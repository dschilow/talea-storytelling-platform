/** Direct visual style study, authorised by the user's continuation after the
 * explicit Runware / five uploaded examples / USD 0.50 confirmation.
 * bun scripts/image-bench/figurenwelt-visual-style-study.ts [--run] [--take=a]
 * Source examples supply style; the two Talea identities are described in text.
 */
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { FLUX2_KLEIN_9B_KV_MODEL, runwareImageModelOptions } from '../../backend/ai/runware-image-model-options';

type Style = { n: number; id: string; name: string };
type Row = { id: string; key: string; taskUUID: string; state: string; file?: string; imageURL?: string; imageUUID?: string; costUSD?: number; error?: string; durationMs?: number };
const root = resolve('output/figurenwelt-flux2-direkte-stilvorlagen-2026-11-03');
const previous = resolve('output/figurenwelt-flux2-vorlagen-2026-11-03');
const run = process.argv.includes('--run');
const selectedTake = process.argv.find(a => a.startsWith('--take='))?.split('=')[1];
if (selectedTake && !['a', 'b'].includes(selectedTake)) throw new Error('Unknown take.');
const styles: Style[] = JSON.parse(await readFile(new URL('./figurenwelt-reference-styles.styles.json', import.meta.url), 'utf8'));
const model = FLUX2_KLEIN_9B_KV_MODEL;
const sha = (v: Buffer | string) => createHash('sha256').update(v).digest('hex');
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
for (const dir of ['sources', 'images', 'prompts', 'requests', 'results']) await mkdir(join(root, dir), { recursive: true });
const previousResults = JSON.parse(await readFile(join(previous, 'results.json'), 'utf8'));
const previousCost: number = previousResults.combinedCostUSD;
const previousUnpriced = previousResults.receipts.filter((r: Row) => r.costUSD === undefined).length * 0.03;
const rows: Row[] = [];
for (const file of await readdir(join(root, 'results'))) if (file.endsWith('.json')) rows.push(JSON.parse(await readFile(join(root, 'results', file), 'utf8')));
let committed = previousCost + previousUnpriced + rows.reduce((s, r) => s + (r.costUSD ?? 0.03), 0);
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
      const vars = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "railway variables --service 'backend 2' --environment production --json"], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }));
      apiKey = vars.RUNWARE_API_KEY || vars.RunwareApiKey || '';
    } catch { throw new Error('Runware configuration unavailable; no credentials printed.'); }
  }
  if (!apiKey) throw new Error('Runware key unavailable.');
}
const briefs = [
  'Preserve the reference\'s whimsical compact character shapes, soft painted edges, scraped and stippled matte pigment, deeply atmospheric teal and midnight blue, quirky expressive faces and amber glints. Paint with irregular masses and tactile brush texture rather than uniform cartoon outlines.',
  'Preserve the reference\'s delicate warm pencil lines, tangled soft curls, rosy cheeks, translucent pale green watercolor, creamy sunlight and gentle breathing space. The figures and natural surroundings must have the same softly hand-drawn warmth.',
  'Preserve the reference\'s bold expressive shapes, energetic rough paint strokes, lively humorous faces, mossy green foreground and cool misty-blue layered forest. Let the creature have the same appealing wildness and animated body language while remaining our golden baby dragon.',
  'Preserve the reference\'s very loose thin broken pen drawing, small simple faces and tiny eyes, wiry playful proportions, sparse translucent watercolor and large untouched white paper. A brisk charming sketch with irregular marks, not meticulous cartoon colouring.',
  'Preserve the reference\'s expressive dark hand-ink contours, beautifully broad translucent watercolor patches, teal, grassy green and warm yellow harmony, visible paper grain and spontaneous irregular painted edge. Retain the handcrafted picture-book clarity.',
];
const sourceScenes = [
  'In a twisting blue woodland cavern, our small human girl stands on the LEFT in her plain yellow dungarees and pale-blue shirt. She holds a tiny amber lantern and points toward a wonderful luminous opening. Our little golden dragon stands separately on a low rock on the RIGHT, with its full silhouette and its own two pink-membraned wings clearly visible. Leave a small gap of lit cave floor between their bodies. Build a deep theatrical tunnel from broad irregular overlapping blue shapes, scratched painted patterns and tiny pools of light. The two friends are small within an immense mysterious environment.',
  'Our curly-haired girl in yellow dungarees sits comfortably beneath tall sunlit trees with one knee raised and a quiet contented face. Our small golden dragon curls up beside her. An open storybook rests near her hand. Keep the soft intimate close composition, informal relaxed posture, translucent pale-green forest and delicately tangled hair drawing of the reference.',
  'Our little girl in yellow dungarees and round glasses stands on a mossy log in a fantastically overgrown mushroom forest. Our friendly golden baby dragon, large and round beside her, has an exuberant goofy face and reaches one paw toward a bright little star balanced on a leaf. Deep plants overlap in the foreground, giant mushrooms arch overhead, and the cool misty forest recedes behind them. Preserve the reference\'s wonderfully wild brush-painted creature design and lively small child.',
  'Our curly-haired little girl in yellow dungarees walks jauntily across a fallen log over a little stream, carrying a small net with one golden star caught inside it. Our tiny golden dragon trots along behind her. Keep both figures small, sketchy and simply drawn with slender lively limbs, very tiny facial marks and charmingly unsteady pen strokes. A few loosely washed grasses and flowers suggest the setting, surrounded by generous untouched white paper.',
  'Our dark-curly-haired girl in yellow dungarees sits among meadow flowers on a grassy hill and opens a colourful storybook toward our large cuddly golden baby dragon seated close beside her. Their faces show shared delight. Broad teal greenery, little wildflowers and a pale-blue open sky surround the affectionate pair, with an irregular hand-painted watercolor edge on warm paper.',
];
const jobs: { style: Style; take: string; id: string; file: string; prompt: string; task: Record<string, unknown>; key: string }[] = [];
for (const style of styles) {
  let source = sharp(await readFile(join(previous, 'sources', `${style.id}.jpg`)));
  // The last example is a cover. Its left-hand painting is sufficient as a
  // medium sample; the cover title is outside this crop.
  if (style.n === 5) source = source.extract({ left: 0, top: 0, width: 730, height: 773 });
  const bytes = await source.jpeg({ quality: 92 }).toBuffer();
  const sourcePath = `sources/${style.id}.jpg`;
  await writeFile(join(root, sourcePath), bytes);
  for (const take of ['a', 'b']) {
    const action = take === 'a'
      ? 'Our little girl kneels on a mossy stepping stone, reaching out with a butterfly net to rescue one glowing fallen star from a shallow woodland stream. Our little dragon waits on the opposite grassy bank, leaning toward the star with delighted surprise. An old wooden tree-workshop door and a small footbridge are quiet background details.'
      : 'Our little girl crouches on the left and shows a glowing star resting in her butterfly net to our little dragon on a mossy rock on the right. It stretches its little front paws toward the glow with a comically amazed expression. A stream curves toward a distant wooden tree-workshop door.';
    const prompt = take === 'b' ? [
      'Transform the attached illustration into a different original children\'s story picture while retaining its actual handmade visual language. Keep its specific facial geometry, characteristic body proportions, line rhythm, visible marks, paint roughness, surface and composition density.',
      sourceScenes[style.n - 1],
      'The new cast consists of one human girl with dark curly hair, round glasses, a pale-blue shirt and yellow dungarees, and one golden baby dragon with a cream belly and pink wing membranes. Translate both into the same drawing language as the reference.',
      'The material and shape language of the source painting should be evident throughout the finished picture. Keep spontaneous irregularities and simplify details as much as the source does. A single wordless illustration.',
    ].join('\n') : [
      'Create a NEW original Talea children\'s book illustration. The attached IMAGE 1 is strictly the visual STYLE reference: translate its drawing language, mark-making, character proportions, paint texture, edge treatment and spatial design into a different narrative picture.',
      briefs[style.n - 1],
      'Our cast consists of exactly TWO friends: Tilda, a little human girl with curly dark-brown hair, round glasses, a pale blue shirt and yellow dungarees; and Funkelflug, one small golden baby dragon with a cream belly and pink wing membranes.',
      action,
      'Match the artistic medium of the attached painting throughout the new characters and environment. Invent the described action rather than copying the reference\'s poses or scene. Keep the two figures separate and their interaction clear. A single wordless picture.',
    ].join('\n');
    const id = `${String(style.n).padStart(2, '0')}-${style.id}-${take}${style.n === 1 && take === 'b' ? '-separated' : ''}`;
    const task = { taskType: 'imageInference', model, numberResults: 1, outputType: ['URL'], includeCost: true,
      ...runwareImageModelOptions({ model, steps: 4, CFGScale: 4, outputFormat: 'JPEG' }), width: 1216, height: 832, seed: take === 'a' ? 2127830332 : 2127830369,
      positivePrompt: prompt.replace(/\s+/g, ' ').trim(), inputs: { referenceImages: [`data:image/jpeg;base64,${bytes.toString('base64')}`] } };
    const safeTask = { ...task, inputs: { sourceFile: sourcePath, sourceSHA256: sha(bytes) } };
    const key = sha(JSON.stringify(safeTask));
    await writeFile(join(root, 'prompts', `${id}.txt`), prompt);
    await writeFile(join(root, 'requests', `${id}.json`), JSON.stringify({ ...safeTask, key }, null, 2));
    jobs.push({ style, take, id, file: `images/${id}.jpg`, prompt, task, key });
  }
}
await writeFile(join(root, 'experiment.json'), JSON.stringify({ model, steps: 4, CFGScale: 4, width: 1216, height: 832, previousReportedCostUSD: previousCost, previousUnpricedReservationUSD: previousUnpriced, combinedCostCapUSD: 0.5,
  method: 'One directly attached user-supplied illustration per style. Its medium and design guide new two-character Talea scenes; original character portraits are not supplied.',
  authorisation: 'User continued with “Weiter” immediately after the explicit question about transferring these five example images to Runware, with a combined cost cap of USD 0.50.',
  sources: styles.map(s => ({ id: s.id, name: s.name, file: `sources/${s.id}.jpg` })) }, null, 2));

