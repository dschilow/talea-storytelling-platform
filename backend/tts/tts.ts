import { api, APIError } from "encore.dev/api";
import log from "encore.dev/log";
import { splitTextIntoChunks } from "../helpers/ttsChunking";

type RunpodEndpointMode = "load_balancer" | "queue";
type VoiceListMode = "static" | "runpod";

const QWEN_RUNPOD_API_URL = readStringEnv("QWEN_RUNPOD_API_URL", "COSYVOICE_RUNPOD_API_URL");
const QWEN_RUNPOD_API_KEY = readStringEnv("QWEN_RUNPOD_API_KEY", "COSYVOICE_RUNPOD_API_KEY");
const QWEN_RUNPOD_WORKER_API_KEY = readStringEnv(
  "QWEN_RUNPOD_WORKER_API_KEY",
  "COSYVOICE_RUNPOD_WORKER_API_KEY"
);
const QWEN_RUNPOD_TTS_PATH = readStringEnv("QWEN_RUNPOD_TTS_PATH", "COSYVOICE_RUNPOD_TTS_PATH") || "/v1/tts";
const QWEN_RUNPOD_ENDPOINT_MODE = resolveRunpodEndpointMode(
  readStringEnv("QWEN_RUNPOD_ENDPOINT_MODE", "COSYVOICE_RUNPOD_ENDPOINT_MODE"),
  QWEN_RUNPOD_API_URL
);
const QWEN_RUNPOD_TIMEOUT_MS = readPositiveIntEnv(
  "QWEN_RUNPOD_TIMEOUT_MS",
  "COSYVOICE_RUNPOD_TIMEOUT_MS",
  300_000
); // 5min per single item
const QWEN_RUNPOD_MAX_RETRIES = readPositiveIntEnv(
  "QWEN_RUNPOD_MAX_RETRIES",
  "COSYVOICE_RUNPOD_MAX_RETRIES",
  3
);
const QWEN_RUNPOD_RETRY_BASE_DELAY_MS = readPositiveIntEnv(
  "QWEN_RUNPOD_RETRY_BASE_DELAY_MS",
  "COSYVOICE_RUNPOD_RETRY_BASE_DELAY_MS",
  1500
);
const QWEN_RUNPOD_MAX_CONCURRENT_CALLS = readPositiveIntEnv(
  "QWEN_RUNPOD_MAX_CONCURRENT_CALLS",
  "COSYVOICE_RUNPOD_MAX_CONCURRENT_CALLS",
  2
);
const QWEN_RUNPOD_WARMUP_ENABLED = readBooleanEnv(
  "QWEN_RUNPOD_WARMUP_ENABLED",
  "COSYVOICE_RUNPOD_WARMUP_ENABLED",
  true
);
const QWEN_RUNPOD_WARMUP_TIMEOUT_MS = readPositiveIntEnv(
  "QWEN_RUNPOD_WARMUP_TIMEOUT_MS",
  "COSYVOICE_RUNPOD_WARMUP_TIMEOUT_MS",
  240_000
);
const QWEN_RUNPOD_WARMUP_POLL_MS = readPositiveIntEnv(
  "QWEN_RUNPOD_WARMUP_POLL_MS",
  "COSYVOICE_RUNPOD_WARMUP_POLL_MS",
  2_500
);
const QWEN_RUNPOD_WARMUP_PING_TIMEOUT_MS = readPositiveIntEnv(
  "QWEN_RUNPOD_WARMUP_PING_TIMEOUT_MS",
  "COSYVOICE_RUNPOD_WARMUP_PING_TIMEOUT_MS",
  15_000
);
const QWEN_RUNPOD_WARMUP_READY_TTL_MS = readPositiveIntEnv(
  "QWEN_RUNPOD_WARMUP_READY_TTL_MS",
  "COSYVOICE_RUNPOD_WARMUP_READY_TTL_MS",
  5_000
);
const QWEN_REFERENCE_FETCH_TIMEOUT_MS = readPositiveIntEnv(
  "QWEN_REFERENCE_FETCH_TIMEOUT_MS",
  "COSYVOICE_REFERENCE_FETCH_TIMEOUT_MS",
  30_000
);
const QWEN_RUNPOD_QUEUE_POLL_MS = readPositiveIntEnv(
  "QWEN_RUNPOD_QUEUE_POLL_MS",
  "COSYVOICE_RUNPOD_QUEUE_POLL_MS",
  2_000
);
const QWEN_DEFAULT_PROMPT_TEXT = readStringEnv(
  "QWEN_DEFAULT_PROMPT_TEXT",
  "COSYVOICE_DEFAULT_PROMPT_TEXT"
);
const QWEN_USE_DEFAULT_PROMPT_TEXT = readBooleanEnv(
  "QWEN_USE_DEFAULT_PROMPT_TEXT",
  "COSYVOICE_USE_DEFAULT_PROMPT_TEXT",
  false
);
const QWEN_DEFAULT_REFERENCE_AUDIO_URL = readStringEnv(
  "QWEN_DEFAULT_REFERENCE_AUDIO_URL",
  "COSYVOICE_DEFAULT_REFERENCE_AUDIO_URL"
);
const QWEN_PREFER_WORKER_DEFAULT_REFERENCE = readBooleanEnv(
  "QWEN_PREFER_WORKER_DEFAULT_REFERENCE",
  "COSYVOICE_PREFER_WORKER_DEFAULT_REFERENCE",
  true
);
const QWEN_REFERENCE_AUDIO_CACHE_TTL_MS = readPositiveIntEnv(
  "QWEN_REFERENCE_AUDIO_CACHE_TTL_MS",
  "COSYVOICE_REFERENCE_AUDIO_CACHE_TTL_MS",
  3_600_000
);
const QWEN_SEND_REFERENCE_AUDIO = readBooleanEnv(
  "QWEN_SEND_REFERENCE_AUDIO",
  "COSYVOICE_SEND_REFERENCE_AUDIO",
  true
);
const QWEN_DEFAULT_EMOTION = readStringEnv("QWEN_DEFAULT_EMOTION", "COSYVOICE_DEFAULT_EMOTION");
const QWEN_DEFAULT_OUTPUT_FORMAT = normalizeOutputFormat(
  readStringEnv("QWEN_DEFAULT_OUTPUT_FORMAT", "COSYVOICE_DEFAULT_OUTPUT_FORMAT") || "mp3"
);
const DEFAULT_QWEN_STATIC_SPEAKERS = [
  "aiden",
  "dylan",
  "eric",
  "ono_anna",
  "ryan",
  "serena",
  "sohee",
  "uncle_fu",
  "vivian",
];
const QWEN_VOICE_LIST_MODE = resolveVoiceListMode(
  readStringEnv("QWEN_VOICE_LIST_MODE", "COSYVOICE_VOICE_LIST_MODE")
);
const QWEN_STATIC_SPEAKERS = parseSpeakerList(
  readStringEnv("QWEN_STATIC_SPEAKERS", "COSYVOICE_STATIC_SPEAKERS"),
  DEFAULT_QWEN_STATIC_SPEAKERS
);
const QWEN_STATIC_DEFAULT_SPEAKER =
  readStringEnv("QWEN_STATIC_DEFAULT_SPEAKER", "COSYVOICE_STATIC_DEFAULT_SPEAKER") || "vivian";

