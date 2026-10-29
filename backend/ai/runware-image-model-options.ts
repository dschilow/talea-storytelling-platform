export const FLUX2_KLEIN_4B_MODEL = "runware:400@4";
export const FLUX3_KLEIN_MODEL = "bfl:flux@3-image-klein";
export const FLUX3_KLEIN_STEPS = 16;

/** Normalised coordinates are [top, left, bottom, right], each from 0 to 1000. */
export interface RunwareReferenceRegion {
  id: string;
  description: string;
  referenceIndex: number;
  sourceBox: number[];
  targetBox: number[];
}

/** Native FLUX 3 binding from a cell on the existing shared sheet into the scene. */
export function runwareReferenceSettings(
  model: string,
  regions: RunwareReferenceRegion[] | undefined,
  referenceCount: number,
): { settings?: { boundingBoxes: RunwareReferenceRegion[] } } {
  if (model !== FLUX3_KLEIN_MODEL || !regions?.length) return {};
  const validBox = (box: unknown): box is RunwareReferenceRegion['sourceBox'] => Array.isArray(box) && box.length === 4 &&
    box.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1000) && box[0] < box[2] && box[1] < box[3];
  const ids = new Set<string>();
  const boundingBoxes = regions.map(region => {
    if (!region || typeof region.id !== 'string' || !region.id.trim() || ids.has(region.id) ||
      typeof region.description !== 'string' || !region.description.trim() || !Number.isInteger(region.referenceIndex) ||
      region.referenceIndex < 0 || region.referenceIndex >= referenceCount || !validBox(region.sourceBox) || !validBox(region.targetBox)) {
      throw new Error('Ungültige Referenzregion für die Bildkomposition.');
    }
    ids.add(region.id);
    return { id: region.id, description: region.description, referenceIndex: region.referenceIndex,
      sourceBox: [...region.sourceBox] as RunwareReferenceRegion['sourceBox'], targetBox: [...region.targetBox] as RunwareReferenceRegion['targetBox'] };
  });
  return { settings: { boundingBoxes } };
}

/** Parameters that differ between the current FLUX.2 and FLUX 3 Klein endpoints. */
export function runwareImageModelOptions(input: {
  model: string;
  steps?: number;
  CFGScale?: number;
  outputFormat?: "WEBP" | "PNG" | "JPEG";
  negativePrompt?: string;
}): Record<string, unknown> {
  const flux3Klein = input.model === FLUX3_KLEIN_MODEL;
  return {
    outputFormat: flux3Klein && input.outputFormat === "JPEG" ? "JPG" : input.outputFormat || "WEBP",
    steps: input.steps ?? (flux3Klein ? FLUX3_KLEIN_STEPS : 4),
    acceleration: "high",
    ...(flux3Klein
      ? { safety: { checkContent: true } }
      : { CFGScale: input.CFGScale ?? 4, checkNSFW: true, ...(input.negativePrompt?.trim() ? { negativePrompt: input.negativePrompt } : {}) }),
  };
}
