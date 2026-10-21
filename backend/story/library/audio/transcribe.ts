/**
 * Speech to text for the listening check of audio drama takes: ElevenLabs Scribe
 * first; when the API key lacks that permission (401/403, measured 2026-10-21 on
 * the local key) OpenAI's transcription takes over for the rest of the process.
 */

import { secret } from "encore.dev/config";
import { transcribeSpeech } from "../../../tts/elevenlabs-dialogue";

const openAIKey = secret("OpenAIKey");
const OPENAI_MODELS = ["gpt-4o-mini-transcribe", "whisper-1"];

let scribeRefused = false;

const statusOf = (error: unknown): number | undefined => (error as { status?: number })?.status;

export async function transcribeTake(audio: Buffer): Promise<string> {
  if (!scribeRefused) {
    try {
      return (await transcribeSpeech({ audio, languageCode: "de" })).text;
    } catch (error) {
      const status = statusOf(error);
      if (status !== 401 && status !== 402 && status !== 403) throw error;
      scribeRefused = true;
      console.warn(`[library-audio] ElevenLabs speech-to-text not allowed for this key (${status}), listening with OpenAI instead.`);
    }
  }
  return transcribeWithOpenAI(audio);
}

function openAIApiKey(): string {
  try {
    const key = openAIKey();
    if (key) return key;
  } catch {
    // not configured in this environment
  }
  return process.env.OPENAI_API_KEY || "";
}

async function transcribeWithOpenAI(audio: Buffer): Promise<string> {
  const key = openAIApiKey();
  if (!key) throw new Error("Kein Speech-to-Text verfügbar (ElevenLabs-Key ohne speech_to_text, kein OpenAI-Key).");
  let lastError = "";
  for (const model of OPENAI_MODELS) {
    const form = new FormData();
    form.append("model", model);
    form.append("language", "de");
    form.append("response_format", "json");
    form.append("file", new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }), "take.mp3");
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
    if (response.ok) return String(((await response.json()) as { text?: string }).text || "");
    lastError = `OpenAI transcription ${response.status}: ${(await response.text()).slice(0, 300)}`;
    if (!((response.status === 400 || response.status === 404) && /model/i.test(lastError))) break;
  }
  throw new Error(lastError);
}
