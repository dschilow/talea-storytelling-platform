/**
 * Storybook Pipeline (storybook-v2) — shared types.
 *
 * Design rule for this folder: the WRITER only ever sees story language. The
 * plan's structure words (setup, payoff, dramatic irony) belong to the planner
 * and the critic; the draft prompt turns them into plain instructions.
 */

import type { StoryConfig } from "../generate";
import type { LearningLedger } from "./learning";

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
  /** The pool character's own backstory — used to introduce them like a picture book does. */
  backstory?: string;
  personality: string[];
  speechStyle: string[];
  quirk?: string;
  catchphrase?: string;
  catchphraseContext?: string;
  imageUrl?: string;
  visualProfile?: any;
  physicalDescription?: string;
  /** The character bible (migration 44): what lets a pool figure carry a book and stay recognisable from book to book. */
  want?: string;
  fear?: string;
  secret?: string;
  runningGag?: string;
  gesture?: string;
  comicRole?: string;
  /** May drive a book as its plot engine (guest with a mission). */
  canLead?: boolean;
  /** May be the opposing figure with a plan of its own. */
  canOppose?: boolean;
  villainStyle?: "comic" | "misunderstood" | "real";
  introLine?: string;
  signatureVisual?: string;
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
  /** Continuity at page end: where everyone is, where the key things are, how far the deadline is. */
  after: string;
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
  /** Why the opponent does what he does — shown on page 1 or 2. */
  obstacleMotive: string;
  /** Every thing the plot needs: where it starts and who carries it. */
  props: Array<{ thing: string; start: string; firstPage: number }>;
  heroes: Array<{ id: string; name: string; strength: string; voice: string; contribution: string }>;
  cast: Array<{ id: string; name: string; role: string; want: string; voice: string; signature: string }>;
  artifact: { id: string; name: string; role: string; firstPage: number; usePage: number; carried: boolean } | null;
  pages: PlanPage[];
  ending: { resolution: string; callback: string; lastLine: string };
  /** Learning mode: the knowledge core the writer committed to (header line WISSEN), as the child should retell it. */
  learningCore?: string | null;
}

export interface StorybookPage {
  order: number;
  title: string;
  content: string;
  /**
   * Chapter books: the page's paragraphs. The art director sees them numbered (p1, p2 …) and names the paragraph
   * its picture shows — the picture is printed right after it.
   */
  paragraphs?: string[];
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
  /** Evidence the critic must write down before judging (compact review only). */
  ledger?: StoryLedger;
}

/**
 * Story 774d5a5e: the free-form continuity read found one typo and missed a
 * painted arrow that became a pegged wooden piece, a map found by chance as the
 * solution and a goal that was never reached. Writing the evidence down first
 * makes those gaps visible; the notes and score caps follow deterministically.
 */
export interface StoryLedger {
  /** The heroes' goal from pages 1-2 and where exactly it is reached (null = never). */
  goal: { want: string; fulfilled: string | null };
  /** What carries the solution and whether it simply turns up when needed. */
  solutionKey: { what: string; firstShown: number | null; usedOn: number | null; foundByChance: boolean };
  /** Form, place and owner of the key things across the pages. */
  props: Array<{ thing: string; track: string; contradiction: string | null }>;
  /** Things announced early and whether they pay off (null = never). */
  setups: Array<{ setup: string; page: number; payoff: string | null }>;
  /** How the heroes are introduced; null = not said in the text. */
  introduction: { relationship: string | null; traits: string | null };
  /** Learning mode only: what a child can retell, whether it is true, carries the solution and comes back (learning.ts). */
  learning?: LearningLedger;
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
  /** Chapter books: number (1-based, within the page) of the paragraph this picture shows; the picture is printed after it. */
  paragraph?: number;
  /** Hero and cast ids that are drawn. At most three. */
  onStage: string[];
  artifactVisible: boolean;
  /** Names of recurring story elements (see IllustrationPlan.storyElements) in this picture. */
  elements?: string[];
  /** A deliberate close-up may omit all people; other empty casts need repair. */
  focus?: "scene" | "detail";
  /** Shorter composition for the single redraw, with the same action and cast. */
  simpleScene?: string;
  /** The same moment without any named character (key object or place) — the last resort before a blank page. */
  vignette?: string;
  /** Invalid plans are repaired before paying for image generation. */
  planningErrors?: string[];
  /**
   * A people-free place picture borrowed from another page. Used only when this
   * page cannot be composed at all, so that no page of the book stays blank.
   */
  fallbackVignette?: string;
  /** Figures left off-panel because the repaired shot was still too crowded. */
  recomposed?: string[];
}

/** A magic creature or special object that is not a pool character but recurs. */
export interface StoryElement {
  name: string;
  /** Fixed English look, used verbatim on every page it appears. */
  look: string;
  /**
   * Plain lowercase noun for the image model ("wooden signpost"). Story 774d5a5e:
   * the title-like name "Hand-painted Wayfinder" was painted onto the sign as
   * text and gave the sign a face — the image prompt never carries the name.
   */
  noun?: string;
  /** A living figure (troll, giant, goose) — counts against the figures per picture. */
  figure?: boolean;
  /**
   * Another element shares this one's head noun (three songbirds). Then only the
   * whole phrase identifies it: matching "songbird" put all three birds into every
   * picture of story ea253b27 and four pages were never drawn.
   */
  distinct?: boolean;
}

export interface IllustrationPlan {
  cover: IllustrationShot;
  pages: IllustrationShot[];
  storyElements?: StoryElement[];
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
    /** Talea-Folge: one to three pictures, each printed after a paragraph (0-based) of the chapter. `imageUrl` is the first. */
    images?: Array<{ url: string; afterParagraph: number }>;
  }>;
  avatarDevelopments: StorybookAvatarDevelopment[];
  pendingArtifact?: StorybookPendingArtifact;
  metadata: Record<string, any>;
}
