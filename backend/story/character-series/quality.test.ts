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
const publicationReview = (fields: Record<string, unknown> = {}) => review({
  reviewVersion: 2, recognizableById: { dragon: true, 'child-a': true }, anatomyOkById: { dragon: true, 'child-a': true },
  visibleHandsById: { dragon: ['left paw on rope', 'right paw raised'], 'child-a': ['left hand raised', 'right hand holding cup'] },
  sceneCompatible: true, storyConsistent: true, materialContradiction: false, ...fields,
});

describe('publication review: recognisable figures before precise staging', () => {
  test('a role swap stays printable even when diagnostic identity and scene scores are low', () => {
    const qa = readSeriesQa(publicationReview({
      identityById: { dragon: 0.72, 'child-a': 0.55 }, sceneMatch: 0.45, styleMatch: 0.65,
      primaryActionClear: false, storyConsistent: false, materialContradiction: true,
      defects: [{ kind: 'story', detail: 'The two characters swapped who turns the crank.', fix: 'Swap their actions.', blocksAction: true, blocking: false }],
    }), cast);
    expect(seriesPicturePasses(qa)).toBe(false);
    expect(seriesPictureUsable(qa)).toBe(true);
    expect(seriesPictureLastResort(qa)).toBe(true);
    expect(qa?.sceneFixes).toEqual([]);
    expect(qa?.criticalSceneDefects).toEqual([]);
  });
  test('a second brush, paint dot, pose or small style difference does not buy another image', () => {
    for (const kind of ['unexpected', 'detail', 'composition', 'style', 'text']) {
      const qa = readSeriesQa(publicationReview({
        posing: true, primaryActionClear: false,
        defects: [{ kind, detail: 'A minor nonblocking variation.', fix: 'Optional cosmetic adjustment.', blocking: false }],
      }), cast);
      expect(seriesPictureUsable(qa)).toBe(true);
      expect(seriesPictureLastResort(qa)).toBe(true);
      expect(qa?.sceneFixes).toEqual([]);
    }
  });
  test('a lower numeric score alone is not a second hidden gate after explicit recognition', () => {
    expect(seriesPicturePasses(readSeriesQa(publicationReview({
      identityById: { dragon: 0.7, 'child-a': 0.68 }, sceneMatch: 0.6, styleMatch: 0.64,
    }), cast))).toBe(true);
  });
  test('false recognition or anatomy on one individual cannot be averaged away', () => {
    for (const field of ['recognizableById', 'anatomyOkById']) {
      const qa = readSeriesQa(publicationReview({ [field]: { dragon: true, 'child-a': false } }), cast);
      expect(seriesPicturePasses(qa)).toBe(false);
      expect(seriesPictureUsable(qa)).toBe(false);
      expect(seriesPictureLastResort(qa, true)).toBe(false);
    }
  });
  test('three separately observed human hands override an optimistic anatomy flag', () => {
    const qa = readSeriesQa(publicationReview({ visibleHandsById: {
      dragon: ['one paw on the rope'], 'child-a': ['hand on left of card', 'hand on right of card', 'third hand pointing'],
    } }), cast);
    expect(qa?.anatomyOkById?.['child-a']).toBe(false);
    expect(seriesPictureUsable(qa)).toBe(false);
    expect(qa?.anatomyDefects).toContain('Nora has 3 separately visible hands.');
    const cropped = readSeriesQa(publicationReview({ visibleHandsById: { dragon: [], 'child-a': [] } }), cast);
    expect(seriesPicturePasses(cropped)).toBe(true);
  });
  test('anatomy, safety and actual identity faults stay blocking even with contradictory optimistic booleans', () => {
    for (const [kind, detail] of [
      ['anatomy', 'Mina has two hands on a card plus a third pointing hand.'],
      ['anatomy', 'An extra arm emerges behind the jacket.'],
      ['identity', 'The blond child has another character’s dark hair and face.'],
      ['safety', 'A child has an unsafe mouth-held smoking object.'],
    ]) {
      const qa = readSeriesQa(publicationReview({ defects: [{ kind, detail, fix: 'Repair the visible fault.', blocking: false }] }), cast);
      expect(seriesPictureUsable(qa)).toBe(false);
      expect(seriesPictureLastResort(qa, true)).toBe(false);
      expect(qa?.sceneFixes).toEqual(['Repair the visible fault.']);
    }
  });
  test('a hard defect cannot disappear after six cosmetic observations', () => {
    const cosmetic = { kind: 'detail', detail: 'A tiny paint dot.', fix: 'Optional paint adjustment.', blocking: false };
    const qa = readSeriesQa(publicationReview({ defects: [
      ...Array.from({ length: 6 }, () => cosmetic),
      { kind: 'anatomy', detail: 'A third hand emerges behind the jacket.', fix: 'Remove the third hand.', blocking: true },
    ] }), cast);
    expect(seriesPictureUsable(qa)).toBe(false);
    expect(qa?.anatomyDefects).toContain('A third hand emerges behind the jacket.');
    expect(readSeriesQa(publicationReview({ defects: Array.from({ length: 13 }, () => cosmetic) }), cast)).toBeUndefined();
  });
  test('an unrelated scene, prominent text, reference panels or an extra main figure stay out', () => {
    expect(seriesPictureUsable(readSeriesQa(publicationReview({ sceneCompatible: false }), cast))).toBe(false);
    for (const kind of ['text', 'composition', 'unexpected', 'story']) {
      const qa = readSeriesQa(publicationReview({ defects: [{ kind, detail: 'A real publication blocker.', fix: 'Repair the blocker.', blocking: true }] }), cast);
      expect(seriesPictureUsable(qa)).toBe(false);
    }
    for (const visibleIds of [['dragon'], ['dragon', 'child-a', 'another-person'], ['dragon', 'child-a', 'child-a']]) {
      expect(seriesPictureUsable(readSeriesQa(publicationReview({ visibleIds }), cast))).toBe(false);
    }
  });
  test('v2 requires explicit checks for every figure and valid defect classification', () => {
    for (const field of ['recognizableById', 'anatomyOkById', 'visibleHandsById', 'sceneCompatible']) {
      expect(readSeriesQa(publicationReview({ [field]: undefined }), cast)).toBeUndefined();
    }
    expect(readSeriesQa(publicationReview({ recognizableById: { dragon: true } }), cast)).toBeUndefined();
    expect(readSeriesQa(publicationReview({ anatomyOkById: { dragon: true, 'child-a': 'true' } }), cast)).toBeUndefined();
    expect(readSeriesQa(publicationReview({ visibleHandsById: { dragon: [], 'child-a': 'two hands' } }), cast)).toBeUndefined();
    expect(readSeriesQa(publicationReview({ defects: [{ kind: 'story', detail: 'A swapped action.', fix: 'Swap it.' }] }), cast)).toBeUndefined();
    expect(readSeriesQa(publicationReview({ reviewVersion: 3 }), cast)).toBeUndefined();
  });
  test('recognition and anatomy aliases resolve in the same slot order as visual scores', () => {
    const qa = readSeriesQa(publicationReview({
      recognizableById: { Funkelflug: true, 'slot 2': true }, anatomyOkById: { seriesfigure1: true, Nora: true },
    }), cast);
    expect(seriesPicturePasses(qa)).toBe(true);
    expect(qa?.recognizableById).toEqual({ dragon: true, 'child-a': true });
  });
});

