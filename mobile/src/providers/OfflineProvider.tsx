import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as FileSystem from 'expo-file-system/legacy';

import { storage, StorageKeys } from '@/lib/storage';
import { BACKEND_URL } from '@/config';

/**
 * Offline library — the native counterpart to the web's IndexedDB store
 * (frontend/utils/offlineDb.ts + OfflineStorageContext).
 *
 * A downloaded story keeps its full chapter text plus every image mirrored into
 * the app's document directory, so a saved story reads identically on a plane.
 * Audio is handled separately by the audio cache, which already writes playable
 * files to disk.
 *
 * Connectivity is probed rather than trusted: on mobile, "has a network
 * interface" and "can reach the backend" diverge constantly (captive portals,
 * dead zones with a bar of signal), so we do a cheap HEAD against the backend.
 */

const IMAGE_DIR = `${FileSystem.documentDirectory}talea-offline/`;
const CONNECTIVITY_TIMEOUT_MS = 4000;
const CONNECTIVITY_INTERVAL_MS = 20000;

export interface OfflineStory {
  id: string;
  title: string;
  summary?: string;
  coverImageUrl?: string;
  chapters: Array<{ id?: string; title: string; content: string; imageUrl?: string; order: number }>;
  savedAt: string;
  /** Local image mirror: original URL -> file:// URI */
  imageMap: Record<string, string>;
}

export interface OfflineDoku {
  id: string;
  title: string;
  topic?: string;
  coverImageUrl?: string;
  sections: Array<{ title: string; content: string; imageUrl?: string; order: number }>;
  savedAt: string;
  imageMap: Record<string, string>;
}

interface OfflineContextValue {
  isOnline: boolean;
  /** True until the first connectivity probe resolves. */
  isCheckingConnectivity: boolean;
  stories: OfflineStory[];
  dokus: OfflineDoku[];
  isSaving: boolean;

  isStorySaved: (storyId: string) => boolean;
  isDokuSaved: (dokuId: string) => boolean;
  saveStory: (story: Omit<OfflineStory, 'savedAt' | 'imageMap'>) => Promise<void>;
  saveDoku: (doku: Omit<OfflineDoku, 'savedAt' | 'imageMap'>) => Promise<void>;
  removeStory: (storyId: string) => Promise<void>;
  removeDoku: (dokuId: string) => Promise<void>;
  getStory: (storyId: string) => OfflineStory | null;
  getDoku: (dokuId: string) => OfflineDoku | null;
  clearAll: () => Promise<void>;
  /** Resolves a remote image URL to its local mirror when one exists. */
  resolveImage: (url: string | undefined) => string | undefined;
  recheckConnectivity: () => Promise<boolean>;
  storageUsage: () => Promise<{ items: number; bytes: number }>;
}

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined);

async function probeConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONNECTIVITY_TIMEOUT_MS);
    const response = await fetch(`${BACKEND_URL}/health`, { method: 'GET', signal: controller.signal });
    clearTimeout(timeout);
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

async function ensureImageDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(IMAGE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
  }
}

