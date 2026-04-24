import assert from "assert";
import { readFileSync } from "fs";
import { createVariantPlan } from "../variant-planner";
import { scoreCandidate } from "../matching-score";
import { validateAndFixImageSpecs } from "../image-prompt-validator";
import { TemplateImageDirector } from "../image-director";
import { computeWordBudget, buildLengthTargetsFromBudget } from "../word-budget";
import { validateStoryDraft } from "../story-validator";
import { splitContinuousStoryIntoChapters } from "../story-segmentation";
import { runQualityGates } from "../quality-gates";
import { validateV8Blueprint } from "../blueprint-validator";
import { resolvePromptVersionForRequest } from "../blueprint-generator";
import { buildV8BlueprintSystemPrompt, buildV8RevisionPrompt, buildV8StoryPrompt, buildV8StorySystemPrompt } from "../prompts";
import { determineCriticVerdict, normalizeCriticReport } from "../semantic-critic";
import { repairCastSet } from "../castset-normalizer";
import { validateCastSet } from "../schema-validator";
import type { CastSet, ImageSpec, NormalizedRequest, RoleSlot, SceneDirective, StoryBlueprintBase, StoryBlueprintV8, StoryDNA } from "../types";

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

function buildTestCast(): CastSet {
  return {
    avatars: [
      {
        characterId: "a1",
        displayName: "Alexander",
        roleType: "AVATAR",
        slotKey: "SLOT_AVATAR_1",
        personalityTags: ["beobachtend"],
        speechStyleHints: ["ruhig und genau"],
        visualSignature: ["brown hair"],
        outfitLock: ["simple jacket"],
        forbidden: ["adult"],
      },
      {
        characterId: "a2",
        displayName: "Adrian",
        roleType: "AVATAR",
        slotKey: "SLOT_AVATAR_2",
        personalityTags: ["draufgaengerisch"],
        speechStyleHints: ["kurz und impulsiv"],
        visualSignature: ["blonde hair"],
        outfitLock: ["simple shirt"],
        forbidden: ["adult"],
      },
    ],
    poolCharacters: [
      {
        characterId: "p1",
        displayName: "Zauberer Sternenschweif",
        roleType: "HELPER",
        slotKey: "SLOT_HELPER_1",
        speechStyleHints: ["melodisch"],
        visualSignature: ["langer Sternenmantel"],
        outfitLock: ["schweifender Mantel"],
        forbidden: [],
      },
      {
        characterId: "p2",
        displayName: "Morbus",
        roleType: "ANTAGONIST",
        slotKey: "SLOT_ANTAGONIST_1",
        speechStyleHints: ["tief und knapp"],
        visualSignature: ["russdunkler Mantel"],
        outfitLock: ["violette Runen"],
        forbidden: [],
      },
    ],
    artifact: {
      artifactId: "art1",
      name: "Gluecksmuenze",
      storyUseRule: "zeigt die Spur, loest sie aber nicht",
      visualRule: "kleine silberne Muenze",
    },
    slotAssignments: {
      SLOT_AVATAR_1: "a1",
      SLOT_AVATAR_2: "a2",
      SLOT_HELPER_1: "p1",
      SLOT_ANTAGONIST_1: "p2",
      SLOT_ARTIFACT_1: "art1",
    },
  };
}

