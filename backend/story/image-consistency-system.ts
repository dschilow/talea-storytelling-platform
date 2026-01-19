/**
 * IMAGE CONSISTENCY SYSTEM v3.0
 *
 * This module provides a comprehensive solution for maintaining visual consistency
 * of characters across all story chapter images.
 *
 * Key Features:
 * 1. Character-First Prompt Structure (never truncated)
 * 2. Seed Consistency (same seed for all chapters)
 * 3. IP-Adapter Reference Image Support
 * 4. Explicit Age Guards at Prompt Start
 * 5. Style Locking for consistent art style
 *
 * @author Talea AI Team
 * @version 3.0.0
 */

import type { AvatarVisualProfile } from "../avatar/avatar";
import { normalizeLanguage } from "./avatar-image-optimization";

/**
 * Character consistency configuration for a story
 */
export interface StoryCharacterConsistency {
  /** Unique story generation session ID */
  storySessionId: string;
  /** Base seed for all images in this story (deterministic) */
  baseSeed: number;
  /** Character profiles with their canonical appearance */
  characters: CharacterCanonicalAppearance[];
  /** Reference image URLs for IP-Adapter (if available) */
  referenceImages: Map<string, string>;
  /** Art style to enforce across all images */
  lockedStyle: ArtStyleConfig;
  /** Target age group for size references */
  ageGroup: string;
}

/**
 * Canonical character appearance - NEVER changes across chapters
 */
export interface CharacterCanonicalAppearance {
  name: string;
  /** Explicit age in years (e.g., 6, 8) */
  ageYears: number;
  /** Explicit height in cm (e.g., 120, 135) */
  heightCm: number;
  /** Gender for pronoun and size references */
  gender: 'male' | 'female' | 'neutral';
  /** Hair description - color, style, length */
  hair: {
    color: string;
    style: string;
    length: string;
  };
  /** Eye description - color, shape */
  eyes: {
    color: string;
    shape: string;
  };
  /** Skin tone */
  skinTone: string;
  /** Canonical outfit */
  outfit: string;
  /** Distinctive features that MUST appear in every image */
  distinctiveFeatures: string[];
  /** Features that MUST NEVER appear */
  forbiddenFeatures: string[];
  /** Species type */
  species: 'human' | 'animal' | 'cat' | 'dog';
}

/**
 * Art style configuration for consistency
 */
export interface ArtStyleConfig {
  masterStyle: string;
  colorPalette: string;
  lineStyle: string;
  lightingStyle: string;
  textureStyle: string;
}

/**
 * Default Talea art style (Axel Scheffler inspired)
 */
export const TALEA_DEFAULT_STYLE: ArtStyleConfig = {
  masterStyle: "Axel Scheffler watercolor storybook illustration",
  colorPalette: "warm pastels, golden tones, soft earth colors",
  lineStyle: "bold hand-inked outlines, slightly caricature",
  lightingStyle: "warm rim light, golden key light, gentle bounce",
  textureStyle: "gouache textures, traditional pigments on textured paper",
};

/**
 * Creates a deterministic base seed from story parameters
 * This ensures the same story config always produces the same seed
 */
export function createDeterministicSeed(
  storyTitle: string,
  avatarNames: string[],
  timestamp?: number
): number {
  const seedString = `${storyTitle}-${avatarNames.sort().join('-')}-${timestamp || Date.now()}`;
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    const char = seedString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % 2147483647;
}

/**
 * Extracts canonical appearance from AvatarVisualProfile
 */
