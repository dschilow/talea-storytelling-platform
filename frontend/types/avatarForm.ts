/**
 * Avatar Form Types and Constants
 * Shared between AvatarWizard and EditAvatar screens
 */

// Character Types with icons and English translations for image generation
export const CHARACTER_TYPES = [
  { id: 'human', labelDe: 'Mensch', labelEn: 'human', icon: '👦', category: 'common' },
  { id: 'dog', labelDe: 'Hund', labelEn: 'dog', icon: '🐕', category: 'animal' },
  { id: 'cat', labelDe: 'Katze', labelEn: 'cat', icon: '🐱', category: 'animal' },
  { id: 'rabbit', labelDe: 'Hase', labelEn: 'rabbit', icon: '🐰', category: 'animal' },
  { id: 'fox', labelDe: 'Fuchs', labelEn: 'fox', icon: '🦊', category: 'animal' },
  { id: 'bear', labelDe: 'Bär', labelEn: 'bear', icon: '🐻', category: 'animal' },
  { id: 'unicorn', labelDe: 'Einhorn', labelEn: 'unicorn', icon: '🦄', category: 'fantasy' },
  { id: 'fairy', labelDe: 'Fee', labelEn: 'fairy', icon: '🧚', category: 'fantasy' },
  { id: 'robot', labelDe: 'Roboter', labelEn: 'robot', icon: '🤖', category: 'fantasy' },
  { id: 'alien', labelDe: 'Alien', labelEn: 'alien creature', icon: '👽', category: 'fantasy' },
  { id: 'wizard', labelDe: 'Zauberer', labelEn: 'wizard', icon: '🧙', category: 'fantasy' },
  { id: 'dragon', labelDe: 'Drache', labelEn: 'dragon', icon: '🐉', category: 'fantasy' },
  { id: 'other', labelDe: 'Anderes', labelEn: 'fantasy creature', icon: '✨', category: 'other' },
] as const;

export type CharacterTypeId = typeof CHARACTER_TYPES[number]['id'];

// Gender options
export const GENDERS = [
  { id: 'male', labelDe: 'Junge / Männlich', labelEn: 'male', icon: '👦' },
  { id: 'female', labelDe: 'Mädchen / Weiblich', labelEn: 'female', icon: '👧' },
] as const;

export type GenderId = typeof GENDERS[number]['id'];

// Body builds
export const BODY_BUILDS = [
  { id: 'slim', labelDe: 'Schlank', labelEn: 'slim', icon: '🏃' },
  { id: 'normal', labelDe: 'Normal', labelEn: 'average', icon: '🧍' },
  { id: 'sturdy', labelDe: 'Kräftig', labelEn: 'sturdy', icon: '💪' },
] as const;

export type BodyBuildId = typeof BODY_BUILDS[number]['id'];

// Hair colors with visual representation
export const HAIR_COLORS = [
  { id: 'blonde', labelDe: 'Blond', labelEn: 'blonde', color: '#F4D03F', icon: '👱' },
  { id: 'brown', labelDe: 'Braun', labelEn: 'brown', color: '#8B4513', icon: '👩' },
  { id: 'black', labelDe: 'Schwarz', labelEn: 'black', color: '#1C1C1C', icon: '🖤' },
  { id: 'red', labelDe: 'Rot', labelEn: 'red', color: '#C0392B', icon: '🦰' },
  { id: 'gray', labelDe: 'Grau', labelEn: 'gray', color: '#95A5A6', icon: '👴' },
  { id: 'colorful', labelDe: 'Bunt', labelEn: 'colorful rainbow', color: 'linear-gradient(90deg, #FF6B6B, #4ECDC4, #45B7D1)', icon: '🌈' },
  { id: 'none', labelDe: 'Keine', labelEn: 'bald', color: '#FDF2E9', icon: '👨‍🦲' },
] as const;

export type HairColorId = typeof HAIR_COLORS[number]['id'];

// Hair styles
export const HAIR_STYLES = [
  { id: 'short', labelDe: 'Kurz', labelEn: 'short', icon: '✂️' },
  { id: 'long', labelDe: 'Lang', labelEn: 'long', icon: '💇' },
  { id: 'curly', labelDe: 'Lockig', labelEn: 'curly', icon: '🌀' },
  { id: 'braids', labelDe: 'Zöpfe', labelEn: 'braided', icon: '🎀' },
  { id: 'ponytail', labelDe: 'Pferdeschwanz', labelEn: 'ponytail', icon: '🐴' },
  { id: 'none', labelDe: 'Keine', labelEn: 'no hair', icon: '🚫' },
] as const;

export type HairStyleId = typeof HAIR_STYLES[number]['id'];

// Eye colors
export const EYE_COLORS = [
  { id: 'blue', labelDe: 'Blau', labelEn: 'blue', color: '#3498DB', icon: '💙' },
  { id: 'green', labelDe: 'Grün', labelEn: 'green', color: '#27AE60', icon: '💚' },
  { id: 'brown', labelDe: 'Braun', labelEn: 'brown', color: '#8B4513', icon: '🤎' },
  { id: 'gray', labelDe: 'Grau', labelEn: 'gray', color: '#7F8C8D', icon: '🩶' },
  { id: 'amber', labelDe: 'Bernstein', labelEn: 'amber', color: '#F39C12', icon: '🧡' },
  { id: 'other', labelDe: 'Andere', labelEn: 'unique colored', color: 'linear-gradient(90deg, #9B59B6, #3498DB)', icon: '🌈' },
] as const;

