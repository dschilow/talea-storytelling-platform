import type { ImageGenerationRequest, ImageGenerationResponse } from '../../ai/image-generation';
import { acceptedGeneratedImageUrl } from '../../helpers/imageResultGuard';
import { LIBRARY_IMAGE_MODEL, LIBRARY_IMAGE_STEPS } from '../library/images';
import type { ImageProvider } from './images';

/** Keep durable storage URLs separate from the short-lived URLs sent to vision and image editing. */
export function createStorybookImageProvider(input: {
  storyId?: string;
  model: string;
  generateImage: (request: ImageGenerationRequest) => Promise<ImageGenerationResponse>;
  resolveForVision: (url: string) => Promise<string | undefined>;
}): ImageProvider {
  return async (request) => {
    const configured = Number(process.env.TALEA_STORYBOOK_IMAGE_STEPS);
    const steps = input.model === LIBRARY_IMAGE_MODEL ? LIBRARY_IMAGE_STEPS : Number.isFinite(configured) && configured >= 4 && configured <= 28 ? Math.round(configured) : 4;
    const image = await input.generateImage({
      prompt: request.prompt, negativePrompt: request.negativePrompt, model: input.model,
      width: request.width, height: request.height, steps,
      ...(input.model === LIBRARY_IMAGE_MODEL ? {} : { CFGScale: 4 }),
      seed: request.seed, outputFormat: input.model === LIBRARY_IMAGE_MODEL ? 'WEBP' : 'JPEG',
      referenceImages: request.referenceImages.length ? request.referenceImages : undefined,
      ...(input.model === LIBRARY_IMAGE_MODEL && request.referenceRegions?.length ? { referenceRegions: request.referenceRegions } : {}),
      logContext: { storyId: input.storyId, stage: request.logStage || (request.page === 0 ? 'storybook-image-cover' : 'storybook-image-page'), chapter: request.logStage ? undefined : request.page || undefined },
    });
    const url = acceptedGeneratedImageUrl(image);
    const response = image?.debugInfo?.responseReceived;
    const rows = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
    const costUSD = rows.reduce((sum: number, row: any) => sum + (Number(row?.cost) > 0 ? Number(row.cost) : 0), 0);
    const viewUrl = url ? await input.resolveForVision(url).catch(() => undefined) : undefined;
    const httpStatus = Number(image?.debugInfo?.responseStatus) || undefined;
    const refused = !url && (httpStatus === 429 || httpStatus === 402 || (httpStatus !== undefined && httpStatus >= 500));
    return { url, viewUrl, costUSD, ...(refused ? { refused: true, httpStatus } : {}) };
  };
}
