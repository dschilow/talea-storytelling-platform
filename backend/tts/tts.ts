import { api } from "encore.dev/api";
import log from "encore.dev/log";

// TTS_SERVICE_URL should use Railway private networking to avoid the public LB timeout:
// Set TTS_SERVICE_URL=http://tts-service.railway.internal:8080 in Railway env vars.
// Railway private networking has no 30/60s proxy timeout — only the AbortController limit applies.
const PIPER_TTS_SERVICE_URL = process.env.TTS_SERVICE_URL || "http://localhost:5000";

// Optional second service for A/B tests (e.g. Chatterbox):
// CHATTERBOX_TTS_SERVICE_URL=http://tts-chatterbox-service.railway.internal:8080
const CHATTERBOX_TTS_SERVICE_URL = process.env.CHATTERBOX_TTS_SERVICE_URL || "";

export type TTSProvider = "piper" | "chatterbox";

// Optional global default for requests that do not send `provider`:
// TTS_DEFAULT_PROVIDER=chatterbox
const TTS_DEFAULT_PROVIDER = (process.env.TTS_DEFAULT_PROVIDER || "piper").toLowerCase();
const TTS_FALLBACK_TO_PIPER = (process.env.TTS_FALLBACK_TO_PIPER || "true").toLowerCase() !== "false";
const CHATTERBOX_FAILURE_COOLDOWN_MS = Number(process.env.CHATTERBOX_FAILURE_COOLDOWN_MS || "300000"); // 5 min

let chatterboxUnavailableUntil = 0;

function isChatterboxTemporarilyUnavailable(): boolean {
    return Date.now() < chatterboxUnavailableUntil;
}

function markChatterboxUnavailable(reason: string): void {
    chatterboxUnavailableUntil = Date.now() + CHATTERBOX_FAILURE_COOLDOWN_MS;
    const seconds = Math.max(1, Math.round(CHATTERBOX_FAILURE_COOLDOWN_MS / 1000));
    log.warn(`Marking chatterbox unavailable for ${seconds}s: ${reason}`);
}

function resolveProvider(provider?: string): TTSProvider {
    const requested = (provider || TTS_DEFAULT_PROVIDER || "piper").toLowerCase();
    if (requested === "chatterbox") return "chatterbox";
    return "piper";
}

function resolveServiceUrl(provider: TTSProvider): string {
    if (provider === "chatterbox") {
        if (!CHATTERBOX_TTS_SERVICE_URL) {
            throw new Error("CHATTERBOX_TTS_SERVICE_URL is not configured");
        }
        return CHATTERBOX_TTS_SERVICE_URL;
    }
    return PIPER_TTS_SERVICE_URL;
}

export interface TTSResponse {
    audioData: string; // Base64 encoded WAV data URI
    providerUsed?: TTSProvider;
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

interface TTSGenerationOptions {
    languageId?: string;
    model?: string;
}

// ── Async polling helpers (used when TTS_SERVICE_URL points to async-capable server) ────

async function submitAsyncJob(serviceUrl: string, text: string, options?: TTSGenerationOptions): Promise<string> {
    const url = `${serviceUrl}/generate/async`;
    const body = JSON.stringify({
        text,
        length_scale: 1.35,
        noise_scale: 0.55,
        noise_w: 0.65,
        language_id: options?.languageId,
        model: options?.model,
    });

    // Retry up to 3 times to handle cold-start 502s from Railway
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15_000); // 15s per attempt
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body,
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (response.ok) {
                const data = await response.json() as { job_id: string };
                return data.job_id;
            }

            const errText = await response.text();
            // 404/405 = server without compatible async endpoint, fall through to sync
            if (response.status === 404 || response.status === 405) {
                throw new Error("ASYNC_NOT_SUPPORTED");
            }
            // 502/503 = service starting up, retry
            if ((response.status === 502 || response.status === 503) && attempt < MAX_RETRIES) {
                log.warn(`TTS service returned ${response.status} (attempt ${attempt}/${MAX_RETRIES}), retrying in 3s...`);
                await new Promise((r) => setTimeout(r, 3_000));
                continue;
            }
            throw new Error(`TTS async submit failed: ${response.status} - ${errText}`);
        } catch (err: any) {
            if (err.message === "ASYNC_NOT_SUPPORTED") throw err;
            if (err.name === "AbortError" && attempt < MAX_RETRIES) {
                log.warn(`TTS submit timed out (attempt ${attempt}/${MAX_RETRIES}), retrying...`);
                await new Promise((r) => setTimeout(r, 2_000));
                continue;
            }
            throw err;
        }
    }
    throw new Error("TTS async submit failed after all retries");
}

