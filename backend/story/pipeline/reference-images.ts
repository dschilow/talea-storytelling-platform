import type { CastSet } from "./types";
import { MAX_REFERENCE_IMAGES } from "./constants";
import { buildSpriteCollage, type CollageResult } from "./sprite-collage";
import { resolveImageUrlForClient } from "../../helpers/bucket-storage";

export function selectReferenceSlots(onStageExact: string[], cast: CastSet, maxRefs = MAX_REFERENCE_IMAGES): string[] {
  const candidates = onStageExact.filter((slot) => getSheet(cast, slot)?.imageUrl);
  const avatarSlots = candidates.filter((slot) => slot.startsWith("SLOT_AVATAR"));
  const otherSlots = candidates.filter((slot) => !slot.startsWith("SLOT_AVATAR"));
  return [...avatarSlots, ...otherSlots].slice(0, maxRefs);
}

export function buildRefsForSlots(refSlots: string[], cast: CastSet): Record<string, string> {
  const refs: Record<string, string> = {};
  let refIndex = 1;

  for (const slotKey of refSlots) {
    const sheet = getSheet(cast, slotKey);
    if (!sheet?.imageUrl) continue;

    const refKey = `ref_image_${refIndex}`;
    const brief = getCharacterBrief(cast, sheet.displayName);
    const briefTag = brief ? ` (${brief})` : "";
    const raw = `IDENTITY ONLY - ${sheet.displayName.toUpperCase()}${briefTag} - keep same face, hair, and outfit`;
    refs[refKey] = truncateRefValue(raw, 120);
    sheet.refKey = refKey;
    refIndex += 1;
  }

  return refs;
}

export function buildReferenceImages(refSlots: string[], cast: CastSet): string[] {
  const urls: string[] = [];
  for (const slotKey of refSlots) {
    const sheet = getSheet(cast, slotKey);
    if (sheet?.imageUrl) {
      urls.push(sheet.imageUrl);
    }
  }
  return urls;
}

/**
 * Build a single collage reference image from the selected reference slots.
 * Returns null if 0-1 characters have images (no collage needed).
 */
export async function buildCollageReference(
  refSlots: string[],
  cast: CastSet
): Promise<CollageResult | null> {
  const slots: Array<{ imageUrl: string; displayName: string }> = [];

  for (const slotKey of refSlots) {
    const sheet = getSheet(cast, slotKey);
    if (!sheet?.imageUrl) continue;
    const resolvedUrl = await resolveImageUrlForClient(sheet.imageUrl);
    if (!resolvedUrl) continue;
    slots.push({ imageUrl: resolvedUrl, displayName: sheet.displayName });
  }

  if (slots.length < 2) return null;
  return buildSpriteCollage(slots);
}

/**
 * Build the refs map for collage mode.
 * Uses slot_N keys with character descriptions for identity matching.
 */
export function buildCollageRefsForSlots(
  collageResult: CollageResult,
  cast: CastSet
): Record<string, string> {
  const refs: Record<string, string> = {};
  for (const pos of collageResult.positions) {
    const slotNum = pos.index + 1;
    const key = `slot_${slotNum}`;
    const brief = getCharacterBrief(cast, pos.displayName);
    const briefTag = brief ? ` (${brief})` : "";
    const raw = `${pos.displayName.toUpperCase()}${briefTag} - match ONLY the identity from slot-${slotNum}`;
    refs[key] = truncateRefValue(raw, 200);
  }
  return refs;
}

function getCharacterBrief(cast: CastSet, displayName: string): string {
  const sheet = [...cast.avatars, ...cast.poolCharacters].find(s => s.displayName === displayName);
  if (!sheet) return "";
  const genericTokens = new Set(["human child", "young child", "male", "female", "teen"]);
  const preferred = [...(sheet.faceLock || []), ...(sheet.outfitLock || []), ...(sheet.visualSignature || [])]
    .filter(Boolean)
    .map(item => String(item).trim())
    .filter(item => item && !genericTokens.has(item.toLowerCase()));
  const fallback = [...(sheet.visualSignature || []), ...(sheet.faceLock || [])]
    .filter(Boolean)
    .map(item => String(item).trim())
    .filter(Boolean);
  const items = preferred.length > 0 ? preferred : fallback;
  return Array.from(new Set(items)).slice(0, 2).join(", ");
}

function getSheet(cast: CastSet, slotKey: string) {
  return cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
}

function truncateRefValue(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return value.slice(0, Math.max(0, maxLength - 3)).trimEnd() + "...";
}
