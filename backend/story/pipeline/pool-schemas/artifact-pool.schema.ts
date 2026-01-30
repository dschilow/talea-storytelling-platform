// Artifact Pool Schema V2 - Artifacts with Mini-Arc support
// Each artifact has a story lifecycle: discovery → failure → triumph

import type {
  ArtifactV2,
  ArtifactMiniArc,
  ArtifactStoryFunctions,
  ArtifactGenreAffinity,
  ArtifactVisualProfile,
  ArtifactCard,
  ArtifactArcPlan,
} from "../types";
import type { StoryCategory } from "../constants";

// ─── Default Values ────────────────────────────────────────────────────────

export const DEFAULT_MINI_ARC: ArtifactMiniArc = {
  introduction: "wird zufällig entdeckt",
  failureMode: "funktioniert noch nicht wie erwartet",
  triumphMode: "hilft am entscheidenden Moment",
  activeChapters: [2, 3, 4],
};

export const DEFAULT_GENRE_AFFINITY: ArtifactGenreAffinity = {
  fairytale: 50,
  adventure: 50,
  scifi: 30,
  modern: 20,
  magic: 60,
  animals: 30,
};

export const DEFAULT_STORY_FUNCTIONS: ArtifactStoryFunctions = {
  abilities: [],
  useRule: "kann in schwierigen Situationen helfen",
  miniArc: DEFAULT_MINI_ARC,
  plotInfluence: "TOOL",
};

// ─── Category → Genre Affinity Map ─────────────────────────────────────────

const CATEGORY_AFFINITY_KEY: Record<StoryCategory, keyof ArtifactGenreAffinity> = {
  "Klassische Märchen": "fairytale",
  "Abenteuer & Schätze": "adventure",
  "Märchenwelten & Magie": "magic",
  "Tierwelten": "animals",
  "Sci-Fi & Zukunft": "scifi",
  "Modern & Realität": "modern",
};

/**
 * Returns the genre affinity score for a given story category.
 */
export function getGenreAffinityScore(artifact: ArtifactV2, category: StoryCategory): number {
  const key = CATEGORY_AFFINITY_KEY[category];
  return key ? (artifact.genreAffinity[key] ?? 50) : 50;
}

// ─── Conversion: DB Row → ArtifactV2 ──────────────────────────────────────

export interface ArtifactPoolDBRow {
  id: string;
  name_de: string;
  name_en: string;
  description_de?: string;
  description_en?: string;
  category: string;
  rarity?: string;
  story_role?: string;
  visual_keywords?: string[];
  image_url?: string;
  // V2 extended fields
  abilities?: string[];
  use_rule?: string;
  mini_arc_introduction?: string;
  mini_arc_failure?: string;
  mini_arc_triumph?: string;
  mini_arc_active_chapters?: number[];
  plot_influence?: string;
  genre_affinity?: Record<string, number>;
  image_prompt?: string;
  must_show_when?: string[];
  visual_style?: string;
}

/**
 * Converts a database artifact row into an ArtifactV2 object.
 * Falls back to sensible defaults for missing V2 fields.
 */
