/**
 * The audio drama's timeline — Encore-free.
 *
 * Lays the rendered parts end to end with room for the music (theme before the
 * title, a bridge between chapters, the theme again under the teaser) and turns
 * the screenplay's directions into cues: one ambience bed per scene, the
 * series' score under the scenes that ask for it, every sound on the word it
 * belongs to. Times are seconds on the voice track.
 */

import type { VoicePiece } from "../../../doku/audio-render";
import type { SoundCue } from "../../../doku/sound-cues";
import type { ScoreMood, ScriptPart } from "../types";

export interface WordTime {
  word: string;
  start: number;
  end: number;
}

export interface RenderedPart {
  part: ScriptPart;
  /** Voice files of this part in playing order (with their decoded lengths) and breaths between takes. */
  segments: Array<{ path: string; seconds: number } | { silence: number }>;
  /** Span of every line, relative to the part's start; null when unknown. */
  lineSpans: Array<{ start: number; end: number } | null>;
  /** Spoken words relative to the part's start. */
  words: WordTime[];
  seconds: number;
}

export interface ScoreTrack {
  mood: ScoreMood;
  path: string;
  seconds: number;
}

export interface Timeline {
  voice: VoicePiece[];
  seconds: number;
  cues: SoundCue[];
  /** Start of every part on the voice track. */
  partStarts: number[];
  /** Start of every chapter (by chapter index). */
  chapterStarts: number[];
}

export const GAPS = {
  leadInWithTheme: 6,
  leadIn: 0.8,
  afterOpening: 1.8,
  bridge: 4.2,
  plainBreak: 2,
  beforeClosing: 2.4,
  tailWithTheme: 7,
  tail: 1.5,
};

const AMBIENCE_GAIN: Record<"low" | "normal" | "high", number> = { low: -32, normal: -28, high: -24 };
const SFX_GAIN = -11;
/** Score tracks are loudness-normalized (−16 LUFS) when prepared, so these gains are predictable. */
const BED_GAIN = -16;
const THEME_GAIN = -8;
const BRIDGE_GAIN = -8;
const CLOSING_THEME_GAIN = -9;
/** A spot effect starts a hair before its word: the attack lands with the syllable. */
const SFX_LEAD = 0.08;

const normalize = (word: string): string => word.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** What the sound generator is asked for a scene's ambience bed (the cache key is made from it). */
export const ambiencePrompt = (ambience: string): string => `${ambience}, no music, no clear speech`;

/** Length a spot effect is generated with (and keyed by): 0.5–6 s, 1.5 s when the screenplay names none. */
export const spotSeconds = (seconds?: number): number => Math.round(Math.max(0.5, Math.min(6, seconds ?? 1.5)) * 10) / 10;

/** Start time of the word a sound is anchored to, inside the line's span. */
export function anchorTime(words: WordTime[], span: { start: number; end: number }, anchor?: string): number {
  if (!anchor) return span.start;
  const target = normalize(anchor);
  if (!target) return span.start;
  const hit = words.find((word) => word.start >= span.start - 0.05 && word.start <= span.end + 0.05 && (normalize(word.word) === target || normalize(word.word).startsWith(target)));
  return hit ? hit.start : span.start;
}

/**
 * Word times inside a line's span when the engine returns none (Gemini): spread by
 * length, with room for the pause after punctuation. Close enough to land a sound
 * on its word.
 */
export function estimateWordTimes(text: string, start: number, end: number): WordTime[] {
  const words = text.replace(/\[[^\]]*\]/g, " ").split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word));
  if (!words.length || end <= start) return [];
  const letters = words.map((word) => word.replace(/[^\p{L}\p{N}]/gu, "").length + 1);
  const pauses = words.map((word) => (/[.!?…]["')\]]*$/.test(word) ? 4 : /[,;:–-]$/.test(word) ? 2 : 0));
  const total = letters.reduce((sum, value, index) => sum + value + pauses[index], 0);
  const perUnit = (end - start) / total;
  let cursor = start;
  return words.map((word, index) => {
    const spoken = letters[index] * perUnit;
    const timed = { word: word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""), start: cursor, end: cursor + spoken };
    cursor += spoken + pauses[index] * perUnit;
    return timed;
  });
}

/** Char-weighted line spans for a part whose audio came back without timing. */
export function estimateLineSpans(part: ScriptPart, seconds: number): Array<{ start: number; end: number }> {
  const weights = part.lines.map((line) => Math.max(1, line.text.replace(/\[[^\]]*\]/g, "").trim().length));
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  let cursor = 0;
  return weights.map((weight) => {
    const start = cursor;
    cursor += (weight / total) * seconds;
    return { start, end: cursor };
  });
}

