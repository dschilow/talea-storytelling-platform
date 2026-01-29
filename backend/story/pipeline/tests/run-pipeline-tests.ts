import assert from "assert";
import { createVariantPlan } from "../variant-planner";
import { scoreCandidate } from "../matching-score";
import { validateAndFixImageSpecs } from "../image-prompt-validator";
import { TemplateImageDirector } from "../image-director";
import { computeWordBudget, buildLengthTargetsFromBudget } from "../word-budget";
import { validateStoryDraft } from "../story-validator";
import type { CastSet, ImageSpec, NormalizedRequest, RoleSlot, SceneDirective, StoryBlueprintBase, StoryDNA } from "../types";

function buildNormalized(seed: number): NormalizedRequest {
  return {
    storyId: "test_story",
    userId: "user",
    category: "Abenteuer & Schätze",
    language: "de",
    ageMin: 6,
    ageMax: 8,
    chapterCount: 5,
    avatarIds: ["a1"],
    avatarCount: 1,
    requestHash: "hash",
    rawConfig: {} as any,
    variantSeed: seed,
  };
}

function buildBlueprint(): StoryBlueprintBase {
  const dna: StoryDNA = {
    templateId: "test",
    category: "Abenteuer & Schätze",
    language: "de",
    age: { min: 6, max: 8 },
    themeTags: ["courage"],
    coreConflict: "test",
    beatPattern: [],
    roleSlots: [],
    artifactCategories: ["magic"],
    artifactAbilities: ["navigation"],
    toneBounds: { targetTone: "warm", contentRules: ["safe"] },
  };
  return { dna, roles: [], scenes: [] };
}

function testVariantDeterminism() {
  const normalized = buildNormalized(123);
  const blueprint = buildBlueprint();
  const a = createVariantPlan({ normalized, blueprint });
  const b = createVariantPlan({ normalized, blueprint });
  assert.deepStrictEqual(a.variantChoices, b.variantChoices, "Variant choices should be deterministic for same seed");

  const normalized2 = buildNormalized(456);
  const c = createVariantPlan({ normalized: normalized2, blueprint });
  assert.notDeepStrictEqual(a.variantChoices, c.variantChoices, "Variant choices should differ for different seeds");
}

function testMatchingScore() {
  const slot: RoleSlot = {
    slotKey: "SLOT_HELPER_1",
    roleType: "HELPER",
    required: true,
    roleCount: 1,
    archetypePreference: ["helper"],
  };

  const helperCandidate: any = {
    id: "c1",
    name: "Mara",
    role: "helper",
    archetype: "guide",
    visual_profile: { description: "friendly", species: "human" },
    personality_keywords: ["kind"],
  };

  const villainCandidate: any = {
    id: "c2",
    name: "Grim",
    role: "antagonist",
    archetype: "villain",
    visual_profile: { description: "dark", species: "human" },
    personality_keywords: ["cruel"],
  };

  const helperScore = scoreCandidate(slot, helperCandidate);
  const villainScore = scoreCandidate(slot, villainCandidate);
  assert.ok(helperScore.finalScore > villainScore.finalScore, "Helper candidate should score higher than villain for helper slot");
}

function testImageSpecValidation() {
  const cast: CastSet = {
    avatars: [
      {
        characterId: "a1",
        displayName: "Lena",
        roleType: "AVATAR",
        slotKey: "SLOT_AVATAR_1",
        visualSignature: ["red hoodie"],
        outfitLock: ["red hoodie"],
        forbidden: ["adult"],
      },
    ],
    poolCharacters: [],
    artifact: {
      artifactId: "art1",
      name: "Glitzerstein",
      storyUseRule: "Helps navigate",
      visualRule: "glowing stone",
    },
    slotAssignments: {
      SLOT_AVATAR_1: "a1",
      SLOT_ARTIFACT_1: "art1",
    },
  };

  const directive: SceneDirective = {
    chapter: 1,
    setting: "forest",
    mood: "WONDER",
    charactersOnStage: ["SLOT_AVATAR_1", "SLOT_ARTIFACT_1"],
    goal: "find the path",
    conflict: "fog",
    outcome: "continue",
    artifactUsage: "artifact glows",
    canonAnchorLine: "Lena belongs here.",
    imageMustShow: ["forest", "Glitzerstein"],
    imageAvoid: ["looking at camera"],
  };

  const spec: ImageSpec = {
    chapter: 1,
    style: "storybook",
    composition: "wide",
    blocking: "Lena center",
    actions: "Lena walks",
    propsVisible: ["Glitzerstein"],
    lighting: "warm",
    refs: {},
    negatives: [],
    onStageExact: ["SLOT_AVATAR_1"],
    finalPromptText: "A story scene.",
  };

  const result = validateAndFixImageSpecs({ specs: [spec], cast, directives: [directive], maxPropsVisible: 7 });
  const fixed = result.specs[0];
  assert.ok(fixed.finalPromptText?.toLowerCase().includes("exactly"), "Prompt should enforce exact count");
  assert.ok(fixed.finalPromptText?.toLowerCase().includes("full body") || fixed.finalPromptText?.toLowerCase().includes("head-to-toe"), "Prompt should enforce full body");
  assert.ok(!(fixed.finalPromptText || "").toLowerCase().includes("negative prompt"), "Prompt should not contain negative section");
}

