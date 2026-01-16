/**
 * Avatar Form Types and Constants
 * Shared between AvatarWizard and EditAvatar screens
 */

// Character Types with icons and English translations for image generation
export const CHARACTER_TYPES = [
  { id: 'human', labelDe: 'Mensch', labelEn: 'human child', icon: '👦', category: 'common' },
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
  { id: 'normal', labelDe: 'Normal', labelEn: 'normal build', icon: '🧍' },
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
}

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
export function formDataToVisualProfile(data: AvatarFormData): any {
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
    consistentDescriptors.push('human child');
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
    gender: gender?.labelEn || 'unknown',
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
      outfit: isHuman ? 'casual children clothing' : null,
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
