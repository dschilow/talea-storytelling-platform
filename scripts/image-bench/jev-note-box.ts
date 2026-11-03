/**
 * Turns the picture checker's notes into Jev box questions and draws the boxes: can an admin see at a glance what the
 * check meant? Reads every failed/flawed attempt with notes from a story log (imageQa[].history), downloads it through
 * the production image proxy and asks one box question per note (≈ 0.001 ct each).
 *
 *   bun --env-file=.env.local run scripts/image-bench/jev-note-box.ts --log <logs.json>[,<logs.json>] [--out <dir>] [--limit 12]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import sharp from "sharp";

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const cwd = process.env.INIT_CWD || process.cwd();
const out = resolve(cwd, arg("out") || "Logs/image-bench/jev-box-probe/notes");
const limit = Number(arg("limit") || 12);
const proxy = "https://backend-2-production-3de1.up.railway.app/story/image?key=";
const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error("OPENROUTER_API_KEY missing");
const COLORS = ["#ff2d55", "#ff9500", "#34c759", "#007aff"];

/** Every attempt with notes, de-duplicated by picture. */
async function attempts() {
  const seen = new Map<string, { url: string; status: string; notes: string[] }>();
  for (const file of (arg("log") || "").split(",").filter(Boolean)) {
    const text = await readFile(resolve(cwd, file), "utf8");
    for (const match of text.matchAll(/"history"\s*:\s*\[/g)) {
      let depth = 0, i = match.index! + match[0].length - 1;
      const start = i;
      for (; i < text.length; i += 1) { if (text[i] === "[") depth += 1; else if (text[i] === "]" && --depth === 0) break; }
      for (const attempt of JSON.parse(text.slice(start, i + 1))) {
        if (attempt?.url && attempt.notes?.length && !seen.has(attempt.url)) seen.set(attempt.url, { url: attempt.url, status: attempt.status, notes: attempt.notes });
      }
    }
  }
  return [...seen.values()];
}

await mkdir(out, { recursive: true });
const rows: any[] = [];
for (const attempt of (await attempts()).slice(0, limit)) {
  const bytes = Buffer.from(await (await fetch(proxy + encodeURIComponent(attempt.url.replace(/^bucket:\/\/[^/]+\//, "")))).arrayBuffer());
  const jpeg = await sharp(bytes).resize(768, 768, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  // Short, de-duplicated notes; the checker often writes the same fault twice in two wordings.
  const notes = [...new Set(attempt.notes.map((note) => note.replace(/\s*\[jev[^\]]*\]/g, "").slice(0, 220)))].slice(0, 4);
  const questions = Object.fromEntries(notes.map((note, index) => [`n${index}`, { type: "box", instructions: `The spot in the picture that shows this fault: ${note}` }]));
  const response = await fetch("https://openrouter.ai/api/alpha/decisions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-OpenRouter-Title": "Talea jev note box" },
    body: JSON.stringify({ model: "typesafe/jev-1.14", state: ["Illustration from a children's book:", { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` } }], questions }),
  });
  if (!response.ok) { console.error(response.status, (await response.text()).slice(0, 300)); continue; }
  const data: any = await response.json();
  const meta = await sharp(jpeg).metadata();
  const width = meta.width!, height = meta.height!;
  const shapes = notes.map((note, index) => {
    const box = data.answers?.[`n${index}`]?.box;
    if (!box) return "";
    const x = box.left * width, y = box.top * height;
    return `<rect x="${x}" y="${y}" width="${(box.right - box.left) * width}" height="${(box.bottom - box.top) * height}" fill="none" stroke="${COLORS[index]}" stroke-width="5"/><text x="${x + 4}" y="${Math.max(20, y - 6)}" font-family="Arial" font-size="20" font-weight="bold" fill="${COLORS[index]}" stroke="black" stroke-width="0.8">${index + 1}</text>`;
  }).join("");
  const legend = notes.map((note, index) => `<text x="8" y="${24 + index * 22}" font-family="Arial" font-size="15" fill="${COLORS[index]}">${index + 1}: ${note.slice(0, 95).replace(/[<&>]/g, "")} (c ${Number(data.answers?.[`n${index}`]?.confidence ?? 0).toFixed(2)})</text>`).join("");
  const id = attempt.url.replace(/^.*\/runware-(\d+)-.*$/, "$1");
  await sharp({ create: { width, height: height + 24 + notes.length * 22, channels: 3, background: "#111" } })
    .composite([{ input: await sharp(jpeg).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${shapes}</svg>`) }]).toBuffer(), top: 0, left: 0 },
      { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${24 + notes.length * 22}">${legend}</svg>`), top: height, left: 0 }])
    .jpeg({ quality: 85 }).toFile(join(out, `${id}.jpg`));
  rows.push({ id, url: attempt.url, status: attempt.status, notes, answers: data.answers, costUSD: data.usage?.cost });
  console.log(id, attempt.status, notes.map((note, index) => `${index + 1}: c${Number(data.answers?.[`n${index}`]?.confidence ?? 0).toFixed(2)}`).join("  "), `${((data.usage?.cost || 0) * 100).toFixed(4)} ct`);
}
await writeFile(join(out, "results.json"), JSON.stringify(rows, null, 2));
