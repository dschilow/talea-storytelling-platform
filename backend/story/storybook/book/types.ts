/**
 * Chapter book (chapter-book-v1) — shared types.
 *
 * A chapter book is read over several evenings: one to two chapters a night,
 * 8 to 15 chapters per volume. It reuses the storybook-v2 engine's port, cast
 * pool, wishes, checks, illustration director and image ladder, but it is
 * planned before it is written: idea and casting first, then a binding plan
 * (bible + chapter plan) that a critic of another model family reviews, then
 * the chapters in batches with a critic read, targeted rewrites, a patch and a
 * logbook of what the released text actually says.
 */

import type { StoryBrief } from "../context";
import type { CastCandidate, StoryElement } from "../types";

/** How the volume feels; every form has its own plan template. */
export type ExperienceForm = "mystery" | "journey" | "funny" | "cozy";

/**
 * Who drives the plot (2026-10-16, "Die Türlaunische": every book grew out of the heroes' own traits,
 * nobody worked against them, and the listener never knew more than the heroes).
 *   heroes  — the classic Talea book: the heroes' wish drives it, an obstacle with its own logic stands in the way.
 *   villain — someone with a plan the heroes do not know drives it; the book may open with that plan, the
 *             listener knows more than the heroes, the heroes react until the middle and act from then on.
 *   guest   — a figure with its own mission and secret is the star; the heroes are its allies and keep it
 *             hidden; suspense comes from near-discovery and from what the guest does not tell.
 * In every engine the heroes stay the point of view and make the decisive move of the finale.
 */
export type StoryEngine = "heroes" | "villain" | "guest";

/** How the opposing figure ends, by age: a comic villain may simply lose (6-8), a misunderstood one is answered (3-5), a real one is beaten (9-12). */
export type VillainStyle = "comic" | "misunderstood" | "real";

/** The opposing figure with a plan of its own — the second motor of the book. */
export interface BookVillain {
  who: string;
  /** What the villain wants, in a child's words. */
  goal: string;
  /** The plan as the villain sees it. */
  plan: string;
  /** Moves the villain makes WITHOUT the heroes present, each in its chapter: these are the scenes the listener sees and the heroes do not. */
  moves: Array<{ chapter: number; move: string }>;
  /** The flaw the heroes use in the finale. */
  weakness: string;
  /** The chapter in which the heroes see through the plan (by the middle of the book). */
  exposedBy: number;
  /** How it ends for the villain. */
  outcome: string;
  style: VillainStyle;
}

/** What every hero must own in the book, whoever drives the plot (the avatar is the child: it must never be a bystander). */
export interface HeroDuty {
  hero: string;
  /** The hero's own ability or habit that turns the plot once — and the chapter where it does. */
  talent: string;
  talentChapter: number;
  /** The decision only this hero makes at the climax. */
  decision: string;
  decisionChapter: number;
  /** The feeling the hero ends the book with, shown in a gesture or a line. */
  feelingEnd: string;
}

/** How many chapters one writer call produces. Measured in phase A of the plan. */
export type ChapterWriteMode = "batch" | "single" | "whole";

export interface BookBudget {
  chapters: number;
  wordsPerChapterMin: number;
  wordsPerChapterMax: number;
  imagesPerChapter: number;
  /** Pool characters a volume may cast (heroes not counted). */
  maxPoolCast: number;
  maxCharactersPerImage: number;
}

/** Test-only switches (scripts/book-live-test.ts). Empty in production. */
export interface BookExperiment {
  writeMode?: ChapterWriteMode;
  /** Chapters per writer call in batch mode (default 3). */
  batchSize?: number;
  /** Chapters in the first batch (default 1: the first chapter appears while the next ones are written). */
  firstBatch?: number;
  planEffort?: "low" | "medium" | "high";
  chapterEffort?: "minimal" | "low" | "medium";
  /** Another model writes the chapters from Sol's plan (cost experiment). */
  chapterWriterModel?: string;
  skipPlanReview?: boolean;
  /** Model for pitch and plan (user idea 2026-10-14: Luna plans, Sol only writes). Default: the writer. */
  plannerModel?: string;
}

/** A pool character as the casting call sees it: one line, plus what decides the casting. */
export interface CatalogueEntry extends CastCandidate {
  /** How often the character appeared in the family's recent stories. */
  recentUses: number;
  hasImage: boolean;
}

/** What a finished volume leaves for the next one (phase C: Band 2). */
export interface SeriesMemory {
  seriesTitle: string;
  volume: number;
  /** Pool ids of the cast that belongs to the series. */
  castIds: string[];
  home: string;
  world: string;
  /** What happened in each volume so far, in two or three sentences each. */
  volumes: Array<{ volume: number; title: string; summary: string }>;
  openThreads: string[];
  runningGags: string[];
  items: string[];
  relationships: string[];
  /** What each hero learned or overcame, one line per volume ("Alexander: erst zuhören, dann handeln") — the next volume gives them another inner arc. */
  lessons?: string[];
  /** The core motifs used so far (the wonder, the central thing, the kind of activity) — the next volume avoids them. */
  motifs?: string[];
}

