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
  /** A named character doing what the scene gives to someone else. */
  roleSwaps: string[];
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
  /** 0 = full identity sheet, 1 = reduced sheet, 2 = no reference, -1 = no picture. */
  referenceLevel?: number;
  /** Why a delivery step failed — goes into the story metadata and logs. */
  errors?: string[];
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
    "Compare who does what with the intended scene, using the reference sheet to tell the characters apart.",
    "Return JSON only:",
    JSON.stringify({
      namedCharactersVisible: 0,
      anatomyDefects: ["e.g. 'child on the left has three hands'"],
      animalFeaturesOnHumans: ["e.g. 'the boy has fox ears'"],
      duplicates: ["a character drawn twice"],
      unexpectedCharacters: ["figures that are not expected"],
      roleSwaps: ["e.g. 'the scene says Adrian climbs the ladder, but the brown-haired boy is climbing'"],
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
    roleSwaps: list(data.roleSwaps),
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
  severity += report.roleSwaps.length * 10;
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
  if (report.roleSwaps.length) fixes.push(`Keep the roles exactly as described: ${report.roleSwaps.slice(0, 2).join("; ")}.`);
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

  // Heroes first: when a sheet must shrink, the avatars keep their identity.
  const rank = (entity: VisualEntity) => (entity.role === "hero" ? 0 : entity.kind === "artifact" ? 2 : 1);

  const renderShot = async (shot: IllustrationShot): Promise<ImageOutcome> => {
    const onStage = shot.onStage.map((id) => byId.get(id)).filter((entity): entity is VisualEntity => Boolean(entity));
    const drawn = [...onStage, ...(shot.artifactVisible && artifact ? [artifact] : [])];
    const withReferences = drawn.filter((entity) => entity.referenceUrl).sort((a, b) => rank(a) - rank(b));
    const expectedCharacters = onStage.length;

    // A page must never stay blank. Story 0039344e lost three of eight
    // pictures because the only attempt path was "full sheet or nothing".
    // Ladder: full sheet → the two most important identities → no reference.
    const ladder: VisualEntity[][] = [withReferences];
    if (withReferences.length > 2) ladder.push(withReferences.slice(0, 2));
    if (withReferences.length > 0) ladder.push([]);

    let costUSD = 0;
    const errors: string[] = [];

    const deliver = async (attemptNo: number, extra: string, startLevel: number) => {
      let lastPrompt = shot.scene;
      for (let level = startLevel; level < ladder.length; level += 1) {
        const sheet = ladder[level];
        let references: string[] = [];
        if (sheet.length > 0) {
          try {
            references = (await buildReference(sheet.map((entity) => ({ imageUrl: entity.referenceUrl!, displayName: entity.name, kind: entity.kind })))).urls;
          } catch (err) {
            errors.push(`sheet ${sheet.map((entity) => entity.name).join("+")}: ${(err as Error)?.message || err}`);
            continue;
          }
        }
        const base = assembleImagePrompt({ scene: shot.scene, onStage: drawn, spriteOrder: sheet });
        const prompt = extra ? `${base}
${extra}` : base;
        lastPrompt = prompt;
        imageCalls += 1;
        try {
          const response = await input.provider({
            page: shot.page,
            prompt,
            negativePrompt: negativePromptFor(drawn, sheet.length > 1),
            referenceImages: references,
            seed: seedFor(input.seed, shot.page, attemptNo * 10 + level),
            width: input.width ?? 1024,
            height: input.height ?? 1024,
          });
          const cost = Number.isFinite(response.costUSD) ? Number(response.costUSD) : 0;
          costUSD += cost;
          imageCostUSD = Number((imageCostUSD + cost).toFixed(6));
          if (response.url) return { response, references, prompt, level };
          errors.push(`level ${level}: provider returned no image`);
        } catch (err) {
          errors.push(`level ${level} (${references.length ? `${sheet.length} identities` : "no reference"}): ${(err as Error)?.message || err}`);
        }
        console.warn(`[storybook/images] page ${shot.page}: ${errors[errors.length - 1]}`);
      }
      return { response: {} as ImageResponse, references: [] as string[], prompt: lastPrompt, level: -1 };
    };

    const attempt = async (attemptNo: number, extra: string, startLevel: number): Promise<ImageOutcome & { level: number }> => {
      const delivered = await deliver(attemptNo, extra, startLevel);
      const url = delivered.response.url;
      if (!url) return { page: shot.page, prompt: delivered.prompt, attempts: attemptNo, costUSD, severity: 999, level: -1 };

      let qa: ImageQaReport | undefined;
      if (input.llm && input.visionModel) {
        try {
          const call = await input.llm({
            stage: `image-qa-${shot.page === 0 ? "cover" : `p${shot.page}`}-${attemptNo}`,
            role: "support",
            model: input.visionModel,
            system: "You are a meticulous picture-book illustration checker. Answer with JSON only.",
            user: buildQaPrompt(drawn, shot.scene, delivered.references.length > 0),
            json: true,
            maxTokens: 2500,
            effort: "low",
            imageInputs: [delivered.response.viewUrl || url, ...delivered.references.slice(0, 1)],
            timeoutMs: 60_000,
          });
          qaCalls.push(call);
          qa = parseQaReport(call.text) || undefined;
        } catch (err) {
          console.warn(`[storybook/images] vision check failed for page ${shot.page}:`, (err as Error)?.message || err);
        }
      }
      return { page: shot.page, url, prompt: delivered.prompt, attempts: attemptNo, costUSD, qa, severity: qaSeverity(qa, expectedCharacters), level: delivered.level };
    };

    const finish = (outcome: ImageOutcome & { level: number }, attempts: number): ImageOutcome => {
      const { level, ...rest } = outcome;
      return { ...rest, attempts, costUSD, referenceLevel: level, errors: errors.length ? errors : undefined };
    };

    const first = await attempt(1, "", 0);
    // No picture at all even without a reference: nothing a new seed would fix.
    if (!first.url || first.severity < 10) return finish(first, 1);
    regenerated.push(shot.page);
    const second = await attempt(2, first.qa ? correctionFor(first.qa) : "", Math.max(0, first.level));
    return finish(second.severity < first.severity ? second : first, 2);
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
