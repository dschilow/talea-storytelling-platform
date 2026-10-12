import { spawn } from "node:child_process";
import { secret } from "encore.dev/config";
import log from "encore.dev/log";
import type { AudioFormat, TTSBatchResultItem } from "./tts";
import { CAPTAIN_COMEDY_REFERENCE_MP3_BASE64, CAPTAIN_COMEDY_REFERENCE_TRANSCRIPT } from "./voice-references";

// OpenRouter text-to-speech: one OpenAI-compatible endpoint for many TTS models
// (https://openrouter.ai/docs/guides/overview/multimodal/tts). A voice id names model + voice, e.g.
// "gemini-lite:sulafat", so a new model is just a new catalog entry. Prices measured 2026-10-12 on a German
// story passage (483 chars), Whisper word similarity 0.97-0.99 for all of them.
const OPENROUTER_SPEECH_URL = "https://openrouter.ai/api/v1/audio/speech";
const OPENROUTER_TIMEOUT_MS = 180_000;
const OPENROUTER_MAX_RETRIES = 3;
const OPENROUTER_RETRY_BASE_DELAY_MS = 1_500;
const OPENROUTER_MAX_CONCURRENT = 4;
const OPENROUTER_MAX_TEXT_CHARS = 5_000;
const GEMINI_PCM_SAMPLE_RATE = 24_000; // Gemini TTS answers with raw 16-bit mono PCM only

const openRouterApiKey = secret("OpenRouterAPIKey");

const STORY_INSTRUCTIONS =
  "Read this German text aloud as a warm, lively bedtime story for children. " +
  "Calm pace, clear articulation, gentle emotion in the dialogue.";

const GEMINI_LITE = "google/gemini-3.8-flash-lite-tts";
const GEMINI_FLASH = "google/gemini-3.8-flash-tts";
const MAI_FLASH = "microsoft/mai-voice-2.1-flash";
const FISH_FREE = "fish-audio/s2.1-pro-free:free";

interface OpenRouterVoice {
  id: string;
  name: string;
  description: string;
  model: string;
  voice?: string;
  instructions?: string;
  cloneCaptainComedy?: boolean;
}

export const OPENROUTER_TTS_VOICES: readonly OpenRouterVoice[] = [
  { id: "gemini-lite:sulafat", name: "Gemini Lite - Sulafat", description: "warm, ca. 1,3 ct/1000 Zeichen", model: GEMINI_LITE, voice: "Sulafat", instructions: STORY_INSTRUCTIONS },
  { id: "gemini-lite:achird", name: "Gemini Lite - Achird", description: "freundlich, ca. 1,1 ct/1000 Zeichen", model: GEMINI_LITE, voice: "Achird", instructions: STORY_INSTRUCTIONS },
  { id: "gemini-lite:kore", name: "Gemini Lite - Kore", description: "klar, ca. 1,2 ct/1000 Zeichen", model: GEMINI_LITE, voice: "Kore", instructions: STORY_INSTRUCTIONS },
  { id: "gemini-lite:charon", name: "Gemini Lite - Charon", description: "maennlich, ca. 1,3 ct/1000 Zeichen", model: GEMINI_LITE, voice: "Charon", instructions: STORY_INSTRUCTIONS },
  { id: "gemini-flash:sulafat", name: "Gemini Flash - Sulafat", description: "ausdrucksstaerker, ca. 1,6 ct/1000 Zeichen", model: GEMINI_FLASH, voice: "Sulafat", instructions: STORY_INSTRUCTIONS },
  { id: "gemini-flash:achird", name: "Gemini Flash - Achird", description: "ausdrucksstaerker, ca. 1,8 ct/1000 Zeichen", model: GEMINI_FLASH, voice: "Achird", instructions: STORY_INSTRUCTIONS },
  { id: "mai:klaus", name: "Microsoft MAI - Klaus", description: "deutsch, 1,5 ct/1000 Zeichen", model: MAI_FLASH, voice: "de-DE-Klaus:MAI-Voice-2.1-Flash" },
  { id: "mai:mia", name: "Microsoft MAI - Mia", description: "deutsch, 1,5 ct/1000 Zeichen", model: MAI_FLASH, voice: "de-DE-Mia:MAI-Voice-2.1-Flash" },
  { id: "fish:captain", name: "Fish Audio - Captain Comedy", description: "Klon, Gratis-Testvariante", model: FISH_FREE, cloneCaptainComedy: true },
];

