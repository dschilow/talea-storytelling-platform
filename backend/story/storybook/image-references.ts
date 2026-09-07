export type ImageReferenceResolver = (imageUrl: string) => Promise<string | undefined>;
import { isProviderReadableReference } from "../image-reference-sprite";
export { isProviderReadableReference } from "../image-reference-sprite";

export interface ProviderReferenceSelection {
  urls: string[];
  usesCollage: boolean;
}

/**
 * Turns a freshly uploaded private collage into an external provider URL.
 * A single portrait can stand alone. Several portraits need a working sprite;
 * failed storage resolution must never increase the provider reference count.
 */
export async function selectProviderReferences(input: {
  collageUrl: string;
  directUrls: string[];
  resolveUrl: ImageReferenceResolver;
}): Promise<ProviderReferenceSelection> {
  try {
    const resolvedCollageUrl = await input.resolveUrl(input.collageUrl);
    if (isProviderReadableReference(resolvedCollageUrl)) {
      // One collage is the user's cost contract. Fix layout leakage in the
      // sprite and scene prompt; do not silently add paid portrait inputs.
      return {
        urls: [resolvedCollageUrl],
        usesCollage: true,
      };
    }
  } catch (err) {
    console.warn("[storybook/images] could not resolve collage for image provider:", err);
  }

  const directUrls = input.directUrls.filter(isProviderReadableReference);
  return {
    urls: directUrls.length === 1 ? directUrls : [],
    usesCollage: false,
  };
}
