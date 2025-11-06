// Fairy Tale Role Transformation System
// Handles avatar visual transformations when playing fairy tale roles
// Example: Alexander (human boy) → Alexander (mermaid with tail)

export interface RoleTransformation {
  roleType: 'protagonist' | 'antagonist' | 'sidekick' | 'helper';
  speciesTransformation?: {
    originalSpecies: 'human';
    transformedSpecies: 'mermaid' | 'merman' | 'animal' | 'magical_creature' | 'giant' | 'dwarf';
    visualChanges: string[]; // ["has shimmering tail", "underwater features", "scales on arms"]
  };
  genderAdaptation?: {
    originalGender: 'male' | 'female';
    roleGender: 'male' | 'female' | 'neutral';
    titleChange?: { from: string; to: string }; // "Meerjungfrau" → "Meermann"
    pronounChanges?: { sie: string; ihr: string; ihre: string }; // sie→er, ihr→sein, ihre→seine
  };
  visualPromptModifications: {
    addFeatures: string[]; // Additional visual features for this role
    removeFeatures: string[]; // Features to remove (e.g., "wearing casual hoodie")
    replaceClothing?: string; // New clothing description
  };
}

export interface FairyTaleRoleMapping {
  taleId: string;
  roles: {
    [placeholder: string]: {
      roleTitle: string; // "Kleine Meerjungfrau", "Meerhexe"
      roleType: 'protagonist' | 'antagonist' | 'sidekick' | 'helper';
      defaultGender: 'male' | 'female' | 'neutral';
      requiredCount: number; // Number of avatars needed for this role
      transformation: RoleTransformation;
    };
  };
}

// Define transformations for each fairy tale
export const FAIRY_TALE_ROLE_MAPPINGS: Record<string, FairyTaleRoleMapping> = {
  'andersen-001': { // Die kleine Meerjungfrau
    taleId: 'andersen-001',
    roles: {
      '{protagonist}': {
        roleTitle: 'Kleine Meerjungfrau',
        roleType: 'protagonist',
        defaultGender: 'female',
        requiredCount: 1,
        transformation: {
          roleType: 'protagonist',
          speciesTransformation: {
            originalSpecies: 'human',
            transformedSpecies: 'mermaid',
            visualChanges: [
              'has shimmering mermaid/merman tail instead of legs',
              'underwater features (slightly webbed fingers)',
              'iridescent scales on arms and shoulders',
              'hair floats gracefully underwater',
              'can breathe underwater'
            ]
          },
          genderAdaptation: {
            originalGender: 'female',
            roleGender: 'neutral', // Can be adapted
            titleChange: { 
              from: 'Kleine Meerjungfrau', 
              to: 'Kleiner Meermann' // When male avatar
            },
            pronounChanges: {
              sie: 'er', // sie schwamm → er schwamm
              ihr: 'sein', // ihr Herz → sein Herz
              ihre: 'seine' // ihre Stimme → seine Stimme
            }
          },
          visualPromptModifications: {
            addFeatures: [
              'shimmering {gender_adapted_tail} (mermaid/merman tail with scales)',
              'underwater glow and magical shimmer',
              'coral accessories or seaweed decorations'
            ],
            removeFeatures: [
              'wearing casual hoodie',
              'wearing sleeveless zip vest',
              'human legs',
              'shoes'
            ],
            replaceClothing: 'underwater royal attire with shells and pearls'
          }
        }
      },
      '{antagonist}': {
        roleTitle: 'Meerhexe',
        roleType: 'antagonist',
        defaultGender: 'female',
        requiredCount: 1,
        transformation: {
          roleType: 'antagonist',
          speciesTransformation: {
            originalSpecies: 'human',
            transformedSpecies: 'magical_creature',
            visualChanges: [
              'has octopus-like tentacles instead of legs',
              'dark magical aura',
              'glowing eyes',
              'sinister underwater presence'
            ]
          },
          genderAdaptation: {
            originalGender: 'female',
            roleGender: 'neutral',
            titleChange: {
              from: 'Meerhexe',
              to: 'Meerhexer' // When male avatar
            },
            pronounChanges: {
              sie: 'er',
              ihr: 'sein',
              ihre: 'seine'
            }
          },
          visualPromptModifications: {
            addFeatures: [
              'dark tentacles with suction cups',
              'magical cauldron and potion bottles',
              'eerie bioluminescent glow',
              'twisted coral crown'
            ],
            removeFeatures: [
              'casual clothing',
              'human legs',
              'innocent expression'
            ],
            replaceClothing: 'dark tattered underwater robes with seaweed'
          }
        }
      }
    }
  },
  
  'grimm-015': { // Hänsel und Gretel
    taleId: 'grimm-015',
    roles: {
      '{protagonist1}': {
        roleTitle: 'Hänsel',
        roleType: 'protagonist',
        defaultGender: 'male',
        requiredCount: 1,
        transformation: {
          roleType: 'protagonist',
          genderAdaptation: {
            originalGender: 'male',
            roleGender: 'neutral', // Name can be adapted to match avatar gender
            pronounChanges: {
              sie: 'sie', // Keep if female avatar
              ihr: 'ihr',
              ihre: 'ihre'
            }
          },
          visualPromptModifications: {
            addFeatures: [
              'forest exploration clothes (practical and sturdy)',
              'carrying a small sack or basket'
            ],
            removeFeatures: [],
            replaceClothing: undefined // Keep original clothing
          }
        }
      },
      '{protagonist2}': {
        roleTitle: 'Gretel',
        roleType: 'protagonist',
        defaultGender: 'female',
        requiredCount: 1,
        transformation: {
          roleType: 'protagonist',
          genderAdaptation: {
            originalGender: 'female',
            roleGender: 'neutral',
            pronounChanges: {
              sie: 'er', // If male avatar
              ihr: 'sein',
              ihre: 'seine'
            }
          },
          visualPromptModifications: {
            addFeatures: [
              'forest exploration clothes',
              'carrying breadcrumbs or pebbles'
            ],
            removeFeatures: [],
            replaceClothing: undefined
          }
        }
      }
    }
  }
};

