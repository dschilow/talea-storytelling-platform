/**
 * Ten art directions on the actual FigurenWelt FLUX.2 image request.
 * bun --env-file=.env.local run scripts/image-bench/figurenwelt-style-study.ts [--run]
 * Only SERIES_ART_DIRECTION changes; references, scene, seed and settings stay fixed.
 * No story/database writes. The offline capture's review stub is never a real image approval.
 */
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { generateSeriesImages, SERIES_ART_DIRECTION } from '../../backend/story/character-series/pictures';
import { withTaleaImageStyle } from '../../backend/ai/image-style';
import { FLUX2_KLEIN_9B_KV_MODEL, runwareImageModelOptions } from '../../backend/ai/runware-image-model-options';
import { encodeReferenceSprite, renderIdentitySprite } from '../../backend/story/image-reference-sprite';
import type { ImageRequest } from '../../backend/story/storybook/images';
import type { VisualEntity } from '../../backend/story/storybook/illustration-stage';

const out = resolve('output/figurenwelt-flux2-stilvergleich-2026-11-03');
const run = process.argv.includes('--run');
const model = FLUX2_KLEIN_9B_KV_MODEL;
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const compact = (value: string) => value.replace(/\s+/g, ' ').trim();
const styles: Array<{ n: number; id: string; name: string; style: string }> = JSON.parse(await readFile(new URL('./figurenwelt-style-study.styles.json', import.meta.url), 'utf8'));
for (const dir of ['images', 'prompts', 'requests', 'results']) await mkdir(join(out, dir), { recursive: true });

const portraits = [
  { id: 'alex', name: 'Alexander', role: 'hero', species: 'human', isHuman: true, appearance: 'eight-year-old boy with short blond hair, orange T-shirt, blue trousers and brown shoes', referenceContext: '8 years old, male, short blond hair, orange T-shirt', file: 'frontend/public/library/series/bruno-der-flunkerfisch/characters/mats.webp' },
  { id: 'tilda', name: 'Tilda Tüftel', role: 'cast', species: 'human', isHuman: true, appearance: 'nine-year-old girl inventor with big curly dark-brown hair, round safety goggles, light-blue shirt and yellow overalls', file: 'frontend/public/library/character-series/leads/tilda-tueftel.webp' },
  { id: 'funkel', name: 'Funkelflug', role: 'cast', species: 'dragon', isHuman: false, appearance: 'small round golden-yellow baby dragon with tiny pink-lined wings, big brown eyes, pink nose, cream belly scales and a short tail', file: 'frontend/public/library/character-series/leads/funkelflug.webp' },
] as const;
const entities: VisualEntity[] = portraits.map(p => ({ ...p, kind: 'character', forbidden: [], referenceUrl: 'https://example.test/identity-only.webp' }));
const sheet = await encodeReferenceSprite(await renderIdentitySprite(await Promise.all(portraits.map(p => readFile(p.file)))));
const reference = `data:image/jpeg;base64,${sheet.toString('base64')}`;
await writeFile(join(out, 'identity-sheet.jpg'), sheet);

const scene = 'At violet dusk beside a hollow-oak star workshop, a small wooden handcart carrying one open brass chest of glowing golden stars rolls down a mossy path toward a stone footbridge. Alexander leans backward on the left, both hands pulling a taut rope attached to the cart to stop it. On the right, Tilda Tüftel crouches and holds a butterfly net directly beneath one glowing star bouncing out of the chest; her eyes follow that star through her round safety goggles. Behind the cart, knee-high Funkelflug plants both hind feet on the ground and grips its rear handle with his front paws, leaning back with puffed cheeks in a funny determined effort to brake it. All three cooperate in this one frozen instant. Show the complete cart and chest between them, the rope visibly connected to the cart and the separate net clearly gripped by Tilda. In the foreground, a folded map and brass key rest beside a wicker basket. In the background, a fern-lined stream flows beneath the mossy arched footbridge, and the enormous hollow oak has an amber-lit round workshop window, a crooked wooden door and hanging lanterns. Layered trees recede into blue-violet evening haze. Child-eye-level medium-wide view, clear distinct silhouettes, warm golden starlight on faces against the cool woodland twilight; the characters and the physical action are the focal point.';
const source = 'Der Sternenwagen rumpelte auf die Brücke zu. Alexander warf sich ins Seil. Hinter dem Wagen stemmte Funkelflug die Füße in den Weg und hielt den Griff fest. Ein Stern hüpfte über den Truhenrand. Tilda ging in die Hocke und schob ihren Kescher darunter. „Den habe ich!“, rief sie.';
const shot = { page: 1, paragraph: 1, onStage: entities.map(e => e.id), elements: [], artifactVisible: false, focus: 'scene' as const, scene, storyQuote: source,
  visualBeat: { actorId: 'alex', action: 'pulls the taut rope to stop the rolling star cart', result: 'Tilda catches a falling star with her net while Funkelflug brakes the rear handle', framing: 'wide' } };
