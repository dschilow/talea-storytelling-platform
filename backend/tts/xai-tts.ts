import log from "encore.dev/log";
import { secret } from "encore.dev/config";
import type { AudioFormat, TTSBatchResultItem } from "./tts";

// ---- Configuration --------------------------------------------------------
// Re-use the same Runware API key that powers image generation.
const runwareApiKey = secret("RunwareApiKey");

const RUNWARE_API_URL = "https://api.runware.ai/v1";
const XAI_TTS_MODEL = "xai:tts@0";
const XAI_TTS_TIMEOUT_MS = 120_000; // 2 min per request
const XAI_TTS_MAX_RETRIES = 3;
const XAI_TTS_RETRY_BASE_DELAY_MS = 1_000;
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

// ---- Concurrency limiter --------------------------------------------------
let inFlight = 0;
const waitQueue: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (inFlight < XAI_MAX_CONCURRENT) {
    inFlight += 1;
    return;
  }
  await new Promise<void>((resolve) => waitQueue.push(resolve));
  inFlight += 1;
}

function releaseSlot(): void {
  inFlight = Math.max(0, inFlight - 1);
  const next = waitQueue.shift();
  if (next) next();
}

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquireSlot();
  try {
    return await fn();
  } finally {
    releaseSlot();
  }
}

// ---- Helpers --------------------------------------------------------------
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503 || status >= 500;
}

function resolveOutputFormat(format?: AudioFormat): { mimeType: string; audioFormat: AudioFormat } {
  if (format === "wav") {
    return { mimeType: "audio/wav", audioFormat: "wav" };
  }
  return { mimeType: "audio/mpeg", audioFormat: "mp3" };
}

function resolveLanguage(lang?: string): string {
  if (!lang) return "de";
  const normalized = lang.trim().toLowerCase();
  const map: Record<string, string> = {
    de: "de", en: "en", fr: "fr", es: "es", it: "it",
    nl: "nl", ru: "ru", ja: "ja", ko: "ko", zh: "zh",
    pt: "pt", tr: "tr", hi: "hi", ar: "ar", vi: "vi",
  };
  return map[normalized] || normalized || "auto";
}

export function ensureXaiConfigured(): void {
  try {
    const key = runwareApiKey();
    if (!key) {
      throw new Error("RunwareApiKey secret is empty.");
    }
  } catch {
    throw new Error(
      "RunwareApiKey is not configured. xAI TTS runs through the Runware API and requires the RunwareApiKey secret."
    );
  }
}

export function isXaiConfigured(): boolean {
  try {
    const key = runwareApiKey();
    return Boolean(key);
  } catch {
    return false;
  }
}

