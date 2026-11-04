/**
 * FLUX.2 study based on the user's five style examples.
 * First redraw each canonical figure individually; then use only those new
 * portraits in the actual captured FigurenWelt scene prompt. No production writes.
 * bun scripts/image-bench/figurenwelt-reference-styles.ts [--run] [--portraits-only]
 * Final text-guided comparison:
 * bun scripts/image-bench/figurenwelt-reference-styles.ts --focused-scenes --text-scenes [--run]
 */
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { FLUX2_KLEIN_9B_KV_MODEL, runwareImageModelOptions } from '../../backend/ai/runware-image-model-options';
import { encodeReferenceSprite, renderIdentitySprite } from '../../backend/story/image-reference-sprite';

type Style = { n: number; id: string; name: string; source: string; crop?: { left: number; top: number; width: number; height: number }; style: string; lighting: string; layout: string };
type Receipt = { id: string; key: string; state: 'reserved' | 'generated' | 'complete' | 'error'; taskUUID: string; file?: string; costUSD?: number; imageURL?: string; imageUUID?: string; model?: string; error?: string; durationMs?: number };
const root = resolve('output/figurenwelt-flux2-vorlagen-2026-11-03');
const priorRoot = resolve('output/figurenwelt-flux2-stilvergleich-2026-11-03');
const attachmentRoot = resolve('.codex-remote-attachments/01a1a226-663f-7f10-9ba0-3c534674296a/d055136e-dd2c-4fee-9778-88b409d0180f');
const run = process.argv.includes('--run');
const portraitsOnly = process.argv.includes('--portraits-only');
const textScenes = process.argv.includes('--text-scenes');
const focusedScenes = process.argv.includes('--focused-scenes');
const portraitVersion = 'text-redesign-v3';
const sceneVersion = focusedScenes ? `focused-two-cast-v5${textScenes ? '-text' : ''}` : textScenes ? 'text-scene-v4' : 'separate-identities-v3';
const selectedStyle = process.argv.find(a => a.startsWith('--style='))?.split('=')[1];
const styles: Style[] = JSON.parse(await readFile(new URL('./figurenwelt-reference-styles.styles.json', import.meta.url), 'utf8'));
const hash = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const uri = (b: Buffer) => `data:image/jpeg;base64,${b.toString('base64')}`;
// Only the previously authorised Talea portraits and our generated character
// sheets may leave this machine. User-uploaded style examples stay local.
const allowedReferenceHashes = new Set<string>();
const compact = (s: string) => s.replace(/\s+/g, ' ').trim();
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const figures = [
  { id: 'alex', name: 'Alexander', appearance: 'an eight-year-old human boy with short tousled blond hair, fair skin, an orange T-shirt, blue shorts and ordinary trainers', file: 'frontend/public/library/series/bruno-der-flunkerfisch/characters/mats.webp' },
  { id: 'tilda', name: 'Tilda Tüftel', appearance: 'a nine-year-old human girl with curly dark-brown hair, fair warm skin, round safety goggles on her eyes, a light blue shirt, yellow overalls and dark shoes', file: 'frontend/public/library/character-series/leads/tilda-tueftel.webp' },
  { id: 'funkel', name: 'Funkelflug', appearance: 'one small golden-yellow baby dragon with a cream belly, a pink nose, brown eyes, two little wings with pink membranes, two arms, two hind legs and one short tail; this dragon wears no glasses or clothes', file: 'frontend/public/library/character-series/leads/funkelflug.webp' },
];
const portraitFile = (style: Style, figure: typeof figures[number]) => join(root, 'portraits', `${style.id}-${figure.id}-${portraitVersion}.jpg`);
for (const dir of ['sources', 'originals', 'portraits', 'references', 'images', 'prompts', 'requests', 'results']) await mkdir(join(root, dir), { recursive: true });
const model = FLUX2_KLEIN_9B_KV_MODEL;
const existingReceipts: Receipt[] = [];
for (const file of await readdir(join(root, 'results'))) {
  if (file.endsWith('.json')) existingReceipts.push(JSON.parse(await readFile(join(root, 'results', file), 'utf8')));
}
const priorResults = JSON.parse(await readFile(join(priorRoot, 'results.json'), 'utf8'));
const previousCost = priorResults.reduce((s: number, r: { costUSD?: number }) => s + (r.costUSD ?? 0), 0);
let committed = previousCost + existingReceipts.reduce((s, r) => s + (r.costUSD ?? 0.03), 0);
let apiKey = '';
if (run) {
  apiKey = process.env.RUNWARE_API_KEY || process.env.RunwareApiKey || '';
  if (!apiKey && existsSync('.env.local')) {
    const bytes = await readFile('.env.local');
    const env = bytes[0] === 0xff && bytes[1] === 0xfe ? bytes.toString('utf16le') : bytes.toString('utf8');
    apiKey = env.match(/^[ \t]*RUNWARE_API_KEY[ \t]*=[ \t]*([^\r\n]*)/m)?.[1]?.trim().replace(/^["']|["']$/g, '') || '';
  }
  if (!apiKey) {
    try {
      const raw = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "railway variables --service 'backend 2' --environment production --json"], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      const vars = JSON.parse(raw); apiKey = vars.RUNWARE_API_KEY || vars.RunwareApiKey || '';
    } catch { throw new Error('Runware configuration unavailable; no credentials printed.'); }
  }
  if (!apiKey) throw new Error('Runware key unavailable.');
}

async function generate(id: string, prompt: string, refs: string[], width: number, height: number, seed: number, file: string): Promise<Receipt | undefined> {
  if (refs.some(ref => !allowedReferenceHashes.has(hash(ref)))) throw new Error('Unapproved reference payload. Style examples must remain local.');
  const task = { taskType: 'imageInference', model, numberResults: 1, outputType: ['URL'], includeCost: true,
    ...runwareImageModelOptions({ model, steps: 4, CFGScale: 4, outputFormat: 'JPEG' }), width, height, seed, positivePrompt: compact(prompt), ...(refs.length ? { inputs: { referenceImages: refs } } : {}) };
  const key = hash(JSON.stringify({ ...task, inputs: { referenceHashes: refs.map(hash) } }));
  await writeFile(join(root, 'prompts', `${id}.txt`), prompt);
  await writeFile(join(root, 'requests', `${id}.json`), JSON.stringify({ ...task, inputs: { referenceHashes: refs.map(hash) }, key }, null, 2));
  const receiptFile = join(root, 'results', `${id}.json`);
  let receipt = existingReceipts.find(r => r.id === id);
  if (receipt && receipt.key !== key) throw new Error(`Request changed for ${id}; preserve this run and use a new id.`);
  if (receipt?.state === 'complete' && receipt.file && existsSync(join(root, receipt.file))) return receipt;
  if (!run) return undefined;
  if (receipt && !receipt.imageURL) throw new Error(`Uncertain prior request ${id}; do not purchase again automatically.`);
  const started = Date.now();
  if (!receipt) {
    if (committed + 0.03 > 0.5) throw new Error('Combined study budget of USD 0.50 reached.');
    committed += 0.03;
    receipt = { id, key, state: 'reserved', taskUUID: randomUUID() };
    existingReceipts.push(receipt);
    await writeFile(receiptFile, JSON.stringify(receipt, null, 2));
  }
  try {
    if (!receipt.imageURL) {
      const response = await fetch('https://api.runware.ai/v1', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify([{ taskUUID: receipt.taskUUID, ...task }]), signal: AbortSignal.timeout(180000) });
      const body: any = await response.json();
      if (!response.ok || body.errors?.length) throw new Error(`Runware HTTP ${response.status}: ${body.errors?.[0]?.code || 'provider_error'}`);
      const output = body.data?.[0];
      if (Number.isFinite(output?.cost) && output.cost >= 0) { receipt.costUSD = output.cost; committed += output.cost - 0.03; }
      if (!output?.imageURL || output.NSFWContent === true) throw new Error('No usable provider output.');
      receipt.imageURL = output.imageURL; receipt.imageUUID = output.imageUUID; receipt.model = output.model ?? model; receipt.state = 'generated';
      await writeFile(receiptFile, JSON.stringify(receipt, null, 2));
    }
    const response = await fetch(receipt.imageURL!, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Download HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(bytes).metadata();
    if (metadata.width !== width || metadata.height !== height) throw new Error('Unexpected dimensions.');
    await writeFile(join(root, file), bytes);
    receipt.file = file; receipt.state = 'complete'; receipt.error = undefined;
  } catch (error) { receipt.state = 'error'; receipt.error = (error as Error).message; }
  receipt.durationMs = Date.now() - started;
  await writeFile(receiptFile, JSON.stringify(receipt, null, 2));
  console.log(`${id}: ${receipt.state}, $${receipt.costUSD?.toFixed(5) ?? 'unknown'}${receipt.error ? ` (${receipt.error})` : ''}`);
  if (receipt.state !== 'complete') throw new Error(`Generation incomplete: ${id}`);
  return receipt;
}

async function parallel<T>(items: T[], fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: 3 }, async () => { while (next < items.length) await fn(items[next++]); }));
}