async function testIntegrationWithMocks() {
  const cast: CastSet = {
    avatars: [
      {
        characterId: "a1",
        displayName: "Lena",
        roleType: "AVATAR",
        slotKey: "SLOT_AVATAR_1",
        visualSignature: ["red hoodie"],
        outfitLock: ["red hoodie"],
        forbidden: ["adult"],
      },
    ],
    poolCharacters: [],
    artifact: {
      artifactId: "art1",
      name: "Glitzerstein",
      storyUseRule: "Helps navigate",
      visualRule: "glowing stone",
    },
    slotAssignments: {
      SLOT_AVATAR_1: "a1",
      SLOT_ARTIFACT_1: "art1",
    },
  };

  const directive: SceneDirective = {
    chapter: 1,
    setting: "forest",
    mood: "WONDER",
    charactersOnStage: ["SLOT_AVATAR_1", "SLOT_ARTIFACT_1"],
    goal: "find the path",
    conflict: "fog",
    outcome: "continue",
    artifactUsage: "artifact glows",
    canonAnchorLine: "Lena belongs here.",
    imageMustShow: ["forest", "Glitzerstein"],
    imageAvoid: ["looking at camera"],
  };

  const director = new TemplateImageDirector();
  const specs = await director.createImageSpecs({
    normalizedRequest: buildNormalized(123),
    cast,
    directives: [directive],
  });

  const fixed = validateAndFixImageSpecs({ specs, cast, directives: [directive], maxPropsVisible: 7 });
  assert.ok(fixed.specs[0].finalPromptText, "Image prompt should be generated");
}

function testWordBudget() {
  const budget = computeWordBudget({ lengthHint: "medium", chapterCount: 5, wpm: 140, pacing: "balanced" });
  const targets = buildLengthTargetsFromBudget(budget);
  assert.ok(budget.targetWords > 0, "Word budget target should be > 0");
  assert.ok(targets.wordMin < targets.wordMax, "Word targets should have min < max");
}

function testForbiddenCanonPhrase() {
  const cast: CastSet = {
    avatars: [
      {
        characterId: "a1",
        displayName: "Lena",
        roleType: "AVATAR",
        slotKey: "SLOT_AVATAR_1",
        visualSignature: ["red hoodie"],
        outfitLock: ["red hoodie"],
        forbidden: ["adult"],
      },
    ],
    poolCharacters: [],
    artifact: {
      artifactId: "art1",
      name: "Glitzerstein",
      storyUseRule: "Helps navigate",
      visualRule: "glowing stone",
    },
    slotAssignments: {
      SLOT_AVATAR_1: "a1",
      SLOT_ARTIFACT_1: "art1",
    },
  };

  const directive: SceneDirective = {
    chapter: 1,
    setting: "forest",
    mood: "WONDER",
    charactersOnStage: ["SLOT_AVATAR_1", "SLOT_ARTIFACT_1"],
    goal: "find the path",
    conflict: "fog",
    outcome: "continue",
    artifactUsage: "artifact glows",
    canonAnchorLine: "Lena belongs here.",
    imageMustShow: ["forest", "Glitzerstein"],
    imageAvoid: ["looking at camera"],
  };

  const draft = {
    title: "Test",
    description: "Test",
    chapters: [
      {
        chapter: 1,
        title: "Kapitel 1",
        text: "Lena gehoert seit jeher zu diesem Maerchen und ist ganz selbstverstaendlich dabei.",
      },
    ],
  };

  const result = validateStoryDraft({
    draft,
    directives: [directive],
    cast,
    language: "de",
    lengthTargets: { wordMin: 10, wordMax: 200 },
  });

  assert.ok(result.issues.some(issue => issue.code === "CANON_REPETITION"), "Forbidden canon phrase should be detected");
}

async function run() {
  testVariantDeterminism();
  testMatchingScore();
  testImageSpecValidation();
  testWordBudget();
  testForbiddenCanonPhrase();
  await testIntegrationWithMocks();
  console.log("Pipeline tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
