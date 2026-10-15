import sharp from "sharp";
import { readFileSync } from "node:fs";
const load = (run) => readFileSync(`Logs/image-bench/runs/${run}/results.jsonl`, "utf8").split("\n").filter(Boolean).map(JSON.parse);
const sets = [
  { label: "Aquarell (heute)", rows: [...load("prompts-1"), ...load("nolooks-confirm")].filter((r) => r.variant === "klein4|sprite|nolooks|watercolor") },
  { label: "Tusche flach (Porträts neu)", rows: load("restyle-flat-ink") },
  { label: "Papierschnitt (Porträts neu)", rows: load("restyle-cutpaper") },
];
const scenes = ["s3-child-fox", "s4-three-humans", "s6-four"];
const cell = 330, label = 150;
const tiles = [];
for (const [r, set] of sets.entries()) {
  tiles.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${label}" height="${cell}"><rect width="100%" height="100%" fill="#f4f1ea"/><text x="6" y="24" font-family="Arial" font-size="14" fill="#222">${set.label.split(" (")[0]}</text><text x="6" y="44" font-family="Arial" font-size="12" fill="#555">${(set.label.match(/\((.*)\)/) || [])[1] || ""}</text></svg>`), left: 0, top: r * cell });
  for (const [c, scene] of scenes.entries()) {
    const hit = set.rows.find((x) => x.scene === scene && x.seed === 21 && x.file);
    if (hit) tiles.push({ input: await sharp(hit.file).resize(cell, cell, { fit: "cover" }).jpeg({ quality: 84 }).toBuffer(), left: label + c * cell, top: r * cell });
  }
}
await sharp({ create: { width: label + scenes.length * cell, height: sets.length * cell, channels: 3, background: "#fff" } }).composite(tiles).jpeg({ quality: 86 }).toFile("Logs/image-bench/style-migration.jpg");
console.log("ok");
