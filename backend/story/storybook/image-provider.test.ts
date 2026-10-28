// @ts-ignore Bun test helpers are runtime-only.
import { describe, expect, test } from 'bun:test';
import { createStorybookImageProvider } from './image-provider';
import { LIBRARY_IMAGE_MODEL } from '../library/images';

const request = { page: 2, prompt: 'scene', negativePrompt: '', referenceImages: ['data:image/jpeg;base64,AA=='], seed: 7, width: 1216, height: 832 };

describe('storybook image provider boundary', () => {
  test('the durable image stays in storage while vision receives the directly resolved URL', async () => {
    const calls: any[] = [];
    const resolved: string[] = [];
    const provider = createStorybookImageProvider({ storyId: 'story-id', model: LIBRARY_IMAGE_MODEL,
      generateImage: async payload => { calls.push(payload); return { imageUrl: 'bucket://test/scene.webp', seed: 7, debugInfo: { success: true, responseReceived: { data: [{ cost: 0.0025 }] } } } as any; },
      resolveForVision: async url => { resolved.push(url); return 'https://storage.example/scene.webp?signature=temporary'; },
    });
    const result = await provider(request);
    expect(result.url).toBe('bucket://test/scene.webp');
    expect(result.viewUrl).toBe('https://storage.example/scene.webp?signature=temporary');
    expect(resolved).toEqual(['bucket://test/scene.webp']);
    expect(result.costUSD).toBeCloseTo(0.0025);
    expect(calls[0]).toMatchObject({ model: LIBRARY_IMAGE_MODEL, steps: 16, referenceImages: request.referenceImages, logContext: { storyId: 'story-id', chapter: 2 } });
  });
  test('a provider credit refusal is exposed to the retry policy without inventing an image', async () => {
    const provider = createStorybookImageProvider({ model: LIBRARY_IMAGE_MODEL,
      generateImage: async () => ({ imageUrl: '', seed: 7, debugInfo: { success: false, responseStatus: 402 } } as any),
      resolveForVision: async () => { throw new Error('must not resolve missing image'); },
    });
    expect(await provider(request)).toMatchObject({ url: undefined, refused: true, httpStatus: 402 });
  });
});
