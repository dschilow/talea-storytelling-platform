/** Local three-story trial of the real opt-in lane. No Encore/database writes. */
import { execFileSync } from 'node:child_process';
import { appendFile, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import bibles from '../../backend/story/character-series/series-bibles.json';
import { seriesBudget, SERIES_IMAGE_MODEL, SERIES_IMAGE_REVIEW_MODEL, SERIES_PICTURE_DIRECTION_MODEL } from '../../backend/story/character-series/authoring';
import { prepareSeriesVisualReferences } from '../../backend/story/character-series/visual-references';
import { seriesLeadCandidate } from '../../backend/story/character-series/identity';
import { seriesLlmBudget } from '../../backend/story/character-series/engine';
import { QUALITY_SERIES_ENGINE, QUALITY_SERIES_MODELS, QUALITY_SERIES_POLICY } from '../../backend/story/character-series-quality/profile';
import { runQualitySeriesTextEngine } from '../../backend/story/character-series-quality/text';
import { generateQualitySeriesImages } from '../../backend/story/character-series-quality/images';
import { directQualitySeriesPictures } from '../../backend/story/character-series-quality/direction';
import { buildBrief } from '../../backend/story/storybook/context';
import { CostLedger, type LlmRequest, type StorybookLlm } from '../../backend/story/storybook/llm';
import { extractStorybookChoiceContent, resolveStorybookReasoning, isTruncatedFinishReason, StorybookSafetyBlock } from '../../backend/story/storybook/llm-guards';
import { toCastCandidate } from '../../backend/story/storybook/cast-selection';
import { castAppearance, speciesFromProfile, type VisualEntity } from '../../backend/story/storybook/illustration-stage';
import { buildRunwareTask, createRunwareCaller } from '../../backend/story/library/images';
import { runwareImageModelOptions } from '../../backend/ai/runware-image-model-options';
import { isPublishable, type ImageProvider } from '../../backend/story/storybook/images';
import { pictureHasPanels } from '../../backend/story/character-series/panels';
import { codexPort } from '../wonder-story/codex-port';

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
if (!args.includes('--run')) throw new Error('Explicit --run required. Uses subscription quota and actual image/editor API billing.');
const root = resolve(opt('--out', 'output/figurenwelt-quality-2026-11-02'));
await mkdir(root, { recursive: true });
let variables = { ...process.env } as Record<string, string>;
if (args.includes('--railway')) {
  try {
    const raw = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "railway variables --service 'backend 2' --environment production --json"], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    variables = { ...variables, ...JSON.parse(raw) };
  } catch { throw new Error('Could not read the linked API configuration; no credentials printed.'); }
}
const apiKey = variables.OPENROUTER_API_KEY || variables.OpenRouterAPIKey || variables.OpenRouterApiKey || variables.OpenRouterKey;
const imageKey = variables.RUNWARE_API_KEY || variables.RunwareApiKey;
if (!apiKey || !imageKey) throw new Error('Editor and Runware API keys required; use --railway for the linked configuration.');
const pool = JSON.parse(await readFile('exports/character-pool/2026-10-26/talea-characters-2026-10-26-optimiert.json', 'utf8'));
let actualCashUSD = 0;
try { actualCashUSD = (await readFile(join(root, 'billing.jsonl'), 'utf8')).trim().split('\n').reduce((sum, line) => sum + (Number(JSON.parse(line).costUSD) || 0), 0); } catch { /* first run */ }
const bill = async (stage: string, model: string, costUSD: number, details: Record<string, unknown> = {}) => {
  actualCashUSD += costUSD;
  await appendFile(join(root, 'billing.jsonl'), JSON.stringify({ timestamp: new Date().toISOString(), stage, model, costUSD, ...details }) + '\n');
};
const cashCap = Number(opt('--cash-cap', '0.40'));
const api: StorybookLlm = async request => {
  if (actualCashUSD >= cashCap) throw new Error('Pilot API cash cap reached.');
  const started = Date.now();
  const send = () => fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(request.timeoutMs || 180000),
    body: JSON.stringify({ model: request.model, max_tokens: request.maxTokens, reasoning: resolveStorybookReasoning(request.model, request.effort, request.role), usage: { include: true },
      ...(request.json ? { response_format: { type: 'json_object' } } : {}), messages: [{ role: 'system', content: request.system }, { role: 'user', content: request.imageInputs?.length
        ? [{ type: 'text', text: request.user }, ...request.imageInputs.map(url => ({ type: 'image_url', image_url: { url } }))] : request.user }] }) });
  let response: Response;
  try { response = await send(); }
  catch (error) {
    if (!/socket|fetch failed|connection|ECONNRESET/i.test(String(error))) throw error;
    await appendFile(join(root, 'billing.jsonl'), JSON.stringify({ timestamp: new Date().toISOString(), stage: request.stage, model: request.model, costUSD: 0, billingUnknown: true, note: 'Connection closed before usage accounting; one bounded retry.' }) + '\n');
    response = await send();
  }
  const data: any = await response.json();
  if (!response.ok) throw new Error(`Editor API HTTP ${response.status}; model ${request.model}.`);
  await bill(request.stage, request.model, Number(data.usage?.cost) || 0, { usage: data.usage, finishReason: data.choices?.[0]?.finish_reason });
  const text = extractStorybookChoiceContent(data.choices?.[0]);
  if (['content_filter', 'safety'].includes(data.choices?.[0]?.finish_reason)) throw new StorybookSafetyBlock(request.model, request.stage, data.choices[0].finish_reason);
  if (!text || isTruncatedFinishReason(data.choices?.[0]?.finish_reason)) throw Object.assign(new Error(`Truncated response from ${request.model}`), { billed: { usage: { costUSD: Number(data.usage?.cost) || 0 } } });
  return { text, modelUsed: data.model || request.model, durationMs: Date.now() - started,
    usage: { prompt: data.usage?.prompt_tokens || 0, completion: data.usage?.completion_tokens || 0, total: data.usage?.total_tokens || 0,
      cachedPromptTokens: data.usage?.prompt_tokens_details?.cached_tokens || 0, costUSD: Number(data.usage?.cost) || 0 } };
};
const inline = async (file: string) => 'data:image/webp;base64,' + (await readFile(file)).toString('base64');
const avatars = [
  { id: 'fictional-nora', name: 'Nora', age: 8, description: 'Neugierig, praktisch, manchmal vorschnell; möchte planen und muss Ben zu Wort kommen lassen.', imageUrl: await inline('frontend/public/library/series/bruno-der-flunkerfisch/characters/ella.webp'), appearance: 'girl with short brown pigtails, red round glasses, yellow raincoat, green striped shirt, blue jeans and red shoes' },
  { id: 'fictional-ben', name: 'Ben', age: 7, description: 'Beobachtet genau, trockener Humor, stellt kurze Fragen und möchte mitentscheiden.', imageUrl: await inline('frontend/public/library/series/die-monster-muellabfuhr/characters/jona.webp'), appearance: 'boy with brown skin and short dark tight curls, blue hoodie, orange reflective vest, blue jeans and yellow boots' },
];
const summaries: any[] = [];
for (const seriesId of opt('--series', 'tilda-tueftel,kapitaen-blubbert,funkelflug').split(',')) {
  const out = join(root, seriesId);
  await mkdir(out, { recursive: true });
  const bible = bibles.find(b => b.id === seriesId);
  if (!bible) throw new Error('Unknown series.');
  const lead = seriesLeadCandidate(toCastCandidate(pool.find((row: any) => row.id === bible.characterId))!);
  const config: any = { avatarIds: avatars.map(a => a.id), storybookMode: true, storybookEngine: QUALITY_SERIES_ENGINE, characterSeriesId: seriesId,
    genre: seriesId === 'kapitaen-blubbert' ? 'animals' : seriesId === 'tilda-tueftel' ? 'modern' : 'adventure', setting: 'village', complexity: 'medium', ageGroup: '6-8', length: 'medium', language: 'de', humorLevel: 2, suspenseLevel: 2, requireHappyEnd: true, avatarIsHero: false };
  const brief = buildBrief({ config, band: '6-8', budget: seriesBudget('medium', '6-8'), heroes: avatars, candidates: [lead], artifacts: [], seed: `quality-pilot-${seriesId}-1` });
  brief.characterSeries = { bible, logs: [] };
  const ledger = new CostLedger();
  const ports = new Map<string, StorybookLlm>();
  let sequence = Math.max(0, ...(await readdir(out)).map(name => Number(name.match(/^(\d+)-/)?.[1]) || 0)), firstReview: LlmRequest | undefined, draft: string | undefined;
  const raw: StorybookLlm = async request => {
    if (request.stage === 'series-author' && args.includes('--resume')) {
      try {
        const cached = JSON.parse(await readFile(join(resolve(opt('--draft-root', root)), seriesId, '01-series-author.response.json'), 'utf8'));
        if (cached.text) { draft = cached.text; console.log(`${seriesId}: reused subscription draft; review runs again`); return { ...cached, modelUsed: 'reused-draft', usage: { prompt: 0, completion: 0, total: 0, costUSD: 0 } }; }
      } catch { /* no prior draft */ }
    }
    const prefix = `${String(++sequence).padStart(2, '0')}-${request.stage}`;
    const { imageInputs, ...metadata } = request;
    await writeFile(join(out, `${prefix}.request.json`), JSON.stringify({ ...metadata, imageInputCount: imageInputs?.length || 0 }, null, 2));
    console.log(`${seriesId}: ${request.stage} (${request.model})`);
    const quota = args.includes('--quota') && request.model.startsWith('openai/') && (!args.includes('--quota-writers-only') || request.role === 'writer');
    let port = api;
    if (quota) {
      const model = request.model.replace(/^openai\//, '');
      if (!ports.has(model)) ports.set(model, codexPort(join(out, 'quota', model), model, { images: true }));
      port = ports.get(model)!;
    }
    const reply = await port({ ...request, timeoutMs: Math.max(request.timeoutMs || 0, quota ? 420000 : 180000) });
    await writeFile(join(out, `${prefix}.response.json`), JSON.stringify({ ...reply, transport: quota ? 'codex-subscription' : 'openrouter-api' }, null, 2));
    if (request.stage === 'series-author') draft = reply.text;
    if (request.stage === 'series-editorial-review') firstReview = request;
    return reply;
  };
  const llm = seriesLlmBudget(raw, 'medium', QUALITY_SERIES_POLICY);
  const startCash = actualCashUSD, started = Date.now();
  try {
    const textPath = join(out, 'text.json');
    let text;
    try { text = JSON.parse(await readFile(textPath, 'utf8')); console.log(`${seriesId}: resumed checked text`); }
    catch { text = await runQualitySeriesTextEngine({ brief, llm, models: QUALITY_SERIES_MODELS, ledger }); await writeFile(textPath, JSON.stringify(text, null, 2)); }
    await writeFile(join(out, 'story.md'), `# ${text.title}\n\n${text.description}\n\n${text.pages.map((p: any) => `## ${p.title}\n\n${p.content}`).join('\n\n')}`);
    if (draft) await writeFile(join(out, 'draft.txt'), draft);
    if (firstReview && args.includes('--compare-sonnet') && summaries.length === 0) {
      const sonnet = await api({ ...firstReview, stage: 'pilot-sonnet-comparison', model: 'anthropic/claude-sonnet-5.5', effort: 'low', maxTokens: 4000 });
      await writeFile(join(out, 'sonnet-comparison.json'), JSON.stringify(sonnet, null, 2));
    }
    const inlineLead = await inline(`frontend/public/library/character-series/leads/${seriesId}.webp`);
    let entities: VisualEntity[] = [
      ...avatars.map(a => ({ id: a.id, name: a.name, kind: 'character' as const, role: 'hero' as const, species: 'human', isHuman: true, appearance: a.appearance, forbidden: [], referenceUrl: a.imageUrl })),
      { id: lead.id, name: lead.name, kind: 'character', role: 'cast', ...speciesFromProfile(lead.visualProfile, lead.species), appearance: castAppearance(lead.visualProfile, lead.physicalDescription), forbidden: [], referenceUrl: inlineLead },
      ...text.episode.guests.map((g: any) => ({ id: g.id, name: g.name, kind: 'character' as const, role: 'cast' as const, species: g.species, isHuman: g.species === 'human', appearance: g.physicalDescription, forbidden: [], referenceUrl: g.imageUrl })),
    ];
    const runware = createRunwareCaller(imageKey);
    let imageNumber = 0;
    const provider: ImageProvider = async request => {
      if (actualCashUSD >= cashCap) throw new Error('Pilot API cash cap reached.');
      const task = { ...buildRunwareTask(request), model: SERIES_IMAGE_MODEL, ...runwareImageModelOptions({ model: SERIES_IMAGE_MODEL, outputFormat: 'JPEG' }) };
      const response = await runware(task); await bill(request.logStage || 'image', SERIES_IMAGE_MODEL, response.cost);
      const bytes = new Uint8Array(await (await fetch(response.imageURL)).arrayBuffer());
      await writeFile(join(out, `image-${String(++imageNumber).padStart(2, '0')}-page-${request.page}.jpg`), bytes);
      return { url: response.imageURL, costUSD: response.cost };
    };
    const visuals = await prepareSeriesVisualReferences({ pages: text.pages, entities, llm, model: SERIES_PICTURE_DIRECTION_MODEL, provider, seed: brief.seed, readableReference: async url => url,
      recordCall: call => ledger.recordCall('series-visual-reference-plan', call, 'support') });
    entities = visuals.entities;
    const direction = await directQualitySeriesPictures({ llm, model: SERIES_PICTURE_DIRECTION_MODEL, brief, title: text.title, pages: text.pages, entities });
    ledger.recordCall('quality-direction', direction.director.call, 'support');
    if (direction.director.repairCall) ledger.recordCall('quality-direction-repair', direction.director.repairCall, 'support');
    await writeFile(join(out, 'direction.json'), JSON.stringify(direction, null, 2));
    const images = await generateQualitySeriesImages({ illustrations: direction.illustrations, entities, provider, seed: brief.seed, llm, visionModel: SERIES_IMAGE_REVIEW_MODEL,
      pageTexts: Object.fromEntries(direction.pages.map(p => [p.order, p.content])), reservedImageCalls: visuals.calls,
      chapterByPage: Object.fromEntries(direction.slots.map((slot, index) => [index + 1, slot.chapter])), panelCheck: pictureHasPanels });
    images.qaCalls.forEach((call, i) => ledger.recordCall(`quality-visual-${i}`, call, 'support'));
    const selected = [images.cover, ...images.pages.values()];
    const report = { pipeline: QUALITY_SERIES_ENGINE, seriesId, title: text.title, durationMs: Date.now() - started, policy: QUALITY_SERIES_POLICY,
      text, images: { ...images, pages: [...images.pages] }, selections: images.selections,
      actualApiCashUSD: actualCashUSD - startCash, subscriptionQuota: args.includes('--quota'), stages: ledger.all(),
      allPicturesApproved: selected.every(isPublishable) && images.bookReview.status === 'passed', imageCostUSD: images.imageCostUSD + visuals.costUSD,
      note: 'Codex calls use subscription quota, not free inference. API cash excludes subscription cost. No database or production story writes. These three pilots cannot establish a population-wide quality gain.' };
    await writeFile(join(out, 'result.json'), JSON.stringify(report, null, 2));
    const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const imageData = new Map<string, string>();
    for (const [index, outcome] of selected.entries()) if (outcome?.url && isPublishable(outcome)) {
      const bytes = Buffer.from(await (await fetch(outcome.url)).arrayBuffer());
      await writeFile(join(out, `selected-${index}.jpg`), bytes);
      imageData.set(outcome.url, `data:image/jpeg;base64,${bytes.toString('base64')}`);
    }
    const book = `<!doctype html><html lang="de"><meta charset="utf-8"><title>${escape(text.title)}</title><style>body{max-width:780px;margin:40px auto;padding:20px;background:#fffaf0;color:#29241f;font:20px/1.65 Georgia}img{display:block;max-width:100%;margin:30px auto}h1,h2{line-height:1.2}small{font:14px sans-serif}</style><h1>${escape(text.title)}</h1><small>Figurenwelt Qualität · ${args.includes('--quota') ? 'Codex-Kontingent + API-Bilder/Lektorat' : 'API-Lauf'}</small>${imageData.get(images.cover?.url || '') ? `<img src="${imageData.get(images.cover!.url!)}">` : ''}${text.pages.map((p: any) => `<h2>${escape(p.title)}</h2>${p.content.split(/\n\n+/).map((paragraph: string, index: number) => `<p>${escape(paragraph)}</p>${direction.placed.flatMap((placement, i) => { const slot = direction.slots[i]; const outcome = images.pages.get(i + 1); return slot.chapter === p.order && placement.afterParagraph === index && outcome?.url && imageData.has(outcome.url) ? [`<img src="${imageData.get(outcome.url)}">`] : []; }).join('')}`).join('')}`).join('')}</html>`;
    await writeFile(join(out, 'book.html'), book);
    summaries.push({ seriesId, title: text.title, actualApiCashUSD: report.actualApiCashUSD, approved: selected.filter(isPublishable).length, planned: selected.length, imageCalls: images.imageCalls + visuals.calls });
    console.log(JSON.stringify(summaries.at(-1)));
  } catch (error) {
    await writeFile(join(out, 'failure.json'), JSON.stringify({ message: String(error), actualApiCashUSD: actualCashUSD - startCash, stages: ledger.all() }, null, 2));
    summaries.push({ seriesId, failed: true, error: String(error) });
    console.log(`${seriesId}: ${String(error).slice(0, 240)}`);
  }
  await writeFile(join(root, 'summary.json'), JSON.stringify({ actualApiCashUSD: actualCashUSD, cashCapUSD: cashCap, stories: summaries }, null, 2));
}
console.log(JSON.stringify({ finished: true, actualApiCashUSD: actualCashUSD, stories: summaries }));
