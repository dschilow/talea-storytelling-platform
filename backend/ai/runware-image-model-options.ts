export const FLUX3_KLEIN_MODEL = "bfl:flux@3-image-klein";
export const FLUX3_KLEIN_STEPS = 16;

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
