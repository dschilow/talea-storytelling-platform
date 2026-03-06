import type { CastSet, CharacterSheet, SceneDirective } from "./types";

const CHILD_TOKEN_PATTERN =
  /\b(child|kind|kid|boy|girl|human_child|schoolchild|student|schueler|schüler|sibling|brother|sister|junior)\b/i;
const ADULT_TOKEN_PATTERN =
  /\b(adult|young_adult|astronaut|wizard|witch|queen|king|emperor|kaiser|teacher|doctor|captain|kapitaen|kapit[aÃ¤]n|pirate|police|firefighter|baker|gardener|elder|grandma|grandpa|oma|opa|mentor|zauberer|zauberin|hexe|ritter|knight|seemann|seefahrer|matrose|lehrer|lehrerin|polizist|feuerwehr|b[Ã¤a]cker|g[Ã¤a]rtner|arzt|doktor|hauptmann)\b/i;

export function isLikelyChildCharacter(
  sheet: { displayName: string; roleType?: string; role?: string; archetype?: string; species?: string },
): boolean {
  const combined = [
    sheet.displayName,
    sheet.roleType,
    sheet.role,
    sheet.archetype,
    sheet.species,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\b(kapit|seemann|seefahrer|matrose|lehrer|lehrerin|polizist|feuerwehr|doktor|arzt|hauptmann)\b/i.test(combined)) {
    return false;
  }
  if (CHILD_TOKEN_PATTERN.test(combined)) return true;
  if (ADULT_TOKEN_PATTERN.test(combined)) return false;

  return (sheet.roleType || "").toUpperCase() === "AVATAR";
}

export function getChildFocusSheets(cast: CastSet): CharacterSheet[] {
  const all = dedupeSheetsByName([...cast.avatars, ...cast.poolCharacters]);
  const childLike = all.filter(isLikelyChildCharacter);
  if (childLike.length > 0) return childLike.slice(0, 3);
  return dedupeSheetsByName(cast.avatars).slice(0, 2);
}

export function getChildFocusNames(cast: CastSet): string[] {
  return getChildFocusSheets(cast)
    .map(sheet => sheet.displayName)
    .filter(Boolean);
}

export function getCoreChapterCharacterNames(input: {
  directive: SceneDirective;
  cast: CastSet;
  ageMax?: number;
}): string[] {
  const { directive, cast } = input;
  const ageMax = input.ageMax ?? 12;
  const limit = ageMax <= 8 ? 2 : 3;

  const sheets = directive.charactersOnStage
    .filter(slot => !slot.includes("ARTIFACT"))
    .map(slot => cast.avatars.find(a => a.slotKey === slot) || cast.poolCharacters.find(c => c.slotKey === slot))
    .filter((sheet): sheet is CharacterSheet => Boolean(sheet));

  const ranked = dedupeSheetsByName(sheets).sort((left, right) => scoreFocusCharacter(right) - scoreFocusCharacter(left));
  if (ranked.length === 0) return [];
  return ranked.slice(0, Math.min(limit, ranked.length)).map(sheet => sheet.displayName);
}

function scoreFocusCharacter(sheet: CharacterSheet): number {
  let score = 0;
  const roleType = (sheet.roleType || "").toUpperCase();

  if (isLikelyChildCharacter(sheet)) score += 100;
  if (roleType === "AVATAR") score += 40;
  if (roleType.includes("PROTAGONIST")) score += 30;
  if (roleType.includes("HELPER")) score += 10;
  if (ADULT_TOKEN_PATTERN.test([sheet.displayName, sheet.role, sheet.archetype, sheet.species].filter(Boolean).join(" "))) {
    score -= 30;
  }

  return score;
}

function dedupeSheetsByName(sheets: CharacterSheet[]): CharacterSheet[] {
  const seen = new Set<string>();
  const deduped: CharacterSheet[] = [];

  for (const sheet of sheets) {
    const key = String(sheet.displayName || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(sheet);
  }

  return deduped;
}
