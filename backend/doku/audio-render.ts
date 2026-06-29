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
  synthesizeDialogueWithTimestamps,
  synthesizeSoundEffect,
  type DialogueTurnSpan,
  type DialogueWord,
} from "../tts/elevenlabs-dialogue";
import {
  generateSoundCues,
  moodToMusicPrompt,
  type SoundCue,
  type CueType,
} from "./sound-cues";

// ============================================================
// Audio Director: server-side studio master for audio dokos.
//
// Treats the doku like film post-production on a real timeline:
//   1. Dialogue is rendered to lossless PCM WITH a word-level timeline
//      (ElevenLabs with-timestamps), so sounds can land on specific words.
//   2. A "sound director" AI produces a cue sheet (spot SFX anchored to words,
//      ambience beds, a music underscore that follows the narrative beats,
//      transition whooshes).
//   3. Each cue is generated (ElevenLabs sound-generation; music from mood beds).
//   4. ONE ffmpeg graph places every cue at its exact time and layers three
//      sidechain-ducked buses (music deep, ambience medium, sfx light) under the
//      voice, crossfades the Talea intro/outro, EBU R128 loudness-normalizes,
//      true-peak limits, and encodes once to 320k MP3.
//
// The legacy per-scene "screenplay" beds are unified into this pipeline as plain
// ambience cues, so soundDesign=false still works through the same mixer.
// ============================================================

const SAMPLE_RATE = 44100;
const DIALOGUE_OUTPUT_FORMAT = "pcm_44100"; // raw s16le mono 44.1 kHz
const DIALOGUE_BYTES_PER_SAMPLE = 2;

const AMBIENT_SKIP_VOLUME = 0.01;
const AMBIENT_MAX_VOLUME = 0.25;
const AMBIENT_DEFAULT_VOLUME = 0.08;
const AMBIENT_MIN_SECONDS = 0.5;
const AMBIENT_MAX_SECONDS = 30;
const AMBIENT_DEFAULT_SECONDS = 10;
const MAX_SCENES = 24;
// Loop-buffer cap for ffmpeg aloop, in samples (one full clip, no oversized alloc).
const AMBIENT_LOOP_BUFFER_SAMPLES = (AMBIENT_MAX_SECONDS + 4) * SAMPLE_RATE;

// Cost/time guards for cue asset generation.
const MAX_GENERATED_ASSETS = 26;
const SFX_ANTICIPATION_SEC = 0.25; // start a spot effect slightly before its word

// Mastering targets.
const LOUDNORM_I = -16;
const LOUDNORM_TP = -1.5;
const LOUDNORM_LRA = 11;
const MP3_BITRATE = "320k";

// Per-bus sidechain ducking character.
const BUS_DUCK: Record<"music" | "ambience" | "sfx", string> = {
  music: "threshold=0.03:ratio=12:attack=5:release=300",
  ambience: "threshold=0.05:ratio=6:attack=8:release=250",
  sfx: "threshold=0.1:ratio=3:attack=2:release=150",
};

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
  /** Full sound design (word-anchored SFX + music + ambience + transitions). Default true. */
  soundDesign?: boolean;
  /** Legacy per-scene ambience beds (used when soundDesign === false). */
  screenplay?: RenderScene[];
  modelId?: string;
  enableAmbient?: boolean;
  includeBranding?: boolean;
  title?: string;
  ageFrom?: number;
  ageTo?: number;
}

interface RenderAudioDokuMasterResponse {
  audioData: string; // base64 data URL of the mastered MP3
  mimeType: string;
  durationSeconds: number;
  mode: "director" | "screenplay";
  hasWordTiming: boolean;
  cueCounts: Record<CueType, number>;
  generatedAssets: number;
  turns: number;
  speakers: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const dbToLinear = (db: number): number => Math.pow(10, db / 20);

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

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
  return clamp(n, AMBIENT_MIN_SECONDS, AMBIENT_MAX_SECONDS);
};

