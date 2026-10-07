/**
 * Dorfkarte malen: Grundriss (map-layout.py) als erste Referenz, Stil von den Gebäuden.
 *
 *   bun scripts/game-art/gen-map.mjs [--seeds 11,12] [--size 2048]   (die „Seeds“ sind hier nur Namen der Varianten)
 *
 * Ergebnis: .cache/map/map.<seed>.png — die beste Variante wählt man von Hand und bereitet sie mit process.py map <seed> auf.
 */
import path from "node:path";
import { CACHE, infer, pool } from "./runware.mjs";
import { STYLE } from "./style.mjs";

const args = process.argv.slice(2);
const opt = (k) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : null;
};
const seeds = (opt("--seeds") || "11,12").split(",").map(Number);
const size = Number(opt("--size") || 2048);
const DIR = path.join(CACHE, "map");
const LAYOUT = path.join(DIR, "layout.png");
const refs = [LAYOUT, path.join(CACHE, "places", "baeckerei.landmark.png"), path.join(CACHE, "places", "garten.landmark.png")];

const prompt =
  `${STYLE} A richly detailed, top-down illustrated village map for a premium children's detective board game, seen straight from above with a gentle three-quarter tilt on trees and roofs. ` +
  `Follow the layout of the first reference image EXACTLY: every road, plaza, the river, the pond, the forests, the fields and the small houses stay at the same positions and sizes. ` +
  `The eight round plazas are EMPTY round cobblestone squares with a ring of edging stones (no buildings, no objects in the middle of the plazas: game pieces will stand there). ` +
  `Roads are winding cobblestone lanes with worn stone edges, tiny lanterns and little wooden fences along them. ` +
  `The river is clear turquoise water with gentle ripples, reeds and stones along both banks. ` +
  `Fill every gap with charming detail: cozy cottages with red and brown tiled roofs and chimneys, vegetable gardens, flower beds, hedges, haystacks, a wooden well, a duck pond with lily pads, ` +
  `a windmill in a golden wheat field, apple trees, rolling hills, dense rounded forest at the map edges. Lush greens, warm accents, high craft, cohesive lighting from the upper left. ` +
  `The style of the second and third reference images (watercolor and ink). No text, no labels, no compass, no frame.`;

const out = await pool(seeds, 2, async (seed) => {
  const file = path.join(DIR, `map.${seed}.png`);
  const r = await infer({ name: `map.${seed}`, out: file, prompt, width: size, height: size, refs });
  console.log(`  ✓ map.${seed} (${r.cost.toFixed(4)} $)`);
  return r.cost;
});
console.log(`Kosten: ${out.reduce((a, b) => a + (typeof b === "number" ? b : 0), 0).toFixed(4)} $`);
