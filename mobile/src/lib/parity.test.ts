import { describe, expect, test } from 'bun:test';
import { collectPages, collectCursorPages } from './pagination';
import { bookHtml } from './bookHtml';
import { treasuryArtifacts, type TreasuryOverview } from './featureModels';
import { resolveWebRoute } from '../navigation/webRoutes';
import { extractCardsFromSections, matchesFilter, shuffle } from './quizDeck';
import { SEED_SEGMENTS, computeNodeStates } from './TaleaLearningPathSeedData';
import { initialJourneyProgress, startJourneyNode, finishJourneySource } from './journeyModel';
import { avatarToFormData, toCompleteFormData, getDirtyFormFields, formDataToBackendFormat, mergeAnalyzedVisualProfile } from './avatarEditorModel';
import type { Doku } from '../types/doku';

describe('complete backend catalogues', () => {
  test('collects more than the first page without dropping the final entry', async () => {
    const data = Array.from({ length: 123 }, (_, i) => ({ id: String(i) }));
    const calls: number[] = [];
    expect(await collectPages(async ({ limit, offset }) => { calls.push(offset); return { items: data.slice(offset, offset + limit), total: data.length }; })).toEqual(data);
    expect(calls).toEqual([0, 50, 100]);
  });
  test('admin exclusive cursors do not skip the first omitted user', async () => {
    const data = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
    expect(await collectCursorPages(async (cursor) => {
      const remaining = data.filter((item) => !cursor || item.id > cursor);
      return { items: remaining.slice(0, 2), nextCursor: remaining[2]?.id };
    })).toEqual(data);
  });
  test('cursor loop fails rather than hanging', async () => {
    await expect(collectCursorPages(async () => ({ items: [{ id: 'a' }], nextCursor: 'b' }))).rejects.toThrow('did not advance');
  });
});

describe('native web route parity', () => {
  test('create and edit are distinct from avatar detail', () => {
    expect(resolveWebRoute('/avatar/create')).toEqual({ name: 'AvatarWizard', params: { childMode: false } });
    expect(resolveWebRoute('/avatar/edit/123')).toEqual({ name: 'AvatarEdit', params: { avatarId: '123' } });
    expect(resolveWebRoute('/avatar/123')).toEqual({ name: 'AvatarDetail', params: { avatarId: '123' } });
  });
  test('topic prefill and legacy reader links still open native screens', () => {
    expect(resolveWebRoute('/doku/create?topic=Erde+%26+Mond&domainId=space')).toEqual({ name: 'DokuWizard', params: { topic: 'Erde & Mond', domainId: 'space' } });
    expect(resolveWebRoute('/story-reader-scroll/a')).toEqual({ name: 'StoryReader', params: { storyId: 'a' } });
    expect(resolveWebRoute('/cosmos/parent')?.name).toBe('CosmosParent');
    expect(resolveWebRoute('/unavailable')).toBeUndefined();
    expect(resolveWebRoute('/avatar/%broken')).toBeUndefined();
  });
});

