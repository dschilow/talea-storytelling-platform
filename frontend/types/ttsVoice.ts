export type TTSVoiceMode = 'default' | 'preset' | 'speaker' | 'upload';

export interface PresetVoice {
  id: string;       // e.g. 'tavi', 'jorin', 'lucy'
  label: string;    // Display name
  audioPath: string; // Path under /voices/  e.g. '/voices/Tavi.mp3'
  description: string;
}

export const PRESET_VOICES_REFERENCE_TEXT =
  'Es ist gleich soweit. Atme einmal ruhig ein… und aus. Heute beginnt eine Geschichte, die leise startet – und dann plötzlich funkelt. Draußen raschelt ein Baum im Wind. Drinnen ist es warm. Auf dem Teppich liegt ein kleiner Schlüssel. Und daneben ein Zettel mit drei Wörtern: „Nur für Mutige." „Ähm… ist das deiner?", fragt Mila. „Nein", sagt Ben. „Aber… ich glaube, er wartet auf uns." Ganz vorsichtig hebt Ben den Schlüssel hoch. Er ist kalt, glatt, und ein bisschen schwerer als gedacht. Da hört man ein winziges Klick – als würde irgendwo eine Tür lächeln. „Hast du das gehört?", flüstert Mila. „Ja", flüstert Ben zurück. „Und jetzt… leise. Eins, zwei, drei." Sie zählen ihre Schritte: vier, fünf, sechs. Dann bleiben sie stehen. Vor ihnen schimmert etwas, als hätte jemand Sternenstaub auf die Luft gestreut. Mila staunt: „Wow… das ist ja wunderschön!" Ben lacht leise: „Okay. Das ist offiziell das Verrückteste, was uns je passiert ist." Und dann – ganz nah – eine Stimme, freundlich und neugierig: „Seid ihr bereit? Wirklich bereit?" Ben schluckt. Mila nickt. „Ja", sagen beide. „Wir sind bereit." Und damit… öffnet sich das Abenteuer.';

export const PRESET_VOICES: PresetVoice[] = [
  {
    id: 'tavi',
    label: 'Tavi',
    audioPath: '/voices/Tavi.mp3',
    description: 'Warme Erzählerstimme',
  },
  {
    id: 'jorin',
    label: 'Jorin',
    audioPath: '/voices/Jorin.mp3',
    description: 'Kräftige Männerstimme',
  },
  {
    id: 'lucy',
    label: 'Lucy',
    audioPath: '/voices/Lucy.mp3',
    description: 'Lebhafte Frauenstimme',
  },
];

export interface TTSVoiceSettings {
  mode: TTSVoiceMode;
  presetVoiceId?: string;
  speakerId?: string;
  promptText?: string;
  referenceAudioDataUrl?: string;
}

export interface TTSRequestOptions {
  promptText?: string;
  referenceAudioDataUrl?: string;
  speaker?: string;
}

export const DEFAULT_TTS_VOICE_SETTINGS: TTSVoiceSettings = {
  mode: 'default',
};

export function buildTTSRequestOptions(settings?: TTSVoiceSettings): TTSRequestOptions {
  if (!settings || settings.mode === 'default') {
    return {};
  }

  if (settings.mode === 'preset') {
    // referenceAudioDataUrl gets set lazily when the preset is loaded
    const referenceAudioDataUrl = settings.referenceAudioDataUrl?.trim();
    const promptText = settings.promptText?.trim();
    return {
      ...(referenceAudioDataUrl ? { referenceAudioDataUrl } : {}),
      ...(promptText ? { promptText } : {}),
    };
  }

  if (settings.mode === 'speaker') {
    const speaker = settings.speakerId?.trim();
    return speaker ? { speaker } : {};
  }

  const referenceAudioDataUrl = settings.referenceAudioDataUrl?.trim();
  const promptText = settings.promptText?.trim();

  return {
    ...(referenceAudioDataUrl ? { referenceAudioDataUrl } : {}),
    ...(promptText ? { promptText } : {}),
  };
}

function hashString(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function buildTTSRequestCacheSuffix(request?: TTSRequestOptions): string {
  if (!request) return 'voice-default';

  const speakerPart = request.speaker?.trim().toLowerCase() || 'default';
  const promptPart = request.promptText?.trim()
    ? `prompt-${hashString(request.promptText.trim())}`
    : 'prompt-none';
  const refPart = request.referenceAudioDataUrl?.trim()
    ? `ref-${hashString(request.referenceAudioDataUrl.trim())}`
    : 'ref-none';

  return `voice-${speakerPart}-${promptPart}-${refPart}`;
}

function normalizeChunkTextForCache(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function buildTTSChunkCacheKey(
  itemId: string,
  chunkText: string,
  cacheSuffix: string,
): string {
  const normalizedSuffix = cacheSuffix?.trim() || 'voice-default';
  const textHash = hashString(normalizeChunkTextForCache(chunkText));
  return `${itemId}:${normalizedSuffix}:text-${textHash}`;
}