let captured: ImageRequest | undefined;
await generateSeriesImages({
  illustrations: { cover: { ...shot, page: 0 }, pages: [shot] }, entities,
  seed: 'figurenwelt-style-study-2026-11-03', imageModel: model, visionModel: 'offline-capture-only', pageTexts: { 1: source },
  buildReference: async () => ({ urls: [reference], mode: 'sprite', subjects: entities.map(e => ({ displayName: e.name, kind: 'character' as const })) }),
  provider: async request => { if (request.page === 1 && !captured) captured = request; return { url: 'https://example.test/offline-capture-only.jpg', costUSD: 0 }; },
  llm: async () => ({ text: JSON.stringify({ visibleIds: entities.map(e => e.id), identityById: Object.fromEntries(entities.map(e => [e.id, 1])), posing: false, primaryActionClear: true, storyConsistent: true, materialContradiction: false, sceneMatch: 1, styleMatch: 1, defects: [] }),
    modelUsed: 'offline-capture-only', usage: { prompt: 0, completion: 0, total: 0, costUSD: 0 }, durationMs: 0 }),
  policy: { maxImageCalls: 2, imageRetries: 0, imageConcurrency: 1 },
});
if (!captured) throw new Error('Production picture loop did not produce the chapter request.');
const request = captured as ImageRequest;
const basePrompt = withTaleaImageStyle(request.prompt);
if (basePrompt.split(SERIES_ART_DIRECTION).length !== 2) throw new Error('Expected exactly one production art-direction block.');
await writeFile(join(out, 'prompts/00-produktion-original.txt'), basePrompt);
const variants = [{ n: 0, id: 'produktion-original', name: 'Bisheriger Talea-Stil', style: SERIES_ART_DIRECTION }, ...styles];
const tasks = variants.map(style => {
  const prompt = basePrompt.replace(SERIES_ART_DIRECTION, style.style);
  // Prove that no character/action/identity instruction changed outside the style block.
  if (prompt.replace(style.style, '<STYLE>') !== basePrompt.replace(SERIES_ART_DIRECTION, '<STYLE>')) throw new Error('Non-style prompt drift.');
  const task = { taskType: 'imageInference', model, numberResults: 1, outputType: ['URL'], includeCost: true,
    ...runwareImageModelOptions({ model, steps: 4, CFGScale: 4, outputFormat: 'JPEG', negativePrompt: request.negativePrompt }),
    width: request.width, height: request.height, seed: request.seed,
    positivePrompt: compact(prompt), inputs: { referenceImages: [...request.referenceImages] } };
  const key = sha(JSON.stringify({ ...task, inputs: { referenceHashes: request.referenceImages.map(sha) } }));
  return { ...style, key, prompt, task, stem: `${String(style.n).padStart(2, '0')}-${style.id}` };
});
for (const t of tasks) {
  await writeFile(join(out, 'prompts', `${t.stem}.txt`), t.prompt);
  await writeFile(join(out, 'requests', `${t.stem}.json`), JSON.stringify({ ...t.task, inputs: { referenceImages: ['../identity-sheet.jpg'], referenceHashes: request.referenceImages.map(sha) }, requestKey: t.key }, null, 2));
}
await writeFile(join(out, 'experiment.json'), JSON.stringify({ model, seed: request.seed, width: request.width, height: request.height, steps: 4, CFGScale: 4, referenceSHA256: sha(sheet), scene, source, productionPromptFunction: 'generateSeriesImages', changedField: 'SERIES_ART_DIRECTION only', productionWhitespaceNormalization: true, productionStyleInjectorAppliedBeforeReplacement: true,
  note: 'Local first-attempt style experiment; production settings unchanged. Offline QA is solely for capturing requests, not an image verdict. Same existing identity sheet for all styles; no style-specific portrait regeneration. Actual results need visual inspection.', variants: tasks.map(t => ({ n: t.n, id: t.id, name: t.name, key: t.key })) }, null, 2));