const sourceBuffers = new Map<string, Buffer>();
for (const style of styles) {
  let source = sharp(await readFile(join(attachmentRoot, style.source))).rotate();
  if (style.crop) source = source.extract(style.crop);
  const bytes = await source.resize({ width: 1152, height: 1152, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
  sourceBuffers.set(style.id, bytes);
  await writeFile(join(root, 'sources', `${style.id}.jpg`), bytes);
}
const originalBuffers = await Promise.all(figures.map(async figure => {
  const bytes = await sharp(await readFile(figure.file)).resize(512, 512, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer();
  await writeFile(join(root, 'originals', `${figure.id}.jpg`), bytes);
  allowedReferenceHashes.add(hash(uri(bytes)));
  return bytes;
}));
await writeFile(join(root, 'experiment.json'), JSON.stringify({ model, steps: 4, CFGScale: 4, previousCostUSD: previousCost, combinedCostCapUSD: 0.5, sourceArticle: 'https://bumblebearpublishing.com/blogs/creative-childrens-book-illustrations-styles/',
  method: 'New style-specific figures are designed from written canonical identity descriptions, without image conditioning from the old portrait style. Scenes use a three-character sheet made only from the matching new figures.',
  portraitVersion,
  transferPolicy: 'User-uploaded examples stay local and are never transmitted. Outgoing reference hashes are restricted to the previously authorised Talea portraits and generated character sheets.',
  changesFromFirstStudy: ['style-specific character references', 'medium and character shape language', 'lighting and palette', 'camera and use of white paper'], scenePromptOrigin: 'captured generateSeriesImages production prompt from first study',
  sceneVersion,
  sceneReferences: textScenes ? 'Text-only style exploration with the same FLUX.2 model and written canonical character traits; no image conditioning.' : 'Three individually generated character portraits, one reference image per named identity; the combined sheet is only a local inspection artifact.',
  styles: styles.map(s => ({ ...s, referenceSHA256: hash(sourceBuffers.get(s.id)!) })) }, null, 2));
const activeStyles = selectedStyle ? styles.filter(s => s.id === selectedStyle) : styles;
if (!activeStyles.length) throw new Error('Unknown style selection.');
await parallel(activeStyles.flatMap(style => figures.map((figure, index) => ({ style, figure, index }))), async ({ style, figure, index }) => {
  const prompt = [
    'Create a single original character design for a new illustrated children\'s book. Design the character entirely in the drawing language specified below.',
    `Draw ONLY ${figure.name}: ${figure.appearance}. These identifying traits stay recognisable, while line quality, shapes, eyes, proportions and paint texture come entirely from the new style brief.`,
    style.style,
    'One relaxed full-body figure, centred on clean ivory paper, arms resting naturally, enough space around the entire silhouette. The paper stays plain. Construct the character from fresh marks and simple shapes in the specified medium. Only the single described person or creature is present. No companions, props, text, title or decorative frame.',
  ].join('\n');
  await generate(`${style.id}-portrait-${figure.id}-${portraitVersion}`, prompt, [], 768, 768, 4100 + index, `portraits/${style.id}-${figure.id}-${portraitVersion}.jpg`);
});

const tiles: { input: Buffer; left: number; top: number }[] = [];
for (const [row, style] of styles.entries()) for (const [column, figure] of figures.entries()) {
  const file = portraitFile(style, figure);
  if (existsSync(file)) tiles.push({ input: await sharp(file).resize(320, 320).jpeg().toBuffer(), left: column * 320, top: row * 320 });
}
if (tiles.length) await sharp({ create: { width: 960, height: 1600, channels: 3, background: '#ffffff' } }).composite(tiles).jpeg({ quality: 92 }).toFile(join(root, 'portraets-vergleich.jpg'));

const sceneRows: { style: Style; take: string; id: string; file: string; prompt: string }[] = [];
const originalPrompt = await readFile(join(priorRoot, 'prompts', '00-produktion-original.txt'), 'utf8');
if (!originalPrompt.includes('IDENTITY SHEET, image 1:')) throw new Error('Captured production identity binding not found.');
const neutralScene = 'A wooden handcart carrying one open brass chest of golden stars rolls toward a woodland footbridge beside a hollow-tree workshop. Alexander leans back at the left, both hands pulling a taut rope attached to the cart. Tilda crouches at the right, both hands holding ONE butterfly net beneath a single falling star. Funkelflug braces his feet BEHIND THE CART and grips its rear handle to brake it. He is knee-high beside the children. The three cooperate with lively determined faces and look at their work. A stream, a folded map and a wicker basket complete the setting.';
for (const style of activeStyles) {
  const portraitFiles = figures.map(f => portraitFile(style, f));
  if (!portraitFiles.every(existsSync)) continue;
  const sheet = await encodeReferenceSprite(await renderIdentitySprite(await Promise.all(portraitFiles.map(f => readFile(f)))));
  allowedReferenceHashes.add(hash(uri(sheet)));
  await writeFile(join(root, 'references', `${style.id}.jpg`), sheet);
  for (const take of ['a', 'b']) {
    const framing = take === 'a' ? 'A clear medium-wide narrative view with all three figures engaged in their individual action. Keep their gazes on the work, with believable tension in the rope and visible hand-to-object contact.' : 'A more intimate oblique view at cart height, the rope crossing the foreground diagonally and the bridge receding behind the group. Emphasise the children\'s small delighted and determined facial expressions while keeping the single dragon and the entire cart clearly readable.';
    const prompt = focusedScenes ? [
      'A single illustrated children\'s book scene showing TWO friends: a curly dark-brown-haired little girl in round glasses, a pale blue shirt and yellow dungarees; and one small golden baby dragon with a cream belly and pink wing membranes.',
      take === 'a' ? 'The girl kneels on a mossy stepping stone and reaches out with a small butterfly net to lift one glowing fallen star from a shallow woodland stream. The dragon waits on the grassy bank on the right, leaning forward with delighted surprise. A little wooden tree-workshop doorway and an arched footbridge sit quietly in the distance.' : 'The girl crouches on the left and shows the star resting in her small butterfly net to the little dragon on the right. The dragon stands on a mossy rock, stretches its little front paws toward the light and looks at the star in wonder. A stream winds toward a distant wooden tree-workshop door.',
      style.style,
      style.lighting.replace('three friends', 'two friends'),
      style.layout.replace('a diagonal cart', 'a diagonal stream').replace('the three friends', 'the two friends'),
      'Two distinct characters share one place and interact naturally. Make the gesture, expressions and painterly medium the focus. A wordless narrative picture.',
    ].join('\n') : [
      textScenes ? 'One original Talea picture-book illustration showing exactly three friends with these distinct appearances:' : 'One original Talea picture-book illustration with three friends. Each attached image supplies ONE named character identity:',
      `${textScenes ? 'BOY' : 'IMAGE 1'}: Alexander, ${figures[0].appearance}. ${textScenes ? 'GIRL' : 'IMAGE 2'}: Tilda Tüftel, ${figures[1].appearance}. ${textScenes ? 'DRAGON' : 'IMAGE 3'}: Funkelflug, ${figures[2].appearance.split(';')[0]}.`,
      'Tilda keeps her round goggles and yellow overalls visible in the scene.',
      `MEDIUM: ${style.style}`,
      `VISIBLE ACTION: ${neutralScene}`,
      `LIGHT AND SPACE: ${style.lighting} ${style.layout}`,
      framing,
      `${textScenes ? 'Invent the design in the stated medium, preserving the written identifying traits.' : 'Use the three reference portraits for the named identities and their illustration medium. Their resting poses change to the action.'} Alexander, Tilda and Funkelflug each appear once in one continuous wordless scene. Tilda holds the net; Alexander holds the rope; Funkelflug holds the rear cart handle. Each child has an ordinary human body.`,
    ].join('\n');
    const id = `${String(style.n).padStart(2, '0')}-${style.id}-${take}-${sceneVersion}`;
    const file = `images/${id}.jpg`;
    sceneRows.push({ style, take, id, file, prompt });
    await writeFile(join(root, 'prompts', `${id}.txt`), prompt);
  }
}
if (run && !portraitsOnly) await parallel(sceneRows, async row => {
  const refs = textScenes ? [] : await Promise.all((focusedScenes ? figures.slice(1) : figures).map(async figure => {
    const bytes = await readFile(portraitFile(row.style, figure));
    const ref = uri(bytes); allowedReferenceHashes.add(hash(ref)); return ref;
  }));
  await generate(row.id, row.prompt, refs, 1216, 832, row.take === 'a' ? 2127830332 : 2127830369, row.file);
});

const ready = sceneRows.filter(row => existsSync(join(root, row.file)));
const imageTiles: { input: Buffer; left: number; top: number }[] = [];
for (const row of ready) {
  const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="608" height="48"><rect width="608" height="48" fill="#faf6ed"/><text x="16" y="32" font-family="Arial" font-size="22" fill="#233b35">${row.style.n}${row.take.toUpperCase()} · ${esc(row.style.name)}</text></svg>`);
  imageTiles.push({ input: await sharp(join(root, row.file)).resize(608, 416).extend({ top: 48, bottom: 0, left: 0, right: 0, background: '#faf6ed' }).composite([{ input: label, left: 0, top: 0 }]).jpeg({ quality: 93 }).toBuffer(), left: row.take === 'a' ? 0 : 608, top: (row.style.n - 1) * 464 });
}
if (imageTiles.length) await sharp({ create: { width: 1216, height: 2320, channels: 3, background: '#faf6ed' } }).composite(imageTiles).jpeg({ quality: 94 }).toFile(join(root, 'vergleich.jpg'));
const cost = existingReceipts.reduce((s, r) => s + (r.costUSD ?? 0), 0);
await writeFile(join(root, 'results.json'), JSON.stringify({ model, completeScenes: ready.length, completePortraits: existingReceipts.filter(r => r.id.endsWith(portraitVersion) && r.state === 'complete').length, costUSD: cost, combinedCostUSD: cost + previousCost, receipts: existingReceipts.map(({ imageURL: _omitURL, ...r }) => r) }, null, 2));
await writeFile(join(root, 'index.html'), `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Talea · Deine fünf Stilvorlagen in FLUX.2</title><style>*{box-sizing:border-box}body{margin:0;background:#f6f2e9;color:#273c35;font:16px/1.6 system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:32px}h1{font:clamp(32px,5vw,64px)/1.08 Georgia,serif}h2{font:30px Georgia,serif}a{color:#246c61}section{margin:42px 0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}figure{margin:0;background:#fffdfa;border:1px solid #ddd5c8;border-radius:12px;overflow:hidden}img{display:block;width:100%;height:auto}figcaption{padding:12px 16px}.source{display:flex;gap:22px;align-items:center;margin:16px 0}.source img{width:220px;max-height:230px;object-fit:contain;background:white;border-radius:8px}.source p{max-width:760px}.muted{color:#67766b;font-size:14px}details{margin-top:14px}summary{cursor:pointer}@media(max-width:800px){main{padding:20px 12px}.grid{grid-template-columns:1fr}.source{display:block}.source img{margin-bottom:14px}}</style><main><p class="muted">TALEA FIGURENWELT · FLUX.2 · VORLAGENVERGLEICH</p><h1>Fünf Vorlagen.<br>Fünf neue Bildsprachen.</h1><p>Alexander, Tilda Tüftel und Funkelflug stoppen einen Sternenwagen. Jede Richtung erhält drei separat mit FLUX.2 neu gezeichnete Figurenreferenzen und zwei Szenenvarianten. Medium, Formensprache, Licht, Bildaufbau und Papieranteil folgen der jeweiligen Nutzervorlage.</p><p class="muted">${esc(model)} · 4 Steps · CFG 4 · Szenen 1216 × 832 · ${ready.length}/10 Szenen · gemeldete Kosten dieses Laufs $${cost.toFixed(5)}. Die Vorlagen dienen als Stilreferenz; ihre Figuren, Texte und Motive werden nicht übernommen.</p>${styles.map(style => `<section><h2>${style.n} · ${esc(style.name)}</h2><div class="source"><a href="sources/${style.id}.jpg"><img src="sources/${style.id}.jpg" alt="Nutzervorlage ${style.n}"></a><div><p>${esc(style.lighting)} ${esc(style.layout)}</p><p class="muted">Vorlage links · eigene Szenen unten · <a href="references/${style.id}.jpg">neu gezeichnetes Figurenreferenzblatt</a></p></div></div><div class="grid">${ready.filter(row => row.style.id === style.id).map(row => `<figure><a href="${row.file}"><img src="${row.file}" alt="${esc(style.name)} Variante ${row.take.toUpperCase()}" loading="lazy"></a><figcaption>Variante ${row.take.toUpperCase()} · <a href="prompts/${row.id}.txt">vollständiger Prompt</a></figcaption></figure>`).join('')}</div><details><summary>Stilbeschreibung</summary><p>${esc(style.style)}</p></details></section>`).join('')}<p>Weitere Inspiration: <a href="https://bumblebearpublishing.com/blogs/creative-childrens-book-illustrations-styles/">BumbleBear Publishing</a>. Ausschlaggebend für diese Studie sind die fünf hochgeladenen Beispiele.</p></main></html>`);
console.log(`${ready.length}/10 scenes, $${cost.toFixed(5)} this run, $${(cost + previousCost).toFixed(5)} combined. ${root}`);
if (focusedScenes || textScenes) {
  const galleryFile = join(root, 'index.html');
  const gallery = await readFile(galleryFile, 'utf8');
  await writeFile(galleryFile, gallery.replace(
    'Alexander, Tilda Tüftel und Funkelflug stoppen einen Sternenwagen. Jede Richtung erhält drei separat mit FLUX.2 neu gezeichnete Figurenreferenzen und zwei Szenenvarianten. Medium, Formensprache, Licht, Bildaufbau und Papieranteil folgen der jeweiligen Nutzervorlage.',
    focusedScenes
      ? 'Tilda und Funkelflug retten einen leuchtenden Stern aus einem Waldbach. Zwei Varianten je Richtung zeigen den Fang und den gemeinsamen Blick auf den Stern. Diese Stilentwürfe entstehen mit FLUX.2 aus Textbeschreibungen der fünf lokalen Vorlagen. Die vereinfachte Szene und der Verzicht auf Bildreferenzen helfen dabei, die Stilwirkung getrennt von den zuvor beobachteten Figurenvermischungen zu beurteilen.'
      : 'Ein Text-zu-Bild-Vergleich mit FLUX.2 auf Basis der geschriebenen Figurenmerkmale und Stilbeschreibungen. Die hochgeladenen Vorlagen dienen nur dem lokalen Vergleich.'
  ).replaceAll('neu gezeichnetes Figurenreferenzblatt</a>', 'Figurenblatt aus dem Vorversuch</a>'));
}
await writeFile(join(root, 'README.md'), `# FLUX.2: fünf Nutzervorlagen als Stilrichtungen\n\nDie Galerie zeigt ${ready.length}/10 Bilder des Modus ${sceneVersion}.\n\n- Modell: ${model}; 4 Steps, CFG 4; 1216 × 832 Pixel.\n- Hauptgalerie: index.html; Übersicht: vergleich.jpg; Einzelbilder: images/.\n- Endgültige Bild-IDs enden auf ${sceneVersion}. Frühere Versuche bleiben separat erhalten.\n- Vollständige Prompts und Anfrageparameter: prompts/ und requests/.\n- Nutzervorlagen: sources/. Diese Dateien wurden nicht an Runware übertragen. Ihre Bildsprache wurde lokal beschrieben.\n- Die letzte Stilrunde verwendet ${textScenes ? 'keine Bildreferenzen' : 'neu erzeugte Figurenreferenzen'}. Sie ist eine Annäherung an die Vorlagen und kein Test unveränderter Produktionsprompts.\n- Die Versuche mit dem alten Figurenlook und mit neu gezeichneten Referenzen zeigten Stilüberlagerung und Vermischungen zwischen Tilda und dem Drachen. Die letzte Runde verwendet deshalb ${focusedScenes ? 'eine einfachere Szene mit zwei Figuren' : 'eine angepasste Szenenbeschreibung'}.\n- Gemeldete Bildkosten dieser neuen Studie einschließlich Vorversuchen: $${cost.toFixed(5)}; zusammen mit dem ersten Stiltest: $${(cost + previousCost).toFixed(5)}. Das gemeinsame Limit beträgt $0.50.\n\nDie neue Studie ändert keine Produktionskonfiguration. Inspiration: https://bumblebearpublishing.com/blogs/creative-childrens-book-illustrations-styles/ und die fünf vom Nutzer hochgeladenen Beispiele.\n`);
if (!run) console.log('Dry run: prepared sources and portrait requests; no paid calls.');
if (run && !portraitsOnly && ready.length !== (selectedStyle ? 2 : 10)) process.exitCode = 1;