describe('series image review after the production PDF', () => {
  test('a checked loose still stays visible, but an explicit material contradiction never does', () => {
    const fields = { primaryActionClear: false, sceneMatch: 0.6, storyConsistent: false, materialContradiction: false,
      defects: [{ kind: 'story', detail: 'The sign is held rather than visibly sliding.', fix: 'Tilt the sign.', blocksAction: false }] };
    const loose = readSeriesQa(review(fields), cast);
    expect(seriesPicturePasses(loose)).toBe(false);
    expect(seriesPictureUsable(loose)).toBe(true);
    expect(seriesPictureLastResort(loose)).toBe(true);
    const contradiction = readSeriesQa(review({ ...fields, materialContradiction: true, sceneMatch: 0.95, primaryActionClear: true, storyConsistent: true }), cast);
    expect(seriesPicturePasses(contradiction, true)).toBe(false);
    expect(seriesPictureUsable(contradiction)).toBe(false);
    expect(seriesPictureLastResort(contradiction, true)).toBe(false);
    for (const kind of ['anatomy', 'identity', 'safety', 'unexpected', 'text']) {
      const broken = readSeriesQa(review({ ...fields, defects: [{ kind, detail: 'Concrete visible defect.', fix: 'Repair the visible defect.' }] }), cast);
      expect(seriesPictureUsable(broken)).toBe(false);
      expect(seriesPictureLastResort(broken)).toBe(false);
    }
    expect(readSeriesQa(review({ materialContradiction: 'false' }), cast)).toBeUndefined();
  });
  test('unexplained style scores do not drop a sound image; a visible style fault still blocks', () => {
    expect(seriesPicturePasses(readSeriesQa(review({ styleMatch: 0.74 }), cast))).toBe(true);
    expect(seriesPicturePasses(readSeriesQa(review({ styleMatch: 0.74, defects: [{ kind: 'style', detail: 'Photorealistic rendering.', fix: 'Use hand-drawn illustration.' }] }), cast))).toBe(false);
    expect(seriesPictureLastResort(readSeriesQa(review({ styleMatch: 0.5 }), cast))).toBe(false);
  });
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
      const hard = readSeriesQa(review({ storyConsistent: true, defects: [{ ...detail, detail: 'A concrete visible fault.', kind }] }), cast);
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
  test('a missing tooth gap is a detail, a different person is still an identity fault (289c11a4)', () => {
    const gap = readSeriesQa(review({ storyConsistent: true, identityById: { dragon: 0.98, 'child-a': 0.78 }, sceneMatch: 0.9, defects: [{ kind: 'identity', detail: 'Nora lacks her prominent front tooth gap, showing fully formed small teeth instead.', fix: 'Render a gap between her front teeth.' }] }), cast)!;
    expect(gap.defects[0].kind).toBe('detail');
    // Printed as a noted flaw instead of failing the picture.
    expect(seriesPictureUsable(gap)).toBe(true);
    const other = readSeriesQa(review({ identityById: { dragon: 0.98, 'child-a': 0.78 }, defects: [{ kind: 'identity', detail: 'A different girl with other teeth replaces Nora.', fix: 'Show Nora.' }] }), cast)!;
    expect(other.defects[0].kind).toBe('identity');
    expect(seriesPicturePasses(other)).toBe(false);
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
