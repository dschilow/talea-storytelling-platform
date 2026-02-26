import { api, APIError } from "encore.dev/api";
import log from "encore.dev/log";
import { splitTextIntoChunks } from "../helpers/ttsChunking";

type RunpodEndpointMode = "load_balancer" | "queue";

const COSYVOICE_RUNPOD_API_URL = (process.env.COSYVOICE_RUNPOD_API_URL || "").trim();
const COSYVOICE_RUNPOD_API_KEY = (process.env.COSYVOICE_RUNPOD_API_KEY || "").trim();
const COSYVOICE_RUNPOD_WORKER_API_KEY = (process.env.COSYVOICE_RUNPOD_WORKER_API_KEY || "").trim();
const COSYVOICE_RUNPOD_TTS_PATH = (process.env.COSYVOICE_RUNPOD_TTS_PATH || "/v1/tts").trim();
const COSYVOICE_RUNPOD_ENDPOINT_MODE = resolveRunpodEndpointMode(
  process.env.COSYVOICE_RUNPOD_ENDPOINT_MODE,
  COSYVOICE_RUNPOD_API_URL
);
const COSYVOICE_RUNPOD_TIMEOUT_MS = parsePositiveInt(process.env.COSYVOICE_RUNPOD_TIMEOUT_MS, 300_000); // 5min per single item
const COSYVOICE_RUNPOD_MAX_RETRIES = parsePositiveInt(process.env.COSYVOICE_RUNPOD_MAX_RETRIES, 3);
const COSYVOICE_RUNPOD_RETRY_BASE_DELAY_MS = parsePositiveInt(
  process.env.COSYVOICE_RUNPOD_RETRY_BASE_DELAY_MS,
  1500
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
const COSYVOICE_RUNPOD_QUEUE_POLL_MS = parsePositiveInt(
  process.env.COSYVOICE_RUNPOD_QUEUE_POLL_MS,
  2_000
);
const COSYVOICE_DEFAULT_PROMPT_TEXT = (process.env.COSYVOICE_DEFAULT_PROMPT_TEXT || "").trim();
const COSYVOICE_USE_DEFAULT_PROMPT_TEXT = parseBoolean(
  process.env.COSYVOICE_USE_DEFAULT_PROMPT_TEXT,
  false
);
const COSYVOICE_DEFAULT_REFERENCE_AUDIO_URL = (
  process.env.COSYVOICE_DEFAULT_REFERENCE_AUDIO_URL || ""
).trim();
const COSYVOICE_PREFER_WORKER_DEFAULT_REFERENCE = parseBoolean(
  process.env.COSYVOICE_PREFER_WORKER_DEFAULT_REFERENCE,
  true
);
const COSYVOICE_REFERENCE_AUDIO_CACHE_TTL_MS = parsePositiveInt(
  process.env.COSYVOICE_REFERENCE_AUDIO_CACHE_TTL_MS,
  3_600_000
);
const COSYVOICE_DEFAULT_EMOTION = (process.env.COSYVOICE_DEFAULT_EMOTION || "").trim();
const COSYVOICE_DEFAULT_REFERENCE_TRANSCRIPT = (
  process.env.COSYVOICE_DEFAULT_REFERENCE_TRANSCRIPT || ""
).trim();
const COSYVOICE_DEFAULT_OUTPUT_FORMAT = normalizeOutputFormat(
  process.env.COSYVOICE_DEFAULT_OUTPUT_FORMAT || "mp3"
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

type ReferenceAudioCacheEntry = {
  buffer: Buffer;
  contentType: string;
  filename: string;
  expiresAtMs: number;
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

function resolveRunpodEndpointMode(
  value: string | undefined,
  apiUrl: string
): RunpodEndpointMode {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "queue") return "queue";
  if (normalized === "load_balancer" || normalized === "loadbalancer" || normalized === "lb") {
    return "load_balancer";
  }

  // Auto-detect: Queue endpoints use api.runpod.ai/v2/<endpoint-id>/...
  if (/api\.runpod\.ai\/v2\/[^/]+/i.test(apiUrl)) {
    return "queue";
  }
  return "load_balancer";
}

function normalizeOutputFormat(value: string | undefined): AudioFormat {
  const normalized = (value || "").trim().toLowerCase();
  return normalized === "mp3" ? "mp3" : "wav";
}

function buildRunpodBaseUrl(): string {
  return COSYVOICE_RUNPOD_API_URL.replace(/\/+$/, "");
}

function buildRunpodLoadBalancerBaseUrl(): string {
  let base = buildRunpodBaseUrl();
  base = base.replace(/\/(v1\/tts|ping|health)$/i, "");
  return base;
}

function buildRunpodQueueBaseUrl(): string {
  let base = buildRunpodBaseUrl();
  base = base.replace(/\/(run|runsync|health|purge-queue)$/i, "");
  base = base.replace(/\/(status|stream|cancel|retry)\/[^/]+$/i, "");
  return base;
}

function buildRunpodTtsUrl(): string {
  const path = `/${COSYVOICE_RUNPOD_TTS_PATH.replace(/^\/+/, "")}`;
  return `${buildRunpodLoadBalancerBaseUrl()}${path}`;
}

function buildRunpodHealthUrl(): string {
  if (COSYVOICE_RUNPOD_ENDPOINT_MODE === "queue") {
    return `${buildRunpodQueueBaseUrl()}/health`;
  }
  return `${buildRunpodLoadBalancerBaseUrl()}/health`;
}

function buildRunpodPingUrl(): string {
  return `${buildRunpodLoadBalancerBaseUrl()}/ping`;
}

function buildRunpodQueueRunUrl(): string {
  return `${buildRunpodQueueBaseUrl()}/run`;
}

function buildRunpodQueueStatusUrl(jobId: string): string {
  return `${buildRunpodQueueBaseUrl()}/status/${encodeURIComponent(jobId)}`;
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

function isLikelyGatewayHostError(status: number, body: string): boolean {
  if (![502, 503, 504].includes(status)) {
    return false;
  }
  const lowered = (body || "").toLowerCase();
  return (
    lowered.includes("bad gateway") ||
    lowered.includes("host error") ||
    lowered.includes("cloudflare") ||
    lowered.includes("no healthy upstream") ||
    lowered.includes("upstream connect error")
  );
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

const referenceAudioCache = new Map<string, ReferenceAudioCacheEntry>();

function getCachedReferenceAudio(url: string): ResolvedReferenceAudio | null {
  if (COSYVOICE_REFERENCE_AUDIO_CACHE_TTL_MS <= 0) return null;

  const cached = referenceAudioCache.get(url);
  if (!cached) return null;
  if (Date.now() >= cached.expiresAtMs) {
    referenceAudioCache.delete(url);
    return null;
  }

  return {
    buffer: Buffer.from(cached.buffer),
    contentType: cached.contentType,
    filename: cached.filename,
  };
}

function setCachedReferenceAudio(url: string, audio: ResolvedReferenceAudio): void {
  if (COSYVOICE_REFERENCE_AUDIO_CACHE_TTL_MS <= 0) return;

  referenceAudioCache.set(url, {
    buffer: Buffer.from(audio.buffer),
    contentType: audio.contentType,
    filename: audio.filename,
    expiresAtMs: Date.now() + COSYVOICE_REFERENCE_AUDIO_CACHE_TTL_MS,
  });
}

async function fetchAudioUrl(url: string): Promise<ResolvedReferenceAudio> {
  const cached = getCachedReferenceAudio(url);
  if (cached) {
    return cached;
  }

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

  const resolved = { buffer, contentType, filename };
  setCachedReferenceAudio(url, resolved);
  return resolved;
}

function hasExplicitReference(req: GenerateSpeechRequest): boolean {
  return Boolean(req.referenceAudioDataUrl?.trim() || req.referenceAudioUrl?.trim());
}

async function resolveReferenceAudio(
  req: GenerateSpeechRequest,
  includeBackendDefaultReference: boolean
): Promise<ResolvedReferenceAudio | null> {
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

  if (includeBackendDefaultReference && COSYVOICE_DEFAULT_REFERENCE_AUDIO_URL) {
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
  if (COSYVOICE_RUNPOD_ENDPOINT_MODE === "queue") return false;
  if (!COSYVOICE_RUNPOD_WARMUP_ENABLED) return false;
  if (runpodLastHealthyAtMs <= 0) return true;
  return Date.now() - runpodLastHealthyAtMs > COSYVOICE_RUNPOD_WARMUP_READY_TTL_MS;
}

async function waitForRunpodWorkerReady(reason: string): Promise<void> {
  if (COSYVOICE_RUNPOD_ENDPOINT_MODE === "queue") return;
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
  if (COSYVOICE_RUNPOD_ENDPOINT_MODE === "queue") return false;
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

type RunpodQueueJobResponse = {
  id?: string;
  status?: string;
  output?: unknown;
  error?: unknown;
};

function parseRunpodQueueStatus(status: unknown): string {
  return String(status || "").trim().toUpperCase();
}

function isRetryableQueueError(message: string): boolean {
  const normalized = (message || "").toLowerCase();
  return (
    normalized.includes(" 429") ||
    normalized.includes("(429)") ||
    normalized.includes(" 500") ||
    normalized.includes(" 502") ||
    normalized.includes(" 503") ||
    normalized.includes(" 504") ||
    normalized.includes("bad gateway") ||
    normalized.includes("gateway") ||
    normalized.includes("timed out") ||
    normalized.includes("rate limit")
  );
}

function parseRunpodQueueFailure(payload: RunpodQueueJobResponse): string {
  const error = payload.error;
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  const output = payload.output as { error?: unknown; detail?: unknown } | undefined;
  const outputError = String(output?.error || output?.detail || "").trim();
  if (outputError) return outputError;
  return "unknown queue failure";
}

function parseQueueTtsOutput(payload: unknown, outputFormat: AudioFormat): TTSResponse {
  const data = (payload || {}) as {
    audioData?: unknown;
    audioBase64?: unknown;
    mimeType?: unknown;
    outputFormat?: unknown;
    error?: unknown;
    detail?: unknown;
  };

  const outputError = String(data.error || data.detail || "").trim();
  if (outputError) {
    throw new Error(`Queue worker error: ${outputError}`);
  }

  const declaredFormat = normalizeOutputFormat(String(data.outputFormat || outputFormat));
  const mimeType = String(data.mimeType || "").trim() || resolveMimeType(null, declaredFormat);

  const audioData = String(data.audioData || "").trim();
  if (audioData) {
    const asDataUri = audioData.startsWith("data:") ? audioData : dataUriFromBuffer(Buffer.from(audioData, "base64"), mimeType);
    return {
      audioData: asDataUri,
      providerUsed: "cosyvoice3",
      mimeType,
      outputFormat: declaredFormat,
    };
  }

  const audioBase64 = String(data.audioBase64 || "").trim();
  if (!audioBase64) {
    throw new Error("Queue response has no audio payload.");
  }

  return {
    audioData: dataUriFromBuffer(Buffer.from(audioBase64, "base64"), mimeType),
    providerUsed: "cosyvoice3",
    mimeType,
    outputFormat: declaredFormat,
  };
}

async function submitRunpodQueueJob(input: Record<string, unknown>): Promise<string> {
  const response = await fetchWithTimeout(
    buildRunpodQueueRunUrl(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildRunpodAuthHeaders(),
      },
      body: JSON.stringify({ input }),
    },
    COSYVOICE_REFERENCE_FETCH_TIMEOUT_MS
  );

  const rawBody = await response.text();
  const requestId = response.headers.get("x-request-id") || response.headers.get("x-runpod-request-id");
  const detailSuffix = requestId ? ` [request-id=${requestId}]` : "";

  if (!response.ok) {
    const body = rawBody.trim() || "<empty>";
    if (response.status === 401) {
      const authHint =
        "Check COSYVOICE_RUNPOD_API_KEY (RunPod account API key with endpoint access). " +
        "Queue endpoint auth is validated at RunPod edge.";
      throw new Error(`RunPod queue submit failed (401): ${body}${detailSuffix}. ${authHint}`);
    }
    throw new Error(`RunPod queue submit failed (${response.status}): ${body}${detailSuffix}`);
  }

  let payload: RunpodQueueJobResponse;
  try {
    payload = JSON.parse(rawBody) as RunpodQueueJobResponse;
  } catch {
    throw new Error(`RunPod queue submit returned invalid JSON: ${rawBody.slice(0, 500)}`);
  }

  const jobId = String(payload.id || "").trim();
  if (!jobId) {
    throw new Error("RunPod queue submit returned no job id.");
  }
  return jobId;
}

async function waitForRunpodQueueJob(jobId: string): Promise<unknown> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < COSYVOICE_RUNPOD_TIMEOUT_MS) {
    const response = await fetchWithTimeout(
      buildRunpodQueueStatusUrl(jobId),
      {
        method: "GET",
        headers: buildRunpodAuthHeaders(),
      },
      COSYVOICE_REFERENCE_FETCH_TIMEOUT_MS
    );

    const rawBody = await response.text();
    if (!response.ok) {
      throw new Error(`RunPod queue status failed (${response.status}): ${(rawBody || "").trim() || "<empty>"}`);
    }

    let payload: RunpodQueueJobResponse;
    try {
      payload = JSON.parse(rawBody) as RunpodQueueJobResponse;
    } catch {
      throw new Error(`RunPod queue status returned invalid JSON: ${rawBody.slice(0, 500)}`);
    }

    const status = parseRunpodQueueStatus(payload.status);
    if (status === "COMPLETED") {
      return payload.output;
    }
    if (["FAILED", "CANCELLED", "TIMED_OUT", "ERROR"].includes(status)) {
      throw new Error(`RunPod queue job ${status}: ${parseRunpodQueueFailure(payload)}`);
    }

    // Adaptive polling: poll fast (1s) during first 10s, then slow down
    const elapsed = Date.now() - startedAt;
    const pollMs = elapsed < 10_000 ? 1_000 : COSYVOICE_RUNPOD_QUEUE_POLL_MS;
    await delay(pollMs);
  }

  throw new Error(
    `RunPod queue job timed out after ${Math.round(COSYVOICE_RUNPOD_TIMEOUT_MS / 1000)}s (job_id=${jobId})`
  );
}

async function runpodQueueTtsRequest(req: GenerateSpeechRequest): Promise<TTSResponse> {
  const text = (req.text || "").trim();
  if (!text) {
    throw APIError.invalidArgument("Text is required.");
  }

  const outputFormat = normalizeOutputFormat(req.outputFormat || COSYVOICE_DEFAULT_OUTPUT_FORMAT);
  const promptText = (
    req.promptText ||
    (COSYVOICE_USE_DEFAULT_PROMPT_TEXT ? COSYVOICE_DEFAULT_PROMPT_TEXT : "") ||
    COSYVOICE_DEFAULT_REFERENCE_TRANSCRIPT ||
    ""
  ).trim();
  const emotion = (req.emotion || COSYVOICE_DEFAULT_EMOTION || "").trim();
  const instructText = (req.instructText || "").trim();
  const speaker = (req.speaker || "").trim();
  const includeBackendDefaultReference =
    !COSYVOICE_PREFER_WORKER_DEFAULT_REFERENCE || hasExplicitReference(req);
  const referenceAudio = await resolveReferenceAudio(req, includeBackendDefaultReference);

  const input: Record<string, unknown> = {
    action: "tts",
    text,
    output_format: outputFormat,
  };
  if (promptText) input.prompt_text = promptText;
  if (emotion) input.emotion = emotion;
  if (instructText) input.instruct_text = instructText;
  if (speaker) input.speaker = speaker;
  if (req.languageId?.trim()) input.language_id = req.languageId.trim();
  if (req.model?.trim()) input.model = req.model.trim();

  if (referenceAudio) {
    input.reference_audio_base64 = referenceAudio.buffer.toString("base64");
    input.reference_audio_content_type = referenceAudio.contentType;
    input.reference_audio_filename = referenceAudio.filename;
  }

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= COSYVOICE_RUNPOD_MAX_RETRIES; attempt++) {
    try {
      const jobId = await submitRunpodQueueJob(input);
      const output = await waitForRunpodQueueJob(jobId);
      markRunpodHealthyNow();
      return parseQueueTtsOutput(output, outputFormat);
    } catch (error) {
      if (isApiError(error)) {
        throw error;
      }

      const message = getErrorMessage(error);
      lastError = new Error(message);
      const retryable =
        attempt < COSYVOICE_RUNPOD_MAX_RETRIES &&
        (isTransientFetchError(error) || isRetryableQueueError(message));

      if (!retryable) {
        throw error;
      }

      const backoffMs = COSYVOICE_RUNPOD_RETRY_BASE_DELAY_MS * attempt;
      log.warn(
        `RunPod queue request failed (attempt ${attempt}/${COSYVOICE_RUNPOD_MAX_RETRIES}): ${message}. Retrying in ${backoffMs}ms.`
      );
      await delay(backoffMs);
    }
  }

  throw new Error(lastError?.message || "RunPod queue request failed after all retries.");
}

async function runpodQueueTtsBatchRequest(
  req: GenerateSpeechBatchRequest
): Promise<TTSBatchResultItem[]> {
  const items = req.items || [];
  if (items.length === 0) return [];

  const outputFormat = normalizeOutputFormat(req.outputFormat || COSYVOICE_DEFAULT_OUTPUT_FORMAT);
  const promptText = (
    req.promptText ||
    (COSYVOICE_USE_DEFAULT_PROMPT_TEXT ? COSYVOICE_DEFAULT_PROMPT_TEXT : "") ||
    COSYVOICE_DEFAULT_REFERENCE_TRANSCRIPT ||
    ""
  ).trim();
  const emotion = (req.emotion || COSYVOICE_DEFAULT_EMOTION || "").trim();
  const instructText = (req.instructText || "").trim();
  const speaker = (req.speaker || "").trim();

  // Extract reference fields compatible with GenerateSpeechRequest
  const refReq: GenerateSpeechRequest = {
    text: "_batch_",
    referenceAudioDataUrl: req.referenceAudioDataUrl,
    referenceAudioUrl: req.referenceAudioUrl,
  };
  const includeBackendDefaultReference =
    !COSYVOICE_PREFER_WORKER_DEFAULT_REFERENCE || hasExplicitReference(refReq);
  const referenceAudio = await resolveReferenceAudio(refReq, includeBackendDefaultReference);

  const texts = items
    .filter((item) => (item.text || "").trim())
    .map((item) => ({ id: item.id, text: (item.text || "").trim() }));

  const emptyItems: TTSBatchResultItem[] = items
    .filter((item) => !(item.text || "").trim())
    .map((item) => ({ id: item.id, audio: null, error: "Text is required." }));

  if (texts.length === 0) return emptyItems;

  const input: Record<string, unknown> = {
    action: "tts_batch",
    texts,
    output_format: outputFormat,
  };
  if (promptText) input.prompt_text = promptText;
  if (emotion) input.emotion = emotion;
  if (instructText) input.instruct_text = instructText;
  if (speaker) input.speaker = speaker;
  if (req.languageId?.trim()) input.language_id = req.languageId.trim();
  if (req.model?.trim()) input.model = req.model.trim();

  if (referenceAudio) {
    input.reference_audio_base64 = referenceAudio.buffer.toString("base64");
    input.reference_audio_content_type = referenceAudio.contentType;
    input.reference_audio_filename = referenceAudio.filename;
  }

  // Longer timeout: ~30s per item + base overhead
  const batchTimeoutMs = Math.max(
    COSYVOICE_RUNPOD_TIMEOUT_MS,
    texts.length * 30_000 + 60_000
  );

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= COSYVOICE_RUNPOD_MAX_RETRIES; attempt++) {
    try {
      const jobId = await submitRunpodQueueJob(input);
      // Use extended polling for batch jobs
      const startedAt = Date.now();
      let output: unknown = undefined;
      while (Date.now() - startedAt < batchTimeoutMs) {
        const response = await fetchWithTimeout(
          buildRunpodQueueStatusUrl(jobId),
          { method: "GET", headers: buildRunpodAuthHeaders() },
          COSYVOICE_REFERENCE_FETCH_TIMEOUT_MS
        );
        const rawBody = await response.text();
        if (!response.ok) {
          throw new Error(`RunPod queue status failed (${response.status}): ${(rawBody || "").trim()}`);
        }
        const payload = JSON.parse(rawBody) as RunpodQueueJobResponse;
        const status = parseRunpodQueueStatus(payload.status);
        if (status === "COMPLETED") {
          output = payload.output;
          break;
        }
        if (["FAILED", "CANCELLED", "TIMED_OUT", "ERROR"].includes(status)) {
          throw new Error(`RunPod queue batch job ${status}: ${parseRunpodQueueFailure(payload)}`);
        }
        // Adaptive polling: poll fast (1s) during first 10s, then slow down
        const elapsed = Date.now() - startedAt;
        const pollMs = elapsed < 10_000 ? 1_000 : COSYVOICE_RUNPOD_QUEUE_POLL_MS;
        await delay(pollMs);
      }
      if (output === undefined) {
        throw new Error(`RunPod batch job timed out after ${Math.round(batchTimeoutMs / 1000)}s`);
      }

      markRunpodHealthyNow();

      // Parse batch results
      const batchOutput = output as { results?: unknown[] } | null;
      const rawResults = Array.isArray(batchOutput?.results) ? batchOutput!.results : [];
      const results: TTSBatchResultItem[] = rawResults.map((item: any) => {
        const id = String(item?.id || "");
        const error = item?.error ? String(item.error) : null;
        if (error || !item?.audioBase64) {
          return { id, audio: null, error: error || "No audio returned." };
        }
        const mimeType = String(item.mimeType || "").trim() || resolveMimeType(null, outputFormat);
        const audioBase64 = String(item.audioBase64);
        return {
          id,
          audio: dataUriFromBuffer(Buffer.from(audioBase64, "base64"), mimeType),
          error: null,
        };
      });

      return [...emptyItems, ...results];
    } catch (error) {
      if (isApiError(error)) throw error;
      const message = getErrorMessage(error);
      lastError = new Error(message);
      const retryable =
        attempt < COSYVOICE_RUNPOD_MAX_RETRIES &&
        (isTransientFetchError(error) || isRetryableQueueError(message));
      if (!retryable) throw error;
      const backoffMs = COSYVOICE_RUNPOD_RETRY_BASE_DELAY_MS * attempt;
      log.warn(`RunPod batch request failed (attempt ${attempt}/${COSYVOICE_RUNPOD_MAX_RETRIES}): ${message}. Retrying in ${backoffMs}ms.`);
      await delay(backoffMs);
    }
  }

  throw new Error(lastError?.message || "RunPod batch request failed after all retries.");
}

async function runpodQueueVoicesRequest(): Promise<CosyVoiceVoicesResponse> {
  const jobId = await submitRunpodQueueJob({ action: "voices" });
  const output = (await waitForRunpodQueueJob(jobId)) as {
    availableSpeakers?: unknown;
    defaultReferenceAvailable?: unknown;
    modelLoaded?: unknown;
  } | null;

  const available = Array.isArray(output?.availableSpeakers)
    ? output!.availableSpeakers
        .map((value) => String(value || "").trim())
        .filter((value) => value.length > 0)
    : [];

  return {
    availableSpeakers: available,
    defaultSpeaker: "",
    defaultReferenceAvailable: Boolean(output?.defaultReferenceAvailable),
    modelLoaded: Boolean(output?.modelLoaded),
  };
}

async function runpodTtsRequest(req: GenerateSpeechRequest): Promise<TTSResponse> {
  if (COSYVOICE_RUNPOD_ENDPOINT_MODE === "queue") {
    return await runpodQueueTtsRequest(req);
  }

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
  const promptText = (
    req.promptText ||
    (COSYVOICE_USE_DEFAULT_PROMPT_TEXT ? COSYVOICE_DEFAULT_PROMPT_TEXT : "") ||
    COSYVOICE_DEFAULT_REFERENCE_TRANSCRIPT ||
    ""
  ).trim();
  const emotion = (req.emotion || COSYVOICE_DEFAULT_EMOTION || "").trim();
  const instructText = (req.instructText || "").trim();
  const speaker = (req.speaker || "").trim();

  const includeBackendDefaultReference =
    !COSYVOICE_PREFER_WORKER_DEFAULT_REFERENCE || hasExplicitReference(req);
  const referenceAudio = await resolveReferenceAudio(req, includeBackendDefaultReference);

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
            isLikelyInfraBusyStatus(response.status, errTextRaw) ||
            isLikelyGatewayHostError(response.status, errTextRaw);

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
        if (isLikelyGatewayHostError(response.status, errTextRaw)) {
          throw new Error(
            `RunPod CosyVoice API failed (${response.status} gateway). ` +
              "Upstream worker was unavailable/crashed during request. " +
              "On slower GPUs this happens more often with LB endpoints. " +
              "Use Queue endpoint, or keep at least one active worker while generating, or increase Max workers."
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

  if (COSYVOICE_RUNPOD_ENDPOINT_MODE === "queue") {
    return await runpodQueueVoicesRequest();
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

    // Safety-net: auto-chunk any oversized items so the GPU gets manageable pieces.
    // Set higher than frontend chunking (280 chars) because German compound words
    // make 40-word chunks often exceed 280 chars. 400 avoids double-chunking.
    const MAX_ITEM_CHARS = 400;
    const expandedItems: { id: string; text: string }[] = [];
    // Track which original items were split so we can reassemble later
    const splitTracker = new Map<string, { chunkIds: string[]; originalId: string }>();

    for (const item of req.items) {
      const text = (item.text || "").trim();
      if (!text) {
        expandedItems.push({ id: item.id, text: "" });
        continue;
      }
      if (text.length <= MAX_ITEM_CHARS) {
        expandedItems.push({ id: item.id, text });
        continue;
      }
      // Item is oversized — split it
      const chunks = splitTextIntoChunks(text);
      if (chunks.length <= 1) {
        expandedItems.push({ id: item.id, text });
        continue;
      }
      const chunkIds: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunkId = `${item.id}__autochunk${i}`;
        chunkIds.push(chunkId);
        expandedItems.push({ id: chunkId, text: chunks[i] });
      }
      splitTracker.set(item.id, { chunkIds, originalId: item.id });
      log.info(`[tts/batch] Auto-chunked item ${item.id}: ${text.length} chars → ${chunks.length} chunks`);
    }

    const expandedReq: GenerateSpeechBatchRequest = { ...req, items: expandedItems };

    // Queue mode: send all items as a single RunPod job (real batch)
    if (COSYVOICE_RUNPOD_ENDPOINT_MODE === "queue") {
      try {
        const rawResults = await withRunpodSlot(() => runpodQueueTtsBatchRequest(expandedReq));
        return { results: reassembleSplitResults(rawResults, splitTracker) };
      } catch (error) {
        if (isApiError(error)) throw error;
        const message = getErrorMessage(error);
        log.error(`TTS batch failed: ${message}`);
        throw APIError.unavailable(`CosyVoice batch generation failed: ${message}`);
      }
    }

    // Load balancer mode: sequential per-item requests (fallback)
    const rawResults: TTSBatchResultItem[] = [];

    for (const item of expandedItems) {
      const text = (item.text || "").trim();
      if (!text) {
        rawResults.push({ id: item.id, audio: null, error: "Text is required." });
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
        rawResults.push({ id: item.id, audio: response.audioData, error: null });
      } catch (error) {
        const message = getErrorMessage(error);
        log.error(`TTS batch item failed (${item.id}): ${message}`);
        rawResults.push({ id: item.id, audio: null, error: message });
      }
    }

    return { results: reassembleSplitResults(rawResults, splitTracker) };
  }
);

/** Reassemble auto-chunked results back into single items by concatenating MP3 buffers. */
function reassembleSplitResults(
  rawResults: TTSBatchResultItem[],
  splitTracker: Map<string, { chunkIds: string[]; originalId: string }>
): TTSBatchResultItem[] {
  if (splitTracker.size === 0) return rawResults;

  const resultMap = new Map(rawResults.map((r) => [r.id, r]));
  const consumed = new Set<string>();
  const finalResults: TTSBatchResultItem[] = [];

  // First, reassemble split items
  for (const [originalId, { chunkIds }] of splitTracker) {
    const buffers: Buffer[] = [];
    let failedChunks = 0;

    for (const chunkId of chunkIds) {
      consumed.add(chunkId);
      const r = resultMap.get(chunkId);
      if (!r?.audio || r.error) {
        // Skip failed chunks but continue with the rest — partial audio is
        // better than losing the entire item.
        failedChunks++;
        log.warn(`[tts/batch] Chunk ${chunkId} missing audio, skipping (${r?.error || "no result"})`);
        continue;
      }
      const base64Match = r.audio.match(/^data:[^;]+;base64,(.+)$/);
      if (base64Match) {
        buffers.push(Buffer.from(base64Match[1], "base64"));
      } else {
        buffers.push(Buffer.from(r.audio, "base64"));
      }
    }

    if (buffers.length === 0) {
      finalResults.push({ id: originalId, audio: null, error: "All chunks failed" });
    } else {
      if (failedChunks > 0) {
        log.warn(`[tts/batch] Item ${originalId}: ${failedChunks}/${chunkIds.length} chunks failed, using ${buffers.length} available`);
      }
      const combined = Buffer.concat(buffers);
      finalResults.push({
        id: originalId,
        audio: `data:audio/mpeg;base64,${combined.toString("base64")}`,
        error: null,
      });
    }
  }

  // Then, pass through non-split items
  for (const r of rawResults) {
    if (!consumed.has(r.id)) {
      finalResults.push(r);
    }
  }

  return finalResults;
}

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
