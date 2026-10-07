/**
 * Beobachtungs-Bilder freistellen (für kleine lebende Tiere und Dinge in den Orts-Szenen).
 *
 *   bun scripts/game-art/cut-sights.mjs [--force]
 *
 * Eingabe: frontend/public/game/alibi/sights/*.webp, Ausgabe roh: .cache/sights/<id>.png (process.py sights macht WebP).
 */
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { CACHE, REPO_ROOT, pool, removeBg } from "./runware.mjs";

const force = process.argv.includes("--force");
const SRC = path.join(REPO_ROOT, "frontend/public/game/alibi/sights");
const ids = readdirSync(SRC).filter((f) => f.endsWith(".webp")).map((f) => f.replace(/\.webp$/, ""));
let spent = 0;
await pool(ids, 6, async (id) => {
  const out = path.join(CACHE, "sights", `${id}.png`);
  if (!force && existsSync(out)) return;
  const r = await removeBg({ name: `sight.${id}`, input: path.join(SRC, `${id}.webp`), out });
  spent += r.cost;
});
console.log(`${ids.length} Bilder, Kosten: ${spent.toFixed(4)} $`);
