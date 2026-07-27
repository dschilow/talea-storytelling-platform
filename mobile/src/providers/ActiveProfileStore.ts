import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { storage, StorageKeys, scopedKey } from '@/lib/storage';

/**
 * Active child-profile id, ported from frontend/lib/active-profile.ts.
 *
 * This lives outside React state because `useBackend()` needs it synchronously
 * when it builds the client, and because AsyncStorage is async on native — the
 * value is hydrated once at startup into an in-memory cache that reads
 * synchronously from then on.
 */

const cache = new Map<string, string | null>();
const listeners = new Set<() => void>();
let hydrated = false;

function notify() {
  listeners.forEach((listener) => listener());
}

function keyFor(userId: string | null): string {
  return scopedKey(StorageKeys.activeProfile, userId);
}

export function subscribeActiveProfileChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getStoredActiveProfileId(userId: string | null): string | null {
  return cache.get(keyFor(userId)) ?? null;
}

export function setStoredActiveProfileId(userId: string | null, profileId: string): void {
  const key = keyFor(userId);
  if (cache.get(key) === profileId) return;
  cache.set(key, profileId);
  void storage.setString(key, profileId);
  notify();
}

export function clearStoredActiveProfileId(userId: string | null): void {
  const key = keyFor(userId);
  if (cache.get(key) == null) return;
  cache.set(key, null);
  void storage.remove(key);
  notify();
}

/** Hydrates the in-memory cache for a user. Safe to call repeatedly. */
export async function hydrateActiveProfileId(userId: string | null): Promise<string | null> {
  const key = keyFor(userId);
  const stored = await storage.getString(key);
  cache.set(key, stored);
  hydrated = true;
  notify();
  return stored;
}

export function isActiveProfileHydrated(): boolean {
  return hydrated;
}

/**
 * Subscribes a component to the active profile id for the given user, hydrating
 * from storage on first mount.
 */
export function useActiveProfileId(userId: string | null): string | null {
  useEffect(() => {
    void hydrateActiveProfileId(userId);
  }, [userId]);

  const getSnapshot = useCallback(() => getStoredActiveProfileId(userId), [userId]);

  return useSyncExternalStore(subscribeActiveProfileChanges, getSnapshot, getSnapshot);
}
