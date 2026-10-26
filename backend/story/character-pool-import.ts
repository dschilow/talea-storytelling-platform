import type { CharacterTemplate } from "./types";
import { bibleFromRow } from "./character-bible-core";

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toStringOrUndefined(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function toFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toInteger(value: unknown, fallback: number): number {
  return Math.trunc(toFiniteNumber(value, fallback));
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function toDate(value: unknown, fallback: Date): Date {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) {
      return parsed;
    }
  }
  return fallback;
}

function toNullableDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = toDate(value, new Date("invalid"));
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function toNumberArray(value: unknown, fallback: number[]): number[] {
  if (!value || !Array.isArray(value)) {
    return fallback;
  }
  const numbers = value
    .map((item) => Number(item))
    .filter((num) => Number.isFinite(num));
  return numbers.length > 0 ? numbers : fallback;
}

function toStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!value || !Array.isArray(value)) {
    return fallback;
  }
  const strings = value
    .map(toStringOrUndefined)
    .filter((str): str is string => Boolean(str))
    .map((item) => item.trim())
    .filter((str) => str.length > 0);
  return strings.length > 0 ? strings : fallback;
}

function normalizeEnum(value: unknown, allowed: readonly string[], fallback: string): string {
  const normalized = toStringOrUndefined(value)?.toLowerCase();
  return normalized && allowed.includes(normalized) ? normalized : fallback;
}

function inferSpeciesCategory(character: Record<string, any>, visualProfile: CharacterTemplate["visualProfile"]): string {
  const haystack = [
    visualProfile.species,
    visualProfile.description,
    character.archetype,
    character.role,
    character.name,
  ]
    .map((value) => toStringOrUndefined(value)?.toLowerCase() || "")
    .join(" ");

  if (/\b(human|child|girl|boy|knight|wizard|astronaut|detective|baker|princess|prince)\b/.test(haystack)) {
    return "human";
  }
  if (/\b(golem|fairy|spirit|phantom|ghost|witch|magical|mage|sorcerer)\b/.test(haystack)) {
    return "magical_creature";
  }
  if (/\b(troll|dragon|giant|unicorn|mythic)\b/.test(haystack)) {
    return "mythical";
  }
  if (/\b(fire|water|wind|earth|elemental)\b/.test(haystack)) {
    return "elemental";
  }
  if (/\b(duck|squirrel|fox|bird|cat|dog|wolf|bear|animal)\b/.test(haystack)) {
    return "animal";
  }
  return "any";
}

export function sanitizeCharacter(character: any, index: number, now: Date) {
  if (!isRecord(character) || !toStringOrUndefined(character.name)) {
    throw new Error(`Import entry ${index + 1} requires a character name`);
  }
  const source = character;
  const requestedId = toStringOrUndefined(source.id);
  // Pool ids are TEXT: legacy char_... ids must round-trip as well as UUIDs.
  if (requestedId && (requestedId.length > 200 || /[\u0000-\u001f]/.test(requestedId))) {
    throw new Error(`Import entry ${index + 1} has an invalid id`);
  }
  const id = requestedId || crypto.randomUUID();
  const name = toStringOrUndefined(source.name) || `Character ${index + 1}`;
  const role = toStringOrUndefined(source.role) || "companion";
  const archetype = toStringOrUndefined(source.archetype) || "support";

  const emotionalSource = isRecord(source.emotionalNature) ? source.emotionalNature : {};
  const emotionalNature = {
    dominant: toStringOrUndefined(emotionalSource.dominant) || "calm",
    secondary: toStringArray(emotionalSource.secondary),
    triggers: toStringArray(emotionalSource.triggers),
  };

  const visualSource = isRecord(source.visualProfile) ? source.visualProfile : {};
  const visualProfile = {
    description: toStringOrUndefined(visualSource.description) || "",
    imagePrompt: toStringOrUndefined(visualSource.imagePrompt),
    species: toStringOrUndefined(visualSource.species) || "unknown",
    colorPalette: toStringArray(visualSource.colorPalette),
  };

  const createdAt = toDate(source.createdAt, now);
  const updatedAt = toDate(source.updatedAt, now);
  const lastUsedAt = toNullableDate(source.lastUsedAt);
  const speciesCategory = normalizeEnum(
    source.species_category,
    ["human", "humanoid", "animal", "magical_creature", "mythical", "elemental", "any"],
    inferSpeciesCategory(source, visualProfile)
  );

  return {
    ...bibleFromRow(source),
    id,
    name,
    role,
    archetype,
    emotionalNature,
    visualProfile,
    imageUrl: toStringOrUndefined(source.imageUrl) || null,
    maxScreenTime: toInteger(source.maxScreenTime, 50),
    availableChapters: toNumberArray(source.availableChapters, [1, 2, 3, 4, 5]),
    canonSettings: toStringArray(source.canonSettings),
    recentUsageCount: toInteger(source.recentUsageCount ?? source.usageCount, 0),
    totalUsageCount: toInteger(source.totalUsageCount ?? source.usageCount, 0),
    lastUsedAt,
    isActive: toBoolean(source.isActive, true),
    createdAt,
    updatedAt,
    gender: normalizeEnum(source.gender, ["male", "female", "neutral", "any"], "any"),
    age_category: normalizeEnum(
      source.age_category,
      ["child", "teenager", "young_adult", "adult", "elder", "ageless", "any"],
      "any"
    ),
    species_category: speciesCategory,
    profession_tags: toStringArray(source.profession_tags),
    size_category: normalizeEnum(source.size_category, ["tiny", "small", "medium", "large", "giant", "any"], "medium"),
    social_class: normalizeEnum(
      source.social_class,
      ["royalty", "nobility", "merchant", "craftsman", "commoner", "outcast", "any"],
      "any"
    ),
    personality_keywords: toStringArray(source.personality_keywords),
    physical_description: toStringOrUndefined(source.physical_description) || visualProfile.description || null,
    backstory: toStringOrUndefined(source.backstory) || null,
    // V2 personality fields
    dominantPersonality: toStringOrUndefined(source.dominantPersonality),
    secondaryTraits: toStringArray(source.secondaryTraits),
    catchphrase: toStringOrUndefined(source.catchphrase),
    catchphraseContext: toStringOrUndefined(source.catchphraseContext),
    speechStyle: toStringArray(source.speechStyle),
    emotionalTriggers: toStringArray(source.emotionalTriggers),
    quirk: toStringOrUndefined(source.quirk),
  };
}
