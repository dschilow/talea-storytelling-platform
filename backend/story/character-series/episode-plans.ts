import { NEBELFEE_SERIES } from './series/nebelfee';
import { FUNKELFLUG_SERIES } from './series/funkelflug';
import { GRAF_GRIESGRAM_SERIES } from './series/graf-griesgram';
import { KAPITAEN_BLUBBERT_SERIES } from './series/kapitaen-blubbert';
import { TILDA_TUEFTEL_SERIES } from './series/tilda-tueftel';

export interface SeriesEnsembleMember {
  id: string;
  poolId: string;
  seriesId: string;
  name: string;
  /** First episode number (1..20) in which this character enters the series; hidden in earlier episodes. */
  debutEpisode: number;
  /** How this character makes their memorable, funny first entrance in their debut episode. */
  debutScene: string;
  species: string;
  speciesCategory: 'human' | 'animal' | 'magical_creature' | 'mythical';
  gender: 'male' | 'female' | 'neutral';
  ageCategory: 'child' | 'adult' | 'elder' | 'ageless';
  sizeCategory: 'tiny' | 'small' | 'medium' | 'large';
  role: string;
  archetype: string;
  comicRole: 'know-it-all' | 'boaster' | 'coward' | 'grump' | 'chaos' | 'literalist' | 'schemer' | 'dreamer' | 'fusspot';
  nature: string;
  origin: string;
  voice: string;
  catchphrase: string;
  catchphraseContext: string;
  speechStyle: string[];
  quirk: string;
  gesture: string;
  want: string;
  fear: string;
  secret: string;
  runningGag: string;
  introLine: string;
  look: string;
  signatureVisual: string;
  colorPalette: string[];
  canonSettings: string[];
  imageUrl?: string;
}

export interface SeriesEpisodeBlueprint {
  episode: number;
  season: 1 | 2;
  titleIdea: string;
  guestId: string | null;
  /** True when guestId makes their very first appearance in the series in this episode. */
  guestDebut?: boolean;
  hook: string;
  slapstick: string;
  suspense: string;
  /** Explicit role for the 1–3 participating child avatars so they are essential co-adventurers without eclipsing the series lead. */
  avatarRole?: string;
  joke: string;
  keyVisual: string;
  clue: string;
}

export interface SeriesPlanFile {
  seriesId: string;
  seasonTitles: { 1: string; 2: string };
  ensemble: SeriesEnsembleMember[];
  episodes: SeriesEpisodeBlueprint[];
}

export const SERIES_PLAN_FILES: Record<string, SeriesPlanFile> = {
  nebelfee: NEBELFEE_SERIES,
  funkelflug: FUNKELFLUG_SERIES,
  'graf-griesgram': GRAF_GRIESGRAM_SERIES,
  'kapitaen-blubbert': KAPITAEN_BLUBBERT_SERIES,
  'tilda-tueftel': TILDA_TUEFTEL_SERIES,
};

export const SERIES_ENSEMBLE_BIBLES: SeriesEnsembleMember[] = Object.values(SERIES_PLAN_FILES).flatMap(
  (series) => series.ensemble,
);

export const SERIES_EPISODE_PLANS: Record<string, SeriesEpisodeBlueprint[]> = Object.fromEntries(
  Object.values(SERIES_PLAN_FILES).map((series) => [series.seriesId, series.episodes]),
);

/**
 * Returns the concrete episode blueprint for episode N (1..20).
 * Episodes beyond 20 cycle with evolved variations while preserving the full unlocked cast.
 */
export function getSeriesEpisodeBlueprint(seriesId: string, episode: number): SeriesEpisodeBlueprint | undefined {
  const list = SERIES_EPISODE_PLANS[seriesId];
  if (!list?.length) return undefined;
  const index = Math.max(0, Math.min(list.length - 1, ((Math.max(1, episode) - 1) % list.length)));
  return list[index];
}

/**
 * Returns only the ensemble characters that have debuted at or before `episode`.
 * Characters with `debutEpisode > episode` remain hidden so they can make a real surprise debut later.
 */
export function getUnlockedSeriesEnsemble(seriesId: string, episode: number): SeriesEnsembleMember[] {
  const file = SERIES_PLAN_FILES[seriesId];
  if (!file) return [];
  return file.ensemble.filter((member) => member.debutEpisode <= episode);
}
