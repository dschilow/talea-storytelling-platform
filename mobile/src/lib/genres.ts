import { Castle, Compass, House, PawPrint, Rocket, Wand2, type LucideIcon } from 'lucide-react-native';

/**
 * Presentation metadata per story genre. Stored stories use `fairy_tales`; the
 * wizard (and the web) use `fairy-tales` — both resolve to the same entry.
 */
export interface GenreMeta {
  id: string;
  label: string;
  hue: string;
  Icon: LucideIcon;
  /** Matching pre-generated illustration (`storyCategory/<art>`). */
  art: string;
}

const GENRES: Record<string, GenreMeta> = {
  fairy_tales: { id: 'fairy_tales', label: 'Märchen', hue: '#E04DA3', Icon: Castle, art: 'fairy-tales' },
  adventure: { id: 'adventure', label: 'Abenteuer', hue: '#F07A2E', Icon: Compass, art: 'adventure' },
  magic: { id: 'magic', label: 'Magie', hue: '#7B55F0', Icon: Wand2, art: 'magic' },
  animals: { id: 'animals', label: 'Tiere', hue: '#22A866', Icon: PawPrint, art: 'animals' },
  scifi: { id: 'scifi', label: 'Sci-Fi', hue: '#2F8FEF', Icon: Rocket, art: 'scifi' },
  modern: { id: 'modern', label: 'Alltag', hue: '#14AFAE', Icon: House, art: 'modern' },
};

export const GENRE_LIST: GenreMeta[] = Object.values(GENRES);

export function genreMeta(genre: string | null | undefined): GenreMeta | null {
  if (!genre) return null;
  return GENRES[genre.replace(/-/g, '_')] ?? null;
}
