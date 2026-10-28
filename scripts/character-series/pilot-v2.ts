/** Production v2 engine with fictional avatars, no database writes. Explicit --run, optional --images and --railway. */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import bibles from '../../backend/story/character-series/series-bibles.json';
import { CHARACTER_SERIES_ENGINE, CHARACTER_SERIES_VERSION, validateSeriesLog, extractSeriesLog, withSeriesContext, type SeriesEpisodeLog } from '../../backend/story/character-series/core';
import { SERIES_NARRATIVES } from '../../backend/story/character-series/narrative';
import { SERIES_MODELS, SERIES_POLICY, SERIES_IMAGE_MODEL, SERIES_IMAGE_REVIEW_MODEL, seriesAuthoring, seriesBudget } from '../../backend/story/character-series/authoring';
import { runCharacterSeriesTextEngine, seriesLlmBudget } from '../../backend/story/character-series/engine';
import { directSeriesPictures, generateSeriesImages, validateSeriesShots } from '../../backend/story/character-series/pictures';
import { buildBrief } from '../../backend/story/storybook/context';
import { CostLedger, type StorybookLlm } from '../../backend/story/storybook/llm';
import { extractStorybookChoiceContent, resolveStorybookReasoning, isTruncatedFinishReason } from '../../backend/story/storybook/llm-guards';
import { toCastCandidate } from '../../backend/story/storybook/cast-selection';
import { castAppearance, speciesFromProfile, type VisualEntity } from '../../backend/story/storybook/illustration-stage';
import { seriesLeadCandidate, seriesReferenceAppearance } from '../../backend/story/character-series/identity';
import { buildRunwareTask, createRunwareCaller, LIBRARY_IMAGE_MODEL } from '../../backend/story/library/images';
import { runwareImageModelOptions, runwareReferenceSettings } from '../../backend/ai/runware-image-model-options';

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
if (!args.includes('--run') && !args.includes('--dry')) throw new Error('Use --run or --dry.');
const seriesId = opt('--series', 'funkelflug'), episode = Number(opt('--episode', '1'));
if (![1, 2].includes(episode)) throw new Error('Pilot supports episodes 1 and 2.');
const bible = bibles.find(b => b.id === seriesId)!;
if (!bible) throw new Error('Unknown series.');
const narrative = SERIES_NARRATIVES[seriesId];
const contractHash = createHash('sha256').update(JSON.stringify(narrative)).digest('hex');
const root = resolve(opt('--out', `Logs/character-series-v2/${seriesId}`));
const out = join(root, `episode-${episode}`);
const published = resolve(opt('--publish', `docs/figurenserien/pilot-v2/${seriesId}`));
await mkdir(out, { recursive: true });
let variables = { ...process.env } as Record<string, string>;
if (args.includes('--railway') && args.includes('--run')) {
  // Credentials remain in this process; neither values nor raw CLI output are persisted or printed.
  const windows = process.platform === 'win32';
  const command = windows ? 'powershell.exe' : 'railway';
  const cliArgs = windows ? ['-NoProfile', '-NonInteractive', '-Command', "railway variables --service 'backend 2' --environment production --json"] : ['variables', '--service', 'backend 2', '--environment', 'production', '--json'];
  let raw: string;
  try { raw = execFileSync(command, cliArgs, { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch { throw new Error('Could not read the connected service configuration.'); }
  const loaded = JSON.parse(raw);
  variables = { ...variables, ...loaded };
}
const key = variables.OPENROUTER_API_KEY || variables.OpenRouterAPIKey || variables.OpenRouterApiKey || variables.OpenRouterKey;
const runwareKey = variables.RUNWARE_API_KEY || variables.RunwareApiKey;
if (args.includes('--run') && !key) throw new Error('No OpenRouter key available.');
if (args.includes('--images') && !runwareKey) throw new Error('No Runware key available.');
const pool = JSON.parse(await readFile('exports/character-pool/2026-10-26/talea-characters-2026-10-26-optimiert.json', 'utf8'));
const row = pool.find((r: any) => r.id === bible.characterId);
const lead = toCastCandidate(row)!;
const publicRef = (url: string) => url?.startsWith('bucket://') ? 'https://backend-2-production-3de1.up.railway.app/story/image?key=' + encodeURIComponent(url.replace(/^bucket:\/\/[^/]+\//, '')) : url;
const inline = async (path: string) => 'data:image/webp;base64,' + (await readFile(path)).toString('base64');
// Published fictional book characters serve as test identities, under explicit fictional aliases.
const avatars = [
  { id: 'fictional-nora', name: 'Nora', age: 8, description: 'Neugierig, praktisch, manchmal vorschnell. Plant gern und muss Ben zu Wort kommen lassen.', imageUrl: await inline('frontend/public/library/series/bruno-der-flunkerfisch/characters/ella.webp'), appearance: 'human girl, brown hair in short pigtails, large round red glasses, yellow raincoat over green striped shirt, blue jeans, red shoes' },
  { id: 'fictional-ben', name: 'Ben', age: 7, description: 'Beobachtet genau, stellt kurze Fragen, trockener Humor. Möchte mitentscheiden.', imageUrl: await inline('frontend/public/library/series/die-monster-muellabfuhr/characters/jona.webp'), appearance: 'human boy, brown skin, short tightly curled dark hair, blue hoodie, orange reflective vest, blue jeans, yellow rubber boots' },
];
const config: any = { avatarIds: avatars.map(a => a.id), storybookMode: true, storybookEngine: CHARACTER_SERIES_ENGINE, characterSeriesVersion: CHARACTER_SERIES_VERSION, characterSeriesId: seriesId, genre: 'adventure', setting: 'mountain', ageGroup: '6-8', length: 'medium', language: 'de', humorLevel: 2, suspenseLevel: 2, requireHappyEnd: true, avatarIsHero: false };
let logs: SeriesEpisodeLog[] = [];
if (episode === 2) {
  const previous = JSON.parse(await readFile(opt('--previous', join(root, 'episode-1/result.json')), 'utf8'));
  if (previous.contractHash !== contractHash || !previous.log) throw new Error('First episode with this contract is missing.');
  logs = [withSeriesContext(previous.log, previous.result.pages.map((p: any) => p.title + '\n' + p.content).join('\n\n'))];
}
const brief = buildBrief({ config, band: '6-8', budget: seriesBudget(config.length, '6-8'), heroes: avatars, candidates: [seriesLeadCandidate(lead)], artifacts: [], seed: `series-v2-${seriesId}-${episode}` });
brief.characterSeries = { bible, logs };
if (args.includes('--dry')) {
  const prompt = seriesAuthoring(brief);
  await writeFile(join(out, 'dry-request.json'), JSON.stringify({ system: prompt.system, user: prompt.user() }, null, 2));
  console.log(JSON.stringify({ dry: true, seriesId, episode, promptChars: prompt.system.length + prompt.user().length }));
  process.exit(0);
}
const ledger = new CostLedger();
let count = 0;
const rawLlm: StorybookLlm = async request => {
  const prefix = `${String(++count).padStart(2, '0')}-${request.stage}`;
  const { imageInputs, ...metadata } = request;
  await writeFile(join(out, prefix + '.request.json'), JSON.stringify({ ...metadata, imageInputCount: imageInputs?.length || 0 }, null, 2));
  console.log(`${request.stage} · ${request.model}`);
  const started = Date.now();
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(request.timeoutMs || 180000),
    body: JSON.stringify({ model: request.model, max_tokens: request.maxTokens, reasoning: resolveStorybookReasoning(request.model, request.effort, request.role), usage: { include: true }, ...(request.json ? { response_format: { type: 'json_object' } } : {}),
      messages: [{ role: 'system', content: request.system }, { role: 'user', content: imageInputs?.length ? [{ type: 'text', text: request.user }, ...imageInputs.map(url => ({ type: 'image_url', image_url: { url } }))] : request.user }] }),
  });
  const data: any = await response.json();
  if (!response.ok) throw new Error(`Model request failed: HTTP ${response.status}, ${data?.error?.code || 'provider error'}`);
  const result = { text: extractStorybookChoiceContent(data.choices?.[0]), modelUsed: data.model || request.model, usage: { prompt: data.usage?.prompt_tokens || 0, completion: data.usage?.completion_tokens || 0, total: data.usage?.total_tokens || 0, costUSD: data.usage?.cost || 0 }, durationMs: Date.now() - started, finishReason: data.choices?.[0]?.finish_reason };
  await writeFile(join(out, prefix + '.response.json'), JSON.stringify(result, null, 2));
  if (!result.text || isTruncatedFinishReason(result.finishReason)) { ledger.recordCall(request.stage + '-failed', result, request.role); throw Object.assign(new Error('Incomplete model response.'), { billed: result }); }
  return result;
};
const llm = seriesLlmBudget(rawLlm);
if (args.includes('--review-contracts')) {
  const review = await llm({ stage: 'series-contract-review', role: 'critic', model: SERIES_MODELS.writer, json: true, effort: 'low', maxTokens: 3000, timeoutMs: 180000,
    system: 'Prüfe als kritisches Kinderbuchlektorat diese fünf Serienverträge für 6–8 Jahre: echter erster Zugang der Avatare, klare Vorgeschichte, kausale und begrenzte Weltregeln, konsistente Gegenstände und Zeitverhältnisse, Figuren mit Initiative und variierende Folgenmotoren über vier Bögen. Melde höchstens fünf konkrete Widersprüche oder erhebliche Unklarheiten. Jede Kritik braucht einen exakten kurzen Textbeleg aus einem Feld des gelieferten Vertrags. Kein Lob aus Höflichkeit, keine erfundenen Probleme und keine neue Geschichte. JSON {"issues":[{"seriesId":"...","field":"origin.after","quote":"exakter Feldtextauszug","severity":"major|minor","problem":"...","change":"konkrete kleine Verbesserung"}]}.',
    user: JSON.stringify(SERIES_NARRATIVES),
  });
  ledger.recordCall('series-contract-review', review, 'critic');
  const data = JSON.parse(review.text);
  if (!Array.isArray(data.issues) || data.issues.length > 5) throw new Error('Invalid contract review.');
  for (const issue of data.issues) {
    let field: any = SERIES_NARRATIVES[issue.seriesId];
    for (const key of String(issue.field).split('.')) field = field?.[key];
    if (typeof field !== 'string' || !issue.quote || !field.includes(issue.quote)) throw new Error('Unsupported contract finding.');
  }
  await writeFile(join(out, 'contract-review.json'), JSON.stringify({ ...data, usage: ledger.totals() }, null, 2));
  console.log(JSON.stringify({ issues: data.issues, cost: ledger.totals().costUSD }));
  process.exit(0);
}
try {
  const reusable = args.includes('--reuse-text') ? JSON.parse(await readFile(opt('--reuse-text', ''), 'utf8')) : undefined;
  if (reusable && (reusable.seriesId !== seriesId || reusable.contractHash !== contractHash || reusable.result?.textQuality?.status !== 'passed' || !reusable.result?.finalChecks?.ok)) throw new Error('The reusable manuscript is not verified for this series contract.');
  const result: Awaited<ReturnType<typeof runCharacterSeriesTextEngine>> = reusable?.result || await runCharacterSeriesTextEngine({ brief, llm, ledger, models: SERIES_MODELS, observe: async (stage, payload) => { await writeFile(join(out, stage + '.json'), JSON.stringify(payload, null, 2)); } });
  const storyText = result.pages.map(p => p.title + '\n' + p.content).join('\n\n');
  const identity = { episode, storyId: `fictional-v2-${seriesId}-${episode}`, avatarIds: avatars.map(a => a.id) };
  const validated = validateSeriesLog(result.episode.seriesLogCandidate, storyText, identity);
  const log = withSeriesContext(validated.events.length ? validated : extractSeriesLog({ storyText, ...identity }), storyText);
  let pictures: any, imageCostUSD = 0;
  if (args.includes('--images')) {
    const entities: VisualEntity[] = [
      { id: bible.characterId, name: bible.characterName, kind: 'character', role: 'cast', ...speciesFromProfile(lead.visualProfile, lead.species), appearance: seriesReferenceAppearance(castAppearance(lead.visualProfile, lead.physicalDescription)), forbidden: [], referenceUrl: publicRef(row.image_url || row.imageUrl) },
      ...avatars.map(a => ({ id: a.id, name: a.name, kind: 'character' as const, role: 'hero' as const, species: 'human', isHuman: true, appearance: a.appearance, forbidden: [], referenceUrl: a.imageUrl })),
      ...result.episode.guests.map(g => ({ id: g.id, name: g.name, kind: 'character' as const, role: 'cast' as const, species: g.species, isHuman: g.species === 'human', appearance: g.physicalDescription, forbidden: [] })),
    ];
    const reusedDirection = args.includes('--reuse-direction') ? JSON.parse(await readFile(opt('--reuse-direction', ''), 'utf8')) : undefined;
    const directed = reusedDirection ? { illustrations: validateSeriesShots(reusedDirection, result.pages, entities, bible.characterId) } : await directSeriesPictures({ llm, model: SERIES_MODELS.support, brief, title: result.title, pages: result.pages, entities });
    if ('director' in directed) {
      ledger.recordCall('series-picture-direction', directed.director.call, 'support');
      if (directed.director.repairCall) ledger.recordCall('series-picture-plan-repair', directed.director.repairCall, 'support');
    }
    await writeFile(join(out, 'direction.json'), JSON.stringify(directed.illustrations, null, 2));
    const call = createRunwareCaller(runwareKey!);
    const images = await generateSeriesImages({ illustrations: directed.illustrations, entities, seed: `series-v2-${seriesId}-${episode}`, llm, visionModel: SERIES_IMAGE_REVIEW_MODEL, pageTexts: Object.fromEntries(result.pages.map(p => [p.order, p.content])),
      provider: async request => {
        const task = buildRunwareTask(request);
        const model = opt('--image-model', SERIES_IMAGE_MODEL);
        const outputFormat = opt('--format', model === LIBRARY_IMAGE_MODEL ? 'WEBP' : 'JPEG') as 'WEBP' | 'JPEG' | 'PNG';
        if (!['WEBP', 'JPEG', 'PNG'].includes(outputFormat)) throw new Error('Unsupported image output format.');
        Object.assign(task, { model, ...runwareImageModelOptions({ model, steps: model === 'runware:400@2' ? 4 : undefined, CFGScale: 4, outputFormat }) });
        Object.assign(task, runwareReferenceSettings(model, request.referenceRegions, request.referenceImages.length));
        const response = await call(task); return { url: response.imageURL, costUSD: response.cost };
      } });
    images.qaCalls.forEach((r, i) => ledger.recordCall(`image-qa-${i + 1}`, r, 'support'));
    imageCostUSD = images.imageCostUSD;
    const all = [images.cover!, ...images.pages.values()];
    pictures = { ...images, pages: [...images.pages], accepted: all.every(i => i.status === 'passed') };
    await mkdir(published, { recursive: true });
    for (const item of all) {
      const file = join(published, `folge-${episode}-${item.page === 0 ? 'cover' : `kapitel-${item.page}`}.webp`);
      await Promise.all([rm(file, { force: true }), rm(file.replace(/\.webp$/, '.jpg'), { force: true })]);
      if (item.status !== 'passed' || !item.url) continue;
      const response = await fetch(item.url); if (!response.ok) throw new Error('Pilot image download failed.');
      const extension = response.headers.get('content-type')?.includes('jpeg') ? 'jpg' : 'webp';
      await writeFile(extension === 'webp' ? file : file.replace(/\.webp$/, '.jpg'), new Uint8Array(await response.arrayBuffer()));
    }
  }
  const report = { seriesId, episode, version: CHARACTER_SERIES_VERSION, contractHash, models: SERIES_MODELS, imageModel: opt('--image-model', SERIES_IMAGE_MODEL), policy: SERIES_POLICY, fictionalAvatars: avatars.map(a => a.name), reusedTextFrom: reusable ? opt('--reuse-text', '') : undefined, status: pictures && !pictures.accepted ? 'accepted-with-missing-images' : 'accepted', result, log, pictures, stages: ledger.all(), costs: { ...ledger.totals(), imageCostUSD, totalUSD: ledger.totals().costUSD + imageCostUSD }, note: 'Real API costs of this run. A reused manuscript is explicitly excluded. Production avatar-development call excluded; no database writes.' };
  await writeFile(join(out, 'result.json'), JSON.stringify(report, null, 2));
  await mkdir(published, { recursive: true });
  await writeFile(join(published, `folge-${episode}.md`), `# ${result.title}\n\n${result.description}\n\n${result.pages.map(p => `## ${p.title}\n\n${p.content}`).join('\n\n')}\n`);
  await writeFile(join(published, `folge-${episode}-pruefung.json`), JSON.stringify({ ...report, result: undefined, pictures: pictures ? { accepted: pictures.accepted, imageCalls: pictures.imageCalls, imagesGenerated: pictures.imagesGenerated, regenerated: pictures.regenerated } : undefined, log }, null, 2));
  console.log(JSON.stringify({ title: result.title, status: report.status, costs: report.costs, output: published }));
} catch (error) {
  await writeFile(join(out, 'failure.json'), JSON.stringify({ error: String(error), stages: ledger.all(), totals: ledger.totals() }, null, 2));
  throw error;
}