// Internal aliases keep the rest of the module stable while runtime config is Qwen-only.
const COSYVOICE_RUNPOD_API_URL = QWEN_RUNPOD_API_URL;
const COSYVOICE_RUNPOD_API_KEY = QWEN_RUNPOD_API_KEY;
const COSYVOICE_RUNPOD_WORKER_API_KEY = QWEN_RUNPOD_WORKER_API_KEY;
const COSYVOICE_RUNPOD_TTS_PATH = QWEN_RUNPOD_TTS_PATH;
const COSYVOICE_RUNPOD_ENDPOINT_MODE = QWEN_RUNPOD_ENDPOINT_MODE;
const COSYVOICE_RUNPOD_TIMEOUT_MS = QWEN_RUNPOD_TIMEOUT_MS;
const COSYVOICE_RUNPOD_MAX_RETRIES = QWEN_RUNPOD_MAX_RETRIES;
const COSYVOICE_RUNPOD_RETRY_BASE_DELAY_MS = QWEN_RUNPOD_RETRY_BASE_DELAY_MS;
const COSYVOICE_RUNPOD_MAX_CONCURRENT_CALLS = QWEN_RUNPOD_MAX_CONCURRENT_CALLS;
const COSYVOICE_RUNPOD_WARMUP_ENABLED = QWEN_RUNPOD_WARMUP_ENABLED;
const COSYVOICE_RUNPOD_WARMUP_TIMEOUT_MS = QWEN_RUNPOD_WARMUP_TIMEOUT_MS;
const COSYVOICE_RUNPOD_WARMUP_POLL_MS = QWEN_RUNPOD_WARMUP_POLL_MS;
const COSYVOICE_RUNPOD_WARMUP_PING_TIMEOUT_MS = QWEN_RUNPOD_WARMUP_PING_TIMEOUT_MS;
const COSYVOICE_RUNPOD_WARMUP_READY_TTL_MS = QWEN_RUNPOD_WARMUP_READY_TTL_MS;
const COSYVOICE_REFERENCE_FETCH_TIMEOUT_MS = QWEN_REFERENCE_FETCH_TIMEOUT_MS;
const COSYVOICE_RUNPOD_QUEUE_POLL_MS = QWEN_RUNPOD_QUEUE_POLL_MS;
const COSYVOICE_DEFAULT_PROMPT_TEXT = QWEN_DEFAULT_PROMPT_TEXT;
const COSYVOICE_USE_DEFAULT_PROMPT_TEXT = QWEN_USE_DEFAULT_PROMPT_TEXT;
const COSYVOICE_DEFAULT_REFERENCE_AUDIO_URL = QWEN_DEFAULT_REFERENCE_AUDIO_URL;
const COSYVOICE_PREFER_WORKER_DEFAULT_REFERENCE = QWEN_PREFER_WORKER_DEFAULT_REFERENCE;
const COSYVOICE_REFERENCE_AUDIO_CACHE_TTL_MS = QWEN_REFERENCE_AUDIO_CACHE_TTL_MS;
const COSYVOICE_SEND_REFERENCE_AUDIO = QWEN_SEND_REFERENCE_AUDIO;
const COSYVOICE_DEFAULT_EMOTION = QWEN_DEFAULT_EMOTION;
const COSYVOICE_DEFAULT_OUTPUT_FORMAT = QWEN_DEFAULT_OUTPUT_FORMAT;
const COSYVOICE_VOICE_LIST_MODE = QWEN_VOICE_LIST_MODE;
const COSYVOICE_STATIC_SPEAKERS = QWEN_STATIC_SPEAKERS;
const COSYVOICE_STATIC_DEFAULT_SPEAKER = QWEN_STATIC_DEFAULT_SPEAKER;

