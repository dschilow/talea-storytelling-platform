/**
 * Records a screenplay with Gemini 3.8 TTS — Encore-free (speech is a port).
 *
 * Every line is one request in the figure's voice with its direction, several in
 * parallel. Each clip gets a free plausibility check (not silent, length fits the
 * text) and is recorded again when it is off — Gemini rarely runs on, cuts off or
 * stays silent on very short lines. Then the editor's work: trim the padding
 * Gemini puts around every clip, level each figure to the same presence (within a
 * figure, whispers stay quiet), and cut the lines together with radio-play gaps:
 * quick replies, a breath when the narrator goes on, room before a new scene.
 * One WAV per part with sample-exact line spans for the sound design.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { AudioScript, ScriptLine, VoiceEngine } from "../types";
import { engineInfo, geminiVoiceCost } from "./engines";
import { geminiLine, type SpeakerDirection } from "./gemini-voices";
import { analyzeSpeech, applyGain, concatSamples, cut, safeGainDb, samplesFromPcm, silence, wavBuffer, type SpeechActivity } from "./pcm";
import { SpeechError, type SpeechPort } from "./openrouter-speech";
import { estimateWordTimes, type RenderedPart, type WordTime } from "./timeline";

/** Requests at once; OpenRouter documents no limit for speech, 6 keeps a 170-line episode near one minute. */
const DEFAULT_CONCURRENCY = 6;
/** One take plus up to two retakes when the length check fails. */
const MAX_ATTEMPTS = 3;
/** Speaking level every figure is brought to (the master is loudness-normalized later anyway). */
const TARGET_LEVEL_DB = -20;
const MAX_BOOST_DB = 10;
const MAX_CUT_DB = 8;

/** Gaps between lines, seconds. */
export const LINE_GAPS = {
  /** The same speaker goes on (mostly the narrator): a breath. */
  sameSpeaker: 0.38,
  /** Somebody else answers. */
  reply: 0.3,
  /** After a question, the answer comes quickly. */
  afterQuestion: 0.24,
  /** A one- to three-word line is a quick reaction. */
  quickReply: 0.2,
  /** The line broke off ("Mats, NICHT…"): the next speaker cuts in. */
  cutIn: 0.1,
  /** A new scene begins: room for the change of place. */
  scene: 1.0,
  /** Extra room when the next line opens with a sound. */
  soundFirst: 0.25,
};

/** Spoken characters per second the length check expects (Gemini's measured pace is 10–14). */
const CHECK_CHARS_PER_SECOND = 13;

/** The words of a line without tags, as spoken. */
function spokenText(text: string): string {
  return text.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
}

