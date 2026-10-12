import log from "encore.dev/log";
import type { AudioFormat, TTSBatchResultItem } from "./tts";

// MOSS-TTS-Nano: self-hosted multilingual TTS (ONNX, CPU), runs as its own Railway service
// (see tts-moss-nano-service/). Reach it over Railway private networking:
//   MOSS_TTS_SERVICE_URL=http://tts-moss-nano.railway.internal:8080
//   MOSS_TTS_API_KEY=<optional, must match API_KEY of the service>
const MOSS_TIMEOUT_MS = 240_000;
const MOSS_MAX_RETRIES = 3;
const MOSS_RETRY_BASE_DELAY_MS = 1_500;
const MOSS_MAX_CONCURRENT = 2; // CPU bound: the service processes one request at a time anyway
const MOSS_MAX_TEXT_CHARS = 6_000;

export const MOSS_VOICES = [
  { id: "thorsten_neutral", name: "Thorsten (MOSS)", description: "Hochdeutsch, geklonte Stimme" },
] as const;

export const MOSS_DEFAULT_VOICE = "thorsten_neutral";

export interface MossTtsRequest {
  text: string;
  voice?: string;
  outputFormat?: AudioFormat;
}

export interface MossTtsResponse {
  audioData: string; // data URI
  mimeType: string;
  outputFormat: AudioFormat;
}

function getServiceUrl(): string {
  return (process.env.MOSS_TTS_SERVICE_URL || "").trim().replace(/\/+$/, "");
}

// The player sends the picked voice as `speaker`; anything we do not know falls back to the service default.
function resolveVoice(requested?: string): string {
  const wanted = (requested || "").trim();
  if (MOSS_VOICES.some((voice) => voice.id === wanted)) return wanted;
  return (process.env.MOSS_TTS_VOICE || "").trim();
}

export function isMossConfigured(): boolean {
  return getServiceUrl().length > 0;
}

// ---- Concurrency limiter --------------------------------------------------
let inFlight = 0;
const waitQueue: Array<() => void> = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= MOSS_MAX_CONCURRENT) {
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

async function callMossTts(req: MossTtsRequest): Promise<MossTtsResponse> {
  const baseUrl = getServiceUrl();
  if (!baseUrl) {
    throw new Error("MOSS_TTS_SERVICE_URL is not configured.");
  }

  const text = (req.text || "").trim();
  if (!text) throw new Error("Text is required for MOSS TTS.");
  if (text.length > MOSS_MAX_TEXT_CHARS) {
    throw new Error(`Text is too long for MOSS TTS (max ${MOSS_MAX_TEXT_CHARS} characters).`);
  }

  const format: AudioFormat = req.outputFormat === "wav" ? "wav" : "mp3";
  const mimeType = format === "wav" ? "audio/wav" : "audio/mpeg";
  const apiKey = (process.env.MOSS_TTS_API_KEY || "").trim();
  const voice = resolveVoice(req.voice);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MOSS_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MOSS_TIMEOUT_MS);
    try {
      const response = await fetch(`${baseUrl}/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ text, format, ...(voice ? { voice } : {}) }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const retryable = response.status === 429 || response.status >= 500;
        const error = new Error(`MOSS TTS failed (${response.status}): ${body.slice(0, 300) || "<empty>"}`);
        if (retryable && attempt < MOSS_MAX_RETRIES) {
          lastError = error;
          const backoff = MOSS_RETRY_BASE_DELAY_MS * attempt;
          log.warn(`MOSS TTS attempt ${attempt}/${MOSS_MAX_RETRIES} failed: ${error.message}. Retrying in ${backoff}ms.`);
          await delay(backoff);
          continue;
        }
        throw error;
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 100) {
        throw new Error("MOSS TTS returned an empty audio file.");
      }
      return {
        audioData: `data:${mimeType};base64,${bytes.toString("base64")}`,
        mimeType,
        outputFormat: format,
      };
    } catch (error) {
      const isAbort = error instanceof Error && error.name === "AbortError";
      const normalized = isAbort
        ? new Error(`MOSS TTS request timed out (attempt ${attempt})`)
        : error instanceof Error
          ? error
          : new Error(String(error));
      // Network errors (service restarting) and timeouts are worth another try.
      const retryable = isAbort || normalized.message.includes("fetch failed");
      if (retryable && attempt < MOSS_MAX_RETRIES) {
        lastError = normalized;
        const backoff = MOSS_RETRY_BASE_DELAY_MS * attempt;
        log.warn(`MOSS TTS attempt ${attempt}/${MOSS_MAX_RETRIES} failed: ${normalized.message}. Retrying in ${backoff}ms.`);
        await delay(backoff);
        continue;
      }
      throw normalized;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("MOSS TTS failed after all retries.");
}

// ---- Public API -----------------------------------------------------------
export async function mossGenerateSpeech(req: MossTtsRequest): Promise<MossTtsResponse> {
  return withSlot(() => callMossTts(req));
}

export async function mossGenerateSpeechBatch(
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
        const response = await mossGenerateSpeech({ text, voice, outputFormat });
        return { id: item.id, audio: response.audioData, error: null } as TTSBatchResultItem;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error(`MOSS TTS batch item failed (${item.id}): ${message}`);
        return { id: item.id, audio: null, error: message } as TTSBatchResultItem;
      }
    })
  );
}
