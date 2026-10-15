/**
 * Testfiguren: zwei Held:innen (Avatar-Porträts mit dem echten Avatar-Rezept erzeugt) und sechs Pool-Figuren
 * mit ihren echten Porträts. Dazu die zwei Referenz-Aufbereitungen, die einmal pro Figur entstehen
 * (Kanon-Karte und Freisteller).
 */
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { castAppearance, speciesFromProfile, type VisualEntity } from "../../../backend/story/storybook/illustration-stage";
import { Budget, ensureDir, generate, removeBackground, ROOT } from "./core";
import { buildRequest, byKey } from "./models";

const PROXY = "https://backend-2-production-3de1.up.railway.app/story/image?key=";
const toUrl = (stored: string) => {
  const match = stored.match(/^bucket:\/\/[^/]+\/(.+)$/);
  return match ? PROXY + encodeURIComponent(match[1]) : stored;
};

export interface Figure extends VisualEntity {
  portrait: Buffer;
  /** Das Porträt vor einer Umzeichnung in einen anderen Stil; der Judge vergleicht immer gegen dieses. */
  original?: Buffer;
  /** Kanon-Karte: ganze Figur, neutrale Pose, weißer Grund (einmal erzeugt). */
  canon?: Buffer;
  /** Freisteller des Porträts auf Weiß. */
  cutout?: Buffer;
}

interface PoolSpec {
  id: string;
  tag: string;
}
const POOL: PoolSpec[] = [
  { id: "88164878", tag: "tall man with round glasses and brown vest" },
  { id: "696c0208", tag: "round man in a patterned vest" },
  { id: "f738e1ed", tag: "small white cloud with a rainbow scarf" },
  { id: "7cd7c99a", tag: "fox with round glasses" },
  { id: "7ae55808", tag: "small green dragon" },
  { id: "5cba02d9", tag: "old witch in a black robe" },
];

const HEROES = [
  { id: "hero-alexander", name: "Alexander", appearance: "boy, messy brown hair, green eyes, slightly protruding ears, light green t-shirt, blue jeans", tag: "brown-haired boy in a light green t-shirt" },
  { id: "hero-adrian", name: "Adrian", appearance: "boy, blond hair, blue eyes, grey-green t-shirt, jeans", tag: "blond boy in a grey-green t-shirt" },
];

/** Das Rezept aus backend/ai/avatar-generation.ts (buildAvatarPrompt), ohne Persönlichkeitszeile. */
function avatarPrompt(appearance: string): string {
  return [
    "Hand-inked European children's storybook watercolor portrait",
    "SUBJECT human (human with no animal traits)",
    `APPEARANCE ${appearance}`,
    "STYLE classic hand-inked watercolor storybook charm, expressive features, cozy color harmony",
    "COMPOSITION centered waist-up portrait, gentle three-quarter angle, direct eye contact",
    "LIGHTING warm morning rim light, soft bounced fill",
    "BACKGROUND soft storybook wash, subtle gouache texture, no text",
    "QUALITY child-safe, clean ink outlines, traditional watercolor pigments, no photographic artifacts",
  ].join(". ");
}

const dataUri = (buffer: Buffer) => `data:image/jpeg;base64,${buffer.toString("base64")}`;

