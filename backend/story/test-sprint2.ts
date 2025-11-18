// Sprint 2 Test: Story Remixer & Originality Validator
// Tests the new originality enforcement system

import { StoryRemixer } from "./story-remixer";
import { OriginalityValidator } from "./originality-validator";

// Test 1: Story Remixer
console.log("=".repeat(60));
console.log("TEST 1: STORY REMIXER");
console.log("=".repeat(60));

const testScenes = [
  {
    id: 1,
    taleId: "grimm-055",
    sceneNumber: 1,
    sceneTitle: "Der Müller prahlt",
    sceneDescription: "Ein armer Müller prahlt vor dem König, seine Tochter könne Stroh zu Gold spinnen.",
    characterVariables: { PROTAGONIST: "Müllerstochter", AUTHORITY: "König", OBSTACLE: "Müller" },
    setting: "castle",
    mood: "tense",
  },
  {
    id: 2,
    taleId: "grimm-055",
    sceneNumber: 2,
    sceneTitle: "Die erste Nacht",
    sceneDescription: "Die Müllerstochter wird in eine Kammer gesperrt und soll Stroh zu Gold spinnen.",
    characterVariables: { PROTAGONIST: "Müllerstochter", HELPER: "Rumpelstilzchen" },
    setting: "castle_chamber",
    mood: "mysterious",
  },
  {
    id: 3,
    taleId: "grimm-055",
    sceneNumber: 3,
    sceneTitle: "Der Deal",
    sceneDescription: "Ein kleines Männchen erscheint und bietet Hilfe gegen ein Geschenk.",
    characterVariables: { PROTAGONIST: "Müllerstochter", ANTAGONIST: "Rumpelstilzchen" },
    setting: "castle_chamber",
    mood: "mysterious",
  },
];

const avatarNames = ["Emma", "Luca"];
const targetOriginality = 65;

const remixResult = StoryRemixer.remixScenes(testScenes, avatarNames, targetOriginality);

console.log(`\n✅ Remix applied:`);
console.log(`   Strategies: ${remixResult.appliedStrategies.join(', ')}`);
console.log(`   Originality Score: ${remixResult.originalityScore}/100`);
console.log(`   Remixed Scenes: ${remixResult.remixedScenes.length}`);
console.log(`\n📋 Transformation Summary (first 500 chars):`);
console.log(remixResult.transformationSummary.substring(0, 500) + "...\n");

// Test 2: Originality Validator
console.log("=".repeat(60));
console.log("TEST 2: ORIGINALITY VALIDATOR");
console.log("=".repeat(60));

const originalText = `
Ein armer Müller prahlt vor dem König, seine Tochter könne Stroh zu Gold spinnen.
Die Müllerstochter wird in eine Kammer gesperrt und soll Stroh zu Gold spinnen.
Ein kleines Männchen erscheint und bietet Hilfe gegen ein Geschenk.
Das Männchen spinnt das Stroh zu Gold und verschwindet.
Am nächsten Tag ist der König begeistert vom Gold.
`;

const highOverlapStory = `
Ein Müller prahlt vor dem König, seine Tochter könne Stroh zu Gold spinnen.
Emma wird in eine Kammer gesperrt und soll Stroh zu Gold spinnen.
Ein kleines Männchen namens Zappelfix erscheint und bietet Hilfe.
Zappelfix spinnt das Stroh zu Gold und verschwindet wieder.
Am nächsten Tag ist der König begeistert vom vielen Gold.
`;

const lowOverlapStory = `
Emma und Luca besuchen eine alte Spinnerei am Stadtrand.
In der Fabrik entdecken sie eine geheimnisvolle Maschine.
Ein freundlicher Roboter namens Zappelfix hilft ihnen dabei.
Die Maschine verwandelt alte Textilien in glänzende neue Stoffe.
Am Ende verkaufen sie die Stoffe auf dem Markt und sind stolz.
`;

console.log("\n--- Test 2a: High Overlap (should FAIL) ---");
const highOverlapReport = OriginalityValidator.validate(
  highOverlapStory,
  originalText,
  { maxOverlapPercentage: 40, minPhraseLength: 4, maxDirectCopies: 3 }
);

console.log(`Overlap: ${highOverlapReport.overlapPercentage.toFixed(1)}%`);
console.log(`Is Original: ${highOverlapReport.isOriginal ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Verdict: ${highOverlapReport.verdictReason}`);
if (!highOverlapReport.isOriginal) {
  console.log(`Issues: ${highOverlapReport.issues.join(', ')}`);
}

console.log("\n--- Test 2b: Low Overlap (should PASS) ---");
const lowOverlapReport = OriginalityValidator.validate(
  lowOverlapStory,
  originalText,
  { maxOverlapPercentage: 40, minPhraseLength: 4, maxDirectCopies: 3 }
);

console.log(`Overlap: ${lowOverlapReport.overlapPercentage.toFixed(1)}%`);
console.log(`Is Original: ${lowOverlapReport.isOriginal ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Verdict: ${lowOverlapReport.verdictReason}`);

console.log("\n" + "=".repeat(60));
console.log("✅ ALL TESTS COMPLETED!");
console.log("=".repeat(60));