export interface BookBrief extends StoryBrief {
  book: BookBudget;
  form: ExperienceForm;
  /** The whole active pool, for idea-first casting. `candidates` holds the chosen cast after casting. */
  catalogue: CatalogueEntry[];
  series?: SeriesMemory | null;
  /** The child's choice or wish for the next volume (continuation only). */
  continuation?: { teaser?: string; wish?: string } | null;
  bookExperiment?: BookExperiment;
}

export interface BookPitchIdea {
  title: string;
  premise: string;
  bigQuestion: string;
  wonder: string;
  roles: Array<{ role: string; castId: string | null; why: string }>;
  /** Who drives this idea's plot (types.ts StoryEngine). Missing in old pitches: heroes. */
  engine?: StoryEngine;
  /** The figure that drives the plot when the engine is villain or guest: a catalogue alias, a cast id or the wonder's name. */
  engineFigure?: string;
  /** What is lost if the heroes fail, as a thing a six-year-old could draw. */
  stake?: string;
}

export interface BookPitch {
  ideas: BookPitchIdea[];
  /** 1-based index into ideas. */
  choice: number;
  why: string;
}

export interface BookCharacterProfile {
  name: string;
  /** Who they are to the heroes and why they are here — what a child must learn at the first appearance. */
  introduction?: string;
  wants: string;
  can: string;
  /** A quirk with side effects: the comic engine and sometimes the problem. */
  flaw: string;
  avoids: string;
  voice: string;
  challengedBy: string;
  /** A decision at the end the character could not have made at the start. */
  finalChoice: string;
  /** Cast only: the one thing this figure DOES that changes the heroes' path (not help — a turn), and its chapter. */
  turn?: { chapter: number; what: string };
}

export interface BookSetup {
  id: string;
  what: string;
  planted: number;
  paidOff: number;
}

export interface BookChapterPlan {
  n: number;
  title: string;
  type: string;
  place: string;
  event: string;
  /** How this chapter moves the big question forward. */
  progress: string;
  /** The planned laugh, built from a character. */
  laugh: string;
  /** What the chapter's central hero feels or secretly thinks, and the quiet moment where it shows (voice.ts). */
  feeling?: string;
  /** The gentle bedtime hook; the last chapter's closing picture. */
  hook: string;
  cast: string[];
  plants: string[];
  payoffs: string[];
  gagBeat?: string;
  /** Paintable moments in reading order, one per picture. */
  pictures: string[];
  /**
   * A short scene WITHOUT the heroes (the villain at work, the guest's secret) that the listener sees and the
   * heroes do not — dramatic irony. At most 15 % of the chapter, set apart by a time cue ("Unterdessen …").
   */
  opponentScene?: string;
  /** Whose scene opens the chapter: the heroes' (default) or the opponent's (a cold open, mostly chapter 1 of a villain book). */
  pov?: "heroes" | "opponent";
}

export interface BookBible {
  world: string;
  home: string;
  bigQuestion: string;
  /** What really happens and why — the author knows it before chapter 1. */
  truth: string;
  limits: string;
  /** A bypass or escape route shown early and needed later. */
  workaround: string;
  stakes: string;
  personalReason: string;
  /** Exactly one, visible. */
  deadline: string;
  opponent: { who: string; motive: string; logic: string } | null;
  characters: BookCharacterProfile[];
  runningGag: { gag: string; beats: Array<{ chapter: number; beat: string }> };
  twistChapter: number;
  lowPointChapter: number;
  solution: { how: string; uses: string[] };
  /** The exact wording of every spell, rhyme, rule sentence, sign or last line the story hinges on. */
  fixedWordings?: BookWording[];
  /** What heroes and companion give each other, and the companion's sore spot (heart-and-wit.ts). */
  heart?: string;
  /** What the heroes know that the grown-ups do not; empty when the story has none. */
  secret?: string;
  /** Planned misunderstandings, literal takes and coined words, each in one chapter. */
  freshEyes?: Array<{ chapter: number; moment: string }>;
  /** Who drives the plot (StoryEngine). Missing in old plans: heroes. */
  engine?: StoryEngine;
  /** The name of the figure that drives the plot (villain or guest); empty for the heroes engine. */
  engineFigure?: string;
  /** The opposing figure with a plan of its own; null when the book has none (cosy) or the obstacle has no will. */
  villain?: BookVillain | null;
  /** Moments where the listening child knows more than the heroes, each in its chapter. */
  readerKnowsMore?: Array<{ chapter: number; what: string }>;
  /** What each hero owns in this book: a talent that turns the plot, the decision at the climax, the feeling at the end. */
  heroDuties?: HeroDuty[];
  /** The stake as a thing a six-year-old could draw. */
  stakeVisible?: string;
}

