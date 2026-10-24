/**
 * Who speaks in a drama and with which voice of which engine — Encore-free.
 *
 * The series cast (narrator and figures) comes with ElevenLabs voices
 * (casting.ts) and, for Gemini, with Gemini voices (gemini-voices.ts). Persona
 * and silence belong to the figure, so they are the same on every engine. A
 * screenplay keeps both voices per speaker, so it can be recorded again with the
 * other engine: missing voices are picked automatically (assignEngineVoices).
 */

import type { AudioScript, ScriptSpeaker, SeriesCharacter, VoiceFamily } from "../types";
import { NARRATOR_ID, pickVoice, type AccountVoice, type ResolvedVoice } from "./casting";
import { figureHint, pickGeminiVoice, type FigureHint, type GeminiCastEntry } from "./gemini-voices";
import { NARRATOR_KEY, speakerKey, type CastMember } from "./screenplay";

const ROLE_LABELS: Record<string, string> = { protagonist: "Hauptfigur", sidekick: "Sidekick", antagonist: "Gegenspieler", recurring: "Nebenfigur der Reihe" };
export const NARRATOR_HINT: FigureHint = { gender: "male", age: "adult", creature: false };

function describe(character: SeriesCharacter): string {
  return [ROLE_LABELS[character.role] ?? "", character.ageYears ? `${character.ageYears} Jahre` : "", character.personality, character.speechStyle ? `Sprechweise: ${character.speechStyle}` : ""]
    .filter(Boolean)
    .join(". ")
    .replace(/\.\./g, ".");
}

/** Gender, age and kind of every series figure (narrator included), for casting and directing on any engine. */
export function seriesHints(characters: SeriesCharacter[], seriesCast: ResolvedVoice[], voices: AccountVoice[]): Map<string, FigureHint> {
  const labels = new Map(voices.map((voice) => [voice.voiceId, voice.labels]));
  const hints = new Map<string, FigureHint>([[NARRATOR_ID, NARRATOR_HINT]]);
  for (const character of characters) {
    const voiceId = seriesCast.find((voice) => voice.speakerId === character.id)?.voiceId;
    hints.set(character.id, figureHint({ name: character.name, personality: character.personality, visual: character.visualProfileEn, ageYears: character.ageYears, labels: voiceId ? labels.get(voiceId) : undefined }));
  }
  return hints;
}

/** Narrator and figures as resolveGeminiCast needs them. */
export function geminiFigures(characters: SeriesCharacter[], seriesCast: ResolvedVoice[], voices: AccountVoice[]) {
  const hints = seriesHints(characters, seriesCast, voices);
  return seriesCast.map((voice) => ({ speakerId: voice.speakerId, name: voice.name, persona: voice.persona, silent: voice.silent, hint: hints.get(voice.speakerId) ?? {} }));
}

/** Narrator and series characters as cast members of the screenplay, with the voices of the engine that records. */
export function seriesCastMembers(characters: SeriesCharacter[], seriesCast: ResolvedVoice[], options: { family?: VoiceFamily; geminiCast?: GeminiCastEntry[]; voices?: AccountVoice[] } = {}): CastMember[] {
  const family = options.family ?? "elevenlabs";
  const gemini = new Map((options.geminiCast ?? []).map((entry) => [entry.speakerId, entry]));
  const hints = seriesHints(characters, seriesCast, options.voices ?? []);
  const narrator = seriesCast.find((voice) => voice.speakerId === NARRATOR_ID);
  const narratorGemini = gemini.get(NARRATOR_ID);
  const members: CastMember[] = [
    {
      key: NARRATOR_KEY,
      name: "Erzähler",
      characterId: NARRATOR_ID,
      description: "Erzählt die Geschichte.",
      persona: narrator?.persona || "warm, playful storyteller",
      silent: false,
      voiceId: narrator?.voiceId,
      voiceName: narrator?.voiceName,
      geminiVoice: narratorGemini?.voice,
      source: (family === "gemini" ? narratorGemini?.source : narrator?.source) === "admin" ? "admin" : "series",
      ...NARRATOR_HINT,
    },
  ];
  for (const character of characters) {
    const voice = seriesCast.find((entry) => entry.speakerId === character.id);
    if (!voice) continue;
    const geminiEntry = gemini.get(character.id);
    const hint = hints.get(character.id) ?? {};
    members.push({
      key: speakerKey(character.id),
      name: character.name,
      characterId: character.id,
      description: describe(character),
      persona: voice.persona,
      silent: family === "gemini" ? (geminiEntry ? geminiEntry.silent || !geminiEntry.voice : voice.silent) : voice.silent || !voice.voiceId,
      voiceId: voice.voiceId,
      voiceName: voice.voiceName,
      geminiVoice: geminiEntry?.voice,
      source: family === "gemini" && geminiEntry ? geminiEntry.source : voice.source,
      ...(hint.gender ? { gender: hint.gender } : {}),
      ...(hint.age ? { age: hint.age } : {}),
      creature: Boolean(hint.creature),
    });
  }
  return members;
}

