/**
 * Does the held-object sheet work for other objects than the Teddy? Generates object references the way production
 * does (visual-references.ts), captures the production prompts and sheets with a stub provider, then draws "held" (current
 * code) and "cell" (TALEA_SERIES_HELD_PROPS=off) with a few seeds. Jev counts the objects and names the holder.
 *
 *   bun --env-file=.env.local run scripts/character-series/held-prop-generic.ts [--seeds 3] [--out <dir>]
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { generateSeriesImages } from '../../backend/story/character-series/pictures';
import { seriesObjectReferencePrompt } from '../../backend/story/character-series/visual-references';
import { SERIES_IMAGE_MODEL } from '../../backend/story/character-series/authoring';
import { buildRunwareTask, createRunwareCaller } from '../../backend/story/library/images';
import { runwareImageModelOptions } from '../../backend/ai/runware-image-model-options';
import { createOpenRouterJevPort } from '../../backend/story/storybook/jev-openrouter';
import type { VisualEntity } from '../../backend/story/storybook/illustration-stage';

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const seeds = Number(opt('--seeds', '3'));
const out = resolve(opt('--out', 'Logs/character-series-held-probe/generic'));
await mkdir(out, { recursive: true });
const call = createRunwareCaller(process.env.RUNWARE_API_KEY!);
const jev = createOpenRouterJevPort(() => process.env.OPENROUTER_API_KEY)!;
const draw = async (prompt: string, seed: number, references: string[], width = 1216, height = 832) => {
  const task = buildRunwareTask({ prompt, width, height, seed, referenceImages: references });
  Object.assign(task, { model: SERIES_IMAGE_MODEL, ...runwareImageModelOptions({ model: SERIES_IMAGE_MODEL, CFGScale: 4, outputFormat: 'JPEG' }) });
  const response = await call(task);
  return Buffer.from(await (await fetch(response.imageURL!)).arrayBuffer());
};
const inline = async (path: string) => 'data:image/webp;base64,' + (await readFile(path)).toString('base64');
// Object portraits exactly as production asks for them (visual-references.ts), cached per object.
const object = async (id: string, name: string, appearance: string, aliases: string[]) => {
  const entity = { id, name, kind: 'artifact', role: 'cast', species: 'object', isHuman: false, appearance, forbidden: [], referenceAliases: aliases } as VisualEntity;
  const file = join(out, `ref-${id}.jpg`);
  if (!existsSync(file)) await writeFile(file, await draw(seriesObjectReferencePrompt(entity), 4242, [], 768, 768));
  return { ...entity, referenceUrl: 'data:image/jpeg;base64,' + (await readFile(file)).toString('base64') } as VisualEntity;
};

const entities: VisualEntity[] = [
  { id: 'tilda', name: 'Tilda Tüftel', kind: 'character', role: 'cast', species: 'human', isHuman: true, appearance: 'Tilda Tueftel, nine-year-old girl inventor with curly dark hair, round safety goggles, yellow overalls', forbidden: [], referenceUrl: await inline('frontend/public/library/character-series/leads/tilda-tueftel.webp') },
  { id: 'alex', name: 'Alexander', kind: 'character', role: 'hero', species: 'human', isHuman: true, appearance: 'boy', referenceContext: '8 years old, 132 cm tall, male, short light-blond hair, orange T-shirt', forbidden: [], referenceUrl: await inline('frontend/public/library/series/bruno-der-flunkerfisch/characters/mats.webp') },
  { id: 'adrian', name: 'Adrian', kind: 'character', role: 'hero', species: 'human', isHuman: true, appearance: 'boy', referenceContext: '5 years old, 120 cm tall, male, dark curly hair, orange safety vest', forbidden: [], referenceUrl: await inline('frontend/public/library/series/die-monster-muellabfuhr/characters/jona.webp') },
  await object('clamp', 'Lieblingsklammer', 'A small red wooden clamp with a silver spring', ['clamp', 'red clamp']),
  await object('lantern', 'Laterne', 'A round tin lantern with a blue glass window and a wire handle', ['lantern', 'blue lantern']),
];
const beat = (actorId: string, action: string, result: string, framing: string) => ({ actorId, action, result, framing });
const plan: any = {
  cover: { page: 0, onStage: ['tilda', 'alex'], elements: [], artifactVisible: false, focus: 'scene', scene: 'Tilda and Alexander wave from the open workshop door on a sunny morning, tools hanging on the wall behind them.', visualBeat: beat('tilda', 'waves from the door', 'Alexander waves back beside her.', 'wide') },
  pages: [
    { page: 1, paragraph: 1, onStage: ['tilda', 'alex'], elements: ['clamp'], artifactVisible: true, focus: 'scene', storyQuote: 'Alexander hielt die rote Klammer gegen das Licht.', scene: 'At the workbench, Alexander holds Tilda’s small red clamp up to the light while Tilda leans in to look at it closely.', visualBeat: beat('alex', 'holds the red clamp up to the light', 'Tilda leans in to look at the clamp.', 'medium') },
    { page: 2, paragraph: 1, onStage: ['tilda', 'alex', 'adrian'], elements: [], artifactVisible: false, focus: 'scene', storyQuote: 'Adrian trug die Laterne voran.', scene: 'In the dark garden shed, Adrian carries the blue lantern in front of him while Tilda and Alexander follow close behind, their faces lit by its glow.', visualBeat: beat('adrian', 'carries the blue lantern', 'The lantern lights the way for Tilda and Alexander.', 'wide') },
  ],
};
const capture = async (variant: string) => {
  if (variant === 'cell') process.env.TALEA_SERIES_HELD_PROPS = 'off'; else delete process.env.TALEA_SERIES_HELD_PROPS;
  const captured = new Map<number, { prompt: string; reference: string }>();
  await generateSeriesImages({ illustrations: plan, entities, seed: 'capture', visionModel: 'stub', pageTexts: {},
    provider: async request => { captured.set(request.page!, { prompt: request.prompt, reference: request.referenceImages[0] }); return { url: `https://example.test/${request.page}.jpg` }; },
    llm: async () => ({ text: JSON.stringify({ visibleIds: ['tilda', 'alex', 'adrian'], identityById: { tilda: 1, alex: 1, adrian: 1 }, posing: false, primaryActionClear: true, sceneMatch: 1, styleMatch: 1, defects: [] }), modelUsed: 'stub', usage: { prompt: 0, completion: 0, total: 0, costUSD: 0 }, durationMs: 0 }),
    policy: { maxImageCalls: 10, imageRetries: 0, imageConcurrency: 1 } } as any);
  delete process.env.TALEA_SERIES_HELD_PROPS;
  return captured;
};
const checks: Record<number, Record<string, { type: 'noul'; instructions: string }>> = {
  1: { two: { type: 'noul', instructions: 'The picture shows two or more red clamps.' }, holder: { type: 'noul', instructions: 'The blond boy in the orange T-shirt holds a small red clamp in his hand.' }, giant: { type: 'noul', instructions: 'The red clamp is huge, about as big as a child\'s head or bigger.' } },
  2: { two: { type: 'noul', instructions: 'The picture shows two or more lanterns.' }, holder: { type: 'noul', instructions: 'The small boy with dark curly hair and an orange vest carries a lantern.' }, giant: { type: 'noul', instructions: 'The lantern is huge, about as big as a child or bigger.' } },
};
const rows: any[] = [];
for (const variant of ['held', 'cell']) {
  const captured = await capture(variant);
  const tiles: sharp.OverlayOptions[] = [];
  let index = 0;
  for (const page of [1, 2]) {
    const { prompt, reference } = captured.get(page)!;
    await writeFile(join(out, `prompt-${variant}-p${page}.txt`), prompt);
    await writeFile(join(out, `sheet-${variant}-p${page}.jpg`), Buffer.from(reference.split(',')[1], 'base64'));
    for (let seed = 1; seed <= seeds; seed += 1) {
      const image = await draw(prompt, 9100 + page * 10 + seed, [reference]);
      await writeFile(join(out, `${variant}-p${page}-s${seed}.jpg`), image);
      const reply = await jev({ imageUrl: `data:image/jpeg;base64,${image.toString('base64')}`, questions: checks[page] }).catch(() => undefined);
      const row = { variant, page, seed, ...reply?.answers };
      rows.push(row);
      const pct = (v?: number) => `${Math.round((v ?? NaN) * 100)}%`;
      console.log(`${variant} p${page} s${seed}: 2+ ${pct(row.two)} · right holder ${pct(row.holder)} · huge ${pct(row.giant)}`);
      const label = `<svg xmlns="http://www.w3.org/2000/svg" width="456" height="26"><rect width="456" height="26" fill="black" opacity="0.75"/><text x="6" y="18" font-family="Arial" font-size="15" fill="#ffd60a">${variant} p${page} s${seed} · 2+ ${pct(row.two)} · holder ${pct(row.holder)}</text></svg>`;
      tiles.push({ input: await sharp(image).resize(456, 312).composite([{ input: Buffer.from(label), top: 0, left: 0 }]).jpeg().toBuffer(), left: (index % seeds) * 456, top: Math.floor(index / seeds) * 312 });
      index += 1;
    }
  }
  await sharp({ create: { width: 456 * seeds, height: 312 * 2, channels: 3, background: '#111' } }).composite(tiles).jpeg({ quality: 80 }).toFile(join(out, `sheet-${variant}.jpg`));
}
await writeFile(join(out, 'results.json'), JSON.stringify(rows, null, 2));
