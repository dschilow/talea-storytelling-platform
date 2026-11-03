// @ts-ignore Bun test helpers are runtime-only in Encore.
import { describe, expect, test } from 'bun:test';
import { QUALITY_SERIES_ENGINE, QUALITY_SERIES_MODELS, QUALITY_SERIES_POLICY, isCharacterSeriesEngine } from './profile';
import { runQualitySeriesTextEngine, qualityEditorialContext } from './text';
import { generateQualitySeriesImages } from './images';
import { seriesBudget, SERIES_MODELS, SERIES_POLICY } from '../character-series/authoring';
import { CostLedger, type StorybookLlm } from '../storybook/llm';
import { buildBrief } from '../storybook/context';
import bibles from '../character-series/series-bibles.json';
import { customerStoryLane } from '../customer-story-lane';
import { StorybookSafetyBlock } from '../storybook/llm-guards';

const reply = (text: string) => ({ text, modelUsed: 'test', durationMs: 0, usage: { prompt: 10, completion: 10, total: 20, costUSD: 0 } });
const brief = () => {
  const bible = bibles.find(b => b.id === 'tilda-tueftel')!;
  const b = buildBrief({ config: { avatarIds: ['kid'], genre: 'modern', setting: 'village', complexity: 'medium', ageGroup: '6-8', length: 'short' }, band: '6-8',
    budget: { ...seriesBudget('short', '6-8'), pages: 2, totalWordsMin: 1, totalWordsMax: 5000 }, heroes: [{ id: 'kid', name: 'Nora' }], candidates: [], artifacts: [], seed: 'quality-test' });
  b.characterSeries = { bible, logs: [] };
  return b;
};
const draft = () => `FIGUR: Tilda Tüftel | pool | ${brief().characterSeries!.bible.characterId} | companion\nTITEL: Der hungrige Besen\nBESCHREIBUNG: Eine Werkstatt.\nIDEE: Ein Teddy fällt in eine Kiste.\nREGEL: Das Pedal bewegt den Besen.\nFUNDSTÜCK: kein\nKAPITEL 1: Der Besuch\nNora kam mit dem Teddy zur Werkstatt. Tilda stellte sich vor.\n\n„Dein Teddy ist kaputt“, sagte Tilda.\nKAPITEL 2: Die Naht\nTilda nähte die Naht. Nora hielt den Teddy still.\n\nDann gingen sie zufrieden nach Hause.`;

describe('opt-in Figurenwelt quality lane', () => {
  test('has its own models and limits while the original and customer release stay intact', () => {
    expect(QUALITY_SERIES_MODELS.critic).toBe('google/gemini-3.8-flash');
    expect(QUALITY_SERIES_MODELS.writer).toBe(SERIES_MODELS.writer);
    expect(SERIES_MODELS.critic).toBe('anthropic/claude-haiku-5.5');
    expect(SERIES_POLICY.maxImageCalls).toBe(13);
    expect(QUALITY_SERIES_POLICY.maxImageCalls).toBe(22);
    expect(isCharacterSeriesEngine(QUALITY_SERIES_ENGINE)).toBe(true);
    expect(customerStoryLane({ storybookEngine: QUALITY_SERIES_ENGINE }, undefined)).toEqual({});
    expect(qualityEditorialContext(brief()).length).toBeLessThan(6500);
    expect(qualityEditorialContext(brief())).not.toContain('Staffel 2');
  });
  test('medium writer, compact Flash review and source-bounded Sol repair are rechecked', async () => {
    const calls: string[] = [];
    const llm: StorybookLlm = async request => {
      calls.push(request.stage);
      expect(request.effort).toBe(request.role === 'critic' ? 'low' : 'medium');
      if (request.stage === 'series-author') return reply(draft());
      if (request.stage === 'series-editorial-review') {
        expect(request.model).toBe('google/gemini-3.8-flash');
        expect(request.user).not.toContain('STYLE EXCERPTS');
        return reply(JSON.stringify({ strengths: ['Nora hielt den Teddy still.'], issues: [{ severity: 'minor', kind: 'craft', quote: '„Dein Teddy ist kaputt“, sagte Tilda.', problem: 'Die Figur wiederholt nur Sichtbares.', change: 'Eine eigensinnige Reaktion geben.' }] }));
      }
      if (request.stage === 'series-local-repair') {
        expect(request.user).toContain('Nora hielt den Teddy still.');
        return reply(JSON.stringify({ edits: [{ chapter: 1, before: '„Dein Teddy ist kaputt“, sagte Tilda.', after: '„Ein anspruchsvoller Kunde“, sagte Tilda und holte das Garn.' }] }));
      }
      return reply('{"issues":[]}');
    };
    const result = await runQualitySeriesTextEngine({ brief: brief(), llm, ledger: new CostLedger(), models: QUALITY_SERIES_MODELS });
    expect(result.engineIds).toEqual([QUALITY_SERIES_ENGINE]);
    expect(result.pages[0].content).toContain('anspruchsvoller Kunde');
    expect(result.pages[1].content).toContain('Nora hielt den Teddy still.');
    expect(calls).toEqual(['series-author', 'series-editorial-review', 'series-local-repair', 'series-editorial-recheck']);
  });
  test('an unreadable independent quality review cannot silently become a passed manuscript', async () => {
    await expect(runQualitySeriesTextEngine({ brief: brief(), models: QUALITY_SERIES_MODELS, ledger: new CostLedger(),
      llm: async request => reply(request.stage === 'series-author' ? draft() : 'not JSON') })).rejects.toThrow();
  });
});

