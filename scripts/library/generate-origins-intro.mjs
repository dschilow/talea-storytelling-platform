/** A single continuous ElevenLabs performance, preceded once by the original magic sound. */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { ttsClip, TAVI_VOICE_ID } from "../game-voices/eleven.mjs";

const voiceFile = "scripts/library/assets/origins-intro-voice.mp3";
const text = "[gentle, storytelling, unhurried] Willkommen bei Talea ...\n\nHier warten Geschichten voller Abenteuer auf dich.\n\nOhren auf ... Augen zu ... Kino im Kopf an ...\n\n[warmly] Los geht's!";
if (!existsSync(voiceFile) || process.argv.includes("--record")) {
  const { audio } = await ttsClip({
    voiceId: TAVI_VOICE_ID,
    text,
    seed: 23,
    settings: { stability: 0.5, similarity_boost: 0.8, speed: 0.8 },
  });
  await mkdir("scripts/library/assets", { recursive: true });
  await writeFile(voiceFile, audio);
  console.log(`Durchgehende Intro-Aufnahme gespeichert (${audio.length} Bytes).`);
}
await mkdir("frontend/public/origins", { recursive: true });
const result = spawnSync("ffmpeg", [
  "-hide_banner", "-loglevel", "error", "-y", "-i", "AudioDoku/Talea_intro.mp3", "-i", voiceFile,
  "-filter_complex",
  // The original's first spoken word starts at 8.4 s. Use its magic sound only.
  "[0:a]atrim=start=0:end=8.1,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[magic];" +
    // No cuts, repeated music or changes of voice within the spoken performance.
    "[1:a]atempo=0.82,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,aformat=channel_layouts=stereo,adelay=600:all=1,apad=pad_dur=1.2[voice];" +
    "[magic][voice]acrossfade=d=0.4:c1=tri:c2=tri[out]",
  "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "192k",
  "frontend/public/origins/talea-origins-intro.mp3",
], { stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`ffmpeg failed (${result.status})`);
console.log("Intro mit einmaligem Zauberklang gespeichert.");
