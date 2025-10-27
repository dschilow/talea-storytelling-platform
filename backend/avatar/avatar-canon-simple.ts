/**
 * Simple Avatar Canon for Visual Consistency
 *
 * Quick-fix implementation: Simple, effective avatar definitions
 * for consistent image generation across all prompts.
 */

export interface SimpleAvatarCanon {
  name: string;
  hair: string;
  eyes: string;
  clothing: string;
  distinctive: string[];
}

/**
 * Simple avatar canons - hardcoded for immediate impact
 */
export const AVATAR_CANON: Record<string, SimpleAvatarCanon> = {
  alexander: {
    name: "Alexander",
    hair: "chestnut-brown, short curly, golden highlights",
    eyes: "warm amber-brown, large, expressive",
    clothing: "green hoodie, white t-shirt",
    distinctive: ["rosy cheeks", "button nose", "energetic"]
  },
  adrian: {
    name: "adrian",
    hair: "golden-blonde, short and messy, spiky fringe",
    eyes: "sky-blue, large, wide/anime-style",
    clothing: "blue denim jacket, mustard-yellow hoodie",
    distinctive: ["fair skin", "rosy cheeks", "freckles", "shy"]
  }
};

/**
 * Get canon for avatar name (case insensitive)
 */
export function getAvatarCanon(avatarName: string): SimpleAvatarCanon {
  const key = avatarName.toLowerCase();
  const canon = AVATAR_CANON[key];

  if (!canon) {
    throw new Error(`No canon defined for avatar: ${avatarName}`);
  }

  return canon;
}

/**
 * Build character description for image prompts
 */
export function buildCharacterDescription(avatarName: string): string {
  const canon = getAvatarCanon(avatarName);
  return `${canon.name} (${canon.hair}, ${canon.eyes}, ${canon.clothing})`;
}

/**
 * Build visual distinction warning
 */
export function buildVisualDistinctionWarning(avatarNames: string[]): string {
  if (avatarNames.length < 2) return "";

  const canons = avatarNames.map(name => getAvatarCanon(name));

  return `
CRITICAL: ${avatarNames.join(' and ')} must look VISUALLY DIFFERENT!
${canons.map(canon =>
  `- ${canon.name}: ${canon.hair.split(',')[0]} hair + ${canon.eyes.split(',')[0]} eyes + ${canon.clothing.split(',')[0]}`
).join('\n')}
- Different hair colors, eye colors, clothing colors!
- Do NOT make them look similar or identical!`;
}
