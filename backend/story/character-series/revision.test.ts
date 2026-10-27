// @ts-ignore Bun test helpers are runtime-only in the Encore project.
import { describe, expect, test } from 'bun:test';
import { applyChapterEdits, runCharacterSeriesTextEngine, seriesLlmBudget } from './engine';
import { seriesAuthoring, seriesBudget, SERIES_MODELS, SERIES_POLICY } from './authoring';
import { SERIES_NARRATIVES } from './narrative';
import { withSeriesContext, seriesPrompt } from './core';
import { directSeriesPictures, generateSeriesImages, validateSeriesShots, seriesPicturePasses } from './pictures';
import { CostLedger, type StorybookLlm } from '../storybook/llm';
import { buildBrief } from '../storybook/context';
import type { VisualEntity } from '../storybook/illustration-stage';
import bibles from './series-bibles.json';

const bible = bibles.find(b => b.id === 'funkelflug')!;
const brief = () => {
  const b = buildBrief({ config: { avatarIds: ['kid'], genre: 'adventure', setting: 'mountain', ageGroup: '6-8', length: 'short', complexity: 'medium', avatarIsHero: false }, band: '6-8', budget: { ...seriesBudget('short', '6-8'), pages: 2, totalWordsMin: 10, totalWordsMax: 5000 }, heroes: [{ id: 'kid', name: 'Nora', description: 'neugierig' }], candidates: [{ id: bible.characterId, name: 'Funkelflug', species: 'dragon', whoTheyAre: 'ein kleiner Drache', personality: [], speechStyle: [], canLead: true }], artifacts: [], seed: 'series-regression' });
  b.characterSeries = { bible, logs: [] };
  return b;
};
const text = `FIGUR: Funkelflug | pool | ${bible.characterId} | companion\nTITEL: Die alte Glocke\nBESCHREIBUNG: Eine Einladung.\nIDEE: Funkelflug entdeckt die Wegewarte.\nREGEL: Kleine Flügel tragen ihn nicht.\nFUNDSTÜCK: kein\nKAPITEL 1: Am Berg\nFunkelflug stellte seinen Becher ab. Nora hielt ihn schon fest.\n\nDer Drache sprang über die Wurzel und landete im Gras. Die Glocke schlug dreimal.\nKAPITEL 2: Die Warte\nFunkelflug zeigte Nora den Bodengang. Gemeinsam prüften sie den Ausgang.\n\nDann klingelte oben etwas, obwohl niemand das Seil berührte. Der Drache steckte seine Nase durch die Tür.`;
const response = (value: string) => ({ text: value, modelUsed: 'test', usage: { prompt: 1, completion: 1, total: 2, costUSD: 0 }, durationMs: 0 });

