/**
 * Smoke test for screenplay-first-v12 spec §H (beat-sheet structured gates)
 * and §I (scene-card structured gates).
 *
 * Run: bun run backend/story/pipeline/tests/screenplay-v12-h-i-gates.ts
 *
 * Covers Spec-X cases:
 *   X.4  irreversible scene without visibleDamage → blocked in premium
 *   X.5  personal object planted before midpoint requirement (closingImage
 *        must echo plantedDetail)
 *   X.6  helper agency: helperFunction looks like helper-explains-solution
 *        → flagged on scene 4
 */
import assert from "assert";
import {
  validateBeatSheetSpecH,
  validateSceneCardsSpecI,
  SPEC_I_MIN_DIALOGUE_BEATS,
} from "../screenplay-validators";

const heroes = ["Adrian", "Alexander"];

function strongBeatSheet() {
  return {
    logline: "x",
    emotionalPremise: "x",
    centralQuestion: "x",
    mainWant: "x",
    mainNeed: "x",
    falseBelief: "x",
    wonderRule: "x",
    recurringMotif: "Glühwürmchen",
    personalObject: {
      object: "Adrians Taschenlampe",
      whyPersonal: "Geschenk seines Opas, einziges Erinnerungsstück",
      risk: "Sie könnte im Tunnel verloren gehen",
      payoff: "Sie leuchtet beim Finale ein letztes Mal",
    },
    act1: { hook: "x", incitingIncident: "x", wrongFirstMove: "x", firstConsequence: "x" },
    act2: { complication: "x", helperComplicates: "x", midpointIrreversibleTurn: "x", personalCost: "x" },
    act3: { recognition: "x", finalChoice: "x", payoffFromPlant: "x", closingImage: "x" },
    irreversibleMiddle: {
      wrongAction: "Adrian wirft den Stein in den Brunnen",
      visibleDamage: "Die kleine Glühwürmchen-Laterne zerbricht hörbar am Brunnenrand",
      personalCost: "Adrian gibt sein Versprechen an Opa auf",
      cannotReturnToStartBecause: "Der Tunnel ist hinter ihnen eingebrochen",
      newPressure: "Die Schatten kriechen aus dem Brunnen heraus",
    },
    finalPayoff: {
      plantedDetail: "Adrians Glühwürmchen-Laterne aus Kapitel 1",
      childAction: "Adrian und Alexander stellen die Laterne gemeinsam in den Brunnen",
      worldResponse: "Die Schatten ziehen sich zurück",
      closingImage: "Die Laterne leuchtet im Brunnen, Adrian und Alexander schauen zu",
    },
  };
}

console.log("\n═══ screenplay-v12 §H/§I smoke ═══");

// ─── X.4: irreversible scene without visibleDamage → blocked in premium ─────
{
  const sheet = strongBeatSheet();
  sheet.irreversibleMiddle.visibleDamage = "";
  const issues = validateBeatSheetSpecH(sheet, "premium", heroes);
  assert.ok(
    issues.some((i) => i.includes("irreversibleMiddle.visibleDamage missing")),
    `X.4 expected visibleDamage-missing failure, got: ${JSON.stringify(issues)}`,
  );
  console.log("  ✓ X.4 premium blocks irreversibleMiddle.visibleDamage missing");
}

// ─── X.4b: same in efficient — sub-object incomplete still flagged ──────────
{
  const sheet = strongBeatSheet();
  sheet.irreversibleMiddle.visibleDamage = "";
  const issues = validateBeatSheetSpecH(sheet, "efficient", heroes);
  assert.ok(
    issues.some((i) => i.includes("irreversibleMiddle.visibleDamage missing")),
    `X.4b efficient should still flag missing leaves once sub-object is present`,
  );
  console.log("  ✓ X.4b efficient also flags partial sub-object");
}

// ─── X.4c: abstract visibleDamage rejected (no concrete damage signal) ──────
{
  const sheet = strongBeatSheet();
  sheet.irreversibleMiddle.visibleDamage = "alles wird schlimmer als zuvor";
  const issues = validateBeatSheetSpecH(sheet, "premium", heroes);
  assert.ok(
    issues.some((i) => i.includes("lacks a concrete damage signal")),
    `X.4c abstract damage should be rejected, got: ${JSON.stringify(issues)}`,
  );
  console.log("  ✓ X.4c abstract visibleDamage rejected");
}