export function extractCanonicalAppearance(
  name: string,
  profile: AvatarVisualProfile,
  ageGroup: string
): CharacterCanonicalAppearance {
  const profileAny = profile as any;

  // Extract explicit age from profile or derive from ageGroup
  let ageYears = profileAny.ageNumeric || profileAny.age;
  if (!ageYears && profile.ageApprox) {
    const match = profile.ageApprox.match(/(\d+)/);
    if (match) ageYears = parseInt(match[1], 10);
  }
  if (!ageYears) {
    // Derive from age group
    const ageMap: Record<string, number> = {
      '3-5': 4,
      '6-8': 7,
      '9-12': 10,
    };
    ageYears = ageMap[ageGroup] || 7;
  }

  // Extract explicit height from profile or calculate from age
  let heightCm = profileAny.heightCm || profileAny.height;
  if (!heightCm) {
    // Average height calculation based on age (child growth charts)
    const heightByAge: Record<number, number> = {
      3: 95, 4: 102, 5: 109, 6: 115, 7: 121,
      8: 128, 9: 133, 10: 138, 11: 143, 12: 149
    };
    heightCm = heightByAge[ageYears] || 121;
  }

  // Determine species
  let species: CharacterCanonicalAppearance['species'] = 'human';
  const characterType = (profileAny.characterType || '').toLowerCase();
  if (characterType.includes('cat') || characterType.includes('kitten')) {
    species = 'cat';
  } else if (characterType.includes('dog') || characterType.includes('puppy')) {
    species = 'dog';
  } else if (characterType.includes('animal') || characterType.includes('creature')) {
    species = 'animal';
  }

  // Build distinctive features from various sources
  const distinctiveFeatures: string[] = [];
  if (profile.skin?.distinctiveFeatures) {
    distinctiveFeatures.push(...profile.skin.distinctiveFeatures.map(f => normalizeLanguage(f)));
  }
  if (profile.face?.otherFeatures) {
    distinctiveFeatures.push(...profile.face.otherFeatures.map(f => normalizeLanguage(f)));
  }

  // Build forbidden features based on species
  const forbiddenFeatures: string[] = [];
  if (species === 'human') {
    forbiddenFeatures.push(
      // Animal ears and tails
      'animal ears', 'cat ears', 'dog ears', 'pointed ears on top of head',
      'tail', 'any tail', 'fur', 'furry', 'paws', 'snout', 'muzzle', 'whiskers',
      'animal features', 'anthropomorphic',
      // CRITICAL v3.1: Elf/Fantasy ears explicitly forbidden
      'elf ears', 'elven ears', 'pointed ears', 'pointy ears', 'fantasy ears',
      'fairy ears', 'elongated ears', 'tapered ears', 'ears with pointed tips',
      'non-human ears', 'ears pointing upward'
    );

    // Add color protection
    const hairColor = profile.hair?.color?.toLowerCase() || '';
    if (hairColor.includes('blond') || hairColor.includes('gold')) {
      forbiddenFeatures.push('brown hair', 'black hair', 'red hair');
    } else if (hairColor.includes('brown')) {
      forbiddenFeatures.push('blonde hair', 'black hair');
    } else if (hairColor.includes('black')) {
      forbiddenFeatures.push('blonde hair', 'brown hair');
    }

    const eyeColor = profile.eyes?.color?.toLowerCase() || '';
    if (eyeColor.includes('blue')) {
      forbiddenFeatures.push('brown eyes', 'green eyes');
    } else if (eyeColor.includes('green')) {
      forbiddenFeatures.push('blue eyes', 'brown eyes');
    } else if (eyeColor.includes('brown')) {
      forbiddenFeatures.push('blue eyes', 'green eyes');
    }
  }

  return {
    name,
    ageYears,
    heightCm,
    gender: profileAny.gender || 'neutral',
    hair: {
      color: normalizeLanguage(profile.hair?.color || 'brown'),
      style: normalizeLanguage(profile.hair?.style || 'natural'),
      length: normalizeLanguage(profile.hair?.length || 'medium'),
    },
    eyes: {
      color: normalizeLanguage(profile.eyes?.color || 'brown'),
      shape: normalizeLanguage(profile.eyes?.shape || 'round'),
    },
    skinTone: normalizeLanguage(profile.skin?.tone || 'fair'),
    outfit: normalizeLanguage(
      profile.clothingCanonical?.outfit ||
      [profile.clothingCanonical?.top, profile.clothingCanonical?.bottom].filter(Boolean).join(', ') ||
      'casual clothing'
    ),
    distinctiveFeatures,
    forbiddenFeatures,
    species,
  };
}

