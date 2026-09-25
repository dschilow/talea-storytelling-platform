/**
 * Storybook Mode Story Generation (storybook-v2) — the Bilderbuch-Modus.
 *
 * An independent generation lane; it does not import or modify the dev-mode,
 * standard or book-workshop engines. This file is the Encore adapter: it loads
 * what the story needs from the database, runs the pure engine in
 * ./storybook/engine.ts, illustrates the result and records side effects.
 *
 * The lane, in one line per stage (models in ./storybook/llm.ts):
 *
 *   casting      pool shortlist + artifact per wizard (brought = mandatory)
 *   concept      3 pitches on 3 proven picture-book engines        gpt-6-luna
 *   plan         strongest pitch → page plan                       gpt-6-luna
 *   draft        the story                                         wizard model
 *   review       cold read, 0-10 against real picture books        other family
 *   revision     whole story once more with every note             wizard model
 *   final-ab     draft vs revision, blind                          other family
 *   illustration one action shot per page, ≤3 characters           gpt-6-luna
 *   images       per-page identity sheet + vision check + 1 retry  runware + luna
 *   development  trait growth with a reason from the text          gpt-6-luna
 *
 * Why it was rebuilt (storybook-v1, measured): premises came from a bank whose
 * variation axes swapped objects independently and produced incoherent
 * situations; one model wrote, judged and line-edited; a connective quota made
 * the prose stiff; the page images used one sprite of the whole cast, which is
 * how children grew animal ears.
 */

import { createHash } from "crypto";
import { ai } from "~encore/clients";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { logTopic } from "../log/logger";
import { resolveImageUrlForClient } from "../helpers/bucket-storage";
import { buildArtifactImageUrlForClient } from "../helpers/image-proxy";
import { acceptedGeneratedImageUrl } from "../helpers/imageResultGuard";
import { recordStoryArtifact } from "./artifact-matcher";
import { recordBroughtArtifact } from "./artifact-treasury";
import { normalizeAgeBand, resolveLengthBudget } from "./storybook/craft";
import { buildBrief } from "./storybook/context";
import { loadArtifactOptions, loadCastCandidates, recordCastUsage } from "./storybook/casting";
import { loadHeroMemories, loadStorybookHistory } from "./storybook/history";
import { CostLedger, resolveStorybookModels } from "./storybook/llm";
import { createOpenRouterStorybookLlm } from "./storybook/llm-openrouter";
import { runStorybookTextEngine, STORYBOOK_PIPELINE_ID } from "./storybook/engine";
import { castAppearance, heroAppearance, runDirectorStage, speciesFromProfile, type VisualEntity } from "./storybook/illustration-stage";
import { generateStorybookImages, type ImageProvider, type StorybookImagesResult } from "./storybook/images";
import { runDevelopmentStage } from "./storybook/developments";
import { artifactHeadToken, countWords } from "./storybook/checks";
import type { StorybookGeneratedStory, StorybookGenerationInput } from "./storybook/types";

export { STORYBOOK_PIPELINE_ID };
export type { StorybookGenerationInput, StorybookGeneratedStory, StorybookHero } from "./storybook/types";

const IMAGE_MODEL = "runware:400@4";

function stableSeed(input: StorybookGenerationInput): string {
  return createHash("sha256")
    .update([input.storyId || "", input.userId || "", input.heroes.map((hero) => hero.name).join("|"), input.config.genre || "", input.config.setting || ""].join("::"))
    .digest("hex")
    .slice(0, 16);
}

async function logStage(storyId: string | undefined, stage: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await publishWithTimeout(logTopic as any, {
      source: "storybook-generation-stage",
      timestamp: new Date(),
      request: { pipeline: STORYBOOK_PIPELINE_ID, stage, storyId },
      response: payload,
      metadata: { pipeline: STORYBOOK_PIPELINE_ID, stage, storyId },
    });
  } catch {
    // Logging must never take generation down.
  }
}

function pageTitle(language: string | undefined, order: number): string {
  const lang = String(language || "de").toLowerCase();
  if (lang.startsWith("en")) return `Page ${order}`;
  if (lang.startsWith("fr")) return `Page ${order}`;
  if (lang.startsWith("es")) return `Página ${order}`;
  if (lang.startsWith("it")) return `Pagina ${order}`;
  if (lang.startsWith("nl")) return `Pagina ${order}`;
  if (lang.startsWith("ru")) return `Страница ${order}`;
  return `Seite ${order}`;
}