export type TTSProvider = "qwen";
export type AudioFormat = "wav" | "mp3";

export interface TTSResponse {
  audioData: string;
  providerUsed: "qwen";
  mimeType: string;
  outputFormat: AudioFormat;
}

export interface TTSBatchItem {
  id: string;
  text: string;
  speaker?: string;
}

export interface TTSBatchResultItem {
  id: string;
  audio: string | null;
  error: string | null;
}

export interface TTSBatchResponse {
  results: TTSBatchResultItem[];
}

export interface QwenVoicesResponse {
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

interface GenerateQwenDialogueRequest {
  script: string;
  speakerVoiceMap: Record<string, string>;
  instructText?: string;
  outputFormat?: AudioFormat;
  languageId?: string;
}

interface GenerateQwenDialogueResponse {
  variants: Array<{
    id: string;
    audioData: string;
    mimeType: string;
  }>;
  turns: number;
  speakers: string[];
}

type DialogueTurn = {
  speaker: string;
  text: string;
};

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

function readStringEnv(primaryKey: string, legacyKey?: string): string {
  const primary = (process.env[primaryKey] || "").trim();
  if (primary) return primary;
  return legacyKey ? (process.env[legacyKey] || "").trim() : "";
}

function readPositiveIntEnv(primaryKey: string, legacyKey: string | undefined, fallback: number): number {
  const raw = process.env[primaryKey] ?? (legacyKey ? process.env[legacyKey] : undefined);
  return parsePositiveInt(raw, fallback);
}

function readBooleanEnv(primaryKey: string, legacyKey: string | undefined, fallback: boolean): boolean {
  const raw = process.env[primaryKey] ?? (legacyKey ? process.env[legacyKey] : undefined);
  return parseBoolean(raw, fallback);
}

function parseSpeakerList(value: string | undefined, fallback: string[]): string[] {
  const parsed = String(value || "")
    .split(/[\n,;]/g)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return parsed.length > 0 ? [...new Set(parsed)] : fallback;
}

function resolveVoiceListMode(value: string | undefined): VoiceListMode {
  const normalized = (value || "").trim().toLowerCase();
  return normalized === "runpod" ? "runpod" : "static";
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

function normalizeDialogueSpeaker(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseDialogueScript(script: string): DialogueTurn[] {
  const normalizedScript = script.replace(/\r\n/g, "\n").trim();
  if (!normalizedScript) {
    throw APIError.invalidArgument("Script is required.");
  }

  const lines = normalizedScript.split("\n");
  const turns: DialogueTurn[] = [];

  let currentSpeaker = "";
  let currentLines: string[] = [];

  const pushCurrentTurn = () => {
    if (!currentSpeaker) return;
    const text = currentLines.join("\n").trim();
    if (text) {
      turns.push({ speaker: currentSpeaker, text });
    }
    currentSpeaker = "";
    currentLines = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd();
    const speakerMatch = line.match(/^\s*([^:\n]{1,80}):\s*(.*)$/);

    if (speakerMatch) {
      pushCurrentTurn();
      currentSpeaker = normalizeDialogueSpeaker(speakerMatch[1]);
      currentLines = [speakerMatch[2].trim()];
      return;
    }

    if (!line.trim()) {
      if (currentLines.length > 0) currentLines.push("");
      return;
    }

    if (!currentSpeaker) {
      throw APIError.invalidArgument(
        `Invalid script format on line ${index + 1}. Each dialogue block must start with "SPEAKER: text".`
      );
    }

    currentLines.push(line.trim());
  });

  pushCurrentTurn();

  if (turns.length === 0) {
    throw APIError.invalidArgument(
      "No dialogue turns found. Use the format \"SPEAKER: text\" for each block."
    );
  }

  return turns;
}

function resolveMappedSpeaker(speaker: string, speakerVoiceMap: Record<string, string>): string | undefined {
  const direct = speakerVoiceMap[speaker]?.trim();
  if (direct) return direct;

  const normalized = speaker.toLowerCase();
  for (const [candidateSpeaker, candidateVoiceId] of Object.entries(speakerVoiceMap)) {
    if (candidateSpeaker.trim().toLowerCase() !== normalized) continue;
    const mapped = candidateVoiceId?.trim();
    if (mapped) return mapped;
  }

  return undefined;
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
  return "audio/mpeg";
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

  let filename = "reference.mp3";
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
      filename: "reference-from-data-url.mp3",
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
              `Qwen RunPod worker ready after ${Date.now() - startedAt}ms (reason=${reason}, ping_attempts=${pingAttempts})`
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
              "RunPod warmup ping route not found (404). Check QWEN_RUNPOD_API_URL and worker routes."
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
    normalized.includes("rate limit") ||
    normalized.includes("throttled") ||
    normalized.includes("in_queue") ||
    normalized.includes("no workers available")
  );
}

function buildRunpodWorkerAvailabilityHint(context: string): string {
  return (
    `${context} Check RunPod worker availability: ` +
    "Qwen requires a queue endpoint (`https://api.runpod.ai/v2/<endpoint-id>`), at least one healthy cached worker, " +
    "and a registry that is not blocked by anonymous Docker pull limits. " +
    "If workers are stuck in `Throttled`, `pending` or `IN_QUEUE`, keep `minWorkers >= 1`, reduce `QWEN_RUNPOD_MAX_CONCURRENT_CALLS=1`, " +
    "and move `dschilow/qwen3-tts-runpod` to an authenticated/private registry or configure authenticated pulls."
  );
}

function buildRunpodQueueTimeoutHint(lastStatus: string): string {
  if (lastStatus === "IN_QUEUE" || lastStatus === "QUEUED") {
    return buildRunpodWorkerAvailabilityHint(
      "The job never left the queue."
    );
  }
  if (lastStatus === "IN_PROGRESS") {
    return (
      "The job started but never finished. Check worker GPU health, model startup logs, and whether the container crashed during synthesis."
    );
  }
  return buildRunpodWorkerAvailabilityHint("The queue endpoint did not finish the job.");
}

function ensureQwenRunpodConfigured(): void {
  if (!QWEN_RUNPOD_API_URL) {
    throw APIError.failedPrecondition(
      "QWEN_RUNPOD_API_URL is not configured. Set it to your RunPod queue endpoint, for example `https://api.runpod.ai/v2/<endpoint-id>`."
    );
  }

  if (QWEN_RUNPOD_ENDPOINT_MODE !== "queue") {
    throw APIError.failedPrecondition(
      "Qwen TTS only supports RunPod queue endpoints. Set QWEN_RUNPOD_API_URL to `https://api.runpod.ai/v2/<endpoint-id>` or QWEN_RUNPOD_ENDPOINT_MODE=queue."
    );
  }
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
      providerUsed: "qwen",
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
    providerUsed: "qwen",
    mimeType,
    outputFormat: declaredFormat,
  };
}

