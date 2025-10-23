/**
 * CHARACTER-BLOCKS Prompt Builder (Abschnitt 4.2-4.3 & 10.2)
 * Structured character blocks with species, MUST INCLUDE, FORBID constraints
 */

import type { AvatarVisualProfile } from "../avatar/avatar";
import type { MinimalAvatarProfile, SpeciesType } from "./avatar-image-optimization";
import { normalizeLanguage } from "./avatar-image-optimization";

/**
 * Normalizes all text fields in a visual profile from German to English
 * This ensures consistent English prompts even if DB contains German text
 */
function normalizeVisualProfile(profile: AvatarVisualProfile | MinimalAvatarProfile): AvatarVisualProfile | MinimalAvatarProfile {
  const normalized = { ...profile };
  
  // Normalize hair
  if (normalized.hair) {
    normalized.hair = {
      ...normalized.hair,
      color: normalizeLanguage(normalized.hair.color || ""),
      style: normalizeLanguage(normalized.hair.style || ""),
      type: normalizeLanguage(normalized.hair.type || ""),
      length: normalizeLanguage(normalized.hair.length || ""),
    };
  }
  
  // Normalize eyes
  if (normalized.eyes) {
    normalized.eyes = {
      ...normalized.eyes,
      color: normalizeLanguage(normalized.eyes.color || ""),
      shape: normalizeLanguage(normalized.eyes.shape || ""),
      size: normalizeLanguage(normalized.eyes.size || ""),
    };
  }
  
  // Normalize skin
  if (normalized.skin) {
    normalized.skin = {
      ...normalized.skin,
      tone: normalizeLanguage(normalized.skin.tone || ""),
      distinctiveFeatures: normalized.skin.distinctiveFeatures?.map(f => normalizeLanguage(f)) || [],
    };
  }
  
  // Normalize face
  if (normalized.face) {
    normalized.face = {
      ...normalized.face,
      shape: normalizeLanguage(normalized.face.shape || ""),
      nose: normalizeLanguage(normalized.face.nose || ""),
      otherFeatures: normalized.face.otherFeatures?.map(f => normalizeLanguage(f)) || [],
    };
  }
  
  // Normalize clothing
  if (normalized.clothingCanonical) {
    normalized.clothingCanonical = {
      ...normalized.clothingCanonical,
      outfit: normalizeLanguage(normalized.clothingCanonical.outfit || ""),
      top: normalizeLanguage(normalized.clothingCanonical.top || ""),
      bottom: normalizeLanguage(normalized.clothingCanonical.bottom || ""),
      colors: normalized.clothingCanonical.colors?.map(c => normalizeLanguage(c)) || [],
      patterns: normalized.clothingCanonical.patterns?.map(p => normalizeLanguage(p)) || [],
    };
  }
  
  // Normalize consistent descriptors
  if (normalized.consistentDescriptors) {
    normalized.consistentDescriptors = normalized.consistentDescriptors.map(d => normalizeLanguage(d));
  }
  
  // Normalize age approx
  if (normalized.ageApprox) {
    normalized.ageApprox = normalizeLanguage(normalized.ageApprox);
  }
  
  return normalized;
}

export interface CharacterBlock {
  name: string;
  species: SpeciesType;
  ageHint?: string;
  mustInclude: string[];
  forbid: string[];
  pose?: string;
  position?: string;
  detailedDescription: string;
}

/**
 * Determines species from visual profile
 */
function getSpeciesFromProfile(profile: AvatarVisualProfile | MinimalAvatarProfile): SpeciesType {
  const descriptors = profile.consistentDescriptors?.join(" ").toLowerCase() || "";
  
  if (descriptors.includes("cat") || descriptors.includes("katze")) return "cat";
  if (descriptors.includes("dog") || descriptors.includes("hund")) return "dog";
  if (descriptors.includes("animal") || descriptors.includes("tier")) return "animal";
  
  // Check hair type
  if (profile.hair?.type === "fur") {
    if (descriptors.includes("cat") || profile.face?.otherFeatures?.some(f => f.includes("whisker"))) {
      return "cat";
    }
    return "animal";
  }
  
  return "human";
}

/**
 * Builds detailed character description based on species
 */
