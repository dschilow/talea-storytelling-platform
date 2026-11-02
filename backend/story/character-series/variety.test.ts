// @ts-ignore Bun test helpers are runtime-only in Encore.
import { describe, expect, test } from 'bun:test';
import { seriesCraftHistory, seriesCraftMemory, seriesVarietyContext } from './variety';
import { seriesAuthoring, seriesBudget, SERIES_MODELS } from './authoring';
import { buildBrief } from '../storybook/context';
import { runCharacterSeriesTextEngine } from './engine';
import { CostLedger } from '../storybook/llm';
import bibles from './series-bibles.json';

describe('family-wide story variety without cross-series continuity', () => {
  const memory = seriesCraftMemory([
    { content: 'Tilda verbeugte sich vor einem leeren Hocker.\n\nNiemand klatschte.\n\nSpäter kam ein Teddy.' },
    { content: 'Tilda nahm ihre schöne Front ab.\n\nSie reparierte die Naht.\n\n„Nur Teddys?“' },
  ]);
  test('records accepted prose, keeps bounded excerpts and reads older plans without inventing source', () => {
    expect(memory.opening).toBe('Tilda verbeugte sich vor einem leeren Hocker. Niemand klatschte.');
    expect(memory.turnaround).toContain('Tilda nahm ihre schöne Front ab.');
    const line = seriesCraftHistory({ pipeline: 'character-series-v1', characterSeriesCraft: memory }, 'Aufräummaschine')!;
    expect(line).toContain('Einstieg: „Tilda verbeugte');
    expect(line).toContain('Nur Teddys?');
    expect(seriesCraftHistory({ pipeline: 'other', characterSeriesCraft: memory }, 'Other')).toBeUndefined();
    expect(seriesCraftHistory({ pipeline: 'character-series-v1', episode: { plan: { chapters: [{ laugh: 'Unterhose auf dem Kopf' }] } } }, 'Alt'))
      .toContain('Geplante Komik: „Unterhose auf dem Kopf“');
    expect(seriesCraftHistory({ pipeline: 'character-series-v1', episode: { plan: { chapters: {} } } }, 'Alt')).toBeUndefined();
    expect(seriesCraftMemory([{ content: 'a'.repeat(5000) }]).turnaround.length).toBeLessThanOrEqual(500);
    expect(seriesCraftMemory([])).toEqual({ opening: '', turnaround: '', ending: '' });
  });
  test('bounded comparison data reaches writer AND editor in another world, with two normal text calls', async () => {
    const bible = bibles.find(b => b.id === 'kapitaen-blubbert')!;
    const b = buildBrief({ config: { avatarIds: ['kid'], genre: 'animals', setting: 'ocean', complexity: 'medium', ageGroup: '6-8', length: 'short' }, band: '6-8',
      budget: { ...seriesBudget('short', '6-8'), pages: 2, totalWordsMin: 1, totalWordsMax: 5000 },
      heroes: [{ id: 'kid', name: 'Nora' }], candidates: [], artifacts: [], seed: 'variety',
      recentStories: [seriesCraftHistory({ pipeline: 'character-series-v1', characterSeriesCraft: memory }, 'Tilda')!] });
    b.characterSeries = { bible, logs: [] };
    const stages: string[] = [];
    const draft = `FIGUR: Kapitän Blubbert | pool | ${bible.characterId} | companion\nTITEL: Der freie Sitz\nBESCHREIBUNG: Ein Seehund wartet.\nIDEE: Die Mannschaft hilft.\nREGEL: Abstand hilft.\nFUNDSTÜCK: kein\nKAPITEL 1: Am Steg\nBlubbert hielt eine nasse Mütze hoch. Nora kam zum Boot und stellte sich vor.\n\nPia führte den Hundehalter fort.\nKAPITEL 2: Die Bucht\nNora schlug die Bucht vor. Blubbert nickte und steuerte das Boot.\n\nDer Seehund schwamm zu seiner Mutter.`;
    await runCharacterSeriesTextEngine({ brief: b, ledger: new CostLedger(), models: SERIES_MODELS, llm: async request => {
      stages.push(request.stage);
      expect(request.user).toContain(memory.opening);
      expect(request.user).toContain('never shared continuity');
      if (request.stage === 'series-editorial-review') {
        expect(request.user).toContain('CAUSAL AUDIT');
        expect(request.user).toContain('proposal, decision and credit');
      }
      return { text: request.stage === 'series-author' ? draft : '{"issues":[]}', modelUsed: 'test',
        usage: { prompt: 1, completion: 1, total: 2, costUSD: 0 }, durationMs: 0 };
    } });
    expect(seriesAuthoring(b).system).toContain('CAUSAL OBSTACLES AND EARNED CHOICES');
    expect(stages).toEqual(['series-author', 'series-editorial-review']);
    expect(seriesVarietyContext([])).toBe('');
    const long = seriesVarietyContext(Array.from({ length: 30 }, () => 'Erzählmuster ' + 'x'.repeat(5000)));
    expect(long.length).toBeLessThan(4500);
  });
});
