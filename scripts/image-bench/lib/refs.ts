/**
 * Referenz-Strategien: WIE die Figurenbilder ins Modell kommen.
 *
 *   none          keine Referenz, Identität nur im Text (Kontrolle)
 *   hero-only     nur die Held:innen kommen aufs Blatt, alle anderen Figuren nur als Text (so zeichnet die Produktion nach einer Tier-Merkmal-Panne neu)
 *   sprite        EIN neutraler Streifen aller Figuren, 512-px-Zellen (heute produktiv)
 *   sprite768     wie sprite, aber 768-px-Zellen (mehr Gesichtsdetail, größeres Eingabebild)
 *   grid          Raster statt Streifen (2×2 bei 3–4 Figuren), quadratisch
 *   multi         jede Figur als eigenes Referenzbild; der Prompt sagt „image 1“, „image 2“ …
 *   canon-sprite  Streifen aus Kanon-Karten (ganze Figur, weißer Grund) statt Porträts
 *   canon-multi   Kanon-Karten als einzelne Referenzbilder
 *   cutout-sprite Streifen aus freigestellten Porträts (Szenerie des Porträts entfernt)
 *   cutout-multi  freigestellte Porträts als einzelne Referenzbilder
 */
import sharp from "sharp";
import { encodeReferenceSprite, renderIdentitySprite, renderSingleReference } from "../../../backend/story/image-reference-sprite";
import type { Budget } from "./core";
import { ensureCanon, ensureCutout, type Figure } from "./roster";
import type { ModelProfile } from "./models";

export const REF_STRATEGIES = ["none", "hero-only", "sprite", "sprite768", "grid", "multi", "canon-sprite", "canon-multi", "cutout-sprite", "cutout-multi"] as const;
export type RefStrategy = (typeof REF_STRATEGIES)[number];

export interface BuiltRefs {
  images: string[];
  /** none = keine Referenz; single = ein Bild einer Figur; sheet = mehrere Figuren in EINEM Bild; multi = je Figur ein Bild */
  mode: "none" | "single" | "sheet" | "multi";
  /** Reihenfolge der Figuren in den Pixeln (links→rechts bzw. Bildnummer). */
  order: Figure[];
  layout: "strip" | "grid" | "single" | "multi" | "none";
}

const asData = (buffer: Buffer) => `data:image/jpeg;base64,${buffer.toString("base64")}`;

async function cellOf(buffer: Buffer, cell: number): Promise<Buffer> {
  return sharp(buffer, { limitInputPixels: 40_000_000 }).rotate().resize(cell, cell, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).png().toBuffer();
}

/** Raster aus quadratischen Zellen, auf ein Quadrat aufgefüllt. */
async function renderGrid(buffers: Buffer[], cell: number): Promise<Buffer> {
  const columns = Math.ceil(Math.sqrt(buffers.length));
  const rows = Math.ceil(buffers.length / columns);
  const side = Math.max(columns, rows) * cell;
  const tiles = await Promise.all(buffers.map((buffer) => cellOf(buffer, cell)));
  return sharp({ create: { width: side, height: side, channels: 3, background: "#ffffff" } })
    .composite(tiles.map((input, index) => ({ input, left: (index % columns) * cell, top: Math.floor(index / columns) * cell })))
    .png().toBuffer();
}

const sources = async (strategy: RefStrategy, figures: Figure[], budget: Budget): Promise<Buffer[]> => {
  if (strategy.startsWith("canon")) return Promise.all(figures.map((figure) => ensureCanon(figure, budget)));
  if (strategy.startsWith("cutout")) return Promise.all(figures.map((figure) => ensureCutout(figure, budget)));
  return figures.map((figure) => figure.portrait);
};

export async function buildRefs(strategy: RefStrategy, onStage: Figure[], model: ModelProfile, budget: Budget): Promise<BuiltRefs> {
  const characters = onStage.filter((figure) => figure.kind === "character");
  const figures = strategy === "hero-only" ? characters.filter((figure) => figure.role === "hero") : characters;
  if (strategy === "none" || figures.length === 0) return { images: [], mode: "none", order: [], layout: "none" };
  const buffers = await sources(strategy, figures, budget);

  if (figures.length === 1) {
    const single = await encodeReferenceSprite(await renderSingleReference(buffers[0]));
    return { images: [asData(single)], mode: "single", order: figures, layout: "single" };
  }

  const wantsMulti = strategy === "multi" || strategy.endsWith("-multi");
  if (wantsMulti && figures.length <= model.maxRefs) {
    const images = await Promise.all(buffers.map(async (buffer) => asData(await encodeReferenceSprite(await renderSingleReference(buffer)))));
    return { images, mode: "multi", order: figures, layout: "multi" };
  }

  // Modelle ohne Breite/Höhe (Boogu, Muse) liefern ein Bild in der Form der Referenz → immer quadratisches Blatt.
  const squareSheet = strategy === "grid" || !model.dims;
  if (squareSheet) {
    const png = await renderGrid(buffers, strategy === "sprite768" ? 768 : 512);
    return { images: [asData(await encodeReferenceSprite(png))], mode: "sheet", order: figures, layout: "grid" };
  }
  if (strategy === "sprite768") {
    const cell = Math.min(768, Math.floor(3072 / figures.length / 16) * 16);
    const tiles = await Promise.all(buffers.map((buffer) => cellOf(buffer, cell)));
    const png = await sharp({ create: { width: cell * tiles.length, height: cell, channels: 3, background: "#ffffff" } })
      .composite(tiles.map((input, index) => ({ input, left: index * cell, top: 0 }))).png().toBuffer();
    return { images: [asData(await encodeReferenceSprite(png))], mode: "sheet", order: figures, layout: "strip" };
  }
  const png = await renderIdentitySprite(buffers);
  return { images: [asData(await encodeReferenceSprite(png))], mode: "sheet", order: figures, layout: "strip" };
}

/** Das Blatt, das der Judge sieht: immer die Original-Porträts, damit alle Varianten gleich gemessen werden. */
export async function judgeSheet(figures: Figure[]): Promise<Buffer> {
  const originals = figures.map((figure) => figure.original ?? figure.portrait);
  const png = figures.length === 1 ? await renderSingleReference(originals[0]) : await renderIdentitySprite(originals);
  return encodeReferenceSprite(png);
}
