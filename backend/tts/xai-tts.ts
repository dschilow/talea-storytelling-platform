import log from "encore.dev/log";
import type { AudioFormat, TTSBatchResultItem } from "./tts";

// ─── Configuration ──────────────────────────────────────────────────────────
const XAI_API_KEY = (process.env.XAI_API_KEY || "").trim();
const XAI_TTS_URL = "https://api.x.ai/v1/tts";
const XAI_TTS_MODEL = "xai:tts@0";
const XAI_TTS_TIMEOUT_MS = 120_000; // 2 min per request
const XAI_TTS_MAX_RETRIES = 3;
const XAI_TTS_RETRY_BASE_DELAY_MS = 1_000;
const XAI_MAX_TEXT_LENGTH = 15_000;
const XAI_MAX_CONCURRENT = 4;

export const XAI_VOICES = [
  { id: "eve", name: "Eve", description: "Energetisch, aufgeweckt" },
  { id: "ara", name: "Ara", description: "Warm, freundlich" },
  { id: "rex", name: "Rex", description: "Selbstsicher, professionell" },
  { id: "sal", name: "Sal", description: "Ruhig, ausgeglichen" },
  { id: "leo", name: "Leo", description: "Autoritaer, kraeftig" },
] as const;

export const XAI_DEFAULT_VOICE = "eve";

export interface XaiTtsRequest {
  text: string;
  voice?: string;
  language?: string;
  outputFormat?: AudioFormat;
}

export interface XaiTtsResponse {
  audioData: string; // data URI
  mimeType: string;
  outputFormat: AudioFormat;
}

export interface XaiVoicesResponse {
  voices: Array<{ id: string; name: string; description: string }>;
  defaultVoice: string;
}

// ─── Concurrency limiter ────────────────────────────────────────────────────
let xaiInFlight = 0;
const xaiWaitQueue: Array<() => void> = [];

async function acquireXaiSlot(): Promise<void> {
  if (xaiInFlight < XAI_MAX_CONCURRENT) {
    xaiInFlight += 1;
    return;
  }
  await new Promise<void>((resolve) => xaiWaitQueue.push(resolve));
  xaiInFlight += 1;
}

function releaseXaiSlot(): void {
  xaiInFlight = Math.max(0, xaiInFlight - 1);
  const next = xaiWaitQueue.shift();
  if (next) next();
}

async function withXaiSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquireXaiSlot();
  try {
    return await fn();
  } finally {
    releaseXaiSlot();
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503 || status >= 500;
}

function resolveXaiOutputFormat(format?: AudioFormat): { codec: string; mimeType: string; audioFormat: AudioFormat } {
  if (format === "wav") {
    return { codec: "wav", mimeType: "audio/wav", audioFormat: "wav" };
  }
  return { codec: "mp3", mimeType: "audio/mpeg", audioFormat: "mp3" };
}

function resolveXaiLanguage(lang?: string): string {
  if (!lang) return "de";
  const normalized = lang.trim().toLowerCase();
  // Map common locale codes to BCP-47
  const map: Record<string, string> = {
    de: "de", en: "en", fr: "fr", es: "es", it: "it",
    nl: "nl", ru: "ru", ja: "ja", ko: "ko", zh: "zh",
    pt: "pt", tr: "tr", hi: "hi", ar: "ar", vi: "vi",
  };
  return map[normalized] || normalized || "auto";
}

export function ensureXaiConfigured(): void {
  if (!XAI_API_KEY) {
    throw new Error(
      "XAI_API_KEY is not configured. Set it as an environment variable to use xAI TTS."
    );
  }
}

