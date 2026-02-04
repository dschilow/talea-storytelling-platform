import { secret } from "encore.dev/config";
import { publishWithTimeout } from "../../helpers/pubsubTimeout";
import { logTopic } from "../../log/logger";
import type { CastSet, ImageSpec, NormalizedRequest, SceneDirective, VisionValidator } from "./types";
import { buildVisionValidationPrompt } from "./prompts";

const openAIKey = secret("OpenAIKey");

export class SimpleVisionValidator implements VisionValidator {
  async validateImages(input: {
    normalizedRequest: NormalizedRequest;
    cast: CastSet;
    directives: SceneDirective[];
    imageSpecs: ImageSpec[];
    images: Array<{ chapter: number; imageUrl?: string; prompt: string }>;
  }): Promise<{ report: any; retryAdvice: Record<number, string[]> }> {
    const report: any = { images: [] };
    const retryAdvice: Record<number, string[]> = {};

    for (const image of input.images) {
      if (!image.imageUrl) {
        report.images.push({ chapter: image.chapter, score: 0, checks: {}, issues: [{ code: "NO_IMAGE", severity: "ERROR", message: "No image URL" }], retryAdvice: ["Regenerate image"] });
        retryAdvice[image.chapter] = ["Regenerate image with stricter prompt."];
        continue;
      }

      const directive = input.directives.find(d => d.chapter === image.chapter);
      const spec = input.imageSpecs.find(s => s.chapter === image.chapter);
      if (!directive || !spec) continue;

      const characterSlots = directive.charactersOnStage.filter(slot => !slot.includes("ARTIFACT"));
      const checklist = [
        `Exactly ${characterSlots.length} characters visible (no extra characters)`,
        "No duplicate characters",
        "Artifact visible if required",
        "Full body visible for each character",
        "No one looking at camera",
      ];

      const prompt = buildVisionValidationPrompt({ checklist });
      const response = await callVisionAPI(image.imageUrl, prompt, { storyId: input.normalizedRequest.storyId, chapter: image.chapter });

      const issues: any[] = [];
      const checks = {
        onStageExact: response?.onStageExact ?? true,
        noExtraCharacters: response?.noExtraCharacters ?? true,
        noDuplicates: response?.noDuplicates ?? true,
        artifactVisible: response?.artifactVisible ?? true,
        fullBodyIfRequired: response?.fullBody ?? true,
        noLookingAtCamera: response?.noLookingAtCamera ?? true,
      };

      if (response?.issues && Array.isArray(response.issues)) {
        response.issues.forEach((msg: string) => {
          issues.push({ code: "VISION", severity: "WARN", message: msg, chapter: image.chapter });
        });
      }

      const score = Object.values(checks).filter(Boolean).length;
      const retry = response?.retryAdvice ?? [];
      if (retry.length === 0 && issues.length > 0) {
        retry.push(
          "Ensure exact character count",
          "Show full-body head-to-toe",
          "No looking at camera",
          "Artifact visible if required"
        );
      }
      retryAdvice[image.chapter] = retry;

      report.images.push({
        chapter: image.chapter,
        score,
        checks,
        issues,
        retryAdvice: retry,
      });
    }

    return { report, retryAdvice };
  }
}

async function callVisionAPI(imageUrl: string, prompt: string, metadata?: { storyId?: string; chapter?: number }): Promise<any> {
  const payload = {
    model: "gpt-5-mini",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
        ],
      },
    ],
    max_tokens: 800,
    response_format: { type: "json_object" },
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAIKey()}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    await publishWithTimeout(logTopic as any, {
      source: "phase10-vision-llm",
      timestamp: new Date(),
      request: payload,
      response: { status: response.status, error: text },
      metadata: metadata ?? null,
    });
    throw new Error(`Vision API error ${response.status}: ${text}`);
  }

  const data = await response.json() as any;
  await publishWithTimeout(logTopic as any, {
    source: "phase10-vision-llm",
    timestamp: new Date(),
    request: payload,
    response: data,
    metadata: metadata ?? null,
  });
  const content = data.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
}
