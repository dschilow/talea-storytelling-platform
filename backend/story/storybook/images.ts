/**
 * Storybook Pipeline — illustrations with a vision check.
 *
 * Per picture:
 *   1. a reference sprite of ONLY the characters drawn on it (plus the artifact
 *      when visible) — still one collage, never loose portraits;
 *   2. the deterministic prompt from illustration-stage.ts;
 *   3. a cheap vision check (gpt-6-luna reads images) for the defects a parent
 *      notices first: extra hands or fingers, animal ears/tails on humans,
 *      doubled characters, text, the reference sheet painted into the scene;
 *   4. on a severe defect exactly one regeneration with a new seed and a named
 *      correction; the better of the two attempts ships.
 *
 * Everything external is injected (image provider, LLM port, sprite builder),
 * so this module runs the same under Encore, in the local harness and in tests.
 */

import { createHash } from "node:crypto";
import { createIdentityReferenceCache, type IdentityReferenceBuilder } from "../image-reference-sprite";
import { parseJsonObject, type LlmCallResult, type StorybookLlm } from "./llm";
import { assembleImagePrompt, negativePromptFor, type VisualEntity } from "./illustration-stage";
import type { IllustrationPlan, IllustrationShot } from "./types";

export interface ImageRequest {
  page: number;
  prompt: string;
  negativePrompt: string;
  referenceImages: string[];
  seed: number;
  width: number;
  height: number;
}

export interface ImageResponse {
  /** What gets stored on the story (may be a private bucket URL). */
  url?: string;
  /** A URL the vision checker can fetch, when `url` is not public. */
  viewUrl?: string;
  costUSD?: number;
}

export type ImageProvider = (request: ImageRequest) => Promise<ImageResponse>;

export interface ImageQaReport {
  anatomyDefects: string[];
  animalFeaturesOnHumans: string[];
  duplicates: string[];
  unexpectedCharacters: string[];
  textVisible: boolean;
  referenceSheetVisible: boolean;
  identityMatch: number;
  sceneMatch: number;
  namedCharactersVisible: number;
}

export interface ImageOutcome {
  page: number;
  url?: string;
  prompt: string;
  attempts: number;
  costUSD: number;
  qa?: ImageQaReport;
  severity: number;
}

export interface StorybookImagesResult {
  cover?: ImageOutcome;
  pages: Map<number, ImageOutcome>;
  imagesGenerated: number;
  imageCalls: number;
  imageCostUSD: number;
  qaCalls: LlmCallResult[];
  regenerated: number[];
}

export interface GenerateImagesInput {
  illustrations: IllustrationPlan;
  entities: VisualEntity[];
  provider: ImageProvider;
  seed: string;
  llm?: StorybookLlm;
  visionModel?: string;
  buildReference?: IdentityReferenceBuilder;
  concurrency?: number;
  width?: number;
  height?: number;
}

function seedFor(seed: string, page: number, attempt: number): number {
  const hex = createHash("sha256").update(`${seed}:${page}:${attempt}`).digest("hex").slice(0, 8);
  return parseInt(hex, 16) % 2_147_483_647;
}

export function buildQaPrompt(expected: VisualEntity[], scene: string, hasReference: boolean): string {
  const list = expected.map((entity) => `- ${entity.name}: ${entity.kind === "artifact" ? "object" : entity.isHuman ? "HUMAN" : entity.species}`).join("\n") || "- (no named characters)";
  return [
    "You inspect ONE illustration from a children's picture book for defects a parent would notice immediately.",
    `Attachment 1 is the illustration.${hasReference ? " Attachment 2 is a technical identity sheet (reference only, NOT part of the artwork)." : ""}`,
    "Expected named characters:",
    list,
    `Intended scene: ${scene.slice(0, 500)}`,
    "",
    "Look carefully at every hand, arm, leg, head and ear. Count fingers where visible.",
    "Return JSON only:",
    JSON.stringify({
      namedCharactersVisible: 0,
      anatomyDefects: ["e.g. 'child on the left has three hands'"],
      animalFeaturesOnHumans: ["e.g. 'the boy has fox ears'"],
      duplicates: ["a character drawn twice"],
      unexpectedCharacters: ["figures that are not expected"],
      textVisible: false,
      referenceSheetVisible: false,
      identityMatch: 0.0,
      sceneMatch: 0.0,
    }),
    "identityMatch/sceneMatch: 0-1. Empty arrays when there is no such defect. Do not invent defects.",
  ].join("\n");
}

export function parseQaReport(raw: string): ImageQaReport | null {
  const data = parseJsonObject<any>(raw);
  if (!data) return null;
  const list = (value: unknown) => (Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter((item) => item && !/^e\.g\./i.test(item)).slice(0, 6) : []);
  const unit = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5;
  };
  return {
    anatomyDefects: list(data.anatomyDefects),
    animalFeaturesOnHumans: list(data.animalFeaturesOnHumans),
    duplicates: list(data.duplicates),
    unexpectedCharacters: list(data.unexpectedCharacters),
    textVisible: data.textVisible === true,
    referenceSheetVisible: data.referenceSheetVisible === true,
    identityMatch: unit(data.identityMatch),
    sceneMatch: unit(data.sceneMatch),
    namedCharactersVisible: Math.max(0, Math.round(Number(data.namedCharactersVisible) || 0)),
  };
}

/** 0 = clean. Anything >= 10 is a defect worth one regeneration. */
export function qaSeverity(report: ImageQaReport | undefined, expectedCharacters: number): number {
  if (!report) return 0;
  let severity = 0;
  severity += report.anatomyDefects.length * 10;
  severity += report.animalFeaturesOnHumans.length * 10;
  severity += report.duplicates.length * 10;
  if (report.referenceSheetVisible) severity += 12;
  if (report.textVisible) severity += 6;
  if (report.identityMatch < 0.4) severity += 8;
  if (report.namedCharactersVisible > expectedCharacters) severity += 6;
  if (expectedCharacters > 0 && report.namedCharactersVisible < expectedCharacters) severity += 3;
  if (report.sceneMatch < 0.4) severity += 3;
  return severity;
}

