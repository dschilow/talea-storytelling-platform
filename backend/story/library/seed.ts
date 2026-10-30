/**
 * The library seed, bundled with the backend (JSON files are imported, not
 * read from disk: the production image is built by `encore build docker` and
 * carries no loose files). Pictures referenced here live in
 * frontend/public/library and are served by the web app.
 */

import brunoBible from "./seed/series/bruno-der-flunkerfisch.bible.json";
import brunoBibleV1 from "./seed/series/bruno-der-flunkerfisch.bible-v1.json";
import brunoSeason1 from "./seed/series/bruno-der-flunkerfisch.season-1.json";
import brunoS1E1 from "./seed/episodes/bruno-der-flunkerfisch.s1e1.json";
import brunoS1E2 from "./seed/episodes/bruno-der-flunkerfisch.s1e2.json";
import brunoS1E3 from "./seed/episodes/bruno-der-flunkerfisch.s1e3.json";
import monsterBible from "./seed/series/die-monster-muellabfuhr.bible.json";
import monsterBibleV1 from "./seed/series/die-monster-muellabfuhr.bible-v1.json";
import monsterSeason1 from "./seed/series/die-monster-muellabfuhr.season-1.json";
import monsterS1E1 from "./seed/episodes/die-monster-muellabfuhr.s1e1.json";
import monsterS1E2 from "./seed/episodes/die-monster-muellabfuhr.s1e2.json";
import monsterS1E3 from "./seed/episodes/die-monster-muellabfuhr.s1e3.json";
import type { EpisodeSeed, SeasonSeed, SeriesSeed } from "./types";

export const SEED_SERIES: SeriesSeed[] = [brunoBible as unknown as SeriesSeed, monsterBible as unknown as SeriesSeed];
export const SEED_LEGACY_BIBLES: SeriesSeed[] = [brunoBibleV1 as unknown as SeriesSeed, monsterBibleV1 as unknown as SeriesSeed];
export const SEED_SEASONS: SeasonSeed[] = [brunoSeason1 as unknown as SeasonSeed, monsterSeason1 as unknown as SeasonSeed];
export const SEED_EPISODES: EpisodeSeed[] = [
  brunoS1E1 as unknown as EpisodeSeed,
  brunoS1E2 as unknown as EpisodeSeed,
  brunoS1E3 as unknown as EpisodeSeed,
  monsterS1E1 as unknown as EpisodeSeed,
  monsterS1E2 as unknown as EpisodeSeed,
  monsterS1E3 as unknown as EpisodeSeed,
];

export function episodeId(seriesId: string, season: number, episode: number): string {
  return `${seriesId}-s${season}e${episode}`;
}

/** Stable fingerprint of a seed file, so a corrected seed replaces its own earlier version (never an admin's edit). */
export function seedHash(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
