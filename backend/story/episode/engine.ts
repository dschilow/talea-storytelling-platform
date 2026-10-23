/**
 * Talea-Folge text engine: story bible + chapter plan (one call) → the story
 * (one call) → deterministic checks → at most one targeted revision.
 *
 * The Originals engine (library/engine.ts) needs a series bible written by
 * people; here the planner invents one per story from the wizard brief, with
 * the same method. The writer gets the Originals' writing rules and two of
 * their chapters as the style reference. Encore-free: the LLM is a port.
 */

import type { StoryBrief } from "../storybook/context";
import { broughtArtifact } from "../storybook/context";
import { containsBlockedTerm, countWords } from "../storybook/checks";
import { parseJsonObject, type CostLedger, type LlmRequest, type StorybookLlm, type StorybookModels } from "../storybook/llm";
import type { CastCandidate, StoryPlan, StorybookPage } from "../storybook/types";
import { parseChapters, type ParsedChapter } from "../library/engine";
import { EPISODE_PIPELINE_ID, SAMPLE_SIGNATURES } from "./craft";
import { planSystemPrompt, planUserPrompt, writerSystemPrompt, writerUserPrompt } from "./prompts";
import type { EpisodeCastMember, EpisodePlan, EpisodeResult } from "./types";

export { EPISODE_PIPELINE_ID };

type Observe = (stage: string, payload: Record<string, unknown>) => Promise<void> | void;

const text = (value: unknown, max = 600) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const list = (value: unknown, max = 12) => (Array.isArray(value) ? value.map((entry) => text(entry, 400)).filter(Boolean).slice(0, max) : []);
const kebab = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "figur";

