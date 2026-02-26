export type TTSVoiceMode = 'default' | 'preset' | 'speaker' | 'upload';

export interface PresetVoice {
  id: string;       // e.g. 'tavi', 'jorin', 'lucy'
  label: string;    // Display name
  audioPath: string; // Path under /voices/  e.g. '/voices/Tavi.mp3'
  description: string;
}

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
    return referenceAudioDataUrl ? { referenceAudioDataUrl } : {};
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
