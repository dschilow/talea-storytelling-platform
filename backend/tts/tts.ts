import { api } from "encore.dev/api";
import log from "encore.dev/log";

// URL of the TTS Service
// Railway private networking uses <service>.railway.internal with the PORT the service listens on
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

// ── Async polling helpers ─────────────────────────────────────────────────────

async function submitAsyncJob(text: string): Promise<string> {
    const url = `${TTS_SERVICE_URL}/generate/async`;
    const body = JSON.stringify({
        text,
        length_scale: 1.55,
        noise_scale: 0.42,
        noise_w: 0.38,
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
            // 502/503 = service starting up, retry
            if ((response.status === 502 || response.status === 503) && attempt < MAX_RETRIES) {
                log.warn(`TTS service returned ${response.status} (attempt ${attempt}/${MAX_RETRIES}), retrying in 3s...`);
                await new Promise((r) => setTimeout(r, 3_000));
                continue;
            }
            throw new Error(`TTS async submit failed: ${response.status} - ${errText}`);
        } catch (err: any) {
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

async function pollJobUntilReady(jobId: string, timeoutMs = 290_000): Promise<string> {
    const statusUrl = `${TTS_SERVICE_URL}/generate/status/${jobId}`;
    const resultUrl = `${TTS_SERVICE_URL}/generate/result/${jobId}`;
    const deadline = Date.now() + timeoutMs;

    // Start with fast polling, then back off
    let intervalMs = 1000;

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
            // Fetch the audio result
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

    throw new Error(`TTS polling timed out after ${timeoutMs / 1000}s for job ${jobId}`);
}

// ── API Endpoints ─────────────────────────────────────────────────────────────

export const generateSpeech = api(
    { expose: true, method: "GET", path: "/tts/generate" },
    async ({ text }: { text: string }): Promise<TTSResponse> => {
        if (!text) {
            throw new Error("Text is required");
        }

        try {
            log.info(`TTS async submit for text length ${text.length}`);

            // Submit job to TTS service — returns immediately
            const jobId = await submitAsyncJob(text);
            log.info(`TTS job submitted: ${jobId}`);

            // Poll until ready (short-lived HTTP requests, no Railway LB timeout)
            const audioData = await pollJobUntilReady(jobId);
            log.info(`TTS job complete: ${jobId}`);

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
