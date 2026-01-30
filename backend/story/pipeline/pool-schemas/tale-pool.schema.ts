// Tale Pool Schema V2 - Enhanced fairy tale DNA for semantic matching
// Each tale has DNA defining its core conflict, moral, emotional arc, and iconic beats

import type {
  TalePoolEntry,
  TaleDNA,
  EmotionType,
  VariantChoice,
  RoleSlot,
  SceneBeat,
} from "../types";

// ─── Default Variant Choices ───────────────────────────────────────────────

export const DEFAULT_VARIANT_DIMENSIONS: VariantChoice[] = [
  {
    dimension: "setting",
    options: ["ORIGINAL", "MODERNIZED", "NATURE_SHIFT", "SEASON_CHANGE"],
    defaultIndex: 0,
  },
  {
    dimension: "encounter",
    options: ["ORIGINAL", "RIDDLE_VARIANT", "HELPER_FIRST", "SURPRISE_TWIST"],
    defaultIndex: 0,
  },
  {
    dimension: "twist",
    options: ["ORIGINAL", "ROLE_REVERSAL", "DOUBLE_MEANING", "ARTIFACT_KEY"],
    defaultIndex: 0,
  },
  {
    dimension: "rescue",
    options: ["ORIGINAL", "TEAMWORK", "AVATAR_PLAN", "UNEXPECTED_ALLY"],
    defaultIndex: 0,
  },
];

// ─── Emotional Arc Presets ─────────────────────────────────────────────────

export const EMOTIONAL_ARC_PRESETS: Record<string, EmotionType[]> = {
  classic_fairy: ["geborgen", "neugierig", "ängstlich", "mutig", "erlöst"],
  adventure: ["neugierig", "spannend", "verzweifelt", "mutig", "erlöst"],
  comedy: ["lustig", "spielerisch", "lustig", "hoffnungsvoll", "geborgen"],
  dark_fairy: ["geborgen", "neugierig", "ängstlich", "verzweifelt", "erlöst"],
  gentle: ["geborgen", "neugierig", "hoffnungsvoll", "geborgen", "erlöst"],
};

// ─── Conversion: TaleDNA (existing) → TalePoolEntry ───────────────────────

/**
 * Converts an existing TaleDNA into a TalePoolEntry with enriched DNA.
 * This bridges existing tale data into the new pool schema.
 */
export function taleDnaToPoolEntry(
  dna: TaleDNA,
  roles: RoleSlot[],
  scenes: SceneBeat[],
): TalePoolEntry {
  return {
    taleId: dna.taleId,
    title: dna.title,

    dna: {
      coreConflict: dna.coreConflict || extractCoreConflict(dna),
      moralLesson: dna.moralLesson || "",
      emotionalArc: (dna.emotionalArc as EmotionType[]) || EMOTIONAL_ARC_PRESETS.classic_fairy,
      themeTags: dna.themeTags || [],
      iconicBeats: dna.iconicBeats || [],
      flexibleElements: dna.flexibleElements || [],
    },

    roleSlots: roles,
    sceneBeats: scenes,
    variantChoices: DEFAULT_VARIANT_DIMENSIONS,
  };
}

// ─── Semantic Matching Utilities ───────────────────────────────────────────

/**
 * Calculates a theme overlap score between a tale and a set of requested themes.
 * Returns 0.0-1.0
 */
export function calculateThemeOverlap(tale: TalePoolEntry, requestedThemes: string[]): number {
  if (requestedThemes.length === 0 || tale.dna.themeTags.length === 0) return 0.5;

  const taleThemes = new Set(tale.dna.themeTags.map(t => t.toLowerCase()));
  const matchCount = requestedThemes.filter(t => taleThemes.has(t.toLowerCase())).length;

  return matchCount / Math.max(requestedThemes.length, 1);
}

/**
 * Checks if a tale's emotional arc matches the requested emotion profile.
 */
export function matchesEmotionProfile(
  tale: TalePoolEntry,
  profile: { tone?: string; suspenseLevel?: string },
): number {
  const arc = tale.dna.emotionalArc;
  if (arc.length === 0) return 0.5;

  let score = 0.5;

  // Check tone alignment
  if (profile.tone === "warm" || profile.tone === "cozy") {
    if (arc.includes("geborgen") || arc.includes("hoffnungsvoll")) score += 0.2;
    if (arc.includes("ängstlich") || arc.includes("verzweifelt")) score -= 0.1;
  }
  if (profile.tone === "spannend" || profile.tone === "exciting") {
    if (arc.includes("spannend") || arc.includes("mutig")) score += 0.2;
    if (arc.includes("spielerisch")) score -= 0.1;
  }
  if (profile.tone === "lustig" || profile.tone === "funny") {
    if (arc.includes("lustig") || arc.includes("spielerisch")) score += 0.2;
    if (arc.includes("traurig") || arc.includes("ängstlich")) score -= 0.1;
  }

  // Check suspense alignment
  if (profile.suspenseLevel === "high") {
    if (arc.includes("verzweifelt") || arc.includes("ängstlich")) score += 0.15;
  }
  if (profile.suspenseLevel === "low") {
    if (arc.includes("geborgen") || arc.includes("spielerisch")) score += 0.15;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Scores how well a tale fits for a given set of avatars' personality traits.
 */
export function scoreAvatarFit(
  tale: TalePoolEntry,
  avatarTraits: string[],
): number {
  const taleThemes = tale.dna.themeTags.map(t => t.toLowerCase());
  const conflict = tale.dna.coreConflict.toLowerCase();

  // Map avatar traits to theme relevance
  const traitThemeMap: Record<string, string[]> = {
    courage: ["mut", "abenteuer", "kampf"],
    curiosity: ["entdeckung", "rätsel", "geheimnis"],
    empathy: ["freundschaft", "mitgefühl", "hilfe"],
    teamwork: ["zusammenarbeit", "gemeinschaft", "freundschaft"],
    creativity: ["fantasie", "verwandlung", "magie"],
    persistence: ["ausdauer", "prüfung", "herausforderung"],
    knowledge: ["weisheit", "lernen", "wissen"],
    logic: ["rätsel", "logik", "strategie"],
    vocabulary: ["sprache", "geschichten", "erzählung"],
  };

  let matches = 0;
  for (const trait of avatarTraits) {
    const relatedThemes = traitThemeMap[trait.toLowerCase()] || [];
    for (const theme of relatedThemes) {
      if (taleThemes.some(t => t.includes(theme)) || conflict.includes(theme)) {
        matches++;
        break;
      }
    }
  }

  return matches / Math.max(avatarTraits.length, 1);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function extractCoreConflict(dna: TaleDNA): string {
  // Try to derive core conflict from moral lesson or theme tags
  if (dna.moralLesson) return dna.moralLesson;
  if (dna.themeTags && dna.themeTags.length >= 2) {
    return `${dna.themeTags[0]} vs ${dna.themeTags[1]}`;
  }
  return "Gut gegen Böse";
}
