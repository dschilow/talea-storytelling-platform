/**
 * Talea library (mode 1: pre-produced stories) — shared data shapes.
 *
 * A series is defined by a versioned SeriesBible (world, rules, formula,
 * invariants, season arcs). Its characters live in their own table so an
 * admin can edit and extend them; the bible JSON only seeds them once.
 * Episodes are the canon: written once, reviewed by a human, then published
 * for every child at the same time. Nothing here depends on Encore.
 */

export type ContentStatus = "planned" | "generating" | "in_review" | "approved" | "published" | "failed";

export type CharacterRole = "protagonist" | "sidekick" | "antagonist" | "recurring";

export interface EpisodeRef {
  season: number;
  episode: number;
}

export interface SeriesCharacter {
  id: string;
  name: string;
  role: CharacterRole;
  ageYears?: number;
  /** German. */
  personality: string;
  /** German, including catchphrases. */
  speechStyle: string;
  /** English, image prompts only. */
  visualProfileEn: string;
  /** Reference picture of the character (public path or stored URL); every scene with this character uses it. */
  referenceStripKey: string;
  allowedInBranches: boolean;
  /** Retired characters stay readable in old episodes but are never written into new ones. */
  active?: boolean;
}

export interface SeasonArc {
  season: number;
  title: string;
  mystery: string;
  clues: Array<{ episode: number; clue: string }>;
  /** Never part of a writing context before the finale. */
  resolution: string;
}

export interface SeriesBible {
  seriesId: string;
  version: number;
  world: { setting: string; tone: string; rules: string[] };
  characters: SeriesCharacter[];
  runningGags: string[];
  catchphrases: string[];
  /** Beat structure every episode follows. */
  episodeFormula: string[];
  /** Facts no story may change. */
  canonInvariants: string[];
  forbiddenTopics: string[];
  seasonArcs: SeasonArc[];
  imageStyleEn: string;
  /** Rules for later avatar adventures in this world (mode 2); stored, not used yet. */
  branch?: Record<string, string>;
}

export interface SeriesInfo {
  id: string;
  slug: string;
  title: string;
  logline: string;
  genre: string;
  status: "draft" | "active" | "paused" | "completed";
  activeBibleVersion: number;
  releaseCadence: { weekday: number; hourLocal: number; timezone: string };
  freeEpisodeCount: number;
  collectibleType: "flunker_card" | "monster_profile" | string;
  /** "Nächsten Freitag" / "Nächste Woche" — how the teaser line starts. */
  teaserPrefix: string;
  ageBand: string;
  sortOrder: number;
  coverImageUrl?: string;
}

export interface SeriesSeed {
  series: SeriesInfo;
  bible: SeriesBible;
}

export interface SeasonPlanEntry {
  episode: number;
  title: string;
  logline: string;
  /** Series-specific columns of the season table (Flunkerei, Monster, Schwäche …). */
  plan: Record<string, string>;
  clue: string;
}

export interface SeasonSeed {
  seriesId: string;
  season: number;
  title: string;
  episodes: SeasonPlanEntry[];
}

/** One picture: the cover (no paragraph) or a chapter picture placed after a paragraph (0-based). */
export interface ImageSlot {
  url?: string;
  afterParagraph?: number;
  /** English scene description: place, action, who does what. */
  sceneEn: string;
  /** Series character ids and guest ids that appear in the picture. */
  characterIds: string[];
  /** Clothes that differ from the reference for this one picture, by figure id (English). */
  outfits?: Record<string, string>;
  /**
   * Where each figure stands: [top, left, bottom, right] on a 0–1000 scale of
   * the picture, by figure id. The scene text names figures as [id].
   */
  boxes?: Record<string, number[]>;
}

export interface EpisodeChapter {
  title: string;
  text: string;
  image?: ImageSlot;
}

/** A figure that only exists in this episode (the monster of the week, Hugo the pony-dog …). */
export interface EpisodeGuest {
  id: string;
  name: string;
  role?: string;
  visualProfileEn: string;
  referenceUrl?: string;
}

export interface Collectible {
  type: string;
  title: string;
  imageUrl?: string;
  fields: Array<{ label: string; value: string }>;
}

export interface EpisodeContent {
  title: string;
  summary: string;
  cover: ImageSlot;
  guests: EpisodeGuest[];
  chapters: EpisodeChapter[];
  collectible: Collectible;
  teaser: string;
  canonFactsAdded: string[];
}

export interface EpisodeSeed extends EpisodeContent {
  seriesId: string;
  season: number;
  episode: number;
  publishAt: string;
}

/** Scores of the independent reader, 0–10 per dimension (concept: minimum 9 everywhere). */
export interface EpisodeScores {
  dimensions: Record<string, number>;
  notes: string[];
  mustFix: string[];
  passed: boolean;
}
