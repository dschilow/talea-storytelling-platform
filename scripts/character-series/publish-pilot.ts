/** Publish the measured release pilot, with approved pictures only, and an honest combined cost comparison. */
import { readFile, writeFile } from 'node:fs/promises';
const first = JSON.parse(await readFile('Logs/character-series-v2/funkelflug/episode-1/result.json', 'utf8'));
const art = JSON.parse(await readFile('Logs/character-series-v2/release-checked/episode-1/result.json', 'utf8'));
const second = JSON.parse(await readFile('Logs/character-series-v2/continuity-fix/episode-2/result.json', 'utf8'));
const out = 'docs/figurenserien/pilot-v2/funkelflug';
const textStages = first.stages.filter((s: any) => s.stage === 'series-author' || s.stage === 'series-editorial-review');
const textUSD = textStages.reduce((sum: number, s: any) => sum + s.usage.costUSD, 0);
const totalUSD = textUSD + art.costs.totalUSD;
const picture = (page: number) => page === 0 ? art.pictures.cover : art.pictures.pages.find((p: any) => p[0] === page)?.[1];
const imageMd = (page: number) => picture(page)?.status === 'passed' ? `\n![${page === 0 ? 'Titelbild' : `Kapitel ${page}`}](folge-1-${page === 0 ? 'cover' : `kapitel-${page}`}.webp)\n` : '';
const direction = JSON.parse(await readFile('Logs/character-series-v2/release-checked/episode-1/direction.json', 'utf8'));
const story = art.result;
const md = `# ${story.title}\n\n> Fiktive Testavatare Nora und Ben. Text geprüft. Drei von vier Illustrationen haben die Bildprüfung bestanden; das nicht bestandene Bild wird nicht gezeigt.\n\n${story.description}\n${imageMd(0)}\n` + story.pages.map((p: any) => {
  const after = direction.pages.find((s: any) => s.page === p.order)?.paragraph;
  const content = p.content.split(/\n\n/).map((paragraph: string, i: number) => paragraph + (i + 1 === after ? imageMd(p.order) : '')).join('\n\n');
  return `## ${p.title}\n\n${content}`;
}).join('\n\n') + '\n';
await writeFile(`${out}/folge-1.md`, md);
const report = {
  date: '2026-10-27', sourceText: 'Logs/character-series-v2/funkelflug/episode-1/result.json', sourceImages: 'Logs/character-series-v2/release-checked/episode-1/result.json', sourceContinuation: 'Logs/character-series-v2/continuity-fix/episode-2/result.json',
  fictionalAvatars: ['Nora', 'Ben'], textQuality: story.textQuality, imageModel: art.imageModel, imageCalls: art.pictures.imageCalls,
  images: [art.pictures.cover, ...art.pictures.pages.map((p: any) => p[1])].map((p: any) => ({ page: p.page, status: p.status, qa: p.qa })),
  costUSD: { text: textUSD, artLlm: art.costs.costUSD, imageGeneration: art.costs.imageCostUSD, combined: totalUSD, oldUploadedStory: 0.156457 },
  excluded: 'Production avatar-development call, production database/storage operations. Earlier rejected development experiments are excluded from this per-episode comparison. Text and imagery were measured separately; this was not one authenticated production request.',
  continuation: { title: second.result.title, textCostUSD: second.costs.totalUSD, textQuality: second.result.textQuality },
};
await writeFile(`${out}/vergleich.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ combinedUSD: totalUSD, reductionPercent: (1 - totalUSD / 0.156457) * 100, approved: report.images.filter((p: any) => p.status === 'passed').length, planned: report.images.length }));