// ─── X.5: closingImage must echo plantedDetail ──────────────────────────────
{
  const sheet = strongBeatSheet();
  sheet.finalPayoff.closingImage = "Ein Drache fliegt über die Berge";
  const issues = validateBeatSheetSpecH(sheet, "premium", heroes);
  assert.ok(
    issues.some((i) => i.includes("does not echo plantedDetail")),
    `X.5 closingImage divorced from plantedDetail should fail, got: ${JSON.stringify(issues)}`,
  );
  console.log("  ✓ X.5 closingImage must echo plantedDetail");
}

// ─── X.6: childAction performed by helper → flagged ─────────────────────────
{
  const sheet = strongBeatSheet();
  sheet.finalPayoff.childAction = "Helfer Fuchs löst das Rätsel und rettet die Laterne";
  const issues = validateBeatSheetSpecH(sheet, "premium", heroes);
  assert.ok(
    issues.some((i) => i.includes("childAction") && i.includes("not clearly executed")),
    `X.6a helper-named childAction (no hero) should fail, got: ${JSON.stringify(issues)}`,
  );
  console.log("  ✓ X.6a helper-only childAction flagged");
}

// ─── X.6b: childAction explicitly helper-solves ─────────────────────────────
{
  const sheet = strongBeatSheet();
  sheet.finalPayoff.childAction = "Adrian und Alexander warten, während der Helfer Fuchs das Rätsel löst";
  const issues = validateBeatSheetSpecH(sheet, "premium", heroes);
  assert.ok(
    issues.some((i) => i.includes("performed by a helper")),
    `X.6b helper-solves childAction should fail even if heroes are named, got: ${JSON.stringify(issues)}`,
  );
  console.log("  ✓ X.6b helper-solves pattern flagged even with hero names present");
}

// ─── strongBeatSheet passes clean in premium ────────────────────────────────
{
  const issues = validateBeatSheetSpecH(strongBeatSheet(), "premium", heroes);
  assert.deepStrictEqual(
    issues,
    [],
    `strong beat sheet should pass spec-§H clean in premium; got: ${JSON.stringify(issues)}`,
  );
  console.log("  ✓ strong beat sheet passes premium spec-§H clean");
}

// ─── §I: scene cards ─────────────────────────────────────────────────────────

function strongSceneCards() {
  const baseBeats = Array.from({ length: SPEC_I_MIN_DIALOGUE_BEATS }, (_, i) => ({
    speaker: i % 2 === 0 ? "Adrian" : "Alexander",
    intent: "want",
    subtext: "x",
    actionCarried: "x",
  }));
  return [
    {
      scene: 1,
      scenePurpose: "hook",
      recurringMotifState: "introduced",
      dialogueBeats: baseBeats,
    },
    {
      scene: 2,
      scenePurpose: "false_attempt",
      recurringMotifState: "misused",
      dialogueBeats: baseBeats,
    },
    {
      scene: 3,
      scenePurpose: "complication",
      recurringMotifState: "lost",
      dialogueBeats: baseBeats,
    },
    {
      scene: 4,
      scenePurpose: "irreversible_middle",
      recurringMotifState: "reinterpreted",
      visibleDamage: "Die Laterne zerbricht am Boden",
      emotionalTurn: "Adrian erkennt, dass er nicht mehr zurück kann",
      cannotGoBackReason: "Der Tunnel ist eingebrochen",
      childDiscovery: "Alexander entdeckt, dass die Scherben das Licht reflektieren",
      helperFunction: "complicates",
      dialogueBeats: baseBeats,
    },
    {
      scene: 5,
      scenePurpose: "final_payoff",
      recurringMotifState: "payoff",
      childDecision: "Adrian und Alexander stellen die Scherben in den Brunnen",
      dialogueBeats: baseBeats,
    },
  ];
}

