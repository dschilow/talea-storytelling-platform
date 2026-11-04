/** Generate two original style references for the Figurenwelt wizard.
 * bun scripts/image-bench/prepare-wizard-image-styles.ts [--run]
 */
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { FLUX3_KLEIN_MODEL, runwareImageModelOptions } from '../../backend/ai/runware-image-model-options';
import { FLUX2_KLEIN_9B_KV_MODEL } from '../../backend/ai/runware-image-model-options';
import { withTaleaImageStyle } from '../../backend/ai/image-style';
import { generateSeriesImages } from '../../backend/story/character-series/pictures';
import { encodeReferenceSprite, renderIdentitySprite } from '../../backend/story/image-reference-sprite';
import type { ImageRequest } from '../../backend/story/storybook/images';
import type { VisualEntity } from '../../backend/story/storybook/illustration-stage';

const root = 'output/wizard-image-styles-v2-2026-11-03';
const assets = 'frontend/public/library/image-styles';
const previous = 'output/figurenwelt-flux2-direkte-stilvorlagen-2026-11-03';
const run = process.argv.includes('--run');
for (const dir of [root, assets]) await mkdir(dir, { recursive: true });
let apiKey = '';
if (run) {
  apiKey = process.env.RUNWARE_API_KEY || process.env.RunwareApiKey || '';
  if (!apiKey && existsSync('.env.local')) {
    const bytes = await readFile('.env.local');
    const env = bytes[0] === 0xff && bytes[1] === 0xfe ? bytes.toString('utf16le') : bytes.toString('utf8');
    apiKey = env.match(/^[ \t]*RUNWARE_API_KEY[ \t]*=[ \t]*([^\r\n]*)/m)?.[1]?.trim().replace(/^["']|["']$/g, '') || '';
  }
  if (!apiKey) {
    const raw = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "railway variables --service 'backend 2' --environment production --json"], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const vars = JSON.parse(raw); apiKey = vars.RUNWARE_API_KEY || vars.RunwareApiKey || '';
  }
  if (!apiKey) throw new Error('Runware key unavailable; no credentials printed.');
}
const previousResult = JSON.parse(await readFile(join(previous, 'results.json'), 'utf8'));
const previousExperiment = JSON.parse(await readFile(join(previous, 'experiment.json'), 'utf8'));
let committed = previousResult.combinedCostUSD + previousExperiment.previousUnpricedReservationUSD;
// Keep the first, rejected visual take in the common budget and preserve its files.
const firstTake = 'output/wizard-image-styles-2026-11-03';
for (const dir of [firstTake, join(firstTake, 'probes')]) {
  if (!existsSync(dir)) continue;
  for (const file of await readdir(dir)) if (file.endsWith('.result.json')) {
    const receipt = JSON.parse(await readFile(join(dir, file), 'utf8'));
    committed += receipt.costUSD ?? 0.06;
  }
}
const specs = [
  { id: 'colored-pencil', source: 'lichter-aquarellwald', title: 'Buntstift & Schraffur', medium: 'COLORED PENCIL DRAWING ON ROUGH IVORY PAPER. Every colored area is built from clearly visible individual colored-pencil strokes: loose parallel hatching, curved scribbles following form, crosshatching in shadows, broken grainy waxy pigment catching on the tooth of the paper. Uncolored ivory paper remains visible between the strokes, including on faces, hair and clothes. Light warm-brown sketch contours, tangled loose curls, rosy cheeks, flat gentle shapes and slender informal gestures. Fresh leaf-green, warm ochre, terracotta and pale sky-blue pencils. The foreground and distance are visibly DRAWN with individual lines, not smoothly filled or washed. No watercolor wash, no smooth painted shading, no digitally airbrushed gradients.' },
  { id: 'painterly-adventure', source: 'wilde-bilderbuch-abenteuer', title: 'Wilde Bilderbuch-Abenteuer', medium: 'A LUSH EXPRESSIVE BRUSH-PAINTED ADVENTURE BOOK. Follow IMAGE 1 closely in its wildly caricatured character proportions: small child with oversized lively round eyes, huge fluffy rounded creature with a comically exaggerated face, bouncy organic silhouettes. Opaque thick gouache paint, broad irregular bristle marks, chipped dry-brush edges, sculpted volumes in layered light and shadow. Faces, hair, cloth and fur are shaped with colored PAINT MASSES rather than fine ink contours or pencil hatching. Saturated mossy emerald foreground, deep ultramarine and misty blue depth, amber rim light and luminous painted highlights. Dense theatrical full-bleed environment, boldly overlapping mushrooms and plants. Preserve a rough hand-painted surface; no meticulous brown line drawing, no pale pencil drawing, no watercolor wash.' },
];
const scene = 'An ORIGINAL woodland story scene with exactly two new friends. A small red-curly-haired human child wearing a peach raincoat and green boots crouches on the left bank of a little stream, launching a plain folded paper boat. On the right bank a large friendly plum-purple furry creature with a turquoise tuft of hair leans forward and blows gently toward the boat, cheeks puffed and eyes comically wide. The child laughs in surprise. Their faces and hands are clearly visible. A low fallen log, several tall mushrooms and ferns frame the stream; the woodland recedes behind them. Translate the new cast into the reference\'s character design language, without copying the source cast. This is one coherent wordless narrative picture, without titles, logos or panels.';
const results: any[] = [];
for (const spec of specs) {
  const bytes = await readFile(join(previous, 'sources', `${spec.source}.jpg`));
  const prompt = `Create a new original children\'s picture-book illustration. IMAGE 1 supplies its artistic medium and CHARACTER DESIGN LANGUAGE, including facial geometry, proportions, edges and expressive gestures. The scene below supplies the NEW cast, action and place.\n${spec.medium}\n${scene}\n${spec.medium}\nApply this material and mark-making visibly to the people and creature as well as the environment.`;
  const task = { taskType: 'imageInference', model: FLUX3_KLEIN_MODEL, numberResults: 1, outputType: ['URL'], includeCost: true,
    ...runwareImageModelOptions({ model: FLUX3_KLEIN_MODEL, steps: 16, outputFormat: 'JPEG' }), width: 1216, height: 832, seed: 480312,
    positivePrompt: prompt.replace(/\s+/g, ' ').trim(), inputs: { referenceImages: [`data:image/jpeg;base64,${bytes.toString('base64')}`] } };
  const safe = { ...task, inputs: { sourceFile: `${spec.source}.jpg`, sourceSHA256: createHash('sha256').update(bytes).digest('hex') } };
  const key = createHash('sha256').update(JSON.stringify(safe)).digest('hex');
  await writeFile(join(root, `${spec.id}.prompt.txt`), prompt);
  await writeFile(join(root, `${spec.id}.request.json`), JSON.stringify({ ...safe, key }, null, 2));
  const receiptFile = join(root, `${spec.id}.result.json`);
  let row: any = existsSync(receiptFile) ? JSON.parse(await readFile(receiptFile, 'utf8')) : undefined;
  if (row && row.key !== key) throw new Error('Changed request; preserve the existing run.');
  if (row) committed += row.costUSD ?? 0.06;
  if (!run) continue;
  if (row && !row.imageURL) throw new Error('Uncertain previous call; do not repurchase automatically.');
  if (!row) {
    if (committed + 0.06 > 0.5) throw new Error('Combined USD 0.50 budget reached.');
    committed += 0.06;
    row = { id: spec.id, key, state: 'reserved', taskUUID: randomUUID() };
    await writeFile(receiptFile, JSON.stringify(row, null, 2));
    const response = await fetch('https://api.runware.ai/v1', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify([{ taskUUID: row.taskUUID, ...task }]), signal: AbortSignal.timeout(180000) });
    const body: any = await response.json();
    if (!response.ok || body.errors?.length) throw new Error(`Runware HTTP ${response.status}: ${body.errors?.[0]?.code || 'provider_error'}`);
    const output = body.data?.[0];
    if (Number.isFinite(output?.cost)) { row.costUSD = output.cost; committed += output.cost - 0.06; }
    if (!output?.imageURL || output.NSFWContent === true) throw new Error('No usable image.');
    row.imageURL = output.imageURL; row.imageUUID = output.imageUUID; row.state = 'generated';
    await writeFile(receiptFile, JSON.stringify(row, null, 2));
  }
  if (!existsSync(join(root, `${spec.id}.jpg`))) {
    const download = await fetch(row.imageURL, { signal: AbortSignal.timeout(60000) });
    if (!download.ok) throw new Error(`Download HTTP ${download.status}`);
    const image = Buffer.from(await download.arrayBuffer());
    const meta = await sharp(image).metadata();
    if (meta.width !== 1216 || meta.height !== 832) throw new Error('Unexpected image size.');
    await writeFile(join(root, `${spec.id}.jpg`), image);
  }
  const assetName = spec.id === 'colored-pencil' ? 'colored-pencil.webp' : 'painterly-adventure-v2.webp';
  await sharp(join(root, `${spec.id}.jpg`)).webp({ quality: 90 }).toFile(join(assets, assetName));
  row.state = 'complete'; row.file = `${assets}/${assetName}`;
  await writeFile(receiptFile, JSON.stringify(row, null, 2));
  results.push({ id: spec.id, title: spec.title, file: row.file, costUSD: row.costUSD, model: FLUX3_KLEIN_MODEL });
  console.log(`${spec.id}: complete, $${row.costUSD?.toFixed(5) ?? 'unknown'}`);
}
if (run) await writeFile(join(root, 'manifest.json'), JSON.stringify({ model: FLUX3_KLEIN_MODEL, results, combinedReservedUSD: committed }, null, 2));
else console.log('Dry run: two FLUX 3 Klein reference requests prepared; no paid calls.');

