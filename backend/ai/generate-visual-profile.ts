import { api } from "encore.dev/api";

/**
 * Structured Avatar Data for Visual Profile Generation
 * This interface matches the frontend AvatarFormData structure
 */
export interface StructuredAvatarData {
  name: string;
  characterType: string; // e.g., "human", "dog", "cat", "unicorn"
  customCharacterType?: string; // For "other" type

  // Demographics
  age: number; // Direct age in years (e.g., 5, 8, 150)
  gender: "male" | "female";
  height?: number; // Height in cm (for humans)
  bodyBuild?: "slim" | "normal" | "sturdy";

  // Appearance
  hairColor: string; // e.g., "blonde", "brown", "black"
  hairStyle: string; // e.g., "short", "long", "curly"
  eyeColor: string; // e.g., "blue", "green", "brown"
  skinTone: string; // e.g., "light", "medium", "dark" for humans; "orange", "brown" for animals

  // Special features
  specialFeatures?: string[]; // e.g., ["glasses", "freckles", "wings"]

  // Optional additional description
  additionalDescription?: string;
}

export interface GenerateVisualProfileRequest {
  avatarData: StructuredAvatarData;
}

export interface GenerateVisualProfileResponse {
  visualProfile: any;
  englishDescription: string;
}

// Character type mappings to English
const CHARACTER_TYPE_MAP: Record<string, string> = {
  human: "human child",
  dog: "dog",
  cat: "cat",
  rabbit: "rabbit",
  fox: "fox",
  bear: "bear",
  unicorn: "unicorn",
  fairy: "fairy",
  robot: "robot",
  alien: "alien creature",
  wizard: "wizard",
  dragon: "dragon",
  other: "fantasy creature",
};

// Hair color mappings
const HAIR_COLOR_MAP: Record<string, string> = {
  blonde: "blonde",
  brown: "brown",
  black: "black",
  red: "red",
  gray: "gray",
  colorful: "colorful rainbow",
  none: "bald",
};

// Hair style mappings
const HAIR_STYLE_MAP: Record<string, string> = {
  short: "short",
  long: "long",
  curly: "curly",
  braids: "braided",
  ponytail: "ponytail",
  none: "no hair",
};

// Eye color mappings
const EYE_COLOR_MAP: Record<string, string> = {
  blue: "blue",
  green: "green",
  brown: "brown",
  gray: "gray",
  amber: "amber",
  other: "unique colored",
};

// Skin tone mappings (humans)
const SKIN_TONE_MAP: Record<string, string> = {
  very_light: "very light skin",
  light: "light skin",
  medium: "medium skin",
  olive: "olive skin",
  tan: "tan skin",
  brown: "brown skin",
  dark: "dark skin",
};

// Fur color mappings (animals)
const FUR_COLOR_MAP: Record<string, string> = {
  white: "white fur",
  cream: "cream fur",
  golden: "golden fur",
  orange: "orange fur",
  brown: "brown fur",
  gray: "gray fur",
  black: "black fur",
  spotted: "spotted pattern fur",
  striped: "striped pattern fur",
};

// Special features mappings
const SPECIAL_FEATURES_MAP: Record<string, string> = {
  glasses: "wearing glasses",
  hat: "wearing a hat",
  crown: "wearing a crown",
  scarf: "wearing a scarf",
  bow: "wearing a bow",
  wings: "has wings",
  tail: "has a tail",
  horns: "has horns",
  freckles: "has freckles",
  scar: "has a scar",
  beard: "has a beard",
  earrings: "wearing earrings",
};

// Helper to determine if character is human
function isHuman(characterType: string): boolean {
  return characterType === "human";
}

// Helper to determine if character is animal
function isAnimal(characterType: string): boolean {
  const animalTypes = ["dog", "cat", "rabbit", "fox", "bear"];
  return animalTypes.includes(characterType);
}

// Helper to get age description
function getAgeDescription(age: number, characterType: string): string {
  if (isAnimal(characterType)) {
    if (age <= 1) return "baby";
    if (age <= 3) return "young";
    if (age <= 7) return "adult";
    return "elderly";
  }

  if (age <= 2) return "baby";
  if (age <= 4) return "toddler";
  if (age <= 8) return "young child";
  if (age <= 12) return "child";
  if (age <= 17) return "teenager";
  if (age <= 30) return "young adult";
  if (age <= 60) return "adult";
  if (age <= 100) return "elderly";
  return "ancient";
}

