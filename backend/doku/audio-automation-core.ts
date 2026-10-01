/**
 * Audio-doku automation core: validation, job queue and the generation pipeline
 * (script, cover, cast, studio master, upload, library entry).
 *
 * This module exposes NO HTTP endpoints and performs no authentication. Whoever
 * wires it to an entry point (an admin-only endpoint, a machine credential) owns
 * the access decision. New episodes are private unless the caller opts in.
 */

import { APIError } from "encore.dev/api";
import { appMeta } from "encore.dev";
import log from "encore.dev/log";

import { dokuDB } from "./db";
import { maybeUploadImageUrlToBucket, uploadBufferToBucket } from "../helpers/bucket-storage";
import { resolveRequestedProfileId } from "../helpers/profiles";
import { fetchElevenLabsVoices } from "../tts/elevenlabs-dialogue";
import { AUDIO_DOKU_WORDS_PER_MINUTE, buildAudioDokuScript, type AudioDokuScriptResponse } from "./audio-script";
import { renderAudioDokuMasterBuffer } from "./audio-render";
import { generateAudioCoverImage, insertAudioDokuRecord } from "./audio-doku";
import { castSpeakerVoices, isNoveltyVoice, type CastableVoice, type SpeakerVoiceHint } from "./voice-casting";
import {
  AutomationInputError,
  MAX_ITEMS_PER_REQUEST,
  countSpokenWords,
  normalizeJobItem,
  type AutomationJobItem,
  type AutomationJobView,
  type AutomationCatalogEntry,
  type NormalizedJobItem,
} from "./audio-automation-input";

export * from "./audio-automation-input";

/** Validation errors from the pure module become 400s at the API edge. */
const normalizeOrReject = (item: AutomationJobItem, index: number): NormalizedJobItem => {
  try {
    return normalizeJobItem(item, index);
  } catch (error) {
    if (error instanceof AutomationInputError) throw APIError.invalidArgument(error.message);
    throw error;
  }
};

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

// ---------------------------------------------------------------------------
// Schema: Encore migration files are not reliably applied on Railway (see CLAUDE.md),
// so the table is also created idempotently at runtime. Keep in sync with
// migrations/7_create_audio_doku_jobs.up.sql.
// ---------------------------------------------------------------------------

let schemaReady: Promise<void> | null = null;

function ensureJobsSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await dokuDB.exec`
        CREATE TABLE IF NOT EXISTS audio_doku_jobs (
          id TEXT PRIMARY KEY,
          status TEXT NOT NULL DEFAULT 'queued'
            CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
          stage TEXT,
          topic TEXT NOT NULL,
          params JSONB NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          audio_doku_id TEXT,
          title TEXT,
          error TEXT,
          notes JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          started_at TIMESTAMP,
          finished_at TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await dokuDB.exec`CREATE INDEX IF NOT EXISTS idx_audio_doku_jobs_status_created ON audio_doku_jobs(status, created_at)`;
      await dokuDB.exec`CREATE INDEX IF NOT EXISTS idx_audio_doku_jobs_audio_doku ON audio_doku_jobs(audio_doku_id)`;
    })().catch((error) => {
      schemaReady = null; // retry on the next call
      throw error;
    });
  }
  return schemaReady;
}

// ---------------------------------------------------------------------------
// Job storage
// ---------------------------------------------------------------------------

type JobRow = {
  id: string;
  status: AutomationJobView["status"];
  stage: string | null;
  topic: string;
  params: AutomationJobItem | string;
  attempts: number;
  audio_doku_id: string | null;
  title: string | null;
  error: string | null;
  notes: string[] | string | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  updated_at: Date;
};

const parseJson = <T>(value: T | string | null | undefined, fallback: T): T => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const toView = (row: JobRow): AutomationJobView => ({
  id: row.id,
  status: row.status,
  stage: row.stage ?? undefined,
  topic: row.topic,
  title: row.title ?? undefined,
  audioDokuId: row.audio_doku_id ?? undefined,
  error: row.error ?? undefined,
  attempts: row.attempts,
  notes: parseJson<string[]>(row.notes, []),
  params: parseJson<AutomationJobItem>(row.params, { topic: row.topic }),
  createdAt: row.created_at,
  startedAt: row.started_at ?? undefined,
  finishedAt: row.finished_at ?? undefined,
  updatedAt: row.updated_at,
});

const setStage = async (jobId: string, stage: string): Promise<void> => {
  await dokuDB.exec`UPDATE audio_doku_jobs SET stage = ${stage}, updated_at = CURRENT_TIMESTAMP WHERE id = ${jobId}`;
};

const addNote = async (jobId: string, note: string): Promise<void> => {
  log.info(`[AudioAutomation] ${jobId}: ${note}`);
  await dokuDB.exec`
    UPDATE audio_doku_jobs
    SET notes = notes || jsonb_build_array(${note}::text), updated_at = CURRENT_TIMESTAMP
    WHERE id = ${jobId}
  `;
};

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

const JOB_TIMEOUT_MS = 45 * 60 * 1000;
const STALE_RUNNING_MINUTES = 25;
const MAX_ATTEMPTS = 2;

let voiceCache: { at: number; voices: CastableVoice[] } | null = null;

async function loadVoices(): Promise<CastableVoice[]> {
  if (voiceCache && Date.now() - voiceCache.at < 60 * 60 * 1000) return voiceCache.voices;
  const voices = (await fetchElevenLabsVoices()).map((voice) => ({
    voiceId: voice.voiceId,
    name: voice.name,
    labels: voice.labels,
    description: voice.description,
  }));
  voiceCache = { at: Date.now(), voices };
  return voices;
}

/** The account's ElevenLabs voices as the casting sees them, with the auto-pick's novelty flag. */
export async function listCastingVoices(): Promise<
  Array<{ voiceId: string; name: string; labels?: Record<string, string>; description?: string; excludedFromAutoCast: boolean }>
> {
  return (await loadVoices()).map((voice) => ({ ...voice, excludedFromAutoCast: isNoveltyVoice(voice) }));
}

async function resolveOwnerUserId(): Promise<string> {
  const fromEnv = process.env.AUDIO_DOKU_AUTOMATION_USER_ID?.trim();
  if (fromEnv) return fromEnv;
  // Episodes are produced by the admin account; reuse whoever created the newest one.
  const row = await dokuDB.queryRow<{ user_id: string }>`
    SELECT user_id FROM audio_dokus ORDER BY created_at DESC LIMIT 1
  `;
  if (!row) {
    throw new Error("Kein Besitzer-Account ermittelbar: AUDIO_DOKU_AUTOMATION_USER_ID setzen (noch keine Audio-Doku vorhanden).");
  }
  return row.user_id;
}

async function generateScriptWithLengthGate(
  jobId: string,
  item: NormalizedJobItem,
  speakerNames: string[],
): Promise<AudioDokuScriptResponse> {
  const base = {
    topic: item.topic,
    ageFrom: item.ageFrom,
    ageTo: item.ageTo,
    durationMinutes: item.durationMinutes,
    speakerNames,
  };
  const targetWords = item.durationMinutes * AUDIO_DOKU_WORDS_PER_MINUTE;
  const wantWords = Math.round(targetWords * 0.85);
  const floorWords = Math.round(targetWords * 0.65);

  let best = await buildAudioDokuScript(base);
  let bestWords = countSpokenWords(best.script);

  if (bestWords < wantWords) {
    await addNote(jobId, `Skript zu kurz (${bestWords} Wörter, Ziel ≈ ${targetWords}) — zweiter Versuch.`);
    const retry = await buildAudioDokuScript({
      ...base,
      extraNote: `Dein letzter Versuch war zu kurz: ${bestWords} gesprochene Wörter statt mindestens ${wantWords}. Schreibe das GESAMTE Skript vollständig und ausführlich neu, mit allen Stationen, langen Erklär- und Ausprobier-Passagen und dem Finale.`,
    });
    const retryWords = countSpokenWords(retry.script);
    if (retryWords > bestWords) {
      best = retry;
      bestWords = retryWords;
    }
  }

  if (bestWords < floorWords) {
    throw new Error(
      `Skript bleibt zu kurz (${bestWords} Wörter, nötig ≥ ${floorWords} für ${item.durationMinutes} Minuten). Es wird nichts vertont.`,
    );
  }
  return best;
}

async function executeJob(row: JobRow): Promise<void> {
  const jobId = row.id;
  const item = normalizeJobItem(parseJson<AutomationJobItem>(row.params, { topic: row.topic }));
  const guests = item.extraSpeakers;
  const speakerNames = ["TAVI", "LUMI", ...guests.map((guest) => guest.name)];

  await setStage(jobId, "script");
  const script = await generateScriptWithLengthGate(jobId, item, speakerNames);

  // Cover before the expensive voice render: a failure shows up early, and it never blocks the episode.
  await setStage(jobId, "cover");
  let coverImageUrl: string | undefined;
  try {
    const generated = await generateAudioCoverImage(script.coverPrompt, script.title);
    const uploaded = await maybeUploadImageUrlToBucket(generated, {
      prefix: "images/audio-dokus",
      filenameHint: script.title.replace(/[^\w\s-]/g, "").trim(),
      uploadMode: "always",
    });
    coverImageUrl = uploaded?.url ?? generated;
  } catch (error) {
    await addNote(jobId, `Cover fehlgeschlagen, Doku wird ohne Cover gespeichert: ${(error as Error).message}`);
  }

  await setStage(jobId, "voices");
  const hints: SpeakerVoiceHint[] = guests.map((guest) => ({
    name: guest.name,
    role: guest.role,
    gender: guest.gender,
    age: guest.age,
    voiceId: guest.voiceId,
  }));
  const speakerVoiceMap = castSpeakerVoices(hints, await loadVoices());

  await setStage(jobId, "audio");
  const master = await renderAudioDokuMasterBuffer({
    script: script.script,
    speakerVoiceMap,
    soundDesign: true,
    screenplay: script.screenplay.map((scene) => ({
      index: scene.index,
      startLine: scene.startLine,
      endLine: scene.endLine,
      ambientPrompt: scene.ambientPrompt,
      ambientVolume: scene.ambientVolume,
      durationSeconds: scene.durationSeconds,
    })),
    enableAmbient: true,
    includeBranding: true,
    title: script.title,
    ageFrom: item.ageFrom,
    ageTo: item.ageTo,
  });
  const minutes = master.durationSeconds / 60;
  await addNote(
    jobId,
    `Audio fertig: ${minutes.toFixed(1)} min Sprache (Ziel ${item.durationMinutes}), ${master.cueCounts.music} Musik / ${master.cueCounts.ambience} Atmo / ${master.cueCounts.sfx} Effekte.`,
  );
  if (minutes < item.durationMinutes * 0.7) {
    await addNote(jobId, `Achtung: deutlich kürzer als gewünscht (${minutes.toFixed(1)} statt ${item.durationMinutes} min).`);
  }

  await setStage(jobId, "saving");
  const uploadedAudio = await uploadBufferToBucket(master.audio, "audio/mpeg", {
    prefix: "audio/dokus",
    filenameHint: script.title.replace(/[^\w\s-]/g, "").trim() || "audio-doku",
  });
  if (!uploadedAudio) throw new Error("Audio-Upload fehlgeschlagen oder Bucket nicht konfiguriert.");

  const userId = await resolveOwnerUserId();
  const profileId = await resolveRequestedProfileId({ userId, fallbackName: "Talea" });
  const id = crypto.randomUUID();
  await insertAudioDokuRecord({
    id,
    userId,
    profileId,
    title: script.title,
    description: script.description,
    ageGroup: script.ageGroup,
    category: script.category,
    coverDescription: script.coverPrompt,
    coverImageUrl,
    audioUrl: uploadedAudio.url,
    isPublic: item.autoPublish,
    now: new Date(),
  });

  await dokuDB.exec`
    UPDATE audio_doku_jobs
    SET status = 'done', stage = 'done', audio_doku_id = ${id}, title = ${script.title}, error = NULL,
        finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${jobId}
  `;
  log.info(`[AudioAutomation] ${jobId}: done -> audio doku ${id} "${script.title}" (public=${item.autoPublish})`);
}

async function runJob(row: JobRow): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      executeJob(row),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Job nach ${JOB_TIMEOUT_MS / 60000} Minuten abgebrochen.`)), JOB_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 900);
    log.error(`[AudioAutomation] ${row.id} failed: ${message}`);
    await dokuDB
      .exec`
        UPDATE audio_doku_jobs
        SET status = 'failed', error = ${message}, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${row.id} AND status = 'running'
      `
      .catch(() => {});
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Runner: DB-backed queue, claimed with SKIP LOCKED, polled in-process.
// (Encore cron does not run in the self-hosted Railway build.)
// ---------------------------------------------------------------------------

