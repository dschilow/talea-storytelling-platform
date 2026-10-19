/**
 * Learning mode (audit 2026-10-17): the knowledge reaches every writer, planner and editor, is checked for truth and
 * spread, survives the chapter book's lesson filter, and grows the right trait with a description that names it.
 */
import { describe, expect, test } from "bun:test";
import { buildBrief } from "./context";
import { resolveLengthBudget, type AgeBand } from "./craft";
import { runDevelopmentStage } from "./developments";
import {
  countKeyWord,
  explanationParagraphs,
  knowledgeSentences,
  learningDevelopmentLinesEn,
  learningGoal,
  learningLedgerNotes,
  learningLinesDe,
  learningPlanAnchorEn,
  learningScoreCap,
  learningSummaryEn,
  learningValidatorLinesEn,
  learningWriterLinesEn,
  mentionsKnowledge,
  parseLearningCore,
  repeatedExplanationNotes,
  sanitizeLearningLedger,
} from "./learning";
import type { LlmRequest } from "./llm";
import { buildOneShotSystemPromptEn, buildOneShotUserPromptEn } from "./oneshot-prompt-en";
import { buildOneShotUserPrompt, buildPatchPrompt, planFromOneShot } from "./oneshot-stage";
import { buildReviewUserPrompt, ledgerScoreCap, runReviewStage, sanitizeReview } from "./review-stage";
import { bookLengthBudget, resolveBookBudget } from "./book/budget";
import { checkBookPlan, checkLearningThread, parsePlan, planScoreCap } from "./book/plan";
import { buildChapterCritiquePrompt, buildChapterSystemPrompt, buildChapterUserPrompt, buildPitchPrompt, buildPlanPrompt, buildPlanReviewPrompt, planReviewNotes } from "./book/prompts";
import { emptyBookState, type BookBrief } from "./book/types";

const HEDGEHOG = { enabled: true, subjects: ["science"], difficulty: "beginner" as const, learningObjectives: ["Warum Igel Winterschlaf halten"], assessmentType: "interactive" as const };
const DOUBLING = { enabled: true, subjects: ["math"], difficulty: "intermediate" as const, learningObjectives: ["Verdoppeln"], assessmentType: "quiz" as const };

function brief(learningMode?: any, band: AgeBand = "6-8") {
  return buildBrief({
    config: { ageGroup: band, length: "medium", language: "de", genre: "animals", setting: "forest", humorLevel: 1, suspenseLevel: 1, learningMode } as any,
    band, budget: resolveLengthBudget("medium", band), heroes: [{ id: "a", name: "Alexander" }, { id: "b", name: "Adrian" }], candidates: [], artifacts: [],
    recentStories: [], recentEngineIds: [], heroMemories: {}, seed: "learning",
  });
}

const reply = (request: LlmRequest, data: unknown) => ({ text: typeof data === "string" ? data : JSON.stringify(data), modelUsed: request.model, usage: { prompt: 50, completion: 20, total: 70, costUSD: 0.0001 }, durationMs: 1 });

