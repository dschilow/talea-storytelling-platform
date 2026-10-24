/**
 * Talea Originals as audio dramas (admins only): record an episode as a
 * Hörspiel (ElevenLabs v4 or Gemini 3.8 TTS), release or withdraw it, switch
 * back to the previous recording, read its screenplay, and cast the voices of a
 * series per engine. Children get the released drama through /library/episodes/:id.
 *
 * Kept next to library-api.ts (not in a subfolder): the Encore v1.50 client
 * generator writes wrong import paths for endpoint files in subfolders.
 */

import { api, APIError } from "encore.dev/api";
import { ensureAdmin } from "../admin/authz";
import { resolveOpenRouterApiKey } from "./openrouter-generation";
import { adminEpisodeView, type LibraryAdminEpisode } from "./library-api";
import { NARRATOR_ID, resolveSeriesCast, type AccountVoice } from "./library/audio/casting";
import { geminiFigures, seriesHints } from "./library/audio/cast-members";
import { engineInfo, normalizeEngine } from "./library/audio/engines";
import { GEMINI_VOICES, geminiVoice, geminiVoiceLabel } from "./library/audio/gemini-voices";
import { openRouterSpeech } from "./library/audio/openrouter-speech";
import { audioIsGenerating, geminiCastForStudio, loadAccountVoices, restorePreviousAudio, startEpisodeAudio } from "./library/audio/production";
import { NARRATOR_KEY } from "./library/audio/screenplay";
import { previewGeminiVoice, previewText } from "./library/audio/voice-preview";
import {
  deleteEngineVoiceCast,
  deleteVoiceCast,
  ensureLibrary,
  getBible,
  getEpisode,
  getEpisodeAudioScript,
  getSeries,
  listCharacters,
  listEpisodes,
  listVoiceCast,
  saveEngineVoiceCast,
  saveEpisodeAudio,
  saveVoiceCast,
  type EpisodeRecord,
} from "./library/store";
import type { VoiceEngine, VoiceFamily } from "./library/types";

/* ── Response shapes (declared in full: Encore drops undeclared fields) ── */

export interface LibraryAudioScriptResponse {
  episodeId: string;
  title: string;
  /** Engine of the current recording. */
  engineLabel: string;
  speakers: Array<{ key: string; name: string; voiceName?: string; persona: string; isNarrator: boolean }>;
  parts: Array<{
    kind: string;
    title: string;
    lines: Array<{ speaker: string; text: string; sounds: Array<{ sound: string; at?: string }> }>;
    scenes: Array<{ startLine: number; place: string; ambience?: string; music?: string }>;
  }>;
  notes: string[];
}

export interface LibraryVoiceOption {
  voiceId: string;
  name: string;
  previewUrl?: string;
  /** "male · old · German · characters" — for the picker. */
  traits: string;
  description?: string;
}

export interface LibraryVoiceRole {
  speakerId: string;
  name: string;
  role: string;
  voiceId?: string;
  voiceName?: string;
  persona: string;
  silent: boolean;
  /** admin = chosen in the Studio, series = default of the series, auto = picked automatically. */
  source: string;
  /** The configured voice was missing in the account and has been replaced. */
  replaced?: string;
}

export interface LibraryVoiceCastResponse {
  /** Engine family of this cast: "elevenlabs" or "gemini". */
  family: string;
  /** Voices of this family get a generated preview (POST …/preview) instead of a preview URL. */
  generatedPreviews: boolean;
  roles: LibraryVoiceRole[];
  voices: LibraryVoiceOption[];
}

export interface LibraryVoicePreviewResponse {
  /** Data URI (MP3). */
  audio: string;
  voiceId: string;
  costUSD: number;
  cached: boolean;
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

async function episodeOrThrow(id: string): Promise<EpisodeRecord> {
  const episode = await getEpisode(id);
  if (!episode) throw APIError.notFound("Folge nicht gefunden");
  return episode;
}

async function viewOf(episodeId: string): Promise<LibraryAdminEpisode> {
  const episode = await episodeOrThrow(episodeId);
  const index = (await listEpisodes(episode.seriesId)).findIndex((entry) => entry.id === episode.id);
  return adminEpisodeView(episode, index);
}

function engineOrThrow(value: unknown): VoiceEngine | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const engine = normalizeEngine(value);
  if (!engine) throw APIError.invalidArgument(`Unbekannte Stimmen-Engine: ${String(value)}`);
  return engine;
}

const familyOf = (engine?: VoiceEngine): VoiceFamily => engineInfo(engine).family;