const MAX_OPEN_JOBS = 15;
const MAX_CONCURRENT = clampInt(process.env.AUDIO_DOKU_AUTOMATION_CONCURRENCY, 1, 3, 2);
let activeJobs = 0;
let pumping = false;

async function recoverStaleJobs(): Promise<void> {
  await dokuDB.exec`
    UPDATE audio_doku_jobs
    SET status = 'queued', stage = 'requeued', updated_at = CURRENT_TIMESTAMP
    WHERE status = 'running'
      AND updated_at < CURRENT_TIMESTAMP - make_interval(mins => ${STALE_RUNNING_MINUTES})
      AND attempts < ${MAX_ATTEMPTS}
  `;
  await dokuDB.exec`
    UPDATE audio_doku_jobs
    SET status = 'failed', error = 'Abgebrochen (Server-Neustart?) und Versuche aufgebraucht.',
        finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE status = 'running'
      AND updated_at < CURRENT_TIMESTAMP - make_interval(mins => ${STALE_RUNNING_MINUTES})
      AND attempts >= ${MAX_ATTEMPTS}
  `;
}

async function claimNextJob(): Promise<JobRow | null> {
  return await dokuDB.queryRow<JobRow>`
    UPDATE audio_doku_jobs
    SET status = 'running', stage = 'starting', attempts = attempts + 1,
        started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, error = NULL
    WHERE id = (
      SELECT id FROM audio_doku_jobs
      WHERE status = 'queued'
      ORDER BY created_at, id
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;
}

/** Starts as many queued jobs as there are free slots. Safe to call at any time. */
export async function pumpAutomationQueue(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    await ensureJobsSchema();
    await recoverStaleJobs();
    while (activeJobs < MAX_CONCURRENT) {
      const row = await claimNextJob();
      if (!row) break;
      activeJobs += 1;
      void runJob(row).finally(() => {
        activeJobs -= 1;
        void pumpAutomationQueue();
      });
    }
  } catch (error) {
    log.error(`[AudioAutomation] queue pump failed: ${(error as Error).message}`);
  } finally {
    pumping = false;
  }
}

let runnerStarted = false;

/** Polls the queue so jobs survive restarts. Call once from the module that exposes the entry point. */
export function startAutomationRunner(): void {
  if (runnerStarted) return;
  try {
    if (appMeta().environment.type === "test") return;
  } catch {
    // appMeta unavailable outside the Encore runtime
  }
  runnerStarted = true;
  setTimeout(() => void pumpAutomationQueue(), 20_000).unref?.();
  setInterval(() => void pumpAutomationQueue(), 60_000).unref?.();
}

// ---------------------------------------------------------------------------
// Operations for the entry point
// ---------------------------------------------------------------------------

export async function loadCatalog(): Promise<{ audioDokus: AutomationCatalogEntry[]; pendingTopics: string[] }> {
  await ensureJobsSchema();
  const rows = await dokuDB.queryAll<{
    id: string;
    title: string;
    description: string;
    category: string | null;
    age_group: string | null;
    is_public: boolean;
    created_at: Date;
  }>`
    SELECT id, title, description, category, age_group, is_public, created_at
    FROM audio_dokus
    ORDER BY created_at DESC
    LIMIT 1000
  `;
  const pending = await dokuDB.queryAll<{ topic: string }>`
    SELECT topic FROM audio_doku_jobs WHERE status IN ('queued', 'running') ORDER BY created_at
  `;
  return {
    audioDokus: rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category ?? undefined,
      ageGroup: row.age_group ?? undefined,
      isPublic: row.is_public,
      createdAt: row.created_at,
    })),
    pendingTopics: pending.map((row) => row.topic),
  };
}

export async function enqueueJobs(items: AutomationJobItem[]): Promise<AutomationJobView[]> {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS_PER_REQUEST) {
    throw APIError.invalidArgument(`items must contain 1-${MAX_ITEMS_PER_REQUEST} entries.`);
  }
  const normalized = items.map((item, index) => normalizeOrReject(item, index));
  await ensureJobsSchema();

  const open = await dokuDB.queryRow<{ count: number }>`
    SELECT COUNT(*)::int AS count FROM audio_doku_jobs WHERE status IN ('queued', 'running')
  `;
  if ((open?.count ?? 0) + normalized.length > MAX_OPEN_JOBS) {
    throw APIError.resourceExhausted(`Too many open jobs (limit ${MAX_OPEN_JOBS}). Wait for running jobs to finish.`);
  }

  const jobs: AutomationJobView[] = [];
  for (const item of normalized) {
    const id = crypto.randomUUID();
    const row = await dokuDB.queryRow<JobRow>`
      INSERT INTO audio_doku_jobs (id, topic, params)
      VALUES (${id}, ${item.topic}, ${JSON.stringify(item)}::jsonb)
      RETURNING *
    `;
    if (row) jobs.push(toView(row));
  }
  log.info(`[AudioAutomation] queued ${jobs.length} job(s)`);
  void pumpAutomationQueue();
  return jobs;
}

export async function listJobs(ids: string[] = []): Promise<AutomationJobView[]> {
  await ensureJobsSchema();
  const clean = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 50);
  const rows =
    clean.length > 0
      ? await dokuDB.queryAll<JobRow>`SELECT * FROM audio_doku_jobs WHERE id = ANY(${clean}) ORDER BY created_at`
      : await dokuDB.queryAll<JobRow>`SELECT * FROM audio_doku_jobs ORDER BY created_at DESC LIMIT 50`;
  return rows.map(toView);
}

export async function getJob(id: string): Promise<AutomationJobView> {
  await ensureJobsSchema();
  const row = await dokuDB.queryRow<JobRow>`SELECT * FROM audio_doku_jobs WHERE id = ${id}`;
  if (!row) throw APIError.notFound("Job not found.");
  return toView(row);
}

export async function cancelJob(id: string): Promise<AutomationJobView> {
  await ensureJobsSchema();
  const row = await dokuDB.queryRow<JobRow>`
    UPDATE audio_doku_jobs
    SET status = 'cancelled', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id} AND status = 'queued'
    RETURNING *
  `;
  if (row) return toView(row);
  const existing = await getJob(id);
  throw APIError.failedPrecondition(`Only queued jobs can be cancelled (this one is ${existing.status}).`);
}

/** Only episodes the automation created can be toggled through it. */
export async function setAutomationEpisodePublic(id: string, isPublic: boolean): Promise<{ id: string; title: string; isPublic: boolean }> {
  await ensureJobsSchema();
  const owned = await dokuDB.queryRow<{ title: string }>`
    SELECT d.title
    FROM audio_dokus d
    WHERE d.id = ${id}
      AND EXISTS (SELECT 1 FROM audio_doku_jobs j WHERE j.audio_doku_id = d.id)
  `;
  if (!owned) throw APIError.notFound("No automation-created audio doku with this id.");
  await dokuDB.exec`UPDATE audio_dokus SET is_public = ${isPublic}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
  return { id, title: owned.title, isPublic };
}
