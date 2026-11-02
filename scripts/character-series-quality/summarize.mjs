import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';

// Offline only: preserve the real trial measurements, including billed failed attempts.
const root = resolve(process.argv[2] || 'output/figurenwelt-quality-final-2026-11-02');
const docs = resolve('docs/figurenserien/qualitaet-pilot-2026-11-02');
await mkdir(docs, { recursive: true });
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const bills = async path => (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
const ids = ['tilda-tueftel', 'kapitaen-blubbert', 'funkelflug'];
const stories = [];
for (const id of ids) {
  const dir = join(root, id), r = await json(join(dir, 'result.json'));
  const pictures = [r.images.cover, ...r.images.pages.map(([, value]) => value)];
  stories.push({ seriesId: id, title: r.title, textWords: r.text.pages.map(p => p.content).join(' ').split(/\s+/).length,
    approvedPictures: pictures.filter(p => p.url && ['passed', 'flawed'].includes(p.status)).length,
    plannedPictures: pictures.length, imageCalls: r.images.imageCalls, imageCostUSD: r.imageCostUSD,
    reportedApiCashUSD: r.actualApiCashUSD, bookReview: { status: r.images.bookReview.status, issues: r.images.bookReview.issues },
    releaseReady: pictures.every(p => p.url && ['passed', 'flawed'].includes(p.status)) && r.images.bookReview.status === 'passed' });
  await copyFile(join(dir, 'story.md'), join(docs, `${id}.md`));
  const files = (await readdir(dir)).filter(f => /^image-.*\.jpg$/.test(f)).sort();
  const tiles = [];
  for (let i = 0; i < files.length; i++) {
    const x = i % 4 * 280, y = Math.floor(i / 4) * 300;
    tiles.push({ input: await sharp(join(dir, files[i])).resize(276, 270, { fit: 'inside' }).toBuffer(), left: x, top: y });
    tiles.push({ input: Buffer.from(`<svg width="280" height="25"><text x="3" y="17" font-size="13">${files[i]}</text></svg>`), left: x, top: y + 273 });
  }
  if (files.length) {
    await sharp({ create: { width: 1120, height: Math.ceil(files.length / 4) * 300, channels: 3, background: '#fff' } }).composite(tiles).jpeg({ quality: 77 }).toFile(join(dir, 'candidates.jpg'));
    await copyFile(join(dir, 'candidates.jpg'), join(docs, `${id}-bilder.jpg`));
  }
}
const finalBilling = await bills(join(root, 'billing.jsonl'));
const developmentBilling = await bills(resolve('output/figurenwelt-quality-2026-11-02/billing.jsonl'));
const sum = rows => rows.reduce((total, row) => total + (Number(row.costUSD) || 0), 0);
const costs = { finalApiUSD: sum(finalBilling), developmentApiUSD: sum(developmentBilling), totalReportedApiUSD: sum([...finalBilling, ...developmentBilling]),
  finalByModelUSD: Object.fromEntries([...new Set(finalBilling.map(row => row.model))].map(model => [model, sum(finalBilling.filter(row => row.model === model))])),
  subscriptionCostIncluded: false, note: 'Provider-reported charges only. Codex subscription quota has no allocated cash price here. A connection failure before usage was returned can leave an unknown charge. This is not an incremental production-cost comparison.' };
const report = { date: '2026-11-02', pipeline: 'character-series-quality-v1', baseline: 'character-series-v1 v25',
  method: 'Three real local generations, fictional children, public references, manual manuscript and contact-sheet review. No matched baseline or blinded evaluation.',
  costs, stories };
await writeFile(join(docs, 'messwerte.json'), JSON.stringify(report, null, 2) + '\n');
await writeFile(join(root, 'index.html'), `<!doctype html><html lang="de"><meta charset="utf-8"><title>Figurenwelt Qualitäts-Pilot</title><style>body{max-width:900px;margin:40px auto;padding:20px;font:18px/1.6 system-ui;background:#fffaf0}img{max-width:100%}</style><h1>Figurenwelt Qualitäts-Pilot</h1><p>Experimentelle Ergebnisse. Abgelehnte Bilder sind ausschließlich in den beschrifteten Kontaktbögen sichtbar.</p>${stories.map(s => `<h2>${s.title}</h2><p>${s.approvedPictures}/${s.plannedPictures} Bilder freigegeben · API: $${s.reportedApiCashUSD.toFixed(4)} · Buchfreigabe: ${s.releaseReady ? 'ja' : 'nein'}</p><p><a href="${s.seriesId}/book.html">Lesefassung</a> · <a href="${s.seriesId}/story.md">Text</a> · <a href="${s.seriesId}/candidates.jpg">Alle Bildversuche</a></p>`).join('')}<p>API gesamt einschließlich Entwicklung: $${costs.totalReportedApiUSD.toFixed(4)}. Hinzu kommt Codex-Kontingent.</p></html>`);
console.log(JSON.stringify(report, null, 2));