async function pollJobUntilReady(serviceUrl: string, jobId: string, timeoutMs = 420_000): Promise<string> {
    const statusUrl = `${serviceUrl}/generate/status/${jobId}`;
    const resultUrl = `${serviceUrl}/generate/result/${jobId}`;
    const deadline = Date.now() + timeoutMs;

    // Start with fast polling, then back off
    let intervalMs = 1200;

    while (Date.now() < deadline) {
        await new Promise((res) => setTimeout(res, intervalMs));

        const statusRes = await fetch(statusUrl);
        if (!statusRes.ok) {
            throw new Error(`Status poll failed: ${statusRes.status}`);
        }
        const status = await statusRes.json() as { status: string; error?: string };

        if (status.status === "error") {
            throw new Error(`TTS job failed: ${status.error || "unknown error"}`);
        }
        if (status.status === "not_found") {
            throw new Error("TTS job not found (expired or never created)");
        }
        if (status.status === "ready") {
            const resultRes = await fetch(resultUrl);
            if (!resultRes.ok) {
                throw new Error(`Result fetch failed: ${resultRes.status}`);
            }
            const arrayBuffer = await resultRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = buffer.toString("base64");
            return `data:audio/wav;base64,${base64}`;
        }

        // Still processing — back off gradually (max 3s)
        intervalMs = Math.min(intervalMs * 1.3, 3000);
    }

    // Final grace check right at timeout boundary to avoid false negatives when
    // the job flips to ready milliseconds after the last poll.
    try {
        const finalStatusRes = await fetch(statusUrl);
        if (finalStatusRes.ok) {
            const finalStatus = await finalStatusRes.json() as { status: string; error?: string };
            if (finalStatus.status === "ready") {
                const resultRes = await fetch(resultUrl);
                if (resultRes.ok) {
                    const arrayBuffer = await resultRes.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    const base64 = buffer.toString("base64");
                    return `data:audio/wav;base64,${base64}`;
                }
            }
            if (finalStatus.status === "error") {
                throw new Error(`TTS job failed: ${finalStatus.error || "unknown error"}`);
            }
        }
    } catch {
        // Preserve timeout error below.
    }

    throw new Error(`TTS polling timed out after ${timeoutMs / 1000}s for job ${jobId}`);
}

async function generateSyncFallback(serviceUrl: string, text: string, options?: TTSGenerationOptions): Promise<string> {
    // Synchronous fallback for old TTS server or when private networking is used.
    // With Railway private networking (tts-service.railway.internal) there is no LB timeout,
    // so long-running requests succeed even if they take 5+ minutes.
    const url = `${serviceUrl}/`;
    log.info(`TTS sync fallback for text length ${text.length}`);

    const parseAudioResponse = async (response: Response): Promise<string> => {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString("base64");
        return `data:audio/wav;base64,${base64}`;
    };

    const isNoTextProvided = (status: number, body: string): boolean =>
        status === 400 && /no text provided/i.test(body);

    const tryFormPost = async (): Promise<string> => {
        const formBody = new URLSearchParams();
        formBody.set("text", text);
        if (options?.model) formBody.set("model", options.model);
        if (options?.languageId) formBody.set("language_id", options.languageId);
        formBody.set("length_scale", "1.55");
        formBody.set("noise_scale", "0.42");
        formBody.set("noise_w", "0.38");

        const formRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formBody.toString(),
        });

        if (formRes.ok) {
            return parseAudioResponse(formRes);
        }

        const formErr = await formRes.text();
        if (!isNoTextProvided(formRes.status, formErr)) {
            throw new Error(`TTS sync(form) failed: ${formRes.status} - ${formErr}`);
        }

        // Last resort for environments rewriting POST bodies: GET with query params.
        // We keep this only as fallback because URLs can get long.
        const query = new URL(url);
        query.searchParams.set("text", text);
        if (options?.model) query.searchParams.set("model", options.model);
        if (options?.languageId) query.searchParams.set("language_id", options.languageId);
        query.searchParams.set("length_scale", "1.55");
        query.searchParams.set("noise_scale", "0.42");
        query.searchParams.set("noise_w", "0.38");

        const getRes = await fetch(query.toString(), { method: "GET" });
        if (getRes.ok) {
            return parseAudioResponse(getRes);
        }

        const getErr = await getRes.text();
        throw new Error(`TTS sync(get) failed: ${getRes.status} - ${getErr}`);
    };

    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 300_000); // 5min
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text,
                    length_scale: 1.55,
                    noise_scale: 0.42,
                    noise_w: 0.38,
                    language_id: options?.languageId,
                    model: options?.model,
                }),
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (response.ok) {
                return parseAudioResponse(response);
            }

            const errText = await response.text();
            if (isNoTextProvided(response.status, errText)) {
                log.warn("TTS sync JSON body not accepted, retrying with form/query fallback");
                return await tryFormPost();
            }
            if ((response.status === 502 || response.status === 503) && attempt < MAX_RETRIES) {
                log.warn(`TTS sync got ${response.status} (attempt ${attempt}/${MAX_RETRIES}), retrying in 5s...`);
                await new Promise((r) => setTimeout(r, 5_000));
                continue;
            }
            throw new Error(`TTS sync failed: ${response.status} - ${errText}`);
        } catch (err: any) {
            if (err.name === "AbortError") {
                if (attempt < MAX_RETRIES) {
                    log.warn(`TTS sync timed out (attempt ${attempt}/${MAX_RETRIES}), retrying...`);
                    await new Promise((r) => setTimeout(r, 3_000));
                    continue;
                }
                throw new Error("TTS sync timed out after 5min");
            }
            throw err;
        }
    }
    throw new Error("TTS sync failed after all retries");
}

