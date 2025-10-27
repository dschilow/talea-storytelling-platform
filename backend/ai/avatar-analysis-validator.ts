/**
 * Avatar Analysis Validation
 *
 * Validates standardized avatar analysis for quality and completeness.
 */

import type { StandardizedAvatarAnalysis } from "../avatar/avatar-analysis-schema";

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  score: number; // 0-10
}

/**
 * Validate avatar analysis for completeness and quality
 */
export function validateAvatarAnalysis(
  analysis: StandardizedAvatarAnalysis
): ValidationResult {

  const issues: string[] = [];

  // 1. Type muss konsistent sein
  if (!['human child', 'elf child', 'fantasy creature'].includes(analysis.type)) {
    issues.push(`Invalid type: ${analysis.type}`);
  }

  // 2. Alle Haar-Details
  if (!analysis.hair.color || analysis.hair.color.length < 10) {
    issues.push('Hair color too vague');
  }
  if (!analysis.hair.style || analysis.hair.style.length < 10) {
    issues.push('Hair style too vague');
  }
  if (!['short', 'medium', 'long'].includes(analysis.hair.length)) {
    issues.push('Invalid hair length');
  }
  if (!['straight', 'wavy', 'curly', 'kinky'].includes(analysis.hair.texture)) {
    issues.push('Invalid hair texture');
  }

  // 3. Augen-Details
  if (!analysis.eyes.color || analysis.eyes.color.length < 5) {
    issues.push('Eye color too vague');
  }
  if (!['round', 'almond', 'wide', 'narrow'].includes(analysis.eyes.shape)) {
    issues.push('Invalid eye shape');
  }
  if (!['small', 'medium', 'large'].includes(analysis.eyes.size)) {
    issues.push('Invalid eye size');
  }
  if (!analysis.eyes.expression || analysis.eyes.expression.length < 5) {
    issues.push('Eye expression missing or too vague');
  }

  // 4. Gesichts-Details
  if (!['round', 'oval', 'square', 'heart'].includes(analysis.face.shape)) {
    issues.push('Invalid face shape');
  }
  if (!analysis.face.skinTone || analysis.face.skinTone.length < 10) {
    issues.push('Skin tone too vague');
  }
  if (analysis.face.distinctiveFeatures.length < 3) {
    issues.push('Need at least 3 distinctive facial features');
  }

  // 5. Körper-Details
  if (!['slim', 'average', 'sturdy'].includes(analysis.body.build)) {
    issues.push('Invalid body build');
  }
  if (!['short', 'average', 'tall'].includes(analysis.body.height)) {
    issues.push('Invalid body height');
  }
  if (!analysis.body.posture || analysis.body.posture.length < 10) {
    issues.push('Body posture too vague');
  }

  // 6. Kleidung
  if (!analysis.clothing.primary || analysis.clothing.primary.length < 5) {
    issues.push('Primary clothing missing or too vague');
  }
  if (!['casual', 'formal', 'fantasy', 'sporty'].includes(analysis.clothing.style)) {
    issues.push('Invalid clothing style');
  }
  if (analysis.clothing.colors.length < 1) {
    issues.push('No clothing colors specified');
  }

  // 7. Emotional Triggers (NEU!)
  const emotionCounts = [
    analysis.emotionalTriggers.joy.length,
    analysis.emotionalTriggers.fear.length,
    analysis.emotionalTriggers.anger.length,
    analysis.emotionalTriggers.sadness.length
  ];
  if (Math.min(...emotionCounts) < 2) {
    issues.push('Each emotion needs at least 2 triggers');
  }

  // 8. Action Patterns (NEU!)
  const actionCounts = [
    analysis.typicalActions.movement.length,
    analysis.typicalActions.speech.length,
    analysis.typicalActions.interaction.length
  ];
  if (Math.min(...actionCounts) < 3) {
    issues.push('Each action type needs at least 3 examples');
  }

  // 9. Canon Descriptors
  if (!analysis.canonDescriptors.short || analysis.canonDescriptors.short.split(' ').length > 15) {
    issues.push('Short descriptor missing or too long (max 15 words)');
  }
  if (!analysis.canonDescriptors.medium || analysis.canonDescriptors.medium.split(' ').length > 35) {
    issues.push('Medium descriptor too long (max 35 words)');
  }
  if (!analysis.canonDescriptors.long || analysis.canonDescriptors.long.split(' ').length < 20) {
    issues.push('Long descriptor too short (min 20 words)');
  }

  // Calculate score
  const totalChecks = 25; // Approximate number of validation points
  const passedChecks = totalChecks - issues.length;
  const score = Math.round((passedChecks / totalChecks) * 10 * 10) / 10; // Round to 1 decimal

  return {
    isValid: issues.length === 0,
    issues,
    score
  };
}

