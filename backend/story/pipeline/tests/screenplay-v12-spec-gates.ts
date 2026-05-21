/**
 * Smoke test for screenplay-first-v12 practical potential gates.
 *
 * Run: bun run backend/story/pipeline/tests/screenplay-v12-spec-gates.ts
 *
 * The old 8.6-8.8 premium idea gate starved real production runs before a
 * draft could be written. These tests lock the current behavior: idea
 * generation uses a practical 8.0 floor, while later story-quality gates decide
 * release readiness.
 */

import assert from "assert";
import {
  potentialGateFailures,
  PREMIUM_POTENTIAL_THRESHOLDS,
  EFFICIENT_POTENTIAL_THRESHOLDS,
  type CandidatePotentialScoresShape,
} from "../potential-thresholds";

type CS = Partial<CandidatePotentialScoresShape>;

const strongCandidateScores: CS = {
  childRetellableHook: 9.0,
  visualShelfAppeal: 8.8,
  novelty: 9.0,
  emotionalEngine: 8.9,
  personalCostPotential: 8.9,
  irreversibleMiddlePotential: 9.0,
  conflictEscalationPotential: 8.9,
  finalImagePotential: 8.8,
  helperDependencyRisk: 5.0,
  similarityToRecentEmotionalMechanics: 5.0,
};

const weakNoveltyCandidate: CS = {
  ...strongCandidateScores,
  novelty: 7.9,
};

const borderlineCandidate: CS = {
  childRetellableHook: 8.0,
  visualShelfAppeal: 8.0,
  novelty: 8.0,
  emotionalEngine: 8.0,
  personalCostPotential: 8.0,
  irreversibleMiddlePotential: 8.0,
  conflictEscalationPotential: 8.0,
  finalImagePotential: 8.0,
  helperDependencyRisk: 6.9,
  similarityToRecentEmotionalMechanics: 6.9,
};

console.log("\n=== screenplay-v12 practical potential gates ===");

{
  assert.strictEqual(PREMIUM_POTENTIAL_THRESHOLDS.childRetellableHook, 8.0);
  assert.strictEqual(PREMIUM_POTENTIAL_THRESHOLDS.visualShelfAppeal, 8.0);
  assert.strictEqual(PREMIUM_POTENTIAL_THRESHOLDS.novelty, 8.0);
  assert.strictEqual(PREMIUM_POTENTIAL_THRESHOLDS.emotionalEngine, 8.0);
  assert.strictEqual(PREMIUM_POTENTIAL_THRESHOLDS.personalCostPotential, 8.0);
  assert.strictEqual(PREMIUM_POTENTIAL_THRESHOLDS.irreversibleMiddlePotential, 8.0);
  assert.strictEqual(PREMIUM_POTENTIAL_THRESHOLDS.conflictEscalationPotential, 8.0);
  assert.strictEqual(PREMIUM_POTENTIAL_THRESHOLDS.finalImagePotential, 8.0);
  assert.strictEqual(PREMIUM_POTENTIAL_THRESHOLDS.helperDependencyRiskMax, 7.0);
  assert.strictEqual(PREMIUM_POTENTIAL_THRESHOLDS.similarityToRecentEmotionalMechanicsMax, 7.0);
  assert.strictEqual(EFFICIENT_POTENTIAL_THRESHOLDS.novelty, 8.0);
  assert.strictEqual(EFFICIENT_POTENTIAL_THRESHOLDS.helperDependencyRiskMax, 7.0);
  console.log("  ok thresholds use practical 8.0 floor");
}

{
  const failures = potentialGateFailures(weakNoveltyCandidate, "premium");
  assert.ok(
    failures.some((f) => f.startsWith("novelty 7.9")),
    `expected premium to reject novelty=7.9, got: ${JSON.stringify(failures)}`,
  );
  console.log(`  ok novelty=7.9 rejects (${failures.length} failure(s))`);
}

{
  const candidate: CS = { ...strongCandidateScores, novelty: 8.4 };
  assert.deepStrictEqual(potentialGateFailures(candidate, "premium"), []);
  assert.deepStrictEqual(potentialGateFailures(candidate, "efficient"), []);
  console.log("  ok novelty=8.4 passes both modes");
}

{
  const premiumStrong = potentialGateFailures(strongCandidateScores, "premium");
  const efficientStrong = potentialGateFailures(strongCandidateScores, "efficient");
  assert.deepStrictEqual(premiumStrong, []);
  assert.deepStrictEqual(efficientStrong, []);
  console.log("  ok strong candidate passes both modes");
}

{
  const premium = potentialGateFailures(borderlineCandidate, "premium");
  const efficient = potentialGateFailures(borderlineCandidate, "efficient");
  assert.deepStrictEqual(premium, []);
  assert.deepStrictEqual(efficient, []);
  console.log("  ok all-8.0 candidate passes generation floor");
}

{
  const helperRiskCandidate: CS = {
    ...strongCandidateScores,
    helperDependencyRisk: 7.1,
  };
  const premium = potentialGateFailures(helperRiskCandidate, "premium");
  const efficient = potentialGateFailures(helperRiskCandidate, "efficient");
  assert.ok(
    premium.some((f) => f.startsWith("helperDependencyRisk")),
    `premium must reject helperDependencyRisk=7.1; got: ${JSON.stringify(premium)}`,
  );
  assert.ok(
    efficient.some((f) => f.startsWith("helperDependencyRisk")),
    `efficient must reject helperDependencyRisk=7.1; got: ${JSON.stringify(efficient)}`,
  );
  console.log("  ok helperDependencyRisk=7.1 rejects in both modes");
}

{
  const failures = potentialGateFailures(weakNoveltyCandidate);
  assert.ok(
    failures.some((f) => f.startsWith("novelty 7.9")),
    `default mode must still apply premium floor; got: ${JSON.stringify(failures)}`,
  );
  console.log("  ok default mode applies practical premium floor");
}

console.log("\nAll practical potential-gate tests passed.");
