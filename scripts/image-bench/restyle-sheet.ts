/** Kontaktbogen: Originalporträts + umgezeichnete Porträts je Stil. bun --env-file=.env.local run scripts/image-bench/restyle-sheet.ts flat-ink,cutpaper */
import sharp from "sharp";
import { Budget, ROOT } from "./lib/core";
import { STYLES } from "./lib/prompts";
import { loadRoster, restylePortrait } from "./lib/roster";

const budget = new Budget(0.5);
const roster = await loadRoster(budget);
const keys = (process.argv[2] || "flat-ink,cutpaper").split(",");
const rows: Buffer[][] = [roster.map((figure) => figure.portrait)];
for (const key of keys) {
  const style = STYLES.find((candidate) => candidate.key === key)!;
  rows.push(await Promise.all(roster.map((figure) => restylePortrait(figure, style, budget))));
}
const cell = 300;
const tiles: Array<{ input: Buffer; left: number; top: number }> = [];
for (const [r, row] of rows.entries()) for (const [c, buffer] of row.entries()) tiles.push({ input: await sharp(buffer).resize(cell, cell, { fit: "cover" }).jpeg({ quality: 86 }).toBuffer(), left: c * cell, top: r * cell });
const out = `${ROOT}/restyle-sheet.jpg`;
await sharp({ create: { width: cell * roster.length, height: cell * rows.length, channels: 3, background: "#fff" } }).composite(tiles).jpeg({ quality: 86 }).toFile(out);
console.log(out, `$${budget.spent.toFixed(4)}`);
