/**
 * Smoke test for screenplay-first-v12 spec §O repair-router.
 *
 * Run: bun run backend/story/pipeline/tests/screenplay-v12-repair-router.ts
 *
 * Covers Spec-X cases:
 *   X.10 raw JSON in story text → parse_output_repair (and is non-LLM)
 *   X.11 only orthography issues → orthography_autofix (and is non-LLM)
 *   X.13 (cost control) premium gets 2 repair attempts, efficient gets 1
 *
 * Also covers all new strategy classes:
 *   parse_output_repair, regenerate_from_plan_or_idea, agency_repair,
 *   voice_punchup, ending_image_repair, orthography_autofix.
 */
import assert from "assert";
import {
  chooseRepairStrategy,
  isDeterministicRepairStrategy,
  maxRepairAttemptsFor,
  type RepairRouterDiagnostics,
  type RepairRouterContext,
} from "../repair-router";

function emptyDiagnostics(): RepairRouterDiagnostics {
  return {
    hardIssueCount: 0,
    softIssueCount: 0,
    totalWords: 1000,
    dialogPct: 30,
    chapterDiagnostics: [
      { dialogPct: 30, issues: [] },
      { dialogPct: 30, issues: [] },
      { dialogPct: 30, issues: [] },
      { dialogPct: 30, issues: [] },
      { dialogPct: 30, issues: [] },
    ],
    hardIssues: [],
    softIssues: [],
  };
}

function withHard(hard: string[]): RepairRouterDiagnostics {
  const d = emptyDiagnostics();
  d.hardIssues = hard;
  d.hardIssueCount = hard.length;
  return d;
}

function withSoft(soft: string[]): RepairRouterDiagnostics {
  const d = emptyDiagnostics();
  d.softIssues = soft;
  d.softIssueCount = soft.length;
  return d;
}

console.log("\n═══ screenplay-v12 §O repair-router smoke ═══");

// ─── X.10: raw JSON in story → parse_output_repair ──────────────────────────
{
  const d = withHard(["[object Object] aufgetaucht in Kapitel 2"]);
  const r = chooseRepairStrategy(d);
  assert.strictEqual(r.strategy, "parse_output_repair", `X.10 expected parse_output_repair, got ${r.strategy}`);
  assert.ok(isDeterministicRepairStrategy(r.strategy), "X.10 parse_output_repair must be deterministic (no LLM)");
  console.log("  ✓ X.10 raw JSON → parse_output_repair (deterministic)");
}

// ─── X.10b: raw JSON wins over title-promise ────────────────────────────────
{
  const d = withHard(["[object Object] in prose", "Titel-Versprechen unerfuellt"]);
  const r = chooseRepairStrategy(d);
  assert.strictEqual(r.strategy, "parse_output_repair", `X.10b parse should win over title-promise, got ${r.strategy}`);
  console.log("  ✓ X.10b parse_output_repair has higher priority than title repair");
}

// ─── title-only → title_promise_micro_repair ────────────────────────────────
{
  const d = withHard(["Titel-Versprechen unerfuellt"]);
  const r = chooseRepairStrategy(d);
  assert.strictEqual(r.strategy, "title_promise_micro_repair");
  assert.ok(isDeterministicRepairStrategy(r.strategy));
  console.log("  ✓ single title-promise → title_promise_micro_repair (deterministic)");
}

// ─── forbidden motif in plan → regenerate_from_plan_or_idea ────────────────
{
  const d = withSoft(["minor stuff"]);
  const r = chooseRepairStrategy(d, { forbiddenMotifInCorePlan: true });
  assert.strictEqual(r.strategy, "regenerate_from_plan_or_idea");
  console.log("  ✓ forbiddenMotifInCorePlan → regenerate_from_plan_or_idea");
}

// ─── page-count mismatch → page_count_repair ────────────────────────────────
{
  const d = withSoft(["minor"]);
  const r = chooseRepairStrategy(d, { requiredPageCount: 5, actualPageCount: 4 });
  assert.strictEqual(r.strategy, "page_count_repair");
  console.log("  ✓ pageCount mismatch → page_count_repair");
}

// ─── under-length → expansion_repair ────────────────────────────────────────
{
  const d = withSoft(["something"]);
  const r = chooseRepairStrategy(d, { totalWords: 750 });
  assert.strictEqual(r.strategy, "expansion_repair");
  console.log("  ✓ totalWords=750 → expansion_repair");
}

// ─── missing irreversible middle → scene_card_repair_then_rewrite ──────────
{
  const d = withSoft(["keine sichtbare irreversible Mitte"]);
  const r = chooseRepairStrategy(d, { missingIrreversibleMiddle: true });
  assert.strictEqual(r.strategy, "scene_card_repair_then_rewrite");
  console.log("  ✓ missingIrreversibleMiddle → scene_card_repair_then_rewrite");
}

