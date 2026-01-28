import type { CastSet } from "./types";
import { MAX_REFERENCE_IMAGES } from "./constants";

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

function getSheet(cast: CastSet, slotKey: string) {
  return cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
}
