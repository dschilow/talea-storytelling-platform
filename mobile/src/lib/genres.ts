/**
 * Display labels per story genre. Stored stories use `fairy_tales`; the wizard
 * (and the web) use `fairy-tales` — both resolve to the same entry.
 */
export interface GenreMeta {
  id: string;
  label: string;
}

const GENRES: Record<string, GenreMeta> = {
  fairy_tales: { id: 'fairy_tales', label: 'Märchen' },
  adventure: { id: 'adventure', label: 'Abenteuer' },
  magic: { id: 'magic', label: 'Magie' },
  animals: { id: 'animals', label: 'Tiere' },
  scifi: { id: 'scifi', label: 'Sci-Fi' },
  modern: { id: 'modern', label: 'Alltag' },
};

export function genreMeta(genre: string | null | undefined): GenreMeta | null {
  if (!genre) return null;
  return GENRES[genre.replace(/-/g, '_')] ?? null;
}