function buildFiveDirectives(): SceneDirective[] {
  return [
    {
      chapter: 1,
      setting: "Thronhalle mit silbernen Wegen",
      mood: "WONDER",
      charactersOnStage: ["SLOT_AVATAR_1", "SLOT_AVATAR_2"],
      goal: "die erste Spur lesen",
      conflict: "eine falsche Spur fuehrt in den Flammenflur",
      outcome: "eine Gluecksmuenze blinkt am Ende des Kreises",
      artifactUsage: "die Muenze glimmt kurz",
      canonAnchorLine: "Alexander merkt kleine Details, Adrian drueckt nach vorn.",
      imageMustShow: ["silberne Wege", "Thronhalle"],
      imageAvoid: [],
    },
    {
      chapter: 2,
      setting: "Waldrand mit krummen Wurzeln",
      mood: "MYSTERIOUS",
      charactersOnStage: ["SLOT_AVATAR_1", "SLOT_AVATAR_2", "SLOT_HELPER_1"],
      goal: "der naeheren Spur folgen",
      conflict: "bewegliche Aeste versperren den sicheren Pfad",
      outcome: "der Raetsel-Baum zieht die Kinder tiefer hinein",
      artifactUsage: "die Muenze wird warm",
      canonAnchorLine: "Sternenschweif warnt, loest aber nichts.",
      imageMustShow: ["Waldrand", "Aeste"],
      imageAvoid: [],
    },
    {
      chapter: 3,
      setting: "vor dem Raetsel-Baum",
      mood: "TENSE",
      charactersOnStage: ["SLOT_AVATAR_1", "SLOT_AVATAR_2", "SLOT_ANTAGONIST_1"],
      goal: "durch die Ast-Barriere kommen",
      conflict: "Alexanders laute Idee aktiviert Morbus' Runen",
      outcome: "der Rueckweg verschwindet hinter violettem Rauch",
      artifactUsage: "die Muenze zeigt nur den Schaden",
      canonAnchorLine: "Der Fehler kommt aus Alexander selbst.",
      imageMustShow: ["Raetsel-Baum", "Runen"],
      imageAvoid: [],
    },
    {
      chapter: 4,
      setting: "enger Waldkreis hinter der Rune",
      mood: "SAD",
      charactersOnStage: ["SLOT_AVATAR_1", "SLOT_AVATAR_2"],
      goal: "den Rueckweg wiederfinden",
      conflict: "Angst, Stille und falsche Zeichen lassen alles verloren wirken",
      outcome: "Adrian entdeckt kleine echte Spuren am Boden",
      artifactUsage: "die Muenze bleibt still",
      canonAnchorLine: "Die Wende kommt aus Beobachtung und Freundschaft.",
      imageMustShow: ["enge Baeume", "Bodenzeichen"],
      imageAvoid: [],
    },
    {
      chapter: 5,
      setting: "Lichtkreis mitten im Wald",
      mood: "TRIUMPH",
      charactersOnStage: ["SLOT_AVATAR_1", "SLOT_AVATAR_2", "SLOT_ANTAGONIST_1"],
      goal: "den richtigen Pfad befreien",
      conflict: "Morbus schlaegt noch einmal nach der Muenze",
      outcome: "der Weg zu Schneewittchen wird frei",
      artifactUsage: "die Muenze zeigt den Kreis, nicht die Loesung",
      canonAnchorLine: "Alexander haelt inne, Adrian darf zuerst sprechen.",
      imageMustShow: ["Lichtkreis", "Waldpfad"],
      imageAvoid: [],
    },
  ];
}

