// @ts-ignore Bun test helpers are runtime-only in the Encore project.
import { describe, expect, test } from 'bun:test';
import { generateSeriesImages, validateSeriesShots } from './pictures';
import { readSeriesQa, seriesPictureLastResort, seriesPicturePasses, seriesPictureUsable, seriesSecondReaderRedraw, withJevDefects } from './quality';
import type { VisualEntity } from '../storybook/illustration-stage';
import type { JevPort } from '../storybook/jev';

const none = { hybrid: 0.02, twins: 0.03, fused: 0.1, mirror: 0.02, text: 0.03, blend: 0.05, garment: 0.05 };
const response = (value: string) => ({ text: value, modelUsed: 'test', usage: { prompt: 1, completion: 1, total: 2, costUSD: 0 }, durationMs: 0 });

const cast: VisualEntity[] = [
  { id: 'dragon', name: 'Funkelflug', kind: 'character', role: 'cast', species: 'dragon', isHuman: false, appearance: 'golden dragon, no clothes', forbidden: [] },
  { id: 'child-a', name: 'Nora', kind: 'character', role: 'hero', species: 'human', isHuman: true, appearance: 'girl with red glasses', forbidden: [] },
];
const inventoryReview = (fields: Record<string, unknown> = {}) => JSON.stringify({
  visibleIds: ['dragon', 'child-a'], identityById: { dragon: 0.98, 'child-a': 0.98 }, posing: false, primaryActionClear: true, sceneMatch: 0.95, styleMatch: 0.9, defects: [],
  reviewVersion: 3, recognizableById: { dragon: true, 'child-a': true }, anatomyOkById: { dragon: true, 'child-a': true },
  visibleHandsById: { dragon: ['left paw on rope', 'right paw raised'], 'child-a': ['left hand raised', 'right hand holding cup'] },
  sceneCompatible: true, storyConsistent: true, materialContradiction: false,
  observedFigures: [
    { position: 'left', appearance: 'small golden dragon', matchedId: 'dragon' },
    { position: 'right', appearance: 'girl with red glasses', matchedId: 'child-a' },
  ],
  ...fields,
});

