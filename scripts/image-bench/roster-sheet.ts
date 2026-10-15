/** Kontaktbogen der Testfiguren (und optional ihrer Kanon-Karten / Freisteller): bun --env-file=.env.local run scripts/image-bench/roster-sheet.ts [--canon] [--cutout] */
import sharp from "sharp";
import { Budget, flag, ROOT } from "./lib/core";
import { ensureCanon, ensureCutout, loadRoster } from "./lib/roster";

const budget = new Budget(0.5);
const figures = await loadRoster(budget);
const rows: Buffer[][] = [figures.map((figure) => figure.portrait)];
if (flag("--canon")) rows.push(await Promise.all(figures.map((figure) => ensureCanon(figure, budget))));
if (flag("--cutout")) rows.push(await Promise.all(figures.map((figure) => ensureCutout(figure, budget))));
const cell = 320;
const tiles: Array<{ input: Buffer; left: number; top: number }> = [];
for (const [r, row] of rows.entries()) {
  for (const [c, buffer] of row.entries()) {
    tiles.push({ input: await sharp(buffer).resize(cell, cell, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).jpeg({ quality: 88 }).toBuffer(), left: c * cell, top: r * cell });
  }
}
const out = `${ROOT}/roster-sheet.jpg`;
await sharp({ create: { width: cell * figures.length, height: cell * rows.length, channels: 3, background: "#ffffff" } }).composite(tiles).jpeg({ quality: 88 }).toFile(out);
console.log(figures.map((figure, i) => `${i + 1}. ${figure.name} [${figure.species}${figure.isHuman ? ", human" : ""}] ${figure.appearance.slice(0, 90)}`).join("\n"));
console.log(`gespeichert: ${out}; Kosten $${budget.spent.toFixed(4)} (${budget.calls} Aufrufe)`);
