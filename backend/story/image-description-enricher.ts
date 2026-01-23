/**
 * Image Description Enricher v2.0
 *
 * Enriches OpenAI-generated imageDescription with:
 * - Species-specific details to prevent humans getting animal features
 * - Character Invariants (tooth gaps, glasses, etc.) for consistency
 * - Explicit height/age information for size accuracy
 *
 * CRITICAL: This is the last line of defense for image consistency!
 */

import type { AvatarVisualProfile, InvariantFeature } from "../avatar/avatar";
import {
  buildInvariantsFromVisualProfile,
  formatInvariantsForPrompt,
  type CharacterInvariants
} from "./character-invariants";

export interface EnrichedCharacterDescription {
  originalDescription: string;
  enrichedDescription: string;
}

/**
 * Builds a concise species descriptor from avatar visual profile
 * v2.0: Now includes Character Invariants for critical features
 * GENERIC - NO HARDCODING!
 */
function buildSpeciesDescriptor(
  profile: AvatarVisualProfile,
  avatarDescription?: string
): string {
  const profileAny = profile as any;
  const species = profileAny.species?.toLowerCase() || 'unknown';

  // NEW v2.0: Build character invariants for critical features
  const invariants = buildInvariantsFromVisualProfile(
    '', // name not needed for descriptor
    profile,
    avatarDescription
  );
  const invariantFormat = formatInvariantsForPrompt(invariants);

  // Build MUST INCLUDE tokens string (e.g., "large tooth gap, blue eyes")
  const criticalInvariants = invariantFormat.mustIncludeTokens
    .filter(t => !t.includes('hair') && !t.includes('eyes') && !t.includes('skin')) // Avoid duplicates
    .slice(0, 3)
    .join(', ');

  // For HUMANS: Build explicit anti-animal-features descriptor
  if (species === 'human') {
    const ageNumeric = profileAny.ageNumeric;
    const heightCm = profileAny.heightCm;
    const ageApprox = profileAny.age?.approx || profile.ageApprox || 'child';

    // Build age/height string
    let ageHeightStr = '';
    if (ageNumeric && heightCm) {
      ageHeightStr = `${ageNumeric} years old, ${heightCm}cm tall`;
    } else if (ageNumeric) {
      ageHeightStr = `${ageNumeric} years old`;
    } else if (heightCm) {
      ageHeightStr = `${heightCm}cm tall child`;
    } else {
      ageHeightStr = ageApprox;
    }

    // Get key visual features from profile
    const hairColor = profile.hair?.color || '';
    const eyeColor = profile.eyes?.color || '';
    const skinTone = profile.skin?.tone || 'skin';

    const features: string[] = [];
    if (hairColor) features.push(`${hairColor} hair`);
    if (eyeColor) features.push(`${eyeColor} eyes`);
    if (skinTone) features.push(`${skinTone} tone`);

    // NEW v2.0: Add critical invariants (tooth gap, glasses, etc.)
    if (criticalInvariants) {
      features.push(criticalInvariants);
    }

    const visualHints = features.length > 0 ? `, ${features.join(', ')}` : '';

    return `(HUMAN ${ageHeightStr}${visualHints}, standing on two legs, round human ears on the sides of the head, smooth human skin, human hands with fingers, human feet with toes)`;
  }

  // For ANIMALS: Build descriptor from profile
  // Use 'any' type assertions since animal profiles have different structure
  if (species === 'cat' || species === 'kitten') {
    // Extract visual details from profile
    const coatColor = (profileAny.coat?.primaryColor || profileAny.fur?.color || '') as string;
    const coatPattern = (profileAny.coat?.pattern || profileAny.fur?.pattern || '') as string;
    const eyeColor = profile.eyes?.color || '';

    const features: string[] = [];
    if (coatPattern && coatColor) {
      features.push(`${coatColor} ${coatPattern}`);
    } else if (coatColor) {
      features.push(`${coatColor} coat`);
    }
    if (eyeColor) features.push(`${eyeColor} eyes`);

    const visualHints = features.length > 0 ? `${features.join(', ')}, ` : '';

    return `(${visualHints}feline quadruped on four paws, cat whiskers, cat tail visible)`;
  }

  if (species === 'dog') {
    const coatColor = (profileAny.coat?.primaryColor || profileAny.fur?.color || '') as string;
    const breed = (profileAny.breed || '') as string;

    const features: string[] = [];
    if (breed) features.push(breed);
    if (coatColor) features.push(`${coatColor} coat`);

    const visualHints = features.length > 0 ? `${features.join(', ')}, ` : '';

    return `(${visualHints}canine quadruped on four legs, dog tail visible)`;
  }

  // For OTHER CREATURES: Use species + any available visual info
  const primaryColor = (profileAny.color?.primary || profile.skin?.tone || '') as string;
  const characterType = (profileAny.characterType || species) as string;

  const features: string[] = [];
  if (primaryColor) features.push(`${primaryColor}`);
  features.push(characterType);

  return `(${features.join(' ')})`;
}

