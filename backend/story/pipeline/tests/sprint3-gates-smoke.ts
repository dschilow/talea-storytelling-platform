/**
 * Sprint 3 smoke test — ending patterns + reference corpus.
 *
 * Run: bun run backend/story/pipeline/tests/sprint3-gates-smoke.ts
 */

import { runQualityGates } from "../quality-gates";
import { ENDING_PATTERNS, scoreEndingPatternMatch } from "../ending-patterns";
import { computeReadabilityReport, REFERENCE_CORPUS_TARGETS, countGermanSyllables } from "../reference-corpus";
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

console.log("\n═══ Test A — Ending pattern library loads all 8 patterns ═══");
console.log(`  Pattern count: ${ENDING_PATTERNS.length}`);
console.log(`  Names: ${ENDING_PATTERNS.map((p) => p.name).join(", ")}`);
if (ENDING_PATTERNS.length !== 8) {
  console.error("  ✗ Expected 8 ending patterns");
} else {
  console.log("  ✓ All 8 patterns loaded");
}

console.log("\n═══ Test B — Syllable counter for common German words ═══");
const syllableCases: Array<[string, number]> = [
  ["Werkstatt", 2],
  ["Schraube", 2],
  ["Alexander", 4],
  ["Vertrauen", 3],
  ["Haus", 1],
  ["eins", 1],
  ["Erinnerung", 4],
];
for (const [word, expected] of syllableCases) {
  const got = countGermanSyllables(word);
  const ok = Math.abs(got - expected) <= 1;
  console.log(`  ${ok ? "✓" : "✗"} ${word}: got ${got}, expected ≈${expected}`);
}

console.log("\n═══ Test C — Readability on short-sentence German prose ═══");
const goodProse = `Alexander lief schnell. Er sah den Stern. Die Schraube lag da. Er hob sie auf. Das Herz klopfte. Dann rief er laut. Adrian kam dazu. Sie lachten leise. Die Sonne schien warm. Sie gingen weiter. Alles war gut. Das Werkzeug lag bereit. Das Kind war froh. Die Werkstatt war warm. Oma nickte zufrieden.`;
const report = computeReadabilityReport(goodProse);
console.log(`  FleschDE: ${report.fleschDE.toFixed(1)} (target ${REFERENCE_CORPUS_TARGETS.fleschDEMin}-${REFERENCE_CORPUS_TARGETS.fleschDEMax})`);
console.log(`  AvgSentenceWords: ${report.avgSentenceWords.toFixed(2)} (target ${REFERENCE_CORPUS_TARGETS.avgSentenceWordsMin}-${REFERENCE_CORPUS_TARGETS.avgSentenceWordsMax})`);
console.log(`  AvgSyllablesPerWord: ${report.avgSyllablesPerWord.toFixed(2)} (target ${REFERENCE_CORPUS_TARGETS.avgSyllablesPerWordMin}-${REFERENCE_CORPUS_TARGETS.avgSyllablesPerWordMax})`);
console.log(`  Outliers: ${report.deltaCount} (${report.outliers.join(", ") || "none"})`);

console.log("\n═══ Test D — Readability on complex adult prose ═══");
const badProse = `Alexander ging vorsichtig durch die verlassene, staubige Werkstatt seiner Großmutter, während er darüber nachdachte, ob die philosophischen Konsequenzen seiner vorherigen Entscheidungen ihn tatsächlich zu einem verantwortungsbewussteren Individuum gemacht hatten, obwohl er gleichzeitig bezweifelte, dass solche abstrakten Überlegungen überhaupt relevant sein konnten angesichts der gegenwärtigen Bedrohungslage durch den mysteriösen Antagonisten.`;
const report2 = computeReadabilityReport(badProse);
console.log(`  FleschDE: ${report2.fleschDE.toFixed(1)}`);
console.log(`  AvgSentenceWords: ${report2.avgSentenceWords.toFixed(2)}`);
console.log(`  AvgSyllablesPerWord: ${report2.avgSyllablesPerWord.toFixed(2)}`);
console.log(`  Outliers: ${report2.deltaCount} (${report2.outliers.join(", ")})`);
if (report2.deltaCount < 2) {
  console.error("  ✗ Expected complex prose to have ≥2 outliers");
} else {
  console.log("  ✓ Complex prose correctly flagged");
}

