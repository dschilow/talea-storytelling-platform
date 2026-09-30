/**
 * Storybook Pipeline — the story brief every stage shares.
 *
 * Built once, deterministically, from the wizard config, the avatars, the cast
 * candidates and the artifact. Stages render the parts they need; nothing here
 * calls a model.
 */

import type { StoryConfig } from "../generate";
import { languageName, type AgeBand, type LengthBudget } from "./craft";
import type { ArtifactOption, CastCandidate, StorybookHero } from "./types";

export interface StoryBrief {
  config: StoryConfig;
  band: AgeBand;
  budget: LengthBudget;
  languageLabel: string;
  heroes: Array<StorybookHero & { id: string }>;
  candidates: CastCandidate[];
  /** A brought artifact is mandatory; reward options are optional. */
  artifacts: ArtifactOption[];
  /** Short summaries of this family's recent stories, newest first. */
  recentStories: string[];
  recentEngineIds: string[];
  /** Titles of each hero's previous adventures, for at most one callback. */
  heroMemories: Record<string, string[]>;
  blockedTerms: string[];
  seed: string;
  /** Test-only switches (scripts/storybook-live-test.ts --variant). Empty in production. */
  experiment?: StorybookExperiment;
}

export interface StorybookExperiment {
  /** Core rules only and a plan with half the fields. */
  slim?: boolean;
  /** Pool characters may be cast, but need not be. */
  castOptional?: boolean;
  /** Picture-book form: short pages, read-aloud rhythm, a laugh cascade, a heart moment. */
  pictureBook?: boolean;
  /** The writer re-reads its story in its head before answering (same call, no extra step). */
  selfCheck?: boolean;
  /** The writer polishes its own story once (instead of the support model's patch). */
  writerPolish?: boolean;
  /** Thinking depth of the one-shot writer (default "low"). */
  writerEffort?: "low" | "medium" | "high";
  /** Thinking depth for concept and plan (default "low"). */
  planEffort?: "low" | "medium" | "high";
  /** Model for concept and plan (default: the support model). */
  plannerModel?: string;
  /**
   * "Schlank": one planner call instead of concept + plan, the plan checked by
   * the support model (serious defects only), writing at "low", a leaner
   * review, revision only on real defects, no final A/B.
   */
  lean?: boolean;
  /** "Spar": lean, plus no plan review and the support model as reviewer. */
  spar?: boolean;
  /** The multi-stage chain (concept → plan → review → draft → review → revision) instead of one shot. */
  legacy?: boolean;
}

export function isLean(brief: { experiment?: StorybookExperiment }): boolean {
  return Boolean(brief.experiment?.lean || brief.experiment?.spar);
}

const FLAVOR_LABELS: Record<string, string> = {
  lachfreude: "zum Lachen",
  warmherzigkeit: "warmherzig",
  prickeln: "spannend, mit Kribbeln",
  uebermut: "verrückt und übermütig",
  zusammenhalt: "mit Bedeutung und Zusammenhalt",
};

const GENRE_LABELS: Record<string, string> = {
  fairy_tales: "Märchen",
  adventure: "Abenteuer",
  magic: "Magie und Zauber",
  animals: "Tiergeschichte",
  scifi: "Weltraum und Zukunft",
  modern: "Alltag von heute",
};

const SETTING_LABELS: Record<string, string> = {
  fantasy: "Märchen- und Fantasiewelt",
  medieval: "Mittelalter mit Burgen und Dörfern",
  forest: "Wald",
  village: "Dorf",
  castle: "Burg oder Schloss",
  mountain: "Berge",
  beach: "Strand und Meer",
  ocean: "Meer",
  city: "Stadt",
  space: "Weltraum",
  home: "Zuhause",
  school: "Schule",
  cave: "Höhle",
};

const TRAIT_LABELS: Record<string, string> = {
  knowledge: "Wissen",
  creativity: "Kreativität",
  vocabulary: "Wortschatz",
  courage: "Mut",
  curiosity: "Neugier",
  teamwork: "Teamgeist",
  empathy: "Empathie",
  persistence: "Ausdauer",
  logic: "Logik",
};

export function heroIdOf(hero: StorybookHero, index: number): string {
  return String(hero.id || "").trim() || `hero-${index + 1}`;
}