/**
 * Avatar profile with optional description for invariant extraction
 */
export interface AvatarProfileWithDescription {
  profile: AvatarVisualProfile;
  description?: string;
}

/**
 * Enriches character descriptions in imageDescription with species information
 * v2.0: Now supports avatar descriptions for invariant extraction
 *
 * Problem: OpenAI generates descriptions like "Character1 crouches left, Character2 leans right"
 * without species info, which causes Runware to sometimes add wrong features.
 *
 * Solution: Inject species-specific descriptors from avatar profiles into the character mentions.
 *
 * IMPORTANT: 100% GENERIC - NO HARDCODING!
 */
export function enrichImageDescriptionWithSpecies(
  charactersString: string,
  avatarProfiles: Record<string, AvatarVisualProfile | AvatarProfileWithDescription>
): string {
  let enriched = charactersString;

  // For each avatar, inject species information near their name
  for (const [name, profileOrWithDesc] of Object.entries(avatarProfiles)) {
    // Support both legacy format (just profile) and new format (profile + description)
    const profile = 'profile' in profileOrWithDesc
      ? profileOrWithDesc.profile
      : profileOrWithDesc;
    const description = 'description' in profileOrWithDesc
      ? profileOrWithDesc.description
      : undefined;

    // Build descriptor from profile WITH avatar description for invariant extraction
    const speciesDescriptor = buildSpeciesDescriptor(profile, description);

    // Find all occurrences of the character name and inject species info
    // Use word boundaries to avoid partial matches
    const nameRegex = new RegExp(`\\b${name}\\b(?!\\s*\\()`, 'gi');

    // Only add descriptor on first occurrence to keep prompt concise
    let firstOccurrence = true;
    enriched = enriched.replace(nameRegex, (match) => {
      if (firstOccurrence) {
        firstOccurrence = false;
        return `${match} ${speciesDescriptor}`;
      }
      return match;
    });
  }

  return enriched;
}

/**
 * NEW v2.0: Builds a cross-chapter character invariants reference block
 * This should be appended to EVERY image prompt in a story for consistency
 *
 * v3.1 CRITICAL: Flux.1 Dev responds best to positive, explicit constraints.
 */
export function buildCrossChapterInvariantsBlock(
  avatarProfiles: Record<string, AvatarProfileWithDescription>
): string {
  const lines: string[] = [
    "CHARACTER INVARIANTS (KEEP CONSISTENT IN EVERY IMAGE):"
  ];

  for (const [name, data] of Object.entries(avatarProfiles)) {
    const invariants = buildInvariantsFromVisualProfile(name, data.profile, data.description);

    const parts = [`[${name}]`];

    // Add critical invariants (priority 1 only)
    const criticalFeatures = invariants.mustIncludeFeatures
      .filter(f => f.priority === 1)
      .map(f => f.mustIncludeToken);

    if (criticalFeatures.length > 0) {
      parts.push(`MUST include: ${criticalFeatures.join(', ')}`);
    }

    if (invariants.lockedHairColor) {
      parts.push(`Hair color: ${invariants.lockedHairColor}`);
    }
    if (invariants.lockedEyeColor) {
      parts.push(`Eye color: ${invariants.lockedEyeColor}`);
    }
    if (invariants.lockedSkinTone) {
      parts.push(`Skin tone: ${invariants.lockedSkinTone}`);
    }

    lines.push(parts.join(' | '));
  }

  return lines.join('\n');
}

/**
 * Enriches the entire imageDescription object
 */
export function enrichFullImageDescription(
  imageDescription: {
    scene?: string;
    characters?: string;
    environment?: string;
    composition?: string;
  },
  avatarProfiles: Record<string, AvatarVisualProfile>
): {
  scene: string;
  characters: string;
  environment: string;
  composition: string;
} {
  return {
    scene: imageDescription.scene || '',
    characters: imageDescription.characters
      ? enrichImageDescriptionWithSpecies(imageDescription.characters, avatarProfiles)
      : '',
    environment: imageDescription.environment || '',
    composition: imageDescription.composition || ''
  };
}
