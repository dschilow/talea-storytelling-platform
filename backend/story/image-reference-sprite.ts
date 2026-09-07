import sharp from "sharp";

export interface IdentitySpriteSlot {
  displayName: string;
  imageUrl: string;
  kind?: "character" | "artifact";
}
export interface IdentityReference {
  urls: string[];
  mode: "none" | "single" | "sprite";
  /** In precisely the same order as the pixels, including artifact entries. */
  subjects: Array<{ displayName: string; kind: "character" | "artifact" }>;
}
export type IdentityReferenceBuilder = (slots: IdentitySpriteSlot[]) => Promise<IdentityReference>;
export const EMPTY_IDENTITY_REFERENCE: IdentityReference = { urls: [], mode: "none", subjects: [] };

export function isProviderReadableReference(imageUrl: string | undefined): imageUrl is string {
  const value = String(imageUrl || "").trim();
  return /^(https?:\/\/|data:image\/(?:png|jpe?g|webp);base64,)/i.test(value) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** One neutral canvas, no added borders, colours, labels, gutters or badges.
 * Contain preserves tall characters, ears and accessories instead of cropping.
 * Cap total width so adding an artifact does not create an enormous input.
 */
export async function renderIdentitySprite(images: Buffer[]): Promise<Buffer> {
  if (images.length < 2 || images.length > 32) throw new Error("A sprite requires 2-32 source images");
  const cell = Math.min(512, Math.floor(2048 / images.length / 16) * 16);
  const tiles = await Promise.all(images.map(buffer => sharp(buffer, { limitInputPixels: 40_000_000 })
    .rotate().resize(cell, cell, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).png().toBuffer()));
  return sharp({ create: { width: cell * tiles.length, height: cell, channels: 3, background: "#ffffff" } })
    .composite(tiles.map((input, index) => ({ input, left: index * cell, top: 0 }))).png().toBuffer();
}

/** Runware supports Data URIs. An inline sprite needs no upload, signed URL,
 * storage round-trip or extra model call. Never append the source portraits.
 * A failed download fails this preparation; identities are never renumbered
 * after silently dropping a person from the middle of the strip.
 */
export function createIdentityReferenceCache(fetcher: typeof fetch = fetch): IdentityReferenceBuilder {
  const downloads = new Map<string, Promise<Buffer>>();
  const sprites = new Map<string, Promise<IdentityReference>>();
  const download = (url: string): Promise<Buffer> => {
    if (!downloads.has(url)) downloads.set(url, (async () => {
      const response = await fetcher(url, { signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error(`Reference image HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    })());
    return downloads.get(url)!;
  };
  return slots => {
    const key = JSON.stringify(slots);
    if (!sprites.has(key)) sprites.set(key, (async (): Promise<IdentityReference> => {
      if (!slots.length) return EMPTY_IDENTITY_REFERENCE;
      if (slots.some(s => !isProviderReadableReference(s.imageUrl))) throw new Error("Reference image is not provider-readable");
      const subjects = slots.map(s => ({ displayName: s.displayName, kind: s.kind || "character" as const }));
      if (slots.length === 1) return { urls: [slots[0].imageUrl], mode: "single", subjects };
      const buffer = await renderIdentitySprite(await Promise.all(slots.map(s => download(s.imageUrl))));
      return { urls: [`data:image/png;base64,${buffer.toString("base64")}`], mode: "sprite", subjects };
    })());
    return sprites.get(key)!;
  };
}

export function identityReferenceContract(reference: IdentityReference): string {
  if (!reference.subjects.length) return "";
  const positions = reference.subjects.map((s, i) => `${i + 1}: ${s.displayName}${s.kind === "artifact" ? " (object appearance)" : " (character identity)"}`).join("; ");
  return [
    "Use the attached image only to identify the depicted subjects, independently of its composition.",
    reference.mode === "sprite" ? `Within the reference only, entries ordered LEFT TO RIGHT are ${positions}.` : `The reference depicts ${positions}.`,
    "Preserve each subject's own face or head, species, hair or fur, colours, clothing and accessories. Keep each identity separate.",
    "Place the selected subjects physically inside the described environment, with natural poses, shared perspective, lighting and contact shadows.",
    "Discard the reference background, source poses and arrangement. The artwork contains only the scene, without portrait insets, badges, panels or decorative borders.",
  ].join(" ");
}

/** The story moment takes precedence over reference-layout instructions. */
export function buildSceneIllustrationPrompt(scene: string, style: string, reference: IdentityReference, visibleNames: string[]): string {
  return [
    scene,
    style,
    "One continuous, full-bleed illustration. The environment extends naturally to every edge.",
    visibleNames.length ? `Depict exactly these characters in the scene: ${visibleNames.join(", ")}.` : "An environment and objects, with no characters present.",
    identityReferenceContract(reference),
  ].filter(Boolean).join("\n");
}