console.log("\n═══ Test E — Ending pattern match: warm_callback ═══");
const warmCallbackEnding = "Adrian lachte wieder. Diesmal war es ein anderes Lachen, nicht so laut. Er reichte Alexander die Schraube. Beide schmunzelten. Draussen wurde es dunkel. Die Werkstatt roch wieder warm. Alexander nickte nur und legte die Muenze zurueck an ihren Platz.";
const scoreWarm = scoreEndingPatternMatch({
  patternName: "warm_callback",
  lastChapterText: warmCallbackEnding,
  callbackMatches: { chapter1_gag_or_line: true },
});
console.log(`  Score: ${scoreWarm.score.toFixed(2)} (hit=${scoreWarm.hitSignals.length}, miss=${scoreWarm.missedSignals.length})`);
if (scoreWarm.score < 0.5) {
  console.error("  ✗ Expected warm_callback to match");
} else {
  console.log("  ✓ warm_callback realized");
}

console.log("\n═══ Test F — Ending pattern MISS: shared_moment probe ═══");
const abstractEnding = "Das Abenteuer war zu Ende. Sie mussten trotzdem weitermachen. Alles war anders als vorher. Keiner sagte etwas. Dann ging die Tür auf.";
const scoreSharedMiss = scoreEndingPatternMatch({
  patternName: "shared_moment",
  lastChapterText: abstractEnding,
});
console.log(`  Score: ${scoreSharedMiss.score.toFixed(2)} (hit=${scoreSharedMiss.hitSignals.length}, miss=${scoreSharedMiss.missedSignals.length})`);
if (scoreSharedMiss.score >= 0.5) {
  console.error("  ✗ Expected shared_moment to FAIL on abstract ending");
} else {
  console.log("  ✓ shared_moment correctly rejected");
}

console.log("\n═══ Test G — runQualityGates integration (ending + corpus) ═══");
const fullDraft: StoryDraft = {
  title: "T",
  description: "d",
  chapters: [
    {
      chapter: 1,
      title: "K1",
      text: "Alexander stand in der Werkstatt. Er sah die Schraube auf dem Tisch. Oma nickte ihm zu. Adrian lachte laut 'Los jetzt!'. Alexander zaehlte leise eins zwei drei. Die Sonne schien durchs Fenster. Das Werkzeug roch nach Oel.",
    },
    {
      chapter: 2,
      title: "K2",
      text: "Sie gingen in den Garten. Der Baum war hoch. Alexander klopfte auf den Stamm. Adrian rief laut. Das Blatt fiel. Sie lachten beide kurz. Die Luft war frisch.",
    },
    {
      chapter: 3,
      title: "K3",
      text: "Alexander rief seinen Plan zu frueh aus. Das Regal kippte um. Adrian trat zurueck. Alexander zaehlte nicht mehr. Der Bauch tat weh. Adrian schaute weg. Die Sonne war weg.",
    },
    {
      chapter: 4,
      title: "K4",
      text: "Alexander atmete tief. Er wollte es gutmachen. Adrian kam zurueck. Sie sprachen leise. Die Werkstatt war ruhig. Beide nickten kurz. Das Herz klopfte wieder.",
    },
    {
      chapter: 5,
      title: "K5",
      text: "Adrian lachte wieder. Diesmal war es leiser als vorher. Er reichte Alexander die Schraube mit Bedacht. Alexander schmunzelte und zaehlte ganz leise. Die Werkstatt roch wieder warm. Oma nickte zufrieden. Die Muenze glitzerte in der Sonne.",
    },
  ],
};
const q = runQualityGates({
  draft: fullDraft,
  directives: minimalDirectives,
  cast: minimalCast,
  language: "de",
  ageRange: { min: 6, max: 8 },
  endingPattern: "warm_callback",
});
const sprint3Issues = q.issues.filter((i) => i.gate === "ENDING_PATTERN_MATCH" || i.gate === "REFERENCE_CORPUS_DELTA");
console.log(`  Sprint 3 issues found: ${sprint3Issues.length}`);
for (const issue of sprint3Issues) {
  console.log(`  [${issue.severity}][${issue.gate}] ${issue.code}: ${issue.message.slice(0, 140)}`);
}

console.log("\n═══ Sprint 3 smoke test complete ═══");