describe("the learning goal", () => {
  test("only an enabled mode with a subject counts; values are normalised", () => {
    expect(learningGoal({ learningMode: { ...HEDGEHOG, enabled: false } } as any)).toBeNull();
    expect(learningGoal({ learningMode: { ...HEDGEHOG, subjects: [] } } as any)).toBeNull();
    expect(learningGoal({} as any)).toBeNull();
    expect(learningGoal({ learningMode: { ...HEDGEHOG, difficulty: "x", assessmentType: "y" } } as any)).toMatchObject({ difficulty: "beginner", assessment: "interactive", objectives: ["Warum Igel Winterschlaf halten"] });
  });

  test("the writer block carries core, arc, subject craft, age and learning style", () => {
    const lines = learningWriterLinesEn({ learningMode: HEDGEHOG } as any, { form: "picturebook", band: "6-8", units: 7 }).join("\n");
    for (const expected of ["LEARNING MODE (mandatory", "„Warum Igel Winterschlaf halten“", "THE KNOWLEDGE CORE", "header line WISSEN", "wrong belief", "at the latest on page 6", "ONE comparison", "Echo on the last page", "observe → guess → try", "For six- to eight-year-olds", "Learning style join in", "no lesson"]) {
      expect(lines).toContain(expected);
    }
    const maths = learningWriterLinesEn({ learningMode: DOUBLING } as any, { form: "chapterbook", band: "3-5", units: 8 }).join("\n");
    expect(maths).toContain("count along");
    expect(maths).toContain("never do the thinking");
    expect(maths).toContain("the chapter before the climax");
    expect(maths).toContain("Learning style quiz");
    expect(maths).toContain("For three- to five-year-olds");
    expect(learningWriterLinesEn({} as any, { form: "story", band: "6-8" })).toEqual([]);
  });

  test("without a typed goal the writer picks one concrete, true piece of knowledge", () => {
    const lines = learningWriterLinesEn({ learningMode: { ...HEDGEHOG, learningObjectives: [] } } as any, { form: "story", band: "9-12", units: 5 }).join("\n");
    expect(lines).toContain("No goal typed");
    expect(lines).toContain("at the latest in chapter 4");
  });

  test("German lines for patch and editor name the arc and the style", () => {
    const lines = learningLinesDe({ learningMode: DOUBLING } as any).join("\n");
    expect(lines).toContain("Lernziel: „Verdoppeln“");
    expect(lines).toContain("zieht sich durch die Handlung");
    expect(lines).toContain("Lernart Quiz");
  });
});

