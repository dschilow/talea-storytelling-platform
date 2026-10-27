import sharp from "sharp";

export interface IdentitySpriteSlot {
  displayName: string;
  imageUrl: string;
  kind?: "character" | "artifact";
  /** Logos or writing on the figure's clothes, as [x0, y0, x1, y1] in 0–1000 of the portrait; painted out first. */
  marks?: MarkBox[];
}
export type MarkBox = [number, number, number, number];
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

/** A box that would cover more than this share of the portrait is no logo (a misread of the whole shirt or the face). */
const MAX_MARK_AREA = 0.12;

/** The marks worth painting: in range, ordered, not too large; at most three per portrait. */
export function usableMarks(raw: unknown): MarkBox[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((box) => (Array.isArray(box) && box.length === 4 ? box.map(Number) : []))
    .filter((box): box is MarkBox => box.length === 4 && box.every((n) => Number.isFinite(n) && n >= 0 && n <= 1000) && box[2] > box[0] && box[3] > box[1])
    .filter(([x0, y0, x1, y1]) => ((x1 - x0) * (y1 - y0)) / 1_000_000 <= MAX_MARK_AREA)
    .slice(0, 3);
}

/**
 * "Das Brett bis zur Tür" (2026-10-27): Adrian's avatar wears a shirt with a logo and a script word under it. FLUX 3
 * Klein copies the reference so faithfully that the logo came back in every close picture — with "plain navy T-shirt"
 * in the look, with a solid-colour sentence in the prompt and even in an edit call asked to repaint the shirt plain —
 * and the vision check failed the cover and two pages on "text visible" after ten calls. The mark is painted out of the
 * portrait instead: each box (padded, since readers draw them tight) gets the median colour of the fabric around it,
 * with a soft edge.
 */
export async function paintOutMarks(image: Buffer, boxes: MarkBox[]): Promise<Buffer> {
  if (!boxes.length) return image;
  const { data, info } = await sharp(image, { limitInputPixels: 40_000_000 }).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const patches: sharp.OverlayOptions[] = [];
  for (const [x0, y0, x1, y1] of boxes) {
    const bw = ((x1 - x0) / 1000) * width;
    const bh = ((y1 - y0) / 1000) * height;
    const pad = Math.max(0.3 * Math.max(bw, bh), 0.015 * Math.max(width, height));
    const left = Math.max(0, Math.floor((x0 / 1000) * width - pad));
    const top = Math.max(0, Math.floor((y0 / 1000) * height - pad));
    const right = Math.min(width, Math.ceil((x1 / 1000) * width + pad));
    const bottom = Math.min(height, Math.ceil((y1 / 1000) * height + pad));
    if (right - left < 2 || bottom - top < 2) continue;
    // The fabric: a ring around the padded box.
    const ring = Math.max(3, Math.round(0.25 * Math.min(right - left, bottom - top)));
    const channels: number[][] = [[], [], []];
    for (let y = Math.max(0, top - ring); y < Math.min(height, bottom + ring); y += 1) {
      for (let x = Math.max(0, left - ring); x < Math.min(width, right + ring); x += 1) {
        if (x >= left && x < right && y >= top && y < bottom) continue;
        const at = (y * width + x) * info.channels;
        for (let c = 0; c < 3; c += 1) channels[c].push(data[at + c]);
      }
    }
    if (!channels[0].length) continue;
    const median = channels.map((values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]);
    const w = right - left;
    const h = bottom - top;
    // Opaque in the middle, fading to the fabric over the outer feather (the padding, not the mark).
    const feather = Math.max(1, Math.min(pad * 0.8, Math.min(w, h) / 3));
    const rgba = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const edge = Math.min(x + 0.5, w - x - 0.5, y + 0.5, h - y - 0.5);
        const t = Math.min(1, edge / feather);
        const at = (y * w + x) * 4;
        rgba[at] = median[0];
        rgba[at + 1] = median[1];
        rgba[at + 2] = median[2];
        rgba[at + 3] = Math.round(255 * t * t * (3 - 2 * t));
      }
    }
    patches.push({ input: rgba, raw: { width: w, height: h, channels: 4 }, left, top });
  }
  if (!patches.length) return image;
  return sharp(data, { raw: { width, height, channels: info.channels } }).composite(patches).png().toBuffer();
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

/** One portrait on the same neutral 512 canvas a sprite cell uses. */
export async function renderSingleReference(image: Buffer): Promise<Buffer> {
  return sharp(image, { limitInputPixels: 40_000_000 }).rotate()
    .resize(512, 512, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).png().toBuffer();
}

/**
 * What actually travels to the image provider. The canvas is rendered as PNG,
 * but a lossless PNG of three portraits is ~2.5 MB of base64 — and in story
 * 0039344e (2026-09-25) exactly the three pages whose sheet held three
 * characters never reached Runware at all (11 calls for 8 pictures, no
 * provider response logged), while every two-character sheet (1.7 MB) went
 * through. JPEG q90 without chroma subsampling keeps faces and colours crisp
 * at ~0.4 MB for three and ~0.55 MB for four portraits.
 */
export async function encodeReferenceSprite(png: Buffer): Promise<Buffer> {
  return sharp(png).jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toBuffer();
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
  // The portrait as it goes on the sheet: logos and writing on the clothes painted out (see paintOutMarks).
  const portrait = async (slot: IdentitySpriteSlot): Promise<Buffer> => {
    const inline = slot.imageUrl.match(/^data:image\/[a-z]+;base64,(.+)$/i);
    const buffer = inline ? Buffer.from(inline[1], "base64") : await download(slot.imageUrl);
    const marks = usableMarks(slot.marks);
    return marks.length ? paintOutMarks(buffer, marks) : buffer;
  };
  return slots => {
    const key = JSON.stringify(slots);
    if (!sprites.has(key)) sprites.set(key, (async (): Promise<IdentityReference> => {
      if (!slots.length) return EMPTY_IDENTITY_REFERENCE;
      if (slots.some(s => !isProviderReadableReference(s.imageUrl))) throw new Error("Reference image is not provider-readable");
      const subjects = slots.map(s => ({ displayName: s.displayName, kind: s.kind || "character" as const }));
      if (slots.length === 1) {
        // Inline like the sprite: with a URL Runware fetches our image proxy, and FLUX.2 klein is
        // billed by end-to-end request time (probe 2026-10-15: $0.0026 per picture by URL vs $0.0012
        // inline; book 6950cb7e paid $0.062 for one picture). A failed download keeps the URL.
        const editable = /^https?:\/\//i.test(slots[0].imageUrl) || (/^data:image\//i.test(slots[0].imageUrl) && usableMarks(slots[0].marks).length > 0);
        if (!editable) return { urls: [slots[0].imageUrl], mode: "single", subjects };
        try {
          const buffer = await encodeReferenceSprite(await renderSingleReference(await portrait(slots[0])));
          return { urls: [`data:image/jpeg;base64,${buffer.toString("base64")}`], mode: "single", subjects };
        } catch {
          return { urls: [slots[0].imageUrl], mode: "single", subjects };
        }
      }
      const buffer = await encodeReferenceSprite(await renderIdentitySprite(await Promise.all(slots.map(portrait))));
      return { urls: [`data:image/jpeg;base64,${buffer.toString("base64")}`], mode: "sprite", subjects };
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
