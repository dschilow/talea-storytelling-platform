import { getBackendUrl } from '../config';
import type {
  GeneratedAudioLibraryEntry,
  GeneratedAudioSourceType,
} from '../types/generated-audio';

export function sortGeneratedAudioEntries(
  items: GeneratedAudioLibraryEntry[],
): GeneratedAudioLibraryEntry[] {
  return [...items].sort((a, b) => {
    const orderA = Number.isFinite(a.itemOrder as number)
      ? (a.itemOrder as number)
      : Number.MAX_SAFE_INTEGER;
    const orderB = Number.isFinite(b.itemOrder as number)
      ? (b.itemOrder as number)
      : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

/**
 * Every generated (TTS) audio part that belongs to one story or doku, in
 * playback order. Returns an empty list on an older backend deployment without
 * the by-source endpoint.
 */
export async function fetchGeneratedAudioBySource(
  getToken: () => Promise<string | null>,
  sourceType: GeneratedAudioSourceType,
  sourceId: string,
): Promise<GeneratedAudioLibraryEntry[]> {
  const token = await getToken();
  const response = await fetch(`${getBackendUrl()}/story/audio-library/by-source`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ sourceType, sourceId }),
  });

  if (response.status === 404) return [];

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || `HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { items?: GeneratedAudioLibraryEntry[] };
  return Array.isArray(payload.items) ? sortGeneratedAudioEntries(payload.items) : [];
}
