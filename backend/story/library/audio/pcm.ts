/**
 * 16-bit mono PCM helpers for the Gemini voice track — Encore-free, no ffmpeg.
 *
 * Gemini answers every line with raw PCM padded with silence (often 0.5–0.8 s at
 * the end). Line by line the editor trims that padding, measures how loud the
 * speech is, levels a figure, and writes the edited part as one WAV, so every
 * line's position on the track is known to the sample.
 */

export const GEMINI_SAMPLE_RATE = 24_000;

/** Raw little-endian 16-bit PCM as samples (copied, so the source buffer's alignment does not matter). */
export function samplesFromPcm(pcm: Buffer): Int16Array {
  const length = pcm.length - (pcm.length % 2);
  const bytes = new Uint8Array(length);
  bytes.set(pcm.subarray(0, length));
  return new Int16Array(bytes.buffer, 0, length / 2);
}

export function silence(seconds: number, sampleRate = GEMINI_SAMPLE_RATE): Int16Array {
  return new Int16Array(Math.max(0, Math.round(seconds * sampleRate)));
}

export function concatSamples(chunks: Int16Array[]): Int16Array {
  const out = new Int16Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function wavBuffer(samples: Int16Array, sampleRate = GEMINI_SAMPLE_RATE): Buffer {
  const header = Buffer.alloc(44);
  const dataBytes = samples.length * 2;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataBytes, 40);
  return Buffer.concat([header, Buffer.from(samples.buffer, samples.byteOffset, dataBytes)]);
}

const FRAME_SECONDS = 0.01;
/** Speech ends where the frame level falls this far below the loudest frame (soft consonants and decays survive). */
const EDGE_BELOW_PEAK_DB = 45;
const EDGE_FLOOR_DBFS = -60;
/** Frames this close to the loudest one count as "speech" for the level. */
const ACTIVE_BELOW_PEAK_DB = 30;
/** Kept before the first and after the last speech frame: breath-in and the natural decay. */
const PRE_ROLL_SECONDS = 0.06;
const POST_ROLL_SECONDS = 0.14;

const dbToRatio = (db: number): number => Math.pow(10, db / 20);
const ratioToDb = (ratio: number): number => 20 * Math.log10(Math.max(ratio, 1e-9));

export interface SpeechActivity {
  /** First and last sample to keep (end exclusive), pre- and post-roll included. */
  start: number;
  end: number;
  /** RMS of the speaking frames, dBFS. */
  levelDb: number;
  /** Highest absolute sample, 0–1. */
  peak: number;
}

/** Where the speech of a clip begins and ends and how loud it is; null for a silent clip. */
export function analyzeSpeech(samples: Int16Array, sampleRate = GEMINI_SAMPLE_RATE): SpeechActivity | null {
  const frame = Math.max(1, Math.round(sampleRate * FRAME_SECONDS));
  const frames = Math.floor(samples.length / frame);
  if (frames === 0) return null;
  const rms = new Float64Array(frames);
  let loudest = 0;
  let peak = 0;
  for (let index = 0; index < frames; index += 1) {
    let sum = 0;
    for (let sample = index * frame; sample < (index + 1) * frame; sample += 1) {
      const value = samples[sample] / 32768;
      sum += value * value;
      const magnitude = Math.abs(value);
      if (magnitude > peak) peak = magnitude;
    }
    rms[index] = Math.sqrt(sum / frame);
    if (rms[index] > loudest) loudest = rms[index];
  }
  const edge = Math.max(loudest * dbToRatio(-EDGE_BELOW_PEAK_DB), dbToRatio(EDGE_FLOOR_DBFS));
  if (loudest < edge || loudest <= dbToRatio(EDGE_FLOOR_DBFS)) return null;
  let first = 0;
  while (first < frames && rms[first] < edge) first += 1;
  let last = frames - 1;
  while (last > first && rms[last] < edge) last -= 1;

  const active = loudest * dbToRatio(-ACTIVE_BELOW_PEAK_DB);
  let energy = 0;
  let count = 0;
  for (let index = first; index <= last; index += 1) {
    if (rms[index] < active) continue;
    energy += rms[index] * rms[index];
    count += 1;
  }
  return {
    start: Math.max(0, first * frame - Math.round(PRE_ROLL_SECONDS * sampleRate)),
    end: Math.min(samples.length, (last + 1) * frame + Math.round(POST_ROLL_SECONDS * sampleRate)),
    levelDb: ratioToDb(Math.sqrt(energy / Math.max(1, count))),
    peak,
  };
}

/** A copy of [start, end) with short fades at the cuts (no clicks). */
export function cut(samples: Int16Array, start: number, end: number, sampleRate = GEMINI_SAMPLE_RATE): Int16Array {
  const out = samples.slice(Math.max(0, start), Math.min(samples.length, end));
  const fade = Math.min(Math.round(0.005 * sampleRate), Math.floor(out.length / 2));
  for (let index = 0; index < fade; index += 1) {
    const ratio = index / fade;
    out[index] = Math.round(out[index] * ratio);
    out[out.length - 1 - index] = Math.round(out[out.length - 1 - index] * ratio);
  }
  return out;
}

/** Applied gain in dB: never more than lets the peak reach `ceiling`. */
export function safeGainDb(gainDb: number, peak: number, ceiling = 0.97): number {
  if (peak <= 0) return gainDb;
  return Math.min(gainDb, ratioToDb(ceiling / peak));
}

export function applyGain(samples: Int16Array, gainDb: number): Int16Array {
  if (Math.abs(gainDb) < 0.05) return samples;
  const ratio = dbToRatio(gainDb);
  const out = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    out[index] = Math.max(-32768, Math.min(32767, Math.round(samples[index] * ratio)));
  }
  return out;
}
