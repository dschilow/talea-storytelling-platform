/**
 * Chapter book (chapter-book-v1) — the text engine.
 *
 *   pitch + casting (writer) → plan (writer) → plan checks + plan review (critic, other family)
 *   → one plan revision (writer) → per batch: chapters (writer) → checks → critic read
 *   → one rewrite of chapters without laugh/hook/progress (writer) → patch (support)
 *   → logbook from the released text (support) → … → series memory (support)
 *
 * Encore-free like the storybook engine: the LLM is a port, state is plain
 * data, so the job can stop after any batch and continue later.
 */


import { isGerman } from "../craft";
import { STORYBOOK_SUPPORT_MODEL, fallbackModelFor, modelFamily, parseJsonObject, type CostLedger, type LlmCallResult, type LlmRequest, type StorybookLlm, type StorybookModels } from "../llm";
import { mentionsName, resolveCasting, type CastingResult } from "./catalogue";
import { checkChapter, mergeChapterPatch, mergeOpenThreads, mergeWorldState, mergeWordings, parseChapterCritique, parseChapters, quoteInText, type ChapterCritiqueResult } from "./chapters";
import { buildColdReadPrompt, coldReadNotes, coldReadQuestions, unansweredQuestions } from "./coldread";
import { checkBookPlan, mergePlanRevision, parsePitch, parsePlan, parsePlanReview } from "./plan";
import {
  buildChapterCritiquePrompt,
  buildChapterPatchPrompt,
  buildChapterRewriteNote,
  buildChapterSystemWithContext,
  buildChapterUserPrompt,
  buildLogbookPrompt,
  buildPitchPrompt,
  buildPlanPrompt,
  buildPlanReviewPrompt,
  buildPlanRevisionPrompt,
  buildSeriesMemoryPrompt,
  heroRelation,
  planReviewNotes,
} from "./prompts";
import type { BookBrief, BookChapter, BookExperiment, BookPitch, BookPlan, BookState, ChapterCurvePoint, PlanReview, SeriesMemory } from "./types";

export interface BookContext {
  llm: StorybookLlm;
  brief: BookBrief;
  models: StorybookModels;
  ledger: CostLedger;
  observe?: (stage: string, payload: Record<string, unknown>) => void | Promise<void>;
}

export interface PlannedBook {
  pitch: BookPitch | null;
  casting: CastingResult;
  plan: BookPlan;
  planReview: PlanReview | null;
  /** Deterministic plan defects left after the revision. */
  planIssues: string[];
  planRevised: boolean;
  /** The brief with `candidates` = the chosen cast. Every later stage uses this one. */
  brief: BookBrief;
}

async function call(ctx: BookContext, request: LlmRequest): Promise<LlmCallResult> {
  const result = await ctx.llm(request);
  ctx.ledger.recordCall(request.stage, result, request.role);
  return result;
}

async function observe(ctx: BookContext, stage: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await ctx.observe?.(stage, payload);
  } catch {
    // Observers never change the book.
  }
}

