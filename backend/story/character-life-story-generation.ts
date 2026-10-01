/**
 * "Talea Origins" generation — the lean lane.
 *
 *   writer     GPT-6.1 Sol, one call: introduction + five adventure chapters   ≈ 7k tokens
 *   shot list  GPT-6 Luna, one call: place, light, camera and action per image  ≈ 4k tokens
 *   images     FLUX.2 klein 9B, cover + one per chapter, hero portrait as reference
 *
 * The Dev engine this replaced (idea lab, beat sheet, scene cards, dialogue
 * plan, draft, polish, validators, repairs, vision checks) burnt 100,000+
 * tokens per story for a text of 1,700 words. Nothing here reads the story a
 * second time: the format is parsed and the cheap checks in
 * character-life-story-writer.ts are stored as notes for the editor.
 *
 * Encore adapter: it talks to OpenRouter and the image service; the pure parts
 * live in character-life-story-{prompt,writer,images}.ts.
 */

import { createHash } from "crypto";
import { ai } from "~encore/clients";
import { resolveImageUrlForClient } from "../helpers/bucket-storage";
import { acceptedGeneratedImageUrl } from "../helpers/imageResultGuard";
import { looksLikeEnglishImagePrompt } from "./dev-mode-image-prompt-quality";
import {
  LIFE_STORY_IMAGE_MODEL,
  LIFE_STORY_IMAGE_NEGATIVE,
  composeShotPrompt,
  fallbackShotList,
  planLifeStoryShots,
  type LifeStoryShotList,
} from "./character-life-story-images";
import {
  LIFE_STORY_TARGET_WORDS,
  deriveLifeStoryMood,
  parseJsonObject,
  type LifeStoryAgeGroup,
  type LifeStoryCharacter,
} from "./character-life-story-prompt";
import { buildLifeStoryMessages, countWords, lifeStoryDraftIssues, parseLifeStoryDraft } from "./character-life-story-writer";
import { CostLedger, STORYBOOK_SUPPORT_MODEL, type LlmRequest } from "./storybook/llm";
import { createOpenRouterStorybookLlm } from "./storybook/llm-openrouter";

export const LIFE_STORY_PIPELINE_ID = "character-life-lean-v1";

export interface LifeStorySource extends LifeStoryCharacter {
  id: string;
  image_url: string | null;
}

export interface GeneratedLifeStory {
  title: string;
  description: string;
  coverImageUrl?: string;
  chapters: Array<{ id: string; order: number; title: string; content: string; imageUrl?: string; imagePrompt?: string }>;
  wordCount: number;
  metadata: Record<string, unknown>;
}

interface ImageJob {
  kind: "cover" | "chapter";
  order?: number;
  prompt: string;
}

interface ImageOutcome {
  job: ImageJob;
  imageUrl?: string;
  costUSD: number;
}

async function readableReference(imageUrl: string | null | undefined): Promise<string | undefined> {
  if (!imageUrl) return undefined;
  try {
    const resolved = await resolveImageUrlForClient(imageUrl);
    return resolved && /^(https?:|data:image\/)/i.test(resolved) ? resolved : undefined;
  } catch {
    return undefined;
  }
}

function providerImageCostUSD(result: any): number {
  const response = result?.debugInfo?.responseReceived;
  const rows = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
  return Number(rows.reduce((sum: number, row: any) => (Number(row?.cost) > 0 ? sum + Number(row.cost) : sum), 0).toFixed(6));
}

async function mapWithLimit<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index]);
    }
  }));
  return results;
}

/** An English look for the image prompt: the profile's visual description, or nothing (the reference image knows the rest). */
function heroLookFor(character: LifeStoryCharacter): string {
  const visual = parseJsonObject(character.visual_profile);
  for (const candidate of [visual.description, visual.imagePrompt, character.physical_description]) {
    const text = String(candidate || "").replace(/\s+/g, " ").trim();
    if (text && looksLikeEnglishImagePrompt(text, [character.name])) return text.slice(0, 200);
  }
  return "";
}

