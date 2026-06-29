import { api, APIError } from "encore.dev/api";
import log from "encore.dev/log";
import { promises as fs } from "fs";
import { spawn } from "child_process";
import os from "os";
import path from "path";

import { getAuthData } from "~encore/auth";
import { ensureAdmin } from "../admin/authz";
import {
  synthesizeDialogue,
  synthesizeSoundEffect,
} from "../tts/elevenlabs-dialogue";

// ============================================================
// Server-side studio master for audio dokus.
//
// Pipeline (no MP3 transcoding before the final encode):
//   1. ElevenLabs dialogue rendered straight to lossless PCM (pcm_44100, mono s16le).
//   2. Per active screenplay scene, an ambient sound clip (MP3 container so ffmpeg can
//      decode it without us having to guess channel counts).
//   3. A single ffmpeg graph does the actual engineering:
//        - place + loop + fade each ambient into its (char-estimated) scene window
//        - sidechain-duck the combined ambient bed under the voice
//        - crossfade the Talea intro/outro around the body
//        - EBU R128 loudness normalize (-16 LUFS) + true-peak limit
//        - encode ONCE to 320 kbps MP3
//
// This replaces the browser-side Web Audio + lamejs mix, which transcoded MP3 multiple
// times and used a hand-rolled ducking/limiter.
// ============================================================

const SAMPLE_RATE = 44100;
/** ElevenLabs dialogue output: raw signed 16-bit little-endian PCM, mono, 44.1 kHz. */
const DIALOGUE_OUTPUT_FORMAT = "pcm_44100";
const DIALOGUE_BYTES_PER_SAMPLE = 2;

const AMBIENT_SKIP_VOLUME = 0.01;
const AMBIENT_MAX_VOLUME = 0.25;
const AMBIENT_DEFAULT_VOLUME = 0.08;
const AMBIENT_MIN_SECONDS = 0.5;
const AMBIENT_MAX_SECONDS = 30;
const AMBIENT_DEFAULT_SECONDS = 10;
const MAX_SCENES = 24;
// Loop-buffer cap for ffmpeg aloop, in samples. Ambient clips are <= AMBIENT_MAX_SECONDS,
// so this comfortably holds one full clip without an oversized allocation.
const AMBIENT_LOOP_BUFFER_SAMPLES = (AMBIENT_MAX_SECONDS + 4) * SAMPLE_RATE;

// Mastering targets.
const LOUDNORM_I = -16; // integrated loudness (LUFS), stereo podcast/doc standard
const LOUDNORM_TP = -1.5; // max true peak (dBTP)
const LOUDNORM_LRA = 11; // loudness range
const MP3_BITRATE = "320k";

const INTRO_CANDIDATES = [
  "frontend/dist/audio-doku/Talea_intro.mp3",
  "backend/frontend/dist/audio-doku/Talea_intro.mp3",
  "frontend/public/audio-doku/Talea_intro.mp3",
  "AudioDoku/Talea_intro.mp3",
];
const OUTRO_CANDIDATES = [
  "frontend/dist/audio-doku/talea-end.mp3",
  "backend/frontend/dist/audio-doku/talea-end.mp3",
  "frontend/public/audio-doku/talea-end.mp3",
  "AudioDoku/talea-end.mp3",
];

interface RenderScene {
  index: number;
  startLine: number;
  endLine: number;
  ambientPrompt: string;
  ambientVolume: number;
  durationSeconds?: number;
}

interface RenderAudioDokuMasterRequest {
  script: string;
  speakerVoiceMap: Record<string, string>;
  screenplay?: RenderScene[];
  modelId?: string;
  enableAmbient?: boolean;
  includeBranding?: boolean;
  title?: string;
}

interface RenderAudioDokuMasterResponse {
  /** Base64 data URL of the finished, mastered MP3. */
  audioData: string;
  mimeType: string;
  durationSeconds: number;
  scenesWithAmbient: number;
  turns: number;
  speakers: string[];
}

