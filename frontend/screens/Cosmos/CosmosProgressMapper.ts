/**
 * CosmosProgressMapper.ts - Maps learning progress to planet visuals.
 *
 * Deterministic mapping: every visual change reflects real learning status.
 * Uses continuous progression, not only coarse stage thresholds.
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
 * Map DomainProgress -> PlanetVisuals.
 *
 * - A blended development score controls continuous visual evolution.
 * - Stage still controls semantic UI labels, but visuals evolve smoothly.
 */
export function mapProgressToVisuals(progress: DomainProgress): PlanetVisuals {
  const { mastery, confidence, stage } = progress;

  const m = clamp01(mastery / 100);
  const c = clamp01(confidence / 100);
  const development = clamp01(m * 0.64 + c * 0.36);
  const eased = smoothstep(0, 1, development);
  const ringProgress = smoothstep(0.35, 0.95, development);
  const lifeSignal = smoothstep(0.5, 1.0, development);
  const satelliteCount = Math.min(5, Math.floor(lifeSignal * 5));

  return {
    scale: 0.58 + eased * 0.92,
    emissiveIntensity: 0.08 + c * 1.6,
    hasAtmosphere: stage !== 'discovered',
    hasRing: ringProgress > 0.06,
    hasSatellites: satelliteCount > 0,
    atmosphereOpacity: stage === 'discovered' ? 0.02 + eased * 0.08 : 0.12 + eased * 0.3,
    orbitStability: 0.25 + c * 0.75,
    developmentLevel: development,
    ringOpacity: ringProgress * (0.22 + c * 0.35),
    satelliteCount,
    cloudOpacity: 0.05 + smoothstep(0.15, 0.9, development) * 0.34,
    surfaceDetail: 0.25 + m * 0.75,
    auraOpacity: 0.04 + smoothstep(0.2, 1, development) * 0.26,
    lifeSignalStrength: lifeSignal,
  };
}

/**
 * Stage label for HUD.
 */
export function getStageLabel(stage: LearningStage): string {
  const labels: Record<LearningStage, string> = {
    discovered: 'Entdeckt',
    understood: 'Verstanden',
    can_explain: 'Kann ich erklaeren',
    mastered: 'Sitzt wirklich',
  };
  return labels[stage];
}

/**
 * Stage color for UI indicators.
 */
export function getStageColor(stage: LearningStage): string {
  const colors: Record<LearningStage, string> = {
    discovered: '#94a3b8',
    understood: '#60a5fa',
    can_explain: '#a78bfa',
    mastered: '#facc15',
  };
  return colors[stage];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(min: number, max: number, value: number): number {
  if (value <= min) return 0;
  if (value >= max) return 1;
  const t = (value - min) / (max - min);
  return t * t * (3 - 2 * t);
}