/**
 * Auto-fix common issues in avatar analysis
 */
export function autoFixAvatarAnalysis(
  analysis: StandardizedAvatarAnalysis
): StandardizedAvatarAnalysis {

  const fixed = { ...analysis };

  // Fix hair defaults
  if (!fixed.hair.texture) {
    fixed.hair.texture = "wavy";
  }
  if (!fixed.hair.length) {
    fixed.hair.length = "medium";
  }

  // Fix eye defaults
  if (!fixed.eyes.shape) {
    fixed.eyes.shape = "round";
  }
  if (!fixed.eyes.size) {
    fixed.eyes.size = "medium";
  }
  if (!fixed.eyes.expression) {
    fixed.eyes.expression = "neutral";
  }

  // Fix face defaults
  if (!fixed.face.shape) {
    fixed.face.shape = "oval";
  }
  if (fixed.face.distinctiveFeatures.length < 3) {
    fixed.face.distinctiveFeatures = [
      ...fixed.face.distinctiveFeatures,
      "smooth complexion",
      "youthful features"
    ].slice(0, 3);
  }

  // Fix body defaults
  if (!fixed.body.build) {
    fixed.body.build = "average";
  }
  if (!fixed.body.height) {
    fixed.body.height = "average";
  }
  if (!fixed.body.posture) {
    fixed.body.posture = "natural and relaxed";
  }

  // Fix clothing defaults
  if (!fixed.clothing.secondary) {
    fixed.clothing.secondary = "";
  }
  if (!fixed.clothing.style) {
    fixed.clothing.style = "casual";
  }
  if (fixed.clothing.colors.length === 0) {
    fixed.clothing.colors = [fixed.clothing.primary.split(' ')[0] || "blue"];
  }

  // Fix emotional triggers
  if (fixed.emotionalTriggers.joy.length < 2) {
    fixed.emotionalTriggers.joy = [
      ...fixed.emotionalTriggers.joy,
      "playing with friends",
      "discovering new things"
    ].slice(0, 3);
  }
  if (fixed.emotionalTriggers.fear.length < 2) {
    fixed.emotionalTriggers.fear = [
      ...fixed.emotionalTriggers.fear,
      "dark places",
      "being alone"
    ].slice(0, 3);
  }
  if (fixed.emotionalTriggers.anger.length < 2) {
    fixed.emotionalTriggers.anger = [
      ...fixed.emotionalTriggers.anger,
      "unfairness",
      "broken promises"
    ].slice(0, 3);
  }
  if (fixed.emotionalTriggers.sadness.length < 2) {
    fixed.emotionalTriggers.sadness = [
      ...fixed.emotionalTriggers.sadness,
      "letting others down",
      "feeling left out"
    ].slice(0, 3);
  }

  // Fix action patterns
  if (fixed.typicalActions.movement.length < 3) {
    fixed.typicalActions.movement = [
      ...fixed.typicalActions.movement,
      "quick movements",
      "energetic gestures",
      "spontaneous actions"
    ].slice(0, 3);
  }
  if (fixed.typicalActions.speech.length < 3) {
    fixed.typicalActions.speech = [
      ...fixed.typicalActions.speech,
      "clear pronunciation",
      "varied intonation",
      "friendly tone"
    ].slice(0, 3);
  }
  if (fixed.typicalActions.interaction.length < 3) {
    fixed.typicalActions.interaction = [
      ...fixed.typicalActions.interaction,
      "friendly smiles",
      "open body language",
      "helpful gestures"
    ].slice(0, 3);
  }

  return fixed;
}
