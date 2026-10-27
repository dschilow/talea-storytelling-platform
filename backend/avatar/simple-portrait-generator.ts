/**
 * Simple Avatar Portrait Generator
 *
 * Quick-fix implementation: Simple portrait prompts for consistent avatar images.
 * Based on the 5.7→10.0 optimization guide.
 */

import { TALEA_IMAGE_STYLE } from "../ai/image-style";

/**
 * Generate portrait prompt for avatar
 */
export function generatePortraitPrompt(
  avatar: string,
  emotion: 'happy' | 'sad' | 'surprised' | 'neutral' | 'thinking',
  pose: 'standing' | 'sitting' | 'jumping' | 'waving'
): string {

  const canons = {
    alexander: {
      hair: "chestnut-brown curly",
      eyes: "warm amber",
      clothing: "green hoodie"
    },
    adrian: {
      hair: "golden-blonde spiky",
      eyes: "sky-blue",
      clothing: "blue jacket"
    }
  };

  const emotions = {
    happy: "huge smile, sparkling eyes, open expression",
    sad: "downturned mouth, gentle eyes, soft expression",
    surprised: "wide eyes, open mouth, raised eyebrows",
    neutral: "calm expression, gentle gaze, relaxed",
    thinking: "hand on chin, thoughtful pose, contemplative"
  };

  const poses = {
    standing: "standing upright, arms at sides, confident",
    sitting: "sitting cross-legged, hands on knees",
    jumping: "mid-jump, arms raised, dynamic",
    waving: "waving with one hand, friendly gesture",
    thinking: "hand on chin, thoughtful pose, contemplative"
  };

  const canon = canons[avatar.toLowerCase()];

  if (!canon) {
    throw new Error(`Unknown avatar: ${avatar}`);
  }

  return `
${TALEA_IMAGE_STYLE}.

CHARACTER: ${avatar}

APPEARANCE:
- Hair: ${canon.hair}
- Eyes: ${canon.eyes}
- Clothing: ${canon.clothing}

EMOTION: ${emotions[emotion]}
POSE: ${poses[pose]}

COMPOSITION: One full-body portrait on a plain warm ivory background.
  `.trim();
}

// Beispiel:
// generatePortraitPrompt("Alexander", "happy", "standing");
// generatePortraitPrompt("Adrian", "thinking", "sitting");
