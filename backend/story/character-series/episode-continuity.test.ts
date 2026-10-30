// @ts-ignore Bun test helpers are runtime-only in the Encore project.
import { describe, expect, test } from 'bun:test';
import bibles from './series-bibles.json';
import { buildBrief } from '../storybook/context';
import { SERIES_PLAN_FILES, getSeriesEpisodeBlueprint } from './episode-plans';
import { SERIES_NARRATIVES } from './narrative';
import { seriesAuthoring, seriesContext } from './authoring';

function episodeBrief(id: string, episode: number, avatarCount = 2) {
  const heroes = Array.from({ length: avatarCount }, (_, n) => ({ id: `child-${n}`, name: ['Leni', 'Sam', 'Nuri'][n] }));
  const brief = buildBrief({
    config: { avatarIds: heroes.map(h => h.id), genre: 'adventure', setting: 'village', ageGroup: '6-8', length: 'medium', avatarIsHero: false },
    band: '6-8', budget: { pages: 3, wordsPerPageMin: 450, wordsPerPageMax: 650, totalWordsMin: 1350, totalWordsMax: 1950, maxCast: 2, maxCharactersPerImage: 3 },
    heroes, candidates: [], artifacts: [], seed: 'episode-continuity',
  });
  brief.characterSeries = { bible: bibles.find(b => b.id === id)!, logs: [], episodeOverride: episode };
  return brief;
}

describe('continuity of all five planned series', () => {
  test('every planned episode supplies its carry-over to the writer and reviewer context, including direct admin jumps', () => {
    let count = 0;
    for (const [id, series] of Object.entries(SERIES_PLAN_FILES)) {
      expect(series.episodes).toHaveLength(20);
      for (const episode of series.episodes) {
        expect(episode.continuity.length).toBeGreaterThan(65);
        const ctx = seriesContext(episodeBrief(id, episode.episode));
        expect(ctx).toContain(episode.continuity);
        expect(ctx).toContain(episode.titleIdea);
        expect(ctx).toContain('The recorded family history below takes precedence.');
        if (episode.guestId) {
          const guest = series.ensemble.find(g => g.id === episode.guestId)!;
          expect(guest).toBeDefined();
          expect(episode.episode).toBeGreaterThanOrEqual(guest.debutEpisode);
          expect(Boolean(episode.guestDebut)).toBe(episode.episode === guest.debutEpisode);
        }
        count++;
      }
      for (const guest of series.ensemble) {
        expect(series.episodes.find(e => e.guestId === guest.id)?.episode).toBe(guest.debutEpisode);
      }
    }
    expect(count).toBe(100);
  });

  test('role allocation fits one, two and three supplied avatars without inventing an A/B child', () => {
    for (const id of Object.keys(SERIES_PLAN_FILES)) {
      const solo = seriesAuthoring(episodeBrief(id, 18, 1)).user();
      expect(solo).toContain('ONE supplied avatar');
      expect(solo).toContain('observe first and act next');
      const pair = seriesAuthoring(episodeBrief(id, 18, 2)).user();
      expect(pair).toContain('TWO supplied avatars by name');
      const trio = seriesAuthoring(episodeBrief(id, 18, 3)).user();
      expect(trio).toContain('THREE supplied avatars by name');
      expect(trio).toContain('Nuri');
    }
  });

  test('after the twentieth episode the origin, solved season riddle and guest debut are not cycled again', () => {
    for (const id of Object.keys(SERIES_PLAN_FILES)) {
      expect(getSeriesEpisodeBlueprint(id, 20)?.episode).toBe(20);
      for (const n of [21, 40, 41]) {
        expect(getSeriesEpisodeBlueprint(id, n)).toBeUndefined();
        const brief = episodeBrief(id, n);
        // Admin overrides are intentionally limited to 1..20; later episodes arise from actual retained history.
        brief.characterSeries!.episodeOverride = undefined;
        brief.characterSeries!.logs = [{ episode: n - 1, storyId: 'previous', avatarIds: ['child-0', 'child-1'], events: [{ fact: 'Neue Route offen', quote: 'Die neue Route war nun offen.' }], relationships: [], openThreads: [] }];
        const ctx = seriesContext(brief);
        expect(ctx).toContain(`episode ${n}.`);
        expect(ctx).toContain('AFTER THE TWO PLANNED SEASONS');
        expect(ctx).not.toContain('PRE-PLANNED BLUEPRINT');
        expect(ctx).not.toContain('GRAND DEBUT');
        expect(ctx).not.toContain('ORIGIN —');
      }
    }
    expect(getSeriesEpisodeBlueprint('nebelfee', 0)).toBeUndefined();
    expect(getSeriesEpisodeBlueprint('unknown', 1)).toBeUndefined();
  });

  test('a documented earlier variant stays in context when the revised plan expects a different prop location', () => {
    const brief = episodeBrief('tilda-tueftel', 10);
    const quote = 'Die Holzklammer blieb bei Leni zu Hause im blauen Werkzeugkasten.';
    brief.characterSeries!.logs = [{ episode: 1, storyId: 'old-variant', avatarIds: ['child-0'], events: [{ fact: 'Klammer bei Leni', quote }], relationships: [], openThreads: [] }];
    const ctx = seriesContext(brief);
    expect(ctx).toContain(quote);
    expect(ctx).toContain(getSeriesEpisodeBlueprint('tilda-tueftel', 10)!.continuity);
    expect(ctx).toContain('If an older episode differs from this revised plan');
    expect(ctx).toContain('Explain any transition from a documented object location');
  });

  test('Funkelflug has the same one-strike origin in the world contract and the first blueprint', () => {
    const origin = SERIES_NARRATIVES.funkelflug.origin;
    expect(origin.after).toContain('genau EIN Schlag');
    expect(origin.trouble).toContain('Wanderkorb');
    expect(origin.trouble).not.toContain('Drei Glockenschläge');
    const ep1 = getSeriesEpisodeBlueprint('funkelflug', 1)!;
    expect(ep1.suspense).toContain('Wanderkorb');
    expect(ep1.clue).toContain('ein einziges Mal');
  });
});
