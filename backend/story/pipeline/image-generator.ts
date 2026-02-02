import { ai } from "~encore/clients";
import type { CastSet, ImageGenerator, ImageSpec, NormalizedRequest, SceneDirective } from "./types";
import { buildReferenceImages, selectReferenceSlots } from "./reference-images";
import { resolveImageUrlForClient } from "../../helpers/bucket-storage";

export class RunwareImageGenerator implements ImageGenerator {
  async generateImages(input: {
    normalizedRequest: NormalizedRequest;
    cast: CastSet;
    directives: SceneDirective[];
    imageSpecs: ImageSpec[];
    pipelineConfig?: { runwareSteps: number; runwareCfgScale: number; imageRetryMax: number };
  }): Promise<Array<{ chapter: number; imageUrl?: string; prompt: string; provider?: string }>> {
    const results: Array<{ chapter: number; imageUrl?: string; prompt: string; provider?: string }> = [];
    const config = input.pipelineConfig;

    for (const spec of input.imageSpecs) {
      const refSlots = selectReferenceSlots(spec.onStageExact, input.cast);

      // Use collage URL if available (set by image-director), otherwise fall back to individual references
      let referenceImages: string[];
      if (spec.collageUrl) {
        const resolvedUrl = await resolveImageUrlForClient(spec.collageUrl);
        if (resolvedUrl) {
          referenceImages = [resolvedUrl];
          console.log(`[pipeline] Using sprite collage reference for chapter ${spec.chapter}`);
        } else {
          referenceImages = buildReferenceImages(refSlots, input.cast);
        }
      } else {
        referenceImages = buildReferenceImages(refSlots, input.cast);
      }

      const prompt = spec.finalPromptText || "";
      const negativePrompt = (spec.negatives || []).join(", ");

      const imageUrl = await generateWithRetry({
        prompt,
        negativePrompt,
        referenceImages,
        maxRetries: config?.imageRetryMax ?? 2,
        steps: config?.runwareSteps,
        cfgScale: config?.runwareCfgScale,
      });

      results.push({
        chapter: spec.chapter,
        imageUrl,
        prompt,
        provider: "runware",
      });
    }

    return results;
  }
}

async function generateWithRetry(input: {
  prompt: string;
  negativePrompt: string;
  referenceImages: string[];
  maxRetries: number;
  steps?: number;
  cfgScale?: number;
}): Promise<string | undefined> {
  let attempt = 0;
  let lastError: unknown;
  while (attempt <= input.maxRetries) {
    try {
      const response = await ai.generateImage({
        prompt: input.prompt,
        negativePrompt: input.negativePrompt,
        referenceImages: input.referenceImages.length > 0 ? input.referenceImages : undefined,
        ipAdapterWeight: input.referenceImages.length > 0 ? 0.8 : undefined,
        steps: input.steps,
        CFGScale: input.cfgScale,
      });
      return response.imageUrl;
    } catch (error) {
      lastError = error;
      attempt += 1;
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  console.error("[pipeline] Image generation failed", lastError);
  return undefined;
}
