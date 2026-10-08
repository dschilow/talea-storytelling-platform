import { useEffect, useState } from 'react';

import { BACKEND_URL } from '@/config';
import { storage, StorageKeys } from '@/lib/storage';

/**
 * The pre-generated Talea illustrations (watercolour art for characters, story
 * categories, moods, doku domains, navigation…), ported from
 * frontend/hooks/useWizardAssets.ts.
 *
 * The manifest comes from the public `/ai/wizard-assets` endpoint with signed
 * URLs that change on every request, so images are cached by their stable
 * object key instead (`cacheKey` below). The last manifest is kept in storage:
 * offline, the expired URL is never fetched — the disk cache answers by key.
 */

export type WizardAssetGroup =
  | 'character'
  | 'gender'
  | 'bodyBuild'
  | 'hairColor'
  | 'hairStyle'
  | 'eyeColor'
  | 'specialFeature'
  | 'storyCategory'
  | 'storyLength'
  | 'storyFeeling'
  | 'storyWish'
  | 'dokuDomain'
  | 'dokuAge'
  | 'dokuDepth'
  | 'dokuPerspective'
  | 'dokuTone'
  | 'dokuLength'
  | 'navTab';

type WizardAssetEntry = { group: string; id: string; key: string; url: string };
type WizardAssetMap = Record<string, string>; // "group/id" -> url

let cachedPromise: Promise<WizardAssetMap> | null = null;
let resolved: WizardAssetMap | null = null;

async function fetchManifest(): Promise<WizardAssetMap> {
  const stored = await storage.getJSON<WizardAssetMap>(StorageKeys.wizardAssets, {});
  try {
    const response = await fetch(`${BACKEND_URL}/ai/wizard-assets`);
    if (!response.ok) return stored;
    const data = (await response.json()) as { assets?: Record<string, WizardAssetEntry> };
    const map: WizardAssetMap = {};
    for (const [key, entry] of Object.entries(data.assets ?? {})) {
      if (entry?.url) map[key] = entry.url;
    }
    if (Object.keys(map).length > 0) void storage.setJSON(StorageKeys.wizardAssets, map);
    return Object.keys(map).length > 0 ? map : stored;
  } catch {
    // Illustrations are decoration; the UI always has an icon fallback.
    return stored;
  }
}

function loadManifestOnce(): Promise<WizardAssetMap> {
  if (!cachedPromise) {
    cachedPromise = fetchManifest().then((map) => {
      resolved = map;
      return map;
    });
  }
  return cachedPromise;
}

/** Stable disk-cache key for an illustration, independent of URL signing. */
export function wizardAssetCacheKey(group: WizardAssetGroup, id: string): string {
  return `wizard-assets/${group}/${id}`;
}

export interface WizardAssetsApi {
  ready: boolean;
  /** The image URL for an option, or undefined while unavailable (use the fallback). */
  assetUrl: (group: WizardAssetGroup, id: string) => string | undefined;
}

export function useWizardAssets(): WizardAssetsApi {
  const [map, setMap] = useState<WizardAssetMap | null>(resolved);

  useEffect(() => {
    if (resolved) return;
    let active = true;
    void loadManifestOnce().then((result) => {
      if (active) setMap(result);
    });
    return () => {
      active = false;
    };
  }, []);

  return {
    ready: map !== null,
    assetUrl: (group, id) => map?.[`${group}/${id}`],
  };
}
