import { createHash } from "node:crypto";

/** An avatar URL identifies the current stored image, so an edited picture gets a fresh cache key. */
export function avatarImageProxyUrl(base: string, avatarId: string, storedImageUrl?: string): string {
  const url = `${base.replace(/\/+$/, "")}/story/image/avatar/${encodeURIComponent(avatarId)}`;
  if (!storedImageUrl) return url;
  const version = createHash("sha256").update(storedImageUrl).digest("hex").slice(0, 16);
  return `${url}?v=${version}`;
}

/** Accept a bucket-key proxy URL only from the configured image proxy. */
export function keyFromOwnImageProxy(imageUrl: string, proxyBaseUrl?: string | null): string | null {
  if (!proxyBaseUrl) return null;
  try {
    const source = new URL(imageUrl);
    const base = new URL(proxyBaseUrl);
    const expectedPath = `${base.pathname.replace(/\/+$/, "")}/story/image`;
    if (source.origin !== base.origin || source.pathname !== expectedPath) return null;
    const key = source.searchParams.get("key")?.replace(/^\/+/, "") || "";
    return key && !key.includes("..") && !key.includes("\\") ? key : null;
  } catch {
    return null;
  }
}
