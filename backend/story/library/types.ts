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
  /** How the series sounds as an audio drama (voices, music). */
  audio?: SeriesAudioDirection;
}

/** A voice in the audio drama: an ElevenLabs voice plus the acting note that colours every line. */
export interface VoiceRole {
  voiceId?: string;
  /** English, 1–4 words, sent as the base audio tag ("grumpy, gravelly, vain"). */
  persona?: string;
  /** The figure never talks (a cat, a talking truck that only honks): only sounds. */
  silent?: boolean;
}

export interface SeriesAudioDirection {
  narrator: VoiceRole;
  /** Default voices by character id; the admin's cast in the database wins over these. */
  cast: Record<string, VoiceRole>;
  /** English: instruments and feel of the series' own music (theme, bridges, scene cues). */
  scoreStyleEn: string;
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

/* ── Audio drama (Hörspiel) ─────────────────────────────────────────────── */

/** Music cues of a series score. Generated once per series and reused by every episode. */
export const SCORE_MOODS = ["theme", "bridge", "mischief", "adventure", "mystery", "heart", "spooky", "finale"] as const;
export type ScoreMood = (typeof SCORE_MOODS)[number];
/** Moods a scene may ask for (theme and bridge are placed by the timeline itself). */
export const SCENE_MOODS: ScoreMood[] = ["mischief", "adventure", "mystery", "heart", "spooky", "finale"];

/** A sound the screenplay asks for on one line. */
export interface ScriptSound {
  /** English sound-generation prompt: source, material, room. */
  sound: string;
  /** Word of the line the sound lands on; missing = the start of the line. */
  at?: string;
  /** Seconds, 0.5–6. */
  seconds?: number;
}

export interface ScriptLine {
  /** Speaker key (ERZAEHLER, ELLA, HUGO …). */
  speaker: string;
  /** Spoken text with Eleven v4 audio tags. */
  text: string;
  sounds?: ScriptSound[];
}

export interface ScriptScene {
  /** First line of the scene within its part (0-based). */
  startLine: number;
  /** German, for the admin: where and when. */
  place: string;
  /** English ambience prompt, empty = no bed. */
  ambience?: string;
  /** "low" | "normal" | "high" — how present the place sounds. */
  ambienceLevel?: "low" | "normal" | "high";
  music?: ScoreMood | null;
}

/** One rendered block: the opening, a chapter, the closing. */
export interface ScriptPart {
  kind: "opening" | "chapter" | "closing";
  chapterIndex?: number;
  title: string;
  lines: ScriptLine[];
  scenes: ScriptScene[];
}

export interface ScriptSpeaker {
  key: string;
  name: string;
  /** Series character id, guest id or "narrator"; extras of the episode have none. */
  characterId?: string;
  voiceId: string;
  voiceName?: string;
  persona: string;
  source: "admin" | "series" | "auto" | "episode";
}

/** The audio screenplay (Drehbuch) an episode is recorded from. */
export interface AudioScript {
  version: 1;
  speakers: ScriptSpeaker[];
  parts: ScriptPart[];
  /** Notes of the adaptation (dropped tags, unknown speakers …), for the admin. */
  notes: string[];
}

export interface EpisodeAudio {
  status: "generating" | "ready" | "failed";
  step?: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  /** Children hear it only when released (and when they may read the episode). */
  released: boolean;
  /** Release on its own as soon as the render is done (chosen at approval). */
  autoRelease?: boolean;
  /** Stored bucket URL of the mastered MP3. */
  url?: string;
  durationSeconds?: number;
  /** Start of each chapter in the master, in seconds. */
  chapterStarts?: number[];
  /** Fingerprint of the episode text the drama was made from (text edited later = stale). */
  textHash?: string;
  script?: AudioScript;
  stats?: {
    llmCostUSD?: number;
    voiceCharacters?: number;
    sounds?: number;
    soundAssets?: number;
    music?: string;
    seconds?: number;
    /** Takes recorded and how many had to be recorded again after the listening check. */
    takes?: number;
    retakes?: number;
  };
}

/** Scores of the independent reader, 0–10 per dimension (concept: minimum 9 everywhere). */
export interface EpisodeScores {
  dimensions: Record<string, number>;
  notes: string[];
  mustFix: string[];
  passed: boolean;
}
