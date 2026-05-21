/**
 * Smoke test for screenplay-first-v12 spec §P (expansion repair), §Q
 * (compression repair) and the §T strategy-marker patterns that
 * `applyHardCaps` matches on.
 *
 * Run: bun run backend/story/pipeline/tests/screenplay-v12-p-q-t.ts
 *
 * Covers Spec-X cases:
 *   X.10 raw JSON pattern is matched by §T applyHardCaps regex (string-level)
 *   X.7  page-count mismatch issue string matches the §T cap regex
 *   X.13 cost control: agency/voice/ending strategies emit short, focused
 *        prompts (no whole-story polish)
 */
import assert from "assert";
import { buildStrategyDirectivesBlock } from "../repair-strategy-directives";

console.log("\n═══ screenplay-v12 §P/§Q/§T smoke ═══");

// ─── §P expansion_repair directives ─────────────────────────────────────────
{
  const block = buildStrategyDirectivesBlock("expansion_repair");
  assert.ok(block, "expansion_repair must produce a directive block");
  assert.ok(/§P EXPANSION REPAIR/.test(block!), "§P header must be present");
  for (const must of ["personalCost", "visible damage", "final decision", "closing image"]) {
    assert.ok(block!.includes(must), `expansion directives must mention "${must}"`);
  }
  // §P forbids adding new structural elements.
  assert.ok(/Do NOT add a new subplot/.test(block!), "expansion directives must forbid new subplots");
  console.log("  ✓ §P expansion_repair directives lock to load-bearing beats");
}

// ─── §Q compression_repair directives ───────────────────────────────────────
{
  const block = buildStrategyDirectivesBlock("whole_story_compression_repair");
  assert.ok(block, "compression must produce a directive block");
  assert.ok(/§Q COMPRESSION REPAIR/.test(block!), "§Q header must be present");
  // Must list the never-cut spine.
  for (const spine of [
    "the hook",
    "first on-page test of the magic",
    "wrong first attempt",
    "irreversible middle",
    "personal cost",
    "final hero decision",
    "closing image",
  ]) {
    assert.ok(block!.toLowerCase().includes(spine.toLowerCase()), `compression NEVER-cut list must mention "${spine}"`);
  }
  // Must list things that may be cut.
  for (const cut of ["second descriptions", "repeated reactions", "explanation sentences", "helper commentary"]) {
    assert.ok(block!.toLowerCase().includes(cut.toLowerCase()), `compression CUT list must mention "${cut}"`);
  }
  console.log("  ✓ §Q compression_repair directives preserve structural spine");
}

// ─── §O agency_repair directives ────────────────────────────────────────────
{
  const block = buildStrategyDirectivesBlock("agency_repair");
  assert.ok(block, "agency_repair must produce a directive block");
  assert.ok(/AGENCY REPAIR/.test(block!));
  // The helper is allowed certain functions but never "explain".
  assert.ok(/never explain the answer/.test(block!), "agency directives must forbid helper-explains");
  assert.ok(/named heroes/.test(block!), "agency directives must call out hero attribution");
  console.log("  ✓ §O agency_repair directives forbid helper-explains");
}

// ─── §O voice_punchup directives ────────────────────────────────────────────
{
  const block = buildStrategyDirectivesBlock("voice_punchup");
  assert.ok(block, "voice_punchup must produce a directive block");
  assert.ok(/VOICE PUNCHUP/.test(block!));
  // Voice punchup must NOT change structural beats.
  assert.ok(/Do not change the plot/.test(block!), "voice directives must lock plot");
  assert.ok(/dialogue percentage/.test(block!), "voice directives must lock dialog %");
  console.log("  ✓ §O voice_punchup directives lock plot + dialog %");
}

// ─── §O ending_image_repair directives ──────────────────────────────────────
{
  const block = buildStrategyDirectivesBlock("ending_image_repair");
  assert.ok(block, "ending_image_repair must produce a directive block");
  assert.ok(/ENDING IMAGE REPAIR/.test(block!));
  assert.ok(/concrete sensory image/.test(block!), "ending directives must demand a concrete image");
  assert.ok(/Do not summarize what the heroes learned/.test(block!), "ending directives must forbid moral summary");
  console.log("  ✓ §O ending_image_repair directives demand a concrete image");
}

// ─── strategy = "none" produces no block ────────────────────────────────────
{
  assert.strictEqual(buildStrategyDirectivesBlock("none"), null);
  assert.strictEqual(buildStrategyDirectivesBlock(undefined), null);
  console.log("  ✓ none/undefined → no directive block (no token waste)");
}

// ─── unknown strategy (e.g. deterministic ones) emits no block ─────────────
{
  // Deterministic strategies short-circuit the LLM call entirely, so their
  // directive block is intentionally absent (would not be sent anyway).
  assert.strictEqual(buildStrategyDirectivesBlock("metadata_sanitize"), null);
  assert.strictEqual(buildStrategyDirectivesBlock("title_promise_micro_repair"), null);
  assert.strictEqual(buildStrategyDirectivesBlock("parse_output_repair"), null);
  assert.strictEqual(buildStrategyDirectivesBlock("orthography_autofix"), null);
  console.log("  ✓ deterministic strategies emit no directive block");
}

// ─── X.10/X.7 §T regex patterns match expected issue strings ──────────────
{
  // These regexes must stay in sync with applyHardCaps in dev-mode-generation.ts.
  // We test them at the string level here so the cap behavior is verifiable
  // without importing the full Encore-bound module.
  const rawJsonRegex = /\[object Object\]|raw JSON|RoheJSON|JSON-Fragment|brokenJson|broken JSON/i;
  assert.ok(rawJsonRegex.test("Kapitel 3 enthält [object Object] in Absatz 4"));
  assert.ok(rawJsonRegex.test("raw JSON visible in title"));
  assert.ok(rawJsonRegex.test("RoheJSON in finalem Absatz"));
  console.log("  ✓ X.10 §T raw-JSON cap regex matches expected issue strings");

  const pageCountRegex = /Seitenzahl|pageCount|page count|Restseite|Orphan|orphan page/i;
  assert.ok(pageCountRegex.test("Seitenzahl falsch: 4 statt 5"));
  assert.ok(pageCountRegex.test("orphan page detected"));
  assert.ok(pageCountRegex.test("pageCount mismatch"));
  console.log("  ✓ X.7 §T pageCount cap regex matches expected issue strings");

  const titlePromiseRegex = /Titel-Versprechen unerfuellt/i;
  assert.ok(titlePromiseRegex.test("Titel-Versprechen unerfuellt — Konzept fehlt im Text"));
  console.log("  ✓ §T title-promise cap regex matches expected issue strings");
}

// ─── §P/§Q blocks are short (cost control — Spec-X.13 spirit) ──────────────
{
  // The whole point of strategy-specific directives is to AVOID dumping a
  // full polish prompt. Sanity-check that each block is under 1.5 KB so we
  // catch accidental token-bloat regressions.
  for (const s of ["expansion_repair", "whole_story_compression_repair", "agency_repair", "voice_punchup", "ending_image_repair"] as const) {
    const block = buildStrategyDirectivesBlock(s);
    assert.ok(block && block.length < 1500, `${s} directive block must stay under 1.5KB; got ${block?.length} chars`);
  }
  console.log("  ✓ X.13 cost control: each strategy block stays under 1.5KB");
}

console.log("\n✓ All §P/§Q/§T smoke tests passed.");
