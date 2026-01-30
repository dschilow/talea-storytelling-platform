import { api } from "encore.dev/api";
import log from "encore.dev/log";

// URL of the TTS Service (configured via environment variable or default to local)
// In Railway, services are often accessible by their name, e.g. http://tts-service:5000
// Use 'TTS_SERVICE_URL' environment variable in Railway.
const TTS_SERVICE_URL = process.env.TTS_SERVICE_URL || "http://localhost:5000";

export interface TTSResponse {
    audioData: string; // Base64 encoded WAV data
}

export const generateSpeech = api(
    { expose: true, method: "GET", path: "/tts/generate" },
    async ({ text }: { text: string }): Promise<TTSResponse> => {
        if (!text) {
            throw new Error("Text is required");
        }

        try {
            const url = `${TTS_SERVICE_URL}/?text=${encodeURIComponent(text)}`;
            log.info(`Requesting TTS from ${url} for text length ${text.length}`);

            const response = await fetch(url);

            if (!response.ok) {
                const errText = await response.text();
                log.error(`TTS Service error: ${response.status} - ${errText}`);
                throw new Error(`TTS generation failed: ${errText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = buffer.toString('base64');

            return {
                audioData: `data:audio/wav;base64,${base64}`,
            };

        } catch (error: any) {
            log.error("Error generating speech", { error: error.message, cause: error.cause, stack: error.stack });
            throw error;
        }

    }
);