describe('Figurenwelt: Jev as the second reader (2026-11-03)', () => {
  test('a double is redrawn but may stay the best attempt; a child with animal parts or writing never', () => {
    const qa = readSeriesQa(inventoryReview(), cast)!;
    expect(seriesPicturePasses(qa)).toBe(true);
    const doubled = withJevDefects(qa, { ...none, twins: 0.9 });
    expect(seriesPicturePasses(doubled)).toBe(false);
    expect(seriesPictureUsable(doubled)).toBe(false);
    expect(seriesSecondReaderRedraw(doubled)).toBe(true);
    // A false alarm costs a redraw, not the chapter's picture.
    expect(seriesPictureLastResort(doubled)).toBe(true);
    expect(doubled.sceneFixes).toContain('Every named figure appears exactly once, matching their own reference.');
    expect(doubled.defects.at(-1)?.detail).toContain('drawn twice [jev 90%]');
    for (const hard of [{ hybrid: 0.9 }, { text: 0.8 }]) {
      const flagged = withJevDefects(qa, { ...none, ...hard });
      expect(seriesPictureLastResort(flagged)).toBe(false);
      expect(seriesSecondReaderRedraw(flagged)).toBe(false);
    }
    expect(withJevDefects(qa, { ...none, text: 0.8 }).textVisible).toBe(true);
  });

  test('nothing fired, no reading or a double the reviewer already counted changes nothing', () => {
    const qa = readSeriesQa(inventoryReview(), cast)!;
    expect(withJevDefects(qa, undefined)).toBe(qa);
    expect(withJevDefects(qa, none).defects).toEqual([]);
    const counted = readSeriesQa(inventoryReview({ observedFigures: [
      { position: 'left', appearance: 'small golden dragon', matchedId: 'dragon' },
      { position: 'middle', appearance: 'second small golden dragon', matchedId: 'dragon' },
      { position: 'right', appearance: 'girl with red glasses', matchedId: 'child-a' },
    ] }), cast)!;
    expect(counted.duplicates.length).toBeGreaterThan(0);
    expect(withJevDefects(counted, { ...none, twins: 0.9 }).defects).toEqual(counted.defects);
  });

  test('in the picture loop a double Jev saw is drawn again as a new scene, with the box in the log', async () => {
    const entities: VisualEntity[] = [
      { id: 'lead', name: 'Funkelflug', kind: 'character', role: 'cast', species: 'dragon', isHuman: false, appearance: 'small golden dragon', forbidden: [], referenceUrl: 'https://example.test/dragon.webp' },
      { id: 'kid', name: 'Nora', kind: 'character', role: 'hero', species: 'human', isHuman: true, appearance: 'girl in red coat', forbidden: [], referenceUrl: 'https://example.test/nora.webp' },
    ];
    const scene = 'Funkelflug at left pulls a bell rope while Nora at right catches the falling wooden handle, both looking at the rope in the mountain hut.';
    const pages = [1, 2, 3].map(order => ({ order, title: 'Glocke', content: 'Ein Absatz.\n\nDie Glocke bewegte sich.\n\nDas Ende.', paragraphs: [] }));
    const beat = (framing = 'wide') => ({ actorId: 'lead', action: 'pulls the bell rope down', result: 'the wooden handle swings toward Nora', framing });
    const plan = validateSeriesShots({ cover: { onStage: ['lead'], visualBeat: beat(), scene }, pages: pages.map(p => ({ page: p.order, paragraph: 2, storyQuote: 'Die Glocke bewegte sich.', onStage: ['lead', 'kid'], visualBeat: beat(p.order === 2 ? 'close' : 'wide'), scene })) }, pages, entities, 'lead');
    const box = { top: 0.2, bottom: 0.8, left: 0.05, right: 0.6, confidence: 0.45 };
    const jev: JevPort = async ({ imageUrl, questions }) => {
      if (Object.values(questions)[0].type === 'box') return { answers: {}, boxes: { twins: box }, costUSD: 0.00004, inputTokens: 900, durationMs: 400 };
      return { answers: { ...none, ...(imageUrl.endsWith('/p1-1.webp') ? { twins: 0.92 } : {}) }, costUSD: 0.00008, inputTokens: 1800, durationMs: 600 };
    };
    const drawnPerPage = new Map<number, number>();
    const requests: any[] = [];
    const result = await generateSeriesImages({
      illustrations: plan, entities, seed: 'second-reader', visionModel: 'test', pageTexts: {}, jev,
      buildReference: async () => ({ urls: ['data:image/jpeg;base64,AA=='] } as any),
      llm: async r => response(JSON.stringify({ visibleIds: r.stage.includes('qa-0-') ? ['lead'] : ['lead', 'kid'], identityById: { lead: 1, kid: 1 }, posing: false, primaryActionClear: true, sceneMatch: 1, styleMatch: 1, defects: [] })),
      provider: async request => {
        requests.push(request);
        const count = (drawnPerPage.get(request.page!) || 0) + 1;
        drawnPerPage.set(request.page!, count);
        return { url: `https://example.test/p${request.page}-${count}.webp`, costUSD: 0.0025 };
      },
    });
    const page = result.pages.get(1)!;
    expect(page.status).toBe('passed');
    expect(page.attempts).toBe(2);
    expect(page.history?.[0].notes.join(' ')).toContain('drawn twice');
    expect(page.history?.[0].boxes).toEqual({ twins: box });
    // A double is recast as a fresh scene (edits returned the same doubled picture), with the positive fix.
    const redraw = requests.filter(r => r.page === 1)[1];
    expect(redraw.logStage).not.toBe('series-image-edit');
    expect(redraw.prompt).toContain('Every named figure appears exactly once');
    // Four first readings, one box question, one reading of the redraw.
    expect(result.jevCalls).toHaveLength(6);
    expect(result.imagesGenerated).toBe(4);
  });
});
