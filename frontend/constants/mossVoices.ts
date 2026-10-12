export const MOSS_VOICES = [
  { id: 'captain_comedy', name: 'Captain Comedy (MOSS)', description: 'Erzaehlstimme, Klon aus ElevenLabs-Referenz' },
  { id: 'thorsten_neutral', name: 'Thorsten (MOSS)', description: 'Hochdeutsch, geklonte Stimme' },
] as const;

export const MOSS_DEFAULT_VOICE = 'captain_comedy';

export function getMossVoiceOptions(): Array<{ id: string; name: string; description: string }> {
  return [...MOSS_VOICES];
}