async function submitRunpodQueueJob(input: Record<string, unknown>): Promise<string> {
  ensureQwenRunpodConfigured();

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
        "Check QWEN_RUNPOD_API_KEY (RunPod account API key with endpoint access). " +
        "Queue endpoint auth is validated at RunPod edge.";
      throw new Error(`RunPod queue submit failed (401): ${body}${detailSuffix}. ${authHint}`);
    }
    const normalizedBody = body.toLowerCase();
    const throttleHint =
      normalizedBody.includes("toomanyrequests") ||
      normalizedBody.includes("rate limit") ||
      normalizedBody.includes("throttled") ||
      normalizedBody.includes("no workers available")
        ? ` ${buildRunpodWorkerAvailabilityHint("RunPod could not start or reach a worker.")}`
        : "";
    throw new Error(`RunPod queue submit failed (${response.status}): ${body}${detailSuffix}.${throttleHint}`);
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
  let lastStatus = "UNKNOWN";

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
    lastStatus = status || lastStatus;
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
    `RunPod queue job timed out after ${Math.round(COSYVOICE_RUNPOD_TIMEOUT_MS / 1000)}s (job_id=${jobId}, last_status=${lastStatus}). ${buildRunpodQueueTimeoutHint(lastStatus)}`
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
    ""
  ).trim();
  const emotion = (req.emotion || COSYVOICE_DEFAULT_EMOTION || "").trim();
  const instructText = (req.instructText || "").trim();
  const speaker = (req.speaker || "").trim();
  const includeBackendDefaultReference =
    !COSYVOICE_PREFER_WORKER_DEFAULT_REFERENCE || hasExplicitReference(req);
  const referenceAudio = COSYVOICE_SEND_REFERENCE_AUDIO
    ? await resolveReferenceAudio(req, includeBackendDefaultReference)
    : null;

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
  const referenceAudio = COSYVOICE_SEND_REFERENCE_AUDIO
    ? await resolveReferenceAudio(refReq, includeBackendDefaultReference)
    : null;

  const texts = items
    .filter((item) => (item.text || "").trim())
    .map((item) => {
      const normalizedSpeaker = String(item.speaker || "").trim();
      return normalizedSpeaker
        ? { id: item.id, text: (item.text || "").trim(), speaker: normalizedSpeaker }
        : { id: item.id, text: (item.text || "").trim() };
    });

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