describe('quiz and learning progression', () => {
  const doku = { id: 'd', title: 'Sterne', topic: 'Weltraum', status: 'complete', metadata: { configSnapshot: { ageGroup: '6-8', perspective: 'science' } }, content: { sections: [
    { title: 'Mond', content: 'Hallo', interactive: { quiz: { enabled: true, questions: [
      { prompt: 'Was ist ein Stern?', answers: [{ label: 'Sonne' }, { text: 'Stein' }], correctAnswer: 'Sonne' },
      { question: 'Unvollständig', options: ['A'] },
      { question: 'Zweite Frage', options: ['A', 'B'], correctIndex: 1 },
    ] } } },
    { title: 'Aus', interactive: { quiz: { enabled: false, questions: [{ question: 'Nicht spielen', options: ['A', 'B'] }] } } },
  ] } } as unknown as Doku;
  test('normalizes old questions and excludes disabled or malformed quizzes', () => {
    const cards = extractCardsFromSections(doku);
    expect(cards).toHaveLength(2); expect(cards[0].options).toEqual(['Sonne', 'Stein']); expect(cards[1].answerIndex).toBe(1);
    expect(new Set(cards.map((card) => card.id)).size).toBe(2);
    const shuffled = shuffle(cards); expect(shuffled).not.toBe(cards); expect(shuffled.map((c) => c.id).sort()).toEqual(cards.map((c) => c.id).sort());
  });
  test('filters stored age and perspective', () => {
    expect(matchesFilter(doku, { query: 'stern', ageGroup: '6-8', depth: 'all', perspective: 'science' })).toBe(true);
    expect(matchesFilter(doku, { query: '', ageGroup: '9-12', depth: 'all', perspective: 'all' })).toBe(false);
  });
  test('reading unlocks the next stop and does not complete unrelated activities', () => {
    const segment = SEED_SEGMENTS[0]; const node = segment.nodes[0];
    const started = startJourneyNode(initialJourneyProgress(), node);
    expect(finishJourneySource(started, 'story')).toBe(started);
    const done = finishJourneySource(started, 'doku');
    expect(done.doneNodeIds).toEqual([node.nodeId]); expect(done.pendingNodeActions).toEqual([]);
    expect(computeNodeStates(segment, done).nodesWithState[1].state).toBe('available');
    expect(finishJourneySource(done, 'doku')).toBe(done);
  });
});

describe('avatar consistency and exports', () => {
  test('renaming preserves canonical visual details', () => {
    const canonical = { characterType: 'human', hair: { color: 'brown', uniqueCurl: 'left' }, clothingCanonical: { top: 'red jumper' }, canonicalMarkers: ['freckle'], mustIncludeFeatures: ['round glasses'] };
    const form = toCompleteFormData(avatarToFormData({ name: 'Lina', visualProfile: canonical }));
    const changed = { ...form, name: 'Mia' };
    const result = formDataToBackendFormat(changed, true, canonical, getDirtyFormFields(changed, form));
    expect(result.visualProfile.clothingCanonical).toEqual(canonical.clothingCanonical);
    expect(result.visualProfile.canonicalMarkers).toEqual(canonical.canonicalMarkers);
    expect(result.visualProfile.hair.uniqueCurl).toBe('left');
  });
  test('image analysis merges features and preserves invariants', () => {
    const merged = mergeAnalyzedVisualProfile({ canonicalMarkers: ['left'], accessories: ['glasses'], hair: { custom: 'curl' } }, { canonicalMarkers: ['wrong'], accessories: ['glasses', 'hat'], hair: { color: 'black' } });
    expect(merged.canonicalMarkers).toEqual(['left']); expect(merged.accessories).toEqual(['glasses', 'hat']); expect(merged.hair).toEqual({ custom: 'curl', color: 'black' });
  });
  test('PDF includes all sections and escapes user text and unsafe image URLs', () => {
    const html = bookHtml({ title: '<script>alert(1)</script>', sections: [{ title: 'A', content: 'Erste\n\nZweite', imageUrl: 'javascript:alert(1)' }, { title: 'B', content: 'Letzte' }] });
    expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('<script>'); expect(html).not.toContain('javascript:'); expect(html).toContain('Letzte'); expect(html.match(/<section>/g)).toHaveLength(2);
  });
  test('treasury uses set artifacts and deduplicates loose entries', () => {
    const artifact = { id: 'a', name: 'Kompass', owned: true };
    const overview = { sets: [{ artifacts: [artifact] }], unsortedArtifacts: [artifact, { id: 'b', name: 'Krone', owned: false }] } as unknown as TreasuryOverview;
    expect(treasuryArtifacts(overview).map((item) => item.id)).toEqual(['a', 'b']); expect(treasuryArtifacts()).toEqual([]);
  });
});
