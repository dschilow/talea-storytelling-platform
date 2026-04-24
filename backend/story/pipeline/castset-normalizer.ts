import type { CastSet, CharacterSheet, MatchScore } from "./types";

const CHARACTER_KEYS = new Set([
  "characterId",
  "displayName",
  "roleType",
  "slotKey",
  "personalityTags",
  "speechStyleHints",
  "visualSignature",
  "outfitLock",
  "faceLock",
  "forbidden",
  "refKey",
  "referenceImageId",
  "imageUrl",
]);

export function repairCastSet(input: CastSet): CastSet {
  const avatars = input.avatars.map(sheet => sanitizeCharacterSheet(sheet));
  // Enforce maximum of 4 pool characters for consistency
  const poolCharacters = (input.poolCharacters || []).slice(0, 4).map(sheet => sanitizeCharacterSheet(sheet));
  const matchScores = sanitizeMatchScores(input.matchScores || []);

  return {
    avatars,
    poolCharacters,
    artifact: input.artifact,
    slotAssignments: input.slotAssignments,
    matchScores,
  };
}

function sanitizeCharacterSheet(sheet: CharacterSheet): CharacterSheet {
  const cleaned: any = {};
  for (const key of Object.keys(sheet)) {
    if (CHARACTER_KEYS.has(key)) {
      cleaned[key] = (sheet as any)[key];
    }
  }

  cleaned.personalityTags = normalizeOptionalList(cleaned.personalityTags, 40, 64);
  cleaned.speechStyleHints = normalizeOptionalList(cleaned.speechStyleHints, 40, 64);
  cleaned.visualSignature = normalizeList(cleaned.visualSignature, ["distinct look", "clear features"], 2, 6, 120);
  cleaned.outfitLock = normalizeList(cleaned.outfitLock, ["consistent outfit"], 1, 8, 120);
  cleaned.faceLock = normalizeOptionalList(cleaned.faceLock, 8, 120);
  cleaned.forbidden = normalizeList(cleaned.forbidden, ["adult proportions"], 1, 20, 120);

  for (const key of Object.keys(cleaned)) {
    if (cleaned[key] === undefined) delete cleaned[key];
  }

  return cleaned as CharacterSheet;
}

function sanitizeMatchScores(scores: MatchScore[]): MatchScore[] {
  if (scores.length <= 40) return scores;
  return [...scores].sort((a, b) => b.finalScore - a.finalScore).slice(0, 40);
}

function normalizeList(list: unknown, fallback: string[], minItems: number, maxItems: number, maxLength: number): string[] {
  const value = normalizeOptionalList(list, maxItems, maxLength) || [];
  if (value.length >= minItems) return value;
  return dedupeStrings([...value, ...fallback.map(item => fitString(item, maxLength))])
    .slice(0, Math.max(minItems, 2));
}

function normalizeOptionalList(list: unknown, maxItems: number, maxLength: number): string[] | undefined {
  if (!Array.isArray(list)) return undefined;
  const value = dedupeStrings(
    list
      .filter((item): item is string => typeof item === "string")
      .map(item => fitString(item, maxLength))
      .filter(item => item.length > 0)
  ).slice(0, maxItems);
  return value.length > 0 ? value : undefined;
}

function fitString(value: string, maxLength: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;

  const sliced = clean.slice(0, maxLength).trimEnd();
  const lastSpace = sliced.lastIndexOf(" ");
  if (lastSpace >= Math.floor(maxLength * 0.7)) {
    return sliced.slice(0, lastSpace).trimEnd();
  }
  return sliced;
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}
