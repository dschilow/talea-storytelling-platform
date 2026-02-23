import { api, APIError } from "encore.dev/api";
import log from "encore.dev/log";

const COSYVOICE_RUNPOD_API_URL = (process.env.COSYVOICE_RUNPOD_API_URL || "").trim();
const COSYVOICE_RUNPOD_API_KEY = (process.env.COSYVOICE_RUNPOD_API_KEY || "").trim();
const COSYVOICE_RUNPOD_WORKER_API_KEY = (process.env.COSYVOICE_RUNPOD_WORKER_API_KEY || "").trim();
const COSYVOICE_RUNPOD_TTS_PATH = (process.env.COSYVOICE_RUNPOD_TTS_PATH || "/v1/tts").trim();
const COSYVOICE_RUNPOD_TIMEOUT_MS = parsePositiveInt(process.env.COSYVOICE_RUNPOD_TIMEOUT_MS, 1_200_000); // 20min
const COSYVOICE_RUNPOD_MAX_RETRIES = parsePositiveInt(process.env.COSYVOICE_RUNPOD_MAX_RETRIES, 3);
const COSYVOICE_RUNPOD_RETRY_BASE_DELAY_MS = parsePositiveInt(
  process.env.COSYVOICE_RUNPOD_RETRY_BASE_DELAY_MS,
  1500
);
const COSYVOICE_RUNPOD_MAX_CONCURRENT_CALLS = parsePositiveInt(
  process.env.COSYVOICE_RUNPOD_MAX_CONCURRENT_CALLS,
  1
);
const COSYVOICE_REFERENCE_FETCH_TIMEOUT_MS = parsePositiveInt(
  process.env.COSYVOICE_REFERENCE_FETCH_TIMEOUT_MS,
  30_000
);
const COSYVOICE_DEFAULT_PROMPT_TEXT = (process.env.COSYVOICE_DEFAULT_PROMPT_TEXT || "").trim();
const COSYVOICE_DEFAULT_REFERENCE_AUDIO_URL = (
  process.env.COSYVOICE_DEFAULT_REFERENCE_AUDIO_URL || ""
).trim();
const COSYVOICE_DEFAULT_EMOTION = (process.env.COSYVOICE_DEFAULT_EMOTION || "").trim();
const COSYVOICE_DEFAULT_OUTPUT_FORMAT = normalizeOutputFormat(
  process.env.COSYVOICE_DEFAULT_OUTPUT_FORMAT || "wav"
);

export type TTSProvider = "cosyvoice3" | "piper" | "chatterbox";
export type AudioFormat = "wav" | "mp3";

export interface TTSResponse {
  audioData: string;
  providerUsed: "cosyvoice3";
  mimeType: string;
  outputFormat: AudioFormat;
}

export interface TTSBatchItem {
  id: string;
  text: string;
}

export interface TTSBatchResultItem {
  id: string;
  audio: string | null;
  error: string | null;
}

export interface TTSBatchResponse {
  results: TTSBatchResultItem[];
}

interface GenerateSpeechRequest {
  text: string;
  provider?: TTSProvider;
  promptText?: string;
  referenceAudioDataUrl?: string;
  referenceAudioUrl?: string;
  emotion?: string;
  instructText?: string;
  outputFormat?: AudioFormat;
  languageId?: string;
  model?: string;
}

interface GenerateSpeechBatchRequest {
  items: TTSBatchItem[];
  provider?: TTSProvider;
  promptText?: string;
  referenceAudioDataUrl?: string;
  referenceAudioUrl?: string;
  emotion?: string;
  instructText?: string;
  outputFormat?: AudioFormat;
  languageId?: string;
  model?: string;
}

