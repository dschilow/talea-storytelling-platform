/**
 * Provider-agnostic validation for generated image results.
 *
 * Runware historically returned a truthy SVG placeholder on failure. That
 * made downstream pipelines count and persist a failed generation as a real
 * illustration. Keep this helper dependency-free so every image boundary can
 * enforce the same contract.
 */

export interface GeneratedImageLike {
  imageUrl?: unknown;
  debugInfo?: {
    success?: unknown;
    contentType?: unknown;
  } | null;
}

export function isUsableGeneratedImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const url = value.trim();
  if (!url) return false;
  if (/^data:image\/svg\+xml(?:;|,)/i.test(url)) return false;
  return true;
}

export function isUsableGeneratedImageResult(
  value: GeneratedImageLike | null | undefined
): boolean {
  if (!value || !isUsableGeneratedImageUrl(value.imageUrl)) return false;
  if (value.debugInfo?.success === false) return false;
  if (/^image\/svg\+xml(?:;|$)/i.test(String(value.debugInfo?.contentType || "").trim())) {
    return false;
  }
  return true;
}

export function acceptedGeneratedImageUrl(
  value: GeneratedImageLike | null | undefined
): string | undefined {
  return isUsableGeneratedImageResult(value) ? String(value!.imageUrl).trim() : undefined;
}
