/**
 * The series score: a theme, a chapter bridge and a few scene beds, composed
 * once per series with ElevenLabs Music and reused by every episode — the same
 * musical identity from week to week, and no music cost per episode. Tracks are
 * loudness-normalized before they are stored, so the timeline's gains mean the
 * same thing for every track. Without music access, short beds come from sound
 * generation instead. Encore-free: storage and generation are ports.
 */

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ScoreMood } from "../types";
import type { ScoreTrack } from "./timeline";

export const SCORE_VERSION = 1;
const TARGET_LUFS = -16;

export interface ScorePorts {
  load(key: string): Promise<Buffer | null>;
  save(key: string, audio: Buffer): Promise<void>;
  /** Instrumental music (ElevenLabs Music). */
  compose(prompt: string, seconds: number): Promise<Buffer>;
  /** Fallback when music is not available: sound generation, at most 30 s. */
  sound(prompt: string, seconds: number): Promise<Buffer>;
}

const MOOD_BRIEF: Record<ScoreMood, { seconds: number; brief: string }> = {
  theme: { seconds: 22, brief: "Main title theme of a German children's audio drama series. A catchy, memorable melody that kids hum along to, bright and inviting, builds once and ends on a clear, satisfying final chord." },
  bridge: { seconds: 7, brief: "Short musical bridge between two chapters of the same series, quoting the main theme's melody, light and quick, ends cleanly with a soft button." },
  mischief: { seconds: 60, brief: "Sneaky, cheeky underscore for mischief and tiptoeing: light staccato, playful pauses, soft enough to sit under dialogue, no big hits." },
  adventure: { seconds: 60, brief: "Light adventure underscore for a chase or a race against time: steady energetic pulse, exciting but not loud, sits under dialogue." },
  mystery: { seconds: 60, brief: "Curious, mysterious underscore for a riddle or a secret: soft, sparse, questioning, gently intriguing, never scary." },
  heart: { seconds: 60, brief: "Warm, heartfelt underscore for a tender moment of friendship or making up: slow, gentle, emotional, soft dynamics." },
  spooky: { seconds: 60, brief: "Spooky-fun underscore for kids: creepy-cute, playful shivers and tiptoe suspense with a wink, never frightening." },
  finale: { seconds: 45, brief: "Happy ending underscore: warm, uplifting, resolving, a gentle triumphant glow, calm enough to sit under narration." },
};

export function scorePrompt(styleEn: string, mood: ScoreMood): { prompt: string; seconds: number } {
  const { seconds, brief } = MOOD_BRIEF[mood];
  return {
    seconds,
    prompt: `${brief} Instrumentation and feel of the series: ${styleEn}. Instrumental only, no vocals, no singing, no spoken words. Clean studio mix, family friendly.`,
  };
}

/** Sound generation takes at most 450 characters. */
export function soundFallbackPrompt(styleEn: string, mood: ScoreMood): string {
  const brief = MOOD_BRIEF[mood].brief.split(/(?<=[.:])\s/)[0];
  return `Instrumental music: ${brief} ${styleEn}`.replace(/\s+/g, " ").slice(0, 400).replace(/[,;\s]+\S*$/, "") + ". No vocals.";
}

/** Music is not part of this account (no plan feature, no permission): the sound generator stands in. */
export function musicRefused(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  return status === 401 || status === 402 || status === 403;
}

function hash(text: string): string {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(36);
}