export type EyeColorId = typeof EYE_COLORS[number]['id'];

// Skin/Fur colors - Dynamic based on character type
export const SKIN_TONES_HUMAN = [
  { id: 'very_light', labelDe: 'Sehr hell', labelEn: 'very light skin', color: '#FDEBD0' },
  { id: 'light', labelDe: 'Hell', labelEn: 'light skin', color: '#F5CBA7' },
  { id: 'medium', labelDe: 'Mittel', labelEn: 'medium skin', color: '#D7BDA5' },
  { id: 'olive', labelDe: 'Oliv', labelEn: 'olive skin', color: '#C4A484' },
  { id: 'tan', labelDe: 'Gebräunt', labelEn: 'tan skin', color: '#A67B5B' },
  { id: 'brown', labelDe: 'Braun', labelEn: 'brown skin', color: '#8B5A2B' },
  { id: 'dark', labelDe: 'Dunkel', labelEn: 'dark skin', color: '#5D4037' },
] as const;

export const FUR_COLORS_ANIMAL = [
  { id: 'white', labelDe: 'Weiß', labelEn: 'white fur', color: '#FFFFFF' },
  { id: 'cream', labelDe: 'Creme', labelEn: 'cream fur', color: '#FFFDD0' },
  { id: 'golden', labelDe: 'Golden', labelEn: 'golden fur', color: '#FFD700' },
  { id: 'orange', labelDe: 'Orange', labelEn: 'orange fur', color: '#FF8C00' },
  { id: 'brown', labelDe: 'Braun', labelEn: 'brown fur', color: '#8B4513' },
  { id: 'gray', labelDe: 'Grau', labelEn: 'gray fur', color: '#808080' },
  { id: 'black', labelDe: 'Schwarz', labelEn: 'black fur', color: '#1C1C1C' },
  { id: 'spotted', labelDe: 'Gefleckt', labelEn: 'spotted pattern', color: 'linear-gradient(90deg, #FFF, #8B4513, #FFF)' },
  { id: 'striped', labelDe: 'Gestreift', labelEn: 'striped pattern', color: 'linear-gradient(90deg, #FF8C00, #1C1C1C, #FF8C00)' },
] as const;

// Special features / accessories
export const SPECIAL_FEATURES = [
  { id: 'glasses', labelDe: 'Brille', labelEn: 'wearing glasses', icon: '👓', category: 'accessory' },
  { id: 'hat', labelDe: 'Hut', labelEn: 'wearing a hat', icon: '🎩', category: 'accessory' },
  { id: 'crown', labelDe: 'Krone', labelEn: 'wearing a crown', icon: '👑', category: 'accessory' },
  { id: 'scarf', labelDe: 'Schal', labelEn: 'wearing a scarf', icon: '🧣', category: 'accessory' },
  { id: 'bow', labelDe: 'Schleife', labelEn: 'wearing a bow', icon: '🎀', category: 'accessory' },
  { id: 'wings', labelDe: 'Flügel', labelEn: 'has wings', icon: '🦋', category: 'body' },
  { id: 'tail', labelDe: 'Schwanz', labelEn: 'has a tail', icon: '🐾', category: 'body' },
  { id: 'horns', labelDe: 'Hörner', labelEn: 'has horns', icon: '🦌', category: 'body' },
  { id: 'freckles', labelDe: 'Sommersprossen', labelEn: 'has freckles', icon: '🔵', category: 'face' },
  { id: 'scar', labelDe: 'Narbe', labelEn: 'has a scar', icon: '⚡', category: 'face' },
  { id: 'beard', labelDe: 'Bart', labelEn: 'has a beard', icon: '🧔', category: 'face' },
  { id: 'earrings', labelDe: 'Ohrringe', labelEn: 'wearing earrings', icon: '💎', category: 'accessory' },
] as const;

export type SpecialFeatureId = typeof SPECIAL_FEATURES[number]['id'];

export const NARRATIVE_TRAIT_OPTIONS = [
  { id: 'kreativ', label: 'Kreativ' },
  { id: 'neugierig', label: 'Neugierig' },
  { id: 'mutig', label: 'Mutig' },
  { id: 'warmherzig', label: 'Warmherzig' },
  { id: 'clever', label: 'Clever' },
  { id: 'humorvoll', label: 'Humorvoll' },
  { id: 'geduldig', label: 'Geduldig' },
  { id: 'abenteuerlustig', label: 'Abenteuerlustig' },
] as const;

// Main Avatar Form Data structure
export interface AvatarFormData {
  // Basic info
  name: string;
  characterType: CharacterTypeId;
  customCharacterType?: string; // For "other" type

  // Demographics
  age: number; // Direct age in years (e.g., 5, 8, 150)
  gender: GenderId;
  height: number; // Height in cm (e.g., 135)
  bodyBuild: BodyBuildId;

  // Appearance
  hairColor: HairColorId;
  hairStyle: HairStyleId;
  eyeColor: EyeColorId;
  skinTone: string; // Dynamic based on character type

  // Special features (multi-select)
  specialFeatures: SpecialFeatureId[];

  // Optional description for fine-tuning
  additionalDescription?: string;
  dominantPersonality: string;
  characterTraits: string[];
  quirk: string;
  catchphrase: string;
  backstory: string;
}

export type AvatarVisualProfileRecord = Record<string, any>;