/** Coerces the planner's JSON into a plan and lists what a repair has to fix. */
export function normalizePlan(raw: any, brief: StoryBrief): { plan: EpisodePlan; problems: string[] } {
  const problems: string[] = [];
  const chapters = brief.budget.pages;
  const heroIds = new Set(brief.heroes.map((hero) => hero.id));
  const poolIds = new Set(brief.candidates.map((candidate) => candidate.id));
  const heroNames = new Set(brief.heroes.map((hero) => hero.name.toLocaleLowerCase("de-DE")));
  const clampChapter = (value: unknown, fallback: number) => Math.max(1, Math.min(chapters, Math.round(Number(value)) || fallback));

  const heroes = brief.heroes.map((hero) => {
    const entry = (Array.isArray(raw?.heroes) ? raw.heroes : []).find((h: any) => h?.id === hero.id || text(h?.name).toLocaleLowerCase("de-DE") === hero.name.toLocaleLowerCase("de-DE"));
    if (!entry) problems.push(`heroes: ${hero.name} (${hero.id}) has no voice and no contribution.`);
    return { id: hero.id, name: hero.name, voice: text(entry?.voice, 300), contribution: text(entry?.contribution, 300) };
  });

  const cast: EpisodeCastMember[] = [];
  for (const member of Array.isArray(raw?.cast) ? raw.cast : []) {
    const name = text(member?.name, 60);
    if (!name || heroNames.has(name.toLocaleLowerCase("de-DE"))) continue;
    const pooled = brief.candidates.find((candidate) => candidate.id === member?.id) || brief.candidates.find((candidate) => candidate.name.toLocaleLowerCase("de-DE") === name.toLocaleLowerCase("de-DE"));
    const from: "pool" | "new" = pooled ? "pool" : "new";
    if (member?.from === "pool" && !pooled) problems.push(`cast: „${name}“ is marked as pool figure but is not in the character pool — either use a pool id or mark it new with a lookEn.`);
    const lookEn = text(member?.lookEn, 400);
    if (from === "new" && !lookEn) problems.push(`cast: the new figure „${name}“ needs a concrete English lookEn.`);
    cast.push({
      id: pooled ? pooled.id : kebab(text(member?.id, 60) || name),
      name: pooled ? pooled.name : name,
      from,
      role: text(member?.role, 30) || "companion",
      species: text(member?.species, 30) || (pooled?.species ?? "creature"),
      voice: text(member?.voice, 300),
      wants: text(member?.wants, 300),
      comicPattern: text(member?.comicPattern, 300),
      ...(from === "new" && lookEn ? { lookEn } : {}),
    });
  }
  const pooledCount = cast.filter((member) => member.from === "pool").length;
  const newCount = cast.filter((member) => member.from === "new").length;
  const maxNew = brief.band === "3-5" ? 1 : 2;
  if (brief.candidates.length > 0 && pooledCount === 0) problems.push("cast: no figure of the character pool has a role — cast at least one with a real task right into the finale.");
  if (pooledCount > brief.budget.maxCast) problems.push(`cast: at most ${brief.budget.maxCast} pool figures, not ${pooledCount}.`);
  if (newCount > maxNew) problems.push(`cast: at most ${maxNew} new figures, not ${newCount} — merge or drop figures.`);

  const rawChapters = Array.isArray(raw?.chapters) ? raw.chapters : [];
  if (rawChapters.length !== chapters) problems.push(`chapters: exactly ${chapters} chapters, not ${rawChapters.length}.`);
  const planChapters = rawChapters.slice(0, chapters).map((chapter: any, index: number) => ({
    title: text(chapter?.title, 60) || `Kapitel ${index + 1}`,
    beats: list(chapter?.beats, 9),
    laugh: (Array.isArray(chapter?.laughs) ? list(chapter.laughs, 3).join(" | ") : "") || text(chapter?.laugh, 300),
    ending: text(chapter?.ending, 300),
  }));
  planChapters.forEach((chapter: EpisodePlan["chapters"][number], index: number) => {
    if (chapter.beats.length < 3) problems.push(`chapters[${index + 1}]: plan at least 4 concrete beats, not ${chapter.beats.length}.`);
  });

  const wonder = raw?.wonder || {};
  if (!text(wonder.rule)) problems.push("wonder.rule: the one rule a child can repeat is missing.");
  if (!text(wonder.endsWhen)) problems.push("wonder.endsWhen: how the wonder ends is missing.");
  if (!text(raw?.courage)) problems.push("courage: the brave moment in front of others is missing.");
  if (!text(raw?.solution)) problems.push("solution: why the solution works is missing.");

  let artifact: EpisodePlan["artifact"] = null;
  const brought = broughtArtifact(brief);
  if (raw?.artifact && typeof raw.artifact === "object") {
    const known = brief.artifacts.find((option) => option.id === raw.artifact.id);
    if (known) {
      artifact = { id: known.id, role: text(raw.artifact.role, 300), firstChapter: clampChapter(raw.artifact.firstChapter, 1), useChapter: clampChapter(raw.artifact.useChapter, chapters) };
    } else if (raw.artifact.id) {
      problems.push(`artifact: „${text(raw.artifact.id, 60)}“ is not one of the offered artifacts.`);
    }
  }
  if (brought && artifact?.id !== brought.id) {
    problems.push(`artifact: the brought artifact „${brought.name}“ (${brought.id}) is mandatory from chapter 1.`);
    artifact = { id: brought.id, role: artifact?.role || "", firstChapter: 1, useChapter: chapters };
  }

  const plan: EpisodePlan = {
    ideas: list(raw?.ideas, 3),
    chosen: Math.max(1, Math.min(3, Math.round(Number(raw?.chosen)) || 1)),
    title: text(raw?.title, 80),
    summary: text(raw?.summary, 400),
    focusHero: heroIds.has(raw?.focusHero) ? raw.focusHero : brief.heroes[0]?.id,
    childSituation: text(raw?.childSituation, 400),
    wonder: { rule: text(wonder.rule, 300), who: text(wonder.who, 300), firstEffect: text(wonder.firstEffect, 300), escalation: list(wonder.escalation, 4), endsWhen: text(wonder.endsWhen, 300) },
    heroes,
    cast,
    runningGags: (Array.isArray(raw?.runningGags) ? raw.runningGags : []).slice(0, 3).map((gag: any) => ({ gag: text(gag?.gag, 200), beats: list(gag?.beats, 4) })).filter((gag: { gag: string }) => gag.gag),
    attempts: list(raw?.attempts, 4),
    nearDiscovery: text(raw?.nearDiscovery, 400),
    quietMoment: text(raw?.quietMoment, 400),
    courage: text(raw?.courage, 400),
    solution: text(raw?.solution, 400),
    setups: (Array.isArray(raw?.setups) ? raw.setups : []).slice(0, 6).map((setup: any) => ({ what: text(setup?.what, 200), planted: clampChapter(setup?.planted, 1), paysOff: clampChapter(setup?.paysOff, chapters) })).filter((setup: { what: string }) => setup.what),
    chapters: planChapters,
    schoolyardLine: text(raw?.schoolyardLine, 200),
    finalLaugh: text(raw?.finalLaugh, 300),
    artifact,
    learningCore: text(raw?.learningCore, 400) || null,
  };
  if (!plan.title) problems.push("title is missing.");
  if (plan.runningGags.length < 1) problems.push("runningGags: plan two running gags with three beats each.");
  const blocked = containsBlockedTerm(JSON.stringify(plan), brief.blockedTerms);
  if (blocked) problems.push(`The blocked term „${blocked}“ must not appear.`);
  return { plan, problems };
}

