/**
 * Avatar Portrait Generator
 *
 * Generates consistent portrait prompts for different scenarios and emotions.
 */

import type { StandardizedAvatarAnalysis } from "./avatar-analysis-schema";

/**
 * Avatar Portrait Generator Class
 */
export class AvatarPortraitGenerator {

  /**
   * Generate portrait prompt with emotion and pose
   */
  generatePortraitPrompt(
    canon: StandardizedAvatarAnalysis,
    emotion: 'happy' | 'sad' | 'surprised' | 'neutral' | 'excited',
    pose: 'standing' | 'sitting' | 'jumping' | 'waving' | 'thinking'
  ): string {

    const emotionDescriptors = {
      happy: "bright smile, sparkling eyes, open expression",
      sad: "downturned mouth, glistening eyes, soft expression",
      surprised: "wide eyes, open mouth, raised eyebrows",
      neutral: "calm expression, gentle gaze, relaxed features",
      excited: "huge grin, wide eyes, energetic expression"
    };

    const poseDescriptors = {
      standing: "standing upright, arms at sides, confident posture",
      sitting: "sitting cross-legged, hands on knees, comfortable pose",
      jumping: "mid-jump, arms raised, dynamic movement",
      waving: "waving with one hand, friendly gesture, welcoming pose",
      thinking: "hand on chin, thoughtful pose, contemplative stance"
    };

    return `
Axel Scheffler watercolor character portrait illustration with gentle gouache textures.

CHARACTER: ${canon.name}

TYPE: ${canon.type}, age ${canon.ageApprox}, ${canon.gender}

APPEARANCE:

Hair:
- ${canon.hair.length} ${canon.hair.texture} ${canon.hair.style}
- Color: ${canon.hair.color}

Eyes:
- ${canon.eyes.size} ${canon.eyes.shape} eyes
- Color: ${canon.eyes.color}
- Expression: ${canon.eyes.expression}

Face:
- ${canon.face.shape} face shape
- Skin: ${canon.face.skinTone}
- Features: ${canon.face.distinctiveFeatures.join(', ')}

Body:
- ${canon.body.build} build, ${canon.body.height} height
- Posture: ${canon.body.posture}

Clothing:
- ${canon.clothing.primary}
- ${canon.clothing.secondary}
- Colors: ${canon.clothing.colors.join(', ')}
- Style: ${canon.clothing.style}

EMOTION: ${emotionDescriptors[emotion]}

POSE: ${poseDescriptors[pose]}

STYLE:
- Axel Scheffler watercolor illustration
- Soft gouache textures
- Hand-drawn quality
- Warm pastel colors
- Gentle outlines
- Storybook character design

COMPOSITION:
- Full body portrait
- Centered character
- Simple gradient background
- Soft vignette
- Child-friendly proportions

QUALITY:
- High detail on face and expression
- Consistent with character canon
- Warm, inviting atmosphere
- Professional children's book quality
    `.trim();
  }
}

/**
 * Generate different portrait types
 */

// 1. AVATAR-ERSTELLUNG (Initial Portrait)
export function generateInitialPortrait(canon: StandardizedAvatarAnalysis): string {
  const generator = new AvatarPortraitGenerator();
  return generator.generatePortraitPrompt(canon, 'happy', 'standing');
}

// 2. STORY THUMBNAIL (Cover)
export function generateStoryThumbnail(
  canon: StandardizedAvatarAnalysis,
  storyMood: 'adventure' | 'mystery' | 'friendship' | 'funny'
): string {
  const generator = new AvatarPortraitGenerator();

  const emotions = {
    adventure: 'excited' as const,
    mystery: 'surprised' as const,
    friendship: 'happy' as const,
    funny: 'excited' as const
  };

  return generator.generatePortraitPrompt(canon, emotions[storyMood], 'waving');
}

// 3. MEMORY ILLUSTRATION (Erinnerungen)
export function generateMemoryPortrait(
  canon: StandardizedAvatarAnalysis,
  memoryEmotion: 'happy' | 'sad' | 'surprised'
): string {
  const generator = new AvatarPortraitGenerator();
  return generator.generatePortraitPrompt(canon, memoryEmotion, 'thinking');
}

// 4. ACTION PORTRAIT (für dynamische Szenen)
export function generateActionPortrait(
  canon: StandardizedAvatarAnalysis,
  action: 'running' | 'jumping' | 'crouching' | 'reaching' | 'hiding'
): string {
  const generator = new AvatarPortraitGenerator();

  const emotion = action === 'hiding' ? 'surprised' : 'excited';
  const pose = action as 'standing' | 'sitting' | 'jumping' | 'waving' | 'thinking';

  return generator.generatePortraitPrompt(canon, emotion, pose);
}

/**
 * Generate all portrait variations for an avatar
 */
export function generatePortraitSuite(canon: StandardizedAvatarAnalysis): {
  initial: string;
  thumbnails: Record<string, string>;
  memories: Record<string, string>;
  actions: Record<string, string>;
} {

  return {
    initial: generateInitialPortrait(canon),

    thumbnails: {
      adventure: generateStoryThumbnail(canon, 'adventure'),
      mystery: generateStoryThumbnail(canon, 'mystery'),
      friendship: generateStoryThumbnail(canon, 'friendship'),
      funny: generateStoryThumbnail(canon, 'funny')
    },

    memories: {
      happy: generateMemoryPortrait(canon, 'happy'),
      sad: generateMemoryPortrait(canon, 'sad'),
      surprised: generateMemoryPortrait(canon, 'surprised')
    },

    actions: {
      running: generateActionPortrait(canon, 'running'),
      jumping: generateActionPortrait(canon, 'jumping'),
      crouching: generateActionPortrait(canon, 'crouching'),
      reaching: generateActionPortrait(canon, 'reaching'),
      hiding: generateActionPortrait(canon, 'hiding')
    }
  };
}
