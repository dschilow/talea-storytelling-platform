/**
 * Character Invariants System v1.0
 * ================================
 *
 * Professional-grade character consistency system for image generation.
 * Ensures distinctive features (tooth gaps, scars, accessories) remain
 * consistent across all story images.
 *
 * CRITICAL: This system solves the Adrian tooth gap inconsistency issue.
 *
 * Architecture by: Senior Software Developer Team + Prompt Engineers
 */

import type { AvatarVisualProfile } from "../avatar/avatar";

/**
 * Invariant Feature - A feature that MUST appear consistently across all images
 */
export interface InvariantFeature {
  /** Unique identifier for the feature */
  id: string;
  /** Category of the feature */
  category: 'facial' | 'body' | 'accessory' | 'clothing' | 'distinctive';
  /** English description for image prompts */
  promptDescription: string;
  /** Short token for MUST INCLUDE list */
  mustIncludeToken: string;
  /** What happens if this feature is missing */
  forbiddenAlternative?: string;
  /** Priority level (1 = highest, 3 = lowest) */
  priority: 1 | 2 | 3;
  /** German label for UI display */
  labelDe?: string;
}

/**
 * Character Invariants Profile
 * Contains all invariant features for consistent image generation
 */
export interface CharacterInvariants {
  /** Character name */
  name: string;
  /** Character type (human, animal, fantasy) */
  characterType: 'human' | 'animal' | 'fantasy';
  /** Explicit age in years */
  ageNumeric?: number;
  /** Explicit height in cm */
  heightCm?: number;
  /** Features that MUST appear in every image */
  mustIncludeFeatures: InvariantFeature[];
  /** Features that MUST NEVER appear */
  forbiddenFeatures: string[];
  /** Hair color - locked for consistency */
  lockedHairColor?: string;
  /** Eye color - locked for consistency */
  lockedEyeColor?: string;
  /** Skin tone - locked for consistency */
  lockedSkinTone?: string;
  /** Signature clothing item */
  signatureClothing?: string;
  /** Gender for pronoun consistency */
  gender?: 'male' | 'female' | 'neutral';
}

/**
 * Common invariant feature templates
 * Used for quick selection in avatar creation
 */
export const COMMON_INVARIANT_FEATURES: Record<string, Omit<InvariantFeature, 'id'>> = {
  // Facial Features
  'tooth_gap': {
    category: 'facial',
    promptDescription: 'prominent gap between front teeth, visible when smiling',
    mustIncludeToken: 'large tooth gap in front teeth',
    forbiddenAlternative: 'complete teeth, no gap',
    priority: 1,
    labelDe: 'Zahnlücke vorne'
  },
  'freckles': {
    category: 'facial',
    promptDescription: 'scattered freckles across nose and cheeks',
    mustIncludeToken: 'freckles on face',
    priority: 2,
    labelDe: 'Sommersprossen'
  },
  'dimples': {
    category: 'facial',
    promptDescription: 'cute dimples on cheeks when smiling',
    mustIncludeToken: 'dimples on cheeks',
    priority: 2,
    labelDe: 'Grübchen'
  },
  'prominent_ears': {
    category: 'facial',
    promptDescription: 'noticeably protruding ears, standing out from head',
    mustIncludeToken: 'prominent protruding ears',
    forbiddenAlternative: 'flat ears against head',
    priority: 1,
    labelDe: 'Abstehende Ohren'
  },
  'round_glasses': {
    category: 'accessory',
    promptDescription: 'round-framed glasses',
    mustIncludeToken: 'round glasses',
    priority: 1,
    labelDe: 'Runde Brille'
  },
  'square_glasses': {
    category: 'accessory',
    promptDescription: 'square-framed glasses',
    mustIncludeToken: 'square glasses',
    priority: 1,
    labelDe: 'Eckige Brille'
  },
  'birthmark_cheek': {
    category: 'facial',
    promptDescription: 'small birthmark on cheek',
    mustIncludeToken: 'birthmark on cheek',
    priority: 2,
    labelDe: 'Muttermal auf Wange'
  },
  'scar_forehead': {
    category: 'facial',
    promptDescription: 'small scar on forehead',
    mustIncludeToken: 'small scar on forehead',
    priority: 1,
    labelDe: 'Narbe auf Stirn'
  },

  // Body Features
  'tall_for_age': {
    category: 'body',
    promptDescription: 'notably tall for their age',
    mustIncludeToken: 'tall child',
    forbiddenAlternative: 'short child',
    priority: 2,
    labelDe: 'Groß für sein Alter'
  },
  'short_for_age': {
    category: 'body',
    promptDescription: 'notably short for their age',
    mustIncludeToken: 'short child',
    forbiddenAlternative: 'tall child',
    priority: 2,
    labelDe: 'Klein für sein Alter'
  },
  'chubby': {
    category: 'body',
    promptDescription: 'chubby, rounded body shape',
    mustIncludeToken: 'chubby child',
    forbiddenAlternative: 'thin child',
    priority: 2,
    labelDe: 'Rundlich'
  },
  'slim': {
    category: 'body',
    promptDescription: 'slim, slender body shape',
    mustIncludeToken: 'slim child',
    forbiddenAlternative: 'chubby child',
    priority: 2,
    labelDe: 'Schlank'
  },

  // Distinctive Items
  'red_cap': {
    category: 'accessory',
    promptDescription: 'always wears a red cap',
    mustIncludeToken: 'red cap on head',
    priority: 1,
    labelDe: 'Rote Mütze'
  },
  'blue_scarf': {
    category: 'accessory',
    promptDescription: 'always wears a blue scarf',
    mustIncludeToken: 'blue scarf around neck',
    priority: 1,
    labelDe: 'Blauer Schal'
  },
  'friendship_bracelet': {
    category: 'accessory',
    promptDescription: 'colorful friendship bracelet on wrist',
    mustIncludeToken: 'friendship bracelet on wrist',
    priority: 2,
    labelDe: 'Freundschaftsarmband'
  },
  'bandaid_knee': {
    category: 'accessory',
    promptDescription: 'band-aid on knee',
    mustIncludeToken: 'bandaid on knee',
    priority: 3,
    labelDe: 'Pflaster am Knie'
  }
};