const clampAmbientVolume = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return AMBIENT_DEFAULT_VOLUME;
  return clamp(n, 0, AMBIENT_MAX_VOLUME);
};

const resolveStaticAsset = async (candidates: string[]): Promise<string | null> => {
  for (const rel of candidates) {
    const abs = path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel);
    try {
      await fs.access(abs);
      return abs;
    } catch {
      // try next
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
    proc.on("error", (err) =>
      reject(new Error(`ffmpeg konnte nicht gestartet werden (installiert?): ${err.message}`)),
    );
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-2000)}`)),
    );
  });

const normalizeWord = (w: string): string => w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * Snaps a spot-SFX cue to the exact time of its anchor word (nearest occurrence to the cue's
 * approximate start), starting slightly early for natural anticipation.
 */
const snapCueToWords = (cue: SoundCue, words: DialogueWord[]): SoundCue => {
  if (cue.type !== "sfx" || !cue.anchor || words.length === 0) return cue;
  const target = normalizeWord(cue.anchor);
  if (!target) return cue;

  let best: DialogueWord | null = null;
  let bestDist = Infinity;
  for (const w of words) {
    const nw = normalizeWord(w.word);
    if (!nw) continue;
    if (nw === target || nw.includes(target) || target.includes(nw)) {
      const dist = Math.abs(w.start - cue.start);
      if (dist < bestDist) {
        bestDist = dist;
        best = w;
      }
    }
  }
  if (!best) return cue;
  return { ...cue, start: Math.max(0, best.start - SFX_ANTICIPATION_SEC) };
};

/**
 * Builds char-weighted turn spans when word timing is unavailable (fallback path), so the
 * cue AI still has per-line time windows to work with.
 */
const estimateTurnSpans = (scriptLines: string[], durationSec: number): DialogueTurnSpan[] => {
  const parsed = scriptLines
    .map((line) => {
      const m = line.match(/^\s*([^:\n]{1,80}):\s*(.*)$/);
      if (!m) return null;
      return { speaker: m[1].replace(/\s+/g, " ").trim(), text: m[2].trim() };
    })
    .filter((x): x is { speaker: string; text: string } => x !== null && x.text.length > 0);

  if (parsed.length === 0) return [];
  const weights = parsed.map((p) => Math.max(1, p.text.replace(/\[[^\]]*\]/g, "").trim().length));
  const total = weights.reduce((s, w) => s + w, 0) || 1;
  const secPerWeight = durationSec / total;

  const spans: DialogueTurnSpan[] = [];
  let cursor = 0;
  parsed.forEach((p, i) => {
    const start = cursor;
    cursor += weights[i] * secPerWeight;
    spans.push({ index: i + 1, speaker: p.speaker, text: p.text, start, end: cursor });
  });
  return spans;
};

/** Converts legacy screenplay scenes into ambience SoundCues (legacy path). */
const screenplayToCues = (
  scenes: RenderScene[],
  turnSpans: DialogueTurnSpan[],
  durationSec: number,
): SoundCue[] => {
  const lineStart = (line: number): number => {
    const span = turnSpans[clamp(Math.floor(line) - 1, 0, turnSpans.length - 1)];
    return span ? span.start : 0;
  };
  const lineEnd = (line: number): number => {
    const span = turnSpans[clamp(Math.floor(line) - 1, 0, turnSpans.length - 1)];
    return span ? span.end : durationSec;
  };

  const cues: SoundCue[] = [];
  for (const scene of scenes.slice(0, MAX_SCENES)) {
    const vol = clampAmbientVolume(scene.ambientVolume);
    if (vol <= AMBIENT_SKIP_VOLUME || isAmbientPromptSkip(scene.ambientPrompt)) continue;
    const start = lineStart(scene.startLine);
    const end = Math.max(start + 1, lineEnd(scene.endLine));
    cues.push({
      type: "ambience",
      start,
      duration: end - start,
      // Map the legacy 0..0.25 linear volume onto a dB gain.
      gainDb: clamp(20 * Math.log10(Math.max(0.0001, vol)), -32, -16),
      behavior: "loop",
      fadeIn: 1.2,
      fadeOut: 1.2,
      pan: 0,
      prompt: scene.ambientPrompt,
    });
  }
  return cues;
};

const busOf = (type: CueType): "music" | "ambience" | "sfx" =>
  type === "music" ? "music" : type === "ambience" ? "ambience" : "sfx";

type PlacedCue = { cue: SoundCue; inputIndex: number; isLoop: boolean; atrimWindow: number };

// ---------------------------------------------------------------------------
// Endpoint
// ---------------------------------------------------------------------------

export const renderAudioDokuMaster = api<
  RenderAudioDokuMasterRequest,
  RenderAudioDokuMasterResponse
>(
  { expose: true, method: "POST", path: "/doku/audio-render/master", auth: true },
  async (req) => {
    ensureAdmin();
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated("Login required");

    const script = (req.script || "").trim();
    if (!script) throw APIError.invalidArgument("script is required");
    if (!req.speakerVoiceMap || Object.keys(req.speakerVoiceMap).length === 0) {
      throw APIError.invalidArgument("speakerVoiceMap is required");
    }

    const wantSoundDesign = req.soundDesign !== false;
    const includeBranding = req.includeBranding !== false;
    const ageFrom = clamp(Math.floor(req.ageFrom || 6), 2, 18);
    const ageTo = clamp(Math.floor(req.ageTo || 8), ageFrom, 18);

    // --- 1) Dialogue → PCM (+ word timeline when possible) ------------------
    let dialoguePcm: Buffer;
    let words: DialogueWord[] = [];
    let turnSpans: DialogueTurnSpan[] = [];
    let turns = 0;
    let speakers: string[] = [];
    let hasWordTiming = false;

    if (wantSoundDesign) {
      try {
        const timed = await synthesizeDialogueWithTimestamps({
          script,
          speakerVoiceMap: req.speakerVoiceMap,
          modelId: req.modelId,
        });
        dialoguePcm = timed.audio;
        words = timed.words;
        turnSpans = timed.turnSpans;
        turns = timed.turns;
        speakers = timed.speakers;
        hasWordTiming = words.length > 0;
      } catch (err) {
        log.warn(
          `[AudioDokuMaster] timed synthesis failed, falling back to plain dialogue: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        const plain = await synthesizeDialogue({
          script,
          speakerVoiceMap: req.speakerVoiceMap,
          modelId: req.modelId,
          outputFormat: DIALOGUE_OUTPUT_FORMAT,
        });
        dialoguePcm = plain.audio;
        turns = plain.turns;
        speakers = plain.speakers;
      }
    } else {
      const plain = await synthesizeDialogue({
        script,
        speakerVoiceMap: req.speakerVoiceMap,
        modelId: req.modelId,
        outputFormat: DIALOGUE_OUTPUT_FORMAT,
      });
      dialoguePcm = plain.audio;
      turns = plain.turns;
      speakers = plain.speakers;
    }

    const dialogueDurationSec = dialoguePcm.length / DIALOGUE_BYTES_PER_SAMPLE / SAMPLE_RATE;
    if (dialogueDurationSec <= 0) {
      throw APIError.unavailable("ElevenLabs returned no usable dialogue audio.");
    }

    const scriptLines = script.replace(/\r\n/g, "\n").split("\n");
    if (turnSpans.length === 0) {
      turnSpans = estimateTurnSpans(scriptLines, dialogueDurationSec);
    }

    // --- 2) Cue sheet -------------------------------------------------------
    const mode: "director" | "screenplay" = wantSoundDesign ? "director" : "screenplay";
    let cues: SoundCue[] = [];

    if (wantSoundDesign) {
      const raw = await generateSoundCues({
        script,
        durationSec: dialogueDurationSec,
        ageFrom,
        ageTo,
        turnSpans,
        words,
      });
      cues = raw.map((c) => snapCueToWords(c, words));
    } else if (req.enableAmbient !== false && Array.isArray(req.screenplay)) {
      cues = screenplayToCues(req.screenplay, turnSpans, dialogueDurationSec);
    }

    // Keep cues inside the timeline.
    cues = cues.filter((c) => c.start < dialogueDurationSec + 0.5);

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "audiodoku-"));
    try {
      const voicePath = path.join(tmpDir, "voice.pcm");
      await fs.writeFile(voicePath, dialoguePcm);

      // --- 3) Generate cue assets (dedupe + cap) --------------------------
      const inputArgs: string[] = [
        "-f", "s16le", "-ar", String(SAMPLE_RATE), "-ac", "1", "-i", voicePath,
      ];
      let nextInputIndex = 1;
      const assetCache = new Map<string, number>(); // cacheKey -> input index
      const placed: PlacedCue[] = [];
      let generatedAssets = 0;

      for (const cue of cues) {
        if (generatedAssets >= MAX_GENERATED_ASSETS) break;

        const isLoop = cue.behavior === "loop";
        const genDur = isLoop
          ? clamp(Math.min(cue.duration, 18), 6, 24)
          : clamp(cue.duration, 0.5, 6);
        const atrimWindow = isLoop
          ? clamp(cue.duration, 0.5, dialogueDurationSec - cue.start + 2)
          : genDur;

        const prompt = cue.type === "music" ? moodToMusicPrompt(cue.mood || "calm") : cue.prompt || "";
        if (!prompt.trim()) continue;

        const cacheKey = `${cue.type}|${cue.mood || prompt}|${Math.round(genDur)}|${isLoop}`;
        let inputIndex = assetCache.get(cacheKey) ?? -1;

        if (inputIndex < 0) {
          try {
            const sound = await synthesizeSoundEffect({
              prompt,
              durationSeconds: genDur,
              mode: isLoop ? "loop" : "oneshot",
              promptInfluence: cue.type === "sfx" ? 0.7 : 0.55,
            });
            const filePath = path.join(tmpDir, `cue-${nextInputIndex}.mp3`);
            await fs.writeFile(filePath, sound.audio);
            inputIndex = nextInputIndex++;
            inputArgs.push("-i", filePath);
            assetCache.set(cacheKey, inputIndex);
            generatedAssets += 1;
          } catch (err) {
            log.warn(
              `[AudioDokuMaster] cue asset (${cue.type}) failed, skipping: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
            continue;
          }
        }

        placed.push({ cue, inputIndex, isLoop, atrimWindow });
      }

      // --- 4) Build the multi-bus ffmpeg graph ---------------------------
      const filters: string[] = [];
      const busCues: Record<"music" | "ambience" | "sfx", string[]> = {
        music: [],
        ambience: [],
        sfx: [],
      };

      placed.forEach((p, k) => {
        const { cue, inputIndex, isLoop, atrimWindow } = p;
        const startMs = Math.max(0, Math.round(cue.start * 1000));
        const win = Math.max(0.3, atrimWindow);
        const fin = clamp(cue.fadeIn, 0, win / 2);
        const fout = clamp(cue.fadeOut, 0, win / 2);
        const gain = dbToLinear(cue.gainDb).toFixed(4);
        const label = `[cue${k}]`;

        const chain = [`[${inputIndex}:a]aresample=${SAMPLE_RATE},aformat=channel_layouts=stereo`];
        if (isLoop) chain.push(`aloop=loop=-1:size=${AMBIENT_LOOP_BUFFER_SAMPLES}`);
        chain.push(`atrim=0:${win.toFixed(3)}`);
        if (fin > 0.01) chain.push(`afade=t=in:st=0:d=${fin.toFixed(3)}`);
        if (fout > 0.01) chain.push(`afade=t=out:st=${(win - fout).toFixed(3)}:d=${fout.toFixed(3)}`);
        chain.push(`volume=${gain}`);
        if (Math.abs(cue.pan) > 0.05) {
          const lGain = cue.pan > 0 ? (1 - cue.pan).toFixed(3) : "1";
          const rGain = cue.pan < 0 ? (1 + cue.pan).toFixed(3) : "1";
          chain.push(`pan=stereo|c0=${lGain}*c0|c1=${rGain}*c1`);
        }
        chain.push(`adelay=${startMs}|${startMs}`);
        filters.push(`${chain.join(",")}${label}`);
        busCues[busOf(cue.type)].push(label);
      });

      const activeBuses = (Object.keys(busCues) as Array<"music" | "ambience" | "sfx">).filter(
        (b) => busCues[b].length > 0,
      );

      // Split the voice into one main copy + one sidechain key per active bus.
      if (activeBuses.length > 0) {
        const keyLabels = activeBuses.map((b) => `[vk_${b}]`).join("");
        filters.push(
          `[0:a]aresample=${SAMPLE_RATE},aformat=channel_layouts=stereo,asplit=${
            activeBuses.length + 1
          }[vmain]${keyLabels}`,
        );
      } else {
        filters.push(`[0:a]aresample=${SAMPLE_RATE},aformat=channel_layouts=stereo[vmain]`);
      }

      const mixInputs: string[] = ["[vmain]"];
      for (const bus of activeBuses) {
        const labels = busCues[bus];
        let busRaw: string;
        if (labels.length === 1) {
          busRaw = labels[0];
        } else {
          busRaw = `[${bus}raw]`;
          filters.push(`${labels.join("")}amix=inputs=${labels.length}:normalize=0${busRaw}`);
        }
        const busOut = `[${bus}bus]`;
        filters.push(`${busRaw}[vk_${bus}]sidechaincompress=${BUS_DUCK[bus]}${busOut}`);
        mixInputs.push(busOut);
      }

      let bodyLabel = "[vmain]";
      if (mixInputs.length > 1) {
        filters.push(`${mixInputs.join("")}amix=inputs=${mixInputs.length}:normalize=0[body]`);
        bodyLabel = "[body]";
      }

      // --- 5) Branding crossfade + master tail ---------------------------
      let introPath: string | null = null;
      let outroPath: string | null = null;
      if (includeBranding) {
        introPath = await resolveStaticAsset(INTRO_CANDIDATES);
        outroPath = await resolveStaticAsset(OUTRO_CANDIDATES);
      }

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

      filters.push(
        `${progLabel}loudnorm=I=${LOUDNORM_I}:TP=${LOUDNORM_TP}:LRA=${LOUDNORM_LRA},alimiter=limit=0.97[out]`,
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
        `[AudioDokuMaster] mode=${mode} voice=${dialogueDurationSec.toFixed(1)}s wordTiming=${hasWordTiming} cues=${cues.length} assets=${generatedAssets} buses=${activeBuses.join("+") || "none"} branding=${Boolean(introPath)}/${Boolean(outroPath)}`,
      );
      await runFfmpeg(args);

      const masterBuffer = await fs.readFile(outputPath);
      if (!masterBuffer.length) throw APIError.internal("ffmpeg produced an empty master file.");

      const cueCounts: Record<CueType, number> = {
        music: cues.filter((c) => c.type === "music").length,
        ambience: cues.filter((c) => c.type === "ambience").length,
        sfx: cues.filter((c) => c.type === "sfx").length,
        transition: cues.filter((c) => c.type === "transition").length,
      };

      return {
        audioData: `data:audio/mpeg;base64,${masterBuffer.toString("base64")}`,
        mimeType: "audio/mpeg",
        durationSeconds: dialogueDurationSec,
        mode,
        hasWordTiming,
        cueCounts,
        generatedAssets,
        turns,
        speakers,
      };
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  },
);
