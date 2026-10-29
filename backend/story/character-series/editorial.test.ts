// @ts-ignore Bun test helpers are runtime-only in Encore.
import { describe, expect, test } from 'bun:test';
import { applySeriesSpellingCorrections, seriesLocalEdits, type SeriesEditorialIssue } from './editorial';

const typo = (before = 'Hofenster', after = 'Hoffenster'): SeriesEditorialIssue => ({ severity: 'minor', kind: 'spelling',
  quote: `Alexander zeigte auf das geschlossene ${before}.`, problem: 'Tippfehler', change: 'Schreibweise korrigieren.', edit: { before, after } });

describe('reviewer-proposed local continuity edits', () => {
  const before = 'Tilda pustete den Zipfel fort.';
  const issue: SeriesEditorialIssue = { severity: 'minor', kind: 'continuity', quote: before, problem: 'Der Zipfel taucht später wieder auf.', change: 'An der Schürze behalten.', edit: { before, after: 'Tilda löste den Zipfel und drückte ihn an ihre Schürze.' } };
  test('only a unique, short, evidenced correction is eligible for full re-review', () => {
    expect(seriesLocalEdits([{ text: before }, { text: 'Sie kehrten zurück.' }], [issue])).toEqual([{ chapter: 1, ...issue.edit }]);
    for (const invalid of [{ ...issue, severity: 'major' }, { ...issue, quote: 'Nicht im Text.' }, { ...issue, kind: 'spelling' },
      { ...issue, edit: { before, after: 'x'.repeat(901) } }, { ...issue, edit: { before, after: before } }]) {
      expect(seriesLocalEdits([{ text: before }], [invalid as SeriesEditorialIssue])).toBeUndefined();
    }
    expect(seriesLocalEdits([{ text: before }, { text: before }], [issue])).toBeUndefined();
    expect(seriesLocalEdits([{ text: before + before }, { text: before }], [issue])).toBeUndefined();
    expect(seriesLocalEdits([{ text: before }], [issue, issue])).toBeUndefined();
    expect(seriesLocalEdits([{ text: before }], [issue, { ...issue, edit: undefined }])).toBeUndefined();
  });
});

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
