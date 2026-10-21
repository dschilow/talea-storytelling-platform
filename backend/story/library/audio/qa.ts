/**
 * Listening check of a recorded take — Encore-free.
 *
 * Eleven v4 sometimes drops a line or invents a sentence in long dialogue
 * requests (measured 2026-10-21: one chapter in one request lost two lines and
 * garbled a third). Every take is therefore transcribed and aligned word by
 * word with its screenplay lines; a take with a missing line or a stretch of
 * words nobody wrote is recorded again.
 */

import type { ScriptLine } from "../types";

const UNITS = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"];
const TENS = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"];

/** German number words, so "46" in a transcript matches "sechsundvierzig" in the script. */
export function germanNumber(value: number): string {
  if (value < 20) return UNITS[value];
  if (value < 100) {
    const unit = value % 10;
    return unit ? `${unit === 1 ? "ein" : UNITS[unit]}und${TENS[Math.floor(value / 10)]}` : TENS[value / 10];
  }
  if (value < 1000) {
    const rest = value % 100;
    return `${Math.floor(value / 100) === 1 ? "ein" : UNITS[Math.floor(value / 100)]}hundert${rest ? germanNumber(rest) : ""}`;
  }
  return String(value);
}

export function listenWords(text: string): string[] {
  return String(text || "")
    .replace(/\[[^\]]*\]/g, " ")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/\d+/g, (digits) => ` ${germanNumber(Number(digits)).replace(/ß/g, "ss")} `)
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Longest common subsequence of two word lists: which script word was heard where. */
function alignWords(script: string[], heard: string[]): { scriptHit: boolean[]; heardHit: boolean[] } {
  const rows = script.length;
  const cols = heard.length;
  const table = Array.from({ length: rows + 1 }, () => new Uint16Array(cols + 1));
  const same = (a: string, b: string) => a === b || (a.length > 4 && b.length > 4 && (a.startsWith(b.slice(0, 4)) && Math.abs(a.length - b.length) <= 2));
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      table[i][j] = same(script[i], heard[j]) ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const scriptHit = new Array<boolean>(rows).fill(false);
  const heardHit = new Array<boolean>(cols).fill(false);
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (same(script[i], heard[j])) {
      scriptHit[i] = true;
      heardHit[j] = true;
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return { scriptHit, heardHit };
}

export interface TakeCheck {
  /** Share of script words that were heard. */
  coverage: number;
  /** Lines (index within the take) that were mostly not heard. */
  missingLines: number[];
  /** A run of heard words that is in no line (an invented sentence). */
  inventedRun: string | null;
  passed: boolean;
  score: number;
}

/** Lines this short ("Blubb.", "PLOPP.") are left out of the per-line check: speech-to-text misses them too often. */
const MIN_CHECKED_WORDS = 3;
const MIN_LINE_COVERAGE = 0.6;
const MIN_TAKE_COVERAGE = 0.88;
const INVENTED_RUN_WORDS = 6;

export function checkTake(lines: ScriptLine[], heardText: string): TakeCheck {
  const script: string[] = [];
  const owner: number[] = [];
  lines.forEach((line, index) => {
    for (const word of listenWords(line.text)) {
      script.push(word);
      owner.push(index);
    }
  });
  const heard = listenWords(heardText);
  if (!script.length) return { coverage: 1, missingLines: [], inventedRun: null, passed: true, score: 1 };
  const { scriptHit, heardHit } = alignWords(script, heard);

  const perLine = new Map<number, { hit: number; total: number }>();
  owner.forEach((line, index) => {
    const entry = perLine.get(line) ?? { hit: 0, total: 0 };
    entry.total += 1;
    if (scriptHit[index]) entry.hit += 1;
    perLine.set(line, entry);
  });
  const missingLines = [...perLine.entries()]
    .filter(([, entry]) => entry.total >= MIN_CHECKED_WORDS && entry.hit / entry.total < MIN_LINE_COVERAGE)
    .map(([line]) => line);

  let inventedRun: string | null = null;
  let run: string[] = [];
  const closeRun = () => {
    if (run.length >= INVENTED_RUN_WORDS && (!inventedRun || run.length > inventedRun.split(" ").length)) inventedRun = run.join(" ");
    run = [];
  };
  heard.forEach((word, index) => {
    if (heardHit[index]) closeRun();
    else run.push(word);
  });
  closeRun();

  const coverage = scriptHit.filter(Boolean).length / script.length;
  const passed = missingLines.length === 0 && coverage >= MIN_TAKE_COVERAGE && !inventedRun;
  const score = coverage - 0.15 * missingLines.length - (inventedRun ? 0.2 : 0);
  return { coverage, missingLines, inventedRun, passed, score };
}

/**
 * Splits a part into takes of at most `maxChars` spoken characters, preferring a
 * cut where a scene starts (a natural breath in the drama). Returns line ranges.
 */
export function planTakes(lines: ScriptLine[], sceneStarts: number[], maxChars = 1600): Array<{ from: number; to: number }> {
  const scenes = new Set(sceneStarts);
  const takes: Array<{ from: number; to: number }> = [];
  let from = 0;
  let chars = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const length = lines[index].text.length + 1;
    if (index > from && chars + length > maxChars) {
      // Cut at the latest scene start inside the second half of this take, else right here.
      let cut = index;
      for (let candidate = index; candidate > from + Math.floor((index - from) / 2); candidate -= 1) {
        if (scenes.has(candidate)) {
          cut = candidate;
          break;
        }
      }
      takes.push({ from, to: cut });
      from = cut;
      chars = lines.slice(cut, index).reduce((sum, line) => sum + line.text.length + 1, 0);
    }
    chars += length;
  }
  if (from < lines.length) takes.push({ from, to: lines.length });
  return takes;
}