// Default values for new avatar
export const DEFAULT_AVATAR_FORM_DATA: AvatarFormData = {
  name: '',
  characterType: 'human',
  age: 8,
  gender: 'male',
  height: 130,
  bodyBuild: 'normal',
  hairColor: 'brown',
  hairStyle: 'short',
  eyeColor: 'brown',
  skinTone: 'medium',
  specialFeatures: [],
  additionalDescription: '',
  dominantPersonality: '',
  characterTraits: [],
  quirk: '',
  catchphrase: '',
  backstory: '',
};

// Helper function to check if character type is human
export function isHumanCharacter(type: CharacterTypeId): boolean {
  return type === 'human';
}

// Helper function to check if character type is animal
export function isAnimalCharacter(type: CharacterTypeId): boolean {
  const animalTypes: CharacterTypeId[] = ['dog', 'cat', 'rabbit', 'fox', 'bear'];
  return animalTypes.includes(type);
}

// Helper function to check if character type is fantasy
export function isFantasyCharacter(type: CharacterTypeId): boolean {
  const fantasyTypes: CharacterTypeId[] = ['unicorn', 'fairy', 'robot', 'alien', 'wizard', 'dragon', 'other'];
  return fantasyTypes.includes(type);
}

// Helper to get age description for visual profile
export function getAgeDescription(age: number, characterType: CharacterTypeId): string {
  if (isAnimalCharacter(characterType)) {
    if (age <= 1) return 'baby';
    if (age <= 3) return 'young';
    if (age <= 7) return 'adult';
    return 'elderly';
  }

  if (age <= 2) return 'baby';
  if (age <= 4) return 'toddler';
  if (age <= 8) return 'young child';
  if (age <= 12) return 'child';
  if (age <= 17) return 'teenager';
  if (age <= 30) return 'young adult';
  if (age <= 60) return 'adult';
  if (age <= 100) return 'elderly';
  return 'ancient';
}

// Helper to get height description
export function getHeightDescription(height: number, age: number): string {
  // Average height by age (roughly)
  const avgHeight: Record<number, number> = {
    2: 85, 3: 95, 4: 103, 5: 110, 6: 116, 7: 122, 8: 128,
    9: 133, 10: 138, 11: 143, 12: 149, 13: 156, 14: 163,
    15: 170, 16: 173, 17: 175, 18: 176
  };

  const avg = avgHeight[Math.min(age, 18)] || 176;
  const diff = height - avg;

  if (diff < -15) return 'very short';
  if (diff < -5) return 'short';
  if (diff <= 5) return 'average height';
  if (diff <= 15) return 'tall';
  return 'very tall';
}

// Convert form data to English description for image generation
export function formDataToDescription(data: AvatarFormData): string {
  const characterType = CHARACTER_TYPES.find(t => t.id === data.characterType);
  const gender = GENDERS.find(g => g.id === data.gender);
  const hairColor = HAIR_COLORS.find(h => h.id === data.hairColor);
  const hairStyle = HAIR_STYLES.find(h => h.id === data.hairStyle);
  const eyeColor = EYE_COLORS.find(e => e.id === data.eyeColor);
  const bodyBuild = BODY_BUILDS.find(b => b.id === data.bodyBuild);

  const parts: string[] = [];

  // Character type and age
  const ageDesc = getAgeDescription(data.age, data.characterType);
  if (data.characterType === 'other' && data.customCharacterType) {
    parts.push(`${ageDesc} ${data.customCharacterType}`);
  } else {
    parts.push(`${ageDesc} ${gender?.labelEn || ''} ${characterType?.labelEn || 'character'}`);
  }

  // Height (only for humans)
  if (isHumanCharacter(data.characterType)) {
    const heightDesc = getHeightDescription(data.height, data.age);
    parts.push(`${heightDesc} (${data.height}cm)`);
    parts.push(`${bodyBuild?.labelEn || 'normal'} build`);
  }

  // Hair
  if (data.hairColor !== 'none' && data.hairStyle !== 'none') {
    parts.push(`${hairColor?.labelEn || 'brown'} ${hairStyle?.labelEn || ''} hair`);
  } else if (isHumanCharacter(data.characterType)) {
    parts.push('bald');
  }

  // Eyes
  parts.push(`${eyeColor?.labelEn || 'brown'} eyes`);

  // Skin/Fur
  if (isHumanCharacter(data.characterType)) {
    const skinTone = SKIN_TONES_HUMAN.find(s => s.id === data.skinTone);
    if (skinTone) {
      parts.push(skinTone.labelEn);
    }
  } else if (isAnimalCharacter(data.characterType)) {
    const furColor = FUR_COLORS_ANIMAL.find(f => f.id === data.skinTone);
    if (furColor) {
      parts.push(furColor.labelEn);
    }
  }

  // Special features
  const features = data.specialFeatures
    .map(id => SPECIAL_FEATURES.find(f => f.id === id)?.labelEn)
    .filter(Boolean);
  if (features.length > 0) {
    parts.push(features.join(', '));
  }

  // Additional description
  if (data.additionalDescription?.trim()) {
    parts.push(data.additionalDescription.trim());
  }

  return parts.join(', ');
}