async function runpodQueueVoicesRequest(): Promise<QwenVoicesResponse> {
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

  ensureQwenRunpodConfigured();

  const text = (req.text || "").trim();
  if (!text) {
    throw APIError.invalidArgument("Text is required.");
  }

  if (req.provider && req.provider !== "qwen") {
    log.warn(`Legacy TTS provider "${req.provider}" requested. Using Qwen RunPod endpoint instead.`);
  }

  const outputFormat = normalizeOutputFormat(req.outputFormat || COSYVOICE_DEFAULT_OUTPUT_FORMAT);
  const promptText = (
    req.promptText ||
    (COSYVOICE_USE_DEFAULT_PROMPT_TEXT ? COSYVOICE_DEFAULT_PROMPT_TEXT : "") ||
    ""
  ).trim();
  const emotion = (req.emotion || COSYVOICE_DEFAULT_EMOTION || "").trim();
  const instructText = (req.instructText || "").trim();
  const speaker = (req.speaker || "").trim();

  const includeBackendDefaultReference =
    !COSYVOICE_PREFER_WORKER_DEFAULT_REFERENCE || hasExplicitReference(req);
  const referenceAudio = COSYVOICE_SEND_REFERENCE_AUDIO
    ? await resolveReferenceAudio(req, includeBackendDefaultReference)
    : null;

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
      type: referenceAudio.contentType || "audio/mpeg",
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
              `Qwen RunPod returned ${response.status} (attempt ${attempt}/${COSYVOICE_RUNPOD_MAX_RETRIES}). Retrying in ${backoffMs}ms.`
            );
            await delay(backoffMs);
          } else {
            log.info(
              `Qwen RunPod warmup complete after ${response.status}; retrying request immediately (attempt ${attempt}/${COSYVOICE_RUNPOD_MAX_RETRIES}).`
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
            "Check QWEN_RUNPOD_API_KEY (must be a RunPod account API key with endpoint access). " +
            "If your worker enforces an internal API key, set QWEN_RUNPOD_WORKER_API_KEY to the same worker secret.";
          const keyState = ` bearer_set=${Boolean(COSYVOICE_RUNPOD_API_KEY)} worker_key_set=${Boolean(
            COSYVOICE_RUNPOD_WORKER_API_KEY
          )}`;
          throw new Error(
            `RunPod Qwen API failed (401): ${errText}${detailSuffix}. ${authHint}.${keyState}`
          );
        }

        if (isLikelyInfraBusyStatus(response.status, errTextRaw)) {
          throw new Error(
            "RunPod Qwen API failed (400 <empty>). This often means worker cold-start/busy on Load Balancer endpoints. " +
            "Use a RunPod queue endpoint, reduce parallel calls (`QWEN_RUNPOD_MAX_CONCURRENT_CALLS=1`), and keep at least one warm worker."
          );
        }
        if (isLikelyGatewayHostError(response.status, errTextRaw)) {
          throw new Error(
            `RunPod Qwen API failed (${response.status} gateway). ` +
            "Upstream worker was unavailable/crashed during request. " +
            "On slower GPUs this happens more often with LB endpoints. " +
            "Use Queue endpoint, or keep at least one active worker while generating, or increase Max workers."
          );
        }

        if (response.status === 400) {
          throw APIError.invalidArgument(`Qwen request rejected: ${errText}${detailSuffix}`);
        }
        if (response.status === 401) {
          throw APIError.unauthenticated(`Qwen auth failed: ${errText}${detailSuffix}`);
        }
        if (response.status === 403) {
          throw APIError.permissionDenied(`Qwen access denied: ${errText}${detailSuffix}`);
        }
        if (response.status === 404) {
          throw APIError.notFound(`Qwen endpoint not found: ${errText}${detailSuffix}`);
        }

        throw new Error(`RunPod Qwen API failed (${response.status}): ${errText}${detailSuffix}`);
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
            providerUsed: "qwen",
            mimeType,
            outputFormat,
          };
        }

        const base64 = payload?.audioBase64?.trim();
        if (!base64) {
          throw new Error("RunPod Qwen API returned JSON without audio data.");
        }

        const mimeType = payload?.mimeType?.trim() || resolveMimeType(null, outputFormat);
        markRunpodHealthyNow();
        return {
          audioData: dataUriFromBuffer(Buffer.from(base64, "base64"), mimeType),
          providerUsed: "qwen",
          mimeType,
          outputFormat,
        };
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      if (!audioBuffer.length) {
        throw new Error("RunPod Qwen API returned an empty audio stream.");
      }

      markRunpodHealthyNow();
      const mimeType = resolveMimeType(contentType, outputFormat);
      return {
        audioData: dataUriFromBuffer(audioBuffer, mimeType),
        providerUsed: "qwen",
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
          `Qwen RunPod network error (attempt ${attempt}/${COSYVOICE_RUNPOD_MAX_RETRIES}): ${message}. Retrying in ${backoffMs}ms.`
        );
        await delay(backoffMs);
        continue;
      }

      if (isAbortError(error)) {
        throw APIError.unavailable(
          `Qwen RunPod request timed out after ${Math.round(
            COSYVOICE_RUNPOD_TIMEOUT_MS / 1000
          )}s. Increase QWEN_RUNPOD_TIMEOUT_MS if needed.`
        );
      }

      throw error;
    }
  }

  throw new Error(lastError?.message || "RunPod Qwen request failed after all retries.");
}

