import { isOfflineAccessAllowed } from './offlineLicense';
import { openDB, deleteDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Story } from '../types/story';
import type { Doku } from '../types/doku';
import type { AudioDoku } from '../types/audio-doku';
import type { GeneratedAudioLibraryEntry } from '../types/generated-audio';

export type OfflineCacheScope = {
  userId: string;
  profileId: string;
};

const LAST_OFFLINE_SCOPE_KEY = 'talea.offline.lastScope.v1';

function isValidScope(value: unknown): value is OfflineCacheScope {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OfflineCacheScope>;
  return (
    typeof candidate.userId === 'string' &&
    candidate.userId.trim().length > 0 &&
    typeof candidate.profileId === 'string' &&
    candidate.profileId.trim().length > 0
  );
}

function assertScope(scope: OfflineCacheScope): OfflineCacheScope {
  if (!isValidScope(scope)) {
    throw new Error('[Offline] A user and child profile scope is required');
  }
  return {
    userId: scope.userId.trim(),
    profileId: scope.profileId.trim(),
  };
}

export function storeLastOfflineScope(scope: OfflineCacheScope): void {
  if (typeof window === 'undefined') return;
  try {
    const normalized = assertScope(scope);
    window.localStorage.setItem(LAST_OFFLINE_SCOPE_KEY, JSON.stringify(normalized));
  } catch {
    // IndexedDB remains usable even when browser privacy settings block localStorage.
  }
}

export function getLastOfflineScope(): OfflineCacheScope | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_OFFLINE_SCOPE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidScope(parsed)
      ? { userId: parsed.userId.trim(), profileId: parsed.profileId.trim() }
      : null;
  } catch {
    return null;
  }
}

// Media URLs from object storage carry a short-lived signature in the query
// string. Keying a cached blob by the full URL means the next signed URL for the
// very same file no longer matches and the content looks "not saved" offline.
// Signed URLs are therefore reduced to their stable origin+path.
const SIGNED_URL_PARAMS = [
  'x-amz-signature',
  'x-amz-algorithm',
  'x-amz-credential',
  'x-goog-signature',
  'signature',
  'expires',
  'token',
  'sig',
  'se',
];

export function normalizeOfflineMediaUrl(url: string): string {
  return normalizeMediaUrl(url);
}

/** True when the URL carries a short-lived signature and must not be persisted. */
export function isSignedMediaUrl(url: string): boolean {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return false;
  const query = url.slice(queryStart + 1).toLowerCase();
  return SIGNED_URL_PARAMS.some(
    (param) => query.startsWith(`${param}=`) || query.includes(`&${param}=`),
  );
}

function normalizeMediaUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  return isSignedMediaUrl(trimmed) ? trimmed.slice(0, trimmed.indexOf('?')) : trimmed;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  webm: 'audio/webm',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
};

function guessMimeFromUrl(url: string): string | undefined {
  const path = url.split('?')[0].split('#')[0];
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  return MIME_BY_EXTENSION[extension];
}

function createCacheKey(scope: OfflineCacheScope, contentId: string): string {
  const normalized = assertScope(scope);
  const normalizedContentId = contentId.trim();
  if (!normalizedContentId) {
    throw new Error('[Offline] A content id is required');
  }
  return JSON.stringify([normalized.userId, normalized.profileId, normalizedContentId]);
}

function isEntryInScope(
  entry: { userId?: unknown; profileId?: unknown },
  scope: OfflineCacheScope,
): boolean {
  const normalized = assertScope(scope);
  return entry.userId === normalized.userId && entry.profileId === normalized.profileId;
}

interface OfflineBlobEntry {
  cacheKey: string;
  userId: string;
  profileId: string;
  url: string;
  blob: Blob;
  mimeType: string;
  savedAt: number;
}

interface OfflineStoryEntry {
  cacheKey: string;
  userId: string;
  profileId: string;
  id: string;
  story: Story;
  savedAt: number;
}

interface OfflineDokuEntry {
  cacheKey: string;
  userId: string;
  profileId: string;
  id: string;
  doku: Doku;
  savedAt: number;
}

interface OfflineAudioDokuEntry {
  cacheKey: string;
  userId: string;
  profileId: string;
  id: string;
  audioDoku: AudioDoku;
  savedAt: number;
}

interface OfflineGeneratedAudioEntry {
  cacheKey: string;
  userId: string;
  profileId: string;
  id: string;
  generatedAudio: GeneratedAudioLibraryEntry;
  savedAt: number;
}

interface TaleaOfflineDB extends DBSchema {
  'offline-stories': {
    key: string;
    value: OfflineStoryEntry;
  };
  'offline-dokus': {
    key: string;
    value: OfflineDokuEntry;
  };
  'offline-audio-dokus': {
    key: string;
    value: OfflineAudioDokuEntry;
  };
  'offline-generated-audios': {
    key: string;
    value: OfflineGeneratedAudioEntry;
  };
  'offline-blobs': {
    key: string;
    value: OfflineBlobEntry;
  };
}

