/**
 * CHARACTER-BLOCKS Prompt Builder (Abschnitt 4.2-4.3 & 10.2)
 * Structured character blocks with species, MUST INCLUDE, FORBID constraints
 */

import type { AvatarVisualProfile } from "../avatar/avatar";
import type { MinimalAvatarProfile, SpeciesType } from "./avatar-image-optimization";
import { normalizeLanguage } from "./avatar-image-optimization";
import { getAvatarCanon, buildVisualDistinctionWarning } from "../avatar/avatar-canon-simple";
import {
  buildAgeAccuratePrompt,
  buildRelativeHeightReferences,
  buildAgeAccuratePromptWithHeight,
  buildRelativeHeightReferencesWithHeight,
  type CharacterWithHeight
} from "./age-consistency-guards";
import {
  buildInvariantsFromVisualProfile,
  formatInvariantsForPrompt,
  extractInvariantsFromDescription,
  type CharacterInvariants
} from "./character-invariants";

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
  characterType?: string; // Full character type from visual profile (e.g., "anthropomorphic mouse-fox hybrid")
  ageHint?: string;
  /** NEW v2.0: Explicit numeric age from visual profile */
  ageNumeric?: number;
  /** NEW v2.0: Explicit height in cm from visual profile */
  heightCm?: number;
  mustInclude: string[];
  forbid: string[];
  /** NEW v2.0: Character invariants for cross-chapter consistency */
  invariants?: CharacterInvariants;
  pose?: string;
  position?: string;
  expression?: string;
  action?: string;
  detailedDescription: string;
}

/**
 * Determines species from visual profile
 */
