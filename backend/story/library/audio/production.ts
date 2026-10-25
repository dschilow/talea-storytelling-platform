/**
 * Audio drama production for library episodes: runs in the background (the
 * Railway edge cuts long requests; the Studio polls the state), keeps the
 * previous drama online until the new one is done, stores the master in the
 * bucket and the series score next to it.
 *
 * The voices come from ElevenLabs v4 or Gemini 3.8 TTS (engines.ts); the engine
 * is chosen per recording. The recording before the current one is kept as
 * `previous`, so the Studio can compare engines and switch back without paying
 * for another recording. Generated sounds are cached in the bucket and listed in
 * the sound library (table library_sounds) every story shares, so a sound is
 * bought once — not once per episode, and not again for a new recording.
 */

import type { SoundCachePort } from "../../../doku/audio-render";
import { fetchElevenLabsVoices, composeMusic, synthesizeSoundEffect } from "../../../tts/elevenlabs-dialogue";
import { bucketObjectExists, resolveObjectKeyUrlForClient, uploadBufferToBucket, uploadBufferToBucketKey } from "../../../helpers/bucket-storage";
import { resolveOpenRouterApiKey } from "../../openrouter-generation";
import { CostLedger, withServiceTier } from "../../storybook/llm";
import { createOpenRouterStorybookLlm } from "../../storybook/llm-openrouter";
import { seedHash } from "../seed";
import {
  getBible,
  getEpisode,
  getEpisodeAudioScript,
  getSeries,
  listCharacters,
  listEngineVoiceCast,
  listVoiceCast,
  saveEngineVoiceCast,
  dbSoundLibrary,
  saveEpisodeAudio,
  saveVoiceCast,
  type EpisodeRecord,
} from "../store";
import type { EpisodeAudio, EpisodeAudioVersion, EpisodeContent, VoiceEngine } from "../types";
import { NARRATOR_ID, resolveSeriesCast, type AccountVoice } from "./casting";
import { geminiFigures } from "./cast-members";
import { renderAudioDrama } from "./drama";
import { defaultVoiceEngine, engineInfo } from "./engines";
import { resolveGeminiCast, type GeminiCastEntry } from "./gemini-voices";
import { openRouterSpeech } from "./openrouter-speech";
import type { ScorePorts } from "./score";

/** A render that has not finished after this long died with its process (deploy, crash). */
export const AUDIO_STALE_MS = 45 * 60 * 1000;

export const AUDIO_STEP_LABELS: Record<string, string> = {
  queued: "Startet …",
  cast: "Besetzt die Gäste der Folge",
  script: "Schreibt das Hörspiel-Drehbuch",
  voices: "Spricht die Rollen ein",
  music: "Holt oder komponiert die Serienmusik",
  mix: "Geräusche, Atmo und Studio-Mix",
  upload: "Speichert das Hörspiel",
};

/** The step of a running render for the Studio ("Spricht die Rollen ein (Gemini 3.8 Flash Lite)"). */
export function audioStepLabel(step: string, engine?: VoiceEngine): string {
  const label = AUDIO_STEP_LABELS[step] ?? step;
  return step === "voices" ? `${label} (${engineInfo(engine).label})` : label;
}

/** Fingerprint of what the drama tells: a changed text makes the drama stale. */
export function episodeTextHash(content: EpisodeContent): string {
  return seedHash({ title: content.title, chapters: content.chapters.map((chapter) => chapter.text), teaser: content.teaser });
}

export function audioIsGenerating(audio: EpisodeAudio | null | undefined): boolean {
  if (audio?.status !== "generating") return false;
  const started = audio.startedAt ? Date.parse(audio.startedAt) : 0;
  return Boolean(started) && Date.now() - started < AUDIO_STALE_MS;
}

/** What children may hear: a finished master the admin released. */
export function audioIsReleased(audio: EpisodeAudio | null | undefined): boolean {
  return Boolean(audio?.url && audio.released);
}

let voiceCache: { at: number; voices: AccountVoice[] } | null = null;

export async function loadAccountVoices(): Promise<AccountVoice[]> {
  if (voiceCache && Date.now() - voiceCache.at < 10 * 60 * 1000) return voiceCache.voices;
  const voices = (await fetchElevenLabsVoices()).map((voice) => ({ voiceId: voice.voiceId, name: voice.name, labels: voice.labels, description: voice.description, previewUrl: voice.previewUrl }));
  voiceCache = { at: Date.now(), voices };
  return voices;
}

async function loadBucketObject(key: string): Promise<Buffer | null> {
  if (!(await bucketObjectExists(key))) return null;
  const url = await resolveObjectKeyUrlForClient(key);
  if (!url || url.startsWith("bucket://")) return null;
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  return response.ok ? Buffer.from(await response.arrayBuffer()) : null;
}