const DB_NAME = 'talea-offline';
const DB_VERSION = 3;
// These only guard against an IndexedDB that hangs outright. They used to be
// 1.2s / 1.5s / 3s, which a slow phone or a large audio blob exceeds on a good
// day — and a timeout then disabled offline storage for the whole session (or
// even deleted the database on open).
const DB_OPEN_TIMEOUT_MS = 10000;
const DB_READ_TIMEOUT_MS = 8000;
const DB_WRITE_TIMEOUT_MS = 20000;
const DB_BLOB_WRITE_TIMEOUT_MS = 60000;
// Network transfers are deliberately NOT covered by the IndexedDB timeouts above.
const MEDIA_DOWNLOAD_TIMEOUT_MS = 120000;
const MEDIA_DOWNLOAD_CONCURRENCY = 3;

let dbInstance: IDBPDatabase<TaleaOfflineDB> | null = null;
let dbOpenPromise: Promise<IDBPDatabase<TaleaOfflineDB>> | null = null;
let dbDisabled = false;
let hasWarnedUnavailable = false;
let dbSession = 0;

class OfflineDbTimeoutError extends Error {
  constructor(operation: string, timeoutMs: number) {
    super(`[Offline] IndexedDB ${operation} timed out after ${timeoutMs}ms`);
    this.name = 'OfflineDbTimeoutError';
  }
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : String(error);
  }
  return String(error);
}

function getErrorName(error: unknown): string {
  if (error && typeof error === 'object' && 'name' in error) {
    const name = (error as { name?: unknown }).name;
    return typeof name === 'string' ? name : '';
  }
  return '';
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new OfflineDbTimeoutError(operation, timeoutMs));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function resetDbConnection(): void {
  dbSession += 1;
  try {
    dbInstance?.close();
  } catch {
    // no-op
  }
  dbInstance = null;
  dbOpenPromise = null;
}

function warnOfflineUnavailable(error: unknown): void {
  if (hasWarnedUnavailable) return;
  hasWarnedUnavailable = true;
  console.warn('[Offline] Storage unavailable, offline reads fall back to network.', error);
}

function markDbUnavailable(error: unknown): void {
  dbDisabled = true;
  resetDbConnection();
  warnOfflineUnavailable(error);
}

function isDbTimeoutError(error: unknown): boolean {
  return getErrorName(error) === 'OfflineDbTimeoutError';
}

function isRecoverableDbError(error: unknown): boolean {
  if (isDbTimeoutError(error)) {
    return true;
  }
  const message = getErrorMessage(error).toLowerCase();
  const name = getErrorName(error).toLowerCase();
  return (
    name === 'unknownerror' ||
    name === 'versionerror' ||
    name === 'invalidstateerror' ||
    name === 'quotaexceedederror' ||
    message.includes('unknownerror') ||
    message.includes('internal error') ||
    message.includes('versionerror') ||
    message.includes('invalidstateerror') ||
    message.includes('quotaexceedederror') ||
    message.includes('file_error_no_space') ||
    message.includes('database connection is closing')
  );
}

function isQuotaError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    getErrorName(error).toLowerCase() === 'quotaexceedederror' ||
    message.includes('quotaexceedederror') ||
    message.includes('file_error_no_space')
  );
}

/**
 * Only genuine corruption justifies deleting the database on open. Timeouts and
 * quota problems must never trigger it — the saved stories and audio inside are
 * exactly what the user came here for.
 */
function isCorruptionError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const name = getErrorName(error).toLowerCase();
  return (
    name === 'unknownerror' ||
    name === 'versionerror' ||
    message.includes('unknownerror') ||
    message.includes('internal error') ||
    message.includes('versionerror')
  );
}

function isDbUnavailableError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return (
    message.includes('Offline storage is unavailable') ||
    isDbTimeoutError(error) ||
    isRecoverableDbError(error)
  );
}

function isDbConnectionClosingError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const name = getErrorName(error).toLowerCase();
  return (
    name === 'invalidstateerror' ||
    message.includes('database connection is closing') ||
    message.includes('the database connection is closing')
  );
}

function handleDbReadFailure<T>(error: unknown, fallback: T): T {
  // A slow read is not a broken database: answer "nothing found" this once and
  // keep the storage usable for the next call.
  if (isDbTimeoutError(error)) {
    console.warn('[Offline] IndexedDB read timed out, using fallback.', error);
    return fallback;
  }
  if (isDbUnavailableError(error)) {
    markDbUnavailable(error);
    return fallback;
  }
  throw error;
}

// Offline content is only handed out while the plan was confirmed recently
// (see utils/offlineLicense). Bookkeeping reads use withDbReadFallback directly.
function withLicensedRead<T>(
  scope: OfflineCacheScope,
  fallback: T,
  reader: (db: IDBPDatabase<TaleaOfflineDB>) => Promise<T>
): Promise<T> {
  if (!isOfflineAccessAllowed(scope.userId)) return Promise.resolve(fallback);
  return withDbReadFallback(fallback, reader);
}

