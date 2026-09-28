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
  /** A story element worn as clothing, drawn as a person, or missing. Not shape/colour details. */
  elementMisuse: string[];
  /** A feature of one character drawn on another (moustache, crown, cape), or facial hair on a child. */
  featureBleed?: string[];
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

export function buildQaPrompt(expected: VisualEntity[], scene: string, hasReference: boolean, elements: Array<{ name: string; look: string }> = []): string {
  const list = expected.map((entity) => `- ${entity.name}: ${entity.kind === "artifact" ? "object" : entity.isHuman ? "HUMAN" : entity.species}`).join("\n") || "- (no named characters)";
  return [
    "You inspect ONE illustration from a children's picture book for defects a parent would notice immediately.",
    `Attachment 1 is the illustration.${hasReference ? " Attachment 2 is a technical identity sheet (reference only, NOT part of the artwork)." : ""}`,
    "Expected named characters:",
    list,
    `Intended scene: ${scene.slice(0, 500)}`,
    ...(elements.length ? [`Story elements in this picture: ${elements.map((element) => `${element.name} — ${element.look}`).join("; ")}. Report under elementMisuse ONLY if one is worn as clothing, drawn as a person, or missing entirely — never for shape, size or colour details.`] : []),
    "",
    "Look carefully at every hand, arm, leg, head and ear. Count fingers where visible. Check every face: children never have a moustache or beard, and no character wears another character's moustache, crown, hat or cape.",
    "Compare who does the KEY action with the intended scene, using the reference sheet to tell the characters apart. Ignore small pose or prop differences — a picture book illustration may interpret the moment freely.",
    "First count how often EACH expected character is drawn (a second person with the same face, hair or outfit counts). Exactly 1 is correct; 2 or more is a duplicate; 0 means missing.",
    "Return JSON only:",
    JSON.stringify({
      characterCounts: Object.fromEntries(expected.filter((entity) => entity.kind !== "artifact").map((entity) => [entity.name, 1])),
      namedCharactersVisible: 0,
      anatomyDefects: ["e.g. 'child on the left has three hands'"],
      animalFeaturesOnHumans: ["e.g. 'the boy has fox ears'"],
      featureBleed: ["e.g. 'both children have the robber's moustache', 'the frog wears a crown that is not his'"],
      duplicates: ["a character drawn twice"],
      unexpectedCharacters: ["figures that are not expected, e.g. two extra children in the background"],
      roleSwaps: ["ONLY: the page's key action is done by the wrong named character. Pose details, props held slightly differently or small action differences are NOT role swaps."],
      elementMisuse: [],
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
  const list = (value: unknown) => (Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter((item) => item && !/^(e\.g\.|ONLY:)/i.test(item)).slice(0, 6) : []);
  const unit = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5;
  };
  // Counts are the reliable signal: a model that lists no duplicate in prose
  // still writes "Johann": 2 when asked to count.
  const counts = data.characterCounts && typeof data.characterCounts === "object" ? data.characterCounts : {};
  const counted = Object.entries(counts).map(([name, value]) => [name, Math.round(Number(value) || 0)] as const);
  const countedDuplicates = counted.filter(([, count]) => count >= 2).map(([name, count]) => `${name} drawn ${count} times`);
  const duplicates = [...list(data.duplicates), ...countedDuplicates].slice(0, 6);
  const countedVisible = counted.filter(([, count]) => count >= 1).length;
  return {
    anatomyDefects: list(data.anatomyDefects),
    animalFeaturesOnHumans: list(data.animalFeaturesOnHumans),
    duplicates,
    unexpectedCharacters: list(data.unexpectedCharacters),
    roleSwaps: list(data.roleSwaps),
    elementMisuse: list(data.elementMisuse),
    featureBleed: list(data.featureBleed),
    textVisible: data.textVisible === true,
    referenceSheetVisible: data.referenceSheetVisible === true,
    identityMatch: unit(data.identityMatch),
    sceneMatch: unit(data.sceneMatch),
    namedCharactersVisible: counted.length > 0 ? countedVisible : Math.max(0, Math.round(Number(data.namedCharactersVisible) || 0)),
  };
}

/** 0 = clean. Anything >= 10 is a defect worth one regeneration. */
export function qaSeverity(report: ImageQaReport | undefined, expectedCharacters: number): number {
  if (!report) return 0;
  let severity = 0;
  severity += report.anatomyDefects.length * 10;
  severity += report.animalFeaturesOnHumans.length * 10;
  severity += report.duplicates.length * 10;
  // Logged, not regenerated: a 4-step render rarely fixes who-does-what on a
  // second try (batch 2026-09-28: 5-8 of 8 pictures redrawn for this alone).
  severity += report.roleSwaps.length * 4;
  severity += (report.elementMisuse?.length || 0) * 10;
  severity += (report.featureBleed?.length || 0) * 10;
  // Story 76dc3218 page 2: two unexplained boys behind the heroes read as
  // copies of them. Alone not a redraw (5), together with anything else it is.
  severity += Math.min(report.unexpectedCharacters.length, 2) * 5;
  if (report.referenceSheetVisible) severity += 12;
  if (report.textVisible) severity += 6;
  if (report.identityMatch < 0.4) severity += 6;
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
  if (report.unexpectedCharacters.length) fixes.push("Only the named characters — no additional children or people in the background.");
  if (report.featureBleed?.length) fixes.push(`Every character keeps only its own face and outfit — the children have smooth faces without facial hair: ${report.featureBleed.slice(0, 2).join("; ")}.`);
  if (report.roleSwaps.length) fixes.push(`Keep the roles exactly as described: ${report.roleSwaps.slice(0, 2).join("; ")}.`);
  if (report.elementMisuse?.length) fixes.push(`Draw the story element as its own thing exactly as described: ${report.elementMisuse.slice(0, 2).join("; ")}.`);
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
    const elements = (input.illustrations.storyElements || []).filter((element) => shot.elements?.includes(element.name));
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
        const base = assembleImagePrompt({ scene: shot.scene, onStage: drawn, spriteOrder: sheet, elements });
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
            user: buildQaPrompt(drawn, shot.scene, delivered.references.length > 0, elements),
            json: true,
            // "low": without any thinking the checker missed two Johanns and two
            // Rosalindes (story 655ef79b). A little counting costs ~$0.0002.
            maxTokens: 3000,
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
