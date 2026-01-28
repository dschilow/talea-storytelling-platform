export const STORY_CATEGORIES = [
  "Klassische Märchen",
  "Abenteuer & Schätze",
  "Märchenwelten & Magie",
  "Tierwelten",
  "Sci-Fi & Zukunft",
  "Modern & Realität",
] as const;

export type StoryCategory = (typeof STORY_CATEGORIES)[number];

export const SUPPORTED_LANGUAGES = ["de", "en", "fr", "es", "it", "nl", "ru"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_CHAPTER_COUNT = 5;
export const MIN_CHAPTERS = 3;
export const MAX_CHAPTERS = 12;

export const DEFAULT_AVATAR_PRESENCE_RATIO = 0.8;

export const GLOBAL_IMAGE_NEGATIVES = [
  "looking at camera",
  "portrait",
  "close-up portrait",
  "selfie",
  "extra characters",
  "duplicate characters",
  "twins",
  "clone",
  "cropped body",
  "text",
  "watermark",
  "logo",
];

export const REQUIRED_IMAGE_AVOIDS = [
  "looking at camera",
  "portrait closeup",
  "extra characters",
  "duplicate characters",
];

export const CATEGORY_ALIAS_MAP: Record<string, StoryCategory> = {
  "klassische märchen": "Klassische Märchen",
  "klassische marchen": "Klassische Märchen",
  "märchen": "Klassische Märchen",
  "maerchen": "Klassische Märchen",
  "fairytale": "Klassische Märchen",
  "fairy tale": "Klassische Märchen",
  "fairy tales": "Klassische Märchen",
  "adventure": "Abenteuer & Schätze",
  "abenteuer": "Abenteuer & Schätze",
  "treasure": "Abenteuer & Schätze",
  "schätze": "Abenteuer & Schätze",
  "magic": "Märchenwelten & Magie",
  "magie": "Märchenwelten & Magie",
  "fantasy": "Märchenwelten & Magie",
  "märchenwelten": "Märchenwelten & Magie",
  "tierwelten": "Tierwelten",
  "animals": "Tierwelten",
  "tiere": "Tierwelten",
  "sci-fi": "Sci-Fi & Zukunft",
  "scifi": "Sci-Fi & Zukunft",
  "science fiction": "Sci-Fi & Zukunft",
  "future": "Sci-Fi & Zukunft",
  "zukunft": "Sci-Fi & Zukunft",
  "modern": "Modern & Realität",
  "realität": "Modern & Realität",
  "reality": "Modern & Realität",
};
