/**
 * Audio drama production for library episodes: runs in the background (the
 * Railway edge cuts long requests; the Studio polls the state), keeps the
 * previous drama online until the new one is done, stores the master in the
 * bucket and the series score next to it.
 */

import { fetchElevenLabsVoices, composeMusic, synthesizeSoundEffect } from "../../../tts/elevenlabs-dialogue";
import { bucketObjectExists, resolveObjectKeyUrlForClient, uploadBufferToBucket, uploadBufferToBucketKey } from "../../../helpers/bucket-storage";
import { CostLedger, withServiceTier } from "../../storybook/llm";
import { createOpenRouterStorybookLlm } from "../../storybook/llm-openrouter";
import { seedHash } from "../seed";
import { getBible, getEpisode, getEpisodeAudioScript, getSeries, listCharacters, listVoiceCast, saveEpisodeAudio, saveVoiceCast, type EpisodeRecord } from "../store";
import type { EpisodeAudio, EpisodeContent } from "../types";
import { resolveSeriesCast, type AccountVoice } from "./casting";
import { renderAudioDrama } from "./drama";
import type { ScorePorts } from "./score";

/** A render that has not finished after this long died with its process (deploy, crash). */
export const AUDIO_STALE_MS = 45 * 60 * 1000;

export const AUDIO_STEP_LABELS: Record<string, string> = {
  queued: "Startet …",
  cast: "Besetzt die Gäste der Folge",
  script: "Schreibt das Hörspiel-Drehbuch",
  voices: "Spricht die Rollen ein (ElevenLabs v4)",
  music: "Holt oder komponiert die Serienmusik",
  mix: "Geräusche, Atmo und Studio-Mix",
  upload: "Speichert das Hörspiel",
};

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

/** The series score lives in the bucket next to the episodes. */
export const bucketScorePorts: ScorePorts = {
  async load(key) {
    if (!(await bucketObjectExists(key))) return null;
    const url = await resolveObjectKeyUrlForClient(key);
    if (!url || url.startsWith("bucket://")) return null;
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    return response.ok ? Buffer.from(await response.arrayBuffer()) : null;
  },
  async save(key, audio) {
    const stored = await uploadBufferToBucketKey(audio, "audio/mpeg", key);
    if (!stored) throw new Error("Bucket nicht konfiguriert");
  },
  compose: (prompt, seconds) => composeMusic({ prompt, lengthSeconds: seconds }),
  async sound(prompt, seconds) {
    return (await synthesizeSoundEffect({ prompt, durationSeconds: seconds, mode: "loop", promptInfluence: 0.5 })).audio;
  },
};

const running = new Set<string>();

export interface StartAudioOptions {
  /** Children may hear it as soon as it is done. */
  release: boolean;
  /** Record again from the stored screenplay (new voices, new mix) instead of writing a new one. */
  keepScript?: boolean;
}

/**
 * Marks the episode as generating and starts the production in the background.
 * Throws when the episode has no text or a render is already running.
 */
export async function startEpisodeAudio(episode: EpisodeRecord, options: StartAudioOptions): Promise<EpisodeAudio> {
  if (!episode.content) throw new Error("Die Folge hat noch keinen Text.");
  if (running.has(episode.id) || audioIsGenerating(episode.audio)) throw new Error("Für diese Folge läuft schon ein Hörspiel.");
  const previous = episode.audio;
  const state: EpisodeAudio = {
    ...(previous?.url ? { url: previous.url, durationSeconds: previous.durationSeconds, chapterStarts: previous.chapterStarts, textHash: previous.textHash, stats: previous.stats, finishedAt: previous.finishedAt } : {}),
    status: "generating",
    step: "queued",
    startedAt: new Date().toISOString(),
    released: Boolean(previous?.url && previous.released),
    autoRelease: options.release,
  };
  await saveEpisodeAudio(episode.id, state);
  running.add(episode.id);
  void produce(episode.id, state, options).finally(() => running.delete(episode.id));
  return state;
}

async function produce(episodeId: string, state: EpisodeAudio, options: StartAudioOptions): Promise<void> {
  const report = async (step: string) => {
    state.step = step;
    await saveEpisodeAudio(episodeId, { ...state });
  };
  const ledger = new CostLedger();
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
    const [characters, overrides, voices] = await Promise.all([listCharacters(series.info.id, false), listVoiceCast(series.info.id), loadAccountVoices()]);
    const { cast, autoPicks } = resolveSeriesCast({ bible: { audio: direction }, characters, overrides, voices });
    for (const pick of autoPicks) await saveVoiceCast(series.info.id, pick);

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
      ...(stored ? { script: stored } : {}),
      report,
    });

    await report("upload");
    const uploaded = await uploadBufferToBucket(result.audio, "audio/mpeg", {
      prefix: `audio/originals/${series.info.slug}`,
      filenameHint: `s${episode.season}e${episode.episode}-${episode.content.title.replace(/[^\w\s-]/g, "").trim() || "folge"}`,
    });
    if (!uploaded) throw new Error("Upload fehlgeschlagen oder Bucket nicht konfiguriert.");

    const done: EpisodeAudio = {
      status: "ready",
      step: "done",
      startedAt: state.startedAt,
      finishedAt: new Date().toISOString(),
      released: options.release,
      url: uploaded.url,
      durationSeconds: Math.round(result.seconds),
      chapterStarts: result.chapterStarts,
      textHash,
      stats: result.stats,
    };
    await saveEpisodeAudio(episodeId, done, result.script);
    console.log(`[library-audio] ${episodeId} done: ${(result.seconds / 60).toFixed(1)} min, released=${options.release}, ${JSON.stringify(result.stats)}`);
  } catch (error) {
    console.error(`[library-audio] ${episodeId} failed:`, error);
    const message = (error as Error)?.message || String(error);
    await saveEpisodeAudio(episodeId, { ...state, status: "failed", step: state.step, error: message.slice(0, 600), finishedAt: new Date().toISOString(), stats: { ...state.stats, llmCostUSD: ledger.totals().costUSD } }).catch(() => undefined);
  }
}