function clean(value: unknown, max = 200): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Strongest earned traits. All avatars start at 0, so this is often empty. */
function strongestTraits(hero: StorybookHero): string[] {
  const traits = hero.personalityTraits && typeof hero.personalityTraits === "object" ? hero.personalityTraits : null;
  if (!traits) return [];
  return Object.entries(traits)
    .map(([key, value]) => ({ key, value: typeof value === "number" ? value : Number((value as any)?.value) }))
    .filter((entry) => Number.isFinite(entry.value) && entry.value >= 5 && TRAIT_LABELS[entry.key])
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .map((entry) => TRAIT_LABELS[entry.key]);
}

/** One compact line per hero. Appearance stays out — it belongs to the pictures. */
/**
 * Planning view of a hero. Quirk and catchphrase stay OUT on purpose: given to
 * the concept stage they became the engine of every story (batch 2026-09-28:
 * Mina's mosaic stones solved six stories out of six). The writer receives
 * them separately as optional seasoning (heroSeasoning).
 */
export function heroSheet(hero: StorybookHero & { id: string }, memories: string[] = []): string {
  const bits: string[] = [];
  if (typeof hero.age === "number" && hero.age > 0) bits.push(`${hero.age} Jahre`);
  const narrative = hero.narrativeProfile && typeof hero.narrativeProfile === "object" ? hero.narrativeProfile : {};
  const personality = [clean(narrative.dominantPersonality, 48), ...(Array.isArray(narrative.traits) ? narrative.traits.map((t: unknown) => clean(t, 32)) : [])]
    .filter(Boolean);
  if (personality.length) bits.push(`Wesen: ${[...new Set(personality)].slice(0, 4).join(", ")}`);
  const description = clean(hero.description, 220);
  if (description) bits.push(`Beschreibung: ${description}`);
  const strengths = strongestTraits(hero);
  if (strengths.length) bits.push(`bisher gewachsen in: ${strengths.join(", ")}`);
  if (memories.length) bits.push(`frühere Abenteuer: ${memories.slice(0, 2).map((t) => `„${clean(t, 70)}“`).join(", ")}`);
  return `- ${hero.name} [id: ${hero.id}] — ${bits.join(" | ") || "keine weiteren Angaben"}`;
}

/** Quirk and catchphrase for the writer: at most once each, never the solution. */
export function heroSeasoning(hero: StorybookHero): string {
  const narrative = hero.narrativeProfile && typeof hero.narrativeProfile === "object" ? hero.narrativeProfile : {};
  const bits: string[] = [];
  if (clean(narrative.quirk)) bits.push(`Eigenart: ${clean(narrative.quirk, 160)}`);
  if (clean(narrative.catchphrase)) bits.push(`typischer Satz: „${clean(narrative.catchphrase, 100)}“`);
  return bits.join("; ");
}

/**
 * Pool data spells Fauchi's line "Erst qualmts, dann klaerts sich!". Both Sol
 * models copy a given spelling letter by letter (a prompt hint did nothing,
 * 2026-09-30), so the line is corrected before the writer ever sees it.
 */
export function fixCatchphrase(text: string): string {
  return String(text || "").replace(/\bklaerts\b/gi, (word) => (word[0] === "K" ? "Klärt's" : "klärt's")).replace(/\bqualmts\b/gi, (word) => (word[0] === "Q" ? "Qualm's" : "qualm's"));
}

export function castSheet(candidate: CastCandidate, compact = false): string {
  const bits: string[] = [`- ${candidate.name} [id: ${candidate.id}]`, candidate.whoTheyAre];
  if (candidate.backstory) bits.push(`Vorgeschichte: ${clean(candidate.backstory, compact ? 160 : 360)}`);
  if (candidate.personality.length) bits.push(`Wesen: ${candidate.personality.slice(0, compact ? 2 : 4).join(", ")}`);
  if (candidate.quirk) bits.push(`Eigenart: ${clean(candidate.quirk, compact ? 100 : 160)}`);
  if (candidate.speechStyle.length) bits.push(`spricht: ${candidate.speechStyle.slice(0, compact ? 1 : 3).join(", ")}`);
  if (candidate.catchphrase) bits.push(`Spruch (nur wenn er zur Szene passt, höchstens einmal, nie als Refrain): „${fixCatchphrase(candidate.catchphrase)}“`);
  return bits.join(" | ");
}

export function artifactSheet(artifact: ArtifactOption): string {
  const bits = [`- ${artifact.name} [id: ${artifact.id}]`];
  if (artifact.description) bits.push(clean(artifact.description, 200));
  bits.push(`Was es kann (unveränderlich, inklusive Grenzen): ${clean(artifact.rule, 400)}`);
  return bits.join(" | ");
}