export async function generateLifeStory(input: {
  character: LifeStorySource;
  ageGroup: LifeStoryAgeGroup;
  writerModel: string;
  storyId: string;
}): Promise<GeneratedLifeStory> {
  const { character, ageGroup, writerModel, storyId } = input;
  const started = Date.now();
  const ledger = new CostLedger();
  const llm = createOpenRouterStorybookLlm({
    onFailedAttempt: (request, billed) => {
      if (billed) ledger.recordCall(`${request.stage}-failed`, billed, request.role);
    },
  });
  const call = async (request: LlmRequest) => {
    const result = await llm(request);
    ledger.recordCall(request.stage, result, request.role);
    return result;
  };

  // 1) The story: one call.
  const messages = buildLifeStoryMessages(character, ageGroup);
  const writerRequest: LlmRequest = {
    stage: "life-story-writer",
    role: "writer",
    model: writerModel,
    system: messages.system,
    user: messages.user,
    json: false,
    maxTokens: 9000,
    effort: "low",
    timeoutMs: 240_000,
  };
  let written = await call(writerRequest);
  let draft = parseLifeStoryDraft(written.text);
  if (!draft) {
    written = await call({
      ...writerRequest,
      stage: "life-story-writer-retry",
      user: `${messages.user}\n\nWICHTIG: Halte das Ausgabeformat exakt ein — TITEL, BESCHREIBUNG und danach genau 6 Kapitel, jedes mit einer Zeile „KAPITEL n: Titel“.`,
    });
    draft = parseLifeStoryDraft(written.text);
  }
  if (!draft) throw new Error("Die Geschichte kam nicht im erwarteten Format zurück (Titel und 6 Kapitel).");
  const draftIssues = lifeStoryDraftIssues(draft, character);
  const mood = deriveLifeStoryMood(character).mood;

  // 2) The shot list: place, light, camera and action for every picture.
  const heroLook = heroLookFor(character);
  const planned = await planLifeStoryShots(async (prompt) => (await call({
    stage: "life-story-shot-list",
    role: "support",
    model: STORYBOOK_SUPPORT_MODEL,
    system: prompt.system,
    user: prompt.user,
    json: true,
    maxTokens: 4000,
    effort: "low",
    timeoutMs: 120_000,
  })).text, {
    heroName: character.name,
    heroLook,
    mood,
    title: draft.title,
    chapters: draft.chapters.map((chapter) => ({ ...chapter, ...(chapter.order === 1 ? { kind: "intro" as const } : {}) })),
  });
  const shots: LifeStoryShotList = planned?.list ?? fallbackShotList(draft.chapters);

  // 3) The pictures.
  const reference = await readableReference(character.image_url);
  const imageModel = process.env.TALEA_LIFE_STORY_IMAGE_MODEL || LIFE_STORY_IMAGE_MODEL;
  const seedBase = (parseInt(createHash("sha256").update(storyId).digest("hex").slice(0, 8), 16) % 2_000_000_000) + 1;
  const compose = (shot: LifeStoryShotList["cover"], kind: "cover" | "chapter") => composeShotPrompt({
    shot, figures: shots.figures, heroName: character.name, heroLook, mood, kind, hasReference: Boolean(reference),
  });
  const jobs: ImageJob[] = [
    { kind: "cover", prompt: compose(shots.cover, "cover") },
    ...shots.chapters.map((shot): ImageJob => ({ kind: "chapter", order: shot.order, prompt: compose(shot, "chapter") })),
  ];

  let imageCalls = 0;
  const render = async (job: ImageJob, seedOffset: number): Promise<ImageOutcome> => {
    try {
      imageCalls += 1;
      const image = await ai.generateImage({
        prompt: job.prompt,
        negativePrompt: LIFE_STORY_IMAGE_NEGATIVE,
        model: imageModel,
        width: 1024,
        height: 1024,
        steps: 4,
        CFGScale: 4,
        outputFormat: "JPEG",
        referenceImages: reference ? [reference] : undefined,
        seed: seedBase + (job.order ?? 0) * 7919 + seedOffset,
        logContext: { storyId, stage: `life-story-image-${job.kind}`, chapter: job.order },
      });
      return { job, imageUrl: acceptedGeneratedImageUrl(image), costUSD: providerImageCostUSD(image) };
    } catch (error) {
      console.warn(`[character-life-story] image ${job.kind}${job.order ? ` ${job.order}` : ""} failed:`, error instanceof Error ? error.message : error);
      return { job, costUSD: 0 };
    }
  };
  const key = (job: ImageJob) => `${job.kind}:${job.order ?? 0}`;
  const outcomes = new Map<string, ImageOutcome>();
  const seen = new Set<string>();
  const accept = (outcome: ImageOutcome) => {
    const previous = outcomes.get(key(outcome.job));
    const costUSD = Number(((previous?.costUSD || 0) + outcome.costUSD).toFixed(6));
    const url = outcome.imageUrl?.trim();
    // The provider occasionally hands back the same picture twice.
    const usable = url && !seen.has(url) ? url : undefined;
    if (usable) seen.add(usable);
    outcomes.set(key(outcome.job), { job: outcome.job, imageUrl: usable, costUSD });
  };
  for (const outcome of await mapWithLimit(jobs, 3, (job) => render(job, 0))) accept(outcome);
  const missing = jobs.filter((job) => !outcomes.get(key(job))?.imageUrl);
  if (missing.length > 0) {
    console.warn("[character-life-story] retrying missing images", { storyId, missing: missing.map(key) });
    for (const outcome of await mapWithLimit(missing, 2, (job) => render(job, 1000))) accept(outcome);
  }
  const imageCostUSD = Number([...outcomes.values()].reduce((sum, outcome) => sum + outcome.costUSD, 0).toFixed(6));
  const imageOf = (kind: "cover" | "chapter", order?: number) => outcomes.get(`${kind}:${order ?? 0}`)?.imageUrl;

  const chapters = draft.chapters.map((chapter) => ({
    id: crypto.randomUUID(),
    order: chapter.order,
    title: chapter.title,
    content: chapter.content,
    imageUrl: imageOf("chapter", chapter.order),
    imagePrompt: jobs.find((job) => job.kind === "chapter" && job.order === chapter.order)?.prompt,
  }));
  const wordCount = chapters.reduce((sum, chapter) => sum + countWords(chapter.content), 0);
  const text = ledger.totals();
  const imagesGenerated = [...outcomes.values()].filter((outcome) => outcome.imageUrl).length;

  return {
    title: draft.title,
    description: draft.description,
    coverImageUrl: imageOf("cover"),
    chapters,
    wordCount,
    metadata: {
      pipeline: LIFE_STORY_PIPELINE_ID,
      generationMode: LIFE_STORY_PIPELINE_ID,
      // The port switches models after repeated failures; the story says who really wrote it.
      model: written.modelUsed || writerModel,
      storyModel: written.modelUsed || writerModel,
      ...(written.fallbackFrom ? { writerFallbackFrom: written.fallbackFrom } : {}),
      supportModel: STORYBOOK_SUPPORT_MODEL,
      imageModel,
      processingTime: Date.now() - started,
      lifeStoryMood: mood,
      targetWords: LIFE_STORY_TARGET_WORDS,
      introWords: countWords(chapters[0]?.content || ""),
      draftIssues,
      shotListIssues: planned?.issues,
      shotListAttempts: planned?.attempts,
      shotListFallback: !planned,
      shotLocations: [shots.cover.location, ...shots.chapters.map((shot) => shot.location)],
      imagesGenerated,
      imageCalls,
      imageCostUSD,
      tokensUsed: { prompt: text.prompt, completion: text.completion, total: text.total, totalCostUSD: text.costUSD, modelUsed: written.modelUsed || writerModel },
      totalCostUSD: Number((text.costUSD + imageCostUSD).toFixed(6)),
      devModeStages: ledger.all(),
    },
  };
}