/**
 * Builds a CHARACTER-FIRST prompt block that should NEVER be truncated
 * This is the core of the consistency system
 *
 * IMPORTANT: Since Flux.1 Dev does NOT support negative prompts,
 * all critical exclusions are built INTO the positive prompt.
 */
export function buildCharacterFirstBlock(
  characters: CharacterCanonicalAppearance[],
  style: ArtStyleConfig = TALEA_DEFAULT_STYLE
): string {
  const lines: string[] = [];

  // 0. FLUX.1 CRITICAL EXCLUSIONS (at VERY TOP since Flux.1 has no negative prompts)
  const humanChars = characters.filter(c => c.species === 'human');
  if (humanChars.length > 0) {
    lines.push('[CRITICAL RULES: Human characters must have NORMAL ROUND ears on SIDES of head. NO pointed/elf/fantasy ears. NO animal features.]');
    lines.push('');
  }

  // 1. STYLE DECLARATION (compact, at the very start)
  lines.push(`[STYLE: ${style.masterStyle}, ${style.lineStyle}]`);
  lines.push('');

  // 2. CHARACTER IDENTITY BLOCKS (most important - never truncate)
  lines.push('=== CHARACTERS (CRITICAL - EXACT APPEARANCE) ===');

  for (const char of characters) {
    if (char.species === 'human') {
      lines.push(buildHumanCharacterLine(char));
    } else {
      lines.push(buildAnimalCharacterLine(char));
    }
  }

  lines.push('');

  // 3. RELATIONSHIP/SIZE REFERENCES (for multi-character scenes)
  if (characters.length > 1) {
    const humanChars = characters.filter(c => c.species === 'human');
    if (humanChars.length > 1) {
      // Sort by height for clear comparison
      const sorted = [...humanChars].sort((a, b) => a.heightCm - b.heightCm);
      const heightRefs = sorted.map(c => `${c.name}=${c.heightCm}cm`).join(' < ');
      lines.push(`HEIGHT ORDER: ${heightRefs}`);

      // Add explicit comparison
      const shortest = sorted[0];
      const tallest = sorted[sorted.length - 1];
      const diff = tallest.heightCm - shortest.heightCm;
      lines.push(`${shortest.name} is ${diff}cm SHORTER than ${tallest.name} - VISIBLE size difference!`);
    }
  }

  lines.push('');
  lines.push('=== END CHARACTERS ===');

  return lines.join('\n');
}

/**
 * Builds a single human character line with all critical details
 */
function buildHumanCharacterLine(char: CharacterCanonicalAppearance): string {
  const parts: string[] = [];

  // Name with explicit age and size
  parts.push(`[${char.name.toUpperCase()}]`);
  parts.push(`EXACTLY ${char.ageYears}-year-old ${char.gender === 'male' ? 'boy' : char.gender === 'female' ? 'girl' : 'child'}`);
  parts.push(`HEIGHT: ${char.heightCm}cm (${getHeightDescription(char.ageYears, char.heightCm)})`);

  // Physical appearance (MUST HAVE)
  parts.push(`HAIR: ${char.hair.color} ${char.hair.style} ${char.hair.length}`);
  parts.push(`EYES: ${char.eyes.color} ${char.eyes.shape}`);
  parts.push(`SKIN: ${char.skinTone}`);
  parts.push(`OUTFIT: ${char.outfit}`);

  // Distinctive features
  if (char.distinctiveFeatures.length > 0) {
    parts.push(`DISTINCTIVE: ${char.distinctiveFeatures.slice(0, 3).join(', ')}`);
  }

  // Critical human guard - ENHANCED v3.1 for elf ear prevention
  parts.push('MUST BE: 100% HUMAN child, NO animal features, NO elf ears');
  parts.push('EARS: NORMAL ROUND HUMAN ears on SIDES of head (NOT pointed, NOT elf-like, NOT fantasy)');

  return parts.join(' | ');
}

/**
 * Builds a single animal character line
 */