describe("picture book", () => {
  test("the English writer gets the arc as its own section and commits to the knowledge in a header", () => {
    const b = brief(HEDGEHOG);
    const user = buildOneShotUserPromptEn(b);
    expect(user).toContain("LEARNING MODE (mandatory");
    expect(user).toContain("WISSEN: <the knowledge core");
    expect(user).toContain("the LEARNING MODE arc runs through the pages");
    // one summary line in the FRAME, the full block below it
    expect(user.match(/Learning mode \(mandatory\)/g)?.length).toBe(1);
    expect(buildOneShotSystemPromptEn(b)).toContain("No moral or life lesson");
    // without learning mode nothing changes
    const plain = brief();
    expect(buildOneShotUserPromptEn(plain)).not.toContain("WISSEN:");
    expect(buildOneShotSystemPromptEn(plain)).toContain("No lesson, not even as a character's line.");
  });

  test("the German writer variant and the patch carry it too", () => {
    const b = brief(HEDGEHOG);
    expect(buildOneShotUserPrompt(b)).toContain("WISSEN:");
    expect(buildPatchPrompt("T", [], [], b)).toContain("zieht sich durch die Handlung");
  });

  test("the WISSEN header becomes the plan's learning core; pages stay clean", () => {
    const raw = ["IDEEN: 1) a 2) b 3) c", "WAHL: 1 — weil", "BAUPLAN: wettlauf", "BESETZUNG: ", "FUNDSTÜCK: keins", "REFRAIN: keiner", "WISSEN: Igel schlafen im Winter, weil es dann kaum Käfer gibt. Sie leben von ihrem Herbstfett.", "TITEL: Der Käfer-Fahrplan", "BESCHREIBUNG: x", "SEITE 1", "Text eins.", "SEITE 2", "Text zwei."].join("\n");
    const b = brief(HEDGEHOG);
    const plan = planFromOneShot(raw, b, { title: "Der Käfer-Fahrplan", description: "x", pages: [{ order: 1, title: "", content: "Text eins." }, { order: 2, title: "", content: "Text zwei." }] });
    expect(plan.learningCore).toBe("Igel schlafen im Winter, weil es dann kaum Käfer gibt. Sie leben von ihrem Herbstfett.");
    expect(parseLearningCore("WISSEN: keins")).toBeNull();
    expect(planFromOneShot(raw, brief(), { title: "", description: "", pages: [] }).learningCore).toBeNull();
  });

  test("the editor reads truth, spread and child words; the caps hold", () => {
    const b = brief(HEDGEHOG);
    const user = buildReviewUserPrompt(b, "T", [{ order: 1, title: "", content: "x" }], [], true, "Igel schlafen im Winter.");
    expect(user).toContain("ZIEL-WISSEN laut Autor");
    expect(user).toContain("\"learning\"");
    expect(buildReviewUserPrompt(brief(), "T", [], [], true)).not.toContain("\"learning\"");
    const scores = { hook: 8, clarity: 8, logic: 8, humor: 8, suspense: 8, heroAgency: 8, characters: 8, language: 8, ending: 8, overall: 9 };
    const ledger = { goal: { want: "x", fulfilled: "S. 7" }, solutionKey: { what: "Fett", firstShown: 1, usedOn: 6, foundByChance: false }, props: [], setups: [], introduction: { relationship: null, traits: "x" } };
    const wrong = sanitizeReview({ scores, ledger: { ...ledger, learning: { fact: "Igel fressen im Winter Äpfel", explainedOn: 6, correct: false, error: "„Äpfel“ — Igel fressen Insekten", keyToSolution: true, pages: [2, 6, 7], adultWords: [] } } }, 7)!;
    expect(wrong.ledger?.learning?.correct).toBe(false);
    expect(wrong.scores.overall).toBe(5.5);
    const missing = sanitizeReview({ scores, ledger: { ...ledger, learning: { fact: null, pages: [] } } }, 7)!;
    expect(missing.scores.overall).toBe(6.5);
    const once = sanitizeReview({ scores, ledger: { ...ledger, learning: { fact: "Igel schlafen, weil es keine Käfer gibt", explainedOn: 6, correct: true, keyToSolution: true, pages: [6], adultWords: [] } } }, 7)!;
    expect(once.scores.overall).toBe(7);
    expect(ledgerScoreCap(ledger as any)).toBe(10);
  });

  test("the compact read asks for the learning ledger only in learning mode", async () => {
    const seen: string[] = [];
    const llm = async (request: LlmRequest) => {
      seen.push(request.system);
      return reply(request, { scores: { overall: 8 }, comprehension: {}, mustFix: [] });
    };
    await runReviewStage(llm as any, brief(HEDGEHOG), "T", [{ order: 1, title: "", content: "x" }], [], "critic", "review", true, { learningCore: "Igel schlafen." });
    await runReviewStage(llm as any, brief(), "T", [{ order: 1, title: "", content: "x" }], [], "critic", "review", true);
    expect(seen[0]).toContain("learning (Lernmodus)");
    expect(seen[1]).not.toContain("learning (Lernmodus)");
  });

  test("learning notes ask for one or two sentences where they belong", () => {
    const goal = learningGoal({ learningMode: HEDGEHOG } as any);
    const base = { fact: "Igel schlafen im Winter, weil es keine Käfer gibt", explainedOn: 6, correct: true, error: null, keyToSolution: true, pages: [6], adultWords: ["Energieverbrauch"], keyWord: null };
    const notes = learningLedgerNotes(base, goal, 7);
    expect(notes.some((note) => note.includes("nur auf Seite 6") && note.includes("Seite 3 oder 4"))).toBe(true);
    expect(notes.some((note) => note.includes("Erwachsenenwörter (Energieverbrauch)"))).toBe(true);
    expect(notes.some((note) => note.startsWith("Seite 7:") && note.includes("nie als Erzählersatz"))).toBe(true);
    expect(learningLedgerNotes({ ...base, fact: null }, goal, 7)).toEqual([expect.stringContaining("Lernziel fehlt")]);
    expect(learningLedgerNotes({ ...base, pages: [2, 6, 7], adultWords: [] }, goal, 7)).toEqual([]);
    expect(learningLedgerNotes(base, null, 7)).toEqual([]);
    expect(learningScoreCap(undefined)).toBe(10);
  });

  test("the key word is counted in the text; never or once heard gets a note where it belongs", () => {
    const goal = learningGoal({ learningMode: HEDGEHOG } as any);
    expect(countKeyWord("Der Winterschlaf. Des Winterschlafs wegen.", "Winterschlaf")).toBe(2);
    expect(countKeyWord("Wir verdoppeln. Verdoppelt!", "Verdoppeln")).toBe(2);
    expect(sanitizeLearningLedger({ fact: "x", keyWord: "das Schlüsselwort des Lernziels" }, 7)?.keyWord).toBeNull();
    const ledger = { fact: "Igel schlafen im Winter", explainedOn: 6, correct: true, error: null, keyToSolution: true, pages: [1, 4, 6], adultWords: [], keyWord: "Winterschlaf" };
    const never = learningLedgerNotes(ledger, goal, 7, { text: "Igel schlafen im Winter.", band: "6-8" });
    expect(never[0]).toContain("Seite 6: Das Wort „Winterschlaf“ fällt in der ganzen Geschichte nie");
    expect(never[1]).toContain("mit dem Wort „Winterschlaf“");
    const once = learningLedgerNotes({ ...ledger, pages: [1, 4, 6, 7] }, goal, 7, { text: "Der Winterschlaf.", band: "6-8" });
    expect(once).toEqual([expect.stringContaining("fällt nur einmal")]);
    expect(learningLedgerNotes({ ...ledger, pages: [1, 4, 6, 7] }, goal, 7, { text: "Winterschlaf … Winterschlaf.", band: "6-8" })).toEqual([]);
    expect(learningLedgerNotes({ ...ledger, pages: [1, 4, 6, 7] }, goal, 7, { text: "Winterschlaf … Winterschlaf.", band: "3-5" })).toEqual([expect.stringContaining("nur einmal")]);
  });

  test("a ledger without learning fields does not cap a story", () => {
    expect(sanitizeLearningLedger({ fact: "x ist so" }, 7)).toMatchObject({ correct: true, keyToSolution: true, pages: [] });
    expect(sanitizeLearningLedger({ fact: "nicht vorhanden" }, 7)?.fact).toBeNull();
  });
});

