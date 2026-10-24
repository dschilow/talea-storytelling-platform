/**
 * OpenRouter text-to-speech for the audio dramas — Encore-free (the key is passed in).
 *
 * One request is one line in one voice (POST /api/v1/audio/speech, OpenAI-compatible).
 * Gemini answers only with raw 16-bit mono PCM ("audio/pcm;rate=24000;channels=1")
 * and reads `input` verbatim, so the delivery goes into `instructions`.
 * Busy (429), server errors, dropped connections and timeouts are retried with
 * backoff; a refused request (400, 401, 402, 403) is not.
 */

import { GEMINI_SAMPLE_RATE } from "./pcm";

const SPEECH_URL = "https://openrouter.ai/api/v1/audio/speech";
/** Less than 10 ms of audio is no answer. */
const MIN_PCM_BYTES = 480;

export interface SpeechRequest {
  model: string;
  voice: string;
  text: string;
  instructions?: string;
}

export interface SpeechResult {
  pcm: Buffer;
  sampleRate: number;
  generationId?: string;
}

export type SpeechPort = (request: SpeechRequest) => Promise<SpeechResult>;

export class SpeechError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "SpeechError";
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function sampleRateOf(contentType: string | null): number {
  const rate = Number(contentType?.match(/rate=(\d+)/)?.[1]);
  return Number.isFinite(rate) && rate > 0 ? rate : GEMINI_SAMPLE_RATE;
}

function retryAfterMs(header: string | null): number | undefined {
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(30_000, seconds * 1000) : undefined;
}

const retryable = (status: number): boolean => status === 429 || status >= 500;

export function openRouterSpeech(options: {
  apiKey: string;
  timeoutMs?: number;
  maxAttempts?: number;
  /** First backoff; doubles per attempt (with jitter). */
  backoffMs?: number;
  /** For tests. */
  fetchImpl?: typeof fetch;
}): SpeechPort {
  if (!options.apiKey) throw new SpeechError("OpenRouter API key is missing (secret OpenRouterAPIKey / OPENROUTER_API_KEY).");
  const call = options.fetchImpl ?? fetch;
  const attempts = Math.max(1, options.maxAttempts ?? 4);
  const timeoutMs = options.timeoutMs ?? 120_000;
  const backoffMs = options.backoffMs ?? 1500;

  return async (request) => {
    const label = `OpenRouter speech ${request.model} (${request.voice})`;
    let lastError = new SpeechError(`${label} failed`);
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      let wait = backoffMs * 2 ** (attempt - 1) * (0.75 + Math.random() * 0.5);
      try {
        const response = await call(SPEECH_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: request.model,
            input: request.text,
            voice: request.voice,
            response_format: "pcm",
            ...(request.instructions ? { instructions: request.instructions } : {}),
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (response.ok) {
          const pcm = Buffer.from(await response.arrayBuffer());
          if (pcm.length >= MIN_PCM_BYTES) {
            return { pcm, sampleRate: sampleRateOf(response.headers.get("content-type")), generationId: response.headers.get("x-generation-id") ?? undefined };
          }
          lastError = new SpeechError(`${label} returned no audio (${pcm.length} bytes)`, 502);
        } else {
          const body = (await response.text().catch(() => "")).slice(0, 400);
          lastError = new SpeechError(`${label} failed with ${response.status}: ${body || "<empty>"}`, response.status);
          if (!retryable(response.status)) throw lastError;
          wait = retryAfterMs(response.headers.get("retry-after")) ?? wait;
        }
      } catch (error) {
        if (error === lastError) throw error;
        const name = (error as Error)?.name;
        lastError = new SpeechError(name === "TimeoutError" || name === "AbortError" ? `${label} timed out after ${timeoutMs / 1000} s` : `${label} failed: ${(error as Error)?.message || error}`);
      }
      if (attempt < attempts) await sleep(wait);
    }
    throw lastError;
  };
}
