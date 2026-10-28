import { APIError } from "encore.dev/api";
import { storyDB } from "../db";
import { chooseSeries, CHARACTER_SERIES_ENGINE, CHARACTER_SERIES_VERSION, nextSeriesEpisode, type CharacterSeriesBible, type SeriesEpisodeLog } from "./core";
import bibles from "./series-bibles.json";

export const SERIES = bibles as CharacterSeriesBible[];

function metadataObject(raw: unknown): any {
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return {}; } }
  return raw && typeof raw === "object" ? raw : {};
}

export async function seriesProgress(userId: string, profileId: string): Promise<Array<{ id: string; title: string; metadata: unknown; character_series_id: string }>> {
  return storyDB.queryAll`
    SELECT id, title, metadata, config::jsonb->>'characterSeriesId' AS character_series_id
    FROM stories
    WHERE user_id = ${userId} AND primary_profile_id = ${profileId} AND status = 'complete'
      AND config::jsonb->>'storybookEngine' = ${CHARACTER_SERIES_ENGINE}
      AND config::jsonb->>'characterSeriesVersion' = ${String(CHARACTER_SERIES_VERSION)}
    ORDER BY created_at ASC, id ASC
  `;
}

export async function loadSeriesHistory(userId: string, profileId: string, seriesId: string): Promise<SeriesEpisodeLog[]> {
  const rows = (await seriesProgress(userId, profileId)).filter((row) => row.character_series_id === seriesId);
  const byEpisode = new Map<number, SeriesEpisodeLog>();
  for (const row of rows) {
    const log = metadataObject(row.metadata)?.characterSeries?.log as SeriesEpisodeLog | undefined;
    if (!log || log.storyId !== row.id || !Number.isSafeInteger(log.episode) || log.episode < 1 || !Array.isArray(log.events) || !log.events.length || !Array.isArray(log.avatarIds) || !Array.isArray(log.relationships) || !Array.isArray(log.openThreads)) {
      throw APIError.failedPrecondition("Die Fortsetzung kann nicht geladen werden: Ein früheres Folgenlog fehlt oder ist unvollständig.");
    }
    byEpisode.set(log.episode, log);
  }
  const logs = [...byEpisode.values()].sort((a, b) => a.episode - b.episode);
  try { nextSeriesEpisode(logs); } catch {
    throw APIError.failedPrecondition("Die Fortsetzung kann nicht geladen werden: Die Folgenzahlen sind nicht streng aufsteigend.");
  }
  return logs;
}

/** Must run within reserveStoryGenerationCapacity's advisory-locked transaction. */
export async function reserveSeries(tx: Awaited<ReturnType<typeof storyDB.begin>>, input: {
  userId: string; profileId: string; requestedId?: string; genre: string;
}): Promise<CharacterSeriesBible> {
  const rows = await tx.queryAll<{ character_series_id: string; count: number }>`
    SELECT config::jsonb->>'characterSeriesId' AS character_series_id, COUNT(*)::int AS count
    FROM stories
    WHERE user_id = ${input.userId} AND primary_profile_id = ${input.profileId} AND status = 'complete'
      AND config::jsonb->>'storybookEngine' = ${CHARACTER_SERIES_ENGINE}
      AND config::jsonb->>'characterSeriesVersion' = ${String(CHARACTER_SERIES_VERSION)}
    GROUP BY config::jsonb->>'characterSeriesId'
  `;
  const pool = await tx.queryAll<{ id: string }>`
    SELECT id FROM character_pool WHERE is_active = TRUE AND id = ANY(${SERIES.map((series) => series.characterId)})
  `;
  const availableIds = new Set(pool.map((row) => row.id));
  const available = SERIES.filter((entry) => availableIds.has(entry.characterId));
  if (!available.length) throw APIError.failedPrecondition("Zurzeit ist keine Figurenwelt verfügbar.");
  const counts = Object.fromEntries(rows.map((row) => [row.character_series_id, row.count]));
  const activeRows = await tx.queryAll<{ character_series_id: string }>`
    SELECT config::jsonb->>'characterSeriesId' AS character_series_id FROM stories
    WHERE user_id = ${input.userId} AND primary_profile_id = ${input.profileId}
      AND status = 'generating' AND config::jsonb->>'storybookEngine' = ${CHARACTER_SERIES_ENGINE}
      AND config::jsonb->>'characterSeriesVersion' = ${String(CHARACTER_SERIES_VERSION)}
  `;
  const activeIds = new Set(activeRows.map((row) => row.character_series_id));
  const idle = available.filter((entry) => !activeIds.has(entry.id));
  if (!input.requestedId && !idle.length) throw APIError.alreadyExists("Für alle verfügbaren Figurenwelten wird bereits eine Folge erstellt.");
  const matching = idle.filter((entry) => entry.genres.includes(input.genre));
  if (!input.requestedId && !matching.length) {
    if (available.some((entry) => entry.genres.includes(input.genre))) {
      throw APIError.alreadyExists("Für die passenden Figurenwelten wird bereits eine Folge erstellt.");
    }
    throw APIError.failedPrecondition("Für diese Welt gibt es noch keine passende Figurenserie. Wähle eine Figur selbst aus.");
  }
  const selected = input.requestedId ? available.find((entry) => entry.id === input.requestedId) : chooseSeries(matching, input.genre, counts);
  if (!selected) throw APIError.invalidArgument("Diese Figurenserie ist nicht verfügbar.");
  if (activeIds.has(selected.id)) throw APIError.alreadyExists("Für diese Figurenwelt wird bereits eine Folge erstellt. Bitte warte, bis sie fertig ist.");
  return selected;
}