console.log(`${model}; ${request.width}x${request.height}; 4 steps; CFG 4; seed ${request.seed}; one identical 3-figure identity sheet.`);
console.log(`Prepared ${styles.length} variants + original baseline. Only the art-direction block changes.`);
if (!run) { console.log('Dry run: no paid network calls.'); process.exit(0); }
let apiKey = process.env.RUNWARE_API_KEY || process.env.RunwareApiKey;
if (!apiKey && existsSync('.env.local')) {
  const bytes = await readFile('.env.local');
  const envText = bytes[0] === 0xff && bytes[1] === 0xfe ? bytes.toString('utf16le') : bytes.toString('utf8');
  apiKey = envText.match(/^[ \t]*RUNWARE_API_KEY[ \t]*=[ \t]*([^\r\n]*)/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
}
if (!apiKey) {
  try {
    const raw = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "railway variables --service 'backend 2' --environment production --json"], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const variables = JSON.parse(raw);
    apiKey = variables.RUNWARE_API_KEY || variables.RunwareApiKey;
  } catch { throw new Error('Could not read linked Runware configuration; no credentials printed.'); }
}
if (!apiKey) throw new Error('No Runware key configured locally or in the linked service.');

type Result = { n: number; id: string; name: string; key: string; state: string; file?: string; costUSD?: number; durationMs?: number; error?: string };
const results: Result[] = [];
let committed = 0;
for (const t of tasks) {
  const file = join(out, 'results', `${t.stem}.json`);
  if (existsSync(file)) {
    const prior: Result = JSON.parse(await readFile(file, 'utf8'));
    if (prior.key !== t.key) throw new Error(`Changed request for ${t.id}; use a new output directory.`);
    const neverConnected = prior.state === 'error' && prior.costUSD === undefined && (prior.durationMs ?? Infinity) < 3000 && /Unable to connect|Was there a typo in the url or port/.test(prior.error || '');
    if (process.argv.includes('--retry-unconnected') && neverConnected) continue;
    committed += prior.costUSD ?? 0.03;
    results.push(prior);
  }
}
let next = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (next < tasks.length) {
    const t = tasks[next++];
    if (results.some(r => r.key === t.key)) continue;
    if (committed + 0.03 > 0.5) throw new Error('Study budget of 0.50 USD reached.');
    committed += 0.03;
    const resultFile = join(out, 'results', `${t.stem}.json`);
    const row: Result = { n: t.n, id: t.id, name: t.name, key: t.key, state: 'reserved' };
    results.push(row);
    await writeFile(resultFile, JSON.stringify(row, null, 2));
    const started = Date.now();
    try {
      const response = await fetch('https://api.runware.ai/v1', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([{ taskUUID: randomUUID(), ...t.task }]), signal: AbortSignal.timeout(180000) });
      const body: any = await response.json();
      if (!response.ok || body.errors?.length) throw new Error(`Runware HTTP ${response.status}: ${body.errors?.[0]?.code || 'provider_error'}`);
      const image = body.data?.[0];
      if (Number.isFinite(image?.cost) && image.cost >= 0) { row.costUSD = image.cost; committed += image.cost - 0.03; }
      if (!image?.imageURL || image.NSFWContent === true) throw new Error('Provider returned no usable image.');
      row.state = 'generated';
      await writeFile(resultFile, JSON.stringify(row, null, 2));
      const download = await fetch(image.imageURL, { signal: AbortSignal.timeout(60000) });
      if (!download.ok) throw new Error(`Image download HTTP ${download.status}`);
      const bytes = Buffer.from(await download.arrayBuffer());
      const meta = await sharp(bytes).metadata();
      if (meta.width !== request.width || meta.height !== request.height) throw new Error('Unexpected image dimensions.');
      row.file = `images/${t.stem}.jpg`;
      await writeFile(join(out, row.file), bytes);
      row.state = 'complete';
    } catch (error) { row.state = 'error'; row.error = (error as Error).message; }
    row.durationMs = Date.now() - started;
    await writeFile(resultFile, JSON.stringify(row, null, 2));
    console.log(`${String(t.n).padStart(2, '0')} ${t.name}: ${row.state}, $${row.costUSD?.toFixed(5) ?? 'unknown'}, ${Math.round(row.durationMs / 1000)}s${row.error ? ` (${row.error})` : ''}`);
  }
}));
results.sort((a, b) => a.n - b.n);
await writeFile(join(out, 'results.json'), JSON.stringify(results, null, 2));

