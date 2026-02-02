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
    refs[refKey] = `IDENTITY ONLY — match ONLY ${sheet.displayName}`;
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
 * Uses position_N keys with color info instead of ref_image_N.
 */
export function buildCollageRefsForSlots(
  collageResult: CollageResult
): Record<string, string> {
  const refs: Record<string, string> = {};
  for (const pos of collageResult.positions) {
    const key = `position_${pos.index + 1}`;
    refs[key] = `${pos.color.name} frame — match face identity ONLY of ${pos.displayName}`;
  }
  return refs;
}

function getSheet(cast: CastSet, slotKey: string) {
  return cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
}
