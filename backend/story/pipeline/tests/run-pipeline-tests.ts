import assert from "assert";
import { createVariantPlan } from "../variant-planner";
import { scoreCandidate } from "../matching-score";
import { validateAndFixImageSpecs } from "../image-prompt-validator";
import { TemplateImageDirector } from "../image-director";
import { computeWordBudget, buildLengthTargetsFromBudget } from "../word-budget";
import { validateStoryDraft } from "../story-validator";
import { splitContinuousStoryIntoChapters } from "../story-segmentation";
import { runQualityGates } from "../quality-gates";
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

function testContinuousStorySegmentation() {
  const directives: SceneDirective[] = [
    {
      chapter: 1,
      setting: "forest path",
      mood: "WONDER",
      charactersOnStage: ["SLOT_AVATAR_1"],
      goal: "start the journey",
      conflict: "thick fog",
      outcome: "they continue",
      artifactUsage: "artifact appears",
      canonAnchorLine: "stay brave",
      imageMustShow: ["forest"],
      imageAvoid: ["looking at camera"],
    },
    {
      chapter: 2,
      setting: "old bridge",
      mood: "TENSE",
      charactersOnStage: ["SLOT_AVATAR_1"],
      goal: "cross the bridge",
      conflict: "bridge shakes",
      outcome: "they reach the cave",
      artifactUsage: "artifact glows",
      canonAnchorLine: "keep moving",
      imageMustShow: ["bridge"],
      imageAvoid: ["looking at camera"],
    },
    {
      chapter: 3,
      setting: "cave entrance",
      mood: "MYSTERIOUS",
      charactersOnStage: ["SLOT_AVATAR_1"],
      goal: "find the hidden mark",
      conflict: "riddle on the wall",
      outcome: "they solve it",
      artifactUsage: "artifact reacts",
      canonAnchorLine: "trust your team",
      imageMustShow: ["cave"],
      imageAvoid: ["looking at camera"],
    },
    {
      chapter: 4,
      setting: "inner chamber",
      mood: "TENSE",
      charactersOnStage: ["SLOT_AVATAR_1"],
      goal: "open the stone gate",
      conflict: "final lock",
      outcome: "gate opens",
      artifactUsage: "artifact fails once, then works",
      canonAnchorLine: "never give up",
      imageMustShow: ["stone gate"],
      imageAvoid: ["looking at camera"],
    },
    {
      chapter: 5,
      setting: "sunny valley",
      mood: "TRIUMPH",
      charactersOnStage: ["SLOT_AVATAR_1"],
      goal: "return home",
      conflict: "none",
      outcome: "happy ending",
      artifactUsage: "artifact rests",
      canonAnchorLine: "home at last",
      imageMustShow: ["valley"],
      imageAvoid: ["looking at camera"],
    },
  ];

  const storyText = [
    "Lena zog den Mantel enger und trat auf den Waldpfad. Der Nebel roch nach nassem Moos, und irgendwo knackte ein Ast. \"Wir gehen trotzdem\", sagte sie und hob die Laterne.",
    "Am alten Steg knarrten die Bretter unter jedem Schritt. Lena atmete tief ein, tastete sich vor und lachte kurz, als ein Frosch ins Wasser sprang. \"Nur nicht stehen bleiben\", murmelte sie.",
    "Vor der Hoehle entdeckte sie eine eingeritzte Spur im Stein. Die Zeichen wirkten erst wirr, dann erkannte sie ein Muster und rief: \"Jetzt verstehe ich es!\"",
    "Im inneren Raum blockierte ein schweres Tor den Weg. Das Artefakt flackerte und wurde dunkel, doch Lena drueckte den Ring ein zweites Mal und der Mechanismus klickte laut.",
    "Draussen lag das Tal im goldenen Licht. Lena hielt kurz inne, steckte das Artefakt ein und grinste. \"Das war knapp\", sagte sie, dann lief sie den Weg nach Hause.",
  ].join("\\n\\n");

  const chapters = splitContinuousStoryIntoChapters({
    storyText,
    directives,
    language: "de",
    wordsPerChapter: { min: 25, max: 120 },
  });

  assert.strictEqual(chapters.length, directives.length, "Segmentation should produce one chapter per directive");
  assert.ok(chapters.every(ch => ch.text.trim().length > 0), "Each segmented chapter should contain text");
  assert.deepStrictEqual(
    chapters.map(ch => ch.chapter),
    directives.map(d => d.chapter),
    "Segmented chapters should keep directive chapter order"
  );
}

