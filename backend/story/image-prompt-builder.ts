/**
 * Image Prompt Builder
 *
 * Builds consistent image prompts using avatar canons for visual continuity.
 */

import type { AvatarCanon } from "../avatar/avatar-analysis-schema";

/**
 * Build image prompt for story chapters
 */
export function buildImagePrompt(
  scene: string,
  avatars: AvatarCanon[],
  environment: string,
  composition: string
): string {

  // 1. CHARACTERS BLOCK (DAS WICHTIGSTE!)
  // Format: [Visual Description] (Name: [CharacterName])
  // This separates the visual tokens from the name tokens to prevent "name bleeding"
  const charactersBlock = avatars.map((avatar, index) => {
    const visualDesc = `${avatar.hair.color} hair, ${avatar.eyes.color} eyes, ${avatar.clothing.primary}`;
    return `${visualDesc} (Name: ${avatar.name})`;
  }).join('\n\n');

  // 2. KRITISCHE UNTERSCHEIDUNG
  const distinctions = avatars.map(a =>
    `${a.name}: ${a.hair.color} hair + ${a.eyes.color} eyes + ${a.clothing.primary}`
  ).join('\n- ');

  // 3. FINALER PROMPT
  return `
Axel Scheffler watercolor storybook illustration with gentle gouache textures.
${environment}
${composition}
SCENE: ${scene}

CHARACTERS:
${charactersBlock}

CRITICAL: ${avatars.map(a => a.name).join(' and ')} must look VISUALLY DIFFERENT!
- ${distinctions}

Style: warm colors, child-friendly, hand-painted feel.
  `.trim();
}

/**
 * Image Prompt Builder Class
 */
export class ImagePromptBuilder {

  constructor(
    private avatarCanons: Map<string, AvatarCanon>,
    private style: string = "Axel Scheffler watercolor"
  ) { }

  /**
   * Generate chapter prompt
   */
  generateChapterPrompt(
    chapterNumber: number,
    sceneDescription: string,
    avatarNames: string[],
    avatarPoses: Record<string, string>,
    environment: string,
    composition: string
  ): string {

    // Hole Avatar-Kanons
    const avatars = avatarNames.map(name => {
      const canon = this.avatarCanons.get(name);
      if (!canon) throw new Error(`Avatar ${name} not found in canon!`);
      return { ...canon, pose: avatarPoses[name] };
    });

    // Generiere Prompt mit Template
    return buildImagePrompt(
      sceneDescription,
      avatars,
      environment,
      composition
    );
  }

  /**
   * Validate prompt quality
   */
  validatePrompt(prompt: string): { isValid: boolean; missing: string[] } {
    const required = [
      'hair:.*color',
      'eyes:.*color',
      'clothing',
      'positioned (LEFT|RIGHT)',
      'CRITICAL.*DIFFERENT'
    ];

    const missing: string[] = [];

    for (const pattern of required) {
      if (!new RegExp(pattern, 'i').test(prompt)) {
        missing.push(pattern);
      }
    }

    return {
      isValid: missing.length === 0,
      missing
    };
  }
}

/**
 * Prompt quality check interface
 */
export interface PromptQualityCheck {
  hasAvatarDetails: boolean;
  hasDistinctionWarning: boolean;
  hasClearPositions: boolean;
  hasEnvironment: boolean;
  hasComposition: boolean;
  score: number;
}

/**
 * Validate image prompt quality
 */
export function validateImagePromptQuality(prompt: string): PromptQualityCheck {

  const checks = {
    hasAvatarDetails: /hair:.*eyes:.*clothing:/i.test(prompt),
    hasDistinctionWarning: /CRITICAL.*DIFFERENT/i.test(prompt),
    hasClearPositions: /(LEFT|RIGHT).*side of frame/i.test(prompt),
    hasEnvironment: /ENVIRONMENT:/i.test(prompt),
    hasComposition: /COMPOSITION:/i.test(prompt)
  };

  const score = Object.values(checks).filter(Boolean).length / 5 * 10;

  return { ...checks, score };
}
