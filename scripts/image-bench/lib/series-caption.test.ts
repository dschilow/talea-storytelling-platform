// @ts-ignore Bun test helpers are runtime-only in the Encore project.
import { describe, expect, test } from 'bun:test';
import { seriesSceneCaption } from './series-caption';
import { TALEA_IMAGE_STYLE } from '../../../backend/ai/image-style';
import type { VisualEntity } from '../../../backend/story/storybook/illustration-stage';
import type { RunwareReferenceRegion } from '../../../backend/ai/runware-image-model-options';

const figures: VisualEntity[] = [
  { id: 'girl', name: 'Tilda Tüftel', kind: 'character', role: 'cast', species: 'human', isHuman: true, appearance: 'nine-year-old girl, curly dark hair, round goggles, yellow overalls', forbidden: [] },
  { id: 'boy', name: 'Niko', kind: 'character', role: 'hero', species: 'human', isHuman: true, appearance: 'young boy, short blond hair, blue shirt', forbidden: [] },
];
const regions: RunwareReferenceRegion[] = figures.map((e, index) => ({
  id: `figure${index + 1}`, description: e.name, referenceIndex: 0,
  sourceBox: [0, index * 500, 1000, (index + 1) * 500], targetBox: [200, index * 500 + 20, 900, (index + 1) * 500 - 20],
}));
const shot = {
  page: 1, onStage: ['girl', 'boy'], scene: 'Inside the sunlit workshop, Tilda turns a crank while Niko catches the falling blue cup.',
  visualBeat: { actorId: 'boy', action: 'catches the blue cup', result: 'the cup rests between his hands', framing: 'medium' as const },
};

describe('FLUX 3 scene captions', () => {
  test('starts with the medium, keeps the scene and binds its actors once', () => {
    const caption = seriesSceneCaption({ shot, identities: figures, regions });
    expect(caption.prompt).toStartWith(`Create a new scene. ${TALEA_IMAGE_STYLE}.`);
    expect(caption.prompt).toContain('Inside the sunlit workshop, <figure1> turns a crank while <figure2> catches the falling blue cup.');
    expect(caption.prompt).toContain('<figure1> is Tilda Tüftel');
    expect(caption.prompt).toContain('<figure2> is Niko');
    expect(caption.prompt).toContain('Exactly 2 named characters');
    expect(caption.prompt).not.toContain('five fingers');
    expect(caption.prompt).not.toContain('sea, ships');
  });

  test('describes each native region without changing its identity, source or target geometry', () => {
    const caption = seriesSceneCaption({ shot, identities: figures, regions });
    expect(caption.regions[0]).toMatchObject({ ...regions[0], description: `Tilda Tüftel: ${figures[0].appearance}.` });
    expect(caption.regions[1].description).toContain('In this scene, catches the blue cup.');
    expect(regions[1].description).toBe('Niko');
    expect(caption.prompt).toContain('figure 1 from the left in image 1');
    expect(caption.prompt).toContain('figure 2 from the left in image 1');
  });

  test('individual references use their real attachment order instead of sheet-cell language', () => {
    const caption = seriesSceneCaption({ shot, identities: figures, regions, individualReferences: true });
    expect(caption.prompt).toContain('same individual as image 1');
    expect(caption.prompt).toContain('same individual as image 2');
    expect(caption.prompt).not.toContain('from the left');
  });
  test('the unbound control keeps the scene and reference roles but emits no native tokens or boxes', () => {
    const caption = seriesSceneCaption({ shot, identities: figures, regions, regionBound: false });
    expect(caption.prompt).toContain(shot.scene);
    expect(caption.prompt).toContain('Tilda Tüftel, the same individual as figure 1 from the left in image 1');
    expect(caption.prompt).not.toContain('<figure');
    expect(caption.regions).toEqual([]);
  });

  test('retains a complete long scene and does not substitute partial names', () => {
    const scene = 'Nikolai waves to Niko. ' + 'A blue curtain frames the workshop window. '.repeat(45) + 'Tüftel raises the cup.';
    const caption = seriesSceneCaption({ shot: { ...shot, scene }, identities: figures, regions });
    expect(caption.prompt).toContain('Nikolai waves to <figure2>.');
    expect(caption.prompt).toContain('A blue curtain frames the workshop window. '.repeat(45));
    expect(caption.prompt).toContain('<figure1> raises the cup.');
  });

  test('ambiguous first names stay unbound and writing negations use the shared cleaner', () => {
    const twins = [{ ...figures[0], name: 'Niko Nord' }, { ...figures[1], name: 'Niko West' }];
    const caption = seriesSceneCaption({ shot: { ...shot, scene: 'Niko Nord catches a cup. Niko West smiles. Niko nods, with no lettering.' }, identities: twins, regions });
    expect(caption.prompt).toContain('<figure1> catches a cup. <figure2> smiles. Niko nods.');
    expect(caption.prompt).not.toContain('lettering');
  });

  test('incomplete reference bindings fail before a paid image request', () => {
    expect(() => seriesSceneCaption({ shot, identities: figures, regions: regions.slice(0, 1) })).toThrow('Referenzregion');
  });
});
