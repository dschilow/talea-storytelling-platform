/**
 * Talea-Folge text engine. Two modes:
 *
 *   one-shot (default)  Sol plans the story bible silently and writes header + story in one call.
 *   two-step            story bible + chapter plan as JSON (one call) → the story (one call).
 *
 * Then deterministic checks, series names renamed, at most one revision on hard defects.
 * The Originals engine (library/engine.ts) needs a series bible written by people; here the
 * story invents one from the wizard brief, with the same method. The writer gets the Originals'
 * writing rules and two of their chapters as the style reference. Encore-free: the LLM is a port.
 */

import type { StoryBrief } from "../storybook/context";
import { broughtArtifact } from "../storybook/context";
import { containsBlockedTerm, countWords } from "../storybook/checks";
import { parseJsonObject, type CostLedger, type LlmRequest, type StorybookLlm, type StorybookModels } from "../storybook/llm";
import type { CastCandidate, StoryPlan, StorybookPage } from "../storybook/types";
import { parseChapters, type ParsedChapter } from "../library/engine";
import { EPISODE_PIPELINE_ID, FRESH_NAMES, SAMPLE_SIGNATURES, takenNames } from "./craft";
import { oneShotSystemPrompt, oneShotUserPrompt, planSystemPrompt, planUserPrompt, writerSystemPrompt, writerUserPrompt } from "./prompts";
import type { EpisodeCastMember, EpisodePlan, EpisodeResult } from "./types";

export { EPISODE_PIPELINE_ID };

export type EpisodeMode = "one-shot" | "two-step";

/** TALEA_EPISODE_MODE=two-step brings back the separate JSON plan. */
export function resolveEpisodeMode(value = process.env.TALEA_EPISODE_MODE): EpisodeMode {
  return String(value || "").trim().toLowerCase() === "two-step" ? "two-step" : "one-shot";
}

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

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Whole word, also as German genitive (Brunos). */
const wordPattern = (word: string, flags = "u") => new RegExp(`(^|[^\\p{L}])${escapeRegExp(word)}(s?)(?=$|[^\\p{L}])`, flags);

function ownNames(brief: StoryBrief): Set<string> {
  return new Set([...brief.heroes, ...brief.candidates].flatMap((figure) => String(figure.name || "").toLocaleLowerCase("de-DE").split(/\s+/)));
}

/**
 * A new figure that still got a series name (run r4-mila: a dog „Bruno“) is renamed everywhere
 * instead of paying for a full rewrite. Names of the family's heroes and pool figures stay.
 */
export function renameTakenNames(chapters: ParsedChapter[], plan: EpisodePlan, brief: StoryBrief): { chapters: ParsedChapter[]; renamed: Array<{ from: string; to: string }> } {
  const renamed: Array<{ from: string; to: string }> = [];
  let current = chapters;
  for (const name of takenNames(brief)) {
    const text = current.map((chapter) => `${chapter.title}\n${chapter.text}`).join("\n");
    if (!wordPattern(name).test(text)) continue;
    const used = new Set([...ownNames(brief), ...plan.cast.flatMap((member) => member.name.toLocaleLowerCase("de-DE").split(/\s+/))]);
    const fresh = FRESH_NAMES.find((candidate) => !used.has(candidate.toLocaleLowerCase("de-DE")) && !wordPattern(candidate).test(text));
    if (!fresh) continue;
    const pattern = wordPattern(name, "gu");
    const swap = (value: string) => value.replace(pattern, (_match, before: string, genitive: string) => `${before}${fresh}${genitive}`);
    current = current.map((chapter) => ({ title: swap(chapter.title), text: swap(chapter.text) }));
    for (const member of plan.cast) {
      if (member.from === "new" && wordPattern(name).test(member.name)) {
        member.name = swap(member.name);
        member.id = kebab(member.name);
      }
    }
    renamed.push({ from: name, to: fresh });
  }
  return { chapters: current, renamed };
}

