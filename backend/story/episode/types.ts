import type { TextEngineResult } from "../storybook/engine";
import type { CastCandidate } from "../storybook/types";

export interface EpisodeCastMember {
  id: string;
  name: string;
  from: "pool" | "new";
  role: "companion" | "troublemaker" | "grownup" | "wonder" | string;
  species: string;
  voice: string;
  wants: string;
  comicPattern: string;
  /** New figures only: what the illustrator draws. */
  lookEn?: string;
}

/** The story bible plus its chapter plan — what a Talea Original's series bible and beat sheet hold together. */
export interface EpisodePlan {
  ideas: string[];
  chosen: number;
  title: string;
  summary: string;
  focusHero: string;
  childSituation: string;
  wonder: { rule: string; who: string; firstEffect: string; escalation: string[]; endsWhen: string };
  heroes: Array<{ id: string; name: string; voice: string; contribution: string }>;
  cast: EpisodeCastMember[];
  runningGags: Array<{ gag: string; beats: string[] }>;
  attempts: string[];
  nearDiscovery: string;
  quietMoment: string;
  courage: string;
  solution: string;
  setups: Array<{ what: string; planted: number; paysOff: number }>;
  chapters: Array<{ title: string; beats: string[]; laugh: string; ending: string }>;
  schoolyardLine: string;
  finalLaugh: string;
  artifact: { id: string; role: string; firstChapter: number; useChapter: number } | null;
  learningCore: string | null;
}

export interface EpisodeResult extends TextEngineResult {
  episode: {
    plan: EpisodePlan;
    /** New figures of this story, shaped like pool candidates so the picture stage can draw them. */
    guests: CastCandidate[];
    checks: { hard: string[]; soft: string[] };
    revised: boolean;
    mode: "one-shot" | "two-step";
    /** New figures that got a series name and were renamed instead of rewritten. */
    renamed: Array<{ from: string; to: string }>;
    seriesLogCandidate?: unknown;
  };
}
