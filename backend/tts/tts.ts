import { api, APIError } from "encore.dev/api";
import log from "encore.dev/log";

const COSYVOICE_RUNPOD_API_URL = (process.env.COSYVOICE_RUNPOD_API_URL || "").trim();
const COSYVOICE_RUNPOD_API_KEY = (process.env.COSYVOICE_RUNPOD_API_KEY || "").trim();
const COSYVOICE_RUNPOD_WORKER_API_KEY = (process.env.COSYVOICE_RUNPOD_WORKER_API_KEY || "").trim();
const COSYVOICE_RUNPOD_TTS_PATH = (process.env.COSYVOICE_RUNPOD_TTS_PATH || "/v1/tts").trim();
const COSYVOICE_RUNPOD_TIMEOUT_MS = parsePositiveInt(process.env.COSYVOICE_RUNPOD_TIMEOUT_MS, 1_200_000); // 20min
const COSYVOICE_RUNPOD_MAX_RETRIES = parsePositiveInt(process.env.COSYVOICE_RUNPOD_MAX_RETRIES, 5);
const COSYVOICE_RUNPOD_RETRY_BASE_DELAY_MS = parsePositiveInt(
  process.env.COSYVOICE_RUNPOD_RETRY_BASE_DELAY_MS,
  3000
);
const COSYVOICE_RUNPOD_MAX_CONCURRENT_CALLS = parsePositiveInt(
  process.env.COSYVOICE_RUNPOD_MAX_CONCURRENT_CALLS,
  1
);
const COSYVOICE_RUNPOD_WARMUP_ENABLED = parseBoolean(
  process.env.COSYVOICE_RUNPOD_WARMUP_ENABLED,
  true
);
const COSYVOICE_RUNPOD_WARMUP_TIMEOUT_MS = parsePositiveInt(
  process.env.COSYVOICE_RUNPOD_WARMUP_TIMEOUT_MS,
  240_000
);
const COSYVOICE_RUNPOD_WARMUP_POLL_MS = parsePositiveInt(
  process.env.COSYVOICE_RUNPOD_WARMUP_POLL_MS,
  2_500
);
const COSYVOICE_RUNPOD_WARMUP_PING_TIMEOUT_MS = parsePositiveInt(
  process.env.COSYVOICE_RUNPOD_WARMUP_PING_TIMEOUT_MS,
  15_000
);
const COSYVOICE_RUNPOD_WARMUP_READY_TTL_MS = parsePositiveInt(
  process.env.COSYVOICE_RUNPOD_WARMUP_READY_TTL_MS,
  5_000
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

export interface CosyVoiceVoicesResponse {
  availableSpeakers: string[];
  defaultSpeaker: string;
  defaultReferenceAvailable: boolean;
  modelLoaded: boolean;
}

interface GenerateSpeechRequest {
  text: string;
  provider?: TTSProvider;
  promptText?: string;
  referenceAudioDataUrl?: string;
  referenceAudioUrl?: string;
  speaker?: string;
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
  speaker?: string;
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

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
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

function buildRunpodHealthUrl(): string {
  const base = COSYVOICE_RUNPOD_API_URL.replace(/\/+$/, "");
  return `${base}/health`;
}

function buildRunpodPingUrl(): string {
  const base = COSYVOICE_RUNPOD_API_URL.replace(/\/+$/, "");
  return `${base}/ping`;
}

function buildRunpodAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (COSYVOICE_RUNPOD_API_KEY) {
    headers.Authorization = `Bearer ${COSYVOICE_RUNPOD_API_KEY}`;
  }
  if (COSYVOICE_RUNPOD_WORKER_API_KEY) {
    headers["X-API-Key"] = COSYVOICE_RUNPOD_WORKER_API_KEY;
  }
  return headers;
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

function isLikelyRunpodNoWorker(status: number, body: string): boolean {
  if (status === 430) return true;
  const lowered = (body || "").toLowerCase();
  return lowered.includes("no workers available");
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
let runpodWarmupInFlight: Promise<void> | null = null;
let runpodLastHealthyAtMs = 0;

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

function parsePingState(bodyText: string): string {
  const trimmed = (bodyText || "").trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as { status?: unknown } | null;
    return String(parsed?.status || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function parsePingDetail(bodyText: string): string {
  const trimmed = (bodyText || "").trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as { detail?: unknown; message?: unknown } | null;
    return String(parsed?.detail || parsed?.message || "").trim();
  } catch {
    return "";
  }
}

function isFatalRunpodStorageIssue(message: string): boolean {
  const normalized = (message || "").toLowerCase();
  return (
    normalized.includes("no space left on device") ||
    normalized.includes("file reconstruction error")
  );
}

function markRunpodHealthyNow(): void {
  runpodLastHealthyAtMs = Date.now();
}

function needsRunpodPrewarm(): boolean {
  if (!COSYVOICE_RUNPOD_WARMUP_ENABLED) return false;
  if (runpodLastHealthyAtMs <= 0) return true;
  return Date.now() - runpodLastHealthyAtMs > COSYVOICE_RUNPOD_WARMUP_READY_TTL_MS;
}

async function waitForRunpodWorkerReady(reason: string): Promise<void> {
  if (!COSYVOICE_RUNPOD_WARMUP_ENABLED) return;

  if (runpodWarmupInFlight) {
    await runpodWarmupInFlight;
    return;
  }

  runpodWarmupInFlight = (async () => {
    const startedAt = Date.now();
    let lastSignal = "none";
    let pingAttempts = 0;
    const headers = buildRunpodAuthHeaders();
    const pingUrl = buildRunpodPingUrl();

    while (Date.now() - startedAt < COSYVOICE_RUNPOD_WARMUP_TIMEOUT_MS) {
      pingAttempts += 1;
      try {
        const response = await fetchWithTimeout(
          pingUrl,
          {
            method: "GET",
            headers,
          },
          COSYVOICE_RUNPOD_WARMUP_PING_TIMEOUT_MS
        );

        const bodyText = await response.text();
        const pingState = parsePingState(bodyText);

        if (response.ok) {
          if (pingState === "healthy" || pingState === "ok" || pingState === "") {
            markRunpodHealthyNow();
            log.info(
              `CosyVoice RunPod worker ready after ${Date.now() - startedAt}ms (reason=${reason}, ping_attempts=${pingAttempts})`
            );
            return;
          }

          if (pingState === "initializing") {
            lastSignal = "200:initializing";
          } else if (pingState === "error") {
            const detail = parsePingDetail(bodyText);
            throw new Error(
              `RunPod ping reports worker error: ${detail || bodyText.trim() || "<empty>"}`
            );
          } else {
            lastSignal = `200:${pingState}`;
          }
        } else {
          const compactBody = (bodyText || "").trim().toLowerCase();
          if (response.status === 401 || response.status === 403) {
            throw new Error(
              `RunPod warmup ping auth failed (${response.status}): ${bodyText.trim() || "<empty>"}`
            );
          }
          if (response.status === 404) {
            throw new Error(
              "RunPod warmup ping route not found (404). Check COSYVOICE_RUNPOD_API_URL and worker routes."
            );
          }
          if (
            isRetryableStatus(response.status) ||
            isLikelyInfraBusyStatus(response.status, bodyText) ||
            isLikelyRunpodNoWorker(response.status, compactBody)
          ) {
            lastSignal = `${response.status}:${compactBody || "<empty>"}`;
          } else {
            throw new Error(`RunPod warmup ping failed (${response.status}): ${bodyText.trim() || "<empty>"}`);
          }
        }
      } catch (error) {
        const message = getErrorMessage(error);
        lastSignal = `error:${message}`;
        if (!isTransientFetchError(error) && !isAbortError(error)) {
          throw error;
        }
      }

      await delay(COSYVOICE_RUNPOD_WARMUP_POLL_MS);
    }

    throw new Error(
      `RunPod worker warmup timed out after ${COSYVOICE_RUNPOD_WARMUP_TIMEOUT_MS}ms (reason=${reason}, last_signal=${lastSignal})`
    );
  })();

  try {
    await runpodWarmupInFlight;
  } finally {
    runpodWarmupInFlight = null;
  }
}

async function maybeWarmupRunpodWorker(reason: string): Promise<boolean> {
  if (!COSYVOICE_RUNPOD_WARMUP_ENABLED) return false;
  try {
    await waitForRunpodWorkerReady(reason);
    return true;
  } catch (error) {
    const message = getErrorMessage(error);
    if (isFatalRunpodStorageIssue(message)) {
      throw APIError.failedPrecondition(
        "RunPod worker storage is full (`No space left on device`). " +
          "Increase endpoint container disk (recommended 40-50GB), redeploy workers, and retry."
      );
    }
    log.warn(`RunPod warmup failed (${reason}): ${message}`);
    return false;
  }
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
  const speaker = (req.speaker || "").trim();

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
  if (speaker) {
    formData.set("speaker", speaker);
  }

  if (referenceAudio) {
    const blob = new Blob([new Uint8Array(referenceAudio.buffer)], {
      type: referenceAudio.contentType || "audio/wav",
    });
    formData.set("reference_audio", blob, referenceAudio.filename);
  }

  const headers = buildRunpodAuthHeaders();

  const url = buildRunpodTtsUrl();
  let lastError: Error | null = null;

  if (needsRunpodPrewarm()) {
    await maybeWarmupRunpodWorker("preflight");
  }

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
          const shouldWarmup =
            isLikelyRunpodNoWorker(response.status, errTextRaw) ||
            isLikelyInfraBusyStatus(response.status, errTextRaw);

          let warmed = false;
          if (shouldWarmup) {
            warmed = await maybeWarmupRunpodWorker(`status-${response.status}`);
          }

          if (!warmed) {
            const backoffMs = COSYVOICE_RUNPOD_RETRY_BASE_DELAY_MS * attempt;
            log.warn(
              `CosyVoice RunPod returned ${response.status} (attempt ${attempt}/${COSYVOICE_RUNPOD_MAX_RETRIES}). Retrying in ${backoffMs}ms.`
            );
            await delay(backoffMs);
          } else {
            log.info(
              `CosyVoice RunPod warmup complete after ${response.status}; retrying request immediately (attempt ${attempt}/${COSYVOICE_RUNPOD_MAX_RETRIES}).`
            );
          }
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
          markRunpodHealthyNow();
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
        markRunpodHealthyNow();
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

      markRunpodHealthyNow();
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
        await maybeWarmupRunpodWorker(`network-attempt-${attempt}`);
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

async function runpodListVoicesRequest(): Promise<CosyVoiceVoicesResponse> {
  if (!COSYVOICE_RUNPOD_API_URL) {
    throw APIError.failedPrecondition(
      "COSYVOICE_RUNPOD_API_URL is not configured. Set it to your RunPod CosyVoice API base URL."
    );
  }

  if (needsRunpodPrewarm()) {
    await maybeWarmupRunpodWorker("voice-list-preflight");
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await fetchWithTimeout(
      buildRunpodHealthUrl(),
      {
        method: "GET",
        headers: buildRunpodAuthHeaders(),
      },
      COSYVOICE_REFERENCE_FETCH_TIMEOUT_MS
    );

    if (!response.ok) {
      const errTextRaw = await response.text();
      const errText = errTextRaw.trim() || "<empty>";
      const shouldWarmup =
        attempt < 2 &&
        (isLikelyRunpodNoWorker(response.status, errTextRaw) ||
          isLikelyInfraBusyStatus(response.status, errTextRaw));
      if (shouldWarmup) {
        await maybeWarmupRunpodWorker(`voice-list-status-${response.status}`);
        continue;
      }
      throw new Error(`RunPod CosyVoice health request failed (${response.status}): ${errText}`);
    }

    const payload = (await response.json()) as
      | {
          available_speakers?: unknown;
          default_speaker?: unknown;
          default_reference_available?: unknown;
          model_loaded?: unknown;
        }
      | null;

    const availableSpeakers = Array.isArray(payload?.available_speakers)
      ? payload!.available_speakers
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      : [];

    markRunpodHealthyNow();
    return {
      availableSpeakers,
      defaultSpeaker: String(payload?.default_speaker || "").trim(),
      defaultReferenceAvailable: Boolean(payload?.default_reference_available),
      modelLoaded: Boolean(payload?.model_loaded),
    };
  }

  throw new Error("RunPod CosyVoice health request failed after warmup attempts.");
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
            speaker: req.speaker,
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

export const listCosyVoiceVoices = api<void, CosyVoiceVoicesResponse>(
  { expose: true, method: "GET", path: "/tts/cosyvoice/voices" },
  async () => {
    try {
      return await runpodListVoicesRequest();
    } catch (error) {
      if (isApiError(error)) {
        throw error;
      }
      const message = getErrorMessage(error);
      log.error(`TTS voice list failed: ${message}`);
      throw APIError.unavailable(`CosyVoice voice list failed: ${message}`);
    }
  }
);
