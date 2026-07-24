import { useEffect, useState } from 'react';
import { getBackendUrl } from '../config';

/**
 * useWizardAssets
 * ---------------
 * Fetches the manifest of pre-generated Talea wizard illustrations (character
 * types, hair, eyes, features, …) from the public /ai/wizard-assets endpoint.
 *
 * The manifest is fetched ONCE per app session (module-level cache) and shared
 * across every selector. Components call `assetUrl(group, id)` and fall back to
 * their emoji/icon when an image has not been generated yet — so the wizard
 * works before the assets exist and upgrades automatically once they do.
 */

export type WizardAssetGroup =
  | 'character'
  | 'gender'
  | 'bodyBuild'
  | 'hairColor'
  | 'hairStyle'
  | 'eyeColor'
  | 'specialFeature';

type WizardAssetEntry = { group: string; id: string; key: string; url: string };
type WizardAssetMap = Record<string, string>; // "group/id" -> url

let cachedPromise: Promise<WizardAssetMap> | null = null;

async function fetchManifest(): Promise<WizardAssetMap> {
  try {
    const res = await fetch(`${getBackendUrl()}/ai/wizard-assets`);
    if (!res.ok) return {};
    const data = (await res.json()) as { assets?: Record<string, WizardAssetEntry> };
    const map: WizardAssetMap = {};
    for (const [key, entry] of Object.entries(data.assets ?? {})) {
      if (entry?.url) map[key] = entry.url;
    }
    return map;
  } catch {
    // Wizard must never break because assets are unavailable.
    return {};
  }
}

function loadManifestOnce(): Promise<WizardAssetMap> {
  if (!cachedPromise) cachedPromise = fetchManifest();
  return cachedPromise;
}

export interface WizardAssetsApi {
  ready: boolean;
  /** Returns the generated image URL for an option, or undefined for fallback. */
  assetUrl: (group: WizardAssetGroup, id: string) => string | undefined;
}

export function useWizardAssets(): WizardAssetsApi {
  const [map, setMap] = useState<WizardAssetMap | null>(null);

  useEffect(() => {
    let active = true;
    loadManifestOnce().then((result) => {
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
