import type {
  EpisodeState,
  LibraryAdminAudio,
  LibraryAdminCharacter,
  LibraryAdminEpisode,
  LibraryAdminSeriesResponse,
  LibraryCharacter,
  LibraryCollectible,
  LibraryCollectionResponse,
  LibraryEpisodeAudio,
  LibraryEpisodeCard,
  LibraryEpisodeResponse,
  LibraryEpisodeRecommendation,
  LibrarySeriesCard,
  LibrarySeriesResponse,
  LibraryShelvesResponse,
} from "~backend/story/library-api";
import type { LibraryAudioScriptResponse, LibrarySoundsResponse, LibrarySoundView, LibraryVoiceCastResponse, LibraryVoiceOption, LibraryVoiceRole } from "~backend/story/library-audio-api";

export type {
  EpisodeState,
  LibraryAdminAudio,
  LibraryAdminCharacter,
  LibraryAdminEpisode,
  LibraryAdminSeriesResponse,
  LibraryAudioScriptResponse,
  LibraryCharacter,
  LibraryCollectible,
  LibraryCollectionResponse,
  LibraryEpisodeAudio,
  LibraryEpisodeCard,
  LibraryEpisodeResponse,
  LibraryEpisodeRecommendation,
  LibrarySeriesCard,
  LibrarySeriesResponse,
  LibraryShelvesResponse,
  LibrarySoundsResponse,
  LibrarySoundView,
  LibraryVoiceCastResponse,
  LibraryVoiceOption,
  LibraryVoiceRole,
};

/** "12:05" for a position in the audio drama. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** The product name of the pre-produced library. */
export const ORIGINALS_NAME = "Talea Originals";

export const seriesPath = (slug: string) => `/originals/${encodeURIComponent(slug)}`;
export const episodeReaderPath = (episodeId: string) => `/episode-reader/${encodeURIComponent(episodeId)}`;
export const originalsHomePath = "/stories?tab=originals";

const dateFormat = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" });
const timeFormat = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });

/** "Freitag, 23. Oktober, 15:00 Uhr" — or "heute, 15:00 Uhr" / "morgen, …". */
export function formatRelease(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  const today = new Date();
  const dayDiff = Math.round((new Date(date.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 86_400_000);
  const day = dayDiff === 0 ? "heute" : dayDiff === 1 ? "morgen" : dateFormat.format(date);
  return `${day}, ${timeFormat.format(date)} Uhr`;
}

export function episodeLabel(card: Pick<LibraryEpisodeCard, "season" | "episode">): string {
  return card.season > 1 ? `Staffel ${card.season} · Folge ${card.episode}` : `Folge ${card.episode}`;
}

export const STATE_LABELS: Record<EpisodeState, string> = {
  planned: "Geplant",
  generating: "Wird geschrieben",
  in_review: "Zur Prüfung",
  scheduled: "Freigegeben",
  published: "Veröffentlicht",
  failed: "Fehlgeschlagen",
};

export const STATE_TONES: Record<EpisodeState, string> = {
  planned: "bg-[var(--talea-surface-inset)] text-[var(--talea-text-secondary)]",
  generating: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  in_review: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  scheduled: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  published: "bg-emerald-600 text-white dark:bg-emerald-500",
  failed: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
};

export const ROLE_LABELS: Record<string, string> = {
  protagonist: "Hauptfigur",
  sidekick: "Bester Freund",
  antagonist: "Gegenspieler",
  recurring: "Immer wieder dabei",
};

/** The quoted catchphrase inside a speech-style line, if there is one. */
export function catchphraseOf(speechStyle: string): string | null {
  const match = speechStyle.match(/„([^“]+)“/);
  return match ? match[1] : null;
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
    const message = (error as { message: string }).message.trim();
    if (message) return message;
  }
  return fallback;
}
