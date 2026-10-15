/**
 * Chapter book (chapter-book-v1) — the Encore adapter and the job runner.
 *
 * A volume takes 15-30 minutes, longer than any request may live. The generate
 * endpoint reserves the coin, stores a job and returns; this runner writes the
 * book step by step — plan, then one batch of chapters (text, pictures,
 * publication) per step — and saves its state after every step, so a restart
 * or deploy continues where it stopped. The first batch makes the story
 * readable; later chapters appear while the family reads.
 *
 * Pattern of the runner: backend/doku/audio-automation-core.ts (a DB queue
 * claimed with SKIP LOCKED and polled in-process, because Encore cron does not
 * run in the self-hosted Railway build).
 */

import { appMeta } from "encore.dev";
import { APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { storyDB } from "./db";
import { logTopic } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { refundGenerationUsage } from "../helpers/billing";
import { sanitizeTextWithBlockedTerms } from "../helpers/parental-controls";
import { scrubProfanity } from "../helpers/child-safety";
import { validateAvatarDevelopments } from "../helpers/mcpClient";
import { buildArtifactImageUrlForClient } from "../helpers/image-proxy";
import { assignAvatarDevelopmentIds } from "./avatar-development-assignment";
import { recordStoryArtifact } from "./artifact-matcher";
import { recordBroughtArtifact } from "./artifact-treasury";
import { buildImageCostEntry, buildLlmCostEntry, summarizeStoryCostEntries } from "./pipeline/cost-ledger";
import { resolveOpenRouterApiKey, splitOpenRouterCostUSD } from "./openrouter-generation";
import { enrichStoryForTTS } from "./tts-enrichment";
import { encoreImageProvider, IMAGE_MODEL, readableReference } from "./storybook-mode-generation";
import { normalizeAgeBand } from "./storybook/craft";
import { buildBrief } from "./storybook/context";
import { loadArtifactOptions, loadPoolRows, recordCastUsage } from "./storybook/casting";
import { loadHeroMemories, loadStorybookHistory } from "./storybook/history";
import { CostLedger, resolveStorybookModels, type StorybookStageLog } from "./storybook/llm";
import { createOpenRouterStorybookLlm } from "./storybook/llm-openrouter";
import { castAppearance, describeReferenceLooks, heroAppearance, speciesFromProfile, type VisualEntity } from "./storybook/illustration-stage";
import { runDevelopmentStage } from "./storybook/developments";
import { artifactHeadToken, countWords } from "./storybook/checks";
import type { StorybookHero, StoryElement } from "./storybook/types";
import { bookLengthBudget, resolveBookBudget, resolveExperienceForm } from "./storybook/book/budget";
import { buildCatalogue } from "./storybook/book/catalogue";
import { buildSeriesMemory, planBook, resolveBookPlanner, writeBook, type BookContext, type PlannedBook } from "./storybook/book/engine";
import { illustrateBatch, type BatchImagesResult, type BookImage } from "./storybook/book/illustrations";
import { createOpenRouterJevPort } from "./storybook/jev-openrouter";
import { emptyBookState, type BookBrief, type BookState, type SeriesMemory } from "./storybook/book/types";
import type { StoryConfig } from "./generate";

export const CHAPTER_BOOK_PIPELINE_ID = "chapter-book-v1";

const mcpServerApiKey = secret("MCPServerAPIKey");
const STALE_RUNNING_MINUTES = 25;
const MAX_ATTEMPTS = 3;
const MAX_CONCURRENT = Math.max(1, Math.min(4, Number(process.env.TALEA_BOOK_JOB_CONCURRENCY) || 2));
const BATCH_SIZE = 3;

export interface BookJobInput {
  storyId: string;
  userId: string;
  profileId?: string;
  config: StoryConfig & { bookChapters?: number; bookImagesPerChapter?: number; experienceForm?: string };
  heroes: StorybookHero[];
  blockedTerms: string[];
  series?: { seriesId: string; memory: SeriesMemory } | null;
  continuation?: { teaser?: string; wish?: string } | null;
}

/** PlannedBook without the catalogue (the whole pool is only needed for casting). */
interface StoredPlan extends Omit<PlannedBook, "brief"> {
  brief: Omit<BookBrief, "catalogue">;
}

interface BookJobState {
  planned?: StoredPlan;
  book?: BookState;
  images?: BookImage[];
  coverUrl?: string;
  storyElements?: StoryElement[];
  slot?: number;
  stages?: StorybookStageLog[];
  imageCostUSD?: number;
  imageCalls?: number;
  /** Pictures that needed more than one attempt, with the checker's reasons. */
  imageRedraws?: NonNullable<BatchImagesResult["redraws"]>;
  published?: number;
  startedAt?: string;
}

interface JobRow {
  story_id: string;
  user_id: string;
  status: string;
  stage: string;
  input: any;
  state: any;
  attempts: number;
}

function json<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === "object") return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

