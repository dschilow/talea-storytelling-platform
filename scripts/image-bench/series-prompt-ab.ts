/**
 * Paired first-attempt test: production prompts, scene captions and individual references.
 * No story writes, redraws, judge fallback or hidden API retries. An uncertain charge keeps its reservation.
 *
 * bun --env-file=.env.local scripts/image-bench/series-prompt-ab.ts --fixture <json> --out <dir> --run --budget 1.50
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { withTaleaImageStyle } from '../../backend/ai/image-style';
import { FLUX3_KLEIN_MODEL, FLUX2_KLEIN_9B_KV_MODEL, runwareImageModelOptions, runwareReferenceSettings, type RunwareReferenceRegion } from '../../backend/ai/runware-image-model-options';
import { encodeReferenceSprite, renderIdentitySprite, renderSingleReference } from '../../backend/story/image-reference-sprite';
import { seriesSceneCaption } from './lib/series-caption';
import { generateSeriesImages, seriesReferenceRegions, type SeriesBox, type SeriesVisualBeat } from '../../backend/story/character-series/pictures';
import { readSeriesQa, seriesPicturePasses, seriesPictureUsable, type SeriesQa } from '../../backend/story/character-series/quality';
import { SERIES_IMAGE_REVIEW_MODEL } from '../../backend/story/character-series/authoring';
import type { VisualEntity } from '../../backend/story/storybook/illustration-stage';
import type { IllustrationShot } from '../../backend/story/storybook/types';
import type { ImageRequest } from '../../backend/story/storybook/images';
import type { LlmRequest } from '../../backend/story/storybook/llm';
import { acceptsTemperature, providerSafetyReason, resolveStorybookReasoning, StorybookSafetyBlock } from '../../backend/story/storybook/llm-guards';

interface TestCase {
  id: string;
  referenceProvenance: string;
  shot: IllustrationShot & { visualBeat: SeriesVisualBeat; boxes?: Record<string, SeriesBox> };
  entities: Array<VisualEntity & { file: string }>;
  source: string;
  existingImage?: string;
}
interface ApiReply {
  data?: Array<{ imageURL?: string; cost?: number; NSFWContent?: boolean }>;
  choices?: Array<{ message?: { content?: string }; finish_reason?: string; error?: { code?: string; message?: string } }>;
  usage?: { cost?: number; prompt_tokens?: number; completion_tokens?: number };
  errors?: Array<{ code?: string; message?: string }>;
  error?: { code?: string; message?: string };
}
interface Charge {
  key: string;
  kind: 'image' | 'judge';
  state: 'reserved' | 'settled';
  usd: number;
}
interface Result {
  id: string;
  caseId: string;
  variant: string;
  seed: number;
  model: string;
  judgeModel?: string;
  file?: string;
  imageCostUSD?: number;
  judgeCostUSD?: number;
  status: 'passed' | 'usable' | 'rejected' | 'image-error' | 'review-error' | 'provider-blocked' | 'unreviewed';
  qa?: SeriesQa;
  error?: string;
  generationKey?: string;
  judgeKey?: string;
}

const arg = (name: string, fallback?: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? fallback : process.argv[index + 1];
};
const fixture = arg('fixture');
if (!fixture) throw new Error('--fixture fehlt.');
const out = resolve(arg('out', 'Logs\\image-bench\\series-prompt-ab')!);
const cap = Number(arg('budget', '1.50'));
if (!Number.isFinite(cap) || cap <= 0 || cap > 3) throw new Error('--budget muss zwischen 0 und 3 USD liegen.');
const variants = arg('variants', 'production,caption,multi,flux2kv')!.split(',');
if (variants.some(v => !['production', 'caption', 'multi', 'caption-free', 'multi-free', 'flux2kv', 'existing'].includes(v))) throw new Error('Unbekannte Promptvariante.');
const seeds = arg('seeds', '5201,5202')!.split(',').map(Number);
if (!seeds.length || seeds.some(seed => !Number.isInteger(seed) || seed < 0 || seed > 2147483647)) throw new Error('Ungültige Seeds.');
const judgeEffort = arg('judge-effort', 'production');
if (!['production', 'low', 'medium', 'high'].includes(judgeEffort!)) throw new Error('Ungültige Prüftiefe.');
const judgeModel = arg('judge-model', SERIES_IMAGE_REVIEW_MODEL)!;
if (!['google/gemini-3.8-flash', 'google/gemini-3.5-flash-lite', 'openai/gpt-6-luna'].includes(judgeModel)) {
  throw new Error('Prüfmodell nicht für das Kostenlimit dieses Benchmarks freigegeben.');
}
const selected = arg('only')?.split(',');
const cases: TestCase[] = JSON.parse(await readFile(resolve(fixture), 'utf8'));
if (!Array.isArray(cases) || !cases.length) throw new Error('Das Fixture enthält keine Testfälle.');
const chosen = cases.filter(c => !selected || selected.includes(c.id));
if (!chosen.length || (selected && selected.some(id => !chosen.some(c => c.id === id)))) throw new Error('Ein angeforderter Testfall fehlt.');
for (const c of chosen) {
  if (!/^[a-z0-9_-]+$/i.test(c.id) || !c.referenceProvenance || !c.shot?.scene || !c.source || !Array.isArray(c.entities) || !c.entities.length ||
    c.shot.onStage.some(id => !c.entities.some(e => e.id === id && e.file && e.appearance))) throw new Error(`Unvollständiger Testfall ${c.id}.`);
}
await mkdir(join(out, 'cache'), { recursive: true });
await mkdir(join(out, 'images'), { recursive: true });
await mkdir(join(out, 'requests'), { recursive: true });
const run = process.argv.includes('--run');
const generateOnly = process.argv.includes('--generate-only');
const cacheOnly = process.argv.includes('--cache-only');
const keys = {
  image: process.env.RUNWARE_API_KEY || process.env.RunwareApiKey,
  judge: process.env.OPENROUTER_API_KEY || process.env.OpenRouterAPIKey,
};
if (run && !cacheOnly && (!keys.image || (!generateOnly && !keys.judge))) throw new Error('Runware- oder OpenRouter-Schlüssel fehlt.');
const journal = join(out, 'charges.jsonl');
const charges = new Map<string, Charge>();
if (existsSync(journal)) for (const line of (await readFile(journal, 'utf8')).split('\n').filter(Boolean)) {
  const charge: Charge = JSON.parse(line);
  if (!Number.isFinite(charge.usd) || charge.usd < 0) throw new Error('Ungültiger Kostenjournaleintrag.');
  charges.set(charge.key, charge);
}
const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24);
const accounted = (): number => [...charges.values()].reduce((sum, c) => sum + c.usd, 0);
const record = async (charge: Charge): Promise<void> => {
  await appendFile(journal, JSON.stringify(charge) + '\n');
  charges.set(charge.key, charge);
};

async function paidRequest(kind: Charge['kind'], body: Record<string, unknown>): Promise<{ reply: ApiReply; key: string }> {
  const key = hash({ kind, body });
  const file = join(out, 'cache', `${key}.json`);
  let reply: ApiReply;
  let httpStatus = 200;
  if (existsSync(file)) {
    reply = JSON.parse(await readFile(file, 'utf8'));
  } else {
    if (cacheOnly) throw new Error(`Anfrage ${key} fehlt im Cache; kein API-Aufruf erlaubt.`);
    if (charges.has(key)) throw new Error(`Anfrage ${key} wurde bereits begonnen; kein automatischer Neukauf.`);
    // Above the current per-image price and a 4k-token Flash check plus two modest image inputs.
    const reserve = kind === 'image' ? 0.03 : 0.035;
    if (accounted() + reserve > cap) throw new Error('Testbudget erreicht.');
    await record({ key, kind, state: 'reserved', usd: reserve });
    const endpoint = kind === 'image' ? 'https://api.runware.ai/v1' : 'https://openrouter.ai/api/v1/chat/completions';
    const payload = kind === 'image' ? [{ ...body, taskUUID: randomUUID() }] : body;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${keys[kind]}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(kind === 'image' ? 180000 : 90000),
    });
    httpStatus = response.status;
    const parsed: unknown = await response.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${kind}: Ungültige Anbieterantwort.`);
    reply = parsed as ApiReply;
    const reported = kind === 'image' ? reply.data?.[0]?.cost : reply.usage?.cost;
    if (typeof reported === 'number' && Number.isFinite(reported) && reported >= 0) {
      await record({ key, kind, state: 'settled', usd: reported });
    }
    await writeFile(file, JSON.stringify(reply));
  }
  const blocked = providerSafetyReason(reply);
  if (blocked) throw new StorybookSafetyBlock(String(body.model), 'image-benchmark', blocked);
  if (httpStatus >= 400 || reply.errors?.length || reply.error) throw new Error(`${kind}: HTTP ${httpStatus}, ${reply.errors?.[0]?.code || reply.error?.code || 'provider_error'}`);
  const cost = kind === 'image' ? reply.data?.[0]?.cost : reply.usage?.cost;
  if (cost === undefined || !Number.isFinite(cost) || cost < 0) throw new Error(`${kind}: Kosten fehlen; Reservierung bleibt bestehen.`);
  return { reply, key };
}

const inline = async (file: string): Promise<string> => `data:image/jpeg;base64,${(await sharp(await readFile(file)).jpeg({ quality: 90, chromaSubsampling: '4:4:4' }).toBuffer()).toString('base64')}`;

async function prepare(c: TestCase, model: string): Promise<{ request: ImageRequest; review: LlmRequest; sheet: string; portraits: string[] }> {
  const figures = c.shot.onStage.map(id => c.entities.find(e => e.id === id)!);
  const bytes = await Promise.all(figures.map(e => readFile(resolve(e.file))));
  const sheetBytes = await encodeReferenceSprite(bytes.length === 1 ? await renderSingleReference(bytes[0]) : await renderIdentitySprite(bytes));
  const sheet = `data:image/jpeg;base64,${sheetBytes.toString('base64')}`;
  const portraits = await Promise.all(bytes.map(async image => `data:image/jpeg;base64,${(await encodeReferenceSprite(await renderSingleReference(image))).toString('base64')}`));
  await writeFile(join(out, 'requests', `${c.id}-sheet.jpg`), sheetBytes);
  let request: ImageRequest | undefined;
  let review: LlmRequest | undefined;
  await generateSeriesImages({
    illustrations: { cover: c.shot, pages: [] },
    entities: figures.map(e => ({ ...e, referenceUrl: 'https://example.test/reference.webp' })),
    provider: async value => { request = value; return { url: 'https://example.test/candidate.webp', costUSD: 0 }; },
    llm: async value => {
      review = value;
      return {
        text: JSON.stringify({ visibleIds: figures.map(e => e.id), identityById: Object.fromEntries(figures.map(e => [e.id, 1])),
          posing: false, primaryActionClear: true, storyConsistent: true, materialContradiction: false, sceneMatch: 1, styleMatch: 1, defects: [] }),
        modelUsed: 'offline-fixture', usage: { prompt: 0, completion: 0, total: 0, costUSD: 0 }, durationMs: 0,
      };
    },
    seed: 'prompt-benchmark', visionModel: SERIES_IMAGE_REVIEW_MODEL, imageModel: model,
    pageTexts: { [c.shot.page]: c.source },
    buildReference: async () => ({ urls: [sheet], mode: figures.length === 1 ? 'single' : 'sprite',
      subjects: figures.map(e => ({ displayName: e.name, kind: 'character' })) }),
  });
  if (!request || !review) throw new Error(`Produktionsanfrage für ${c.id} fehlt.`);
  return { request, review, sheet, portraits };
}

const results: Result[] = [];
for (const c of chosen) {
  const figures = c.shot.onStage.map(id => c.entities.find(e => e.id === id)!);
  const flux3 = await prepare(c, FLUX3_KLEIN_MODEL);
  const flux2 = variants.includes('flux2kv') ? await prepare(c, FLUX2_KLEIN_9B_KV_MODEL) : undefined;
  for (const seed of seeds) for (const variant of variants) {
    const id = `${c.id}-${variant}-${seed}`;
    const model = variant === 'flux2kv' ? FLUX2_KLEIN_9B_KV_MODEL : FLUX3_KLEIN_MODEL;
    const baseline = variant === 'flux2kv' ? flux2! : flux3;
    let prompt = baseline.request.prompt;
    let regions: RunwareReferenceRegion[] | undefined = baseline.request.referenceRegions;
    let references = [baseline.sheet];
    if (variant === 'caption' || variant === 'multi' || variant === 'caption-free' || variant === 'multi-free') {
      const individualReferences = variant === 'multi' || variant === 'multi-free';
      regions = seriesReferenceRegions(figures, c.shot.visualBeat, 0, c.shot.boxes, c.shot.page);
      if (individualReferences) {
        references = baseline.portraits;
        regions = regions.map((r, i) => ({ ...r, referenceIndex: i, sourceBox: [0, 0, 1000, 1000] }));
      }
      const caption = seriesSceneCaption({ shot: c.shot, identities: figures, regions, individualReferences, regionBound: !variant.endsWith('-free') });
      prompt = caption.prompt;
      regions = caption.regions;
    }
    const body = {
      taskType: 'imageInference', model, numberResults: 1, outputType: ['URL'], includeCost: true,
      width: baseline.request.width, height: baseline.request.height, seed,
      ...runwareImageModelOptions({ model, outputFormat: 'WEBP' }),
      positivePrompt: withTaleaImageStyle(prompt), inputs: { referenceImages: references },
      ...runwareReferenceSettings(model, regions, references.length),
    };
    await writeFile(join(out, 'requests', `${id}.json`), JSON.stringify({ ...body, inputs: { referenceImages: references.map(hash) }, referenceProvenance: c.referenceProvenance }, null, 2));
    if (!run) { console.log(`${id}: ${body.positivePrompt.length} chars; ${references.length} references`); continue; }
    const result: Result = { id, caseId: c.id, variant, seed, model, judgeModel, status: 'image-error', generationKey: hash({ kind: 'image', body }) };
    const resultFile = join(out, `${id}.json`);
    try {
      if (existsSync(resultFile)) {
        const saved: Result = JSON.parse(await readFile(resultFile, 'utf8'));
        const generationKey = hash({ kind: 'image', body });
        if (variant !== 'existing' && saved.generationKey !== generationKey) throw new Error(`Test ${id} geändert: neues Ausgabeverzeichnis verwenden.`);
        if (saved.judgeModel && saved.judgeModel !== judgeModel) throw new Error(`Prüfmodell für ${id} geändert: neues Ausgabeverzeichnis verwenden.`);
        if (generateOnly) {
          results.push(saved);
          console.log(`${id}: cached ${saved.status}`);
          continue;
        }
      }
      if (variant === 'existing') {
        if (!c.existingImage || !existsSync(c.existingImage)) throw new Error(`Vorhandenes Bild für ${c.id} fehlt.`);
        result.file = resolve(c.existingImage);
        result.imageCostUSD = 0;
      } else {
        const generated = await paidRequest('image', body);
        result.generationKey = generated.key;
        result.imageCostUSD = generated.reply.data?.[0]?.cost;
        const image = generated.reply.data?.[0];
        if (!image?.imageURL || image.NSFWContent) throw new Error('Kein freigegebenes Bild zurückgegeben.');
        result.file = join(out, 'images', `${id}.webp`);
        if (!existsSync(result.file)) {
          const download = await fetch(image.imageURL, { signal: AbortSignal.timeout(60000) });
          if (!download.ok) throw new Error(`Bilddownload HTTP ${download.status}`);
          const bytes = Buffer.from(await download.arrayBuffer());
          await sharp(bytes).metadata();
          await writeFile(result.file, bytes);
        }
      }
      result.status = 'unreviewed';
      if (!generateOnly) {
        result.status = 'review-error';
        const effort = judgeEffort === 'medium' || judgeEffort === 'high' ? judgeEffort
          : judgeEffort === 'production' && baseline.review.effort === 'medium' ? 'medium' : 'low';
        const reviewBody = {
          model: judgeModel, max_tokens: effort === 'low' ? 4000 : 6000,
          ...(acceptsTemperature(judgeModel) ? { temperature: 0 } : {}),
          usage: { include: true },
          reasoning: resolveStorybookReasoning(judgeModel, effort, 'support'), response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: baseline.review.system },
            { role: 'user', content: [
              { type: 'text', text: baseline.review.user },
              { type: 'image_url', image_url: { url: await inline(result.file) } },
              { type: 'image_url', image_url: { url: baseline.sheet } },
            ] },
          ],
        };
        result.judgeKey = hash({ kind: 'judge', body: reviewBody });
        const judged = await paidRequest('judge', reviewBody);
        result.judgeKey = judged.key;
        result.judgeCostUSD = judged.reply.usage?.cost;
        const choice = judged.reply.choices?.[0];
        const qa = readSeriesQa(choice?.message?.content || '', figures);
        if (!qa) throw new Error(`Unlesbare Prüfung: ${choice?.finish_reason || 'empty'}, ${choice?.error?.code || 'no_valid_json'}`);
        result.qa = qa;
        result.status = seriesPicturePasses(qa, c.shot.page === 0) ? 'passed' : seriesPictureUsable(qa) ? 'usable' : 'rejected';
      }
    } catch (error) {
      if (error instanceof StorybookSafetyBlock) result.status = 'provider-blocked';
      result.error = error instanceof Error ? error.message : 'Unbekannter Testfehler';
      console.error(`${id}: ${result.error}`);
      if (result.error === 'Testbudget erreicht.' || result.error.includes('neues Ausgabeverzeichnis')) throw error;
    }
    results.push(result);
    await writeFile(resultFile, JSON.stringify(result, null, 2));
    console.log(`${id}: ${result.status}; $${accounted().toFixed(5)} accounted`);
  }
}
if (run) {
  const accumulated = new Map(results.map(r => [r.id, r]));
  for (const file of await readdir(out)) {
    if (!/-(production|caption|multi|caption-free|multi-free|flux2kv|existing)-\d+\.json$/.test(file)) continue;
    const row: Result = JSON.parse(await readFile(join(out, file), 'utf8'));
    if (`${row.id}.json` !== file) throw new Error(`Ungültige gespeicherte Test-ID in ${file}.`);
    if (!accumulated.has(row.id)) accumulated.set(row.id, row);
  }
  const allResults = [...accumulated.values()].sort((a, b) => a.id.localeCompare(b.id));
  const summary = [...new Set(allResults.map(r => r.variant))].map(variant => {
    const rows = allResults.filter(r => r.variant === variant);
    return { variant, total: rows.length, passed: rows.filter(r => r.status === 'passed').length,
      usable: rows.filter(r => r.status === 'usable').length, rejected: rows.filter(r => r.status === 'rejected').length,
      imageErrors: rows.filter(r => r.status === 'image-error').length, reviewErrors: rows.filter(r => r.status === 'review-error').length,
      providerBlocks: rows.filter(r => r.status === 'provider-blocked').length, unreviewed: rows.filter(r => r.status === 'unreviewed').length,
      imageCostUSD: rows.some(r => r.generationKey && charges.get(r.generationKey)?.state === 'reserved')
        ? null : rows.reduce((sum, r) => sum + (r.imageCostUSD || 0), 0),
      judgeCostUSD: rows.some(r => r.judgeKey && charges.get(r.judgeKey)?.state === 'reserved')
        ? null : rows.reduce((sum, r) => sum + (r.judgeCostUSD || 0), 0) };
  });
  await writeFile(join(out, 'summary.json'), JSON.stringify({ capUSD: cap, accountedUSD: accounted(), uncertainCharges: [...charges.values()].filter(c => c.state === 'reserved'), judge: judgeModel, summary, results: allResults }, null, 2));
  console.log(JSON.stringify({ accountedUSD: accounted(), summary }, null, 2));
}
