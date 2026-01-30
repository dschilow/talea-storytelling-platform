// Character Pool Schema V2 - Enhanced character definitions for recognizable, organic characters
// Characters with real personality, speech patterns, catchphrases, and emotional triggers

import type {
  Archetype,
  PoolCharacterV2,
  PoolCharacterMatchingProfile,
  PoolCharacterPersonality,
  PoolCharacterVisualProfile,
  PoolCharacterStoryBinding,
  RoleType,
  EnhancedPersonality,
  CharacterSheet,
} from "../types";

// ─── Default Values ────────────────────────────────────────────────────────

export const DEFAULT_MATCHING_PROFILE: PoolCharacterMatchingProfile = {
  archetypes: ["ADVENTURER"],
  roleCompatibility: ["HELPER"],
  themeAffinity: [],
  ageRange: { min: 4, max: 12 },
  conflictPotential: [],
};

export const DEFAULT_PERSONALITY: PoolCharacterPersonality = {
  dominant: "neugierig",
  secondary: [],
  speechStyle: ["direkt"],
  triggers: [],
};

export const DEFAULT_VISUAL_PROFILE: PoolCharacterVisualProfile = {
  species: "human_child",
  imagePrompt: "",
  colorPalette: [],
  consistencyMarkers: [],
  forbidden: [],
};

export const DEFAULT_STORY_BINDING: PoolCharacterStoryBinding = {
  canonSettings: [],
  maxScreenTime: 0.6,
  introStyle: "casual",
};

// ─── Archetype → Role Compatibility Map ────────────────────────────────────

const ARCHETYPE_ROLE_MAP: Record<Archetype, RoleType[]> = {
  ADVENTURER: ["PROTAGONIST", "HELPER"],
  MENTOR: ["MENTOR", "GUARDIAN"],
  TRICKSTER: ["TRICKSTER", "COMIC_RELIEF"],
  GUARDIAN: ["GUARDIAN", "MENTOR"],
  HEALER: ["HELPER", "MENTOR"],
  SCHOLAR: ["MENTOR", "NARRATOR"],
  REBEL: ["PROTAGONIST", "TRICKSTER"],
  INNOCENT: ["HELPER", "CAMEO"],
  EXPLORER: ["PROTAGONIST", "HELPER"],
  JESTER: ["COMIC_RELIEF", "TRICKSTER"],
};

/**
 * Derives role compatibility from archetypes if not explicitly set
 */
export function deriveRoleCompatibility(archetypes: Archetype[]): RoleType[] {
  const roles = new Set<RoleType>();
  for (const arch of archetypes) {
    const compatible = ARCHETYPE_ROLE_MAP[arch] || [];
    compatible.forEach(r => roles.add(r));
  }
  return Array.from(roles);
}

// ─── Personality → Speech Style Defaults ───────────────────────────────────

const PERSONALITY_SPEECH_MAP: Record<string, string[]> = {
  mutig: ["direkt", "bestimmt"],
  neugierig: ["fragend", "enthusiastisch"],
  schüchtern: ["leise", "stockend"],
  hilfsbereit: ["warmherzig", "ermutigend"],
  frech: ["verspielt", "schnippisch"],
  weise: ["bedacht", "ruhig"],
  ängstlich: ["zögerlich", "flüsternd"],
  lustig: ["witzig", "übertreibend"],
  grummelig: ["knapp", "brummig"],
  verträumt: ["abschweifend", "poetisch"],
};

/**
 * Suggests speech styles based on dominant personality
 */
export function suggestSpeechStyles(dominant: string): string[] {
  return PERSONALITY_SPEECH_MAP[dominant] || ["neutral"];
}

// ─── Conversion: DB Row → PoolCharacterV2 ──────────────────────────────────

export interface CharacterPoolDBRow {
  id: string;
  name: string;
  role: string;
  archetype: string;
  emotional_nature: any;
  visual_profile: any;
  gender?: string | null;
  age_category?: string | null;
  species_category?: string | null;
  profession_tags?: string[] | null;
  personality_keywords?: string[] | null;
  physical_description?: string | null;
  backstory?: string | null;
  // V2 extended fields (nullable for backward compat)
  dominant_personality?: string | null;
  secondary_traits?: string[] | null;
  catchphrase?: string | null;
  catchphrase_context?: string | null;
  speech_style?: string[] | null;
  emotional_triggers?: string[] | null;
  quirk?: string | null;
  theme_affinity?: string[] | null;
  conflict_potential?: string[] | null;
  canon_settings?: string[] | null;
  max_screen_time?: number | null;
  intro_style?: string | null;
  consistency_markers?: string[] | null;
  color_palette?: string[] | null;
  visual_forbidden?: string[] | null;
}

/**
 * Converts a database row into an enriched PoolCharacterV2 object.
 * Falls back to sensible defaults for missing V2 fields.
 */
