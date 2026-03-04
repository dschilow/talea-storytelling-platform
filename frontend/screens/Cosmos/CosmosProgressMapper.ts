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
  const development = clamp01(m * 0.68 + c * 0.32);
  const eased = smoothstep(0, 1, development);
  const ringProgress = smoothstep(0.72, 1.0, development);
  const lifeSignal = smoothstep(0.5, 1.0, development);
  const stageMoonCount = stage === 'mastered' ? 2 : stage === 'can_explain' ? 1 : 0;
  const bonusSatellites = stage === 'mastered' ? Math.min(2, Math.floor(lifeSignal * 2.2)) : 0;
  const satelliteCount = Math.min(3, bonusSatellites);
  const hasAtmosphere = stage !== 'discovered';
  const hasRing = stage === 'mastered';

  return {
    scale: 0.62 + m * 0.34 + eased * 0.26,
    emissiveIntensity: 0.06 + c * 1.35,
    hasAtmosphere,
    hasRing,
    hasSatellites: satelliteCount > 0,
    stageMoonCount,
    atmosphereOpacity:
      stage === 'discovered'
        ? 0.01 + eased * 0.04
        : stage === 'understood'
        ? 0.08 + eased * 0.12
        : 0.16 + eased * 0.2,
    orbitStability: 0.32 + c * 0.68,
    developmentLevel: development,
    ringOpacity: hasRing ? ringProgress * (0.24 + c * 0.42) : 0,
    satelliteCount,
    cloudOpacity: stage === 'discovered' ? 0.03 + m * 0.08 : 0.1 + smoothstep(0.15, 0.95, development) * 0.28,
    surfaceDetail: 0.22 + m * 0.78,
    auraOpacity:
      stage === 'discovered'
        ? 0.02 + c * 0.05
        : 0.06 + smoothstep(0.2, 1, c) * 0.24,
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