function imageSteps(): number {
  const configured = Number(process.env.TALEA_STORYBOOK_IMAGE_STEPS);
  return Number.isFinite(configured) && configured >= 4 && configured <= 28 ? Math.round(configured) : 4;
}

/** Runware through the ai service; stored URL for the story, readable URL for the vision check. */
function encoreImageProvider(storyId: string | undefined): ImageProvider {
  return async (request) => {
    const image = await ai.generateImage({
      prompt: request.prompt,
      negativePrompt: request.negativePrompt,
      model: IMAGE_MODEL,
      width: request.width,
      height: request.height,
      steps: imageSteps(),
      CFGScale: 4,
      seed: request.seed,
      outputFormat: "JPEG",
      referenceImages: request.referenceImages.length > 0 ? request.referenceImages : undefined,
      logContext: { storyId, stage: request.page === 0 ? "storybook-image-cover" : "storybook-image-page", chapter: request.page || undefined },
    });
    const url = acceptedGeneratedImageUrl(image) || undefined;
    const response = (image as any)?.debugInfo?.responseReceived;
    const rows = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
    const costUSD = rows.reduce((sum: number, row: any) => sum + (Number(row?.cost) > 0 ? Number(row.cost) : 0), 0);
    const viewUrl = url ? await resolveImageUrlForClient(url).catch(() => undefined) : undefined;
    return { url, viewUrl, costUSD };
  };
}

async function readableReference(imageUrl: string | undefined): Promise<string | undefined> {
  if (!imageUrl) return undefined;
  try {
    const resolved = await resolveImageUrlForClient(imageUrl);
    return resolved && /^(https?:|data:image\/)/i.test(resolved) ? resolved : undefined;
  } catch {
    return undefined;
  }
}