/** The series score lives in the bucket next to the episodes. */
export const bucketScorePorts: ScorePorts = {
  load: loadBucketObject,
  async save(key, audio) {
    const stored = await uploadBufferToBucketKey(audio, "audio/mpeg", key);
    if (!stored) throw new Error("Bucket nicht konfiguriert");
  },
  compose: (prompt, seconds) => composeMusic({ prompt, lengthSeconds: seconds }),
  async sound(prompt, seconds) {
    return (await synthesizeSoundEffect({ prompt, durationSeconds: seconds, mode: "loop", promptInfluence: 0.5 })).audio;
  },
};

/** Generated spot effects and ambience, shared by every episode of every series. */
export const bucketSoundCache: SoundCachePort = {
  load: (key) => loadBucketObject(`library/${key}`),
  async save(key, audio) {
    await uploadBufferToBucketKey(audio, "audio/mpeg", `library/${key}`);
  },
};

const running = new Set<string>();

export interface StartAudioOptions {
  /** Children may hear it as soon as it is done. */
  release: boolean;
  /** Record again from the stored screenplay (new voices, new mix) instead of writing a new one. */
  keepScript?: boolean;
  /** Voice engine; the server default (TALEA_AUDIO_ENGINE, else Gemini 3.8 Flash Lite) when missing. */
  engine?: VoiceEngine;
}

/** The current recording as a version to keep. */
function versionOf(audio: EpisodeAudio, sameScript: boolean): EpisodeAudioVersion | undefined {
  if (!audio.url) return undefined;
  return {
    url: audio.url,
    engine: audio.engine ?? "elevenlabs",
    ...(audio.durationSeconds ? { durationSeconds: audio.durationSeconds } : {}),
    ...(audio.chapterStarts ? { chapterStarts: audio.chapterStarts } : {}),
    ...(audio.textHash ? { textHash: audio.textHash } : {}),
    ...(audio.finishedAt ? { finishedAt: audio.finishedAt } : {}),
    ...(audio.stats ? { stats: audio.stats } : {}),
    sameScript,
  };
}

/**
 * Marks the episode as generating and starts the production in the background.
 * Throws when the episode has no text or a render is already running.
 */
export async function startEpisodeAudio(episode: EpisodeRecord, options: StartAudioOptions): Promise<EpisodeAudio> {
  if (!episode.content) throw new Error("Die Folge hat noch keinen Text.");
  if (running.has(episode.id) || audioIsGenerating(episode.audio)) throw new Error("Für diese Folge läuft schon ein Hörspiel.");
  const engine = options.engine ?? defaultVoiceEngine();
  const previous = episode.audio;
  const state: EpisodeAudio = {
    ...(previous?.url
      ? { url: previous.url, engine: previous.engine, durationSeconds: previous.durationSeconds, chapterStarts: previous.chapterStarts, textHash: previous.textHash, stats: previous.stats, finishedAt: previous.finishedAt }
      : {}),
    ...(previous?.previous ? { previous: previous.previous } : {}),
    status: "generating",
    step: "queued",
    startedAt: new Date().toISOString(),
    released: Boolean(previous?.url && previous.released),
    autoRelease: options.release,
    pendingEngine: engine,
  };
  await saveEpisodeAudio(episode.id, state);
  running.add(episode.id);
  void produce(episode.id, state, { ...options, engine }).finally(() => running.delete(episode.id));
  return state;
}

/** The Gemini voices of a series; automatic picks are stored so a figure keeps its voice. */
async function geminiSeriesCast(seriesId: string, figures: ReturnType<typeof geminiFigures>, store: boolean): Promise<GeminiCastEntry[]> {
  const overrides = await listEngineVoiceCast(seriesId, "gemini");
  const { cast, autoPicks } = resolveGeminiCast({ figures, overrides, narratorId: NARRATOR_ID });
  if (store) for (const pick of autoPicks) await saveEngineVoiceCast(seriesId, pick);
  return cast;
}