// ---- Core Runware audioInference call -------------------------------------
async function callRunwareXaiTts(req: XaiTtsRequest): Promise<XaiTtsResponse> {
  ensureXaiConfigured();

  const text = (req.text || "").trim();
  if (!text) {
    throw new Error("Text is required for xAI TTS.");
  }

  const voice = (req.voice || XAI_DEFAULT_VOICE).trim().toLowerCase();
  const language = resolveLanguage(req.language);
  const { mimeType, audioFormat } = resolveOutputFormat(req.outputFormat);

  // Runware audioInference request body
  const requestBody = {
    taskType: "audioInference",
    taskUUID: crypto.randomUUID(),
    model: XAI_TTS_MODEL,
    speech: {
      text,
      voice,
      language,
    },
    outputType: "dataURI",
    outputFormat: audioFormat === "wav" ? "WAV" : "MP3",
    includeCost: true,
  };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= XAI_TTS_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), XAI_TTS_TIMEOUT_MS);

    try {
      const retryInfo = attempt > 1 ? ` (retry ${attempt}/${XAI_TTS_MAX_RETRIES})` : "";
      log.info(`[Runware xAI TTS] Generating speech${retryInfo}: voice=${voice}, lang=${language}, len=${text.length}`);

      const response = await fetch(RUNWARE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runwareApiKey()}`,
        },
        body: JSON.stringify([requestBody]),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        const msg = `Runware xAI TTS failed (${response.status}): ${errBody || "<empty>"}`;

        if (attempt < XAI_TTS_MAX_RETRIES && isRetryableStatus(response.status)) {
          lastError = new Error(msg);
          const backoff = XAI_TTS_RETRY_BASE_DELAY_MS * attempt;
          log.warn(`Runware xAI TTS attempt ${attempt}/${XAI_TTS_MAX_RETRIES} failed: ${msg}. Retrying in ${backoff}ms.`);
          await delay(backoff);
          continue;
        }

        throw new Error(msg);
      }

      const responseText = await response.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`Failed to parse Runware response: ${responseText.slice(0, 200)}`);
      }

      // Extract audio from Runware response
      const audioResult = extractRunwareAudio(data);
      if (!audioResult) {
        log.error(`[Runware xAI TTS] No audio in response: ${JSON.stringify(data).slice(0, 500)}`);
        throw new Error(`No audio data found in Runware response`);
      }

      const dataUri = audioResult.startsWith("data:")
        ? audioResult
        : `data:${mimeType};base64,${audioResult}`;

      log.info(`[Runware xAI TTS] Speech generated successfully: voice=${voice}`);

      return {
        audioData: dataUri,
        mimeType,
        outputFormat: audioFormat,
      };
    } catch (error) {
      const isAbort = error instanceof Error && error.name === "AbortError";
      if (isAbort && attempt < XAI_TTS_MAX_RETRIES) {
        lastError = new Error(`Runware xAI TTS request timed out (attempt ${attempt})`);
        const backoff = XAI_TTS_RETRY_BASE_DELAY_MS * attempt;
        log.warn(`Runware xAI TTS timeout on attempt ${attempt}/${XAI_TTS_MAX_RETRIES}. Retrying in ${backoff}ms.`);
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

  throw lastError || new Error("Runware xAI TTS failed after all retries.");
}

// ---- Extract audio from Runware response ----------------------------------
function extractRunwareAudio(data: any): string | null {
  // Runware responses can come in different shapes:
  // - Array of result objects
  // - Object with data/results array
  // - Direct object with audio fields

  const tryExtract = (obj: any): string | null => {
    if (!obj || typeof obj !== "object") return null;

    // Check common audio data field names
    const audioFields = [
      "audioBase64", "audioBase64Data", "base64Data", "base64",
      "audioData", "audio", "data", "b64",
    ];
    for (const field of audioFields) {
      const val = obj[field];
      if (typeof val === "string" && val.length > 100) {
        return val;
      }
    }

    // Check for audio URL (fallback — we prefer base64 for TTS)
    const urlFields = ["audioURL", "audioUrl", "audio_url", "url"];
    for (const field of urlFields) {
      const val = obj[field];
      if (typeof val === "string" && (val.startsWith("http") || val.startsWith("data:"))) {
        return val;
      }
    }

    return null;
  };

  // Case 1: response is an array
  if (Array.isArray(data)) {
    for (const item of data) {
      const result = tryExtract(item);
      if (result) return result;

      // Nested results array
      if (item && Array.isArray(item.results)) {
        for (const r of item.results) {
          const nested = tryExtract(r);
          if (nested) return nested;
        }
      }
    }
  }

  // Case 2: response has data/results array
  if (data && typeof data === "object") {
    const result = tryExtract(data);
    if (result) return result;

    for (const key of ["data", "results", "output"]) {
      const arr = data[key];
      if (Array.isArray(arr)) {
        for (const item of arr) {
          const nested = tryExtract(item);
          if (nested) return nested;
        }
      }
    }
  }

  return null;
}

// ---- Public API -----------------------------------------------------------
export async function xaiGenerateSpeech(req: XaiTtsRequest): Promise<XaiTtsResponse> {
  return withSlot(() => callRunwareXaiTts(req));
}

export async function xaiGenerateSpeechBatch(
  items: Array<{ id: string; text: string; speaker?: string }>,
  defaultVoice?: string,
  language?: string,
  outputFormat?: AudioFormat,
): Promise<TTSBatchResultItem[]> {
  if (items.length === 0) return [];

  // Runware doesn't have a native batch TTS endpoint, so we run items concurrently
  const results = await Promise.all(
    items.map(async (item) => {
      const text = (item.text || "").trim();
      if (!text) {
        return { id: item.id, audio: null, error: "Text is required." } as TTSBatchResultItem;
      }

      try {
        const response = await withSlot(() =>
          callRunwareXaiTts({
            text,
            voice: item.speaker || defaultVoice || XAI_DEFAULT_VOICE,
            language,
            outputFormat,
          })
        );
        return { id: item.id, audio: response.audioData, error: null } as TTSBatchResultItem;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error(`Runware xAI TTS batch item failed (${item.id}): ${message}`);
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
