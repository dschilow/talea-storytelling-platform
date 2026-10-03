/**
 * Gemeinsame ElevenLabs-Helfer für die Spiel-Stimmen (Mitternachts-Alibi).
 *
 * Schlüssel: Zuerst process.env.ELEVENLABS_API_KEY, dann .env.local, sonst die Railway-Variablen des
 * verlinkten Projekts (`railway variables --kv`, Produktion). Der Schlüssel liegt nur im Speicher und wird
 * weder ausgegeben noch in eine Datei geschrieben.
 *
 * API-Nutzung wie im Backend (backend/tts/elevenlabs-dialogue.ts): Modell eleven_v4, bei Ablehnung eleven_v3.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const API = "https://api.elevenlabs.io";
export const MODEL_PRIMARY = "eleven_v4";
export const MODEL_FALLBACK = "eleven_v3";
/** Gleicher Tavi wie in den Audio-Dokus (backend/doku/voice-casting.ts FIXED_SPEAKER_VOICES). */
export const TAVI_VOICE_ID = "8tJgFGd1nr7H5KLTvjjt";
/** Gleiches Kind wie in den Audio-Dokus, falls ein Kind-Erzähler gebraucht wird. */
export const LUMI_VOICE_ID = "7Nj1UduP6iY6hWpEDibS";

let cachedKey = null;

export function getApiKey() {
  if (cachedKey) return cachedKey;
  let key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) {
    const envLocal = path.join(REPO_ROOT, ".env.local");
    if (existsSync(envLocal)) {
      const m = readFileSync(envLocal, "utf8").match(/^ELEVENLABS_API_KEY=(.*)$/m);
      if (m) key = m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  if (!key) {
    try {
      const out = execSync("railway variables --kv", { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "ignore"], timeout: 60_000 }).toString();
      const m = out.match(/^ELEVENLABS_API_KEY=(.*)$/m);
      if (m) key = m[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      /* Railway-CLI nicht verfügbar */
    }
  }
  if (!key) throw new Error("Kein ELEVENLABS_API_KEY gefunden (Umgebung, .env.local oder Railway).");
  cachedKey = key;
  return key;
}

export async function el(pathname, init = {}) {
  const res = await fetch(`${API}${pathname}`, { ...init, headers: { "xi-api-key": getApiKey(), ...(init.headers || {}) } });
  return res;
}

export async function elJson(pathname, init) {
  const res = await el(pathname, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`${pathname} → ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Ein Clip über text-to-speech. Audio-Tags stehen direkt im Text ("[whispers] …").
 * Fällt bei Modell-Ablehnung einmal auf eleven_v3 zurück.
 */
export async function ttsClip({ voiceId, text, modelId = MODEL_PRIMARY, settings, seed, outputFormat = "mp3_44100_128" }) {
  const body = { text, model_id: modelId, language_code: "de", ...(settings ? { voice_settings: settings } : {}), ...(seed !== undefined ? { seed } : {}) };
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await el(`/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { audio: Buffer.from(await res.arrayBuffer()), modelId, chars: text.length };
    const errText = await res.text();
    if (modelId !== MODEL_FALLBACK && [400, 404, 422].includes(res.status) && /model/i.test(errText)) {
      return ttsClip({ voiceId, text, modelId: MODEL_FALLBACK, settings, seed, outputFormat });
    }
    if ([429, 500, 502, 503].includes(res.status) && attempt < 4) {
      await sleep(1500 * attempt);
      continue;
    }
    throw new Error(`TTS ${res.status}: ${errText.slice(0, 300)}`);
  }
  throw new Error("TTS: zu viele Versuche");
}

/** Geräusch über sound-generation. */
export async function sfxClip({ prompt, durationSeconds = 2, loop = false, promptInfluence = 0.5, outputFormat = "mp3_44100_128" }) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await el(`/v1/sound-generation?output_format=${outputFormat}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: prompt, duration_seconds: Math.max(0.5, Math.min(30, durationSeconds)), prompt_influence: promptInfluence, loop }),
    });
    if (res.ok) return { audio: Buffer.from(await res.arrayBuffer()) };
    const errText = await res.text();
    if ([429, 500, 502, 503].includes(res.status) && attempt < 4) {
      await sleep(1500 * attempt);
      continue;
    }
    throw new Error(`SFX ${res.status}: ${errText.slice(0, 300)}`);
  }
  throw new Error("SFX: zu viele Versuche");
}
