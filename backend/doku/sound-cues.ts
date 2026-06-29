import { secret } from "encore.dev/config";
import log from "encore.dev/log";
import { logTopic } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import type { DialogueTurnSpan, DialogueWord } from "../tts/elevenlabs-dialogue";

// ============================================================
// Sound Director: turns a timed dialogue into a DAW-style cue sheet.
//
// The AI acts as a sound designer and produces a timeline of sound events
// (spot SFX anchored to spoken words, ambience beds per location, a music
// underscore that follows the narrative beats, and transition whooshes).
// The renderer (audio-render.ts) then places, layers, ducks and masters them.
// ============================================================

const openAIKey = secret("OpenAIKey");
const CUE_MODEL = "gpt-5.4-mini";

export type CueType = "sfx" | "ambience" | "music" | "transition";
export type CueBehavior = "oneshot" | "loop";

/** Music moods the underscore can use; each maps to a concrete sound-generation prompt. */
export const MUSIC_MOODS = [
  "intro",
  "curious",
  "wonder",
  "tension",
  "playful",
  "resolve",
  "calm",
] as const;
export type MusicMood = (typeof MUSIC_MOODS)[number];

export interface SoundCue {
  type: CueType;
  /** Start time in seconds on the dialogue timeline. */
  start: number;
  /** Clip length in seconds (looped beds are trimmed to their window). */
  duration: number;
  /** Mix gain in dB (negative). */
  gainDb: number;
  behavior: CueBehavior;
  fadeIn: number;
  fadeOut: number;
  /** Stereo placement, -1 (left) .. 1 (right). 0 = centered. */
  pan: number;
  /** Sound-generation prompt for sfx/ambience/transition. */
  prompt?: string;
  /** Music mood for music cues (maps to a musical bed prompt). */
  mood?: MusicMood;
  /** The spoken word a spot effect should land on (used to snap to exact time). */
  anchor?: string;
}

export interface GenerateSoundCuesInput {
  script: string;
  durationSec: number;
  ageFrom: number;
  ageTo: number;
  turnSpans: DialogueTurnSpan[];
  /** Present when word-level timing is available (enables precise spot SFX). */
  words: DialogueWord[];
}

const GAIN_RANGES: Record<CueType, { min: number; max: number; def: number }> = {
  music: { min: -34, max: -18, def: -26 },
  ambience: { min: -32, max: -18, def: -24 },
  sfx: { min: -20, max: -4, def: -10 },
  transition: { min: -22, max: -8, def: -14 },
};

const MAX_CUES = 40;

const stripJsonFences = (raw: string): string => raw.replace(/```json\s*|\s*```/g, "").trim();

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

/**
 * Maps a music mood to a concrete instrumental bed prompt for ElevenLabs sound-generation.
 * Kept deliberately gentle and percussion-free so it sits under narration.
 */
export const moodToMusicPrompt = (mood: MusicMood): string => {
  switch (mood) {
    case "intro":
      return "warm uplifting documentary opening underscore, soft strings and gentle bells, hopeful, no percussion, no vocals";
    case "curious":
      return "light curious documentary bed, soft plucked strings and marimba, inquisitive, gentle motion, no percussion, no vocals";
    case "wonder":
      return "awe and wonder underscore, warm sustained strings and soft piano, shimmering pad, cinematic, no percussion, no vocals";
    case "tension":
      return "soft gentle suspense bed for kids, low warm pulse and airy strings, mild anticipation, not scary, no percussion, no vocals";
    case "playful":
      return "playful light documentary bed, soft pizzicato strings and glockenspiel, friendly and bouncy, no percussion, no vocals";
    case "resolve":
      return "warm resolving documentary underscore, gentle strings and soft piano, satisfying and calm, no percussion, no vocals";
    case "calm":
    default:
      return "calm soft ambient documentary pad, warm sustained strings, peaceful, slow, no percussion, no vocals";
  }
};

const callOpenAI = async (payload: Record<string, unknown>, timeoutMs: number): Promise<any> => {
  const abort = new AbortController();
  const handle = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAIKey()}` },
      body: JSON.stringify(payload),
      signal: abort.signal,
    });
    if (!res.ok) {
      throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    await publishWithTimeout(logTopic, {
      source: "openai-audio-doku-sound-cues",
      timestamp: new Date(),
      request: payload,
      response: data,
    });
    return data;
  } catch (error) {
    if ((error as any)?.name === "AbortError") {
      throw new Error(`OpenAI cue request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(handle);
  }
};