// ── API Endpoints ─────────────────────────────────────────────────────────────

export const generateSpeech = api(
    { expose: true, method: "POST", path: "/tts/generate" },
    async ({ text, provider, languageId, model }: { text: string; provider?: TTSProvider; languageId?: string; model?: string }): Promise<TTSResponse> => {
        if (!text) {
            throw new Error("Text is required");
        }

        try {
            const runProvider = async (targetProvider: TTSProvider): Promise<TTSResponse> => {
                const serviceUrl = resolveServiceUrl(targetProvider);

                // Try async polling first (new server). Falls back to sync if 404/405.
                log.info(`TTS request for text length ${text.length} via ${targetProvider}`);

                let audioData: string;
                try {
                    const jobId = await submitAsyncJob(serviceUrl, text, { languageId, model });
                    log.info(`TTS async job submitted: ${jobId}`);
                    audioData = await pollJobUntilReady(serviceUrl, jobId);
                    log.info(`TTS async job complete: ${jobId}`);
                } catch (err: any) {
                    if (err.message === "ASYNC_NOT_SUPPORTED") {
                        // Old TTS server — use synchronous endpoint
                        log.warn("TTS async not supported, falling back to sync endpoint");
                        audioData = await generateSyncFallback(serviceUrl, text, { languageId, model });
                    } else {
                        throw err;
                    }
                }

                return { audioData, providerUsed: targetProvider };
            };

            const resolvedProvider = resolveProvider(provider);
            const startProvider: TTSProvider = (
                resolvedProvider === "chatterbox" &&
                TTS_FALLBACK_TO_PIPER &&
                isChatterboxTemporarilyUnavailable()
            ) ? "piper" : resolvedProvider;

            if (startProvider !== resolvedProvider) {
                const remainingMs = Math.max(0, chatterboxUnavailableUntil - Date.now());
                log.warn(`Skipping chatterbox during cooldown (${Math.ceil(remainingMs / 1000)}s remaining), using piper`);
            }

            try {
                const result = await runProvider(startProvider);
                if (startProvider === "chatterbox") {
                    chatterboxUnavailableUntil = 0;
                }
                return result;
            } catch (primaryError: any) {
                if (
                    startProvider === "chatterbox" &&
                    TTS_FALLBACK_TO_PIPER &&
                    !!PIPER_TTS_SERVICE_URL
                ) {
                    markChatterboxUnavailable(primaryError?.message || "unknown error");
                    log.warn(`Chatterbox failed, retrying with piper fallback: ${primaryError?.message || "unknown error"}`);
                    return await runProvider("piper");
                }
                throw primaryError;
            }
        } catch (error: any) {
            const causeMsg = error.cause ? (error.cause.message || JSON.stringify(error.cause)) : "none";
            log.error(`TTS failed: ${error.message} | cause: ${causeMsg}`);
            throw error;
        }
    }
);

export const generateSpeechBatch = api(
    { expose: true, method: "POST", path: "/tts/batch" },
    async ({ items, provider }: { items: TTSBatchItem[]; provider?: TTSProvider }): Promise<TTSBatchResponse> => {
        if (!items || items.length === 0) {
            return { results: [] };
        }

        try {
            const resolvedProvider = resolveProvider(provider);
            const serviceUrl = resolveServiceUrl(resolvedProvider);
            const url = `${serviceUrl}/batch`;
            log.info(`Requesting TTS batch from ${url} for ${items.length} items`);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 600_000); // 10min for batch

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items,
                    length_scale: 1.55,
                    noise_scale: 0.42,
                    noise_w: 0.38,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                const errText = await response.text();
                log.error(`TTS Batch error: ${response.status} - ${errText}`);
                throw new Error(`TTS batch failed: ${errText}`);
            }

            const data = await response.json() as { results: TTSBatchResultItem[] };
            log.info(`TTS batch completed: ${data.results.filter((r: TTSBatchResultItem) => r.audio).length}/${items.length} ok`);
            return { results: data.results };
        } catch (error: any) {
            const causeMsg = error.cause ? (error.cause.message || JSON.stringify(error.cause)) : "none";
            log.error(`TTS batch fetch failed: ${error.message} | cause: ${causeMsg}`);
            throw error;
        }
    }
);
