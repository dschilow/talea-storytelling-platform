import * as FileSystem from 'expo-file-system/legacy';

import { storage, StorageKeys } from './storage';

/**
 * On-device audio cache, the native counterpart to frontend/utils/audioCache.ts.
 *
 * The web caches decoded blobs in IndexedDB and hands out object URLs. Native has
 * something better: the TTS backend returns a base64 data URI, and expo-audio can
 * play a file URI directly — so we decode once, write an .mp3 into the cache
 * directory, and hand out `file://` URIs. That means no per-play decode, no
 * memory pressure from holding audio buffers, and playback survives the JS
 * context being reloaded.
 *
 * Eviction matches the web policy: 200 entries / 7 days, oldest first.
 */

const CACHE_DIR = `${FileSystem.cacheDirectory}talea-audio/`;
const MAX_ENTRIES = 200;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type CacheIndex = Record<string, { file: string; createdAt: number; bytes: number }>;

let indexPromise: Promise<CacheIndex> | null = null;
let directoryReady = false;

async function ensureDirectory(): Promise<void> {
  if (directoryReady) return;
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
  directoryReady = true;
}

function loadIndex(): Promise<CacheIndex> {
  indexPromise ??= storage.getJSON<CacheIndex>(StorageKeys.audioCacheIndex, {});
  return indexPromise;
}

async function saveIndex(index: CacheIndex): Promise<void> {
  indexPromise = Promise.resolve(index);
  await storage.setJSON(StorageKeys.audioCacheIndex, index);
}

/** Cache ids contain ':' and text hashes; make them filename-safe and bounded. */
function fileNameFor(id: string): string {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const safeStem = id.replace(/[^a-zA-Z0-9]/g, '').slice(-24);
  return `${safeStem}-${(hash >>> 0).toString(16)}.mp3`;
}

function stripDataUriPrefix(dataUri: string): string {
  const commaIndex = dataUri.indexOf(',');
  return commaIndex >= 0 ? dataUri.slice(commaIndex + 1) : dataUri;
}

/** Returns a playable file:// URI, or null on a miss/expiry. */
export async function getCachedAudio(id: string): Promise<string | null> {
  try {
    const index = await loadIndex();
    const entry = index[id];
    if (!entry) return null;

    if (Date.now() - entry.createdAt > MAX_AGE_MS) {
      await evict([id]);
      return null;
    }

    const uri = `${CACHE_DIR}${entry.file}`;
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      // Index and disk drifted (OS cleared the cache dir) — forget the entry.
      delete index[id];
      await saveIndex(index);
      return null;
    }

    return uri;
  } catch {
    return null;
  }
}

/** Persists a base64 data URI and returns the playable file:// URI. */
export async function cacheAudio(id: string, base64DataUrl: string): Promise<string | null> {
  try {
    await ensureDirectory();

    const file = fileNameFor(id);
    const uri = `${CACHE_DIR}${file}`;
    const base64 = stripDataUriPrefix(base64DataUrl);

    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });

    const index = await loadIndex();
    index[id] = { file, createdAt: Date.now(), bytes: Math.floor((base64.length * 3) / 4) };
    await saveIndex(index);

    void enforceLimits();
    return uri;
  } catch (error) {
    console.warn('[audioCache] Failed to cache audio', error);
    return null;
  }
}

async function evict(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const index = await loadIndex();
  for (const id of ids) {
    const entry = index[id];
    if (!entry) continue;
    delete index[id];
    await FileSystem.deleteAsync(`${CACHE_DIR}${entry.file}`, { idempotent: true }).catch(() => {});
  }
  await saveIndex(index);
}

async function enforceLimits(): Promise<void> {
  const index = await loadIndex();
  const entries = Object.entries(index);
  const now = Date.now();

  const expired = entries.filter(([, entry]) => now - entry.createdAt > MAX_AGE_MS).map(([id]) => id);

  const remaining = entries
    .filter(([id]) => !expired.includes(id))
    .sort((a, b) => a[1].createdAt - b[1].createdAt);

  const overflow = remaining.slice(0, Math.max(0, remaining.length - MAX_ENTRIES)).map(([id]) => id);

  await evict([...expired, ...overflow]);
}

export async function clearAudioCache(): Promise<void> {
  await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true }).catch(() => {});
  directoryReady = false;
  await saveIndex({});
}

export async function getAudioCacheSize(): Promise<{ entries: number; bytes: number }> {
  const index = await loadIndex();
  const entries = Object.values(index);
  return {
    entries: entries.length,
    bytes: entries.reduce((total, entry) => total + (entry.bytes || 0), 0),
  };
}

/** Downloads a remote audio URL into the cache so it plays offline. */
export async function cacheRemoteAudio(id: string, remoteUrl: string): Promise<string | null> {
  try {
    await ensureDirectory();
    const file = fileNameFor(id);
    const uri = `${CACHE_DIR}${file}`;

    const result = await FileSystem.downloadAsync(remoteUrl, uri);
    if (result.status !== 200) return null;

    const info = await FileSystem.getInfoAsync(uri);
    const index = await loadIndex();
    index[id] = {
      file,
      createdAt: Date.now(),
      bytes: info.exists && 'size' in info ? (info.size ?? 0) : 0,
    };
    await saveIndex(index);
    void enforceLimits();

    return uri;
  } catch {
    return null;
  }
}