/** A line that must stay letter for letter wherever it is spoken or read. */
export interface BookWording {
  what: string;
  text: string;
}

export interface BookPlan {
  title: string;
  description: string;
  bible: BookBible;
  setups: BookSetup[];
  chapters: BookChapterPlan[];
  /** Pool ids actually cast in the plan. */
  castIds: string[];
  artifact: { id: string; foundIn: number; use: string } | null;
  sequelTeasers: string[];
}

export interface PlanReview {
  checks: Record<string, boolean>;
  scores: { redThread: number; suspense: number; humor: number; characters: number; logic: number; overall: number };
  mustFix: Array<{ chapter: number | null; problem: string }>;
  /** Always listed, even for a good plan; "high" ones go into the revision. */
  weaknesses: Array<{ chapter: number | null; problem: string; severity: "high" | "low" }>;
  verdict: string;
}

export interface BookChapter {
  order: number;
  title: string;
  content: string;
  /** Two kid-facing sentences for "Was bisher geschah"; from the released text. */
  recap: string;
}

export interface BookFact {
  chapter: number;
  fact: string;
}

export interface ChapterCritique {
  n: number;
  laugh: string | null;
  hook: string | null;
  suspense: number;
  humor: number;
  /** 0-10: a narrator's voice with inner life and rhythm, or a script. null when the critic gave none. */
  voice: number | null;
  /** The exact sentence in which someone states a lesson or motto; null when there is none. */
  lesson: string | null;
  progress: boolean;
  missingPlants: string[];
  /** The critic quoted something the text does not contain (kept to tell a paraphrase from a missing laugh). */
  unmatched?: { laugh?: string; hook?: string };
  /** The opposing force (villain, guest's secret, deadline) is felt in this chapter. null when the critic gave none. */
  opponentPresent?: boolean | null;
  /** A rhyme or chant the heroes speak that is not among the fixed wordings; null when there is none. */
  newChant?: string | null;
}

export interface ChapterCurvePoint {
  chapter: number;
  suspense: number;
  humor: number;
  /** The critic's voice score (narrator, inner life, rhythm); absent when the critic gave none. */
  voice?: number | null;
  /** Measured on the released text: words per sentence and the share of dialogue (voice.ts). */
  prose?: { avgSentenceLength: number; dialogueShare: number; innerLife: number };
  laugh: string | null;
  hook: string | null;
  rewritten: boolean;
  patched: boolean;
  /** Why the writer rewrote the chapter: no-laugh, laugh-unmatched, no-progress, missing-plant, too-short, script-like. */
  rewriteReasons?: string[];
  /** The chapter ended without a gentle hook and the support model patched its ending. */
  hookPatched?: boolean;
  /** The critic felt the opposing force in this chapter (villain, secret, deadline); absent when the critic gave none. */
  opponentPresent?: boolean;
  /** Share of the chapter's words in scenes without the heroes (measured, voice.ts interludeShare). */
  interludeShare?: number;
  /** The sentence in which someone stated a lesson, as the critic quoted it (counted across the book). */
  lesson?: string | null;
  /** The planned laugh did not land and the patch was asked to build it in (no rewrite). */
  laughPatched?: boolean;
  /** A measured voice issue the critic contradicted (voice ≥ 8): no rewrite was paid for. */
  voiceDisputed?: boolean;
}

/** Everything the next batch needs. Persisted between job runs in production. */
export interface BookState {
  chapters: BookChapter[];
  facts: BookFact[];
  knowledge: Array<{ chapter: number; who: string; knows: string }>;
  curve: ChapterCurvePoint[];
  /** Notes that could not be fixed, per chapter. */
  openIssues: Array<{ chapter: number; issue: string }>;
  storyElements?: StoryElement[];
  /** The current state of things that change (how many rooms, which knot is tied, what is wet) — latest entry per thing. */
  worldState?: Array<{ thing: string; now: string; chapter: number }>;
  /** Spells, rhymes, signs and key sentences introduced in the text, verbatim — later chapters copy them exactly. */
  wordings?: BookWording[];
  /** Questions the released text made a child ask and has not answered yet. */
  openThreads?: OpenThread[];
}

/**
 * A question the text raised ("Schatto führt Regie": the small second shadow at Schatto's feet
 * appeared three times and was never explained). Ids F1, F2 … are stable while it is open.
 */
export interface OpenThread {
  id: string;
  chapter: number;
  question: string;
}

export function emptyBookState(): BookState {
  return { chapters: [], facts: [], knowledge: [], curve: [], openIssues: [], worldState: [] };
}
