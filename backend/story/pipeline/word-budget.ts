export interface WordBudget {
  minMinutes: number;
  maxMinutes: number;
  selectedMinutes: number;
  wpm: number;
  targetWords: number;
  minWords: number;
  maxWords: number;
  minWordsPerChapter: number;
  maxWordsPerChapter: number;
  targetWordsPerChapter: number;
}

const LENGTH_MINUTES: Record<string, { min: number; max: number }> = {
  short: { min: 3, max: 5 },
  medium: { min: 8, max: 12 },
  long: { min: 15, max: 20 },
};

export function computeWordBudget(input: {
  lengthHint?: string;
  chapterCount: number;
  wpm?: number;
  pacing?: "fast" | "balanced" | "slow";
}): WordBudget {
  const lengthKey = input.lengthHint || "medium";
  const minutes = LENGTH_MINUTES[lengthKey] ?? LENGTH_MINUTES.medium;
  const wpm = input.wpm ?? 140;
  const pacingFactor = input.pacing === "fast" ? 0.9 : input.pacing === "slow" ? 1.1 : 1;

  const selectedMinutes = Math.round((minutes.min + minutes.max) / 2);
  const targetWords = Math.max(300, Math.round(selectedMinutes * wpm * pacingFactor));
  const minWords = Math.max(240, Math.round(minutes.min * wpm * pacingFactor));
  const maxWords = Math.max(minWords + 200, Math.round(minutes.max * wpm * pacingFactor));

  const chapterCount = Math.max(1, input.chapterCount);
  const minWordsPerChapter = Math.max(80, Math.floor(minWords / chapterCount));
  const maxWordsPerChapter = Math.max(minWordsPerChapter + 40, Math.ceil(maxWords / chapterCount));
  const targetWordsPerChapter = Math.max(minWordsPerChapter + 20, Math.round(targetWords / chapterCount));

  return {
    minMinutes: minutes.min,
    maxMinutes: minutes.max,
    selectedMinutes,
    wpm,
    targetWords,
    minWords,
    maxWords,
    minWordsPerChapter,
    maxWordsPerChapter,
    targetWordsPerChapter,
  };
}

export function buildLengthTargetsFromBudget(budget: WordBudget): {
  wordMin: number;
  wordMax: number;
  sentenceMin: number;
  sentenceMax: number;
} {
  const wordMin = budget.minWordsPerChapter;
  const wordMax = budget.maxWordsPerChapter;
  const sentenceMin = Math.max(6, Math.round(wordMin / 18));
  const sentenceMax = Math.max(sentenceMin + 2, Math.round(wordMax / 14));
  return { wordMin, wordMax, sentenceMin, sentenceMax };
}
