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
  /** The gentle bedtime hook; the last chapter's closing picture. */
  hook: string;
  cast: string[];
  plants: string[];
  payoffs: string[];
  gagBeat?: string;
  /** Paintable moments in reading order, one per picture. */
  pictures: string[];
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
  progress: boolean;
  missingPlants: string[];
  /** The critic quoted something the text does not contain (kept to tell a paraphrase from a missing laugh). */
  unmatched?: { laugh?: string; hook?: string };
}

export interface ChapterCurvePoint {
  chapter: number;
  suspense: number;
  humor: number;
  laugh: string | null;
  hook: string | null;
  rewritten: boolean;
  patched: boolean;
  /** Why the writer rewrote the chapter: no-laugh, laugh-unmatched, no-progress, missing-plant, too-short. */
  rewriteReasons?: string[];
  /** The chapter ended without a gentle hook and the support model patched its ending. */
  hookPatched?: boolean;
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
}

export function emptyBookState(): BookState {
  return { chapters: [], facts: [], knowledge: [], curve: [], openIssues: [], worldState: [] };
}
