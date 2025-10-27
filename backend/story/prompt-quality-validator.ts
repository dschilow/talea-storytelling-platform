/**
 * Prompt Quality Validator
 *
 * Comprehensive validation for image prompts before generation.
 */

import { validateImagePromptQuality } from "./image-prompt-builder";

/**
 * Extended quality check for production use
 */
export interface ExtendedPromptQualityCheck {
  // Basic checks
  hasAvatarDetails: boolean;
  hasDistinctionWarning: boolean;
  hasClearPositions: boolean;
  hasEnvironment: boolean;
  hasComposition: boolean;

  // Advanced checks
  hasVisualConsistency: boolean;
  hasStyleDefinition: boolean;
  hasMoodSpecification: boolean;
  hasQualityIndicators: boolean;

  // Technical checks
  promptLength: number;
  hasExcessiveTokens: boolean;
  hasRedundantPhrases: boolean;

  // Content checks
  avatarCount: number;
  sceneComplexity: 'low' | 'medium' | 'high';

  // Overall score
  score: number;
  recommendations: string[];
}

/**
 * Validate prompt quality with extended checks
 */
export function validatePromptQualityExtended(prompt: string): ExtendedPromptQualityCheck {
  const basic = validateImagePromptQuality(prompt);

  // Advanced checks
  const hasVisualConsistency = /must look.*DIFFERENT|different.*color|different.*hair|different.*eye/i.test(prompt);
  const hasStyleDefinition = /watercolor|gouache|illustration|storybook/i.test(prompt);
  const hasMoodSpecification = /mood|atmosphere|feeling|tone/i.test(prompt);
  const hasQualityIndicators = /high detail|professional|consistent|quality/i.test(prompt);

  // Technical checks
  const promptLength = prompt.length;
  const hasExcessiveTokens = promptLength > 2000; // Runware limit consideration
  const hasRedundantPhrases = (prompt.match(/\b(the|a|and|or|but|with)\b/gi) || []).length > 50;

  // Content analysis
  const avatarCount = (prompt.match(/\b(LEFT|RIGHT).*side of frame/g) || []).length;
  const sceneComplexity = determineSceneComplexity(prompt);

  // Calculate score
  let score = basic.score;
  if (hasVisualConsistency) score += 1;
  if (hasStyleDefinition) score += 0.5;
  if (hasMoodSpecification) score += 0.5;
  if (hasQualityIndicators) score += 0.5;
  if (!hasExcessiveTokens) score += 0.5;
  if (!hasRedundantPhrases) score += 0.5;

  score = Math.min(10.0, score);

  // Generate recommendations
  const recommendations: string[] = [];
  if (!basic.hasAvatarDetails) recommendations.push("Add detailed avatar descriptions (hair, eyes, clothing)");
  if (!basic.hasDistinctionWarning) recommendations.push("Add visual distinction warning between avatars");
  if (!basic.hasClearPositions) recommendations.push("Specify clear left/right positioning");
  if (!hasVisualConsistency) recommendations.push("Ensure avatars look visually different");
  if (!hasStyleDefinition) recommendations.push("Add art style specification");
  if (hasExcessiveTokens) recommendations.push("Prompt is too long, consider shortening");
  if (hasRedundantPhrases) recommendations.push("Remove redundant phrases");

  return {
    ...basic,
    hasVisualConsistency,
    hasStyleDefinition,
    hasMoodSpecification,
    hasQualityIndicators,
    promptLength,
    hasExcessiveTokens,
    hasRedundantPhrases,
    avatarCount,
    sceneComplexity,
    score,
    recommendations
  };
}

/**
 * Determine scene complexity
 */
function determineSceneComplexity(prompt: string): 'low' | 'medium' | 'high' {
  const complexityIndicators = prompt.match(/complex|detailed|multiple|various|different|several|many|crowded|busy/gi) || [];

  if (complexityIndicators.length > 3) return 'high';
  if (complexityIndicators.length > 1) return 'medium';
  return 'low';
}

/**
 * Validate multiple prompts as a batch
 */
export function validatePromptBatch(prompts: string[]): {
  averageScore: number;
  allValid: boolean;
  issues: Array<{
    promptIndex: number;
    score: number;
    issues: string[];
  }>;
  recommendations: string[];
} {
  const results = prompts.map((prompt, index) => {
    const validation = validatePromptQualityExtended(prompt);
    return {
      promptIndex: index,
      score: validation.score,
      issues: validation.recommendations
    };
  });

  const averageScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  const allValid = results.every(r => r.score >= 8.0);

  // Collect common issues
  const issueCounts = new Map<string, number>();
  results.forEach(r => {
    r.issues.forEach(issue => {
      issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1);
    });
  });

  const commonIssues = Array.from(issueCounts.entries())
    .filter(([_, count]) => count > prompts.length / 2)
    .map(([issue, _]) => issue);

  return {
    averageScore: Math.round(averageScore * 10) / 10,
    allValid,
    issues: results.filter(r => r.score < 8.0),
    recommendations: commonIssues
  };
}

/**
 * Auto-fix common prompt issues
 */
export function autoFixPromptIssues(prompt: string): string {
  let fixed = prompt;

  // Add style if missing
  if (!/watercolor|gouache|illustration|storybook/i.test(fixed)) {
    fixed = fixed.replace(
      /Axel Scheffler/,
      "Axel Scheffler watercolor storybook illustration with gentle gouache textures"
    );
  }

  // Add quality indicators if missing
  if (!/high detail|professional|consistent|quality/i.test(fixed)) {
    fixed = fixed.replace(
      /COMPOSITION:/,
      "COMPOSITION:\n\nQUALITY:\n- High detail on face and expression\n- Consistent with character canon\n- Warm, inviting atmosphere\n- Professional children's book quality"
    );
  }

  // Add distinction warning if missing
  if (!/must look.*DIFFERENT|different.*color|different.*hair|different.*eye/i.test(fixed)) {
    fixed = fixed.replace(
      /ENVIRONMENT:/,
      `CRITICAL: Characters must look VISUALLY DIFFERENT!
- Different hair colors, eye colors, clothing colors!
- Do NOT make them look similar or identical!

ENVIRONMENT:`
    );
  }

  return fixed;
}
