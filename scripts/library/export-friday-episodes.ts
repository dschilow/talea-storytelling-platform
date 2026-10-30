/** Reading copies, self-contained illustrated HTML, and contact sheets for visual QA. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { chapterImages } from "../../backend/story/library/image-slots";
import type { EpisodeSeed } from "../../backend/story/library/types";

const root = resolve(import.meta.dir, "../..");
const docs = join(root, "docs/talea-originals/2026-10-30");
const publicRoot = join(root, "frontend/public");
const file = (url: string) => join(publicRoot, url);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const data = (url: string) => `data:image/webp;base64,${readFileSync(file(url)).toString("base64")}`;
for (const [key, series] of [["bruno", "bruno-der-flunkerfisch"], ["monster", "die-monster-muellabfuhr"]]) {
  const episode: EpisodeSeed = JSON.parse(readFileSync(join(root, `backend/story/library/seed/episodes/${series}.s1e3.json`), "utf8"));
  const label = key === "bruno" ? "Bruno, der Flunkerfisch" : "Die Monster-Müllabfuhr";
  const md = [`# ${episode.title}`, `${label} · Staffel 1, Folge 3 · 30. Oktober 2026`, "", `![Cover](${file(episode.cover.url!).replace(/\\/g, "/")})`, ""];
  const html = [`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(episode.title)} – Talea Originals</title><style>body{margin:0;background:#f5efdf;color:#302c28;font:20px/1.75 Georgia,serif}main{max-width:850px;margin:auto;padding:44px 24px 90px}h1{font-size:clamp(36px,7vw,58px);line-height:1.08}h2{line-height:1.2;margin-top:70px}p{margin:0 0 1.2em}img{display:block;width:100%;height:auto;border-radius:15px;margin:28px 0 44px}small,figcaption{font:14px/1.5 system-ui;color:#766652}aside{background:#fff8e9;border:1px solid #e6d8bd;border-radius:16px;padding:24px;margin-top:55px}dt{font-weight:bold}dd{margin:0 0 15px}footer{margin-top:42px;font-style:italic}@media print{body{background:white;font-size:13pt}main{padding:0}img{max-height:13cm;object-fit:contain;break-inside:avoid}h2{break-after:avoid}aside{break-inside:avoid}}</style><main><small>TALEA ORIGINALS · ${esc(label)} · Staffel 1, Folge 3 · 30.10.2026</small><h1>${esc(episode.title)}</h1><img alt="Titelbild" src="${data(episode.cover.url!)}">`];
  const pictures = [{ label: "Cover", url: episode.cover.url! }];
  episode.chapters.forEach((chapter, i) => {
    md.push(`## Kapitel ${i + 1}: ${chapter.title}`, "");
    html.push(`<h2>Kapitel ${i + 1}: ${esc(chapter.title)}</h2>`);
    const images = chapterImages(chapter);
    chapter.text.split(/\n\n/).forEach((paragraph, p) => {
      md.push(paragraph, "");
      html.push(`<p>${esc(paragraph)}</p>`);
      images.forEach((image, imageIndex) => {
        if (image.afterParagraph !== p) return;
        md.push(`![Kapitel ${i + 1}, Bild ${imageIndex + 1}](${file(image.url!).replace(/\\/g, "/")})`, "");
        html.push(`<img loading="lazy" alt="Illustration zu Kapitel ${i + 1}, Szene ${imageIndex + 1}" src="${data(image.url!)}">`);
      });
    });
    images.forEach((image, imageIndex) => pictures.push({ label: `Kapitel ${i + 1} · Bild ${imageIndex + 1}`, url: image.url! }));
  });
  md.push(`## ${episode.collectible.title}`, "", ...episode.collectible.fields.map(f => `- **${f.label}:** ${f.value}`), "", `*${episode.teaser}*`, "");
  html.push(`<aside><h2 style="margin-top:0">${esc(episode.collectible.title)}</h2><dl>${episode.collectible.fields.map(f => `<dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd>`).join("")}</dl></aside><footer>${esc(episode.teaser)}</footer></main></html>`);
  writeFileSync(join(docs, `${key}.md`), md.join("\n"));
  writeFileSync(join(docs, `${key}.html`), html.join("\n"));
  const canvas = createCanvas(1200, 4 * 438);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f5efdf"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < pictures.length; i++) {
    const x = (i % 2) * 600; const y = Math.floor(i / 2) * 438;
    ctx.fillStyle = "#302c28"; ctx.font = "20px sans-serif"; ctx.fillText(pictures[i].label, x + 16, y + 28);
    const image = await loadImage(file(pictures[i].url));
    ctx.drawImage(image, x + 12, y + 42, 576, 384);
  }
  writeFileSync(join(docs, `${key}.bildkontrolle.jpg`), canvas.toBuffer("image/jpeg", 90));
  console.log(`${label}: Markdown, eigenständige HTML-Lesefassung und Kontaktbogen exportiert; ${pictures.length} FLUX-Bilder.`);
}
