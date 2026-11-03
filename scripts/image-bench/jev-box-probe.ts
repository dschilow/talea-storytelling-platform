/**
 * Probe for Jev 1.14 "box" questions (OpenRouter Decisions API): asks a yes/no question and a box question per fault and
 * draws every box whose yes/no probability clears the cut onto a copy of the picture.
 *
 *   bun --env-file=.env.local run scripts/image-bench/jev-box-probe.ts --images <file|dir>[,<file|dir>] [--out <dir>] [--raw] [--cut 0.5]
 *
 * Box answers never say "not found" (TypeSafe docs): without the paired yes/no question every picture gets a box.
 */
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import sharp from "sharp";

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const cwd = process.env.INIT_CWD || process.cwd();
const out = resolve(cwd, arg("out") || "Logs/image-bench/jev-box-probe");
const raw = process.argv.includes("--raw");
const cut = Number(arg("cut") || 0.5);
const model = arg("model") || "typesafe/jev-1.14";
const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error("OPENROUTER_API_KEY missing");

/** One fault = a yes/no question (is it there?) and a box question (where?). */
const FAULTS: Record<string, { color: string; noul: string; box: string }> = {
  text: { color: "#ff2d55", noul: "The picture contains readable written words, letters or a logo.", box: "The written words, letters or logo in the picture." },
  detached: { color: "#ff9500", noul: "The picture contains a body part (a paw, hand, foot or ear) that is detached from any body and floats on its own.", box: "The body part that is detached from any body." },
  floating: { color: "#ffcc00", noul: "An object such as a boot or shoe lies or floats in the picture without belonging to anyone, out of place.", box: "The out-of-place object that belongs to nobody." },
  hybrid: { color: "#af52de", noul: "A human child in the picture has animal body parts such as a tail, scales, claws, a snout or dinosaur legs.", box: "The animal body part on the human child." },
  fused: { color: "#34c759", noul: "A character's legs or arms are fused into one shape or merge with another figure's body.", box: "The place where the bodies merge." },
};

async function listImages(): Promise<string[]> {
  const files: string[] = [];
  for (const entry of (arg("images") || "").split(",").filter(Boolean).map((p) => resolve(cwd, p))) {
    if ((await stat(entry)).isDirectory()) files.push(...(await readdir(entry)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort().map((f) => join(entry, f)));
    else files.push(entry);
  }
  return files;
}

interface Box { top: number; bottom: number; left: number; right: number }

function readBox(answer: any): Box | null {
  const box = answer?.box ?? answer;
  const edges = ["top", "bottom", "left", "right"].map((edge) => Number(box?.[edge]));
  if (edges.some((value) => !Number.isFinite(value))) return null;
  const [top, bottom, left, right] = edges;
  return { top, bottom, left, right };
}

await mkdir(out, { recursive: true });
const rows: any[] = [];
for (const file of await listImages()) {
  const jpeg = await sharp(await readFile(file)).resize(768, 768, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  const questions: Record<string, unknown> = {};
  for (const [id, fault] of Object.entries(FAULTS)) {
    questions[`${id}`] = { type: "noul", instructions: fault.noul };
    questions[`${id}_box`] = { type: "box", instructions: fault.box };
  }
  const started = Date.now();
  const response = await fetch("https://openrouter.ai/api/alpha/decisions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "TypeSafe-Danger-Zone-Images": "true", "X-OpenRouter-Title": "Talea jev box probe" },
    body: JSON.stringify({ model, state: ["Illustration from a children's book:", { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` } }], questions }),
  });
  const text = await response.text();
  if (raw) console.log(basename(file), response.status, text.slice(0, 3000));
  if (!response.ok) { console.error(basename(file), response.status, text.slice(0, 500)); continue; }
  const data = JSON.parse(text);
  const row: any = { file: basename(file), ms: Date.now() - started, costUSD: Number(data?.usage?.cost) || 0, inputTokens: data?.usage?.input_tokens, faults: {} };
  const meta = await sharp(await readFile(file)).metadata();
  const width = meta.width || 1024, height = meta.height || 1024;
  const shapes: string[] = [];
  for (const [id, fault] of Object.entries(FAULTS)) {
    const probability = Number(data?.answers?.[id]?.noul);
    const boxAnswer = data?.answers?.[`${id}_box`];
    const box = readBox(boxAnswer);
    const confidence = Number(boxAnswer?.confidence ?? data?.confidence?.[`${id}_box`]);
    row.faults[id] = { probability, box, confidence: Number.isFinite(confidence) ? confidence : undefined };
    if (!box) continue;
    const shown = probability >= cut;
    if (!shown && !process.argv.includes("--all-boxes")) continue;
    const x = box.left * width, y = box.top * height, w = (box.right - box.left) * width, h = (box.bottom - box.top) * height;
    shapes.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${fault.color}" stroke-width="${shown ? 6 : 2}" ${shown ? "" : 'stroke-dasharray="10 8" opacity="0.6"'}/>`);
    shapes.push(`<text x="${x + 6}" y="${Math.max(24, y - 8)}" font-family="Arial" font-size="24" font-weight="bold" fill="${fault.color}" stroke="black" stroke-width="1">${id} ${Math.round(probability * 100)}%</text>`);
  }
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${shapes.join("")}</svg>`);
  await sharp(await readFile(file)).composite([{ input: svg }]).jpeg({ quality: 85 }).toFile(join(out, basename(file).replace(/\.\w+$/, ".boxes.jpg")));
  rows.push(row);
  console.log(row.file, `${row.ms} ms`, `${(row.costUSD * 100).toFixed(4)} ct`, Object.entries(row.faults).map(([id, f]: any) => `${id} ${Math.round(f.probability * 100)}%${f.box ? ` [t${f.box.top.toFixed(2)} b${f.box.bottom.toFixed(2)} l${f.box.left.toFixed(2)} r${f.box.right.toFixed(2)}${f.confidence !== undefined ? ` c${f.confidence.toFixed(2)}` : ""}]` : ""}`).join("  "));
}
await writeFile(join(out, "results.json"), JSON.stringify(rows, null, 2));

// Contact sheets: 3 × 3 marked pictures per sheet, numbered, so a person can check every box by eye.
const marked = rows.map((row) => join(out, row.file.replace(/\.\w+$/, ".boxes.jpg")));
const tile = 520;
for (let sheet = 0; sheet * 9 < marked.length; sheet += 1) {
  const files = marked.slice(sheet * 9, sheet * 9 + 9);
  const tiles = await Promise.all(files.map(async (file, index) => ({
    input: await sharp(file).resize(tile, tile, { fit: "contain", background: "#fff" })
      .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="34"><rect width="${tile}" height="34" fill="black" opacity="0.7"/><text x="8" y="24" font-family="Arial" font-size="20" fill="white">${sheet * 9 + index + 1}: ${basename(file).replace(".boxes.jpg", "").slice(0, 40)}</text></svg>`), top: 0, left: 0 }])
      .jpeg().toBuffer(),
    left: (index % 3) * tile, top: Math.floor(index / 3) * tile,
  })));
  await sharp({ create: { width: tile * 3, height: tile * Math.ceil(files.length / 3), channels: 3, background: "#fff" } }).composite(tiles).jpeg({ quality: 80 }).toFile(join(out, `sheet-${sheet + 1}.jpg`));
}