// ─── X.6 agency repair ──────────────────────────────────────────────────────
{
  const d = withSoft(["Helper-Explains-Gate"]);
  const r = chooseRepairStrategy(d, { helperExplainsSolution: true });
  assert.strictEqual(r.strategy, "agency_repair");
  console.log("  ✓ X.6 helperExplainsSolution → agency_repair");
}

// ─── voice_punchup at distinctiveness < 8 ───────────────────────────────────
{
  const d = withSoft(["small"]);
  const r = chooseRepairStrategy(d, { voiceDistinctiveness: 7.5 });
  assert.strictEqual(r.strategy, "voice_punchup");
  console.log("  ✓ voiceDistinctiveness=7.5 → voice_punchup");
}

// ─── voice_punchup NOT triggered at distinctiveness == 8 ────────────────────
{
  const d = withSoft(["small"]);
  const r = chooseRepairStrategy(d, { voiceDistinctiveness: 8.0 });
  assert.notStrictEqual(r.strategy, "voice_punchup", "voice 8.0 must not trigger voice_punchup");
  console.log("  ✓ voiceDistinctiveness=8.0 does NOT trigger voice_punchup");
}

// ─── ending_image_repair on moralizing soft issue ───────────────────────────
{
  const d = withSoft(["Finale klingt wie eine Lehre"]);
  const r = chooseRepairStrategy(d);
  assert.strictEqual(r.strategy, "ending_image_repair");
  console.log("  ✓ moralizing finale → ending_image_repair");
}

// ─── ending_image_repair via explicit context flag ──────────────────────────
{
  const d = withSoft(["small"]);
  const r = chooseRepairStrategy(d, { finalMoralizing: true });
  assert.strictEqual(r.strategy, "ending_image_repair");
  console.log("  ✓ finalMoralizing flag → ending_image_repair");
}

// ─── X.11: only orthography issues → orthography_autofix ───────────────────
{
  const d = withSoft(["gross statt groß in Kapitel 1", "Aermel statt Ärmel"]);
  const r = chooseRepairStrategy(d);
  assert.strictEqual(r.strategy, "orthography_autofix", `X.11 expected orthography_autofix, got ${r.strategy}`);
  assert.ok(isDeterministicRepairStrategy(r.strategy), "X.11 orthography_autofix must be deterministic");
  console.log("  ✓ X.11 only-ortho issues → orthography_autofix (deterministic)");
}

// ─── all-clean → none ───────────────────────────────────────────────────────
{
  const r = chooseRepairStrategy(emptyDiagnostics());
  assert.strictEqual(r.strategy, "none");
  assert.ok(!isDeterministicRepairStrategy(r.strategy), "none is not deterministic-repair (no repair needed)");
  console.log("  ✓ all clean → none");
}

// ─── X.13: premium=2 attempts, efficient=1 attempt ──────────────────────────
{
  assert.strictEqual(maxRepairAttemptsFor("premium"), 2, "premium must allow 2 repairs");
  assert.strictEqual(maxRepairAttemptsFor("efficient"), 1, "efficient must allow 1 repair");
  assert.strictEqual(maxRepairAttemptsFor(undefined), 2, "default (premium) must allow 2 repairs");
  console.log("  ✓ X.13 cost control: premium=2 attempts, efficient=1");
}

// ─── §O priority: parse > title > forbiddenMotif > pageCount > expansion ───
{
  // raw JSON beats everything else.
  const d = withHard(["[object Object]"]);
  const r = chooseRepairStrategy(d, {
    forbiddenMotifInCorePlan: true,
    requiredPageCount: 5,
    actualPageCount: 4,
    totalWords: 700,
    missingIrreversibleMiddle: true,
  });
  assert.strictEqual(r.strategy, "parse_output_repair", "parse_output_repair must dominate other diagnostics");
  console.log("  ✓ §O priority — parse_output_repair beats every other context");
}

// ─── §O priority: agency_repair beats dialog_rebalance ──────────────────────
{
  const d = withSoft(["Helper-Explains-Gate", "dialog rebalance soft"]);
  d.dialogPct = 22; // below 27 -> would trigger dialog_rebalance on its own
  const r = chooseRepairStrategy(d, { helperExplainsSolution: true });
  assert.strictEqual(r.strategy, "agency_repair");
  console.log("  ✓ §O priority — agency_repair beats dialog_rebalance");
}

// ─── §O premium-safe dialogue floor: 26.x still rebalances ────────────────
{
  const d = withSoft(["Dialoganteil knapp unter Premium-Floor"]);
  d.dialogPct = 26.5;
  const r = chooseRepairStrategy(d);
  assert.strictEqual(r.strategy, "whole_story_dialog_rebalance");
  console.log("  ✓ §O dialogPct=26.5 -> whole_story_dialog_rebalance");
}

console.log("\n✓ All §O repair-router tests passed.");
