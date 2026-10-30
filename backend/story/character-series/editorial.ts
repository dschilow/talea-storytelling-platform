export interface SeriesEditorialIssue {
  severity: 'major' | 'minor';
  quote: string;
  problem: string;
  change: string;
  kind?: 'continuity' | 'spelling' | 'craft';
  edit?: { before: string; after: string };
}

export const SERIES_SPELLING_CONTRACT = 'Prioritise an unfulfilled central promise, real causal contradictions and child comprehension over proofreading. A simultaneous action cannot use a hand explicitly still occupied, but ordinary sequential setting-down or passing a prop needs no narrated handover unless its absence creates an actual contradiction. Return minor spelling typos separately in optional spelling:[{severity:"minor",kind:"spelling",quote:"exact source sentence",problem:"typo",change:"correction",edit:{before:"single misspelled word",after:"correct word"}}], at most three. Retain issues:[] when there are no supported findings. A local one-letter insertion/deletion, adjacent transposition or case correction can then be applied without another model call. Never classify a name, ownership change or content rewrite as spelling.';

export const SERIES_EDITORIAL_CRAFT = 'READ AS A CHILDREN\'S BOOK, not an engineering inspection. CHILD READER TEST: Without using the series contract or earlier episodes to fill gaps, could a listener at the youngest age in the requested band retell who wants what, why it matters, what goes wrong, why the attempted solution helps, and how it ends? Trace these answers across chapters, including changes of place and the main cause-and-effect links. Judge whether the concrete goal is meaningful to a child, not merely whether a technical task is completed. A jumble of unexplained specialist terms, similar place names, directions or prop movements can obscure the story even when every sentence is short. Report a central goal, obstacle, causal link or solution that a child cannot follow as MAJOR; cite the actual confusing passage and propose a specific bounded correction. A genuinely missing element may use an empty quote. An isolated unfamiliar word is not automatically a problem when context makes it clear. Preserve expressive language, humour and age-appropriate variety; do not demand uniformly short sentences or explain away every mystery.\n' +
  'Then trace the opening concrete task to its observable outcome: does the climax solve THAT problem for the people who needed it, and does the title promise really happen? An unrelated technical success or a finished object awaiting delivery is not enough when the opening promised an outcome. Flag a genuinely missing central payoff as major with evidence from the promise and ending. Check whether a tight deadline unrealistically contains minutes of cleaning, making or travel. Also report a concrete minor craft problem when it matters: repeated beats that leave the situation unchanged, a mechanical inventory replacing the decisive scene, undifferentiated functional dialogue, or an explained punchline. Give the exact affected passage and one bounded change preserving the voice; never demand a second plot or a generic "make it funnier". Strong jokes, character choices and warmth are worth protecting. A future-series clue stays secondary to today\'s resolution.';

export const SERIES_LOCAL_EDIT_CONTRACT = 'For a MINOR continuity issue with a clear one- or two-sentence fix, also return kind:"continuity" and edit:{before:"exact unique source passage containing the quoted evidence",after:"same passage with only the small repair"}. Keep before 12–600 characters and after at most 900; preserve voice, names, objects and jokes. Never supply this edit for a major issue or an uncertain diagnosis. The edit will be checked against the source and the resulting full manuscript will be reviewed again.';

/** All-or-nothing proposal; exact local evidence is necessary, and the engine MUST re-review the edited manuscript. */
export function seriesLocalEdits(chapters: Array<{ text: string }>, issues: SeriesEditorialIssue[]): Array<{ chapter: number; before: string; after: string }> | undefined {
  if (!issues.length || issues.length > 2) return undefined;
  const edits: Array<{ chapter: number; before: string; after: string }> = [];
  for (const issue of issues) {
    const { before, after } = issue.edit || {};
    if (issue.severity !== 'minor' || issue.kind !== 'continuity' || typeof before !== 'string' || typeof after !== 'string'
      || before.length < 12 || before.length > 600 || !after.trim() || after.length > 900 || after.length > before.length + 350
      || !issue.quote || !before.includes(issue.quote) || before === after) return undefined;
    const matches = chapters.flatMap((c, index) => c.text.includes(before) && c.text.indexOf(before) === c.text.lastIndexOf(before) ? [index] : []);
    // A duplicate in any chapter makes the proposal ambiguous, even when another chapter contains it once.
    if (matches.length !== 1 || chapters.some(c => c.text.indexOf(before) !== c.text.lastIndexOf(before))) return undefined;
    const chapter = matches[0] + 1;
    if (edits.some(e => e.chapter === chapter && (e.before.includes(before) || before.includes(e.before)))) return undefined;
    edits.push({ chapter, before, after });
  }
  return edits;
}

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
