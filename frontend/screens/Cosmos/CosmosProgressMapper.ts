/**
 * CosmosProgressMapper.ts - Maps learning progress to planet visuals
 *
 * Deterministic mapping: every visual change reflects real learning status.
 * No random/fake effects.
 */

import type { DomainProgress, PlanetVisuals, LearningStage } from './CosmosTypes';

/**
 * Compute stage from mastery + confidence thresholds.
 */
export function computeStage(mastery: number, confidence: number): LearningStage {
  if (mastery >= 80 && confidence >= 65) return 'mastered';
  if (mastery >= 55 && confidence >= 40) return 'can_explain';
  if (mastery >= 25 && confidence >= 15) return 'understood';
  return 'discovered';
}

/**
 * Map DomainProgress → PlanetVisuals
 *
 * Scale:        0.6 (no progress) → 1.4 (mastered)
 * Emissive:     0.05 (dim) → 1.5 (bright glow)
 * Atmosphere:   appears at "understood"
 * Ring:         appears at "can_explain"
 * Satellites:   appear at "mastered"
 * Orbit stability: low confidence = more wobble
 */
export function mapProgressToVisuals(progress: DomainProgress): PlanetVisuals {
  const { mastery, confidence, stage } = progress;

  // Normalize 0–100 → 0–1
  const m = Math.min(mastery, 100) / 100;
  const c = Math.min(confidence, 100) / 100;

  return {
    scale: 0.6 + m * 0.8,
    emissiveIntensity: 0.05 + c * 1.45,
    hasAtmosphere: stage !== 'discovered',
    hasRing: stage === 'can_explain' || stage === 'mastered',
    hasSatellites: stage === 'mastered',
    atmosphereOpacity: stage === 'discovered' ? 0 : 0.15 + m * 0.35,
    orbitStability: 0.3 + c * 0.7,
  };
}

/**
 * Stage label for HUD
 */
export function getStageLabel(stage: LearningStage): string {
  const labels: Record<LearningStage, string> = {
    discovered: 'Entdeckt',
    understood: 'Verstanden',
    can_explain: 'Kann ich erklären',
    mastered: 'Sitzt wirklich',
  };
  return labels[stage];
}

/**
 * Stage color for UI indicators
 */
export function getStageColor(stage: LearningStage): string {
  const colors: Record<LearningStage, string> = {
    discovered: '#94a3b8',   // slate
    understood: '#60a5fa',   // blue
    can_explain: '#a78bfa',  // purple
    mastered: '#facc15',     // gold
  };
  return colors[stage];
}