// Real image probes from the production picture loop. The offline LLM below
// captures requests only; it is NOT a verdict on the images generated afterwards.
if (run && process.argv.includes('--probes')) {
  await mkdir(join(root, 'probes'), { recursive: true });
  const entities: VisualEntity[] = [
    { id: 'tilda', name: 'Tilda', kind: 'character', role: 'cast', species: 'human', isHuman: true, appearance: 'nine-year-old girl with curly dark-brown hair, round goggles, pale blue shirt and yellow overalls', forbidden: [], referenceUrl: 'https://example.test/tilda.jpg' },
    { id: 'alex', name: 'Alexander', kind: 'character', role: 'hero', species: 'human', isHuman: true, appearance: 'eight-year-old blond boy, orange T-shirt and blue shorts', referenceContext: '8 years old, blond hair, orange T-shirt', forbidden: [], referenceUrl: 'https://example.test/alex.jpg' },
  ];
  const sheet = await encodeReferenceSprite(await renderIdentitySprite(await Promise.all([
    readFile('frontend/public/library/character-series/leads/tilda-tueftel.webp'),
    readFile('frontend/public/library/series/bruno-der-flunkerfisch/characters/mats.webp'),
  ])));
  const scenes = [
    { page: 0, scene: 'On an open sandy beach with blue sea and a distant sailboat, Tilda crouches at the left and gently adds a small seashell to a sandcastle turret. Alexander kneels at the right and pats its sand wall with one hand while holding a little wooden spade in the other. Both look at their shared sandcastle with delighted concentration. A bucket sits on the sand. Clear sunny afternoon, seaside setting.', action: 'adds a small seashell to the sandcastle turret', result: 'Alexander pats the sand wall beside her' },
    { page: 1, scene: 'Inside a cozy kitchen with pale-blue tiled walls, a window showing the evening sky and a wooden table, Tilda leans over a large mixing bowl and stirs with one wooden spoon. Alexander on the other side holds a little flour sieve above the bowl; a soft puff of flour makes him grin. An egg and a small jug rest on the table. Warm interior light, a domestic kitchen setting.', action: 'stirs the mixing bowl with one wooden spoon', result: 'Alexander sifts a little flour into the same bowl' },
  ];
  const shots = scenes.map(s => ({ ...s, paragraph: 1, onStage: entities.map(e => e.id), elements: [], artifactVisible: false, focus: 'scene' as const, visualBeat: { actorId: 'tilda', action: s.action, result: s.result, framing: 'wide' as const } }));
  for (const spec of specs) {
    const id = spec.id as 'colored-pencil' | 'painterly-adventure';
    const captured: ImageRequest[] = [];
    const styleBytes = await readFile(join(assets, id === 'colored-pencil' ? 'colored-pencil.webp' : 'painterly-adventure-v2.webp'));
    await generateSeriesImages({ illustrations: { cover: shots[0], pages: [shots[1]] }, entities, seed: 'wizard-style-probe', imageModel: FLUX2_KLEIN_9B_KV_MODEL, imageStyle: id,
      styleReferenceUrl: `data:image/webp;base64,${styleBytes.toString('base64')}`, visionModel: 'offline-request-capture', pageTexts: {},
      buildReference: async () => ({ urls: [`data:image/jpeg;base64,${sheet.toString('base64')}`], mode: 'sprite', subjects: entities.map(e => ({ displayName: e.name, kind: 'character' as const })) }),
      provider: async request => { captured.push(request); return { url: 'https://example.test/request-capture.jpg' }; },
      llm: async () => ({ text: JSON.stringify({ visibleIds: entities.map(e => e.id), identityById: { tilda: 1, alex: 1 }, posing: false, primaryActionClear: true, sceneMatch: 1, styleMatch: 1, defects: [] }), modelUsed: 'offline-request-capture', usage: { prompt: 0, completion: 0, total: 0, costUSD: 0 }, durationMs: 0 }),
      policy: { maxImageCalls: 2, imageRetries: 0, imageConcurrency: 1 },
    });
    for (const request of captured) {
      const stem = `${id}-${request.page === 0 ? 'beach' : 'kitchen'}`;
      const resultFile = join(root, 'probes', `${stem}.result.json`);
      const task = { taskType: 'imageInference', model: FLUX2_KLEIN_9B_KV_MODEL, numberResults: 1, outputType: ['URL'], includeCost: true,
        ...runwareImageModelOptions({ model: FLUX2_KLEIN_9B_KV_MODEL, steps: 4, CFGScale: 4, outputFormat: 'JPEG' }), width: request.width, height: request.height, seed: request.seed,
        positivePrompt: withTaleaImageStyle(request.prompt, request.imageStyle).replace(/\s+/g, ' ').trim(), inputs: { referenceImages: request.referenceImages } };
      const safe = { ...task, inputs: { referenceHashes: request.referenceImages.map(ref => createHash('sha256').update(ref).digest('hex')) } };
      const key = createHash('sha256').update(JSON.stringify(safe)).digest('hex');
      await writeFile(join(root, 'probes', `${stem}.request.json`), JSON.stringify(safe, null, 2));
      let result: any = existsSync(resultFile) ? JSON.parse(await readFile(resultFile, 'utf8')) : undefined;
      if (result && result.key !== key) throw new Error('Probe changed; preserve its earlier result.');
      if (result) committed += result.costUSD ?? 0.03;
      if (result?.state === 'complete') continue;
      if (result && !result.imageURL) throw new Error('Uncertain prior probe; no automatic repurchase.');
      if (!result) {
        if (committed + 0.03 > 0.5) throw new Error('Combined USD 0.50 budget reached.');
        committed += 0.03;
        result = { key, state: 'reserved', taskUUID: randomUUID() };
        await writeFile(resultFile, JSON.stringify(result, null, 2));
        const response = await fetch('https://api.runware.ai/v1', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify([{ taskUUID: result.taskUUID, ...task }]), signal: AbortSignal.timeout(180000) });
        const body: any = await response.json();
        if (!response.ok || body.errors?.length) throw new Error(`Probe HTTP ${response.status}: ${body.errors?.[0]?.code || 'provider_error'}`);
        const image = body.data?.[0];
        if (Number.isFinite(image?.cost)) { result.costUSD = image.cost; committed += image.cost - 0.03; }
        if (!image?.imageURL || image.NSFWContent === true) throw new Error('No usable probe output.');
        result.imageURL = image.imageURL; result.state = 'generated';
        await writeFile(resultFile, JSON.stringify(result, null, 2));
      }
      const download = await fetch(result.imageURL, { signal: AbortSignal.timeout(60000) });
      if (!download.ok) throw new Error(`Probe download HTTP ${download.status}`);
      const image = Buffer.from(await download.arrayBuffer());
      await sharp(image).metadata();
      await writeFile(join(root, 'probes', `${stem}.jpg`), image);
      result.state = 'complete';
      await writeFile(resultFile, JSON.stringify(result, null, 2));
      console.log(`${stem}: complete, $${result.costUSD?.toFixed(5) ?? 'unknown'}`);
    }
  }
}

