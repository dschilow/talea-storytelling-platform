// @ts-ignore Bun test helpers are runtime-only in Encore.
import { describe, expect, test } from 'bun:test';
import { buildBrief } from '../storybook/context';
import { CostLedger } from '../storybook/llm';
import { runCharacterSeriesTextEngine, seriesLlmBudget } from './engine';
import { directSeriesPictures, generateSeriesImages, validateSeriesShots } from './pictures';
import { SERIES_MODELS, seriesBudget } from './authoring';
import bibles from './series-bibles.json';
import type { VisualEntity } from '../storybook/illustration-stage';

const bible = bibles.find(b => b.id === 'funkelflug')!;
const brief = () => {
  const b = buildBrief({ config: { avatarIds: ['kid'], genre: 'adventure', setting: 'mountain', ageGroup: '6-8', length: 'short', avatarIsHero: false },
    band: '6-8', budget: { ...seriesBudget('short', '6-8'), pages: 2, totalWordsMin: 10, totalWordsMax: 5000 },
    heroes: [{ id: 'kid', name: 'Nora' }], candidates: [{ id: bible.characterId, name: 'Funkelflug', species: 'dragon', whoTheyAre: 'Drache', personality: [], speechStyle: [], canLead: true }], artifacts: [], seed: 'cost-regression' });
  b.characterSeries = { bible, logs: [] };
  return b;
};
const reply = (text: string) => ({ text, modelUsed: 'test', usage: { prompt: 1, completion: 1, total: 2, costUSD: 0 }, durationMs: 0 });
const prose = `FIGUR: Funkelflug | pool | ${bible.characterId} | companion\nTITEL: Der Glockenhof\nBESCHREIBUNG: Ein Abenteuer am Berg.\nIDEE: Gemeinsam die Glocke erreichen.\nREGEL: Funkelflug fliegt nicht.\nFUNDSTÜCK: kein\nKAPITEL 1: Der Hof\nFunkelflug stellte den Becher ab. Nora nahm ihn vom Tisch.\n\nAlexander zeigte auf das geschlossene Hofenster.\nKAPITEL 2: Der Weg\nNora trug den Becher zur Glocke. Funkelflug zog am Seil.\n\nDer Weg war wieder offen, und beide gingen zusammen weiter.`;