const buildTimedScript = (input: GenerateSoundCuesInput): string =>
  input.turnSpans
    .map((span) => `[${span.start.toFixed(1)}-${span.end.toFixed(1)}s] ${span.speaker}: ${span.text}`)
    .join("\n");

const SYSTEM_PROMPT = `Du bist ein erstklassiger Sound-Designer und Tonmeister fuer hochwertige Kinder-Wissens-Dokus (Stil: Checker Tobi, Galileo, BBC Earth Kids). Du arbeitest wie in einer echten Film-Postproduktion mit einer Timeline.

Du bekommst ein vertontes Dialog-Skript MIT Zeitstempeln pro Zeile (in Sekunden) und erzeugst eine PRAEZISE KLANG-PARTITUR (cue sheet) als JSON.

Es gibt vier Arten von Cues:
1. "sfx" — punktgenaue Einzelgeraeusche auf konkrete Ereignisse/Woerter (z.B. Donner, Wellen-Klatsch, Rakete, Herzschlag, Vulkanausbruch, Fluegelschlag). Kurz (0.5-3s), behavior "oneshot". Setze "anchor" auf das gesprochene WORT, auf das der Effekt fallen soll. Nur bei echten, hoerbaren Ereignissen — nicht dekorativ.
2. "ambience" — leise Orts-Atmosphaere unter einem Abschnitt (Meer, Wald, Wind, Regen, Laborhum). behavior "loop". Nur wenn der Abschnitt klar an einem Ort spielt.
3. "music" — instrumentales Musikbett, das der DRAMATURGIE folgt. behavior "loop". Setze "mood" aus: intro, curious, wonder, tension, playful, resolve, calm. Wechsle die Stimmung mit den Erzaehl-Beats (Hook -> Neugier -> Staunen -> Spannung -> Aufloesung). Lass Musik an starken "Wow"-Momenten kurz aussetzen oder leiser werden.
4. "transition" — kurzer Riser/Whoosh (0.8-1.5s) an Themen-/Orts-Wechseln, um Abschnitte zu verbinden. behavior "oneshot".

REGELN:
- Sprache ist immer die Hauptspur. Sound unterstuetzt, ueberdeckt nie.
- Sei sparsam und gezielt. Lieber wenige starke Cues als ein Dauer-Teppich. Maximal ${MAX_CUES} Cues.
- sfx braucht ein konkretes Ereignis im Text. Keine sfx ohne klaren Ausloeser.
- prompt (fuer sfx/ambience/transition): kurzer, konkreter ENGLISCHER Sound-Prompt, KEINE Stimmen, KEIN Gesang.
- gainDb: music -34..-18, ambience -32..-18, sfx -20..-4, transition -22..-8. (negative dB)
- pan: -1..1, Stimme bleibt mittig; ambience/sfx duerfen leicht seitlich liegen. Im Zweifel 0.
- start: Sekunde auf der Timeline. sfx: nahe dem Zeitfenster der Zeile mit dem Ereignis. ambience/music: Beginn des Abschnitts.
- duration: realistisch. ambience/music duerfen lang sein (bis Abschnittsende), sfx kurz.
- fadeIn/fadeOut: Sekunden. Musik/Atmo weich (0.8-2.0). sfx kurz (0-0.2).
- kindgerecht und sicher: nichts wirklich Erschreckendes.

Antworte AUSSCHLIESSLICH als JSON:
{ "cues": [ { "type": "music", "start": 0, "duration": 18, "gainDb": -26, "behavior": "loop", "mood": "intro", "fadeIn": 1.5, "fadeOut": 1.5, "pan": 0 }, { "type": "sfx", "start": 12.4, "duration": 2.2, "gainDb": -9, "behavior": "oneshot", "prompt": "deep volcanic eruption rumble with debris", "anchor": "ausbricht", "fadeIn": 0, "fadeOut": 0.2, "pan": -0.2 } ] }`;

/**
 * Normalizes / clamps a raw AI cue into a safe SoundCue, or returns null if unusable.
 */