export const OPENROUTER_TTS_DEFAULT_VOICE = "gemini-lite:sulafat";

export interface OpenRouterTtsRequest {
  text: string;
  voice?: string;
  outputFormat?: AudioFormat;
}

export interface OpenRouterTtsResponse {
  audioData: string; // data URI
  mimeType: string;
  outputFormat: AudioFormat;
}

function resolveApiKey(): string {
  const fromEnv =
    process.env.ENCORE_SECRET_OPENROUTERAPIKEY || process.env.OPENROUTER_API_KEY || process.env.OpenRouterAPIKey;
  if (fromEnv?.trim()) return fromEnv.trim();
  try {
    return openRouterApiKey().trim();
  } catch {
    return ""; // secret not set in this environment
  }
}

export function isOpenRouterTtsConfigured(): boolean {
  return resolveApiKey().length > 0;
}

function resolveVoice(requested?: string): OpenRouterVoice {
  const wanted = (requested || "").trim().toLowerCase();
  return (
    OPENROUTER_TTS_VOICES.find((voice) => voice.id === wanted) ??
    OPENROUTER_TTS_VOICES.find((voice) => voice.id === OPENROUTER_TTS_DEFAULT_VOICE)!
  );
}

function buildBody(voice: OpenRouterVoice, text: string): Record<string, unknown> {
  const isGemini = voice.model.startsWith("google/");
  return {
    model: voice.model,
    input: text,
    response_format: isGemini ? "pcm" : "mp3",
    ...(voice.voice ? { voice: voice.voice } : {}),
    ...(voice.instructions ? { instructions: voice.instructions } : {}),
    ...(voice.cloneCaptainComedy
      ? {
          input_references: [
            { type: "input_audio", input_audio: { data: `data:audio/mpeg;base64,${CAPTAIN_COMEDY_REFERENCE_MP3_BASE64}` } },
            { type: "text", text: CAPTAIN_COMEDY_REFERENCE_TRANSCRIPT },
          ],
        }
      : {}),
  };
}

// ---- PCM -> MP3/WAV -------------------------------------------------------
function runFfmpeg(args: string[], input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let stderr = "";
    proc.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2000);
    });
    proc.on("error", (err) => reject(new Error(`ffmpeg could not start: ${err.message}`)));
    proc.on("close", (code) => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`ffmpeg exited ${code}: ${stderr}`))));
    proc.stdin.end(input);
  });
}

function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function encodePcm(pcm: Buffer, format: AudioFormat): Promise<{ bytes: Buffer; format: AudioFormat }> {
  const wav = pcmToWav(pcm, GEMINI_PCM_SAMPLE_RATE);
  if (format === "wav") return { bytes: wav, format };
  try {
    const mp3 = await runFfmpeg(
      ["-hide_banner", "-loglevel", "error", "-f", "wav", "-i", "pipe:0", "-codec:a", "libmp3lame", "-b:a", "96k", "-f", "mp3", "pipe:1"],
      wav,
    );
    return { bytes: mp3, format: "mp3" };
  } catch (error) {
    log.warn(`OpenRouter TTS: MP3 encoding failed, returning WAV: ${error instanceof Error ? error.message : error}`);
    return { bytes: wav, format: "wav" };
  }
}

