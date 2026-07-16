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
const DB_OPEN_TIMEOUT_MS = 1200;
const DB_READ_TIMEOUT_MS = 1500;
const DB_WRITE_TIMEOUT_MS = 3000;

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
        if (isDbUnavailableError(retryError)) {
          markDbUnavailable(retryError);
          return fallback;
        }
        throw retryError;
      }
    }
    if (isDbUnavailableError(error)) {
      markDbUnavailable(error);
      return fallback;
    }
    throw error;
  }
}

async function withDbWriteFallback(
  writer: (db: IDBPDatabase<TaleaOfflineDB>) => Promise<void>
): Promise<void> {
  try {
    const db = await getDb();
    await withTimeout(writer(db), DB_WRITE_TIMEOUT_MS, 'write');
  } catch (error) {
    if (isDbConnectionClosingError(error)) {
      resetDbConnection();
      try {
        const db = await getDb();
        await withTimeout(writer(db), DB_WRITE_TIMEOUT_MS, 'write');
        return;
      } catch (retryError) {
        if (isDbUnavailableError(retryError)) {
          markDbUnavailable(retryError);
          return;
        }
        throw retryError;
      }
    }
    if (isDbUnavailableError(error)) {
      markDbUnavailable(error);
      return;
    }
    throw error;
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
      if (!isRecoverableDbError(error)) {
        dbDisabled = true;
        throw error;
      }

      console.warn('[Offline] IndexedDB unavailable or unresponsive, trying database reset...');
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

async function fetchAndStoreBlob(
  url: string,
  scope: OfflineCacheScope,
  db?: IDBPDatabase<TaleaOfflineDB>
): Promise<void> {
  if (!url || dbDisabled) return;
  const normalizedScope = assertScope(scope);
  const cacheKey = createCacheKey(normalizedScope, url);

  const writeBlob = async (database: IDBPDatabase<TaleaOfflineDB>) => {
    const existing = await database.get('offline-blobs', cacheKey);
    if (existing) return;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      await database.put('offline-blobs', {
        cacheKey,
        userId: normalizedScope.userId,
        profileId: normalizedScope.profileId,
        url,
        blob,
        mimeType: blob.type,
        savedAt: Date.now(),
      });
    } catch (error) {
      if (isDbUnavailableError(error)) {
        markDbUnavailable(error);
        return;
      }
      console.warn('[Offline] Failed to cache blob:', url, error);
    }
  };

  if (db) {
    await writeBlob(db);
    return;
  }

  await withDbWriteFallback(writeBlob);
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
  const urls: string[] = [];
  if (entry.coverImageUrl) urls.push(entry.coverImageUrl);
  if (entry.audioUrl) urls.push(entry.audioUrl);
  return urls;
}

export async function saveStoryOffline(scope: OfflineCacheScope, story: Story): Promise<void> {
  const normalizedScope = assertScope(scope);
  await withDbWriteFallback(async (db) => {
    await db.put('offline-stories', {
      cacheKey: createCacheKey(normalizedScope, story.id),
      userId: normalizedScope.userId,
      profileId: normalizedScope.profileId,
      id: story.id,
      story,
      savedAt: Date.now(),
    });

    const urls = collectStoryUrls(story);
    await Promise.allSettled(urls.map((url) => fetchAndStoreBlob(url, normalizedScope, db)));
  });
}

export async function saveDokuOffline(scope: OfflineCacheScope, doku: Doku): Promise<void> {
  const normalizedScope = assertScope(scope);
  await withDbWriteFallback(async (db) => {
    await db.put('offline-dokus', {
      cacheKey: createCacheKey(normalizedScope, doku.id),
      userId: normalizedScope.userId,
      profileId: normalizedScope.profileId,
      id: doku.id,
      doku,
      savedAt: Date.now(),
    });

    const urls = collectDokuUrls(doku);
    await Promise.allSettled(urls.map((url) => fetchAndStoreBlob(url, normalizedScope, db)));
  });
}

export async function saveAudioDokuOffline(
  scope: OfflineCacheScope,
  audioDoku: AudioDoku,
): Promise<void> {
  const normalizedScope = assertScope(scope);
  await withDbWriteFallback(async (db) => {
    await db.put('offline-audio-dokus', {
      cacheKey: createCacheKey(normalizedScope, audioDoku.id),
      userId: normalizedScope.userId,
      profileId: normalizedScope.profileId,
      id: audioDoku.id,
      audioDoku,
      savedAt: Date.now(),
    });

    const urls = collectAudioDokuUrls(audioDoku);
    await Promise.allSettled(urls.map((url) => fetchAndStoreBlob(url, normalizedScope, db)));
  });
}

export async function saveGeneratedAudioOffline(
  scope: OfflineCacheScope,
  entry: GeneratedAudioLibraryEntry,
): Promise<void> {
  const normalizedScope = assertScope(scope);
  await withDbWriteFallback(async (db) => {
    await db.put('offline-generated-audios', {
      cacheKey: createCacheKey(normalizedScope, entry.id),
      userId: normalizedScope.userId,
      profileId: normalizedScope.profileId,
      id: entry.id,
      generatedAudio: entry,
      savedAt: Date.now(),
    });

    const urls = collectGeneratedAudioUrls(entry);
    await Promise.allSettled(urls.map((url) => fetchAndStoreBlob(url, normalizedScope, db)));
  });
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
    for (const url of collectStoryUrls(entry.story)) allUsedUrls.add(url);
  }

  const dokus = await db.getAll('offline-dokus');
  for (const entry of dokus.filter((item) => isEntryInScope(item, scope))) {
    for (const url of collectDokuUrls(entry.doku)) allUsedUrls.add(url);
  }

  const audioDokus = await db.getAll('offline-audio-dokus');
  for (const entry of audioDokus.filter((item) => isEntryInScope(item, scope))) {
    for (const url of collectAudioDokuUrls(entry.audioDoku)) allUsedUrls.add(url);
  }

  const generatedAudios = await db.getAll('offline-generated-audios');
  for (const entry of generatedAudios.filter((item) => isEntryInScope(item, scope))) {
    for (const url of collectGeneratedAudioUrls(entry.generatedAudio)) allUsedUrls.add(url);
  }

  for (const url of urls) {
    if (!allUsedUrls.has(url)) {
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
  return withDbReadFallback([], async (db) => {
    const entries = await db.getAll('offline-stories');
    return entries
      .filter((entry) => isEntryInScope(entry, scope))
      .map((entry) => entry.story);
  });
}

export async function getAllOfflineDokus(scope: OfflineCacheScope): Promise<Doku[]> {
  return withDbReadFallback([], async (db) => {
    const entries = await db.getAll('offline-dokus');
    return entries
      .filter((entry) => isEntryInScope(entry, scope))
      .map((entry) => entry.doku);
  });
}

export async function getAllOfflineAudioDokus(scope: OfflineCacheScope): Promise<AudioDoku[]> {
  return withDbReadFallback([], async (db) => {
    const entries = await db.getAll('offline-audio-dokus');
    return entries
      .filter((entry) => isEntryInScope(entry, scope))
      .map((entry) => entry.audioDoku);
  });
}

export async function getAllOfflineGeneratedAudios(
  scope: OfflineCacheScope,
): Promise<GeneratedAudioLibraryEntry[]> {
  return withDbReadFallback([], async (db) => {
    const entries = await db.getAll('offline-generated-audios');
    return entries
      .filter((entry) => isEntryInScope(entry, scope))
      .sort((a, b) => b.savedAt - a.savedAt)
      .map((entry) => entry.generatedAudio);
  });
}

export async function getBlobUrl(
  scope: OfflineCacheScope,
  originalUrl: string,
): Promise<string | null> {
  return withDbReadFallback(null, async (db) => {
    return getBlobUrlForDb(db, scope, originalUrl);
  });
}

async function getBlobUrlForDb(
  db: IDBPDatabase<TaleaOfflineDB>,
  scope: OfflineCacheScope,
  originalUrl: string,
): Promise<string | null> {
  const entry = await db.get('offline-blobs', createCacheKey(scope, originalUrl));
  if (!entry || !isEntryInScope(entry, scope)) return null;
  return URL.createObjectURL(entry.blob);
}

export async function getOfflineStory(
  scope: OfflineCacheScope,
  storyId: string,
): Promise<Story | null> {
  return withDbReadFallback(null, async (db) => {
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
  return withDbReadFallback(null, async (db) => {
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
  return withDbReadFallback(null, async (db) => {
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
  return withDbReadFallback(null, async (db) => {
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