const isAmbientPromptSkip = (prompt: string): boolean => {
  const p = (prompt || "").trim().toLowerCase();
  return (
    !p ||
    p.includes("skip ambient") ||
    p.includes("voice only") ||
    p.includes("reine stimme") ||
    p.includes("nur stimme") ||
    p.includes("kein hintergrund") ||
    p.includes("ohne hintergrund") ||
    p.includes("kein sound") ||
    p === "silence" ||
    p === "stille" ||
    p.startsWith("silent ")
  );
};

const clampAmbientDuration = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return AMBIENT_DEFAULT_SECONDS;
  return Math.max(AMBIENT_MIN_SECONDS, Math.min(AMBIENT_MAX_SECONDS, n));
};

const clampAmbientVolume = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return AMBIENT_DEFAULT_VOLUME;
  return Math.max(0, Math.min(AMBIENT_MAX_VOLUME, n));
};

type SceneWindow = {
  scene: RenderScene;
  startSec: number;
  endSec: number;
};

/**
 * Estimates a per-scene time window from the character weight of the lines each scene
 * covers. Approximate (TTS speed varies) but reliable without per-line timestamps.
 */
const estimateSceneWindows = (
  scriptLines: string[],
  scenes: RenderScene[],
  totalDurationSec: number,
): SceneWindow[] => {
  if (scenes.length === 0 || totalDurationSec <= 0) return [];

  const weights = scriptLines.map((line) => {
    const stripped = line
      .replace(/\[[^\]]*\]/g, "")
      .replace(/^[^:]{1,80}:\s*/, "")
      .trim();
    return Math.max(1, stripped.length);
  });
  const totalWeight = weights.reduce((s, w) => s + w, 0) || 1;
  const secPerWeight = totalDurationSec / totalWeight;

  const cumulative: number[] = [0];
  for (const w of weights) cumulative.push(cumulative[cumulative.length - 1] + w);

  return scenes.map((scene) => {
    const sIdx = Math.max(1, Math.min(scriptLines.length, scene.startLine)) - 1;
    const eIdx = Math.max(sIdx + 1, Math.max(1, Math.min(scriptLines.length, scene.endLine)));
    return {
      scene,
      startSec: cumulative[sIdx] * secPerWeight,
      endSec: cumulative[eIdx] * secPerWeight,
    };
  });
};

const resolveStaticAsset = async (candidates: string[]): Promise<string | null> => {
  for (const rel of candidates) {
    const abs = path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel);
    try {
      await fs.access(abs);
      return abs;
    } catch {
      // try next candidate
    }
  }
  return null;
};

