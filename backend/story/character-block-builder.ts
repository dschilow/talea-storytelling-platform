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
    // HUMAN-SPECIFIC DESCRIPTION - PRIMARY DISTINGUISHING FEATURES FIRST
    // 1. HAIR (most visible distinguishing feature)
    if (profile.hair?.color && profile.hair?.style) {
      parts.push(`hair: DISTINCT ${profile.hair.color} ${profile.hair.style}, ${profile.hair.length || "medium"} length, ${profile.hair.color} hair visible`);
    } else if (profile.hair?.color) {
      parts.push(`hair: DISTINCT ${profile.hair.color} hair, ${profile.hair.color} hair color must be visible`);
    }
    
    // 2. EYES (second most visible)
    if (profile.eyes?.color) {
      parts.push(`eyes: DISTINCT ${profile.eyes.color} colored eyes, ${profile.eyes.color} eyes clearly visible`);
    }
    
    // 3. CLOTHING (creates strong visual difference)
    if (profile.clothingCanonical?.outfit) {
      parts.push(`outfit: UNIQUE ${profile.clothingCanonical.outfit}`);
      if (profile.clothingCanonical.colors?.length) {
        parts.push(`clothing colors: ${profile.clothingCanonical.colors.join(" and ")}`);
      }
    } else if (profile.clothingCanonical) {
      const clothing: string[] = [];
      if (profile.clothingCanonical.top) {
        clothing.push(`UNIQUE top: ${profile.clothingCanonical.top}`);
        if (profile.clothingCanonical.colors?.length) {
          clothing.push(`in ${profile.clothingCanonical.colors.join(" and ")} colors`);
        }
      }
      if (profile.clothingCanonical.bottom) {
        clothing.push(`UNIQUE bottom: ${profile.clothingCanonical.bottom}`);
      }
      if (clothing.length) parts.push(clothing.join("; "));
    }
    
    // 4. SKIN
    if (profile.skin?.tone) {
      parts.push(`skin: ${profile.skin.tone} with ${profile.skin.distinctiveFeatures?.join(", ") || "rosy cheeks"}`);
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
    // HUMANS - PRIORITIZE DISTINGUISHING FEATURES
    
    // 1. HAIR COLOR (most important for distinguishing characters)
    if (profile.hair?.color) {
      mustInclude.push(`${profile.hair.color} hair color`);
      mustInclude.push(`${profile.hair.color} hair visible`);
      mustInclude.push(`${profile.hair.color} ${profile.hair.style || "hair"}`);
    }
    
    // 2. EYE COLOR (second most important)
    if (profile.eyes?.color) {
      mustInclude.push(`${profile.eyes.color} eyes`);
      mustInclude.push(`${profile.eyes.color} colored eyes`);
    }
    
    // 3. CLOTHING (creates strong visual distinction)
    if (profile.clothingCanonical?.outfit) {
      mustInclude.push(profile.clothingCanonical.outfit);
      if (profile.clothingCanonical.colors?.length) {
        mustInclude.push(...profile.clothingCanonical.colors.map(c => `${c} clothing`));
      }
    } else if (profile.clothingCanonical) {
      if (profile.clothingCanonical.top) {
        mustInclude.push(profile.clothingCanonical.top);
      }
      if (profile.clothingCanonical.bottom) {
        mustInclude.push(profile.clothingCanonical.bottom);
      }
      if (profile.clothingCanonical.colors?.length) {
        mustInclude.push(...profile.clothingCanonical.colors.slice(0, 2));
      }
    }
    
    // 4. DISTINCTIVE FEATURES
    if (profile.skin?.tone) {
      mustInclude.push(`${profile.skin.tone} skin tone`);
    }
    
    if (profile.skin?.distinctiveFeatures?.length) {
      mustInclude.push(...profile.skin.distinctiveFeatures.slice(0, 2));
    }
    
    if (profile.face?.shape) {
      mustInclude.push(`${profile.face.shape} face shape`);
    }
    
    // 5. Use consistent descriptors as ADDITIONAL (not primary)
    if (profile.consistentDescriptors?.length) {
      const filtered = profile.consistentDescriptors
        .filter(d => d.trim().length > 3 && !d.toLowerCase().includes("character"))
        .slice(0, 5); // Limit to 5 additional descriptors
      mustInclude.push(...filtered);
    }
  }

  // Remove duplicates and limit total
  return Array.from(new Set(mustInclude)).slice(0, 15);
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
    // HUMAN - STRENGTHEN FORBID CONSTRAINTS
    forbid.push(
      "duplicate character",
      `duplicate ${characterName}`,
      "second boy same age",
      "second girl same age",
      "clone",
      "identical twin",
      "twins",
      "matching outfits",
      "same clothing",
      "identical appearance"
    );
    
    // Forbid OTHER hair colors (to ensure this character's hair color is correct)
    if (profile?.hair?.color) {
      const otherHairColors = ["blond", "brown", "black", "red", "ginger", "dark", "light"];
      const thisColor = profile.hair.color.toLowerCase();
      otherHairColors
        .filter(c => !thisColor.includes(c) && !c.includes(thisColor.split(" ")[0]))
        .forEach(c => {
          forbid.push(`${c} hair on ${characterName}`);
        });
    }
    
    // Forbid OTHER eye colors
    if (profile?.eyes?.color) {
      const otherEyeColors = ["blue", "green", "brown", "hazel", "gray"];
      const thisColor = profile.eyes.color.toLowerCase();
      otherEyeColors
        .filter(c => c !== thisColor)
        .forEach(c => {
          forbid.push(`${c} eyes on ${characterName}`);
        });
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
    .map((block, index) => {
      let formatted = formatCharacterBlockAsPrompt(block);
      
      // For 2-character scenes, add explicit left/right indicators
      if (blocks.length === 2) {
        const side = index === 0 ? "LEFT" : "RIGHT";
        formatted = `[${side}] ${formatted}`;
      }
      
      return formatted;
    })
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
      ? "CRITICAL: exactly two distinct subjects with clear visual separation, first subject positioned left side, second subject positioned right side, NO overlapping characters, knee-up framing shows both subjects clearly, gentle depth-of-field, characters must look different from each other"
      : "single-subject focus, slightly low camera, inviting depth";

  const lighting =
    "warm rim light, soft fill from environment, subtle volumetric glow, no harsh shadows";

  const style =
    "friendly children's book illustration, soft 3D forms with painterly shading, watercolor texture, analog paper grain";

  const qualityParts = [
    `EXACTLY ${characterCount} subject${characterCount === 1 ? "" : "s"} ONLY`,
    "child-safe, print-ready clarity",
    "clean hands and faces",
    "each character visually distinct with different appearance",
  ];
  
  if (characterCount > 1) {
    qualityParts.push("NO identical characters", "NO matching appearances", "NO twins", "different hair colors clearly visible", "different clothing clearly visible");
  }

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