function imageFileName(url: string): string {
  let hash = 2166136261;
  for (let i = 0; i < url.length; i += 1) {
    hash ^= url.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const extension = /\.(png|jpe?g|webp|gif)(\?|$)/i.exec(url)?.[1] ?? 'jpg';
  return `${(hash >>> 0).toString(16)}.${extension}`;
}

/** Mirrors a batch of remote images, returning a url -> local-uri map. */
async function mirrorImages(urls: (string | undefined)[]): Promise<Record<string, string>> {
  await ensureImageDir();
  const unique = Array.from(new Set(urls.filter((url): url is string => Boolean(url && /^https?:/i.test(url)))));

  const entries = await Promise.all(
    unique.map(async (url) => {
      const target = `${IMAGE_DIR}${imageFileName(url)}`;
      try {
        const existing = await FileSystem.getInfoAsync(target);
        if (existing.exists) return [url, target] as const;

        const result = await FileSystem.downloadAsync(url, target);
        return result.status === 200 ? ([url, target] as const) : null;
      } catch {
        // A failed image must not fail the whole download — the reader falls
        // back to the remote URL, which simply shows a placeholder offline.
        return null;
      }
    })
  );

  return Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null));
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isCheckingConnectivity, setIsCheckingConnectivity] = useState(true);
  const [stories, setStories] = useState<OfflineStory[]>([]);
  const [dokus, setDokus] = useState<OfflineDoku[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Load the saved library once.
  useEffect(() => {
    void Promise.all([
      storage.getJSON<OfflineStory[]>(StorageKeys.offlineStories, []),
      storage.getJSON<OfflineDoku[]>(StorageKeys.offlineDokus, []),
    ]).then(([savedStories, savedDokus]) => {
      setStories(savedStories);
      setDokus(savedDokus);
    });
  }, []);

  const recheckConnectivity = useCallback(async () => {
    const online = await probeConnectivity();
    setIsOnline(online);
    setIsCheckingConnectivity(false);
    return online;
  }, []);

  useEffect(() => {
    void recheckConnectivity();
    const interval = setInterval(() => void recheckConnectivity(), CONNECTIVITY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [recheckConnectivity]);

  const saveStory = useCallback<OfflineContextValue['saveStory']>(async (story) => {
    setIsSaving(true);
    try {
      const imageMap = await mirrorImages([story.coverImageUrl, ...story.chapters.map((chapter) => chapter.imageUrl)]);
      const record: OfflineStory = { ...story, savedAt: new Date().toISOString(), imageMap };

      setStories((prev) => {
        const next = [record, ...prev.filter((entry) => entry.id !== story.id)];
        void storage.setJSON(StorageKeys.offlineStories, next);
        return next;
      });
    } finally {
      setIsSaving(false);
    }
  }, []);

  const saveDoku = useCallback<OfflineContextValue['saveDoku']>(async (doku) => {
    setIsSaving(true);
    try {
      const imageMap = await mirrorImages([doku.coverImageUrl, ...doku.sections.map((section) => section.imageUrl)]);
      const record: OfflineDoku = { ...doku, savedAt: new Date().toISOString(), imageMap };

      setDokus((prev) => {
        const next = [record, ...prev.filter((entry) => entry.id !== doku.id)];
        void storage.setJSON(StorageKeys.offlineDokus, next);
        return next;
      });
    } finally {
      setIsSaving(false);
    }
  }, []);

  /** Deletes mirrored files that no other saved item still references. */
  const pruneOrphanedImages = useCallback(
    async (nextStories: OfflineStory[], nextDokus: OfflineDoku[], removed: Record<string, string>) => {
      const stillReferenced = new Set<string>();
      for (const entry of [...nextStories, ...nextDokus]) {
        Object.values(entry.imageMap).forEach((uri) => stillReferenced.add(uri));
      }
      await Promise.all(
        Object.values(removed)
          .filter((uri) => !stillReferenced.has(uri))
          .map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {}))
      );
    },
    []
  );

  const removeStory = useCallback(
    async (storyId: string) => {
      const removed = stories.find((entry) => entry.id === storyId)?.imageMap ?? {};
      const next = stories.filter((entry) => entry.id !== storyId);
      setStories(next);
      await storage.setJSON(StorageKeys.offlineStories, next);
      await pruneOrphanedImages(next, dokus, removed);
    },
    [dokus, pruneOrphanedImages, stories]
  );

  const removeDoku = useCallback(
    async (dokuId: string) => {
      const removed = dokus.find((entry) => entry.id === dokuId)?.imageMap ?? {};
      const next = dokus.filter((entry) => entry.id !== dokuId);
      setDokus(next);
      await storage.setJSON(StorageKeys.offlineDokus, next);
      await pruneOrphanedImages(stories, next, removed);
    },
    [dokus, pruneOrphanedImages, stories]
  );

  const clearAll = useCallback(async () => {
    setStories([]);
    setDokus([]);
    await storage.multiRemove([StorageKeys.offlineStories, StorageKeys.offlineDokus]);
    await FileSystem.deleteAsync(IMAGE_DIR, { idempotent: true }).catch(() => {});
  }, []);

  const imageLookup = useMemo(() => {
    const map: Record<string, string> = {};
    for (const entry of [...stories, ...dokus]) {
      Object.assign(map, entry.imageMap);
    }
    return map;
  }, [stories, dokus]);

  const resolveImage = useCallback((url: string | undefined) => (url ? (imageLookup[url] ?? url) : undefined), [imageLookup]);

  const storageUsage = useCallback(async () => {
    let bytes = 0;
    try {
      const files = await FileSystem.readDirectoryAsync(IMAGE_DIR);
      const sizes = await Promise.all(
        files.map(async (file) => {
          const info = await FileSystem.getInfoAsync(`${IMAGE_DIR}${file}`);
          return info.exists && 'size' in info ? (info.size ?? 0) : 0;
        })
      );
      bytes = sizes.reduce((total, size) => total + size, 0);
    } catch {
      bytes = 0;
    }
    return { items: stories.length + dokus.length, bytes };
  }, [dokus.length, stories.length]);

  const value = useMemo<OfflineContextValue>(
    () => ({
      isOnline,
      isCheckingConnectivity,
      stories,
      dokus,
      isSaving,
      isStorySaved: (storyId) => stories.some((entry) => entry.id === storyId),
      isDokuSaved: (dokuId) => dokus.some((entry) => entry.id === dokuId),
      saveStory,
      saveDoku,
      removeStory,
      removeDoku,
      getStory: (storyId) => stories.find((entry) => entry.id === storyId) ?? null,
      getDoku: (dokuId) => dokus.find((entry) => entry.id === dokuId) ?? null,
      clearAll,
      resolveImage,
      recheckConnectivity,
      storageUsage,
    }),
    [
      clearAll,
      dokus,
      isCheckingConnectivity,
      isOnline,
      isSaving,
      recheckConnectivity,
      removeDoku,
      removeStory,
      resolveImage,
      saveDoku,
      saveStory,
      storageUsage,
      stories,
    ]
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline(): OfflineContextValue {
  const context = useContext(OfflineContext);
  if (!context) throw new Error('useOffline must be used within an OfflineProvider');
  return context;
}