export async function generateStoryStorybookMode(input: StorybookGenerationInput): Promise<StorybookGeneratedStory> {
  const startedAt = Date.now();
  const { config } = input;
  const ledger = new CostLedger();
  const models = resolveStorybookModels(config, { critic: process.env.TALEA_STORYBOOK_CRITIC_MODEL || undefined });
  const band = normalizeAgeBand(config.ageGroup);
  const budget = resolveLengthBudget(config.length, band);
  const seed = stableSeed(input);
  const avatarIds = input.heroes.map((hero) => String(hero.id || "")).filter(Boolean);

  // -------------------------------------------------------------------------
  // 0) Everything the story is built from, loaded in parallel.
  // -------------------------------------------------------------------------
  const [history, heroMemories, candidates, artifacts] = await Promise.all([
    loadStorybookHistory({ userId: input.userId, currentStoryId: input.storyId }),
    loadHeroMemories(avatarIds),
    loadCastCandidates({
      enabled: config.useCharacterPool !== false,
      genre: config.genre,
      setting: config.setting,
      band,
      excludeNames: new Set(input.heroes.map((hero) => hero.name.toLocaleLowerCase("de-DE"))),
      seed,
    }),
    loadArtifactOptions({ avatarIds, brought: config.broughtArtifact, genre: config.genre, language: config.language, seed }),
  ]);

  const brief = buildBrief({
    config,
    band,
    budget,
    heroes: input.heroes,
    candidates,
    artifacts,
    recentStories: history.recentStories,
    recentEngineIds: history.recentEngineIds,
    heroMemories,
    blockedTerms: input.blockedTerms,
    seed,
  });

  await logStage(input.storyId, "premise-and-cast", {
    models,
    band,
    budget,
    candidates: candidates.map((candidate) => ({ id: candidate.id, name: candidate.name, species: candidate.species, hasImage: Boolean(candidate.imageUrl) })),
    artifacts: artifacts.map((artifact) => ({ id: artifact.id, name: artifact.name, brought: Boolean(artifact.broughtBy) })),
    recentStories: history.recentStories.length,
  });

  const llm = createOpenRouterStorybookLlm({
    onFailedAttempt: (request, billed) => {
      if (billed) ledger.recordCall(`${request.stage}-failed`, billed, request.role);
    },
  });

  // -------------------------------------------------------------------------
  // 1) Text: concept → plan → draft → review → revision → final A/B.
  // -------------------------------------------------------------------------
  const text = await runStorybookTextEngine({
    llm,
    brief,
    models,
    ledger,
    observe: (stage, payload) => logStage(input.storyId, stage, payload),
  });
  const { plan, pages } = text;

  // -------------------------------------------------------------------------
  // 2) Illustration direction, then images and developments in parallel.
  // -------------------------------------------------------------------------
  const castInStory = plan.cast
    .map((member) => candidates.find((candidate) => candidate.id === member.id))
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
  const artifactOption = plan.artifact ? artifacts.find((artifact) => artifact.id === plan.artifact!.id) : undefined;

  const entities: VisualEntity[] = [];
  for (const hero of brief.heroes) {
    const { species, isHuman } = speciesFromProfile(hero.visualProfile, "human");
    entities.push({
      id: hero.id,
      name: hero.name,
      kind: "character",
      species,
      isHuman,
      appearance: heroAppearance(hero.visualProfile, ""),
      forbidden: Array.isArray(hero.visualProfile?.forbiddenFeatures) ? hero.visualProfile.forbiddenFeatures.map(String) : [],
      referenceUrl: await readableReference(hero.imageUrl),
    });
  }
  for (const member of castInStory) {
    const { species, isHuman } = speciesFromProfile(member.visualProfile, member.species);
    entities.push({
      id: member.id,
      name: member.name,
      kind: "character",
      species,
      isHuman,
      appearance: castAppearance(member.visualProfile, member.physicalDescription),
      forbidden: [],
      referenceUrl: await readableReference(member.imageUrl),
    });
  }
  if (artifactOption && plan.artifact) {
    entities.push({
      id: `artifact:${artifactOption.id}`,
      name: artifactOption.name,
      kind: "artifact",
      species: "object",
      isHuman: false,
      appearance: artifactOption.visualKeywords.join(", ") || artifactOption.nameEn || artifactOption.name,
      forbidden: [],
      referenceUrl: await readableReference(artifactOption.imageUrl),
    });
  }

  const director = await runDirectorStage(llm, { brief, title: text.title, pages, plan, entities }, models.support);
  if (director.call) ledger.recordCall("illustration-direction", director.call, "support");

  const emptyImages: StorybookImagesResult = { pages: new Map(), imagesGenerated: 0, imageCalls: 0, imageCostUSD: 0, qaCalls: [], regenerated: [] };
  const [images, development] = await Promise.all([
    generateStorybookImages({
      illustrations: director.illustrations,
      entities,
      provider: encoreImageProvider(input.storyId),
      seed,
      llm,
      visionModel: process.env.TALEA_STORYBOOK_IMAGE_QA === "off" ? undefined : models.support,
    }).catch((err): StorybookImagesResult => {
      console.warn("[storybook] image stage failed:", err);
      return emptyImages;
    }),
    runDevelopmentStage(llm, { heroes: brief.heroes, title: text.title, pages }, models.support),
  ]);
  images.qaCalls.forEach((call, index) => ledger.recordCall(`image-qa-${index + 1}`, call, "support"));
  if (development.call) ledger.recordCall("avatar-development", development.call, "support");

  // -------------------------------------------------------------------------
  // 3) Side effects: pool rotation, artifact economy.
  // -------------------------------------------------------------------------
  await recordCastUsage(input.storyId, castInStory.map((member) => member.id));

  let pendingArtifact: StorybookGeneratedStory["pendingArtifact"];
  if (plan.artifact && artifactOption && input.storyId) {
    const head = artifactHeadToken(artifactOption.name);
    const pagesWithArtifact = pages.filter((page) => head.length >= 3 && page.content.toLocaleLowerCase("de-DE").includes(head)).map((page) => page.order);
    try {
      if (artifactOption.broughtBy) {
        // Mitnehmen-Loop: journal entry + level track, never a new artifact.
        await recordBroughtArtifact({ storyId: input.storyId, artifactId: artifactOption.id, avatarId: artifactOption.broughtBy, chapterCount: pages.length });
      } else if (pagesWithArtifact.length > 0) {
        // Awarded only when the prose really contains it; otherwise the
        // reader gets the shard fallback from the treasury economy.
        const discoveryChapter = pagesWithArtifact[0];
        const usageChapter = pagesWithArtifact.find((page) => page >= plan.artifact!.usePage) ?? pagesWithArtifact[pagesWithArtifact.length - 1];
        await recordStoryArtifact(input.storyId, artifactOption.id, discoveryChapter, usageChapter);
        pendingArtifact = {
          id: artifactOption.id,
          name: artifactOption.name,
          nameEn: artifactOption.nameEn,
          description: artifactOption.description,
          category: artifactOption.category,
          rarity: artifactOption.rarity,
          storyRole: artifactOption.rule,
          visualKeywords: artifactOption.visualKeywords,
          emoji: artifactOption.emoji,
          imageUrl: await buildArtifactImageUrlForClient(artifactOption.id, artifactOption.imageUrl),
          discoveryChapter,
          usageChapter,
          locked: true,
        };
      }
    } catch (err) {
      console.warn("[storybook] could not record the story artifact:", err);
    }
  }

  // -------------------------------------------------------------------------
  // 4) Assemble.
  // -------------------------------------------------------------------------
  const totals = ledger.totals();
  const wordCount = pages.reduce((sum, page) => sum + countWords(page.content), 0);
  const durationMs = Date.now() - startedAt;
  const releaseReady = text.finalChecks.hard.length === 0;
  const chapters = pages.map((page) => {
    const image = images.pages.get(page.order);
    return {
      id: `storybook-${page.order}`,
      title: pageTitle(config.language, page.order),
      content: page.content,
      order: page.order,
      imageUrl: image?.url,
      imagePrompt: image?.prompt,
      imageModel: image?.url ? IMAGE_MODEL : undefined,
    };
  });

  const metadata: Record<string, any> = {
    pipeline: STORYBOOK_PIPELINE_ID,
    generationMode: STORYBOOK_PIPELINE_ID,
    model: models.writer,
    storyModel: models.writer,
    supportModel: models.support,
    criticModel: models.critic,
    processingTime: durationMs,
    displayMode: "reading_pages",
    imagesGenerated: images.imagesGenerated,
    imageCalls: images.imageCalls,
    imageCostUSD: images.imageCostUSD,
    tokensUsed: { prompt: totals.prompt, completion: totals.completion, total: totals.total, totalCostUSD: totals.costUSD, modelUsed: models.writer },
    devModeStages: ledger.all(),
    releaseReady,
    quality: {
      benchmarkScore: text.benchmarkScore,
      draftScore: text.draftScore,
      scale: "0-10 vs. published top picture books",
      releaseReady,
    },
    storybook: {
      engine: plan.engine,
      logline: plan.logline,
      band,
      pages: pages.length,
      wordCount,
      llmCalls: totals.calls,
      chosen: text.chosen,
      planRepaired: text.planRepaired,
      draftRetried: text.draftRetried,
      benchmarkScore: text.benchmarkScore,
      draftScore: text.draftScore,
      review: text.review,
      pairwise: text.pairwise,
      castUsed: castInStory.map((member) => ({ id: member.id, name: member.name })),
      artifact: plan.artifact ? { ...plan.artifact, awarded: Boolean(pendingArtifact) } : null,
      hardIssues: text.finalChecks.hard.map((issue) => issue.message),
      softIssues: text.finalChecks.soft.map((issue) => issue.message),
      imageRegenerations: images.regenerated,
      imageQa: [...images.pages.values(), ...(images.cover ? [images.cover] : [])].map((outcome) => ({ page: outcome.page, attempts: outcome.attempts, severity: outcome.severity, qa: outcome.qa })),
      pitches: text.pitches.map((pitch) => ({ engine: pitch.engine, title: pitch.title, logline: pitch.logline })),
      plan,
    },
  };

  await logStage(input.storyId, "complete", {
    title: text.title,
    pages: pages.length,
    wordCount,
    llmCalls: totals.calls,
    textCostUSD: totals.costUSD,
    imageCostUSD: images.imageCostUSD,
    totalCostUSD: Number((totals.costUSD + images.imageCostUSD).toFixed(6)),
    benchmarkScore: text.benchmarkScore,
    draftScore: text.draftScore,
    chosen: text.chosen,
    releaseReady,
    durationMs,
  });

  return {
    title: text.title,
    description: text.description,
    coverImageUrl: images.cover?.url,
    displayMode: "reading_pages",
    chapters,
    avatarDevelopments: development.developments,
    pendingArtifact,
    metadata,
  };
}