// Convert form data to structured visual profile for backend
function buildBaseVisualProfile(data: AvatarFormData): any {
  const characterType = CHARACTER_TYPES.find(t => t.id === data.characterType);
  const gender = GENDERS.find(g => g.id === data.gender);
  const hairColor = HAIR_COLORS.find(h => h.id === data.hairColor);
  const hairStyle = HAIR_STYLES.find(h => h.id === data.hairStyle);
  const eyeColor = EYE_COLORS.find(e => e.id === data.eyeColor);
  const bodyBuild = BODY_BUILDS.find(b => b.id === data.bodyBuild);

  const isHuman = isHumanCharacter(data.characterType);
  const isAnimal = isAnimalCharacter(data.characterType);

  // Build consistent descriptors (8-10 tokens)
  const consistentDescriptors: string[] = [];

  // Character type first
  if (data.characterType === 'other' && data.customCharacterType) {
    consistentDescriptors.push(data.customCharacterType);
  } else {
    consistentDescriptors.push(characterType?.labelEn || 'character');
  }

  // Age
  consistentDescriptors.push(getAgeDescription(data.age, data.characterType));

  // Gender
  consistentDescriptors.push(gender?.labelEn || 'unknown');

  // Hair
  if (hairColor?.labelEn && hairColor.id !== 'none') {
    consistentDescriptors.push(`${hairColor.labelEn} hair`);
  }

  // Eyes
  if (eyeColor?.labelEn) {
    consistentDescriptors.push(`${eyeColor.labelEn} eyes`);
  }

  // Animal-specific
  if (isAnimal) {
    consistentDescriptors.push('quadruped');
    consistentDescriptors.push('four paws');
    consistentDescriptors.push('tail visible');
  }

  // Human-specific
  if (isHuman) {
    consistentDescriptors.push('human');
    consistentDescriptors.push('natural skin');
  }

  // Key features
  data.specialFeatures.slice(0, 2).forEach(id => {
    const feature = SPECIAL_FEATURES.find(f => f.id === id);
    if (feature) {
      consistentDescriptors.push(feature.labelEn);
    }
  });

  return {
    characterType: data.characterType === 'other' && data.customCharacterType
      ? data.customCharacterType
      : characterType?.labelEn || 'character',
    speciesCategory: isHuman ? 'human' : isAnimal ? 'animal' : 'fantasy',
    locomotion: isAnimal ? 'quadruped' : 'bipedal',
    ageApprox: `${data.age} years old`,
    ageNumeric: data.age,
    gender: gender?.labelEn || 'unknown',
    heightCm: isHuman ? data.height : undefined,
    heightDescription: isHuman ? getHeightDescription(data.height, data.age) : undefined,
    bodyBuild: isHuman ? (bodyBuild?.labelEn || 'normal') : undefined,
    skin: {
      tone: isHuman
        ? (SKIN_TONES_HUMAN.find(s => s.id === data.skinTone)?.labelEn || 'medium skin')
        : (FUR_COLORS_ANIMAL.find(f => f.id === data.skinTone)?.labelEn || 'natural coloring'),
      undertone: null,
      distinctiveFeatures: data.specialFeatures
        .filter(id => ['freckles', 'scar'].includes(id))
        .map(id => SPECIAL_FEATURES.find(f => f.id === id)?.labelEn || '')
        .filter(Boolean),
    },
    hair: {
      color: hairColor?.labelEn || 'brown',
      type: isAnimal ? 'fur' : (hairStyle?.labelEn || 'straight'),
      length: hairStyle?.id === 'long' ? 'long' : hairStyle?.id === 'short' ? 'short' : 'medium',
      style: hairStyle?.labelEn || 'natural',
    },
    eyes: {
      color: eyeColor?.labelEn || 'brown',
      shape: 'round',
      size: 'medium',
    },
    face: {
      shape: isHuman ? 'round' : (isAnimal ? 'animal face' : 'unique'),
      nose: isAnimal ? 'snout' : 'small nose',
      mouth: null,
      eyebrows: isHuman ? 'natural eyebrows' : null,
      freckles: data.specialFeatures.includes('freckles'),
      otherFeatures: data.specialFeatures
        .filter(id => ['beard', 'scar'].includes(id))
        .map(id => SPECIAL_FEATURES.find(f => f.id === id)?.labelEn || '')
        .filter(Boolean),
    },
    accessories: data.specialFeatures
      .filter(id => ['glasses', 'hat', 'crown', 'scarf', 'bow', 'earrings'].includes(id))
      .map(id => SPECIAL_FEATURES.find(f => f.id === id)?.labelEn || '')
      .filter(Boolean),
    clothingCanonical: {
      top: null,
      bottom: null,
      outfit: isHuman ? 'casual clothing' : null,
      colors: [],
      patterns: [],
    },
    palette: {
      primary: [hairColor?.labelEn || 'brown', eyeColor?.labelEn || 'brown'],
      secondary: [],
    },
    consistentDescriptors: consistentDescriptors.slice(0, 10),
  };
}
type ManagedInvariantKey =
  | SpecialFeatureId
  | 'tooth_gap'
  | 'prominent_ears'
  | 'birthmark'
  | 'dimples';

type ManagedInvariantDefinition = {
  category: 'facial' | 'body' | 'accessory' | 'clothing' | 'distinctive';
  promptDescription: string;
  mustIncludeToken: string;
  forbiddenAlternative?: string;
  priority: 1 | 2 | 3;
  labelDe: string;
};