/** Header lines of the one-shot (IDEE, REGEL, FIGUR …, FUNDSTÜCK, WISSEN) before the story. */
export function readOneShot(raw: string): {
  header: { idea: string; rule: string; figures: string[][]; artifactId: string | null; learningCore: string | null };
  story: { title: string; description: string; chapters: ParsedChapter[] };
} {
  const value = String(raw || "").replace(/\r\n/g, "\n");
  const head = value.split(/^\s*(?:#+\s*)?KAPITEL\s+1\s*[:.–-]/im)[0] || "";
  const line = (marker: string) => head.match(new RegExp(`^\\s*${marker}\\s*:\\s*(.+)$`, "im"))?.[1]?.replace(/[*_#]/g, "").trim() || "";
  const figures = [...head.matchAll(/^\s*FIGUR\s*:\s*(.+)$/gim)].map((match) => match[1].split("|").map((part) => part.replace(/[*_#]/g, "").trim()));
  const artifact = line("FUNDST(?:Ü|UE)CK");
  return {
    header: {
      idea: line("IDEE"),
      rule: line("REGEL"),
      figures,
      artifactId: artifact && !/^kein/i.test(artifact) ? artifact : null,
      learningCore: line("WISSEN") || null,
    },
    story: readStory(value),
  };
}

/** The plan the app keeps for a one-shot: cast and artifact from the header, chapters from the text. */
export function planFromHeader(header: ReturnType<typeof readOneShot>["header"], story: { title: string; description: string; chapters: ParsedChapter[] }, brief: StoryBrief): EpisodePlan {
  const full = story.chapters.map((chapter) => chapter.text).join("\n");
  const heroNames = new Set(brief.heroes.map((hero) => hero.name.toLocaleLowerCase("de-DE")));
  const appears = (name: string) => {
    const headWord = name.split(/\s+/).filter((part) => part.length > 2).pop() || name;
    return wordPattern(headWord).test(full);
  };
  const cast: EpisodeCastMember[] = [];
  const maxNew = brief.band === "3-5" ? 1 : 2;
  for (const parts of header.figures) {
    const [name = "", kind = "", ...rest] = parts;
    if (!name || heroNames.has(name.toLocaleLowerCase("de-DE")) || !appears(name)) continue;
    if (/^pool$/i.test(kind)) {
      const pooled = brief.candidates.find((candidate) => candidate.id === rest[0]) || brief.candidates.find((candidate) => candidate.name.toLocaleLowerCase("de-DE") === name.toLocaleLowerCase("de-DE"));
      if (pooled && !cast.some((member) => member.id === pooled.id)) {
        cast.push({ id: pooled.id, name: pooled.name, from: "pool", role: rest[1] || "companion", species: pooled.species, voice: "", wants: "", comicPattern: "" });
      }
    } else if (cast.filter((member) => member.from === "new").length < maxNew) {
      const [role = "companion", species = "creature", look = ""] = rest;
      if (look) cast.push({ id: kebab(name), name, from: "new", role, species, voice: "", wants: "", comicPattern: "", lookEn: look });
    }
  }
  // A pool figure the writer used without a header line still counts (rotation, pictures).
  for (const candidate of brief.candidates) {
    if (cast.some((member) => member.id === candidate.id) || cast.filter((member) => member.from === "pool").length >= brief.budget.maxCast) continue;
    if (appears(candidate.name)) cast.push({ id: candidate.id, name: candidate.name, from: "pool", role: "companion", species: candidate.species, voice: "", wants: "", comicPattern: "" });
  }
  const brought = broughtArtifact(brief);
  // The header names the id, sometimes the name — „artifact_098“, „artifact_098 (Entdeckungslupe)“ or „Entdeckungslupe“.
  const named = String(header.artifactId || "").toLocaleLowerCase("de-DE");
  const chosen = brought || (named ? brief.artifacts.find((option) => named.includes(option.id.toLocaleLowerCase("de-DE")) || named.includes(option.name.toLocaleLowerCase("de-DE"))) : undefined);
  const chapterOf = (needle: string, fallback: number, last = false) => {
    const word = needle.split(/\s+/).filter((part) => part.length > 2).pop() || needle;
    const hits = story.chapters.map((chapter, index) => (wordPattern(word).test(chapter.text) ? index + 1 : 0)).filter(Boolean);
    return hits.length ? (last ? hits[hits.length - 1] : hits[0]) : fallback;
  };
  return {
    ideas: header.idea ? [header.idea] : [],
    chosen: 1,
    title: story.title,
    summary: story.description,
    focusHero: brief.heroes[0]?.id,
    childSituation: header.idea,
    wonder: { rule: header.rule, who: "", firstEffect: "", escalation: [], endsWhen: "" },
    heroes: brief.heroes.map((hero) => ({ id: hero.id, name: hero.name, voice: "", contribution: "" })),
    cast,
    runningGags: [],
    attempts: [],
    nearDiscovery: "",
    quietMoment: "",
    courage: "",
    solution: "",
    setups: [],
    chapters: story.chapters.map((chapter) => ({ title: chapter.title, beats: [], laugh: "", ending: "" })),
    schoolyardLine: "",
    finalLaugh: "",
    artifact: chosen ? { id: chosen.id, role: "", firstChapter: chapterOf(chosen.name, 1), useChapter: chapterOf(chosen.name, story.chapters.length, true) } : null,
    learningCore: header.learningCore,
  };
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
  const own = ownNames(brief);
  for (const signature of SAMPLE_SIGNATURES) {
    // A hero or pool figure called Ella or Bruno is the family's, not a copy.
    if (own.has(signature.toLocaleLowerCase("de-DE"))) continue;
    if (wordPattern(signature).test(full)) hard.push(`„${signature}“ comes from the style reference — replace it with something of this story's own.`);
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
  /** Mode (default: TALEA_EPISODE_MODE, else one-shot), the two-step planner model and the efforts (default "low"). */
  options?: { mode?: EpisodeMode; plannerModel?: string; planEffort?: LlmRequest["effort"]; writeEffort?: LlmRequest["effort"] };
}): Promise<EpisodeResult> {
  const { brief, models, ledger, llm } = input;
  const observe = async (stage: string, payload: Record<string, unknown>) => {
    try { await input.observe?.(stage, payload); } catch { /* telemetry never changes the story */ }
  };
  const mode = input.options?.mode || resolveEpisodeMode();
  const written = mode === "one-shot" ? await oneShot(input, observe) : await twoStep(input, observe);
  const { plan, story, checks, revised } = written;
  if (story.chapters.length === 0) throw new Error(`[${EPISODE_PIPELINE_ID}] the writer returned no chapters.`);
  await observe("episode-checks", { mode, checks, revised, renamed: written.renamed });

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
    planRepaired: written.planRepaired,
    draftRetried: written.draftRetried,
    textQuality: { status: checks.hard.length ? "failed" : "unverified", issues: [...checks.hard, ...checks.soft] },
    episode: { plan, guests: guestsOf(plan), checks, revised, mode, renamed: written.renamed },
  };
}

type EngineInput = Parameters<typeof runEpisodeTextEngine>[0];
type Story = { title: string; description: string; chapters: ParsedChapter[] };
interface Written {
  plan: EpisodePlan;
  story: Story;
  checks: { hard: string[]; soft: string[] };
  revised: boolean;
  planRepaired: boolean;
  draftRetried: boolean;
  renamed: Array<{ from: string; to: string }>;
}

/** Series names out, then the checks. */
function settle(story: Story, plan: EpisodePlan, brief: StoryBrief, renamed: Written["renamed"]): { story: Story; checks: Written["checks"] } {
  const result = renameTakenNames(story.chapters, plan, brief);
  renamed.push(...result.renamed);
  const settled = { ...story, chapters: result.chapters };
  return { story: settled, checks: storyChecks(settled.chapters, plan, brief) };
}

/** Bible and story in one call; the header carries cast, artifact and knowledge. */
async function oneShot(input: EngineInput, observe: Observe): Promise<Written> {
  const { brief, models, ledger, llm } = input;
  const system = oneShotSystemPrompt(brief);
  const maxTokens = Math.ceil(brief.budget.totalWordsMax * 2.6 + 8000);
  const renamed: Written["renamed"] = [];
  const call = async (stage: string, revision?: { raw: string; notes: string[] }) => {
    const result = await llm({ stage, role: "writer", model: models.writer, system, user: oneShotUserPrompt(brief, revision), json: false, maxTokens, effort: input.options?.writeEffort || "low", timeoutMs: 420_000 });
    ledger.recordCall(stage, result, "writer");
    const parsed = readOneShot(result.text);
    await observe(stage, { model: result.modelUsed, usage: result.usage, durationMs: result.durationMs, header: parsed.header, words: parsed.story.chapters.map((chapter) => countWords(chapter.text)) });
    return { raw: result.text, ...parsed };
  };
  let draft = await call("episode-oneshot");
  let draftRetried = false;
  if (draft.story.chapters.length === 0) {
    draftRetried = true;
    draft = await call("episode-oneshot-retry");
  }
  let plan = planFromHeader(draft.header, draft.story, brief);
  let { story, checks } = settle(draft.story, plan, brief, renamed);
  let revised = false;
  if (checks.hard.length) {
    const candidate = await call("episode-revision", { raw: draft.raw, notes: [...checks.hard, ...checks.soft] });
    const candidatePlan = planFromHeader(candidate.header, candidate.story, brief);
    const settled = settle(candidate.story, candidatePlan, brief, renamed);
    if (settled.checks.hard.length < checks.hard.length) {
      ({ story, checks } = settled);
      plan = candidatePlan;
      revised = true;
    }
  }
  return { plan, story, checks, revised, planRepaired: false, draftRetried, renamed };
}

/** Story bible + chapter plan as JSON, then the story. */
async function twoStep(input: EngineInput, observe: Observe): Promise<Written> {
  const { brief, models, ledger, llm } = input;
  const plannerModel = input.options?.plannerModel || models.writer;
  const renamed: Written["renamed"] = [];

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
  const first = await write("episode-write");
  let draftRetried = false;
  let draft = first;
  if (draft.chapters.length === 0) {
    draftRetried = true;
    draft = await write("episode-write-retry");
  }
  let { story, checks } = settle(draft, plan, brief, renamed);
  let revised = false;
  if (checks.hard.length) {
    const candidate = await write("episode-revision", { chapters: story.chapters, notes: [...checks.hard, ...checks.soft] });
    const settled = settle({ title: candidate.title || story.title, description: candidate.description || story.description, chapters: candidate.chapters }, plan, brief, renamed);
    if (settled.checks.hard.length < checks.hard.length) {
      ({ story, checks } = settled);
      revised = true;
    }
  }
  return { plan, story, checks, revised, planRepaired, draftRetried, renamed };
}