function getSpeciesFromProfile(profile: AvatarVisualProfile | MinimalAvatarProfile): SpeciesType {
  const profileAny = profile as any;
  const explicitType = (profileAny.characterType || "").toLowerCase();
  const descriptors = (profile.consistentDescriptors?.join(" ") || "").toLowerCase();

  // Priority 1: Humans must be detected first
  if (explicitType.includes("human") || explicitType.includes("child") || explicitType.includes("boy") || explicitType.includes("girl")) {
    return "human";
  }

  // Priority 2: Anthropomorphic or hybrid creatures are ALWAYS "animal" (generic fantasy creature)
  if (explicitType.includes("anthropomorphic") || explicitType.includes("hybrid")) {
    return "animal"; // Any anthropomorphic or hybrid creature -> generic animal type
  }

  // Priority 3: Generic fantasy creatures
  if (explicitType.includes("monster") || explicitType.includes("creature") || explicitType.includes("fantasie-wesen") || explicitType.includes("fabelwesen")) {
    return "animal";
  }

  // Priority 4: Real animals (NOT anthropomorphic) - only pure real animals!
  // IMPORTANT: Only return "cat" or "dog" if it's a REAL quadruped animal, not a hybrid
  if ((explicitType.includes("cat") || explicitType.includes("kitten")) && !explicitType.includes("hybrid") && !explicitType.includes("anthropomorphic")) {
    return "cat";
  }
  if (explicitType.includes("dog") && !explicitType.includes("hybrid") && !explicitType.includes("anthropomorphic")) {
    return "dog";
  }

  // Priority 5: Check descriptors (less reliable)
  if (descriptors.includes("anthropomorphic") || descriptors.includes("hybrid")) {
    return "animal";
  }

  // Priority 6: Fur presence suggests an animal (but not necessarily cat/dog)
  const hairType = profile.hair?.type?.toLowerCase() || "";
  const skinTone = profile.skin?.tone?.toLowerCase() || "";
  const distinctive = (profile.skin?.distinctiveFeatures || []).join(" ").toLowerCase();
  if (hairType.includes("fur") || skinTone.includes("fur") || distinctive.includes("fur")) {
    return "animal";
  }

  // Default: human
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
    // DOG/ANIMAL/CREATURE-SPECIFIC DESCRIPTION (generic for all non-human, non-cat)
    const profileAny = profile as any;

    // Try to get color from multiple sources
    const color = profileAny.coat?.primaryColor || profileAny.fur?.color || profile.hair?.color || profileAny.color?.primary;
    const colorType = profileAny.coat?.pattern || profile.hair?.type || "texture";

    if (color) {
      parts.push(`${color} ${colorType}`);
    }

    // Add distinctive features
    if (profile.skin?.distinctiveFeatures?.length) {
      parts.push(profile.skin.distinctiveFeatures.slice(0, 2).join("; "));
    }

    // Eyes
    if (profile.eyes) {
      parts.push(`${profile.eyes.color || "dark"} ${profile.eyes.shape || "round"} eyes`);
    }

    // Character type for non-standard creatures
    const characterType = profileAny.characterType;
    if (characterType && characterType !== species) {
      parts.push(`${characterType} appearance`);
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
    // Animals/Creatures - Use coat, fur, or color (safely access with any cast)
    const profileAny = profile as any;
    const coatColor = profileAny.coat?.primaryColor || profileAny.fur?.color || profile.hair?.color || profileAny.color?.primary;
    if (coatColor) {
      mustInclude.push(`${coatColor} fur`, `${coatColor} coat`);
    }

    const coatPattern = profileAny.coat?.pattern || profileAny.fur?.pattern;
    if (coatPattern) {
      mustInclude.push(`${coatPattern} pattern`);
    }

    if (profile.eyes?.color) mustInclude.push(`${profile.eyes.color} eyes`);

    if (species === "cat") {
      mustInclude.push("whiskers", "four legs", "non-anthropomorphic cat", "quadruped");
    } else if (species === "dog") {
      mustInclude.push("four legs", "non-anthropomorphic dog", "quadruped");
    } else {
      // Generic animal/creature
      mustInclude.push("non-anthropomorphic");
    }

    // Add distinctive features
    if (profile.skin?.distinctiveFeatures?.length) {
      mustInclude.push(profile.skin.distinctiveFeatures[0].substring(0, 50));
    }

    // Add characterType for non-standard creatures (monster, robot, etc.)
    const characterType = profileAny.characterType;
    if (characterType && characterType !== species) {
      mustInclude.push(characterType);
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
    // CRITICAL v3.1: Explicitly require NORMAL HUMAN EARS
    // This prevents elf ears, pointed ears, animal ears
    mustInclude.push("normal human ears on sides of head");
    mustInclude.push("round human ear shape");
  }

  // Remove duplicates and limit to 8 (increased from 6 for critical human features)
  return Array.from(new Set(mustInclude)).slice(0, 8);
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

  const add = (...items: string[]) => {
    items
      .map((item) => item && item.trim())
      .filter((item): item is string => Boolean(item))
      .forEach((item) => {
        forbid.push(normalizeLanguage(item));
      });
  };

  if (species === "cat") {
    add(
      "anthropomorphic cat",
      "cat standing on two legs",
      "cat wearing clothes",
      "mascot suit",
      "human face on cat",
      "extra cat",
      "duplicate cat",
      "duplicate boy",
      "duplicate girl",
      `duplicate ${characterName}`
    );
  } else if (species === "dog") {
    add(
      "anthropomorphic dog",
      "dog standing on two legs",
      "dog wearing clothes",
      "mascot suit",
      "human face on dog",
      "extra dog",
      `duplicate ${characterName}`
    );
  } else if (species === "animal") {
    add(
      "anthropomorphic animal",
      "animal standing on two legs",
      "animal wearing clothes",
      "mascot suit",
      "extra animal",
      `duplicate ${characterName}`
    );
  } else {
    // CRITICAL FIX: AGGRESSIVE HUMAN-GUARD against animal features
    // Per human-guard-fix.md - this prevents human characters from getting animal traits

    // EARS - All types of non-human ears MUST be forbidden
    // CRITICAL v3.1: Added elf/fantasy ears after "Der Goldene Wind" cover issue
    add(
      "animal ears",
      "cat ears",
      "dog ears",
      "furry ears",
      "kemonomimi",
      "neko ears",
      "ears on top of head",
      "pointed ears",
      "fox ears",
      "wolf ears",
      "bunny ears",
      // v3.1: CRITICAL - Elf/Fantasy ears must be explicitly forbidden
      "elf ears",
      "elven ears",
      "fantasy ears",
      "fairy ears",
      "pointy ears",
      "elongated ears",
      "tapered ears",
      "ears pointing upward",
      "ears with pointed tips",
      "non-human ears"
    );

    // TAIL - Any kind of tail MUST be forbidden
    add(
      "tail",
      "cat tail",
      "dog tail",
      "fox tail",
      "any tail",
      "any kind of tail",
      "visible tail",
      "tail behind",
      "tail attachment",
      "tail appendage",
      "fluffy tail",
      "bushy tail",
      "furry tail",
      "appendage from rear",
      "protruding from back"
    );

    // FUR/PELT - Fur texture on human skin MUST be forbidden
    add(
      "fur",
      "pelt",
      "animal fur",
      "animal coat",
      "body fur",
      "furry body",
      "fur coat",
      "fur texture",
      "hairy body",
      "animal skin",
      "furry character",
      "fur covering body",
      "animal pelt",
      "fuzzy skin"
    );

    // FACE - Animal facial features MUST be forbidden
    add(
      "snout",
      "muzzle",
      "animal nose",
      "whiskers",
      "fangs",
      "animal mouth",
      "animal face",
      "cat nose",
      "dog snout",
      "feline face shape",
      "painted whisker markings",
      "beast face",
      "anthropomorphic face",
      "animal jaw"
    );

    // LIMBS - Animal limbs MUST be forbidden
    add(
      "paws",
      "claws",
      "animal hands",
      "animal feet",
      "padded hands",
      "padded feet",
      "paw pads",
      "animal limbs",
      "talons",
      "hooves"
    );

    // GENERAL - Anthropomorphic/furry styles MUST be forbidden
    add(
      "anthropomorphic",
      "furry character",
      "furry",
      "kemono",
      "catboy",
      "dogboy",
      "neko",
      "animal hybrid",
      "half-animal",
      "beast character",
      "beast-human",
      "mascot suit",
      "costume makeup",
      "anthro",
      "zoomorphic"
    );

    // CHARACTER DUPLICATION
    add(
      `duplicate ${characterName}`,
      "duplicate character",
      "identical twins",
      "same appearance",
      "matching clothing",
      "extra children",
      "multiple copies"
    );

    // HAIR COLOR PROTECTION - Prevent wrong hair colors
    if (profile?.hair?.color) {
      const hair = profile.hair.color.toLowerCase();
      if (hair.includes("blond") || hair.includes("gold")) {
        add("brown hair", "black hair", "red hair", "brunette");
      } else if (hair.includes("brown") || hair.includes("chestnut") || hair.includes("brunette")) {
        add("blond hair", "blonde hair", "golden hair", "red hair");
      } else if (hair.includes("black")) {
        add("blond hair", "brown hair", "red hair");
      }
    }

    // EYE COLOR PROTECTION - Prevent wrong eye colors
    if (profile?.eyes?.color) {
      const eyes = profile.eyes.color.toLowerCase();
      if (eyes.includes("blue") || eyes.includes("sky")) {
        add("brown eyes", "green eyes", "amber eyes", "hazel eyes");
      } else if (eyes.includes("green") || eyes.includes("grun") || eyes.includes("emerald")) {
        add("blue eyes", "brown eyes", "amber eyes");
      } else if (eyes.includes("brown") || eyes.includes("amber")) {
        add("blue eyes", "green eyes");
      }
    }
  }

  return Array.from(new Set(forbid));
}

/**
 * Builds a complete CHARACTER BLOCK for image generation
 * v2.0: Now includes Character Invariants for cross-chapter consistency
 *
 * @param name - Character name
 * @param profile - Visual profile from database
 * @param sceneDetails - Optional scene-specific details
 * @param avatarDescription - Original avatar description (for extracting invariants)
 */
export function buildCharacterBlock(
  name: string,
  profile: AvatarVisualProfile | MinimalAvatarProfile,
  sceneDetails?: {
    position?: string;
    expression?: string;
    action?: string;
    pose?: string;
  },
  avatarDescription?: string
): CharacterBlock {
  // CRITICAL: Normalize profile to English BEFORE building character block
  const normalizedProfile = normalizeVisualProfile(profile);

  const species = getSpeciesFromProfile(normalizedProfile);
  const ageHint = normalizedProfile.ageApprox || (species === "human" ? "child 6-8 years" : `young ${species}`);

  // NEW v2.0: Extract explicit measurements from visual profile
  const profileAny = normalizedProfile as any;
  const ageNumeric = profileAny.ageNumeric;
  const heightCm = profileAny.heightCm;

  // NEW v2.0: Build Character Invariants for consistency across all images
  // This ensures features like "tooth gap" ALWAYS appear in every image
  const invariants = buildInvariantsFromVisualProfile(
    name,
    normalizedProfile as AvatarVisualProfile,
    avatarDescription
  );

  // CRITICAL: Also extract invariants from the avatar description text
  // This catches features like "große Zahnlücke" that might not be in visual profile
  if (avatarDescription) {
    const descriptionInvariants = extractInvariantsFromDescription(avatarDescription);
    // Merge with existing invariants (no duplicates)
    const existingIds = new Set(invariants.mustIncludeFeatures.map(f => f.id.split('_')[0]));
    for (const feature of descriptionInvariants) {
      const baseId = feature.id.split('_')[0];
      if (!existingIds.has(baseId)) {
        invariants.mustIncludeFeatures.push(feature);
        // Also add forbidden alternative if exists
        if (feature.forbiddenAlternative) {
          invariants.forbiddenFeatures.push(feature.forbiddenAlternative);
        }
      }
    }
  }

  console.log(`[character-block-builder] Built invariants for ${name}:`, {
    ageNumeric,
    heightCm,
    mustIncludeFeatures: invariants.mustIncludeFeatures.map(f => f.mustIncludeToken),
    forbiddenFeatures: invariants.forbiddenFeatures.slice(0, 5)
  });

  const resolvePose = () => {
    if (sceneDetails?.pose) {
      return sceneDetails.pose;
    }
    if (species === "cat") {
      return "on four paws, tail visible, alert and curious";
    }
    if (species === "human") {
      return "natural child posture, relaxed shoulders";
    }
    return "natural stance";
  };

  const pose = normalizeLanguage(resolvePose());
  const position = normalizeLanguage(sceneDetails?.position || "foreground");
  const expression = sceneDetails?.expression
    ? normalizeLanguage(sceneDetails.expression)
    : species === "human"
      ? "friendly, open expression"
      : species === "cat"
        ? "bright, curious eyes"
        : undefined;
  const action = sceneDetails?.action ? normalizeLanguage(sceneDetails.action) : undefined;

  // ADD AVATAR CANON DETAILS to mustInclude list
  // PRIORITY 1: Use visual_profile data from database (analyzed appearance from Schritt 7)
  // PRIORITY 2: Use extractMustInclude from profile
  // PRIORITY 3: Use hardcoded canon as fallback (only for legacy avatars)

  let mustInclude = extractMustInclude(normalizedProfile, species);

  // NEW v2.0: Add invariant features to mustInclude list (CRITICAL for consistency)
  // This ensures tooth gaps, glasses, etc. are ALWAYS mentioned in prompts
  const invariantFormat = formatInvariantsForPrompt(invariants);
  mustInclude = [...mustInclude, ...invariantFormat.mustIncludeTokens];

  // Build forbid list with invariant-specific forbidden features
  let forbidList = buildForbidList(species, name, normalizedProfile);
  forbidList = [...forbidList, ...invariantFormat.forbidTokens];

  // Try hardcoded canon ONLY as last resort for legacy avatars (alexander, adrian)
  try {
    const canon = getAvatarCanon(name);
    console.log(`[character-block-builder] Using hardcoded canon for legacy avatar: ${name}`);
    mustInclude = [
      ...mustInclude,
      canon.hair,
      canon.eyes,
      canon.clothing,
      ...canon.distinctive
    ];
  } catch (error) {
    // This is EXPECTED for new avatars - they use visual_profile data
    console.log(`[character-block-builder] Using visual_profile data for avatar: ${name} (no hardcoded canon)`);
  }

  // Extract characterType from profile (already extracted above, reuse)
  const characterType = profileAny.characterType || undefined;

  const block: CharacterBlock = {
    name,
    species,
    characterType, // ADD: Character type from visual profile
    ageHint,
    ageNumeric,  // NEW v2.0: Explicit numeric age
    heightCm,    // NEW v2.0: Explicit height in cm
    mustInclude: [...new Set(mustInclude)], // Deduplicate
    forbid: [...new Set(forbidList)], // Deduplicate with invariants
    invariants,  // NEW v2.0: Full invariants object for cross-chapter reference
    pose,
    position,
    expression,
    action,
    detailedDescription: buildDetailedDescription(normalizedProfile, species),
  };
  
  // OPTIMIZATION v2.0: GENRE-AWARE COSTUME OVERRIDES
  // If the scene suggests a strong genre shift (e.g. medieval/fantasy), we override modern clothing
  const genreKeywords = ['medieval', 'fantasy', 'magic', 'castle', 'knight', 'princess', 'dragon', 'fairy', 'wizard', 'witch', 'kingdom', 'ancient', 'steampunk', 'victorian', 'retro', 'historical', 'old world', 'village'];
  const sceneActionLower = (sceneDetails?.action || '').toLowerCase();
  const scenePoseLower = (sceneDetails?.pose || '').toLowerCase();
  const scenePositionLower = (sceneDetails?.position || '').toLowerCase();
  
  // Check if ANY genre keyword appears in action, pose, or position
  const isGenreScene = genreKeywords.some(keyword => 
    sceneActionLower.includes(keyword) || 
    scenePoseLower.includes(keyword) || 
    scenePositionLower.includes(keyword)
  );

  if (isGenreScene) {
     console.log(`[character-block-builder] 🎭 Applying GENRE COSTUME override for ${name} (Triggered by keywords)`);
     // Detect specific sub-genre if possible
     const isSteampunk = sceneActionLower.includes('steampunk') || sceneActionLower.includes('gear') || sceneActionLower.includes('clockwork');
     const genreType = isSteampunk ? 'steampunk' : 'fantasy';

     block.detailedDescription = overrideClothingForGenre(block.detailedDescription, genreType);
     
     // Remove modern clothing items from mustInclude
     block.mustInclude = block.mustInclude.filter(item => 
       !item.includes('hoodie') && 
       !item.includes('jeans') && 
       !item.includes('t-shirt') &&
       !item.includes('sneakers') &&
       !item.includes('baseball cap') &&
       !item.includes('modern')
     );
     
     // Add genre-appropriate clothing based on type
     if (genreType === 'steampunk') {
       block.mustInclude.push('victorian clothing');
       block.mustInclude.push('brass accessories');
     } else {
       block.mustInclude.push('period-appropriate tunic');
       block.mustInclude.push('medieval attire');
     }
  }

  return block;
}

/**
 * Helper to replace modern clothing terms with genre-appropriate ones
 */
function overrideClothingForGenre(description: string, genre: 'fantasy' | 'sci-fi' | 'steampunk'): string {
  if (genre === 'fantasy') {
    return description
      .replace(/hoodie/gi, "hooded tunic")
      .replace(/jeans/gi, "breeches")
      .replace(/t-shirt/gi, "linen shirt")
      .replace(/sneakers/gi, "leather boots")
      .replace(/baseball cap/gi, "cap")
      .replace(/modern/gi, "timeless");
  }
  if (genre === 'steampunk') {
    return description
      .replace(/hoodie/gi, "vest with brass buttons")
      .replace(/jeans/gi, "striped trousers")
      .replace(/t-shirt/gi, "ruffled shirt")
      .replace(/sneakers/gi, "heavy boots")
      .replace(/baseball cap/gi, "aviator cap")
      .replace(/modern/gi, "victorian");
  }
  return description;
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
    return normalizeLanguage(normalized);
  }
  const limited = sentences.slice(0, maxCount).join(" ").trim();
  return normalizeLanguage(limited);
}