function testReadabilityGateForYoungAudience() {
  const directives: SceneDirective[] = [
    {
      chapter: 1,
      setting: "forest",
      mood: "WONDER",
      charactersOnStage: ["SLOT_AVATAR_1"],
      goal: "walk ahead",
      conflict: "fog",
      outcome: "keeps going",
      artifactUsage: "none",
      canonAnchorLine: "stay brave",
      imageMustShow: ["forest"],
      imageAvoid: [],
    },
  ];

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
      storyUseRule: "glows",
      visualRule: "glowing stone",
    },
    slotAssignments: { SLOT_AVATAR_1: "a1", SLOT_ARTIFACT_1: "art1" },
  };

  const draft = {
    title: "Test",
    description: "Test",
    chapters: [
      {
        chapter: 1,
        title: "",
        text: "Lena ging durch den Wald und beschrieb in einem einzigen, sehr langen Satz, wie jeder Ast, jeder Geruch, jede Wolke, jedes Rascheln und jedes winzige Detail zusammen mit ihren Gedanken in einer endlosen Schachtel aus Worten weiterlief, waehrend sie kaum Luft holen konnte und der Satz einfach nicht endete.",
      },
    ],
  };

  const report = runQualityGates({
    draft,
    directives,
    cast,
    language: "de",
    ageRange: { min: 6, max: 8 },
  });

  assert.ok(
    report.issues.some(issue => issue.code === "SENTENCE_COMPLEXITY_HIGH" || issue.code === "LONG_SENTENCE_OVERUSE"),
    "Readability gate should flag excessive sentence complexity for age 6-8"
  );
}

function testCharacterVoiceGate() {
  const directives: SceneDirective[] = [
    {
      chapter: 1,
      setting: "market",
      mood: "FUNNY",
      charactersOnStage: ["SLOT_AVATAR_1", "SLOT_HELPER_1", "SLOT_HELPER_2"],
      goal: "find the clue",
      conflict: "noise",
      outcome: "they continue",
      artifactUsage: "none",
      canonAnchorLine: "work together",
      imageMustShow: ["market"],
      imageAvoid: [],
    },
  ];

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
    poolCharacters: [
      {
        characterId: "c1",
        displayName: "Fanni",
        roleType: "HELPER",
        slotKey: "SLOT_HELPER_1",
        visualSignature: ["helmet"],
        outfitLock: ["helmet"],
        forbidden: [],
      },
      {
        characterId: "c2",
        displayName: "Peter",
        roleType: "HELPER",
        slotKey: "SLOT_HELPER_2",
        visualSignature: ["blue coat"],
        outfitLock: ["blue coat"],
        forbidden: [],
      },
    ],
    artifact: {
      artifactId: "art1",
      name: "Glitzerstein",
      storyUseRule: "glows",
      visualRule: "glowing stone",
    },
    slotAssignments: {
      SLOT_AVATAR_1: "a1",
      SLOT_HELPER_1: "c1",
      SLOT_HELPER_2: "c2",
      SLOT_ARTIFACT_1: "art1",
    },
  };

  const draft = {
    title: "Test",
    description: "Test",
    chapters: [
      {
        chapter: 1,
        title: "",
        text: "Lena, Fanni und Peter liefen ueber den Markt. Lena hob einen Korb. Fanni zeigte auf den Brunnen. Peter trug den Rucksack. Sie suchten weiter und fanden eine Spur im Staub.",
      },
    ],
  };

  const report = runQualityGates({
    draft,
    directives,
    cast,
    language: "de",
    ageRange: { min: 6, max: 8 },
  });

  assert.ok(
    report.issues.some(issue => issue.code === "VOICE_INDISTINCT"),
    "Character voice gate should flag missing distinct speakers in multi-character scenes"
  );
}

