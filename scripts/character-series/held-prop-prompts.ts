/**
 * Prompt variants for a held object, on the production sheet and prompt of story 9a84d5e0 (see held-prop-probe.ts):
 * the production prompts are captured from the picture loop with a stub provider (free), then FLUX.2 klein 9B KV draws
 * each variant with a few seeds. Jev counts the teddies (≈ 0.01 ct a picture); the contact sheets are for the eye.
 *
 *   bun --env-file=.env.local run scripts/character-series/held-prop-prompts.ts [--pages 1,5,6] [--seeds 3] [--variants base,lean,count,hands]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { generateSeriesImages } from '../../backend/story/character-series/pictures';
import { SERIES_IMAGE_MODEL } from '../../backend/story/character-series/authoring';
import { buildRunwareTask, createRunwareCaller } from '../../backend/story/library/images';
import { runwareImageModelOptions } from '../../backend/ai/runware-image-model-options';
import { createOpenRouterJevPort } from '../../backend/story/storybook/jev-openrouter';
import type { VisualEntity } from '../../backend/story/storybook/illustration-stage';

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const pages = opt('--pages', '1,5,6').split(',').map(Number);
const seeds = Number(opt('--seeds', '3'));
const variants = opt('--variants', 'base,lean,count,hands').split(',');
const out = resolve(opt('--out', 'Logs/character-series-held-probe/prompts'));
const runwareKey = process.env.RUNWARE_API_KEY!;
const jev = createOpenRouterJevPort(() => process.env.OPENROUTER_API_KEY)!;
const inline = async (path: string) => 'data:image/webp;base64,' + (await readFile(path)).toString('base64');
const teddyUrl = 'data:image/jpeg;base64,' + Buffer.from(await (await fetch('https://backend-2-production-3de1.up.railway.app/story/image?key=' + encodeURIComponent('images/runware/runware-188587869-0fab32b9-db20-4ba4-b4ea-c7fc6c6666ad.jpg'))).arrayBuffer()).toString('base64');
const entities: VisualEntity[] = [
  { id: 'tilda', name: 'Tilda Tüftel', kind: 'character', role: 'cast', species: 'human', isHuman: true, appearance: 'Tilda Tueftel, nine-year-old girl inventor with curly dark hair, round safety goggles, yellow overalls', forbidden: [], referenceUrl: await inline('frontend/public/library/character-series/leads/tilda-tueftel.webp') },
  { id: 'alex', name: 'Alexander', kind: 'character', role: 'hero', species: 'human', isHuman: true, appearance: 'boy', referenceContext: '8 years old, 132 cm tall, male, short light-blond hair, orange T-shirt', forbidden: [], referenceUrl: await inline('frontend/public/library/series/bruno-der-flunkerfisch/characters/mats.webp') },
  { id: 'adrian', name: 'Adrian', kind: 'character', role: 'hero', species: 'human', isHuman: true, appearance: 'boy', referenceContext: '5 years old, 120 cm tall, male, dark curly hair, orange safety vest', forbidden: [], referenceUrl: await inline('frontend/public/library/series/die-monster-muellabfuhr/characters/jona.webp') },
  { id: 'teddy', name: 'Teddy', kind: 'artifact', role: 'cast', species: 'teddy bear', isHuman: false, appearance: 'Soft teddy bear with a green ribbon around its neck and a small seam on its body.', forbidden: [], referenceAliases: ['teddy bear'], referenceUrl: teddyUrl } as VisualEntity,
];
const plan: any = JSON.parse(await readFile(resolve('scripts/character-series/fixtures/aufraummaschine-plan.json'), 'utf8'));

// 1) The production prompts and sheets, captured without a paid call.
const captured = new Map<number, { prompt: string; reference: string }>();
await generateSeriesImages({ illustrations: plan, entities, seed: 'capture', visionModel: 'stub', pageTexts: {},
  provider: async request => { captured.set(request.page!, { prompt: request.prompt, reference: request.referenceImages[0] }); return { url: `https://example.test/${request.page}.jpg` }; },
  llm: async () => ({ text: JSON.stringify({ visibleIds: ['tilda', 'alex', 'adrian'], identityById: { tilda: 1, alex: 1, adrian: 1 }, posing: false, primaryActionClear: true, sceneMatch: 1, styleMatch: 1, defects: [] }), modelUsed: 'stub', usage: { prompt: 0, completion: 0, total: 0, costUSD: 0 }, durationMs: 0 }),
  policy: { maxImageCalls: 10, imageRetries: 0, imageConcurrency: 1 } } as any);
await mkdir(out, { recursive: true });
for (const page of pages) {
  const sheet = captured.get(page)!.reference;
  await writeFile(join(out, `sheet-p${page}.jpg`), Buffer.from(sheet.split(',')[1], 'base64'));
  await writeFile(join(out, `prompt-p${page}-base.txt`), captured.get(page)!.prompt);
}

// 2) Variants of the captured text.
const holderOf: Record<number, string> = { 1: 'Alexander', 5: 'Alexander', 6: 'Alexander' };
const others: Record<number, string[]> = { 1: ['Tilda Tüftel', 'Adrian'], 5: ['Tilda Tüftel'], 6: ['Tilda Tüftel'] };
const busy: Record<string, string> = { 'Tilda Tüftel': 'Tilda Tüftel keeps her own hands on her own task: she holds a striped sock or rests her hands on the table edge.', Adrian: 'Adrian points with one finger and keeps his other hand at his side.' };
const lean = (prompt: string) => prompt.split('\n')
  .filter(line => !/^OBJECT REFERENCES/.test(line))
  .map(line => /^Teddy: /.test(line) ? '' : line)
  .filter(Boolean).join('\n').replace(/STORY-CRITICAL OBJECT DESIGNS, only for objects already in this scene:\n(?=Keep)/, '').replace(/^Keep the same material, shape, scale and distinctive parts\. Exactly one copy of each singular story object; no matching toy on a background shelf\. Current state and placement follow the scene, never a reference pose\.\n/m, '');
const variantPrompt = (variant: string, page: number, prompt: string): string => {
  const holder = holderOf[page];
  const count = `There is exactly one teddy bear in the whole picture, and ${holder} holds it.`;
  const [scene, ...rest] = (variant === 'base' ? prompt : lean(prompt)).split('\n');
  if (variant === 'base' || variant === 'lean') return [scene, ...rest].join('\n');
  if (variant === 'count') return [scene, count, ...rest].join('\n');
  return [scene, count, ...others[page].map(name => busy[name]), ...rest].join('\n');
};

const call = createRunwareCaller(runwareKey);
const rows: any[] = [];
for (const variant of variants) {
  const tiles: sharp.OverlayOptions[] = [];
  let index = 0;
  for (const page of pages) {
    const { prompt, reference } = captured.get(page)!;
    const text = variantPrompt(variant, page, prompt);
    await writeFile(join(out, `prompt-p${page}-${variant}.txt`), text);
    for (let seed = 1; seed <= seeds; seed += 1) {
      const task = buildRunwareTask({ prompt: text, width: 1216, height: 832, seed: 7000 + page * 10 + seed, referenceImages: [reference] });
      Object.assign(task, { model: SERIES_IMAGE_MODEL, ...runwareImageModelOptions({ model: SERIES_IMAGE_MODEL, CFGScale: 4, outputFormat: 'JPEG' }) });
      const response = await call(task);
      const image = Buffer.from(await (await fetch(response.imageURL!)).arrayBuffer());
      await writeFile(join(out, `${variant}-p${page}-s${seed}.jpg`), image);
      const reply = await jev({ imageUrl: `data:image/jpeg;base64,${image.toString('base64')}`, questions: {
        two: { type: 'noul', instructions: 'The picture shows two or more teddy bears.' },
        holder: { type: 'noul', instructions: `The boy in the orange shirt holds a teddy bear.` },
      } }).catch(() => undefined);
      const row = { variant, page, seed, two: reply?.answers.two, holder: reply?.answers.holder, costUSD: response.cost };
      rows.push(row);
      console.log(`${variant.padEnd(6)} p${page} s${seed}: two teddies ${Math.round((row.two ?? NaN) * 100)}% · boy holds ${Math.round((row.holder ?? NaN) * 100)}%`);
      const label = `<svg xmlns="http://www.w3.org/2000/svg" width="456" height="26"><rect width="456" height="26" fill="black" opacity="0.75"/><text x="6" y="18" font-family="Arial" font-size="15" fill="#ffd60a">${variant} p${page} s${seed} · 2+ teddies ${Math.round((row.two ?? 0) * 100)}%</text></svg>`;
      tiles.push({ input: await sharp(image).resize(456, 312).composite([{ input: Buffer.from(label), top: 0, left: 0 }]).jpeg().toBuffer(), left: (index % seeds) * 456, top: Math.floor(index / seeds) * 312 });
      index += 1;
    }
  }
  await sharp({ create: { width: 456 * seeds, height: 312 * pages.length, channels: 3, background: '#111' } }).composite(tiles).jpeg({ quality: 80 }).toFile(join(out, `sheet-${variant}.jpg`));
}
await writeFile(join(out, 'results.json'), JSON.stringify(rows, null, 2));
for (const variant of variants) {
  const mine = rows.filter(row => row.variant === variant);
  console.log(`${variant}: Jev "2+ teddies" ≥ 0.5 on ${mine.filter(row => (row.two ?? 0) >= 0.5).length}/${mine.length}`);
}