async function withDbReadFallback<T>(
  fallback: T,
  reader: (db: IDBPDatabase<TaleaOfflineDB>) => Promise<T>
): Promise<T> {
  try {
    const db = await getDb();
    return await withTimeout(reader(db), DB_READ_TIMEOUT_MS, 'read');
  } catch (error) {
    if (isDbConnectionClosingError(error)) {
      resetDbConnection();
      try {
        const db = await getDb();
        return await withTimeout(reader(db), DB_READ_TIMEOUT_MS, 'read');
      } catch (retryError) {
        return handleDbReadFailure(retryError, fallback);
      }
    }
    return handleDbReadFailure(error, fallback);
  }
}

/**
 * Runs a write. Resolves `true` when it was stored and `false` when offline
 * storage is unavailable in this browser context. A timeout throws so the
 * caller can tell the user the save failed instead of reporting a false success.
 */
async function withDbWriteFallback(
  writer: (db: IDBPDatabase<TaleaOfflineDB>) => Promise<unknown>,
  timeoutMs: number = DB_WRITE_TIMEOUT_MS,
): Promise<boolean> {
  const handleFailure = (error: unknown): boolean => {
    // Timeouts and a full disk say nothing about the health of what is already
    // stored, so they must not switch offline reading off.
    if (isDbTimeoutError(error) || isQuotaError(error)) throw error;
    if (isDbUnavailableError(error)) {
      markDbUnavailable(error);
      return false;
    }
    throw error;
  };

  try {
    const db = await getDb();
    await withTimeout(writer(db), timeoutMs, 'write');
    return true;
  } catch (error) {
    if (isDbConnectionClosingError(error)) {
      resetDbConnection();
      try {
        const db = await getDb();
        await withTimeout(writer(db), timeoutMs, 'write');
        return true;
      } catch (retryError) {
        return handleFailure(retryError);
      }
    }
    return handleFailure(error);
  }
}

function assertStored(stored: boolean): void {
  if (!stored) {
    throw new Error('[Offline] Offline storage is unavailable in this browser context');
  }
}

async function openOfflineDb(): Promise<IDBPDatabase<TaleaOfflineDB>> {
  const db = await openDB<TaleaOfflineDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 3) {
        // Version 1/2 entries only used the content id. They cannot be assigned
        // safely to a user or child profile, so the migration intentionally
        // removes them instead of guessing and risking cross-profile access.
        if (db.objectStoreNames.contains('offline-stories')) {
          db.deleteObjectStore('offline-stories');
        }
        if (db.objectStoreNames.contains('offline-dokus')) {
          db.deleteObjectStore('offline-dokus');
        }
        if (db.objectStoreNames.contains('offline-audio-dokus')) {
          db.deleteObjectStore('offline-audio-dokus');
        }
        if (db.objectStoreNames.contains('offline-generated-audios')) {
          db.deleteObjectStore('offline-generated-audios');
        }
        if (db.objectStoreNames.contains('offline-blobs')) {
          db.deleteObjectStore('offline-blobs');
        }

        db.createObjectStore('offline-stories', { keyPath: 'cacheKey' });
        db.createObjectStore('offline-dokus', { keyPath: 'cacheKey' });
        db.createObjectStore('offline-audio-dokus', { keyPath: 'cacheKey' });
        db.createObjectStore('offline-generated-audios', { keyPath: 'cacheKey' });
        db.createObjectStore('offline-blobs', { keyPath: 'cacheKey' });
      }
    },
    blocked() {
      console.warn('[Offline] IndexedDB upgrade blocked by another tab.');
    },
  });

  db.onversionchange = () => {
    if (dbInstance === db) {
      dbInstance = null;
      dbOpenPromise = null;
    }
    db.close();
  };
  return db;
}

async function getDb(): Promise<IDBPDatabase<TaleaOfflineDB>> {
  if (dbInstance) return dbInstance;
  if (dbDisabled) {
    throw new Error('Offline storage is unavailable in this browser context');
  }
  if (dbOpenPromise) {
    return withTimeout(dbOpenPromise, DB_OPEN_TIMEOUT_MS, 'open');
  }

  const sessionAtStart = dbSession;
  dbOpenPromise = (async () => {
    try {
      const openedDb = await withTimeout(openOfflineDb(), DB_OPEN_TIMEOUT_MS, 'open');
      if (dbDisabled || sessionAtStart !== dbSession) {
        try {
          openedDb.close();
        } catch {
          // no-op
        }
        throw new Error('Offline storage is unavailable in this browser context');
      }
      dbInstance = openedDb;
      return dbInstance;
    } catch (error) {
      // A slow open is retried on the next call. It must never fall through to
      // the reset below, which deletes every saved story and audio file.
      if (isDbTimeoutError(error)) throw error;
      if (!isCorruptionError(error)) {
        dbDisabled = true;
        throw error;
      }

      console.warn('[Offline] IndexedDB looks corrupted, trying database reset...');
      resetDbConnection();
      const recoverySession = dbSession;

      try {
        await deleteDB(DB_NAME);
      } catch {
        // best effort cleanup
      }

      try {
        const reopenedDb = await withTimeout(openOfflineDb(), DB_OPEN_TIMEOUT_MS, 're-open');
        if (dbDisabled || recoverySession !== dbSession) {
          try {
            reopenedDb.close();
          } catch {
            // no-op
          }
          throw new Error('Offline storage is unavailable in this browser context');
        }
        dbInstance = reopenedDb;
        return dbInstance;
      } catch (recoveryError) {
        dbDisabled = true;
        throw recoveryError;
      }
    } finally {
      dbOpenPromise = null;
    }
  })();

  return dbOpenPromise;
}