const MANAGED_INVARIANT_DEFINITIONS: Record<ManagedInvariantKey, ManagedInvariantDefinition> = {
  glasses: {
    category: 'accessory',
    promptDescription: 'wearing glasses',
    mustIncludeToken: 'wearing glasses',
    priority: 1,
    labelDe: 'Brille',
  },
  hat: {
    category: 'accessory',
    promptDescription: 'wearing a hat',
    mustIncludeToken: 'wearing a hat',
    priority: 2,
    labelDe: 'Hut',
  },
  crown: {
    category: 'accessory',
    promptDescription: 'wearing a crown',
    mustIncludeToken: 'wearing a crown',
    priority: 1,
    labelDe: 'Krone',
  },
  scarf: {
    category: 'accessory',
    promptDescription: 'wearing a scarf',
    mustIncludeToken: 'wearing a scarf',
    priority: 2,
    labelDe: 'Schal',
  },
  bow: {
    category: 'accessory',
    promptDescription: 'wearing a bow',
    mustIncludeToken: 'wearing a bow',
    priority: 2,
    labelDe: 'Schleife',
  },
  wings: {
    category: 'body',
    promptDescription: 'clearly visible wings',
    mustIncludeToken: 'wings visible',
    priority: 1,
    labelDe: 'Fl�gel',
  },
  tail: {
    category: 'body',
    promptDescription: 'clearly visible tail',
    mustIncludeToken: 'tail visible',
    priority: 2,
    labelDe: 'Schwanz',
  },
  horns: {
    category: 'body',
    promptDescription: 'clearly visible horns',
    mustIncludeToken: 'horns visible',
    priority: 1,
    labelDe: 'H�rner',
  },
  freckles: {
    category: 'facial',
    promptDescription: 'scattered freckles across nose and cheeks',
    mustIncludeToken: 'freckles on face',
    priority: 2,
    labelDe: 'Sommersprossen',
  },
  scar: {
    category: 'facial',
    promptDescription: 'small scar visible on face',
    mustIncludeToken: 'small scar on face',
    priority: 1,
    labelDe: 'Narbe',
  },
  beard: {
    category: 'facial',
    promptDescription: 'clearly visible beard',
    mustIncludeToken: 'beard visible',
    priority: 2,
    labelDe: 'Bart',
  },
  earrings: {
    category: 'accessory',
    promptDescription: 'wearing earrings',
    mustIncludeToken: 'wearing earrings',
    priority: 2,
    labelDe: 'Ohrringe',
  },
  tooth_gap: {
    category: 'facial',
    promptDescription: 'prominent gap between the front teeth, visible when smiling',
    mustIncludeToken: 'large tooth gap in front teeth',
    forbiddenAlternative: 'complete teeth, no gap',
    priority: 1,
    labelDe: 'Zahnl�cke vorne',
  },
  prominent_ears: {
    category: 'facial',
    promptDescription: 'noticeably protruding ears, standing out from the head',
    mustIncludeToken: 'prominent protruding ears',
    forbiddenAlternative: 'flat ears against head',
    priority: 1,
    labelDe: 'Abstehende Ohren',
  },
  birthmark: {
    category: 'facial',
    promptDescription: 'small birthmark visible on the face',
    mustIncludeToken: 'birthmark on face',
    priority: 1,
    labelDe: 'Muttermal',
  },
  dimples: {
    category: 'facial',
    promptDescription: 'dimples on the cheeks when smiling',
    mustIncludeToken: 'dimples on cheeks',
    priority: 2,
    labelDe: 'Gr�bchen',
  },
};

const MANAGED_FEATURE_TOKENS: Record<ManagedInvariantKey, string[]> = {
  glasses: ['wearing glasses', 'round glasses', 'square glasses', 'brille'],
  hat: ['wearing a hat', 'wearing hat', 'hut'],
  crown: ['wearing a crown', 'crown visible', 'krone'],
  scarf: ['wearing a scarf', 'scarf visible', 'schal'],
  bow: ['wearing a bow', 'bow visible', 'schleife'],
  wings: ['wings visible', 'has wings', 'flugel'],
  tail: ['tail visible', 'has a tail', 'schwanz'],
  horns: ['horns visible', 'has horns', 'horner'],
  freckles: ['freckles', 'sommersprossen'],
  scar: ['scar visible', 'scar on', 'narbe'],
  beard: ['beard visible', 'has a beard', 'bart'],
  earrings: ['wearing earrings', 'earrings visible', 'ohrringe'],
  tooth_gap: ['tooth gap', 'gap in front teeth', 'zahnlucke'],
  prominent_ears: ['protruding ears', 'prominent ears', 'abstehende ohren'],
  birthmark: ['birthmark', 'muttermal'],
  dimples: ['dimples', 'grubchen'],
};

function normalizeVisualText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/�/g, 'ss');
}

function getManagedFeatureKey(value: unknown): ManagedInvariantKey | undefined {
  const normalized = normalizeVisualText(value);
  if (!normalized) return undefined;

  for (const key of Object.keys(MANAGED_FEATURE_TOKENS) as ManagedInvariantKey[]) {
    if (
      normalized === key ||
      normalized.startsWith(`${key}_`) ||
      normalized.startsWith(`form_${key}`) ||
      MANAGED_FEATURE_TOKENS[key].some((token) => normalized.includes(token))
    ) {
      return key;
    }
  }

  return undefined;
}

function uniqueStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    if (typeof value !== 'string' || !value.trim()) return;
    const normalized = normalizeVisualText(value.trim());
    if (seen.has(normalized)) return;
    seen.add(normalized);
    result.push(value.trim());
  });

  return result;
}

function buildManagedInvariants(data: AvatarFormData): Array<Record<string, any>> {
  const activeKeys = new Set<ManagedInvariantKey>(data.specialFeatures);
  const notes = normalizeVisualText(data.additionalDescription);

  if (notes.includes('tooth gap') || notes.includes('zahnlucke')) activeKeys.add('tooth_gap');
  if (notes.includes('protruding ears') || notes.includes('abstehende ohren')) activeKeys.add('prominent_ears');
  if (notes.includes('birthmark') || notes.includes('muttermal')) activeKeys.add('birthmark');
  if (notes.includes('dimples') || notes.includes('grubchen')) activeKeys.add('dimples');

  return [...activeKeys].map((key) => ({
    id: `form_${key}`,
    ...MANAGED_INVARIANT_DEFINITIONS[key],
  }));
}

