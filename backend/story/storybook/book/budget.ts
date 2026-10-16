/**
 * Chapter book — size of a volume and the experience form.
 *
 * Start values (plan 2026-10-14, measured in phase A): a chapter is one to two
 * bedtime readings of five to eight minutes, like "Lichterland" or "Der kleine
 * Drache Kokosnuss". Reading aloud runs at roughly 100-130 words a minute.
 * Raised 2026-10-16 to one reading of eight to twelve minutes: the shorter
 * chapters had no room for a narrator (see voice.ts).
 */

import type { StoryConfig } from "../../generate";
import type { AgeBand, LengthBudget } from "../craft";
import type { BookBudget, ExperienceForm } from "./types";

export const BOOK_CHAPTER_OPTIONS = [8, 12, 15] as const;

// 2026-10-16 ("Der Regen sagt rückwärts", 8 chapters at 550-700): with 600 words a chapter had room for
// the planned events and the dialogue, but none for a narrator, a thought or a detail — it read like a
// script. Published read-aloud chapter books for six- to eight-year-olds run 900-1,500 words a chapter
// (8-12 minutes aloud); the new bands give the writer that room and the prose checks (voice.ts) use it.
const WORDS_PER_CHAPTER: Record<AgeBand, [number, number]> = {
  "3-5": [380, 520],
  "6-8": [850, 1100],
  "9-12": [1150, 1500],
};

const DEFAULT_CHAPTERS: Record<AgeBand, number> = { "3-5": 8, "6-8": 12, "9-12": 15 };

export function resolveBookBudget(band: AgeBand, options: { chapters?: number; imagesPerChapter?: number } = {}): BookBudget {
  const requested = Math.round(Number(options.chapters));
  const chapters = Number.isFinite(requested) && requested >= 4 && requested <= 20 ? requested : DEFAULT_CHAPTERS[band];
  const images = Math.round(Number(options.imagesPerChapter));
  const [min, max] = WORDS_PER_CHAPTER[band];
  return {
    chapters,
    wordsPerChapterMin: min,
    wordsPerChapterMax: max,
    imagesPerChapter: Number.isFinite(images) && images >= 1 && images <= 3 ? images : band === "9-12" ? 1 : 2,
    // Two heroes plus up to four pool figures; a child of six tracks about that many.
    maxPoolCast: band === "3-5" ? 2 : band === "9-12" ? 4 : 3,
    maxCharactersPerImage: 3,
  };
}

/** The storybook brief needs a LengthBudget; a chapter plays the role of a page. */
export function bookLengthBudget(book: BookBudget): LengthBudget {
  return {
    pages: book.chapters,
    wordsPerPageMin: book.wordsPerChapterMin,
    wordsPerPageMax: book.wordsPerChapterMax,
    totalWordsMin: book.chapters * book.wordsPerChapterMin,
    totalWordsMax: book.chapters * book.wordsPerChapterMax,
    maxCast: book.maxPoolCast,
    maxCharactersPerImage: book.maxCharactersPerImage,
  };
}

const FORMS: ExperienceForm[] = ["mystery", "journey", "funny", "cozy"];

/** The wizard's choice, or one derived from genre and feelings. */
export function resolveExperienceForm(config: Pick<StoryConfig, "genre"> & { experienceForm?: string; emotionalFlavors?: string[] }): ExperienceForm {
  const chosen = String(config.experienceForm || "").trim() as ExperienceForm;
  if (FORMS.includes(chosen)) return chosen;
  const flavors = Array.isArray(config.emotionalFlavors) ? config.emotionalFlavors : [];
  if (flavors.includes("lachfreude") || flavors.includes("uebermut")) return "funny";
  if (flavors.includes("warmherzigkeit") && !flavors.includes("prickeln")) return "cozy";
  if (config.genre === "adventure" || config.genre === "scifi") return "journey";
  return "mystery";
}

/** What each form promises, in plan terms. "Cozy" really means less threat, not only another label. */
export const FORM_TEMPLATES: Record<ExperienceForm, { label: string; plan: string }> = {
  mystery: {
    label: "a funny mystery",
    plan: "A secret drives the book. Fix the TRUTH before chapter 1: what really happens, who does it and why. Clues grow out of that truth from chapter 2 on and are fair: a listening child can spot them before the heroes. Around the middle the heroes follow a plausible false suspicion until a clue contradicts it. The reveal uses at least two earlier clues. Whoever causes the trouble has a motive a child understands and is never evil for fun.",
  },
  journey: {
    label: "an adventurous journey",
    plan: "The heroes leave their home place to reach something by the deadline. Every stage is a new, concrete place with its own inhabitant and obstacle, and each stage costs or teaches them something they need later. A detour that seemed wrong turns out to be necessary. The last chapter brings them home, and the home place is visibly a little changed.",
  },
  funny: {
    label: "a comedy",
    plan: "One outrageous premise escalates from chapter to chapter: misunderstandings, a character who is ridiculously sure of themselves, a rule of three across the book. There are still real stakes and one deadline, so the laughter has something to lose. The climax is a comic catastrophe the heroes turn around with an idea prepared earlier.",
  },
  cozy: {
    label: "a cosy story",
    plan: "A gentle book: no villain and no real danger. Tension comes from wanting something (a gift, a festival, a lost friend, a promise), small obstacles, misunderstandings, feelings and surprises. Every chapter ends safely with a warm, small question. It still has a red thread, a deadline that matters to the heroes, and plenty of humour.",
  },
};