/**
 * Extracts invariant features from avatar description text
 * @param description Free-text description of the avatar
 * @returns Array of detected invariant features
 */
export function extractInvariantsFromDescription(description: string): InvariantFeature[] {
  const invariants: InvariantFeature[] = [];
  const descLower = description.toLowerCase();

  // Tooth gap detection (German & English)
  if (descLower.includes('zahnlücke') || descLower.includes('tooth gap') || descLower.includes('gap in teeth')) {
    invariants.push({
      id: 'tooth_gap_' + Date.now(),
      ...COMMON_INVARIANT_FEATURES['tooth_gap']
    });
  }

  // Protruding ears detection
  if (descLower.includes('abstehende ohren') || descLower.includes('protruding ears') || descLower.includes('sticking out ears')) {
    invariants.push({
      id: 'prominent_ears_' + Date.now(),
      ...COMMON_INVARIANT_FEATURES['prominent_ears']
    });
  }

  // Freckles detection
  if (descLower.includes('sommersprossen') || descLower.includes('freckles')) {
    invariants.push({
      id: 'freckles_' + Date.now(),
      ...COMMON_INVARIANT_FEATURES['freckles']
    });
  }

  // Glasses detection
  if (descLower.includes('brille') || descLower.includes('glasses')) {
    const isRound = descLower.includes('rund') || descLower.includes('round');
    const featureKey = isRound ? 'round_glasses' : 'square_glasses';
    invariants.push({
      id: featureKey + '_' + Date.now(),
      ...COMMON_INVARIANT_FEATURES[featureKey]
    });
  }

  // Dimples detection
  if (descLower.includes('grübchen') || descLower.includes('dimples')) {
    invariants.push({
      id: 'dimples_' + Date.now(),
      ...COMMON_INVARIANT_FEATURES['dimples']
    });
  }

  // Height detection
  if (descLower.includes('sehr groß') || descLower.includes('very tall') || descLower.includes('tall for')) {
    invariants.push({
      id: 'tall_for_age_' + Date.now(),
      ...COMMON_INVARIANT_FEATURES['tall_for_age']
    });
  }

  if (descLower.includes('sehr klein') || descLower.includes('very short') || descLower.includes('short for')) {
    invariants.push({
      id: 'short_for_age_' + Date.now(),
      ...COMMON_INVARIANT_FEATURES['short_for_age']
    });
  }

  // Dancing ability detection (can be used for pose hints)
  if (descLower.includes('kann gut tanzen') || descLower.includes('good dancer') || descLower.includes('loves dancing')) {
    // Store as metadata for pose suggestions, not visual invariant
  }

  // Memory/Intelligence detection (for characterization)
  if (descLower.includes('gutes gedächtnis') || descLower.includes('super schlau') || descLower.includes('very smart')) {
    // Store as character trait, not visual invariant
  }

  return invariants;
}

/**
 * Builds CharacterInvariants from visual profile
 */