describe("avatar development", () => {
  test("the learned fact grows the subject's trait and is named in the description", async () => {
    let system = "";
    const llm = async (request: LlmRequest) => {
      system = request.system;
      return reply(request, { developments: [{ name: "Alexander", changedTraits: [{ trait: "knowledge.biology", change: 3, description: "Hat herausgefunden, dass Igel im Winter schlafen, weil es dann kaum Käfer gibt." }] }] });
    };
    const result = await runDevelopmentStage(llm as any, { heroes: [{ id: "a", name: "Alexander" }] as any, title: "T", pages: [{ order: 1, title: "", content: "x" }], learning: { goal: learningGoal({ learningMode: HEDGEHOG } as any), core: "Igel schlafen im Winter." } }, "support");
    expect(system).toContain("LERNMODUS");
    expect(system).toContain("knowledge.biology");
    expect(system).toContain("Kernwissen laut Autor");
    expect(result.developments[0].changedTraits[0]).toMatchObject({ trait: "knowledge.biology", change: 3 });
    await runDevelopmentStage(llm as any, { heroes: [{ id: "a", name: "Alexander" }] as any, title: "T", pages: [{ order: 1, title: "", content: "x" }] }, "support");
    expect(system).not.toContain("LERNMODUS");
  });

  test("normal mode: the English lines map subjects to traits", () => {
    const lines = learningDevelopmentLinesEn(learningGoal({ learningMode: { ...DOUBLING, subjects: ["math", "social"] } } as any)).join("\n");
    expect(lines).toContain("knowledge.mathematics");
    expect(lines).toContain("empathy");
    expect(learningDevelopmentLinesEn(null)).toEqual([]);
  });
});

