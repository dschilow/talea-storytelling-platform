/**
 * Image Description Enricher
 *
 * Enriches OpenAI-generated imageDescription with species-specific details
 * to prevent issues like humans getting animal features (tails, ears, etc.)
 */

import type { AvatarVisualProfile } from "../avatar/avatar";

export interface EnrichedCharacterDescription {
  originalDescription: string;
  enrichedDescription: string;
}

/**
 * Builds a concise species descriptor from avatar visual profile
 * GENERIC - NO HARDCODING!
 */
function buildSpeciesDescriptor(profile: AvatarVisualProfile): string {
  const species = profile.species?.toLowerCase() || 'unknown';

  // For HUMANS: Build explicit anti-animal-features descriptor
  if (species === 'human') {
    const ageInfo = profile.age?.approx || 'child';

    // Get key visual features from profile
    const hairColor = profile.hair?.color || '';
    const eyeColor = profile.eyes?.color || '';
    const skinTone = profile.skin?.tone || 'skin';

    const features: string[] = [];
    if (hairColor) features.push(`${hairColor} hair`);
    if (eyeColor) features.push(`${eyeColor} eyes`);
    if (skinTone) features.push(`${skinTone} tone`);

    const visualHints = features.length > 0 ? `, ${features.join(', ')}` : '';

    return `(HUMAN ${ageInfo}${visualHints}, standing on two legs, NO animal ears, NO tail, NO fur, smooth human skin, human hands with fingers, human feet with toes)`;
  }

  // For ANIMALS: Build descriptor from profile
  if (species === 'cat' || species === 'kitten') {
    // Extract visual details from profile
    const coatColor = profile.coat?.primaryColor || profile.fur?.color || '';
    const coatPattern = profile.coat?.pattern || profile.fur?.pattern || '';
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
    const coatColor = profile.coat?.primaryColor || profile.fur?.color || '';
    const breed = profile.breed || '';

    const features: string[] = [];
    if (breed) features.push(breed);
    if (coatColor) features.push(`${coatColor} coat`);

    const visualHints = features.length > 0 ? `${features.join(', ')}, ` : '';

    return `(${visualHints}canine quadruped on four legs, dog tail visible)`;
  }

  // For OTHER CREATURES: Use species + any available visual info
  const primaryColor = profile.color?.primary || profile.skin?.tone || '';
  const characterType = profile.characterType || species;

  const features: string[] = [];
  if (primaryColor) features.push(`${primaryColor}`);
  features.push(characterType);

  return `(${features.join(' ')})`;
}

/**
 * Enriches character descriptions in imageDescription with species information
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
  avatarProfiles: Record<string, AvatarVisualProfile>
): string {
  let enriched = charactersString;

  // For each avatar, inject species information near their name
  for (const [name, profile] of Object.entries(avatarProfiles)) {
    // Build descriptor from profile (NO HARDCODING!)
    const speciesDescriptor = buildSpeciesDescriptor(profile);

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