async function runpodListVoicesRequest(): Promise<QwenVoicesResponse> {
  ensureQwenRunpodConfigured();

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
      throw new Error(`RunPod Qwen health request failed (${response.status}): ${errText}`);
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

  throw new Error("RunPod Qwen health request failed after warmup attempts.");
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
      throw APIError.unavailable(`Qwen generation failed: ${message}`);
    }
  }
);

async function generateSpeechBatchInternal(req: GenerateSpeechBatchRequest): Promise<TTSBatchResponse> {
  if (!req.items || req.items.length === 0) {
    return { results: [] };
  }

  // Safety-net: auto-chunk any oversized items so the GPU gets manageable pieces.
  // Set well above frontend chunking (600 chars) to avoid double-chunking.
  // Auto-chunking causes silent sentence drops when sub-chunks fail, so we
  // want it to trigger only as a last resort for truly oversized items.
  const MAX_ITEM_CHARS = 900;
  const expandedItems: TTSBatchItem[] = [];
  // Track which original items were split so we can reassemble later
  const splitTracker = new Map<string, { chunkIds: string[]; originalId: string }>();

  for (const item of req.items) {
    const text = (item.text || "").trim();
    const itemSpeaker = String(item.speaker || "").trim();
    if (!text) {
      expandedItems.push({ id: item.id, text: "", ...(itemSpeaker ? { speaker: itemSpeaker } : {}) });
      continue;
    }
    if (text.length <= MAX_ITEM_CHARS) {
      expandedItems.push({ id: item.id, text, ...(itemSpeaker ? { speaker: itemSpeaker } : {}) });
      continue;
    }
    // Item is oversized — split it
    const chunks = splitTextIntoChunks(text);
    if (chunks.length <= 1) {
      expandedItems.push({ id: item.id, text, ...(itemSpeaker ? { speaker: itemSpeaker } : {}) });
      continue;
    }
    const chunkIds: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkId = `${item.id}__autochunk${i}`;
      chunkIds.push(chunkId);
      expandedItems.push({
        id: chunkId,
        text: chunks[i],
        ...(itemSpeaker ? { speaker: itemSpeaker } : {}),
      });
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
      throw APIError.unavailable(`Qwen batch generation failed: ${message}`);
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
          speaker: String(item.speaker || req.speaker || "").trim(),
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

export const generateSpeechBatch = api<GenerateSpeechBatchRequest, TTSBatchResponse>(
  { expose: true, method: "POST", path: "/tts/batch" },
  async (req) => {
    return await generateSpeechBatchInternal(req);
  }
);

/** Reassemble auto-chunked results back into single items by concatenating audio buffers.
 *  For WAV: strips the 44-byte header from all but the first chunk, then rebuilds a valid WAV.
 *  For MP3: simple concatenation (MP3 frames are self-describing).
 */
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
    let detectedMimeType = "audio/mpeg";

    for (const chunkId of chunkIds) {
      consumed.add(chunkId);
      const r = resultMap.get(chunkId);
      if (!r?.audio || r.error) {
        failedChunks++;
        log.warn(`[tts/batch] Chunk ${chunkId} missing audio, skipping (${r?.error || "no result"})`);
        continue;
      }
      const base64Match = r.audio.match(/^data:([^;]+);base64,(.+)$/);
      if (base64Match) {
        if (base64Match[1]) detectedMimeType = base64Match[1];
        buffers.push(Buffer.from(base64Match[2], "base64"));
      } else {
        buffers.push(Buffer.from(r.audio, "base64"));
      }
    }

    if (buffers.length === 0) {
      finalResults.push({ id: originalId, audio: null, error: "All chunks failed" });
    } else if (failedChunks > 0) {
      // Treat partial failure as full failure so the frontend can retry via fallbackToSingle.
      // Returning partial audio here silently drops sentences from the missing chunks.
      log.warn(`[tts/batch] Item ${originalId}: ${failedChunks}/${chunkIds.length} chunks failed — reporting error so frontend retries`);
      finalResults.push({
        id: originalId,
        audio: null,
        error: `${failedChunks}/${chunkIds.length} auto-chunks failed`,
      });
    } else {
      const combined = concatenateAudioBuffers(buffers, detectedMimeType);
      finalResults.push({
        id: originalId,
        audio: `data:${detectedMimeType};base64,${combined.toString("base64")}`,
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

/** Concatenate audio buffers, handling WAV header stripping when needed. */
function concatenateAudioBuffers(buffers: Buffer[], mimeType: string): Buffer {
  if (buffers.length <= 1) return buffers[0] || Buffer.alloc(0);

  const isWav = mimeType.includes("wav") || mimeType.includes("wave");
  if (!isWav) {
    // MP3/OGG: simple concat works
    return Buffer.concat(buffers);
  }

  // WAV: each buffer has its own 44-byte RIFF header. We need to strip
  // headers from chunks 2..N and rebuild a single valid WAV header.
  const WAV_HEADER_SIZE = 44;
  const pcmChunks: Buffer[] = [];

  for (let i = 0; i < buffers.length; i++) {
    const buf = buffers[i];
    if (i === 0) {
      // Keep the first buffer entirely (header + PCM data)
      pcmChunks.push(buf);
    } else if (buf.length > WAV_HEADER_SIZE && isWavHeader(buf)) {
      // Strip the WAV header, keep only PCM data
      pcmChunks.push(buf.subarray(WAV_HEADER_SIZE));
    } else {
      // Not a WAV or too short — include as-is (fallback)
      pcmChunks.push(buf);
    }
  }

  const combined = Buffer.concat(pcmChunks);

  // Update the RIFF header with correct total size
  if (combined.length >= WAV_HEADER_SIZE && isWavHeader(combined)) {
    // RIFF chunk size = total file size - 8
    combined.writeUInt32LE(combined.length - 8, 4);
    // data sub-chunk size = total file size - 44
    combined.writeUInt32LE(combined.length - WAV_HEADER_SIZE, 40);
  }

  return combined;
}

/** Check if a buffer starts with a WAV RIFF header. */
function isWavHeader(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  // "RIFF" at offset 0, "WAVE" at offset 8
  return (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45
  );
}

function decodeAudioResult(audio: string, fallbackMimeType: string): { buffer: Buffer; mimeType: string } {
  const base64Match = audio.match(/^data:([^;]+);base64,(.+)$/);
  if (base64Match) {
    const mimeType = String(base64Match[1] || "").trim() || fallbackMimeType;
    return {
      buffer: Buffer.from(base64Match[2], "base64"),
      mimeType,
    };
  }
  return {
    buffer: Buffer.from(audio, "base64"),
    mimeType: fallbackMimeType,
  };
}

export const generateQwenDialogue = api<GenerateQwenDialogueRequest, GenerateQwenDialogueResponse>(
  { expose: true, method: "POST", path: "/tts/qwen/dialogue" },
  async (req) => {
    if (!req.speakerVoiceMap || Object.keys(req.speakerVoiceMap).length === 0) {
      throw APIError.invalidArgument("speakerVoiceMap is required.");
    }

    const turns = parseDialogueScript(req.script);
    const missingSpeakers = new Set<string>();
    const resolvedTurns = turns.map((turn, index) => {
      const mappedSpeaker = resolveMappedSpeaker(turn.speaker, req.speakerVoiceMap);
      if (!mappedSpeaker) {
        missingSpeakers.add(turn.speaker);
      }
      return {
        turn,
        id: `turn-${index + 1}`,
        mappedSpeaker: mappedSpeaker || "",
      };
    });

    if (missingSpeakers.size > 0) {
      const speakers = [...missingSpeakers].join(", ");
      throw APIError.invalidArgument(`Missing Qwen voice mapping for speaker(s): ${speakers}`);
    }

    // Use per-turn synthesis for dialogue to guarantee correct per-speaker voice
    // mapping even on older worker images that may collapse batch speaker routing.
    const instructText = (req.instructText || "").trim() || undefined;
    const languageId = (req.languageId || "").trim() || undefined;
    const fallbackMimeType = "audio/wav";
    const buffers: Buffer[] = [];
    let detectedMimeType = fallbackMimeType;

    for (const item of resolvedTurns) {
      const response = await withRunpodSlot(() =>
        runpodTtsRequest({
          text: item.turn.text,
          speaker: item.mappedSpeaker,
          instructText,
          outputFormat: "wav",
          languageId,
        })
      );

      if (!response.audioData) {
        throw APIError.unavailable(`Qwen dialogue item failed (${item.id}): missing audio`);
      }

      const decoded = decodeAudioResult(response.audioData, response.mimeType || fallbackMimeType);
      buffers.push(decoded.buffer);
      detectedMimeType = decoded.mimeType || detectedMimeType;
    }

    if (buffers.length === 0) {
      throw APIError.unavailable("Qwen dialogue generation returned no audio.");
    }

    const combined = concatenateAudioBuffers(buffers, detectedMimeType);
    return {
      variants: [
        {
          id: "variant-1",
          audioData: `data:${detectedMimeType};base64,${combined.toString("base64")}`,
          mimeType: detectedMimeType,
        },
      ],
      turns: turns.length,
      speakers: [...new Set(turns.map((turn) => turn.speaker))],
    };
  }
);

async function listRunpodVoicesOrThrow(providerLabel: string): Promise<QwenVoicesResponse> {
  if (COSYVOICE_VOICE_LIST_MODE === "static") {
    const availableSpeakers = [...COSYVOICE_STATIC_SPEAKERS];
    const defaultSpeaker = availableSpeakers.includes(COSYVOICE_STATIC_DEFAULT_SPEAKER)
      ? COSYVOICE_STATIC_DEFAULT_SPEAKER
      : (availableSpeakers[0] || "");

    return {
      availableSpeakers,
      defaultSpeaker,
      defaultReferenceAvailable: Boolean(COSYVOICE_DEFAULT_REFERENCE_AUDIO_URL),
      modelLoaded: false,
    };
  }

  try {
    return await runpodListVoicesRequest();
  } catch (error) {
    if (isApiError(error)) {
      throw error;
    }
    const message = getErrorMessage(error);
    log.error(`TTS voice list failed (${providerLabel}): ${message}`);
    throw APIError.unavailable(`${providerLabel} voice list failed: ${message}`);
  }
}

export const listQwenVoices = api<void, QwenVoicesResponse>(
  { expose: true, method: "GET", path: "/tts/qwen/voices" },
  async () => {
    return await listRunpodVoicesOrThrow("Qwen");
  }
);

// Temporary alias until the generated frontend client is refreshed.
export const listCosyVoiceVoices = api<void, QwenVoicesResponse>(
  { expose: true, method: "GET", path: "/tts/cosyvoice/voices" },
  async () => {
    return await listRunpodVoicesOrThrow("Qwen");
  }
);