export function dbRowToPoolCharacterV2(row: CharacterPoolDBRow): PoolCharacterV2 {
  const dominant = row.dominant_personality
    || row.personality_keywords?.[0]
    || "neugierig";

  const archetypes = parseArchetypes(row.archetype);
  const roleCompat = deriveRoleCompatibility(archetypes);

  const visualProfile = typeof row.visual_profile === "string"
    ? safeJson(row.visual_profile)
    : (row.visual_profile || {});

  return {
    id: row.id,
    name: row.name,

    matchingProfile: {
      archetypes,
      roleCompatibility: roleCompat,
      themeAffinity: row.theme_affinity || [],
      ageRange: resolveAgeRange(row.age_category),
      conflictPotential: row.conflict_potential || [],
    },

    personality: {
      dominant,
      secondary: row.secondary_traits || (row.personality_keywords?.slice(1) || []),
      catchphrase: row.catchphrase || undefined,
      catchphraseContext: row.catchphrase_context || undefined,
      speechStyle: row.speech_style || suggestSpeechStyles(dominant),
      triggers: row.emotional_triggers || [],
      quirk: row.quirk || undefined,
    },

    visualProfile: {
      species: row.species_category || "human_child",
      imagePrompt: visualProfile?.description || row.physical_description || "",
      colorPalette: row.color_palette || [],
      consistencyMarkers: row.consistency_markers || visualProfile?.consistentDescriptors || [],
      forbidden: row.visual_forbidden || ["duplicate character", "extra limbs"],
    },

    storyBinding: {
      canonSettings: row.canon_settings || [],
      maxScreenTime: row.max_screen_time ?? 0.6,
      introStyle: (row.intro_style as PoolCharacterStoryBinding["introStyle"]) || "casual",
    },
  };
}

// ─── Conversion: PoolCharacterV2 → EnhancedPersonality ─────────────────────

/**
 * Builds an EnhancedPersonality from a PoolCharacterV2 personality definition.
 * This bridges pool data into the CharacterSheet used by story generation.
 */
export function buildEnhancedPersonality(pool: PoolCharacterV2): EnhancedPersonality {
  const p = pool.personality;

  const dialogueStyleMap: Record<string, EnhancedPersonality["dialogueStyle"]> = {
    "direkt": "casual",
    "bestimmt": "casual",
    "warmherzig": "casual",
    "förmlich": "formal",
    "bedacht": "wise",
    "ruhig": "wise",
    "verspielt": "playful",
    "witzig": "playful",
    "schnippisch": "playful",
    "knapp": "grumpy",
    "brummig": "grumpy",
  };

  const primaryStyle = p.speechStyle[0] || "direkt";
  const dialogueStyle = dialogueStyleMap[primaryStyle] || "casual";

  return {
    dominant: p.dominant,
    secondary: p.secondary,
    catchphrase: p.catchphrase,
    speechPatterns: p.speechStyle,
    emotionalTriggers: p.triggers,
    dialogueStyle,
  };
}

/**
 * Enriches a CharacterSheet with personality data from PoolCharacterV2
 */
export function enrichCharacterSheet(sheet: CharacterSheet, pool: PoolCharacterV2): CharacterSheet {
  return {
    ...sheet,
    enhancedPersonality: buildEnhancedPersonality(pool),
    catchphrase: pool.personality.catchphrase,
    personalityTags: [pool.personality.dominant, ...pool.personality.secondary].slice(0, 6),
    speechStyleHints: pool.personality.speechStyle.slice(0, 3),
    visualSignature: pool.visualProfile.consistencyMarkers.length > 0
      ? pool.visualProfile.consistencyMarkers.slice(0, 6)
      : sheet.visualSignature,
    forbidden: pool.visualProfile.forbidden.length > 0
      ? pool.visualProfile.forbidden
      : sheet.forbidden,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseArchetypes(raw: string | null | undefined): Archetype[] {
  if (!raw) return ["ADVENTURER"];
  const known: Archetype[] = [
    "ADVENTURER", "MENTOR", "TRICKSTER", "GUARDIAN", "HEALER",
    "SCHOLAR", "REBEL", "INNOCENT", "EXPLORER", "JESTER",
  ];
  const parts = raw.toUpperCase().split(/[,;\s]+/).map(s => s.trim());
  const matched = parts.filter(p => known.includes(p as Archetype)) as Archetype[];
  return matched.length > 0 ? matched : ["ADVENTURER"];
}

function resolveAgeRange(ageCategory?: string | null): { min: number; max: number } {
  const map: Record<string, { min: number; max: number }> = {
    child: { min: 4, max: 10 },
    teen: { min: 11, max: 16 },
    adult: { min: 17, max: 99 },
    elderly: { min: 60, max: 99 },
    ageless: { min: 0, max: 999 },
  };
  return map[(ageCategory || "child").toLowerCase()] || { min: 4, max: 12 };
}

function safeJson(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