type ResolvedReferenceAudio = {
  buffer: Buffer;
  contentType: string;
  filename: string;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt((value || "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function normalizeOutputFormat(value: string | undefined): AudioFormat {
  const normalized = (value || "").trim().toLowerCase();
  return normalized === "mp3" ? "mp3" : "wav";
}

function buildRunpodTtsUrl(): string {
  const base = COSYVOICE_RUNPOD_API_URL.replace(/\/+$/, "");
  const path = `/${COSYVOICE_RUNPOD_TTS_PATH.replace(/^\/+/, "")}`;
  return `${base}${path}`;
}

function dataUriFromBuffer(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function isAbortError(error: unknown): boolean {
  const maybeError = error as { name?: string; message?: string };
  const name = String(maybeError?.name || "");
  const message = String(maybeError?.message || "").toLowerCase();
  return name === "AbortError" || message.includes("aborted");
}

function isTransientFetchError(error: unknown): boolean {
  if (isAbortError(error)) return true;
  const maybeError = error as { message?: string; cause?: { code?: string } };
  const message = String(maybeError?.message || "").toLowerCase();
  const code = String(maybeError?.cause?.code || "").toUpperCase();

  if (message.includes("fetch failed") || message.includes("network")) {
    return true;
  }

  return [
    "ECONNREFUSED",
    "ECONNRESET",
    "ENOTFOUND",
    "EAI_AGAIN",
    "ETIMEDOUT",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_SOCKET",
  ].includes(code);
}

function isRetryableStatus(status: number): boolean {
  // 430 = RunPod "no workers available" (cold-start / scaling up)
  return status === 408 || status === 425 || status === 429 || status === 430 || status >= 500;
}

function isLikelyInfraBusyStatus(status: number, body: string): boolean {
  // RunPod LB can return empty 400 responses when workers are cold/busy/unavailable.
  return status === 400 && !body.trim();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseDataUrl(dataUrl: string): { contentType: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const contentType = (match[1] || "").trim();
  const base64 = match[2] || "";
  if (!contentType || !base64) return null;
  return { contentType, buffer: Buffer.from(base64, "base64") };
}

function detectContentTypeFromFilename(urlOrName: string): string {
  const lower = urlOrName.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".webm")) return "audio/webm";
  if (lower.endsWith(".flac")) return "audio/flac";
  return "audio/wav";
}

function safeFileName(input: string, fallback: string): string {
  const trimmed = input.trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/[^a-z0-9_.-]/gi, "_");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isApiError(error: unknown): boolean {
  const maybeError = error as { code?: unknown; message?: unknown };
  return (
    !!maybeError &&
    typeof maybeError === "object" &&
    typeof maybeError.code === "string" &&
    typeof maybeError.message === "string"
  );
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAudioUrl(url: string): Promise<ResolvedReferenceAudio> {
  const response = await fetchWithTimeout(url, { method: "GET" }, COSYVOICE_REFERENCE_FETCH_TIMEOUT_MS);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Reference audio download failed (${response.status}): ${body}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length === 0) {
    throw new Error("Reference audio download returned empty content.");
  }

  const contentType =
    (response.headers.get("content-type") || "").split(";")[0].trim() ||
    detectContentTypeFromFilename(url);

  let filename = "reference.wav";
  try {
    const parsedUrl = new URL(url);
    const parts = parsedUrl.pathname.split("/").filter(Boolean);
    const lastSegment = parts.length ? parts[parts.length - 1] : undefined;
    if (lastSegment) {
      filename = safeFileName(lastSegment, filename);
    }
  } catch {
    filename = safeFileName(url, filename);
  }

  return { buffer, contentType, filename };
}

async function resolveReferenceAudio(req: GenerateSpeechRequest): Promise<ResolvedReferenceAudio | null> {
  if (req.referenceAudioDataUrl?.trim()) {
    const parsed = parseDataUrl(req.referenceAudioDataUrl.trim());
    if (!parsed) {
      throw APIError.invalidArgument("Invalid referenceAudioDataUrl format.");
    }
    if (!parsed.contentType.startsWith("audio/")) {
      throw APIError.invalidArgument("referenceAudioDataUrl must contain an audio mime type.");
    }
    return {
      buffer: parsed.buffer,
      contentType: parsed.contentType,
      filename: "reference-from-data-url.wav",
    };
  }

  const providedUrl = req.referenceAudioUrl?.trim();
  if (providedUrl) {
    return await fetchAudioUrl(providedUrl);
  }

  if (COSYVOICE_DEFAULT_REFERENCE_AUDIO_URL) {
    return await fetchAudioUrl(COSYVOICE_DEFAULT_REFERENCE_AUDIO_URL);
  }

  return null;
}

let runpodInFlight = 0;
const runpodWaitQueue: Array<() => void> = [];

async function acquireRunpodSlot(): Promise<void> {
  if (runpodInFlight < COSYVOICE_RUNPOD_MAX_CONCURRENT_CALLS) {
    runpodInFlight += 1;
    return;
  }

  await new Promise<void>((resolve) => runpodWaitQueue.push(resolve));
  runpodInFlight += 1;
}

function releaseRunpodSlot(): void {
  runpodInFlight = Math.max(0, runpodInFlight - 1);
  const next = runpodWaitQueue.shift();
  if (next) next();
}

async function withRunpodSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquireRunpodSlot();
  try {
    return await fn();
  } finally {
    releaseRunpodSlot();
  }
}

function resolveMimeType(contentTypeHeader: string | null, outputFormat: AudioFormat): string {
  const normalized = (contentTypeHeader || "").split(";")[0].trim().toLowerCase();
  if (normalized.startsWith("audio/")) {
    return normalized;
  }
  return outputFormat === "mp3" ? "audio/mpeg" : "audio/wav";
}

async function runpodTtsRequest(req: GenerateSpeechRequest): Promise<TTSResponse> {
  if (!COSYVOICE_RUNPOD_API_URL) {
    throw APIError.failedPrecondition(
      "COSYVOICE_RUNPOD_API_URL is not configured. Set it to your RunPod CosyVoice API base URL."
    );
  }

  const text = (req.text || "").trim();
  if (!text) {
    throw APIError.invalidArgument("Text is required.");
  }

  if (req.provider && req.provider !== "cosyvoice3") {
    log.warn(
      `Legacy provider "${req.provider}" requested. Using CosyVoice3 RunPod endpoint instead.`
    );
  }

  const outputFormat = normalizeOutputFormat(req.outputFormat || COSYVOICE_DEFAULT_OUTPUT_FORMAT);
  const promptText = (req.promptText || COSYVOICE_DEFAULT_PROMPT_TEXT || "").trim();
  const emotion = (req.emotion || COSYVOICE_DEFAULT_EMOTION || "").trim();
  const instructText = (req.instructText || "").trim();

  const referenceAudio = await resolveReferenceAudio(req);

  const formData = new FormData();
  formData.set("text", text);
  formData.set("output_format", outputFormat);

  if (promptText) {
    formData.set("prompt_text", promptText);
  }
  if (emotion) {
    formData.set("emotion", emotion);
  }
  if (instructText) {
    formData.set("instruct_text", instructText);
  }
  if (req.languageId?.trim()) {
    formData.set("language_id", req.languageId.trim());
  }
  if (req.model?.trim()) {
    formData.set("model", req.model.trim());
  }

  if (referenceAudio) {
    const blob = new Blob([new Uint8Array(referenceAudio.buffer)], {
      type: referenceAudio.contentType || "audio/wav",
    });
    formData.set("reference_audio", blob, referenceAudio.filename);
  }

  const headers: Record<string, string> = {};
  if (COSYVOICE_RUNPOD_API_KEY) {
    headers.Authorization = `Bearer ${COSYVOICE_RUNPOD_API_KEY}`;
  }
  if (COSYVOICE_RUNPOD_WORKER_API_KEY) {
    headers["X-API-Key"] = COSYVOICE_RUNPOD_WORKER_API_KEY;
  }

  const url = buildRunpodTtsUrl();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= COSYVOICE_RUNPOD_MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers,
          body: formData,
        },
        COSYVOICE_RUNPOD_TIMEOUT_MS
      );

      if (!response.ok) {
        const errTextRaw = await response.text();
        const errText = errTextRaw.trim() || "<empty>";
        const wwwAuth = response.headers.get("www-authenticate");
        const requestId =
          response.headers.get("x-request-id") || response.headers.get("x-runpod-request-id");

        const retryable =
          isRetryableStatus(response.status) || isLikelyInfraBusyStatus(response.status, errTextRaw);

        if (attempt < COSYVOICE_RUNPOD_MAX_RETRIES && retryable) {
          const backoffMs = COSYVOICE_RUNPOD_RETRY_BASE_DELAY_MS * attempt;
          log.warn(
            `CosyVoice RunPod returned ${response.status} (attempt ${attempt}/${COSYVOICE_RUNPOD_MAX_RETRIES}). Retrying in ${backoffMs}ms.`
          );
          await delay(backoffMs);
          continue;
        }

        const details: string[] = [];
        if (wwwAuth) details.push(`www-authenticate=${wwwAuth}`);
        if (requestId) details.push(`request-id=${requestId}`);
        const detailSuffix = details.length > 0 ? ` [${details.join(", ")}]` : "";

        if (response.status === 401) {
          const authHint =
            "Check COSYVOICE_RUNPOD_API_KEY (must be a RunPod account API key with endpoint access). " +
            "If your worker enforces COSYVOICE_API_KEY, set COSYVOICE_RUNPOD_WORKER_API_KEY to the same worker secret.";
          const keyState = ` bearer_set=${Boolean(COSYVOICE_RUNPOD_API_KEY)} worker_key_set=${Boolean(
            COSYVOICE_RUNPOD_WORKER_API_KEY
          )}`;
          throw new Error(
            `RunPod CosyVoice API failed (401): ${errText}${detailSuffix}. ${authHint}.${keyState}`
          );
        }

        if (isLikelyInfraBusyStatus(response.status, errTextRaw)) {
          throw new Error(
            "RunPod CosyVoice API failed (400 <empty>). This often means worker cold-start/busy on Load Balancer endpoints. " +
              "Reduce parallel calls (COSYVOICE_RUNPOD_MAX_CONCURRENT_CALLS=1), keep Max workers >= 1, or use Queue endpoint."
          );
        }

        if (response.status === 400) {
          throw APIError.invalidArgument(`CosyVoice request rejected: ${errText}${detailSuffix}`);
        }
        if (response.status === 401) {
          throw APIError.unauthenticated(`CosyVoice auth failed: ${errText}${detailSuffix}`);
        }
        if (response.status === 403) {
          throw APIError.permissionDenied(`CosyVoice access denied: ${errText}${detailSuffix}`);
        }
        if (response.status === 404) {
          throw APIError.notFound(`CosyVoice endpoint not found: ${errText}${detailSuffix}`);
        }

        throw new Error(`RunPod CosyVoice API failed (${response.status}): ${errText}${detailSuffix}`);
      }

      const contentType = response.headers.get("content-type");
      if ((contentType || "").toLowerCase().includes("application/json")) {
        const payload = (await response.json()) as
          | { audioData?: string; audioBase64?: string; mimeType?: string }
          | null;

        const audioData = payload?.audioData?.trim();
        if (audioData) {
          const mimeType = payload?.mimeType?.trim() || resolveMimeType(null, outputFormat);
          return {
            audioData,
            providerUsed: "cosyvoice3",
            mimeType,
            outputFormat,
          };
        }

        const base64 = payload?.audioBase64?.trim();
        if (!base64) {
          throw new Error("RunPod CosyVoice API returned JSON without audio data.");
        }

        const mimeType = payload?.mimeType?.trim() || resolveMimeType(null, outputFormat);
        return {
          audioData: dataUriFromBuffer(Buffer.from(base64, "base64"), mimeType),
          providerUsed: "cosyvoice3",
          mimeType,
          outputFormat,
        };
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      if (!audioBuffer.length) {
        throw new Error("RunPod CosyVoice API returned an empty audio stream.");
      }

      const mimeType = resolveMimeType(contentType, outputFormat);
      return {
        audioData: dataUriFromBuffer(audioBuffer, mimeType),
        providerUsed: "cosyvoice3",
        mimeType,
        outputFormat,
      };
    } catch (error) {
      if (isApiError(error)) {
        throw error;
      }

      const message = getErrorMessage(error);
      lastError = new Error(message);

      const canRetry = attempt < COSYVOICE_RUNPOD_MAX_RETRIES && isTransientFetchError(error);
      if (canRetry) {
        const backoffMs = COSYVOICE_RUNPOD_RETRY_BASE_DELAY_MS * attempt;
        log.warn(
          `CosyVoice RunPod network error (attempt ${attempt}/${COSYVOICE_RUNPOD_MAX_RETRIES}): ${message}. Retrying in ${backoffMs}ms.`
        );
        await delay(backoffMs);
        continue;
      }

      if (isAbortError(error)) {
        throw APIError.unavailable(
          `CosyVoice RunPod request timed out after ${Math.round(
            COSYVOICE_RUNPOD_TIMEOUT_MS / 1000
          )}s. Increase COSYVOICE_RUNPOD_TIMEOUT_MS if needed.`
        );
      }

      throw error;
    }
  }

  throw new Error(lastError?.message || "RunPod CosyVoice request failed after all retries.");
}

