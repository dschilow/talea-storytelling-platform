import log from "encore.dev/log";
import type { AudioFormat, TTSBatchResultItem } from "./tts";

// Thorsten-Voice (Kokoro): self-hosted German TTS, runs as its own Railway service
// (see tts-thorsten-kokoro-service/). Reach it over Railway private networking:
//   THORSTEN_TTS_SERVICE_URL=http://tts-thorsten-kokoro.railway.internal:8080
//   THORSTEN_TTS_API_KEY=<optional, must match API_KEY of the service>
const THORSTEN_TIMEOUT_MS = 180_000;
const THORSTEN_MAX_RETRIES = 3;
const THORSTEN_RETRY_BASE_DELAY_MS = 1_500;
const THORSTEN_MAX_CONCURRENT = 2; // CPU bound: the service processes one request at a time anyway
const THORSTEN_MAX_TEXT_CHARS = 6_000;

export const THORSTEN_VOICES = [
  { id: "thorsten", name: "Thorsten", description: "Hochdeutsch, ruhig und klar" },
] as const;

export const THORSTEN_DEFAULT_VOICE = "thorsten";

export interface ThorstenTtsRequest {
  text: string;
  outputFormat?: AudioFormat;
  speed?: number;
}

export interface ThorstenTtsResponse {
  audioData: string; // data URI
  mimeType: string;
  outputFormat: AudioFormat;
}

function getServiceUrl(): string {
  return (process.env.THORSTEN_TTS_SERVICE_URL || "").trim().replace(/\/+$/, "");
}

export function isThorstenConfigured(): boolean {
  return getServiceUrl().length > 0;
}

export function thorstenListVoices() {
  return {
    voices: [...THORSTEN_VOICES],
    defaultVoice: THORSTEN_DEFAULT_VOICE,
  };
}

// ---- Concurrency limiter --------------------------------------------------
let inFlight = 0;
const waitQueue: Array<() => void> = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= THORSTEN_MAX_CONCURRENT) {
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

function resolveSpeed(): number | undefined {
  const raw = Number(process.env.THORSTEN_TTS_SPEED);
  return Number.isFinite(raw) && raw > 0 ? raw : undefined;
}

async function callThorstenTts(req: ThorstenTtsRequest): Promise<ThorstenTtsResponse> {
  const baseUrl = getServiceUrl();
  if (!baseUrl) {
    throw new Error("THORSTEN_TTS_SERVICE_URL is not configured.");
  }

  const text = (req.text || "").trim();
  if (!text) throw new Error("Text is required for Thorsten TTS.");
  if (text.length > THORSTEN_MAX_TEXT_CHARS) {
    throw new Error(`Text is too long for Thorsten TTS (max ${THORSTEN_MAX_TEXT_CHARS} characters).`);
  }

  const format: AudioFormat = req.outputFormat === "wav" ? "wav" : "mp3";
  const mimeType = format === "wav" ? "audio/wav" : "audio/mpeg";
  const apiKey = (process.env.THORSTEN_TTS_API_KEY || "").trim();
  const speed = req.speed ?? resolveSpeed();

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= THORSTEN_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), THORSTEN_TIMEOUT_MS);
    try {
      const response = await fetch(`${baseUrl}/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ text, format, ...(speed ? { speed } : {}) }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const retryable = response.status === 429 || response.status >= 500;
        const error = new Error(`Thorsten TTS failed (${response.status}): ${body.slice(0, 300) || "<empty>"}`);
        if (retryable && attempt < THORSTEN_MAX_RETRIES) {
          lastError = error;
          const backoff = THORSTEN_RETRY_BASE_DELAY_MS * attempt;
          log.warn(`Thorsten TTS attempt ${attempt}/${THORSTEN_MAX_RETRIES} failed: ${error.message}. Retrying in ${backoff}ms.`);
          await delay(backoff);
          continue;
        }
        throw error;
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 100) {
        throw new Error("Thorsten TTS returned an empty audio file.");
      }
      return {
        audioData: `data:${mimeType};base64,${bytes.toString("base64")}`,
        mimeType,
        outputFormat: format,
      };
    } catch (error) {
      const isAbort = error instanceof Error && error.name === "AbortError";
      const normalized = isAbort
        ? new Error(`Thorsten TTS request timed out (attempt ${attempt})`)
        : error instanceof Error
          ? error
          : new Error(String(error));
      // Network errors (service restarting) and timeouts are worth another try.
      const retryable = isAbort || normalized.message.includes("fetch failed");
      if (retryable && attempt < THORSTEN_MAX_RETRIES) {
        lastError = normalized;
        const backoff = THORSTEN_RETRY_BASE_DELAY_MS * attempt;
        log.warn(`Thorsten TTS attempt ${attempt}/${THORSTEN_MAX_RETRIES} failed: ${normalized.message}. Retrying in ${backoff}ms.`);
        await delay(backoff);
        continue;
      }
      throw normalized;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("Thorsten TTS failed after all retries.");
}

// ---- Public API -----------------------------------------------------------
export async function thorstenGenerateSpeech(req: ThorstenTtsRequest): Promise<ThorstenTtsResponse> {
  return withSlot(() => callThorstenTts(req));
}

export async function thorstenGenerateSpeechBatch(
  items: Array<{ id: string; text: string }>,
  outputFormat?: AudioFormat,
): Promise<TTSBatchResultItem[]> {
  if (items.length === 0) return [];

  return Promise.all(
    items.map(async (item) => {
      const text = (item.text || "").trim();
      if (!text) {
        return { id: item.id, audio: null, error: "Text is required." } as TTSBatchResultItem;
      }
      try {
        const response = await thorstenGenerateSpeech({ text, outputFormat });
        return { id: item.id, audio: response.audioData, error: null } as TTSBatchResultItem;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error(`Thorsten TTS batch item failed (${item.id}): ${message}`);
        return { id: item.id, audio: null, error: message } as TTSBatchResultItem;
      }
    })
  );
}
