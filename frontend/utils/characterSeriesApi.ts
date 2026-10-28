import { getBackendUrl } from '../config';
import type { CharacterSeriesChoice } from '../screens/Story/wizard-steps/StepCharacterSeries';

/** The catalogue endpoint may be newer than the generated Encore client. */
export async function fetchCharacterSeries(
  getToken: () => Promise<string | null>,
  profileId?: string | null,
  signal?: AbortSignal,
): Promise<CharacterSeriesChoice[]> {
  const token = await getToken();
  const url = new URL('/story/character-series', getBackendUrl());
  if (profileId) url.searchParams.set('profileId', profileId);
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
    signal,
  });
  if (!response.ok) throw new Error(`Figurenwelten: HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { series?: unknown }).series)) {
    throw new Error('Ungültige Antwort für Figurenwelten');
  }
  return (payload as { series: CharacterSeriesChoice[] }).series;
}

/** Admin test tool: the series counter of this profile starts again at 0; the earlier stories stay in the library. */
export async function resetCharacterSeries(
  getToken: () => Promise<string | null>,
  seriesId: string,
  profileId?: string | null,
): Promise<{ seriesId: string; resetEpisodes: number }> {
  const token = await getToken();
  const response = await fetch(new URL('/story/character-series/reset', getBackendUrl()).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    credentials: 'include',
    body: JSON.stringify({ seriesId, ...(profileId ? { profileId } : {}) }),
  });
  if (!response.ok) {
    const detail = await response.json().then((body: { message?: unknown }) => (typeof body?.message === 'string' ? body.message : ''), () => '');
    throw new Error(detail || `Zähler zurücksetzen: HTTP ${response.status}`);
  }
  return (await response.json()) as { seriesId: string; resetEpisodes: number };
}