/**
 * Formats a CHARACTER BLOCK as a structured prompt section.
 * Aligns with StoryWeaver prompt template (CHARACTER / MUST INCLUDE / FORBID).
 */
export function formatCharacterBlockAsPrompt(block: CharacterBlock): string {
  const safeName = normalizeLanguage(block.name);
  const safeAge = block.ageHint ? normalizeLanguage(block.ageHint) : undefined;

  const mustInclude = Array.from(
    new Set(
      (block.mustInclude || [])
        .map((item) => normalizeLanguage(item))
        .filter(Boolean)
    )
  ).slice(0, 6);

  const forbidInput = Array.from(
    new Set(
      (block.forbid || [])
        .map((item) => normalizeLanguage(item))
        .filter(Boolean)
    )
  );

  let speciesSummary = "";
  let depictLine = "";
  let defaultMust: string[] = [];
  let defaultForbid: string[] = [];

  if (block.species === "cat") {
    // Use characterType if available, otherwise use detailedDescription
    const typeDesc = block.characterType || block.detailedDescription || "feline quadruped";
    speciesSummary = `${typeDesc}`;
    depictLine = `${safeName} must appear as described: ${typeDesc}`;
    defaultMust = [
      "four paws grounded",
      "tail visible",
      "long whiskers",
      "feline face shape",
    ];
    defaultForbid = [
      "standing upright",
      "wearing clothes",
      `duplicate ${safeName}`,
      "extra human child",
      "mascot costume",
      "humanoid cat",
      "cat with human body",
    ];
  } else if (block.species === "dog") {
    const typeDesc = block.characterType || block.detailedDescription || "canine quadruped";
    speciesSummary = `${typeDesc}`;
    depictLine = `${safeName} must appear as described: ${typeDesc}`;
    defaultMust = ["four paws grounded", "expressive muzzle"];
    defaultForbid = ["standing upright", "wearing clothes", `duplicate ${safeName}`];
  } else if (block.species === "animal") {
    // CRITICAL FIX: Use characterType from profile instead of generic "storybook animal"
    const animalType = block.characterType || block.detailedDescription || "creature";
    speciesSummary = `${animalType} with natural proportions`;
    depictLine = `${safeName} should stay a ${animalType}, not humanoid.`;
    defaultMust = ["natural body silhouette"];
    defaultForbid = ["standing upright", "wearing clothes", `duplicate ${safeName}`];
  } else {
    // v3.6: Rewritten with POSITIVE guidance for Flux.1 Dev
    speciesSummary = `human child (${safeAge || "6-8 years"})`;
    depictLine = `${safeName} is a human child with natural skin, hair, and facial structure. Ears: round human ears with curved outer rim and soft earlobe, positioned on sides of head at ear-level.`;
    defaultMust = [
      "smooth human skin",
      "friendly child expression",
      "distinct facial features",
      "natural child anatomy",
      "everyday clothing",
      // CRITICAL v3.6: POSITIVE ear description (Flux.1 responds better to this)
      "round human ears with curved outer rim",
      "ears positioned on sides of head at ear-level",
      "ear shape like real human children",
    ];
    defaultForbid = [
      `duplicate ${safeName}`,
      `animal traits`,
      "tail or whiskers",
      "cat nose",
      "fur texture on skin",
      "painted whiskers",
      // v3.6: Keep these for non-Flux models, but rely on POSITIVE guidance for Flux.1
      "pointed ears",
      "elf ears",
      "fantasy ears",
    ];
  }

  const detailParts: string[] = [];
  if (block.detailedDescription) {
    detailParts.push(normalizeLanguage(block.detailedDescription));
  }
  if (block.expression) {
    detailParts.push(`expression ${normalizeLanguage(block.expression)}`);
  }
  if (block.action) {
    detailParts.push(`action ${normalizeLanguage(block.action)}`);
  }
  if (block.pose) {
    detailParts.push(`pose ${normalizeLanguage(block.pose)}`);
  }
  if (block.position) {
    detailParts.push(`position ${normalizeLanguage(block.position)}`);
  }

  const traits = Array.from(new Set([...defaultMust, ...mustInclude]))
    .filter(Boolean)
    .slice(0, 6);

  const forbids = Array.from(new Set([...defaultForbid, ...forbidInput]))
    .filter(Boolean)
    .slice(0, 6);

  const parts = [
    `CHARACTER ${safeName}: ${speciesSummary}`,
    depictLine,
    traits.length > 0 ? `TRAITS ${traits.join(", ")}` : "",
    detailParts.length > 0 ? `DETAILS ${detailParts.join(", ")}` : "",
    forbids.length > 0 ? `NEVER ${forbids.join(", ")}` : "",
    "camera eye-level medium full shot",
  ].filter(Boolean);

  return parts.join(". ");
}