/** One JSON call with a single retry when the reply is not the expected object. */
async function jsonCall<T>(ctx: BookContext, request: LlmRequest, parse: (raw: any) => T | null, retryModel?: string): Promise<T | null> {
  const first = await call(ctx, request);
  const parsed = parse(parseJsonObject<any>(first.text));
  if (parsed) return parsed;
  const second = await call(ctx, {
    ...request,
    stage: `${request.stage}-retry`,
    model: retryModel || request.model,
    user: `${request.user}\n\nYour previous answer was not the requested JSON object. Return only the complete JSON object.`,
  });
  return parse(parseJsonObject<any>(second.text));
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

/**
 * Who plans a chapter book. Measured 2026-10-15: Luna at effort "low" plans for about 1 cent what Sol
 * plans for about 12 cents, and Sol still wrote its chapters without a rewrite (Luna medium and
 * Luna-pro scored higher on the plan review but caused rewrites in 5 of 6 chapters). "writer" puts
 * the plan back on the writer model.
 */
export function resolveBookPlanner(model?: string, effort?: string): Pick<BookExperiment, "plannerModel" | "planEffort"> {
  const plannerModel = !model ? STORYBOOK_SUPPORT_MODEL : model === "writer" ? undefined : model;
  const planEffort = (effort as BookExperiment["planEffort"]) || (plannerModel === STORYBOOK_SUPPORT_MODEL ? "low" : undefined);
  return { plannerModel, planEffort };
}

export async function planBook(ctx: BookContext): Promise<PlannedBook> {
  const { brief, models } = ctx;
  const experiment = brief.bookExperiment || {};
  // User idea 2026-10-14: a cheaper model plans, Sol only writes. Measured in phase A.
  const planner = experiment.plannerModel || models.writer;
  // The plan critic must never be the planner's twin.
  const planCritic = modelFamily(planner) === modelFamily(models.critic) ? models.support : models.critic;
  // A cheap planner that fails goes to the writer: the default fallback (Flash-Lite) planned 4/10 books.
  const plannerFallback = planner !== models.writer ? models.writer : undefined;

  const pitchPrompt = buildPitchPrompt(brief);
  const pitch = await jsonCall(ctx, {
    stage: "book-pitch", role: "writer", model: planner, system: pitchPrompt.system, user: pitchPrompt.user,
    json: true, maxTokens: 7000, effort: "low", timeoutMs: 240_000, temperature: 0.9, fallbackModel: plannerFallback,
  }, parsePitch, plannerFallback);
  const idea = pitch?.ideas[pitch.choice - 1];
  if (!idea) throw new Error("[book] Die Buchidee konnte nicht entwickelt werden. Bitte erneut versuchen.");

  let casting = resolveCasting(idea, brief.catalogue, brief.book.maxPoolCast, brief.series);
  // Pool characters are part of the product: an idea without any gets the best-fitting companion.
  if (casting.cast.length === 0 && brief.catalogue.length > 0) {
    const fallback = brief.catalogue[0];
    casting = { cast: [fallback], roles: [{ id: fallback.id, role: "Begleiter", why: "passt am besten zum Genre" }], notes: [...casting.notes, "Keine gültige Besetzung — bestpassende Pool-Figur als Begleiter gesetzt."] };
  }
  const castBrief: BookBrief = { ...brief, candidates: casting.cast };
  await observe(ctx, "pitch", { ideas: pitch!.ideas.map((entry) => entry.title), choice: pitch!.choice, cast: casting.roles, notes: casting.notes });

  const planPrompt = buildPlanPrompt(castBrief, idea, casting.cast, casting.roles);
  const planRequest: LlmRequest = {
    stage: "book-plan", role: "writer", model: planner, system: planPrompt.system, user: planPrompt.user,
    json: true, maxTokens: 14000 + brief.book.chapters * 300, effort: experiment.planEffort || "medium", timeoutMs: 420_000, temperature: 0.8, fallbackModel: plannerFallback,
  };
  let rawPlan: any = null;
  const plan0 = await jsonCall(ctx, planRequest, (raw) => {
    const parsed = parsePlan(raw, brief.book.chapters);
    if (parsed) rawPlan = raw;
    return parsed;
  }, plannerFallback);
  if (!plan0) throw new Error("[book] Der Bandplan konnte nicht erstellt werden. Bitte erneut versuchen.");
  let plan = plan0;

  const checkInput = {
    genre: brief.config.genre,
    heroNames: brief.heroes.map((hero) => hero.name),
    castNames: casting.cast.map((candidate) => candidate.name),
    blockedTerms: brief.blockedTerms,
    cozy: brief.form === "cozy",
  };
  let issues = checkBookPlan(plan, brief.book, checkInput);

  let planReview: PlanReview | null = null;
  if (!experiment.skipPlanReview) {
    const prompt = buildPlanReviewPrompt(castBrief, plan);
    try {
      planReview = await jsonCall(ctx, {
        stage: "book-plan-review", role: "critic", model: planCritic, system: prompt.system, user: prompt.user,
        json: true, maxTokens: 6000, effort: "low", timeoutMs: 180_000, temperature: 0.2,
      }, parsePlanReview, fallbackModelFor(planCritic));
    } catch (err) {
      console.warn("[book] plan review failed:", (err as Error)?.message || err);
    }
  }
  await observe(ctx, "plan", { title: plan.title, issues, review: planReview?.scores, mustFix: planReview?.mustFix.length ?? null, weaknesses: planReview?.weaknesses.map((entry) => `${entry.severity}: ${entry.problem}`) });

  const notes = [...issues, ...planReviewNotes(planReview)];
  let planRevised = false;
  if (notes.length > 0) {
    const revisionPrompt = buildPlanRevisionPrompt(castBrief, planPrompt, JSON.stringify(rawPlan ?? plan), notes);
    try {
      // Only the changed parts come back (a full rewrite cost 10.7 ¢ on the first live run).
      const revised = await jsonCall(ctx, { ...planRequest, stage: "book-plan-revision", user: revisionPrompt.user, maxTokens: 9000 }, (raw) =>
        raw && typeof raw === "object" && !Array.isArray(raw) ? parsePlan(mergePlanRevision(rawPlan ?? plan, raw), brief.book.chapters) : null);
      if (revised) {
        const revisedIssues = checkBookPlan(revised, brief.book, checkInput);
        if (revisedIssues.length <= issues.length) {
          plan = revised;
          issues = revisedIssues;
          planRevised = true;
        }
      }
    } catch (err) {
      console.warn("[book] plan revision failed; writing from the first plan:", (err as Error)?.message || err);
    }
    await observe(ctx, "plan-revision", { revised: planRevised, remaining: issues });
  }
  // The plan may cast fewer characters than the pitch; the book carries only those it plans with.
  const planned = casting.cast.filter((candidate) => plan.chapters.some((chapter) => chapter.cast.some((entry) => mentionsName(entry, candidate.name))) || plan.castIds.includes(candidate.id));
  const finalCast = planned.length ? planned : casting.cast;
  return { pitch, casting: { ...casting, cast: finalCast }, plan, planReview, planIssues: issues, planRevised, brief: { ...castBrief, candidates: finalCast } };
}

// ---------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------

function chapterBudgetTokens(brief: BookBrief, count: number): number {
  // German ≈ 1.7 tokens per word, plus thinking at "low" and the markers.
  return Math.min(48000, Math.ceil(count * brief.book.wordsPerChapterMax * 2.3 + 4000));
}

function writerRequest(ctx: BookContext, planned: PlannedBook, state: BookState, from: number, to: number, stage: string, extra = ""): LlmRequest {
  const { brief } = planned;
  const experiment = brief.bookExperiment || {};
  const count = to - from + 1;
  return {
    stage,
    role: "writer",
    model: experiment.chapterWriterModel || ctx.models.writer,
    // Rules + bible + chapter plan in the system message: cached for every later batch of the book.
    system: buildChapterSystemWithContext(brief, planned.plan),
    user: buildChapterUserPrompt(brief, planned.plan, state, from, to) + extra,
    json: false,
    maxTokens: chapterBudgetTokens(brief, count),
    effort: experiment.chapterEffort || "low",
    timeoutMs: Math.min(900_000, 150_000 + count * 70_000),
    temperature: 0.9,
  };
}

/** Writes chapters [from, to] in one call; a call that stops early gets one more call for the rest. */
export async function draftChapters(ctx: BookContext, planned: PlannedBook, state: BookState, from: number, to: number): Promise<BookChapter[]> {
  const german = isGerman(planned.brief.config.language);
  const titleOf = (n: number) => planned.plan.chapters.find((chapter) => chapter.n === n)?.title;
  const take = (raw: string) => parseChapters(raw, { german })
    .filter((chapter) => chapter.order >= from && chapter.order <= to)
    .map((chapter) => ({ ...chapter, title: /^Kapitel \d+$/.test(chapter.title) ? titleOf(chapter.order) || chapter.title : chapter.title }));
  const first = await call(ctx, writerRequest(ctx, planned, state, from, to, `book-chapters-${from}-${to}`));
  const drafted = take(first.text);
  const missing = Array.from({ length: to - from + 1 }, (_, index) => from + index).filter((n) => !drafted.some((chapter) => chapter.order === n));
  if (missing.length) {
    const start = missing[0];
    const end = missing[missing.length - 1];
    const partial: BookState = { ...state, chapters: [...state.chapters, ...drafted.filter((chapter) => chapter.order < start)] };
    const rest = await call(ctx, writerRequest(ctx, planned, partial, start, end, `book-chapters-${start}-${end}-rest`));
    for (const chapter of take(rest.text)) if (!drafted.some((entry) => entry.order === chapter.order)) drafted.push(chapter);
  }
  drafted.sort((a, b) => a.order - b.order);
  if (drafted.length !== to - from + 1) throw new Error(`[book] Kapitel ${from}–${to} konnten nicht vollständig geschrieben werden.`);
  return drafted;
}

interface RewriteReason { code: string; message: string }

/** A chapter without a quotable laugh is rewritten only when the critic also rates its humour this low. */
export const LAUGH_REWRITE_MAX_HUMOR = 5;

/**
 * Reasons for a full rewrite by the writer: a laugh, progress or a plant cannot be patched in.
 * A missing hook alone is no reason — the support model rewrites the last sentences instead
 * (Gurkenberg 2026-10-14: five rewrites cost 10 ¢, a third of the chapter text).
 */
export function rewriteReasons(critique: ChapterCritiqueResult["chapters"][number] | undefined, chapter: BookChapter, planned: PlannedBook, hard: string[]): RewriteReason[] {
  const reasons: RewriteReason[] = hard.map((message) => ({ code: "too-short", message }));
  if (!critique) return reasons;
  // A laugh the critic quoted but misquoted is still a laugh ("Sieben Zimmer" chapter 8 was rewritten for it).
  // So is one it rated funny but did not quote: "Schatto führt Regie" rewrote chapters 2-4 at humour 6
  // for 5.5 ¢, a fifth of the book — the critic is known to miss quotes (7 of 12 in one replay).
  if (!critique.laugh && !critique.unmatched?.laugh && critique.humor <= LAUGH_REWRITE_MAX_HUMOR) {
    reasons.push({ code: "no-laugh", message: "Es gibt keine Stelle, an der ein Kind laut lacht. Baue den geplanten Lacher richtig auf (Figur, Steigerung, Pointe) und lass ihn landen." });
  }
  if (!critique.progress) reasons.push({ code: "no-progress", message: `Das Kapitel bringt die große Frage („${planned.plan.bible.bigQuestion}“) nicht voran. Zeige den geplanten Fortschritt als Szene.` });
  // A missing plant alone is one casual sentence for the patch (7 of 10 rewrites in the planner A/B
  // of 2026-10-15); a chapter rewritten anyway gets it in the same call.
  if (reasons.length) reasons.push(...plantReasons(critique, planned));
  // Rewritten anyway: the new version gets its gentle ending in the same call.
  if (reasons.length && !critique.hook && chapter.order < planned.brief.book.chapters) {
    reasons.push({ code: "no-hook", message: "Das Kapitel hört einfach auf oder endet in akuter Gefahr. Es braucht ein sanftes, neugierig machendes Ende (ein Ding verhält sich anders, eine Figur weiß mehr, ein kleiner Erfolg wirft eine neue Frage auf)." });
  }
  return reasons;
}

function plantReasons(critique: ChapterCritiqueResult["chapters"][number], planned: PlannedBook): RewriteReason[] {
  return critique.missingPlants.flatMap((id) => {
    const setup = planned.plan.setups.find((entry) => entry.id === id);
    return setup ? [{ code: "missing-plant", message: `Lege ${id} beiläufig in einer Szene an: ${setup.what} (ohne anzukündigen, wofür es gut ist).` }] : [];
  });
}

/** Companions who first appear in this batch (not in any released chapter). */
function newcomersIn(chapters: BookChapter[], state: BookState, cast: string[]): string[] {
  return cast.filter((name) => !state.chapters.some((chapter) => mentionsName(chapter.content, name)) && chapters.some((chapter) => mentionsName(chapter.content, name)));
}

/** The cold reader: what a child without any profile learns from this batch alone. Never fatal. */
async function coldRead(ctx: BookContext, planned: PlannedBook, state: BookState, chapters: BookChapter[], range: string): Promise<{ missing: string[]; notes: string[] }> {
  const { brief, plan } = planned;
  const heroes = brief.heroes.map((hero) => hero.name);
  const relation = heroRelation(brief);
  const questions = coldReadQuestions({
    heroes, relation,
    orientation: chapters.some((chapter) => chapter.order === 1),
    newcomers: newcomersIn(chapters, state, brief.candidates.map((candidate) => candidate.name)),
  });
  if (!questions.length) return { missing: [], notes: [] };
  const prompt = buildColdReadPrompt(brief, chapters, questions);
  try {
    const response = await call(ctx, {
      stage: `book-coldread-${range}`, role: "support", model: ctx.models.support, system: prompt.system, user: prompt.user,
      json: true, maxTokens: 2500, effort: "low", timeoutMs: 120_000, temperature: 0.2,
    });
    const missing = unansweredQuestions(response.text, chapters, questions);
    return { missing, notes: coldReadNotes(missing, { chapters, plan, heroes, relation }) };
  } catch (err) {
    console.warn("[book] cold read failed:", (err as Error)?.message || err);
    return { missing: [], notes: [] };
  }
}

function hookPatchNote(chapter: BookChapter, planned: PlannedBook): string {
  const planHook = planned.plan.chapters.find((entry) => entry.n === chapter.order)?.hook;
  return `Kapitel ${chapter.order}: hört einfach auf oder endet in akuter Gefahr. Ersetze nur die letzten ein bis zwei Sätze durch ein sanftes, neugierig machendes Ende (ein Ding verhält sich anders, eine Figur weiß mehr, ein kleiner Erfolg wirft eine neue Frage auf)${planHook ? ` — geplant war: ${planHook}` : ""}.`;
}

/** Checks, critic read, one rewrite where needed, patch, logbook. Returns the new state. */
export async function processChapters(ctx: BookContext, planned: PlannedBook, state: BookState, drafted: BookChapter[]): Promise<BookState> {
  const { brief, plan } = planned;
  const german = isGerman(brief.config.language);
  const names = [...brief.heroes.map((hero) => hero.name), ...brief.candidates.map((candidate) => candidate.name)];
  const checksFor = (chapters: BookChapter[]) => chapters.map((chapter, index) =>
    checkChapter(chapter, { brief, budget: brief.book, earlier: [...state.chapters, ...chapters.slice(0, index)], names }));
  let chapters = drafted;
  let checks = checksFor(chapters);

  // Critic read of the batch (other family).
  const critiquePrompt = buildChapterCritiquePrompt(brief, plan, state, chapters);
  let critique: ChapterCritiqueResult | null = null;
  const range = `${chapters[0].order}-${chapters[chapters.length - 1].order}`;
  try {
    const request: LlmRequest = { stage: `book-critique-${range}`, role: "critic", model: ctx.models.critic, system: critiquePrompt.system, user: critiquePrompt.user, json: true, maxTokens: 6000, effort: "low", timeoutMs: 180_000, temperature: 0.2 };
    const first = await call(ctx, request);
    critique = parseChapterCritique(first.text, chapters);
    if (!critique) {
      const retry = await call(ctx, { ...request, stage: `${request.stage}-retry`, model: fallbackModelFor(ctx.models.critic) });
      critique = parseChapterCritique(retry.text, chapters);
    }
  } catch (err) {
    console.warn("[book] chapter critique failed:", (err as Error)?.message || err);
  }

  // One rewrite per chapter that has no laugh, no progress, a missing plant or is far too short.
  const rewritten = new Set<number>();
  const reasonCodes = new Map<number, string[]>();
  for (const [index, chapter] of chapters.entries()) {
    const hard = checks[index].filter((issue) => issue.code === "chapter_short").map((issue) => issue.message);
    const reasons = rewriteReasons(critique?.chapters.find((entry) => entry.n === chapter.order), chapter, planned, hard);
    if (!reasons.length) continue;
    reasonCodes.set(chapter.order, [...new Set(reasons.map((reason) => reason.code))]);
    const before: BookState = { ...state, chapters: [...state.chapters, ...chapters.slice(0, index)] };
    try {
      const response = await call(ctx, writerRequest(ctx, planned, before, chapter.order, chapter.order, `book-rewrite-${chapter.order}`,
        `${buildChapterRewriteNote(reasons.map((reason) => reason.message))}\n\nYOUR FIRST VERSION:\nKAPITEL ${chapter.order}: ${chapter.title}\n${chapter.content}`));
      const next = parseChapters(response.text, { german }).find((entry) => entry.order === chapter.order);
      if (!next) continue;
      const candidate = { ...next, title: next.title || chapter.title };
      const nextChecks = checkChapter(candidate, { brief, budget: brief.book, earlier: before.chapters, names });
      if (nextChecks.filter((issue) => issue.severity === "hard").length <= checks[index].filter((issue) => issue.severity === "hard").length) {
        chapters = chapters.map((entry) => (entry.order === chapter.order ? candidate : entry));
        rewritten.add(chapter.order);
      }
    } catch (err) {
      console.warn(`[book] rewrite of chapter ${chapter.order} failed; keeping the first version:`, (err as Error)?.message || err);
    }
  }
  if (rewritten.size) checks = checksFor(chapters);

  // A first version without a gentle hook gets a new ending from the patch, not a rewrite.
  const last = brief.book.chapters;
  const hookNotes = chapters
    .filter((chapter) => critique && !rewritten.has(chapter.order) && chapter.order < last)
    .filter((chapter) => !critique?.chapters.find((entry) => entry.n === chapter.order)?.hook);
  const hookPatched = new Set(hookNotes.map((chapter) => chapter.order));
  // Plants the critic missed in chapters that were not rewritten: one casual sentence each.
  const plantNotes = chapters
    .filter((chapter) => !rewritten.has(chapter.order))
    .flatMap((chapter) => {
      const point = critique?.chapters.find((entry) => entry.n === chapter.order);
      return point ? plantReasons(point, planned).map((reason) => `Kapitel ${chapter.order}: ${reason.message} Ein einziger Satz in einer vorhandenen Szene genügt.`) : [];
    });
  const cold = await coldRead(ctx, planned, state, chapters, range);

  // The last batch answers what the text made a child ask: the critic names what is still open.
  const lastChapter = chapters[chapters.length - 1];
  const threadNotes = lastChapter.order === last
    ? (critique?.unanswered || [])
      .map((id) => (state.openThreads || []).find((thread) => thread.id === id))
      .filter((thread): thread is NonNullable<typeof thread> => Boolean(thread))
      .map((thread) => `Kapitel ${lastChapter.order}: Ein Kind fragt sich seit Kapitel ${thread.chapter} noch: „${thread.question}“ Beantworte das beiläufig in ein bis zwei Sätzen einer vorhandenen Szene, aus dem, was die Geschichte schon gezeigt hat.`)
    : [];

  // Patch: continuity, language, invented looks, repeated phrases, missing hooks and plants, what a newcomer cannot follow.
  const notes = [
    ...cold.notes,
    ...threadNotes,
    ...hookNotes.map((chapter) => hookPatchNote(chapter, planned)),
    ...plantNotes,
    ...checks.flat().filter((issue) => issue.code !== "chapter_short").map((issue) => issue.message),
    ...(critique?.mustFix || []).filter((note) => !rewritten.has(note.chapter)).map((note) => `Kapitel ${note.chapter}: ${note.problem}${note.quote ? ` („${note.quote}“)` : ""}`),
    ...(critique?.languageErrors || []).filter((error) => !rewritten.has(error.chapter)).map((error) => `Kapitel ${error.chapter}: „${error.quote}“ → ${error.correction}`),
  ];
  const patched = new Set<number>();
  if (notes.length) {
    const prompt = buildChapterPatchPrompt(brief, chapters, notes, state.facts.map((fact) => `(${fact.chapter}) ${fact.fact}`));
    try {
      const response = await call(ctx, {
        stage: `book-patch-${range}`, role: "support", model: ctx.models.support, system: prompt.system, user: prompt.user,
        json: false, maxTokens: Math.min(20000, Math.ceil(chapters.length * brief.book.wordsPerChapterMax * 2.2 + 2000)), effort: "low", timeoutMs: 240_000, temperature: 0.4,
      });
      const merged = mergeChapterPatch(response.text, chapters, german);
      const mergedChecks = checksFor(merged);
      const hardBefore = checks.flat().filter((issue) => issue.severity === "hard").length;
      const hardAfter = mergedChecks.flat().filter((issue) => issue.severity === "hard").length;
      if (hardAfter <= hardBefore) {
        for (const chapter of merged) if (chapter.content !== chapters.find((entry) => entry.order === chapter.order)?.content) patched.add(chapter.order);
        chapters = merged;
        checks = mergedChecks;
      }
    } catch (err) {
      console.warn("[book] chapter patch failed; keeping the text:", (err as Error)?.message || err);
    }
  }

  // Logbook from the released text: recaps, facts with their chapter, who knows what.
  const logPrompt = buildLogbookPrompt(brief, chapters, state.facts.map((fact) => `(${fact.chapter}) ${fact.fact}`), state.openThreads || []);
  let log: any = null;
  try {
    log = await jsonCall(ctx, {
      stage: `book-logbook-${range}`, role: "support", model: ctx.models.support, system: logPrompt.system, user: logPrompt.user,
      json: true, maxTokens: 4000, effort: "low", timeoutMs: 120_000, temperature: 0.2,
    }, (raw) => (Array.isArray(raw?.chapters) ? raw : null));
  } catch (err) {
    console.warn("[book] logbook failed:", (err as Error)?.message || err);
  }
  const entryOf = (n: number) => (Array.isArray(log?.chapters) ? log.chapters.find((entry: any) => Math.round(Number(entry?.n)) === n) : null);
  const clean = (value: unknown, max: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const released = chapters.map((chapter) => ({ ...chapter, recap: clean(entryOf(chapter.order)?.recap, 400) || clean(plan.chapters.find((entry) => entry.n === chapter.order)?.event, 300) }));
  const facts = released.flatMap((chapter) => (Array.isArray(entryOf(chapter.order)?.facts) ? entryOf(chapter.order).facts : []).map((fact: unknown) => ({ chapter: chapter.order, fact: clean(fact, 200) })).filter((fact: { fact: string }) => fact.fact).slice(0, 10));
  const knowledge = released.flatMap((chapter) => (Array.isArray(entryOf(chapter.order)?.knowledge) ? entryOf(chapter.order).knowledge : [])
    .map((entry: any) => ({ chapter: chapter.order, who: clean(entry?.who, 60), knows: clean(entry?.knows, 200) }))
    .filter((entry: { who: string; knows: string }) => entry.who && entry.knows)
    .slice(0, 5));
  // Spells, rhymes and key sentences, verbatim: the first version stands, later chapters copy it.
  const wordings = released.flatMap((chapter) => (Array.isArray(entryOf(chapter.order)?.wordings) ? entryOf(chapter.order).wordings : [])
    .map((entry: any) => ({ what: clean(entry?.what, 60), text: clean(entry?.text, 240) }))
    .filter((entry: { what: string; text: string }) => entry.what && entry.text && quoteInText(entry.text, chapter.content))
    .slice(0, 4));
  const worldState = released.flatMap((chapter) => (Array.isArray(entryOf(chapter.order)?.state) ? entryOf(chapter.order).state : [])
    .map((entry: any) => ({ chapter: chapter.order, thing: clean(entry?.thing, 60), now: clean(entry?.now, 160) }))
    .filter((entry: { thing: string; now: string }) => entry.thing && entry.now)
    .slice(0, 8));
  // Questions the text raised, chapter by chapter; answered ones leave the list.
  let openThreads = state.openThreads || [];
  for (const chapter of released) {
    const entry = entryOf(chapter.order);
    const opened = (Array.isArray(entry?.opened) ? entry.opened : []).map((question: unknown) => ({ chapter: chapter.order, question: clean(question, 200) })).filter((item: { question: string }) => item.question).slice(0, 3);
    const answered = (Array.isArray(entry?.answered) ? entry.answered : []).map((id: unknown) => clean(id, 8));
    openThreads = mergeOpenThreads(openThreads, opened, answered);
  }

  const curve: ChapterCurvePoint[] = released.map((chapter) => {
    const point = critique?.chapters.find((entry) => entry.n === chapter.order);
    return {
      chapter: chapter.order,
      suspense: point?.suspense ?? 0,
      humor: point?.humor ?? 0,
      // A rewritten chapter was not read again; its first-read quotes do not describe it.
      laugh: rewritten.has(chapter.order) ? null : point?.laugh ?? null,
      hook: rewritten.has(chapter.order) ? null : point?.hook ?? null,
      rewritten: rewritten.has(chapter.order),
      patched: patched.has(chapter.order),
      ...(reasonCodes.has(chapter.order) ? { rewriteReasons: reasonCodes.get(chapter.order) } : {}),
      ...(hookPatched.has(chapter.order) && patched.has(chapter.order) ? { hookPatched: true } : {}),
    };
  });
  const openIssues = checks.flatMap((list, index) => list.filter((issue) => issue.severity === "hard").map((issue) => ({ chapter: chapters[index].order, issue: issue.message })));
  await observe(ctx, "chapters", {
    range, rewritten: [...rewritten], patched: [...patched], curve, open: openIssues.length,
    ...(cold.missing.length ? { coldReadGaps: cold.missing } : {}),
    ...(openThreads.length ? { openThreads: openThreads.map((thread) => `${thread.id} (K${thread.chapter}): ${thread.question}`) } : {}),
    ...(threadNotes.length ? { answeredByPatch: threadNotes.length } : {}),
  });
  return {
    ...state,
    chapters: [...state.chapters, ...released],
    facts: [...state.facts, ...facts],
    knowledge: [...state.knowledge, ...knowledge],
    worldState: mergeWorldState(state.worldState || [], worldState),
    wordings: mergeWordings(state.wordings || [], wordings),
    openThreads,
    curve: [...state.curve, ...curve],
    openIssues: [...state.openIssues, ...openIssues],
  };
}

/**
 * The first batch is chapter 1 alone: the family can start reading while the next chapters are
 * written (user wish 2026-10-16 — "Schatto führt Regie" showed its first page after five minutes).
 */
export const FIRST_BATCH_CHAPTERS = 1;

/**
 * Chapter ranges for one volume, by write mode: the first batch, then the rest in even batches of
 * at most `batchSize` (8 chapters with a first batch of 1: 1, 2-4, 5-6, 7-8).
 */
export function chapterRanges(total: number, mode: "batch" | "single" | "whole" = "batch", batchSize = 3, firstBatch?: number): Array<[number, number]> {
  const size = mode === "single" ? 1 : mode === "whole" ? total : Math.max(1, batchSize);
  if (total < 1) return [];
  const first = Math.max(1, Math.min(total, firstBatch ?? size));
  const ranges: Array<[number, number]> = [[1, first]];
  const batches = Math.ceil((total - first) / size);
  let start = first + 1;
  for (let index = 0; index < batches; index += 1) {
    const length = Math.ceil((total - start + 1) / (batches - index));
    ranges.push([start, start + length - 1]);
    start += length;
  }
  return ranges;
}

/**
 * Flex (half price, about twice as slow, probe 2026-10-16) for every step after the first chapter:
 * the plan and chapter 1 stay on the fast tier so the family can start reading soon.
 * TALEA_BOOK_FLEX=off | later (default) | all.
 */
export function bookServiceTier(step: "plan" | "first" | "later", policy = process.env.TALEA_BOOK_FLEX): "flex" | undefined {
  const mode = String(policy || "later").trim().toLowerCase();
  if (mode === "off") return undefined;
  if (mode === "all") return "flex";
  return step === "later" ? "flex" : undefined;
}

/** The ranges the job and writeBook share: one batch per job step. */
export function bookBatchRanges(brief: BookBrief): Array<[number, number]> {
  const experiment = brief.bookExperiment || {};
  const mode = experiment.writeMode === "single" ? "single" : "batch";
  return chapterRanges(brief.book.chapters, mode, experiment.batchSize || 3, experiment.firstBatch ?? FIRST_BATCH_CHAPTERS);
}

/** Writes chapters up to `upTo` (default: all). Whole mode writes everything first and reads it in groups of three. */
export async function writeBook(ctx: BookContext, planned: PlannedBook, state: BookState, upTo = planned.brief.book.chapters): Promise<BookState> {
  const experiment = planned.brief.bookExperiment || {};
  const mode = experiment.writeMode || "batch";
  let current = state;
  const done = current.chapters.length;
  if (mode === "whole" && done === 0) {
    const drafted = await draftChapters(ctx, planned, current, 1, upTo);
    for (const [from, to] of chapterRanges(upTo, "batch", 3)) {
      current = await processChapters(ctx, planned, current, drafted.filter((chapter) => chapter.order >= from && chapter.order <= to));
    }
    return current;
  }
  for (const [from, to] of bookBatchRanges(planned.brief)) {
    if (to <= done) continue;
    if (from > upTo) break;
    const start = Math.max(from, done + 1);
    const end = Math.min(to, upTo);
    const drafted = await draftChapters(ctx, planned, current, start, end);
    current = await processChapters(ctx, planned, current, drafted);
  }
  return current;
}

/** The series memory for the next volume. Never fatal. */
export async function buildSeriesMemory(ctx: BookContext, planned: PlannedBook, state: BookState, previous?: SeriesMemory | null): Promise<SeriesMemory> {
  const prompt = buildSeriesMemoryPrompt(planned.brief, planned.plan, state);
  const clean = (value: unknown, max: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const list = (value: unknown) => (Array.isArray(value) ? value : []).map((entry) => clean(entry, 200)).filter(Boolean).slice(0, 8);
  let raw: any = null;
  try {
    raw = await jsonCall(ctx, {
      stage: "book-series-memory", role: "support", model: ctx.models.support, system: prompt.system, user: prompt.user,
      json: true, maxTokens: 2500, effort: "low", timeoutMs: 120_000, temperature: 0.2,
    }, (value) => (value && typeof value === "object" ? value : null));
  } catch (err) {
    console.warn("[book] series memory failed:", (err as Error)?.message || err);
  }
  const volume = (previous?.volume || 0) + 1;
  return {
    seriesTitle: previous?.seriesTitle || planned.plan.title,
    volume,
    castIds: [...new Set([...(previous?.castIds || []), ...planned.brief.candidates.map((candidate) => candidate.id)])].slice(0, 6),
    home: clean(raw?.home, 400) || planned.plan.bible.home,
    world: clean(raw?.world, 400) || planned.plan.bible.world,
    volumes: [...(previous?.volumes || []), { volume, title: planned.plan.title, summary: clean(raw?.summary, 600) || planned.plan.description }],
    openThreads: list(raw?.openThreads),
    runningGags: list(raw?.runningGags),
    items: list(raw?.items),
    relationships: list(raw?.relationships),
  };
}