async function generate(job: typeof jobs[number]) {
  let row = rows.find(r => r.id === job.id);
  if (row && row.key !== job.key) throw new Error(`Changed request ${job.id}; preserve this run.`);
  if (row?.state === 'complete' && row.file && existsSync(join(root, row.file))) return;
  if (!run) return;
  if (row && !row.imageURL) throw new Error(`Uncertain previous call ${job.id}; no automatic repurchase.`);
  if (!row) {
    if (committed + 0.03 > 0.5) throw new Error('Combined USD 0.50 budget reached.');
    committed += 0.03;
    row = { id: job.id, key: job.key, taskUUID: randomUUID(), state: 'reserved' };
    rows.push(row);
  }
  const resultFile = join(root, 'results', `${job.id}.json`);
  await writeFile(resultFile, JSON.stringify(row, null, 2));
  const start = Date.now();
  try {
    if (!row.imageURL) {
      const response = await fetch('https://api.runware.ai/v1', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify([{ taskUUID: row.taskUUID, ...job.task }]), signal: AbortSignal.timeout(180000) });
      const body: any = await response.json();
      if (!response.ok || body.errors?.length) throw new Error(`Runware HTTP ${response.status}: ${body.errors?.[0]?.code || 'provider_error'}`);
      const output = body.data?.[0];
      if (Number.isFinite(output?.cost) && output.cost >= 0) { row.costUSD = output.cost; committed += output.cost - 0.03; }
      if (!output?.imageURL || output.NSFWContent === true) throw new Error('No usable image.');
      row.imageURL = output.imageURL; row.imageUUID = output.imageUUID; row.state = 'generated';
      await writeFile(resultFile, JSON.stringify(row, null, 2));
    }
    const response = await fetch(row.imageURL!, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Download HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const meta = await sharp(bytes).metadata();
    if (meta.width !== 1216 || meta.height !== 832) throw new Error('Unexpected image dimensions.');
    await writeFile(join(root, job.file), bytes);
    row.state = 'complete'; row.file = job.file; row.error = undefined;
  } catch (error) { row.state = 'error'; row.error = (error as Error).message; }
  row.durationMs = Date.now() - start;
  await writeFile(resultFile, JSON.stringify(row, null, 2));
  console.log(`${job.id}: ${row.state}, $${row.costUSD?.toFixed(5) ?? 'unknown'}${row.error ? ` (${row.error})` : ''}`);
  if (row.state !== 'complete') throw new Error(`Incomplete ${job.id}`);
}
const selected = selectedTake ? jobs.filter(j => j.take === selectedTake) : jobs;
let next = 0;
await Promise.all(Array.from({ length: 3 }, async () => { while (next < selected.length) await generate(selected[next++]); }));

