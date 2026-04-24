/**
 * Sprint 2 smoke test — verifies VOICE_FINGERPRINT_PER_CHAPTER gate fires correctly.
 * Does not cover orchestrator-level logic (hard-rewrite dispatch, candidate fallback)
 * because those require full pipeline context.
 *
 * Run: bun run backend/story/pipeline/tests/sprint2-gates-smoke.ts
 */

import { runQualityGates } from "../quality-gates";
import type { StoryDraft, SceneDirective, CastSet } from "../types";
import type { StorySoul } from "../schemas/story-soul";

const minimalCast: CastSet = {
  avatars: [{ characterId: "alex", displayName: "Alexander" }] as any,
  poolCharacters: [],
  artifact: undefined,
} as any;

const minimalDirectives: SceneDirective[] = [1, 2, 3, 4, 5].map((n) => ({
  chapter: n,
  setting: "Werkstatt",
  goal: "Werkzeug finden",
  conflict: "Regal kippt",
  outcome: "Schraube entdeckt",
  charactersOnStage: ["Alexander"],
  artifactUsage: "",
  canonAnchorLine: "",
  imageMustShow: [],
  imageAvoid: [],
})) as SceneDirective[];

function soulWithFingerprints(): StorySoul {
  return {
    premise: "p",
    hookQuestion: "h",
    emotionalStakes: { what: "", why: "", whoCares: "" },
    worldTexture: { placeName: "", senseDetails: "", anchors: [] },
    characterFingerprints: [
      {
        name: "Alexander",
        role: "protagonist",
        coreMacke: "zählt leise die Schrauben in der Werkstatt",
        runningGag: "sagt 'eins zwei drei' bevor er handelt",
        favoriteWords: ["Schraube", "zählen", "Ordnung"],
        tabooWords: [],
        bodyTell: "klopft mit den Fingerknöcheln auf den Tisch",
        wantIneedle: "bewiesen zu haben",
        fearInternal: "übersehen zu werden",
        voiceExample: "Eins zwei drei. Jetzt passt es.",
      },
      {
        name: "Adrian",
        role: "partner",
        coreMacke: "trommelt ungeduldig mit der Hand",
        runningGag: "ruft 'Los jetzt!' bevor andere sprechen",
        favoriteWords: ["jetzt", "los", "schnell"],
        tabooWords: [],
        bodyTell: "wippt auf den Fußballen und blickt zur Tür",
        wantIneedle: "sofort anzukommen",
        fearInternal: "warten zu müssen",
        voiceExample: "Los jetzt, schnell!",
      },
    ],
    supportingCast: [],
    antagonism: null as any,
    payoffPromise: { emotionalLanding: "", transformationOfChild: "", finalImage: "", callbackFromChapter1: "" },
    humorBeats: [],
    chapterEndings: [],
    benchmarkBook: { title: "", whyMatch: "", voiceReference: "" },
  } as any;
}

function runTest(name: string, draft: StoryDraft, soul?: StorySoul) {
  const report = runQualityGates({
    draft,
    directives: minimalDirectives,
    cast: minimalCast,
    language: "de",
    ageRange: { min: 6, max: 8 },
    storySoul: soul,
  });

  const hits = report.issues.filter(i => i.gate === "VOICE_FINGERPRINT_PER_CHAPTER");
  console.log(`\n═══ ${name} ═══`);
  if (hits.length === 0) {
    console.log(`  ✓ no VOICE_FINGERPRINT_PER_CHAPTER issue`);
  } else {
    for (const h of hits) {
      console.log(`  ! [${h.gate}] ${h.code} ch${h.chapter}: ${h.message}`);
    }
  }
}

// Test 1: Strong voice markers per chapter for both primaries — should pass
runTest("Test 1 — Strong voice markers in all chapters", {
  title: "T", description: "d",
  chapters: [
    { chapter: 1, title: "K1", text: "Alexander zählte die Schrauben in Ordnung. Er klopfte mit den Fingerknöcheln leise auf den Tisch. Dann sagte Adrian: 'Los jetzt!' und wippte auf den Fußballen zur Tür." },
    { chapter: 2, title: "K2", text: "Alexander klopfte wieder mit den Fingerknöcheln. Die Schraube lag auf dem Tisch. Adrian rief 'Los jetzt, schnell!' und wippte auf den Fußballen." },
    { chapter: 3, title: "K3", text: "Alexander zählte in Ordnung die Teile. Er klopfte mit den Fingerknöcheln. Adrian sagte 'jetzt' und wippte auf den Fußballen." },
    { chapter: 4, title: "K4", text: "Alexander klopfte mit den Fingerknöcheln ruhig. Er zählte leise. Adrian wippte auf den Fußballen und blickte zur Tür." },
    { chapter: 5, title: "K5", text: "Alexander zählte eins zwei drei, Ordnung. Er klopfte mit den Fingerknöcheln sanft. Adrian sagte 'schnell, los!' und wippte auf den Fußballen." },
  ],
}, soulWithFingerprints());

// Test 2: Adrian loses voice in chapter 3-5 — should fire WARNING per chapter
runTest("Test 2 — Adrian drops voice markers in ch3-5 (should fire 3x)", {
  title: "T", description: "d",
  chapters: [
    { chapter: 1, title: "K1", text: "Alexander zählte die Schrauben in Ordnung. Er klopfte mit den Fingerknöcheln. Adrian rief 'Los jetzt!' und wippte auf den Fußballen." },
    { chapter: 2, title: "K2", text: "Alexander klopfte mit den Fingerknöcheln ruhig. Er zählte die Teile in Ordnung. Adrian sagte 'jetzt, schnell!' und wippte auf den Fußballen." },
    { chapter: 3, title: "K3", text: "Alexander zählte die Stufen in Ordnung. Er klopfte mit den Fingerknöcheln nervös. Adrian war einfach nur still. Er sagte nichts Besonderes. Die Wand war grau und die Lampe blass, während die Uhr weiterging." },
    { chapter: 4, title: "K4", text: "Alexander klopfte mit den Fingerknöcheln und zählte in Ordnung. Adrian nickte nur leise. Er war sehr ruhig geworden. Kein Wort von ihm mehr, keine Bewegung zum Ausgang. Die Stille wurde dichter zwischen den beiden." },
    { chapter: 5, title: "K5", text: "Alexander zählte eins zwei drei in Ordnung. Er klopfte mit den Fingerknöcheln sanft. Adrian lächelte einfach. Er sagte gar nichts. Die Werkstatt wurde wieder heller und das Licht fiel warm auf den langen Arbeitstisch." },
  ],
}, soulWithFingerprints());

console.log("\n═══ Sprint 2 smoke test complete ═══");