if (run) {
  // Include cached probes as well when resuming a run or rendering the gallery.
  let finalCommitted = previousResult.combinedCostUSD + previousExperiment.previousUnpricedReservationUSD;
  for (const dir of [firstTake, join(firstTake, 'probes'), root, join(root, 'probes')]) {
    if (!existsSync(dir)) continue;
    for (const file of await readdir(dir)) if (file.endsWith('.result.json')) {
      const receipt = JSON.parse(await readFile(join(dir, file), 'utf8'));
      finalCommitted += receipt.costUSD ?? 0.06;
    }
  }
  await writeFile(join(root, 'manifest.json'), JSON.stringify({ model: FLUX3_KLEIN_MODEL, results, combinedReservedUSD: finalCommitted }, null, 2));
  const pencil = join(root, 'probes/colored-pencil-kitchen.jpg');
  const painted = join(root, 'probes/painterly-adventure-kitchen.jpg');
  if (existsSync(pencil) && existsSync(painted)) {
    const labels = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="64"><rect width="1600" height="64" fill="#fcf8ee"/><text x="24" y="43" font-family="Arial" font-size="28" fill="#273c35">Buntstift &amp; Schraffur</text><text x="824" y="43" font-family="Arial" font-size="28" fill="#273c35">Wilde Bilderbuch-Abenteuer</text></svg>');
    await sharp({ create: { width: 1600, height: 612, channels: 3, background: '#fcf8ee' } }).composite([
      { input: labels, top: 0, left: 0 },
      { input: await sharp(pencil).resize(800, 548).toBuffer(), top: 64, left: 0 },
      { input: await sharp(painted).resize(800, 548).toBuffer(), top: 64, left: 800 },
    ]).jpeg({ quality: 94 }).toFile(join(root, 'vergleich.jpg'));
  }
}