const esc = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const cards = results.map(r => `<article id="stil-${r.n}"><header><span>${String(r.n).padStart(2, '0')}</span><h2>${esc(r.name)}</h2></header>${r.file ? `<a href="${r.file}" target="_blank"><img src="${r.file}" alt="Sternenwagen in ${esc(r.name)}" loading="lazy"></a>` : '<p>Kein fertiges Bild.</p>'}<details><summary>Stilprompt</summary><p>${esc(variants.find(v => v.n === r.n)!.style)}</p><a href="prompts/${tasks.find(t => t.n === r.n)!.stem}.txt">Vollständiger Bildprompt</a></details></article>`).join('\n');
await writeFile(join(out, 'index.html'), `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>FigurenWelt · 10 FLUX.2 Bildstile</title><style>*{box-sizing:border-box}body{margin:0;background:#f4f0e8;color:#263b35;font:16px/1.6 system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:44px 28px}h1{font:clamp(32px,5vw,64px)/1.08 Georgia,serif;max-width:800px;margin:12px 0 22px}h2{font-size:19px;margin:0}p{max-width:920px}nav{display:flex;gap:10px;flex-wrap:wrap;margin:28px 0}a{color:#21665e}nav a{background:white;border-radius:99px;padding:7px 14px;text-decoration:none}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:26px}article{background:#fffdf8;border:1px solid #ddd8cc;border-radius:16px;overflow:hidden;scroll-margin-top:20px}header{padding:14px 18px;display:flex;gap:13px;align-items:center}header span{font:italic 27px Georgia;color:#947342}img{width:100%;height:auto;display:block}details{padding:12px 18px}summary{cursor:pointer}details p{font-size:14px}.meta{color:#6c7467;font-size:14px}.reference img{max-width:700px;border-radius:12px}.reference{margin-top:36px}@media(max-width:760px){.grid{grid-template-columns:1fr}main{padding:24px 14px}}@media(prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}</style><main><p class="meta">TALEA FIGURENWELT · STILSTUDIE · 03.11.2026</p><h1>Ein Sternenwagen.<br>Zehn Bildsprachen.</h1><p>Alexander, Tilda Tüftel und Funkelflug stoppen gemeinsam einen davonrollenden Sternenwagen. Alle Bilder verwenden denselben echten FigurenWelt-Bildauftrag und dasselbe Figurenreferenzblatt. Ausschließlich die Stilbeschreibung wurde ausgetauscht.</p><p class="meta">FLUX.2 klein 9B KV · ${model} · ${request.width} × ${request.height} · 4 Steps · CFG 4 · Seed ${request.seed}. Lokaler Erstversuch je Stil; visuelle Auswahl, keine automatische Produktionsfreigabe.</p><nav>${results.map(r => `<a href="#stil-${r.n}">${r.n === 0 ? 'Original' : String(r.n).padStart(2, '0')} · ${esc(r.name)}</a>`).join('')}</nav><section class="grid">${cards}</section><section class="reference"><h2>Gemeinsames Figurenreferenzblatt</h2><p>Alexander · Tilda Tüftel · Funkelflug. Die vorhandenen Referenzen bleiben bei allen Varianten gleich; ihr ursprünglicher Zeichenstil kann den Stilwechsel begrenzen.</p><a href="identity-sheet.jpg"><img src="identity-sheet.jpg" alt="Gemeinsames Figurenreferenzblatt"></a></section></main></html>`);

const complete = results.filter(r => r.n > 0 && r.file);
const cellWidth = 608, cellHeight = 462;
const tiles = await Promise.all(complete.map(async (r, i) => {
  const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="608" height="46"><rect width="608" height="46" fill="#f8f4eb"/><text x="16" y="31" font-family="Arial" font-size="22" fill="#263b35">${String(r.n).padStart(2, '0')} · ${esc(r.name)}</text></svg>`);
  const image = await sharp(join(out, r.file!)).resize(608, 416).extend({ top: 46, bottom: 0, left: 0, right: 0, background: '#f8f4eb' }).composite([{ input: label, left: 0, top: 0 }]).jpeg({ quality: 92 }).toBuffer();
  return { input: image, left: (i % 2) * cellWidth, top: Math.floor(i / 2) * cellHeight };
}));
if (tiles.length) await sharp({ create: { width: cellWidth * 2, height: cellHeight * Math.ceil(tiles.length / 2), channels: 3, background: '#f8f4eb' } }).composite(tiles).jpeg({ quality: 94 }).toFile(join(out, 'vergleich.jpg'));
const cost = results.reduce((sum, r) => sum + (r.costUSD || 0), 0);
console.log(`Saved ${complete.length}/10 style pictures + baseline. Reported image cost: $${cost.toFixed(5)}. ${join(out, 'index.html')}`);
if (complete.length !== 10 || !results.find(r => r.n === 0)?.file) process.exitCode = 1;
