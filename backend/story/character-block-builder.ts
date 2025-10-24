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
    // HUMAN - COMPACT DESCRIPTION
    if (profile.hair?.color) {
      parts.push(`${profile.hair.color} hair`);
    }
    if (profile.eyes?.color) {
      parts.push(`${profile.eyes.color} eyes`);
    }
    if (profile.clothingCanonical?.outfit) {
      parts.push(`${profile.clothingCanonical.outfit}`);
    } else if (profile.clothingCanonical?.top && profile.clothingCanonical?.bottom) {
      parts.push(`${profile.clothingCanonical.top}, ${profile.clothingCanonical.bottom}`);
    }
    if (profile.skin?.tone) {
      parts.push(`${profile.skin.tone} skin`);
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

  if (species === "cat" || species === "dog" || species === "animal") {
    // Animals
    if (profile.hair?.color) mustInclude.push(`${profile.hair.color} fur`, `${profile.hair.color} coat`);
    if (profile.eyes?.color) mustInclude.push(`${profile.eyes.color} eyes`);
    if (species === "cat") {
      mustInclude.push("whiskers", "four legs", "non-anthropomorphic cat", "quadruped");
    }
    if (profile.skin?.distinctiveFeatures?.length) {
      mustInclude.push(profile.skin.distinctiveFeatures[0].substring(0, 50));
    }
  } else {
    // HUMANS - COMPACT, ONLY ESSENTIALS
    if (profile.hair?.color) {
      mustInclude.push(`${profile.hair.color} hair`);
    }
    if (profile.eyes?.color) {
      mustInclude.push(`${profile.eyes.color} eyes`);
    }
    if (profile.clothingCanonical?.outfit) {
      mustInclude.push(profile.clothingCanonical.outfit);
    } else if (profile.clothingCanonical?.top) {
      mustInclude.push(profile.clothingCanonical.top);
    }
    if (profile.skin?.tone) {
      mustInclude.push(`${profile.skin.tone} skin`);
    }
  }

  // Remove duplicates and limit to 6
  return Array.from(new Set(mustInclude)).slice(0, 6);
}

/**
 * Builds FORBID list based on species and common errors
 */
function buildForbidList(
  species: SpeciesType, 
  characterName: string,
  profile?: AvatarVisualProfile | MinimalAvatarProfile
): string[] {
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
    // HUMAN - COMPACT FORBID LIST
    forbid.push(
      "duplicate character",
      "identical twins",
      "same appearance",
      "matching clothing"
    );
    
    // Forbid ONLY the most common conflicting hair/eye colors
    if (profile?.hair?.color) {
      const thisColor = profile.hair.color.toLowerCase();
      if (thisColor.includes("blond")) {
        forbid.push("brown hair", "black hair");
      } else if (thisColor.includes("brown")) {
        forbid.push("blond hair", "red hair");
      }
    }
    
    if (profile?.eyes?.color) {
      const thisColor = profile.eyes.color.toLowerCase();
      if (thisColor.includes("blue")) {
        forbid.push("brown eyes", "green eyes");
      } else if (thisColor.includes("green") || thisColor.includes("grun")) {
        forbid.push("blue eyes", "brown eyes");
      }
    }
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
    forbid: buildForbidList(species, name, normalizedProfile),
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
 * Formats a CHARACTER BLOCK as a text prompt section - COMPACT
 */
export function formatCharacterBlockAsPrompt(block: CharacterBlock): string {
  const parts: string[] = [];

  // Name and species
  if (block.species === "cat") {
    parts.push(`${block.name} (cat, 4 legs)`);
  } else {
    parts.push(`${block.name} (${block.ageHint})`);
  }

  // Description
  if (block.detailedDescription) {
    parts.push(block.detailedDescription);
  }

  // Must include (top 3 only)
  if (block.mustInclude.length > 0) {
    parts.push(block.mustInclude.slice(0, 3).join(", "));
  }

  // Forbid (top 2 only)
  if (block.forbid.length > 0) {
    parts.push(`NOT: ${block.forbid.slice(0, 2).join(", ")}`);
  }

  return parts.join("; ");
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
  // CRITICAL: For multi-character scenes, explicitly set left/right positions
  const enrichedData = charactersData.map((data, index) => {
    const sceneDetails = data.sceneDetails || {};
    
    // Auto-assign positions for 2-character scenes if not specified
    if (charactersData.length === 2 && !sceneDetails.position) {
      sceneDetails.position = index === 0 ? "left side of frame" : "right side of frame";
    } else if (!sceneDetails.position) {
      sceneDetails.position = "foreground";
    }
    
    return {
      ...data,
      sceneDetails,
    };
  });
  
  const blocks = enrichedData.map((data) =>
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
      ? limitSentences(scene, 1)
      : "storybook scene";

  const composition =
    characterCount > 1
      ? "two subjects in scene, dynamic angle, action-focused"
      : "single subject, dynamic composition";

  const lighting = "warm natural lighting";

  const style = "children's book illustration, watercolor style";

  const qualityParts = [
    `${characterCount} subject${characterCount === 1 ? "" : "s"}`,
    "child-safe",
    "distinct characters"
  ];
  
  if (characterCount > 1) {
    qualityParts.push("different hair visible");
  }

  if (includesCat) {
    qualityParts.push("cat on four paws");
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
  return normalizeLanguage(
    `${block.scene}, ${block.composition}, ${block.lighting}, ${block.style}, ${block.quality}`
  );
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

  // 1. Character blocks (compact)
  const { prompt: identityPrompt, blocks } = buildMultiCharacterPrompt(
    options.characters
  );
  const subjectCount = blocks.length || options.characters.length;
  const speciesSet = new Set(blocks.map((b) => b.species));
  const includesAnimal = Array.from(speciesSet).some((s) => s !== "human");
  const includesCat = speciesSet.has("cat");

  // Goal: ultra compact
  let goal = "children's book scene";
  if (includesCat) {
    goal += ", cat on four paws";
  }
  
  sections.push(normalizeLanguage(goal));
  sections.push(identityPrompt); // No "IDENTITY - DO NOT ALTER:" prefix

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

  return normalizeLanguage(sections.join(". "));
}
