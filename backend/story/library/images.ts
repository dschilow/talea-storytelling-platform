/**
 * Library pictures with FLUX 3 Image Klein on Runware (`bfl:flux@3-image-klein`,
 * live since 2026-10-15). Encore-free so the seed script and the admin
 * pipeline draw with exactly the same code.
 *
 * Model facts (Runware schema + probe 2026-10-19): up to 4 reference images,
 * no negative prompt, no CFG (Runware answers 400 "unsupportedParameter" for
 * CFGScale), width/height multiples of 16, ~$0.006–0.009 per 1 MP picture.
 *
 * Series characters always travel as ONE reference sheet (user rule: a
 * collage, never separate files): portraits side by side on white, ordered
 * like the names in the prompt, sent inline as a JPEG data URI (a URL makes
 * Runware download from our proxy and costs 2–3x).
 */

import { encodeReferenceSprite, renderIdentitySprite, renderSingleReference } from "../image-reference-sprite";
import type { EpisodeGuest, ImageSlot, SeriesCharacter } from "./types";
import { TALEA_IMAGE_STYLE } from "../../ai/image-style";

export const LIBRARY_IMAGE_MODEL = "bfl:flux@3-image-klein";
export const LIBRARY_IMAGE_STEPS = 16;
/** The style shared by the Originals seed series and Talea-Folge. */
export const ORIGINALS_IMAGE_STYLE = TALEA_IMAGE_STYLE;
/** Landscape pictures for covers and chapters (3:2-ish, ~1 MP). */
export const SCENE_SIZE = { width: 1216, height: 832 } as const;
export const PORTRAIT_SIZE = { width: 768, height: 768 } as const;
/** The model reads at most four references; one sheet carries at most four figures so faces stay large. */
export const MAX_FIGURES_ON_SHEET = 4;

export interface Figure {
  id: string;
  name: string;
  visualProfileEn: string;
  referenceUrl?: string;
}

export interface RunwareImageTask {
  taskType: "imageInference";
  taskUUID: string;
  model: string;
  positivePrompt: string;
  width: number;
  height: number;
  steps: number;
  seed: number;
  outputType: ["URL"];
  outputFormat: "WEBP";
  includeCost: true;
  inputs?: { referenceImages: string[] };
  settings?: {
    boundingBoxes: Array<{ id: string; description: string; referenceIndex: number; sourceBox: [number, number, number, number]; targetBox: [number, number, number, number] }>;
  };
}

export interface DrawnImage {
  imageUrl: string;
  costUSD: number;
  seed: number;
  prompt: string;
  referenceCount: number;
}

/** Runs one Runware task. Production plugs in the secret-backed caller, scripts their env key. */
export type RunwareCaller = (task: RunwareImageTask) => Promise<{ imageURL: string; cost?: number; seed?: number }>;
/** Returns the bytes of a reference picture (public seed path, bucket URL …). */
export type ReferenceLoader = (url: string) => Promise<Buffer>;

export function figuresFor(ids: string[], characters: SeriesCharacter[], guests: EpisodeGuest[]): Figure[] {
  const figures: Figure[] = [];
  for (const id of ids) {
    const character = characters.find((entry) => entry.id === id);
    if (character) {
      figures.push({ id, name: shortName(character.name), visualProfileEn: character.visualProfileEn, referenceUrl: character.referenceStripKey || undefined });
      continue;
    }
    const guest = guests.find((entry) => entry.id === id);
    if (guest) figures.push({ id, name: guest.name, visualProfileEn: guest.visualProfileEn, referenceUrl: guest.referenceUrl || undefined });
  }
  return figures;
}

/** "Ella Brandt" → "Ella", "Der Mann mit dem Fischhut" stays whole. */
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length === 2 && /^[A-ZÄÖÜ]/.test(parts[1]) && !/^(Der|Die|Das|Oma|Opa|Frau|Herr|Kater|Mama|Papa)$/.test(parts[0]) ? parts[0] : name.trim();
}

const SHEET_RULE =
  "The attached reference sheet only says who is who: copy each figure's face or head, species, hair or fur, colours, proportions and clothes from it " +
  "(unless the scene names other clothes), never its white background, its side-by-side layout or its poses. One continuous full-bleed illustration, the setting reaches every edge.";

/**
 * Doubles were the main defect of the first seed run (2026-10-19: a second
 * tomcat, a second Mats on the dog, two fish tanks) — the sheet figure plus the
 * scene's figure. Naming the exact head count, positively, is the cheapest guard.
 */
function headCountLine(figures: Figure[]): string {
  if (!figures.length) return "";
  const names = figures.map((figure) => figure.name);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return figures.length === 1
    ? `${list} appears exactly once in the picture.`
    : `Exactly ${figures.length} characters appear in the picture, each of them only once: ${list}.`;
}

