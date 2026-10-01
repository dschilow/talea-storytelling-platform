/**
 * Server-side voice casting for the audio-doku automation. A port of
 * frontend/screens/Doku/speakerCasting.ts (same scoring), so an automated doku
 * gets the same voices the editor would have suggested. TAVI and LUMI are the
 * show's fixed voices and are never auto-picked.
 */

export type VoiceGender = "female" | "male";
export type VoiceAge = "young" | "adult" | "old";

export interface CastableVoice {
  voiceId: string;
  name: string;
  labels?: Record<string, string>;
}

export interface SpeakerVoiceHint {
  name: string;
  role?: string;
  gender?: VoiceGender;
  age?: VoiceAge;
}

/** Same IDs the editor ships with (CreateAudioDokuScreen DEFAULT_SPEAKERS). */
export const FIXED_SPEAKER_VOICES: Record<string, string> = {
  TAVI: "8tJgFGd1nr7H5KLTvjjt",
  LUMI: "7Nj1UduP6iY6hWpEDibS",
};

const FEMALE_WORDS = /(FRAU|MÄDCHEN|MAEDCHEN|OMA|MUTTER|TANTE|SCHWESTER|KÖNIGIN|KOENIGIN|PRINZESSIN)/;
const MALE_WORDS = /(MANN|JUNGE|OPA|VATER|ONKEL|BRUDER|KÖNIG|KOENIG|PRINZ|HERR)/;
const CHILD_WORDS = /(KIND|JUNGE|MÄDCHEN|MAEDCHEN|JUNIOR|SCHÜLER|SCHUELER)/;
const OLD_WORDS = /(OMA|OPA|GROSS|GROß|ALT)/;

export function inferSpeakerGender(name: string): VoiceGender | undefined {
  const upper = name.toUpperCase();
  if (FEMALE_WORDS.test(upper)) return "female";
  if (MALE_WORDS.test(upper)) return "male";
  const words = upper.split(/\s+/).filter(Boolean);
  if (words.some((word) => word.length > 4 && word.endsWith("IN"))) return "female";
  if (words.some((word) => /(ER|OGE|ARZT|EUR|IST|ANT)$/.test(word) && word.length > 4)) return "male";
  return undefined;
}

function inferSpeakerAge(hint: SpeakerVoiceHint): VoiceAge | undefined {
  if (hint.age) return hint.age;
  const text = `${hint.name} ${hint.role ?? ""}`.toUpperCase();
  if (CHILD_WORDS.test(text)) return "young";
  if (OLD_WORDS.test(text)) return "old";
  return undefined;
}

const label = (voice: CastableVoice, key: string): string => (voice.labels?.[key] ?? "").toLowerCase();

function scoreVoice(
  voice: CastableVoice,
  gender: VoiceGender | undefined,
  age: VoiceAge | undefined,
  used: Set<string>,
): number {
  let score = 0;
  const voiceGender = label(voice, "gender");
  if (gender && voiceGender) score += voiceGender === gender ? 6 : -12;

  const voiceAge = label(voice, "age");
  if (age === "young" && voiceAge.includes("young")) score += 3;
  if (age === "adult" && voiceAge.includes("middle")) score += 2;
  if (age === "old" && (voiceAge.includes("old") || voiceAge.includes("senior"))) score += 3;

  const language = `${label(voice, "language")} ${label(voice, "accent")}`;
  if (/(german|deutsch|\bde\b)/.test(language)) score += 2;

  const useCase = `${label(voice, "use_case")} ${label(voice, "use case")}`;
  if (/(conversational|narrat|character|characters)/.test(useCase)) score += 1;

  if (used.has(voice.voiceId)) score -= 20;
  return score;
}

/** How far below the best score a voice may be and still count as "fits well enough" for the random pick. */
const VARIETY_SCORE_WINDOW = 3;
const VARIETY_MAX_CANDIDATES = 5;

/**
 * An unused voice that fits the speaker. Picks at random among the best-fitting
 * voices (not always THE best), so guests do not sound the same in every doku.
 * Pass `rng` for deterministic tests. Returns "" when the account has no voices.
 */
export function suggestVoiceForSpeaker(
  hint: SpeakerVoiceHint,
  voices: CastableVoice[],
  used: Set<string>,
  rng: () => number = Math.random,
): string {
  if (voices.length === 0) return "";
  const gender = hint.gender ?? inferSpeakerGender(hint.name);
  const age = inferSpeakerAge(hint);

  const scored = voices
    .map((voice) => ({ voice, score: scoreVoice(voice, gender, age, used) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0].score;
  const candidates = scored
    .filter((entry) => entry.score >= best - VARIETY_SCORE_WINDOW)
    .slice(0, VARIETY_MAX_CANDIDATES);
  return candidates[Math.floor(rng() * candidates.length) % candidates.length].voice.voiceId;
}

/**
 * Builds the speaker→voice map for a doku: TAVI and LUMI fixed, every guest gets
 * a distinct best-fit voice. Throws when a guest cannot be cast (no voices).
 */
export function castSpeakerVoices(
  guests: SpeakerVoiceHint[],
  voices: CastableVoice[],
  rng: () => number = Math.random,
): Record<string, string> {
  const map: Record<string, string> = { ...FIXED_SPEAKER_VOICES };
  const used = new Set<string>(Object.values(FIXED_SPEAKER_VOICES));
  // Nobody reviews an automated cast: when the account has enough German-labelled voices, only use those.
  const german = voices.filter((voice) => /(german|deutsch|\bde\b)/.test(`${label(voice, "language")} ${label(voice, "accent")}`));
  const pool = german.length >= guests.length + 2 ? german : voices;
  for (const guest of guests) {
    const voiceId = suggestVoiceForSpeaker(guest, pool, used, rng);
    if (!voiceId) throw new Error(`Keine ElevenLabs-Stimme für ${guest.name} gefunden (Stimmenliste leer).`);
    used.add(voiceId);
    map[guest.name.toUpperCase()] = voiceId;
  }
  return map;
}
