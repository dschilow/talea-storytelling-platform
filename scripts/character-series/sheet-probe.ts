/**
 * Draws chosen pictures of a story with the production sheet and prompt (captured from the picture loop with a stub,
 * free), FLUX.2 klein 9B KV and a few seeds, and asks Jev the fixture's yes/no questions per picture (≈ 0.01 ct). No
 * Luna review: the contact sheet is for the eye. Fixture: scripts/character-series/fixtures/<name>.json with
 * { entities: [{ ...VisualEntity, portrait: "frontend/public/…" | "bucket:images/…" }], plan, draw: [page], checks: { page: { id: question } } }.
 *
 *   bun --env-file=.env.local run scripts/character-series/sheet-probe.ts --fixture <file> [--seeds 3] [--pages 2,4] [--out <dir>]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import sharp from 'sharp';
import { generateSeriesImages } from '../../backend/story/character-series/pictures';
import { SERIES_IMAGE_MODEL } from '../../backend/story/character-series/authoring';
import { buildRunwareTask, createRunwareCaller } from '../../backend/story/library/images';
import { runwareImageModelOptions } from '../../backend/ai/runware-image-model-options';
import { createOpenRouterJevPort } from '../../backend/story/storybook/jev-openrouter';
import type { VisualEntity } from '../../backend/story/storybook/illustration-stage';

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const fixtureFile = resolve(opt('--fixture', ''));
const seeds = Number(opt('--seeds', '3'));
const fixture = JSON.parse(await readFile(fixtureFile, 'utf8'));
const pages: number[] = args.includes('--pages') ? opt('--pages', '').split(',').map(Number) : fixture.draw;
const out = resolve(opt('--out', `Logs/character-series-held-probe/${basename(fixtureFile, '.json')}`));
await mkdir(out, { recursive: true });
const jev = createOpenRouterJevPort(() => process.env.OPENROUTER_API_KEY)!;
const call = createRunwareCaller(process.env.RUNWARE_API_KEY!);
const portrait = async (source: string) => source.startsWith('bucket:')
  ? 'data:image/jpeg;base64,' + Buffer.from(await (await fetch('https://backend-2-production-3de1.up.railway.app/story/image?key=' + encodeURIComponent(source.slice(7)))).arrayBuffer()).toString('base64')
  : 'data:image/webp;base64,' + (await readFile(source)).toString('base64');
const entities: VisualEntity[] = await Promise.all(fixture.entities.map(async ({ portrait: source, ...entity }: any) => ({ forbidden: [], ...entity, referenceUrl: source ? await portrait(source) : undefined })));

const captured = new Map<number, { prompt: string; reference: string }>();
// The production model: without it the prompt binds names to region tokens (FLUX 3), which production never sends.
await generateSeriesImages({ illustrations: fixture.plan, entities, seed: 'capture', visionModel: 'stub', pageTexts: {}, imageModel: SERIES_IMAGE_MODEL,
  provider: async request => { captured.set(request.page!, { prompt: request.prompt, reference: request.referenceImages[0] }); return { url: `https://example.test/${request.page}.jpg` }; },
  llm: async () => ({ text: JSON.stringify({ visibleIds: entities.map(e => e.id), identityById: Object.fromEntries(entities.map(e => [e.id, 1])), posing: false, primaryActionClear: true, sceneMatch: 1, styleMatch: 1, defects: [] }), modelUsed: 'stub', usage: { prompt: 0, completion: 0, total: 0, costUSD: 0 }, durationMs: 0 }),
  policy: { maxImageCalls: 20, imageRetries: 0, imageConcurrency: 1 } } as any);

const tiles: sharp.OverlayOptions[] = [];
const rows: any[] = [];
let index = 0, costUSD = 0;
for (const page of pages) {
  const { prompt, reference } = captured.get(page)!;
  await writeFile(join(out, `prompt-p${page}.txt`), prompt);
  if (reference) await writeFile(join(out, `sheet-p${page}.jpg`), Buffer.from(reference.split(',')[1], 'base64'));
  for (let seed = 1; seed <= seeds; seed += 1) {
    const task = buildRunwareTask({ prompt, width: 1216, height: 832, seed: 5300 + page * 10 + seed, referenceImages: reference ? [reference] : [] });
    Object.assign(task, { model: SERIES_IMAGE_MODEL, ...runwareImageModelOptions({ model: SERIES_IMAGE_MODEL, CFGScale: 4, outputFormat: 'JPEG' }) });
    const response = await call(task);
    costUSD += response.cost || 0;
    const image = Buffer.from(await (await fetch(response.imageURL!)).arrayBuffer());
    await writeFile(join(out, `p${page}-s${seed}.jpg`), image);
    const questions = Object.fromEntries(Object.entries(fixture.checks[page] || {}).map(([id, instructions]) => [id, { type: 'noul' as const, instructions: String(instructions) }]));
    const reply = Object.keys(questions).length ? await jev({ imageUrl: `data:image/jpeg;base64,${image.toString('base64')}`, questions }).catch(() => undefined) : undefined;
    costUSD += reply?.costUSD || 0;
    const answers = reply?.answers || {};
    rows.push({ page, seed, ...answers });
    const summary = Object.entries(answers).map(([id, value]) => `${id} ${Math.round(Number(value) * 100)}%`).join(' · ');
    console.log(`p${page} s${seed}: ${summary}`);
    const label = `<svg xmlns="http://www.w3.org/2000/svg" width="456" height="26"><rect width="456" height="26" fill="black" opacity="0.75"/><text x="6" y="18" font-family="Arial" font-size="14" fill="#ffd60a">p${page} s${seed} · ${summary.replace(/[<&>]/g, '')}</text></svg>`;
    tiles.push({ input: await sharp(image).resize(456, 312).composite([{ input: Buffer.from(label), top: 0, left: 0 }]).jpeg().toBuffer(), left: (index % seeds) * 456, top: Math.floor(index / seeds) * 312 });
    index += 1;
  }
}
await sharp({ create: { width: 456 * seeds, height: 312 * pages.length, channels: 3, background: '#111' } }).composite(tiles).jpeg({ quality: 80 }).toFile(join(out, 'sheet.jpg'));
await writeFile(join(out, 'results.json'), JSON.stringify(rows, null, 2));
console.log(`${rows.length} pictures · ${(costUSD * 100).toFixed(2)} ct`);
