import { APIError } from "encore.dev/api";
import { storyDB } from "../db";
import { chooseSeries, CHARACTER_SERIES_ENGINE, CHARACTER_SERIES_VERSION, nextSeriesEpisode, type CharacterSeriesBible, type SeriesEpisodeLog } from "./core";
import bibles from "./series-bibles.json";

export const SERIES = bibles as CharacterSeriesBible[];

let resetTable: Promise<void> | undefined;
/**
 * Admin test resets (2026-10-28: "4 Folgen erlebt" after a day of tests). The migration creates the table too; creating
 * it here on first use means a boot that skipped the migration run never breaks the series list.
 */
export function ensureSeriesResetTable(): Promise<void> {
  if (!resetTable) {
    resetTable = storyDB.exec`CREATE TABLE IF NOT EXISTS character_series_resets (user_id TEXT NOT NULL, profile_id TEXT NOT NULL, series_id TEXT NOT NULL, reset_at TIMESTAMP NOT NULL, reset_by TEXT NOT NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, profile_id, series_id))`
      .catch((error) => { resetTable = undefined; throw error; });
  }
  return resetTable;
}

function metadataObject(raw: unknown): any {
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return {}; } }
  return raw && typeof raw === "object" ? raw : {};
}

/** The episodes that count: complete series stories of this profile, from after the series' last admin reset. */
export async function seriesProgress(userId: string, profileId: string): Promise<Array<{ id: string; title: string; metadata: unknown; character_series_id: string }>> {
  await ensureSeriesResetTable();
  return storyDB.queryAll`
    SELECT s.id, s.title, s.metadata, s.config::jsonb->>'characterSeriesId' AS character_series_id
    FROM stories s
    LEFT JOIN character_series_resets r
      ON r.user_id = s.user_id AND r.profile_id = s.primary_profile_id AND r.series_id = s.config::jsonb->>'characterSeriesId'
    WHERE s.user_id = ${userId} AND s.primary_profile_id = ${profileId} AND s.status = 'complete'
      AND s.config::jsonb->>'storybookEngine' = ${CHARACTER_SERIES_ENGINE}
      AND s.config::jsonb->>'characterSeriesVersion' = ${String(CHARACTER_SERIES_VERSION)}
      AND (r.reset_at IS NULL OR s.created_at > r.reset_at)
    ORDER BY s.created_at ASC, s.id ASC
  `;
}

/**
 * Admin test reset: the series starts again at episode 1 for this profile. Nothing is deleted — the earlier stories stay
 * readable, they only stop counting for the counter and the continuation. The reset point is the newest story of the
 * series (also one still generating) and never leaves the database, so the timestamp-without-zone column cannot shift.
 */
export async function resetSeriesProgress(input: { userId: string; profileId: string; seriesId: string; resetBy: string }): Promise<{ resetEpisodes: number }> {
  const counted = (await seriesProgress(input.userId, input.profileId)).filter((row) => row.character_series_id === input.seriesId).length;
  await storyDB.exec`
    INSERT INTO character_series_resets (user_id, profile_id, series_id, reset_at, reset_by)
    SELECT s.user_id, s.primary_profile_id, ${input.seriesId}::text, MAX(s.created_at), ${input.resetBy}::text
    FROM stories s
    WHERE s.user_id = ${input.userId} AND s.primary_profile_id = ${input.profileId}
      AND s.config::jsonb->>'storybookEngine' = ${CHARACTER_SERIES_ENGINE}
      AND s.config::jsonb->>'characterSeriesId' = ${input.seriesId}
    GROUP BY s.user_id, s.primary_profile_id
    ON CONFLICT (user_id, profile_id, series_id) DO UPDATE
      SET reset_at = GREATEST(character_series_resets.reset_at, EXCLUDED.reset_at), reset_by = EXCLUDED.reset_by, updated_at = CURRENT_TIMESTAMP
  `;
  return { resetEpisodes: counted };
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
  await ensureSeriesResetTable();
  const rows = await tx.queryAll<{ character_series_id: string; count: number }>`
    SELECT s.config::jsonb->>'characterSeriesId' AS character_series_id, COUNT(*)::int AS count
    FROM stories s
    LEFT JOIN character_series_resets r
      ON r.user_id = s.user_id AND r.profile_id = s.primary_profile_id AND r.series_id = s.config::jsonb->>'characterSeriesId'
    WHERE s.user_id = ${input.userId} AND s.primary_profile_id = ${input.profileId} AND s.status = 'complete'
      AND s.config::jsonb->>'storybookEngine' = ${CHARACTER_SERIES_ENGINE}
      AND s.config::jsonb->>'characterSeriesVersion' = ${String(CHARACTER_SERIES_VERSION)}
      AND (r.reset_at IS NULL OR s.created_at > r.reset_at)
    GROUP BY s.config::jsonb->>'characterSeriesId'
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
