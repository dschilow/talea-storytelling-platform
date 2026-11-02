// @ts-ignore Bun test helpers are runtime-only in Encore.
import { describe, expect, test } from 'bun:test';
import { readSeriesVisualContracts, seriesShotContinuity } from './visual-continuity';
import { generateSeriesImages, validateSeriesShots } from './pictures';
import { readSeriesQa, seriesPictureLastResort, seriesPicturePasses, seriesPictureUsable } from './quality';
import type { VisualEntity } from '../storybook/illustration-stage';

const entities: VisualEntity[] = [
  { id: 'tilda', name: 'Tilda', kind: 'character', role: 'cast', species: 'human', isHuman: true, appearance: 'girl with goggles', forbidden: [], referenceUrl: 'https://test/tilda.jpg' },
  { id: 'alex', name: 'Alexander', kind: 'character', role: 'hero', species: 'human', isHuman: true, appearance: 'brown-haired boy', forbidden: [], referenceUrl: 'https://test/alex.jpg' },
];
const rawQa = (defects: unknown[] = []) => ({ reviewVersion: 3,
  observedFigures: [{ position: 'left', appearance: 'girl with goggles', matchedId: 'tilda' }, { position: 'right', appearance: 'brown-haired boy', matchedId: 'alex' }],
  identityById: { tilda: 0.98, alex: 0.98 }, recognizableById: { tilda: true, alex: true }, anatomyOkById: { tilda: true, alex: true },
  visibleHandsById: { tilda: [], alex: [] }, sceneCompatible: true, storyConsistent: true, materialContradiction: false,
  primaryActionClear: true, posing: false, sceneMatch: 0.95, styleMatch: 0.95, defects });

