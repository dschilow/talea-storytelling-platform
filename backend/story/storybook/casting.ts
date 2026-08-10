/**
 * Storybook Pipeline — casting.
 *
 * Inverted compared to the older engines: the PREMISE declares which role slots
 * it can genuinely use, and casting looks for the pool character whose existing
 * want fits that slot. If nothing fits, the slot stays empty.
 *
 * The old rule — "if the story still works after deleting that figure, rewrite
 * the beat" — forced every picked character onto the page whether or not the
 * premise wanted them, which is how Müller Hans ended up blocking a door and
 * saying his catchphrase and nothing else.
 */

import { storyDB } from "../db";
import { artifactMatcher } from "../artifact-matcher";
import { buildArtifactImageUrlForClient } from "../../helpers/image-proxy";
import type { ArtifactCategory, ArtifactRequirement, ArtifactTemplate } from "../types";
import type { Premise, RoleNeed, StorybookArtifact, StorybookCastMember } from "./types";

interface CharacterPoolRow {
  id: string;
  name: string;
  image_url: string | null;
  role: string | null;
  archetype: string | null;
  emotional_nature: any;
  visual_profile: any;
  age_category: string | null;
  species_category: string | null;
  size_category: string | null;
  personality_keywords: string[] | null;
  physical_description: string | null;
  backstory: string | null;
  dominant_personality: string | null;
  secondary_traits: string[] | null;
  catchphrase: string | null;
  catchphrase_context: string | null;
  speech_style: string[] | null;
  emotional_triggers: string[] | null;
  quirk: string | null;
  canon_settings: string[] | null;
  recent_usage_count: number | null;
  total_usage_count: number | null;
  last_used_at: Date | string | null;
}

/**
 * Which pool `role` / `archetype` values can carry which narrative slot.
 * Deliberately generous on the fallback side — an empty slot is better than a
 * wrong one, but a slightly-off fit still gives the writer a real person with
 * a catchphrase, a quirk and a voice.
 */
const ROLE_NEED_MATCHERS: Record<RoleNeed, { roles: string[]; archetypes: RegExp; bonus: RegExp | null }> = {
  gegenspieler: {
    roles: ["antagonist", "obstacle"],
    archetypes: /villain|trickster|rival|guardian_challenge|shadow/i,
    bonus: /frech|eitel|berechnend|gierig|stur|grummelig/i,
  },
  komplize: {
    roles: ["companion", "helper", "support", "main"],
    archetypes: /helper|companion|sidekick|hero|explorer|craftsman|helpful/i,
    bonus: /loyal|hilfsbereit|mutig|lustig|treu/i,
  },
  skeptiker: {
    roles: ["neutral", "support", "companion", "discovery"],
    archetypes: /observer|innocent|scholar|merchant|neutral|craftsman/i,
    bonus: /aufmerksam|nachdenklich|vorsichtig|klug|schüchtern|zögerlich/i,
  },
  autoritaet: {
    roles: ["authority", "mentor", "guide"],
    archetypes: /ruler|mentor|magical_mentor|elder|guardian|authority/i,
    bonus: /weise|gerecht|streng|bestimmt|väterlich/i,
  },
  kleiner_helfer: {
    roles: ["companion", "helper", "discovery", "special"],
    archetypes: /animal|creature|sprite|helper|companion|cosmic_visitor/i,
    bonus: /neugierig|verspielt|lustig|frech|verträumt/i,
  },
};

function asPlainObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function compactList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry || "").trim())
    .filter((entry) => entry.length > 0)
    .slice(0, max);
}

function ageGroupMaxAge(ageGroup?: string): number {
  const match = String(ageGroup || "").match(/(\d+)\s*-\s*(\d+)/);
  if (match) return Number(match[2]);
  if (String(ageGroup || "").includes("13")) return 14;
  return 8;
}

function daysSince(value: Date | string | null | undefined): number | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return (Date.now() - date.getTime()) / 86_400_000;
}

/**
 * A one-sentence "who is this" that the writer must place on the character's
 * first appearance. Built deterministically from the pool row so the pipeline
 * never has to pay a model to restate what the database already knows.
 */
function buildWhoTheyAre(row: CharacterPoolRow): string {
  const parts: string[] = [];
  const physical = String(row.physical_description || "").trim();
  const quirk = String(row.quirk || "").trim();
  const dominant = String(row.dominant_personality || "").trim();

  if (physical) {
    // Keep it to the first clause — a full paragraph does not belong in a
    // character-introducing sentence.
    parts.push(physical.split(/[.;]/)[0].trim());
  } else if (dominant) {
    parts.push(`jemand, der vor allem ${dominant} ist`);
  }
  if (quirk) parts.push(quirk);

  const joined = parts.filter(Boolean).join(", ");
  return joined || `eine Figur aus dem Dorf`;
}

