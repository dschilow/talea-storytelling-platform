import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Story } from '../types/story';
import type { Doku } from '../types/doku';
import type { AudioDoku } from '../types/audio-doku';

interface OfflineBlobEntry {
  url: string;
  blob: Blob;
  mimeType: string;
  savedAt: number;
}

interface OfflineStoryEntry {
  id: string;
  story: Story;
  savedAt: number;
}

interface OfflineDokuEntry {
  id: string;
  doku: Doku;
  savedAt: number;
}

interface OfflineAudioDokuEntry {
  id: string;
  audioDoku: AudioDoku;
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
  'offline-blobs': {
    key: string;
    value: OfflineBlobEntry;
  };
}

const DB_NAME = 'talea-offline';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<TaleaOfflineDB> | null = null;

async function getDb(): Promise<IDBPDatabase<TaleaOfflineDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<TaleaOfflineDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('offline-stories')) {
        db.createObjectStore('offline-stories', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('offline-dokus')) {
        db.createObjectStore('offline-dokus', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('offline-audio-dokus')) {
        db.createObjectStore('offline-audio-dokus', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('offline-blobs')) {
        db.createObjectStore('offline-blobs', { keyPath: 'url' });
      }
    },
  });

  return dbInstance;
}

async function fetchAndStoreBlob(url: string): Promise<void> {
  if (!url) return;
  const db = await getDb();

  const existing = await db.get('offline-blobs', url);
  if (existing) return;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    await db.put('offline-blobs', {
      url,
      blob,
      mimeType: blob.type,
      savedAt: Date.now(),
    });
  } catch (error) {
    console.warn('[Offline] Failed to cache blob:', url, error);
  }
}

function collectStoryUrls(story: Story): string[] {
  const urls: string[] = [];
  if (story.coverImageUrl) urls.push(story.coverImageUrl);
  const chapters = story.chapters || story.pages || [];
  for (const chapter of chapters) {
    if (chapter.imageUrl) urls.push(chapter.imageUrl);
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

export async function saveStoryOffline(story: Story): Promise<void> {
  const db = await getDb();
  await db.put('offline-stories', {
    id: story.id,
    story,
    savedAt: Date.now(),
  });

  const urls = collectStoryUrls(story);
  await Promise.allSettled(urls.map(fetchAndStoreBlob));
}

export async function saveDokuOffline(doku: Doku): Promise<void> {
  const db = await getDb();
  await db.put('offline-dokus', {
    id: doku.id,
    doku,
    savedAt: Date.now(),
  });

  const urls = collectDokuUrls(doku);
  await Promise.allSettled(urls.map(fetchAndStoreBlob));
}

export async function saveAudioDokuOffline(audioDoku: AudioDoku): Promise<void> {
  const db = await getDb();
  await db.put('offline-audio-dokus', {
    id: audioDoku.id,
    audioDoku,
    savedAt: Date.now(),
  });

  const urls = collectAudioDokuUrls(audioDoku);
  await Promise.allSettled(urls.map(fetchAndStoreBlob));
}

export async function removeStoryOffline(storyId: string): Promise<void> {
  const db = await getDb();
  const entry = await db.get('offline-stories', storyId);
  if (!entry) return;

  const urls = collectStoryUrls(entry.story);
  await db.delete('offline-stories', storyId);
  await cleanupOrphanedBlobs(urls);
}

export async function removeDokuOffline(dokuId: string): Promise<void> {
  const db = await getDb();
  const entry = await db.get('offline-dokus', dokuId);
  if (!entry) return;

  const urls = collectDokuUrls(entry.doku);
  await db.delete('offline-dokus', dokuId);
  await cleanupOrphanedBlobs(urls);
}

export async function removeAudioDokuOffline(audioDokuId: string): Promise<void> {
  const db = await getDb();
  const entry = await db.get('offline-audio-dokus', audioDokuId);
  if (!entry) return;

  const urls = collectAudioDokuUrls(entry.audioDoku);
  await db.delete('offline-audio-dokus', audioDokuId);
  await cleanupOrphanedBlobs(urls);
}

async function cleanupOrphanedBlobs(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  const db = await getDb();

  const allUsedUrls = new Set<string>();

  const stories = await db.getAll('offline-stories');
  for (const s of stories) {
    for (const u of collectStoryUrls(s.story)) allUsedUrls.add(u);
  }

  const dokus = await db.getAll('offline-dokus');
  for (const d of dokus) {
    for (const u of collectDokuUrls(d.doku)) allUsedUrls.add(u);
  }

  const audioDokus = await db.getAll('offline-audio-dokus');
  for (const a of audioDokus) {
    for (const u of collectAudioDokuUrls(a.audioDoku)) allUsedUrls.add(u);
  }

  for (const url of urls) {
    if (!allUsedUrls.has(url)) {
      await db.delete('offline-blobs', url).catch(() => {});
    }
  }
}

export async function isStorySaved(storyId: string): Promise<boolean> {
  const db = await getDb();
  const entry = await db.get('offline-stories', storyId);
  return !!entry;
}

export async function isDokuSaved(dokuId: string): Promise<boolean> {
  const db = await getDb();
  const entry = await db.get('offline-dokus', dokuId);
  return !!entry;
}

export async function isAudioDokuSaved(audioDokuId: string): Promise<boolean> {
  const db = await getDb();
  const entry = await db.get('offline-audio-dokus', audioDokuId);
  return !!entry;
}

export async function getAllSavedIds(): Promise<{
  stories: string[];
  dokus: string[];
  audioDokus: string[];
}> {
  const db = await getDb();
  const [stories, dokus, audioDokus] = await Promise.all([
    db.getAllKeys('offline-stories'),
    db.getAllKeys('offline-dokus'),
    db.getAllKeys('offline-audio-dokus'),
  ]);
  return {
    stories: stories as string[],
    dokus: dokus as string[],
    audioDokus: audioDokus as string[],
  };
}

export async function getBlobUrl(originalUrl: string): Promise<string | null> {
  const db = await getDb();
  const entry = await db.get('offline-blobs', originalUrl);
  if (!entry) return null;
  return URL.createObjectURL(entry.blob);
}

export async function getOfflineStory(storyId: string): Promise<Story | null> {
  const db = await getDb();
  const entry = await db.get('offline-stories', storyId);
  return entry?.story ?? null;
}

export async function getOfflineDoku(dokuId: string): Promise<Doku | null> {
  const db = await getDb();
  const entry = await db.get('offline-dokus', dokuId);
  return entry?.doku ?? null;
}

export async function getOfflineAudioDoku(audioDokuId: string): Promise<AudioDoku | null> {
  const db = await getDb();
  const entry = await db.get('offline-audio-dokus', audioDokuId);
  return entry?.audioDoku ?? null;
}