/**
 * "Standing" in the first portrait prompt gave the goldfish two little feet
 * (seed run 2026-10-19). The pose now follows the creature: whatever it is,
 * shown the way it naturally is.
 */
export function buildPortraitPrompt(_style: string, figure: Pick<Figure, "visualProfileEn">): string {
  return [
    `Character reference picture: ${figure.visualProfileEn}.`,
    "The whole figure is visible in the calm, natural pose of what it is, three-quarter view, centered with space around it, alone on a plain pure white background.",
    `${TALEA_IMAGE_STYLE}.`,
  ].join(" ");
}

/**
 * Picture books never pose their cast for a photo (user review 2026-10-19:
 * "die Charaktere schauen doch nicht sonst in die Kamera"). Every picture is a
 * moment of the plot, said positively: this model has no negative prompt.
 */
export const ACTION_RULE =
  "A storybook moment caught in the middle of the action, like a frame from an animated film: every character is busy with what happens, " +
  "eyes on each other or on the event inside the picture, bodies turned in side or three-quarter view and caught mid-movement.";

/** Scene text names figures as [id]; with boxes they become <token>s the model binds to a sheet cell, otherwise plain names. */
export function boxToken(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]/g, "") || "figure";
}

function resolveSceneTokens(scene: string, figures: Figure[], boxed: Set<string>): string {
  return scene.replace(/\[([a-z0-9-]+)\]/gi, (match, id: string) => {
    const figure = figures.find((entry) => entry.id === id);
    if (!figure) return match.slice(1, -1);
    return boxed.has(figure.id) ? `<${boxToken(figure.id)}>` : figure.name;
  });
}

/**
 * Scene first (the moment matters most), style right after it (otherwise a
 * portrait's look wins), then who is who on the sheet. Positive wording only:
 * this model has no negative prompt, and naming a defect draws it.
 */
export function buildScenePrompt(
  scene: string,
  _style: string,
  sheetFigures: Figure[],
  textOnlyFigures: Figure[] = [],
  outfits: Record<string, string> = {},
  boxedIds: Set<string> = new Set(),
): string {
  // A scene may dress a figure differently (pyjamas at midnight): the look
  // keeps face, hair and body from the sheet, the clothes come from the scene.
  const look = (figure: Figure) =>
    outfits[figure.id] ? `same face, hair and body as on the sheet, but here wearing ${outfits[figure.id]}` : figure.visualProfileEn;
  const all = [...sheetFigures, ...textOnlyFigures];
  const sceneText = resolveSceneTokens(scene.trim().replace(/\.$/, ""), all, boxedIds);
  const lines = [`${sceneText}.`, ACTION_RULE, `${TALEA_IMAGE_STYLE}.`];
  // A boxed figure the scene never mentions still needs its token once, or the box has nothing to bind to.
  for (const figure of sheetFigures) {
    if (boxedIds.has(figure.id) && !sceneText.includes(`<${boxToken(figure.id)}>`)) lines.push(`<${boxToken(figure.id)}> is ${figure.name}.`);
  }
  if (sheetFigures.length === 1) {
    lines.push(`${sheetFigures[0].name} looks exactly like the figure on the reference picture: ${look(sheetFigures[0])}.`);
  } else if (sheetFigures.length > 1) {
    lines.push(
      `The reference sheet shows ${sheetFigures.length} figures from left to right: ` +
        sheetFigures.map((figure, index) => `${index + 1}. ${figure.name} (${look(figure)})`).join("; ") + "."
    );
  }
  for (const figure of textOnlyFigures) lines.push(`${figure.name}: ${outfits[figure.id] ? `${figure.visualProfileEn}, here wearing ${outfits[figure.id]}` : figure.visualProfileEn}.`);
  lines.push(headCountLine(all));
  if (sheetFigures.length) lines.push(SHEET_RULE);
  return lines.filter(Boolean).join("\n");
}

type Box = [number, number, number, number];

function validBox(value: unknown): value is Box {
  return Array.isArray(value) && value.length === 4 && value.every((n) => Number.isFinite(n) && n >= 0 && n <= 1000) &&
    value[0] < value[2] && value[1] < value[3];
}

/**
 * FLUX 3 Klein can take an element from a region of a reference and place it
 * in a region of the picture. With ONE sheet (cells of equal width, side by
 * side) every figure is lifted from its own cell into its own spot. Probe
 * 2026-10-19 (tomcat in the basket): 2/2 clean with boxes, 2/2 doubled without.
 */