describe('story-critical visual continuity, 1bbb8af3 and b3d96e64', () => {
  test('the explicitly observed second teddy blocks even when omitted from the inventory and marked harmless', () => {
    const defect = { kind: 'detail', blocking: false, blocksAction: false,
      detail: 'A second teddy matching the hugged bear sits prominently on the right workbench.',
      fix: 'Remove the extra teddy if the scene should show only the bear Alexander has just been mending.' };
    const qa = readSeriesQa(JSON.stringify(rawQa([defect])), entities, { sceneText: 'Alexander hugs the repaired Teddy against his chest.' })!;
    expect(qa.defects[0]).toMatchObject({ kind: 'continuity', blocking: true });
    expect(qa.sceneFixes).toContain('Keep exactly one teddy; remove the extra copy.');
    expect(seriesPicturePasses(qa)).toBe(false);
    expect(seriesPictureUsable(qa)).toBe(false);
    expect(seriesPictureLastResort(qa, true)).toBe(false);
    const plural = readSeriesQa(JSON.stringify(rawQa([defect])), entities, { sceneText: 'Alexander sorts several teddies.' });
    expect(seriesPictureUsable(plural)).toBe(true);
    for (const detail of ['The teddy has an extra decorative stitch.', 'The second stitch on teddy is blue.', 'There is no second teddy on the shelf.']) {
      expect(seriesPictureUsable(readSeriesQa(JSON.stringify(rawQa([{ ...defect, detail }])), entities,
        { sceneText: 'Alexander hugs his Teddy.' }))).toBe(true);
    }
  });
  test('explicit central prop contradictions block regardless of optimistic reviewer flags or an empty chapter', () => {
    for (const detail of ['The cardboard sign has become a heavy wooden plank.', 'The broom-and-box device is replaced by a tall factory machine.', 'The established lifejacket is visibly absent.']) {
      const qa = readSeriesQa(JSON.stringify(rawQa([{ kind: 'continuity', blocking: false, detail, fix: 'Restore the source-grounded object design.' }])), entities);
      expect(seriesPicturePasses(qa, true)).toBe(false);
      expect(seriesPictureUsable(qa)).toBe(false);
      expect(seriesPictureLastResort(qa, true)).toBe(false);
    }
    expect(seriesPictureUsable(readSeriesQa(JSON.stringify(rawQa([{ kind: 'detail', blocking: false,
      detail: 'An extra brush is on the workbench.', fix: 'Optional brush adjustment.' }])), entities))).toBe(true);
  });
  test('only literal, named source evidence can supply a shared design; no unrelated prop is summoned', () => {
    const pages = [{ order: 1, title: 'Das Schild', content: 'Das Schild war aus dünner Pappe. Alexander hielt es fest.', paragraphs: [] }];
    const item = { name: 'Schild', aliases: ['sign'], appearance: 'one thin flexible cardboard sign', evidence: [{ page: 1, quote: 'Das Schild war aus dünner Pappe.' }] };
    const contracts = readSeriesVisualContracts([item, { ...item, name: 'Maschine', aliases: ['machine'], evidence: [{ page: 1, quote: 'Eine Maschine stand daneben.' }] }], pages);
    expect(contracts).toHaveLength(1);
    expect(readSeriesVisualContracts([{ ...item, evidence: [{ page: 2, quote: item.evidence[0].quote }] }], pages)).toEqual([]);
    expect(readSeriesVisualContracts([{ ...item, name: 'Katze', aliases: ['cat'] }], pages)).toEqual([]);
    const shot = { page: 1, onStage: ['alex'], focus: 'scene' as const, artifactVisible: false, scene: 'Alexander holds the sign.' };
    expect(seriesShotContinuity(contracts, shot)).toHaveLength(1);
    expect(seriesShotContinuity(contracts, { ...shot, scene: 'Alexander draws a design.' })).toEqual([]);
    expect(seriesShotContinuity(contracts, { ...shot, scene: 'Alexander holds a cup.' })).toEqual([]);
  });
  test('the same sourced design reaches painting, checking and a local repair without another reference cell', async () => {
    const quote = 'Die Aufräummaschine hatte einen breiten Besen, ein Pedal und eine Holzkiste.';
    const pages = [1, 2].map(order => ({ order, title: 'Die Maschine', content: quote, paragraphs: [quote] }));
    const shot = { onStage: ['tilda', 'alex'], scene: 'In the workshop, Tilda stops the cleaning machine beside Alexander.', paragraph: 1, storyQuote: quote,
      visualBeat: { actorId: 'tilda', action: 'stops the cleaning machine', result: 'the broom rests beside the wooden collection box', framing: 'medium' } };
    const plan = validateSeriesShots({ cover: shot, pages: pages.map(page => ({ ...shot, page: page.order })),
      continuity: [{ name: 'Aufräummaschine', aliases: ['cleaning machine'], appearance: 'A floor-level wooden collection box with a broad broom and one pedal.', evidence: [{ page: 1, quote }] }] }, pages, entities, 'tilda');
    let repaired = false;
    const prompts: string[] = [];
    const images = await generateSeriesImages({ illustrations: plan, entities, seed: 'continuity', visionModel: 'test',
      pageTexts: { 1: quote, 2: quote }, imageModel: 'runware:400@6',
      buildReference: async slots => { expect(slots).toHaveLength(2); return { urls: ['https://test/sheet.jpg'], mode: 'sprite', subjects: slots.map(slot => ({ displayName: slot.displayName, kind: slot.kind || 'character' })) }; },
      provider: async request => {
        prompts.push(request.prompt);
        expect(request.prompt).toContain('floor-level wooden collection box');
        if (request.logStage === 'series-image-edit') repaired = true;
        return { url: `https://test/${request.page}-${prompts.length}.jpg`, costUSD: 0.001 };
      },
      llm: async request => {
        expect(request.user).toContain('floor-level wooden collection box');
        const broken = request.stage === 'series-image-qa-1-1';
        return { text: JSON.stringify(rawQa(broken ? [{ kind: 'continuity', blocking: false, detail: 'The central device is a metal factory machine.', fix: 'Restore the wooden broom-and-box device.' }] : [])),
          modelUsed: 'test', durationMs: 0, usage: { prompt: 1, completion: 1, total: 2, costUSD: 0 } };
      } });
    expect(repaired).toBe(true);
    expect(images.pages.get(1)?.status).toBe('passed');
    expect(images.imageCalls).toBe(4);
  });
});