/** TITEL / BESCHREIBUNG header plus KAPITEL blocks. */
export function readStory(raw: string): { title: string; description: string; chapters: ParsedChapter[] } {
  const value = String(raw || "").replace(/\r\n/g, "\n");
  const title = value.match(/^\s*TITEL\s*:\s*(.+)$/im)?.[1]?.replace(/[*_#]/g, "").trim() || "";
  const description = value.match(/^\s*BESCHREIBUNG\s*:\s*(.+)$/im)?.[1]?.replace(/[*_#]/g, "").trim() || "";
  return { title, description, chapters: parseChapters(value) };
}

/** Hard: the story cannot ship like this. Soft: worth a revision only together with a hard one. */
export function storyChecks(chapters: ParsedChapter[], plan: EpisodePlan, brief: StoryBrief): { hard: string[]; soft: string[] } {
  const hard: string[] = [];
  const soft: string[] = [];
  const { budget } = brief;
  if (chapters.length !== budget.pages) hard.push(`Exactly ${budget.pages} chapters are needed, the text has ${chapters.length}.`);
  const words = chapters.reduce((sum, chapter) => sum + countWords(chapter.text), 0);
  if (words < budget.totalWordsMin * 0.75) hard.push(`The story has ${words} words; it needs ${budget.totalWordsMin}–${budget.totalWordsMax}. Tell the beats as full scenes with dialogue.`);
  else if (words < budget.totalWordsMin * 0.9) soft.push(`Slightly short: ${words} words (target ${budget.totalWordsMin}–${budget.totalWordsMax}).`);
  if (words > budget.totalWordsMax * 1.35) soft.push(`Too long: ${words} words (target ${budget.totalWordsMin}–${budget.totalWordsMax}).`);
  const full = chapters.map((chapter) => `${chapter.title}\n${chapter.text}`).join("\n");
  for (const signature of SAMPLE_SIGNATURES) {
    if (new RegExp(`(^|[^\\p{L}])${signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}])`, "u").test(full)) hard.push(`„${signature}“ comes from the style reference — replace it with something of this story's own.`);
  }
  const blocked = containsBlockedTerm(full, brief.blockedTerms);
  if (blocked) hard.push(`The blocked term „${blocked}“ appears — remove it completely.`);
  for (const member of plan.cast.filter((entry) => entry.from === "pool")) {
    const head = member.name.split(/\s+/).pop() || member.name;
    if (!full.includes(head)) soft.push(`The pool figure ${member.name} never appears by name.`);
  }
  const artifact = plan.artifact ? brief.artifacts.find((option) => option.id === plan.artifact!.id) : undefined;
  if (artifact && broughtArtifact(brief)?.id === artifact.id && !full.toLocaleLowerCase("de-DE").includes(artifact.name.toLocaleLowerCase("de-DE").split(/\s+/).pop() || "")) {
    hard.push(`The brought artifact „${artifact.name}“ is missing in the text.`);
  }
  chapters.slice(0, -1).forEach((chapter, index) => {
    const last = chapter.text.trim().split(/\n\n/).pop() || "";
    if (/\?\s*[“"»]?\s*$/.test(last) && !/[„“"»«]/.test(last)) soft.push(`Chapter ${index + 1} ends with a narrator question; end on an event or a line instead.`);
  });
  return { hard, soft };
}

function toStoryPlan(plan: EpisodePlan, chapters: ParsedChapter[]): StoryPlan {
  return {
    title: plan.title,
    logline: plan.summary,
    engine: EPISODE_PIPELINE_ID,
    chosenPitch: plan.chosen,
    whyChosen: plan.ideas[plan.chosen - 1] || "",
    want: plan.childSituation,
    stakes: plan.childSituation,
    worldRule: plan.wonder.rule || null,
    ruleIntro: plan.wonder.firstEffect || null,
    solutionWhy: plan.solution,
    refrain: null,
    runningGag: { what: plan.runningGags[0]?.gag || "", beats: plan.runningGags[0]?.beats || [] },
    dramaticIrony: plan.nearDiscovery,
    setups: plan.setups.map((setup) => ({ what: setup.what, plantedOnPage: setup.planted, paysOffOnPage: setup.paysOff })),
    obstacleMotive: plan.cast.find((member) => member.role === "troublemaker")?.wants || "",
    props: [],
    heroes: plan.heroes.map((hero) => ({ id: hero.id, name: hero.name, strength: hero.contribution, voice: hero.voice, contribution: hero.contribution })),
    cast: plan.cast.map((member) => ({ id: member.id, name: member.name, role: member.role, want: member.wants, voice: member.voice, signature: member.lookEn || member.comicPattern })),
    artifact: plan.artifact ? { id: plan.artifact.id, name: plan.artifact.id, role: plan.artifact.role, firstPage: plan.artifact.firstChapter, usePage: plan.artifact.useChapter, carried: true } : null,
    pages: plan.chapters.map((chapter, index) => ({
      page: index + 1,
      place: "",
      action: chapter.beats.join(" "),
      heroMoment: chapter.beats.find((beat) => plan.heroes.some((hero) => beat.includes(hero.name))) || "",
      humor: chapter.laugh,
      emotion: index === plan.chapters.length - 1 ? plan.courage : "",
      turn: chapter.ending,
      picture: chapter.laugh,
      onPage: [...plan.heroes.map((hero) => hero.id), ...plan.cast.filter((member) => (chapters[index]?.text || "").includes(member.name.split(/\s+/).pop() || member.name)).map((member) => member.id)],
      after: "",
    })),
    ending: { resolution: plan.solution, callback: plan.finalLaugh, lastLine: plan.finalLaugh },
    learningCore: plan.learningCore,
  };
}

/** New figures in the shape the picture stage reads for pool characters. */
function guestsOf(plan: EpisodePlan): CastCandidate[] {
  return plan.cast.filter((member) => member.from === "new").map((member) => ({
    id: member.id,
    name: member.name,
    species: member.species,
    whoTheyAre: member.comicPattern || member.role,
    want: member.wants,
    speechStyle: member.voice ? [member.voice] : [],
    personality: [],
    physicalDescription: member.lookEn || "",
    visualProfile: { description: member.lookEn || "", imagePrompt: member.lookEn || "", species: member.species },
  }));
}

export async function runEpisodeTextEngine(input: {
  llm: StorybookLlm;
  brief: StoryBrief;
  models: StorybookModels;
  ledger: CostLedger;
  observe?: Observe;
  /** Test switches: the planner model and both efforts (defaults: the writer model, "low"). */
  options?: { plannerModel?: string; planEffort?: LlmRequest["effort"]; writeEffort?: LlmRequest["effort"] };
}): Promise<EpisodeResult> {
  const { brief, models, ledger, llm } = input;
  const observe = async (stage: string, payload: Record<string, unknown>) => {
    try { await input.observe?.(stage, payload); } catch { /* telemetry never changes the story */ }
  };
  const plannerModel = input.options?.plannerModel || models.writer;

  // 1) Story bible + chapter plan. One repair when the structure is off.
  const planSystem = planSystemPrompt(brief);
  let planRaw: any = null;
  let normalized: { plan: EpisodePlan; problems: string[] } | null = null;
  let planRepaired = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const stage = attempt ? "episode-plan-repair" : "episode-plan";
    const result = await llm({
      stage, role: "writer", model: plannerModel, system: planSystem,
      user: planUserPrompt(brief, attempt && normalized ? { plan: planRaw, problems: normalized.problems } : undefined),
      json: true, maxTokens: 12000, effort: input.options?.planEffort || "low", timeoutMs: 240_000,
    });
    ledger.recordCall(stage, result, "writer");
    planRaw = parseJsonObject<any>(result.text);
    normalized = normalizePlan(planRaw, brief);
    await observe(stage, { model: result.modelUsed, usage: result.usage, durationMs: result.durationMs, problems: normalized.problems, plan: normalized.plan });
    if (!normalized.problems.length) break;
    planRepaired = attempt === 0;
  }
  const plan = normalized!.plan;
  if (plan.chapters.length !== brief.budget.pages) throw new Error(`[${EPISODE_PIPELINE_ID}] plan has ${plan.chapters.length} chapters instead of ${brief.budget.pages}.`);

  // 2) The story, in one call: one voice from the first to the last line.
  const system = writerSystemPrompt(brief);
  const maxTokens = Math.ceil(brief.budget.totalWordsMax * 2.6 + 6000);
  const write = async (stage: string, revision?: { chapters: ParsedChapter[]; notes: string[] }) => {
    const result = await llm({ stage, role: "writer", model: models.writer, system, user: writerUserPrompt(brief, plan, revision), json: false, maxTokens, effort: input.options?.writeEffort || "low", timeoutMs: 360_000 });
    ledger.recordCall(stage, result, "writer");
    const story = readStory(result.text);
    await observe(stage, { model: result.modelUsed, usage: result.usage, durationMs: result.durationMs, words: story.chapters.map((chapter) => countWords(chapter.text)) });
    return story;
  };
  let story = await write("episode-write");
  let draftRetried = false;
  if (story.chapters.length === 0) {
    draftRetried = true;
    story = await write("episode-write-retry");
  }
  let checks = storyChecks(story.chapters, plan, brief);
  let revised = false;
  if (checks.hard.length) {
    const candidate = await write("episode-revision", { chapters: story.chapters, notes: [...checks.hard, ...checks.soft] });
    const candidateChecks = storyChecks(candidate.chapters, plan, brief);
    if (candidateChecks.hard.length < checks.hard.length) {
      story = { title: candidate.title || story.title, description: candidate.description || story.description, chapters: candidate.chapters };
      checks = candidateChecks;
      revised = true;
    }
  }
  if (story.chapters.length === 0) throw new Error(`[${EPISODE_PIPELINE_ID}] the writer returned no chapters.`);
  await observe("episode-checks", { checks, revised });

  const pages: StorybookPage[] = story.chapters.map((chapter, index) => ({ order: index + 1, title: chapter.title || plan.chapters[index]?.title || `Kapitel ${index + 1}`, content: chapter.text, paragraphs: chapter.text.split(/\n\n/) }));
  return {
    title: story.title || plan.title,
    description: story.description || plan.summary,
    pages,
    plan: toStoryPlan(plan, story.chapters),
    pitches: [],
    engineIds: [EPISODE_PIPELINE_ID],
    review: null,
    pairwise: null,
    chosen: revised ? "revision" : "draft",
    finalChecks: {
      ok: checks.hard.length === 0,
      hard: checks.hard.map((message) => ({ code: "episode_hard", severity: "hard" as const, message })),
      soft: checks.soft.map((message) => ({ code: "episode_soft", severity: "soft" as const, message })),
    },
    benchmarkScore: null,
    draftScore: null,
    planRepaired,
    draftRetried,
    textQuality: { status: checks.hard.length ? "failed" : "unverified", issues: [...checks.hard, ...checks.soft] },
    episode: { plan, guests: guestsOf(plan), checks, revised },
  };
}
