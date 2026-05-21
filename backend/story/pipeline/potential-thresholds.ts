/**
 * v12 quality-mode potential thresholds for the idea-candidate gate.
 *
 * This module is intentionally Encore-free so smoke tests can import the gate
 * logic directly. The idea gate should filter clearly weak candidates, not
 * starve generation before a draft exists.
 */

export type DevModeQualityMode = "efficient" | "premium";

export interface PotentialThresholds {
  readonly childRetellableHook: number;
  readonly visualShelfAppeal: number;
  readonly novelty: number;
  readonly emotionalEngine: number;
  readonly personalCostPotential: number;
  readonly irreversibleMiddlePotential: number;
  readonly conflictEscalationPotential: number;
  readonly finalImagePotential: number;
  readonly helperDependencyRiskMax: number;
  readonly similarityToRecentEmotionalMechanicsMax: number;
}

/**
 * Efficient mode floor. Anything below 8.0 on core dramaturgy axes is usually
 * structurally weak: boilerplate novelty, no real personal stake, or no
 * child-retellable hook.
 */
export const EFFICIENT_POTENTIAL_THRESHOLDS: PotentialThresholds = {
  childRetellableHook: 8.0,
  visualShelfAppeal: 8.0,
  novelty: 8.0,
  emotionalEngine: 8.0,
  personalCostPotential: 8.0,
  irreversibleMiddlePotential: 8.0,
  conflictEscalationPotential: 8.0,
  finalImagePotential: 8.0,
  helperDependencyRiskMax: 7.0,
  similarityToRecentEmotionalMechanicsMax: 7.0,
};

/**
 * Premium generation floor. The previous 8.6-8.8 candidate gate blocked real
 * runs before drafting. Final story-quality and structural gates are the right
 * place to reject a weak story, so premium generation now uses the same
 * practical 8.0 floor.
 */
export const PREMIUM_POTENTIAL_THRESHOLDS: PotentialThresholds = {
  childRetellableHook: 8.0,
  visualShelfAppeal: 8.0,
  novelty: 8.0,
  emotionalEngine: 8.0,
  personalCostPotential: 8.0,
  irreversibleMiddlePotential: 8.0,
  conflictEscalationPotential: 8.0,
  finalImagePotential: 8.0,
  helperDependencyRiskMax: 7.0,
  similarityToRecentEmotionalMechanicsMax: 7.0,
};

export function getPotentialThresholds(mode: DevModeQualityMode | undefined): PotentialThresholds {
  return (mode || "premium") === "efficient"
    ? EFFICIENT_POTENTIAL_THRESHOLDS
    : PREMIUM_POTENTIAL_THRESHOLDS;
}

/**
 * Score shape the gate reads. Mirrors `CandidatePotentialScores` in
 * dev-mode-generation.ts; we keep a local minimal copy here so this module
 * stays free of the heavy pipeline-types graph.
 */
export interface CandidatePotentialScoresShape {
  childRetellableHook?: number;
  visualShelfAppeal?: number;
  novelty?: number;
  emotionalEngine?: number;
  personalCostPotential?: number;
  irreversibleMiddlePotential?: number;
  conflictEscalationPotential?: number;
  finalImagePotential?: number;
  helperDependencyRisk?: number;
  similarityToRecentEmotionalMechanics?: number;
}

/**
 * Returns the list of gate failures for a candidate under the given mode.
 * Empty array means the candidate passes the gate.
 */
export function potentialGateFailures(
  scores: Partial<CandidatePotentialScoresShape>,
  mode?: DevModeQualityMode,
): string[] {
  const failures: string[] = [];
  const t = getPotentialThresholds(mode);
  const read = (key: keyof CandidatePotentialScoresShape): number => {
    const value = Number(scores[key]);
    return Number.isFinite(value) ? value : 0;
  };

  if (read("childRetellableHook") < t.childRetellableHook) {
    failures.push(`childRetellableHook ${read("childRetellableHook").toFixed(1)} < ${t.childRetellableHook}`);
  }
  if (read("visualShelfAppeal") < t.visualShelfAppeal) {
    failures.push(`visualShelfAppeal ${read("visualShelfAppeal").toFixed(1)} < ${t.visualShelfAppeal}`);
  }
  if (read("novelty") < t.novelty) {
    failures.push(`novelty ${read("novelty").toFixed(1)} < ${t.novelty}`);
  }
  if (read("emotionalEngine") < t.emotionalEngine) {
    failures.push(`emotionalEngine ${read("emotionalEngine").toFixed(1)} < ${t.emotionalEngine}`);
  }
  if (read("personalCostPotential") < t.personalCostPotential) {
    failures.push(`personalCostPotential ${read("personalCostPotential").toFixed(1)} < ${t.personalCostPotential}`);
  }
  if (read("irreversibleMiddlePotential") < t.irreversibleMiddlePotential) {
    failures.push(`irreversibleMiddlePotential ${read("irreversibleMiddlePotential").toFixed(1)} < ${t.irreversibleMiddlePotential}`);
  }
  if (read("conflictEscalationPotential") < t.conflictEscalationPotential) {
    failures.push(`conflictEscalationPotential ${read("conflictEscalationPotential").toFixed(1)} < ${t.conflictEscalationPotential}`);
  }
  if (read("finalImagePotential") < t.finalImagePotential) {
    failures.push(`finalImagePotential ${read("finalImagePotential").toFixed(1)} < ${t.finalImagePotential}`);
  }
  if (read("helperDependencyRisk") > t.helperDependencyRiskMax) {
    failures.push(`helperDependencyRisk ${read("helperDependencyRisk").toFixed(1)} > ${t.helperDependencyRiskMax}`);
  }
  if (read("similarityToRecentEmotionalMechanics") > t.similarityToRecentEmotionalMechanicsMax) {
    failures.push(`similarityToRecentEmotionalMechanics ${read("similarityToRecentEmotionalMechanics").toFixed(1)} > ${t.similarityToRecentEmotionalMechanicsMax}`);
  }
  return failures;
}