const ready = jobs.filter(j => existsSync(join(root, j.file)));
const pairTiles: { input: Buffer; left: number; top: number }[] = [];
const comparisonTiles: { input: Buffer; left: number; top: number }[] = [];
async function tile(file: string, label: string) {
  const caption = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="608" height="48"><rect width="608" height="48" fill="#faf6ed"/><text x="14" y="31" font-family="Arial" font-size="21" fill="#253e35">${esc(label)}</text></svg>`);
  return sharp(file).resize(608, 416, { fit: 'contain', background: '#fffdf8' }).extend({ top: 48, bottom: 0, left: 0, right: 0, background: '#faf6ed' }).composite([{ input: caption, left: 0, top: 0 }]).jpeg({ quality: 93 }).toBuffer();
}
for (const style of styles) comparisonTiles.push({ input: await tile(join(root, 'sources', `${style.id}.jpg`), `${style.n} · Deine Vorlage`), left: 0, top: (style.n - 1) * 464 });
for (const job of ready) {
  const input = await tile(join(root, job.file), `${job.style.n}${job.take.toUpperCase()} · ${job.style.name}`);
  pairTiles.push({ input, left: job.take === 'a' ? 0 : 608, top: (job.style.n - 1) * 464 });
  comparisonTiles.push({ input, left: job.take === 'a' ? 608 : 1216, top: (job.style.n - 1) * 464 });
}
if (ready.length) {
  await sharp({ create: { width: 1216, height: 2320, channels: 3, background: '#faf6ed' } }).composite(pairTiles).jpeg({ quality: 94 }).toFile(join(root, 'vergleich.jpg'));
  await sharp({ create: { width: 1824, height: 2320, channels: 3, background: '#faf6ed' } }).composite(comparisonTiles).jpeg({ quality: 94 }).toFile(join(root, 'vorlage-gegen-ergebnis.jpg'));
}
const cost = rows.reduce((s, r) => s + (r.costUSD ?? 0), 0);
await writeFile(join(root, 'results.json'), JSON.stringify({ model, complete: ready.length, costUSD: cost, combinedCostUSD: previousCost + cost, receipts: rows.map(({ imageURL: _omit, ...row }) => row) }, null, 2));
await writeFile(join(root, 'index.html'), `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Talea · Direkte Stilvorlagen mit FLUX.2</title><style>*{box-sizing:border-box}body{margin:0;background:#f6f2e9;color:#273c35;font:16px/1.6 system-ui,sans-serif}main{max-width:1600px;margin:auto;padding:36px 24px}h1{font:clamp(34px,5vw,64px)/1.1 Georgia}h2{font:29px Georgia}section{margin:42px 0}a{color:#246c61}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}figure{margin:0;border:1px solid #ddd5c8;border-radius:12px;overflow:hidden;background:#fffdf8}img{display:block;width:100%;aspect-ratio:1216/832;object-fit:contain;background:white}figcaption{padding:12px 15px}.meta{color:#67766b;font-size:14px}.source img{object-fit:contain}details{margin-top:12px}@media(max-width:850px){.grid{grid-template-columns:1fr}main{padding:24px 12px}}</style><main><p class="meta">TALEA FIGURENWELT · FLUX.2 · DIREKTE BILDREFERENZEN</p><h1>Deine Vorlagen.<br>Neue Talea-Illustrationen.</h1><p>Jede Richtung verwendet dein Beispielbild direkt als visuelle Stilreferenz. Variante A zeigt dieselbe Sternenrettung am Waldbach. Variante B orientiert sich stärker an Formensprache, Bildaufbau und Erzählwelt der jeweiligen Vorlage und zeigt dafür eine andere Szene mit den eigenen Figuren.</p><p class="meta">${model} · 4 Steps · CFG 4 · 1216 × 832 · ${ready.length}/10 Bilder · gemeldete Kosten dieser Runde $${cost.toFixed(5)} · alle bisherigen Studien zusammen $${(previousCost + cost).toFixed(5)}</p>${styles.map(style => `<section><h2>${style.n} · ${esc(style.name)}</h2><div class="grid"><figure class="source"><a href="sources/${style.id}.jpg"><img src="sources/${style.id}.jpg" alt="Deine Stilvorlage ${style.n}"></a><figcaption>Deine Vorlage · visuelle Stilreferenz</figcaption></figure>${jobs.filter(j => j.style.id === style.id).map(job => `<figure>${existsSync(join(root, job.file)) ? `<a href="${job.file}"><img src="${job.file}" alt="Neue Szene ${job.take.toUpperCase()} in ${esc(style.name)}" loading="lazy"></a>` : '<p>Diese Variante steht noch aus.</p>'}<figcaption>Variante ${job.take.toUpperCase()} · <a href="prompts/${job.id}.txt">vollständiger Prompt</a></figcaption></figure>`).join('')}</div></section>`).join('')}<p><a href="../figurenwelt-flux2-vorlagen-2026-11-03/index.html">Vorheriger Vergleich nur mit Stilbeschreibungen</a></p></main></html>`);
await writeFile(join(root, 'README.md'), `# Direkte visuelle Stilvorlagen mit FLUX.2\n\n${ready.length}/10 Bilder; Modell ${model}, 4 Steps, CFG 4, 1216 × 832.\n\nJeder neue Szenenauftrag enthält genau ein vom Nutzer bereitgestelltes Beispiel als Stilreferenz. Die eigenen Figuren und Handlungen stehen im Prompt. Die Bilder wurden nach der Fortsetzung des Nutzers auf die ausdrückliche Frage zur Übertragung an Runware und zum gemeinsamen USD-0.50-Limit erzeugt.\n\nGalerie: index.html. Zehn Bilder: vergleich.jpg. Vorlagen neben Ergebnissen: vorlage-gegen-ergebnis.jpg. Prompts und sichere Anfrageparameter liegen in prompts/ und requests/. Ergebnisbelege liegen in results/.\n\nGemeldete Kosten dieser Runde: $${cost.toFixed(5)}. Einschließlich aller bisherigen Stilversuche: $${(previousCost + cost).toFixed(5)}. Frühere unklare Reservierungen werden zusätzlich im Budget berücksichtigt.\n\nDie Produktionskonfiguration wurde nicht geändert.\n`);
console.log(`${ready.length}/10 images, $${cost.toFixed(5)} this round, $${(previousCost + cost).toFixed(5)} combined. ${root}`);
if (!run) console.log('Dry run; no paid calls.');
if (run && selected.some(j => !existsSync(join(root, j.file)))) process.exitCode = 1;
