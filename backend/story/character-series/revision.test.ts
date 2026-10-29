// @ts-ignore Bun test helpers are runtime-only in the Encore project.
import { describe, expect, test } from 'bun:test';
import { applyChapterEdits, runCharacterSeriesTextEngine, seriesLlmBudget } from './engine';
import { seriesAuthoring, seriesBudget, SERIES_MODELS, SERIES_IMAGE_REVIEW_MODEL, SERIES_IMAGE_REVIEW_FALLBACK_MODEL, SERIES_POLICY } from './authoring';
import { SERIES_NARRATIVES } from './narrative';
import { withSeriesContext, seriesPrompt } from './core';
import { directSeriesPictures, generateSeriesImages, validateSeriesShots, seriesPicturePasses, seriesPaintableMoment, seriesReferenceRegions } from './pictures';
import { readSeriesQa } from './quality';
import { isPublishable } from '../storybook/images';
import { IdentityReferenceError } from '../image-reference-sprite';
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
  test('Sol writes, Haiku reviews the text and plans the pictures, Gemini reviews them with the bounded Flash-Lite fallback', () => {
    expect(SERIES_MODELS).toEqual({ writer: 'openai/gpt-6.1-sol', support: 'anthropic/claude-haiku-5.5', critic: 'anthropic/claude-haiku-5.5' });
    expect(SERIES_IMAGE_REVIEW_MODEL).toBe('google/gemini-3.8-flash');
    expect(SERIES_IMAGE_REVIEW_FALLBACK_MODEL).toBe('google/gemini-3.5-flash-lite');
  });
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
    let criticSystem = '';
    let criticTokens = 0;
    const llm: StorybookLlm = async r => {
      calls.push(r.stage);
      if (r.stage === 'series-author') return response(text);
      if (r.stage === 'series-editorial-review') { criticSystem = r.system; criticTokens = r.maxTokens; return response(JSON.stringify({ issues: [{ severity: 'major', quote: '', problem: 'Die Kinder sind ohne Begegnung da.', change: 'Den Weg und die erste Begegnung erzählen.' }] })); }
      if (r.stage === 'series-local-repair') return response(JSON.stringify({ edits: [{ chapter: 1, before: 'Funkelflug stellte seinen Becher ab. Nora hielt ihn schon fest.', after: 'Funkelflug übte allein. Nora kam vom Weg herauf, weil sie eine Glocke gehört hatte. „Wer bist du?“, fragte sie. „Funkelflug“, sagte der Drache. Nora stellte sich vor. Erst dann fing sie seinen fallenden Becher.' }] }));
      return response('{"issues":[]}');
    };
    const result = await runCharacterSeriesTextEngine({ brief: brief(), llm, models: SERIES_MODELS, ledger: new CostLedger() });
    expect(calls).toEqual(['series-author', 'series-editorial-review', 'series-local-repair', 'series-editorial-recheck']);
    // Story ff6eff04: „Und meine Idee trägt deinen Fisch“ credited Alexander with Adrian's idea and passed the critic.
    expect(criticSystem).toContain('Attribution stays true');
    expect(criticSystem).toContain('„ihre“ can be plural');
    expect(criticTokens).toBe(16000);
    expect(criticSystem).toContain('running gag');
    expect(result.pages[0].content).toContain('Nora kam vom Weg');
    expect(result.pages[1].content).toContain('Gemeinsam prüften sie den Ausgang.');
    expect(result.textQuality?.status).toBe('passed');
  });
  test('unsupported findings are dropped without paying for a rewrite or failing the story', async () => {
    const calls: string[] = [], logged: string[] = [];
    const llm: StorybookLlm = async r => { calls.push(r.stage); return response(r.stage === 'series-author' ? text : '{"issues":[{"severity":"major","quote":"Ein nicht vorhandener Satz.","problem":"Fehler","change":"Ändern"}]}'); };
    const result = await runCharacterSeriesTextEngine({ brief: brief(), llm, models: SERIES_MODELS, ledger: new CostLedger(), observe: stage => { logged.push(stage); } });
    expect(calls).toHaveLength(2);
    expect(logged).toContain('series-editorial-review-unsupported');
    expect(result.chosen).toBe('draft');
  });
  test('a quote shortened with an ellipsis is evidence when its pieces stand in the text in order', async () => {
    const calls: string[] = [];
    const quote = 'Funkelflug zeigte Nora den Bodengang. … Der Drache steckte seine Nase durch die Tür.';
    const llm: StorybookLlm = async r => {
      calls.push(r.stage);
      if (r.stage === 'series-author') return response(text);
      if (r.stage === 'series-editorial-review') return response(JSON.stringify({ issues: [{ severity: 'minor', quote, problem: 'Der Weg zur Tür fehlt.', change: 'Den Weg zeigen.' }] }));
      if (r.stage === 'series-local-repair') return response(JSON.stringify({ edits: [{ chapter: 2, before: 'Der Drache steckte seine Nase durch die Tür.', after: 'Der Drache lief zur Tür und steckte seine Nase hindurch.' }] }));
      return response('{"issues":[]}');
    };
    const result = await runCharacterSeriesTextEngine({ brief: brief(), llm, models: SERIES_MODELS, ledger: new CostLedger() });
    expect(calls).toContain('series-local-repair');
    expect(result.pages[1].content).toContain('Der Drache lief zur Tür');
  });
  test('a literal 42-word continuity quote across adjacent paragraphs remains actionable', async () => {
    const first = 'Funkelflug stellte seinen Becher ab. Nora hielt ihn schon fest.';
    const quote = 'Mara prüfte den niedrigen Gang von der Wiesenseite. Nora hielt den Spiegel hinein. Das Sonnenlicht wanderte bis unter den Korb.\n\nBen blieb neben Funkelflug am Eingang. Er legte den breiten Trageriemen um dessen Bauch. Mara prüfte den Sitz und blieb dicht dabei.';
    const amended = quote.replace('Ben blieb neben', 'Mara ging zum Eingang zurück. Ben blieb neben');
    const manuscript = text.replace(first, `${first}\n\n${quote}`);
    const llm: StorybookLlm = async r => {
      if (r.stage === 'series-author') return response(manuscript);
      if (r.stage === 'series-editorial-review') return response(JSON.stringify({ issues: [{ severity: 'minor', quote, problem: 'Maras Rückweg zum Eingang fehlt.', change: 'Den Rückweg zeigen.' }] }));
      if (r.stage === 'series-local-repair') return response(JSON.stringify({ edits: [{ chapter: 1, before: quote, after: amended }] }));
      return response('{"issues":[]}');
    };
    expect(quote.split(/\s+/).length).toBe(42);
    const result = await runCharacterSeriesTextEngine({ brief: brief(), llm, models: SERIES_MODELS, ledger: new CostLedger() });
    expect(result.pages[0].content).toContain('Mara ging zum Eingang zurück.');
    expect(result.chosen).toBe('revision');
  });
  test('an evidenced minor prop jump gets one local repair instead of being knowingly published', async () => {
    const calls: string[] = [];
    const before = 'Funkelflug stellte seinen Becher ab. Nora hielt ihn schon fest.';
    const after = 'Funkelflug stellte seinen Becher ab. Nora nahm ihn vom Tisch und hielt ihn fest.';
    const llm: StorybookLlm = async r => {
      calls.push(r.stage);
      if (r.stage === 'series-author') return response(text);
      if (r.stage === 'series-editorial-review') return response(JSON.stringify({ issues: [{ severity: 'minor', quote: before, problem: 'Der Becher wechselt ohne Handlung in Noras Hand.', change: 'Nora nimmt den Becher vom Tisch.' }] }));
      if (r.stage === 'series-local-repair') {
        expect(r.user).toContain('Der Becher wechselt ohne Handlung');
        return response(JSON.stringify({ edits: [{ chapter: 1, before, after }] }));
      }
      return response('{"issues":[]}');
    };
    const result = await runCharacterSeriesTextEngine({ brief: brief(), llm, models: SERIES_MODELS, ledger: new CostLedger() });
    expect(calls).toEqual(['series-author', 'series-editorial-review', 'series-local-repair', 'series-editorial-recheck']);
    expect(result.pages[0].content).toContain(after);
    expect(result.pages[1].content).toContain('Gemeinsam prüften sie den Ausgang.');
    expect(result.chosen).toBe('revision');
  });
  test('a new minor continuity gap found on recheck gets one more verified local correction', async () => {
    const before = 'Funkelflug stellte seinen Becher ab. Nora hielt ihn schon fest.';
    const after = 'Funkelflug stellte seinen Becher ab. Nora nahm ihn vom Tisch und hielt ihn fest.';
    const secondBefore = 'Funkelflug zeigte Nora den Bodengang. Gemeinsam prüften sie den Ausgang.';
    const secondAfter = 'Funkelflug zeigte Nora den Bodengang. Nora nahm das Tuch vom Tisch. Gemeinsam prüften sie den Ausgang.';
    const stages: string[] = [];
    const llm: StorybookLlm = async r => {
      stages.push(r.stage);
      if (r.stage === 'series-author') return response(text);
      if (r.stage === 'series-editorial-review') return response(JSON.stringify({ issues: [{ severity: 'minor', quote: before, problem: 'Der Becher wechselt die Hand.', change: 'Nora nimmt ihn vom Tisch.' }] }));
      if (r.stage === 'series-local-repair') return response(JSON.stringify({ edits: [{ chapter: 1, before, after }] }));
      if (r.stage === 'series-editorial-recheck') return response(JSON.stringify({ issues: [{ severity: 'minor', quote: secondBefore, problem: 'Nora nimmt das Tuch nicht mit.', change: 'Sie nimmt es vom Tisch.' }] }));
      if (r.stage === 'series-local-repair-2') return response(JSON.stringify({ edits: [{ chapter: 2, before: secondBefore, after: secondAfter }] }));
      return response('{"issues":[]}');
    };
    const result = await runCharacterSeriesTextEngine({ brief: brief(), llm, models: SERIES_MODELS, ledger: new CostLedger() });
    expect(stages).toEqual(['series-author', 'series-editorial-review', 'series-local-repair', 'series-editorial-recheck', 'series-local-repair-2', 'series-editorial-recheck-2']);
    expect(result.pages[0].content).toContain(after);
    expect(result.pages[1].content).toContain(secondAfter);
    expect(result.textQuality?.issues).toEqual([]);
  });
  test('an optional second correction rolls back if its recheck finds a major defect', async () => {
    const before = 'Funkelflug stellte seinen Becher ab. Nora hielt ihn schon fest.';
    const after = 'Funkelflug stellte seinen Becher ab. Nora nahm ihn vom Tisch und hielt ihn fest.';
    const secondBefore = 'Funkelflug zeigte Nora den Bodengang. Gemeinsam prüften sie den Ausgang.';
    const secondAfter = 'Funkelflug zeigte Nora den Bodengang. Nora verlor den Ausgang.';
    const llm: StorybookLlm = async r => {
      if (r.stage === 'series-author') return response(text);
      if (r.stage === 'series-editorial-review') return response(JSON.stringify({ issues: [{ severity: 'minor', quote: before, problem: 'Der Becher wechselt die Hand.', change: 'Nora nimmt ihn vom Tisch.' }] }));
      if (r.stage === 'series-local-repair') return response(JSON.stringify({ edits: [{ chapter: 1, before, after }] }));
      if (r.stage === 'series-editorial-recheck') return response(JSON.stringify({ issues: [{ severity: 'minor', quote: secondBefore, problem: 'Eine Handlung fehlt.', change: 'Den Übergang ergänzen.' }] }));
      if (r.stage === 'series-local-repair-2') return response(JSON.stringify({ edits: [{ chapter: 2, before: secondBefore, after: secondAfter }] }));
      return response(JSON.stringify({ issues: [{ severity: 'major', quote: secondAfter, problem: 'Der Ausgang geht verloren.', change: 'Den Ausgang behalten.' }] }));
    };
    const result = await runCharacterSeriesTextEngine({ brief: brief(), llm, models: SERIES_MODELS, ledger: new CostLedger() });
    expect(result.pages[1].content).toContain(secondBefore);
    expect(result.pages[1].content).not.toContain(secondAfter);
    expect(result.textQuality?.issues).toContain('Eine Handlung fehlt.');
  });
  test('an unavailable optional correction preserves the already checked story', async () => {
    const before = 'Funkelflug stellte seinen Becher ab. Nora hielt ihn schon fest.';
    const after = 'Funkelflug stellte seinen Becher ab. Nora nahm ihn vom Tisch und hielt ihn fest.';
    const second = 'Funkelflug zeigte Nora den Bodengang. Gemeinsam prüften sie den Ausgang.';
    const llm: StorybookLlm = async r => {
      if (r.stage === 'series-author') return response(text);
      if (r.stage === 'series-editorial-review') return response(JSON.stringify({ issues: [{ severity: 'minor', quote: before, problem: 'Der Becher wechselt die Hand.', change: 'Nora nimmt ihn vom Tisch.' }] }));
      if (r.stage === 'series-local-repair') return response(JSON.stringify({ edits: [{ chapter: 1, before, after }] }));
      if (r.stage === 'series-editorial-recheck') return response(JSON.stringify({ issues: [{ severity: 'minor', quote: second, problem: 'Ein Übergang fehlt.', change: 'Den Übergang ergänzen.' }] }));
      throw new Error('model unavailable');
    };
    const result = await runCharacterSeriesTextEngine({ brief: brief(), llm, models: SERIES_MODELS, ledger: new CostLedger() });
    expect(result.pages[0].content).toContain(after);
    expect(result.pages[1].content).toContain(second);
    expect(result.textQuality?.issues).toContain('Ein Übergang fehlt.');
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
    const costly = seriesLlmBudget(async () => ({ ...response('ok'), usage: { prompt: 1, completion: 1, total: 2, costUSD: SERIES_POLICY.llmStopAfterUSD + 0.01 } }));
    await costly(request);
    await expect(costly(request)).rejects.toThrow('Kostenlimit');
  });
  test('parallel calls run at once but a burst never exceeds the call cap', async () => {
    let inFlight = 0, peak = 0, paid = 0;
    const bounded = seriesLlmBudget(async () => {
      inFlight++; peak = Math.max(peak, inFlight);
      await new Promise(resolve => setTimeout(resolve, 5));
      inFlight--; paid++;
      return response('ok');
    });
    const results = await Promise.allSettled(Array.from({ length: SERIES_POLICY.maxLlmCalls + 3 }, () => bounded({ model: 'test', stage: 'burst' } as any)));
    expect(peak).toBeGreaterThan(1);
    expect(paid).toBe(SERIES_POLICY.maxLlmCalls);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(3);
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
const beat = (framing = 'wide') => ({ actorId: 'lead', action: 'pulls the bell rope down', result: 'the wooden handle swings toward Nora', framing });
const rawPlan = () => ({ cover: { onStage: ['lead'], visualBeat: beat(), scene }, pages: pages.map(p => ({ page: p.order, paragraph: 2, storyQuote: 'Die Glocke bewegte sich.', onStage: ['lead', 'kid'], visualBeat: beat(p.order === 2 ? 'close' : 'wide'), scene })) });
const imageReview = (stage: string, fields: Record<string, unknown> = {}) => response(JSON.stringify({ visibleIds: stage.includes('qa-0-') ? ['lead'] : ['lead', 'kid'], identityById: { lead: 1, kid: 1 }, posing: false, primaryActionClear: true, sceneMatch: 1, styleMatch: 1, defects: [], ...fields }));
// Two pictures per chapter: 16 paragraphs per chapter give two reading segments of eight; Pia acts in paragraph 13.
const segmentChapters = [1, 2, 3].map(order => ({ order, title: `Kapitel ${order}`, content: Array.from({ length: 16 }, (_, i) => `Absatz ${order}.${i + 1}: Funkelflug zog am Glockenseil${i === 12 ? ', und Pia hielt die Leine fest' : ''}, und Nora fing den Griff.`).join('\n\n'), paragraphs: [] }));
const segmentPlan = (lead: string, options: { coverKid?: boolean; guest?: string } = {}) => ({
  cover: { onStage: options.coverKid === false ? [lead] : [lead, 'kid'], visualBeat: { ...beat(), actorId: lead }, scene },
  pages: Array.from({ length: 6 }, (_, i) => {
    const chapter = Math.floor(i / 2) + 1, part = i % 2;
    return { page: i + 1, paragraph: 3, storyQuote: `Absatz ${chapter}.${part * 8 + 3}: Funkelflug zog am Glockenseil, und Nora fing den Griff.`, onStage: options.guest && i === 3 ? [lead, options.guest] : [lead, 'kid'], visualBeat: { ...beat(part ? 'close' : 'wide'), actorId: lead }, scene };
  }),
});

describe('series artwork preserves action and lead within a fixed budget', () => {
  test('direction sees the public lead and style, never private avatar portraits, and plans two pictures per chapter', async () => {
    const b = brief();
    const figures = entities.map(e => e.id === 'lead' ? { ...e, id: bible.characterId } : e);
    let inputs: string[] = [];
    let user = '';
    const stages: string[] = [];
    const direction = await directSeriesPictures({ brief: b, model: 'test', title: 'Glocke', pages: segmentChapters, entities: figures, llm: async r => { stages.push(r.stage); inputs = r.imageInputs || []; user = r.user; return response(JSON.stringify(segmentPlan(bible.characterId))); } });
    expect(inputs).toContain(figures[0].referenceUrl!);
    expect(inputs).not.toContain(figures[1].referenceUrl!);
    expect(user).toContain('FIRST CHAPTER PICTURE');
    expect(user).toContain('PLANNED KEY VISUAL');
    expect(user).toContain('PAGE 6 — chapter 3, part 2 of 2');
    expect(stages).toEqual(['series-picture-direction']);
    expect(direction.slots.map(s => `${s.chapter}.${s.part}`)).toEqual(['1.0', '1.1', '2.0', '2.1', '3.0', '3.1']);
    // Each picture prints right after the paragraph it shows: segment paragraph 3 is chapter paragraph 3 or 11.
    expect(direction.placed.map(p => p.afterParagraph)).toEqual([2, 10, 2, 10, 2, 10]);
  });
  test('the first plan brings the family onto the cover and an acting guest into a picture; after one repair these are wishes', async () => {
    const b = brief();
    const lead = bible.characterId;
    const figures: VisualEntity[] = [
      { ...entities[0], id: lead },
      entities[1],
      { id: 'pia', name: 'Pia', kind: 'character', role: 'cast', species: 'human', isHuman: true, appearance: 'woman in an orange headscarf', forbidden: [], referenceUrl: 'https://example.test/pia.webp' },
    ];
    const repairs: string[] = [];
    const repaired = await directSeriesPictures({ brief: b, model: 'test', title: 'Glocke', pages: segmentChapters, entities: figures, llm: async r => {
      if (r.stage === 'series-picture-plan-repair') { repairs.push(r.user); return response(JSON.stringify(segmentPlan(lead, { guest: 'pia' }))); }
      return response(JSON.stringify(segmentPlan(lead, { coverKid: false })));
    } });
    expect(repairs).toHaveLength(1);
    expect(repairs[0]).toContain('RECURRING GUESTS pia');
    expect(repaired.illustrations.cover.onStage).toContain('kid');
    expect(repaired.illustrations.pages.some(p => p.onStage.includes('pia'))).toBe(true);
    expect(repaired.unplaced).toEqual([]);
    // A broken repair falls back to the valid first plan instead of failing the whole story.
    const fallback = await directSeriesPictures({ brief: b, model: 'test', title: 'Glocke', pages: segmentChapters, entities: figures, llm: async r => response(r.stage === 'series-picture-plan-repair' ? 'kein JSON' : JSON.stringify(segmentPlan(lead, { coverKid: false }))) });
    expect(fallback.illustrations.cover.onStage).toEqual([lead]);
    expect(fallback.unplaced).toEqual(['Pia']);
    expect(fallback.director.repairReasons?.[0].errors[0]).toContain('Titelbild');
  });
  test('a harmless composition difference cannot hide a contradicted primary action', () => {
    const qa = readSeriesQa(imageReview('chapter').text, entities)!;
    expect(seriesPicturePasses(qa)).toBe(true);
    expect(seriesPicturePasses({ ...qa, primaryActionClear: false })).toBe(false);
  });
  test('planning recovers an invalid cover from a valid motif but still rejects a missing lead in chapter 1', () => {
    expect(validateSeriesShots(rawPlan(), pages, entities, 'lead').cover.onStage).toEqual(['lead']);
    // The director's first plan must put the family on the cover; after the repair it is only a wish.
    expect(() => validateSeriesShots(rawPlan(), pages, entities, 'lead', { strict: true })).toThrow('Titelbild');
    const raw = rawPlan(); raw.cover.onStage = ['kid'];
    expect(validateSeriesShots(raw, pages, entities, 'lead').cover).toMatchObject({ onStage: ['lead', 'kid'], coverSourcePage: 1 });
    raw.pages[0].onStage = ['kid'];
    expect(() => validateSeriesShots(raw, pages, entities, 'lead')).toThrow('Serienhauptfigur');
  });
  test('a valid framing next to visualBeat is accepted, while invalid values remain rejected', () => {
    const raw: any = rawPlan();
    raw.pages[1].framing = raw.pages[1].visualBeat.framing;
    delete raw.pages[1].visualBeat.framing;
    expect((validateSeriesShots(raw, pages, entities, 'lead').pages[1] as any).visualBeat.framing).toBe('close');
    raw.pages[1].framing = 'imaginary';
    expect(() => validateSeriesShots(raw, pages, entities, 'lead')).toThrow('Bildausschnitt');
  });
  test('all four scenes use landscape geometry and an actual art reference; no portrait generation', async () => {
    const requests: any[] = [];
    const llm: StorybookLlm = async r => imageReview(r.stage);
    const plan = validateSeriesShots(rawPlan(), pages, entities, 'lead');
    const quality = llm;
    const result = await generateSeriesImages({ illustrations: plan, entities, seed: 'test', provider: async request => { requests.push(request); return { url: 'https://example.test/image.webp', costUSD: 0.0025 }; }, llm: quality, visionModel: 'test', pageTexts: {}, buildReference: async () => ({ urls: ['data:image/jpeg;base64,AA=='] } as any) });
    expect(result.imagesGenerated).toBe(4);
    expect(requests).toHaveLength(4);
    expect(requests.every(r => r.width === 1216 && r.height === 832 && r.referenceImages.length === 1 && r.prompt.includes('gouache'))).toBe(true);
  });
  test('a child series lead such as Tilda keeps child proportions alongside an adult', () => {
    const cast: VisualEntity[] = [
      { ...entities[0], id: 'tilda', name: 'Tilda', species: 'human', isHuman: true, appearance: 'nine-year-old girl inventor with curly dark hair' },
      { ...entities[0], id: 'adult', name: 'Mama', species: 'human', isHuman: true, appearance: 'adult woman' },
    ];
    const regions = seriesReferenceRegions(cast);
    expect(regions[0].targetBox[0]).toBeGreaterThan(regions[1].targetBox[0]);
    const custom = seriesReferenceRegions(cast, undefined, 0, { tilda: [160, 100, 920, 450] });
    expect(custom[0].targetBox[0]).toBe(280);
  });
  test('failed action gets at most the policy repairs across the story and never loses the lead', async () => {
    const requests: any[] = [];
    const qa: StorybookLlm = async r => imageReview(r.stage, { sceneMatch: 0.2, primaryActionClear: false, defects: [{ kind: 'story', detail: 'The key action is missing.', fix: 'Keep the bell action.' }] });
    const result = await generateSeriesImages({ illustrations: validateSeriesShots(rawPlan(), pages, entities, 'lead'), entities, seed: 'test', provider: async request => { requests.push(request); return { url: 'https://example.test/image.webp', costUSD: 0.0025 }; }, llm: qa, visionModel: 'test', pageTexts: {}, buildReference: async () => ({ urls: ['data:image/jpeg;base64,AA=='] } as any) });
    expect(result.imageCalls).toBe(4 + SERIES_POLICY.imageRetries);
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
  test('temporary vision errors recheck the same generated picture without a paid redraw', async () => {
    const drawn: number[] = [], checked: Array<{ stage: string; images?: string[] }> = [];
    const result = await generateSeriesImages({
      illustrations: validateSeriesShots(rawPlan(), pages, entities, 'lead'), entities, seed: 'vision-recovery', visionModel: 'test', pageTexts: {},
      buildReference: async () => ({ urls: ['data:image/jpeg;base64,AA=='], mode: 'sprite', subjects: [] }),
      provider: async r => { drawn.push(r.page); return { url: `bucket://story/${r.page}.webp`, viewUrl: `https://example.test/${r.page}.webp`, costUSD: 0.0025 }; },
      llm: async r => {
        checked.push({ stage: r.stage, images: r.imageInputs });
        if (r.stage === 'series-image-qa-2-1') throw new Error('temporary vision outage');
        if (r.stage === 'series-image-qa-2-1-retry') return response('not valid JSON');
        return imageReview(r.stage);
      },
    });
    expect(result.imagesGenerated).toBe(4);
    expect(result.pages.get(2)?.status).toBe('passed');
    expect(result.pages.get(2)?.history?.map(entry => entry.kind)).toEqual(['series-vision', 'series-scene']);
    expect(drawn.filter(page => page === 2)).toEqual([2]);
    expect(result.imageCalls).toBe(4);
    expect(result.regenerated).toEqual([]);
    expect(checked.find(entry => entry.stage === 'series-image-qa-2-1-recovery')?.images?.[0]).toBe('https://example.test/2.webp');
  });
  test('a vision outage after a redraw also rechecks the redraw before giving up', async () => {
    const result = await generateSeriesImages({
      illustrations: validateSeriesShots(rawPlan(), pages, entities, 'lead'), entities, seed: 'redraw-vision-recovery', visionModel: 'test', pageTexts: {},
      buildReference: async () => ({ urls: [], mode: 'none', subjects: [] }),
      provider: async r => ({ url: `https://example.test/${r.page}.webp`, costUSD: 0.0025 }),
      llm: async r => {
        if (r.stage === 'series-image-qa-1-1') return imageReview(r.stage, { primaryActionClear: false, sceneMatch: 0.4 });
        if (r.stage === 'series-image-qa-1-2' || r.stage === 'series-image-qa-1-2-retry') throw new Error('temporary outage');
        return imageReview(r.stage);
      },
    });
    expect(result.pages.get(1)?.status).toBe('passed');
    expect(result.pages.get(1)?.attempts).toBe(2);
    expect(result.imageCalls).toBe(5);
    expect(result.imagesGenerated).toBe(4);
  });
  test('a recovered vision report still blocks an unsafe picture', async () => {
    const result = await generateSeriesImages({
      illustrations: validateSeriesShots(rawPlan(), pages, entities, 'lead'), entities, seed: 'vision-unsafe', visionModel: 'test', pageTexts: {},
      buildReference: async () => ({ urls: [], mode: 'none', subjects: [] }),
      provider: async r => ({ url: `https://example.test/${r.page}.webp`, costUSD: 0.0025 }),
      llm: async r => {
        if (r.stage.startsWith('series-image-qa-2-1') && !r.stage.endsWith('-recovery')) throw new Error('temporary outage');
        if (r.stage.startsWith('series-image-qa-2-')) return imageReview(r.stage, { defects: [{ kind: 'safety', detail: 'A child stands beneath an unsupported load.', fix: 'Move the child clear of the unsupported load.' }] });
        return imageReview(r.stage);
      },
    });
    expect(result.pages.get(2)?.status).toBe('failed');
    expect(isPublishable(result.pages.get(2))).toBe(false);
    expect(result.pages.get(2)?.history?.at(-1)?.notes).toContain('A child stands beneath an unsupported load.');
  });
  test('a provider that returns no image gets a bounded retry for the missing chapter', async () => {
    const requests: number[] = [];
    const result = await generateSeriesImages({
      illustrations: validateSeriesShots(rawPlan(), pages, entities, 'lead'), entities, seed: 'empty-provider', visionModel: 'test', pageTexts: {},
      buildReference: async () => ({ urls: [], mode: 'none', subjects: [] }),
      provider: async r => { requests.push(r.page); return { url: r.page === 1 && requests.filter(p => p === 1).length === 1 ? undefined : `https://example.test/${r.page}.webp`, costUSD: 0 }; },
      llm: async r => imageReview(r.stage),
    });
    expect(result.pages.get(1)?.status).toBe('passed');
    expect(result.imageCalls).toBe(5);
    expect(result.regenerated).toEqual([1]);
  });
  test('a provider credit refusal is reported without spending retries on the same refusal', async () => {
    let draws = 0;
    const result = await generateSeriesImages({
      illustrations: validateSeriesShots(rawPlan(), pages, entities, 'lead'), entities, seed: 'provider-credit', visionModel: 'test', pageTexts: {},
      buildReference: async () => ({ urls: [], mode: 'none', subjects: [] }),
      provider: async () => { draws++; return { refused: true, httpStatus: 402 }; }, llm: async r => imageReview(r.stage),
    });
    expect(draws).toBe(4);
    expect(result.imageCalls).toBe(4);
    expect(result.pages.get(1)?.errors).toEqual(['series_provider_http_402']);
    expect(result.regenerated).toEqual([]);
  });
  test('limited repairs cover separate pictureless chapters before a second picture of one chapter', async () => {
    const readingPages = Array.from({ length: 6 }, (_, i) => ({ ...pages[i % 3], order: i + 1 }));
    const raw = rawPlan();
    raw.pages = readingPages.map((p, i) => ({ ...raw.pages[i % 3], page: p.order }));
    const plan = validateSeriesShots(raw, readingPages, entities, 'lead');
    const result = await generateSeriesImages({
      illustrations: plan, entities, seed: 'chapter-coverage', visionModel: 'test', pageTexts: {},
      chapterByPage: { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3 },
      buildReference: async () => ({ urls: [], mode: 'none', subjects: [] }),
      provider: async r => ({ url: `https://example.test/${r.page}.webp`, costUSD: 0.0025 }),
      llm: async r => {
        const page = Number(r.stage.match(/^series-image-qa-(\d+)-/)?.[1]);
        const first = r.stage === `series-image-qa-${page}-1`;
        return imageReview(r.stage, first && page >= 3 ? { primaryActionClear: false, sceneMatch: 0.4 } : {});
      },
    });
    expect(result.regenerated).toEqual([3, 5, 4, 6]);
    expect(result.pages.get(3)?.status).toBe('passed');
    expect(result.pages.get(5)?.status).toBe('passed');
    expect(result.imagesGenerated).toBe(7);
    expect(result.imageCalls).toBe(11);
  });
  test('retry budget reserves a simpler last chance for pictureless chapters before the cover', async () => {
    const readingPages = Array.from({ length: 6 }, (_, i) => ({ ...pages[i % 3], order: i + 1 }));
    const raw = rawPlan();
    raw.pages = readingPages.map((p, i) => ({ ...raw.pages[i % 3], page: p.order }));
    const planning: string[] = [];
    const result = await generateSeriesImages({
      illustrations: validateSeriesShots(raw, readingPages, entities, 'lead'), entities, seed: 'reserve-empty', visionModel: 'test',
      pageTexts: Object.fromEntries(readingPages.map(p => [p.order, p.content])),
      chapterByPage: { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3 },
      buildReference: async () => ({ urls: [] } as any), provider: async r => ({ url: `https://example.test/${r.page}.webp` }),
      llm: async r => {
        if (r.stage === 'series-picture-rescue-plan') { planning.push(r.user); return response('{"pages":[]}'); }
        const match = r.stage.match(/^series-image-qa-(\d+)-(\d+)$/);
        const page = Number(match?.[1]), attempt = Number(match?.[2]);
        if (page === 0) return imageReview(r.stage, { defects: [{ kind: 'safety', detail: 'A child is beneath an unsupported load.', fix: 'Move the child clear.' }] });
        return imageReview(r.stage, [1, 2, 5, 6].includes(page) && attempt < 3 ? { primaryActionClear: false, sceneMatch: 0.4 } : {});
      },
    });
    expect(result.regenerated).toEqual([1, 5, 1, 5]);
    expect(planning).toHaveLength(1);
    expect(JSON.parse(planning[0]).map((item: any) => item.page)).toEqual([1, 5]);
    expect(result.pages.get(1)?.status).toBe('passed');
    expect(result.pages.get(5)?.status).toBe('passed');
    // Their second pictures lost the scene itself (sceneMatch 0.4), so not even the best attempt is printable.
    expect(result.pages.get(2)?.status).toBe('failed');
    expect(result.pages.get(6)?.status).toBe('failed');
    expect(result.cover?.status).toBe('failed');
    expect(result.imageCalls).toBe(7 + SERIES_POLICY.imageRetries);
  });
  test('long stories keep one image for each of four chapters, with a shared repair allowance', async () => {
    const longPages = [...pages, { ...pages[0], order: 4 }];
    const raw = rawPlan(); raw.pages.push({ ...raw.pages[0], page: 4 });
    const result = await generateSeriesImages({ illustrations: validateSeriesShots(raw, longPages, entities, 'lead'), entities, seed: 'long', provider: async () => ({ url: 'https://example.test/image.webp', costUSD: 0.0025 }), llm: async r => imageReview(r.stage, { sceneMatch: 0.2, primaryActionClear: false }), visionModel: 'test', pageTexts: {}, buildReference: async () => ({ urls: [] } as any) });
    expect(result.imageCalls).toBe(5 + SERIES_POLICY.imageRetries);
    expect(result.pages.size).toBe(4);
  });
  test('all planned pictures are drawn and checked at the same time', async () => {
    let inFlight = 0, peak = 0;
    const result = await generateSeriesImages({ illustrations: validateSeriesShots(rawPlan(), pages, entities, 'lead'), entities, seed: 'parallel', provider: async () => {
      inFlight++; peak = Math.max(peak, inFlight);
      await new Promise(resolve => setTimeout(resolve, 10));
      inFlight--;
      return { url: 'https://example.test/image.webp', costUSD: 0.0025 };
    }, llm: async r => imageReview(r.stage), visionModel: 'test', pageTexts: {}, buildReference: async () => ({ urls: [] } as any) });
    expect(peak).toBe(4);
    expect(result.imagesGenerated).toBe(4);
  });
  test('reference preparation recovers all seven pictures without spending paid redraws', async () => {
    // f346d2d6: the only successful picture contained just the lead; every avatar sheet failed.
    const readingPages = Array.from({ length: 6 }, (_, i) => ({ ...pages[i % 3], order: i + 1 }));
    const raw = rawPlan();
    raw.cover.onStage = ['lead', 'kid'];
    raw.pages = readingPages.map((p, i) => ({ ...raw.pages[i % 3], page: p.order, onStage: i === 0 ? ['lead'] : ['lead', 'kid'] }));
    const plan = validateSeriesShots(raw, readingPages, entities, 'lead');
    const stages: string[] = [], drawn: number[] = [];
    let together = 0;
    const result = await generateSeriesImages({
      illustrations: plan, entities, seed: 'f346d2d6', visionModel: 'test', pageTexts: {},
      buildReference: async slots => {
        if (slots.length > 1 && ++together <= 12) throw new IdentityReferenceError('reference_http', 503);
        return { urls: ['data:image/jpeg;base64,AA=='], mode: slots.length > 1 ? 'sprite' : 'single', subjects: slots.map(s => ({ displayName: s.displayName, kind: 'character' })) };
      },
      provider: async r => { drawn.push(r.page); return { url: `https://example.test/${r.page}.webp`, costUSD: 0.0025 }; },
      llm: async r => {
        stages.push(r.stage);
        const shot = [plan.cover, ...plan.pages].find(s => r.stage.startsWith(`series-image-qa-${s.page}-`))!;
        return response(JSON.stringify({ visibleIds: shot.onStage, identityById: Object.fromEntries(shot.onStage.map(id => [id, 1])), posing: false, primaryActionClear: true, sceneMatch: 1, styleMatch: 1, defects: [] }));
      },
    });
    expect(result.imagesGenerated).toBe(7);
    expect(result.imageCalls).toBe(7);
    expect(result.imageCostUSD).toBeCloseTo(0.0175);
    expect(new Set(drawn).size).toBe(7);
    expect(result.regenerated).toEqual([]);
    expect(stages.every(s => s.endsWith('-1'))).toBe(true);
    expect(result.cover?.history?.[0].notes).toContain('Identitätsreferenz nicht verfügbar: reference_http (HTTP 503); kein Ersatzkind erzeugt und kein Bildaufruf bezahlt.');
  });
  test('permanent reference failures stay bounded, diagnostic and never create a replacement child', async () => {
    let preparations = 0, paid = 0;
    const result = await generateSeriesImages({
      illustrations: validateSeriesShots(rawPlan(), pages, entities, 'lead'), entities, seed: 'offline', visionModel: 'test', pageTexts: {},
      buildReference: async () => { preparations++; throw new IdentityReferenceError('reference_http', 500); },
      provider: async () => { paid++; return { url: 'https://example.test/unused.webp' }; }, llm: async r => imageReview(r.stage),
    });
    expect(preparations).toBe(16); // Four shots, two preparations each, one recovery pass.
    expect(paid).toBe(0);
    expect(result.imageCalls).toBe(0);
    expect(result.imagesGenerated).toBe(0);
    expect(result.pages.get(1)?.errors).toEqual(['series_reference_error', 'reference_http (HTTP 500)']);
    expect(result.pages.get(1)?.history).toHaveLength(2);
  });
  test('a consistent neighbouring moment is printed as flawed without a repair; a contradiction gets the repair', async () => {
    const loose = { primaryActionClear: false, sceneMatch: 0.55, defects: [{ kind: 'story', detail: 'The crate is being turned, not yet landed on the coat.', fix: 'Show the crate landing on the coat.' }] };
    const result = await generateSeriesImages({ illustrations: validateSeriesShots(rawPlan(), pages, entities, 'lead'), entities, seed: 'flawed', provider: async () => ({ url: 'https://example.test/image.webp', costUSD: 0.0025 }),
      llm: async r => imageReview(r.stage, r.stage === 'series-image-qa-1-1' ? { ...loose, storyConsistent: true } : r.stage === 'series-image-qa-2-1' ? { ...loose, storyConsistent: false } : {}), visionModel: 'test', pageTexts: {}, buildReference: async () => ({ urls: [] } as any) });
    expect(result.pages.get(1)?.status).toBe('flawed');
    expect(isPublishable(result.pages.get(1))).toBe(true);
    expect(result.regenerated).toEqual([2]);
    expect(result.pages.get(2)?.status).toBe('passed');
    expect(result.imageCalls).toBe(5);
    expect(result.imagesGenerated).toBe(4);
  });
  test('an empty chapter can retain a reviewed neighbouring moment even after a later unsafe redraw', async () => {
    let pageOne = 0;
    const result = await generateSeriesImages({
      illustrations: validateSeriesShots(rawPlan(), pages, entities, 'lead'), entities, seed: 'chapter-fallback',
      visionModel: 'test', pageTexts: {}, chapterByPage: { 1: 1, 2: 2, 3: 3 },
      buildReference: async () => ({ urls: [] } as any),
      provider: async r => ({ url: `https://example.test/${r.page}-${r.page === 1 ? ++pageOne : 1}.webp` }),
      llm: async r => {
        if (r.stage === 'series-image-qa-1-1') return imageReview(r.stage, { posing: true, primaryActionClear: false, storyConsistent: true, defects: [{ kind: 'story', detail: 'The bell is beginning to swing, before the catch.', fix: 'Show the catch.' }] });
        if (r.stage.startsWith('series-image-qa-1-')) return imageReview(r.stage, { defects: [{ kind: 'identity', detail: 'The dragon is duplicated.', fix: 'Show one dragon.' }] });
        return imageReview(r.stage);
      },
    });
    expect(result.pages.get(1)?.status).toBe('flawed');
    expect(result.pages.get(1)?.salvaged).toBe(true);
    expect(result.pages.get(1)?.url).toBe('https://example.test/1-1.webp');
    expect(result.pages.get(1)?.history?.at(-1)?.kind).toBe('series-best-attempt');
    expect(result.imagesGenerated).toBe(4);
  });
  test('primary outages do not exhaust seven pictures, and the circuit is isolated between families', async () => {
    const readingPages = Array.from({ length: 6 }, (_, i) => ({ ...pages[i % 3], order: i + 1 }));
    const raw = rawPlan(); raw.pages = readingPages.map((p, i) => ({ ...raw.pages[i % 3], page: p.order }));
    const illustrations = validateSeriesShots(raw, readingPages, entities, 'lead');
    const calls: string[] = [], otherCalls: string[] = [];
    const base = { illustrations, entities, seed: 'concurrent-families', visionModel: 'primary', visionFallbackModel: 'cheap', pageTexts: {},
      buildReference: async () => ({ urls: ['data:image/jpeg;base64,AA=='] } as any), provider: async (r: any) => ({ url: `https://example.test/${r.page}.webp`, costUSD: 0.0025 }) };
    const [result, other] = await Promise.all([
      generateSeriesImages({ ...base, llm: seriesLlmBudget(async r => {
        calls.push(r.stage);
        expect(r.imageInputs).toHaveLength(2); // Scene + identities. No unrelated style image on every check.
        if (r.model === 'primary') throw Object.assign(new Error('Empty'), { billed: { usage: { total: 0, costUSD: 0 } } });
        expect(r.model).toBe('cheap');
        return imageReview(r.stage, r.stage === 'series-image-qa-3-1-fallback' ? { defects: [{ kind: 'anatomy', detail: 'The child has a third hand.', fix: 'Show two hands.' }] } : {});
      }) }),
      generateSeriesImages({ ...base, llm: seriesLlmBudget(async r => { otherCalls.push(r.model); return imageReview(r.stage); }) }),
    ]);
    expect(result.imagesGenerated).toBe(7);
    expect(result.imageCalls).toBe(8);
    expect(calls).toHaveLength(15); // Seven free failures, seven reads, one checked anatomy repair.
    expect(calls).toContain('series-image-qa-3-2-fallback');
    expect(calls.some(stage => stage.endsWith('-retry') || stage.endsWith('-recovery'))).toBe(false);
    expect(other.imagesGenerated).toBe(7);
    expect(otherCalls).toEqual(Array(7).fill('primary'));
  });
  test('a failed primary goes directly to the fallback reader, without repeating the empty primary', async () => {
    const calls: Array<[string, string, string | undefined, number | undefined]> = [];
    const result = await generateSeriesImages({
      illustrations: validateSeriesShots(rawPlan(), pages, entities, 'lead'), entities, seed: 'vision-ladder', visionModel: 'gemini', visionFallbackModel: 'flash-lite', pageTexts: {},
      buildReference: async () => ({ urls: [] } as any), provider: async r => ({ url: `https://example.test/${r.page}.webp` }),
      llm: async r => {
        calls.push([r.stage, r.model, r.serviceTier, r.timeoutMs]);
        if (r.stage === 'series-image-qa-2-1') throw new Error('timed out after 40s');
        if (r.stage === 'series-image-qa-3-1' || r.stage === 'series-image-qa-3-1-retry') throw new Error('Empty response from gemini');
        return imageReview(r.stage);
      },
    });
    expect(calls).toContainEqual(['series-image-qa-2-1', 'gemini', 'flex', 20000]);
    expect(calls).toContainEqual(['series-image-qa-2-1-fallback', 'flash-lite', 'standard', 60000]);
    expect(calls.some(([stage]) => stage.endsWith('-retry'))).toBe(false);
    expect(calls).toContainEqual(['series-image-qa-3-1-fallback', 'flash-lite', 'standard', 60000]);
    expect(result.pages.get(2)?.status).toBe('passed');
    expect(result.pages.get(3)?.status).toBe('passed');
    expect(result.imageCalls).toBe(4);
  });
  test('a picture whose only fault is a loose action is printed without a redraw; a hand, a face or a lost scene is redrawn', async () => {
    const loose = { primaryActionClear: false, storyConsistent: false, sceneMatch: 0.7, defects: [{ kind: 'story', detail: 'The arm does not clamp the apron.', fix: 'Show the arm clamping the apron.', blocksAction: true }] };
    const requests: number[] = [];
    const result = await generateSeriesImages({
      illustrations: validateSeriesShots(rawPlan(), pages, entities, 'lead'), entities, seed: 'loose-action', visionModel: 'test', pageTexts: {}, chapterByPage: { 1: 1, 2: 2, 3: 3 },
      buildReference: async () => ({ urls: [] } as any), provider: async r => { requests.push(r.page); return { url: `https://example.test/${r.page}-${requests.length}.webp` }; },
      llm: async r => imageReview(r.stage, r.stage === 'series-image-qa-1-1' ? loose
        : r.stage === 'series-image-qa-2-1' ? { defects: [{ kind: 'anatomy', detail: 'The boy arm ends in a stump without a hand.', fix: 'Draw a hand.' }] } : {}),
    });
    expect(requests.filter(page => page === 1)).toHaveLength(1);
    expect(result.pages.get(1)).toMatchObject({ status: 'flawed', salvaged: true });
    expect(result.pages.get(1)?.history?.at(-1)?.kind).toBe('series-best-attempt');
    expect(requests.filter(page => page === 2)).toHaveLength(2);
    expect(result.pages.get(2)?.status).toBe('passed');
    expect(result.regenerated).toEqual([2]);
  });
  test('the quoted paragraph, not the named number, places the picture (e83e44e2)', () => {
    const long = pages.map(p => ({ ...p, content: Array.from({ length: 16 }, (_, i) => i === 5 ? 'Alexander hob gerade ein Fähnchen. Dessen Papier faltete sich hinter ihr Ohr.' : `Absatz ${i + 1} erzählt etwas.`).join('\n\n') }));
    const raw = rawPlan(); raw.pages.forEach(p => { p.paragraph = 16; p.storyQuote = 'Dessen Papier faltete sich hinter ihr Ohr.'; });
    expect(validateSeriesShots(raw, long, entities, 'lead').pages[0]).toMatchObject({ paragraph: 6 });
    // A quote across two paragraphs counts at its last sentence; an unquoted page keeps the named paragraph.
    raw.pages[0].storyQuote = 'Absatz 9 erzählt etwas. Absatz 10 erzählt etwas.';
    expect(validateSeriesShots(raw, long, entities, 'lead').pages[0]).toMatchObject({ paragraph: 10 });
    raw.pages[0].storyQuote = 'Ein im Kapitel nicht vorhandener Satz.';
    expect(validateSeriesShots(raw, long, entities, 'lead').pages[0]).toMatchObject({ paragraph: 16 });
  });
  test('a one-word paragraph borrows its neighbour as evidence instead of failing the plan', () => {
    const short = pages.map(p => ({ ...p, content: 'Pia prüfte die neue Leine mit einem Griff.\n\n„Hält.“\n\nDas Ende.' }));
    const raw = rawPlan(); raw.pages.forEach(p => { p.storyQuote = 'Ein im Kapitel nicht vorhandener Satz.'; });
    expect(validateSeriesShots(raw, short, entities, 'lead').pages[0]).toMatchObject({ storyQuote: 'Pia prüfte die neue Leine mit einem Griff. „Hält.“' });
  });
  test('a page planned twice keeps one picture instead of failing the plan', () => {
    const raw: any = rawPlan();
    // The first proposal for page 1 is speech only; the second one is drawn.
    raw.pages = [{ ...raw.pages[0], visualBeat: { ...raw.pages[0].visualBeat, action: 'agrees to wait' } }, ...raw.pages];
    const plan = validateSeriesShots(raw, pages, entities, 'lead');
    expect(plan.pages.map(p => p.page)).toEqual([1, 2, 3]);
    expect((plan.pages[0] as any).visualBeat.action).toBe('pulls the bell rope down');
    raw.pages = raw.pages.filter((p: any) => p.page !== 2);
    expect(() => validateSeriesShots(raw, pages, entities, 'lead')).toThrow('genau ein Bild je Leseabschnitt');
  });
  test('a paraphrased model quote is replaced by actual source evidence before drawing', () => {
    const raw = rawPlan(); raw.pages[0].storyQuote = 'Ein im Kapitel nicht vorhandener Satz.';
    expect(validateSeriesShots(raw, pages, entities, 'lead').pages[0]).toMatchObject({ storyQuote: 'Die Glocke bewegte sich.' });
  });
  test('speech-only plans and a uniform sequence of portrait framings are rejected before drawing', () => {
    const passive = rawPlan(); passive.pages[1].visualBeat.action = 'agrees to take the shorter route';
    expect(() => validateSeriesShots(passive, pages, entities, 'lead')).toThrow('körperliche Handlung');
    const uniform = rawPlan(); uniform.pages.forEach(p => p.visualBeat.framing = 'medium');
    expect(() => validateSeriesShots(uniform, pages, entities, 'lead')).toThrow('unterschiedliche Bildausschnitte');
    const wrongActor = rawPlan(); wrongActor.pages[0].visualBeat.actorId = 'off-panel-child';
    expect(() => validateSeriesShots(wrongActor, pages, entities, 'lead')).toThrow('körperliche Handlung');
  });
  test('written clue text does not enlarge a hand-sized location token into a table', () => {
    const shot = { page: 2, onStage: ['kid'], scene: 'Nora scrubs a clay location tile with a damp cloth. The letters T and STEG appear after BUCH on the tile. Ben leans closer.', visualBeat: { ...beat('close'), actorId: 'kid', action: 'rubs the dirty place tile clean', result: 'the letters T and STEG appear after BUCH' } };
    const rendered = seriesPaintableMoment(shot as any);
    expect(rendered.scene).toContain('palm-sized clay token');
    expect(rendered.scene).not.toContain('STEG');
    expect(rendered.fact).toContain('clean patch');
    expect(rendered.fact).not.toContain('letters');
  });
  test('a literal quote survives straight quotation marks and dashes', () => {
    const spoken = pages.map(p => ({ ...p, content: 'Ein Absatz.\n\n„Hallo“, sagte Adrian – und grinste…\n\nDas Ende.' }));
    const raw = rawPlan(); raw.pages.forEach(p => { p.storyQuote = '"Hallo", sagte Adrian - und grinste...'; });
    expect(validateSeriesShots(raw, spoken, entities, 'lead').pages[0]).toMatchObject({ storyQuote: '"Hallo", sagte Adrian - und grinste...' });
  });
  test('a cover is not checked against unrelated chapter-opening actions; chapter evidence stays available', async () => {
    const reviews: any[] = [], drawings: any[] = [];
    await generateSeriesImages({ illustrations: validateSeriesShots(rawPlan(), pages, entities, 'lead'), entities, seed: 'cover-scope', provider: async r => { drawings.push(r); return { url: 'https://example.test/image.webp' }; }, llm: async r => { reviews.push(r); return imageReview(r.stage); }, visionModel: 'test', pageTexts: { 1: 'An earlier footprint gag.\n\nDie Glocke bewegte sich.' }, buildReference: async () => ({ urls: ['data:image/jpeg;base64,AA=='] } as any) });
    const coverReview = reviews.find(r => r.stage === 'series-image-qa-0-1');
    const chapterReview = reviews.find(r => r.stage === 'series-image-qa-1-1');
    const chapterDrawing = drawings.find(d => d.page === 1);
    expect(coverReview.user).toContain('COVER:');
    expect(coverReview.user).not.toContain('earlier footprint gag');
    expect(chapterReview.user).toContain('Die Glocke bewegte sich.');
    expect(chapterReview.user).toContain('slot 2 = kid');
    expect(chapterDrawing.prompt).toContain('slot 2 (right half) is ONLY Nora');
    expect(chapterDrawing.referenceImages).toHaveLength(1); // Only the existing shared sheet; no competing style characters or individual private exports.
  });
  test('repairs go to a failed chapter before a failed cover', async () => {
    const result = await generateSeriesImages({ illustrations: validateSeriesShots(rawPlan(), pages, entities, 'lead'), entities, seed: 'chapter-first', provider: async () => ({ url: 'https://example.test/image.webp' }), llm: async r => imageReview(r.stage, r.stage.includes('qa-0-') ? { defects: [{ kind: 'safety', detail: 'A child is beneath an unsupported load.', fix: 'Move the child clear.' }] } : r.stage.includes('qa-1-1') ? { primaryActionClear: false, sceneMatch: 0.4, defects: [{ kind: 'story', detail: 'The selected exchange is absent.', fix: 'Show the selected exchange.' }] } : {}), visionModel: 'test', pageTexts: {}, buildReference: async () => ({ urls: [] } as any) });
    expect(result.imageCalls).toBe(7);
    expect(result.regenerated).toEqual([1, 0, 0]);
    expect(result.pages.get(1)?.status).toBe('passed');
    expect(result.cover?.status).toBe('failed');
  });
  test('a failed targeted edit gets one independently reviewed fresh variant within the shared budget', async () => {
    const requests: any[] = [];
    const result = await generateSeriesImages({
      illustrations: validateSeriesShots(rawPlan(), pages, entities, 'lead'), entities, seed: 'fresh-variant',
      visionModel: 'test', pageTexts: {}, chapterByPage: { 1: 1, 2: 2, 3: 3 },
      buildReference: async () => ({ urls: ['data:image/jpeg;base64,AA=='] } as any),
      provider: async request => {
        requests.push(request);
        return { url: `https://example.test/scene-${request.page}-${requests.filter(r => r.page === request.page).length}.webp`, costUSD: 0.0025 };
      },
      llm: async r => imageReview(r.stage, r.stage === 'series-image-qa-1-1' || r.stage === 'series-image-qa-1-2'
        ? { defects: [{ kind: 'identity', detail: 'A second dragon appears.', fix: 'Show the dragon exactly once.' }] } : {}),
    });
    const attempts = requests.filter(r => r.page === 1);
    expect(attempts).toHaveLength(3);
    expect(attempts[1].referenceImages).toEqual(['https://example.test/scene-1-1.webp', 'data:image/jpeg;base64,AA==']);
    expect(attempts[2].referenceImages).toEqual(['data:image/jpeg;base64,AA==']);
    expect(attempts[2].prompt).not.toContain('existing scene to edit');
    expect(attempts[2].seed).not.toBe(attempts[1].seed);
    expect(result.pages.get(1)?.status).toBe('passed');
    expect(result.pages.get(1)?.history?.map(h => h.status)).toEqual(['failed', 'failed', 'passed']);
    expect(result.regenerated).toEqual([1, 1]);
    expect(result.imageCalls).toBe(6);
    expect(result.imageCostUSD).toBeCloseTo(0.015);
  });
  test('a pictureless chapter can use a simpler moment grounded in the same paragraph', async () => {
    const requests: any[] = [];
    const story = 'Ein Absatz.\n\nFunkelflug zieht das Glockenseil. Die Glocke bewegt sich.\n\nDas Ende.';
    const result = await generateSeriesImages({
      illustrations: validateSeriesShots(rawPlan(), pages, entities, 'lead'), entities, seed: 'simpler-moment',
      visionModel: 'test', pageTexts: { 1: story }, chapterByPage: { 1: 1, 2: 2, 3: 3 },
      buildReference: async () => ({ urls: ['data:image/jpeg;base64,AA=='] } as any),
      provider: async r => { requests.push(r); return { url: `https://example.test/${r.page}-${requests.length}.webp` }; },
      llm: async r => {
        if (r.stage === 'series-picture-rescue-plan') return response(JSON.stringify({ pages: [{ page: 1, onStage: ['lead'], storyQuote: 'Funkelflug zieht das Glockenseil.', scene: 'Funkelflug pulls the bell rope.', visualBeat: { actorId: 'lead', action: 'pulls the bell rope down', result: 'the bell starts to swing overhead', framing: 'medium' } }] }));
        if (r.stage === 'series-image-qa-1-1' || r.stage === 'series-image-qa-1-2') return imageReview(r.stage, { defects: [{ kind: 'identity', detail: 'The dragon is duplicated.', fix: 'Show only one dragon.' }] });
        return imageReview(r.stage, r.stage === 'series-image-qa-1-3' ? { visibleIds: ['lead'] } : {});
      },
    });
    const last = requests.filter(r => r.page === 1).at(-1);
    expect(last.prompt).toContain('pulls the bell rope');
    expect(last.prompt).toContain('A solitary scene with exactly one character');
    expect(last.prompt).not.toContain('unnamed animals or crowds');
    expect(last.prompt).not.toContain('Show only one dragon.');
    expect(result.pages.get(1)?.history?.at(-1)?.kind).toBe('simplified-scene-repair');
    expect(result.pages.get(1)?.status).toBe('passed');
    expect(result.imageCalls).toBe(6);
  });
  test('an invented rescue quote is ignored and cannot replace the original scene', async () => {
    const requests: any[] = [];
    const result = await generateSeriesImages({
      illustrations: validateSeriesShots(rawPlan(), pages, entities, 'lead'), entities, seed: 'unfounded-rescue',
      visionModel: 'test', pageTexts: { 1: 'Ein Absatz.\n\nDie Glocke bewegte sich.\n\nDas Ende.' }, chapterByPage: { 1: 1, 2: 2, 3: 3 },
      buildReference: async () => ({ urls: [] } as any), provider: async r => { requests.push(r); return { url: 'https://example.test/image.webp' }; },
      llm: async r => r.stage === 'series-picture-rescue-plan'
        ? response(JSON.stringify({ pages: [{ page: 1, onStage: ['lead'], storyQuote: 'Ein erfundener Satz steht hier.', scene: 'A fabricated green apple is sitting in the middle of a sunny meadow by the mountain.', visualBeat: beat() }] }))
        : imageReview(r.stage, r.stage === 'series-image-qa-1-1' || r.stage === 'series-image-qa-1-2' ? { primaryActionClear: false, sceneMatch: 0.4 } : {}),
    });
    expect(requests.filter(r => r.page === 1).at(-1).prompt).not.toContain('fabricated green apple');
    expect(result.pages.get(1)?.history?.at(-1)?.kind).toBe('same-scene-repair');
  });
  test('the single repair edits the readable existing scene while retaining the shared identity sheet', async () => {
    const requests: any[] = [];
    const result = await generateSeriesImages({ illustrations: validateSeriesShots(rawPlan(), pages, entities, 'lead'), entities, seed: 'edit', provider: async r => { requests.push(r); return { url: `bucket://story/${r.page}.webp`, viewUrl: `https://example.test/scene-${r.page}.webp` }; }, llm: async r => imageReview(r.stage, r.stage === 'series-image-qa-1-1' ? { defects: [{ kind: 'anatomy', detail: 'The child has an extra hand.', fix: 'Give the child two hands holding the handle.' }] } : {}), visionModel: 'test', pageTexts: {}, buildReference: async () => ({ urls: ['data:image/jpeg;base64,AA=='] } as any) });
    expect(requests).toHaveLength(5);
    expect(requests[4].referenceImages).toEqual(['https://example.test/scene-1.webp', 'data:image/jpeg;base64,AA==']);
    expect(requests[4].prompt).toContain('Image 1 is the existing scene to edit');
    expect(requests[4].prompt).toContain('Image 2 is only the identity sheet');
    expect(requests[4].referenceRegions.map((r: any) => r.referenceIndex)).toEqual([1, 1]);
    expect(result.pages.get(1)?.status).toBe('passed');
    expect(result.pages.get(1)?.history?.at(-1)?.kind).toBe('targeted-scene-edit');
  });
  test('bounding boxes scale children shorter than adults, vary across chapters and support three figures', () => {
    const captainAndKids: VisualEntity[] = [
      { id: 'captain', name: 'Kapitän Blubbert', kind: 'character', role: 'cast', species: 'human', isHuman: true, appearance: 'old sailor with white beard', forbidden: [], referenceUrl: 'https://example.test/captain.webp' },
      { id: 'kid1', name: 'Adrian', kind: 'character', role: 'hero', species: 'human', isHuman: true, appearance: 'blond boy', forbidden: [], referenceUrl: 'https://example.test/kid1.webp' },
      { id: 'kid2', name: 'Alexander', kind: 'character', role: 'hero', species: 'human', isHuman: true, appearance: 'brown-haired boy', forbidden: [], referenceUrl: 'https://example.test/kid2.webp' },
    ];
    const ch1 = seriesReferenceRegions(captainAndKids.slice(0, 2), { actorId: 'kid1', action: 'lifts the rope', result: 'the rope rises', framing: 'medium' }, 0, undefined, 1);
    const ch2 = seriesReferenceRegions(captainAndKids.slice(0, 2), { actorId: 'kid1', action: 'lifts the rope', result: 'the rope rises', framing: 'medium' }, 0, undefined, 2);
    // Child top is lower in frame (larger y0) than adult top so the child never towers over the adult.
    expect(ch1[1].targetBox[0]).toBeGreaterThan(ch1[0].targetBox[0]);
    // Consecutive chapters flip left/right default placement to avoid repetitive 50/50 split-screens.
    expect(ch1[0].targetBox[1]).not.toBe(ch2[0].targetBox[1]);
    // Three characters (lead + both sibling avatars) are supported on one sheet.
    const trio = seriesReferenceRegions(captainAndKids, { actorId: 'captain', action: 'holds the wheel', result: 'the boat turns', framing: 'wide' }, 0, undefined, 1);
    expect(trio).toHaveLength(3);
  });
});