// ---- Concurrency limiter --------------------------------------------------
let inFlight = 0;
const waitQueue: Array<() => void> = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= OPENROUTER_MAX_CONCURRENT) {
    await new Promise<void>((resolve) => waitQueue.push(resolve));
  }
  inFlight += 1;
  try {
    return await fn();
  } finally {
    inFlight = Math.max(0, inFlight - 1);
    const next = waitQueue.shift();
    if (next) next();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOpenRouterTts(req: OpenRouterTtsRequest): Promise<OpenRouterTtsResponse> {
  const apiKey = resolveApiKey();
  if (!apiKey) throw new Error("OpenRouter API key is not configured.");

  const text = (req.text || "").trim();
  if (!text) throw new Error("Text is required for OpenRouter TTS.");
  if (text.length > OPENROUTER_MAX_TEXT_CHARS) {
    throw new Error(`Text is too long for OpenRouter TTS (max ${OPENROUTER_MAX_TEXT_CHARS} characters).`);
  }

  const voice = resolveVoice(req.voice);
  const wanted: AudioFormat = req.outputFormat === "wav" ? "wav" : "mp3";
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= OPENROUTER_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);
    try {
      const response = await fetch(OPENROUTER_SPEECH_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(voice, text)),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const retryable = response.status === 429 || response.status >= 500;
        const error = new Error(`OpenRouter TTS ${voice.model} failed (${response.status}): ${body.slice(0, 300) || "<empty>"}`);
        if (retryable && attempt < OPENROUTER_MAX_RETRIES) {
          lastError = error;
          const backoff = OPENROUTER_RETRY_BASE_DELAY_MS * attempt;
          log.warn(`OpenRouter TTS attempt ${attempt}/${OPENROUTER_MAX_RETRIES} failed: ${error.message}. Retrying in ${backoff}ms.`);
          await delay(backoff);
          continue;
        }
        throw error;
      }

      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.length < 100) throw new Error("OpenRouter TTS returned an empty audio file.");
      const encoded = voice.model.startsWith("google/")
        ? await encodePcm(raw, wanted)
        : { bytes: raw, format: "mp3" as AudioFormat };
      const mimeType = encoded.format === "wav" ? "audio/wav" : "audio/mpeg";
      log.info(
        `OpenRouter TTS ok: ${voice.id} (${voice.model}), ${text.length} chars, generation=${response.headers.get("x-generation-id") ?? "?"}`,
      );
      return {
        audioData: `data:${mimeType};base64,${encoded.bytes.toString("base64")}`,
        mimeType,
        outputFormat: encoded.format,
      };
    } catch (error) {
      const isAbort = error instanceof Error && error.name === "AbortError";
      const normalized = isAbort
        ? new Error(`OpenRouter TTS request timed out (attempt ${attempt})`)
        : error instanceof Error
          ? error
          : new Error(String(error));
      const retryable = isAbort || normalized.message.includes("fetch failed");
      if (retryable && attempt < OPENROUTER_MAX_RETRIES) {
        lastError = normalized;
        const backoff = OPENROUTER_RETRY_BASE_DELAY_MS * attempt;
        log.warn(`OpenRouter TTS attempt ${attempt}/${OPENROUTER_MAX_RETRIES} failed: ${normalized.message}. Retrying in ${backoff}ms.`);
        await delay(backoff);
        continue;
      }
      throw normalized;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("OpenRouter TTS failed after all retries.");
}

// ---- Public API -----------------------------------------------------------
export async function openRouterGenerateSpeech(req: OpenRouterTtsRequest): Promise<OpenRouterTtsResponse> {
  return withSlot(() => callOpenRouterTts(req));
}

export async function openRouterGenerateSpeechBatch(
  items: Array<{ id: string; text: string }>,
  outputFormat?: AudioFormat,
  voice?: string,
): Promise<TTSBatchResultItem[]> {
  if (items.length === 0) return [];

  return Promise.all(
    items.map(async (item) => {
      const text = (item.text || "").trim();
      if (!text) {
        return { id: item.id, audio: null, error: "Text is required." } as TTSBatchResultItem;
      }
      try {
        const response = await openRouterGenerateSpeech({ text, voice, outputFormat });
        return { id: item.id, audio: response.audioData, error: null } as TTSBatchResultItem;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error(`OpenRouter TTS batch item failed (${item.id}): ${message}`);
        return { id: item.id, audio: null, error: message } as TTSBatchResultItem;
      }
    })
  );
}