function mergeManagedStringList(
  existingValues: unknown,
  generatedValues: unknown,
  activeKeys: Set<ManagedInvariantKey>
): string[] {
  const existing = Array.isArray(existingValues) ? existingValues : [];
  const generated = Array.isArray(generatedValues) ? generatedValues : [];
  const preserved = existing.filter((value) => {
    const key = getManagedFeatureKey(value);
    return !key || activeKeys.has(key);
  });

  return uniqueStrings([...preserved, ...generated]);
}

function isManagedCoreDescriptor(value: string): boolean {
  const normalized = normalizeVisualText(value);
  const characterTokens = CHARACTER_TYPES.flatMap((character) => [
    normalizeVisualText(character.id),
    normalizeVisualText(character.labelEn),
  ]);

  return (
    /\b(years old|baby|toddler|young child|child|teenager|young adult|adult|elderly|ancient)\b/.test(normalized) ||
    /\b(hair|eyes|human|natural skin|quadruped|four paws)\b/.test(normalized) ||
    characterTokens.some((token) => normalized === token)
  );
}

function referenceFingerprint(referenceImageUrl?: string): string | null {
  if (!referenceImageUrl) return null;
  return `${referenceImageUrl.length}:${referenceImageUrl.slice(0, 48)}:${referenceImageUrl.slice(-48)}`;
}

export function getAvatarVisualPromptSignature(
  data: AvatarFormData,
  referenceImageUrl?: string
): string {
  return JSON.stringify({
    characterType: data.characterType,
    customCharacterType: data.customCharacterType?.trim() || null,
    age: data.age,
    gender: data.gender,
    height: data.height,
    bodyBuild: data.bodyBuild,
    hairColor: data.hairColor,
    hairStyle: data.hairStyle,
    eyeColor: data.eyeColor,
    skinTone: data.skinTone,
    specialFeatures: [...data.specialFeatures].sort(),
    additionalDescription: data.additionalDescription?.trim() || null,
    reference: referenceFingerprint(referenceImageUrl),
  });
}

export function formDataToNarrativeProfile(data: AvatarFormData) {
  const text = (value: string, maximum: number) => value.trim().replace(/\s+/g, ' ').slice(0, maximum);
  const dominantPersonality = text(data.dominantPersonality, 48);
  const traits = Array.from(new Set(data.characterTraits.map((trait) => text(trait, 32)).filter(Boolean))).slice(0, 5);
  const quirk = text(data.quirk, 180);
  const catchphrase = text(data.catchphrase, 120);
  const backstory = text(data.backstory, 520);
  const profile = {
    ...(dominantPersonality ? { dominantPersonality } : {}),
    ...(traits.length > 0 ? { traits } : {}),
    ...(quirk ? { quirk } : {}),
    ...(catchphrase ? { catchphrase } : {}),
    ...(backstory ? { backstory } : {}),
  };
  return Object.keys(profile).length > 0 ? profile : undefined;
}

export function inferSpecialFeaturesFromVisualProfile(
  visualProfile: AvatarVisualProfileRecord | null | undefined
): SpecialFeatureId[] {
  if (!visualProfile) return [];

  const candidates: unknown[] = [
    ...(Array.isArray(visualProfile.accessories) ? visualProfile.accessories : []),
    ...(Array.isArray(visualProfile.bodyFeatures) ? visualProfile.bodyFeatures : []),
    ...(Array.isArray(visualProfile.skin?.distinctiveFeatures)
      ? visualProfile.skin.distinctiveFeatures
      : []),
    ...(Array.isArray(visualProfile.face?.otherFeatures)
      ? visualProfile.face.otherFeatures
      : []),
    ...(Array.isArray(visualProfile.mustIncludeFeatures)
      ? visualProfile.mustIncludeFeatures.flatMap((feature: any) => [
          feature?.id,
          feature?.promptDescription,
          feature?.mustIncludeToken,
        ])
      : []),
  ];

  if (visualProfile.face?.freckles) candidates.push('freckles');

  const selected = new Set<SpecialFeatureId>();
  candidates.forEach((candidate) => {
    const key = getManagedFeatureKey(candidate);
    if (key && SPECIAL_FEATURES.some((feature) => feature.id === key)) {
      selected.add(key as SpecialFeatureId);
    }
  });

  return [...selected];
}

export function formDataToVisualProfile(data: AvatarFormData): AvatarVisualProfileRecord {
  const base = buildBaseVisualProfile(data) as AvatarVisualProfileRecord;
  const invariants = buildManagedInvariants(data);
  const selected = new Set<SpecialFeatureId>(data.specialFeatures);
  const selectedLabels = (category: string) =>
    SPECIAL_FEATURES
      .filter((feature) => feature.category === category && selected.has(feature.id))
      .map((feature) => feature.labelEn);

  const accessories = SPECIAL_FEATURES
    .filter((feature) => feature.category === 'accessory' && selected.has(feature.id))
    .map((feature) => feature.labelEn);
  const bodyFeatures = selectedLabels('body');
  const facialFeatures = selectedLabels('face');
  const descriptorTokens = invariants.map((feature) => feature.mustIncludeToken);

  return {
    ...base,
    ageDescription: getAgeDescription(data.age, data.characterType),
    bodyFeatures,
    skin: {
      ...base.skin,
      distinctiveFeatures: facialFeatures.filter((feature) =>
        /freckles|scar/i.test(feature)
      ),
    },
    face: {
      ...base.face,
      freckles: selected.has('freckles'),
      otherFeatures: facialFeatures.filter((feature) => !/freckles/i.test(feature)),
    },
    accessories,
    consistentDescriptors: uniqueStrings([
      ...(Array.isArray(base.consistentDescriptors) ? base.consistentDescriptors : []),
      ...descriptorTokens,
    ]).slice(0, 10),
    mustIncludeFeatures: invariants.length > 0 ? invariants : undefined,
    forbiddenFeatures: uniqueStrings(
      invariants.map((feature) => feature.forbiddenAlternative)
    ),
    additionalNotes: data.additionalDescription?.trim() || undefined,
  };
}

