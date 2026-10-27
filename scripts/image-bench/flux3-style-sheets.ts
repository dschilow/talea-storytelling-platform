/** Readable, labelled comparisons for the style and portrait studies. */
import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const root = "Logs/image-bench/flux3-style-study-2026-10-27";
const rows = (await readFile(join(root, "results.jsonl"), "utf8")).split("\n").filter(Boolean).map(line => JSON.parse(line));
await mkdir(join(root, "sheets"), { recursive: true });
const labels: Record<string, string> = { previous: "Bisheriger Prompt", caption: "Neue Bildbeschreibung", directed: "Moderne Bilderbuchregie", dreamworks: "DreamWorks-Richtung", pixar: "Pixar-Richtung", jansson: "Tove-Jansson-Richtung", sendak: "Maurice-Sendak-Richtung" };

export async function sheet(path: string, entries: Array<{ file: string; label: string }>, columns = 3, cell = 460, height = cell) {
  const labelHeight = 34, layers: sharp.OverlayOptions[] = [];
  for (const [i, entry] of entries.entries()) {
    const left = (i % columns) * cell, top = Math.floor(i / columns) * (height + labelHeight);
    const title = entry.label.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    layers.push({ input: Buffer.from(`<svg width="${cell}" height="${labelHeight}"><rect width="100%" height="100%" fill="#f6f3ef"/><text x="10" y="23" fill="#222" font-family="Arial" font-size="17">${title}</text></svg>`), left, top });
    layers.push({ input: await sharp(entry.file).resize(cell, height, { fit: "contain", background: "#ffffff" }).png().toBuffer(), left, top: top + labelHeight });
  }
  await sharp({ create: { width: cell * columns, height: Math.ceil(entries.length / columns) * (height + labelHeight), channels: 3, background: "#eeeeee" } }).composite(layers).jpeg({ quality: 92 }).toFile(path);
}
for (const scene of ["map", "rain", "stream"]) {
  await sheet(join(root, "sheets", `${scene}-styles.jpg`), rows.filter(row => row.scene === scene && row.file).map(row => ({ file: row.file, label: labels[row.variant] })), 3);
}
await sheet(join(root, "sheets", "five-styles.jpg"), ["directed", "dreamworks", "pixar", "jansson", "sendak"].map(variant => ({ file: rows.find(row => row.id === `map-${variant}`).file, label: labels[variant] })), 3, 520);
console.log("Style sheets rendered");

const portraitRoot = "Logs/image-bench/flux3-portrait-study-2026-10-27";
let portraits: any[] = [];
try { portraits = (await readFile(join(portraitRoot, "results.jsonl"), "utf8")).split("\n").filter(Boolean).map(line => JSON.parse(line)); } catch {}
if (portraits.length) {
  await mkdir(join(portraitRoot, "sheets"), { recursive: true });
  for (const [name, ids] of [["avatars", ["alexander", "adrian"]], ["pool", ["bo", "wuschel", "griselda"]]] as const) {
    const entries: Array<{ file: string; label: string }> = [];
    for (const id of ids) {
      const first = portraits.find(row => row.id === `portrait-${id}-modern`);
      if (!first) continue;
      entries.push({ file: first.original, label: `${first.figure}: bisher` });
      for (const style of ["modern", "dreamworks", "pixar"]) {
        const row = portraits.find(row => row.id === `portrait-${id}-${style}` && row.file);
        if (row) entries.push({ file: row.file, label: `${row.figure}: ${style === "modern" ? "Bilderbuch" : style}` });
      }
    }
    await sheet(join(portraitRoot, "sheets", `${name}.jpg`), entries, 4, 400);
  }
  for (const scene of ["map", "rain", "stream"]) {
    const entries: Array<{ file: string; label: string }> = [];
    for (const style of ["modern", "dreamworks", "pixar"]) {
      const row = portraits.find(row => row.id === `scene-${scene}-${style}` && row.file);
      if (row) entries.push({ file: row.controlFile, label: `${style}: alte Referenzen` }, { file: row.file, label: `${style}: neue Referenzen` });
    }
    if (entries.length) await sheet(join(portraitRoot, "sheets", `${scene}-references.jpg`), entries, 2, 500);
  }
  console.log("Portrait/reference comparison sheets rendered");
}