async function produce(episodeId: string, state: EpisodeAudio, options: StartAudioOptions & { engine: VoiceEngine }): Promise<void> {
  const report = async (step: string) => {
    state.step = step;
    await saveEpisodeAudio(episodeId, { ...state });
  };
  const ledger = new CostLedger();
  const info = engineInfo(options.engine);
  try {
    const episode = await getEpisode(episodeId);
    if (!episode?.content) throw new Error("Die Folge hat keinen Text mehr.");
    const series = await getSeries(episode.seriesId);
    if (!series) throw new Error("Reihe nicht gefunden");
    const bible = await getBible(series.info.id, episode.bibleVersion ?? series.activeBibleVersion) ?? await getBible(series.info.id, series.activeBibleVersion);
    if (!bible) throw new Error("Serien-Bibel fehlt");
    // The cast and the score come from the active bible: a voice change applies to every episode.
    const active = await getBible(series.info.id, series.activeBibleVersion);
    const direction = active?.audio ?? bible.audio;
    // Gemini needs no ElevenLabs account; its voice labels still help to cast and direct.
    const accountVoices = info.family === "elevenlabs" ? loadAccountVoices() : loadAccountVoices().catch(() => [] as AccountVoice[]);
    const [characters, overrides, voices] = await Promise.all([listCharacters(series.info.id, false), listVoiceCast(series.info.id), accountVoices]);
    const { cast, autoPicks } = resolveSeriesCast({ bible: { audio: direction }, characters, overrides, voices });
    if (voices.length) for (const pick of autoPicks) await saveVoiceCast(series.info.id, pick);
    const geminiCast = info.family === "gemini" ? await geminiSeriesCast(series.info.id, geminiFigures(characters, cast, voices), true) : undefined;
    const apiKey = info.family === "gemini" ? resolveOpenRouterApiKey() : null;
    if (info.family === "gemini" && !apiKey) throw new Error("OpenRouter ist nicht eingerichtet (Secret OpenRouterAPIKey fehlt).");

    const textHash = episodeTextHash(episode.content);
    const stored = options.keepScript && episode.audio?.textHash === textHash ? await getEpisodeAudioScript(episodeId) : null;
    const llm = withServiceTier(createOpenRouterStorybookLlm({
      onFailedAttempt: (request, billed) => {
        if (billed) ledger.recordCall(`${request.stage}-failed`, billed, request.role);
      },
    }), "flex");

    const result = await renderAudioDrama({
      series: series.info,
      bible: { ...bible, audio: direction },
      season: episode.season,
      episode: episode.episode,
      content: episode.content,
      characters,
      seriesCast: cast,
      voices,
      llm,
      ledger,
      scorePorts: bucketScorePorts,
      engine: options.engine,
      ...(geminiCast ? { geminiCast } : {}),
      ...(apiKey ? { speech: openRouterSpeech({ apiKey }) } : {}),
      soundCache: bucketSoundCache,
      soundLibrary: dbSoundLibrary,
      ...(stored ? { script: stored } : {}),
      report,
    });

    await report("upload");
    const uploaded = await uploadBufferToBucket(result.audio, "audio/mpeg", {
      prefix: `audio/originals/${series.info.slug}`,
      filenameHint: `s${episode.season}e${episode.episode}-${episode.content.title.replace(/[^\w\s-]/g, "").trim() || "folge"}`,
    });
    if (!uploaded) throw new Error("Upload fehlgeschlagen oder Bucket nicht konfiguriert.");

    // The recording this one replaces stays one level deep, to compare and to switch back.
    const previous = versionOf(state, Boolean(stored)) ?? state.previous;
    const done: EpisodeAudio = {
      status: "ready",
      step: "done",
      startedAt: state.startedAt,
      finishedAt: new Date().toISOString(),
      released: options.release,
      engine: result.engine,
      url: uploaded.url,
      durationSeconds: Math.round(result.seconds),
      chapterStarts: result.chapterStarts,
      textHash,
      stats: result.stats,
      ...(previous ? { previous } : {}),
    };
    await saveEpisodeAudio(episodeId, done, result.script);
    console.log(`[library-audio] ${episodeId} done (${info.label}): ${(result.seconds / 60).toFixed(1)} min, released=${options.release}, ${JSON.stringify(result.stats)}`);
  } catch (error) {
    console.error(`[library-audio] ${episodeId} failed:`, error);
    const message = (error as Error)?.message || String(error);
    await saveEpisodeAudio(episodeId, { ...state, status: "failed", step: state.step, error: message.slice(0, 600), finishedAt: new Date().toISOString(), stats: { ...state.stats, llmCostUSD: ledger.totals().costUSD } }).catch(() => undefined);
  }
}

/**
 * The kept recording becomes the current one again (and the current one is kept
 * instead). Only for a recording of the stored screenplay, so the Studio's
 * screenplay always belongs to what children hear.
 */
export async function restorePreviousAudio(episode: EpisodeRecord): Promise<EpisodeAudio> {
  const audio = episode.audio;
  if (!audio?.url || !audio.previous) throw new Error("Es gibt keine frühere Fassung.");
  if (audioIsGenerating(audio) || running.has(episode.id)) throw new Error("Gerade entsteht eine neue Aufnahme.");
  if (!audio.previous.sameScript) throw new Error("Die frühere Fassung wurde aus einem anderen Drehbuch aufgenommen und kann nur angehört werden.");
  const { previous } = audio;
  const restored: EpisodeAudio = {
    ...audio,
    status: "ready",
    step: "done",
    error: undefined,
    pendingEngine: undefined,
    url: previous.url,
    engine: previous.engine,
    durationSeconds: previous.durationSeconds,
    chapterStarts: previous.chapterStarts,
    textHash: previous.textHash ?? audio.textHash,
    finishedAt: previous.finishedAt,
    stats: previous.stats,
    previous: versionOf(audio, true),
  };
  await saveEpisodeAudio(episode.id, restored);
  return restored;
}

/** Gemini cast of a series for the Studio (read-only: automatic picks are stored by the first recording). */
export async function geminiCastForStudio(seriesId: string, figures: ReturnType<typeof geminiFigures>): Promise<GeminiCastEntry[]> {
  return geminiSeriesCast(seriesId, figures, false);
}
