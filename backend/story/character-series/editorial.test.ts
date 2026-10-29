// @ts-ignore Bun test helpers are runtime-only in Encore.
import { describe, expect, test } from 'bun:test';
import { applySeriesSpellingCorrections, type SeriesEditorialIssue } from './editorial';

const typo = (before = 'Hofenster', after = 'Hoffenster'): SeriesEditorialIssue => ({ severity: 'minor', kind: 'spelling',
  quote: `Alexander zeigte auf das geschlossene ${before}.`, problem: 'Tippfehler', change: 'Schreibweise korrigieren.', edit: { before, after } });

describe('bounded spelling corrections', () => {
  test('the exact production typo changes locally without rewriting the sentence or the next chapter', () => {
    const chapters = [{ text: typo().quote }, { text: 'Adrian trug die Klammer.' }];
    const corrected = applySeriesSpellingCorrections(chapters, [typo()], ['Alexander', 'Adrian']);
    expect(corrected.chapters[0].text).toBe('Alexander zeigte auf das geschlossene Hoffenster.');
    expect(corrected.chapters[1]).toEqual(chapters[1]);
    expect(chapters[0].text).toContain('Hofenster');
    expect(corrected.remaining).toEqual([]);
    expect(corrected.edits).toEqual([{ chapter: 1, before: 'Hofenster', after: 'Hoffenster' }]);
  });
  test('names, word substitutions, prose additions, major findings and ambiguous occurrences require the normal reviewer', () => {
    for (const issue of [typo('Tilda', 'Tildda'), typo('Hofenster', 'Türfenster'), typo('Hofenster', 'Hoffenster mit Klammer'),
      { ...typo(), severity: 'major' as const }, { ...typo(), kind: 'continuity' as const }, { ...typo(), edit: { before: 123, after: {} } } as any]) {
      const result = applySeriesSpellingCorrections([{ text: issue.quote }], [issue], ['Tilda']);
      expect(result.edits).toEqual([]);
      expect(result.remaining).toEqual([issue]);
    }
    const repeated = [{ text: `${typo().quote} Am Hofenster hing Papier.` }];
    expect(applySeriesSpellingCorrections(repeated, [typo()], []).edits).toEqual([]);
    expect(applySeriesSpellingCorrections([{ text: typo().quote.replace('Hofenster', 'Hofensterrahmen') }], [typo()], []).edits).toEqual([]);
  });
  test('a source-absent quote cannot authorize a correction', () => {
    const source = [{ text: 'Adrian zeigte auf das geschlossene Hofenster.' }];
    expect(applySeriesSpellingCorrections(source, [typo()], []).edits).toEqual([]);
  });
});
