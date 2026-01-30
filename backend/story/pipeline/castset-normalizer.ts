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
  // Enforce maximum of 2 pool characters for consistency
  const poolCharacters = (input.poolCharacters || []).slice(0, 2).map(sheet => sanitizeCharacterSheet(sheet));
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

  cleaned.visualSignature = normalizeList(cleaned.visualSignature, ["distinct look", "clear features"], 2);
  cleaned.outfitLock = normalizeList(cleaned.outfitLock, ["consistent outfit"], 1);
  cleaned.forbidden = normalizeList(cleaned.forbidden, ["adult proportions"], 1);

  return cleaned as CharacterSheet;
}

function sanitizeMatchScores(scores: MatchScore[]): MatchScore[] {
  if (scores.length <= 40) return scores;
  return [...scores].sort((a, b) => b.finalScore - a.finalScore).slice(0, 40);
}

function normalizeList(list: unknown, fallback: string[], minItems: number): string[] {
  const value = Array.isArray(list) ? list.filter(item => typeof item === "string" && item.trim().length > 0) : [];
  if (value.length >= minItems) return value;
  return [...value, ...fallback].slice(0, Math.max(minItems, 2));
}