export function buildTimeline(parts: RenderedPart[], score: Map<ScoreMood, ScoreTrack>): Timeline {
  const theme = score.get("theme");
  const bridge = score.get("bridge");
  const voice: VoicePiece[] = [];
  const cues: SoundCue[] = [];
  const partStarts: number[] = [];
  const chapterStarts: number[] = [];
  let cursor = 0;

  const silence = (seconds: number) => {
    voice.push({ silence: seconds });
    cursor += seconds;
  };

  silence(theme ? GAPS.leadInWithTheme : GAPS.leadIn);
  parts.forEach((rendered, index) => {
    const next = parts[index + 1];
    if (rendered.part.kind === "closing" && index > 0) {
      // The theme comes back under the teaser.
      silence(GAPS.beforeClosing);
    }
    const start = cursor;
    partStarts.push(start);
    if (rendered.part.kind === "chapter") chapterStarts[rendered.part.chapterIndex ?? chapterStarts.length] = start;
    for (const segment of rendered.segments) voice.push("path" in segment ? { path: segment.path } : { silence: segment.silence });
    cursor += rendered.seconds;
    placeSceneCues(rendered, start, score, cues);

    if (rendered.part.kind === "opening") {
      silence(GAPS.afterOpening);
      if (theme) cues.push(musicCue(theme, 0, start + rendered.seconds + GAPS.afterOpening + 1.2, THEME_GAIN, 0.2, 2.5));
    } else if (rendered.part.kind === "chapter" && next?.part.kind === "chapter") {
      const end = cursor;
      silence(bridge ? GAPS.bridge : GAPS.plainBreak);
      if (bridge) cues.push(musicCue(bridge, Math.max(0, end - 0.5), GAPS.bridge + 2.5, BRIDGE_GAIN, 0.3, 1.5));
    }
  });

  const closing = parts.findIndex((rendered) => rendered.part.kind === "closing");
  silence(theme ? GAPS.tailWithTheme : GAPS.tail);
  if (theme && closing >= 0) {
    const from = partStarts[closing] - GAPS.beforeClosing + 0.4;
    cues.push(musicCue(theme, from, cursor - from, CLOSING_THEME_GAIN, 1.5, 3.5));
  }
  return { voice, seconds: cursor, cues: cues.sort((a, b) => a.start - b.start), partStarts, chapterStarts };
}

function musicCue(track: ScoreTrack, start: number, duration: number, gainDb: number, fadeIn: number, fadeOut: number): SoundCue {
  return {
    type: "music",
    start: Math.max(0, start),
    duration: Math.max(0.5, Math.min(duration, track.seconds)),
    gainDb,
    behavior: "oneshot",
    fadeIn,
    fadeOut,
    pan: 0,
    assetPath: track.path,
  };
}

function placeSceneCues(rendered: RenderedPart, partStart: number, score: Map<ScoreMood, ScoreTrack>, cues: SoundCue[]): void {
  const { part, lineSpans, words } = rendered;
  const spanOf = (line: number) => lineSpans[line] ?? { start: (line / Math.max(1, part.lines.length)) * rendered.seconds, end: ((line + 1) / Math.max(1, part.lines.length)) * rendered.seconds };

  const startOf = (index: number) => (index < part.scenes.length ? spanOf(Math.min(part.scenes[index].startLine, part.lines.length - 1)).start : rendered.seconds);
  part.scenes.forEach((scene, index) => {
    const from = startOf(index);
    const length = Math.max(1, startOf(index + 1) - from);
    // The same place again (a music cue inside a scene): the ambience simply carries on.
    const sameAsBefore = index > 0 && part.scenes[index - 1].ambience === scene.ambience;
    if (scene.ambience && !sameAsBefore) {
      let last = index;
      while (last + 1 < part.scenes.length && part.scenes[last + 1].ambience === scene.ambience) last += 1;
      cues.push({
        type: "ambience",
        start: Math.max(0, partStart + from - 0.3),
        duration: Math.max(1, startOf(last + 1) - from) + 0.9,
        gainDb: AMBIENCE_GAIN[scene.ambienceLevel ?? "normal"],
        behavior: "loop",
        fadeIn: 1.5,
        fadeOut: 1.5,
        pan: 0,
        prompt: ambiencePrompt(scene.ambience),
      });
    }
    const bed = scene.music ? score.get(scene.music) : undefined;
    if (bed) cues.push(musicCue(bed, partStart + from, length + 1, BED_GAIN, 2, 3));
  });

  part.lines.forEach((line, index) => {
    if (!line.sounds?.length) return;
    const span = spanOf(index);
    for (const sound of line.sounds) {
      cues.push({
        type: "sfx",
        start: Math.max(0, partStart + anchorTime(words, span, sound.at) - SFX_LEAD),
        duration: spotSeconds(sound.seconds),
        gainDb: SFX_GAIN,
        behavior: "oneshot",
        fadeIn: 0,
        fadeOut: 0.2,
        pan: 0,
        prompt: sound.sound,
      });
    }
  });
}