describe('Figurenserien revision 2', () => {
  test('every catalogue world has its own arrival, encounter, motor and four developed arcs', () => {
    for (const b of bibles) {
      const n = SERIES_NARRATIVES[b.id];
      expect(n).toBeDefined();
      expect(n.origin.arrival.length).toBeGreaterThan(80);
      expect(n.origin.encounter.length).toBeGreaterThan(80);
      expect(n.arcs).toHaveLength(4);
      expect(n.arcs.every(a => a.possibilities.length >= 3)).toBe(true);
    }
    const a = seriesAuthoring(brief());
    expect(a.system).toContain('BEFORE the first cooperative task');
    expect(a.user()).toContain('AVATAR ARRIVAL');
    expect(a.user()).toContain('FIRST ENCOUNTER');
  });
  test('a missing arrival triggers one local correction and recheck, preserving other chapters', async () => {
    const calls: string[] = [];
    const llm: StorybookLlm = async r => {
      calls.push(r.stage);
      if (r.stage === 'series-author') return response(text);
      if (r.stage === 'series-editorial-review') return response(JSON.stringify({ issues: [{ severity: 'major', quote: '', problem: 'Die Kinder sind ohne Begegnung da.', change: 'Den Weg und die erste Begegnung erzählen.' }] }));
      if (r.stage === 'series-local-repair') return response(JSON.stringify({ edits: [{ chapter: 1, before: 'Funkelflug stellte seinen Becher ab. Nora hielt ihn schon fest.', after: 'Funkelflug übte allein. Nora kam vom Weg herauf, weil sie eine Glocke gehört hatte. „Wer bist du?“, fragte sie. „Funkelflug“, sagte der Drache. Nora stellte sich vor. Erst dann fing sie seinen fallenden Becher.' }] }));
      return response('{"issues":[]}');
    };
    const result = await runCharacterSeriesTextEngine({ brief: brief(), llm, models: SERIES_MODELS, ledger: new CostLedger() });
    expect(calls).toEqual(['series-author', 'series-editorial-review', 'series-local-repair', 'series-editorial-recheck']);
    expect(result.pages[0].content).toContain('Nora kam vom Weg');
    expect(result.pages[1].content).toContain('Gemeinsam prüften sie den Ausgang.');
    expect(result.textQuality?.status).toBe('passed');
  });
  test('unsupported findings fail without paying for a rewrite', async () => {
    const calls: string[] = [];
    const llm: StorybookLlm = async r => { calls.push(r.stage); return response(r.stage === 'series-author' ? text : '{"issues":[{"severity":"major","quote":"Ein nicht vorhandener Satz.","problem":"Fehler","change":"Ändern"}]}'); };
    await expect(runCharacterSeriesTextEngine({ brief: brief(), llm, models: SERIES_MODELS, ledger: new CostLedger() })).rejects.toThrow('Textbeleg');
    expect(calls).toHaveLength(2);
  });
  test('local repair must identify one unique passage and stays bounded', () => {
    expect(() => applyChapterEdits([{ title: '', text: 'Dies ist ein langer Satz. Dies ist ein langer Satz.' }], [{ chapter: 1, before: 'Dies ist ein langer Satz.', after: 'Eine Änderung.' }])).toThrow();
    expect(() => applyChapterEdits([{ title: '', text: 'Ein anderer Absatz.' }], [{ chapter: 1, before: 'Ein fehlender Absatz.', after: 'Eine Änderung.' }])).toThrow();
  });
  test('request budget stops further calls after count or reported spend', async () => {
    let paid = 0;
    const bounded = seriesLlmBudget(async () => { paid++; return response('ok'); });
    const request: any = { model: 'test', stage: 'test' };
    for (let i = 0; i < SERIES_POLICY.maxLlmCalls; i++) await bounded(request);
    await expect(bounded(request)).rejects.toThrow('Kostenlimit');
    expect(paid).toBe(SERIES_POLICY.maxLlmCalls);
    const costly = seriesLlmBudget(async () => ({ ...response('ok'), usage: { prompt: 1, completion: 1, total: 2, costUSD: 0.09 } }));
    await costly(request);
    await expect(costly(request)).rejects.toThrow('Kostenlimit');
  });
  test('continuity contains only literal source paragraphs and shows the latest episode context', () => {
    const source = 'Nora kam mit Ben zum Berg.\n\nDas Brett versperrte den Tunnel.\n\nFunkelflug zog den Stift heraus.\n\nDanach aßen sie gemeinsam auf der Wiese.\n\nUnter dem Fenster hing eine zweite Schnur.';
    const log = withSeriesContext({ episode: 1, storyId: 'first', avatarIds: ['kid'], events: [{ fact: 'Durchgang', quote: 'Funkelflug zog den Stift heraus.' }], relationships: [], openThreads: [] }, source);
    expect(log.context?.every(p => source.includes(p))).toBe(true);
    expect(seriesPrompt(bible, [log], [{ id: 'kid', name: 'Nora' }])).toContain('Danach aßen sie gemeinsam auf der Wiese.');
    expect(log.context?.join('').length).toBeLessThanOrEqual(5000);
  });
  test('only a provably free empty answer gets one retry, paid failures stop immediately', async () => {
    let attempts = 0;
    const free = seriesLlmBudget(async () => { if (++attempts === 1) throw Object.assign(new Error('Empty'), { billed: { usage: { total: 0, costUSD: 0 } } }); return response('ok'); });
    expect((await free({ model: 'test' } as any)).text).toBe('ok');
    expect(attempts).toBe(2);
    attempts = 0;
    const paid = seriesLlmBudget(async () => { attempts++; throw Object.assign(new Error('Empty'), { billed: { usage: { total: 500, costUSD: 0.01 } } }); });
    await expect(paid({ model: 'test' } as any)).rejects.toThrow('Empty');
    expect(attempts).toBe(1);
  });
});

