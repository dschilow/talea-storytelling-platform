/**
 * Storybook Pipeline (storybook-v2) — shared types.
 *
 * Design rule for this folder: the WRITER only ever sees story language. The
 * plan's structure words (setup, payoff, dramatic irony) belong to the planner
 * and the critic; the draft prompt turns them into plain instructions.
 */

import type { StoryConfig } from "../generate";

export interface StorybookHero {
  id?: string;
  name: string;
  age?: number | null;
  description?: string;
  imageUrl?: string;
  visualProfile?: any;
  physicalTraits?: any;
  personalityTraits?: any;
  narrativeProfile?: any;
}

/** A pool character offered to the concept stage. The story picks, not the dice. */
export interface CastCandidate {
  id: string;
  name: string;
  /** human | animal | magical_creature | mythical | … — drives image anatomy locks. */
  species: string;
  ageCategory?: string | null;
  role?: string | null;
  archetype?: string | null;
  /** Short German "who is this", built from the pool row. */
  whoTheyAre: string;
  personality: string[];
  speechStyle: string[];
  quirk?: string;
  catchphrase?: string;
  catchphraseContext?: string;
  imageUrl?: string;
  visualProfile?: any;
  physicalDescription?: string;
}

/** A catalogue artifact: either brought along by an avatar or a possible reward. */
export interface ArtifactOption {
  id: string;
  name: string;
  nameEn?: string;
  description?: string;
  category?: string;
  rarity?: string;
  /** What the artifact can do, including its limits. Never changed by a story. */
  rule: string;
  visualKeywords: string[];
  emoji?: string;
  imageUrl?: string;
  /** Avatar id when the wizard took this artifact along (Mitnehmen-Loop). */
  broughtBy?: string;
}

export interface StoryPitch {
  engine: string;
  title: string;
  logline: string;
  heroWant: string;
  stakes: string;
  obstacle: { who: string; want: string; weakness: string };
  comicEngine: string;
  runningGag: string;
  dramaticIrony: string;
  escalation: string[];
  lowPoint: string;
  cleverSolution: string;
  plantedClue: string;
  heroRoles: Array<{ heroId: string; strength: string; contribution: string }>;
  cast: Array<{ id: string; role: string }>;
  artifact: { id: string; use: string } | null;
  lastPage: string;
  whyKidsLoveIt: string;
}

export interface PlanPage {
  page: number;
  place: string;
  /** What visibly happens, 1-3 sentences. */
  action: string;
  /** What a hero decides or does on this page. */
  heroMoment: string;
  humor: string;
  emotion: string;
  /** Why the child turns the page: a concrete question, sound or surprise. */
  turn: string;
  /** The single strongest visual moment, for the illustrator. */
  picture: string;
  /** Hero and cast ids present on this page. */
  onPage: string[];
}

export interface StoryPlan {
  title: string;
  logline: string;
  engine: string;
  chosenPitch: number;
  whyChosen: string;
  want: string;
  stakes: string;
  worldRule: string | null;
  /** How the rule is SHOWN before it is needed (page + visible demonstration). */
  ruleIntro: string | null;
  /** Why the solution works, in one sentence a six-year-old understands. */
  solutionWhy: string;
  refrain: string | null;
  runningGag: { what: string; beats: string[] };
  dramaticIrony: string;
  setups: Array<{ what: string; plantedOnPage: number; paysOffOnPage: number }>;
  heroes: Array<{ id: string; name: string; strength: string; voice: string; contribution: string }>;
  cast: Array<{ id: string; name: string; role: string; want: string; voice: string; signature: string }>;
  artifact: { id: string; name: string; role: string; firstPage: number; usePage: number; carried: boolean } | null;
  pages: PlanPage[];
  ending: { resolution: string; callback: string; lastLine: string };
}

export interface StorybookPage {
  order: number;
  title: string;
  content: string;
}

export interface ReviewNote {
  page: number;
  quote: string;
  problem: string;
  fix: string;
}

export interface EditorialReview {
  /** What a first-time listener can answer from the text alone. null = not answerable. */
  comprehension: { want: string | null; problem: string | null; solution: string | null; ending: string | null };
  scores: {
    hook: number;
    clarity: number;
    logic: number;
    humor: number;
    suspense: number;
    heroAgency: number;
    characters: number;
    language: number;
    ending: number;
    overall: number;
  };
  mustFix: ReviewNote[];
  polish: ReviewNote[];
  keep: string[];
  languageErrors: Array<{ page: number; quote: string; correction: string }>;
  verdict: string;
}

export interface PairwiseVerdict {
  /** Which of the two presented versions is better ("A" or "B"). */
  winner: "A" | "B";
  reason: string;
  remainingProblems: string[];
}

export interface IllustrationShot {
  /** 0 = cover. */
  page: number;
  /** English scene description: action, composition, camera, setting, light. */
  scene: string;
  /** Hero and cast ids that are drawn. At most three. */
  onStage: string[];
  artifactVisible: boolean;
}

export interface IllustrationPlan {
  cover: IllustrationShot;
  pages: IllustrationShot[];
}

export interface CheckIssue {
  code: string;
  severity: "hard" | "soft";
  message: string;
  /** 1-based reading page, when the issue is page-scoped. */
  page?: number;
}

export interface CheckReport {
  ok: boolean;
  hard: CheckIssue[];
  soft: CheckIssue[];
}

export interface StorybookGenerationInput {
  config: StoryConfig;
  userId?: string;
  storyId?: string;
  heroes: StorybookHero[];
  primaryProfileAge?: number | null;
  /** Parental-control terms that must not appear anywhere in the story. */
  blockedTerms?: string[];
}

export interface StorybookAvatarDevelopment {
  avatarId?: string;
  name: string;
  changedTraits: Array<{ trait: string; change: number; description: string }>;
}

export interface StorybookPendingArtifact {
  id: string;
  name: string;
  nameEn?: string;
  description?: string;
  category?: string;
  rarity?: string;
  storyRole?: string;
  visualKeywords?: string[];
  emoji?: string;
  imageUrl?: string;
  discoveryChapter: number;
  usageChapter: number;
  locked: true;
}

export interface StorybookGeneratedStory {
  title: string;
  description: string;
  coverImageUrl?: string;
  displayMode: "reading_pages";
  chapters: Array<{
    id: string;
    title: string;
    content: string;
    order: number;
    imageUrl?: string;
    imagePrompt?: string;
    imageModel?: string;
  }>;
  avatarDevelopments: StorybookAvatarDevelopment[];
  pendingArtifact?: StorybookPendingArtifact;
  metadata: Record<string, any>;
}