describe("normal mode (dev engine)", () => {
  test("the goal travels with the locked idea and the validator checks it", () => {
    const config = { learningMode: { ...HEDGEHOG, subjects: ["geography"], learningObjectives: ["Himmelsrichtungen"] } } as any;
    expect(learningPlanAnchorEn(config).join("\n")).toContain("LEARNING GOAL (binding");
    const validator = learningValidatorLinesEn(config).join("\n");
    expect(validator).toContain("LEARNING MODE CHECK");
    expect(validator).toContain("max 7.5");
    expect(validator).toContain("not a moral");
    expect(learningSummaryEn(config, "story")).toContain("„Himmelsrichtungen“");
    expect(learningPlanAnchorEn({} as any)).toEqual([]);
    expect(learningValidatorLinesEn({} as any)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Chapter book
// ---------------------------------------------------------------------------

function bookBrief(learningMode?: any): BookBrief {
  const book = resolveBookBudget("6-8", { chapters: 8 });
  const base = buildBrief({
    config: { genre: "animals", ageGroup: "6-8", language: "de", length: "long", learningMode } as any,
    band: "6-8", budget: bookLengthBudget(book), heroes: [{ id: "hero-alexander", name: "Alexander", age: 8 }, { id: "hero-adrian", name: "Adrian", age: 7 }], candidates: [], artifacts: [], seed: "t",
  });
  return { ...base, book, form: "journey", catalogue: [], series: null };
}

function rawPlan(learning: any) {
  return {
    title: "Der Käfer-Fahrplan", description: "x",
    bible: {
      world: "Garten", home: "Haus", bigQuestion: "Schafft es der Igel?", truth: "x", limits: "x", workaround: "x", stakes: "x", personalReason: "x", deadline: "Frost",
      opponent: { who: "Der Frost", motive: "x", logic: "x" }, characters: [{ name: "Alexander", wants: "x" }, { name: "Adrian", wants: "x" }],
      runningGag: { gag: "x", beats: [{ chapter: 2, beat: "a" }, { chapter: 4, beat: "b" }, { chapter: 8, beat: "c" }] },
      twistChapter: 4, lowPointChapter: 6, solution: { how: "x", uses: ["S1", "S2"] },
      ...(learning ? { learning } : {}),
    },
    setups: [{ id: "S1", what: "a", planted: 1, paidOff: 7 }, { id: "S2", what: "b", planted: 2, paidOff: 7 }, { id: "S3", what: "c", planted: 3, paidOff: 6 }],
    chapters: Array.from({ length: 8 }, (_, index) => ({ n: index + 1, title: `T${index + 1}`, type: ["discovery", "chase", "puzzle"][index % 3], place: ["Garten", "Hecke", "Beet"][index % 3], event: "e", progress: "p", laugh: "l", hook: index < 7 ? "h" : "", cast: ["Alexander", "Adrian"], plants: [], payoffs: [], pictures: ["a"] })),
    castIds: [], artifact: null, sequelTeasers: [],
  };
}

const THREAD = {
  core: "Igel schlafen im Winter, weil es dann kaum Käfer gibt; sie leben von ihrem Herbstfett.",
  term: "Winterschlaf",
  misconception: "Adrian glaubt, der Igel friert nur und braucht eine Decke.",
  comparison: "Das Fett ist wie eine volle Brotdose unter der Haut.",
  steps: [{ chapter: 1, step: "Der Igel frisst und frisst." }, { chapter: 4, step: "Unter dem Brett finden sie keinen Käfer mehr.", obstacle: "Der Futterplatz der Helden bleibt leer" }, { chapter: 6, step: "Alexander erklärt den Winterschlaf." }, { chapter: 7, step: "Sie bauen ein ruhiges Laubnest statt eines Futterplatzes.", obstacle: "Der Igel flieht vor dem lauten Futterplatz" }, { chapter: 8, step: "Adrian erkennt im Laubhaufen am Zaun ein zweites Winterquartier." }],
  realWorld: "Im Herbst einen Laubhaufen liegen lassen.",
  withoutIt: "Mit noch mehr Futter würden sie den Igel wecken und vertreiben.",
};

describe("chapter book", () => {
  test("the plan carries the learning thread; the check finds a thin one", () => {
    const plan = parsePlan(rawPlan(THREAD), 8)!;
    expect(plan.bible.learning?.steps.map((entry) => entry.chapter)).toEqual([1, 4, 6, 7, 8]);
    expect(checkLearningThread(plan, 8, true)).toEqual([]);
    expect(checkLearningThread(plan, 8, false)).toEqual([]);
    const none = parsePlan(rawPlan(null), 8)!;
    expect(checkLearningThread(none, 8, true)[0]).toContain("keinen Wissensfaden");
    const thin = parsePlan(rawPlan({ ...THREAD, misconception: "", withoutIt: "", steps: [{ chapter: 5, step: "x" }] }), 8)!;
    const issues = checkLearningThread(thin, 8, true).join("\n");
    expect(issues).toContain("mindestens drei Schritte");
    expect(issues).toContain("Kapitel 1–2");
    expect(issues).toContain("Höhepunkt");
    expect(issues).toContain("Irrtum");
    // "Pfeile aus Nebel" (2026-10-19): a thread whose steps cause no story problem and that the climax does not need.
    expect(issues).toContain("withoutIt");
    expect(issues).toContain("obstacle");
    expect(plan.bible.learning?.withoutIt).toContain("wecken");
    expect(plan.bible.learning?.steps.filter((entry) => entry.obstacle)).toHaveLength(2);
    const input = { heroNames: ["Alexander", "Adrian"], castNames: [], blockedTerms: [] };
    expect(checkBookPlan(none, bookBrief().book, { ...input, learning: true }).some((issue) => issue.startsWith("Lernmodus"))).toBe(true);
    expect(checkBookPlan(none, bookBrief().book, input).some((issue) => issue.startsWith("Lernmodus"))).toBe(false);
  });

  test("pitch, plan, review, writer and critic all know the thread", () => {
    const b = bookBrief(HEDGEHOG);
    const plan = parsePlan(rawPlan(THREAD), 8)!;
    expect(buildPitchPrompt(b).user).toContain("LEARNING MODE (mandatory): every idea");
    const planPrompt = buildPlanPrompt(b, { title: "x", premise: "x", bigQuestion: "x", wonder: "x", roles: [] }, [], []).user;
    expect(planPrompt).toContain("- learning (LEARNING MODE — binding)");
    expect(planPrompt).toContain("\"learning\":{\"core\"");
    expect(planPrompt).toContain("not a lesson");
    const review = buildPlanReviewPrompt(b, plan);
    expect(review.system).toContain("learningThread");
    expect(review.user).toContain("Learning thread (LEARNING MODE");
    expect(planScoreCap({ learningThread: false })).toBe(6.5);
    expect(planReviewNotes({ checks: { learningThread: false }, scores: { redThread: 8, suspense: 8, humor: 8, characters: 8, logic: 8, overall: 6.5 }, mustFix: [], weaknesses: [], verdict: "" })[0]).toContain("Wissensfaden");
    expect(buildChapterSystemPrompt(b)).toContain("narrator's word to the listening child never explains it");
    expect(buildChapterUserPrompt(b, plan, emptyBookState(), 4, 6)).toContain("learning step here");
    const critic = buildChapterCritiquePrompt(b, plan, emptyBookState(), [{ order: 6, title: "x", content: "y", recap: "" }]);
    expect(critic.system).toContain("neither is a fact about the world");
    expect(critic.system).toContain("a factual error in what the story teaches");
    expect(critic.user).toContain("LEARNING STEP planned for chapter 6");
    // a book without learning mode keeps the old critic
    const plainCritic = buildChapterCritiquePrompt(bookBrief(), plan, emptyBookState(), [{ order: 6, title: "x", content: "y", recap: "" }]);
    expect(plainCritic.system).toContain("anything a child is supposed to learn from");
    expect(plainCritic.user).not.toContain("LEARNING THREAD");
  });

  test("Pfeile aus Nebel (2026-10-19): explained once, used afterwards; a second explanation gets a note, a word in use does not", () => {
    const core = "Wasser verdunstet: Es wird zu unsichtbarem Wasserdampf und verteilt sich in der Luft. Wärme und Wind machen das schneller.";
    const term = "Verdunstung";
    const k5 = { order: 5, content: "„Das heißt Verdunstung“, sagte er. „Wasser wird zu unsichtbarem Wasserdampf und verteilt sich in der Luft, so wie Teeduft im Zimmer. Wärme und bewegte Luft können das schneller machen.“\n\nEin Windstoß blätterte die Buchseite um." };
    const k7 = { order: 7, content: "„Das Wasser aus dem Tuch verteilt sich in der Luft“, sagte Alexander. „Wir brauchen das nasse Tuch daneben, nicht darauf.“" };
    const k8 = { order: 8, content: "„Für den Pfeil braucht es bald wieder ein bisschen Wasser. Das ist Verdunstung. Wasser verteilt sich als unsichtbarer Wasserdampf in der Luft, auch bei einem ganz gewöhnlichen Tuch.“\n\nFrau Holle nahm die Gießkanne." };
    const echo = { order: 8, content: "„Verdunstung“, sagte Adrian und hängte das Tuch an die Heizung. „Hier geht es noch schneller.“" };
    expect(explanationParagraphs(k5.content, core, term)).toHaveLength(1);
    expect(explanationParagraphs(k7.content, core, term)).toEqual([]);
    const notes = repeatedExplanationNotes([k5], [k7, k8], core, term);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/^Kapitel 8: Das Wissen wird hier ein zweites Mal erklärt \(„Das ist Verdunstung\./);
    expect(notes[0]).toContain("Kapitel 5 hat es schon erklärt");
    expect(repeatedExplanationNotes([k5, k7], [echo], core, term)).toEqual([]);
    // The first explanation in the batch is the aha.
    expect(repeatedExplanationNotes([], [k5], core, term)).toEqual([]);
    // The arc asks for an echo that uses the knowledge — never the old "explains it to someone who was not there".
    const lines = learningWriterLinesEn({ learningMode: HEDGEHOG } as any, { form: "chapterbook", band: "6-8", units: 8 }).join("\n");
    expect(lines).toContain("Never a second explanation");
    expect(lines).toContain("explained in full ONCE");
    expect(lines).not.toContain("explains it to someone who was not there");
    expect(learningLinesDe({ learningMode: HEDGEHOG } as any).join("\n")).toContain("nie als zweite Erklärung");
  });

  test("the plan's withoutIt and the story problems reach writer and critic; the climax batch is told what needs the knowledge", () => {
    const b = bookBrief(HEDGEHOG);
    const plan = parsePlan(rawPlan(THREAD), 8)!;
    expect(buildChapterUserPrompt(b, plan, emptyBookState(), 7, 7)).toContain("it causes or solves this story problem: Der Igel flieht");
    expect(buildPlanPrompt(b, { title: "x", premise: "x", bigQuestion: "x", wonder: "x", roles: [] }, [], []).user).toContain("The knowledge works FOR the plot, not beside it");
    const climax = buildChapterCritiquePrompt(b, plan, emptyBookState(), [{ order: 7, title: "x", content: "y", recap: "" }]);
    expect(climax.user).toContain("CLIMAX NEEDS IT (the planned move that fails without the knowledge): Mit noch mehr Futter");
    expect(climax.system).toContain("knowledge explained a second time");
    const early = buildChapterCritiquePrompt(b, plan, emptyBookState(), [{ order: 2, title: "x", content: "y", recap: "" }]);
    expect(early.user).not.toContain("CLIMAX NEEDS IT");
  });

  test("a knowledge sentence is recognised (lesson guard and development evidence)", () => {
    expect(mentionsKnowledge("„Im Winterschlaf braucht er fast nichts“, sagte Alexander.", THREAD.core, THREAD.term)).toBe(true);
    expect(mentionsKnowledge("„Man muss erst zuhören, bevor man redet“, sagte Adrian.", THREAD.core, THREAD.term)).toBe(false);
    const text = "Es war kalt. „Im Winter gibt es kaum Käfer“, sagte Alexander, „darum lebt der Igel von seinem Herbstfett.“ Dann lachten sie.";
    expect(knowledgeSentences(text, THREAD.core, THREAD.term)).toHaveLength(1);
  });
});

describe("Lernkosmos", () => {
  test("a learning story counts in the world of what it taught, with the goal as its topic", async () => {
    const { inferDomainFromLearning } = await import("../../helpers/cosmos-learning-domain");
    expect(inferDomainFromLearning({ learningMode: HEDGEHOG }, ["curiosity", "knowledge.biology"])).toEqual({ domainId: "nature", topic: "Warum Igel Winterschlaf halten" });
    expect(inferDomainFromLearning(JSON.stringify({ learningMode: { ...HEDGEHOG, subjects: ["geography"], learningObjectives: [] } }), ["teamwork"])).toEqual({ domainId: "earth", topic: null });
    expect(inferDomainFromLearning({ learningMode: { ...HEDGEHOG, subjects: ["science"] } }, ["knowledge.astronomy"])?.domainId).toBe("space");
    expect(inferDomainFromLearning({ learningMode: { ...HEDGEHOG, subjects: ["social"] } }, ["empathy"])).toBeNull();
    expect(inferDomainFromLearning({}, ["knowledge.biology"])).toBeNull();
  });
});
