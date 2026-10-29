export interface SeriesEditorialIssue {
  severity: 'major' | 'minor';
  quote: string;
  problem: string;
  change: string;
  kind?: 'continuity' | 'spelling';
  edit?: { before: string; after: string };
}

export const SERIES_SPELLING_CONTRACT = 'Prioritise contradictory actions and missing prop handovers over proofreading. Use the two issues slots for actual continuity/logic findings. A character who explicitly lets go cannot still be holding the same object later without taking it again; a held tool changes owner through a shown handover. Return minor spelling typos separately in optional spelling:[{severity:"minor",kind:"spelling",quote:"exact source sentence",problem:"typo",change:"correction",edit:{before:"single misspelled word",after:"correct word"}}], at most three. Retain issues:[] when there are no logic findings. A local one-letter insertion/deletion, adjacent transposition or case correction can then be applied without another model call. Never classify a name, ownership change or content rewrite as spelling.';

/** Only a single inserted/deleted letter, an adjacent transposition or case correction; no word substitutions. */
function smallSpellingChange(before: string, after: string): boolean {
  const a = before.toLocaleLowerCase('de-DE'), b = after.toLocaleLowerCase('de-DE');
  if (a === b) return before !== after;
  if (Math.abs(a.length - b.length) === 1) {
    const [longer, shorter] = a.length > b.length ? [a, b] : [b, a];
    return [...longer].some((_, i) => longer.slice(0, i) + longer.slice(i + 1) === shorter);
  }
  const differences = [...a].flatMap((c, i) => c === b[i] ? [] : [i]);
  return a.length === b.length && differences.length === 2 && differences[1] === differences[0] + 1
    && a[differences[0]] === b[differences[1]] && a[differences[1]] === b[differences[0]];
}

/** Safe one-word proofreading avoids paying Sol + a full recheck just to change Hofenster to Hoffenster. */
export function applySeriesSpellingCorrections<T extends { text: string }>(chapters: T[], issues: SeriesEditorialIssue[], protectedNames: string[]) {
  const protectedWords = new Set(protectedNames.flatMap(name => name.split(/[^\p{L}]+/u)).map(w => w.toLocaleLowerCase('de-DE')));
  const result = chapters.map(c => ({ ...c }));
  const remaining: SeriesEditorialIssue[] = [], edits: Array<{ chapter: number; before: string; after: string }> = [];
  for (const issue of issues) {
    const { before, after } = issue.edit || {};
    if (issue.kind !== 'spelling' || issue.severity !== 'minor' || typeof before !== 'string' || typeof after !== 'string' || !before || !after
      || !/^[\p{L}]{4,40}$/u.test(before) || !/^[\p{L}]{4,41}$/u.test(after)
      || protectedWords.has(before.toLocaleLowerCase('de-DE')) || protectedWords.has(after.toLocaleLowerCase('de-DE'))
      || !smallSpellingChange(before, after) || !issue.quote.includes(before)) { remaining.push(issue); continue; }
    const word = new RegExp(`(?<![\\p{L}])${before}(?![\\p{L}])`, 'gu');
    const matches = result.flatMap((chapter, i) => [...chapter.text.matchAll(word)].map(m => ({ chapter: i, at: m.index! })));
    if (matches.length !== 1 || !result[matches[0].chapter].text.includes(issue.quote)) { remaining.push(issue); continue; }
    const { chapter, at } = matches[0];
    result[chapter].text = result[chapter].text.slice(0, at) + after + result[chapter].text.slice(at + before.length);
    edits.push({ chapter: chapter + 1, before, after });
  }
  return { chapters: result, remaining, edits };
}