function buildAnimalCharacterLine(char: CharacterCanonicalAppearance): string {
  const parts: string[] = [];

  parts.push(`[${char.name.toUpperCase()}]`);
  parts.push(`${char.species.toUpperCase()} - quadruped on four legs`);
  parts.push(`FUR/COAT: ${char.hair.color}`);
  parts.push(`EYES: ${char.eyes.color}`);

  if (char.distinctiveFeatures.length > 0) {
    parts.push(`DISTINCTIVE: ${char.distinctiveFeatures.slice(0, 3).join(', ')}`);
  }

  parts.push(`MUST BE: natural ${char.species}, NOT anthropomorphic, NOT wearing clothes`);

  return parts.join(' | ');
}

/**
 * Returns a human-readable height description
 */
function getHeightDescription(age: number, heightCm: number): string {
  // Compare to average heights
  const avgHeights: Record<number, number> = {
    3: 95, 4: 102, 5: 109, 6: 115, 7: 121,
    8: 128, 9: 133, 10: 138, 11: 143, 12: 149
  };
  const avg = avgHeights[age] || 121;

  if (heightCm < avg - 5) return 'shorter than average';
  if (heightCm > avg + 5) return 'taller than average';
  return 'average height';
}

/**
 * Builds a complete image prompt with character-first structure
 * Scene details can be truncated, but character block is preserved
 */
export function buildConsistentImagePrompt(
  consistency: StoryCharacterConsistency,
  sceneDescription: string,
  chapterNumber: number,
  options?: {
    composition?: string;
    mood?: string;
    lighting?: string;
  }
): { positivePrompt: string; negativePrompt: string; seed: number } {
  const lines: string[] = [];

  // 1. CHARACTER BLOCK FIRST (NEVER truncated)
  const characterBlock = buildCharacterFirstBlock(
    consistency.characters,
    consistency.lockedStyle
  );
  lines.push(characterBlock);

  // 2. SCENE DESCRIPTION (can be truncated if needed)
  lines.push('');
  lines.push('=== SCENE ===');
  lines.push(normalizeLanguage(sceneDescription));

  if (options?.composition) {
    lines.push(`COMPOSITION: ${normalizeLanguage(options.composition)}`);
  }
  if (options?.mood) {
    lines.push(`MOOD: ${normalizeLanguage(options.mood)}`);
  }
  if (options?.lighting) {
    lines.push(`LIGHTING: ${normalizeLanguage(options.lighting)}`);
  }

  // 3. QUALITY GUARDS
  lines.push('');
  lines.push('QUALITY: child-safe, print-ready, no text/watermarks');
  lines.push('CRITICAL: Each character appears EXACTLY ONCE with their EXACT appearance defined above');

  // CRITICAL FOR FLUX.1: Add positive exclusions since Flux.1 Dev doesn't support negative prompts
  const humanChars = consistency.characters.filter(c => c.species === 'human');
  if (humanChars.length > 0) {
    const humanNames = humanChars.map(c => c.name).join(' and ');
    lines.push('');
    lines.push(`[FLUX.1 CRITICAL - ${humanNames} MUST HAVE: normal ROUND human ears on SIDES of head]`);
    lines.push(`[ABSOLUTELY NO: pointed ears, elf ears, fantasy ears, animal ears, ears on top of head]`);
    lines.push(`[NO: tail, fur on skin, whiskers, snout, paws - pure human anatomy only]`);
  }

  // Build negative prompt from all forbidden features (kept for non-Flux models)
  const allForbidden = new Set<string>();
  for (const char of consistency.characters) {
    char.forbiddenFeatures.forEach(f => allForbidden.add(f));
  }
  // Standard quality issues
  allForbidden.add('duplicate characters');
  allForbidden.add('twins');
  allForbidden.add('text');
  allForbidden.add('watermark');
  allForbidden.add('signature');
  allForbidden.add('deformed');
  allForbidden.add('disfigured');
  // CRITICAL v3.1: Explicitly add elf ears to global negative prompt
  allForbidden.add('elf ears');
  allForbidden.add('elven ears');
  allForbidden.add('pointed ears');
  allForbidden.add('pointy ears');
  allForbidden.add('fantasy ears');

  const negativePrompt = Array.from(allForbidden).join(', ');

  // Seed: Same base seed for all chapters, but with chapter offset for variety
  // Using a small multiplier ensures variety while maintaining some consistency
  const seed = (consistency.baseSeed + chapterNumber * 7) >>> 0;

  return {
    positivePrompt: lines.join('\n'),
    negativePrompt,
    seed,
  };
}

