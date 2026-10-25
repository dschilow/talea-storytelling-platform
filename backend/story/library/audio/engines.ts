/**
 * Voice engines of the audio dramas — Encore-free.
 *
 * ElevenLabs v4 records takes of up to 1,600 characters through text-to-dialogue
 * (the voices hear each other, word timestamps come back). Gemini 3.8 TTS through
 * OpenRouter records every line on its own with the figure's voice and a direction
 * (Gemini takes at most two voices per request and returns no timestamps); the
 * engine trims, levels and edits the lines together itself (gemini-render.ts).
 *
 * Prices are list prices of 2026-10-24 and feed the estimates and the cost
 * breakdown of every recording: ElevenLabs bills characters (audio tags count),
 * Gemini bills 25 audio tokens per second of speech plus a few input tokens.
 */

import type { AudioCosts, AudioScript, VoiceEngine, VoiceFamily } from "../types";
import { VOICE_ENGINES } from "../types";

export interface VoiceEngineInfo {
  id: VoiceEngine;
  family: VoiceFamily;
  /** For the Studio. */
  label: string;
  /** Model id at the provider. */
  model: string;
  /** USD per 1,000 billed characters. */
  usdPer1kChars?: number;
  /** USD per second of generated speech. */
  usdPerSecond?: number;
  /** USD per input token (text and direction). */
  usdPerInputToken?: number;
}

/** Gemini TTS bills its audio output as 25 tokens per second (measured 2026-10-24: 7.6 s = 190 tokens). */
export const AUDIO_TOKENS_PER_SECOND = 25;

export const VOICE_ENGINE_INFO: Record<VoiceEngine, VoiceEngineInfo> = {
  elevenlabs: { id: "elevenlabs", family: "elevenlabs", label: "ElevenLabs v4", model: "eleven_v4", usdPer1kChars: 0.08 },
  "gemini-lite": {
    id: "gemini-lite",
    family: "gemini",
    label: "Gemini 3.8 Flash Lite",
    model: "google/gemini-3.8-flash-lite-tts",
    usdPerSecond: AUDIO_TOKENS_PER_SECOND * 6e-6,
    usdPerInputToken: 0.5e-6,
  },
  "gemini-flash": {
    id: "gemini-flash",
    family: "gemini",
    label: "Gemini 3.8 Flash",
    model: "google/gemini-3.8-flash-tts",
    usdPerSecond: AUDIO_TOKENS_PER_SECOND * 9e-6,
    usdPerInputToken: 0.5e-6,
  },
};

/** ElevenLabs list prices for the rest of the production (sound generation, music — Gemini makes neither). */
export const SOUND_USD_PER_MINUTE = 0.12;
export const MUSIC_USD_PER_MINUTE = 0.15;

/**
 * Spoken characters (tags not counted) per billed second of a Gemini recording,
 * the padding around every clip included. Measured 2026-10-24 on Bruno S1E1
 * chapter 1: 3,241 spoken characters → 285 s billed (Lite) / 295 s (Flash, one retake).
 */
export const GEMINI_CHARS_PER_SECOND = 11.4;
/** Screenplay characters per character of prose (tags added, "sagte Ella" removed), measured on Bruno S1E1. */
const BILLED_PER_PROSE_CHAR = 1.15;
const SPOKEN_PER_PROSE_CHAR = 0.91;
const PROSE_CHARS_PER_LINE = 67;
/** Text and direction of one Gemini request, in input tokens. */
const INPUT_TOKENS_PER_LINE = 70;

export function normalizeEngine(value: unknown): VoiceEngine | undefined {
  const text = String(value ?? "").trim().toLowerCase();
  return (VOICE_ENGINES as readonly string[]).includes(text) ? (text as VoiceEngine) : undefined;
}

/**
 * The engine new recordings use unless the Studio picks another one
 * (`TALEA_AUDIO_ENGINE`). Gemini 3.8 Flash Lite since 2026-10-25: the editor's
 * blind comparison found it good enough at about an eighth of ElevenLabs' price.
 */
export function defaultVoiceEngine(): VoiceEngine {
  return normalizeEngine(process.env.TALEA_AUDIO_ENGINE) ?? "gemini-lite";
}

/** A recording without an engine was made before there was a choice: ElevenLabs. */
export function engineInfo(engine?: VoiceEngine | null): VoiceEngineInfo {
  return VOICE_ENGINE_INFO[engine ?? "elevenlabs"] ?? VOICE_ENGINE_INFO.elevenlabs;
}

export interface ScriptVolume {
  /** Characters ElevenLabs bills (tags included). */
  billedChars: number;
  /** Characters actually spoken. */
  spokenChars: number;
  lines: number;
}

export function scriptVolume(script: Pick<AudioScript, "parts">): ScriptVolume {
  let billedChars = 0;
  let spokenChars = 0;
  let lines = 0;
  for (const part of script.parts) {
    for (const line of part.lines) {
      lines += 1;
      billedChars += line.text.length;
      spokenChars += line.text.replace(/\[[^\]]*\]\s*/g, "").trim().length;
    }
  }
  return { billedChars, spokenChars, lines };
}

/** Before there is a screenplay: the volume an episode's prose will roughly have as one. */
export function proseVolume(proseChars: number): ScriptVolume {
  return {
    billedChars: Math.round(proseChars * BILLED_PER_PROSE_CHAR),
    spokenChars: Math.round(proseChars * SPOKEN_PER_PROSE_CHAR),
    lines: Math.max(1, Math.round(proseChars / PROSE_CHARS_PER_LINE)),
  };
}

/** USD of a Gemini recording from its measured speech seconds and requests. */
export function geminiVoiceCost(engine: VoiceEngine, seconds: number, inputTokens: number): number {
  const info = engineInfo(engine);
  return seconds * (info.usdPerSecond ?? 0) + inputTokens * (info.usdPerInputToken ?? 0);
}

export interface VoiceEstimate {
  engine: VoiceEngine;
  usd: number;
  /** Seconds of speech (Gemini; ElevenLabs is billed by characters). */
  seconds?: number;
}

export function estimateVoices(engine: VoiceEngine, volume: ScriptVolume): VoiceEstimate {
  const info = engineInfo(engine);
  if (info.usdPer1kChars) return { engine, usd: (volume.billedChars / 1000) * info.usdPer1kChars };
  const seconds = volume.spokenChars / GEMINI_CHARS_PER_SECOND;
  return { engine, seconds, usd: geminiVoiceCost(engine, seconds, volume.lines * INPUT_TOKENS_PER_LINE) };
}

export function soundCost(generatedSeconds: number): number {
  return (generatedSeconds / 60) * SOUND_USD_PER_MINUTE;
}

export function musicCost(composedSeconds: number): number {
  return (composedSeconds / 60) * MUSIC_USD_PER_MINUTE;
}

const round4 = (value: number): number => Number(value.toFixed(4));

export function audioCosts(parts: Omit<AudioCosts, "totalUSD">): AudioCosts {
  const costs = { scriptUSD: round4(parts.scriptUSD), voicesUSD: round4(parts.voicesUSD), soundsUSD: round4(parts.soundsUSD), musicUSD: round4(parts.musicUSD) };
  return { ...costs, totalUSD: round4(costs.scriptUSD + costs.voicesUSD + costs.soundsUSD + costs.musicUSD) };
}
