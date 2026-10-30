/**
 * OpenRouter text-to-speech for the audio dramas — Encore-free (the key is passed in).
 *
 * One request is one line in one voice (POST /api/v1/audio/speech, OpenAI-compatible).
 * Gemini answers only with raw 16-bit mono PCM ("audio/pcm;rate=24000;channels=1")
 * and reads `input` verbatim, so the delivery goes into `instructions`.
 * Busy requests, temporary in-flight budget exhaustion, server errors, dropped
 * connections and timeouts are retried; genuine billing failures are not.
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

/** OpenRouter can report a provider refusal as 400, 403 or 422. */
function isModerationRefusal(status: number | undefined, body: string): boolean {
  return (status === 400 || status === 403 || status === 422) &&
    /content moderation|content[_ -]filter|\bSAFETY\b|\bPROHIBITED_CONTENT\b/i.test(body);
}

export class SpeechError extends Error {
  readonly moderation: boolean;

  constructor(message: string, readonly status?: number, moderation?: boolean) {
    super(message);
    this.name = "SpeechError";
    this.moderation = moderation ?? isModerationRefusal(status, message);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function sampleRateOf(contentType: string | null): number {
  const rate = Number(contentType?.match(/rate=(\d+)/)?.[1]);
  return Number.isFinite(rate) && rate > 0 ? rate : GEMINI_SAMPLE_RATE;
}

function retryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
  return Number.isFinite(delay) && delay >= 0 ? Math.min(60_000, delay) : undefined;
}

const retryable = (status: number): boolean => status === 429 || status >= 500;

/** Shared across productions in this process, including separately created clients. */
export function createSpeechGate() {
  let inFlight = 0;
  let limit = 6;
  let pausedUntil = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const queue: Array<() => void> = [];
  const pump = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (!queue.length) return;
    const delay = pausedUntil - Date.now();
    if (delay > 0) {
      timer = setTimeout(pump, delay);
      return;
    }
    while (queue.length && inFlight < limit) {
      inFlight += 1;
      queue.shift()!();
    }
  };
  return {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      await new Promise<void>((resolve) => { queue.push(resolve); pump(); });
      try { return await fn(); }
      finally { inFlight -= 1; pump(); }
    },
    budgetExhausted(delay: number) {
      // Drain existing calls, then use one request at a time for this process.
      limit = 1;
      pausedUntil = Math.max(pausedUntil, Date.now() + delay);
      pump();
    },
  };
}

const sharedSpeechGate = createSpeechGate();

function isInFlightBudgetError(status: number, body: string): boolean {
  if (status !== 402) return false;
  try {
    const parsed = JSON.parse(body);
    return parsed?.error?.metadata?.reason === "in_flight_budget_exhausted";
  } catch {
    return false;
  }
}

export function openRouterSpeech(options: {
  apiKey: string;
  timeoutMs?: number;
  maxAttempts?: number;
  /** First backoff; doubles per attempt (with jitter). */
  backoffMs?: number;
  /** For tests. */
  fetchImpl?: typeof fetch;
  /** Isolated scheduler for tests. */
  gate?: ReturnType<typeof createSpeechGate>;
}): SpeechPort {
  if (!options.apiKey) throw new SpeechError("OpenRouter API key is missing (secret OpenRouterAPIKey / OPENROUTER_API_KEY).");
  const call = options.fetchImpl ?? fetch;
  const attempts = Math.max(1, options.maxAttempts ?? 8);
  const timeoutMs = options.timeoutMs ?? 120_000;
  const backoffMs = options.backoffMs ?? 1500;
  const gate = options.gate ?? sharedSpeechGate;

  return async (request) => {
    const label = `OpenRouter speech ${request.model} (${request.voice})`;
    let lastError = new SpeechError(`${label} failed`);
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      let wait = Math.min(60_000, backoffMs * 2 ** (attempt - 1) * (0.75 + Math.random() * 0.5));
      try {
        const outcome = await gate.run(async () => {
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
              return { result: { pcm, sampleRate: sampleRateOf(response.headers.get("content-type")), generationId: response.headers.get("x-generation-id") ?? undefined } };
            }
            lastError = new SpeechError(`${label} returned no audio (${pcm.length} bytes)`, 502);
          } else {
            const body = await response.text().catch(() => "");
            const budgetBusy = isInFlightBudgetError(response.status, body);
            wait = retryAfterMs(response.headers.get("retry-after")) ?? wait;
            if (budgetBusy) gate.budgetExhausted(wait);
            lastError = new SpeechError(budgetBusy
              ? `${label}: OpenRouter hat das verfügbare Guthaben vorübergehend für laufende Anfragen reserviert. Bitte später erneut versuchen oder das OpenRouter-Guthaben prüfen.`
              : `${label} failed with ${response.status}: ${body.slice(0, 400) || "<empty>"}`, response.status, isModerationRefusal(response.status, body));
            if (!budgetBusy && !retryable(response.status)) throw lastError;
          }
          return {};
        });
        if (outcome.result) return outcome.result;
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
