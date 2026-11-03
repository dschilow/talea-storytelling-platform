// @ts-ignore Bun test helpers are runtime-only in the Encore project.
import { describe, expect, test } from 'bun:test';
import { generateSeriesImages, seriesObjectSize, seriesPaintableMoment, seriesPropPlacement, validateSeriesShots, withoutAbsentThings } from './pictures';
import type { VisualEntity } from '../storybook/illustration-stage';
import type { IllustrationShot } from '../storybook/types';
import type { IdentitySpriteSlot } from '../image-reference-sprite';
import { seriesObjectReferencePrompt } from './visual-references';

// The cast and captions of story 9a84d5e0 ("Die Aufräummaschine hat Hunger", 2026-11-03).
const tilda: VisualEntity = { id: 'tilda', name: 'Tilda Tüftel', kind: 'character', role: 'cast', species: 'human', isHuman: true, appearance: 'girl inventor', forbidden: [], referenceUrl: 'https://example.test/tilda.webp' };
const alexander: VisualEntity = { id: 'alex', name: 'Alexander', kind: 'character', role: 'hero', species: 'human', isHuman: true, appearance: 'boy', forbidden: [], referenceUrl: 'https://example.test/alex.webp' };
const adrian: VisualEntity = { id: 'adrian', name: 'Adrian', kind: 'character', role: 'hero', species: 'human', isHuman: true, appearance: 'boy', forbidden: [], referenceUrl: 'https://example.test/adrian.webp' };
const teddy: VisualEntity = { id: 'teddy', name: 'Teddy', kind: 'artifact', role: 'cast', species: 'teddy bear', isHuman: false, appearance: 'Soft teddy bear with a green ribbon around its neck.', forbidden: [], referenceUrl: 'https://example.test/teddy.jpg', referenceAliases: ['teddy bear'] } as VisualEntity;
const shot = (scene: string, actorId: string, action: string, onStage: string[]): IllustrationShot =>
  ({ page: 5, scene, onStage, elements: ['teddy'], artifactVisible: true, visualBeat: { actorId, action, result: 'x', framing: 'medium' } } as unknown as IllustrationShot);

