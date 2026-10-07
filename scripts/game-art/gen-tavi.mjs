/**
 * Kommissar Tavi lebendig: je Pose Blinzel- und Sprech-Varianten per Inpainting (nur Augen bzw. Mund werden neu
 * gemalt, der Rest bleibt pixelgleich). process.py tavi setzt nur die maskierten Bereiche auf das Original.
 *
 *   bun scripts/game-art/gen-tavi.mjs [--only kommissar] [--kinds blink,talk1,talk2] [--force]
 */
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { CACHE, HERE, infer, pool } from "./runware.mjs";

const args = process.argv.slice(2);
const opt = (k) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : null;
};
const force = args.includes("--force");
const POSES = (opt("--only") || "kommissar,whisper,cheer,shrug,surprised").split(",");
const KINDS = (opt("--kinds") || "blink,talk1,talk2").split(",");
const DIR = path.join(CACHE, "tavi");
mkdirSync(DIR, { recursive: true });

// Vorlagen (576 × 768 auf Weiß) und Masken erzeugt process.py (tavi-prep), damit die Geometrie an einer Stelle liegt.
execFileSync("python", [path.join(HERE, "process.py"), "tavi-prep"], { stdio: "inherit" });

const PROMPTS = {
  blink: "The same cute round white robot detective with a brown deerstalker hat, exactly the same drawing, but both eyes are gently CLOSED: each eye is a soft curved dark-brown line like a smile, eyelids down, blinking. Same watercolor and ink style, same colors.",
  talk1: "The same cute round white robot detective, exactly the same drawing, but the small mouth is half open while talking: a small rounded open mouth, dark inside with a hint of pink tongue. Same watercolor and ink style.",
  talk2: "The same cute round white robot detective, exactly the same drawing, but the mouth is wide open while talking enthusiastically: a round open mouth, dark brown inside with a pink tongue. Same watercolor and ink style.",
};

const MODEL = opt("--model") || "bfl:flux@3-image";
const jobs = POSES.flatMap((pose) => KINDS.filter((k) => k === "blink" || existsSync(path.join(DIR, `${pose}.mouth.mask.png`))).map((kind) => ({ pose, kind })));
let spent = 0;
await pool(jobs, 4, async ({ pose, kind }) => {
  const out = path.join(DIR, `${pose}.${kind}.png`);
  if (!force && existsSync(out)) return;
  const mask = path.join(DIR, `${pose}.${kind === "blink" ? "eyes" : "mouth"}.mask.png`);
  // Bearbeitungsmodell (Standard): ganzes Bild als Referenz, „nur das ändern“; process.py nimmt nur den Maskenbereich.
  // Inpainting (--model runware:102@1): Ausgangsbild + Maske.
  const edit = MODEL.startsWith("bfl:");
  const r = await infer({
    name: `tavi.${pose}.${kind}`,
    out,
    model: MODEL,
    prompt: edit ? `Edit the reference image. Keep EVERYTHING exactly identical (pose, position, size, colors, background, lines) and change only this: ${PROMPTS[kind]}` : PROMPTS[kind],
    width: 768,
    height: 768,
    ...(edit ? { refs: [path.join(DIR, `${pose}.seed.png`)] } : { seedImage: path.join(DIR, `${pose}.seed.png`), maskImage: mask, steps: 28 }),
    format: "PNG",
  });
  spent += r.cost;
  console.log(`  ✓ ${pose}.${kind}`);
});
console.log(`Kosten: ${spent.toFixed(4)} $`);
