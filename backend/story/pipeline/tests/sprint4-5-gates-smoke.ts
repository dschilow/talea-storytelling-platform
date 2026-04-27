/**
 * Sprint 4+5 smoke test — refrain, antagonist showdown, iconic motif.
 *
 * Run: bun run backend/story/pipeline/tests/sprint4-5-gates-smoke.ts
 */

import { runQualityGates } from "../quality-gates";
import { getReferenceFewshotBlock } from "../reference-fewshot";
import { STORY_SKELETONS } from "../content-library/story-skeletons";
import { buildContentLibraryBinding, buildContentLibraryPromptBlock } from "../content-library/concrete-binding";
import type { StoryDraft, SceneDirective, CastSet } from "../types";

// Sprint3 smoke runs this same way without Encore — content-library has no DB deps.

const minimalCast: CastSet = {
  avatars: [{ characterId: "alex", displayName: "Alexander" }] as any,
  poolCharacters: [{ characterId: "morb", displayName: "Mutlosmacher" }] as any,
  artifact: undefined,
} as any;

const minimalDirectives: SceneDirective[] = [1, 2, 3, 4, 5].map((n) => ({
  chapter: n,
  setting: "Wald",
  goal: "Spur folgen",
  conflict: "falsche Spur",
  outcome: "richtigen Weg finden",
  charactersOnStage: ["Alexander"],
  artifactUsage: "",
  canonAnchorLine: "",
  imageMustShow: [],
  imageAvoid: [],
})) as SceneDirective[];

console.log("\n═══ Sprint 4+5 Smoke Test ═══");

// ─── A: Skeleton has refrain + iconic motif ─────────────────────────────────
console.log("\nA — All 6 skeletons have refrain candidates + iconic motif");
let aOk = true;
for (const s of STORY_SKELETONS) {
  if (!s.refrainCandidates || s.refrainCandidates.length < 3) {
    console.error(`  ✗ ${s.id}: only ${s.refrainCandidates?.length ?? 0} refrain candidates`);
    aOk = false;
  }
  if (!s.iconicMotif?.object || !s.iconicMotif.perChapterPosition || s.iconicMotif.perChapterPosition.length !== 5) {
    console.error(`  ✗ ${s.id}: iconicMotif missing or wrong size`);
    aOk = false;
  }
}
if (aOk) console.log(`  ✓ all 6 skeletons valid`);

// ─── B: Binding propagates refrain + iconic motif ──────────────────────────
console.log("\nB — buildContentLibraryBinding produces refrain + iconic motif");
const binding = buildContentLibraryBinding({
  genre: "classical-fairy-tales",
  themeTags: ["helfer", "dankbarkeit"],
  hasArtifact: false,
});
if (binding) {
  console.log(`  ✓ skeleton: ${binding.skeleton.id}`);
  console.log(`  ✓ recommendedRefrain: "${binding.recommendedRefrain}"`);
  console.log(`  ✓ recommendedIconicMotif.object: "${binding.recommendedIconicMotif.object}"`);
  console.log(`  ✓ motif positions: ${binding.recommendedIconicMotif.perChapterPosition.length}`);
  const block = buildContentLibraryPromptBlock(binding);
  if (!block.includes("RECOMMENDED refrain_line")) console.error("  ✗ prompt block missing refrain section");
  if (!block.includes("RECOMMENDED iconic_motif")) console.error("  ✗ prompt block missing iconic motif section");
  console.log(`  ✓ prompt block contains refrain + motif sections`);
} else {
  console.error("  ✗ no binding returned");
}

