/**
 * Sprint 1 smoke test — runs three new quality gates against a small draft
 * fixture to verify the gates fire (or pass) as expected. Does not require
 * Encore runtime, pure TS.
 *
 * Run: bun run backend/story/pipeline/tests/sprint1-gates-smoke.ts
 */

import { runQualityGates } from "../quality-gates";
import type { StoryDraft, SceneDirective, CastSet } from "../types";

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

function runGateTest(name: string, draft: StoryDraft, opts: Partial<Parameters<typeof runQualityGates>[0]> = {}) {
  const report = runQualityGates({
    draft,
    directives: minimalDirectives,
    cast: minimalCast,
    language: "de",
    ageRange: { min: 6, max: 8 },
    ...opts,
  });

  const sprint1 = ["AGE_FIT_SENTENCE_LENGTH", "LAST_SENTENCE_PIPELINE_ARTIFACT", "CONCRETE_ANCHOR_PRESENCE"];
  const hits = report.issues.filter(i => sprint1.includes(i.gate));

  console.log(`\n═══ ${name} ═══`);
  if (hits.length === 0) {
    console.log(`  ✓ no Sprint 1 gate fired`);
  } else {
    for (const h of hits) {
      console.log(`  ${h.severity === "ERROR" ? "✗" : "!"} [${h.gate}] ${h.code} ch${h.chapter}: ${h.message}`);
    }
  }
}

// Test 1: Clean short sentences — should PASS all 3 Sprint 1 gates
runGateTest("Test 1 — Clean short prose (should pass)", {
  title: "T",
  description: "d",
  chapters: [
    { chapter: 1, title: "K1", text: "Alex lief schnell. Er sah den Stern. Die Schraube lag da. Er hob sie auf. Das Herz klopfte. Dann rief er laut." },
    { chapter: 2, title: "K2", text: "Adrian kam dazu. Sie sprachen kurz. Er lachte leise. Die Sonne schien warm. Sie gingen weiter. Alles war still." },
    { chapter: 3, title: "K3", text: "Alex machte einen Fehler. Er sprach zu laut. Das Regal kippte. Adrian fuehlte sich verletzt. Er wandte sich ab. Alex war traurig." },
    { chapter: 4, title: "K4", text: "Alex dachte nach. Er wollte es ruhig klaeren. Adrian hoerte zu. Sie einigten sich. Der Raum war warm. Beide nickten." },
    { chapter: 5, title: "K5", text: "Adrian legte die Schraube in Alex' Hand. Die Muenze glaenzte. Das Bild wurde ruhig. Beide lachten. Sie gingen heim. Ein warmes Ende." },
  ],
});

// Test 2: Long sentences — AGE_FIT should fire ERROR
runGateTest("Test 2 — Too-complex sentences (AGE_FIT should fire)", {
  title: "T",
  description: "d",
  chapters: [
    { chapter: 1, title: "K1", text: "Alexander ging durch die kleine staubige Werkstatt und atmete langsam, waehrend er nachdachte, als waere er gedanklich ganz woanders und dennoch wach. Nachdem er sich gesammelt hatte, griff er nach dem kleinen Stueck Metall, weil er wusste, dass Adrian es gemocht haette. Dabei spuerte er das schwere Gewicht seiner Gedanken, obwohl der Raum hell war." },
    { chapter: 2, title: "K2", text: "Alex lief schnell. Er sah den Stern." },
    { chapter: 3, title: "K3", text: "Alex lief schnell." },
    { chapter: 4, title: "K4", text: "Alex lief." },
    { chapter: 5, title: "K5", text: "Alex lief heim." },
  ],
});

// Test 3: Pipeline-artifact ending — LAST_SENTENCE_PIPELINE_ARTIFACT should fire
runGateTest("Test 3 — Pipeline-artifact ending (should fire)", {
  title: "T",
  description: "d",
  chapters: [
    { chapter: 1, title: "K1", text: "Alex lief schnell. Er sah den Stern. Die Sonne ging unter." },
    { chapter: 2, title: "K2", text: "Alex lief weiter. Die Nacht kam. Er fand das Licht." },
    { chapter: 3, title: "K3", text: "Alex machte einen Fehler. Er stolperte. Er fiel." },
    { chapter: 4, title: "K4", text: "Alex dachte nach. Er wollte neu beginnen. Er stand auf." },
    { chapter: 5, title: "K5", text: "Alex lief weiter. Sie mussten danach trotzdem weiter, ganz nah am Kapitel-1 Ziel. Damit endete die Geschichte." },
  ],
});

// Test 4: Concrete anchors missing — CONCRETE_ANCHOR_PRESENCE should fire
runGateTest("Test 4 — Missing concrete anchor (should fire)", {
  title: "T",
  description: "d",
  chapters: [
    { chapter: 1, title: "K1", text: "Alex lief schnell. Er sah den Stern. Er griff daneben." },
    { chapter: 2, title: "K2", text: "Adrian kam dazu. Er lachte. Sie sprachen kurz." },
    { chapter: 3, title: "K3", text: "Alex rief laut. Er stolperte. Er fiel." },
    { chapter: 4, title: "K4", text: "Alex dachte nach. Er entschied sich. Er stand auf." },
    { chapter: 5, title: "K5", text: "Sie lachten wieder. Es war warm. Zuhause war ruhig." },
  ],
}, {
  concreteAnchors: {
    trust: "die sternfoermige Schraube die Adrian Alex in die Hand legt",
  },
});

// Test 5: Concrete anchors present — should pass
runGateTest("Test 5 — Anchor present in text (should pass)", {
  title: "T",
  description: "d",
  chapters: [
    { chapter: 1, title: "K1", text: "Alex lief schnell. Er sah die Schraube. Es war eine Sternschraube." },
    { chapter: 2, title: "K2", text: "Adrian kam dazu. Er lachte. Sie sprachen kurz." },
    { chapter: 3, title: "K3", text: "Alex rief laut. Er stolperte. Er fiel." },
    { chapter: 4, title: "K4", text: "Alex dachte nach. Er entschied sich. Er stand auf." },
    { chapter: 5, title: "K5", text: "Sie lachten wieder. Es war warm. Die Schraube glaenzte." },
  ],
}, {
  concreteAnchors: {
    trust: "die sternfoermige Schraube die Adrian Alex in die Hand legt",
  },
});

console.log("\n═══ Sprint 1 smoke test complete ═══");