async function downloadMedia(url: string): Promise<Blob> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), MEDIA_DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.blob();
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Downloads one media file and stores it as a blob. The download happens
 * OUTSIDE any IndexedDB timeout: a multi-megabyte audio file on a train wifi
 * legitimately takes longer than a database call should. Resolves `false` when
 * the file could not be saved; the caller decides how loud to be about it.
 */
async function fetchAndStoreBlob(
  url: string,
  scope: OfflineCacheScope,
  mimeHint?: string,
): Promise<boolean> {
  if (!url || dbDisabled) return false;
  const normalizedScope = assertScope(scope);
  const normalizedUrl = normalizeMediaUrl(url);
  const cacheKey = createCacheKey(normalizedScope, normalizedUrl);

  try {
    const existing = await withDbReadFallback<OfflineBlobEntry | undefined>(
      undefined,
      (db) => db.get('offline-blobs', cacheKey),
    );
    if (existing && existing.blob.size > 0) return true;

    let blob = await downloadMedia(url);
    if (blob.size === 0) throw new Error('empty response');

    // Object storage often answers audio with application/octet-stream, which
    // iOS refuses to play from a blob URL. Restore the real type.
    const declaredType = blob.type;
    if (!declaredType || declaredType === 'application/octet-stream') {
      const mimeType = mimeHint || guessMimeFromUrl(url);
      if (mimeType) blob = new Blob([blob], { type: mimeType });
    }

    return await withDbWriteFallback(
      (db) =>
        db.put('offline-blobs', {
          cacheKey,
          userId: normalizedScope.userId,
          profileId: normalizedScope.profileId,
          url: normalizedUrl,
          blob,
          mimeType: blob.type,
          savedAt: Date.now(),
        }),
      DB_BLOB_WRITE_TIMEOUT_MS,
    );
  } catch (error) {
    console.warn('[Offline] Failed to cache blob:', url, error);
    return false;
  }
}

interface MediaSource {
  url: string;
  mimeType?: string;
}

/**
 * Stores many media files with a small worker pool. Saving a 20-part audiobook
 * used to start 20 parallel downloads at once. Returns how many files failed.
 */
async function storeMediaBlobs(
  scope: OfflineCacheScope,
  sources: MediaSource[],
): Promise<number> {
  const unique = new Map<string, MediaSource>();
  for (const source of sources) {
    if (!source.url) continue;
    const key = normalizeMediaUrl(source.url);
    if (!unique.has(key)) unique.set(key, source);
  }

  const queue = [...unique.values()];
  let failed = 0;
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const ok = await fetchAndStoreBlob(next.url, scope, next.mimeType);
      if (!ok) failed += 1;
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(MEDIA_DOWNLOAD_CONCURRENCY, queue.length) }, worker),
  );
  return failed;
}

/** What a save managed to store; `failedMedia` files can not be shown offline. */
export interface OfflineSaveResult {
  failedMedia: number;
}

function collectStoryUrls(story: Story): string[] {
  const urls: string[] = [];
  if (story.coverImageUrl) urls.push(story.coverImageUrl);
  const chapters = story.chapters || story.pages || [];
  for (const chapter of chapters) {
    if (chapter.imageUrl) urls.push(chapter.imageUrl);
    if (chapter.scenicImageUrl) urls.push(chapter.scenicImageUrl);
  }
  return urls;
}

function collectDokuUrls(doku: Doku): string[] {
  const urls: string[] = [];
  if (doku.coverImageUrl) urls.push(doku.coverImageUrl);
  if (doku.content?.sections) {
    for (const section of doku.content.sections) {
      if (section.imageUrl) urls.push(section.imageUrl);
    }
  }
  return urls;
}

function collectAudioDokuUrls(audioDoku: AudioDoku): string[] {
  const urls: string[] = [];
  if (audioDoku.coverImageUrl) urls.push(audioDoku.coverImageUrl);
  if (audioDoku.audioUrl) urls.push(audioDoku.audioUrl);
  return urls;
}

function collectGeneratedAudioUrls(entry: GeneratedAudioLibraryEntry): string[] {
  return collectGeneratedAudioSources(entry).map((source) => source.url);
}

const toMediaSources = (urls: string[]): MediaSource[] => urls.map((url) => ({ url }));