export function buildInvariantsFromVisualProfile(
  name: string,
  visualProfile: AvatarVisualProfile,
  description?: string
): CharacterInvariants {
  const invariants: CharacterInvariants = {
    name,
    characterType: 'human', // Default, can be overridden
    ageNumeric: (visualProfile as any).ageNumeric,
    heightCm: (visualProfile as any).heightCm,
    mustIncludeFeatures: [],
    forbiddenFeatures: [],
    lockedHairColor: visualProfile.hair?.color,
    lockedEyeColor: visualProfile.eyes?.color,
    lockedSkinTone: visualProfile.skin?.tone,
    signatureClothing: visualProfile.clothingCanonical?.outfit ||
                       visualProfile.clothingCanonical?.top,
    gender: visualProfile.gender as any
  };

  // Extract from description if provided
  if (description) {
    invariants.mustIncludeFeatures = extractInvariantsFromDescription(description);
  }

  // Extract from visual profile distinctive features
  if (visualProfile.skin?.distinctiveFeatures) {
    for (const feature of visualProfile.skin.distinctiveFeatures) {
      const featureLower = feature.toLowerCase();

      if (featureLower.includes('freckles') || featureLower.includes('sommersprossen')) {
        invariants.mustIncludeFeatures.push({
          id: 'freckles_vp',
          ...COMMON_INVARIANT_FEATURES['freckles']
        });
      }

      if (featureLower.includes('birthmark') || featureLower.includes('muttermal')) {
        invariants.mustIncludeFeatures.push({
          id: 'birthmark_vp',
          ...COMMON_INVARIANT_FEATURES['birthmark_cheek']
        });
      }
    }
  }

  // Extract from face features
  if (visualProfile.face?.otherFeatures) {
    for (const feature of visualProfile.face.otherFeatures) {
      const featureLower = feature.toLowerCase();

      if (featureLower.includes('tooth gap') || featureLower.includes('zahnlücke')) {
        invariants.mustIncludeFeatures.push({
          id: 'tooth_gap_face',
          ...COMMON_INVARIANT_FEATURES['tooth_gap']
        });
      }

      if (featureLower.includes('dimple') || featureLower.includes('grübchen')) {
        invariants.mustIncludeFeatures.push({
          id: 'dimples_face',
          ...COMMON_INVARIANT_FEATURES['dimples']
        });
      }
    }
  }

  // Check accessories
  if (visualProfile.accessories) {
    for (const accessory of visualProfile.accessories) {
      const accLower = accessory.toLowerCase();

      if (accLower.includes('glasses') || accLower.includes('brille')) {
        const isRound = accLower.includes('round') || accLower.includes('rund');
        const featureKey = isRound ? 'round_glasses' : 'square_glasses';
        invariants.mustIncludeFeatures.push({
          id: featureKey + '_acc',
          ...COMMON_INVARIANT_FEATURES[featureKey]
        });
      }

      if (accLower.includes('cap') || accLower.includes('mütze')) {
        invariants.mustIncludeFeatures.push({
          id: 'cap_acc',
          category: 'accessory',
          promptDescription: accessory,
          mustIncludeToken: accessory,
          priority: 1
        });
      }
    }
  }

  // Build forbidden features based on what MUST be included
  // (if tooth gap is required, forbid "complete teeth")
  for (const feature of invariants.mustIncludeFeatures) {
    if (feature.forbiddenAlternative) {
      invariants.forbiddenFeatures.push(feature.forbiddenAlternative);
    }
  }

  // Add hair color protection
  if (invariants.lockedHairColor) {
    const hairLower = invariants.lockedHairColor.toLowerCase();
    if (hairLower.includes('blond') || hairLower.includes('gold')) {
      invariants.forbiddenFeatures.push('brown hair', 'black hair', 'red hair', 'brunette');
    } else if (hairLower.includes('brown') || hairLower.includes('brunette')) {
      invariants.forbiddenFeatures.push('blond hair', 'blonde hair', 'golden hair');
    } else if (hairLower.includes('black')) {
      invariants.forbiddenFeatures.push('blond hair', 'brown hair');
    } else if (hairLower.includes('red') || hairLower.includes('ginger')) {
      invariants.forbiddenFeatures.push('blond hair', 'black hair');
    }
  }

  // Add eye color protection
  if (invariants.lockedEyeColor) {
    const eyeLower = invariants.lockedEyeColor.toLowerCase();
    if (eyeLower.includes('blue')) {
      invariants.forbiddenFeatures.push('brown eyes', 'green eyes', 'amber eyes');
    } else if (eyeLower.includes('green')) {
      invariants.forbiddenFeatures.push('blue eyes', 'brown eyes');
    } else if (eyeLower.includes('brown') || eyeLower.includes('amber')) {
      invariants.forbiddenFeatures.push('blue eyes', 'green eyes');
    }
  }

  // Deduplicate
  invariants.forbiddenFeatures = [...new Set(invariants.forbiddenFeatures)];

  return invariants;
}

/**
 * Formats invariants as MUST INCLUDE / FORBID prompt sections
 * Used by character-block-builder
 */