function correctionFor(report: ImageQaReport): string {
  const fixes: string[] = [];
  if (report.anatomyDefects.length) fixes.push("Correct anatomy: every person has exactly two arms and two hands with five fingers each; no extra limbs.");
  if (report.animalFeaturesOnHumans.length) fixes.push("The human characters have ordinary human ears and no animal features at all.");
  if (report.duplicates.length) fixes.push("Each character appears exactly once.");
  if (report.referenceSheetVisible) fixes.push("Only the scene itself — no reference sheet, no framed portraits, no white panels.");
  if (report.textVisible) fixes.push("No letters or writing anywhere.");
  return fixes.join(" ");
}

async function mapWithLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, run));
  return results;
}

export async function generateStorybookImages(input: GenerateImagesInput): Promise<StorybookImagesResult> {
  const buildReference = input.buildReference || createIdentityReferenceCache();
  const byId = new Map(input.entities.map((entity) => [entity.id, entity]));
  const artifact = input.entities.find((entity) => entity.kind === "artifact");
  const qaCalls: LlmCallResult[] = [];
  const regenerated: number[] = [];
  let imageCalls = 0;
  let imageCostUSD = 0;

  const shots: IllustrationShot[] = [input.illustrations.cover, ...input.illustrations.pages];

  const renderShot = async (shot: IllustrationShot): Promise<ImageOutcome> => {
    const onStage = shot.onStage.map((id) => byId.get(id)).filter((entity): entity is VisualEntity => Boolean(entity));
    const drawn = [...onStage, ...(shot.artifactVisible && artifact ? [artifact] : [])];
    const spriteOrder = drawn.filter((entity) => entity.referenceUrl);

    let references: string[] = [];
    try {
      const reference = await buildReference(spriteOrder.map((entity) => ({ imageUrl: entity.referenceUrl!, displayName: entity.name, kind: entity.kind })));
      references = reference.urls;
    } catch (err) {
      // Without the identity sheet the picture cannot be consistent; drawing it
      // anyway would put a stranger on the page.
      console.warn(`[storybook/images] reference sheet failed for page ${shot.page}:`, (err as Error)?.message || err);
      return { page: shot.page, prompt: shot.scene, attempts: 0, costUSD: 0, severity: 0 };
    }
    const sheetEntities = references.length > 0 ? spriteOrder : [];
    const basePrompt = assembleImagePrompt({ scene: shot.scene, onStage: drawn, spriteOrder: sheetEntities });
    const negativePrompt = negativePromptFor(drawn, sheetEntities.length > 1);
    const expectedCharacters = onStage.length;

    const attempt = async (attemptNo: number, extra: string): Promise<ImageOutcome> => {
      const prompt = extra ? `${basePrompt}\n${extra}` : basePrompt;
      imageCalls += 1;
      let response: ImageResponse = {};
      try {
        response = await input.provider({
          page: shot.page,
          prompt,
          negativePrompt,
          referenceImages: references,
          seed: seedFor(input.seed, shot.page, attemptNo),
          width: input.width ?? 1024,
          height: input.height ?? 1024,
        });
      } catch (err) {
        console.warn(`[storybook/images] page ${shot.page} attempt ${attemptNo} failed:`, (err as Error)?.message || err);
      }
      const cost = Number.isFinite(response.costUSD) ? Number(response.costUSD) : 0;
      imageCostUSD = Number((imageCostUSD + cost).toFixed(6));
      if (!response.url) return { page: shot.page, prompt, attempts: attemptNo, costUSD: cost, severity: 999 };

      let qa: ImageQaReport | undefined;
      if (input.llm && input.visionModel) {
        try {
          const call = await input.llm({
            stage: `image-qa-${shot.page === 0 ? "cover" : `p${shot.page}`}-${attemptNo}`,
            role: "support",
            model: input.visionModel,
            system: "You are a meticulous picture-book illustration checker. Answer with JSON only.",
            user: buildQaPrompt(drawn, shot.scene, references.length > 0),
            json: true,
            maxTokens: 2500,
            effort: "low",
            imageInputs: [response.viewUrl || response.url, ...references.slice(0, 1)],
            timeoutMs: 60_000,
          });
          qaCalls.push(call);
          qa = parseQaReport(call.text) || undefined;
        } catch (err) {
          console.warn(`[storybook/images] vision check failed for page ${shot.page}:`, (err as Error)?.message || err);
        }
      }
      return { page: shot.page, url: response.url, prompt, attempts: attemptNo, costUSD: cost, qa, severity: qaSeverity(qa, expectedCharacters) };
    };

    const first = await attempt(1, "");
    if (first.severity < 10) return first;
    regenerated.push(shot.page);
    const second = await attempt(2, first.qa ? correctionFor(first.qa) : "");
    const best = second.severity < first.severity ? second : first;
    return { ...best, attempts: 2, costUSD: first.costUSD + second.costUSD };
  };

  const outcomes = await mapWithLimit(shots, input.concurrency ?? 4, renderShot);
  const pages = new Map<number, ImageOutcome>();
  let cover: ImageOutcome | undefined;
  for (const outcome of outcomes) {
    if (outcome.page === 0) cover = outcome;
    else pages.set(outcome.page, outcome);
  }
  const imagesGenerated = outcomes.filter((outcome) => outcome.url).length;
  return { cover, pages, imagesGenerated, imageCalls, imageCostUSD, qaCalls, regenerated };
}