const normalizeCue = (raw: unknown, durationSec: number): SoundCue | null => {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const type = String(obj.type || "").toLowerCase() as CueType;
  if (!["sfx", "ambience", "music", "transition"].includes(type)) return null;

  const start = Number(obj.start);
  if (!Number.isFinite(start) || start < 0 || start > durationSec + 1) return null;

  const range = GAIN_RANGES[type];
  const gainDb = Number.isFinite(Number(obj.gainDb))
    ? clamp(Number(obj.gainDb), range.min, range.max)
    : range.def;

  const behavior: CueBehavior =
    obj.behavior === "loop" || type === "ambience" || type === "music" ? "loop" : "oneshot";

  const defaultDuration = behavior === "loop" ? Math.min(20, Math.max(4, durationSec - start)) : 1.5;
  let duration = Number.isFinite(Number(obj.duration)) ? Number(obj.duration) : defaultDuration;
  duration = clamp(duration, 0.5, behavior === "loop" ? Math.max(2, durationSec) : 6);

  const fadeIn = clamp(Number(obj.fadeIn) || (behavior === "loop" ? 1.2 : 0), 0, 4);
  const fadeOut = clamp(Number(obj.fadeOut) || (behavior === "loop" ? 1.2 : 0.15), 0, 4);
  const pan = clamp(Number(obj.pan) || 0, -1, 1);

  const cue: SoundCue = { type, start, duration, gainDb, behavior, fadeIn, fadeOut, pan };

  if (type === "music") {
    const mood = String(obj.mood || "calm").toLowerCase() as MusicMood;
    cue.mood = (MUSIC_MOODS as readonly string[]).includes(mood) ? mood : "calm";
  } else {
    const prompt = typeof obj.prompt === "string" ? obj.prompt.trim() : "";
    if (!prompt) return null;
    cue.prompt = prompt;
    const anchor = typeof obj.anchor === "string" ? obj.anchor.trim() : "";
    if (anchor) cue.anchor = anchor;
  }

  return cue;
};

/**
 * Generates the sound cue sheet for a timed dialogue. Returns [] on failure so the caller
 * can gracefully fall back to a voice-only or simple-bed render.
 */
export async function generateSoundCues(input: GenerateSoundCuesInput): Promise<SoundCue[]> {
  const hasWordTiming = input.words.length > 0;
  const timedScript = buildTimedScript(input);

  const user = `ZIELGRUPPE: ${input.ageFrom}-${input.ageTo} Jahre
GESAMTDAUER: ${input.durationSec.toFixed(1)} Sekunden
WORT-TIMING VERFUEGBAR: ${hasWordTiming ? "ja (sfx praezise auf Woerter anchoren)" : "nein (sfx grob am Zeilen-Zeitfenster platzieren)"}

VERTONTES SKRIPT MIT ZEITSTEMPELN:
${timedScript}

Erstelle jetzt die Klang-Partitur als JSON. Denke an Dramaturgie: starker Musik-Hook am Anfang, Stimmungswechsel mit dem Inhalt, punktgenaue sfx auf echte Ereignisse, transitions an Themenwechseln, ruhige Aufloesung am Ende.`;

  const payload: Record<string, unknown> = {
    model: CUE_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 8000,
    reasoning_effort: "low",
  };

  try {
    const data = await callOpenAI(payload, 180_000);
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      log.warn("[SoundCues] OpenAI returned no content; skipping sound design.");
      return [];
    }
    let parsed: { cues?: unknown };
    try {
      parsed = JSON.parse(stripJsonFences(content));
    } catch {
      log.warn("[SoundCues] OpenAI returned invalid JSON; skipping sound design.");
      return [];
    }

    const rawCues = Array.isArray(parsed.cues) ? parsed.cues : [];
    const cues = rawCues
      .map((c) => normalizeCue(c, input.durationSec))
      .filter((c): c is SoundCue => c !== null)
      .sort((a, b) => a.start - b.start)
      .slice(0, MAX_CUES);

    log.info(
      `[SoundCues] generated ${cues.length} cues (music=${cues.filter((c) => c.type === "music").length}, ambience=${cues.filter((c) => c.type === "ambience").length}, sfx=${cues.filter((c) => c.type === "sfx").length}, transition=${cues.filter((c) => c.type === "transition").length})`,
    );
    return cues;
  } catch (error) {
    log.error(
      `[SoundCues] generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}
