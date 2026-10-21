/**
 * Library persistence: schema guard, seed sync and queries (story database).
 *
 * The seed is synced on first use in every process. It never overwrites an
 * admin's work: characters are only refreshed while they are untouched seed
 * rows, planned episodes only while nobody wrote them, and seeded episode texts
 * only while they still are the seed's own text.
 */

import { storyDB } from "../db";
import { SEED_EPISODES, SEED_SEASONS, SEED_SERIES, episodeId, seedHash } from "./seed";
import type { AudioScript, ContentStatus, EpisodeAudio, EpisodeContent, EpisodeScores, SeriesBible, SeriesCharacter, SeriesInfo } from "./types";
import type { VoiceOverride } from "./audio/casting";

export interface GenerationInfo {
  source?: "seed" | "pipeline" | "manual";
  seedHash?: string;
  planEdited?: boolean;
  step?: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  costUSD?: number;
  textCostUSD?: number;
  imageCostUSD?: number;
  writes?: number;
  models?: Record<string, string>;
  stages?: Array<{ stage: string; model?: string; costUSD?: number; seconds?: number; note?: string }>;
  idea?: string;
  /** Pictures that could not be drawn; the admin redraws them by hand. */
  issues?: string[];
}

export interface EpisodePlan {
  fields: Record<string, string>;
  clue: string;
}

