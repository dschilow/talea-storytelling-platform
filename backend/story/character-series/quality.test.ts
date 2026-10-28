// @ts-ignore Bun test helpers are runtime-only in Encore.
import { describe, test, expect } from 'bun:test';
import { readSeriesQa, seriesPicturePasses, seriesPictureSource } from './quality';
import { seriesAvatarAppearance } from './identity';
import type { VisualEntity } from '../storybook/illustration-stage';

const cast: VisualEntity[] = [
  { id: 'dragon', name: 'Funkelflug', kind: 'character', role: 'cast', species: 'dragon', isHuman: false, appearance: 'golden dragon, no clothes', forbidden: [] },
  { id: 'child-a', name: 'Nora', kind: 'character', role: 'hero', species: 'human', isHuman: true, appearance: 'girl with red glasses', forbidden: [] },
];
const review = (fields: Record<string, unknown> = {}) => JSON.stringify({ visibleIds: ['dragon', 'child-a'], identityById: { dragon: 0.98, 'child-a': 0.98 }, posing: false, primaryActionClear: true, sceneMatch: 0.95, styleMatch: 0.9, defects: [], ...fields });

describe('series image review after the production PDF', () => {
  test('correct identities in a passive lineup still do not illustrate the physical event', () => {
    expect(seriesPicturePasses(readSeriesQa(review({ posing: true }), cast))).toBe(false);
    expect(readSeriesQa(review({ posing: undefined }), cast)).toBeUndefined();
  });
  test('recognised real trousers added by a wreath metaphor reject an otherwise clear scene', () => {
    const qa = readSeriesQa(review({ defects: [{ kind: 'identity', detail: 'The bare dragon wears actual trousers beneath the wreath.', fix: 'Keep only the flower wreath around the bare scaled belly.' }] }), cast);
    expect(seriesPicturePasses(qa)).toBe(false);
    expect(qa?.criticalSceneDefects).toContain('The bare dragon wears actual trousers beneath the wreath.');
  });
  test('an unrequested stick and smoke at a child mouth cannot be accepted as a whistling gesture', () => {
    const qa = readSeriesQa(review({ defects: [{ kind: 'unexpected', detail: 'The child has a cigarette-like stick with smoke at the mouth.', fix: 'Show the empty mouth and open hands while the child speaks.' }] }), cast);
    expect(seriesPicturePasses(qa)).toBe(false);
  });
  test('a good dragon match cannot average away a generic replacement child', () => {
    const qa = readSeriesQa(review({ identityById: { dragon: 0.99, 'child-a': 0.65 } }), cast);
    expect(qa?.identityMatch).toBe(0.65);
    expect(seriesPicturePasses(qa)).toBe(false);
  });
  test('each expected identity needs a score and actual presence', () => {
    expect(readSeriesQa(review({ identityById: { dragon: 1 } }), cast)).toBeUndefined();
    expect(seriesPicturePasses(readSeriesQa(review({ visibleIds: ['dragon', 'another-child'] }), cast))).toBe(false);
  });
  test('unreadable reviews and invalid confidence scores never publish', () => {
    expect(readSeriesQa('{}', cast)).toBeUndefined();
    expect(readSeriesQa(review({ styleMatch: 1.1 }), cast)).toBeUndefined();
    expect(seriesPicturePasses(readSeriesQa(review(), cast))).toBe(true);
  });
  test('caption ownership errors are material even when the generated picture follows the wrong caption', () => {
    const qa = readSeriesQa(review({ defects: [{ kind: 'identity', detail: 'The caption assigns the other child\'s whistling to the visible child.', fix: 'The visible child introduces herself with empty hands and mouth.' }] }), cast);
    expect(seriesPicturePasses(qa)).toBe(false);
  });
  test('minor staging does not blank a recognisable active illustration; lost action and unsafe support still do', () => {
    const variation = [{ kind: 'story', detail: 'The tiny map marks differ from the source wording.', fix: 'Keep the prop marks pictorial.' }];
    expect(seriesPicturePasses(readSeriesQa(review({ defects: variation }), cast))).toBe(true);
    expect(seriesPicturePasses(readSeriesQa(review({ defects: variation, primaryActionClear: false }), cast))).toBe(false);
    expect(seriesPicturePasses(readSeriesQa(review({ defects: [{ kind: 'safety', detail: 'The child is underneath an unsupported loaded board.', fix: 'Keep the child beside the supported board.' }] }), cast))).toBe(false);
  });
  test('literal nearby evidence replaces an entire repeated chapter in the picture prompt', () => {
    const text = ['first', 'The mouse turns the handle.', 'The door opens.', 'They wave.', ...Array(80).fill('Unrelated later event.')].join('\n\n');
    const source = seriesPictureSource(text, 2, 'The mouse turns the handle.');
    expect(source).toContain('The door opens.');
    expect(source.length).toBeLessThan(text.length);
    expect(source.length).toBeLessThan(2500);
  });
  test('facial invariants stay with their own avatar rather than generic colour descriptions', () => {
    const first = seriesAvatarAppearance({ name: 'Nora', visualProfile: { face: { otherFeatures: ['distinct protruding ears'] }, mustIncludeFeatures: [{ priority: 1, promptDescription: 'distinct protruding ears' }] } });
    const second = seriesAvatarAppearance({ name: 'Ben', visualProfile: { face: { mouth: 'wide front tooth gap' } } });
    expect(first).toContain('distinct protruding ears');
    expect(first).not.toContain('tooth gap');
    expect(second).toContain('wide front tooth gap');
    expect(second).not.toContain('protruding ears');
  });
});