// ─── §I.1: strong cards pass premium clean ──────────────────────────────────
{
  const issues = validateSceneCardsSpecI(strongSceneCards(), "premium");
  assert.deepStrictEqual(
    issues,
    [],
    `strong scene cards should pass spec-§I clean; got: ${JSON.stringify(issues)}`,
  );
  console.log("  ✓ §I strong scene cards pass premium clean");
}

// ─── §I.2: dialogue-beat floor 4 ────────────────────────────────────────────
{
  const cards = strongSceneCards();
  cards[2].dialogueBeats = cards[2].dialogueBeats.slice(0, 3);
  const issues = validateSceneCardsSpecI(cards, "premium");
  assert.ok(
    issues.some((i) => i.includes("scene 3 has fewer than 4 dialogue beats")),
    `§I dialogueBeats < 4 must fail, got: ${JSON.stringify(issues)}`,
  );
  console.log("  ✓ §I dialogueBeats < 4 flagged");
}

// ─── §I.3: visibleDamage missing on irreversible middle scene → premium fail ─
{
  const cards = strongSceneCards();
  cards[3].visibleDamage = "";
  const issues = validateSceneCardsSpecI(cards, "premium");
  assert.ok(
    issues.some((i) => i.includes("scene 4.visibleDamage missing")),
    `§I premium visibleDamage missing must fail, got: ${JSON.stringify(issues)}`,
  );
  console.log("  ✓ §I premium scene-4 visibleDamage missing flagged");
}

// ─── §I.4: childDiscovery missing on scene 4 → premium fail ────────────────
{
  const cards = strongSceneCards();
  cards[3].childDiscovery = "";
  const issues = validateSceneCardsSpecI(cards, "premium");
  assert.ok(
    issues.some((i) => i.includes("childDiscovery missing")),
    `§I premium childDiscovery missing on scene 4 must fail, got: ${JSON.stringify(issues)}`,
  );
  console.log("  ✓ §I premium scene-4 childDiscovery missing flagged");
}

// ─── §I.5: helperFunction looks like helper-explains-solution ───────────────
{
  const cards = strongSceneCards();
  cards[3].helperFunction = "erklärt die Lösung den Kindern";
  const issues = validateSceneCardsSpecI(cards, "premium");
  assert.ok(
    issues.some((i) => i.includes("helperFunction looks like helper-explains-solution")),
    `§I helper-explains flagged on scene 4 helperFunction, got: ${JSON.stringify(issues)}`,
  );
  console.log("  ✓ §I scene-4 helper-explains flagged");
}

// ─── §I.6: efficient mode is lenient — missing childDiscovery is advisory ──
{
  const cards = strongSceneCards();
  cards[3].childDiscovery = "";
  cards[3].visibleDamage = "";
  cards[3].emotionalTurn = "";
  cards[3].cannotGoBackReason = "";
  const issues = validateSceneCardsSpecI(cards, "efficient");
  assert.deepStrictEqual(
    issues,
    [],
    `§I efficient mode should not raise on missing-but-not-present additive fields; got: ${JSON.stringify(issues)}`,
  );
  console.log("  ✓ §I efficient mode tolerates missing additive fields");
}

// ─── §I.7: childDecision missing on final scene → premium fail ──────────────
{
  const cards = strongSceneCards();
  cards[4].childDecision = "";
  const issues = validateSceneCardsSpecI(cards, "premium");
  assert.ok(
    issues.some((i) => i.includes("scene 5.childDecision missing")),
    `§I premium scene-5 childDecision missing must fail, got: ${JSON.stringify(issues)}`,
  );
  console.log("  ✓ §I premium scene-5 childDecision missing flagged");
}

// ─── §I.8: invalid recurringMotifState value rejected ──────────────────────
{
  const cards = strongSceneCards();
  cards[2].recurringMotifState = "broken-by-fairies";
  const issues = validateSceneCardsSpecI(cards, "premium");
  assert.ok(
    issues.some((i) => i.includes("recurringMotifState invalid")),
    `§I invalid recurringMotifState must fail, got: ${JSON.stringify(issues)}`,
  );
  console.log("  ✓ §I invalid recurringMotifState rejected");
}

console.log("\n✓ All §H/§I gate tests passed.");
