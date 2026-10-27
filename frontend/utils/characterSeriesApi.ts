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
