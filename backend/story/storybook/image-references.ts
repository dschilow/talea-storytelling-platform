export type ImageReferenceResolver = (imageUrl: string) => Promise<string | undefined>;

export interface ProviderReferenceSelection {
  urls: string[];
  usesCollage: boolean;
}

/** Runware cannot fetch Talea's private bucket:// or s3:// storage identifiers. */
export function isProviderReadableReference(imageUrl: string | undefined): imageUrl is string {
  const value = String(imageUrl || "").trim();
  if (!value) return false;
  return /^(https?:\/\/|data:image\/)/i.test(value) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Turns a freshly uploaded private collage into an external provider URL.
 * If storage resolution is unavailable, retain the already resolved direct
 * character references instead of sending an unreadable private bucket URI.
 */
export async function selectProviderReferences(input: {
  collageUrl: string;
  directUrls: string[];
  resolveUrl: ImageReferenceResolver;
}): Promise<ProviderReferenceSelection> {
  try {
    const resolvedCollageUrl = await input.resolveUrl(input.collageUrl);
    if (isProviderReadableReference(resolvedCollageUrl)) {
      // Collage FIRST, then the individual portraits — never the collage alone.
      //
      // A single reference at 4 steps is treated by the image model as the
      // composition to follow, not as a lookup table. Run 6683b402 sent one
      // collage per image and every single illustration came back with the
      // framed portrait grid painted across the top of the scene, despite
      // "do NOT draw the frames" in the prompt and "collage, grid, panel
      // borders, picture frame" in the negative prompt. The old engine sent two
      // to three references and produced clean scenes.
      //
      // The collage stays — it is what keeps faces consistent, and it stays in
      // slot one so the frame-colour mapping in identityContract still reads
      // "reference image 1". The extra portraits break its grip on the layout.
      return {
        urls: [resolvedCollageUrl, ...input.directUrls.filter(isProviderReadableReference)],
        usesCollage: true,
      };
    }
  } catch (err) {
    console.warn("[storybook/images] could not resolve collage for image provider:", err);
  }

  return {
    urls: input.directUrls.filter(isProviderReadableReference),
    usesCollage: false,
  };
}
