export interface SeriesEditorialIssue {
  severity: 'major' | 'minor';
  quote: string;
  problem: string;
  change: string;
  kind?: 'continuity' | 'spelling' | 'craft';
  edit?: { before: string; after: string };
}

export const SERIES_SPELLING_CONTRACT = 'Prioritise an unfulfilled central promise, real causal contradictions and child comprehension over proofreading. A simultaneous action cannot use a hand explicitly still occupied, but ordinary sequential setting-down or passing a prop needs no narrated handover unless its absence creates an actual contradiction. Return minor spelling typos separately in optional spelling:[{severity:"minor",kind:"spelling",quote:"exact source sentence",problem:"typo",change:"correction",edit:{before:"single misspelled word",after:"correct word"}}], at most three. Retain issues:[] when there are no supported findings. A local one-letter insertion/deletion, adjacent transposition or case correction can then be applied without another model call. Never classify a name, ownership change or content rewrite as spelling.';

export const SERIES_EDITORIAL_CRAFT = 'READ AS A CHILDREN\'S BOOK, not an engineering inspection. CHILD READER TEST: Without using the series contract or earlier episodes to fill gaps, could a listener at the youngest age in the requested band retell who wants what, why it matters, what goes wrong, why the attempted solution helps, and how it ends? Trace these answers across chapters, including changes of place and the main cause-and-effect links. A helper moving from a side room to an outdoor entrance needs a plausible transition when the route matters. A named window, tool or special object must be identifiable at its first consequential use; the series contract alone cannot introduce it for the listener. Judge whether the concrete goal is meaningful to a child, not merely whether a technical task is completed. A jumble of unexplained specialist terms, similar place names, directions or prop movements can obscure the story even when every sentence is short. Report a central goal, obstacle, causal link or solution that a child cannot follow as MAJOR; cite the actual confusing passage and propose a specific bounded correction. A genuinely missing element may use an empty quote. An isolated unfamiliar word is not automatically a problem when context makes it clear. Preserve expressive language, humour and age-appropriate variety; do not demand uniformly short sentences or explain away every mystery.\n' +
  'Then trace the opening concrete task to its observable outcome: does the climax solve THAT problem for the people who needed it, and does the title promise really happen? An unrelated technical success or a finished object awaiting delivery is not enough when the opening promised an outcome. Flag a genuinely missing central payoff as major with evidence from the promise and ending. Check whether a tight deadline unrealistically contains minutes of cleaning, making or travel. Also report a concrete minor craft problem when it matters: repeated beats that leave the situation unchanged, a mechanical inventory replacing the decisive scene, undifferentiated functional dialogue, or an explained punchline. Give the exact affected passage and one bounded change preserving the voice; never demand a second plot or a generic "make it funnier". Strong jokes, character choices and warmth are worth protecting. A future-series clue stays secondary to today\'s resolution.\n' +
  'WORDS A CHILD HEARS: the final punchline must land for the youngest listener from the situation alone; an adult idiom there („hat das Wort“, „Stellvertreter“) is a minor craft problem with a simpler line as the change. A title image („Die Maschine hat Hunger“) that no character says or shows before the ending relies on it is minor. A young animal called „das Junge“ is heard as „der Junge“ (a boy): minor, name it „der kleine Seehund“ or similar.';

export const SERIES_LOCAL_EDIT_CONTRACT = 'For a MINOR continuity or craft issue with a clear one- or two-sentence fix, also return kind:"continuity" or kind:"craft" and edit:{before:"exact unique source passage containing the quoted evidence",after:"same passage with only the small repair"}. Keep before 12–600 characters and after at most 900; preserve voice, names, objects and jokes. Never supply this edit for a major issue or an uncertain diagnosis. The edit will be checked against the source and the resulting full manuscript will be reviewed again.';

export const SERIES_CAUSAL_REVIEW = 'CAUSAL AUDIT before returning issues: (1) Name the simplest action that could remove the central obstacle. Does the source explain why it is unavailable or insufficient? A competent helper leaving an easily removable cause in place for chapters is MAJOR when the plot depends on it. Do not demand exhaustive alternatives or adult competence from every comic mistake. (2) Trace the decisive choice backwards: a reluctance or personal cost must be established before it delays the obvious fix; removable decoration alone does not explain an inaccessible object. (3) Verify the order of proposal, decision and credit. Saying "we were about to suggest that" after a decision does not establish that the idea came from those speakers. Preserve clearly challenged comic false claims. (4) Check essential object state, access and clothing across scenes, without narrating routine handovers; a toy does not move itself unless this world establishes that power. Quote the affected source, propose a bounded repair and prioritise central causal defects over cosmetic phrasing. Compare recent family story excerpts for repeated opening and comic/solution mechanics; preserve a mandated episode premise, but flag a near-identical opening or avoidable repeated gag as minor craft. Historical excerpts are comparison evidence, not events in today\'s world.';

/** All-or-nothing proposal; exact local evidence is necessary, and the engine MUST re-review the edited manuscript. */
export function seriesLocalEdits(chapters: Array<{ text: string }>, issues: SeriesEditorialIssue[]): Array<{ chapter: number; before: string; after: string }> | undefined {
  if (!issues.length || issues.length > 2) return undefined;
  const edits: Array<{ chapter: number; before: string; after: string }> = [];
  for (const issue of issues) {
    const { before, after } = issue.edit || {};
    if (issue.severity !== 'minor' || !['continuity', 'craft'].includes(issue.kind || '') || typeof before !== 'string' || typeof after !== 'string'
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

const quoteNorm = (value: string) => value.normalize('NFC').replace(/[„“”"«»]/g, '"').replace(/\s+/g, ' ').trim();

/** A finding quotes (part of) a passage the repair has just written. */
export function touchesRepair(quote: string, edits: Array<{ after: string }>): boolean {
  const pieces = quoteNorm(quote || '').split(/\s*(?:\.\.\.|…)\s*/).filter(piece => piece.length >= 12);
  return edits.some(edit => {
    const after = quoteNorm(String(edit.after || ''));
    return pieces.some(piece => after.includes(piece) || (after.length >= 12 && piece.includes(after)));
  });
}

/**
 * Whether a repair of MINOR findings made the manuscript better. "Der Graf verbietet den Wind" (2026-11-04): Sol turned
 * an unclear final joke into an explained one, the recheck flagged the new line, the series kept it anyway and paid a
 * second round (1.2 ¢ in all) that ended on the explained line. Fewer findings is better. Otherwise the repair stays when
 * no finding quotes a repaired passage: only those passages changed, so a finding elsewhere was in the old text as well
 * (pilot 2026-11-06: Sol removed a talking flower pot, the story's unexplained second magic, and the recheck listed two
 * older minor points elsewhere; counting findings threw the good repair away).
 */
export function seriesMinorRepairImproved(before: SeriesEditorialIssue[], after: SeriesEditorialIssue[], edits: Array<{ after: string }>): boolean {
  if (after.some(issue => issue.severity === 'major')) return false;
  if (after.length < before.length) return true;
  return !after.some(issue => touchesRepair(issue.quote, edits));
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
