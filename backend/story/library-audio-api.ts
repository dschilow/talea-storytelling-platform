/**
 * Talea Originals as audio dramas (admins only): record an episode as a
 * Hörspiel, release or withdraw it, read its screenplay, and cast the voices of
 * a series. Children get the released drama through /library/episodes/:id.
 *
 * Kept next to library-api.ts (not in a subfolder): the Encore v1.50 client
 * generator writes wrong import paths for endpoint files in subfolders.
 */

import { api, APIError } from "encore.dev/api";
import { ensureAdmin } from "../admin/authz";
import { adminEpisodeView, type LibraryAdminEpisode } from "./library-api";
import { NARRATOR_ID, resolveSeriesCast } from "./library/audio/casting";
import { audioIsGenerating, loadAccountVoices, startEpisodeAudio } from "./library/audio/production";
import { NARRATOR_KEY } from "./library/audio/screenplay";
import {
  deleteVoiceCast,
  ensureLibrary,
  getBible,
  getEpisode,
  getEpisodeAudioScript,
  getSeries,
  listCharacters,
  listEpisodes,
  listVoiceCast,
  saveEpisodeAudio,
  saveVoiceCast,
  type EpisodeRecord,
} from "./library/store";

/* ── Response shapes (declared in full: Encore drops undeclared fields) ── */

export interface LibraryAudioScriptResponse {
  episodeId: string;
  title: string;
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
  roles: LibraryVoiceRole[];
  voices: LibraryVoiceOption[];
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

const ROLE_NAMES: Record<string, string> = { protagonist: "Hauptfigur", sidekick: "Bester Freund", antagonist: "Gegenspieler", recurring: "Immer wieder dabei" };

async function voiceCast(slug: string): Promise<LibraryVoiceCastResponse> {
  const series = await getSeries(slug);
  if (!series) throw APIError.notFound("Reihe nicht gefunden");
  const [bible, characters, overrides, voices] = await Promise.all([
    getBible(series.info.id, series.activeBibleVersion),
    listCharacters(series.info.id, false),
    listVoiceCast(series.info.id),
    loadAccountVoices().catch(() => []),
  ]);
  // Read-only view: automatic picks are shown, they are stored by the first recording.
  const { cast } = resolveSeriesCast({ bible: { audio: bible?.audio }, characters, overrides, voices });
  const roleOf = new Map(characters.map((character) => [character.id, ROLE_NAMES[character.role] ?? character.role]));
  return {
    roles: cast.map((voice) => ({
      speakerId: voice.speakerId,
      name: voice.speakerId === NARRATOR_ID ? "Erzähler" : voice.name,
      role: voice.speakerId === NARRATOR_ID ? "Erzählt jede Folge" : roleOf.get(voice.speakerId) ?? "",
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

export const libraryAdminGenerateAudio = api<{ id: string; release?: boolean; keepScript?: boolean }, LibraryAdminEpisode>(
  { expose: true, method: "POST", path: "/library/admin/episodes/:id/audio", auth: true },
  async (req) => {
    ensureAdmin();
    await ensureLibrary();
    const episode = await episodeOrThrow(req.id);
    if (!episode.content) throw APIError.failedPrecondition("Ohne Text gibt es nichts zu vertonen.");
    if (episode.status === "generating") throw APIError.failedPrecondition("Die Folge wird gerade geschrieben.");
    if (audioIsGenerating(episode.audio)) throw APIError.failedPrecondition("Das Hörspiel entsteht gerade.");
    try {
      await startEpisodeAudio(episode, { release: Boolean(req.release), keepScript: Boolean(req.keepScript) });
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

export const libraryAdminAudioScript = api<{ id: string }, LibraryAudioScriptResponse>(
  { expose: true, method: "GET", path: "/library/admin/episodes/:id/audio/script", auth: true },
  async (req) => {
    ensureAdmin();
    await ensureLibrary();
    const episode = await episodeOrThrow(req.id);
    const script = await getEpisodeAudioScript(episode.id);
    if (!script) throw APIError.notFound("Für diese Folge gibt es noch kein Drehbuch.");
    return {
      episodeId: episode.id,
      title: episode.content?.title || episode.title,
      speakers: script.speakers.map((speaker) => ({ key: speaker.key, name: speaker.name, ...(speaker.voiceName ? { voiceName: speaker.voiceName } : {}), persona: speaker.persona, isNarrator: speaker.key === NARRATOR_KEY })),
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

export const libraryAdminVoiceCast = api<{ slug: string }, LibraryVoiceCastResponse>(
  { expose: true, method: "GET", path: "/library/admin/series/:slug/voices", auth: true },
  async (req) => {
    ensureAdmin();
    await ensureLibrary();
    return voiceCast(req.slug);
  }
);

export const libraryAdminUpdateVoice = api<{ slug: string; speakerId: string; voiceId?: string; persona?: string; reset?: boolean }, LibraryVoiceCastResponse>(
  { expose: true, method: "PUT", path: "/library/admin/series/:slug/voices/:speakerId", auth: true },
  async (req) => {
    ensureAdmin();
    await ensureLibrary();
    const series = await getSeries(req.slug);
    if (!series) throw APIError.notFound("Reihe nicht gefunden");
    const known = req.speakerId === NARRATOR_ID || (await listCharacters(series.info.id, true)).some((character) => character.id === req.speakerId);
    if (!known) throw APIError.notFound("Figur nicht gefunden");
    if (req.reset) {
      await deleteVoiceCast(series.info.id, req.speakerId);
    } else {
      const voiceId = String(req.voiceId || "").trim();
      if (voiceId && !(await loadAccountVoices()).some((voice) => voice.voiceId === voiceId)) throw APIError.invalidArgument("Diese Stimme gibt es im ElevenLabs-Konto nicht.");
      const persona = String(req.persona ?? "").toLowerCase().replace(/[^a-z ,'-]/g, "").replace(/\s+/g, " ").trim().slice(0, 50);
      const current = (await listVoiceCast(series.info.id)).find((row) => row.speakerId === req.speakerId);
      await saveVoiceCast(series.info.id, {
        speakerId: req.speakerId,
        voiceId: voiceId || current?.voiceId || null,
        persona: req.persona === undefined ? current?.persona ?? null : persona || null,
        // Choosing a voice makes it the admin's; only changing the acting note keeps an automatic pick automatic.
        source: voiceId ? "admin" : current?.source ?? "admin",
      });
    }
    return voiceCast(req.slug);
  }
);
