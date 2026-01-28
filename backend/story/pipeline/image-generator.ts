import { ai } from "~encore/clients";
import type { CastSet, ImageGenerator, ImageSpec, NormalizedRequest, SceneDirective } from "./types";

export class RunwareImageGenerator implements ImageGenerator {
  async generateImages(input: {
    normalizedRequest: NormalizedRequest;
    cast: CastSet;
    directives: SceneDirective[];
    imageSpecs: ImageSpec[];
  }): Promise<Array<{ chapter: number; imageUrl?: string; prompt: string; provider?: string }>> {
    const results: Array<{ chapter: number; imageUrl?: string; prompt: string; provider?: string }> = [];

    for (const spec of input.imageSpecs) {
      const referenceImages = buildReferenceImages(spec, input.cast);
      const prompt = spec.finalPromptText || "";
      const negativePrompt = (spec.negatives || []).join(", ");

      const imageUrl = await generateWithRetry({
        prompt,
        negativePrompt,
        referenceImages,
        maxRetries: 2,
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

function buildReferenceImages(spec: ImageSpec, cast: CastSet): string[] {
  const urls: string[] = [];
  for (const slotKey of spec.onStageExact) {
    const sheet = cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
    if (sheet?.imageUrl) {
      urls.push(sheet.imageUrl);
    }
  }
  return urls;
}
