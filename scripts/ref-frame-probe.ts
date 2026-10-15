/**
 * Probe: neutral identity sheet (storybook today) vs. colour-framed sheet (the old standard pipeline).
 *   bun --env-file=.env.local run scripts/ref-frame-probe.ts
 * Same scenes, same seeds, same prompt builder; only the sheet and its sentence in the prompt differ.
 */
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { encodeReferenceSprite, renderIdentitySprite } from "../backend/story/image-reference-sprite";
import { assembleImagePrompt, negativePromptFor, type VisualEntity } from "../backend/story/storybook/illustration-stage";

const key = process.env.RUNWARE_API_KEY || process.env.RunwareApiKey || "";
if (!key) throw new Error("RUNWARE_API_KEY missing");
const PROXY = "https://backend-2-production-3de1.up.railway.app/story/image?key=";
const out = "Logs/book-v1/frame-probe";
await mkdir(out, { recursive: true }).catch(() => undefined);

const pool: any[] = JSON.parse(await readFile("Logs/talea-characters-2026-08-10T08-13-38-438Z.json", "utf8"));
const toUrl = (stored: string) => { const m = stored.match(/^bucket:\/\/[^/]+\/(.+)$/); return m ? PROXY + encodeURIComponent(m[1]) : stored; };
const byId = (id: string) => pool.find((row) => row.id === id);
const FRAMES = [{ name: "purple", hex: "#8B5CF6" }, { name: "green", hex: "#22C55E" }, { name: "blue", hex: "#3B82F6" }, { name: "orange", hex: "#F97316" }];

function entity(id: string, species: string, isHuman: boolean): VisualEntity & { buffer?: Buffer } {
  const row = byId(id);
  return { id, name: row.name, kind: "character", role: "cast", species, isHuman, appearance: String(row.physical_description || ""), forbidden: [], referenceUrl: toUrl(row.imageUrl) } as any;
}
const kuno = entity("42e27e23-3da1-4c22-8774-e4b310c6b3cd", "human", true);
const wuschel = entity("f738e1ed-4bf7-4a36-8d28-f289075c469e", "cloud", false);
const seitenflug = entity("88164878-35e4-4417-ac74-ee104c7366d3", "human", true);
const gustav = entity("696c0208-7116-4e47-b04d-f289f525c3e8", "human", true);

const buffers = new Map<string, Buffer>();
for (const e of [kuno, wuschel, seitenflug, gustav]) buffers.set(e.id, Buffer.from(await (await fetch(e.referenceUrl!)).arrayBuffer()));

async function neutral(cast: VisualEntity[]): Promise<string> {
  const png = await renderIdentitySprite(cast.map((e) => buffers.get(e.id)!));
  return `data:image/jpeg;base64,${(await encodeReferenceSprite(png)).toString("base64")}`;
}
async function framed(cast: VisualEntity[]): Promise<string> {
  const cell = Math.min(512, Math.floor(2048 / cast.length / 16) * 16);
  const border = 10;
  const tiles = await Promise.all(cast.map(async (e, index) => {
    const { hex } = FRAMES[index];
    const inner = await sharp(buffers.get(e.id)!).rotate().resize(cell - border * 2, cell - border * 2, { fit: "cover" }).png().toBuffer();
    return sharp({ create: { width: cell, height: cell, channels: 3, background: hex } }).composite([{ input: inner, left: border, top: border }]).png().toBuffer();
  }));
  const png = await sharp({ create: { width: cell * tiles.length, height: cell, channels: 3, background: "#ffffff" } })
    .composite(tiles.map((input, index) => ({ input, left: index * cell, top: 0 }))).png().toBuffer();
  return `data:image/jpeg;base64,${(await encodeReferenceSprite(png)).toString("base64")}`;
}

/** The framed variant names each figure's coloured cell instead of only its place. */
function framedPrompt(prompt: string, cast: VisualEntity[]): string {
  let text = prompt;
  cast.forEach((e, index) => { text = text.replace(new RegExp(`, ${["first", "second", "third", "fourth"][index]} on the identity sheet`), `, in the ${FRAMES[index].name}-framed cell of the identity sheet`); });
  return text.replace(/The attached image is only an identity sheet[^\n]*/, `The attached image is only an identity sheet, not part of the picture: left to right ${cast.map((e, i) => `${e.name} (${FRAMES[i].name}-framed cell)`).join(", ")}. Take each figure's face, hair or fur, colours and outfit from its own framed cell — the identities, not the sheet's painting style, not its coloured frames — and draw one single scene without any frame or border.`);
}

