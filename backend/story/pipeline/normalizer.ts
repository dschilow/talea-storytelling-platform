import type { StoryConfig, StoryLanguage } from "../generate";
import { DEFAULT_CHAPTER_COUNT, MAX_CHAPTERS, MIN_CHAPTERS, STORY_CATEGORIES, SUPPORTED_LANGUAGES } from "./constants";
import type { NormalizedRequest } from "./types";
import { clampNumber, hashRequest, normalizeCategory } from "./utils";

const AGE_GROUP_MAP: Record<string, { min: number; max: number }> = {
  "3-5": { min: 3, max: 5 },
  "6-8": { min: 6, max: 8 },
  "9-12": { min: 9, max: 12 },
  "13+": { min: 13, max: 18 },
};

function resolveLanguage(lang?: StoryLanguage): StoryLanguage {
  if (!lang) return "de";
  return SUPPORTED_LANGUAGES.includes(lang) ? lang : "de";
}

function resolveCategory(config: StoryConfig): string {
  if (config.preferences?.useFairyTaleTemplate) {
    return "Klassische Märchen";
  }
  const normalized = normalizeCategory(config.genre);
  if (STORY_CATEGORIES.includes(normalized as any)) return normalized;
  const fallback = normalizeCategory(config.setting);
  if (STORY_CATEGORIES.includes(fallback as any)) return fallback;
  return "Abenteuer & Schätze";
}

function resolveChapterCount(config: StoryConfig): number {
  const length = config.length || "medium";
  const lengthMap: Record<string, number> = {
    short: 3,
    medium: DEFAULT_CHAPTER_COUNT,
    long: 7,
  };
  const raw = lengthMap[length] ?? DEFAULT_CHAPTER_COUNT;
  return clampNumber(raw, MIN_CHAPTERS, MAX_CHAPTERS);
}

export function normalizeRequest(input: {
  storyId: string;
  userId: string;
  config: StoryConfig;
  avatarIds: string[];
}): NormalizedRequest {
  const { storyId, userId, config, avatarIds } = input;
  const category = resolveCategory(config);
  const language = resolveLanguage(config.language);
  const ageRange = AGE_GROUP_MAP[config.ageGroup] ?? { min: 6, max: 8 };
  const chapterCount = resolveChapterCount(config);
  const avatarCount = clampNumber(avatarIds.length, 1, 2);

  if (avatarCount < 1 || avatarCount > 2) {
    throw new Error(`avatarCount must be 1-2, got ${avatarCount}`);
  }

  const requestHash = hashRequest({
    storyId,
    userId,
    category,
    language,
    ageRange,
    chapterCount,
    avatarIds,
    config,
  });

  return {
    storyId,
    userId,
    category: category as any,
    language,
    ageMin: ageRange.min,
    ageMax: ageRange.max,
    chapterCount,
    avatarIds,
    avatarCount,
    lengthHint: config.length,
    emotionProfile: {
      tone: config.tone,
      suspenseLevel: config.suspenseLevel,
      humorLevel: config.humorLevel,
      pacing: config.pacing,
      storySoul: config.storySoul,
      emotionalFlavors: config.emotionalFlavors,
      specialIngredients: config.specialIngredients,
    },
    variantSeed: (config as any).variantSeed,
    taleId: (config as any).taleId,
    requestedTone: config.tone,
    requestHash,
    rawConfig: config,
  };
}
