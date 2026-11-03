/**
 * Can a Jev box replace a redraw for writing in a finished picture? Asks Jev where the writing is, paints the box out with
 * the portrait painter (paintOutMarks: median colour of the surrounding fabric, soft edge), then asks Jev again whether
 * writing is left. Writes <name>.painted.jpg next to a side-by-side <name>.compare.jpg.
 *
 *   bun --env-file=.env.local run scripts/image-bench/jev-paint-probe.ts --images <file>[,<file>] [--out <dir>]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import sharp from "sharp";
import { paintOutMarks, type MarkBox } from "../../backend/story/image-reference-sprite";

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const cwd = process.env.INIT_CWD || process.cwd();
const out = resolve(cwd, arg("out") || "Logs/image-bench/jev-box-probe/paint");
const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error("OPENROUTER_API_KEY missing");

async function ask(image: Buffer, questions: Record<string, unknown>) {
  const jpeg = await sharp(image).resize(768, 768, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  const response = await fetch("https://openrouter.ai/api/alpha/decisions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-OpenRouter-Title": "Talea jev paint probe" },
    body: JSON.stringify({ model: "typesafe/jev-1.14", state: ["Illustration from a children's book:", { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` } }], questions }),
  });
  if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 300)}`);
  return response.json() as Promise<any>;
}

await mkdir(out, { recursive: true });
const rows: any[] = [];
for (const file of (arg("images") || "").split(",").filter(Boolean).map((p) => resolve(cwd, p))) {
  const original = await readFile(file);
  const before = await ask(original, {
    text: { type: "noul", instructions: "The picture contains readable written words, letters or a logo." },
    where: { type: "box", instructions: "The written words, letters or logo in the picture." },
  });
  const box = before.answers.where.box;
  const mark: MarkBox = [box.left * 1000, box.top * 1000, box.right * 1000, box.bottom * 1000];
  const painted = await paintOutMarks(original, [mark]);
  const after = await ask(painted, { text: { type: "noul", instructions: "The picture contains readable written words, letters or a logo." } });
  const name = basename(file).replace(/\.\w+$/, "");
  await sharp(painted).jpeg({ quality: 88 }).toFile(join(out, `${name}.painted.jpg`));
  // Side by side, cropped to the padded box ×3 so the patch is visible at a glance.
  const meta = await sharp(original).metadata();
  const w = meta.width!, h = meta.height!;
  const cx = ((box.left + box.right) / 2) * w, cy = ((box.top + box.bottom) / 2) * h;
  const side = Math.min(w, h, Math.max(260, 3 * Math.max((box.right - box.left) * w, (box.bottom - box.top) * h)));
  const crop = { left: Math.round(Math.max(0, Math.min(w - side, cx - side / 2))), top: Math.round(Math.max(0, Math.min(h - side, cy - side / 2))), width: Math.round(side), height: Math.round(side) };
  const [a, b] = await Promise.all([original, painted].map((buffer) => sharp(buffer).extract(crop).resize(400, 400).jpeg().toBuffer()));
  await sharp({ create: { width: 810, height: 400, channels: 3, background: "#fff" } }).composite([{ input: a, left: 0, top: 0 }, { input: b, left: 410, top: 0 }]).jpeg({ quality: 85 }).toFile(join(out, `${name}.compare.jpg`));
  const row = { file: name, textBefore: before.answers.text.noul, box, confidence: before.answers.where.confidence, textAfter: after.answers.text.noul, costUSD: (Number(before.usage?.cost) || 0) + (Number(after.usage?.cost) || 0) };
  rows.push(row);
  console.log(`${name.padEnd(30)} text ${Math.round(row.textBefore * 100)}% → ${Math.round(row.textAfter * 100)}%  box t${box.top} b${box.bottom} l${box.left} r${box.right} c${row.confidence}`);
}
await writeFile(join(out, "results.json"), JSON.stringify(rows, null, 2));

// One sheet with every close-up pair (before | after).
const pairs = await Promise.all(rows.map((row) => sharp(join(out, `${row.file}.compare.jpg`)).resize(810, 400).jpeg().toBuffer()));
await sharp({ create: { width: 1620, height: 400 * Math.ceil(pairs.length / 2), channels: 3, background: "#fff" } })
  .composite(pairs.map((input, index) => ({ input, left: (index % 2) * 810, top: Math.floor(index / 2) * 400 })))
  .jpeg({ quality: 80 }).toFile(join(out, "sheet.jpg"));