function collectGeneratedAudioSources(entry: GeneratedAudioLibraryEntry): MediaSource[] {
  const sources: MediaSource[] = [];
  if (entry.coverImageUrl) sources.push({ url: entry.coverImageUrl });
  if (entry.audioUrl) sources.push({ url: entry.audioUrl, mimeType: entry.mimeType });
  return sources;
}

export async function saveStoryOffline(
  scope: OfflineCacheScope,
  story: Story,
): Promise<OfflineSaveResult> {
  const normalizedScope = assertScope(scope);
  assertStored(
    await withDbWriteFallback((db) =>
      db.put('offline-stories', {
        cacheKey: createCacheKey(normalizedScope, story.id),
        userId: normalizedScope.userId,
        profileId: normalizedScope.profileId,
        id: story.id,
        story,
        savedAt: Date.now(),
      }),
    ),
  );

  const failedMedia = await storeMediaBlobs(
    normalizedScope,
    toMediaSources(collectStoryUrls(story)),
  );
  return { failedMedia };
}

export async function saveDokuOffline(
  scope: OfflineCacheScope,
  doku: Doku,
): Promise<OfflineSaveResult> {
  const normalizedScope = assertScope(scope);
  assertStored(
    await withDbWriteFallback((db) =>
      db.put('offline-dokus', {
        cacheKey: createCacheKey(normalizedScope, doku.id),
        userId: normalizedScope.userId,
        profileId: normalizedScope.profileId,
        id: doku.id,
        doku,
        savedAt: Date.now(),
      }),
    ),
  );

  const failedMedia = await storeMediaBlobs(
    normalizedScope,
    toMediaSources(collectDokuUrls(doku)),
  );
  return { failedMedia };
}

export async function saveAudioDokuOffline(
  scope: OfflineCacheScope,
  audioDoku: AudioDoku,
): Promise<OfflineSaveResult> {
  const normalizedScope = assertScope(scope);
  assertStored(
    await withDbWriteFallback((db) =>
      db.put('offline-audio-dokus', {
        cacheKey: createCacheKey(normalizedScope, audioDoku.id),
        userId: normalizedScope.userId,
        profileId: normalizedScope.profileId,
        id: audioDoku.id,
        audioDoku,
        savedAt: Date.now(),
      }),
    ),
  );

  const failedMedia = await storeMediaBlobs(
    normalizedScope,
    toMediaSources(collectAudioDokuUrls(audioDoku)),
  );
  return { failedMedia };
}

/**
 * Saves any number of generated audio parts (e.g. every chapter of one story)
 * in one go: all entries are recorded first, then their files are downloaded
 * through a single worker pool.
 */
export async function saveGeneratedAudiosOffline(
  scope: OfflineCacheScope,
  entries: GeneratedAudioLibraryEntry[],
): Promise<OfflineSaveResult> {
  const normalizedScope = assertScope(scope);
  if (entries.length === 0) return { failedMedia: 0 };

  assertStored(
    await withDbWriteFallback(async (db) => {
      const tx = db.transaction('offline-generated-audios', 'readwrite');
      const savedAt = Date.now();
      await Promise.all([
        ...entries.map((entry) =>
          tx.store.put({
            cacheKey: createCacheKey(normalizedScope, entry.id),
            userId: normalizedScope.userId,
            profileId: normalizedScope.profileId,
            id: entry.id,
            generatedAudio: entry,
            savedAt,
          }),
        ),
        tx.done,
      ]);
    }),
  );

  const failedMedia = await storeMediaBlobs(
    normalizedScope,
    entries.flatMap(collectGeneratedAudioSources),
  );
  return { failedMedia };
}

export async function saveGeneratedAudioOffline(
  scope: OfflineCacheScope,
  entry: GeneratedAudioLibraryEntry,
): Promise<OfflineSaveResult> {
  return saveGeneratedAudiosOffline(scope, [entry]);
}

export async function removeStoryOffline(
  scope: OfflineCacheScope,
  storyId: string,
): Promise<void> {
  const normalizedScope = assertScope(scope);
  const cacheKey = createCacheKey(normalizedScope, storyId);
  await withDbWriteFallback(async (db) => {
    const entry = await db.get('offline-stories', cacheKey);
    if (!entry || !isEntryInScope(entry, normalizedScope)) return;

    const urls = collectStoryUrls(entry.story);
    await db.delete('offline-stories', cacheKey);
    await cleanupOrphanedBlobs(db, normalizedScope, urls);
  });
}

export async function removeDokuOffline(
  scope: OfflineCacheScope,
  dokuId: string,
): Promise<void> {
  const normalizedScope = assertScope(scope);
  const cacheKey = createCacheKey(normalizedScope, dokuId);
  await withDbWriteFallback(async (db) => {
    const entry = await db.get('offline-dokus', cacheKey);
    if (!entry || !isEntryInScope(entry, normalizedScope)) return;

    const urls = collectDokuUrls(entry.doku);
    await db.delete('offline-dokus', cacheKey);
    await cleanupOrphanedBlobs(db, normalizedScope, urls);
  });
}

