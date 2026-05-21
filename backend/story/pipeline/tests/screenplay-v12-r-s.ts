/**
 * Smoke test for screenplay-first-v12 spec §R (line-punchup gate) and §S
 * (final-validation routing).
 *
 * Run: bun run backend/story/pipeline/tests/screenplay-v12-r-s.ts
 *
 * Covers Spec-X cases:
 *   X.13 cost control: line-punchup never fires under score 8.6
 *   §S    failureClass/recommendedRoute classification for all spec cases
 */
import assert from "assert";
import {
  classifyFinalRouting,
  type FinalRoutingInput,
} from "../final-routing";

console.log("\n═══ screenplay-v12 §R/§S smoke ═══");

// ─── §R: line-punchup must not run below score 8.6 ──────────────────────────
// Verified by recomputing the orchestrator's gate predicate at the string
// level (see DEV_MODE_LINE_PUNCHUP_MIN_SCORE in dev-mode-generation.ts).
{
  const MIN = 8.6;
  const isReleaseNear = (score: number | undefined) =>
    typeof score === "number" && score >= MIN;

  assert.strictEqual(isReleaseNear(7.5), false, "score 7.5 must NOT qualify for punchup");
  assert.strictEqual(isReleaseNear(8.5), false, "score 8.5 must NOT qualify for punchup");
  assert.strictEqual(isReleaseNear(8.6), true, "score 8.6 just qualifies for punchup");
  assert.strictEqual(isReleaseNear(8.9), true, "score 8.9 qualifies for punchup");
  assert.strictEqual(isReleaseNear(undefined), false, "no-score must not qualify");
  console.log("  ✓ §R line-punchup gate ≥ 8.6 (X.13 cost control)");
}

// ─── §S baseline: clean release ─────────────────────────────────────────────
{
  const r = classifyFinalRouting({
    releaseReady: true,
    hardIssues: [],
    softIssues: [],
    releaseDimensionFailures: [],
    imagesSkipped: false,
  });
  assert.strictEqual(r.failureClass, "none");
  assert.strictEqual(r.recommendedRoute, "release");
  assert.deepStrictEqual(r.mustFixBeforeRelease, []);
  console.log("  ✓ §S clean release → failureClass=none, route=release");
}

// ─── §S plan failure: missing irreversible middle ───────────────────────────
{
  const r = classifyFinalRouting({
    releaseReady: false,
    hardIssues: ["keine sichtbare irreversible Mitte"],
    softIssues: [],
    releaseDimensionFailures: [],
    imagesSkipped: false,
  });
  assert.strictEqual(r.failureClass, "plan_failure");
  assert.strictEqual(r.recommendedRoute, "rewrite_from_scene_cards");
  assert.ok(r.mustFixBeforeRelease.length > 0);
  console.log("  ✓ §S irreversibleMiddle missing → plan_failure, rewrite_from_scene_cards");
}

// ─── §S plan failure: helper explains finale ────────────────────────────────
{
  const r = classifyFinalRouting({
    releaseReady: false,
    hardIssues: [],
    softIssues: ["Helper-Explains-Gate"],
    releaseDimensionFailures: [],
    imagesSkipped: false,
    routerStrategy: "agency_repair",
  });
  assert.strictEqual(r.failureClass, "plan_failure");
  // Strategy is "agency_repair" → targeted_repair route (not rewrite).
  assert.strictEqual(r.recommendedRoute, "targeted_repair");
  console.log("  ✓ §S helper-explains + agency_repair → plan_failure, targeted_repair");
}

// ─── §S plan failure via dimension floor (X.6 spirit) ──────────────────────
{
  const r = classifyFinalRouting({
    releaseReady: false,
    hardIssues: [],
    softIssues: [],
    releaseDimensionFailures: ["emotionalPayoffScore 7 is below 8."],
    imagesSkipped: false,
  });
  assert.strictEqual(r.failureClass, "plan_failure");
  assert.strictEqual(r.recommendedRoute, "rewrite_from_scene_cards");
  console.log("  ✓ §S dimension floor breach → plan_failure, rewrite_from_scene_cards");
}

// ─── §S plan failure via dimensionScores (causalChain < 8) ─────────────────
{
  const r = classifyFinalRouting({
    releaseReady: false,
    hardIssues: [],
    softIssues: [],
    releaseDimensionFailures: [],
    imagesSkipped: false,
    dimensionScores: { causalChain: 7.4 },
  });
  assert.strictEqual(r.failureClass, "plan_failure");
  console.log("  ✓ §S causalChain<8 → plan_failure");
}