export function formatInvariantsForPrompt(invariants: CharacterInvariants): {
  mustIncludeTokens: string[];
  forbidTokens: string[];
  summaryLine: string;
} {
  // Sort by priority (1 first)
  const sortedFeatures = [...invariants.mustIncludeFeatures]
    .sort((a, b) => a.priority - b.priority);

  const mustIncludeTokens = sortedFeatures.map(f => f.mustIncludeToken);

  // Add locked colors
  if (invariants.lockedHairColor) {
    mustIncludeTokens.unshift(`${invariants.lockedHairColor} hair`);
  }
  if (invariants.lockedEyeColor) {
    mustIncludeTokens.push(`${invariants.lockedEyeColor} eyes`);
  }
  if (invariants.lockedSkinTone) {
    mustIncludeTokens.push(`${invariants.lockedSkinTone} skin`);
  }

  // Add height/age if explicit
  if (invariants.heightCm) {
    mustIncludeTokens.push(`exactly ${invariants.heightCm}cm tall`);
  }
  if (invariants.ageNumeric) {
    mustIncludeTokens.push(`${invariants.ageNumeric} years old child`);
  }

  // Build summary line for quick reference
  const summaryParts = [invariants.name];
  if (invariants.ageNumeric) summaryParts.push(`${invariants.ageNumeric}yo`);
  if (invariants.heightCm) summaryParts.push(`${invariants.heightCm}cm`);
  if (invariants.lockedHairColor) summaryParts.push(invariants.lockedHairColor + ' hair');

  const distinctiveFeatures = sortedFeatures
    .filter(f => f.priority === 1)
    .map(f => f.labelDe || f.mustIncludeToken);

  if (distinctiveFeatures.length > 0) {
    summaryParts.push(`DISTINCTIVE: ${distinctiveFeatures.join(', ')}`);
  }

  return {
    mustIncludeTokens: [...new Set(mustIncludeTokens)],
    forbidTokens: [...new Set(invariants.forbiddenFeatures)],
    summaryLine: summaryParts.join(' | ')
  };
}

/**
 * Validates that invariants are present in generated image prompt
 */
export function validateInvariantsInPrompt(
  prompt: string,
  invariants: CharacterInvariants
): { valid: boolean; missing: string[]; warnings: string[] } {
  const promptLower = prompt.toLowerCase();
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check priority 1 features (CRITICAL)
  for (const feature of invariants.mustIncludeFeatures.filter(f => f.priority === 1)) {
    const tokenLower = feature.mustIncludeToken.toLowerCase();
    if (!promptLower.includes(tokenLower)) {
      missing.push(feature.mustIncludeToken);
    }
  }

  // Check priority 2 features (WARNING)
  for (const feature of invariants.mustIncludeFeatures.filter(f => f.priority === 2)) {
    const tokenLower = feature.mustIncludeToken.toLowerCase();
    if (!promptLower.includes(tokenLower)) {
      warnings.push(feature.mustIncludeToken);
    }
  }

  // Check locked colors
  if (invariants.lockedHairColor) {
    const hairLower = invariants.lockedHairColor.toLowerCase();
    if (!promptLower.includes(hairLower)) {
      missing.push(`${invariants.lockedHairColor} hair`);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings
  };
}

/**
 * Creates a canonical invariants string for cross-chapter reference
 * Used to maintain consistency across all images
 */
export function buildCanonicalInvariantsRef(invariants: CharacterInvariants): string {
  const parts: string[] = [];

  parts.push(`[${invariants.name}]`);

  if (invariants.characterType === 'human') {
    parts.push('HUMAN CHILD');
    if (invariants.ageNumeric) parts.push(`age ${invariants.ageNumeric}`);
    if (invariants.heightCm) parts.push(`${invariants.heightCm}cm`);
  } else {
    parts.push(invariants.characterType.toUpperCase());
  }

  if (invariants.gender) {
    parts.push(invariants.gender === 'male' ? 'boy' : invariants.gender === 'female' ? 'girl' : 'child');
  }

  if (invariants.lockedHairColor) parts.push(`${invariants.lockedHairColor} hair`);
  if (invariants.lockedEyeColor) parts.push(`${invariants.lockedEyeColor} eyes`);

  // Add CRITICAL invariants
  const criticalFeatures = invariants.mustIncludeFeatures
    .filter(f => f.priority === 1)
    .map(f => f.mustIncludeToken);

  if (criticalFeatures.length > 0) {
    parts.push(`MUST: ${criticalFeatures.join(', ')}`);
  }

  if (invariants.signatureClothing) {
    parts.push(`wearing ${invariants.signatureClothing}`);
  }

  return parts.join(' | ');
}

export default {
  COMMON_INVARIANT_FEATURES,
  extractInvariantsFromDescription,
  buildInvariantsFromVisualProfile,
  formatInvariantsForPrompt,
  validateInvariantsInPrompt,
  buildCanonicalInvariantsRef
};
