/**
 * Trailer der Dorf-Vorschau (Abend → Mitternacht mit dem Dieb → Morgengrauen) als MP4 aufnehmen.
 * Braucht den Vite-Dev-Server mit der Werkstatt-Seite (siehe alibi-qa.mjs) und ffmpeg.
 *
 *   node scripts/game-qa/trailer.mjs [--seconds 40] [--size 720x780] [--out scripts/game-qa/out/trailer.mp4]
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pw = [process.env.PLAYWRIGHT_PATH, path.join(os.homedir(), ".claude/skills/ref2game/scripts/node_modules/playwright"), "playwright"].filter(Boolean).map((t) => {
  try {
    return require(t);
  } catch {
    return null;
  }
}).find(Boolean);
if (!pw) throw new Error("Playwright nicht gefunden.");

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const seconds = Number(opt("seconds", "40"));
const [w, h] = opt("size", "720x780").split("x").map(Number);
const out = path.resolve(opt("out", path.join(HERE, "out", "trailer.mp4")));
const tmp = path.join(HERE, "out", "video-tmp");
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

// GPU zuerst (flüssiger), sonst Software-Rendering
let browser;
try {
  browser = await pw.chromium.launch({ args: ["--use-gl=angle", "--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
} catch {
  browser = await pw.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
}
const ctx = await browser.newContext({ viewport: { width: w, height: h }, recordVideo: { dir: tmp, size: { width: w, height: h } } });
const page = await ctx.newPage();
await page.goto(`${opt("base", "http://127.0.0.1:5199")}/alibi-lab.html?scene=attract`, { waitUntil: "networkidle" });
await page.addStyleTag({ content: "body{display:flex;align-items:center;min-height:100vh} #root{width:100%}" });
await page.waitForTimeout(seconds * 1000);
await ctx.close();
await browser.close();
const webm = readdirSync(tmp).find((f) => f.endsWith(".webm"));
if (!webm) throw new Error("Keine Aufnahme entstanden.");
mkdirSync(path.dirname(out), { recursive: true });
// die ersten 1,5 s (Laden) abschneiden, H.264 für überall abspielbar
execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", "1.5", "-i", path.join(tmp, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", out], { stdio: "inherit" });
rmSync(tmp, { recursive: true, force: true });
console.log(`Trailer: ${out}`);
