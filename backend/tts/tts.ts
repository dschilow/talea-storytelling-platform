import { api } from "encore.dev/api";
import log from "encore.dev/log";

// URL of the TTS Service
// Railway private networking uses <service>.railway.internal with the PORT the service listens on
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
            // Use POST to send text in body to avoid URL length limits
            const url = `${TTS_SERVICE_URL}/`;
            log.info(`Requesting TTS from ${url} (POST) for text length ${text.length}`);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 300_000); // 5min timeout for long texts

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    text,
                    length_scale: 1.55, // Langsam, aber natürlicher als 1.65
                    noise_scale: 0.42,  // Etwas mehr natürliche Variation
                    noise_w: 0.38       // Leicht variierte Betonung für Lebendigkeit
                }),

                signal: controller.signal,
            });


            clearTimeout(timeout);

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
            const causeMsg = error.cause ? (error.cause.message || JSON.stringify(error.cause)) : "none";
            log.error(`TTS fetch failed: ${error.message} | cause: ${causeMsg} | code: ${error.code || "none"} | url: ${TTS_SERVICE_URL}`);
            throw error;
        }

    }
);