export interface EpisodeRecord {
  id: string;
  seriesId: string;
  season: number;
  episode: number;
  title: string;
  logline: string;
  plan: EpisodePlan;
  idea: string | null;
  status: ContentStatus;
  content: EpisodeContent | null;
  bibleVersion: number | null;
  scores: EpisodeScores | null;
  generation: GenerationInfo;
  publishAt: Date | null;
  /** The audio drama without its screenplay (getEpisodeAudioScript loads that). */
  audio: EpisodeAudio | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SeriesRecord {
  info: SeriesInfo;
  activeBibleVersion: number;
}

export interface CharacterRecord extends SeriesCharacter {
  active: boolean;
  sortOrder: number;
  origin: "seed" | "admin";
}

type EpisodeRow = {
  id: string;
  series_id: string;
  season: number;
  episode: number;
  title: string;
  logline: string;
  plan: unknown;
  idea: string | null;
  status: ContentStatus;
  content: unknown;
  bible_version: number | null;
  scores: unknown;
  generation: unknown;
  publish_at: Date | null;
  audio: unknown;
  created_at: Date;
  updated_at: Date;
};

/** JSONB comes back parsed; rows written as JSON strings by older drivers come back as text. */
export function jsonValue<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

/** Encore's driver sends a string parameter as JSON text; this round trip stores a real object (see book-generation.ts). */
const json = (value: unknown) => JSON.stringify(value ?? null);

function toEpisode(row: EpisodeRow): EpisodeRecord {
  return {
    id: row.id,
    seriesId: row.series_id,
    season: row.season,
    episode: row.episode,
    title: row.title,
    logline: row.logline,
    plan: jsonValue<EpisodePlan>(row.plan, { fields: {}, clue: "" }),
    idea: row.idea,
    status: row.status,
    content: jsonValue<EpisodeContent | null>(row.content, null),
    bibleVersion: row.bible_version,
    scores: jsonValue<EpisodeScores | null>(row.scores, null),
    generation: jsonValue<GenerationInfo>(row.generation, {}),
    publishAt: row.publish_at ? new Date(row.publish_at) : null,
    audio: jsonValue<EpisodeAudio | null>(row.audio, null),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/** Readers see an episode once it is approved and its release time has come. */
export function isVisible(episode: Pick<EpisodeRecord, "status" | "publishAt" | "content">, now = new Date()): boolean {
  return Boolean(episode.content) && (episode.status === "approved" || episode.status === "published") &&
    Boolean(episode.publishAt) && episode.publishAt!.getTime() <= now.getTime();
}

let ready: Promise<void> | null = null;

export function ensureLibrary(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await ensureSchema();
      await syncSeed();
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

/** Same tables as migration 45 — Railway has skipped migration files before, so the service guards itself. */
async function ensureSchema(): Promise<void> {
  await storyDB.exec`CREATE TABLE IF NOT EXISTS library_series (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, info JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'active', sort_order INTEGER NOT NULL DEFAULT 0, active_bible_version INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
  await storyDB.exec`CREATE TABLE IF NOT EXISTS library_series_bibles (series_id TEXT NOT NULL REFERENCES library_series(id) ON DELETE CASCADE, version INTEGER NOT NULL, bible JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (series_id, version))`;
  await storyDB.exec`CREATE TABLE IF NOT EXISTS library_characters (series_id TEXT NOT NULL REFERENCES library_series(id) ON DELETE CASCADE, id TEXT NOT NULL, data JSONB NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (series_id, id))`;
  await storyDB.exec`CREATE TABLE IF NOT EXISTS library_episodes (id TEXT PRIMARY KEY, series_id TEXT NOT NULL REFERENCES library_series(id) ON DELETE CASCADE, season INTEGER NOT NULL, episode INTEGER NOT NULL, title TEXT NOT NULL, logline TEXT NOT NULL DEFAULT '', plan JSONB NOT NULL DEFAULT '{}'::jsonb, idea TEXT, status TEXT NOT NULL DEFAULT 'planned', content JSONB, bible_version INTEGER, scores JSONB, generation JSONB NOT NULL DEFAULT '{}'::jsonb, publish_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (series_id, season, episode))`;
  await storyDB.exec`CREATE INDEX IF NOT EXISTS idx_library_episodes_visible ON library_episodes(status, publish_at)`;
  await storyDB.exec`CREATE TABLE IF NOT EXISTS library_progress (profile_id TEXT NOT NULL, episode_id TEXT NOT NULL REFERENCES library_episodes(id) ON DELETE CASCADE, user_id TEXT NOT NULL, chapter_index INTEGER NOT NULL DEFAULT 0, started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, finished_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (profile_id, episode_id))`;
  await storyDB.exec`CREATE INDEX IF NOT EXISTS idx_library_progress_user ON library_progress(user_id)`;
  // Audio dramas (migration 46): the state in `audio`, the screenplay apart — lists never load it.
  await storyDB.exec`ALTER TABLE library_episodes ADD COLUMN IF NOT EXISTS audio JSONB`;
  await storyDB.exec`ALTER TABLE library_episodes ADD COLUMN IF NOT EXISTS audio_script JSONB`;
  await storyDB.exec`CREATE TABLE IF NOT EXISTS library_voice_cast (series_id TEXT NOT NULL REFERENCES library_series(id) ON DELETE CASCADE, speaker_id TEXT NOT NULL, voice_id TEXT, persona TEXT, source TEXT NOT NULL DEFAULT 'admin', updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (series_id, speaker_id))`;
}

async function syncSeed(): Promise<void> {
  for (const { series, bible } of SEED_SERIES) {
    const { characters, ...bibleWithoutCast } = bible;
    await storyDB.exec`
      INSERT INTO library_series (id, slug, info, status, sort_order, active_bible_version)
      VALUES (${series.id}, ${series.slug}, (${json(series)}::jsonb #>> '{}')::jsonb, ${series.status}, ${series.sortOrder}, ${series.activeBibleVersion})
      ON CONFLICT (id) DO UPDATE SET info = EXCLUDED.info, sort_order = EXCLUDED.sort_order, updated_at = CURRENT_TIMESTAMP
    `;
    await storyDB.exec`
      INSERT INTO library_series_bibles (series_id, version, bible)
      VALUES (${series.id}, ${bible.version}, (${json(bibleWithoutCast)}::jsonb #>> '{}')::jsonb)
      ON CONFLICT (series_id, version) DO UPDATE SET bible = EXCLUDED.bible
    `;
    for (const [index, character] of characters.entries()) {
      const data = { ...character, origin: "seed", seedHash: seedHash(character) };
      await storyDB.exec`
        INSERT INTO library_characters (series_id, id, data, active, sort_order)
        VALUES (${series.id}, ${character.id}, (${json(data)}::jsonb #>> '{}')::jsonb, TRUE, ${index})
        ON CONFLICT (series_id, id) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP
        WHERE library_characters.data->>'origin' = 'seed' AND library_characters.data->>'seedHash' IS DISTINCT FROM EXCLUDED.data->>'seedHash'
      `;
    }
  }

  for (const season of SEED_SEASONS) {
    for (const entry of season.episodes) {
      const plan: EpisodePlan = { fields: entry.plan, clue: entry.clue };
      await storyDB.exec`
        INSERT INTO library_episodes (id, series_id, season, episode, title, logline, plan, status)
        VALUES (${episodeId(season.seriesId, season.season, entry.episode)}, ${season.seriesId}, ${season.season}, ${entry.episode},
                ${entry.title}, ${entry.logline}, (${json(plan)}::jsonb #>> '{}')::jsonb, 'planned')
        ON CONFLICT (series_id, season, episode) DO UPDATE SET title = EXCLUDED.title, logline = EXCLUDED.logline, plan = EXCLUDED.plan, updated_at = CURRENT_TIMESTAMP
        WHERE library_episodes.status = 'planned' AND library_episodes.content IS NULL AND (library_episodes.generation->>'planEdited') IS NULL
      `;
    }
  }

  for (const seed of SEED_EPISODES) {
    const { seriesId, season, episode, publishAt, ...content } = seed;
    const hash = seedHash(seed);
    const generation: GenerationInfo = { source: "seed", seedHash: hash };
    await storyDB.exec`
      UPDATE library_episodes
      SET content = (${json(content)}::jsonb #>> '{}')::jsonb, title = ${content.title}, status = 'approved', bible_version = 1,
          publish_at = ${new Date(publishAt)}, generation = (${json(generation)}::jsonb #>> '{}')::jsonb, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${episodeId(seriesId, season, episode)}
        AND (content IS NULL OR generation->>'source' = 'seed')
        AND generation->>'seedHash' IS DISTINCT FROM ${hash}
    `;
  }
}

/* ── Series ─────────────────────────────────────────────────────────────── */

export async function listSeries(): Promise<SeriesRecord[]> {
  const rows = await storyDB.queryAll<{ info: unknown; active_bible_version: number }>`
    SELECT info, active_bible_version FROM library_series WHERE status <> 'archived' ORDER BY sort_order, created_at
  `;
  return rows.map((row) => ({ info: jsonValue<SeriesInfo>(row.info, {} as SeriesInfo), activeBibleVersion: row.active_bible_version }));
}

export async function getSeries(slugOrId: string): Promise<SeriesRecord | null> {
  const row = await storyDB.queryRow<{ info: unknown; active_bible_version: number }>`
    SELECT info, active_bible_version FROM library_series WHERE slug = ${slugOrId} OR id = ${slugOrId}
  `;
  return row ? { info: jsonValue<SeriesInfo>(row.info, {} as SeriesInfo), activeBibleVersion: row.active_bible_version } : null;
}

/** The bible of a version with the series' current cast: retired characters stay out of new writing. */
export async function getBible(seriesId: string, version: number): Promise<SeriesBible | null> {
  const row = await storyDB.queryRow<{ bible: unknown }>`SELECT bible FROM library_series_bibles WHERE series_id = ${seriesId} AND version = ${version}`;
  if (!row) return null;
  const characters = await listCharacters(seriesId, false);
  return { ...jsonValue<Omit<SeriesBible, "characters">>(row.bible, {} as SeriesBible), characters };
}

/* ── Characters ─────────────────────────────────────────────────────────── */

export async function listCharacters(seriesId: string, includeRetired: boolean): Promise<CharacterRecord[]> {
  const rows = await storyDB.queryAll<{ data: unknown; active: boolean; sort_order: number }>`
    SELECT data, active, sort_order FROM library_characters WHERE series_id = ${seriesId} ORDER BY sort_order, created_at
  `;
  return rows
    .filter((row) => includeRetired || row.active)
    .map((row) => {
      const data = jsonValue<SeriesCharacter & { origin?: "seed" | "admin" }>(row.data, {} as SeriesCharacter);
      return { ...data, active: row.active, sortOrder: row.sort_order, origin: data.origin === "admin" ? "admin" : "seed" };
    });
}

export async function getCharacter(seriesId: string, characterId: string): Promise<CharacterRecord | null> {
  const all = await listCharacters(seriesId, true);
  return all.find((character) => character.id === characterId) ?? null;
}

/** Saving a character makes it the admin's: the seed never touches it again. */
export async function saveCharacter(seriesId: string, character: SeriesCharacter, active: boolean, sortOrder?: number): Promise<void> {
  const { active: _drop, ...rest } = character as SeriesCharacter & { active?: boolean; sortOrder?: number; origin?: string };
  const data = { ...rest, origin: "admin" };
  delete (data as { sortOrder?: number }).sortOrder;
  const order = sortOrder ?? (await storyDB.queryRow<{ next: number }>`
    SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM library_characters WHERE series_id = ${seriesId}
  `)?.next ?? 0;
  await storyDB.exec`
    INSERT INTO library_characters (series_id, id, data, active, sort_order)
    VALUES (${seriesId}, ${character.id}, (${json(data)}::jsonb #>> '{}')::jsonb, ${active}, ${order})
    ON CONFLICT (series_id, id) DO UPDATE SET data = EXCLUDED.data, active = EXCLUDED.active, updated_at = CURRENT_TIMESTAMP
  `;
}

/* ── Episodes ───────────────────────────────────────────────────────────── */

export async function listEpisodes(seriesId: string): Promise<EpisodeRecord[]> {
  const rows = await storyDB.queryAll<EpisodeRow>`
    SELECT id, series_id, season, episode, title, logline, plan, idea, status, content, bible_version, scores, generation, publish_at, audio, created_at, updated_at
    FROM library_episodes WHERE series_id = ${seriesId} ORDER BY season, episode
  `;
  return rows.map(toEpisode);
}

export async function listAllEpisodes(): Promise<EpisodeRecord[]> {
  const rows = await storyDB.queryAll<EpisodeRow>`
    SELECT id, series_id, season, episode, title, logline, plan, idea, status, content, bible_version, scores, generation, publish_at, audio, created_at, updated_at
    FROM library_episodes ORDER BY series_id, season, episode
  `;
  return rows.map(toEpisode);
}

export async function getEpisode(id: string): Promise<EpisodeRecord | null> {
  const row = await storyDB.queryRow<EpisodeRow>`
    SELECT id, series_id, season, episode, title, logline, plan, idea, status, content, bible_version, scores, generation, publish_at, audio, created_at, updated_at
    FROM library_episodes WHERE id = ${id}
  `;
  return row ? toEpisode(row) : null;
}

export async function createEpisode(input: { seriesId: string; season: number; episode: number; title: string; logline: string; idea: string | null; plan: EpisodePlan }): Promise<string> {
  const id = episodeId(input.seriesId, input.season, input.episode);
  await storyDB.exec`
    INSERT INTO library_episodes (id, series_id, season, episode, title, logline, plan, idea, status, generation)
    VALUES (${id}, ${input.seriesId}, ${input.season}, ${input.episode}, ${input.title}, ${input.logline},
            (${json(input.plan)}::jsonb #>> '{}')::jsonb, ${input.idea}, 'planned', (${json({ planEdited: true })}::jsonb #>> '{}')::jsonb)
  `;
  return id;
}

export async function updateEpisodePlan(id: string, patch: { title: string; logline: string; idea: string | null; plan: EpisodePlan; publishAt: Date | null }, generation: GenerationInfo): Promise<void> {
  await storyDB.exec`
    UPDATE library_episodes
    SET title = ${patch.title}, logline = ${patch.logline}, idea = ${patch.idea}, plan = (${json(patch.plan)}::jsonb #>> '{}')::jsonb,
        publish_at = ${patch.publishAt}, generation = (${json(generation)}::jsonb #>> '{}')::jsonb, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
  `;
}

export async function saveEpisodeState(
  id: string,
  state: { status: ContentStatus; content?: EpisodeContent | null; scores?: EpisodeScores | null; generation: GenerationInfo; bibleVersion?: number | null; publishAt?: Date | null },
): Promise<void> {
  const current = await getEpisode(id);
  if (!current) return;
  const content = state.content === undefined ? current.content : state.content;
  const scores = state.scores === undefined ? current.scores : state.scores;
  const bibleVersion = state.bibleVersion === undefined ? current.bibleVersion : state.bibleVersion;
  const publishAt = state.publishAt === undefined ? current.publishAt : state.publishAt;
  await storyDB.exec`
    UPDATE library_episodes
    SET status = ${state.status},
        content = (${json(content)}::jsonb #>> '{}')::jsonb,
        scores = (${json(scores)}::jsonb #>> '{}')::jsonb,
        generation = (${json(state.generation)}::jsonb #>> '{}')::jsonb,
        bible_version = ${bibleVersion},
        publish_at = ${publishAt},
        title = ${content?.title || current.title},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
  `;
}

/* ── Audio dramas ───────────────────────────────────────────────────────── */

/** Saves the audio state; `script` replaces the stored screenplay, `null` removes it, undefined keeps it. */
export async function saveEpisodeAudio(id: string, audio: EpisodeAudio | null, script?: AudioScript | null): Promise<void> {
  if (script === undefined) {
    await storyDB.exec`UPDATE library_episodes SET audio = (${json(audio)}::jsonb #>> '{}')::jsonb WHERE id = ${id}`;
    return;
  }
  await storyDB.exec`
    UPDATE library_episodes SET audio = (${json(audio)}::jsonb #>> '{}')::jsonb, audio_script = (${json(script)}::jsonb #>> '{}')::jsonb WHERE id = ${id}
  `;
}

export async function getEpisodeAudioScript(id: string): Promise<AudioScript | null> {
  const row = await storyDB.queryRow<{ audio_script: unknown }>`SELECT audio_script FROM library_episodes WHERE id = ${id}`;
  return jsonValue<AudioScript | null>(row?.audio_script, null);
}

export async function listVoiceCast(seriesId: string): Promise<VoiceOverride[]> {
  const rows = await storyDB.queryAll<{ speaker_id: string; voice_id: string | null; persona: string | null; source: string }>`
    SELECT speaker_id, voice_id, persona, source FROM library_voice_cast WHERE series_id = ${seriesId}
  `;
  return rows.map((row) => ({ speakerId: row.speaker_id, voiceId: row.voice_id, persona: row.persona, source: row.source === "auto" ? "auto" : "admin" }));
}

export async function saveVoiceCast(seriesId: string, row: VoiceOverride): Promise<void> {
  await storyDB.exec`
    INSERT INTO library_voice_cast (series_id, speaker_id, voice_id, persona, source)
    VALUES (${seriesId}, ${row.speakerId}, ${row.voiceId ?? null}, ${row.persona ?? null}, ${row.source})
    ON CONFLICT (series_id, speaker_id) DO UPDATE SET voice_id = EXCLUDED.voice_id, persona = EXCLUDED.persona, source = EXCLUDED.source, updated_at = CURRENT_TIMESTAMP
  `;
}

export async function deleteVoiceCast(seriesId: string, speakerId: string): Promise<void> {
  await storyDB.exec`DELETE FROM library_voice_cast WHERE series_id = ${seriesId} AND speaker_id = ${speakerId}`;
}

/* ── Progress & collection ──────────────────────────────────────────────── */

export interface ProgressRecord {
  episodeId: string;
  chapterIndex: number;
  startedAt: Date;
  finishedAt: Date | null;
  updatedAt: Date;
}

export async function listProgress(profileId: string): Promise<ProgressRecord[]> {
  const rows = await storyDB.queryAll<{ episode_id: string; chapter_index: number; started_at: Date; finished_at: Date | null; updated_at: Date }>`
    SELECT episode_id, chapter_index, started_at, finished_at, updated_at FROM library_progress WHERE profile_id = ${profileId}
  `;
  return rows.map((row) => ({
    episodeId: row.episode_id,
    chapterIndex: row.chapter_index,
    startedAt: new Date(row.started_at),
    finishedAt: row.finished_at ? new Date(row.finished_at) : null,
    updatedAt: new Date(row.updated_at),
  }));
}

/** Returns true when this call finished the episode for the first time (the collectible is handed over once). */
export async function saveProgress(input: { profileId: string; userId: string; episodeId: string; chapterIndex: number; finished: boolean }): Promise<boolean> {
  const before = await storyDB.queryRow<{ finished_at: Date | null }>`
    SELECT finished_at FROM library_progress WHERE profile_id = ${input.profileId} AND episode_id = ${input.episodeId}
  `;
  const finishedNow = input.finished && !before?.finished_at;
  await storyDB.exec`
    INSERT INTO library_progress (profile_id, episode_id, user_id, chapter_index, finished_at)
    VALUES (${input.profileId}, ${input.episodeId}, ${input.userId}, ${input.chapterIndex}, ${input.finished ? new Date() : null})
    ON CONFLICT (profile_id, episode_id) DO UPDATE SET
      chapter_index = EXCLUDED.chapter_index,
      finished_at = COALESCE(library_progress.finished_at, EXCLUDED.finished_at),
      updated_at = CURRENT_TIMESTAMP
  `;
  return finishedNow;
}
