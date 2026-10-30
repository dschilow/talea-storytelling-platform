/** Intro metadata and migration policy, independent of Encore and storage. */
import type { EpisodeAudio, EpisodeAudioVersion } from "../types";

export const EPISODE_INTRO_VERSION = 1;
/** Same overlap as mixStudioMaster. */
export const EPISODE_INTRO_CROSSFADE_SECONDS = 0.8;

export interface IntroMaster {
  url: string;
  durationSeconds: number;
  offsetSeconds: number;
}

type Recording = Pick<EpisodeAudio, "url" | "introVersion" | "introSourceUrl" | "chapterStarts" | "durationSeconds">;

export function needsEpisodeIntro(audio: EpisodeAudio | null): boolean {
  if (!audio || audio.status === "generating") return false;
  return Boolean((audio.url && !audio.introVersion) || (audio.previous?.url && !audio.previous.introVersion));
}

/** Preserve the original URL and every production/release field; only replace the master and its timings. */
export async function upgradeEpisodeIntro(audio: EpisodeAudio, prepend: (url: string) => Promise<IntroMaster>): Promise<EpisodeAudio> {
  if (!needsEpisodeIntro(audio)) return audio;
  const masters = new Map<string, Promise<IntroMaster>>();
  async function upgrade<T extends Recording>(recording: T): Promise<T> {
    if (!recording.url || recording.introVersion) return recording;
    let pending = masters.get(recording.url);
    if (!pending) {
      pending = prepend(recording.url);
      masters.set(recording.url, pending);
    }
    const master = await pending;
    if (!master.url || !Number.isFinite(master.durationSeconds) || master.durationSeconds <= 0 ||
        !Number.isFinite(master.offsetSeconds) || master.offsetSeconds <= 0) {
      throw new Error("Ungültiger Intro-Master");
    }
    return {
      ...recording,
      url: master.url,
      introSourceUrl: recording.url,
      introVersion: EPISODE_INTRO_VERSION,
      durationSeconds: Math.round(master.durationSeconds),
      ...(recording.chapterStarts ? { chapterStarts: recording.chapterStarts.map((time) => Number((time + master.offsetSeconds).toFixed(2))) } : {}),
    };
  }
  const upgraded = await upgrade(audio);
  const previous: EpisodeAudioVersion | undefined = audio.previous ? await upgrade(audio.previous) : undefined;
  return { ...upgraded, ...(previous ? { previous } : {}) };
}
