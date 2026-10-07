import log from "encore.dev/log";
import type { AudioFormat, TTSBatchResultItem } from "./tts";

// Thorsten-Voice CosyVoice3: GPU worker (runpod/thorsten-cosyvoice3/), meant to be compared
// with the Kokoro service. THORSTEN_COSYVOICE_URL is either
//   https://api.runpod.ai/v2/<endpoint-id>  RunPod queue endpoint (key = RunPod API key), or
//   http://host:port                        worker in WORKER_MODE=http (key = its API_KEY, optional)
const REQUEST_TIMEOUT_MS = 900_000; // a cold start downloads ~5 GB of weights before the first job
const POLL_INTERVAL_MS = 2_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 2_000;
const MAX_TEXT_CHARS = 6_000;
const MAX_CONCURRENT = Math.max(1, Number(process.env.THORSTEN_COSYVOICE_MAX_CONCURRENT) || 2);

export interface ThorstenCosyVoiceRequest {
  text: string;
  outputFormat?: AudioFormat;
  speed?: number;
}

export interface ThorstenCosyVoiceResponse {
  audioData: string; // data URI
  mimeType: string;
  outputFormat: AudioFormat;
}

interface RunpodJob {
  id?: string;
  status?: string;
  output?: { audio_base64?: string; error?: string };
  error?: unknown;
}

function getBaseUrl(): string {
  return (process.env.THORSTEN_COSYVOICE_URL || "").trim().replace(/\/+$/, "");
}

function isQueueEndpoint(baseUrl: string): boolean {
  return /api\.runpod\.ai\/v2\//i.test(baseUrl);
}

export function isThorstenCosyVoiceConfigured(): boolean {
  return getBaseUrl().length > 0;
}

// ---- Concurrency limiter --------------------------------------------------
let inFlight = 0;
const waitQueue: Array<() => void> = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_CONCURRENT) {
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

class RetryableError extends Error {}

function authHeaders(): Record<string, string> {
  const apiKey = (process.env.THORSTEN_COSYVOICE_API_KEY || "").trim();
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

async function fetchOrRetryable(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (response.ok) return response;
    const body = (await response.text().catch(() => "")).slice(0, 300) || "<empty>";
    const message = `HTTP ${response.status}: ${body}`;
    throw response.status === 429 || response.status >= 500 ? new RetryableError(message) : new Error(message);
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.message.includes("fetch failed"))) {
      throw new RetryableError(error.name === "AbortError" ? "request timed out" : error.message);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function synthesizeViaQueue(baseUrl: string, payload: object): Promise<Buffer> {
  const headers = { "Content-Type": "application/json", ...authHeaders() };
  const started = Date.now();
  const submitted = (await (
    await fetchOrRetryable(`${baseUrl}/run`, { method: "POST", headers, body: JSON.stringify({ input: payload }) }, 30_000)
  ).json()) as RunpodJob;
  if (!submitted.id) throw new Error(`RunPod did not return a job id: ${JSON.stringify(submitted).slice(0, 200)}`);

  let job = submitted;
  for (;;) {
    if (job.status === "COMPLETED") {
      if (!job.output?.audio_base64) throw new Error(job.output?.error || "job completed without audio");
      return Buffer.from(job.output.audio_base64, "base64");
    }
    if (job.status === "FAILED" || job.status === "CANCELLED" || job.status === "TIMED_OUT") {
      throw new Error(`RunPod job ${job.status}: ${String(job.output?.error ?? job.error ?? "").slice(0, 300)}`);
    }
    if (Date.now() - started > REQUEST_TIMEOUT_MS) {
      await fetch(`${baseUrl}/cancel/${submitted.id}`, { method: "POST", headers }).catch(() => undefined);
      throw new Error(`RunPod job ${submitted.id} timed out (last status ${job.status})`);
    }
    await delay(POLL_INTERVAL_MS);
    try {
      job = (await (await fetchOrRetryable(`${baseUrl}/status/${submitted.id}`, { headers }, 30_000)).json()) as RunpodJob;
    } catch (error) {
      if (!(error instanceof RetryableError)) throw error;
      log.warn(`Thorsten CosyVoice status poll failed, retrying: ${error.message}`);
    }
  }
}

async function synthesizeViaHttp(baseUrl: string, payload: object): Promise<Buffer> {
  const response = await fetchOrRetryable(
    `${baseUrl}/tts`,
    { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(payload) },
    REQUEST_TIMEOUT_MS,
  );
  return Buffer.from(await response.arrayBuffer());
}

async function callThorstenCosyVoice(req: ThorstenCosyVoiceRequest): Promise<ThorstenCosyVoiceResponse> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) throw new Error("THORSTEN_COSYVOICE_URL is not configured.");

  const text = (req.text || "").trim();
  if (!text) throw new Error("Text is required for Thorsten CosyVoice.");
  if (text.length > MAX_TEXT_CHARS) {
    throw new Error(`Text is too long for Thorsten CosyVoice (max ${MAX_TEXT_CHARS} characters).`);
  }

  const format: AudioFormat = req.outputFormat === "wav" ? "wav" : "mp3";
  const mimeType = format === "wav" ? "audio/wav" : "audio/mpeg";
  const envSpeed = Number(process.env.THORSTEN_COSYVOICE_SPEED);
  const speed = req.speed ?? (Number.isFinite(envSpeed) && envSpeed > 0 ? envSpeed : undefined);
  const payload = { text, format, ...(speed ? { speed } : {}) };

  for (let attempt = 1; ; attempt++) {
    try {
      const bytes = isQueueEndpoint(baseUrl)
        ? await synthesizeViaQueue(baseUrl, payload)
        : await synthesizeViaHttp(baseUrl, payload);
      if (bytes.length < 100) throw new Error("Thorsten CosyVoice returned an empty audio file.");
      return { audioData: `data:${mimeType};base64,${bytes.toString("base64")}`, mimeType, outputFormat: format };
    } catch (error) {
      if (!(error instanceof RetryableError) || attempt >= MAX_ATTEMPTS) {
        throw error instanceof Error ? error : new Error(String(error));
      }
      const backoff = RETRY_BASE_DELAY_MS * attempt;
      log.warn(`Thorsten CosyVoice attempt ${attempt}/${MAX_ATTEMPTS} failed: ${error.message}. Retrying in ${backoff}ms.`);
      await delay(backoff);
    }
  }
}

// ---- Public API -----------------------------------------------------------
export async function thorstenCosyVoiceGenerateSpeech(req: ThorstenCosyVoiceRequest): Promise<ThorstenCosyVoiceResponse> {
  return withSlot(() => callThorstenCosyVoice(req));
}

export async function thorstenCosyVoiceGenerateSpeechBatch(
  items: Array<{ id: string; text: string }>,
  outputFormat?: AudioFormat,
): Promise<TTSBatchResultItem[]> {
  return Promise.all(
    items.map(async (item) => {
      const text = (item.text || "").trim();
      if (!text) {
        return { id: item.id, audio: null, error: "Text is required." } as TTSBatchResultItem;
      }
      try {
        const response = await thorstenCosyVoiceGenerateSpeech({ text, outputFormat });
        return { id: item.id, audio: response.audioData, error: null } as TTSBatchResultItem;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error(`Thorsten CosyVoice batch item failed (${item.id}): ${message}`);
        return { id: item.id, audio: null, error: message } as TTSBatchResultItem;
      }
    })
  );
}
