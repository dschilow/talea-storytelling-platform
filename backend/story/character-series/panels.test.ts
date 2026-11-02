// @ts-ignore Bun test helpers are runtime-only in Encore.
import { describe, expect, test } from 'bun:test';
import sharp from 'sharp';
import { hasPanelGutter } from './panels';

const WIDTH = 1216, HEIGHT = 832;
/** A busy painted area: noise, so it is never mistaken for an even band. */
const painted = (width: number, height: number, seed: number) => {
  const data = Buffer.alloc(width * height * 3);
  let state = seed;
  for (let i = 0; i < data.length; i++) { state = (state * 1103515245 + 12345) & 0x7fffffff; data[i] = 40 + (state % 170); }
  return sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer();
};
const canvas = (composites: sharp.OverlayOptions[]) =>
  sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: { r: 250, g: 248, b: 242 } } }).composite(composites).jpeg().toBuffer();

describe('sheet-like panels in a drawn picture (stories fa24532b and 571a9c54)', () => {
  test('two panels with a light gutter are found; one continuous scene is not', async () => {
    const half = Math.floor((WIDTH - 40) / 2);
    const diptych = await canvas([
      { input: await painted(half, HEIGHT - 30, 1), left: 12, top: 15 },
      { input: await painted(half, HEIGHT - 30, 2), left: WIDTH - 12 - half, top: 15 },
    ]);
    expect(await hasPanelGutter(diptych)).toBe(true);
    expect(await hasPanelGutter(await canvas([{ input: await painted(WIDTH, HEIGHT, 3), left: 0, top: 0 }]))).toBe(false);
  });
  test('stacked panels count too, a pale wall broken by a floor does not', async () => {
    const stacked = await canvas([
      { input: await painted(WIDTH - 24, 380, 4), left: 12, top: 15 },
      { input: await painted(WIDTH - 24, 380, 5), left: 12, top: HEIGHT - 395 },
    ]);
    expect(await hasPanelGutter(stacked)).toBe(true);
    // A light wall over the whole upper picture, figures on both sides, a painted floor along the bottom.
    const room = await canvas([
      { input: await painted(420, HEIGHT, 6), left: 0, top: 0 },
      { input: await painted(420, HEIGHT, 7), left: WIDTH - 420, top: 0 },
      { input: await painted(WIDTH, 220, 8), left: 0, top: HEIGHT - 220 },
    ]);
    expect(await hasPanelGutter(room)).toBe(false);
  });
});