const scenes: Array<{ id: string; text: string; cast: VisualEntity[] }> = [
  { id: "s1-reading-room", text: "A cosy village reading room in warm afternoon light. Herr Seitenflug points at a tiny paper boat hovering above an open book on a wooden table, Kuno Knopf measures the boat with a tape, and the small cloud Wuschel floats beside them over a cushion.", cast: [kuno, wuschel, seitenflug] },
  { id: "s2-market", text: "A sunny market square. Händler Gustav carries a crate of flower pots while Kuno Knopf holds up a patched cloth and laughs.", cast: [gustav, kuno] },
  { id: "s3-four", text: "A long table at a village festival under lanterns. Herr Seitenflug passes a bowl of apples, Händler Gustav bargains, Kuno Knopf pins a ribbon on a hat and the cloud Wuschel rains a few drops on the cake.", cast: [seitenflug, gustav, kuno, wuschel] },
];

async function run(label: string, prompt: string, negative: string, sheet: string, seed: number): Promise<{ file: string; cost: number }> {
  const body: any = {
    taskType: "imageInference", taskUUID: crypto.randomUUID(), model: "runware:400@2", numberResults: 1, outputType: ["URL"], outputFormat: "JPEG",
    width: 1024, height: 1024, steps: 4, CFGScale: 4, includeCost: true, checkNSFW: true, acceleration: "high", seed,
    positivePrompt: prompt, negativePrompt: negative, inputs: { referenceImages: [sheet] },
  };
  const res = await fetch("https://api.runware.ai/v1", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify([body]) });
  const data: any = await res.json();
  const item = data?.data?.[0];
  if (!item?.imageURL) throw new Error(`${label}: ${JSON.stringify(data).slice(0, 200)}`);
  const file = join(out, `${label}.jpg`);
  await writeFile(file, Buffer.from(await (await fetch(item.imageURL)).arrayBuffer()));
  return { file, cost: item.cost };
}

let total = 0;
for (const scene of scenes) {
  const base = assembleImagePrompt({ scene: scene.text, onStage: scene.cast, spriteOrder: scene.cast });
  const negative = negativePromptFor(scene.cast, true);
  const sheets = { neutral: await neutral(scene.cast), framed: await framed(scene.cast) };
  await writeFile(join(out, `${scene.id}-prompt-neutral.txt`), base);
  await writeFile(join(out, `${scene.id}-prompt-framed.txt`), framedPrompt(base, scene.cast));
  await writeFile(join(out, `${scene.id}-sheet-neutral.jpg`), Buffer.from(sheets.neutral.split(",")[1], "base64"));
  await writeFile(join(out, `${scene.id}-sheet-framed.jpg`), Buffer.from(sheets.framed.split(",")[1], "base64"));
  const files: Record<string, string> = {};
  for (const seed of [21, 22, 23]) {
    for (const variant of ["neutral", "framed"] as const) {
      const prompt = variant === "neutral" ? base : framedPrompt(base, scene.cast);
      const result = await run(`${scene.id}-${variant}-${seed}`, prompt, negative, sheets[variant], seed);
      total += result.cost;
      files[`${variant}-${seed}`] = result.file;
      console.log(`${scene.id} ${variant} seed ${seed} $${result.cost}`);
    }
  }
  // Montage: row 1 neutral (3 seeds), row 2 framed (3 seeds), 480 px each.
  const size = 480;
  const tiles: Array<{ input: Buffer; left: number; top: number }> = [];
  for (const [row, variant] of (["neutral", "framed"] as const).entries()) {
    for (const [col, seed] of [21, 22, 23].entries()) {
      tiles.push({ input: await sharp(files[`${variant}-${seed}`]).resize(size, size).jpeg({ quality: 88 }).toBuffer(), left: col * size, top: row * size });
    }
  }
  await sharp({ create: { width: size * 3, height: size * 2, channels: 3, background: "#ffffff" } }).composite(tiles).jpeg({ quality: 88 }).toFile(join(out, `${scene.id}-montage.jpg`));
}
console.log(`total $${total.toFixed(4)}`);