export function mergeVisualProfileWithForm(
  existingProfile: AvatarVisualProfileRecord | null | undefined,
  data: AvatarFormData
): AvatarVisualProfileRecord {
  const existing = existingProfile && typeof existingProfile === 'object'
    ? existingProfile
    : {};
  const generated = formDataToVisualProfile(data);
  const generatedInvariants = Array.isArray(generated.mustIncludeFeatures)
    ? generated.mustIncludeFeatures
    : [];
  const activeKeys = new Set<ManagedInvariantKey>(
    generatedInvariants
      .map((feature: any) => getManagedFeatureKey(feature?.id))
      .filter(Boolean) as ManagedInvariantKey[]
  );

  const existingInvariants = Array.isArray(existing.mustIncludeFeatures)
    ? existing.mustIncludeFeatures
    : [];
  const preservedInvariants = existingInvariants.filter((feature: any) => {
    const key = getManagedFeatureKey(
      [feature?.id, feature?.promptDescription, feature?.mustIncludeToken].join(' ')
    );
    return !key || activeKeys.has(key);
  });
  const mergedInvariants = [...preservedInvariants, ...generatedInvariants].filter(
    (feature, index, all) => {
      const token = normalizeVisualText(feature?.mustIncludeToken || feature?.id);
      return token && all.findIndex((candidate) =>
        normalizeVisualText(candidate?.mustIncludeToken || candidate?.id) === token
      ) === index;
    }
  );

  const existingForbidden = Array.isArray(existing.forbiddenFeatures)
    ? existing.forbiddenFeatures
    : [];
  const preservedForbidden = existingForbidden.filter((feature: string) => {
    const key = getManagedFeatureKey(feature);
    return !key || activeKeys.has(key);
  });

  const preservedDescriptors = (Array.isArray(existing.consistentDescriptors)
    ? existing.consistentDescriptors
    : []
  ).filter((descriptor: string) => {
    const key = getManagedFeatureKey(descriptor);
    if (key) return activeKeys.has(key);
    return !isManagedCoreDescriptor(descriptor);
  });

  const existingClothing =
    existing.clothingCanonical && typeof existing.clothingCanonical === 'object'
      ? existing.clothingCanonical
      : {};
  const existingPalette =
    existing.palette && typeof existing.palette === 'object'
      ? existing.palette
      : {};

  return {
    ...existing,
    ...generated,
    skin: {
      ...(generated.skin || {}),
      ...(existing.skin || {}),
      tone: generated.skin?.tone,
      distinctiveFeatures: mergeManagedStringList(
        existing.skin?.distinctiveFeatures,
        generated.skin?.distinctiveFeatures,
        activeKeys
      ),
    },
    hair: {
      ...(existing.hair || {}),
      ...(generated.hair || {}),
    },
    eyes: {
      ...(generated.eyes || {}),
      ...(existing.eyes || {}),
      color: generated.eyes?.color,
    },
    face: {
      ...(generated.face || {}),
      ...(existing.face || {}),
      freckles: generated.face?.freckles,
      otherFeatures: mergeManagedStringList(
        existing.face?.otherFeatures,
        generated.face?.otherFeatures,
        activeKeys
      ),
    },
    accessories: mergeManagedStringList(
      existing.accessories,
      generated.accessories,
      activeKeys
    ),
    bodyFeatures: mergeManagedStringList(
      existing.bodyFeatures,
      generated.bodyFeatures,
      activeKeys
    ),
    clothingCanonical: {
      ...(generated.clothingCanonical || {}),
      ...existingClothing,
    },
    palette: {
      ...(generated.palette || {}),
      ...existingPalette,
      primary: uniqueStrings([
        ...(Array.isArray(generated.palette?.primary) ? generated.palette.primary : []),
        ...(Array.isArray(existingPalette.primary) ? existingPalette.primary : []),
      ]),
      secondary: uniqueStrings([
        ...(Array.isArray(existingPalette.secondary) ? existingPalette.secondary : []),
        ...(Array.isArray(generated.palette?.secondary) ? generated.palette.secondary : []),
      ]),
    },
    consistentDescriptors: uniqueStrings([
      ...(Array.isArray(generated.consistentDescriptors)
        ? generated.consistentDescriptors
        : []),
      ...preservedDescriptors,
    ]).slice(0, 14),
    mustIncludeFeatures: mergedInvariants.length > 0 ? mergedInvariants : undefined,
    forbiddenFeatures: uniqueStrings([
      ...preservedForbidden,
      ...(Array.isArray(generated.forbiddenFeatures) ? generated.forbiddenFeatures : []),
    ]),
    additionalNotes: generated.additionalNotes,
  };
}

