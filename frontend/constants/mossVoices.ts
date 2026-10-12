export const MOSS_VOICES = [
  { id: 'thorsten_neutral', name: 'Thorsten (MOSS)', description: 'Hochdeutsch, geklonte Stimme' },
] as const;

export const MOSS_DEFAULT_VOICE = 'thorsten_neutral';

export function getMossVoiceOptions(): Array<{ id: string; name: string; description: string }> {
  return [...MOSS_VOICES];
}
