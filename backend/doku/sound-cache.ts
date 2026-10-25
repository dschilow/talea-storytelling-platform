/**
 * Storage of generated sounds between mixes — Encore-free, so the sound library
 * (story/library/audio/sound-library.ts) and its tests can compute the same keys.
 */

import { createHash } from "crypto";

/**
 * Generated sounds kept between mixes (bucket in production, a folder in live
 * tests): a second recording of the same screenplay buys no sound twice.
 */
export interface SoundCachePort {
  load(key: string): Promise<Buffer | null>;
  save(key: string, audio: Buffer): Promise<void>;
}

/** Bump when the generation settings change, so old cached sounds are not reused. */
export const SOUND_CACHE_VERSION = 1;

/**
 * Storage key of a generated sound. A loop is keyed by its prompt alone — it is
 * looped to any length anyway — so the same place sounds the same in every take.
 */
export function soundCacheKey(type: string, prompt: string, seconds: number, loop: boolean): string {
  const id = createHash("sha1").update(`${type}|${prompt.trim().toLowerCase()}|${loop ? "loop" : Math.round(seconds * 10) / 10}`).digest("hex").slice(0, 20);
  return `sounds/v${SOUND_CACHE_VERSION}/${type}/${id}.mp3`;
}