export async function loadRoster(budget: Budget): Promise<Figure[]> {
  const dir = join(ROOT, "roster");
  await ensureDir(dir);
  const pool: any[] = JSON.parse(await readFile("Logs/talea-characters-2026-08-10T08-13-38-438Z.json", "utf8"));
  const figures: Figure[] = [];

  for (const hero of HEROES) {
    const file = join(dir, `${hero.id}.jpg`);
    // Genau wie produktiv: FLUX.2 klein 4B, 1024², 4 Schritte, CFG 4.
    const result = await generate(
      buildRequest(byKey("klein4"), { prompt: avatarPrompt(hero.appearance), refs: [], seed: 7, size: 1024 }),
      file,
      budget,
    );
    if (!result.file) throw new Error(`hero portrait ${hero.name}: ${result.error}`);
    figures.push({
      id: hero.id, name: hero.name, kind: "character", role: "hero", species: "human", isHuman: true,
      appearance: hero.appearance, tag: hero.tag, forbidden: [], portrait: await readFile(file),
    });
  }

  for (const spec of POOL) {
    const row = pool.find((candidate) => candidate.id.startsWith(spec.id) && candidate.imageUrl);
    if (!row) throw new Error(`pool character ${spec.id} not found`);
    const file = join(dir, `${row.id}.jpg`);
    let buffer: Buffer;
    try {
      buffer = await readFile(file);
    } catch {
      const response = await fetch(toUrl(row.imageUrl), { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`portrait download ${row.name}: HTTP ${response.status}`);
      buffer = await sharp(Buffer.from(await response.arrayBuffer())).rotate().jpeg({ quality: 92 }).toBuffer();
      await writeFile(file, buffer);
    }
    const { species, isHuman } = speciesFromProfile(row.visualProfile, row.species_category);
    figures.push({
      id: row.id, name: row.name, kind: "character", role: "cast", species, isHuman,
      appearance: castAppearance(row.visualProfile, row.physical_description), tag: spec.tag, forbidden: [], portrait: buffer,
    });
  }
  return figures;
}

/**
 * Kanon-Karte: das Porträt dient als Referenz, heraus kommt dieselbe Figur ganz, in neutraler Pose, vor Weiß.
 * Kostet einmal pro Figur ≈ 0,2 ¢ und entfernt Szenerie und Pose des Porträts aus der Referenz.
 */
export async function ensureCanon(figure: Figure, budget: Budget): Promise<Buffer> {
  if (figure.canon) return figure.canon;
  const file = join(ROOT, "roster", `${figure.id}-canon.jpg`);
  const prompt = [
    `Character reference card of ${figure.name}: ${figure.appearance}.`,
    "The whole figure from head to toe, standing relaxed and facing the viewer in a neutral pose, centred on a plain pure white background with nothing else in the picture.",
    "Exactly the same face, hair or fur, skin, species, clothes and colours as the attached portrait, in the same soft watercolour and coloured-pencil picture-book style. One figure only.",
  ].join(" ");
  const result = await generate(
    { ...buildRequest(byKey("klein9"), { prompt, refs: [dataUri(await sharp(figure.portrait).resize(512, 512, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer())], seed: 11, size: 1024 }), width: 768, height: 1024 },
    file,
    budget,
  );
  if (!result.file) throw new Error(`canon card ${figure.name}: ${result.error}`);
  figure.canon = await readFile(result.file);
  return figure.canon;
}

/** Freisteller: Runware birefnet entfernt den Hintergrund, danach auf Weiß gelegt. */
export async function ensureCutout(figure: Figure, budget: Budget): Promise<Buffer> {
  if (figure.cutout) return figure.cutout;
  const file = join(ROOT, "roster", `${figure.id}-cutout.jpg`);
  try {
    figure.cutout = await readFile(file);
    return figure.cutout;
  } catch {
    // neu erzeugen
  }
  const png = await removeBackground(dataUri(await sharp(figure.portrait).resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 92 }).toBuffer()), budget);
  figure.cutout = await sharp(png).flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer();
  await writeFile(file, figure.cutout);
  return figure.cutout;
}

/**
 * Stilwechsel-Test: zeichnet das Porträt in einem anderen Stil neu (gleiche Figur, anderer Look) und nimmt es als Referenz.
 * So lässt sich messen, was eine Stilumstellung kostet: Pool-Porträts neu erzeugen ≈ 0,2 ¢ je Figur.
 */
export async function restylePortrait(figure: Figure, style: { key: string; text: string }, budget: Budget): Promise<Buffer> {
  const file = join(ROOT, "roster", `${figure.id}-restyle-${style.key}.jpg`);
  const prompt = [
    `Redraw this character portrait of ${figure.name}: ${figure.appearance}.`,
    style.text.replace(/,?s*one full-bleed scene.?/i, "."),
    "Exactly the same face, hair or fur, species, clothes and colours as the attached portrait, the same waist-up pose, a plain soft pale background, one figure only. No text.",
  ].join(" ");
  const source = await sharp(figure.original ?? figure.portrait).resize(512, 512, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
  const result = await generate(buildRequest(byKey("klein9"), { prompt, refs: [dataUri(source)], seed: 13, size: 1024 }), file, budget);
  if (!result.file) throw new Error(`restyle ${figure.name} (${style.key}): ${result.error}`);
  return readFile(result.file);
}

export const figureById = (figures: Figure[], key: string): Figure => {
  const found = figures.find((figure) => figure.id.startsWith(key) || figure.name.toLowerCase().startsWith(key.toLowerCase()));
  if (!found) throw new Error(`figure "${key}" not in roster`);
  return found;
};