/** The character's own want, derived from their triggers and personality. */
function buildWants(row: CharacterPoolRow, roleNeed: RoleNeed, premise: Premise): string {
  if (roleNeed === "gegenspieler") return premise.opponent.want;

  const triggers = compactList(
    (row.emotional_triggers && row.emotional_triggers.length > 0)
      ? row.emotional_triggers
      : asPlainObject(row.emotional_nature).triggers,
    2
  );
  const dominant = String(row.dominant_personality || "").trim();

  switch (roleNeed) {
    case "komplize":
      return triggers.length > 0
        ? `dabei sein und helfen, reagiert stark auf ${triggers.join(" und ")}`
        : "dabei sein und mit anpacken";
    case "skeptiker":
      return triggers.length > 0
        ? `erst verstehen, bevor mitgemacht wird; stört sich an ${triggers[0]}`
        : "erst verstehen, bevor mitgemacht wird";
    case "autoritaet":
      return dominant
        ? `dass alles seine Ordnung hat, weil ${dominant} zu sein für sie zählt`
        : "dass alles seine Ordnung hat";
    case "kleiner_helfer":
      return "mitkommen und irgendwo dazwischenfunken";
    default:
      return "seinen eigenen Kopf durchsetzen";
  }
}

export interface CastingInput {
  premise: Premise;
  setting?: string;
  genre?: string;
  ageGroup?: string;
  /** Hero names — never cast a pool character with the same name. */
  excludeNames: Set<string>;
  userId?: string;
}

export interface CastingResult {
  cast: StorybookCastMember[];
  /** Slots the premise wanted but the pool could not fill. */
  unfilled: RoleNeed[];
  poolSize: number;
}

/**
 * Casts at most three supporting characters. Three is the ceiling because a
 * 6-8 year old holds roughly three names plus the heroes; beyond that the cast
 * itself becomes the comprehension problem.
 */
export async function castSupportingCharacters(input: CastingInput): Promise<CastingResult> {
  let rows: CharacterPoolRow[] = [];
  try {
    rows = await storyDB.queryAll<CharacterPoolRow>`
      SELECT id, name, image_url, role, archetype, emotional_nature, visual_profile,
             age_category, species_category, size_category, personality_keywords,
             physical_description, backstory, dominant_personality,
             secondary_traits, catchphrase, catchphrase_context,
             speech_style, emotional_triggers, quirk, canon_settings,
             recent_usage_count, total_usage_count, last_used_at
      FROM character_pool
      WHERE is_active = TRUE
    `;
  } catch (err) {
    console.warn("[storybook/casting] character_pool unavailable, continuing without supporting cast:", err);
    return { cast: [], unfilled: input.premise.roleNeeds, poolSize: 0 };
  }

  if (rows.length === 0) {
    return { cast: [], unfilled: input.premise.roleNeeds, poolSize: 0 };
  }

  const setting = String(input.setting || "").toLowerCase().trim();
  const ageMax = ageGroupMaxAge(input.ageGroup);
  const castBudget = ageMax <= 5 ? 2 : ageMax <= 8 ? 3 : 3;

  const available = rows.filter((row) => !input.excludeNames.has(String(row.name || "").toLowerCase()));

  const scoreFor = (row: CharacterPoolRow, roleNeed: RoleNeed): number => {
    const matcher = ROLE_NEED_MATCHERS[roleNeed];
    const role = String(row.role || "").toLowerCase();
    const archetype = String(row.archetype || "").toLowerCase();

    let score = 0;
    if (matcher.roles.includes(role)) score += 40;
    if (matcher.archetypes.test(`${role} ${archetype}`)) score += 24;
    if (score === 0) score -= 25; // wrong slot: allowed, but strongly discouraged

    const personality = [
      row.dominant_personality || "",
      ...(row.secondary_traits || []),
      ...(row.personality_keywords || []),
    ].join(" ");
    if (matcher.bonus && matcher.bonus.test(personality)) score += 12;

    // Setting fit.
    const canon = (row.canon_settings || []).map((entry) => String(entry).toLowerCase());
    if (setting && canon.length > 0) {
      if (canon.includes(setting)) score += 26;
      else if (canon.some((entry) => entry.includes(setting) || setting.includes(entry))) score += 12;
    } else if (canon.length === 0) {
      score += 6;
    }

    // Recognisability: a character without a voice is a name, not a figure.
    if (String(row.catchphrase || "").trim()) score += 10;
    if (String(row.quirk || "").trim()) score += 8;
    if ((row.speech_style || []).length > 0) score += 6;
    if (String(row.physical_description || "").trim()) score += 5;

    // Younger readers need vivid, instantly picturable figures.
    const species = String(row.species_category || "").toLowerCase();
    if (ageMax <= 8 && (species === "animal" || species === "magical_creature" || species === "mythical")) {
      score += 8;
    }

    // Rotation.
    const recent = Number(row.recent_usage_count) || 0;
    const total = Number(row.total_usage_count) || 0;
    score += Math.max(0, 16 - recent * 5);
    score -= Math.min(total, 30) * 0.2;
    if (total === 0) score += 6;
    const since = daysSince(row.last_used_at);
    if (typeof since === "number" && since < 3) score -= 8;

    score += Math.random() * 6;
    return score;
  };

  const cast: StorybookCastMember[] = [];
  const used = new Set<string>();
  const unfilled: RoleNeed[] = [];

  for (const roleNeed of input.premise.roleNeeds) {
    if (cast.length >= castBudget) {
      unfilled.push(roleNeed);
      continue;
    }
    const candidates = available
      .filter((row) => !used.has(row.id))
      .map((row) => ({ row, score: scoreFor(row, roleNeed) }))
      .sort((a, b) => b.score - a.score);

    const best = candidates[0];
    // Below zero means the pool has nothing for this slot. Leave it empty
    // rather than bolting on a character who cannot carry the function.
    if (!best || best.score < 0) {
      unfilled.push(roleNeed);
      continue;
    }

    const row = best.row;
    used.add(row.id);
    const visualProfile = asPlainObject(row.visual_profile);
    cast.push({
      id: row.id,
      name: String(row.name || "").trim(),
      roleNeed,
      whoTheyAre: buildWhoTheyAre(row),
      wants: buildWants(row, roleNeed, input.premise),
      catchphrase: String(row.catchphrase || "").trim() || undefined,
      catchphraseContext: String(row.catchphrase_context || "").trim() || undefined,
      speechStyle: compactList(row.speech_style, 3),
      quirk: String(row.quirk || "").trim() || undefined,
      imageUrl: row.image_url || undefined,
      visualProfile,
      physicalDescription: String(row.physical_description || "").trim() || undefined,
      species: row.species_category,
      ageCategory: row.age_category,
    });
  }

  return { cast, unfilled, poolSize: rows.length };
}

