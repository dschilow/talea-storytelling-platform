/**
 * Storybook Pipeline — casting shortlist and artifact options (pure).
 *
 * The pool offers candidates; the story chooses. storybook-v1 assigned pool
 * characters to fixed role slots before a story existed. Here the concept
 * stage sees a varied shortlist (someone who makes trouble, someone who
 * helps, a creature a child can picture at once) and casts whoever the best
 * pitch actually needs.
 *
 * Characters without a reference image are only a last resort: a character
 * the illustrator cannot reference is drawn differently on every page.
 */

import type { ArtifactOption, CastCandidate } from "./types";
import type { AgeBand } from "./craft";

type Row = Record<string, any>;

function asObject(value: unknown): Row {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
}

function list(value: unknown, max = 6): string[] {
  const source = typeof value === "string" ? (() => { try { return JSON.parse(value); } catch { return []; } })() : value;
  return Array.isArray(source) ? source.map((entry) => String(entry ?? "").trim()).filter(Boolean).slice(0, max) : [];
}

function text(value: unknown, max = 300): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function stableHash(value: string): number {
  return [...value].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 17);
}

export type CastFunction = "trouble" | "helper" | "creature" | "grownup" | "other";

export function castFunctionOf(row: Row): CastFunction {
  const role = text(row.role, 40).toLowerCase();
  const archetype = text(row.archetype, 60).toLowerCase();
  const species = text(row.species_category ?? row.speciesCategory, 40).toLowerCase();
  if (["antagonist", "obstacle"].includes(role) || /villain|trickster|rival|grump|guardian_challenge/.test(archetype)) return "trouble";
  if (["animal", "magical_creature", "mythical", "elemental"].includes(species) || /animal|creature|dragon|sprite/.test(archetype)) return "creature";
  if (["authority", "mentor", "guide"].includes(role) || /ruler|mentor|elder|authority|royal/.test(archetype)) return "grownup";
  if (["companion", "helper", "support", "discovery", "special", "main", "neutral"].includes(role)) return "helper";
  return "other";
}

/** Normalises a pool row (DB snake_case or the exported camelCase) into a candidate. */
export function toCastCandidate(row: Row): CastCandidate | null {
  const id = text(row.id, 120);
  const name = text(row.name, 80);
  if (!id || !name) return null;
  const emotional = asObject(row.emotional_nature ?? row.emotionalNature);
  const physical = text(row.physical_description ?? row.physicalDescription, 400);
  const personality = [
    text(row.dominant_personality ?? row.dominantPersonality, 40),
    ...list(row.secondary_traits ?? row.secondaryTraits, 4),
    ...list(row.personality_keywords ?? row.personalityKeywords, 4),
    text(emotional.dominant, 40),
  ].filter(Boolean);
  const firstClause = physical.split(/[.;]/)[0].trim();
  return {
    id,
    name,
    species: text(row.species_category ?? row.speciesCategory, 40) || "any",
    ageCategory: text(row.age_category ?? row.ageCategory, 40) || null,
    role: text(row.role, 40) || null,
    archetype: text(row.archetype, 60) || null,
    whoTheyAre: firstClause || text(row.backstory, 160) || "eine Figur aus der Gegend",
    personality: [...new Set(personality)].slice(0, 5),
    speechStyle: list(row.speech_style ?? row.speechStyle, 3),
    quirk: text(row.quirk, 160) || undefined,
    catchphrase: text(row.catchphrase, 120) || undefined,
    catchphraseContext: text(row.catchphrase_context ?? row.catchphraseContext, 160) || undefined,
    imageUrl: text(row.image_url ?? row.imageUrl, 2000) || undefined,
    visualProfile: asObject(row.visual_profile ?? row.visualProfile),
    physicalDescription: physical || undefined,
  };
}