/**
 * Builds multi-character prompt with enhanced positioning and invariants
 * v2.0: Now supports avatar descriptions for invariant extraction
 */
export function buildMultiCharacterPrompt(
  charactersData: Array<{
    name: string;
    profile: AvatarVisualProfile | MinimalAvatarProfile;
    description?: string; // NEW v2.0: Original avatar description for invariant extraction
    sceneDetails?: {
      position?: string;
      expression?: string;
      action?: string;
      pose?: string;
    };
  }>
): { prompt: string; blocks: CharacterBlock[]; characterInvariantsRef: string } {
  // CRITICAL: For multi-character scenes, explicitly set left/right positions
  // NEW v2.0: Sort characters by height (shorter on left) for visual consistency
  const sortedData = [...charactersData].sort((a, b) => {
    const heightA = (a.profile as any).heightCm || 999;
    const heightB = (b.profile as any).heightCm || 999;
    return heightA - heightB;
  });

  const enrichedData = sortedData.map((data, index) => {
    const sceneDetails = { ...(data.sceneDetails || {}) };

    // Auto-assign positions for 2-character scenes if not specified
    // CRITICAL: Shorter character always on LEFT to prevent visual confusion
    if (sortedData.length === 2 && !sceneDetails.position) {
      sceneDetails.position = index === 0 ? "left side of frame (shorter)" : "right side of frame (taller)";
    } else if (sortedData.length > 2 && !sceneDetails.position) {
      const positions = ["far left", "center left", "center", "center right", "far right"];
      sceneDetails.position = positions[index] || "foreground";
    } else if (!sceneDetails.position) {
      sceneDetails.position = "foreground";
    }

    return {
      ...data,
      sceneDetails,
    };
  });

  // Build character blocks with invariants
  const blocks = enrichedData.map((data) =>
    buildCharacterBlock(data.name, data.profile, data.sceneDetails, data.description)
  );

  // NEW v2.0: Build cross-chapter character invariants reference
  // This can be appended to EVERY image prompt in the story for consistency
  const characterInvariantsRef = blocks
    .filter(b => b.invariants)
    .map(b => {
      const inv = b.invariants!;
      const parts = [`[${b.name}]`];
      if (inv.ageNumeric) parts.push(`${inv.ageNumeric}yo`);
      if (inv.heightCm) parts.push(`${inv.heightCm}cm`);
      if (inv.lockedHairColor) parts.push(`${inv.lockedHairColor} hair`);
      if (inv.lockedEyeColor) parts.push(`${inv.lockedEyeColor} eyes`);
      const criticalFeatures = inv.mustIncludeFeatures
        .filter(f => f.priority === 1)
        .map(f => f.mustIncludeToken)
        .slice(0, 3);
      if (criticalFeatures.length > 0) {
        parts.push(`MUST: ${criticalFeatures.join(', ')}`);
      }
      return parts.join(' | ');
    })
    .join('\n');

  const formattedBlocks = blocks
    .map((block) => formatCharacterBlockAsPrompt(block))
    .join("\n\n");

  // ADD VISUAL DISTINCTION WARNING for multiple characters
  let distinctionWarning = "";
  if (blocks.length > 1) {
    try {
      // Create SimpleAvatarCanon objects dynamically from the full profiles
      const simpleCanons = enrichedData.map(data => {
        const profile = data.profile;
        return {
          name: data.name,
          hair: profile.hair?.color || 'unknown',
          eyes: profile.eyes?.color || 'unknown',
          clothing: profile.clothingCanonical?.outfit || profile.clothingCanonical?.top || 'unknown',
          distinctive: profile.skin?.distinctiveFeatures || []
        };
      });
      distinctionWarning = buildVisualDistinctionWarning(simpleCanons);
    } catch (error) {
      console.warn("[character-block-builder] Could not add visual distinction warning:", error);
    }
  }

  // NEW v2.0: Add CHARACTER INVARIANTS section to prompt for cross-chapter consistency
  const invariantsSection = characterInvariantsRef
    ? `\n\nCHARACTER INVARIANTS (CRITICAL - SAME IN EVERY IMAGE):\n${characterInvariantsRef}`
    : "";

  return {
    blocks,
    prompt: formattedBlocks + (distinctionWarning ? "\n\n" + distinctionWarning : "") + invariantsSection,
    characterInvariantsRef, // NEW v2.0: Return for use across all chapter images
  };
}