/** Records pool usage so the rotation actually rotates. Best-effort. */
export async function recordCastUsage(input: {
  storyId?: string;
  cast: StorybookCastMember[];
}): Promise<void> {
  if (!input.storyId || input.cast.length === 0) return;
  for (const member of input.cast) {
    try {
      await storyDB.exec`
        UPDATE character_pool
        SET recent_usage_count = COALESCE(recent_usage_count, 0) + 1,
            total_usage_count = COALESCE(total_usage_count, 0) + 1,
            last_used_at = NOW()
        WHERE id = ${member.id}
      `;
    } catch (err) {
      console.warn("[storybook/casting] failed to record pool usage", member.name, err);
    }
  }
}

const GENRE_TO_ARTIFACT_CATEGORY: Record<string, ArtifactCategory> = {
  adventure: "map",
  fantasy: "magic",
  magic: "magic",
  mystery: "book",
  nature: "nature",
  space: "tech",
  animals: "nature",
  dinosaurs: "nature",
  friendship: "jewelry",
  fairy_tales: "magic",
};

export interface ArtifactCastingInput {
  premise: Premise;
  genre?: string;
  setting?: string;
  ageGroup?: string;
  language?: string;
  storyId?: string;
  /** Artifact ids the participating avatars already own — never award twice. */
  excludeIds?: string[];
}

/**
 * Picks an artifact ONLY when the premise declares a slot for it. Most premises
 * do not: a prop that is "mentioned briefly as background detail" costs tokens
 * and confuses a child who then waits for it to matter.
 */
export async function castArtifact(
  input: ArtifactCastingInput
): Promise<{ artifact?: StorybookArtifact; template?: ArtifactTemplate }> {
  if (!input.premise.artifactSlot) return {};

  const requirement: ArtifactRequirement = {
    placeholder: "{{ARTIFACT_REWARD}}",
    preferredCategory: GENRE_TO_ARTIFACT_CATEGORY[String(input.genre || "").toLowerCase()],
    contextHint: `${input.premise.situation} Der Gegenstand liegt am Ende als Fundstück bereit.`,
    discoveryChapter: 2,
    usageChapter: 4,
    importance: "medium",
  };

  try {
    const template = await artifactMatcher.match(
      requirement,
      String(input.genre || "adventure"),
      [],
      String(input.language || "de"),
      { excludeArtifactIds: new Set(input.excludeIds || []) }
    );
    if (!template || !template.id) return {};

    const isGerman = String(input.language || "de").toLowerCase().startsWith("de");
    return {
      template,
      artifact: {
        id: template.id,
        name: isGerman ? template.name?.de : template.name?.en,
        nameEn: template.name?.en,
        description: isGerman ? template.description?.de : template.description?.en,
        category: template.category,
        rarity: template.rarity,
        storyRole: template.storyRole,
        visualKeywords: Array.isArray(template.visualKeywords) ? template.visualKeywords : [],
        emoji: template.emoji,
        imageUrl: await buildArtifactImageUrlForClient(template.id, template.imageUrl),
      },
    };
  } catch (err) {
    console.warn("[storybook/casting] artifact matching failed, continuing without artifact:", err);
    return {};
  }
}
