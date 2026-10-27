/** Side-by-side contact sheets for the recorded image benchmark. */
import { readFile, mkdir } from "node:fs/promises";
import sharp from "sharp";
import { join } from "node:path";
const root = "Logs/image-bench/flux3-story-comparison-2026-10-27";
const rows = (await readFile(join(root, "results.jsonl"), "utf8")).trim().split("\n").map((line) => JSON.parse(line)).filter((row) => row.file);
await mkdir(join(root, "sheets"), { recursive: true });
for (const story of ["forest", "cloud", "witch"]) {
  const scenes = [`${story}-cover`, ...[1, 2, 3, 4].map((i) => `${story}-${i}`)];
  const cell = 480, label = 32, columns = 2;
  const layers: sharp.OverlayOptions[] = [];
  for (const [i, scene] of scenes.entries()) for (const [j, model] of ["flux2", "flux3"].entries()) {
    const row = rows.find((x) => x.id === `${scene}-${model}-baseline`);
    if (!row) continue;
    const picture = await sharp(row.file).resize(cell, cell).png().toBuffer();
    const title = Buffer.from(`<svg width="${cell}" height="${label}"><rect width="100%" height="100%" fill="#f6f3ef"/><text x="8" y="22" fill="#222" font-size="17" font-family="Arial">${scene} / ${model}</text></svg>`);
    layers.push({ input: picture, left: j * cell, top: i * (cell + label) + label }, { input: title, left: j * cell, top: i * (cell + label) });
  }
  await sharp({ create: { width: cell * columns, height: (cell + label) * scenes.length, channels: 3, background: "#eeeeee" } }).composite(layers).jpeg({ quality: 91 }).toFile(join(root, "sheets", `${story}-paired.jpg`));
}
for (const story of ["forest", "cloud", "witch"]) {
  const scene = `${story}-4`, variants = ["flux2-baseline", "flux3-baseline", "flux3-multi", "flux3-style"];
  const cell = 520, label = 32, layers: sharp.OverlayOptions[] = [];
  for (const [i, variant] of variants.entries()) {
    const row = rows.find((x) => x.id === `${scene}-${variant}`);
    if (!row) continue;
    const picture = await sharp(row.file).resize(cell, cell).png().toBuffer();
    const title = Buffer.from(`<svg width="${cell}" height="${label}"><rect width="100%" height="100%" fill="#f6f3ef"/><text x="8" y="22" fill="#222" font-size="17" font-family="Arial">${scene} / ${variant}</text></svg>`);
    layers.push({ input: picture, left: (i % 2) * cell, top: Math.floor(i / 2) * (cell + label) + label }, { input: title, left: (i % 2) * cell, top: Math.floor(i / 2) * (cell + label) });
  }
  await sharp({ create: { width: cell * 2, height: (cell + label) * 2, channels: 3, background: "#eeeeee" } }).composite(layers).jpeg({ quality: 91 }).toFile(join(root, "sheets", `${story}-four.jpg`));
}
for (const story of ["forest", "cloud", "witch"]) {
  const scenes = [`${story}-cover`, `${story}-4`];
  const variants = ["flux3-baseline", "flux3-origins", "flux3-origins-landscape", "flux3-origins-boxes"];
  const cell = 500, height = 410, label = 32, layers: sharp.OverlayOptions[] = [];
  for (const [i, scene] of scenes.entries()) for (const [j, variant] of variants.entries()) {
    const row = rows.find((x) => x.id === `${scene}-${variant}`);
    if (!row) continue;
    const picture = await sharp(row.file).resize(cell, height, { fit: "contain", background: "#ffffff" }).png().toBuffer();
    const title = Buffer.from(`<svg width="${cell}" height="${label}"><rect width="100%" height="100%" fill="#f6f3ef"/><text x="8" y="22" fill="#222" font-size="17" font-family="Arial">${scene} / ${variant}</text></svg>`);
    layers.push({ input: picture, left: j * cell, top: i * (height + label) + label }, { input: title, left: j * cell, top: i * (height + label) });
  }
  await sharp({ create: { width: cell * variants.length, height: (height + label) * scenes.length, channels: 3, background: "#eeeeee" } }).composite(layers).jpeg({ quality: 91 }).toFile(join(root, "sheets", `${story}-origins.jpg`));
}
const retries = rows.filter((row) => row.id.endsWith("-retry"));
if (retries.length) {
  const cell = 480, label = 32, layers: sharp.OverlayOptions[] = [];
  for (const [i, retry] of retries.entries()) {
    const first = rows.find((row) => row.id === retry.id.replace(/-retry$/, ""));
    for (const [j, row] of [first, retry].entries()) {
      if (!row) continue;
      const picture = await sharp(row.file).resize(cell, cell).png().toBuffer();
      const title = Buffer.from(`<svg width="${cell}" height="${label}"><rect width="100%" height="100%" fill="#f6f3ef"/><text x="8" y="22" fill="#222" font-size="17" font-family="Arial">${row.id}</text></svg>`);
      layers.push({ input: picture, left: j * cell, top: i * (cell + label) + label }, { input: title, left: j * cell, top: i * (cell + label) });
    }
  }
  // Separate sheets keep individual figures readable even with many retries.
  for (let start = 0; start < retries.length; start += 3) {
    const pageLayers = layers.filter((layer) => Number(layer.top) >= start * (cell + label) && Number(layer.top) < (start + 3) * (cell + label)).map((layer) => ({ ...layer, top: Number(layer.top) - start * (cell + label) }));
    await sharp({ create: { width: cell * 2, height: (cell + label) * Math.min(3, retries.length - start), channels: 3, background: "#eeeeee" } }).composite(pageLayers).jpeg({ quality: 91 }).toFile(join(root, "sheets", `retry-${start / 3 + 1}.jpg`));
  }
}
console.log(`Rendered contact sheets: ${rows.length} image records`);