/**
 * Builds scene/style block (Abschnitt 4.4)
 */
export interface SceneStyleBlock {
  masterStyle: string;
  colorAndLight: string;
  atmosphere: string;
  mediumDetails: string;
  scene: string;
  composition: string;
  background: string;
  lighting: string;
  qualityGuards: string;
  storybookFinish: string;
}

export function buildSceneStyleBlock(
  scene?: string,
  characterCount = 1,
  includesAnimal = false,
  includesCat = false,
  includesHuman = true
): SceneStyleBlock {
  const baseScene =
    scene && scene.trim() !== ""
      ? limitSentences(scene, 2)
      : "storybook scene with gentle motion";

  const composition =
    characterCount > 1
      ? "balanced two-character framing, soft leading lines"
      : "single character centered, welcoming framing";

  const qualityParts = [
    `${characterCount} subject${characterCount === 1 ? "" : "s"} child-safe`,
    "anatomically correct proportions",
    "print-ready clarity",
  ];

  if (includesCat) {
    qualityParts.push("cat stays quadruped, tail visible, no clothing");
  }
  if (includesHuman) {
    qualityParts.push("human child keeps natural features, no animal traits");
  }
  if (includesCat && includesHuman) {
    qualityParts.push("exactly one cat and one human, clearly distinct");
  }
  if (characterCount > 1) {
    qualityParts.push("no duplicate characters, no extra children");
  }
  if (includesAnimal && !includesCat) {
    qualityParts.push("animal stays natural, no human traits");
  }

  return {
    masterStyle:
      "Axel Scheffler watercolor storybook illustration with gentle gouache textures",
    colorAndLight:
      "warm rim light, soft pastels, hand-inked outlines, subtle vignette",
    atmosphere: "whimsical hopeful mood with gentle story tension",
    mediumDetails:
      "traditional pigments on textured paper, delicate brush strokes",
    scene: baseScene,
    composition,
    background:
      "storybook environment with handcrafted props and painterly scenery",
    lighting: "golden key light, gentle bounce, candle-glow highlights",
    qualityGuards: qualityParts.join(", "),
    storybookFinish: "soft vignette, sparkling dust motes, inviting glow",
  };
}

/**
 * Formats scene/style block as prompt text
 */
export function formatSceneStyleBlockAsPrompt(block: SceneStyleBlock): string {
  const lines = [
    `MASTERSTYLE ${block.masterStyle}`,
    `COLOR ${block.colorAndLight}`,
    `ATMOSPHERE ${block.atmosphere}`,
    `MEDIUM ${block.mediumDetails}`,
    `SCENE ${block.scene}`,
    `COMPOSITION ${block.composition}`,
    `BACKGROUND ${block.background}`,
    `LIGHTING ${block.lighting}`,
    `QUALITY ${block.qualityGuards}`,
    `FINISH ${block.storybookFinish}`,
  ];

  return lines.map((line) => normalizeLanguage(line)).join(". ");
}

/**
 * Complete image prompt builder combining characters + scene/style
 * NEW FORMAT: CHARACTERS / SCENE / COMPOSITION / LIGHTING / MOOD
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
  customStyle?: Partial<SceneStyleBlock> & {
    style?: string;
    quality?: string;
    backgroundStyle?: string;
    composition?: string;
    lighting?: string;
    mood?: string;
  };
  supportingCharacterLines?: string[];
  environmentLayers?: {
    foreground?: string[];
    midground?: string[];
    background?: string[];
  };
  props?: string[];
  atmosphereLines?: string[];
  recurringElementNote?: string;
  storytellingDetails?: string[];
}

function normalizeSceneStyleOverrides(
  overrides?: CompleteImagePromptOptions["customStyle"]
): Partial<SceneStyleBlock> {
  if (!overrides) {
    return {};
  }

  const normalized: Partial<SceneStyleBlock> = {};

  for (const [key, value] of Object.entries(overrides)) {
    if (!value) continue;
    const normalizedValue = normalizeLanguage(value);

    switch (key) {
      case "style":
        normalized.masterStyle = normalizedValue;
        break;
      case "quality":
        normalized.qualityGuards = normalizedValue;
        break;
      case "backgroundStyle":
        normalized.background = normalizedValue;
        break;
      default:
        (normalized as any)[key] = normalizedValue;
        break;
    }
  }

  return normalized;
}

const defaultActionBySpecies: Record<SpeciesType, string> = {
  human: "leans into the moment with lively curiosity",
  cat: "pads softly forward on four paws",
  dog: "trots gently on four paws with tail relaxed",
  animal: "moves naturally through the scene",
};

/**
 * Builds detailed character description for structured prompt format
 * Example: "Diego (orange tabby KITTEN - feline quadruped on four paws, white belly, green eyes, long whiskers, curved tail)"
 */
