/**
 * False-alarm audit for the Jev second reader before it runs in a lane: asks the production questions (jev.ts, with a
 * cast of one human child and one creature, so every question is asked) on every picture, applies the production
 * thresholds and draws a box around each finding that fired. Only the alarms go on the contact sheets, so a person can
 * judge each one by eye. Pictures: local files/folders and/or story logs (every attempt in imageQa[].history).
 *
 *   bun --env-file=.env.local run scripts/image-bench/jev-alarm-audit.ts [--images <file|dir>,…] [--logs <logs.json>,…] [--out <dir>]
 */
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import sharp from "sharp";
import { createOpenRouterJevPort } from "../../backend/story/storybook/jev-openrouter";
import { interpretJev, jevBoxQuestionsFor, jevQuestionsFor, parseJevScores } from "../../backend/story/storybook/jev";
import type { VisualEntity } from "../../backend/story/storybook/illustration-stage";

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const cwd = process.env.INIT_CWD || process.cwd();
const out = resolve(cwd, arg("out") || "Logs/image-bench/jev-alarm-audit");
const only = arg("only") ? new RegExp(arg("only")!) : undefined;
const proxy = "https://backend-2-production-3de1.up.railway.app/story/image?key=";
const port = createOpenRouterJevPort(() => process.env.OPENROUTER_API_KEY);
if (!port) throw new Error("No OpenRouter key.");

const cast = [
  { id: "a", name: "Kind", kind: "character", role: "hero", species: "human", isHuman: true, appearance: "young child", forbidden: [] },
  { id: "b", name: "Wesen", kind: "character", role: "cast", species: "creature", isHuman: false, appearance: "friendly creature", forbidden: [] },
] as unknown as VisualEntity[];

async function sources(): Promise<Array<{ id: string; load: () => Promise<Buffer> }>> {
  const list: Array<{ id: string; load: () => Promise<Buffer> }> = [];
  for (const entry of (arg("images") || "").split(",").filter(Boolean).map((p) => resolve(cwd, p))) {
    const files = (await stat(entry)).isDirectory() ? (await readdir(entry)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f) && (!only || only.test(f))).sort().map((f) => join(entry, f)) : [entry];
    for (const file of files) list.push({ id: `${basename(resolve(file, ".."))}/${basename(file)}`, load: () => readFile(file) });
  }
  for (const file of (arg("logs") || "").split(",").filter(Boolean)) {
    const text = await readFile(resolve(cwd, file), "utf8");
    const seen = new Set<string>();
    for (const match of text.matchAll(/"url"\s*:\s*"(bucket:\/\/[^"]+\.(?:webp|jpg|png))"/g)) {
      if (seen.has(match[1])) continue;
      seen.add(match[1]);
      const key = match[1].replace(/^bucket:\/\/[^/]+\//, "");
      list.push({ id: `${basename(file).slice(0, 24)}/${key.replace(/^.*runware-(\d+)-.*$/, "$1")}`, load: async () => Buffer.from(await (await fetch(proxy + encodeURIComponent(key))).arrayBuffer()) });
    }
  }
  return list;
}

await mkdir(out, { recursive: true });
const rows: any[] = [];
const alarms: string[] = [];
for (const source of await sources()) {
  let bytes: Buffer;
  try { bytes = await source.load(); } catch { continue; }
  if (bytes.length < 2000) continue;
  const imageUrl = `data:image/jpeg;base64,${(await sharp(bytes).jpeg({ quality: 88 }).toBuffer()).toString("base64")}`;
  const reply = await port({ imageUrl, questions: jevQuestionsFor(cast) }).catch((error) => { console.error(source.id, error.message); return undefined; });
  const scores = reply && parseJevScores(reply.answers);
  if (!scores) continue;
  const found = interpretJev(scores);
  const fired = [...found.hybrid, ...found.soft, ...(found.text ? ["text"] : [])];
  const row: any = { id: source.id, scores, fired, costUSD: reply!.costUSD };
  if (fired.length) {
    const boxes = await port({ imageUrl, questions: jevBoxQuestionsFor(scores) }).catch(() => undefined);
    row.boxes = boxes?.boxes;
    const file = join(out, `${rows.length + 1}`.padStart(3, "0") + ".jpg");
    const image = await sharp(bytes).resize(768, 768, { fit: "inside" }).jpeg().toBuffer();
    const { width = 768, height = 768 } = await sharp(image).metadata();
    const shapes = Object.entries(boxes?.boxes || {}).map(([key, box]: any) => `<rect x="${box.left * width}" y="${box.top * height}" width="${(box.right - box.left) * width}" height="${(box.bottom - box.top) * height}" fill="none" stroke="#ff2d55" stroke-width="5"/><text x="${box.left * width + 4}" y="${Math.max(22, box.top * height - 6)}" font-family="Arial" font-size="20" font-weight="bold" fill="#ff2d55" stroke="black" stroke-width="0.8">${key} c${box.confidence.toFixed(2)}</text>`).join("");
    const label = `<rect width="${width}" height="${28 + fired.length * 22}" fill="black" opacity="0.7"/><text x="8" y="22" font-family="Arial" font-size="18" fill="white">${rows.length + 1}: ${source.id.replace(/[<&>]/g, "")}</text>${fired.map((f, i) => `<text x="8" y="${44 + i * 22}" font-family="Arial" font-size="16" fill="#ffd60a">${f.replace(/[<&>]/g, "").slice(0, 80)}</text>`).join("")}`;
    await sharp(image).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${shapes}${label}</svg>`) }]).jpeg({ quality: 82 }).toFile(file);
    alarms.push(file);
  }
  rows.push(row);
  console.log(`${String(rows.length).padStart(3)} ${source.id.padEnd(48)} ${fired.length ? "ALARM " + fired.map((f) => f.replace(/ \(.*?\)| \[jev/g, "").slice(0, 40)).join(" | ") : "-"}`);
}
await writeFile(join(out, "results.json"), JSON.stringify(rows, null, 2));
for (let sheet = 0; sheet * 6 < alarms.length; sheet += 1) {
  const part = alarms.slice(sheet * 6, sheet * 6 + 6);
  const tiles = await Promise.all(part.map(async (file, i) => ({ input: await sharp(file).resize(600, 600, { fit: "contain", background: "#111" }).jpeg().toBuffer(), left: (i % 3) * 600, top: Math.floor(i / 3) * 600 })));
  await sharp({ create: { width: 1800, height: 600 * Math.ceil(part.length / 3), channels: 3, background: "#111" } }).composite(tiles).jpeg({ quality: 80 }).toFile(join(out, `alarms-${sheet + 1}.jpg`));
}
const cost = rows.reduce((sum, row) => sum + row.costUSD, 0);
console.log(`\n${rows.length} pictures, ${alarms.length} with an alarm; ${(cost * 100).toFixed(3)} ct for the questions`);
