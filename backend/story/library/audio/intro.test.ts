import { describe, expect, test } from "bun:test";
import type { EpisodeAudio } from "../types";
import { EPISODE_INTRO_VERSION, needsEpisodeIntro, upgradeEpisodeIntro } from "./intro";

const original: EpisodeAudio = {
  status: "ready",
  released: true,
  url: "bucket://talea/episode.mp3",
  engine: "gemini-lite",
  durationSeconds: 600,
  chapterStarts: [6, 120.25, 300],
  textHash: "unchanged-text",
  finishedAt: "2026-10-20T12:00:00Z",
};

describe("episode intro backfill", () => {
  test("updates the master and chapter times, preserving release, text and recording metadata", async () => {
    const upgraded = await upgradeEpisodeIntro(original, async () => ({
      url: "bucket://talea/episode-with-intro.mp3", durationSeconds: 620.98, offsetSeconds: 20.98,
    }));
    expect(upgraded).toEqual({
      ...original,
      url: "bucket://talea/episode-with-intro.mp3",
      introVersion: EPISODE_INTRO_VERSION,
      introSourceUrl: original.url,
      durationSeconds: 621,
      chapterStarts: [26.98, 141.23, 320.98],
    });
    expect(original.chapterStarts).toEqual([6, 120.25, 300]);
  });

  test("repeated visits do not add another intro or shift the chapter times again", async () => {
    let calls = 0;
    const prepend = async () => { calls++; return { url: "master", durationSeconds: 621, offsetSeconds: 20.98 }; };
    const first = await upgradeEpisodeIntro(original, prepend);
    expect(await upgradeEpisodeIntro(first, prepend)).toBe(first);
    expect(needsEpisodeIntro(first)).toBe(false);
    expect(calls).toBe(1);
  });

  test("also repairs the previous recording, retaining its restore eligibility and engine", async () => {
    const audio: EpisodeAudio = {
      ...original,
      introVersion: EPISODE_INTRO_VERSION,
      previous: { url: "old", engine: "elevenlabs", sameScript: true, chapterStarts: [2], durationSeconds: 500 },
    };
    const sources: string[] = [];
    const upgraded = await upgradeEpisodeIntro(audio, async (url) => {
      sources.push(url);
      return { url: "old-with-intro", durationSeconds: 521, offsetSeconds: 20.98 };
    });
    expect(sources).toEqual(["old"]);
    expect(upgraded.url).toBe(original.url);
    expect(upgraded.previous).toEqual({
      ...audio.previous,
      url: "old-with-intro", introSourceUrl: "old", introVersion: EPISODE_INTRO_VERSION,
      chapterStarts: [22.98], durationSeconds: 521,
    });
  });

  test("leaves running productions and missing recordings alone", async () => {
    const prepend = async () => { throw new Error("must not record"); };
    expect(await upgradeEpisodeIntro({ ...original, status: "generating" }, prepend)).toEqual({ ...original, status: "generating" });
    expect(await upgradeEpisodeIntro({ status: "failed", released: false }, prepend)).toEqual({ status: "failed", released: false });
    expect(needsEpisodeIntro(null)).toBe(false);
  });

  test("a failed replacement cannot modify the source metadata", async () => {
    const before = JSON.stringify(original);
    await expect(upgradeEpisodeIntro(original, async () => { throw new Error("upload failed"); })).rejects.toThrow("upload failed");
    expect(JSON.stringify(original)).toBe(before);
  });
});
