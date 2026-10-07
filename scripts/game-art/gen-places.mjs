/**
 * Orte neu malen: je Ort ein freistehendes Gebäude für die Dorfkarte (freigestellt) und ein Szenenbild für die Karten.
 *
 *   bun scripts/game-art/gen-places.mjs [--only baeckerei,turm] [--kind landmark|scene] [--force]
 *
 * Rohbilder: scripts/game-art/.cache/places/, fertige Bilder macht process.py.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { CACHE, REPO_ROOT, infer, pool, removeBg } from "./runware.mjs";
import { PLACES, STYLE } from "./style.mjs";

const args = process.argv.slice(2);
const opt = (k) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : null;
};
const only = opt("--only")?.split(",") ?? Object.keys(PLACES);
const kinds = opt("--kind") ? [opt("--kind")] : ["landmark", "scene"];
const force = args.includes("--force");
const seed = opt("--seed") ? Number(opt("--seed")) : undefined;
const DIR = path.join(CACHE, "places");
const OLD = (id) => path.join(REPO_ROOT, "frontend/public/game/alibi/places", `${id}.webp`);
const MAP = path.join(REPO_ROOT, "frontend/public/game/alibi/map/village.webp");

let spent = 0;
if (kinds.includes("landmark")) {
  console.log("Gebäude für die Karte …");
  await pool(only, 4, async (id) => {
    const p = PLACES[id];
    const raw = path.join(DIR, `${id}.landmark.png`), cut = path.join(DIR, `${id}.landmark.cut.png`);
    if (!force && existsSync(cut)) return;
    const prompt =
      `${STYLE} A single miniature game-board piece: ${p.landmark}. Signature color: ${p.color}. ` +
      `Three-quarter front view from slightly above, the whole piece fully visible and centered with a wide empty margin on all sides, ` +
      `standing on its own small round patch of ground. A bold, unique silhouette that a small child recognizes instantly. ` +
      `Plain flat off-white background, no other buildings, no cast shadow on the background.`;
    const r = await infer({ name: `${id}.landmark`, out: raw, prompt, width: 1024, height: 1024, refs: [OLD(id), MAP], seed });
    const c = await removeBg({ name: `${id}.landmark`, input: raw, out: cut });
    spent += r.cost + c.cost;
    console.log(`  ✓ ${id} (${(r.cost + c.cost).toFixed(4)} $)`);
  });
}
if (kinds.includes("scene")) {
  console.log("Szenenbilder …");
  await pool(only, 4, async (id) => {
    const p = PLACES[id];
    const raw = path.join(DIR, `${id}.scene.png`), lm = path.join(DIR, `${id}.landmark.png`);
    if (!force && existsSync(raw)) return;
    const prompt =
      `${STYLE} ${p.scene}. The signature, ${p.sign}, is big and clearly visible in the center, so a small child who cannot read recognizes the place at a glance. ` +
      `Dominant color: ${p.color}. Night in a fairy-tale village, deep blue sky with a few stars. Same building design as the first reference image. No people.`;
    const refs = existsSync(lm) ? [lm, OLD(id)] : [OLD(id)];
    const r = await infer({ name: `${id}.scene`, out: raw, prompt, width: 1024, height: 1024, refs, seed });
    spent += r.cost;
    console.log(`  ✓ ${id} (${r.cost.toFixed(4)} $)`);
  });
}
console.log(`Kosten: ${spent.toFixed(4)} $`);