function buildStructuredCharacterLine(block: CharacterBlock): string {
  const parts: string[] = [];

  // Determine species type dynamically from profile data
  let speciesType = "";

  if (block.species === "cat") {
    // Use characterType if available, otherwise generic cat description
    if (block.characterType) {
      speciesType = block.characterType;
    } else {
      speciesType = "feline quadruped on four paws";
    }
  } else if (block.species === "dog") {
    // Use characterType if available, otherwise generic dog description
    if (block.characterType) {
      speciesType = block.characterType;
    } else {
      speciesType = "canine quadruped on four legs";
    }
  } else if (block.species === "animal") {
    // CRITICAL FIX: Use characterType from visual profile, not hardcoded "KITTEN"
    if (block.characterType) {
      speciesType = `${block.characterType}`;
    } else {
      speciesType = "CREATURE - natural form";
    }
  } else {
    // Human - Use Age-Guards for accurate age representation
    const ageHint = block.ageHint || "child";
    speciesType = `HUMAN ${ageHint}, standing on two legs like humans do, NO animal features`;
  }

  // Build detailed physical description
  const physicalTraits: string[] = [];

  if (block.species === "cat" || block.species === "dog" || block.species === "animal") {
    // Animal descriptions
    if (block.detailedDescription) {
      physicalTraits.push(block.detailedDescription);
    }
    // Add must-include traits
    block.mustInclude.slice(0, 4).forEach(trait => {
      if (!physicalTraits.some(p => p.includes(trait))) {
        physicalTraits.push(trait);
      }
    });
  } else {
    // Human descriptions
    if (block.detailedDescription) {
      physicalTraits.push(block.detailedDescription);
    }
    block.mustInclude.slice(0, 3).forEach(trait => {
      if (!physicalTraits.some(p => p.includes(trait))) {
        physicalTraits.push(trait);
      }
    });
  }

  const physicalDesc = physicalTraits.join(", ");

  // Build action description
  const actionDesc = block.action || block.pose || "";

  // Format: "Name (species type - physical traits) action"
  let line = `${normalizeLanguage(block.name)} (${speciesType}`;
  if (physicalDesc) {
    line += `, ${physicalDesc}`;
  }
  line += ")";

  if (actionDesc) {
    line += ` ${normalizeLanguage(actionDesc)}`;
  }

  // Add expression if provided
  if (block.expression) {
    line += `, ${normalizeLanguage(block.expression)}`;
  }

  return line;
}

export function buildCompleteImagePrompt(
  options: CompleteImagePromptOptions
): { positivePrompt: string; negativePrompt: string } {
  const { blocks } = buildMultiCharacterPrompt(options.characters);
  const subjectCount = blocks.length || options.characters.length;
  const speciesSet = new Set(blocks.map((b) => b.species));
  const includesAnimal = Array.from(speciesSet).some((s) => s !== "human");
  const includesCat = speciesSet.has("cat");
  const includesHuman = speciesSet.has("human");

  const styleOverrides = normalizeSceneStyleOverrides(options.customStyle);
  const sceneStyle = {
    ...buildSceneStyleBlock(
      options.scene,
      subjectCount,
      includesAnimal,
      includesCat,
      includesHuman
    ),
    ...styleOverrides,
  };

  // NEW STRUCTURED FORMAT: CHARACTERS / SCENE / COMPOSITION / LIGHTING / MOOD

  // 1. CHARACTERS - Detailed description of each avatar
  const characterLines = blocks.map(block => buildStructuredCharacterLine(block));
  const charactersSection = `CHARACTERS: ${characterLines.join(" ")}`;

  // 2. SCENE - Setting and environment description
  const sceneText = options.scene ? limitSentences(options.scene, 2) : sceneStyle.scene;
  const sceneSection = `SCENE: ${normalizeLanguage(sceneText)}. ${normalizeLanguage(sceneStyle.background)}`;

  // Supporting characters from narrative context
  const supportingSection =
    options.supportingCharacterLines && options.supportingCharacterLines.length > 0
      ? `SUPPORTING CHARACTERS: ${normalizeLanguage(options.supportingCharacterLines.join(" | "))}`
      : "";

  // Environment layers summary
  const environmentLayerLines: string[] = [];
  if (options.environmentLayers?.foreground?.length) {
    environmentLayerLines.push(
      "Foreground: " + normalizeLanguage(options.environmentLayers.foreground.join(", "))
    );
  }
  if (options.environmentLayers?.midground?.length) {
    environmentLayerLines.push(
      "Midground: " + normalizeLanguage(options.environmentLayers.midground.join(", "))
    );
  }
  if (options.environmentLayers?.background?.length) {
    environmentLayerLines.push(
      "Background: " + normalizeLanguage(options.environmentLayers.background.join(", "))
    );
  }
  const environmentSection =
    environmentLayerLines.length > 0 ? `ENVIRONMENT: ${environmentLayerLines.join(" | ")}` : "";

  const propsSection =
    options.props && options.props.length > 0
      ? `PROPS & OBJECTS: ${normalizeLanguage(options.props.join(", "))}`
      : "";

  const atmosphereSection =
    options.atmosphereLines && options.atmosphereLines.length > 0
      ? `ATMOSPHERE: ${normalizeLanguage(options.atmosphereLines.join(" | "))}`
      : "";

  const recurringSection = options.recurringElementNote
    ? `RECURRING ELEMENT: ${normalizeLanguage(options.recurringElementNote)}`
    : "";

  const storytellingSection =
    options.storytellingDetails && options.storytellingDetails.length > 0
      ? `STORY DETAILS: ${normalizeLanguage(options.storytellingDetails.join(", "))}`
      : "";

  // 3. COMPOSITION - Positioning, camera angle, depth layers
  const compositionParts: string[] = [];

  // Position information
  const positionInfo = blocks.map(block => {
    const pos = block.position || "center";
    return `${normalizeLanguage(block.name)} ${normalizeLanguage(pos)}`;
  }).join(", ");
  compositionParts.push(positionInfo);

  // Camera and framing
  compositionParts.push("child-height eye-level perspective");
  compositionParts.push("gentle depth of field");

  // Custom composition if provided
  if (options.customStyle?.composition) {
    compositionParts.push(normalizeLanguage(options.customStyle.composition));
  }

  const compositionSection = `COMPOSITION: ${compositionParts.join(". ")}`;

  // 4. LIGHTING - Light direction, quality, mood lighting
  const lightingText = options.customStyle?.lighting || sceneStyle.lighting;
  const lightingSection = `LIGHTING: ${normalizeLanguage(lightingText)}`;

  // 5. MOOD - Emotional atmosphere
  const moodText = options.customStyle?.mood || sceneStyle.atmosphere;
  const moodSection = `MOOD: ${normalizeLanguage(moodText)}`;

  // Build final prompt with sections
  // CRITICAL FOR FLUX.1: Add positive exclusions since Flux.1 Dev doesn't support negative prompts
  const fluxExclusions = buildPositiveExclusionsForFlux(blocks);

  const sections = [
    charactersSection,
    sceneSection,
    supportingSection,
    environmentSection,
    propsSection,
    atmosphereSection,
    recurringSection,
    storytellingSection,
    compositionSection,
    lightingSection,
    moodSection,
    // Quality guards
    buildSpeciesGuardLine(blocks),
    // CRITICAL: Flux.1 exclusions must be in positive prompt
    fluxExclusions,
    normalizeLanguage(`${sceneStyle.masterStyle}. ${sceneStyle.mediumDetails}`),
    "No text or typography in image.",
  ].filter(Boolean);

  const rawPrompt = sections.join("\n\n").replace(/\s+/g, " ").trim();
  const asciiPrompt = ensureAscii(rawPrompt);
  const positivePrompt = clampPromptLength(asciiPrompt, 1500); // Increased limit for structured format

  // Build negative prompt from all character forbid lists
  const negativePrompt = buildNegativePromptFromBlocks(blocks);

  // Add Age-Consistency Guards for human characters
  // CRITICAL FIX: Use explicit height data from visual profile to ensure Adrian (5y/120cm)
  // is always visibly shorter than Alexander (8y/135cm)
  const humanBlocks = blocks.filter(b => b.species === 'human');
  let ageGuardsSection = "";

  if (humanBlocks.length > 0) {
    const ageGuardLines: string[] = [];

    // Build character data with explicit height from visual profile
    const charactersWithHeight: CharacterWithHeight[] = humanBlocks.map((block) => {
      // Find matching character data by name (since humanBlocks is filtered)
      const originalCharData = options.characters.find(c => c.name === block.name);
      const profile = originalCharData?.profile as any;

      // Extract explicit numeric age from visual profile (prioritize ageNumeric > age > ageApprox)
      const ageNumeric = profile?.ageNumeric || profile?.age;
      const ageFromHint = block.ageHint?.match(/(\d+)/);
      const extractedAge = ageNumeric || (ageFromHint ? parseInt(ageFromHint[1], 10) : undefined);

      // Extract explicit height in cm from visual profile
      const heightCm = profile?.heightCm || profile?.height;

      return {
        name: block.name,
        age: extractedAge,
        ageNumeric: ageNumeric,
        ageApprox: block.ageHint,
        heightCm: heightCm,
        species: block.species
      };
    });

    // Use height-aware prompts for each character
    charactersWithHeight.forEach(char => {
      if (char.ageNumeric || char.age || char.heightCm || char.ageApprox) {
        // Use height-aware function if we have explicit height data
        if (char.heightCm) {
          const ageGuard = buildAgeAccuratePromptWithHeight(
            char.name,
            char.ageNumeric || char.age,
            char.ageApprox,
            char.heightCm
          );
          ageGuardLines.push(ageGuard);
        } else {
          // Fallback to standard age prompt
          const ageGuard = buildAgeAccuratePrompt(
            char.name,
            char.ageNumeric || char.age,
            char.ageApprox
          );
          ageGuardLines.push(ageGuard);
        }
      }
    });

    // Add relative height references for multi-character scenes
    // CRITICAL: This fixes the Adrian/Alexander issue by using explicit height comparisons
    if (charactersWithHeight.length > 1) {
      // Check if any character has explicit height data
      const hasExplicitHeights = charactersWithHeight.some(c => c.heightCm);

      if (hasExplicitHeights) {
        // Use height-aware function for precise comparisons
        const relativeHeights = buildRelativeHeightReferencesWithHeight(charactersWithHeight);
        if (relativeHeights) {
          ageGuardLines.push(relativeHeights);
        }
      } else {
        // Fallback to age-based height references
        const relativeHeights = buildRelativeHeightReferences(
          charactersWithHeight.map(c => ({
            name: c.name,
            age: c.age,
            ageApprox: c.ageApprox,
            species: c.species
          }))
        );
        if (relativeHeights) {
          ageGuardLines.push(relativeHeights);
        }
      }
    }

    if (ageGuardLines.length > 0) {
      ageGuardsSection = "\n\nAGE CONSISTENCY GUARDS:\n" + ageGuardLines.join("\n\n");
    }
  }

  // Append age guards to positive prompt
  const finalPositivePrompt = positivePrompt + ageGuardsSection;

  return { positivePrompt: finalPositivePrompt, negativePrompt };
}