const ROLE_NAMES: Record<string, string> = { protagonist: "Hauptfigur", sidekick: "Bester Freund", antagonist: "Gegenspieler", recurring: "Immer wieder dabei" };

async function seriesContext(slug: string) {
  const series = await getSeries(slug);
  if (!series) throw APIError.notFound("Reihe nicht gefunden");
  const [bible, characters, overrides, voices] = await Promise.all([
    getBible(series.info.id, series.activeBibleVersion),
    listCharacters(series.info.id, false),
    listVoiceCast(series.info.id),
    loadAccountVoices().catch((): AccountVoice[] => []),
  ]);
  // Read-only view: automatic picks are shown, they are stored by the first recording.
  const { cast } = resolveSeriesCast({ bible: { audio: bible?.audio }, characters, overrides, voices });
  return { series, bible, characters, voices, cast };
}

async function voiceCast(slug: string, family: VoiceFamily): Promise<LibraryVoiceCastResponse> {
  const { series, characters, voices, cast } = await seriesContext(slug);
  const roleOf = new Map(characters.map((character) => [character.id, ROLE_NAMES[character.role] ?? character.role]));
  const roleLabel = (speakerId: string) => (speakerId === NARRATOR_ID ? "Erzählt jede Folge" : roleOf.get(speakerId) ?? "");
  const nameOf = (speakerId: string, name: string) => (speakerId === NARRATOR_ID ? "Erzähler" : name);

  if (family === "gemini") {
    const gemini = await geminiCastForStudio(series.info.id, geminiFigures(characters, cast, voices));
    return {
      family,
      generatedPreviews: true,
      roles: gemini.map((entry) => ({
        speakerId: entry.speakerId,
        name: nameOf(entry.speakerId, entry.name),
        role: roleLabel(entry.speakerId),
        ...(entry.voice ? { voiceId: entry.voice, voiceName: entry.voice } : {}),
        persona: entry.persona,
        silent: entry.silent,
        source: entry.source,
      })),
      voices: GEMINI_VOICES.map((voice) => ({ voiceId: voice.name, name: voice.name, traits: geminiVoiceLabel(voice), description: `Google: ${voice.trait}` })),
    };
  }

  return {
    family,
    generatedPreviews: false,
    roles: cast.map((voice) => ({
      speakerId: voice.speakerId,
      name: nameOf(voice.speakerId, voice.name),
      role: roleLabel(voice.speakerId),
      ...(voice.voiceId ? { voiceId: voice.voiceId } : {}),
      ...(voice.voiceName ? { voiceName: voice.voiceName } : {}),
      persona: voice.persona,
      silent: voice.silent,
      source: voice.source,
      ...(voice.replaced ? { replaced: voice.replaced } : {}),
    })),
    voices: voices.map((voice) => {
      const labels = voice.labels ?? {};
      const traits = [labels.gender, labels.age?.replace("_", " "), labels.language === "de" ? "Deutsch" : labels.language, labels.use_case?.replace(/_/g, " ")].filter(Boolean).join(" · ");
      return { voiceId: voice.voiceId, name: voice.name.trim(), ...(voice.previewUrl ? { previewUrl: voice.previewUrl } : {}), traits, ...(voice.description ? { description: voice.description.slice(0, 220) } : {}) };
    }),
  };
}

/* ── Endpoints ─────────────────────────────────────────────────────────── */

export const libraryAdminGenerateAudio = api<{ id: string; release?: boolean; keepScript?: boolean; engine?: string }, LibraryAdminEpisode>(
  { expose: true, method: "POST", path: "/library/admin/episodes/:id/audio", auth: true },
  async (req) => {
    ensureAdmin();
    await ensureLibrary();
    const engine = engineOrThrow(req.engine);
    const episode = await episodeOrThrow(req.id);
    if (!episode.content) throw APIError.failedPrecondition("Ohne Text gibt es nichts zu vertonen.");
    if (episode.status === "generating") throw APIError.failedPrecondition("Die Folge wird gerade geschrieben.");
    if (audioIsGenerating(episode.audio)) throw APIError.failedPrecondition("Das Hörspiel entsteht gerade.");
    if (familyOf(engine) === "gemini" && !resolveOpenRouterApiKey()) throw APIError.failedPrecondition("Für Gemini fehlt der OpenRouter-Schlüssel (Secret OpenRouterAPIKey).");
    try {
      await startEpisodeAudio(episode, { release: Boolean(req.release), keepScript: Boolean(req.keepScript), ...(engine ? { engine } : {}) });
    } catch (error) {
      throw APIError.failedPrecondition((error as Error).message);
    }
    return viewOf(episode.id);
  }
);