const GENRE_SETTINGS: Record<string, string[]> = {
  fairy_tales: ["fantasy", "medieval", "castle", "forest", "village"],
  magic: ["fantasy", "castle", "forest", "mountain"],
  adventure: ["forest", "mountain", "beach", "coast", "cave", "river", "village"],
  animals: ["forest", "village", "garden", "river", "home"],
  scifi: ["space", "city", "school", "workshop"],
  modern: ["city", "home", "school", "village", "market"],
};

export interface ShortlistInput {
  rows: Row[];
  genre?: string;
  setting?: string;
  band: AgeBand;
  excludeNames: Set<string>;
  seed: string;
  limit?: number;
  now?: number;
}

/** A varied shortlist of up to `limit` candidates, best fit first. */
export function shortlistCastCandidates(input: ShortlistInput): CastCandidate[] {
  const limit = input.limit ?? 6;
  const now = input.now ?? Date.now();
  const setting = text(input.setting, 40).toLowerCase();
  const genreSettings = GENRE_SETTINGS[text(input.genre, 40).toLowerCase()] || [];

  // A pool "Prinz Alexander" next to a hero Alexander confuses every child:
  // exclude any character sharing a name part with a hero.
  const heroTokens = new Set(
    [...input.excludeNames].flatMap((name) => name.split(/\s+/)).map((token) => token.toLocaleLowerCase("de-DE")).filter((token) => token.length >= 3)
  );
  const clashesWithHero = (name: string) =>
    name.split(/\s+/).some((token) => heroTokens.has(token.replace(/[^\p{L}-]/gu, "").toLocaleLowerCase("de-DE")));

  // Pool rows are duplicated (with and without image). Keep the richest per name.
  const byName = new Map<string, Row>();
  for (const row of input.rows) {
    if (row.is_active === false || row.isActive === false) continue;
    const name = text(row.name, 80);
    const key = name.toLocaleLowerCase("de-DE");
    if (!name || input.excludeNames.has(key) || clashesWithHero(name)) continue;
    const existing = byName.get(key);
    const hasImage = Boolean(row.image_url ?? row.imageUrl);
    if (!existing || (hasImage && !(existing.image_url ?? existing.imageUrl))) byName.set(key, row);
  }

  const scored = [...byName.values()].map((row) => {
    let score = 0;
    const canon = list(row.canon_settings ?? row.canonSettings, 10).map((entry) => entry.toLowerCase());
    if (setting && setting !== "varied" && canon.includes(setting)) score += 24;
    const genreHits = canon.filter((entry) => genreSettings.includes(entry)).length;
    score += Math.min(3, genreHits) * 8;
    if (canon.length === 0) score += 4;

    if (row.image_url ?? row.imageUrl) score += 30;
    if (text(row.catchphrase)) score += 6;
    if (text(row.quirk)) score += 8;
    if (list(row.speech_style ?? row.speechStyle).length) score += 4;

    const fn = castFunctionOf(row);
    const species = text(row.species_category ?? row.speciesCategory, 40).toLowerCase();
    // Comic potential: the figures children remember are the tricksters,
    // the creatures and anyone with a visible tic — not the throne.
    if (fn === "trouble" && /trickster|grump/.test(text(row.archetype).toLowerCase())) score += 10;
    if (fn === "creature") score += 6;
    if (fn === "grownup" && /ruler|royal/.test(text(row.archetype).toLowerCase())) score -= 6;
    // Small listeners: vivid creatures and gentle helpers; no abstract fear villains.
    if (input.band === "3-5") {
      if (fn === "creature") score += 12;
      if (fn === "trouble" && /villain/.test(text(row.archetype).toLowerCase())) score -= 30;
    } else if (input.band === "6-8" && (species === "animal" || species === "magical_creature" || species === "mythical")) {
      score += 6;
    }

    // Rotation: recently used characters rest.
    const recent = Number(row.recent_usage_count ?? row.recentUsageCount) || 0;
    const total = Number(row.total_usage_count ?? row.totalUsageCount) || 0;
    score += Math.max(0, 14 - recent * 3) - Math.min(total, 40) * 0.15;
    const lastUsed = row.last_used_at ?? row.lastUsedAt;
    if (lastUsed) {
      const days = (now - new Date(lastUsed).getTime()) / 86_400_000;
      if (Number.isFinite(days) && days < 2) score -= 10;
    }
    score += (stableHash(`${input.seed}:${text(row.id)}`) % 1000) / 60; // up to ~16 points of variety
    return { row, fn, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Variety: one of each main function first, then fill under per-function caps.
  const caps: Record<CastFunction, number> = { trouble: 2, helper: 2, creature: 2, grownup: 1, other: 1 };
  const picked: typeof scored = [];
  const count = (fn: CastFunction) => picked.filter((entry) => entry.fn === fn).length;
  for (const fn of ["trouble", "helper", "creature"] as CastFunction[]) {
    const best = scored.find((entry) => entry.fn === fn && !picked.includes(entry));
    if (best) picked.push(best);
  }
  for (const entry of scored) {
    if (picked.length >= limit) break;
    if (picked.includes(entry) || count(entry.fn) >= caps[entry.fn]) continue;
    picked.push(entry);
  }
  // A tiny pool may not fill the caps; top up with whatever is left.
  for (const entry of scored) {
    if (picked.length >= limit) break;
    if (!picked.includes(entry)) picked.push(entry);
  }
  return picked
    .slice(0, limit)
    .sort((a, b) => b.score - a.score)
    .map((entry) => toCastCandidate(entry.row))
    .filter((candidate): candidate is CastCandidate => Boolean(candidate));
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

export function toArtifactOption(row: Row, language = "de"): ArtifactOption | null {
  const id = text(row.id, 120);
  const german = !language || language.startsWith("de");
  const name = text(german ? row.name_de ?? row.name?.de : row.name_en ?? row.name?.en, 100) || text(row.name_de ?? row.name_en, 100);
  const rule = text(row.story_role ?? row.storyRole, 600);
  if (!id || !name || !rule) return null;
  return {
    id,
    name,
    nameEn: text(row.name_en ?? row.name?.en, 100) || undefined,
    description: text(german ? row.description_de ?? row.description?.de : row.description_en ?? row.description?.en, 400) || undefined,
    category: text(row.category, 40) || undefined,
    rarity: text(row.rarity, 40) || undefined,
    rule,
    visualKeywords: list(row.visual_keywords ?? row.visualKeywords, 8),
    emoji: text(row.emoji, 8) || undefined,
    imageUrl: text(row.image_url ?? row.imageUrl, 2000) || undefined,
  };
}

const GENRE_AFFINITY: Record<string, string> = {
  fairy_tales: "genre_fantasy",
  magic: "genre_fantasy",
  adventure: "genre_adventure",
  animals: "genre_nature",
  scifi: "genre_learning",
  modern: "genre_friendship",
};

/** Up to three reward options: never owned, never a crown, never legendary, genre first. */
export function selectRewardArtifacts(input: {
  rows: Row[];
  genre?: string;
  excludeIds: Set<string>;
  seed: string;
  language?: string;
  limit?: number;
}): ArtifactOption[] {
  const affinity = GENRE_AFFINITY[text(input.genre, 40).toLowerCase()] || "genre_adventure";
  return input.rows
    .filter((row) => row.is_active !== false && row.isActive !== false)
    .filter((row) => !input.excludeIds.has(text(row.id, 120)))
    .filter((row) => text(row.rarity, 20).toLowerCase() !== "legendary")
    .map((row) => ({
      row,
      score: (Number(row[affinity]) || 0.5) * 10 - (Number(row.recent_usage_count) || 0) * 0.5 + (stableHash(`${input.seed}:${text(row.id)}`) % 1000) / 200,
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => toArtifactOption(entry.row, input.language))
    .filter((option): option is ArtifactOption => Boolean(option))
    .slice(0, input.limit ?? 3);
}
