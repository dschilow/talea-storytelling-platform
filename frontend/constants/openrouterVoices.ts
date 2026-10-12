// Mirrors OPENROUTER_TTS_VOICES in backend/tts/openrouter-tts.ts (the backend maps id -> model + voice).
// Prices measured 2026-10-12 on a German story passage; xAI Grok lists at 1,5 ct/1000 Zeichen.
export const OPENROUTER_VOICES = [
  { id: 'gemini-lite:sulafat', name: 'Gemini Lite - Sulafat', description: 'warm, ca. 1,3 ct/1000 Zeichen' },
  { id: 'gemini-lite:achird', name: 'Gemini Lite - Achird', description: 'freundlich, ca. 1,1 ct/1000 Zeichen' },
  { id: 'gemini-lite:kore', name: 'Gemini Lite - Kore', description: 'klar, ca. 1,2 ct/1000 Zeichen' },
  { id: 'gemini-lite:charon', name: 'Gemini Lite - Charon', description: 'maennlich, ca. 1,3 ct/1000 Zeichen' },
  { id: 'gemini-flash:sulafat', name: 'Gemini Flash - Sulafat', description: 'ausdrucksstaerker, ca. 1,6 ct/1000 Zeichen' },
  { id: 'gemini-flash:achird', name: 'Gemini Flash - Achird', description: 'ausdrucksstaerker, ca. 1,8 ct/1000 Zeichen' },
  { id: 'mai:klaus', name: 'Microsoft MAI - Klaus', description: 'deutsch, 1,5 ct/1000 Zeichen' },
  { id: 'mai:mia', name: 'Microsoft MAI - Mia', description: 'deutsch, 1,5 ct/1000 Zeichen' },
  { id: 'fish:captain', name: 'Fish Audio - Captain Comedy', description: 'Klon, Gratis-Testvariante' },
] as const;

export const OPENROUTER_DEFAULT_VOICE = 'gemini-lite:sulafat';

export function getOpenRouterVoiceOptions(): Array<{ id: string; name: string; description: string }> {
  return [...OPENROUTER_VOICES];
}
