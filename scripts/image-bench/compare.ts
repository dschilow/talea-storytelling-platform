/**
 * Beschriftetes Vergleichsbild ausgewählter Varianten einer Szene.
 *   bun run scripts/image-bench/compare.ts <lauf> <szene> <variante-prefix,variante-prefix,...> [seeds=21,22,23] [--out datei.jpg]
 * Zeilen = Varianten (Präfix-Treffer), Spalten = Seeds; Rahmen grün = bestanden, rot = durchgefallen.
 */
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { option } from "./lib/core";

const [run, scene, prefixes, seedArg] = process.argv.slice(2);
const results = (await readFile(`Logs/image-bench/runs/${run}/results.jsonl`, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line));
const seeds = (seedArg && !seedArg.startsWith("--") ? seedArg : "21,22,23").split(",").map(Number);
const cell = 300, label = 210, bar = 6;
const rows = prefixes.split(",");
const tiles: sharp.OverlayOptions[] = [];
for (const [r, prefix] of rows.entries()) {
  const text = prefix.replace(/&/g, "&amp;").split("|").join(" ");
  tiles.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${label}" height="${cell}"><rect width="100%" height="100%" fill="#f4f1ea"/><text x="8" y="26" font-family="Arial" font-size="15" fill="#222">${text}</text></svg>`), left: 0, top: r * (cell + bar) });
  for (const [c, seed] of seeds.entries()) {
    const hit = results.find((x) => x.scene === scene && x.seed === seed && x.variant.startsWith(prefix) && x.file);
    if (!hit) continue;
    const color = hit.verdict?.pass ? "#2e7d4f" : "#b3382f";
    tiles.push({ input: await sharp(hit.file).resize(cell, cell, { fit: "cover" }).jpeg({ quality: 82 }).toBuffer(), left: label + c * cell, top: r * (cell + bar) });
    tiles.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="${bar}"><rect width="100%" height="100%" fill="${color}"/></svg>`), left: label + c * cell, top: r * (cell + bar) + cell });
  }
}
const out = option("--out", `Logs/image-bench/compare-${run}-${scene}.jpg`)!;
await sharp({ create: { width: label + seeds.length * cell, height: rows.length * (cell + bar), channels: 3, background: "#fff" } }).composite(tiles).jpeg({ quality: 85 }).toFile(out);
console.log(out);
