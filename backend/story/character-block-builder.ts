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

function limitSentences(text: string | undefined, maxCount: number): string {
  if (!text) {
    return "";
  }
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized === "") {
    return "";
  }
  const sentences = normalized.match(/[^.!?]+[.!?]?/g);
  if (!sentences) {
    return normalized;
  }
  return sentences.slice(0, maxCount).join(" ").trim();
}

/**
 * Formats a CHARACTER BLOCK as a text prompt section
 */
export function formatCharacterBlockAsPrompt(block: CharacterBlock): string {
  const segments: string[] = [];

  const speciesDescriptor =
    block.species === "cat"
      ? `cat (${block.ageHint}), non-anthropomorphic, four-legged`
      : block.species === "dog"
      ? `dog (${block.ageHint}), non-anthropomorphic, four-legged`
      : block.species === "animal"
      ? `animal (${block.ageHint}), non-anthropomorphic, four-legged`
      : `human (${block.ageHint})`;

  segments.push(`${block.name}: ${speciesDescriptor}`);

  if (block.detailedDescription) {
    segments.push(block.detailedDescription);
  }

  if (block.pose) {
    segments.push(`pose ${block.pose}`);
  }

  if (block.position) {
    segments.push(`position ${block.position}`);
  }

  if (block.mustInclude.length > 0) {
    segments.push(`must include ${block.mustInclude.join(", ")}`);
  }

  if (block.forbid.length > 0) {
    segments.push(`forbid ${block.forbid.join(", ")}`);
  }

  return segments.join("; ");
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
): { prompt: string; blocks: CharacterBlock[] } {
  const blocks = charactersData.map((data) =>
    buildCharacterBlock(data.name, data.profile, data.sceneDetails)
  );

  const formattedBlocks = blocks
    .map((block) => formatCharacterBlockAsPrompt(block))
    .join(" | ");

  return {
    blocks,
    prompt: normalizeLanguage(formattedBlocks),
  };
}

/**
 * Builds scene/style block (Abschnitt 4.4)
 */
export interface SceneStyleBlock {
  scene: string;
  composition: string;
  lighting: string;
  style: string;
  quality: string;
}

export function buildSceneStyleBlock(
  scene?: string,
  characterCount = 1,
  includesAnimal = false,
  includesCat = false
): SceneStyleBlock {
  const baseScene =
    scene && scene.trim() !== ""
      ? limitSentences(scene, 2)
      : "storybook setting with gentle movement and clear foreground focus";

  const composition =
    characterCount > 1
      ? "balanced two-subject layout, left/right separation, knee-up framing, gentle depth-of-field"
      : "single-subject focus, slightly low camera, inviting depth";

  const lighting =
    "warm rim light, soft fill from environment, subtle volumetric glow, no harsh shadows";

  const style =
    "friendly children's book illustration, soft 3D forms with painterly shading, watercolor texture, analog paper grain";

  const qualityParts = [
    `exactly ${characterCount} subject${characterCount === 1 ? "" : "s"}`,
    "child-safe, print-ready clarity",
    "clean hands and faces",
    "consistent characters across images",
  ];

  if (includesAnimal) {
    qualityParts.push("animal stays natural, no clothing or human traits");
  }

  if (includesCat) {
    qualityParts.push("cat on four paws, expressive tail visible");
  }

  return {
    scene: baseScene,
    composition,
    lighting,
    style,
    quality: qualityParts.join(", "),
  };
}

/**
 * Formats scene/style block as prompt text
 */
export function formatSceneStyleBlockAsPrompt(block: SceneStyleBlock): string {
  const lines: string[] = [];

  lines.push(`COMPOSITION: ${block.composition}`);
  lines.push(`SCENE & LIGHT: ${block.scene}. Lighting ${block.lighting}`);
  lines.push(`STYLE: ${block.style}`);
  lines.push(`QUALITY GUARDS: ${block.quality}`);

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
  const { prompt: identityPrompt, blocks } = buildMultiCharacterPrompt(
    options.characters
  );
  const subjectCount = blocks.length || options.characters.length;
  const speciesSet = new Set(blocks.map((b) => b.species));
  const includesAnimal = Array.from(speciesSet).some((s) => s !== "human");
  const includesCat = speciesSet.has("cat");

  const goalParts = [
    "GOAL: friendly children's book illustration for the chapter scene",
    subjectCount === 1 ? "exactly one subject" : "exactly two subjects",
    "knee-up framing",
    "warm fairy-tale mood",
  ];

  if (includesCat) {
    goalParts.push("cat remains non-anthropomorphic and on four paws");
  } else if (includesAnimal) {
    goalParts.push("animal remains natural and quadruped");
  }

  sections.push(normalizeLanguage(goalParts.join(", ") + "."));
  sections.push(`IDENTITY - DO NOT ALTER: ${identityPrompt}`);

  // 2. Scene/Style block
  const sceneStyle = {
    ...buildSceneStyleBlock(
      options.scene,
      subjectCount,
      includesAnimal,
      includesCat
    ),
    ...options.customStyle,
  };
  const sceneStylePrompt = formatSceneStyleBlockAsPrompt(sceneStyle);
  sections.push(sceneStylePrompt);

  return normalizeLanguage(sections.join(" "));
}