function testCharacterFocusGate() {
  const directives: SceneDirective[] = [
    {
      chapter: 1,
      setting: "camp",
      mood: "TENSE",
      charactersOnStage: ["SLOT_AVATAR_1", "SLOT_HELPER_1", "SLOT_HELPER_2", "SLOT_HELPER_3", "SLOT_HELPER_4"],
      goal: "solve puzzle",
      conflict: "time pressure",
      outcome: "they move on",
      artifactUsage: "none",
      canonAnchorLine: "stay focused",
      imageMustShow: ["camp"],
      imageAvoid: [],
    },
  ];

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
    poolCharacters: [
      { characterId: "c1", displayName: "Fanni", roleType: "HELPER", slotKey: "SLOT_HELPER_1", visualSignature: [], outfitLock: [], forbidden: [] },
      { characterId: "c2", displayName: "Peter", roleType: "HELPER", slotKey: "SLOT_HELPER_2", visualSignature: [], outfitLock: [], forbidden: [] },
      { characterId: "c3", displayName: "Mika", roleType: "HELPER", slotKey: "SLOT_HELPER_3", visualSignature: [], outfitLock: [], forbidden: [] },
      { characterId: "c4", displayName: "Nora", roleType: "HELPER", slotKey: "SLOT_HELPER_4", visualSignature: [], outfitLock: [], forbidden: [] },
    ],
    artifact: {
      artifactId: "art1",
      name: "Glitzerstein",
      storyUseRule: "glows",
      visualRule: "glowing stone",
    },
    slotAssignments: {
      SLOT_AVATAR_1: "a1",
      SLOT_HELPER_1: "c1",
      SLOT_HELPER_2: "c2",
      SLOT_HELPER_3: "c3",
      SLOT_HELPER_4: "c4",
      SLOT_ARTIFACT_1: "art1",
    },
  };

  const draft = {
    title: "Test",
    description: "Test",
    chapters: [
      {
        chapter: 1,
        title: "",
        text: "Lena rief: \"Los!\" Fanni zeigte auf die Karte. Peter zog am Seil. Mika hob die Kiste. Nora oeffnete die Kiste. Alle redeten durcheinander und rannten weiter.",
      },
    ],
  };

  const report = runQualityGates({
    draft,
    directives,
    cast,
    language: "de",
    ageRange: { min: 6, max: 8 },
  });

  assert.ok(
    report.issues.some(issue => issue.code === "TOO_MANY_ACTIVE_CHARACTERS"),
    "Character focus gate should flag more than 4 active characters"
  );
}

function testStakesAndLowpointGate() {
  const directives: SceneDirective[] = [
    {
      chapter: 1,
      setting: "forest",
      mood: "WONDER",
      charactersOnStage: ["SLOT_AVATAR_1"],
      goal: "start",
      conflict: "none",
      outcome: "continue",
      artifactUsage: "none",
      canonAnchorLine: "go",
      imageMustShow: ["forest"],
      imageAvoid: [],
    },
    {
      chapter: 2,
      setting: "path",
      mood: "WONDER",
      charactersOnStage: ["SLOT_AVATAR_1"],
      goal: "walk",
      conflict: "none",
      outcome: "continue",
      artifactUsage: "none",
      canonAnchorLine: "go",
      imageMustShow: ["path"],
      imageAvoid: [],
    },
    {
      chapter: 3,
      setting: "bridge",
      mood: "TENSE",
      charactersOnStage: ["SLOT_AVATAR_1"],
      goal: "cross",
      conflict: "none",
      outcome: "continue",
      artifactUsage: "none",
      canonAnchorLine: "go",
      imageMustShow: ["bridge"],
      imageAvoid: [],
    },
    {
      chapter: 4,
      setting: "home",
      mood: "TRIUMPH",
      charactersOnStage: ["SLOT_AVATAR_1"],
      goal: "arrive",
      conflict: "none",
      outcome: "finish",
      artifactUsage: "none",
      canonAnchorLine: "go",
      imageMustShow: ["home"],
      imageAvoid: [],
    },
  ];

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
      storyUseRule: "glows",
      visualRule: "glowing stone",
    },
    slotAssignments: { SLOT_AVATAR_1: "a1", SLOT_ARTIFACT_1: "art1" },
  };

  const draft = {
    title: "Test",
    description: "Test",
    chapters: [
      { chapter: 1, title: "", text: "Lena ging los und winkte." },
      { chapter: 2, title: "", text: "Lena lief weiter und summte." },
      { chapter: 3, title: "", text: "Lena sah den Fluss und ging ruhig darueber." },
      { chapter: 4, title: "", text: "Lena kam an und lachte." },
    ],
  };

  const report = runQualityGates({
    draft,
    directives,
    cast,
    language: "de",
    ageRange: { min: 6, max: 8 },
  });

  assert.ok(
    report.issues.some(issue => issue.code === "MISSING_EXPLICIT_STAKES"),
    "Stakes gate should require explicit early consequence"
  );
  assert.ok(
    report.issues.some(issue => issue.code === "MISSING_LOWPOINT"),
    "Lowpoint gate should require a clear setback in chapter 3/4"
  );
}