function buildValidV8Blueprint(): StoryBlueprintV8 {
  return {
    title: "Die Muenze im Kreis",
    teaser: "Warum lacht die Spur, bevor sie den richtigen Weg zeigt?",
    setting_type: "fantasy_familiar",
    narrative_perspective: "personal_third",
    tense: "preterite",
    pov_character: "Alexander",
    chapters: [
      {
        chapter: 1,
        arc_label: "SETUP",
        location: "In der Thronhalle glitzerten silberne Wege, und die Luft roch nach kaltem Stein.",
        goal: "Alexander und Adrian wollen die erste Spur lesen.",
        obstacle: "Eine falsche Spur fuehrt genau dorthin, wo Morbus warten koennte.",
        active_characters: ["Alexander", "Adrian"],
        supporting_characters: [],
        key_emotion: "Neugier mit leichtem Ziehen im Bauch",
        key_scene: {
          what_happens: "Adrian springt schon auf den ersten Weg, waehrend Alexander auf die Schatten zeigt.",
          playable_moment: "Adrian drueckt sein Ohr an den Boden und tut so, als hoere er die Muenze klingeln.",
          quotable_line: "Die Spur grinst. Das ist nie ein gutes Zeichen.",
        },
        chapter_hook: "Am Ende des Kreises liegt eine Muenze mit dem Wort Glueck.",
        word_target: 320,
        dialogue_percentage: 30,
      },
      {
        chapter: 2,
        arc_label: "DISCOVERY",
        location: "Am Waldrand knackten Wurzeln, und feuchtes Moos roch dunkel und weich.",
        goal: "Die Kinder folgen der scheinbar schnelleren Spur.",
        obstacle: "Der Raetsel-Baum schiebt bewegliche Aeste in den sicheren Pfad.",
        active_characters: ["Alexander", "Adrian"],
        supporting_characters: ["Zauberer Sternenschweif"],
        key_emotion: "Mut mit wachsender Spannung",
        key_scene: {
          what_happens: "Sternenschweif warnt nur kurz, dann muessen die Kinder selbst entscheiden.",
          playable_moment: "Adrian duckt sich unter einen Ast und macht ein knarzendes Baumgeraeusch nach.",
          quotable_line: "Der Wald ist bestimmt gegen Orientierung allergisch.",
        },
        chapter_hook: "Zwischen den Aesten leuchtet ein violetter Riss auf.",
        word_target: 324,
        dialogue_percentage: 31,
      },
      {
        chapter: 3,
        arc_label: "TURNING_POINT",
        location: "Vor dem Raetsel-Baum glimmten Runen wie heisse Kohlen im Nebel.",
        goal: "Alexander will die Ast-Barriere ueberlisten.",
        obstacle: "Er ruft seine Idee zu frueh heraus und aktiviert Morbus' Runen.",
        active_characters: ["Alexander", "Adrian"],
        supporting_characters: ["Morbus"],
        key_emotion: "Scham und Druck nach dem Fehler",
        key_scene: {
          what_happens: "Alexander hebt beide Arme, ruft seinen Plan hinaus und sieht im selben Moment die Runen aufblitzen.",
          playable_moment: "Er reisst die Arme hoch und friert dann mitten in der Bewegung ein.",
          quotable_line: "Wartet! Ich weiss es! ... Oh.",
        },
        chapter_hook: "Der Rueckweg klappt hinter violettem Rauch zu.",
        word_target: 328,
        dialogue_percentage: 28,
      },
      {
        chapter: 4,
        arc_label: "DARKEST_MOMENT",
        location: "Im engen Waldkreis standen die Stamme dicht, und nasse Blaetter klebten an den Schuhen.",
        goal: "Die Kinder wollen den verlorenen Rueckweg wiederfinden.",
        obstacle: "Angst und falsche Zeichen lassen jede Richtung gleich aussehen.",
        active_characters: ["Alexander", "Adrian"],
        supporting_characters: [],
        key_emotion: "Fast-Aufgeben mit kleinem innerem Funken",
        key_scene: {
          what_happens: "Alexander legt die Hand an die kalte Luft, als koenne er die Zeit rueckwaerts schieben, bis Adrian auf winzige Zeichen am Boden zeigt.",
          playable_moment: "Alexander tastet in die Luft, dann gehen beide gleichzeitig auf die Knie und suchen den Boden ab.",
          quotable_line: "Nicht schneller. Richtiger.",
        },
        chapter_hook: "Die echte Spur fuehrt als kaum sichtbarer Kreis aus dem Dunkel.",
        word_target: 332,
        dialogue_percentage: 25,
      },
      {
        chapter: 5,
        arc_label: "LANDING",
        location: "Im Lichtkreis roch die Luft ploetzlich nach warmem Harz, und die Baeume standen offen wie ein Tor.",
        goal: "Die Kinder wollen den richtigen Pfad befreien, bevor Morbus zuschlaegt.",
        obstacle: "Morbus greift noch einmal nach der Gluecksmuenze.",
        active_characters: ["Alexander", "Adrian"],
        supporting_characters: ["Morbus"],
        key_emotion: "Erleichterung und stille Reife",
        key_scene: {
          what_happens: "Alexander haelt diesmal an, laesst Adrian zuerst sprechen und setzt den letzten Schritt erst danach.",
          playable_moment: "Adrian streckt die Hand vor, Alexander nickt knapp und beide setzen gleichzeitig einen Fuss in den Lichtkreis.",
          quotable_line: "Diesmal redest du zuerst.",
        },
        chapter_hook: "Die Spur endet im richtigen Kreis, und der Pfad bleibt offen.",
        word_target: 330,
        dialogue_percentage: 30,
      },
    ],
    humor_beats: [
      { chapter: 1, type: "character_behavior", description: "Adrian tut so, als knurre die Muenze in seinem Bauch." },
      { chapter: 5, type: "warm_callback", description: "Die lachende Spur aus Kapitel 1 endet nun wirklich im richtigen Kreis." },
    ],
    error_and_repair: {
      who: "Alexander",
      error_chapter: 3,
      error: "Alexander ruft seinen Plan laut heraus, bevor er ihn prueft.",
      inner_reason: "Er will Kontrolle zurueckgewinnen und klueger wirken als die Falle.",
      body_signal: "Ein Knoten zieht sich durch seinen Bauch, die Haende werden kalt, die Kehle eng.",
      repair_chapter: 5,
      repair: "Alexander haelt inne, laesst Adrian zuerst sprechen und fuehrt dann ruhiger weiter.",
    },
    arc_checkpoints: {
      ch1_feeling: "wissbegierig und leicht uebermuetig",
      ch2_feeling: "mutig, aber unsicherer als vorher",
      ch3_feeling: "Scham und Angst nach dem Fehler",
      ch4_feeling: "Tiefpunkt mit einem kleinen neuen Entschluss",
      ch5_feeling: "Erleichterung, Waerme und neue Ruhe",
    },
    iconic_scene: {
      chapter: 3,
      description: "Alexander reisst die Arme hoch, ruft seinen Plan hinaus und friert ein, als die Runen antworten.",
    },
    concrete_anchors: {
      trust: "die kleine Muenze, die Alexander und Adrian zwischen den Fingern hin- und herreichen",
      mistake: "der eingefrorene Moment nach Alexanders Ruf im Kreis",
      repair: "Alexander laesst Adrian zuerst sprechen und legt die Muenze in die Mitte",
    },
    ending_pattern: "warm_callback",
  };
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

function testCastSetRepairTruncatesLongCharacterLocks() {
  const longVisual = "green eyes ".repeat(20);
  const longOutfit = "a very detailed weathered forest cloak with stitched silver leaves and tiny pockets ".repeat(3);
  const cast = buildTestCast();
  cast.poolCharacters[0].visualSignature = [longVisual];
  cast.poolCharacters[0].outfitLock = [longOutfit];

  const repaired = repairCastSet(cast);
  const validation = validateCastSet(repaired);

  assert.strictEqual(validation.valid, true, `Repaired cast set should pass schema: ${validation.errors.join("; ")}`);
  assert.ok(
    repaired.poolCharacters[0].visualSignature.every(item => item.length <= 120),
    "visualSignature entries should be capped at schema maxLength"
  );
  assert.ok(
    repaired.poolCharacters[0].outfitLock.every(item => item.length <= 120),
    "outfitLock entries should be capped at schema maxLength"
  );
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
  assert.ok(
    report.issues.some(issue => issue.code === "VOICE_INDISTINCT" && issue.severity === "ERROR"),
    "Character voice gate should treat indistinct voices as ERROR for age 6-8"
  );
}

function testRoleLabelOveruseSeverity() {
  const directives: SceneDirective[] = [
    {
      chapter: 1,
      setting: "road",
      mood: "COZY",
      charactersOnStage: ["SLOT_AVATAR_1", "SLOT_HELPER_1"],
      goal: "walk",
      conflict: "none",
      outcome: "continue",
      artifactUsage: "none",
      canonAnchorLine: "go",
      imageMustShow: ["road"],
      imageAvoid: [],
    },
  ];

  const cast: CastSet = {
    avatars: [
      {
        characterId: "a1",
        displayName: "Adrian",
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
        text: "Feuerwehrfrau Fanni hob die Tasche. Feuerwehrfrau Fanni sagte: \"Langsam.\" Feuerwehrfrau Fanni zeigte auf den Weg. Adrian nickte.",
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
    report.issues.some(issue => issue.code === "ROLE_LABEL_OVERUSE" && issue.severity === "ERROR"),
    "Role label overuse should be ERROR for age 6-8"
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

function testGlobalCharacterLoadGate() {
  const directives: SceneDirective[] = [
    {
      chapter: 1,
      setting: "path",
      mood: "WONDER",
      charactersOnStage: ["SLOT_AVATAR_1", "SLOT_HELPER_1"],
      goal: "start",
      conflict: "fog",
      outcome: "continue",
      artifactUsage: "none",
      canonAnchorLine: "go",
      imageMustShow: ["path"],
      imageAvoid: [],
    },
    {
      chapter: 2,
      setting: "bridge",
      mood: "TENSE",
      charactersOnStage: ["SLOT_AVATAR_1", "SLOT_HELPER_2"],
      goal: "cross",
      conflict: "wind",
      outcome: "continue",
      artifactUsage: "none",
      canonAnchorLine: "go",
      imageMustShow: ["bridge"],
      imageAvoid: [],
    },
    {
      chapter: 3,
      setting: "cave",
      mood: "MYSTERIOUS",
      charactersOnStage: ["SLOT_AVATAR_1", "SLOT_HELPER_3"],
      goal: "find clue",
      conflict: "dark",
      outcome: "continue",
      artifactUsage: "none",
      canonAnchorLine: "go",
      imageMustShow: ["cave"],
      imageAvoid: [],
    },
    {
      chapter: 4,
      setting: "yard",
      mood: "COZY",
      charactersOnStage: ["SLOT_AVATAR_1", "SLOT_HELPER_4"],
      goal: "return",
      conflict: "none",
      outcome: "finish",
      artifactUsage: "none",
      canonAnchorLine: "go",
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
      { chapter: 1, title: "", text: "Lena nahm die Karte. Fanni zeigte auf den Pfad und sagte: \"Hier lang!\"" },
      { chapter: 2, title: "", text: "Lena hielt das Seil fest. Peter rief: \"Die Bretter sind locker!\"" },
      { chapter: 3, title: "", text: "Lena hob die Lampe. Mika fluesterte: \"Da ist eine Spur im Stein.\"" },
      { chapter: 4, title: "", text: "Lena lachte leise. Nora oeffnete das Tor und sagte: \"Wir sind zu Hause.\"" },
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
    report.issues.some(issue => issue.code === "GLOBAL_CAST_OVERLOAD" && issue.severity === "ERROR"),
    "Global character load gate should flag too many actively distinct characters for age 6-8"
  );
}

function testChildEmotionArcSeverity() {
  const directives: SceneDirective[] = [
    {
      chapter: 1,
      setting: "meadow",
      mood: "COZY",
      charactersOnStage: ["SLOT_AVATAR_1"],
      goal: "walk",
      conflict: "none",
      outcome: "continue",
      artifactUsage: "none",
      canonAnchorLine: "go",
      imageMustShow: ["meadow"],
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
      { chapter: 1, title: "", text: "Lena ging den Weg entlang. Sie hob einen Stein auf und lief weiter." },
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
    report.issues.some(issue => issue.code === "MISSING_INNER_CHILD_MOMENT" && issue.severity === "ERROR"),
    "Child emotion gate should treat missing inner child moment as ERROR for age 6-8"
  );
  assert.ok(
    report.issues.some(issue => issue.code === "NO_CHILD_ERROR_CORRECTION_ARC" && issue.severity === "ERROR"),
    "Child emotion gate should treat missing error-correction arc as ERROR for age 6-8"
  );
}

function testImageryDensitySeverity() {
  const directives: SceneDirective[] = [
    {
      chapter: 1,
      setting: "forest",
      mood: "WONDER",
      charactersOnStage: ["SLOT_AVATAR_1"],
      goal: "walk",
      conflict: "fog",
      outcome: "continue",
      artifactUsage: "none",
      canonAnchorLine: "go",
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
        text: "Lena ging wie eine Feder durch den Wald. Der Nebel kroch wie ein Tuch ueber den Weg. Die Aeste klangen, als ob Trommeln im Himmel schlugen. Ihr Atem war wie ein kleiner Motor. Die Schatten tanzten, als ob sie Namen kannten. Das Gras glitzerte wie ein Meer aus Glas.",
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
    report.issues.some(
      issue =>
        (issue.code === "IMAGERY_DENSITY_HIGH" || issue.code === "METAPHOR_OVERLOAD") &&
        issue.severity === "ERROR"
    ),
    "Imagery gates should treat dense metaphor/comparison language as ERROR for age 6-8"
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

function testLowpointTooSoftGate() {
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
      mood: "TENSE",
      charactersOnStage: ["SLOT_AVATAR_1"],
      goal: "hurry",
      conflict: "rain",
      outcome: "continue",
      artifactUsage: "none",
      canonAnchorLine: "go",
      imageMustShow: ["path"],
      imageAvoid: [],
    },
    {
      chapter: 3,
      setting: "gate",
      mood: "TENSE",
      charactersOnStage: ["SLOT_AVATAR_1"],
      goal: "open gate",
      conflict: "lock",
      outcome: "continue",
      artifactUsage: "none",
      canonAnchorLine: "go",
      imageMustShow: ["gate"],
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
      { chapter: 1, title: "", text: "Lena sagte: Wenn wir es nicht schaffen, dann bleibt das Tor zu." },
      { chapter: 2, title: "", text: "Lena lief schneller und hielt die Karte fest." },
      { chapter: 3, title: "", text: "Lena scheiterte am Schloss und schluckte. Das war keine Katastrophe, nur ein kleiner Schreck." },
      { chapter: 4, title: "", text: "Lena fand den zweiten Hebel und kam nach Hause." },
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
    report.issues.some(issue => issue.code === "LOWPOINT_TOO_SOFT" && issue.severity === "ERROR"),
    "Lowpoint gate should reject softened setbacks for age 6-8"
  );
}

function testFilterPlaceholderGate() {
  const directives: SceneDirective[] = [
    {
      chapter: 1,
      setting: "hut",
      mood: "COZY",
      charactersOnStage: ["SLOT_AVATAR_1"],
      goal: "listen",
      conflict: "none",
      outcome: "continue",
      artifactUsage: "none",
      canonAnchorLine: "go",
      imageMustShow: ["hut"],
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
        text: "Lena sah Bruno an. Dann sagte er: Das [inhalt-gefiltert]en wir hin.",
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
    report.issues.some(issue => issue.code === "FILTER_PLACEHOLDER" && issue.severity === "ERROR"),
    "Instruction leak gate should reject filter placeholders in final prose"
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
  assert.ok(
    report.issues.some(issue => issue.code === "ENDING_UNRESOLVED" && issue.severity === "ERROR"),
    "Ending gate should treat unresolved ending as ERROR for age 6-8"
  );
}

function testPromptVersionResolverV8Rollout() {
  assert.strictEqual(
    resolvePromptVersionForRequest({
      requestedPromptVersion: "v8",
      defaultPromptVersion: "v7",
      language: "en",
      ageMax: 10,
      chapterCount: 7,
    }),
    "v8",
    "Explicit prompt version must win"
  );

  assert.strictEqual(
    resolvePromptVersionForRequest({
      defaultPromptVersion: "v7",
      language: "de",
      ageMax: 8,
      chapterCount: 5,
    }),
    "v8",
    "German 5-chapter stories for age 6-8 should auto-enable V8 during rollout"
  );

  assert.strictEqual(
    resolvePromptVersionForRequest({
      defaultPromptVersion: "v8",
      language: "de",
      ageMax: 8,
      chapterCount: 3,
    }),
    "v8",
    "When the global default points to V8, non-rollout stories should still follow that default"
  );
}

function testV8BlueprintValidation() {
  const validBlueprint = buildValidV8Blueprint();
  const valid = validateV8Blueprint({
    blueprint: validBlueprint,
    chapterCount: 5,
    ageMax: 8,
    wordsPerChapter: { min: 280, max: 392 },
  });
  assert.strictEqual(valid.valid, true, "Valid V8 blueprint should pass");

  const invalidBlueprint = JSON.parse(JSON.stringify(validBlueprint)) as StoryBlueprintV8;
  invalidBlueprint.chapters[2].active_characters = ["Alexander", "Adrian", "Morbus"];
  invalidBlueprint.chapters[2].key_scene.playable_moment = "Alexander ruft seine Idee verr";
  invalidBlueprint.chapters[0].goal = "Die Kinder wollen trotz ein belauschtes Geheimnis den naechsten Hinweis erreichen.";
  invalidBlueprint.chapters[0].key_scene.what_happens = "Adrian und Alexander muessen auf das reagieren, was in deep forest schiefgeht.";
  invalidBlueprint.chapters.forEach((chapter) => {
    chapter.key_scene.quotable_line = "\"Nicht weglaufen. Erst hinschauen.\"";
  });
  invalidBlueprint.chapters[3].arc_label = "LANDING";
  invalidBlueprint.pov_character = "Morbus";

  const invalid = validateV8Blueprint({
    blueprint: invalidBlueprint,
    chapterCount: 5,
    ageMax: 8,
    wordsPerChapter: { min: 280, max: 392 },
  });
  const codes = new Set(invalid.issues.map((issue) => issue.code));
  assert.strictEqual(invalid.valid, false, "Invalid V8 blueprint should fail");
  assert.ok(codes.has("ACTIVE_CHARACTERS_OVER_LIMIT"), "Validator should reject overloaded foreground casts");
  assert.ok(codes.has("FIELD_TRUNCATED"), "Validator should detect truncated chapter fields");
  assert.ok(codes.has("FIELD_TOO_ABSTRACT"), "Validator should reject abstract placeholder blueprint language");
  assert.ok(codes.has("ARC_LABEL_INVALID"), "Validator should enforce strict V8 arc order");
  assert.ok(codes.has("POV_PRESENCE_TOO_LOW"), "Validator should require the POV child across the arc");
  assert.ok(codes.has("QUOTABLE_LINE_REPEATED"), "Validator should reject repeated placeholder quotable lines");
}

function testV8WriterPromptRegression() {
  const legacyPrompt = readFileSync("Logs/logs/extracted-fullstory-prompt-6ea4688e.txt", "utf8");
  assert.ok(legacyPrompt.includes("Was danach anders ist: Morbus"), "Regression fixture must contain the old truncated beat line");
  assert.ok(legacyPrompt.includes("entscheidet sich, kur"), "Regression fixture must contain the old Chapter 4 truncation");
  assert.ok(legacyPrompt.includes("nur diesmal rich"), "Regression fixture must contain the old Chapter 5 truncation");

  const blueprintSystemPrompt = buildV8BlueprintSystemPrompt("de");
  assert.ok(blueprintSystemPrompt.includes("Return valid JSON only"), "V8 blueprint system prompt should carry structural instructions in English");
  assert.ok(blueprintSystemPrompt.includes("never use more than 2 active characters per chapter"), "Blueprint system prompt should express hard constraints in English");
  assert.ok(blueprintSystemPrompt.includes("define any secret, bluff, false lead, trap, or price"), "Blueprint system prompt should force abstract mechanics to become concrete");

  const storySystemPrompt = buildV8StorySystemPrompt("de");
  assert.ok(storySystemPrompt.includes("Structural rules:"), "V8 story system prompt should use English structural guidance");
  assert.ok(storySystemPrompt.includes("GERMAN STYLE RULES"), "V8 story system prompt should contain a dedicated German style block");
  assert.ok(storySystemPrompt.includes("Kein Fremdwort"), "German lexical style rules should stay in German");
  assert.ok(storySystemPrompt.includes("realize the blueprint's key scenes"), "V8 story system prompt should force explicit blueprint realization");
  assert.ok(storySystemPrompt.includes("Mindestens zwei ehrliche Schmunzelmomente"), "German humor requirement should stay explicit");

  const prompt = buildV8StoryPrompt({
    blueprint: buildValidV8Blueprint(),
    cast: buildTestCast(),
    language: "de",
    chapterCount: 5,
    totalWordMin: 1400,
    totalWordMax: 1960,
    wordsPerChapter: { min: 280, max: 392 },
  });

  assert.ok(!prompt.includes("SELF-CHECK"), "V8 writer prompt must not include self-check rhetoric");
  assert.ok(!prompt.includes("Was danach anders ist:"), "V8 writer prompt must not include old beat prose labels");
  assert.ok(!prompt.includes("entscheidet sich, kur"), "V8 writer prompt must not include truncated Chapter 4 fragments");
  assert.ok(!prompt.includes("nur diesmal rich"), "V8 writer prompt must not include truncated Chapter 5 fragments");
  assert.ok(prompt.includes('Return valid JSON only.'), "V8 writer prompt should express output contract in English");
  assert.ok(prompt.includes('"paragraphs" must be a JSON array with 4-6 strings per chapter'), "V8 writer prompt should expose the paragraph rule in English");
  assert.ok(prompt.includes("German example lines are binding"), "Voice contract instructions should clarify that German examples are binding");
  assert.ok(prompt.includes("DEUTSCHE STILREGELN"), "Language-specific style rules should stay in German");
  assert.ok(prompt.includes("Kein Fremdwort"), "German lexical constraints should remain in German");
  assert.ok(prompt.includes("BLUEPRINT FIDELITY"), "V8 writer prompt should include an explicit blueprint fidelity block");
  assert.ok(prompt.includes("realize the blueprint's humor_beats"), "V8 writer prompt should force humor beats onto the page");
  assert.ok(!prompt.includes("4-5 Strings"), "V8 writer prompt must not carry the conflicting old paragraph count");

  const revisionPrompt = buildV8RevisionPrompt({
    originalDraft: {
      title: "Die Muenze im Kreis",
      description: "Warum lacht die Spur?",
      chapters: [
        { chapter: 1, text: "Kapitel eins." },
        { chapter: 2, text: "Kapitel zwei." },
        { chapter: 3, text: "Kapitel drei." },
        { chapter: 4, text: "Kapitel vier." },
        { chapter: 5, text: "Kapitel fuenf." },
      ],
    },
    blueprint: buildValidV8Blueprint(),
    cast: buildTestCast(),
    language: "de",
    ageRange: { min: 6, max: 8 },
    totalWordMin: 1400,
    totalWordMax: 1960,
    wordsPerChapter: { min: 280, max: 392 },
    qualityIssues: "- Add one stronger humor beat in chapter 2.",
  });
  assert.ok(revisionPrompt.includes("BLUEPRINT FIDELITY"), "V8 revision prompt should stay blueprint-aware");
  assert.ok(revisionPrompt.includes("QUALITY ISSUES TO FIX"), "V8 revision prompt should carry focused fix instructions");
  assert.ok(revisionPrompt.includes("German example lines are binding"), "V8 revision prompt should preserve voice contracts");
}

function testCriticNormalizationAndBanding() {
  const raw = {
    overall_score: 7.2,
    scores: {
      character_voice: { score: 7, reasoning: "Voices are mostly distinct.", example: "Alexander stays precise." },
      scenic_presence: { score: 8, reasoning: "Scenes are visible.", example: "The glowing runes are concrete." },
      tension_arc: { score: 7, reasoning: "There is escalation.", example: "Chapter 3 breaks the path." },
      humor: { score: 6, reasoning: "There are a few smile moments.", example: "Adrian overplays a clue." },
      age_appropriateness: { score: 8, reasoning: "Language suits 6-8.", example: "Sentences stay simple." },
      chapter_coherence: { score: 7, reasoning: "Callbacks hold.", example: "The circle returns in Chapter 5." },
      readability: { score: 8, reasoning: "Read-aloud flow works.", example: "Rhythm varies cleanly." },
      emotional_arc: { score: 7, reasoning: "Alexander's shame and recovery are visible.", example: "Cold hands after the mistake." },
      iconic_scene: { score: 7, reasoning: "The raised-arm mistake is replayable.", example: "\"Wartet! Ich weiss es! ... Oh.\"" },
      chapter5_quality: { score: 7, reasoning: "Ending is full enough.", example: "The warm circle lands well." },
    },
    strengths: ["Strong concrete midpoint scene"],
    revision_hints: ["Sharpen one additional humor beat in the middle chapters"],
    issues: [
      {
        chapter: 2,
        code: "HUMOR_MISSING",
        severity: "WARNING",
        message: "Middle chapter could use one warmer comic beat.",
        patchInstruction: "Add one short behavior-based laugh in chapter 2.",
      },
    ],
  };

  const report = normalizeCriticReport(raw, {
    model: "test-model",
    targetMinScore: 8.0,
    warnFloor: 6.5,
    directives: buildFiveDirectives(),
    language: "de",
  });

  assert.strictEqual(report.verdict, "acceptable", "7.x average with no hard failures should normalize to acceptable");
  assert.strictEqual(report.releaseReady, false, "Only publish verdict should be release-ready");
  assert.strictEqual(report.rubricScores.character_voice.score, 7, "Rubric scores should be preserved");
  assert.ok(report.dimensionScores.craft > 0, "Legacy dimension summary should be derived from rubric scores");
  assert.strictEqual(report.revisionHints[0], "Sharpen one additional humor beat in the middle chapters", "Revision hints should be preserved");
  assert.strictEqual(report.patchTasks.length, 1, "Issues with patch instructions should derive local patch tasks when missing");

  assert.strictEqual(
    determineCriticVerdict({
      rubricScores: report.rubricScores,
      criticalFailures: ["Chapter 4 resolves externally."],
      publishThreshold: 8.0,
      acceptableThreshold: 6.5,
    }),
    "reject",
    "Critical failures must force reject verdict"
  );
}

async function run() {
  testVariantDeterminism();
  testMatchingScore();
  testImageSpecValidation();
  testCastSetRepairTruncatesLongCharacterLocks();
  testWordBudget();
  testForbiddenCanonPhrase();
  testContinuousStorySegmentation();
  testReadabilityGateForYoungAudience();
  testCharacterVoiceGate();
  testRoleLabelOveruseSeverity();
  testCharacterFocusGate();
  testGlobalCharacterLoadGate();
  testStakesAndLowpointGate();
  testLowpointTooSoftGate();
  testChildEmotionArcSeverity();
  testImageryDensitySeverity();
  testFilterPlaceholderGate();
  testBannedWordGate();
  testEndingStabilityGate();
  testPromptVersionResolverV8Rollout();
  testV8BlueprintValidation();
  testV8WriterPromptRegression();
  testCriticNormalizationAndBanding();
  await testIntegrationWithMocks();
  console.log("Pipeline tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