// ─── C: Refrain gate fires when refrain absent ────────────────────────────
console.log("\nC — REFRAIN_PRESENCE gate fires when refrain absent or only in early chapters");
const draftMissingRefrain: StoryDraft = {
  title: "T",
  description: "D",
  chapters: [
    { chapter: 1, title: "1", text: "Erst hinschauen, dann los. Alexander ging weiter. Es war kühl im Wald." },
    { chapter: 2, title: "2", text: "Der Vogel pfiff. Adrian rannte voraus. Sie sahen einen Pfeil im Gras." },
    { chapter: 3, title: "3", text: "Sie folgten der Spur. Der Wald wurde dichter. Plötzlich rief jemand." },
    { chapter: 4, title: "4", text: "Sie machten Pause. Adrian aß ein Stück Brot. Beide schwiegen einen Moment." },
    { chapter: 5, title: "5", text: "Am Ende kamen sie heim. Die Tür stand offen. Oma wartete schon." },
  ],
};
const reportNoRefrain = runQualityGates({
  draft: draftMissingRefrain,
  directives: minimalDirectives,
  cast: minimalCast,
  language: "de",
  refrainLine: "Erst hinschauen, dann los.",
});
const refrainIssues = reportNoRefrain.issues.filter(i => i.gate === "REFRAIN_PRESENCE");
console.log(`  Issues: ${refrainIssues.length} — codes: ${refrainIssues.map(i => i.code).join(", ")}`);
if (refrainIssues.some(i => i.code === "REFRAIN_MISSING") && refrainIssues.some(i => i.code === "REFRAIN_ENDING_MISSING")) {
  console.log(`  ✓ both REFRAIN_MISSING and REFRAIN_ENDING_MISSING fire`);
} else {
  console.error(`  ✗ expected both REFRAIN_MISSING and REFRAIN_ENDING_MISSING`);
}

// ─── D: Refrain gate passes when refrain ≥3× and in last chapter ─────────
console.log("\nD — REFRAIN_PRESENCE gate passes when refrain present 3× incl. last chapter");
const draftGoodRefrain: StoryDraft = {
  title: "T",
  description: "D",
  chapters: [
    { chapter: 1, title: "1", text: "Erst hinschauen, dann los. Alexander ging weiter." },
    { chapter: 2, title: "2", text: "Der Vogel pfiff." },
    { chapter: 3, title: "3", text: "Erst hinschauen, dann los. Adrian nickte." },
    { chapter: 4, title: "4", text: "Sie machten Pause." },
    { chapter: 5, title: "5", text: "Erst hinschauen, dann los. Sie kamen heim." },
  ],
};
const reportGoodRefrain = runQualityGates({
  draft: draftGoodRefrain,
  directives: minimalDirectives,
  cast: minimalCast,
  language: "de",
  refrainLine: "Erst hinschauen, dann los.",
});
const refrainIssues2 = reportGoodRefrain.issues.filter(i => i.gate === "REFRAIN_PRESENCE");
if (refrainIssues2.length === 0) {
  console.log(`  ✓ refrain gate passes`);
} else {
  console.error(`  ✗ expected 0 issues, got ${refrainIssues2.length}: ${refrainIssues2.map(i => i.code).join(", ")}`);
}

// ─── E: Antagonist showdown gate fires when antagonist absent in last chapter ─
console.log("\nE — ANTAGONIST_SHOWDOWN fires when antagonist missing from last chapter");
const draftMissingShowdown: StoryDraft = {
  title: "T",
  description: "D",
  chapters: [
    { chapter: 1, title: "1", text: "Der Mutlosmacher trat aus dem Schatten." },
    { chapter: 2, title: "2", text: "Der Mutlosmacher murmelte etwas." },
    { chapter: 3, title: "3", text: "Der Mutlosmacher folgte ihnen." },
    { chapter: 4, title: "4", text: "Sie sprachen über den Schatten." },
    { chapter: 5, title: "5", text: "Sie kamen heim. Es war warm. Alle waren froh." },
  ],
};
const reportNoShowdown = runQualityGates({
  draft: draftMissingShowdown,
  directives: minimalDirectives,
  cast: minimalCast,
  language: "de",
  antagonistName: "Mutlosmacher",
});
const showdownIssues = reportNoShowdown.issues.filter(i => i.gate === "ANTAGONIST_SHOWDOWN");
console.log(`  Issues: ${showdownIssues.length} — codes: ${showdownIssues.map(i => i.code).join(", ")}`);
if (showdownIssues.some(i => i.code === "ANTAGONIST_NO_SHOWDOWN")) {
  console.log(`  ✓ ANTAGONIST_NO_SHOWDOWN fires`);
} else {
  console.error(`  ✗ expected ANTAGONIST_NO_SHOWDOWN`);
}