describe('production failures and avoidable series cost, abfc9b06', () => {
  test('a cited spelling correction finishes with author plus reviewer, without Sol repair and another whole-story check', async () => {
    const stages: string[] = [];
    const result = await runCharacterSeriesTextEngine({ brief: brief(), models: SERIES_MODELS, ledger: new CostLedger(), llm: async r => {
      stages.push(r.stage);
      expect(r.stage).not.toContain('local-repair');
      if (r.stage === 'series-author') return reply(prose);
      expect(r.system).toContain('spelling:[');
      return reply(JSON.stringify({ issues: [], spelling: [{ severity: 'minor', kind: 'spelling', quote: 'Alexander zeigte auf das geschlossene Hofenster.', problem: 'Tippfehler', change: 'Ein f ergänzen.', edit: { before: 'Hofenster', after: 'Hoffenster' } }] }));
    } });
    expect(stages).toEqual(['series-author', 'series-editorial-review']);
    expect(result.pages[0].content).toContain('geschlossene Hoffenster.');
    expect(result.textQuality?.issues).toEqual([]);
    expect(result.chosen).toBe('revision');
  });

  test('a real minor continuity repair retains the full source and eligible history without resending future episode plans', async () => {
    const b = brief();
    b.characterSeries = { bible, episodeOverride: 2, logs: [
      { episode: 1, storyId: 'past', avatarIds: ['kid'], events: [{ fact: 'Früher', quote: 'Nora trug einen grünen Korb.' }], relationships: [], openThreads: [] },
      { episode: 3, storyId: 'future', avatarIds: ['kid'], events: [{ fact: 'Später', quote: 'Ein späterer Gast fand die Winterkarte.' }], relationships: [], openThreads: [] },
    ] };
    await runCharacterSeriesTextEngine({ brief: b, models: SERIES_MODELS, ledger: new CostLedger(), llm: async r => {
      if (r.stage === 'series-author') return reply(prose);
      if (r.stage === 'series-editorial-review') return reply(JSON.stringify({ issues: [{ severity: 'minor', quote: 'Nora nahm ihn vom Tisch.', problem: 'Der Griff zum Becher fehlt.', change: 'Den Griff zeigen.' }] }));
      if (r.stage === 'series-local-repair') {
        expect(r.user).toContain('WORLD RULES:');
        expect(r.user).toContain('MANUSCRIPT:');
        expect(r.user).toContain('Nora trug einen grünen Korb.');
        expect(r.user).not.toContain('Ein späterer Gast fand');
        expect(r.user).not.toContain('PRE-PLANNED BLUEPRINT');
        return reply(JSON.stringify({ edits: [{ chapter: 1, before: 'Nora nahm ihn vom Tisch.', after: 'Nora griff nach dem Becher und nahm ihn vom Tisch.' }] }));
      }
      return reply('{"issues":[]}');
    } });
  });

  test('a malformed cover visualBeat reuses a validated story motif without a paid plan repair', async () => {
    const b = brief(), lead = bible.characterId;
    const entities: VisualEntity[] = [
      { id: lead, name: 'Funkelflug', kind: 'character', role: 'cast', species: 'dragon', isHuman: false, appearance: 'golden dragon', forbidden: [], referenceUrl: 'https://example.test/dragon.webp' },
      { id: 'kid', name: 'Nora', kind: 'character', role: 'hero', species: 'human', isHuman: true, appearance: 'child', forbidden: [], referenceUrl: 'https://example.test/nora.webp' },
    ];
    const chapters = [1, 2].map(order => ({ order, title: 'Glocke', paragraphs: [], content: Array.from({ length: 16 }, (_, i) => `Absatz ${i + 1}: Funkelflug zieht am Seil. Nora fängt den losen Griff.`).join('\n\n') }));
    const stages: string[] = [];
    const scene = 'In the mountain courtyard, Funkelflug pulls the rope and the loose wooden handle swings toward Nora as she ducks.';
    const plan = { cover: { onStage: [lead, 'kid'], scene, visualBeat: { actorId: 'unknown', action: 'looks', result: 'nice' } },
      pages: Array.from({ length: 4 }, (_, i) => ({ page: i + 1, paragraph: 3, storyQuote: 'Funkelflug zieht am Seil. Nora fängt den losen Griff.', onStage: [lead, 'kid'], scene,
        visualBeat: { actorId: lead, action: 'pulls the bell rope down', result: 'the wooden handle swings toward Nora', framing: i % 2 ? 'close' : 'medium' } })) };
    const result = await directSeriesPictures({ brief: b, model: 'test', title: 'Glocke', pages: chapters, entities, llm: async r => { stages.push(r.stage); return reply(JSON.stringify(plan)); } });
    expect(stages).toEqual(['series-picture-direction']);
    expect(result.illustrations.cover).toMatchObject({ page: 0, coverSourcePage: 1, onStage: [lead, 'kid'] });
    expect((result.illustrations.cover as any).visualBeat.actorId).toBe(lead);
    expect(result.illustrations.cover.scene).toContain(scene);
    plan.pages[0].visualBeat.action = 'looks at Nora';
    expect(() => validateSeriesShots(plan, result.pages, entities, lead)).toThrow('körperliche Handlung');
  });

  test('the budget wrapper does not multiply vision recovery calls for the same free empty answer', async () => {
    const stages: string[] = [];
    const budgeted = seriesLlmBudget(async r => { stages.push(r.stage); throw Object.assign(new Error('Empty'), { billed: { usage: { total: 0, costUSD: 0 } } }); });
    await expect(budgeted({ stage: 'series-image-qa-1-1', model: 'gemini' } as any)).rejects.toThrow('Empty');
    expect(stages).toEqual(['series-image-qa-1-1']);
    // The existing non-vision free retry remains available to save the writer from transient provider blips.
    stages.length = 0;
    await expect(budgeted({ stage: 'series-author', model: 'writer' } as any)).rejects.toThrow('Empty');
    expect(stages).toEqual(['series-author', 'series-author']);
  });
});
