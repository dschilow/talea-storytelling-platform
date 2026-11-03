/**
 * Live A/B of a held story object on the identity sheet (production picture loop, FLUX.2 klein 9B KV + Luna review):
 * the scenes of story 9a84d5e0 ("Die Aufräummaschine hat Hunger"), where the Teddy's own sheet cell came back as a
 * second, seated teddy on 6 of 6 attempts. Variant "held" = current code (the teddy rides in its holder's cell),
 * "cell" = TALEA_SERIES_HELD_PROPS=off (its own cell, as before). First attempts only, no redraws.
 * Alexander and Adrian are played by two Originals portraits (Mats, Jona); Tilda and the Teddy are the real references.
 *
 *   bun --env-file=.env.local run scripts/character-series/held-prop-probe.ts [--variants held,cell] [--seeds 1,2] [--out <dir>]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { generateSeriesImages } from '../../backend/story/character-series/pictures';
import { SERIES_IMAGE_MODEL, SERIES_IMAGE_REVIEW_MODEL } from '../../backend/story/character-series/authoring';
import { buildRunwareTask, createRunwareCaller } from '../../backend/story/library/images';
import { runwareImageModelOptions, runwareReferenceSettings } from '../../backend/ai/runware-image-model-options';
import { extractStorybookChoiceContent, resolveStorybookReasoning } from '../../backend/story/storybook/llm-guards';
import type { StorybookLlm } from '../../backend/story/storybook/llm';
import type { ImageProvider } from '../../backend/story/storybook/images';
import type { VisualEntity } from '../../backend/story/storybook/illustration-stage';

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const variants = opt('--variants', 'held,cell').split(',');
const seeds = opt('--seeds', '1,2').split(',');
const out = resolve(opt('--out', 'Logs/character-series-held-probe'));
const key = process.env.OPENROUTER_API_KEY, runwareKey = process.env.RUNWARE_API_KEY;
if (!key || !runwareKey) throw new Error('OPENROUTER_API_KEY and RUNWARE_API_KEY are needed.');
const inline = async (path: string) => 'data:image/webp;base64,' + (await readFile(path)).toString('base64');
const proxied = async (bucketKey: string) => {
  const response = await fetch('https://backend-2-production-3de1.up.railway.app/story/image?key=' + encodeURIComponent(bucketKey));
  if (!response.ok) throw new Error(`reference download failed: ${response.status}`);
  return 'data:image/jpeg;base64,' + Buffer.from(await response.arrayBuffer()).toString('base64');
};

const entities: VisualEntity[] = [
  { id: 'tilda', name: 'Tilda Tüftel', kind: 'character', role: 'cast', species: 'human', isHuman: true, appearance: 'Tilda Tueftel, nine-year-old girl inventor with curly dark hair, round safety goggles, yellow overalls', forbidden: [], referenceUrl: await inline('frontend/public/library/character-series/leads/tilda-tueftel.webp') },
  { id: 'alex', name: 'Alexander', kind: 'character', role: 'hero', species: 'human', isHuman: true, appearance: 'boy', referenceContext: '8 years old, 132 cm tall, male, short light-blond hair, orange T-shirt', forbidden: [], referenceUrl: await inline('frontend/public/library/series/bruno-der-flunkerfisch/characters/mats.webp') },
  { id: 'adrian', name: 'Adrian', kind: 'character', role: 'hero', species: 'human', isHuman: true, appearance: 'boy', referenceContext: '5 years old, 120 cm tall, male, dark curly hair, orange safety vest', forbidden: [], referenceUrl: await inline('frontend/public/library/series/die-monster-muellabfuhr/characters/jona.webp') },
  { id: 'teddy', name: 'Teddy', kind: 'artifact', role: 'cast', species: 'teddy bear', isHuman: false, appearance: 'Soft teddy bear with a green ribbon around its neck and a small seam on its body.', forbidden: [], referenceAliases: ['teddy bear'],
    referenceUrl: await proxied('images/runware/runware-188587869-0fab32b9-db20-4ba4-b4ea-c7fc6c6666ad.jpg') } as VisualEntity,
];
const beat = (actorId: string, action: string, result: string, framing: string) => ({ actorId, action, result, framing });
// The director's captions of story 9a84d5e0, ids mapped to the stand-ins.
const plan: any = {
  continuity: [{ name: 'Teddy', aliases: ['Teddy', 'teddy bear'], appearance: 'A soft teddy bear with a green ribbon around its neck and a small loose seam.', evidence: [{ page: 4, quote: 'Tief hinter der Schauseite schimmerte das grüne Band, das der Teddy um den Hals trug.' }] }],
  cover: { page: 0, onStage: ['tilda', 'alex', 'adrian'], elements: [], artifactVisible: false, focus: 'scene', scene: 'Inside the workshop, Tilda presses the pedal as a slipper glides neatly into the collection box. Alexander claps and Adrian grins beside her; Teddy rests safely on the low bench. Their delighted reactions frame the machine’s first tidy success, with the workshop visible around them.', visualBeat: beat('tilda', 'steps on the pedal', 'The slipper glides into the collection box as Alexander claps and Adrian grins.', 'wide') },
  pages: [
    { page: 1, paragraph: 20, onStage: ['tilda', 'alex', 'adrian'], elements: [], artifactVisible: false, focus: 'scene', storyQuote: '„Ich heiße Alexander. Das ist Adrian, mein Bruder.“ Er hielt den Teddy hoch. „Kannst du seine Naht reparieren?“', scene: 'At the open workshop doorway, Alexander holds Teddy up while Adrian points to its loose thread. Tilda stands facing the brothers and nods, her attention on the small bear. The three form a clear exchange in the foreground, with the workshop interior visible behind Tilda.', visualBeat: beat('alex', 'raises Teddy', 'Adrian points to the loose thread while Tilda nods toward the bear.', 'medium') },
    { page: 4, paragraph: 19, onStage: ['tilda', 'alex'], elements: ['teddy'], artifactVisible: true, focus: 'scene', storyQuote: 'Tilda beugte sich zu ihm. Tief hinter der Schauseite schimmerte das grüne Band, das der Teddy um den Hals trug.', scene: 'At the collection box inside the workshop, Tilda bends toward the narrow space behind its painted front wall. Teddy’s green ribbon glimmers beneath a corner of cloth, and Alexander stands very still beside her. The two focus on the small glimpse inside the box.', visualBeat: beat('tilda', 'bends toward the collection box', 'The Teddy’s green ribbon shows behind the front wall, with cloth over its loose seam.', 'close') },
    { page: 5, paragraph: 24, onStage: ['tilda', 'alex'], elements: ['teddy'], artifactVisible: true, focus: 'scene', storyQuote: 'Der Teddy kam frei. Seine lockere Naht war noch da, aber nicht größer geworden. Alexander drückte sein Gesicht an das weiche Fell, ganz vorsichtig auf der heilen Seite.', scene: 'Beside the open collection box, Alexander gently presses the freed Teddy against himself, careful to keep away from its loose seam. Tilda stands close by after lifting a sock clear of the bear. Their relief fills the foreground, with the box and rumpled laundry behind them.', visualBeat: beat('alex', 'presses Teddy gently against himself', 'The bear is free and the loose seam has not grown larger.', 'medium') },
    { page: 6, paragraph: 12, onStage: ['tilda', 'alex'], elements: ['teddy'], artifactVisible: true, focus: 'scene', storyQuote: 'Schließlich durfte Alexander den Teddy probeweise fest drücken. Die Naht blieb zu. Kein heller Faden baumelte mehr heraus.', scene: 'At the worktable, Alexander carefully gives Teddy a firm test squeeze while Tilda sits beside him. The repaired seam stays shut, with no pale thread hanging out. Their attention rests on the bear, and the quiet workshop surrounds this small, reassuring check.', visualBeat: beat('alex', 'squeezes Teddy for a test', 'The seam stays closed and no pale thread hangs out.', 'close') },
  ],
};

const llm: StorybookLlm = async request => {
  const started = Date.now();
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(request.timeoutMs || 120000),
    body: JSON.stringify({ model: request.model, max_tokens: request.maxTokens, reasoning: resolveStorybookReasoning(request.model, request.effort, request.role), usage: { include: true }, ...(request.json ? { response_format: { type: 'json_object' } } : {}),
      messages: [{ role: 'system', content: request.system }, { role: 'user', content: request.imageInputs?.length ? [{ type: 'text', text: request.user }, ...request.imageInputs.map(url => ({ type: 'image_url', image_url: { url } }))] : request.user }] }),
  });
  const data: any = await response.json();
  if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${JSON.stringify(data).slice(0, 200)}`);
  const text = extractStorybookChoiceContent(data.choices?.[0]);
  if (!text) throw new Error('empty review');
  return { text, modelUsed: data.model || request.model, usage: { prompt: data.usage?.prompt_tokens || 0, completion: data.usage?.completion_tokens || 0, total: data.usage?.total_tokens || 0, costUSD: data.usage?.cost || 0 }, durationMs: Date.now() - started };
};
const call = createRunwareCaller(runwareKey);
const provider: ImageProvider = async request => {
  const task = buildRunwareTask(request);
  Object.assign(task, { model: SERIES_IMAGE_MODEL, ...runwareImageModelOptions({ model: SERIES_IMAGE_MODEL, CFGScale: 4, outputFormat: 'JPEG' }) });
  Object.assign(task, runwareReferenceSettings(SERIES_IMAGE_MODEL, request.referenceRegions, request.referenceImages.length));
  const response = await call(task);
  return { url: response.imageURL, costUSD: response.cost };
};

const summary: any[] = [];
for (const variant of variants) {
  for (const seed of seeds) {
    if (variant === 'cell') process.env.TALEA_SERIES_HELD_PROPS = 'off'; else delete process.env.TALEA_SERIES_HELD_PROPS;
    const dir = join(out, `${variant}-s${seed}`);
    await mkdir(dir, { recursive: true });
    let reviewCost = 0;
    const counted: StorybookLlm = async request => { const reply = await llm(request); reviewCost += reply.usage.costUSD; return reply; };
    const result = await generateSeriesImages({ illustrations: plan, entities, seed: `held-probe-${seed}`, llm: counted, visionModel: SERIES_IMAGE_REVIEW_MODEL, pageTexts: {}, provider,
      policy: { maxImageCalls: 10, imageRetries: 0, imageConcurrency: 5 } });
    const outcomes = [result.cover!, ...result.pages.values()];
    const tiles: sharp.OverlayOptions[] = [];
    for (const [index, outcome] of outcomes.entries()) {
      const notes = outcome.history?.at(-1)?.notes || [];
      summary.push({ variant, seed, page: outcome.page, status: outcome.status, notes });
      console.log(`${variant} s${seed} p${outcome.page}: ${outcome.status}${notes.length ? ' · ' + notes.join(' | ').slice(0, 220) : ''}`);
      if (!outcome.url) continue;
      const image = Buffer.from(await (await fetch(outcome.url)).arrayBuffer());
      await writeFile(join(dir, `p${outcome.page}.jpg`), image);
      const label = `<svg xmlns="http://www.w3.org/2000/svg" width="608" height="30"><rect width="608" height="30" fill="black" opacity="0.75"/><text x="8" y="21" font-family="Arial" font-size="17" fill="${outcome.status === 'passed' ? '#30d158' : '#ff453a'}">${variant} s${seed} p${outcome.page}: ${outcome.status}</text></svg>`;
      tiles.push({ input: await sharp(image).resize(608, 416, { fit: 'contain', background: '#111' }).composite([{ input: Buffer.from(label), top: 0, left: 0 }]).jpeg().toBuffer(), left: (index % 3) * 608, top: Math.floor(index / 3) * 416 });
    }
    await sharp({ create: { width: 608 * 3, height: 416 * 2, channels: 3, background: '#111' } }).composite(tiles).jpeg({ quality: 80 }).toFile(join(dir, 'sheet.jpg'));
    console.log(`${variant} s${seed}: ${outcomes.filter(o => o.status === 'passed').length}/${outcomes.length} passed · pictures ${(result.imageCostUSD * 100).toFixed(2)} ct · reviews ${(reviewCost * 100).toFixed(2)} ct`);
  }
}
delete process.env.TALEA_SERIES_HELD_PROPS;
await writeFile(join(out, 'summary.json'), JSON.stringify(summary, null, 2));