export const toSpeaker = (member: CastMember): ScriptSpeaker => ({
  key: member.key,
  name: member.name,
  ...(member.characterId ? { characterId: member.characterId } : {}),
  voiceId: member.voiceId ?? "",
  ...(member.voiceName ? { voiceName: member.voiceName } : {}),
  ...(member.geminiVoice ? { geminiVoice: member.geminiVoice } : {}),
  persona: member.persona,
  source: member.source,
  ...(member.gender ? { gender: member.gender } : {}),
  ...(member.age ? { age: member.age } : {}),
  ...(member.creature ? { creature: true } : {}),
});

/** A stored screenplay with today's voices of the series (episode guests keep theirs). */
export function recastScript(script: AudioScript, seriesMembers: CastMember[]): AudioScript {
  const current = new Map(seriesMembers.map((member) => [member.key, member]));
  return {
    ...script,
    speakers: script.speakers.map((speaker) => {
      const member = current.get(speaker.key);
      if (!member) return speaker;
      return {
        ...speaker,
        ...(member.voiceId ? { voiceId: member.voiceId, voiceName: member.voiceName } : {}),
        ...(member.geminiVoice ? { geminiVoice: member.geminiVoice } : {}),
        persona: member.persona,
        source: member.source,
        ...(member.gender && !speaker.gender ? { gender: member.gender } : {}),
        ...(member.age && !speaker.age ? { age: member.age } : {}),
        ...(member.creature && speaker.creature === undefined ? { creature: true } : {}),
      };
    }),
  };
}

/** A speaker's hint: what the screenplay stored, completed from its series figure. */
export function speakerHint(speaker: ScriptSpeaker, hints: Map<string, FigureHint>): FigureHint {
  return {
    ...(speaker.characterId ? hints.get(speaker.characterId) : undefined),
    ...(speaker.gender ? { gender: speaker.gender } : {}),
    ...(speaker.age ? { age: speaker.age } : {}),
    ...(speaker.creature !== undefined ? { creature: speaker.creature } : {}),
  };
}

/**
 * Every speaker of the screenplay gets a voice of the engine that records: a
 * script written for ElevenLabs can be recorded with Gemini and the other way
 * round. Missing voices are picked automatically and stay with the script.
 */
export function assignEngineVoices(script: AudioScript, family: VoiceFamily, voices: AccountVoice[], hints: Map<string, FigureHint>): AudioScript {
  if (family === "gemini") {
    const used = new Set(script.speakers.map((speaker) => speaker.geminiVoice).filter((voice): voice is string => Boolean(voice)));
    return {
      ...script,
      speakers: script.speakers.map((speaker) => {
        if (speaker.geminiVoice) return speaker;
        const voice = pickGeminiVoice({ ...speakerHint(speaker, hints), persona: speaker.persona, seed: speaker.key }, used);
        used.add(voice.name);
        return { ...speaker, geminiVoice: voice.name };
      }),
    };
  }
  const used = new Set(script.speakers.map((speaker) => speaker.voiceId).filter(Boolean));
  const names = new Map(voices.map((voice) => [voice.voiceId, voice.name.trim()]));
  return {
    ...script,
    speakers: script.speakers.map((speaker) => {
      if (speaker.voiceId) return speaker;
      const hint = speakerHint(speaker, hints);
      const picked = pickVoice({ gender: hint.gender, age: hint.age, creature: hint.creature, seed: speaker.key }, voices, used);
      if (!picked) throw new Error(`${speaker.name} hat keine ElevenLabs-Stimme, und im ElevenLabs-Konto ist keine frei.`);
      used.add(picked.voiceId);
      return { ...speaker, voiceId: picked.voiceId, voiceName: names.get(picked.voiceId) };
    }),
  };
}