const entities: VisualEntity[] = [
  { id: 'lead', name: 'Funkelflug', kind: 'character', role: 'cast', species: 'dragon', isHuman: false, appearance: 'small golden dragon', forbidden: [], referenceUrl: 'https://example.test/dragon.webp' },
  { id: 'kid', name: 'Nora', kind: 'character', role: 'hero', species: 'human', isHuman: true, appearance: 'girl in red coat', forbidden: [], referenceUrl: 'https://example.test/nora.webp' },
];
const scene = 'Funkelflug at left pulls a bell rope while Nora at right catches the falling wooden handle, both looking at the rope in the mountain hut.';
const pages = [1, 2, 3].map(order => ({ order, title: 'Glocke', content: 'Ein Absatz.\n\nDie Glocke bewegte sich.\n\nDas Ende.', paragraphs: [] }));
const rawPlan = () => ({ cover: { onStage: ['lead'], scene }, pages: pages.map(p => ({ page: p.order, paragraph: 2, onStage: ['lead', 'kid'], scene })) });

describe('series artwork preserves action and lead within a fixed budget', () => {
  test('direction sees the public lead and style, never private avatar portraits', async () => {
    const b = brief();
    const figures = entities.map(e => e.id === 'lead' ? { ...e, id: bible.characterId } : e);
    const raw = rawPlan();
    raw.cover.onStage = [bible.characterId];
    raw.pages.forEach(p => p.onStage = [bible.characterId, 'kid']);
    let inputs: string[] = [];
    await directSeriesPictures({ brief: b, model: 'test', title: 'Glocke', pages, entities: figures, llm: async r => { inputs = r.imageInputs || []; expect(r.user).toContain('FIRST CHAPTER PICTURE'); return response(JSON.stringify(raw)); } });
    expect(inputs).toContain(figures[0].referenceUrl!);
    expect(inputs).not.toContain(figures[1].referenceUrl!);
  });
  test('a harmless composition difference cannot hide a contradicted primary action', () => {
    const qa: any = { styleMatch: 0.9, styleDefects: [], primaryActionClear: true, criticalSceneDefects: [], sceneMatch: 0.85, identityMatch: 1, anatomyDefects: [], animalFeaturesOnHumans: [], duplicates: [], unexpectedCharacters: [], roleSwaps: [], elementMisuse: [], sceneDefects: ['A wing is unfolded.'], textVisible: false, referenceSheetVisible: false };
    expect(seriesPicturePasses(qa)).toBe(true);
    expect(seriesPicturePasses({ ...qa, primaryActionClear: false, criticalSceneDefects: ['The gag-defining object is absent.'] })).toBe(false);
  });
  test('planning rejects missing lead and allows the lead without all avatars on the cover', () => {
    expect(validateSeriesShots(rawPlan(), pages, entities, 'lead').cover.onStage).toEqual(['lead']);
    const raw = rawPlan(); raw.cover.onStage = ['kid'];
    expect(() => validateSeriesShots(raw, pages, entities, 'lead')).toThrow('Serienhauptfigur');
  });
  test('all four scenes use landscape geometry and an actual art reference; no portrait generation', async () => {
    const requests: any[] = [];
    const llm: StorybookLlm = async () => response(JSON.stringify({ anatomyDefects: [], animalFeaturesOnHumans: [], duplicates: [], unexpectedCharacters: [], roleSwaps: [], sceneDefects: [], sceneFixes: [], elementMisuse: [], featureBleed: [], characterCounts: { Funkelflug: 1, Nora: 1 }, textVisible: false, referenceSheetVisible: false, identityMatch: 1, sceneMatch: 1, styleMatch: 1, styleDefects: [], primaryActionClear: true, criticalSceneDefects: [] }));
    const plan = validateSeriesShots(rawPlan(), pages, entities, 'lead');
    // The cover has only the lead and therefore gets its own correct count.
    const quality: StorybookLlm = async r => { const reply = await llm(r); if (r.stage.includes('qa-0-')) { const data = JSON.parse(reply.text); delete data.characterCounts.Nora; return response(JSON.stringify(data)); } return reply; };
    const result = await generateSeriesImages({ illustrations: plan, entities, seed: 'test', provider: async request => { requests.push(request); return { url: 'https://example.test/image.webp', costUSD: 0.0025 }; }, llm: quality, visionModel: 'test', pageTexts: {}, buildReference: async () => ({ urls: ['data:image/jpeg;base64,AA=='] } as any) });
    expect(result.imagesGenerated).toBe(4);
    expect(requests).toHaveLength(4);
    expect(requests.every(r => r.width === 1216 && r.height === 832 && r.referenceImages.length === 2 && r.prompt.includes('STYLE EXAMPLE'))).toBe(true);
  });
  test('failed action gets at most one extra attempt across the story and never loses the lead', async () => {
    const requests: any[] = [];
    const qa: StorybookLlm = async () => response(JSON.stringify({ anatomyDefects: [], animalFeaturesOnHumans: [], duplicates: [], unexpectedCharacters: [], roleSwaps: [], sceneDefects: ['The key action is missing.'], sceneFixes: ['Keep the bell action.'], elementMisuse: [], featureBleed: [], characterCounts: { Funkelflug: 1, Nora: 1 }, textVisible: false, referenceSheetVisible: false, identityMatch: 1, sceneMatch: 0.2, styleMatch: 1, styleDefects: [], primaryActionClear: true, criticalSceneDefects: [] }));
    const result = await generateSeriesImages({ illustrations: validateSeriesShots(rawPlan(), pages, entities, 'lead'), entities, seed: 'test', provider: async request => { requests.push(request); return { url: 'https://example.test/image.webp', costUSD: 0.0025 }; }, llm: qa, visionModel: 'test', pageTexts: {}, buildReference: async () => ({ urls: ['data:image/jpeg;base64,AA=='] } as any) });
    expect(result.imageCalls).toBe(5);
    expect(requests.every(r => r.prompt.includes('Funkelflug'))).toBe(true);
    expect(result.imagesGenerated).toBe(0);
    expect(result.pages.get(1)?.status).toBe('failed');
    expect(result.pages.get(1)?.vignette).not.toBe(true);
  });
  test('a failed vision response retains the generated image cost and later outcomes', async () => {
    const result = await generateSeriesImages({ illustrations: validateSeriesShots(rawPlan(), pages, entities, 'lead'), entities, seed: 'failure', provider: async () => ({ url: 'https://example.test/image.webp', costUSD: 0.0025 }), llm: async () => { throw new Error('Unavailable'); }, visionModel: 'test', pageTexts: {}, buildReference: async () => ({ urls: [] } as any) });
    expect(result.imageCalls).toBe(4);
    expect(result.imageCostUSD).toBeCloseTo(0.01);
    expect(result.pages.size).toBe(3);
    expect(result.imagesGenerated).toBe(0);
  });
  test('long stories keep one image for each of four chapters, with one shared retry allowance', async () => {
    const longPages = [...pages, { ...pages[0], order: 4 }];
    const raw = rawPlan(); raw.pages.push({ ...raw.pages[0], page: 4 });
    const result = await generateSeriesImages({ illustrations: validateSeriesShots(raw, longPages, entities, 'lead'), entities, seed: 'long', provider: async () => ({ url: 'https://example.test/image.webp', costUSD: 0.0025 }), llm: async () => response(JSON.stringify({ anatomyDefects: [], animalFeaturesOnHumans: [], duplicates: [], unexpectedCharacters: [], roleSwaps: [], sceneDefects: ['Wrong action'], elementMisuse: [], characterCounts: { Funkelflug: 1, Nora: 1 }, textVisible: false, referenceSheetVisible: false, identityMatch: 1, sceneMatch: 0.2, styleMatch: 1, styleDefects: [], primaryActionClear: true, criticalSceneDefects: [] })), visionModel: 'test', pageTexts: {}, buildReference: async () => ({ urls: [] } as any) });
    expect(result.imageCalls).toBe(SERIES_POLICY.maxImageCalls);
    expect(result.pages.size).toBe(4);
  });
});