// ─── Core xAI TTS call ─────────────────────────────────────────────────────
async function callXaiTts(req: XaiTtsRequest): Promise<XaiTtsResponse> {
  ensureXaiConfigured();

  const text = (req.text || "").trim();
  if (!text) {
    throw new Error("Text is required for xAI TTS.");
  }
  if (text.length > XAI_MAX_TEXT_LENGTH) {
    throw new Error(`Text exceeds xAI limit of ${XAI_MAX_TEXT_LENGTH} characters (got ${text.length}).`);
  }

  const voice = (req.voice || XAI_DEFAULT_VOICE).trim().toLowerCase();
  const language = resolveXaiLanguage(req.language);
  const { codec, mimeType, audioFormat } = resolveXaiOutputFormat(req.outputFormat);

  const body = {
    text,
    voice_id: voice,
    model: XAI_TTS_MODEL,
    language,
    output_format: {
      codec,
      sample_rate: 24000,
      ...(codec === "mp3" ? { bit_rate: 128000 } : {}),
    },
  };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= XAI_TTS_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), XAI_TTS_TIMEOUT_MS);

    try {
      const response = await fetch(XAI_TTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${XAI_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        const msg = `xAI TTS failed (${response.status}): ${errBody || "<empty>"}`;

        if (attempt < XAI_TTS_MAX_RETRIES && isRetryableStatus(response.status)) {
          lastError = new Error(msg);
          const backoff = XAI_TTS_RETRY_BASE_DELAY_MS * attempt;
          log.warn(`xAI TTS attempt ${attempt}/${XAI_TTS_MAX_RETRIES} failed: ${msg}. Retrying in ${backoff}ms.`);
          await delay(backoff);
          continue;
        }

        throw new Error(msg);
      }

      // Response is raw audio bytes
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length === 0) {
        throw new Error("xAI TTS returned empty audio response.");
      }

      const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;

      return {
        audioData: dataUri,
        mimeType,
        outputFormat: audioFormat,
      };
    } catch (error) {
      const isAbort = error instanceof Error && error.name === "AbortError";
      if (isAbort && attempt < XAI_TTS_MAX_RETRIES) {
        lastError = new Error(`xAI TTS request timed out (attempt ${attempt})`);
        const backoff = XAI_TTS_RETRY_BASE_DELAY_MS * attempt;
        log.warn(`xAI TTS timeout on attempt ${attempt}/${XAI_TTS_MAX_RETRIES}. Retrying in ${backoff}ms.`);
        await delay(backoff);
        continue;
      }
      if (error instanceof Error) {
        lastError = error;
      }
      throw lastError || error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("xAI TTS failed after all retries.");
}

// ─── Public API ─────────────────────────────────────────────────────────────
export async function xaiGenerateSpeech(req: XaiTtsRequest): Promise<XaiTtsResponse> {
  return withXaiSlot(() => callXaiTts(req));
}

export async function xaiGenerateSpeechBatch(
  items: Array<{ id: string; text: string; speaker?: string }>,
  defaultVoice?: string,
  language?: string,
  outputFormat?: AudioFormat,
): Promise<TTSBatchResultItem[]> {
  if (items.length === 0) return [];

  // xAI doesn't have a native batch endpoint, so we run items concurrently
  const results = await Promise.all(
    items.map(async (item) => {
      const text = (item.text || "").trim();
      if (!text) {
        return { id: item.id, audio: null, error: "Text is required." } as TTSBatchResultItem;
      }

      try {
        const response = await withXaiSlot(() =>
          callXaiTts({
            text,
            voice: item.speaker || defaultVoice || XAI_DEFAULT_VOICE,
            language,
            outputFormat,
          })
        );
        return { id: item.id, audio: response.audioData, error: null } as TTSBatchResultItem;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error(`xAI TTS batch item failed (${item.id}): ${message}`);
        return { id: item.id, audio: null, error: message } as TTSBatchResultItem;
      }
    })
  );

  return results;
}

export function xaiListVoices(): XaiVoicesResponse {
  return {
    voices: [...XAI_VOICES],
    defaultVoice: XAI_DEFAULT_VOICE,
  };
}

export function isXaiConfigured(): boolean {
  return Boolean(XAI_API_KEY);
}
