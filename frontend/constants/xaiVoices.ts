export const XAI_VOICES = [
  { id: 'eve', name: 'Eve', description: 'Energetisch, aufgeweckt' },
  { id: 'ara', name: 'Ara', description: 'Warm, freundlich' },
  { id: 'rex', name: 'Rex', description: 'Selbstsicher, professionell' },
  { id: 'sal', name: 'Sal', description: 'Ruhig, ausgeglichen' },
  { id: 'leo', name: 'Leo', description: 'Autoritaer, kraeftig' },
] as const;

export const XAI_DEFAULT_VOICE = 'eve';

export function getXaiVoiceOptions(): Array<{ id: string; name: string; description: string }> {
  return [...XAI_VOICES];
}

export function getXaiSpeakers(): string[] {
  return XAI_VOICES.map((v) => v.id);
}