const runFfmpeg = (args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 40000) stderr = stderr.slice(-40000);
    });
    proc.on("error", (err) => {
      reject(
        new Error(
          `ffmpeg konnte nicht gestartet werden (ist ffmpeg installiert?): ${err.message}`,
        ),
      );
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-2000)}`));
    });
  });

export const renderAudioDokuMaster = api<
  RenderAudioDokuMasterRequest,
  RenderAudioDokuMasterResponse
>(
  { expose: true, method: "POST", path: "/doku/audio-render/master", auth: true },
  async (req) => {
    ensureAdmin();
    const auth = getAuthData();
    if (!auth?.userID) {
      throw APIError.unauthenticated("Login required");
    }

    const script = (req.script || "").trim();
    if (!script) {
      throw APIError.invalidArgument("script is required");
    }
    if (!req.speakerVoiceMap || Object.keys(req.speakerVoiceMap).length === 0) {
      throw APIError.invalidArgument("speakerVoiceMap is required");
    }

    const enableAmbient = req.enableAmbient !== false;
    const includeBranding = req.includeBranding !== false;

    // --- 1) Dialogue → lossless PCM -----------------------------------------
    const dialogue = await synthesizeDialogue({
      script,
      speakerVoiceMap: req.speakerVoiceMap,
      modelId: req.modelId,
      outputFormat: DIALOGUE_OUTPUT_FORMAT,
    });
    const dialoguePcm = dialogue.audio;
    const dialogueDurationSec =
      dialoguePcm.length / DIALOGUE_BYTES_PER_SAMPLE / SAMPLE_RATE;
    if (dialogueDurationSec <= 0) {
      throw APIError.unavailable("ElevenLabs returned no usable dialogue audio.");
    }

    // --- 2) Resolve active ambient scenes -----------------------------------
    const scriptLines = script.replace(/\r\n/g, "\n").split("\n");
    const rawScenes = Array.isArray(req.screenplay) ? req.screenplay.slice(0, MAX_SCENES) : [];
    const windows = enableAmbient
      ? estimateSceneWindows(scriptLines, rawScenes, dialogueDurationSec)
      : [];

    const activeWindows = windows.filter((w) => {
      const vol = clampAmbientVolume(w.scene.ambientVolume);
      return vol > AMBIENT_SKIP_VOLUME && !isAmbientPromptSkip(w.scene.ambientPrompt);
    });

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "audiodoku-"));
    try {
      // Write dialogue PCM to disk for ffmpeg.
      const voicePath = path.join(tmpDir, "voice.pcm");
      await fs.writeFile(voicePath, dialoguePcm);

      // Generate + write each ambient clip (MP3 container).
      const ambientPaths: Array<{ filePath: string; window: SceneWindow }> = [];
      for (const w of activeWindows) {
        try {
          const durationSeconds = clampAmbientDuration(w.scene.durationSeconds);
          const sound = await synthesizeSoundEffect({
            prompt: w.scene.ambientPrompt,
            durationSeconds,
            mode: "loop",
            promptInfluence: 0.65,
            // MP3 container → ffmpeg decodes channels/rate reliably.
          });
          const filePath = path.join(tmpDir, `ambient-${w.scene.index}.mp3`);
          await fs.writeFile(filePath, sound.audio);
          ambientPaths.push({ filePath, window: w });
        } catch (err) {
          log.warn(
            `[AudioDokuMaster] Ambient for scene ${w.scene.index} failed, skipping: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }

      // Resolve branding assets (skip gracefully if not found on disk).
      let introPath: string | null = null;
      let outroPath: string | null = null;
      if (includeBranding) {
        introPath = await resolveStaticAsset(INTRO_CANDIDATES);
        outroPath = await resolveStaticAsset(OUTRO_CANDIDATES);
        if (!introPath || !outroPath) {
          log.warn(
            `[AudioDokuMaster] Branding asset(s) not found (intro=${Boolean(
              introPath,
            )}, outro=${Boolean(outroPath)}); rendering without missing branding.`,
          );
        }
      }

      // --- 3) Build the ffmpeg filter graph ---------------------------------
      const inputArgs: string[] = [
        "-f",
        "s16le",
        "-ar",
        String(SAMPLE_RATE),
        "-ac",
        "1",
        "-i",
        voicePath,
      ];
      let nextInputIndex = 1;
      const filters: string[] = [];
      const hasBeds = ambientPaths.length > 0;

      // Voice → stereo. Split into a main + sidechain-key copy only when we need ducking.
      if (hasBeds) {
        filters.push(
          `[0:a]aresample=${SAMPLE_RATE},aformat=channel_layouts=stereo,asplit=2[voicemain][voicekey]`,
        );
      } else {
        filters.push(`[0:a]aresample=${SAMPLE_RATE},aformat=channel_layouts=stereo[voicemain]`);
      }

      const bedLabels: string[] = [];
      ambientPaths.forEach(({ filePath, window }, k) => {
        const inputIndex = nextInputIndex++;
        inputArgs.push("-i", filePath);

        const startMs = Math.max(0, Math.round(window.startSec * 1000));
        const winLen = Math.max(0.5, window.endSec - window.startSec);
        const fade = Math.min(0.8, winLen / 3);
        const vol = clampAmbientVolume(window.scene.ambientVolume);
        const label = `[bed${k}]`;
        bedLabels.push(label);

        filters.push(
          `[${inputIndex}:a]aresample=${SAMPLE_RATE},aformat=channel_layouts=stereo,` +
            `aloop=loop=-1:size=${AMBIENT_LOOP_BUFFER_SAMPLES},atrim=0:${winLen.toFixed(3)},` +
            `afade=t=in:st=0:d=${fade.toFixed(3)},` +
            `afade=t=out:st=${(winLen - fade).toFixed(3)}:d=${fade.toFixed(3)},` +
            `volume=${vol.toFixed(3)},adelay=${startMs}|${startMs}${label}`,
        );
      });

      let bodyLabel = "[voicemain]";
      if (hasBeds) {
        let bedMixLabel: string;
        if (bedLabels.length === 1) {
          bedMixLabel = bedLabels[0];
        } else {
          bedMixLabel = "[bedmix]";
          filters.push(
            `${bedLabels.join("")}amix=inputs=${bedLabels.length}:normalize=0${bedMixLabel}`,
          );
        }
        // Duck the ambient bed under the voice (real sidechain compression).
        filters.push(
          `${bedMixLabel}[voicekey]sidechaincompress=threshold=0.05:ratio=6:attack=5:release=250[duckbed]`,
        );
        // Mix voice + ducked bed without auto-normalization (loudnorm handles levels).
        filters.push(`[voicemain][duckbed]amix=inputs=2:normalize=0[body]`);
        bodyLabel = "[body]";
      }

      // Crossfade intro/outro branding around the body.
      let progLabel = bodyLabel;
      if (introPath) {
        const introIndex = nextInputIndex++;
        inputArgs.push("-i", introPath);
        filters.push(
          `[${introIndex}:a]aresample=${SAMPLE_RATE},aformat=channel_layouts=stereo[intro]`,
        );
        filters.push(`[intro]${progLabel}acrossfade=d=0.8:c1=tri:c2=tri[pintro]`);
        progLabel = "[pintro]";
      }
      if (outroPath) {
        const outroIndex = nextInputIndex++;
        inputArgs.push("-i", outroPath);
        filters.push(
          `[${outroIndex}:a]aresample=${SAMPLE_RATE},aformat=channel_layouts=stereo[outro]`,
        );
        filters.push(`${progLabel}[outro]acrossfade=d=1.0:c1=tri:c2=tri[pouter]`);
        progLabel = "[pouter]";
      }

      // Final mastering: EBU R128 loudness + true-peak safety limiter.
      filters.push(
        `${progLabel}loudnorm=I=${LOUDNORM_I}:TP=${LOUDNORM_TP}:LRA=${LOUDNORM_LRA},` +
          `alimiter=limit=0.97[out]`,
      );

      const outputPath = path.join(tmpDir, "master.mp3");
      const args = [
        "-y",
        ...inputArgs,
        "-filter_complex",
        filters.join(";"),
        "-map",
        "[out]",
        "-c:a",
        "libmp3lame",
        "-b:a",
        MP3_BITRATE,
        "-ar",
        String(SAMPLE_RATE),
        outputPath,
      ];

      log.info(
        `[AudioDokuMaster] ffmpeg render: voice=${dialogueDurationSec.toFixed(
          1,
        )}s, beds=${ambientPaths.length}, branding=${Boolean(introPath)}/${Boolean(outroPath)}`,
      );
      await runFfmpeg(args);

      const masterBuffer = await fs.readFile(outputPath);
      if (!masterBuffer.length) {
        throw APIError.internal("ffmpeg produced an empty master file.");
      }

      return {
        audioData: `data:audio/mpeg;base64,${masterBuffer.toString("base64")}`,
        mimeType: "audio/mpeg",
        durationSeconds: dialogueDurationSec,
        scenesWithAmbient: ambientPaths.length,
        turns: dialogue.turns,
        speakers: dialogue.speakers,
      };
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  },
);
