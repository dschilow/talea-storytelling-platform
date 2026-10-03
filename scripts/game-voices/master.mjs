/** Schneiden, Lautheit angleichen und klein kodieren (ffmpeg). Gemeinsam für Sprache und Klänge. */
import { spawnSync } from "node:child_process";

/** ffmpeg-Aufruf, gibt stderr zurück (ffmpeg schreibt Messwerte dorthin). */
export function ff(argv) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-y", ...argv], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffmpeg: ${(r.stderr || "").slice(-400)}`);
  return r.stderr || "";
}

const trimChain = (threshold, minDuration, lead, tail) =>
  `silenceremove=start_periods=1:start_threshold=${threshold}dB:start_duration=${minDuration}:start_silence=${lead},areverse,silenceremove=start_periods=1:start_threshold=${threshold}dB:start_duration=${minDuration}:start_silence=${tail},areverse`;
/** Sprache: Stille vorn/hinten weg (Rohdatei ist laut genug, absolute Schwelle −48 dBFS). */
const TRIM_SPEECH = trimChain(-48, 0.02, 0.03, 0.06);
/** Klänge: erst Pegel anheben, dann sanft schneiden, sonst fressen leise Rohdateien den Ausklang (Glocke, Gong). */
const TRIM_SFX = trimChain(-55, 0.004, 0.01, 0.08);

/**
 * target: Ziel-Lautheit in LUFS · trim: "speech" (vor der Pegelung schneiden), "sfx" (nach der Pegelung, sanft), false
 * peakCap: höchste erlaubte Spitze in dBFS nach der Pegelung (verhindert, dass kurze Knackser/Ticks riesig verstärkt werden)
 * fadeOut: Sekunden Ausblendung am Ende · bitrate: mp3-Bitrate · Mono, 44,1 kHz.
 * Spitzen werden bei −3 dBFS begrenzt (MP3-Kodierung überschwingt um 1–2 dB).
 */
export function master(rawPath, outPath, { target = -19, trim = "speech", peakCap = null, fadeOut = 0.04, bitrate = "64k", maxGain = 25 } = {}) {
  const pre = trim === "speech" ? `${TRIM_SPEECH},` : "";
  const post = trim === "sfx" ? `${TRIM_SFX},` : "";
  const log = ff(["-i", rawPath, "-af", `${pre}ebur128=peak=true`, "-f", "null", "-"]);
  const lufs = [...log.matchAll(/\bI:\s+(-?\d+(?:\.\d+)?)\s+LUFS/g)].pop();
  const peak = [...log.matchAll(/Peak:\s+(-?\d+(?:\.\d+)?)\s+dBFS/g)].pop();
  let gain;
  if (lufs && Number(lufs[1]) > -60) {
    gain = target - Number(lufs[1]);
  } else {
    const vd = ff(["-i", rawPath, "-af", `${pre}volumedetect`, "-f", "null", "-"]);
    const mean = vd.match(/mean_volume:\s+(-?\d+(?:\.\d+)?)\s+dB/);
    gain = mean ? target - 1 - Number(mean[1]) : 0;
  }
  if (peakCap !== null && peak) gain = Math.min(gain, peakCap - Number(peak[1]));
  gain = Math.max(-25, Math.min(maxGain, gain));
  ff([
    "-i", rawPath,
    "-af", `${pre}volume=${gain.toFixed(2)}dB,${post}alimiter=limit=0.72:level=0:attack=2:release=40,afade=t=in:d=0.005,areverse,afade=t=in:d=${fadeOut},areverse`,
    "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", bitrate, outPath,
  ]);
  const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", outPath], { encoding: "utf8" });
  return { gain: Number(gain.toFixed(2)), duration: Number.parseFloat(probe.stdout) || 0 };
}
