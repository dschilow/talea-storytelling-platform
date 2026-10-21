/**
 * Who speaks with which voice in a series' audio dramas — Encore-free.
 *
 * Every figure keeps its voice from episode to episode. Order of precedence:
 * the admin's choice (database) → the series default in the bible → an
 * automatic pick that is then stored, so it never changes behind anyone's back.
 * A voice that disappeared from the ElevenLabs account falls through to the next
 * step instead of failing the render.
 */

import { inferSpeakerGender } from "../../../doku/voice-casting";
import type { SeriesBible, SeriesCharacter, VoiceRole } from "../types";

export interface AccountVoice {
  voiceId: string;
  name: string;
  labels?: Record<string, string>;
  description?: string;
  previewUrl?: string;
}

/** A row of library_voice_cast. */
export interface VoiceOverride {
  speakerId: string;
  voiceId?: string | null;
  persona?: string | null;
  source: "admin" | "auto";
}

export const NARRATOR_ID = "narrator";
/** Captain Comedy — the narrator of every Talea Original, like Tavi in the audio dokus. */
export const DEFAULT_NARRATOR: Required<Pick<VoiceRole, "voiceId" | "persona">> = { voiceId: "8tJgFGd1nr7H5KLTvjjt", persona: "warm, playful storyteller" };

export interface ResolvedVoice {
  speakerId: string;
  name: string;
  voiceId?: string;
  voiceName?: string;
  persona: string;
  silent: boolean;
  source: "admin" | "series" | "auto";
  /** Set when a configured voice is no longer in the account. */
  replaced?: string;
}

export type VoiceAge = "child" | "adult" | "old";

export interface VoiceHint {
  gender?: "female" | "male";
  age?: VoiceAge;
  /** Monsters, animals, magical figures: character voices welcome. */
  creature?: boolean;
  /** Stable tie-break, so the same figure gets the same pick on every run. */
  seed: string;
}

const label = (voice: AccountVoice, key: string): string => (voice.labels?.[key] ?? "").toLowerCase();
const isGerman = (voice: AccountVoice): boolean => /(german|deutsch|\bde\b)/.test(`${label(voice, "language")} ${label(voice, "accent")}`);

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export function scoreVoice(voice: AccountVoice, hint: VoiceHint, used: Set<string>): number {
  let score = 0;
  if (isGerman(voice)) score += 5;
  const gender = label(voice, "gender");
  if (hint.gender && gender) score += gender === hint.gender ? 4 : gender === "neutral" ? (hint.creature ? 1 : -2) : -8;
  const age = label(voice, "age");
  const useCase = `${label(voice, "use_case")} ${label(voice, "use case")}`;
  const animated = /character|animation/.test(useCase);
  if (hint.age === "child") score += (age.includes("young") ? 3 : -2) + (animated ? 2 : 0);
  if (hint.age === "old") score += age.includes("old") || age.includes("senior") ? 4 : -1;
  if (hint.age === "adult") score += age.includes("middle") ? 2 : age.includes("old") ? -1 : 0;
  if (hint.creature) score += animated ? 3 : 0;
  else if (/(robot|alien|demon|zombie)/i.test(`${voice.name} ${voice.description ?? ""}`)) score -= 6;
  if (used.has(voice.voiceId)) score -= 30;
  return score;
}

/** The best free voice for a figure; deterministic for the same seed and account. */
export function pickVoice(hint: VoiceHint, voices: AccountVoice[], used: Set<string>): AccountVoice | null {
  if (!voices.length) return null;
  return [...voices].sort((a, b) => scoreVoice(b, hint, used) - scoreVoice(a, hint, used) || hash(hint.seed + a.voiceId) - hash(hint.seed + b.voiceId))[0];
}

