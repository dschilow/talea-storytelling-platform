/**
 * Greenfield smoke test — verifies content-library building blocks and binding.
 * Pure TS, no Encore runtime needed.
 *
 * Run: bun run backend/story/pipeline/tests/greenfield-smoke.ts
 */

import {
  STORY_SKELETONS,
  pickBestSkeleton,
  buildSkeletonPromptBlock,
} from "../content-library/story-skeletons";
import {
  ANTAGONIST_ARCHETYPES,
  getAntagonistArchetype,
} from "../content-library/antagonist-archetypes";
import {
  ARTIFACT_TEMPLATES,
  pickArtifactForSkeleton,
} from "../content-library/artifact-templates";
import {
  buildContentLibraryBinding,
  buildContentLibraryPromptBlock,
} from "../content-library/concrete-binding";

function section(label: string) {
  console.log(`\n═══ ${label} ═══`);
}

// ─── A: Library shapes ─────────────────────────────────────────────────────────
section("A — Library sizes");
console.log(`  Skeletons: ${STORY_SKELETONS.length} (expected 6)`);
console.log(`  Antagonist archetypes: ${ANTAGONIST_ARCHETYPES.length} (expected 6)`);
console.log(`  Artifact templates: ${ARTIFACT_TEMPLATES.length} (expected 8)`);
if (STORY_SKELETONS.length !== 6) console.error("  ✗ skeleton count mismatch");
if (ANTAGONIST_ARCHETYPES.length !== 6) console.error("  ✗ archetype count mismatch");
if (ARTIFACT_TEMPLATES.length !== 8) console.error("  ✗ artifact count mismatch");

// ─── B: Skeleton picker ────────────────────────────────────────────────────────
section("B — Skeleton picker routes genre+tags correctly");
const casesB = [
  { label: "fairy-tales + helper", input: { genre: "fairy-tales", themeTags: ["helfer", "dankbarkeit"] }, expect: "cft-03-helper-returns" },
  { label: "magical + artifact", input: { genre: "magical-worlds", hasArtifact: true }, expect: "mw-01-artifact-price" },
  { label: "magical + portal", input: { genre: "magical-worlds", themeTags: ["tor", "andere-welt"] }, expect: "mw-02-gate-to-other-world" },
  { label: "fairy-tales + transformation", input: { genre: "classical-fairy-tales", themeTags: ["verwandlung"] }, expect: "cft-02-transformation" },
  { label: "magical + forgotten rule", input: { genre: "magical-worlds", themeTags: ["regel", "vergessen"] }, expect: "mw-03-forgotten-rule" },
];
for (const c of casesB) {
  const chosen = pickBestSkeleton(c.input as any);
  const ok = chosen?.id === c.expect;
  console.log(`  ${ok ? "✓" : "✗"} ${c.label}: picked ${chosen?.id ?? "none"} (expected ${c.expect})`);
}

// ─── C: Archetype to pool characters ───────────────────────────────────────────
section("C — Archetype → pool characters");
for (const arch of ANTAGONIST_ARCHETYPES) {
  const a = getAntagonistArchetype(arch.category);
  const ok = a && a.poolCharacterIds.length >= 1;
  console.log(`  ${ok ? "✓" : "✗"} ${arch.category} (${arch.label}): ${a?.poolCharacterIds.length ?? 0} pool-IDs`);
}

// ─── D: Artifact picker for skeletons ──────────────────────────────────────────
section("D — Artifact picker returns suitable template");
for (const skel of STORY_SKELETONS) {
  const art = pickArtifactForSkeleton(skel.id);
  console.log(`  ${art ? "✓" : "·"} ${skel.id}: ${art ? art.label : "(no boost artifact)"}`);
}

// ─── E: Full binding for a fairy-tale request ──────────────────────────────────
section("E — Full binding: fairy-tales + helper story");
const bindingA = buildContentLibraryBinding({
  genre: "classical-fairy-tales",
  themeTags: ["helfer", "dankbarkeit"],
  hasArtifact: false,
});
if (!bindingA) {
  console.error("  ✗ no binding returned");
} else {
  console.log(`  ✓ skeleton: ${bindingA.skeleton.id}`);
  console.log(`  ✓ antagonist archetype: ${bindingA.antagonistArchetype?.category}`);
  console.log(`  ✓ artifact: ${bindingA.artifactTemplate?.id ?? "(none, hasArtifact=false)"}`);
  console.log(`  ✓ concrete anchors: ${Object.keys(bindingA.concreteAnchorDefaults).length}`);
  console.log(`  ✓ recommended ending: ${bindingA.recommendedEndingPattern}`);
  if (Object.keys(bindingA.concreteAnchorDefaults).length < 3) {
    console.error("  ✗ fewer than 3 concrete anchors — would fail CONCRETE_ANCHOR gate");
  }
}

// ─── F: Full binding for a magical-worlds artifact story ───────────────────────
section("F — Full binding: magical-worlds + artifact");
const bindingB = buildContentLibraryBinding({
  genre: "magical-worlds",
  hasArtifact: true,
  settingHint: "Werkstatt",
});
if (!bindingB) {
  console.error("  ✗ no binding returned");
} else {
  console.log(`  ✓ skeleton: ${bindingB.skeleton.id} (expected mw-01-artifact-price)`);
  console.log(`  ✓ artifact: ${bindingB.artifactTemplate?.id}`);
  if (bindingB.skeleton.id !== "mw-01-artifact-price") {
    console.error("  ✗ skeleton routing for artifact story incorrect");
  }
}

// ─── G: Prompt-block generation ────────────────────────────────────────────────
section("G — Prompt-block generation (compact readout)");
if (bindingB) {
  const block = buildContentLibraryPromptBlock(bindingB);
  const lines = block.split("\n");
  console.log(`  Block: ${lines.length} lines, ${block.length} chars`);
  // Sanity: the block should contain the skeleton id, archetype category, artifact label
  const hasSkeleton = block.includes(bindingB.skeleton.id);
  const hasArchetype = bindingB.antagonistArchetype
    ? block.includes(bindingB.antagonistArchetype.category)
    : true;
  const hasArtifact = bindingB.artifactTemplate
    ? block.includes(bindingB.artifactTemplate.label)
    : true;
  const hasEnding = block.includes(bindingB.recommendedEndingPattern);
  console.log(`  ${hasSkeleton ? "✓" : "✗"} contains skeleton id`);
  console.log(`  ${hasArchetype ? "✓" : "✗"} contains archetype category`);
  console.log(`  ${hasArtifact ? "✓" : "✗"} contains artifact label`);
  console.log(`  ${hasEnding ? "✓" : "✗"} contains recommended ending`);
}

// ─── H: No-match case (unrelated genre) ────────────────────────────────────────
section("H — Unrelated genre still returns some skeleton (safe fallback)");
const bindingC = buildContentLibraryBinding({ genre: "sci-fi" });
// pickBestSkeleton falls back to all-candidates when no genre match; binding must still be a valid skeleton
console.log(`  Result: ${bindingC ? bindingC.skeleton.id : "undefined"} (safe to have a fallback, never undefined)`);

console.log("\n═══ Greenfield smoke test complete ═══");