export function gapBetween(current: ScriptLine, next: ScriptLine | undefined, nextStartsScene: boolean): number {
  if (!next) return 0;
  if (nextStartsScene) return LINE_GAPS.scene;
  const said = spokenText(current.text);
  let gap: number;
  if (next.speaker === current.speaker) gap = LINE_GAPS.sameSpeaker;
  else if (/(…|\.\.\.|[–-])$/.test(said)) gap = LINE_GAPS.cutIn;
  else if (spokenText(next.text).split(" ").filter(Boolean).length <= 3) gap = LINE_GAPS.quickReply;
  else if (/\?["')\]]*$/.test(said)) gap = LINE_GAPS.afterQuestion;
  else gap = LINE_GAPS.reply;
  if (next.sounds?.some((sound) => !sound.at)) gap += LINE_GAPS.soundFirst;
  return gap;
}

/** Seconds a line should roughly take: its words plus the acted reactions and pauses. */
export function expectedSeconds(text: string): number {
  const chars = spokenText(text).length;
  const reactions = (text.match(/\[(laughs|laughing|giggles|chuckles|sighs|gasps|gulps|sniffs|sneezes|snorts|yawns|groans|hums|clears throat|inhales deeply|exhales)\]/gi) ?? []).length;
  const pauses = (text.match(/\[(pause|short pause)\]/gi) ?? []).length + 2 * (text.match(/\[long pause\]/gi) ?? []).length;
  return chars / CHECK_CHARS_PER_SECOND + 0.6 * reactions + 0.5 * pauses;
}

export interface ClipCheck {
  ok: boolean;
  reason?: string;
  /** How far off the clip is (0 = as expected); the best of several takes stays. */
  distance: number;
}

/**
 * Free plausibility check of one clip: speech must be there, and its length must
 * fit the text (a clip twice as long as the words ran on or repeated itself; one
 * far shorter dropped words). Very short lines ("Blubb.") may be stretched by acting.
 */
export function checkClip(text: string, speechSeconds: number | null): ClipCheck {
  if (speechSeconds === null || speechSeconds < 0.15) return { ok: false, reason: "stumm", distance: 10 };
  const expected = expectedSeconds(text);
  const ratio = speechSeconds / Math.max(0.3, expected);
  const distance = Math.abs(Math.log(ratio));
  if (spokenText(text).length < 12) {
    return speechSeconds <= 4 ? { ok: true, distance } : { ok: false, reason: `zu lang (${speechSeconds.toFixed(1)} s für ein kurzes Wort)`, distance };
  }
  if (ratio > 2.4) return { ok: false, reason: `zu lang (${speechSeconds.toFixed(1)} s statt ~${expected.toFixed(1)} s)`, distance };
  if (ratio < 0.45) return { ok: false, reason: `zu kurz (${speechSeconds.toFixed(1)} s statt ~${expected.toFixed(1)} s)`, distance };
  return { ok: true, distance };
}

export interface GeminiRenderInput {
  script: AudioScript;
  engine: VoiceEngine;
  speech: SpeechPort;
  /** Voice and direction of every speaker key. */
  cast: Map<string, SpeakerDirection & { voice: string }>;
  tmpDir: string;
  concurrency?: number;
  log?: (message: string) => void;
}

export interface GeminiRenderStats {
  /** Requests sent, retakes included. */
  requests: number;
  /** Retakes after the audio plausibility check (refusals are tracked separately). */
  retakes: number;
  /** Seconds of audio Gemini generated and billed (padding and retakes included). */
  billedSeconds: number;
  inputTokens: number;
  costUSD: number;
  /** Lines that stayed implausible after every take, for the admin. */
  flagged: Array<{ part: string; line: number; text: string; reason: string }>;
  /** Lines recovered with plain delivery or the same voice on Flash. */
  recovered: Array<{ label: string; voice: string; engine: VoiceEngine }>;
}

interface Clip {
  samples: Int16Array;
  activity: SpeechActivity;
  attempts: number;
  check: ClipCheck;
}

/** Input tokens of one request (Gemini counts roughly 4.5 characters per token). */
const tokensOf = (text: string, instructions: string): number => Math.ceil((text.length + instructions.length) / 4.5);

export async function renderWithGemini(input: GeminiRenderInput): Promise<{ parts: RenderedPart[]; stats: GeminiRenderStats }> {
  const say = input.log ?? ((message: string) => console.log(`[library-audio] ${message}`));
  const model = engineInfo(input.engine).model;
  const stats: GeminiRenderStats = { requests: 0, retakes: 0, billedSeconds: 0, inputTokens: 0, costUSD: 0, flagged: [], recovered: [] };
  const jobs = input.script.parts.flatMap((part, partIndex) => part.lines.map((line, lineIndex) => ({ partIndex, lineIndex, line })));
  const clips: Clip[][] = input.script.parts.map((part) => new Array<Clip>(part.lines.length));
  let sampleRate = 0;

  const record = async (line: ScriptLine, label: string): Promise<Clip> => {
    const speaker = input.cast.get(line.speaker);
    if (!speaker) throw new Error(`${label}: Sprecher ${line.speaker} hat keine Gemini-Stimme.`);
    const direction = geminiLine(line, speaker);
    // Keep every spoken word and the cast's voice. A provider refusal can stem
    // from the direction/tags rather than the story. Try plain delivery once,
    // then (Lite only) the same voice on Flash. All safety filters stay active.
    const variants = [
      { engine: input.engine, model, text: direction.text, instructions: direction.instructions },
      { engine: input.engine, model, text: spokenText(direction.text), instructions: "Natural standard German." },
      ...(input.engine === "gemini-lite"
        ? [{ engine: "gemini-flash" as const, model: engineInfo("gemini-flash").model, text: spokenText(direction.text), instructions: "Natural standard German." }]
        : []),
    ];
    let variant = 0;
    let best: Clip | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      let result;
      for (;;) {
        const request = variants[variant];
        const inputTokens = tokensOf(request.text, request.instructions);
        stats.requests += 1;
        stats.inputTokens += inputTokens;
        stats.costUSD += geminiVoiceCost(request.engine, 0, inputTokens);
        try {
          result = await input.speech({ model: request.model, voice: speaker.voice, text: request.text, instructions: request.instructions });
          break;
        } catch (error) {
          const badTag = error instanceof SpeechError && error.status === 400 && variant === 0 && /\[/.test(request.text) && /(?:bad|invalid|unsupported).*tag/i.test(error.message);
          if (error instanceof SpeechError && (error.moderation || badTag) && variant + 1 < variants.length) {
            variant += 1;
            say(`gemini: ${label} (${speaker.name}, ${speaker.voice}) abgelehnt — ${variant === 1 ? "nimmt mit neutraler Regie neu auf" : "nimmt dieselbe Stimme mit Gemini Flash auf"}`);
            continue;
          }
          if (error instanceof SpeechError) throw new SpeechError(`${label} (${speaker.name}, ${speaker.voice}): ${error.message}`, error.status, error.moderation);
          throw new Error(`${label} (${speaker.name}, ${speaker.voice}): ${(error as Error)?.message || error}`);
        }
      }
      sampleRate = sampleRate || result.sampleRate;
      const samples = samplesFromPcm(result.pcm);
      stats.billedSeconds += samples.length / result.sampleRate;
      stats.costUSD += geminiVoiceCost(variants[variant].engine, samples.length / result.sampleRate, 0);
      const activity = analyzeSpeech(samples, result.sampleRate);
      const check = checkClip(direction.text, activity ? (activity.end - activity.start) / result.sampleRate : null);
      const clip: Clip = { samples, activity: activity ?? { start: 0, end: samples.length, levelDb: -90, peak: 0 }, attempts: attempt, check };
      if (!best || check.distance < best.check.distance) best = clip;
      best.attempts = attempt;
      if (check.ok) break;
      if (attempt < MAX_ATTEMPTS) {
        stats.retakes += 1;
        say(`gemini: ${label} ${check.reason} — nimmt neu auf`);
      }
    }
    if (variant > 0) stats.recovered.push({ label, voice: speaker.voice, engine: variants[variant].engine });
    return best!;
  };

  let next = 0;
  let done = 0;
  let failure: { error: unknown } | undefined;
  const workers = Array.from({ length: Math.min(input.concurrency ?? DEFAULT_CONCURRENCY, jobs.length) }, async () => {
    while (!failure && next < jobs.length) {
      const job = jobs[next++];
      const part = input.script.parts[job.partIndex];
      try {
        clips[job.partIndex][job.lineIndex] = await record(job.line, `${part.title}, Zeile ${job.lineIndex + 1}`);
      } catch (error) {
        failure ??= { error };
        return;
      }
      done += 1;
      if (done % 25 === 0 || done === jobs.length) say(`gemini: ${done}/${jobs.length} Zeilen`);
    }
  });
  await Promise.all(workers);
  // Drain the in-flight requests before the caller marks the render failed and
  // removes its temporary files. Never schedule the rest of a failed episode.
  if (failure) throw failure.error;

  // Every figure at the same presence: one gain per speaker from the median of its lines.
  const levels = new Map<string, number[]>();
  input.script.parts.forEach((part, partIndex) =>
    part.lines.forEach((line, lineIndex) => {
      const clip = clips[partIndex][lineIndex];
      if (clip.check.distance < 10) levels.set(line.speaker, [...(levels.get(line.speaker) ?? []), clip.activity.levelDb]);
    }),
  );
  const gains = new Map<string, number>();
  for (const [speaker, values] of levels) {
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    gains.set(speaker, Math.max(-MAX_CUT_DB, Math.min(MAX_BOOST_DB, TARGET_LEVEL_DB - median)));
  }

  const rate = sampleRate || 24_000;
  const parts: RenderedPart[] = [];
  for (const [partIndex, part] of input.script.parts.entries()) {
    const chunks: Int16Array[] = [];
    const lineSpans: RenderedPart["lineSpans"] = [];
    const words: WordTime[] = [];
    const sceneStarts = new Set(part.scenes.map((scene) => scene.startLine));
    let offset = 0;
    part.lines.forEach((line, lineIndex) => {
      const clip = clips[partIndex][lineIndex];
      if (!clip.check.ok) {
        stats.flagged.push({ part: part.title, line: lineIndex + 1, text: spokenText(line.text).slice(0, 80), reason: clip.check.reason ?? "unplausibel" });
      }
      const trimmed = cut(clip.samples, clip.activity.start, clip.activity.end, rate);
      const leveled = applyGain(trimmed, safeGainDb(gains.get(line.speaker) ?? 0, clip.activity.peak));
      const start = offset / rate;
      chunks.push(leveled);
      offset += leveled.length;
      const end = offset / rate;
      lineSpans.push({ start, end });
      words.push(...estimateWordTimes(line.text, start, end));
      const gap = gapBetween(line, part.lines[lineIndex + 1], sceneStarts.has(lineIndex + 1));
      if (gap > 0) {
        const pause = silence(gap, rate);
        chunks.push(pause);
        offset += pause.length;
      }
    });
    const file = path.join(input.tmpDir, `gemini-part-${partIndex + 1}.wav`);
    await fs.writeFile(file, wavBuffer(concatSamples(chunks), rate));
    const seconds = offset / rate;
    parts.push({ part, segments: [{ path: file, seconds }], lineSpans, words, seconds });
  }

  return { parts, stats };
}