/**
 * Apply role transformation to avatar description for image generation
 */
export function applyRoleTransformation(
  avatarDescription: string,
  avatarGender: 'male' | 'female',
  transformation: RoleTransformation
): string {
  let modifiedDescription = avatarDescription;
  
  // Remove features that don't fit the role
  for (const feature of transformation.visualPromptModifications.removeFeatures) {
    const regex = new RegExp(feature, 'gi');
    modifiedDescription = modifiedDescription.replace(regex, '');
  }
  
  // Add new features
  const newFeatures = transformation.visualPromptModifications.addFeatures.join(', ');
  modifiedDescription += '. ' + newFeatures;
  
  // Replace clothing if specified
  if (transformation.visualPromptModifications.replaceClothing) {
    // Remove clothing mentions
    modifiedDescription = modifiedDescription.replace(/wearing [^,;.]+/gi, '');
    modifiedDescription += '. Wearing: ' + transformation.visualPromptModifications.replaceClothing;
  }
  
  // Add species transformation description
  if (transformation.speciesTransformation) {
    const speciesDesc = transformation.speciesTransformation.visualChanges.join(', ');
    modifiedDescription += '. ' + speciesDesc;
  }
  
  return modifiedDescription.trim();
}

/**
 * Get gender-adapted role title
 */
export function getAdaptedRoleTitle(
  roleMapping: FairyTaleRoleMapping['roles'][string],
  avatarGender: 'male' | 'female'
): string {
  if (!roleMapping.transformation.genderAdaptation) {
    return roleMapping.roleTitle;
  }
  
  const genderAdapt = roleMapping.transformation.genderAdaptation;
  
  // If role default matches avatar gender, use original title
  if (roleMapping.defaultGender === avatarGender) {
    return roleMapping.roleTitle;
  }
  
  // Use adapted title if available
  if (genderAdapt.titleChange) {
    return avatarGender === 'male' 
      ? genderAdapt.titleChange.to 
      : genderAdapt.titleChange.from;
  }
  
  return roleMapping.roleTitle;
}

/**
 * Get pronoun changes for text generation
 */
export function getAdaptedPronouns(
  roleMapping: FairyTaleRoleMapping['roles'][string],
  avatarGender: 'male' | 'female'
): Record<string, string> {
  if (!roleMapping.transformation.genderAdaptation) {
    return {};
  }
  
  const genderAdapt = roleMapping.transformation.genderAdaptation;
  
  // If genders match, no changes needed
  if (roleMapping.defaultGender === avatarGender) {
    return {};
  }
  
  return genderAdapt.pronounChanges || {};
}
