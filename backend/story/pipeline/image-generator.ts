import { ai } from "~encore/clients";
import { publishWithTimeout } from "../../helpers/pubsubTimeout";
import { logTopic } from "../../log/logger";
import type { CastSet, ImageGenerator, ImageSpec, NormalizedRequest, SceneDirective } from "./types";
import { extractRunwareCostMetrics } from "./cost-ledger";
import { buildReferenceImages, selectReferenceSlots } from "./reference-images";
import { resolveImageUrlForClient } from "../../helpers/bucket-storage";

const INLINE_TTS_TAG_PATTERN = /\[([^\]\n]{1,40})\]/g;
const KNOWN_TTS_TAGS = new Set<string>([
  "excited",
  "dramatic",
  "thoughtful",
  "curious",
  "whisper",
  "whispers",
  "whispering",
  "gulps",
  "gulp",
  "nervous",
  "laughs",
  "laugh",
  "sad",
  "happy",
  "angry",
  "calm",
  "serious",
  "short pause",
]);

function normalizeTag(tag: string): string {
  return String(tag || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyTtsEmotionTag(tag: string): boolean {
  const normalized = normalizeTag(tag);
  if (!normalized) return false;
  if (KNOWN_TTS_TAGS.has(normalized)) return true;
  if (normalized.includes("pause") || normalized.includes("beat")) return true;
  if (normalized.includes("whisper")) return true;
  if (normalized.includes("laugh")) return true;
  if (normalized.includes("excit")) return true;
  if (normalized.includes("dramatic")) return true;
  return false;
}

function stripTtsEmotionTags(text: string): string {
  return String(text || "")
    .replace(INLINE_TTS_TAG_PATTERN, (fullTag, innerTag) => (
      isLikelyTtsEmotionTag(String(innerTag || "")) ? " " : fullTag
    ))
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();
}

export class RunwareImageGenerator implements ImageGenerator {
  async generateImages(input: {
    normalizedRequest: NormalizedRequest;
    cast: CastSet;
    directives: SceneDirective[];
    imageSpecs: ImageSpec[];
    pipelineConfig?: { runwareSteps: number; runwareCfgScale: number; imageRetryMax: number };
    logContext?: { storyId?: string; phase?: string };
  }): Promise<Array<{
    chapter: number;
    imageUrl?: string;
    prompt: string;
    provider?: string;
    model?: string;
    providerCostUSD?: number | null;
    providerCostCredits?: number | null;
    promptChars?: number;
    negativePromptChars?: number;
    referenceCount?: number;
    success?: boolean;
    metadata?: Record<string, any>;
  }>> {
    const results: Array<{
      chapter: number;
      imageUrl?: string;
      prompt: string;
      provider?: string;
      model?: string;
      providerCostUSD?: number | null;
      providerCostCredits?: number | null;
      promptChars?: number;
      negativePromptChars?: number;
      referenceCount?: number;
      success?: boolean;
      metadata?: Record<string, any>;
    }> = [];
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

      const prompt = stripTtsEmotionTags(spec.finalPromptText || "");
      const negativePrompt = (spec.negatives || []).join(", ");

      const imageResult = await generateWithRetry({
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
        imageUrl: imageResult.imageUrl,
        prompt,
        provider: "runware",
        model: "runware:400@4",
        providerCostUSD: imageResult.providerCostUSD,
        providerCostCredits: imageResult.providerCostCredits,
        promptChars: prompt.length,
        negativePromptChars: negativePrompt.length,
        referenceCount: referenceImages.length,
        success: Boolean(imageResult.imageUrl),
        metadata: imageResult.metadata,
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
}): Promise<{
  imageUrl?: string;
  providerCostUSD?: number | null;
  providerCostCredits?: number | null;
  metadata?: Record<string, any>;
}> {
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
      const providerCosts = extractRunwareCostMetrics(response?.debugInfo?.responseReceived ?? response);
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
      return {
        imageUrl: response.imageUrl,
        providerCostUSD: providerCosts.providerCostUSD,
        providerCostCredits: providerCosts.providerCostCredits,
        metadata: {
          costMatches: providerCosts.matches,
          steps: input.steps,
          cfgScale: input.cfgScale,
          referenceCount: input.referenceImages.length,
        },
      };
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
  return {
    imageUrl: undefined,
    providerCostUSD: null,
    providerCostCredits: null,
    metadata: {
      steps: input.steps,
      cfgScale: input.cfgScale,
      referenceCount: input.referenceImages.length,
      error: String((lastError as Error)?.message || lastError),
    },
  };
}

function resolveImageLogSource(phase?: string): string {
  if (phase === "phase8-cover") return "phase8-cover-imagegen";
  if (phase === "phase10-vision-retry-imagegen") return "phase10-vision-retry-imagegen";
  if (phase === "phase10-vision") return "phase10-vision-retry-imagegen";
  if (phase === "phase9-imagegen-scenic") return "phase9-imagegen-scenic";
  if (phase === "phase9-imagegen") return "phase9-imagegen-runware";
  return "phase9-imagegen-runware";
}

function resolveIpAdapterWeight(referenceCount: number, useCollageReference: boolean): number | undefined {
  if (referenceCount <= 0) return undefined;
  if (useCollageReference) {
    return referenceCount >= 3 ? 0.72 : 0.7;
  }
  if (referenceCount >= 3) return 0.74;
  if (referenceCount === 2) return 0.72;
  return 0.68;
}