export async function removeAudioDokuOffline(
  scope: OfflineCacheScope,
  audioDokuId: string,
): Promise<void> {
  const normalizedScope = assertScope(scope);
  const cacheKey = createCacheKey(normalizedScope, audioDokuId);
  await withDbWriteFallback(async (db) => {
    const entry = await db.get('offline-audio-dokus', cacheKey);
    if (!entry || !isEntryInScope(entry, normalizedScope)) return;

    const urls = collectAudioDokuUrls(entry.audioDoku);
    await db.delete('offline-audio-dokus', cacheKey);
    await cleanupOrphanedBlobs(db, normalizedScope, urls);
  });
}

export async function removeGeneratedAudioOffline(
  scope: OfflineCacheScope,
  entryId: string,
): Promise<void> {
  const normalizedScope = assertScope(scope);
  const cacheKey = createCacheKey(normalizedScope, entryId);
  await withDbWriteFallback(async (db) => {
    const entry = await db.get('offline-generated-audios', cacheKey);
    if (!entry || !isEntryInScope(entry, normalizedScope)) return;

    const urls = collectGeneratedAudioUrls(entry.generatedAudio);
    await db.delete('offline-generated-audios', cacheKey);
    await cleanupOrphanedBlobs(db, normalizedScope, urls);
  });
}

async function cleanupOrphanedBlobs(
  db: IDBPDatabase<TaleaOfflineDB>,
  scope: OfflineCacheScope,
  urls: string[],
): Promise<void> {
  if (urls.length === 0) return;
  const allUsedUrls = new Set<string>();

  const stories = await db.getAll('offline-stories');
  for (const entry of stories.filter((item) => isEntryInScope(item, scope))) {
    for (const url of collectStoryUrls(entry.story)) allUsedUrls.add(normalizeMediaUrl(url));
  }

  const dokus = await db.getAll('offline-dokus');
  for (const entry of dokus.filter((item) => isEntryInScope(item, scope))) {
    for (const url of collectDokuUrls(entry.doku)) allUsedUrls.add(normalizeMediaUrl(url));
  }

  const audioDokus = await db.getAll('offline-audio-dokus');
  for (const entry of audioDokus.filter((item) => isEntryInScope(item, scope))) {
    for (const url of collectAudioDokuUrls(entry.audioDoku)) allUsedUrls.add(normalizeMediaUrl(url));
  }

  const generatedAudios = await db.getAll('offline-generated-audios');
  for (const entry of generatedAudios.filter((item) => isEntryInScope(item, scope))) {
    for (const url of collectGeneratedAudioUrls(entry.generatedAudio)) {
      allUsedUrls.add(normalizeMediaUrl(url));
    }
  }

  for (const url of urls) {
    const normalizedUrl = normalizeMediaUrl(url);
    if (allUsedUrls.has(normalizedUrl)) continue;
    await db.delete('offline-blobs', createCacheKey(scope, normalizedUrl)).catch(() => {});
    if (normalizedUrl !== url.trim()) {
      await db.delete('offline-blobs', createCacheKey(scope, url)).catch(() => {});
    }
  }
}

export async function isStorySaved(scope: OfflineCacheScope, storyId: string): Promise<boolean> {
  return withDbReadFallback(false, async (db) => {
    const entry = await db.get('offline-stories', createCacheKey(scope, storyId));
    return !!entry && isEntryInScope(entry, scope);
  });
}

export async function isDokuSaved(scope: OfflineCacheScope, dokuId: string): Promise<boolean> {
  return withDbReadFallback(false, async (db) => {
    const entry = await db.get('offline-dokus', createCacheKey(scope, dokuId));
    return !!entry && isEntryInScope(entry, scope);
  });
}

export async function isAudioDokuSaved(
  scope: OfflineCacheScope,
  audioDokuId: string,
): Promise<boolean> {
  return withDbReadFallback(false, async (db) => {
    const entry = await db.get('offline-audio-dokus', createCacheKey(scope, audioDokuId));
    return !!entry && isEntryInScope(entry, scope);
  });
}

export async function isGeneratedAudioSaved(
  scope: OfflineCacheScope,
  entryId: string,
): Promise<boolean> {
  return withDbReadFallback(false, async (db) => {
    const entry = await db.get('offline-generated-audios', createCacheKey(scope, entryId));
    return !!entry && isEntryInScope(entry, scope);
  });
}

export async function getAllSavedIds(scope: OfflineCacheScope): Promise<{
  stories: string[];
  dokus: string[];
  audioDokus: string[];
}> {
  return withDbReadFallback(
    { stories: [], dokus: [], audioDokus: [] },
    async (db) => {
      const [stories, dokus, audioDokus] = await Promise.all([
        db.getAll('offline-stories'),
        db.getAll('offline-dokus'),
        db.getAll('offline-audio-dokus'),
      ]);
      return {
        stories: stories.filter((entry) => isEntryInScope(entry, scope)).map((entry) => entry.id),
        dokus: dokus.filter((entry) => isEntryInScope(entry, scope)).map((entry) => entry.id),
        audioDokus: audioDokus
          .filter((entry) => isEntryInScope(entry, scope))
          .map((entry) => entry.id),
      };
    }
  );
}