describe('where a referenced object is in the picture (story 9a84d5e0)', () => {
  test('a held object belongs to its holder: the beat decides, then the caption', () => {
    const page5 = shot('Beside the open collection box, Alexander gently presses the freed Teddy against himself, careful to keep away from its loose seam. Tilda stands close by after lifting a sock clear of the bear.', 'alex', 'presses Teddy gently against himself', ['tilda', 'alex']);
    expect(seriesPropPlacement(page5, [tilda, alexander], [teddy]).carriedBy.get('teddy')).toBe('alex');
    const page1 = shot('At the open workshop doorway, Alexander holds Teddy up while Adrian points to its loose thread.', 'adrian', 'points to the loose thread', ['tilda', 'alex', 'adrian']);
    expect(seriesPropPlacement(page1, [tilda, alexander, adrian], [teddy]).carriedBy.get('teddy')).toBe('alex');
    const page6 = shot('At the worktable, Alexander carefully gives Teddy a firm test squeeze while Tilda sits beside him.', 'alex', 'squeezes Teddy for a test', ['tilda', 'alex']);
    expect(seriesPropPlacement(page6, [tilda, alexander], [teddy]).carriedBy.get('teddy')).toBe('alex');
  });
  test('"lifting a sock clear of the bear" is no hold of the bear; a hidden object and a resting one are not carried', () => {
    const sock = shot('Tilda stands close by after lifting a sock clear of the bear.', 'tilda', 'stands close by', ['tilda', 'alex']);
    expect(seriesPropPlacement(sock, [tilda, alexander], [teddy]).carriedBy.size).toBe(0);
    const page4 = shot('At the collection box inside the workshop, Tilda bends toward the narrow space behind its painted front wall. Teddy’s green ribbon glimmers beneath a corner of cloth, and Alexander stands very still beside her.', 'tilda', 'bends toward the collection box', ['tilda', 'alex']);
    const hidden = seriesPropPlacement(page4, [tilda, alexander], [teddy]);
    expect(hidden.carriedBy.size).toBe(0);
    expect(hidden.hidden.has('teddy')).toBe(true);
    const cover = shot('Inside the workshop, Tilda presses the pedal as a slipper glides neatly into the collection box. Teddy rests safely on the low bench.', 'tilda', 'steps on the pedal', ['tilda', 'alex', 'adrian']);
    const resting = seriesPropPlacement(cover, [tilda, alexander, adrian], [teddy]);
    expect(resting.carriedBy.size).toBe(0);
    expect(resting.hidden.size).toBe(0);
  });

  test('any other object works the same; a machine is never carried, and a verb that moves the figure holds nothing', () => {
    const object = (id: string, name: string, appearance: string, aliases: string[] = []) =>
      ({ id, name, kind: 'artifact', role: 'cast', species: 'object', isHuman: false, appearance, forbidden: [], referenceUrl: `https://example.test/${id}.jpg`, referenceAliases: aliases } as VisualEntity);
    const lantern = object('lantern', 'Laterne', 'A round tin lantern with a blue glass window.', ['lantern', 'blue lantern']);
    const clamp = object('clamp', 'Lieblingsklammer', 'A small red wooden clamp.', ['clamp', 'red clamp']);
    const machine = object('machine', 'Aufräummaschine', 'A floor-level tidying machine with a pedal, a broom and a collection box.', ['tidying machine', 'machine']);
    const carts = object('cart', 'Handwagen', 'A wooden hand cart with red wheels.', ['cart', 'hand cart']);
    const scene = (text: string, actorId = 'adrian', action = 'walks') => shot(text, actorId, action, ['tilda', 'alex', 'adrian']);
    const cast = [tilda, alexander, adrian];
    expect(seriesPropPlacement(scene('In the dark shed, Adrian carries the blue lantern while Tilda and Alexander follow him.', 'adrian', 'carries the blue lantern'), cast, [lantern]).carriedBy.get('lantern')).toBe('adrian');
    expect(seriesPropPlacement(scene('At the bench Alexander holds the red clamp up to the light.', 'alex', 'holds the red clamp up'), cast, [clamp]).carriedBy.get('clamp')).toBe('alex');
    // "presses the machine's pedal" holds the pedal, not the machine; a pushed cart stays its own thing.
    expect(seriesPropPlacement(scene('Tilda presses the machine’s pedal with her foot.', 'tilda', 'presses the pedal'), cast, [machine]).carriedBy.size).toBe(0);
    expect(seriesPropPlacement(scene('Tilda lifts the tidying machine onto the bench.', 'tilda', 'lifts the tidying machine'), cast, [machine]).carriedBy.size).toBe(0);
    expect(seriesPropPlacement(scene('Alexander squeezes past the cart in the lane.', 'alex', 'squeezes past the cart'), cast, [carts]).carriedBy.size).toBe(0);
    expect(seriesPropPlacement(scene('Alexander squeezes past the blue lantern on the shelf.', 'alex', 'squeezes past the lantern'), cast, [lantern]).carriedBy.size).toBe(0);
    expect([seriesObjectSize(clamp), seriesObjectSize(lantern), seriesObjectSize(teddy), seriesObjectSize(machine), seriesObjectSize(carts)]).toEqual(['small', 'held', 'held', 'large', 'large']);
  });

  test('in the picture loop the held teddy rides in Alexander\'s cell, a hidden one gets none, a resting one keeps its own', async () => {
    const pages = [1, 2, 3].map(order => ({ order, title: 'Kapitel', content: 'Ein Absatz.\n\nAlexander drückte den Teddy an sich.\n\nDas Ende.', paragraphs: [] }));
    const beat = (actorId: string, action: string) => ({ actorId, action, result: 'the teddy is safe again', framing: 'medium' });
    const plan = validateSeriesShots({
      cover: { onStage: ['tilda', 'alex'], elements: ['teddy'], visualBeat: beat('tilda', 'waves at the workshop door'), scene: 'Inside the workshop Tilda waves at the door while Alexander stands beside the bench; Teddy rests on the low bench.' },
      pages: [
        { page: 1, paragraph: 2, storyQuote: 'Alexander drückte den Teddy an sich.', onStage: ['tilda', 'alex'], elements: ['teddy'], visualBeat: beat('alex', 'presses Teddy gently against himself'), scene: 'Beside the open box, Alexander gently presses the freed Teddy against himself while Tilda watches closely.' },
        { page: 2, paragraph: 2, storyQuote: 'Alexander drückte den Teddy an sich.', onStage: ['tilda', 'alex'], elements: ['teddy'], visualBeat: beat('tilda', 'bends toward the collection box'), scene: 'Tilda bends toward the collection box; Teddy’s green ribbon glimmers beneath a corner of cloth while Alexander waits.' },
        { page: 3, paragraph: 2, storyQuote: 'Alexander drückte den Teddy an sich.', onStage: ['tilda', 'alex', 'adrian'], elements: [], visualBeat: beat('adrian', 'points to the loose thread'), scene: 'At the doorway Alexander holds Teddy up while Adrian points to its loose thread and Tilda nods toward the bear.' },
      ],
    }, pages, [tilda, alexander, adrian, teddy], 'tilda');
    // One picture at a time: the sheets arrive in the order cover, page 1, 2, 3.
    const sheets: IdentitySpriteSlot[][] = [];
    const prompts = new Map<number, string>();
    await generateSeriesImages({
      illustrations: plan, entities: [tilda, alexander, adrian, teddy], seed: 'held', visionModel: 'test', pageTexts: {},
      buildReference: async (slots: IdentitySpriteSlot[]) => { sheets.push(slots); return { urls: ['data:image/jpeg;base64,AA=='], mode: 'sprite', subjects: [] }; },
      provider: async (request: { page?: number; prompt: string }) => { prompts.set(request.page!, request.prompt); return { url: `https://example.test/p${request.page}.webp` }; },
      llm: async () => ({ text: JSON.stringify({ visibleIds: ['tilda', 'alex', 'adrian'], identityById: { tilda: 1, alex: 1, adrian: 1 }, posing: false, primaryActionClear: true, sceneMatch: 1, styleMatch: 1, defects: [] }), modelUsed: 'test', usage: { prompt: 1, completion: 1, total: 2, costUSD: 0 }, durationMs: 0 }),
      policy: { maxImageCalls: 10, imageRetries: 0, imageConcurrency: 1 },
    } as any);
    // The holder comes first: FLUX gives the caption's action to the first figure of the sheet.
    expect(sheets.map(slots => slots.map(slot => `${slot.displayName}${slot.holds ? `+${slot.holds.displayName}` : ''}`))).toEqual([
      ['Tilda Tüftel', 'Alexander', 'Teddy'],
      ['Alexander+Teddy', 'Tilda Tüftel'],
      ['Tilda Tüftel', 'Alexander'],
      ['Alexander+Teddy', 'Tilda Tüftel', 'Adrian'],
    ]);
    expect(sheets[1][0].holds?.imageUrl).toBe(teddy.referenceUrl);
    expect(prompts.get(1)).toContain('slot 1 (left portrait) is ONLY Alexander, together with Teddy in front of Alexander');
    expect(prompts.get(1)).not.toContain('is ONLY Teddy');
    expect(prompts.get(1)).toContain("the only Teddy in the picture, in Alexander's hands");
    // Hidden: no cell, the design stays in words.
    expect(prompts.get(2)).not.toContain('is ONLY Teddy');
    expect(prompts.get(2)).not.toContain('together with Teddy');
    expect(prompts.get(2)).toContain('green ribbon');
    // Three people fill the sheet; the held teddy still comes along in its holder's cell.
    expect(prompts.get(3)).toContain('is ONLY Alexander, together with Teddy');
    // The cover's resting teddy keeps its own cell as before.
    expect(prompts.get(0)).toContain('is ONLY Teddy');
  });

  test('what is absent leaves the caption: "with no pale thread hanging out" was painted as a thread', () => {
    expect(withoutAbsentThings('The repaired seam stays shut, with no pale thread hanging out.')).toBe('The repaired seam stays shut.');
    expect(withoutAbsentThings('The seam stays closed and no pale thread hangs out.')).toBe('The seam stays closed.');
    expect(withoutAbsentThings('Tilda waits, without her goggles, by the door.')).toBe('Tilda waits, by the door.');
    expect(withoutAbsentThings('Nobody else is there. Tilda knocks.')).toBe('Nobody else is there. Tilda knocks.');
    const moment = seriesPaintableMoment(shot('At the worktable, Alexander gives Teddy a firm test squeeze. The repaired seam stays shut, with no pale thread hanging out.', 'alex', 'squeezes Teddy for a test', ['tilda', 'alex']));
    expect(moment.scene).not.toContain('thread');
    expect(moment.scene).toContain('The repaired seam stays shut.');
  });

  test('only a toy\'s portrait speaks of a face; a lantern is painted without the figure words (it came back walking)', () => {
    expect(seriesObjectReferencePrompt(teddy)).toContain("Preserve the toy's own stitched face and limbs.");
    const lantern = { ...teddy, id: 'lantern', name: 'Laterne', species: 'object', appearance: 'A round tin lantern with a blue glass window and a wire handle' } as VisualEntity;
    const prompt = seriesObjectReferencePrompt(lantern);
    expect(prompt).not.toMatch(/\b(?:faces?|heads?|limbs?|expressions?|expressive)\b/i);
    expect(prompt).toContain('a still, inanimate thing exactly as it is made');
    expect(prompt).toContain('gouache');
  });

  test('TALEA_SERIES_HELD_PROPS=off restores a cell of its own for every listed object', async () => {
    const pages = [{ order: 1, title: 'Kapitel', content: 'Ein Absatz.\n\nAlexander drückte den Teddy an sich.\n\nDas Ende.', paragraphs: [] }];
    const plan = validateSeriesShots({
      cover: { onStage: ['tilda', 'alex'], elements: ['teddy'], visualBeat: { actorId: 'tilda', action: 'waves at the door', result: 'Alexander smiles back at her', framing: 'wide' }, scene: 'Inside the workshop Tilda waves at the door while Alexander smiles; Teddy rests on the low bench beside them.' },
      pages: [{ page: 1, paragraph: 2, storyQuote: 'Alexander drückte den Teddy an sich.', onStage: ['tilda', 'alex'], elements: ['teddy'], visualBeat: { actorId: 'alex', action: 'presses Teddy gently against himself', result: 'the teddy is safe again', framing: 'medium' }, scene: 'Beside the open box, Alexander gently presses the freed Teddy against himself while Tilda watches closely.' }],
    }, pages, [tilda, alexander, adrian, teddy], 'tilda');
    const prompts = new Map<number, string>();
    process.env.TALEA_SERIES_HELD_PROPS = 'off';
    try {
      await generateSeriesImages({
        illustrations: plan, entities: [tilda, alexander, adrian, teddy], seed: 'held-off', visionModel: 'test', pageTexts: {},
        buildReference: async () => ({ urls: ['data:image/jpeg;base64,AA=='], mode: 'sprite', subjects: [] }),
        provider: async (request: { page?: number; prompt: string }) => { prompts.set(request.page!, request.prompt); return { url: `https://example.test/p${request.page}.webp` }; },
        llm: async () => ({ text: JSON.stringify({ visibleIds: ['tilda', 'alex'], identityById: { tilda: 1, alex: 1 }, posing: false, primaryActionClear: true, sceneMatch: 1, styleMatch: 1, defects: [] }), modelUsed: 'test', usage: { prompt: 1, completion: 1, total: 2, costUSD: 0 }, durationMs: 0 }),
        policy: { maxImageCalls: 10, imageRetries: 0, imageConcurrency: 1 },
      } as any);
    } finally {
      delete process.env.TALEA_SERIES_HELD_PROPS;
    }
    expect(prompts.get(1)).toContain('is ONLY Teddy');
    expect(prompts.get(1)).not.toContain('together with Teddy');
  });
});