export function hintForCharacter(character: Pick<SeriesCharacter, "id" | "name" | "ageYears" | "personality" | "speechStyle">): VoiceHint {
  const text = `${character.name} ${character.personality}`;
  const age: VoiceAge | undefined = character.ageYears ? (character.ageYears <= 13 ? "child" : character.ageYears >= 60 ? "old" : "adult") : /\b(oma|opa|alt)/i.test(text) ? "old" : undefined;
  const gender = /\b(oma|mama|frau|tante|königin|prinzessin|mädchen)\b/i.test(character.name)
    ? "female"
    : /\b(opa|papa|herr|onkel|könig|prinz|mann|junge)\b/i.test(character.name)
      ? "male"
      : inferSpeakerGender(character.name);
  const creature = !character.ageYears && /(monster|fisch|kater|katze|hund|drache|geist|flus|wesen|tier|kobold|troll)/i.test(text);
  return { gender, age, creature, seed: character.id };
}

/**
 * The narrator and every active character of the series with the voice it speaks
 * with. `autoPicks` lists the voices chosen right now; the caller stores them.
 */
export function resolveSeriesCast(input: {
  bible: Pick<SeriesBible, "audio">;
  characters: SeriesCharacter[];
  overrides: VoiceOverride[];
  voices: AccountVoice[];
}): { cast: ResolvedVoice[]; autoPicks: VoiceOverride[] } {
  const byId = new Map(input.voices.map((voice) => [voice.voiceId, voice]));
  const overrides = new Map(input.overrides.map((row) => [row.speakerId, row]));
  const direction = input.bible.audio;
  const used = new Set<string>();
  const autoPicks: VoiceOverride[] = [];
  const cast: ResolvedVoice[] = [];

  const resolve = (speakerId: string, name: string, base: VoiceRole | undefined, hint: VoiceHint | null): ResolvedVoice => {
    const override = overrides.get(speakerId);
    const persona = (override?.persona || base?.persona || "").trim() || "natural";
    const admin = override?.source === "admin" && override.voiceId ? override.voiceId : undefined;
    // A silent figure stays silent until the admin gives it a voice.
    if (!admin && base?.silent) return { speakerId, name, persona, silent: true, source: "series" };

    let replaced: string | undefined;
    const candidates: Array<[string | undefined, ResolvedVoice["source"]]> = [
      [admin, "admin"],
      [base?.voiceId, "series"],
      [override?.source === "auto" ? override.voiceId ?? undefined : undefined, "auto"],
    ];
    for (const [voiceId, source] of candidates) {
      if (!voiceId) continue;
      const voice = byId.get(voiceId);
      if (voice || !input.voices.length) {
        used.add(voiceId);
        return { speakerId, name, voiceId, voiceName: voice?.name.trim(), persona, silent: false, source, ...(replaced ? { replaced } : {}) };
      }
      replaced = replaced ?? voiceId;
    }
    const picked = hint ? pickVoice(hint, input.voices, used) : null;
    if (!picked) return { speakerId, name, persona, silent: false, source: "auto", ...(replaced ? { replaced } : {}) };
    used.add(picked.voiceId);
    autoPicks.push({ speakerId, voiceId: picked.voiceId, persona: override?.persona ?? null, source: "auto" });
    return { speakerId, name, voiceId: picked.voiceId, voiceName: picked.name.trim(), persona, silent: false, source: "auto", ...(replaced ? { replaced } : {}) };
  };

  // The narrator first: nobody else may take Captain Comedy.
  cast.push(resolve(NARRATOR_ID, "Erzähler", direction?.narrator ?? DEFAULT_NARRATOR, { gender: "male", age: "adult", seed: NARRATOR_ID }));
  // Configured voices claim their place before automatic picks fill the gaps.
  const ordered = [...input.characters].sort((a, b) => Number(Boolean(direction?.cast[b.id]?.voiceId)) - Number(Boolean(direction?.cast[a.id]?.voiceId)));
  for (const character of ordered) {
    cast.push(resolve(character.id, character.name, direction?.cast[character.id], hintForCharacter(character)));
  }
  const order = new Map(input.characters.map((character, index) => [character.id, index]));
  cast.sort((a, b) => (a.speakerId === NARRATOR_ID ? -1 : b.speakerId === NARRATOR_ID ? 1 : (order.get(a.speakerId) ?? 0) - (order.get(b.speakerId) ?? 0)));
  return { cast, autoPicks };
}
