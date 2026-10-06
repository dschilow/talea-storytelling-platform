export const THORSTEN_VOICES = [
  { id: 'thorsten', name: 'Thorsten', description: 'Hochdeutsch, ruhig und klar' },
] as const;

export const THORSTEN_DEFAULT_VOICE = 'thorsten';

export function getThorstenVoiceOptions(): Array<{ id: string; name: string; description: string }> {
  return [...THORSTEN_VOICES];
}
