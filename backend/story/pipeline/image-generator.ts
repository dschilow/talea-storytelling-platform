import { ai } from "~encore/clients";
import { publishWithTimeout } from "../../helpers/pubsubTimeout";
import { logTopic } from "../../log/logger";
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
    logContext?: { storyId?: string; phase?: string };
  }): Promise<Array<{ chapter: number; imageUrl?: string; prompt: string; provider?: string }>> {
    const results: Array<{ chapter: number; imageUrl?: string; prompt: string; provider?: string }> = [];
    const config = input.pipelineConfig;
    const logContext = input.logContext;

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
        useCollageReference: Boolean(spec.collageUrl),
        maxRetries: config?.imageRetryMax ?? 2,
        steps: config?.runwareSteps,
        cfgScale: config?.runwareCfgScale,
        logContext: { ...logContext, chapter: spec.chapter },
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
  useCollageReference?: boolean;
  maxRetries: number;
  steps?: number;
  cfgScale?: number;
  logContext?: { storyId?: string; phase?: string; chapter?: number };
}): Promise<string | undefined> {
  let attempt = 0;
  let lastError: unknown;
  const logSource = resolveImageLogSource(input.logContext?.phase);
  const ipAdapterWeight = resolveIpAdapterWeight(input.referenceImages.length, Boolean(input.useCollageReference));
  while (attempt <= input.maxRetries) {
    try {
      const response = await ai.generateImage({
        prompt: input.prompt,
        negativePrompt: input.negativePrompt,
        width: 1024,
        height: 1024,
        referenceImages: input.referenceImages.length > 0 ? input.referenceImages : undefined,
        ipAdapterWeight,
        steps: input.steps,
        CFGScale: input.cfgScale,
      });
      await publishWithTimeout(logTopic as any, {
        source: logSource,
        timestamp: new Date(),
        request: {
          prompt: input.prompt,
          negativePrompt: input.negativePrompt,
          referenceImages: input.referenceImages,
          ipAdapterWeight,
          steps: input.steps,
          cfgScale: input.cfgScale,
          attempt,
        },
        response,
        metadata: input.logContext ?? null,
      });
      return response.imageUrl;
    } catch (error) {
      lastError = error;
      await publishWithTimeout(logTopic as any, {
        source: logSource,
        timestamp: new Date(),
        request: {
          prompt: input.prompt,
          negativePrompt: input.negativePrompt,
          referenceImages: input.referenceImages,
          ipAdapterWeight,
          steps: input.steps,
          cfgScale: input.cfgScale,
          attempt,
        },
        response: { error: String((error as Error)?.message || error) },
        metadata: input.logContext ?? null,
      });
      attempt += 1;
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  console.error("[pipeline] Image generation failed", lastError);
  return undefined;
}

function resolveImageLogSource(phase?: string): string {
  if (phase === "phase8-cover") return "phase8-cover-imagegen";
  if (phase === "phase10-vision-retry-imagegen") return "phase10-vision-retry-imagegen";
  if (phase === "phase10-vision") return "phase10-vision-retry-imagegen";
  if (phase === "phase9-imagegen") return "phase9-imagegen-runware";
  return "phase9-imagegen-runware";
}

function resolveIpAdapterWeight(referenceCount: number, useCollageReference: boolean): number | undefined {
  if (referenceCount <= 0) return undefined;
  if (useCollageReference) return 0.55;
  if (referenceCount >= 3) return 0.6;
  return 0.65;
}
