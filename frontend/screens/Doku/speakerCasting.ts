// Automatische Stimmen-Vorschläge für Audio-Doku-Sprecher.
// Nutzt die ElevenLabs-Voice-Labels (gender, age, accent, language, use_case) und
// meidet bereits vergebene Stimmen, damit zwei Sprecher nie gleich klingen.

export type VoiceGender = 'female' | 'male';
export type VoiceAge = 'young' | 'adult' | 'old';

export type CastableVoice = {
  id: string;
  name: string;
  labels?: Record<string, string>;
  description?: string;
  previewUrl?: string;
};

export type SpeakerVoiceHint = {
  name: string;
  role?: string;
  gender?: VoiceGender;
  age?: VoiceAge;
};

const FEMALE_WORDS = /(FRAU|MÄDCHEN|MAEDCHEN|OMA|MUTTER|TANTE|SCHWESTER|KÖNIGIN|KOENIGIN|PRINZESSIN)/;
const MALE_WORDS = /(MANN|JUNGE|OPA|VATER|ONKEL|BRUDER|KÖNIG|KOENIG|PRINZ|HERR)/;
const CHILD_WORDS = /(KIND|JUNGE|MÄDCHEN|MAEDCHEN|JUNIOR|SCHÜLER|SCHUELER)/;
const OLD_WORDS = /(OMA|OPA|GROSS|GROß|ALT)/;

/**
 * Leitet das Geschlecht aus dem Sprechernamen ab, wenn die KI keinen Hinweis geliefert hat.
 * Deutsche Berufsbezeichnungen auf "-IN" (FÖRSTERIN, TIERÄRZTIN) sind weiblich.
 */
export const inferSpeakerGender = (name: string): VoiceGender | undefined => {
  const upper = name.toUpperCase();
  if (FEMALE_WORDS.test(upper)) return 'female';
  if (MALE_WORDS.test(upper)) return 'male';
  const words = upper.split(/\s+/).filter(Boolean);
  if (words.some((word) => word.length > 4 && word.endsWith('IN'))) return 'female';
  if (words.some((word) => /(ER|OGE|ARZT|EUR|IST|ANT)$/.test(word) && word.length > 4)) return 'male';
  return undefined;
};

const inferSpeakerAge = (hint: SpeakerVoiceHint): VoiceAge | undefined => {
  if (hint.age) return hint.age;
  const text = `${hint.name} ${hint.role ?? ''}`.toUpperCase();
  if (CHILD_WORDS.test(text)) return 'young';
  if (OLD_WORDS.test(text)) return 'old';
  return undefined;
};

const label = (voice: CastableVoice, key: string): string => (voice.labels?.[key] ?? '').toLowerCase();

export const describeVoice = (voice: CastableVoice): string =>
  [label(voice, 'gender'), label(voice, 'age').replace(/_/g, ' '), label(voice, 'accent')]
    .filter(Boolean)
    .join(' · ');

const scoreVoice = (
  voice: CastableVoice,
  gender: VoiceGender | undefined,
  age: VoiceAge | undefined,
  usedVoiceIds: Set<string>,
): number => {
  let score = 0;
  const voiceGender = label(voice, 'gender');
  if (gender && voiceGender) score += voiceGender === gender ? 6 : -12;

  const voiceAge = label(voice, 'age');
  if (age === 'young' && voiceAge.includes('young')) score += 3;
  if (age === 'adult' && voiceAge.includes('middle')) score += 2;
  if (age === 'old' && (voiceAge.includes('old') || voiceAge.includes('senior'))) score += 3;

  const language = `${label(voice, 'language')} ${label(voice, 'accent')}`;
  if (/(german|deutsch|\bde\b)/.test(language)) score += 2;

  const useCase = `${label(voice, 'use_case')} ${label(voice, 'use case')}`;
  if (/(conversational|narrat|character|characters)/.test(useCase)) score += 1;

  if (usedVoiceIds.has(voice.id)) score -= 20;
  return score;
};

/** Beste Stimme für einen Sprecher, oder '' wenn keine Stimmen geladen sind. */
export const suggestVoiceForSpeaker = (
  hint: SpeakerVoiceHint,
  voices: CastableVoice[],
  usedVoiceIds: Set<string>,
): string => {
  if (voices.length === 0) return '';
  const gender = hint.gender ?? inferSpeakerGender(hint.name);
  const age = inferSpeakerAge(hint);

  let best = voices[0];
  let bestScore = -Infinity;
  for (const voice of voices) {
    const score = scoreVoice(voice, gender, age, usedVoiceIds);
    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }
  return best.id;
};