function testBannedWordGate() {
  const directives: SceneDirective[] = [
    {
      chapter: 1,
      setting: "yard",
      mood: "COZY",
      charactersOnStage: ["SLOT_AVATAR_1"],
      goal: "listen",
      conflict: "none",
      outcome: "continue",
      artifactUsage: "none",
      canonAnchorLine: "stay calm",
      imageMustShow: ["yard"],
      imageAvoid: [],
    },
  ];

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
      storyUseRule: "glows",
      visualRule: "glowing stone",
    },
    slotAssignments: { SLOT_AVATAR_1: "a1", SLOT_ARTIFACT_1: "art1" },
  };

  const draft = {
    title: "Test",
    description: "Test",
    chapters: [
      {
        chapter: 1,
        title: "",
        text: "Lena ging ploetzlich los und war sehr nervoes.",
      },
    ],
  };

  const report = runQualityGates({
    draft,
    directives,
    cast,
    language: "de",
    ageRange: { min: 6, max: 8 },
  });

  assert.ok(
    report.issues.some(issue => issue.code === "BANNED_WORD_USED"),
    "Banned word gate should flag forbidden filler words"
  );
}

function testEndingStabilityGate() {
  const directives: SceneDirective[] = [
    {
      chapter: 1,
      setting: "hill",
      mood: "TRIUMPH",
      charactersOnStage: ["SLOT_AVATAR_1"],
      goal: "finish",
      conflict: "none",
      outcome: "done",
      artifactUsage: "none",
      canonAnchorLine: "home",
      imageMustShow: ["hill"],
      imageAvoid: [],
    },
  ];

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
      storyUseRule: "glows",
      visualRule: "glowing stone",
    },
    slotAssignments: { SLOT_AVATAR_1: "a1", SLOT_ARTIFACT_1: "art1" },
  };

  const draft = {
    title: "Test",
    description: "Test",
    chapters: [
      {
        chapter: 1,
        title: "",
        text: "Lena lachte. Alle nickten. Am naechsten Morgen wartete ein neues Raetsel.",
      },
    ],
  };

  const report = runQualityGates({
    draft,
    directives,
    cast,
    language: "de",
    ageRange: { min: 6, max: 8 },
  });

  assert.ok(
    report.issues.some(issue => issue.code === "ENDING_UNRESOLVED"),
    "Ending gate should flag unresolved uncertainty at the end"
  );
}

async function run() {
  testVariantDeterminism();
  testMatchingScore();
  testImageSpecValidation();
  testWordBudget();
  testForbiddenCanonPhrase();
  testContinuousStorySegmentation();
  testReadabilityGateForYoungAudience();
  testCharacterVoiceGate();
  testCharacterFocusGate();
  testStakesAndLowpointGate();
  testBannedWordGate();
  testEndingStabilityGate();
  await testIntegrationWithMocks();
  console.log("Pipeline tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
