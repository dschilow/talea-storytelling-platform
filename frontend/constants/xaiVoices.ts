export const XAI_VOICES = [
  { id: 'eve', name: 'Eve', description: 'Energetisch, aufgeweckt' },
  { id: 'ara', name: 'Ara', description: 'Warm, freundlich' },
  { id: 'rex', name: 'Rex', description: 'Selbstsicher, klar' },
  { id: 'sal', name: 'Sal', description: 'Ruhig, ausgeglichen' },
  { id: 'leo', name: 'Leo', description: 'Autoritaer, kraeftig' },
  { id: 'carina', name: 'Carina', description: 'Sanft, einfuehlsam, beruhigend' },
  { id: 'luna', name: 'Luna', description: 'Sanft, geduldig, fuersorglich' },
  { id: 'iris', name: 'Iris', description: 'Freundlich, froehlich, charmant' },
  { id: 'celeste', name: 'Celeste', description: 'Mitfuehlend, zuversichtlich, beruhigend' },
  { id: 'ursa', name: 'Ursa', description: 'Freundlich, warm, verlaesslich' },
  { id: 'una', name: 'Una', description: 'Neue Stimme' },
  { id: 'naksh', name: 'Naksh', description: 'Warm, nachdenklich, weise' },
  { id: 'lux', name: 'Lux', description: 'Ruhig, geerdet, weise' },
  { id: 'lumen', name: 'Lumen', description: 'Warm, wortgewandt, fesselnd' },
  { id: 'cosmo', name: 'Cosmo', description: 'Hell, neugierig, leicht verstaendlich' },
  { id: 'castor', name: 'Castor', description: 'Charismatisch, bodenstaendig, entspannt' },
  { id: 'sirius', name: 'Sirius', description: 'Schlagfertig, clever, verspielt' },
  { id: 'helios', name: 'Helios', description: 'Froehlich, energiegeladen, vielseitig' },
  { id: 'kepler', name: 'Kepler', description: 'Erfinderisch, charismatisch' },
  { id: 'orion', name: 'Orion', description: 'Voll, filmisch, resonant' },
  { id: 'zagan', name: 'Zagan', description: 'Kraftvoll, dramatisch, unverwechselbar' },
  { id: 'helix', name: 'Helix', description: 'Kraeftig, dynamisch, mitreissend' },
  { id: 'altair', name: 'Altair', description: 'Elegant, edel, gepflegt' },
  { id: 'zenith', name: 'Zenith', description: 'Scharf, fokussiert, zielstrebig' },
  { id: 'perseus', name: 'Perseus', description: 'Stark, selbstsicher, vertrauenswuerdig' },
  { id: 'atlas', name: 'Atlas', description: 'Souveraen, bestimmt, beruhigend' },
  { id: 'rigel', name: 'Rigel', description: 'Praezise, professionell, gelassen' },
] as const;

export const XAI_DEFAULT_VOICE = 'eve';

export function getXaiVoiceOptions(): Array<{ id: string; name: string; description: string }> {
  return [...XAI_VOICES];
}

export function getXaiSpeakers(): string[] {
  return XAI_VOICES.map((v) => v.id);
}