function formatCharacterNarrativeLine(block: CharacterBlock): string {
  const safeName = normalizeLanguage(block.name);
  const speciesTag = determineSpeciesTag(block);
  const actionPhrase = buildActionPhrase(block);
  const expressionPhrase = block.expression
    ? `with ${normalizeLanguage(block.expression)}`
    : "";
  const positionPhrase = block.position
    ? `positioned ${normalizeLanguage(block.position)}`
    : "";

  const descriptors = [actionPhrase, expressionPhrase, positionPhrase]
    .filter(Boolean)
    .join(", ");

  // CRITICAL: Include ALL visual traits, not just a summary!
  const traitSummary = summarizeCharacterTraits(block);
  const visualDetails = buildFullVisualDescription(block);

  const baseLine = descriptors.length
    ? `${safeName} (${speciesTag}) ${descriptors}`
    : `${safeName} (${speciesTag}) engages with the scene`;

  // Include BOTH traits AND full visual description
  const fullLine = [
    baseLine,
    visualDetails ? `Visual: ${visualDetails}` : "",
    traitSummary ? `Key traits: ${traitSummary}` : ""
  ].filter(Boolean).join(". ");

  return normalizeLanguage(fullLine);
}

/**
 * Builds complete visual description from detailedDescription and mustInclude
 */
function buildFullVisualDescription(block: CharacterBlock): string {
  const parts: string[] = [];

  // Add detailedDescription (contains hair, eyes, skin, etc.)
  if (block.detailedDescription) {
    parts.push(block.detailedDescription);
  }

  // Add top 3 most important mustInclude items that aren't already in description
  const additionalTraits = (block.mustInclude || [])
    .filter(item => !block.detailedDescription?.includes(item))
    .slice(0, 3);

  if (additionalTraits.length > 0) {
    parts.push(additionalTraits.join(", "));
  }

  return parts.join("; ");
}

function determineSpeciesTag(block: CharacterBlock): string {
  const ageHint = block.ageHint ? normalizeLanguage(block.ageHint) : "";

  // CRITICAL FIX: Use characterType from profile instead of hardcoded species names
  if (block.characterType) {
    return block.characterType;
  }

  // Fallback to generic descriptions only if characterType is missing
  switch (block.species) {
    case "cat":
      return "feline quadruped";
    case "dog":
      return "canine quadruped";
    case "animal":
      return "creature";
    default:
      return ageHint ? `HUMAN child (${ageHint})` : "HUMAN child";
  }
}

function buildActionPhrase(block: CharacterBlock): string {
  if (block.action) {
    return ensureActionVerb(normalizeLanguage(block.action));
  }
  if (block.pose) {
    return convertPoseToAction(block.pose, block.species);
  }
  return defaultActionBySpecies[block.species] || "engages with playful energy";
}