export const libraryAdminReleaseAudio = api<{ id: string; released: boolean }, LibraryAdminEpisode>(
  { expose: true, method: "POST", path: "/library/admin/episodes/:id/audio/release", auth: true },
  async (req) => {
    ensureAdmin();
    await ensureLibrary();
    const episode = await episodeOrThrow(req.id);
    const audio = episode.audio;
    if (!audio) throw APIError.failedPrecondition("Diese Folge hat noch kein Hörspiel.");
    if (req.released && !audio.url) {
      if (!audioIsGenerating(audio)) throw APIError.failedPrecondition("Das Hörspiel ist noch nicht fertig.");
      // Still recording: it goes live on its own when it is done.
      await saveEpisodeAudio(episode.id, { ...audio, autoRelease: true });
    } else {
      await saveEpisodeAudio(episode.id, { ...audio, released: Boolean(req.released), ...(audioIsGenerating(audio) ? { autoRelease: Boolean(req.released) } : {}) });
    }
    return viewOf(episode.id);
  }
);

/** The previous recording (e.g. ElevenLabs before a Gemini test) becomes the current one again; the release state stays. */
export const libraryAdminRestoreAudio = api<{ id: string }, LibraryAdminEpisode>(
  { expose: true, method: "POST", path: "/library/admin/episodes/:id/audio/restore", auth: true },
  async (req) => {
    ensureAdmin();
    await ensureLibrary();
    const episode = await episodeOrThrow(req.id);
    try {
      await restorePreviousAudio(episode);
    } catch (error) {
      throw APIError.failedPrecondition((error as Error).message);
    }
    return viewOf(episode.id);
  }
);

export const libraryAdminAudioScript = api<{ id: string }, LibraryAudioScriptResponse>(
  { expose: true, method: "GET", path: "/library/admin/episodes/:id/audio/script", auth: true },
  async (req) => {
    ensureAdmin();
    await ensureLibrary();
    const episode = await episodeOrThrow(req.id);
    const script = await getEpisodeAudioScript(episode.id);
    if (!script) throw APIError.notFound("Für diese Folge gibt es noch kein Drehbuch.");
    const family = familyOf(episode.audio?.engine);
    return {
      episodeId: episode.id,
      title: episode.content?.title || episode.title,
      engineLabel: engineInfo(episode.audio?.engine).label,
      speakers: script.speakers.map((speaker) => {
        const voiceName = family === "gemini" ? speaker.geminiVoice : speaker.voiceName;
        return { key: speaker.key, name: speaker.name, ...(voiceName ? { voiceName } : {}), persona: speaker.persona, isNarrator: speaker.key === NARRATOR_KEY };
      }),
      parts: script.parts.map((part) => ({
        kind: part.kind,
        title: part.title,
        lines: part.lines.map((line) => ({ speaker: line.speaker, text: line.text, sounds: (line.sounds ?? []).map((sound) => ({ sound: sound.sound, ...(sound.at ? { at: sound.at } : {}) })) })),
        scenes: part.scenes.map((scene) => ({ startLine: scene.startLine, place: scene.place, ...(scene.ambience ? { ambience: scene.ambience } : {}), ...(scene.music ? { music: scene.music } : {}) })),
      })),
      notes: script.notes,
    };
  }
);

export const libraryAdminVoiceCast = api<{ slug: string; engine?: string }, LibraryVoiceCastResponse>(
  { expose: true, method: "GET", path: "/library/admin/series/:slug/voices", auth: true },
  async (req) => {
    ensureAdmin();
    await ensureLibrary();
    return voiceCast(req.slug, familyOf(engineOrThrow(req.engine)));
  }
);

