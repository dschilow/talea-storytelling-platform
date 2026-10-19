import type { StorybookPage, CastCandidate, StoryPlan } from "../storybook/types";
import type { TextEngineResult } from "../storybook/engine";

export const WONDER_PIPELINE_ID = "wonder-story-v1";

export interface WonderScene {
  chapter: number;
  title: string;
  place: string;
  action: string;
  cause: string;
  change: string;
  humor: string;
  end: string;
  onStage: string[];
  after: string;
}

/** A concrete story contract, independent of image and reward bookkeeping. */
export interface WonderPlan {
  ideas: Array<{ hook: string; comicEngine: string; whyTheseHeroes: string }>;
  chosenIdea: number;
  packageId: string | null;
  title: string;
  logline: string;
  want: string;
  stakes: string;
  worldRule: string | null;
  ruleDemonstration: string;
  easyWayOut: string;
  heroes: Array<{ id: string; name: string; voice: string; choice: string; contribution: string }>;
  guests: Array<{ id: string; name: string; species: string; appearance: string; want: string; voice: string; role: string }>;
  artifact: StoryPlan["artifact"];
  setups: Array<{ what: string; plantedOnPage: number; paysOffOnPage: number }>;
  scenes: WonderScene[];
  ending: { resolution: string; emotionalAction: string; callback: string };
  learningCore: string | null;
}

export interface WonderEvidence { page: number; quote: string }
export interface WonderIssue extends WonderEvidence {
  severity: "blocker" | "improve";
  kind: "logic" | "character" | "humor" | "language" | "wish" | "safety";
  problem: string;
  fix: string;
  /** Explicit dependency span for local edits; absent older reviews remain supported. */
  affectedPages?: number[];
}
export interface WonderReview {
  comprehension: { goal: string | null; obstacle: string | null; solution: string | null };
  heroActions: Array<WonderEvidence & { heroId: string }>;
  laughs: Array<WonderEvidence & { why: string }>;
  keep: WonderEvidence[];
  issues: WonderIssue[];
  readAgainReason: string;
}
export interface WonderDraft { title: string; description: string; pages: StorybookPage[] }
export interface WonderResult extends TextEngineResult {
  wonder: {
    packageId: string | null;
    plan: WonderPlan;
    planReview: { issues: string[]; keep: string[] };
    review: WonderReview;
    draftReview: WonderReview;
    guests: CastCandidate[];
    revisedChapters: number[];
  };
}
