/**
 * Voice preview for the Studio's cast manager: a figure's own line in a Gemini
 * voice with its direction, generated on request (ElevenLabs voices bring their
 * own preview URL). About 4 seconds ≈ 0.06 ct; kept in memory, so clicking the
 * same preview again costs nothing.
 */

import { spawn } from "node:child_process";
import type { VoiceEngine } from "../types";
import { engineInfo, geminiVoiceCost } from "./engines";
import { geminiLine, type SpeakerDirection } from "./gemini-voices";
import { analyzeSpeech, cut, samplesFromPcm, wavBuffer } from "./pcm";
import type { SpeechPort } from "./openrouter-speech";

const MAX_CACHED = 200;
const cache = new Map<string, { audio: string; costUSD: number }>();

/** What the figure says in its preview: its catchphrase from the bible, else a short hello. */
export function previewText(input: { narrator: boolean; seriesTitle: string; name: string; speechStyle?: string }): string {
  if (input.narrator) return `[warm, playful] Hallo und herzlich willkommen bei ${input.seriesTitle}! [pause] Heute wird es spannend. Und ein bisschen lustig.`;
  const quote = input.speechStyle?.match(/„([^“]{4,140})“/)?.[1]?.trim();
  return quote || `Hallo! Ich bin ${input.name}. Und so klinge ich.`;
}

function encodeMp3(wav: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "wav", "-i", "pipe:0", "-codec:a", "libmp3lame", "-b:a", "96k", "-f", "mp3", "pipe:1"], { stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    proc.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`ffmpeg exited ${code}`))));
    proc.stdin.end(wav);
  });
}

export async function previewGeminiVoice(input: { engine: VoiceEngine; voice: string; speaker: SpeakerDirection; text: string; speech: SpeechPort }): Promise<{ audio: string; costUSD: number; cached: boolean }> {
  const key = JSON.stringify([input.engine, input.voice, input.speaker, input.text]);
  const hit = cache.get(key);
  if (hit) return { ...hit, cached: true };
  const line = geminiLine({ text: input.text }, input.speaker);
  const result = await input.speech({ model: engineInfo(input.engine).model, voice: input.voice, text: line.text, instructions: line.instructions });
  const samples = samplesFromPcm(result.pcm);
  const activity = analyzeSpeech(samples, result.sampleRate);
  const wav = wavBuffer(activity ? cut(samples, activity.start, activity.end, result.sampleRate) : samples, result.sampleRate);
  const mp3 = await encodeMp3(wav).catch(() => null);
  const audio = mp3 ? `data:audio/mpeg;base64,${mp3.toString("base64")}` : `data:audio/wav;base64,${wav.toString("base64")}`;
  const costUSD = geminiVoiceCost(input.engine, samples.length / result.sampleRate, Math.ceil((line.text.length + line.instructions.length) / 4.5));
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
  cache.set(key, { audio, costUSD });
  return { audio, costUSD, cached: false };
}