/** A changed style in the bible means new music; the old files stay where they are. */
export function scoreKey(seriesSlug: string, styleEn: string, mood: ScoreMood): string {
  return `library/${seriesSlug}/score/v${SCORE_VERSION}-${hash(styleEn)}/${mood}.mp3`;
}

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    proc.stdout.on("data", (chunk: Buffer) => (out += chunk.toString()));
    proc.stderr.on("data", (chunk: Buffer) => {
      err += chunk.toString();
      if (err.length > 20000) err = err.slice(-20000);
    });
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${command} exited ${code}: ${err.slice(-800)}`))));
  });
}

export async function probeSeconds(file: string): Promise<number> {
  try {
    const out = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
    const seconds = Number(out.trim());
    return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  } catch {
    return 0;
  }
}

/** Loudness-normalizes a track to −16 LUFS with short fades, so it never starts or ends with a click. */
async function masterTrack(input: Buffer, tmpDir: string, name: string): Promise<Buffer> {
  const raw = path.join(tmpDir, `${name}-raw.mp3`);
  const out = path.join(tmpDir, `${name}-mastered.mp3`);
  await fs.writeFile(raw, input);
  const seconds = await probeSeconds(raw);
  const fadeOut = seconds > 4 ? `,afade=t=out:st=${(seconds - 0.6).toFixed(2)}:d=0.6` : "";
  await run("ffmpeg", ["-y", "-i", raw, "-af", `loudnorm=I=${TARGET_LUFS}:TP=-1.5:LRA=11,afade=t=in:st=0:d=0.02${fadeOut}`, "-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "192k", out]);
  return fs.readFile(out);
}

export interface PreparedScore {
  tracks: Map<ScoreMood, ScoreTrack>;
  /** Moods composed now (not from the cache). */
  composed: ScoreMood[];
  /** Moods that came from sound generation because music was refused. */
  fallbacks: ScoreMood[];
  failed: Array<{ mood: ScoreMood; error: string }>;
}

/**
 * The score tracks for `moods`, from the store or freshly composed (three at a
 * time). A mood that cannot be made is left out — the drama plays without it.
 */
export async function prepareScore(input: { seriesSlug: string; styleEn: string; moods: ScoreMood[]; tmpDir: string; ports: ScorePorts }): Promise<PreparedScore> {
  const { seriesSlug, styleEn, tmpDir, ports } = input;
  const tracks = new Map<ScoreMood, ScoreTrack>();
  const composed: ScoreMood[] = [];
  const fallbacks: ScoreMood[] = [];
  const failed: PreparedScore["failed"] = [];
  let noMusic = false;
  const queue = [...new Set(input.moods)];

  const prepare = async (mood: ScoreMood) => {
    const key = scoreKey(seriesSlug, styleEn, mood);
    const soundKey = key.replace(/\.mp3$/, "-sfx.mp3");
    let audio = (await ports.load(key).catch(() => null)) ?? (await ports.load(soundKey).catch(() => null));
    if (!audio) {
      const { prompt, seconds } = scorePrompt(styleEn, mood);
      let fromSound = noMusic;
      if (!noMusic) {
        try {
          audio = await ports.compose(prompt, seconds);
        } catch (error) {
          // Busy or a hiccup: this mood stays out. Not on this plan: sound generation keeps the drama musical.
          if (!musicRefused(error)) throw error;
          noMusic = true;
          fromSound = true;
          console.warn(`[library-audio] music not available, using sound generation: ${(error as Error).message}`);
        }
      }
      if (fromSound) {
        audio = await ports.sound(soundFallbackPrompt(styleEn, mood), Math.min(30, seconds));
        fallbacks.push(mood);
      }
      audio = await masterTrack(audio!, tmpDir, `score-${mood}`);
      await ports.save(fromSound ? soundKey : key, audio).catch((error) => console.warn(`[library-audio] score ${mood} not cached: ${(error as Error).message}`));
      composed.push(mood);
    }
    const file = path.join(tmpDir, `score-${mood}.mp3`);
    await fs.writeFile(file, audio);
    const seconds = await probeSeconds(file);
    if (seconds > 0) tracks.set(mood, { mood, path: file, seconds });
  };

  // One after another: the account allows only two requests at once, and a series composes
  // its score once. The theme goes first: it tells us whether music is available at all.
  const theme = queue.indexOf("theme");
  if (theme > 0) queue.unshift(...queue.splice(theme, 1));
  for (const mood of queue) {
    await prepare(mood).catch((error) => failed.push({ mood, error: (error as Error).message }));
  }
  return { tracks, composed, fallbacks, failed };
}