function buildDetailedDescription(
  profile: AvatarVisualProfile | MinimalAvatarProfile,
  species: SpeciesType
): string {
  const parts: string[] = [];

  if (species === "cat") {
    // CAT-SPECIFIC DESCRIPTION
    if (profile.hair?.color) {
      parts.push(`coat: ${profile.hair.color} ${profile.hair.style || "tabby"}`);
    }
    if (profile.skin?.distinctiveFeatures?.length) {
      const features = profile.skin.distinctiveFeatures
        .filter(f => f && f.trim())
        .slice(0, 2)
        .join("; ");
      if (features) parts.push(features);
    }
    if (profile.eyes?.color && profile.eyes?.shape) {
      parts.push(`eyes: ${profile.eyes.size || "large"} ${profile.eyes.color}; ${profile.eyes.shape}`);
    }
    if (profile.face?.nose) {
      parts.push(`face: ${profile.face.nose}`);
    }
    if (profile.face?.otherFeatures?.length) {
      parts.push(profile.face.otherFeatures.slice(0, 2).join("; "));
    }
  } else if (species === "dog" || species === "animal") {
    // DOG/ANIMAL-SPECIFIC DESCRIPTION
    if (profile.hair?.color) {
      parts.push(`coat: ${profile.hair.color} ${profile.hair.type || "fur"}`);
    }
    if (profile.skin?.distinctiveFeatures?.length) {
      parts.push(profile.skin.distinctiveFeatures.slice(0, 2).join("; "));
    }
    if (profile.eyes) {
      parts.push(`eyes: ${profile.eyes.color || "brown"} ${profile.eyes.shape || "round"}`);
    }
  } else {
    // HUMAN-SPECIFIC DESCRIPTION
    if (profile.hair?.color && profile.hair?.style) {
      parts.push(`hair: ${profile.hair.color} ${profile.hair.style}, ${profile.hair.length || "medium"} length`);
    }
    if (profile.eyes?.color) {
      parts.push(`eyes: ${profile.eyes.color}`);
    }
    if (profile.skin?.tone) {
      parts.push(`skin: ${profile.skin.tone}`);
    }
    if (profile.clothingCanonical?.outfit) {
      parts.push(`outfit: ${profile.clothingCanonical.outfit}`);
    } else if (profile.clothingCanonical) {
      const clothing: string[] = [];
      if (profile.clothingCanonical.top) clothing.push(profile.clothingCanonical.top);
      if (profile.clothingCanonical.bottom) clothing.push(profile.clothingCanonical.bottom);
      if (clothing.length) parts.push(`clothing: ${clothing.join("; ")}`);
    }
  }

  return parts.join(". ");
}

/**
 * Extracts MUST INCLUDE tokens from profile
 */
function extractMustInclude(
  profile: AvatarVisualProfile | MinimalAvatarProfile,
  species: SpeciesType
): string[] {
  const mustInclude: string[] = [];

  // Use consistent descriptors as primary source
  if (profile.consistentDescriptors?.length) {
    // Take top 8-10 descriptors, skip generic ones
    const filtered = profile.consistentDescriptors
      .filter(d => d.trim().length > 3 && !d.toLowerCase().includes("character"))
      .slice(0, 10);
    mustInclude.push(...filtered);
  } else {
    // Fallback: build from profile details
    if (species === "cat" || species === "dog" || species === "animal") {
      if (profile.hair?.color) mustInclude.push(`${profile.hair.color} fur`);
      if (profile.eyes?.color) mustInclude.push(`${profile.eyes.color} eyes`);
      if (species === "cat") {
        mustInclude.push("whiskers", "four legs", "non-anthropomorphic cat", "quadruped");
      }
      if (profile.skin?.distinctiveFeatures?.length) {
        mustInclude.push(profile.skin.distinctiveFeatures[0].substring(0, 50));
      }
    } else {
      // Human
      if (profile.hair?.color) mustInclude.push(`${profile.hair.color} hair`);
      if (profile.eyes?.color) mustInclude.push(`${profile.eyes.color} eyes`);
      if (profile.clothingCanonical?.outfit) {
        mustInclude.push(profile.clothingCanonical.outfit);
      }
    }
  }

  return mustInclude;
}

/**
 * Builds FORBID list based on species and common errors
 */
function buildForbidList(species: SpeciesType, characterName: string): string[] {
  const forbid: string[] = [];

  if (species === "cat") {
    forbid.push(
      "anthropomorphic cat",
      "cat standing on two legs",
      "cat wearing clothes",
      "mascot suit",
      "human face on cat",
      "extra cat",
      "second human child",
      "two boys",
      "two girls",
      `duplicate ${characterName}`
    );
  } else if (species === "dog") {
    forbid.push(
      "anthropomorphic dog",
      "dog standing on two legs",
      "dog wearing clothes",
      "mascot suit",
      "human face on dog",
      "extra dog",
      `duplicate ${characterName}`
    );
  } else if (species === "animal") {
    forbid.push(
      "anthropomorphic animal",
      "animal standing on two legs",
      "animal wearing clothes",
      "mascot suit",
      "extra animal",
      `duplicate ${characterName}`
    );
  } else {
    // Human
    forbid.push(
      "duplicate character",
      `duplicate ${characterName}`,
      "second boy same age",
      "second girl same age",
      "clone",
      "identical twin"
    );
  }

  return forbid;
}

/**
 * Builds a complete CHARACTER BLOCK for image generation
 */
export function buildCharacterBlock(
  name: string,
  profile: AvatarVisualProfile | MinimalAvatarProfile,
  sceneDetails?: {
    position?: string;
    expression?: string;
    action?: string;
    pose?: string;
  }
): CharacterBlock {
  // CRITICAL: Normalize profile to English BEFORE building character block
  const normalizedProfile = normalizeVisualProfile(profile);
  
  const species = getSpeciesFromProfile(normalizedProfile);
  const ageHint = normalizedProfile.ageApprox || (species === "human" ? "child 6-8 years" : `young ${species}`);
  
  const block: CharacterBlock = {
    name,
    species,
    ageHint,
    mustInclude: extractMustInclude(normalizedProfile, species),
    forbid: buildForbidList(species, name),
    pose: sceneDetails?.pose || sceneDetails?.action || (species === "human" ? "playful, natural pose" : "curious, alert"),
    position: sceneDetails?.position || "foreground",
    detailedDescription: buildDetailedDescription(normalizedProfile, species),
  };

  return block;
}