async function logStage(storyId: string, stage: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await publishWithTimeout(logTopic as any, {
      source: "storybook-generation-stage",
      timestamp: new Date(),
      request: { pipeline: CHAPTER_BOOK_PIPELINE_ID, stage, storyId },
      response: payload,
      metadata: { pipeline: CHAPTER_BOOK_PIPELINE_ID, stage, storyId },
    });
  } catch {
    // Logging never takes a book down.
  }
}

// ---------------------------------------------------------------------------
// Schema (also in migration 43; kept here because Railway has skipped
// migration files before — see CLAUDE.md "Running Database Migrations Manually")
// ---------------------------------------------------------------------------

let schemaReady: Promise<void> | null = null;
async function ensureBookSchema(): Promise<void> {
  schemaReady ||= (async () => {
    await storyDB.exec`CREATE TABLE IF NOT EXISTS story_series (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, profile_id TEXT, title TEXT NOT NULL DEFAULT '', memory JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
    await storyDB.exec`ALTER TABLE stories ADD COLUMN IF NOT EXISTS series_id TEXT`;
    await storyDB.exec`ALTER TABLE stories ADD COLUMN IF NOT EXISTS series_volume INTEGER`;
    await storyDB.exec`ALTER TABLE chapters ADD COLUMN IF NOT EXISTS images JSONB`;
    await storyDB.exec`
      CREATE TABLE IF NOT EXISTS story_book_jobs (
        story_id TEXT PRIMARY KEY REFERENCES stories(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'waiting', 'done', 'failed')),
        stage TEXT NOT NULL DEFAULT 'queued',
        input JSONB NOT NULL,
        state JSONB NOT NULL DEFAULT '{}'::jsonb,
        attempts INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        finished_at TIMESTAMP
      )
    `;
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

// ---------------------------------------------------------------------------
// Entry point for /story/generate
// ---------------------------------------------------------------------------

/** Stores the job; the coin stays reserved until the first chapters are published or the job gives up. */
export async function enqueueChapterBook(input: BookJobInput): Promise<void> {
  await ensureBookSchema();
  await storyDB.exec`
    INSERT INTO story_book_jobs (story_id, user_id, status, stage, input, state)
    VALUES (${input.storyId}, ${input.userId}, 'queued', 'queued', (${JSON.stringify(input)}::jsonb #>> '{}')::jsonb, (${JSON.stringify({ startedAt: new Date().toISOString() })}::jsonb #>> '{}')::jsonb)
    ON CONFLICT (story_id) DO NOTHING
  `;
  await logStage(input.storyId, "queued", { heroes: input.heroes.map((hero) => hero.name), chapters: input.config.bookChapters, form: input.config.experienceForm });
  startBookRunner();
  void pumpBookQueue();
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

let activeJobs = 0;
let pumping = false;

async function recoverStaleJobs(): Promise<void> {
  await storyDB.exec`
    UPDATE story_book_jobs SET status = 'queued', stage = 'requeued', updated_at = CURRENT_TIMESTAMP
    WHERE status = 'running' AND updated_at < CURRENT_TIMESTAMP - make_interval(mins => ${STALE_RUNNING_MINUTES}) AND attempts < ${MAX_ATTEMPTS}
  `;
  const dead = await storyDB.queryAll<JobRow>`
    UPDATE story_book_jobs SET status = 'failed', error = 'Abgebrochen (Server-Neustart?) und Versuche aufgebraucht.', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE status = 'running' AND updated_at < CURRENT_TIMESTAMP - make_interval(mins => ${STALE_RUNNING_MINUTES}) AND attempts >= ${MAX_ATTEMPTS}
    RETURNING *
  `;
  for (const row of dead) await giveUp(row, "Abgebrochen (Server-Neustart?) und Versuche aufgebraucht.");
}

async function claimNextJob(): Promise<JobRow | null> {
  return await storyDB.queryRow<JobRow>`
    UPDATE story_book_jobs
    SET status = 'running', attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP, error = NULL
    WHERE story_id = (
      SELECT story_id FROM story_book_jobs WHERE status = 'queued' ORDER BY updated_at, story_id LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;
}

export async function pumpBookQueue(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    await ensureBookSchema();
    await recoverStaleJobs();
    while (activeJobs < MAX_CONCURRENT) {
      const row = await claimNextJob();
      if (!row) break;
      activeJobs += 1;
      void runJobStep(row).finally(() => {
        activeJobs -= 1;
        void pumpBookQueue();
      });
    }
  } catch (err) {
    console.error("[book] queue pump failed:", (err as Error)?.message || err);
  } finally {
    pumping = false;
  }
}

let runnerStarted = false;
export function startBookRunner(): void {
  if (runnerStarted) return;
  try {
    if (appMeta().environment.type === "test") return;
  } catch {
    // appMeta unavailable outside the Encore runtime
  }
  runnerStarted = true;
  setTimeout(() => void pumpBookQueue(), 15_000).unref?.();
  setInterval(() => void pumpBookQueue(), 60_000).unref?.();
}

// ---------------------------------------------------------------------------
// One step
// ---------------------------------------------------------------------------

function seedFor(input: BookJobInput): string {
  return `${input.storyId}:${input.heroes.map((hero) => hero.name).join("|")}`.slice(0, 120);
}

async function buildBookBrief(input: BookJobInput): Promise<BookBrief> {
  const { config } = input;
  const band = normalizeAgeBand(config.ageGroup);
  const book = resolveBookBudget(band, { chapters: config.bookChapters, imagesPerChapter: config.bookImagesPerChapter });
  const seed = seedFor(input);
  const avatarIds = input.heroes.map((hero) => String(hero.id || "")).filter(Boolean);
  const [history, heroMemories, rows, artifacts] = await Promise.all([
    loadStorybookHistory({ userId: input.userId, currentStoryId: input.storyId }),
    loadHeroMemories(avatarIds),
    config.useCharacterPool === false ? Promise.resolve([]) : loadPoolRows(),
    loadArtifactOptions({ avatarIds, brought: config.broughtArtifact, genre: config.genre, language: config.language, seed }),
  ]);
  const excludeNames = new Set(input.heroes.map((hero) => hero.name.toLocaleLowerCase("de-DE")));
  const base = buildBrief({
    config, band, budget: bookLengthBudget(book), heroes: input.heroes, candidates: [], artifacts,
    // A sequel must not steer away from its own series.
    recentStories: input.series ? [] : history.recentStories,
    recentEngineIds: history.recentEngineIds, heroMemories, blockedTerms: input.blockedTerms, seed,
  });
  return {
    ...base,
    book,
    form: resolveExperienceForm(config as any),
    catalogue: buildCatalogue({ rows, genre: config.genre, setting: config.setting, band, excludeNames, seed }),
    series: input.series?.memory || null,
    continuation: input.continuation || null,
    bookExperiment: {
      // Luna low plans the volume (TALEA_BOOK_PLANNER_MODEL=writer: Sol plans again; TALEA_BOOK_PLAN_EFFORT overrides the effort).
      ...resolveBookPlanner(process.env.TALEA_BOOK_PLANNER_MODEL || undefined, process.env.TALEA_BOOK_PLAN_EFFORT || undefined),
      chapterEffort: (process.env.TALEA_BOOK_CHAPTER_EFFORT as any) || undefined,
    },
  };
}

function plannedFromState(stored: StoredPlan): PlannedBook {
  return { ...stored, brief: { ...stored.brief, catalogue: [] } };
}

/** Child safety and parental terms on every text that reaches the reader. */
function cleanForReader(text: string, blockedTerms: string[]): string {
  const parental = blockedTerms.length ? sanitizeTextWithBlockedTerms(text, blockedTerms).text : text;
  return scrubProfanity(parental).text;
}

async function entitiesFor(planned: PlannedBook): Promise<VisualEntity[]> {
  const entities: VisualEntity[] = [];
  for (const hero of planned.brief.heroes) {
    const { species, isHuman } = speciesFromProfile(hero.visualProfile, "human");
    entities.push({
      id: hero.id, name: hero.name, kind: "character", role: "hero", species, isHuman,
      appearance: heroAppearance(hero.visualProfile, ""),
      forbidden: Array.isArray(hero.visualProfile?.forbiddenFeatures) ? hero.visualProfile.forbiddenFeatures.map(String) : [],
      referenceUrl: await readableReference(hero.imageUrl), referenceKey: hero.imageUrl,
    });
  }
  for (const member of planned.brief.candidates) {
    const { species, isHuman } = speciesFromProfile(member.visualProfile, member.species);
    entities.push({
      id: member.id, name: member.name, kind: "character", role: "cast", species, isHuman,
      appearance: castAppearance(member.visualProfile, member.physicalDescription), forbidden: [],
      referenceUrl: await readableReference(member.imageUrl), referenceKey: member.imageUrl,
    });
  }
  return entities;
}

async function saveState(storyId: string, state: BookJobState, stage: string, status: "queued" | "running" | "waiting" | "done"): Promise<void> {
  await storyDB.exec`
    UPDATE story_book_jobs
    SET state = (${JSON.stringify(state)}::jsonb #>> '{}')::jsonb, stage = ${stage}, status = ${status}, updated_at = CURRENT_TIMESTAMP,
        attempts = CASE WHEN ${status} = 'queued' THEN 0 ELSE attempts END,
        finished_at = CASE WHEN ${status} = 'done' THEN CURRENT_TIMESTAMP ELSE finished_at END
    WHERE story_id = ${storyId}
  `;
}

function readerMetadata(planned: PlannedBook, state: BookJobState, phase: "writing" | "complete" | "stalled"): Record<string, any> {
  const book = state.book || emptyBookState();
  return {
    format: "chapter-book",
    chaptersPlanned: planned.brief.book.chapters,
    chaptersReady: book.chapters.length,
    state: phase,
    form: planned.brief.form,
    // Recaps only of chapters that exist; the reader shows those already read.
    recaps: book.chapters.map((chapter) => ({ chapter: chapter.order, recap: chapter.recap })),
    ...(phase === "complete" ? { teasers: planned.plan.sequelTeasers } : {}),
  };
}

function adminMetrics(state: BookJobState) {
  const stages = state.stages || [];
  const entries = [
    ...stages.map((stage) => {
      const usage = stage.usage;
      if (!usage) return null;
      const model = stage.modelUsed || "openai/gpt-6.1-sol";
      const split = splitOpenRouterCostUSD(Number(usage.costUSD || 0), model, Number(usage.prompt || 0), Number(usage.completion || 0));
      return buildLlmCostEntry({
        phase: "chapter-book-generation", step: stage.stage,
        usage: { promptTokens: usage.prompt, completionTokens: usage.completion, cachedPromptTokens: Number(usage.cachedPromptTokens || 0), totalTokens: usage.total, model, inputCostUSD: split.inputCostUSD, outputCostUSD: split.outputCostUSD, totalCostUSD: Number(usage.costUSD || 0) },
        fallbackModel: model, success: true, metadata: { durationMs: stage.durationMs, modelRole: stage.modelRole, costSource: "provider-reported" },
      });
    }),
    ...((state.imageCalls || 0) > 0 ? [buildImageCostEntry({ phase: "chapter-book-generation", step: "runware-images", provider: "runware", model: IMAGE_MODEL, success: (state.images || []).length > 0, itemCount: state.imageCalls, providerCostUSD: state.imageCostUSD || 0, metadata: { source: "runware-response" } })] : []),
  ].filter(Boolean) as any[];
  const summary = summarizeStoryCostEntries(entries);
  return {
    summary,
    metrics: {
      version: 1 as const,
      currency: "USD" as const,
      calculatedAt: new Date().toISOString(),
      tokens: { input: summary.totals.llm.inputTokens || 0, cachedInput: summary.totals.llm.cachedInputTokens || 0, output: summary.totals.llm.outputTokens || 0, total: summary.totals.llm.totalTokens || 0 },
      costs: {
        cachedInputUSD: summary.totals.llm.cachedInputCostUSD || 0, inputUSD: summary.totals.llm.inputCostUSD || 0, outputUSD: summary.totals.llm.outputCostUSD || 0,
        storyUSD: summary.totals.llm.totalCostUSD || 0, imagesUSD: summary.totals.images.providerCostUSD || 0, totalUSD: summary.totals.overall.trackedCostUSD || 0,
        imageCredits: summary.totals.images.providerCostCredits || 0,
      },
      calls: { llm: summary.totals.llm.calls || 0, images: state.imageCalls || 0 },
      durationMs: stages.reduce((sum, stage) => sum + Math.max(0, Number(stage.durationMs || 0)), 0),
      imageCostEstimated: false,
      stages: (summary.breakdown.byStep as any[]).map((row) => ({ key: String(row?.key || "unknown"), calls: Number(row?.calls || 0), inputTokens: Number(row?.inputTokens || 0), outputTokens: Number(row?.outputTokens || 0), totalTokens: Number(row?.totalTokens || 0), totalCostUSD: Number(((row?.totalCostUSD || 0) + (row?.providerCostUSD || 0)).toFixed(6)) })),
      models: (summary.breakdown.byModel as any[]).map((row) => ({ key: String(row?.key || "unknown"), calls: Number(row?.calls || 0), inputTokens: Number(row?.inputTokens || 0), outputTokens: Number(row?.outputTokens || 0), totalTokens: Number(row?.totalTokens || 0), totalCostUSD: Number(((row?.totalCostUSD || 0) + (row?.providerCostUSD || 0)).toFixed(6)) })),
    },
  };
}

async function writeStoryMetadata(storyId: string, input: BookJobInput, planned: PlannedBook, state: BookJobState, phase: "writing" | "complete" | "stalled"): Promise<Record<string, any>> {
  const row = await storyDB.queryRow<{ metadata: any }>`SELECT metadata FROM stories WHERE id = ${storyId}`;
  const previous = json<Record<string, any>>(row?.metadata, {});
  const { metrics } = adminMetrics(state);
  const book = state.book || emptyBookState();
  const metadata = {
    ...previous,
    pipeline: CHAPTER_BOOK_PIPELINE_ID,
    generationMode: CHAPTER_BOOK_PIPELINE_ID,
    displayMode: "chapters",
    model: planned.brief.config.openRouterModel,
    storyModel: resolveStorybookModels(input.config).writer,
    imageModel: IMAGE_MODEL,
    imagesGenerated: (state.images || []).length,
    imageCostUSD: state.imageCostUSD || 0,
    characterPoolUsed: planned.brief.candidates.map((member) => ({ characterId: member.id, characterName: member.name })),
    totalCost: { text: metrics.costs.storyUSD, images: metrics.costs.imagesUSD, total: metrics.costs.totalUSD },
    adminGenerationMetrics: metrics,
    book: readerMetadata(planned, state, phase),
    // Admin only (metadata-visibility.ts strips it): the plan knows the future.
    bookAdmin: {
      plan: planned.plan,
      planReview: planned.planReview,
      planIssues: planned.planIssues,
      casting: planned.casting.roles,
      curve: book.curve,
      openIssues: book.openIssues,
      imageRedraws: state.imageRedraws || [],
      wordCount: book.chapters.reduce((sum, chapter) => sum + countWords(chapter.content), 0),
    },
  };
  await storyDB.exec`UPDATE stories SET metadata = ${JSON.stringify(metadata)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${storyId}`;
  return metadata;
}

async function runJobStep(row: JobRow): Promise<void> {
  const input = json<BookJobInput>(row.input, null as any);
  const state = json<BookJobState>(row.state, {});
  const storyId = row.story_id;
  try {
    const ledger = new CostLedger();
    const llm = createOpenRouterStorybookLlm({ onFailedAttempt: (request, billed) => { if (billed) ledger.recordCall(`${request.stage}-failed`, billed, request.role); } });
    const models = resolveStorybookModels(input.config, { critic: process.env.TALEA_STORYBOOK_CRITIC_MODEL || undefined });
    const keepCosts = () => { state.stages = [...(state.stages || []), ...ledger.all()]; };

    // Step 1: idea, casting, plan.
    if (!state.planned) {
      const brief = await buildBookBrief(input);
      const ctx: BookContext = { llm, brief, models, ledger, observe: (stage, payload) => logStage(storyId, stage, payload) };
      const planned = await planBook(ctx);
      const { catalogue: _catalogue, ...storedBrief } = planned.brief;
      state.planned = { ...planned, brief: storedBrief };
      state.book = emptyBookState();
      keepCosts();
      await saveState(storyId, state, "planned", "queued");
      await storyDB.exec`UPDATE stories SET updated_at = CURRENT_TIMESTAMP WHERE id = ${storyId}`;
      return;
    }

    // Step 2..n: one batch of chapters with pictures, then publication.
    const planned = plannedFromState(state.planned);
    const total = planned.brief.book.chapters;
    const book = state.book || emptyBookState();
    if (book.chapters.length < total) {
      const ctx: BookContext = { llm, brief: planned.brief, models, ledger, observe: (stage, payload) => logStage(storyId, stage, payload) };
      const from = book.chapters.length + 1;
      const to = Math.min(total, from + BATCH_SIZE - 1);
      const next = await writeBook(ctx, planned, book, to);
      const fresh = next.chapters.filter((chapter) => chapter.order >= from && chapter.order <= to);
      // TALEA_BOOK_IMAGES=off: text-only books (local smoke test, emergency switch when the image provider is down).
      const pictures = process.env.TALEA_BOOK_IMAGES === "off"
        ? { images: [], missing: [], storyElements: state.storyElements || [], imageCostUSD: 0, imagesGenerated: 0, coverUrl: undefined }
        : await (async () => {
            const entities = await describeReferenceLooks(llm, await entitiesFor(planned), models.support);
            if (entities.call) ledger.recordCall("reference-looks", entities.call, "support");
            return illustrateBatch({
              llm, models, ledger, brief: planned.brief, plan: planned.plan, chapters: fresh, entities: entities.entities,
              provider: encoreImageProvider(storyId), seed: seedFor(input), withCover: from === 1, fixedElements: state.storyElements, startSlot: state.slot || 1,
              jev: createOpenRouterJevPort(resolveOpenRouterApiKey),
            });
          })();
      state.book = next;
      state.images = [...(state.images || []).filter((image) => image.chapter < from || image.chapter > to), ...pictures.images];
      state.storyElements = pictures.storyElements;
      state.slot = (state.slot || 1) + fresh.length * planned.brief.book.imagesPerChapter;
      state.imageCostUSD = Number(((state.imageCostUSD || 0) + pictures.imageCostUSD).toFixed(6));
      state.imageCalls = (state.imageCalls || 0) + ("imageCalls" in pictures && pictures.imageCalls ? pictures.imageCalls : pictures.imagesGenerated);
      if ("redraws" in pictures && pictures.redraws?.length) state.imageRedraws = [...(state.imageRedraws || []), ...pictures.redraws];
      if (pictures.coverUrl) state.coverUrl = pictures.coverUrl;
      keepCosts();
      await publishChapters(input, planned, state, from, to);
      const done = next.chapters.length >= total;
      // Write-ahead: an abandoned book stops costing money a few chapters past the reader.
      const pause = !done && writeAheadPolicy() === "buffer" && next.chapters.length >= (await readerChapter(storyId, total)) + WRITE_AHEAD_BUFFER;
      await saveState(storyId, state, done ? "finishing" : pause ? `waiting-after-${to}` : `chapters-${to}`, pause ? "waiting" : "queued");
      return;
    }

    // Last step: developments, artifact, series memory, costs.
    await finishBook(input, planned, state, { llm, models, ledger });
    keepCosts();
    await writeStoryMetadata(storyId, input, planned, state, "complete");
    await saveState(storyId, state, "done", "done");
    await publishCosts(input, planned, state);
  } catch (err) {
    const message = String((err as Error)?.message || err).slice(0, 500);
    console.error(`[book] step failed for ${storyId}:`, message);
    await logStage(storyId, "step-failed", { message, attempts: row.attempts, stage: row.stage });
    if (row.attempts >= MAX_ATTEMPTS) {
      await storyDB.exec`UPDATE story_book_jobs SET status = 'failed', error = ${message}, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE story_id = ${storyId}`;
      await giveUp({ ...row, state }, message);
    } else {
      await storyDB.exec`UPDATE story_book_jobs SET status = 'queued', error = ${message}, updated_at = CURRENT_TIMESTAMP WHERE story_id = ${storyId}`;
    }
  }
}

/** Nothing published yet: the story fails and the coin goes back. Otherwise the book stays readable and stalls. */
async function giveUp(row: JobRow, message: string): Promise<void> {
  const state = json<BookJobState>(row.state, {});
  const input = json<BookJobInput>(row.input, null as any);
  if (!state.published) {
    await storyDB.exec`UPDATE stories SET status = 'error', updated_at = CURRENT_TIMESTAMP WHERE id = ${row.story_id} AND status <> 'complete'`;
    await refundGenerationUsage({ userId: row.user_id, kind: "story", contentRef: row.story_id, reason: message.slice(0, 200) });
    return;
  }
  if (!state.planned || !input) return;
  const planned = plannedFromState(state.planned);
  // Every chapter is published and only the extras failed: the book is readable to the end and finishes.
  const complete = (state.book?.chapters.length || 0) >= planned.brief.book.chapters;
  await writeStoryMetadata(row.story_id, input, planned, state, complete ? "complete" : "stalled");
}

async function publishChapters(input: BookJobInput, planned: PlannedBook, state: BookJobState, from: number, to: number): Promise<void> {
  const storyId = input.storyId;
  const chapters = (state.book?.chapters || []).filter((chapter) => chapter.order >= from && chapter.order <= to);
  const now = new Date();
  const inserted: Array<{ id: string; title: string; content: string; order: number }> = [];
  await using tx = await storyDB.begin();
  // Idempotent: a repeated step replaces its chapters instead of doubling them.
  await tx.exec`DELETE FROM chapters WHERE story_id = ${storyId} AND chapter_order >= ${from} AND chapter_order <= ${to}`;
  for (const chapter of chapters) {
    const images = (state.images || []).filter((image) => image.chapter === chapter.order).map((image) => ({ url: image.url, afterParagraph: image.afterParagraph }));
    const id = crypto.randomUUID();
    const title = cleanForReader(chapter.title, input.blockedTerms);
    const content = cleanForReader(chapter.content, input.blockedTerms);
    await tx.exec`
      INSERT INTO chapters (id, story_id, title, content, image_url, images, chapter_order, created_at)
      VALUES (${id}, ${storyId}, ${title}, ${content}, ${images[0]?.url || null}, (${JSON.stringify(images)}::jsonb #>> '{}')::jsonb, ${chapter.order}, ${now})
    `;
    inserted.push({ id, title, content, order: chapter.order });
  }
  if (from === 1) {
    // The cover always exists: the first clean picture stands in when the cover failed.
    const cover = state.coverUrl || (state.images || []).find((image) => image.status === "passed" && !image.vignette)?.url || null;
    await tx.exec`
      UPDATE stories
      SET title = ${cleanForReader(planned.plan.title, input.blockedTerms)},
          description = ${cleanForReader(planned.plan.description, input.blockedTerms)},
          cover_image_url = ${cover},
          status = 'complete',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${storyId}
    `;
  }
  await tx.commit();
  state.published = Math.max(state.published || 0, to);
  await writeStoryMetadata(storyId, input, planned, state, "writing");
  // Redraw reasons belong in the downloadable log too: "Die segelnden Wörter" drew 34 pictures for 17 places and the log said why in no line.
  const redraws = (state.imageRedraws || []).filter((entry) => entry.chapter >= from && entry.chapter <= to);
  await logStage(storyId, "chapters-published", {
    from, to, images: (state.images || []).filter((image) => image.chapter >= from && image.chapter <= to).length,
    ...(redraws.length ? { redraws: redraws.map((entry) => `K${entry.chapter}.${entry.part}×${entry.attempts}: ${entry.reasons.join("; ") || "?"}`) } : {}),
  });
  enrichStoryForTTS({ storyId, chapters: inserted, aiModel: input.config.aiModel }).catch((error) => {
    console.warn(`[book] TTS enrichment failed (non-blocking): ${(error as Error)?.message || error}`);
  });
}

async function finishBook(input: BookJobInput, planned: PlannedBook, state: BookJobState, deps: { llm: BookContext["llm"]; models: BookContext["models"]; ledger: CostLedger }): Promise<void> {
  const storyId = input.storyId;
  const book = state.book || emptyBookState();
  const ctx: BookContext = { llm: deps.llm, brief: planned.brief, models: deps.models, ledger: deps.ledger };

  // Avatar growth from the chapter recaps (a whole book does not fit the 8,000-character window).
  const development = await runDevelopmentStage(deps.llm, { heroes: planned.brief.heroes, title: planned.plan.title, pages: book.chapters.map((chapter) => ({ order: chapter.order, title: chapter.title, content: `${chapter.title}: ${chapter.recap}` })) }, deps.models.support);
  if (development.call) deps.ledger.recordCall("avatar-development", development.call, "support");
  const avatars = planned.brief.heroes.map((hero) => ({ id: hero.id, name: hero.name }));
  let developments = assignAvatarDevelopmentIds(development.developments as any[], avatars);
  try {
    const validation = await validateAvatarDevelopments(developments, mcpServerApiKey()) as { isValid?: boolean; normalized?: any[] };
    if (validation?.isValid === false) developments = [];
    else if (Array.isArray(validation?.normalized)) developments = assignAvatarDevelopmentIds(validation.normalized, avatars);
  } catch (err) {
    console.warn("[book] avatar development validation unavailable; keeping the clamped developments:", (err as Error)?.message || err);
  }
  await storyDB.exec`UPDATE stories SET avatar_developments = ${JSON.stringify(developments)} WHERE id = ${storyId}`;

  await recordCastUsage(storyId, planned.brief.candidates.map((member) => member.id));

  // Artifact: brought along (journal + level) or found where the text names it.
  const artifact = planned.plan.artifact ? planned.brief.artifacts.find((option) => option.id === planned.plan.artifact!.id) : planned.brief.artifacts.find((option) => option.broughtBy);
  if (artifact) {
    try {
      if (artifact.broughtBy) {
        await recordBroughtArtifact({ storyId, artifactId: artifact.id, avatarId: artifact.broughtBy, chapterCount: book.chapters.length });
      } else {
        const head = artifactHeadToken(artifact.name);
        const found = book.chapters.filter((chapter) => head.length >= 3 && chapter.content.toLocaleLowerCase("de-DE").includes(head)).map((chapter) => chapter.order);
        if (found.length) {
          const usage = found[found.length - 1];
          await recordStoryArtifact(storyId, artifact.id, found[0], usage);
          const row = await storyDB.queryRow<{ metadata: any }>`SELECT metadata FROM stories WHERE id = ${storyId}`;
          const metadata = json<Record<string, any>>(row?.metadata, {});
          metadata.pendingArtifact = {
            id: artifact.id, name: artifact.name, nameEn: artifact.nameEn, description: artifact.description, category: artifact.category, rarity: artifact.rarity,
            storyRole: artifact.rule, visualKeywords: artifact.visualKeywords, emoji: artifact.emoji,
            imageUrl: await buildArtifactImageUrlForClient(artifact.id, artifact.imageUrl), discoveryChapter: found[0], usageChapter: usage, locked: true,
          };
          await storyDB.exec`UPDATE stories SET metadata = ${JSON.stringify(metadata)} WHERE id = ${storyId}`;
        }
      }
    } catch (err) {
      console.warn("[book] could not record the book's artifact:", (err as Error)?.message || err);
    }
  }

  // Series memory for the next volume.
  const memory = await buildSeriesMemory(ctx, planned, book, input.series?.memory || null);
  const seriesId = input.series?.seriesId || crypto.randomUUID();
  await storyDB.exec`
    INSERT INTO story_series (id, user_id, profile_id, title, memory)
    VALUES (${seriesId}, ${input.userId}, ${input.profileId || null}, ${memory.seriesTitle}, (${JSON.stringify(memory)}::jsonb #>> '{}')::jsonb)
    ON CONFLICT (id) DO UPDATE SET memory = EXCLUDED.memory, updated_at = CURRENT_TIMESTAMP
  `;
  await storyDB.exec`UPDATE stories SET series_id = ${seriesId}, series_volume = ${memory.volume} WHERE id = ${storyId}`;
}

async function publishCosts(input: BookJobInput, planned: PlannedBook, state: BookJobState): Promise<void> {
  const { summary } = adminMetrics(state);
  try {
    await publishWithTimeout(logTopic, {
      source: "story-generation-costs" as any,
      timestamp: new Date(),
      request: { storyId: input.storyId, userId: input.userId, model: planned.brief.config.openRouterModel },
      response: {
        title: planned.plan.title,
        pipeline: CHAPTER_BOOK_PIPELINE_ID,
        summary: summary.summary,
        totals: summary.totals,
        breakdown: summary.breakdown,
        chapters: state.book?.chapters.length || 0,
        images: (state.images || []).length,
      },
    });
  } catch {
    // Cost logs never fail a book.
  }
}

/**
 * The next volume of a finished book: same series memory, the child's chosen
 * teaser or wish. Only the owner's own, finished chapter book can be continued.
 */
export async function loadBookContinuation(
  config: Pick<StoryConfig, "continueFromStoryId" | "continuationChoice" | "continuationWish">,
  userId: string,
): Promise<{ series: { seriesId: string; memory: SeriesMemory }; choice: { teaser?: string; wish?: string } } | null> {
  const previousId = String(config.continueFromStoryId || "").trim();
  if (!previousId) return null;
  await ensureBookSchema();
  const previous = await storyDB.queryRow<{ user_id: string; series_id: string | null }>`
    SELECT user_id, series_id FROM stories WHERE id = ${previousId}
  `;
  if (!previous || previous.user_id !== userId) throw APIError.notFound("Der vorige Band wurde nicht gefunden.");
  if (!previous.series_id) throw APIError.failedPrecondition("Der vorige Band ist noch nicht fertig geschrieben.");
  const series = await storyDB.queryRow<{ memory: any }>`SELECT memory FROM story_series WHERE id = ${previous.series_id} AND user_id = ${userId}`;
  if (!series) throw APIError.notFound("Die Buchreihe wurde nicht gefunden.");
  const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 400) || undefined;
  return {
    series: { seriesId: previous.series_id, memory: json<SeriesMemory>(series.memory, null as any) },
    choice: { teaser: clean(config.continuationChoice), wish: clean(config.continuationWish) },
  };
}

// ---------------------------------------------------------------------------
// Write-ahead
// ---------------------------------------------------------------------------

/** Chapters written beyond the furthest reader before the job pauses (one batch takes 3-5 minutes). */
const WRITE_AHEAD_BUFFER = 4;

/** "all" writes the whole volume at once (default); "buffer" writes ahead of the reader only. */
function writeAheadPolicy(): "all" | "buffer" {
  return process.env.TALEA_BOOK_WRITE_AHEAD === "buffer" ? "buffer" : "all";
}

/** The furthest chapter any profile has reached, from the server bookmark (percent of the planned chapters). */
async function readerChapter(storyId: string, planned: number): Promise<number> {
  const row = await storyDB.queryRow<{ pct: number | null }>`
    SELECT MAX(progress_pct)::int AS pct FROM story_profile_state WHERE story_id = ${storyId}
  `;
  return Math.ceil(((row?.pct || 0) / 100) * planned);
}

/**
 * Called with every bookmark update: a paused book continues when the reader
 * comes within the write-ahead buffer of the last written chapter. Cheap and
 * never fatal; does nothing for any other story.
 */
export async function nudgeBookWriter(storyId: string): Promise<void> {
  try {
    await ensureBookSchema();
    const job = await storyDB.queryRow<{ status: string; state: any }>`SELECT status, state FROM story_book_jobs WHERE story_id = ${storyId}`;
    if (job?.status !== "waiting") return;
    const state = json<BookJobState>(job.state, {});
    const planned = state.planned?.brief.book.chapters || 0;
    const written = state.book?.chapters.length || 0;
    if (!planned || written >= (await readerChapter(storyId, planned)) + WRITE_AHEAD_BUFFER) return;
    await storyDB.exec`UPDATE story_book_jobs SET status = 'queued', attempts = 0, updated_at = CURRENT_TIMESTAMP WHERE story_id = ${storyId} AND status = 'waiting'`;
    void pumpBookQueue();
  } catch (err) {
    console.warn("[book] could not nudge the writer:", (err as Error)?.message || err);
  }
}

/** Admin: re-queue a stalled or failed book (it continues after the last published chapter). */
export async function requeueChapterBook(storyId: string): Promise<boolean> {
  await ensureBookSchema();
  const row = await storyDB.queryRow<{ story_id: string }>`
    UPDATE story_book_jobs SET status = 'queued', attempts = 0, error = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE story_id = ${storyId} AND status IN ('failed', 'waiting')
    RETURNING story_id
  `;
  if (row) void pumpBookQueue();
  return Boolean(row);
}

export async function bookJobStatus(storyId: string): Promise<{ status: string; stage: string; error: string | null; attempts: number } | null> {
  await ensureBookSchema();
  return await storyDB.queryRow<{ status: string; stage: string; error: string | null; attempts: number }>`
    SELECT status, stage, error, attempts FROM story_book_jobs WHERE story_id = ${storyId}
  `;
}

startBookRunner();