export function dbRowToArtifactV2(row: ArtifactPoolDBRow, language: string): ArtifactV2 {
  const name = language === "en" ? row.name_en : row.name_de;

  const miniArc: ArtifactMiniArc = {
    introduction: row.mini_arc_introduction || `entdeckt ${name}`,
    failureMode: row.mini_arc_failure || `${name} funktioniert noch nicht richtig`,
    triumphMode: row.mini_arc_triumph || `${name} hilft bei der Lösung`,
    activeChapters: row.mini_arc_active_chapters || [2, 3, 4],
  };

  const storyFunctions: ArtifactStoryFunctions = {
    abilities: row.abilities || (row.visual_keywords || []),
    useRule: row.use_rule || row.story_role || "kann in schwierigen Situationen helfen",
    miniArc,
    plotInfluence: (row.plot_influence as ArtifactStoryFunctions["plotInfluence"]) || "TOOL",
  };

  const genreAffinity: ArtifactGenreAffinity = {
    fairytale: row.genre_affinity?.fairytale ?? 50,
    adventure: row.genre_affinity?.adventure ?? 50,
    scifi: row.genre_affinity?.scifi ?? 30,
    modern: row.genre_affinity?.modern ?? 20,
    magic: row.genre_affinity?.magic ?? 60,
    animals: row.genre_affinity?.animals ?? 30,
  };

  const visualProfile: ArtifactVisualProfile = {
    imagePrompt: row.image_prompt || (row.visual_keywords || []).join(", "),
    mustShowWhen: row.must_show_when || ["wenn es aktiviert wird", "in der Entdeckungsszene"],
    style: row.visual_style || "magisch glühend",
  };

  return {
    id: row.id,
    name,
    storyFunctions,
    genreAffinity,
    visualProfile,
  };
}

// ─── Conversion: ArtifactV2 → ArtifactCard (for CastSet) ──────────────────

/**
 * Creates a standard ArtifactCard from an ArtifactV2 for use in CastSet.
 */
export function artifactV2ToCard(artifact: ArtifactV2, rarity?: string): ArtifactCard {
  return {
    artifactId: artifact.id,
    name: artifact.name,
    category: undefined,
    storyUseRule: artifact.storyFunctions.useRule,
    visualRule: artifact.visualProfile.imagePrompt || "artifact must be visible",
    rarity: (rarity?.toUpperCase() as ArtifactCard["rarity"]) || undefined,
  };
}

// ─── Build Artifact Arc Plan ───────────────────────────────────────────────

/**
 * Creates an ArtifactArcPlan from an ArtifactV2 and the total chapter count.
 * Distributes discovery, failure, and success across chapters.
 */
export function buildArtifactArcPlan(
  artifact: ArtifactV2,
  totalChapters: number,
): ArtifactArcPlan {
  const arc = artifact.storyFunctions.miniArc;

  // Ensure chapters fit within story bounds
  const discoveryChapter = Math.min(2, totalChapters);
  const failureChapter = Math.min(
    Math.max(discoveryChapter + 1, Math.floor(totalChapters / 2)),
    totalChapters - 1
  );
  const successChapter = Math.max(failureChapter + 1, totalChapters - 1);

  // Active chapters: at least discovery, failure, success
  const activeChapters = Array.from(
    new Set([discoveryChapter, failureChapter, successChapter, ...arc.activeChapters])
  )
    .filter(ch => ch >= 1 && ch <= totalChapters)
    .sort((a, b) => a - b);

  return {
    artifactId: artifact.id,
    artifactName: artifact.name,
    discoveryChapter,
    discoveryMethod: arc.introduction,
    failureChapter,
    failureReason: arc.failureMode,
    successChapter,
    successMethod: arc.triumphMode,
    activeChapters,
  };
}

// ─── Validate Artifact Arc ─────────────────────────────────────────────────

export interface ArtifactArcValidation {
  valid: boolean;
  issues: string[];
}

/**
 * Validates that an artifact arc plan is internally consistent.
 */
export function validateArtifactArcPlan(plan: ArtifactArcPlan, totalChapters: number): ArtifactArcValidation {
  const issues: string[] = [];

  if (plan.discoveryChapter < 1) {
    issues.push("Discovery chapter must be >= 1");
  }
  if (plan.discoveryChapter > 2 && totalChapters >= 4) {
    issues.push("Artifact should be introduced in chapter 1-2");
  }
  if (plan.failureChapter <= plan.discoveryChapter) {
    issues.push("Failure must come after discovery");
  }
  if (plan.successChapter <= plan.failureChapter) {
    issues.push("Success must come after failure");
  }
  if (plan.successChapter > totalChapters) {
    issues.push("Success chapter exceeds total chapters");
  }
  if (plan.activeChapters.length < 2) {
    issues.push("Artifact must be active in at least 2 chapters");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