// Helper to get height description
function getHeightDescription(height: number, age: number): string {
  const avgHeights: Record<number, number> = {
    2: 85, 3: 95, 4: 103, 5: 110, 6: 116, 7: 122, 8: 128,
    9: 133, 10: 138, 11: 143, 12: 149, 13: 156, 14: 163,
    15: 170, 16: 173, 17: 175, 18: 176,
  };

  const avg = avgHeights[Math.min(age, 18)] || 176;
  const diff = height - avg;

  if (diff < -15) return "very short";
  if (diff < -5) return "short";
  if (diff <= 5) return "average height";
  if (diff <= 15) return "tall";
  return "very tall";
}

/**
 * Generate Visual Profile from Structured Avatar Data
 *
 * This endpoint converts structured avatar data into a complete visual profile
 * that can be used for consistent image generation across story chapters.
 *
 * CRITICAL: This ensures age, height, and other explicit data are preserved
 * and used in image generation, solving the Adrian/Alexander age consistency issue.
 */
export const generateVisualProfile = api<GenerateVisualProfileRequest, GenerateVisualProfileResponse>(
  { expose: true, method: "POST", path: "/ai/generate-visual-profile" },
  async (req) => {
    const { avatarData } = req;

    console.log(`🎨 Generating visual profile for ${avatarData.name}...`);

    const charType = avatarData.characterType;
    const isHumanChar = isHuman(charType);
    const isAnimalChar = isAnimal(charType);

    // Get English character type
    let characterTypeEn = CHARACTER_TYPE_MAP[charType] || charType;
    if (charType === "other" && avatarData.customCharacterType) {
      characterTypeEn = avatarData.customCharacterType;
    }

    // Get age description
    const ageDesc = getAgeDescription(avatarData.age, charType);

    // Build consistent descriptors (8-10 tokens for reliable regeneration)
    const consistentDescriptors: string[] = [];

    // 1. Character type
    consistentDescriptors.push(characterTypeEn);

    // 2. Age
    consistentDescriptors.push(`${avatarData.age} years old`);
    consistentDescriptors.push(ageDesc);

    // 3. Gender
    consistentDescriptors.push(avatarData.gender);

    // 4. Hair (if applicable)
    const hairColor = HAIR_COLOR_MAP[avatarData.hairColor] || avatarData.hairColor;
    const hairStyle = HAIR_STYLE_MAP[avatarData.hairStyle] || avatarData.hairStyle;
    if (hairColor && hairColor !== "bald" && !isAnimalChar) {
      consistentDescriptors.push(`${hairColor} ${hairStyle} hair`);
    }

    // 5. Eyes
    const eyeColor = EYE_COLOR_MAP[avatarData.eyeColor] || avatarData.eyeColor;
    consistentDescriptors.push(`${eyeColor} eyes`);

    // 6. Height (for humans)
    if (isHumanChar && avatarData.height) {
      consistentDescriptors.push(`${avatarData.height}cm tall`);
      const heightDesc = getHeightDescription(avatarData.height, avatarData.age);
      if (heightDesc !== "average height") {
        consistentDescriptors.push(heightDesc);
      }
    }

    // 7. Animal-specific
    if (isAnimalChar) {
      consistentDescriptors.push("quadruped");
      consistentDescriptors.push("four paws");
      consistentDescriptors.push("tail visible");
    }

    // 8. Human-specific
    if (isHumanChar) {
      consistentDescriptors.push("human child");
      consistentDescriptors.push("natural skin");
    }

    // Build skin/fur tone
    let skinTone: string;
    if (isHumanChar) {
      skinTone = SKIN_TONE_MAP[avatarData.skinTone] || avatarData.skinTone || "medium skin";
    } else if (isAnimalChar) {
      skinTone = FUR_COLOR_MAP[avatarData.skinTone] || avatarData.skinTone || "natural fur";
    } else {
      skinTone = avatarData.skinTone || "natural coloring";
    }

    // Build accessories list from special features
    const accessories: string[] = [];
    const bodyFeatures: string[] = [];
    const faceFeatures: string[] = [];

    (avatarData.specialFeatures || []).forEach((feature) => {
      const featureEn = SPECIAL_FEATURES_MAP[feature] || feature;
      if (["glasses", "hat", "crown", "scarf", "bow", "earrings"].includes(feature)) {
        accessories.push(featureEn);
      } else if (["wings", "tail", "horns"].includes(feature)) {
        bodyFeatures.push(featureEn);
      } else {
        faceFeatures.push(featureEn);
      }
    });

    // Build the visual profile
    const visualProfile = {
      // CRITICAL: Character type and age are explicitly stored
      characterType: characterTypeEn,
      speciesCategory: isHumanChar ? "human" : isAnimalChar ? "animal" : "fantasy",
      locomotion: isAnimalChar ? "quadruped" : "bipedal",

      // CRITICAL: Explicit age and gender
      ageApprox: `${avatarData.age} years old`,
      ageNumeric: avatarData.age, // NEW: Explicit numeric age for comparisons
      ageDescription: ageDesc,
      gender: avatarData.gender,

      // CRITICAL: Explicit height (for humans)
      heightCm: isHumanChar ? avatarData.height : undefined,
      heightDescription: isHumanChar && avatarData.height
        ? getHeightDescription(avatarData.height, avatarData.age)
        : undefined,

      // Body build (for humans)
      bodyBuild: isHumanChar ? (avatarData.bodyBuild || "normal") : undefined,

      // Skin/Fur
      skin: {
        tone: skinTone,
        undertone: null,
        distinctiveFeatures: faceFeatures.filter((f) => f.includes("freckles") || f.includes("scar")),
      },

      // Hair
      hair: {
        color: hairColor,
        type: isAnimalChar ? "fur" : hairStyle,
        length: avatarData.hairStyle === "long" ? "long" : avatarData.hairStyle === "short" ? "short" : "medium",
        style: hairStyle,
      },

      // Eyes
      eyes: {
        color: eyeColor,
        shape: "round",
        size: "medium",
      },

      // Face
      face: {
        shape: isHumanChar ? "round childlike face" : isAnimalChar ? "animal face" : "unique face",
        nose: isAnimalChar ? "snout" : "small nose",
        mouth: null,
        eyebrows: isHumanChar ? "natural eyebrows" : null,
        freckles: faceFeatures.some((f) => f.includes("freckles")),
        otherFeatures: faceFeatures.filter((f) => !f.includes("freckles")),
      },

      // Accessories
      accessories,

      // Body features (wings, tail, horns)
      bodyFeatures,

      // Clothing
      clothingCanonical: {
        top: null,
        bottom: null,
        outfit: isHumanChar ? "casual children clothing" : null,
        colors: [],
        patterns: [],
      },

      // Color palette
      palette: {
        primary: [hairColor, eyeColor].filter(Boolean),
        secondary: [],
      },

      // CRITICAL: Consistent descriptors for image generation
      consistentDescriptors: consistentDescriptors.slice(0, 10),

      // Additional notes
      additionalNotes: avatarData.additionalDescription || undefined,
    };

    // Build English description for image generation
    const descriptionParts: string[] = [];

    // Character basics
    descriptionParts.push(`${ageDesc} ${avatarData.gender} ${characterTypeEn}`);

    // Age explicitly
    descriptionParts.push(`${avatarData.age} years old`);

    // Height (humans only)
    if (isHumanChar && avatarData.height) {
      descriptionParts.push(`${avatarData.height}cm tall`);
      const heightDesc = getHeightDescription(avatarData.height, avatarData.age);
      if (heightDesc !== "average height") {
        descriptionParts.push(heightDesc);
      }
    }

    // Body build
    if (isHumanChar && avatarData.bodyBuild && avatarData.bodyBuild !== "normal") {
      descriptionParts.push(`${avatarData.bodyBuild} build`);
    }

    // Hair
    if (hairColor && hairColor !== "bald" && !isAnimalChar) {
      descriptionParts.push(`${hairColor} ${hairStyle} hair`);
    }

    // Eyes
    descriptionParts.push(`${eyeColor} eyes`);

    // Skin/Fur
    descriptionParts.push(skinTone);

    // Special features
    const allFeatures = [...accessories, ...bodyFeatures, ...faceFeatures];
    if (allFeatures.length > 0) {
      descriptionParts.push(allFeatures.join(", "));
    }

    // Additional description
    if (avatarData.additionalDescription) {
      descriptionParts.push(avatarData.additionalDescription);
    }

    const englishDescription = descriptionParts.join(", ");

    console.log(`✅ Visual profile generated for ${avatarData.name}:`);
    console.log(`   - Age: ${avatarData.age} years (${ageDesc})`);
    console.log(`   - Height: ${avatarData.height || "N/A"}cm`);
    console.log(`   - Character: ${characterTypeEn}`);
    console.log(`   - Description: ${englishDescription.substring(0, 100)}...`);

    return {
      visualProfile,
      englishDescription,
    };
  }
);