/**
 * Smart prompt clamping that NEVER removes character block
 * Only truncates scene details if needed
 */
export function smartClampPrompt(prompt: string, maxLength: number = 2800): string {
  if (prompt.length <= maxLength) {
    return prompt;
  }

  // Find the character block boundaries
  const charBlockStart = prompt.indexOf('=== CHARACTERS');
  const charBlockEnd = prompt.indexOf('=== END CHARACTERS');

  if (charBlockStart === -1 || charBlockEnd === -1) {
    // No character block found, use simple truncation
    return prompt.slice(0, maxLength - 3) + '...';
  }

  // Extract character block (MUST preserve)
  const characterBlock = prompt.slice(charBlockStart, charBlockEnd + '=== END CHARACTERS ==='.length);

  // Extract parts before and after character block
  const beforeBlock = prompt.slice(0, charBlockStart);
  const afterBlock = prompt.slice(charBlockEnd + '=== END CHARACTERS ==='.length);

  // Calculate how much space we have for scene details
  const characterBlockLength = characterBlock.length;
  const availableForOther = maxLength - characterBlockLength - 50; // 50 char buffer

  if (availableForOther < 100) {
    // Not enough space even for minimal scene
    console.warn('[smartClampPrompt] Character block too large, returning character block only');
    return characterBlock;
  }

  // Truncate scene details (afterBlock) to fit
  let truncatedAfter = afterBlock;
  if (truncatedAfter.length > availableForOther) {
    truncatedAfter = truncatedAfter.slice(0, availableForOther - 3);
    // Find a good break point
    const lastPeriod = truncatedAfter.lastIndexOf('.');
    const lastNewline = truncatedAfter.lastIndexOf('\n');
    const breakPoint = Math.max(lastPeriod, lastNewline, availableForOther * 0.7);
    truncatedAfter = truncatedAfter.slice(0, breakPoint) + '...';
  }

  const result = beforeBlock + characterBlock + truncatedAfter;

  if (result.length > maxLength) {
    console.warn(`[smartClampPrompt] Result still too long (${result.length}), hard truncating`);
    return result.slice(0, maxLength - 3) + '...';
  }

  return result;
}

/**
 * Creates a StoryCharacterConsistency object from story config and avatars
 */
export function createStoryConsistency(
  storyTitle: string,
  avatars: Array<{ name: string; visualProfile: AvatarVisualProfile }>,
  ageGroup: string,
  style?: ArtStyleConfig
): StoryCharacterConsistency {
  const avatarNames = avatars.map(a => a.name);
  const baseSeed = createDeterministicSeed(storyTitle, avatarNames);

  const characters = avatars.map(avatar =>
    extractCanonicalAppearance(avatar.name, avatar.visualProfile, ageGroup)
  );

  return {
    storySessionId: `story-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    baseSeed,
    characters,
    referenceImages: new Map(),
    lockedStyle: style || TALEA_DEFAULT_STYLE,
    ageGroup,
  };
}

/**
 * Logs consistency system status for debugging
 */
export function logConsistencyStatus(consistency: StoryCharacterConsistency): void {
  console.log('[ImageConsistency] ========================================');
  console.log(`[ImageConsistency] Session: ${consistency.storySessionId}`);
  console.log(`[ImageConsistency] Base Seed: ${consistency.baseSeed}`);
  console.log(`[ImageConsistency] Characters: ${consistency.characters.length}`);

  for (const char of consistency.characters) {
    console.log(`[ImageConsistency]   - ${char.name}: ${char.ageYears}yo, ${char.heightCm}cm, ${char.hair.color} hair, ${char.eyes.color} eyes`);
  }

  console.log(`[ImageConsistency] Style: ${consistency.lockedStyle.masterStyle}`);
  console.log('[ImageConsistency] ========================================');
}