export async function getAllOfflineStories(scope: OfflineCacheScope): Promise<Story[]> {
  return withLicensedRead(scope, [], async (db) => {
    const entries = await db.getAll('offline-stories');
    return entries
      .filter((entry) => isEntryInScope(entry, scope))
      .map((entry) => entry.story);
  });
}

export async function getAllOfflineDokus(scope: OfflineCacheScope): Promise<Doku[]> {
  return withLicensedRead(scope, [], async (db) => {
    const entries = await db.getAll('offline-dokus');
    return entries
      .filter((entry) => isEntryInScope(entry, scope))
      .map((entry) => entry.doku);
  });
}

export async function getAllOfflineAudioDokus(scope: OfflineCacheScope): Promise<AudioDoku[]> {
  return withLicensedRead(scope, [], async (db) => {
    const entries = await db.getAll('offline-audio-dokus');
    return entries
      .filter((entry) => isEntryInScope(entry, scope))
      .map((entry) => entry.audioDoku);
  });
}

export async function getAllOfflineGeneratedAudios(
  scope: OfflineCacheScope,
): Promise<GeneratedAudioLibraryEntry[]> {
  return withLicensedRead(scope, [], async (db) => {
    const entries = await db.getAll('offline-generated-audios');
    return entries
      .filter((entry) => isEntryInScope(entry, scope))
      .sort((a, b) => b.savedAt - a.savedAt)
      .map((entry) => entry.generatedAudio);
  });
}

/**
 * Ids of the generated audio entries saved for one story or doku. Unlike
 * {@link getOfflineGeneratedAudiosBySource} this creates no object URLs, so it
 * is the right call for bookkeeping (e.g. deleting a story's audio with it).
 */
export async function listOfflineGeneratedAudioIdsBySource(
  scope: OfflineCacheScope,
  sourceType: GeneratedAudioLibraryEntry['sourceType'],
  sourceId: string,
): Promise<string[]> {
  return withDbReadFallback([], async (db) => {
    const entries = await db.getAll('offline-generated-audios');
    return entries
      .filter((entry) => isEntryInScope(entry, scope))
      .filter(
        (entry) =>
          entry.generatedAudio.sourceType === sourceType &&
          entry.generatedAudio.sourceId === sourceId,
      )
      .map((entry) => entry.id);
  });
}

/**
 * All generated (TTS) audio saved offline for one story or doku, sorted in
 * playback order and with `audioUrl`/`coverImageUrl` already pointing at local
 * blobs. This is what lets the player keep working when the audio library API
 * is unreachable.
 */