export function boundingBoxesFor(sheetFigures: Figure[], boxes: Record<string, number[]> | undefined) {
  if (!boxes || !sheetFigures.length) return [];
  const cell = 1000 / sheetFigures.length;
  return sheetFigures.flatMap((figure, index) => {
    const target = boxes[figure.id];
    if (!validBox(target)) return [];
    return [{
      id: boxToken(figure.id),
      description: figure.name,
      referenceIndex: 0,
      sourceBox: [0, Math.round(index * cell), 1000, Math.round((index + 1) * cell)] as Box,
      targetBox: target.map((n) => Math.round(n)) as Box,
    }];
  });
}

export async function buildReferenceSheet(figures: Figure[], load: ReferenceLoader): Promise<string | null> {
  const withPictures = figures.filter((figure) => figure.referenceUrl);
  if (!withPictures.length) return null;
  const buffers = await Promise.all(withPictures.map((figure) => load(figure.referenceUrl!)));
  const png = buffers.length === 1 ? await renderSingleReference(buffers[0]) : await renderIdentitySprite(buffers);
  const jpeg = await encodeReferenceSprite(png);
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

export function buildRunwareTask(input: { prompt: string; width: number; height: number; seed?: number; steps?: number; referenceImages?: string[] }): RunwareImageTask {
  return {
    taskType: "imageInference",
    taskUUID: crypto.randomUUID(),
    model: LIBRARY_IMAGE_MODEL,
    positivePrompt: input.prompt,
    width: input.width,
    height: input.height,
    steps: input.steps ?? LIBRARY_IMAGE_STEPS,
    seed: input.seed ?? Math.floor(Math.random() * 2_147_483_647),
    outputType: ["URL"],
    outputFormat: "WEBP",
    includeCost: true,
    ...(input.referenceImages?.length ? { inputs: { referenceImages: input.referenceImages.slice(0, 4) } } : {}),
  };
}

export async function drawPortrait(figure: Figure, style: string, call: RunwareCaller, seed?: number): Promise<DrawnImage> {
  const prompt = buildPortraitPrompt(style, figure);
  const task = buildRunwareTask({ prompt, ...PORTRAIT_SIZE, seed });
  const result = await call(task);
  return { imageUrl: result.imageURL, costUSD: Number(result.cost) || 0, seed: result.seed ?? task.seed, prompt, referenceCount: 0 };
}

export async function drawScene(
  slot: ImageSlot,
  context: { style: string; characters: SeriesCharacter[]; guests: EpisodeGuest[]; load: ReferenceLoader; call: RunwareCaller; seed?: number },
): Promise<DrawnImage> {
  const figures = figuresFor(slot.characterIds, context.characters, context.guests);
  const sheetFigures = figures.filter((figure) => figure.referenceUrl).slice(0, MAX_FIGURES_ON_SHEET);
  const textOnly = figures.filter((figure) => !sheetFigures.includes(figure));
  const sheet = await buildReferenceSheet(sheetFigures, context.load);
  const boundingBoxes = sheet ? boundingBoxesFor(sheetFigures, slot.boxes) : [];
  const boxedIds = new Set(boundingBoxes.map((box) => sheetFigures.find((figure) => boxToken(figure.id) === box.id)!.id));
  const prompt = buildScenePrompt(slot.sceneEn, context.style, sheet ? sheetFigures : [], sheet ? textOnly : figures, slot.outfits, boxedIds);
  const task: RunwareImageTask = {
    ...buildRunwareTask({ prompt, ...SCENE_SIZE, seed: context.seed, referenceImages: sheet ? [sheet] : [] }),
    ...(boundingBoxes.length ? { settings: { boundingBoxes } } : {}),
  };
  const result = await context.call(task);
  return { imageUrl: result.imageURL, costUSD: Number(result.cost) || 0, seed: result.seed ?? task.seed, prompt, referenceCount: sheet ? 1 : 0 };
}

/** HTTP caller with the usual Runware retry (429 / 5xx with backoff). */
export function createRunwareCaller(apiKey: string, fetcher: typeof fetch = fetch): RunwareCaller {
  return async (task) => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetcher("https://api.runware.ai/v1", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify([task]),
        signal: AbortSignal.timeout(120_000),
      }).catch((error) => {
        lastError = error;
        return null;
      });
      if (response) {
        const json: any = await response.json().catch(() => ({}));
        const row = Array.isArray(json?.data) ? json.data[0] : null;
        if (response.ok && row?.imageURL) return { imageURL: String(row.imageURL), cost: Number(row.cost) || 0, seed: Number(row.seed) || task.seed };
        const errors = Array.isArray(json?.errors) ? json.errors : [];
        lastError = new Error(`Runware ${response.status}: ${errors.map((e: any) => e?.message || e?.code).join("; ") || "no image"}`);
        if (response.status < 500 && response.status !== 429) break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  };
}