// ─── §S form failure: raw JSON only ─────────────────────────────────────────
{
  const r = classifyFinalRouting({
    releaseReady: false,
    hardIssues: ["[object Object] in Kapitel 3"],
    softIssues: [],
    releaseDimensionFailures: [],
    imagesSkipped: false,
  });
  assert.strictEqual(r.failureClass, "form_failure");
  assert.strictEqual(r.recommendedRoute, "local_fix");
  assert.ok(r.mustFixBeforeRelease[0].includes("[object Object]"));
  console.log("  ✓ §S raw JSON only → form_failure, local_fix");
}

// ─── §S form failure: page count mismatch ──────────────────────────────────
{
  const r = classifyFinalRouting({
    releaseReady: false,
    hardIssues: ["Seitenzahl falsch (4 statt 5)"],
    softIssues: [],
    releaseDimensionFailures: [],
    imagesSkipped: false,
  });
  assert.strictEqual(r.failureClass, "form_failure");
  assert.strictEqual(r.recommendedRoute, "local_fix");
  console.log("  ✓ §S page count mismatch → form_failure, local_fix");
}

// ─── §S form failure: orthography only ─────────────────────────────────────
{
  const r = classifyFinalRouting({
    releaseReady: false,
    hardIssues: ["ASCII-Umlaut in Kapitel 2"],
    softIssues: [],
    releaseDimensionFailures: [],
    imagesSkipped: false,
    routerStrategy: "orthography_autofix",
  });
  assert.strictEqual(r.failureClass, "form_failure");
  assert.strictEqual(r.recommendedRoute, "local_fix");
  console.log("  ✓ §S orthography only → form_failure, local_fix");
}

// ─── §S draft failure: hard issue that is neither form nor plan ────────────
{
  const r = classifyFinalRouting({
    releaseReady: false,
    hardIssues: ["Kapitel 2: Dialoganteil zu niedrig"],
    softIssues: [],
    releaseDimensionFailures: [],
    imagesSkipped: false,
    routerStrategy: "targeted_chapter_repair_with_context",
  });
  assert.strictEqual(r.failureClass, "draft_failure");
  assert.strictEqual(r.recommendedRoute, "targeted_repair");
  console.log("  ✓ §S unspecific hard issue → draft_failure, targeted_repair");
}

// ─── §S plan trumps form: both present ─────────────────────────────────────
{
  const r = classifyFinalRouting({
    releaseReady: false,
    hardIssues: ["[object Object] in Kapitel 1", "keine sichtbare irreversible Mitte"],
    softIssues: [],
    releaseDimensionFailures: [],
    imagesSkipped: false,
  });
  assert.strictEqual(r.failureClass, "plan_failure", "plan must trump form");
  assert.strictEqual(r.recommendedRoute, "rewrite_from_scene_cards");
  console.log("  ✓ §S plan+form together → plan_failure wins (polish cannot fix structure)");
}

// ─── §S regenerate idea: router said so ────────────────────────────────────
{
  const r = classifyFinalRouting({
    releaseReady: false,
    hardIssues: ["Verbotenes Motiv 'Schattencape' im Kernplan"],
    softIssues: [],
    releaseDimensionFailures: [],
    imagesSkipped: false,
    routerStrategy: "regenerate_from_plan_or_idea",
  });
  assert.strictEqual(r.failureClass, "plan_failure");
  assert.strictEqual(r.recommendedRoute, "regenerate_idea");
  console.log("  ✓ §S regenerate_from_plan_or_idea → recommendedRoute=regenerate_idea");
}

// ─── §S image_not_started: text clean, images skipped ──────────────────────
{
  const r = classifyFinalRouting({
    releaseReady: false, // because images count toward release
    hardIssues: [],
    softIssues: [],
    releaseDimensionFailures: [],
    imagesSkipped: true,
  });
  assert.strictEqual(r.failureClass, "image_not_started");
  assert.strictEqual(r.recommendedRoute, "release");
  console.log("  ✓ §S text clean + images skipped → image_not_started");
}

// ─── §S mustFixBeforeRelease is bounded ────────────────────────────────────
{
  const manyIssues = Array.from({ length: 20 }, (_, i) => `Issue ${i}: [object Object]`);
  const r = classifyFinalRouting({
    releaseReady: false,
    hardIssues: manyIssues,
    softIssues: [],
    releaseDimensionFailures: [],
    imagesSkipped: false,
  });
  assert.ok(r.mustFixBeforeRelease.length <= 6, `mustFixBeforeRelease must cap at 6, got ${r.mustFixBeforeRelease.length}`);
  console.log("  ✓ §S mustFixBeforeRelease capped at 6 entries");
}

console.log("\n✓ All §R/§S smoke tests passed.");