/**
 * Formats a CHARACTER BLOCK as a text prompt section
 */
export function formatCharacterBlockAsPrompt(block: CharacterBlock): string {
  const lines: string[] = [];

  lines.push(`CHARACTER: ${block.name}`);
  
  // Species line with modifiers
  if (block.species === "cat") {
    lines.push(`species: cat (${block.ageHint}), non-anthropomorphic, quadruped`);
  } else if (block.species === "dog") {
    lines.push(`species: dog (${block.ageHint}), non-anthropomorphic, quadruped`);
  } else if (block.species === "animal") {
    lines.push(`species: animal (${block.ageHint}), non-anthropomorphic, quadruped`);
  } else {
    lines.push(`species: human (${block.ageHint})`);
  }

  // Detailed description
  if (block.detailedDescription) {
    lines.push(block.detailedDescription);
  }

  // Pose and position
  if (block.pose) lines.push(`pose: ${block.pose}`);
  if (block.position) lines.push(`position: ${block.position}`);

  // MUST INCLUDE tokens
  if (block.mustInclude.length > 0) {
    lines.push(`MUST INCLUDE: ${block.mustInclude.join(", ")}`);
  }

  // FORBID constraints
  if (block.forbid.length > 0) {
    lines.push(`FORBID: ${block.forbid.join(", ")}`);
  }

  return lines.join(". ");
}

/**
 * Builds multiple character blocks and combines them
 */
export function buildMultiCharacterPrompt(
  charactersData: Array<{
    name: string;
    profile: AvatarVisualProfile | MinimalAvatarProfile;
    sceneDetails?: {
      position?: string;
      expression?: string;
      action?: string;
      pose?: string;
    };
  }>
): string {
  const blocks = charactersData.map((data) =>
    buildCharacterBlock(data.name, data.profile, data.sceneDetails)
  );

  const formattedBlocks = blocks.map((block) => formatCharacterBlockAsPrompt(block));

  // Add separator between characters for clarity
  const separator = charactersData.length > 1 ? " AND " : "";
  const combined = formattedBlocks.join(separator);

  // Normalize language (DE -> EN)
  return normalizeLanguage(combined);
}

/**
 * Builds scene/style block (Abschnitt 4.4)
 */
export interface SceneStyleBlock {
  scene?: string;
  masterStyle: string;
  composition: string;
  lighting?: string;
  global: string;
}

export function buildSceneStyleBlock(
  scene?: string,
  characterCount = 1
): SceneStyleBlock {
  return {
    scene: scene || "dynamic scene with clear focus on characters",
    masterStyle:
      "professional children's book illustration, vibrant colors, soft lighting, expressive characters",
    composition:
      characterCount > 1
        ? "two-subject focus; clear separation; shallow depth-of-field; both characters clearly visible"
        : "single-subject focus; clear composition; engaging perspective",
    lighting: "warm rim light; gentle bounce from environment; natural illumination",
    global: "keep each character visually identical across all images; anatomically correct proportions",
  };
}

/**
 * Formats scene/style block as prompt text
 */
export function formatSceneStyleBlockAsPrompt(block: SceneStyleBlock): string {
  const lines: string[] = [];

  lines.push(`MASTERSTYLE: ${block.masterStyle}`);
  lines.push(`COMPOSITION: ${block.composition}`);
  
  if (block.scene) {
    lines.push(`SCENE: ${block.scene}`);
  }
  
  if (block.lighting) {
    lines.push(`LIGHTING: ${block.lighting}`);
  }
  
  lines.push(`GLOBAL: ${block.global}`);

  return normalizeLanguage(lines.join(". "));
}

/**
 * Complete image prompt builder combining characters + scene/style
 */
export interface CompleteImagePromptOptions {
  characters: Array<{
    name: string;
    profile: AvatarVisualProfile | MinimalAvatarProfile;
    sceneDetails?: {
      position?: string;
      expression?: string;
      action?: string;
      pose?: string;
    };
  }>;
  scene?: string;
  customStyle?: Partial<SceneStyleBlock>;
}

export function buildCompleteImagePrompt(
  options: CompleteImagePromptOptions
): string {
  const sections: string[] = [];

  // 1. Character blocks (always first)
  const characterPrompt = buildMultiCharacterPrompt(options.characters);
  sections.push(characterPrompt);

  // 2. Scene/Style block
  const sceneStyle = {
    ...buildSceneStyleBlock(options.scene, options.characters.length),
    ...options.customStyle,
  };
  const sceneStylePrompt = formatSceneStyleBlockAsPrompt(sceneStyle);
  sections.push(sceneStylePrompt);

  return sections.join(". ");
}