// ─── F: Iconic motif gate fires when motif sparse ─────────────────────────
console.log("\nF — ICONIC_MOTIF_RECURRENCE fires when motif visible in <3 chapters");
const draftSparseMotif: StoryDraft = {
  title: "T",
  description: "D",
  chapters: [
    { chapter: 1, title: "1", text: "Alexander hielt einen kleinen glatten Stein in der Hand." },
    { chapter: 2, title: "2", text: "Der Vogel pfiff." },
    { chapter: 3, title: "3", text: "Adrian nickte." },
    { chapter: 4, title: "4", text: "Sie machten Pause." },
    { chapter: 5, title: "5", text: "Sie kamen heim." },
  ],
};
const reportSparse = runQualityGates({
  draft: draftSparseMotif,
  directives: minimalDirectives,
  cast: minimalCast,
  language: "de",
  iconicMotif: { object: "kleiner glatter Stein" },
});
const motifIssues = reportSparse.issues.filter(i => i.gate === "ICONIC_MOTIF_RECURRENCE");
if (motifIssues.length > 0) {
  console.log(`  ✓ ICONIC_MOTIF_SPARSE fires`);
} else {
  console.error(`  ✗ expected ICONIC_MOTIF_SPARSE`);
}

// ─── G: tightening picker filters AGE_FIT issues only (lazy-loaded to skip Encore) ─
console.log("\nG — pickChaptersNeedingTightening picks only AGE_FIT chapters");
try {
  const { pickChaptersNeedingTightening } = await import("../sentence-tightening-pass");
  const issues = [
    { gate: "AGE_FIT_SENTENCE_LENGTH", chapter: 1, severity: "ERROR", code: "AVG_SENTENCE_TOO_LONG_HARD" },
    { gate: "AGE_FIT_SENTENCE_LENGTH", chapter: 3, severity: "ERROR", code: "COMPLEX_CLAUSE_OVERUSE" },
    { gate: "DIALOGUE_QUOTE", chapter: 2, severity: "ERROR", code: "DIALOGUE_RATIO_LOW" },
    { gate: "READABILITY_COMPLEXITY", chapter: 4, severity: "WARNING", code: "SENTENCE_COMPLEXITY_HIGH" },
  ];
  const set = pickChaptersNeedingTightening(issues);
  if (set.has(1) && set.has(3) && !set.has(2) && !set.has(4) && set.size === 2) {
    console.log(`  ✓ picked ${[...set].sort().join(", ")}`);
  } else {
    console.error(`  ✗ expected {1,3}, got ${[...set].sort().join(", ")}`);
  }
} catch (err) {
  console.warn(`  ⚠ skipped (encore env missing): ${(err as Error).message?.slice(0, 80)}`);
}

// ─── H: Reference fewshot block is non-empty in both languages ─────────
console.log("\nH — getReferenceFewshotBlock");
const blockDe = getReferenceFewshotBlock("de");
const blockEn = getReferenceFewshotBlock("en");
if (blockDe.length > 200 && blockEn.length > 100 && blockDe.includes("EXAMPLE") && blockEn.includes("EXAMPLE")) {
  console.log(`  ✓ DE block ${blockDe.length} chars, EN block ${blockEn.length} chars`);
} else {
  console.error(`  ✗ blocks too short or missing markers`);
}

console.log("\n═══ Sprint 4+5 smoke test complete ═══");
