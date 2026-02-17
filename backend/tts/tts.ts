import { api } from "encore.dev/api";
import log from "encore.dev/log";

// TTS_SERVICE_URL should use Railway private networking to avoid the public LB timeout:
// Set TTS_SERVICE_URL=http://tts-service.railway.internal:8080 in Railway env vars.
// Railway private networking has no 30/60s proxy timeout — only the AbortController limit applies.
const TTS_SERVICE_URL = process.env.TTS_SERVICE_URL || "http://localhost:5000";

export interface TTSResponse {
    audioData: string; // Base64 encoded WAV data URI
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

// ── Async polling helpers (used when TTS_SERVICE_URL points to async-capable server) ────

async function submitAsyncJob(text: string): Promise<string> {
    const url = `${TTS_SERVICE_URL}/generate/async`;
    const body = JSON.stringify({
        text,
        length_scale: 1.35,
        noise_scale: 0.55,
        noise_w: 0.65,
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
            // 404 = old server without async endpoint, fall through to sync
            if (response.status === 404) {
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

async function pollJobUntilReady(jobId: string, timeoutMs = 420_000): Promise<string> {
    const statusUrl = `${TTS_SERVICE_URL}/generate/status/${jobId}`;
    const resultUrl = `${TTS_SERVICE_URL}/generate/result/${jobId}`;
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

async function generateSyncFallback(text: string): Promise<string> {
    // Synchronous fallback for old TTS server or when private networking is used.
    // With Railway private networking (tts-service.railway.internal) there is no LB timeout,
    // so long-running requests succeed even if they take 5+ minutes.
    const url = `${TTS_SERVICE_URL}/`;
    log.info(`TTS sync fallback for text length ${text.length}`);

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
                }),
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const base64 = buffer.toString("base64");
                return `data:audio/wav;base64,${base64}`;
            }

            const errText = await response.text();
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
    async ({ text }: { text: string }): Promise<TTSResponse> => {
        if (!text) {
            throw new Error("Text is required");
        }

        try {
            // Try async polling first (new server). Falls back to sync if 404 (old server).
            log.info(`TTS request for text length ${text.length}`);

            let audioData: string;
            try {
                const jobId = await submitAsyncJob(text);
                log.info(`TTS async job submitted: ${jobId}`);
                audioData = await pollJobUntilReady(jobId);
                log.info(`TTS async job complete: ${jobId}`);
            } catch (err: any) {
                if (err.message === "ASYNC_NOT_SUPPORTED") {
                    // Old TTS server — use synchronous endpoint
                    log.warn("TTS async not supported, falling back to sync endpoint");
                    audioData = await generateSyncFallback(text);
                } else {
                    throw err;
                }
            }

            return { audioData };
        } catch (error: any) {
            const causeMsg = error.cause ? (error.cause.message || JSON.stringify(error.cause)) : "none";
            log.error(`TTS failed: ${error.message} | cause: ${causeMsg} | url: ${TTS_SERVICE_URL}`);
            throw error;
        }
    }
);

export const generateSpeechBatch = api(
    { expose: true, method: "POST", path: "/tts/batch" },
    async ({ items }: { items: TTSBatchItem[] }): Promise<TTSBatchResponse> => {
        if (!items || items.length === 0) {
            return { results: [] };
        }

        try {
            const url = `${TTS_SERVICE_URL}/batch`;
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
