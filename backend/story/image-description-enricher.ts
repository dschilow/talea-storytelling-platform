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
 * Enriches character descriptions in imageDescription with species information
 *
 * Problem: OpenAI generates descriptions like "Diego crouches left, Adrian leans right"
 * without species info, which causes Runware to sometimes add animal features to humans.
 *
 * Solution: Inject species-specific descriptors into the character mentions.
 */
export function enrichImageDescriptionWithSpecies(
  charactersString: string,
  avatarProfiles: Record<string, AvatarVisualProfile>
): string {
  let enriched = charactersString;

  // For each avatar, inject species information near their name
  for (const [name, profile] of Object.entries(avatarProfiles)) {
    const species = profile.species?.toLowerCase() || 'unknown';

    // Create species descriptor
    let speciesDescriptor = '';

    if (species === 'cat' || species === 'kitten') {
      speciesDescriptor = '(orange tabby cat on four paws, feline quadruped)';
    } else if (species === 'dog') {
      speciesDescriptor = '(canine quadruped on four legs)';
    } else if (species === 'human') {
      // CRITICAL: Very explicit human descriptor to prevent animal features
      const ageInfo = profile.age?.approx || 'child';
      speciesDescriptor = `(HUMAN ${ageInfo}, standing on two legs, NO animal ears, NO tail, NO fur, smooth human skin, human hands with fingers, human feet with toes)`;
    } else {
      speciesDescriptor = `(${species})`;
    }

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