/** Every narrative wizard control, in plain words. */
export function wishLines(config: StoryConfig): string[] {
  const lines: string[] = [];
  const genre = GENRE_LABELS[String(config.genre || "")] || clean(config.genre, 40);
  if (genre) lines.push(`Genre: ${genre}`);
  if (config.setting && config.setting !== "varied") {
    lines.push(`Schauplatz-Wunsch: ${SETTING_LABELS[String(config.setting).toLowerCase()] || clean(config.setting, 60)}`);
  }
  const flavors = (Array.isArray((config as any).emotionalFlavors) ? (config as any).emotionalFlavors : [])
    .map((flavor: string) => FLAVOR_LABELS[flavor] || flavor)
    .filter(Boolean);
  if (flavors.length) lines.push(`Die Geschichte soll sich anfühlen: ${flavors.join(", ")}`);
  if (typeof config.humorLevel === "number") lines.push(`Humor: ${config.humorLevel >= 2 ? "viel, zum lauten Lachen" : config.humorLevel <= 0 ? "wenig, eher still" : "schon, aber nicht albern"}`);
  if (typeof config.suspenseLevel === "number") lines.push(`Spannung: ${config.suspenseLevel >= 2 ? "hoch, mit echtem Kribbeln" : config.suspenseLevel <= 0 ? "sanft, geborgen" : "mittel"}`);
  if (config.hasTwist) lines.push("Eine überraschende Wendung ist gewünscht — früh angedeutet, nicht aus dem Nichts.");
  if (config.allowRhymes) lines.push("Reime sind willkommen: mindestens der wiederkehrende Satz reimt sich.");
  if (config.requireHappyEnd !== false) lines.push("Das Ende geht gut aus.");
  if (config.requireMoral) lines.push("Eine Botschaft ist gewünscht — sie wird nur durch die Handlung gezeigt, nie ausgesprochen.");
  if (config.avatarIsHero === false) lines.push("Die Avatare dürfen auch Begleiter sein, müssen aber etwas Entscheidendes beitragen.");
  if (config.allowFamousCharacters) lines.push("Gemeinfreie Märchenfiguren dürfen als Gäste auftreten; die Helden bleiben die Helden.");
  if (config.learningMode?.enabled && config.learningMode.subjects?.length) {
    lines.push(`Nebenbei lernen: ${config.learningMode.subjects.join(", ")} — sachlich richtig, in die Handlung eingebaut, kein Unterricht.`);
  }
  const wish = clean(config.customPrompt, 500);
  if (wish) lines.push(`Wunsch des Kindes / der Eltern (hat Vorrang): ${wish}`);
  if (config.parentalGuidance) lines.push(`Elternvorgabe (verbindlich): ${clean(config.parentalGuidance, 400)}`);
  return lines;
}

export function briefHeader(brief: StoryBrief): string[] {
  return [
    `Sprache der Geschichte: ${brief.languageLabel}`,
    `Alter der Zuhörer: ${brief.band} Jahre`,
    `Umfang: genau ${brief.budget.pages} Bilderbuchseiten, je ${brief.budget.wordsPerPageMin}–${brief.budget.wordsPerPageMax} Wörter, jede Seite bekommt ein eigenes Bild`,
  ];
}

export function buildBrief(input: {
  config: StoryConfig;
  band: AgeBand;
  budget: LengthBudget;
  heroes: StorybookHero[];
  candidates: CastCandidate[];
  artifacts: ArtifactOption[];
  recentStories?: string[];
  recentEngineIds?: string[];
  heroMemories?: Record<string, string[]>;
  blockedTerms?: string[];
  seed: string;
  experiment?: StorybookExperiment;
}): StoryBrief {
  return {
    config: input.config,
    band: input.band,
    budget: input.budget,
    languageLabel: languageName(input.config.language),
    heroes: input.heroes.map((hero, index) => ({ ...hero, id: heroIdOf(hero, index) })),
    candidates: input.candidates,
    artifacts: input.artifacts,
    recentStories: (input.recentStories || []).slice(0, 8),
    recentEngineIds: input.recentEngineIds || [],
    heroMemories: input.heroMemories || {},
    blockedTerms: (input.blockedTerms || []).map((term) => clean(term, 60)).filter(Boolean),
    seed: input.seed,
    experiment: input.experiment,
  };
}

export function broughtArtifact(brief: StoryBrief): ArtifactOption | undefined {
  return brief.artifacts.find((artifact) => artifact.broughtBy);
}