// API Endpoints

export const generateSpeech = api<GenerateSpeechRequest, TTSResponse>(
  { expose: true, method: "POST", path: "/tts/generate" },
  async (req) => {
    try {
      return await withRunpodSlot(() => runpodTtsRequest(req));
    } catch (error) {
      if (isApiError(error)) {
        throw error;
      }
      const message = getErrorMessage(error);
      log.error(`TTS generate failed: ${message}`);
      throw APIError.unavailable(`CosyVoice generation failed: ${message}`);
    }
  }
);

export const generateSpeechBatch = api<GenerateSpeechBatchRequest, TTSBatchResponse>(
  { expose: true, method: "POST", path: "/tts/batch" },
  async (req) => {
    if (!req.items || req.items.length === 0) {
      return { results: [] };
    }

    const results: TTSBatchResultItem[] = [];

    for (const item of req.items) {
      const text = (item.text || "").trim();
      if (!text) {
        results.push({
          id: item.id,
          audio: null,
          error: "Text is required.",
        });
        continue;
      }

      try {
        const response = await withRunpodSlot(() =>
          runpodTtsRequest({
            text,
            provider: req.provider,
            promptText: req.promptText,
            referenceAudioDataUrl: req.referenceAudioDataUrl,
            referenceAudioUrl: req.referenceAudioUrl,
            emotion: req.emotion,
            instructText: req.instructText,
            outputFormat: req.outputFormat,
            languageId: req.languageId,
            model: req.model,
          })
        );

        results.push({
          id: item.id,
          audio: response.audioData,
          error: null,
        });
      } catch (error) {
        const message = getErrorMessage(error);
        log.error(`TTS batch item failed (${item.id}): ${message}`);
        results.push({
          id: item.id,
          audio: null,
          error: message,
        });
      }
    }

    return { results };
  }
);