describe('two image variants with bounded independent selection', () => {
  const entities = [
    { id: 'lead', name: 'Tilda', kind: 'character' as const, role: 'cast' as const, species: 'human', isHuman: true, appearance: 'girl with goggles', forbidden: [], referenceUrl: 'https://test/lead.jpg' },
    { id: 'kid', name: 'Nora', kind: 'character' as const, role: 'hero' as const, species: 'human', isHuman: true, appearance: 'girl with red glasses', forbidden: [], referenceUrl: 'https://test/kid.jpg' },
  ];
  const shot = (page: number) => ({ page, onStage: ['lead', 'kid'], scene: 'In the workshop Tilda holds one Teddy while Nora lifts the cloth.', focus: 'scene' as const, artifactVisible: false, paragraph: 1 });
  const qa = JSON.stringify({ visibleIds: ['lead', 'kid'], identityById: { lead: 0.98, kid: 0.98 }, posing: false, primaryActionClear: true,
    sceneMatch: 0.95, styleMatch: 0.95, storyConsistent: true, materialContradiction: false, defects: [] });
  test('draws two seeds and selects B on evidence without weakening identity gates', async () => {
    const seeds = new Set<number>();
    const result = await generateQualitySeriesImages({ entities, illustrations: { cover: shot(0), pages: [shot(1), shot(2)], storyElements: [] }, seed: 'variants', visionModel: 'test', pageTexts: { 1: 'Nora hebt das Tuch.', 2: 'Tilda hält den Teddy.' },
      buildReference: async () => ({ urls: ['https://test/sheet.jpg'], mode: 'sprite', subjects: [] }),
      provider: async request => { seeds.add(request.seed); return { url: `https://test/${request.seed}.jpg`, costUSD: 0.001 }; },
      llm: async request => reply(request.stage === 'quality-book-image-review' ? '{"issues":[]}' : request.stage.startsWith('quality-image-selection') ? '{"winner":"B","reason":"Clearer action and warmer expressions.","rejectA":false,"rejectB":false}' : qa) });
    expect(result.imageCalls).toBe(6);
    expect(seeds.size).toBe(6);
    expect(result.imagesGenerated).toBe(3);
    expect(result.selections.every(s => s.selected === 'B')).toBe(true);
  });
  test('an explicit provider safety block propagates, never falling back to a preferred picture', async () => {
    await expect(generateQualitySeriesImages({ entities, illustrations: { cover: shot(0), pages: [shot(1)], storyElements: [] }, seed: 'blocked', visionModel: 'test', pageTexts: {},
      buildReference: async () => ({ urls: ['https://test/sheet.jpg'], mode: 'sprite', subjects: [] }), provider: async request => ({ url: `https://test/${request.seed}.jpg` }),
      llm: async request => { if (request.stage.startsWith('quality-image-selection')) throw new StorybookSafetyBlock('test', request.stage, 'blocked'); return reply(qa); } })).rejects.toThrow();
  });
  test('a cross-picture contradiction rejects the affected winner instead of publishing a prettier wrong object', async () => {
    const result = await generateQualitySeriesImages({ entities, illustrations: { cover: shot(0), pages: [shot(1)], storyElements: [] }, seed: 'book-check', visionModel: 'test', pageTexts: {},
      buildReference: async () => ({ urls: ['https://test/sheet.jpg'], mode: 'sprite', subjects: [] }), provider: async request => ({ url: `https://test/${request.seed}.jpg` }),
      llm: async request => reply(request.stage === 'quality-book-image-review' ? '{"issues":[{"page":1,"detail":"The wooden box has become a metal cabinet in this picture.","blocking":true}]}'
        : request.stage.startsWith('quality-image-selection') ? '{"winner":"A","reason":"Clearer physical action.","rejectA":false,"rejectB":false}' : qa) });
    expect(result.bookReview.status).toBe('failed');
    expect(result.pages.get(1)?.status).toBe('failed');
    expect(result.selections.find(s => s.page === 1)?.selected).toBe('none');
  });
  test('a grounded central prop gets a real reference even when the cheap reference planner missed it', async () => {
    let portraits = 0, heldTeddySheets = 0;
    const result = await generateQualitySeriesImages({ entities, illustrations: { cover: shot(0), pages: [shot(1)], storyElements: [], continuity: [
      { name: 'Teddy', aliases: ['Teddy'], appearance: 'One brown cloth teddy with a blue ribbon.', evidence: [{ page: 1, quote: 'Nora hielt ihren Teddy fest.' }] },
    ] } as any, seed: 'prop-reference', visionModel: 'test', pageTexts: { 1: 'Nora hielt ihren Teddy fest.' },
      buildReference: async slots => { if (slots.length === 2 && slots[0].holds) heldTeddySheets++; return { urls: ['https://test/sheet.jpg'], mode: 'sprite', subjects: [] }; },
      provider: async request => { if (request.logStage === 'quality-object-reference') portraits++; return { url: `https://test/${request.seed}.jpg` }; },
      llm: async request => reply(request.stage === 'quality-book-image-review' ? '{"issues":[]}'
        : request.stage.startsWith('quality-image-selection') ? '{"winner":"A","reason":"Clearer physical action.","rejectA":false,"rejectB":false}' : qa) });
    expect(portraits).toBe(1);
    // Tilda holds the Teddy, so it rides in her cell (story 9a84d5e0) instead of a third one.
    expect(heldTeddySheets).toBe(4);
    expect(result.imageCalls).toBe(5);
  });
});
