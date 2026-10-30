/** Retrofit existing masters in the background; never record their voices again. */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveOriginsIntro } from "../../../doku/audio-render";
import { resolveObjectUrlForClient, uploadBufferToBucketKey } from "../../../helpers/bucket-storage";
import { listAllEpisodes, replaceEpisodeAudioIfUnchanged } from "../store";
import { EPISODE_INTRO_CROSSFADE_SECONDS, EPISODE_INTRO_VERSION, needsEpisodeIntro, upgradeEpisodeIntro, type IntroMaster } from "./intro";
import { probeSeconds } from "./score";

let running: Promise<void> | null = null;

/** Called after library initialization, retried on later visits if a previous attempt failed. */
export function backfillEpisodeIntros(): Promise<void> {
  if (!running) running = runBackfill().finally(() => { running = null; });
  return running;
}

async function runBackfill(): Promise<void> {
  const episodes = (await listAllEpisodes()).filter((episode) => needsEpisodeIntro(episode.audio));
  if (!episodes.length) return;
  const introPath = await resolveOriginsIntro();
  if (!introPath) throw new Error("Das Talea-Intro fehlt; vorhandene Hörspiele bleiben unverändert.");
  const introSeconds = await probeSeconds(introPath);
  if (introSeconds <= EPISODE_INTRO_CROSSFADE_SECONDS) throw new Error("Ungültige Intro-Dauer");
  // One episode at a time to keep CPU and memory available for playback and production.
  for (const episode of episodes) {
    const original = episode.audio!;
    try {
      const upgraded = await upgradeEpisodeIntro(original, (url) => prepend(url, introPath, introSeconds));
      // Recording, release and restore actions may have changed this row while ffmpeg ran.
      const saved = await replaceEpisodeAudioIfUnchanged(episode.id, original, upgraded);
      console.log(`[library-intro] ${episode.id}: ${saved ? "Intro ergänzt" : "parallel geändert, wird später erneut geprüft"}`);
    } catch (error) {
      console.error(`[library-intro] ${episode.id}:`, error);
    }
  }
}

async function prepend(source: string, introPath: string, introSeconds: number): Promise<IntroMaster> {
  const url = await resolveObjectUrlForClient(source);
  if (!url || !/^https?:\/\//.test(url)) throw new Error("Hörspiel kann nicht geladen werden");
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Hörspiel-Download fehlgeschlagen (${response.status})`);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "library-intro-"));
  try {
    const programme = path.join(tmpDir, "programme.mp3");
    const master = path.join(tmpDir, "master.mp3");
    await fs.writeFile(programme, Buffer.from(await response.arrayBuffer()));
    const programmeSeconds = await probeSeconds(programme);
    if (programmeSeconds <= EPISODE_INTRO_CROSSFADE_SECONDS) throw new Error("Ungültiges Hörspiel");
    await new Promise<void>((resolve, reject) => {
      const process = spawn("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y", "-i", introPath, "-i", programme,
        "-filter_complex",
        `[0:a]aresample=44100,aformat=channel_layouts=stereo[intro];` +
        `[1:a]aresample=44100,aformat=channel_layouts=stereo[programme];` +
        `[intro][programme]acrossfade=d=${EPISODE_INTRO_CROSSFADE_SECONDS}:c1=tri:c2=tri[out]`,
        "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "192k", master,
      ], { stdio: ["ignore", "ignore", "pipe"], timeout: 300_000 });
      let error = "";
      process.stderr.on("data", (chunk: Buffer) => { error = (error + chunk.toString()).slice(-2000); });
      process.on("error", reject);
      process.on("close", (code) => code === 0 ? resolve() : reject(new Error(`Intro-Mix fehlgeschlagen (${code}): ${error}`)));
    });
    const durationSeconds = await probeSeconds(master);
    const offsetSeconds = introSeconds - EPISODE_INTRO_CROSSFADE_SECONDS;
    if (Math.abs(durationSeconds - programmeSeconds - offsetSeconds) > 0.2) throw new Error("Intro-Mix hat eine unerwartete Dauer");
    // The source remains intact. A deterministic key makes concurrent workers harmless.
    const hash = createHash("sha256").update(source).digest("hex").slice(0, 32);
    const stored = await uploadBufferToBucketKey(await fs.readFile(master), "audio/mpeg", `audio/originals/intro-v${EPISODE_INTRO_VERSION}/${hash}.mp3`);
    if (!stored) throw new Error("Intro-Master konnte nicht gespeichert werden");
    return { url: stored.url, durationSeconds, offsetSeconds };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
