/**
 * Teile für bewegte Figuren und Leben auf der Karte (alle freigestellt):
 * Mantelkörper (einfärbbar), Bein mit Stiefel, Arm mit Fäustling, Kapuzenmantel des Diebs, Kapuze,
 * Elster im Flug (Körper + Flügel), Vordergrund-Pflanzen für die Ortsbühnen.
 *
 *   bun scripts/game-art/gen-parts.mjs [--only cloak,leg] [--force] [--seed 7]
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { CACHE, REPO_ROOT, infer, pool, removeBg } from "./runware.mjs";
import { STYLE } from "./style.mjs";

const args = process.argv.slice(2);
const opt = (k) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : null;
};
const force = args.includes("--force");
const seed = opt("--seed") ? Number(opt("--seed")) : undefined;
const DIR = path.join(CACHE, "parts");
const STYLE_REF = path.join(CACHE, "places", "baeckerei.landmark.png");
const ELSTER = path.join(REPO_ROOT, "frontend/public/game/alibi/elster/elster.webp");
const ISO = "Isolated single object, centered, fully visible with a wide empty margin, on a plain flat white background, no shadow on the background.";

/** Reihenfolge zählt: spätere Teile nehmen frühere als Referenz (gleicher Stil, gleiche Strichstärke). */
const JOBS = [
  {
    name: "cloak",
    w: 1024, h: 1024,
    prompt: `${STYLE} A small, cute, rounded traveling cloak garment for a board-game figure, front view: a soft bell-shaped cape that falls to the knees, with a round empty collar opening at the top (no head, no neck), no arms, no legs, no hands. Plain cream-white wool with soft watercolor shading, a few stitched seams, two small round wooden buttons, brown ink outline. ${ISO}`,
  },
  {
    name: "leg",
    w: 1024, h: 1024,
    refs: ["cloak"],
    prompt: `${STYLE} A single short stubby cartoon leg for a board-game figure, side view, perfectly straight and vertical: a dark chocolate-brown trouser leg from hip to ankle, ending in a round chunky brown leather boot with the toe pointing to the right. Nothing else. ${ISO}`,
  },
  {
    name: "arm",
    w: 1024, h: 1024,
    refs: ["cloak"],
    prompt: `${STYLE} A single short stubby cartoon arm for a board-game figure, hanging perfectly straight down: a cream-white wool sleeve from shoulder to wrist, ending in a small round white mitten hand. Nothing else. ${ISO}`,
  },
  {
    name: "thiefcloak",
    w: 1024, h: 1024,
    refs: ["cloak"],
    prompt: `${STYLE} A mysterious dark hooded cloak for a sneaky board-game figure, front three-quarter view: a deep charcoal-blue cloak falling to the knees with a big pointed hood up; inside the hood only deep dark shadow and two tiny glowing yellow eyes, no face. No arms, no legs. Small silver clasp. ${ISO}`,
  },
  {
    name: "hood",
    w: 1024, h: 1024,
    refs: ["thiefcloak"],
    prompt: `${STYLE} Only a big pointed deep charcoal-blue cloth hood with a short shoulder cape, front view, empty inside: the opening is a round hole where a face would be. Soft folds, silver clasp at the neck. ${ISO}`,
  },
  {
    name: "magpie_body",
    w: 1024, h: 1024,
    refs: [ELSTER],
    prompt: `${STYLE} The magpie from the reference (black and white feathers with blue-green shimmer, purple scarf, gold coin in the beak) in flight, side view facing right, body stretched out horizontally with the long tail behind, WITHOUT wings (the wings are drawn separately). ${ISO}`,
  },
  {
    name: "magpie_wing",
    w: 1024, h: 1024,
    refs: [ELSTER, "magpie_body"],
    prompt: `${STYLE} One single spread bird wing of a magpie, seen from the side, fully extended horizontally to the right from its shoulder root on the left: black feathers with a blue-green shimmer and a white patch, long primary feathers. Nothing else. ${ISO}`,
  },
  {
    name: "foliage",
    w: 1568, h: 672,
    prompt: `${STYLE} A wide horizontal strip of foreground plants for the bottom edge of a stage: dark green ferns, tall grass blades, a few blue and yellow wildflowers and round leaves, dense at the bottom, open sky above. ${ISO}`,
  },
];

const only = opt("--only")?.split(",");
const jobs = only ? JOBS.filter((j) => only.includes(j.name)) : JOBS;
const fileOf = (name) => path.join(DIR, `${name}.png`);
const cutOf = (name) => path.join(DIR, `${name}.cut.png`);
let spent = 0;

// In Wellen: ein Teil wartet, bis seine Referenzteile da sind.
const done = new Set(JOBS.filter((j) => existsSync(cutOf(j.name)) && !jobs.includes(j)).map((j) => j.name));
let left = jobs.slice();
while (left.length) {
  const ready = left.filter((j) => (j.refs || []).every((r) => r.includes("/") || r.includes("\\") || done.has(r) || existsSync(fileOf(r))));
  if (!ready.length) throw new Error(`Referenzen fehlen: ${left.map((j) => j.name).join(", ")}`);
  await pool(ready, 4, async (j) => {
    if (!force && existsSync(cutOf(j.name))) return;
    const refs = (j.refs || []).map((r) => (r.includes("/") || r.includes("\\") ? r : fileOf(r)));
    refs.push(STYLE_REF);
    const r = await infer({ name: j.name, out: fileOf(j.name), prompt: j.prompt, width: j.w, height: j.h, refs, seed });
    const c = await removeBg({ name: j.name, input: fileOf(j.name), out: cutOf(j.name) });
    spent += r.cost + c.cost;
    console.log(`  ✓ ${j.name}`);
  });
  ready.forEach((j) => done.add(j.name));
  left = left.filter((j) => !ready.includes(j));
}
console.log(`Kosten: ${spent.toFixed(4)} $`);
