import i18n from '../src/i18n';

/**
 * Stories carry genre ids from several pipelines: the wizard sends "fairy-tales",
 * older stories "fairy_tales", the fairy-tale lane "classical-fairy-tales". The
 * translations only know the underscore ids, so a hyphenated id used to reach
 * the page raw ("fairy tales", "magical worlds").
 */
const GENRE_ALIASES: Record<string, string> = {
  fairy_tale: 'fairy_tales',
  fairytales: 'fairy_tales',
  classical_fairy_tales: 'fairy_tales',
  maerchen: 'fairy_tales',
  magical_worlds: 'magic',
  sci_fi: 'scifi',
  science_fiction: 'scifi',
};

/** German words for ids the translations do not list (yet). */
const GERMAN_FALLBACK: Record<string, string> = {
  everyday: 'Alltag',
  space: 'Weltraum',
  mystery: 'Rätsel',
  fantasy: 'Fantasy',
  friendship: 'Freundschaft',
  bedtime: 'Gute Nacht',
  gute_nacht: 'Gute Nacht',
  funny: 'Lustig',
  nature: 'Natur',
  ocean: 'Meer',
  dinosaurs: 'Dinosaurier',
  pirates: 'Piraten',
  knights: 'Ritter',
  detective: 'Detektiv',
  sports: 'Sport',
  holidays: 'Feiertage',
  christmas: 'Weihnachten',
};

export function normalizeGenreId(genre: string | undefined | null): string {
  const id = String(genre ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return GENRE_ALIASES[id] ?? id;
}

/** "Märchen" for "fairy-tales"; a readable word for an unknown id, never the raw key. */
export function genreLabel(genre: string | undefined | null): string {
  const id = normalizeGenreId(genre);
  if (!id) return '';
  const translated = i18n.t(`storiesScreen.genre.${id}`, { defaultValue: '' });
  if (typeof translated === 'string' && translated) return translated;
  const language = (i18n.language || 'de').split('-')[0];
  if (language === 'de' && GERMAN_FALLBACK[id]) return GERMAN_FALLBACK[id];
  return id
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
