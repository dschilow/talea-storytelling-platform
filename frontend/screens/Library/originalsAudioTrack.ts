import type { AudioTrack } from "../../contexts/AudioPlayerContext";
import { episodeLabel, type LibraryEpisodeResponse } from "./libraryShared";

/** Single source for Original playback, including its completion/profile metadata. */
export function originalsAudioTrack(episode: LibraryEpisodeResponse, profileId?: string, startAt?: number): AudioTrack {
  if (!episode.audio) throw new Error("Für diese Folge gibt es noch kein Hörspiel.");
  return {
    id: `originals-audio:${episode.id}`,
    title: episode.title,
    description: `${episode.seriesTitle} · ${episodeLabel(episode)} · Hörspiel`,
    coverImageUrl: episode.coverImageUrl,
    audioUrl: episode.audio.url,
    ...(startAt ? { startAt } : {}),
    originals: { episodeId: episode.id, profileId: profileId ?? episode.profileId, chapterCount: episode.chapters.length },
  };
}