function ensureActionVerb(phrase: string): string {
  let trimmed = phrase.trim().replace(/[.?!]+$/, "");
  if (!trimmed) {
    return "";
  }
  const replacements: Array<[RegExp, string]> = [
    [/^is\s+/i, ""],
    [/^are\s+/i, ""],
    [/^standing\b/i, "stands"],
    [/^sitting\b/i, "sits"],
    [/^looking\b/i, "looks"],
    [/^holding\b/i, "holds"],
    [/^smiling\b/i, "smiles"],
    [/^walking\b/i, "walks"],
    [/^running\b/i, "runs"],
    [/^jumping\b/i, "jumps"],
    [/^floating\b/i, "floats"],
    [/^flying\b/i, "flies"],
    [/^reaching\b/i, "reaches"],
  ];

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(trimmed)) {
      trimmed = trimmed.replace(pattern, replacement).trim();
      break;
    }
  }

  return trimmed;
}

function convertPoseToAction(pose: string, species: SpeciesType): string {
  const normalized = normalizeLanguage(pose).trim();
  if (!normalized) {
    return defaultActionBySpecies[species] || "moves with gentle energy";
  }
  const replacements: Array<[RegExp, string]> = [
    [/^standing\b/i, "stands"],
    [/^sitting\b/i, "sits"],
    [/^kneeling\b/i, "kneels"],
    [/^crouching\b/i, "crouches"],
  ];
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(normalized)) {
      return normalized.replace(pattern, replacement);
    }
  }
  return `holds ${normalized}`;
}

function summarizeCharacterTraits(block: CharacterBlock): string {
  const candidates: string[] = [];
  if (block.detailedDescription) {
    block.detailedDescription
      .split(/[.;]/)
      .map((part) => normalizeLanguage(part).trim())
      .filter(Boolean)
      .forEach((part) => candidates.push(part));
  }
  (block.mustInclude || [])
    .map((item) => normalizeLanguage(item).trim())
    .filter(Boolean)
    .forEach((item) => candidates.push(item));

  const unique = Array.from(new Set(candidates))
    .filter(Boolean)
    .slice(0, 3);

  return unique.join(", ");
}

/**
 * Builds negative prompt from all character forbid lists
 * NOTE: Flux.1 Dev does NOT support negative prompts, so this is only used
 * for fallback with other models. For Flux.1, use buildPositiveExclusionsForFlux()
 */
function buildNegativePromptFromBlocks(blocks: CharacterBlock[]): string {
  const allForbidden: string[] = [];

  // Collect all forbid items from all characters
  blocks.forEach(block => {
    if (block.forbid && Array.isArray(block.forbid)) {
      allForbidden.push(...block.forbid);
    }
  });

  // Remove duplicates and limit to most important items
  const uniqueForbidden = Array.from(new Set(allForbidden))
    .filter(item => item && item.trim().length > 0)
    .slice(0, 50); // Limit to 50 most important items

  // Join with commas for Runware API
  return uniqueForbidden.join(", ");
}

/**
 * CRITICAL FOR FLUX.1 v3.6: Builds POSITIVE anatomy guidance since Flux.1 Dev
 * does NOT support negative prompts and responds poorly to "NO X" statements.
 *
 * Instead of saying "NO elf ears", we describe what SHOULD be there:
 * "round human ears positioned on sides of head at ear-level"
 *
 * @returns A compact string to append to positive prompts
 */
export function buildPositiveExclusionsForFlux(blocks: CharacterBlock[]): string {
  const humanBlocks = blocks.filter(b => b.species === 'human');
  if (humanBlocks.length === 0) return "";

  // v3.6: POSITIVE guidance for human characters - Flux.1 responds better to this!
  const positiveGuidance = [
    // Ears - POSITIVE description (not "NO elf ears")
    "EARS: round human ears with curved outer rim and soft earlobe",
    "ear position: on sides of head at ear-level like real human children",
    // Human anatomy - POSITIVE description
    "smooth human skin",
    "human hands with 5 fingers",
    "human feet with toes",
    // General
    "100% human child anatomy",
  ];

  // Build character-specific positive guidance
  const characterNames = humanBlocks.map(b => b.name).join(" and ");

  return `[ANATOMY REQUIREMENTS for ${characterNames}: ${positiveGuidance.join(", ")}]`;
}

function buildSpeciesGuardLine(blocks: CharacterBlock[]): string {
  const catNames = blocks
    .filter((b) => b.species === "cat")
    .map((b) => normalizeLanguage(b.name));
  const humanNames = blocks
    .filter((b) => b.species === "human")
    .map((b) => normalizeLanguage(b.name));
  const dogNames = blocks
    .filter((b) => b.species === "dog")
    .map((b) => normalizeLanguage(b.name));
  const otherAnimals = blocks
    .filter((b) => b.species === "animal")
    .map((b) => normalizeLanguage(b.name));

  // v3.6: Rewritten to use POSITIVE guidance - Flux.1 Dev responds better to "MUST HAVE" than "NO X"
  if (catNames.length && humanNames.length) {
    return normalizeLanguage(
      `SPECIES GUARD: ${catNames.join(" and ")} are real quadruped cats with visible tails. ${humanNames.join(" and ")} are human children with: smooth human skin, round human ears with curved outer rim positioned on sides of head at ear-level, human hands with 5 fingers, human feet with toes. Ear shape for humans: like real human children - curved outer edge, soft earlobe.`
    );
  }
  if (catNames.length) {
    return normalizeLanguage(
      `SPECIES GUARD: ${catNames.join(" and ")} are non-anthropomorphic cats on four paws with whiskers and tails visible.`
    );
  }
  if (humanNames.length) {
    return normalizeLanguage(
      `SPECIES GUARD for ${humanNames.join(" and ")}: Human children with smooth human skin, round human ears positioned on sides of head at ear-level (curved outer rim, soft earlobe - exactly like real human children), human hands with 5 fingers, human feet with toes. 100% human child anatomy.`
    );
  }
  if (dogNames.length) {
    return normalizeLanguage(
      `SPECIES GUARD Keep ${dogNames.join(
        " and "
      )} as natural canine quadrupeds with tails visible.`
    );
  }
  if (otherAnimals.length) {
    return normalizeLanguage(
      `SPECIES GUARD Keep ${otherAnimals.join(
        " and "
      )} as natural animals without human traits.`
    );
  }
  return normalizeLanguage(
    "SPECIES GUARD Keep every character true to their species with no hybrids, no duplicates, no swapped features."
  );
}

function ensureAscii(text: string): string {
  const replacements: Record<string, string> = {
    ä: "ae",
    ö: "oe",
    ü: "ue",
    Ä: "Ae",
    Ö: "Oe",
    Ü: "Ue",
    ß: "ss",
  };
  return text
    .replace(/[äöüÄÖÜß]/g, (char) => replacements[char] || char)
    .replace(/[^\x20-\x7E]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampPromptLength(prompt: string, maxLength = 1200): string {
  if (prompt.length <= maxLength) {
    return prompt;
  }
  const clipped = prompt.slice(0, maxLength - 1);
  const lastPeriod = clipped.lastIndexOf(".");
  if (lastPeriod > 200) {
    return clipped.slice(0, lastPeriod + 1).trim();
  }
  return clipped.trim();
}
