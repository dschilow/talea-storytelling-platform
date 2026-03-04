import type { DomainProgress, PlanetVisuals, LearningStage } from "./CosmosTypes";

export function computeStage(mastery: number, confidence: number): LearningStage {
  if (confidence >= 70 && mastery >= 55) return "retained";
  if (mastery >= 55 && confidence >= 40) return "apply";
  if (mastery >= 25 && confidence >= 15) return "understood";
  return "discovered";
}

function derivePlanetLevel(progress: DomainProgress): number {
  if (progress.planetLevel && Number.isFinite(progress.planetLevel)) {
    return Math.max(1, Math.min(50, Math.floor(progress.planetLevel)));
  }
  const fallbackScore = progress.mastery * 0.65 + progress.confidence * 0.35;
  return Math.max(1, Math.min(50, Math.floor(fallbackScore / 2) + 1));
}

export function mapProgressToVisuals(progress: DomainProgress): PlanetVisuals {
  const level = derivePlanetLevel(progress);
  const level01 = (level - 1) / 49;
  const mastery01 = clamp01(progress.mastery / 100);
  const confidence01 = clamp01(progress.confidence / 100);
  const stage = progress.stage;

  const stageMoonCount = level >= 41 ? 2 : level >= 21 ? 1 : 0;
  const hasRing = level >= 31;
  const ringOpacity = hasRing ? smoothstep(0, 1, (level - 31) / 19) * (0.22 + confidence01 * 0.36) : 0;
  const hasAtmosphere = level >= 2;
  const hasSatellites = level >= 21;
  const satelliteCount = level >= 41 ? 2 : level >= 21 ? 1 : 0;

  return {
    scale: 0.66 + smoothstep(0, 1, level01) * 0.58,
    emissiveIntensity: 0.08 + confidence01 * 1.28 + smoothstep(0.2, 1, level01) * 0.18,
    hasAtmosphere,
    hasRing,
    hasSatellites,
    stageMoonCount,
    atmosphereOpacity: hasAtmosphere ? 0.06 + level01 * 0.22 : 0.02,
    orbitStability: 0.4 + confidence01 * 0.6,
    developmentLevel: level01,
    ringOpacity,
    satelliteCount,
    cloudOpacity: 0.06 + mastery01 * 0.24,
    surfaceDetail: level >= 11 ? 0.32 + mastery01 * 0.68 : 0.22 + mastery01 * 0.35,
    auraOpacity: stage === "retained" ? 0.22 + confidence01 * 0.2 : 0.08 + confidence01 * 0.12,
    lifeSignalStrength: level >= 41 ? 1 : level >= 31 ? 0.75 : level >= 21 ? 0.52 : 0.22,
  };
}

export function getStageLabel(stage: LearningStage): string {
  const labels: Record<LearningStage, string> = {
    discovered: "Entdeckt",
    understood: "Verstanden",
    apply: "Anwenden",
    retained: "Sitzt wirklich",
  };
  return labels[stage];
}

export function getStageColor(stage: LearningStage): string {
  const colors: Record<LearningStage, string> = {
    discovered: "#94a3b8",
    understood: "#60a5fa",
    apply: "#22c55e",
    retained: "#f59e0b",
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

