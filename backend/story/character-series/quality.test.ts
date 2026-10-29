// @ts-ignore Bun test helpers are runtime-only in Encore.
import { describe, test, expect } from 'bun:test';
import { readSeriesQa, seriesPictureLastResort, seriesPicturePasses, seriesPictureSource, seriesPictureUsable } from './quality';
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
    expect(seriesPicturePasses(readSeriesQa(review({ defects: variation, storyConsistent: true }), cast))).toBe(true);
    expect(seriesPicturePasses(readSeriesQa(review({ defects: variation, primaryActionClear: false }), cast))).toBe(false);
    expect(seriesPicturePasses(readSeriesQa(review({ defects: [{ kind: 'safety', detail: 'The child is underneath an unsupported loaded board.', fix: 'Keep the child beside the supported board.' }] }), cast))).toBe(false);
  });
  test('an explicit story contradiction cannot pass on an optimistic action flag alone', () => {
    const contradiction = [{ kind: 'story', detail: 'The berries hit the child’s bare hair instead of his hat.', fix: 'Show the berries landing on the hat.', blocksAction: true }];
    const qa = readSeriesQa(review({ defects: contradiction, storyConsistent: false, primaryActionClear: true }), cast);
    expect(seriesPicturePasses(qa)).toBe(false);
    expect(seriesPictureUsable(qa)).toBe(false);
    expect(seriesPicturePasses(qa, true)).toBe(true); // The cover establishes the cast and world, not a specific instant.
    const minor = [{ kind: 'story', detail: 'Tilda holds a wrench instead of a button, while the crown lands.', fix: 'Show the small button.', blocksAction: false }];
    expect(seriesPicturePasses(readSeriesQa(review({ defects: minor, storyConsistent: false, primaryActionClear: true }), cast))).toBe(true);
  });
  test('small unobservable features are retained as a noted flaw, while identity and anatomy defects block', () => {
    const detail = { kind: 'detail', detail: 'The small tooth gap is not visible from this angle.', fix: 'Keep the character recognisable.' };
    const qa = readSeriesQa(review({ storyConsistent: true, defects: [detail] }), cast);
    expect(seriesPicturePasses(qa)).toBe(false);
    expect(seriesPictureUsable(qa)).toBe(true);
    expect(seriesPictureLastResort(qa)).toBe(true);
    for (const kind of ['identity', 'anatomy', 'unexpected', 'safety']) {
      const hard = readSeriesQa(review({ storyConsistent: true, defects: [{ ...detail, kind }] }), cast);
      expect(seriesPictureUsable(hard)).toBe(false);
      expect(seriesPictureLastResort(hard)).toBe(false);
    }
    expect(seriesPictureUsable(readSeriesQa(review({ storyConsistent: false, defects: [detail] }), cast))).toBe(false);
    expect(seriesPictureUsable(readSeriesQa(review({ storyConsistent: true, identityById: { dragon: 0.98, 'child-a': 0.7 }, defects: [detail] }), cast))).toBe(false);
  });
  test('cover does not require the chapter action but still rejects safety and identity faults', () => {
    const qa = readSeriesQa(review({ primaryActionClear: false, storyConsistent: true, defects: [{ kind: 'story', detail: 'The cart action is absent from the cover.', fix: 'Keep the cover composition.', blocksAction: true }] }), cast);
    expect(seriesPicturePasses(qa, true)).toBe(true);
    expect(seriesPicturePasses(qa, false)).toBe(false);
    expect(seriesPicturePasses(readSeriesQa(review({ primaryActionClear: false, defects: [{ kind: 'identity', detail: 'The girl is replaced by another person.', fix: 'Show the correct girl.' }] }), cast), true)).toBe(false);
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
    const second = seriesAvatarAppearance({ name: 'Ben', visualProfile: { face: { shape: 'round', mouth: 'wide front tooth gap' }, hair: { color: 'blonde', length: 'short', style: 'short' }, skin: { tone: 'very light skin' } } });
    expect(first).toContain('distinct protruding ears');
    expect(first).not.toContain('tooth gap');
    expect(second).toContain('wide front tooth gap');
    expect(second).toContain('round face');
    expect(second).not.toContain('short short');
    expect(second).not.toContain('skin skin');
    expect(second).not.toContain('protruding ears');
  });
  test('vision QA resolves character names and slot aliases instead of dropping valid cover reviews', () => {
    const qa = readSeriesQa(review({
      visibleIds: ['Funkelflug', 'slot 2'],
      identityById: { Funkelflug: 0.96, seriesfigure2: 0.94 },
    }), cast);
    expect(qa).toBeDefined();
    expect(seriesPicturePasses(qa)).toBe(true);
    expect(qa?.identityMatch).toBe(0.94);
  });
  test('storyConsistent separates a neighbouring instant of the scene from a contradicted story', () => {
    // Story ff6eff04, chapter 3: the three turn the crate together instead of the selected landing on the coat.
    const neighbour = { primaryActionClear: false, sceneMatch: 0.55, defects: [{ kind: 'story', detail: 'The crate is held upright; the landing on the coat is absent.', fix: 'Show the crate landing on the coat.' }] };
    const loose = readSeriesQa(review({ ...neighbour, storyConsistent: true }), cast);
    expect(seriesPicturePasses(loose)).toBe(false);
    expect(seriesPictureUsable(loose)).toBe(true);
    expect(seriesPictureUsable(readSeriesQa(review({ ...neighbour, storyConsistent: false }), cast))).toBe(false);
    expect(seriesPictureUsable(readSeriesQa(review(neighbour), cast))).toBe(false);
    expect(seriesPictureUsable(readSeriesQa(review({ ...neighbour, storyConsistent: true, defects: [{ kind: 'anatomy', detail: 'The child has a third hand.', fix: 'Give the child two hands.' }] }), cast))).toBe(false);
    expect(seriesPictureUsable(readSeriesQa(review({ ...neighbour, storyConsistent: true, posing: true }), cast))).toBe(false);
    // A posed picture fills only a chapter that would otherwise have none.
    expect(seriesPictureLastResort(readSeriesQa(review({ ...neighbour, sceneMatch: 0.9, storyConsistent: true, posing: true }), cast), true)).toBe(true);
    expect(seriesPictureLastResort(readSeriesQa(review({ ...neighbour, sceneMatch: 0.9, storyConsistent: true, posing: true }), cast))).toBe(false);
    expect(seriesPictureLastResort(readSeriesQa(review({ ...neighbour, storyConsistent: false, posing: true }), cast), true)).toBe(false);
    expect(seriesPictureLastResort(readSeriesQa(review({ ...neighbour, storyConsistent: true, defects: [{ kind: 'identity', detail: 'The dragon is doubled.', fix: 'Keep one dragon.' }] }), cast))).toBe(false);
    expect(seriesPictureUsable(readSeriesQa(review({ ...neighbour, storyConsistent: true, identityById: { dragon: 0.98, 'child-a': 0.7 } }), cast))).toBe(false);
  });
  test('an unexplained low identity score keeps recognisable figures; a named identity defect still blocks (e83e44e2)', () => {
    // Gemini scored the flag picture 0.97/0.96 and, a run later, 0.82/0.78 without naming any defect.
    expect(seriesPicturePasses(readSeriesQa(review({ identityById: { dragon: 0.82, 'child-a': 0.78 }, sceneMatch: 0.75 }), cast))).toBe(true);
    const elfEars = readSeriesQa(review({ identityById: { dragon: 0.98, 'child-a': 0.78 }, defects: [{ kind: 'identity', detail: 'Nora has huge pointed elf ears.', fix: 'Give Nora her own rounded ears.' }] }), cast);
    expect(seriesPicturePasses(elfEars)).toBe(false);
    expect(seriesPictureLastResort(elfEars)).toBe(false);
  });
  test('after the last redraw a loose action is printed instead of a hole; a wrong setting, a missing hand or lettering is not', () => {
    const loose = { primaryActionClear: false, storyConsistent: false, sceneMatch: 0.68, defects: [{ kind: 'story', detail: 'Tilda runs forward instead of tripping backward behind the cart.', fix: 'Show her pulled backward by the apron.', blocksAction: true }] };
    expect(seriesPictureUsable(readSeriesQa(review(loose), cast))).toBe(false);
    expect(seriesPictureLastResort(readSeriesQa(review(loose), cast))).toBe(true);
    expect(seriesPictureLastResort(readSeriesQa(review({ ...loose, sceneMatch: 0.5 }), cast))).toBe(false);
    expect(seriesPictureLastResort(readSeriesQa(review({ ...loose, defects: [...loose.defects, { kind: 'anatomy', detail: 'The left arm ends in a stump without a hand.', fix: 'Draw the left hand.' }] }), cast))).toBe(false);
    expect(seriesPictureLastResort(readSeriesQa(review({ ...loose, defects: [{ kind: 'text', detail: 'The sign carries garbled letters.', fix: 'Leave the sign plain.' }] }), cast))).toBe(false);
  });
});