export async function getOfflineGeneratedAudiosBySource(
  scope: OfflineCacheScope,
  sourceType: GeneratedAudioLibraryEntry['sourceType'],
  sourceId: string,
): Promise<GeneratedAudioLibraryEntry[]> {
  return withDbReadFallback([], async (db) => {
    const entries = await db.getAll('offline-generated-audios');
    const matching = entries
      .filter((entry) => isEntryInScope(entry, scope))
      .map((entry) => entry.generatedAudio)
      .filter((audio) => audio.sourceType === sourceType && audio.sourceId === sourceId)
      .sort((a, b) => {
        const orderA = Number.isFinite(a.itemOrder as number)
          ? (a.itemOrder as number)
          : Number.MAX_SAFE_INTEGER;
        const orderB = Number.isFinite(b.itemOrder as number)
          ? (b.itemOrder as number)
          : Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    const resolved: GeneratedAudioLibraryEntry[] = [];
    for (const audio of matching) {
      const next = { ...audio };
      if (next.audioUrl) {
        const blobUrl = await getBlobUrlForDb(db, scope, next.audioUrl);
        // An entry without its blob cannot be played offline — skip it rather
        // than handing the player a URL that will 404 without a network.
        if (!blobUrl) continue;
        // The blob URL dies with the page; the key is how the player finds this
        // file again after the app was closed and reopened.
        next.offlineAudioKey = normalizeMediaUrl(next.audioUrl);
        next.audioUrl = blobUrl;
      }
      if (next.coverImageUrl) {
        const coverUrl = await getBlobUrlForDb(db, scope, next.coverImageUrl);
        if (coverUrl) next.coverImageUrl = coverUrl;
      }
      resolved.push(next);
    }
    return resolved;
  });
}

export async function getBlobUrl(
  scope: OfflineCacheScope,
  originalUrl: string,
): Promise<string | null> {
  return withLicensedRead(scope, null, async (db) => {
    return getBlobUrlForDb(db, scope, originalUrl);
  });
}

async function getBlobUrlForDb(
  db: IDBPDatabase<TaleaOfflineDB>,
  scope: OfflineCacheScope,
  originalUrl: string,
): Promise<string | null> {
  const normalizedUrl = normalizeMediaUrl(originalUrl);
  const candidateKeys = [createCacheKey(scope, normalizedUrl)];
  if (normalizedUrl !== originalUrl.trim()) {
    // Entries written before signed URLs were normalized still use the full URL.
    candidateKeys.push(createCacheKey(scope, originalUrl));
  }

  for (const key of candidateKeys) {
    const entry = await db.get('offline-blobs', key);
    if (entry && isEntryInScope(entry, scope)) {
      return URL.createObjectURL(entry.blob);
    }
  }
  return null;
}

export async function getOfflineStory(
  scope: OfflineCacheScope,
  storyId: string,
): Promise<Story | null> {
  return withLicensedRead(scope, null, async (db) => {
    const entry = await db.get('offline-stories', createCacheKey(scope, storyId));
    if (!entry || !isEntryInScope(entry, scope)) return null;

    // Replace image URLs with blob URLs
    const story = { ...entry.story };

    // Replace cover image
    if (story.coverImageUrl) {
      const blobUrl = await getBlobUrlForDb(db, scope, story.coverImageUrl);
      if (blobUrl) story.coverImageUrl = blobUrl;
    }

    // Replace chapter/page images
    const items = story.chapters || story.pages || [];
    for (let i = 0; i < items.length; i++) {
      const imageUrl = items[i]?.imageUrl;
      if (imageUrl) {
        const blobUrl = await getBlobUrlForDb(db, scope, imageUrl);
        if (blobUrl) items[i] = { ...items[i], imageUrl: blobUrl };
      }
      const scenicImageUrl = items[i]?.scenicImageUrl;
      if (scenicImageUrl) {
        const scenicBlobUrl = await getBlobUrlForDb(db, scope, scenicImageUrl);
        if (scenicBlobUrl) items[i] = { ...items[i], scenicImageUrl: scenicBlobUrl };
      }
    }

    return story;
  });
}

export async function getOfflineDoku(
  scope: OfflineCacheScope,
  dokuId: string,
): Promise<Doku | null> {
  return withLicensedRead(scope, null, async (db) => {
    const entry = await db.get('offline-dokus', createCacheKey(scope, dokuId));
    if (!entry || !isEntryInScope(entry, scope)) return null;

    const doku = { ...entry.doku };

    // Replace cover image
    if (doku.coverImageUrl) {
      const blobUrl = await getBlobUrlForDb(db, scope, doku.coverImageUrl);
      if (blobUrl) doku.coverImageUrl = blobUrl;
    }

    // Replace section images
    if (doku.content?.sections) {
      const sections = [];
      for (const section of doku.content.sections) {
        const newSection = { ...section };
        if (newSection.imageUrl) {
          const blobUrl = await getBlobUrlForDb(db, scope, newSection.imageUrl);
          if (blobUrl) newSection.imageUrl = blobUrl;
        }
        sections.push(newSection);
      }
      doku.content = { ...doku.content, sections };
    }

    return doku;
  });
}

export async function getOfflineAudioDoku(
  scope: OfflineCacheScope,
  audioDokuId: string,
): Promise<AudioDoku | null> {
  return withLicensedRead(scope, null, async (db) => {
    const entry = await db.get('offline-audio-dokus', createCacheKey(scope, audioDokuId));
    if (!entry || !isEntryInScope(entry, scope)) return null;

    const audioDoku = { ...entry.audioDoku };

    // Replace cover image
    if (audioDoku.coverImageUrl) {
      const blobUrl = await getBlobUrlForDb(db, scope, audioDoku.coverImageUrl);
      if (blobUrl) audioDoku.coverImageUrl = blobUrl;
    }

    // Replace audio URL
    if (audioDoku.audioUrl) {
      const blobUrl = await getBlobUrlForDb(db, scope, audioDoku.audioUrl);
      if (blobUrl) audioDoku.audioUrl = blobUrl;
    }

    return audioDoku;
  });
}

export async function getOfflineGeneratedAudio(
  scope: OfflineCacheScope,
  entryId: string,
): Promise<GeneratedAudioLibraryEntry | null> {
  return withLicensedRead(scope, null, async (db) => {
    const entry = await db.get('offline-generated-audios', createCacheKey(scope, entryId));
    if (!entry || !isEntryInScope(entry, scope)) return null;

    const generatedAudio = { ...entry.generatedAudio };
    if (generatedAudio.coverImageUrl) {
      const coverBlob = await getBlobUrlForDb(db, scope, generatedAudio.coverImageUrl);
      if (coverBlob) generatedAudio.coverImageUrl = coverBlob;
    }
    if (generatedAudio.audioUrl) {
      const audioBlob = await getBlobUrlForDb(db, scope, generatedAudio.audioUrl);
      if (audioBlob) generatedAudio.audioUrl = audioBlob;
    }

    return generatedAudio;
  });
}