export const libraryAdminUpdateVoice = api<{ slug: string; speakerId: string; engine?: string; voiceId?: string; persona?: string; reset?: boolean }, LibraryVoiceCastResponse>(
  { expose: true, method: "PUT", path: "/library/admin/series/:slug/voices/:speakerId", auth: true },
  async (req) => {
    ensureAdmin();
    await ensureLibrary();
    const family = familyOf(engineOrThrow(req.engine));
    const series = await getSeries(req.slug);
    if (!series) throw APIError.notFound("Reihe nicht gefunden");
    const known = req.speakerId === NARRATOR_ID || (await listCharacters(series.info.id, true)).some((character) => character.id === req.speakerId);
    if (!known) throw APIError.notFound("Figur nicht gefunden");
    const voiceId = String(req.voiceId || "").trim();
    const current = (await listVoiceCast(series.info.id)).find((row) => row.speakerId === req.speakerId);

    if (req.reset) {
      if (family === "gemini") await deleteEngineVoiceCast(series.info.id, req.speakerId, "gemini");
      else await deleteVoiceCast(series.info.id, req.speakerId);
      return voiceCast(req.slug, family);
    }
    if (voiceId && family === "gemini") {
      const voice = geminiVoice(voiceId);
      if (!voice) throw APIError.invalidArgument("Diese Gemini-Stimme gibt es nicht.");
      await saveEngineVoiceCast(series.info.id, { speakerId: req.speakerId, family: "gemini", voiceId: voice.name, source: "admin" });
    }
    if (voiceId && family === "elevenlabs" && !(await loadAccountVoices()).some((voice) => voice.voiceId === voiceId)) {
      throw APIError.invalidArgument("Diese Stimme gibt es im ElevenLabs-Konto nicht.");
    }
    // The persona belongs to the figure (every engine); the ElevenLabs voice only changes on the ElevenLabs cast.
    const elevenVoice = family === "elevenlabs" ? voiceId : "";
    if (elevenVoice || req.persona !== undefined) {
      const persona = String(req.persona ?? "").toLowerCase().replace(/[^a-z ,'-]/g, "").replace(/\s+/g, " ").trim().slice(0, 50);
      await saveVoiceCast(series.info.id, {
        speakerId: req.speakerId,
        voiceId: elevenVoice || current?.voiceId || null,
        persona: req.persona === undefined ? current?.persona ?? null : persona || null,
        // Choosing a voice makes it the admin's; only changing the acting note keeps an automatic pick automatic.
        source: elevenVoice ? "admin" : current?.source ?? "admin",
      });
    }
    return voiceCast(req.slug, family);
  }
);

/** A Gemini voice speaking the figure's own line with its direction (≈ 0.06 ct, cached in memory). */
export const libraryAdminVoicePreview = api<{ slug: string; speakerId: string; engine?: string; voiceId?: string }, LibraryVoicePreviewResponse>(
  { expose: true, method: "POST", path: "/library/admin/series/:slug/voices/:speakerId/preview", auth: true },
  async (req) => {
    ensureAdmin();
    await ensureLibrary();
    const engine = engineOrThrow(req.engine) ?? "gemini-lite";
    if (familyOf(engine) !== "gemini") throw APIError.invalidArgument("Hörproben werden nur für Gemini-Stimmen erzeugt; ElevenLabs-Stimmen haben eine eigene Probe.");
    const apiKey = resolveOpenRouterApiKey();
    if (!apiKey) throw APIError.failedPrecondition("Für Gemini fehlt der OpenRouter-Schlüssel (Secret OpenRouterAPIKey).");
    const { series, characters, voices, cast } = await seriesContext(req.slug);
    const figure = cast.find((entry) => entry.speakerId === req.speakerId);
    if (!figure) throw APIError.notFound("Figur nicht gefunden");
    const gemini = (await geminiCastForStudio(series.info.id, geminiFigures(characters, cast, voices))).find((entry) => entry.speakerId === req.speakerId);
    const voice = geminiVoice(req.voiceId) ?? geminiVoice(gemini?.voice);
    if (!voice) throw APIError.invalidArgument("Keine Gemini-Stimme gewählt.");
    const narrator = req.speakerId === NARRATOR_ID;
    const character = characters.find((entry) => entry.id === req.speakerId);
    const hint = seriesHints(characters, cast, voices).get(req.speakerId) ?? {};
    try {
      const preview = await previewGeminiVoice({
        engine,
        voice: voice.name,
        speaker: { name: narrator ? "Erzähler" : figure.name, persona: figure.persona, narrator, hint },
        text: previewText({ narrator, seriesTitle: series.info.title, name: figure.name, speechStyle: character?.speechStyle }),
        speech: openRouterSpeech({ apiKey, maxAttempts: 2, timeoutMs: 45_000 }),
      });
      return { audio: preview.audio, voiceId: voice.name, costUSD: Number(preview.costUSD.toFixed(5)), cached: preview.cached };
    } catch (error) {
      throw APIError.unavailable(`Hörprobe fehlgeschlagen: ${(error as Error).message.slice(0, 300)}`);
    }
  }
);