export type AvatarFormField = keyof AvatarFormData;

export const AVATAR_VISUAL_FORM_FIELDS: readonly AvatarFormField[] = [
  'characterType',
  'customCharacterType',
  'age',
  'gender',
  'height',
  'bodyBuild',
  'hairColor',
  'hairStyle',
  'eyeColor',
  'skinTone',
  'specialFeatures',
  'additionalDescription',
] as const;

export const AVATAR_NARRATIVE_FORM_FIELDS: readonly AvatarFormField[] = [
  'dominantPersonality',
  'characterTraits',
  'quirk',
  'catchphrase',
  'backstory',
] as const;

function hasOwnVisualField(source: AvatarVisualProfileRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key);
}

/**
 * Editor-safe visual profile merge.
 *
 * Form controls intentionally cover only a subset of the canonical visual
 * profile. Untouched canonical clothing, invariants, image markers and
 * uneditable nested fields therefore stay byte-for-byte equivalent.
 */
export function mergeVisualProfileForEditor(
  existingProfile: AvatarVisualProfileRecord | null | undefined,
  data: AvatarFormData,
  dirtyFields: ReadonlySet<AvatarFormField>
): AvatarVisualProfileRecord {
  const existing = existingProfile && typeof existingProfile === 'object'
    ? existingProfile
    : {};
  const hasExisting = Object.keys(existing).length > 0;
  const generated = formDataToVisualProfile(data);
  const result = mergeVisualProfileWithForm(existing, data);
  const isDirty = (...fields: AvatarFormField[]) =>
    !hasExisting || fields.some((field) => dirtyFields.has(field));
  const assignRoot = (keys: string[], fields: AvatarFormField[]) => {
    keys.forEach((key) => {
      if (isDirty(...fields) || !hasOwnVisualField(existing, key)) {
        result[key] = generated[key];
      } else {
        result[key] = existing[key];
      }
    });
  };

  assignRoot(
    ['characterType', 'speciesCategory', 'locomotion'],
    ['characterType', 'customCharacterType']
  );
  assignRoot(
    ['ageApprox', 'ageNumeric', 'ageDescription'],
    ['age']
  );
  assignRoot(['gender'], ['gender']);
  assignRoot(['heightCm'], ['height']);
  assignRoot(['heightDescription'], ['height', 'age']);
  assignRoot(['bodyBuild'], ['bodyBuild']);

  const existingSkin = existing.skin && typeof existing.skin === 'object' ? existing.skin : {};
  const generatedSkin = generated.skin && typeof generated.skin === 'object' ? generated.skin : {};
  const mergedSkin = result.skin && typeof result.skin === 'object' ? result.skin : {};
  result.skin = { ...existingSkin };
  result.skin.tone =
    isDirty('skinTone') || existingSkin.tone === undefined
      ? generatedSkin.tone
      : existingSkin.tone;
  result.skin.distinctiveFeatures =
    isDirty('specialFeatures', 'additionalDescription') ||
    existingSkin.distinctiveFeatures === undefined
      ? mergedSkin.distinctiveFeatures
      : existingSkin.distinctiveFeatures;

  const existingHair = existing.hair && typeof existing.hair === 'object' ? existing.hair : {};
  const generatedHair = generated.hair && typeof generated.hair === 'object' ? generated.hair : {};
  result.hair = { ...existingHair };
  result.hair.color =
    isDirty('hairColor') || existingHair.color === undefined
      ? generatedHair.color
      : existingHair.color;
  ['type', 'length', 'style'].forEach((key) => {
    result.hair[key] =
      isDirty('hairStyle') || existingHair[key] === undefined
        ? generatedHair[key]
        : existingHair[key];
  });

  const existingEyes = existing.eyes && typeof existing.eyes === 'object' ? existing.eyes : {};
  const generatedEyes = generated.eyes && typeof generated.eyes === 'object' ? generated.eyes : {};
  result.eyes = { ...existingEyes };
  result.eyes.color =
    isDirty('eyeColor') || existingEyes.color === undefined
      ? generatedEyes.color
      : existingEyes.color;

  const featureFields: AvatarFormField[] = ['specialFeatures', 'additionalDescription'];
  if (!isDirty(...featureFields)) {
    ['accessories', 'bodyFeatures', 'mustIncludeFeatures', 'forbiddenFeatures'].forEach((key) => {
      if (hasOwnVisualField(existing, key)) result[key] = existing[key];
    });
    if (existing.face && typeof existing.face === 'object') {
      result.face = { ...existing.face };
    }
    if (existingSkin.distinctiveFeatures !== undefined) {
      result.skin.distinctiveFeatures = existingSkin.distinctiveFeatures;
    }
  }

  if (!isDirty('additionalDescription') && hasOwnVisualField(existing, 'additionalNotes')) {
    result.additionalNotes = existing.additionalNotes;
  }

  const hasAnyVisualChange = AVATAR_VISUAL_FORM_FIELDS.some((field) => dirtyFields.has(field));
  if (!hasAnyVisualChange) {
    ['consistentDescriptors', 'palette'].forEach((key) => {
      if (hasOwnVisualField(existing, key)) result[key] = existing[key];
    });
  }

  if (existing.clothingCanonical && typeof existing.clothingCanonical === 'object') {
    result.clothingCanonical = existing.clothingCanonical;
  }

  Object.keys(existing).forEach((key) => {
    if (/(canonical|marker|invariant)/i.test(key) && key !== 'consistentDescriptors') {
      result[key] = existing[key];
    }
  });

  return result;
}

