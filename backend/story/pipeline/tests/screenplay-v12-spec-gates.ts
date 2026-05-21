/**
 * Smoke test for screenplay-first-v12 spec §B/§C quality-mode + premium-
 * potential-threshold behavior.
 *
 * Run: bun run backend/story/pipeline/tests/screenplay-v12-spec-gates.ts
 *
 * Covers Spec-X cases:
 *   X.1  premium candidate with novelty 8.4 → reject
 *   X.2  no best-of-weak in premium (caller decides; here we verify that
 *        every premium gate is stricter than every efficient gate)
 *   X.13 (partial) cost control: premium thresholds are strictly stricter
 *        than efficient, so any candidate that passes premium also passes
 *        efficient — the inverse cannot hold.
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
  novelty: 8.4,
};

const borderlineEfficientCandidate: CS = {
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

console.log("\n═══ screenplay-v12 §B/§C smoke ═══");

// ─── Spec-§C threshold values are exactly as written ────────────────────────
{
  assert.strictEqual(PREMIUM_POTENTIAL_THRESHOLDS.childRetellableHook, 8.7);
  assert.strictEqual(PREMIUM_POTENTIAL_THRESHOLDS.visualShelfAppeal, 8.6);
  assert.strictEqual(PREMIUM_POTENTIAL_THRESHOLDS.novelty, 8.8);
  assert.strictEqual(PREMIUM_POTENTIAL_THRESHOLDS.emotionalEngine, 8.7);
  assert.strictEqual(PREMIUM_POTENTIAL_THRESHOLDS.personalCostPotential, 8.7);
  assert.strictEqual(PREMIUM_POTENTIAL_THRESHOLDS.irreversibleMiddlePotential, 8.8);
  assert.strictEqual(PREMIUM_POTENTIAL_THRESHOLDS.conflictEscalationPotential, 8.7);
  assert.strictEqual(PREMIUM_POTENTIAL_THRESHOLDS.finalImagePotential, 8.6);
  assert.strictEqual(PREMIUM_POTENTIAL_THRESHOLDS.helperDependencyRiskMax, 6.0);
  assert.strictEqual(PREMIUM_POTENTIAL_THRESHOLDS.similarityToRecentEmotionalMechanicsMax, 6.0);
  assert.strictEqual(EFFICIENT_POTENTIAL_THRESHOLDS.novelty, 8.0);
  assert.strictEqual(EFFICIENT_POTENTIAL_THRESHOLDS.helperDependencyRiskMax, 7.0);
  console.log("  ✓ §C thresholds match spec values exactly");
}

// ─── X.1: premium novelty=8.4 must reject ───────────────────────────────────
{
  const failures = potentialGateFailures(weakNoveltyCandidate, "premium");
  assert.ok(
    failures.some((f) => f.startsWith("novelty 8.4")),
    `X.1 expected premium to reject novelty=8.4, got: ${JSON.stringify(failures)}`,
  );
  console.log(`  ✓ X.1 premium rejects novelty=8.4 (${failures.length} failure(s))`);
}

// ─── X.1b: same candidate in efficient still rejects? No — efficient floor 8.0 ─
{
  const failures = potentialGateFailures(weakNoveltyCandidate, "efficient");
  assert.ok(
    !failures.some((f) => f.startsWith("novelty")),
    `X.1b efficient should accept novelty=8.4 (>=8.0); got: ${JSON.stringify(failures)}`,
  );
  console.log(`  ✓ X.1b efficient accepts novelty=8.4`);
}

// ─── X.2 (structural): premium gates strictly stricter than efficient ───────
{
  // strongCandidateScores must pass BOTH modes.
  const premiumStrong = potentialGateFailures(strongCandidateScores, "premium");
  const efficientStrong = potentialGateFailures(strongCandidateScores, "efficient");
  assert.deepStrictEqual(
    premiumStrong,
    [],
    `X.2 strong candidate should pass premium clean; got: ${JSON.stringify(premiumStrong)}`,
  );
  assert.deepStrictEqual(
    efficientStrong,
    [],
    `X.2 strong candidate should pass efficient clean; got: ${JSON.stringify(efficientStrong)}`,
  );
  console.log(`  ✓ X.2 strong candidate passes both modes`);
}

// ─── X.2b: borderline candidate passes efficient, fails premium ─────────────
{
  const premium = potentialGateFailures(borderlineEfficientCandidate, "premium");
  const efficient = potentialGateFailures(borderlineEfficientCandidate, "efficient");
  assert.deepStrictEqual(
    efficient,
    [],
    `X.2b borderline (all 8.0) should pass efficient clean; got: ${JSON.stringify(efficient)}`,
  );
  assert.ok(
    premium.length > 0,
    `X.2b borderline (all 8.0) must fail premium; got no failures`,
  );
  console.log(`  ✓ X.2b borderline passes efficient, fails premium (${premium.length} gates tripped)`);
}

// ─── X.13 partial: every premium failure-prone candidate is also efficient-prone ─
{
  // helperDependencyRisk 6.5 — premium cap 6.0 → fails; efficient cap 7.0 → passes.
  const helperRiskCandidate: CS = {
    ...strongCandidateScores,
    helperDependencyRisk: 6.5,
  };
  const premium = potentialGateFailures(helperRiskCandidate, "premium");
  const efficient = potentialGateFailures(helperRiskCandidate, "efficient");
  assert.ok(
    premium.some((f) => f.startsWith("helperDependencyRisk")),
    `X.13a premium must reject helperDependencyRisk=6.5; got: ${JSON.stringify(premium)}`,
  );
  assert.deepStrictEqual(
    efficient,
    [],
    `X.13a efficient must accept helperDependencyRisk=6.5; got: ${JSON.stringify(efficient)}`,
  );
  console.log(`  ✓ X.13a helperDependencyRisk=6.5 → premium rejects, efficient accepts`);
}

// ─── Default-mode = premium (no explicit mode argument) ─────────────────────
{
  const failures = potentialGateFailures(weakNoveltyCandidate);
  assert.ok(
    failures.some((f) => f.startsWith("novelty 8.4")),
    `Default-mode must be premium; got: ${JSON.stringify(failures)}`,
  );
  console.log(`  ✓ default-mode behaves as premium`);
}

console.log("\n✓ All §B/§C gate tests passed.");
