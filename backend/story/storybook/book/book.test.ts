// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { buildBrief } from "../context";
import type { CastCandidate } from "../types";
import { retryRequestFor, withServiceTier, type LlmCallResult, type LlmRequest } from "../llm";
import { bookLengthBudget, resolveBookBudget, resolveExperienceForm } from "./budget";
import { catalogueForPitch, catalogueLine, foldUmlauts, mentionsName, resolveCasting } from "./catalogue";
import { checkChapter, formulaicOpening, mergeChapterPatch, mergeOpenThreads, mergeWordings, mergeWorldState, speechTagCommas, parseChapterCritique, parseChapters, quoteInText, repeatedPhrases } from "./chapters";
import { bookBatchRanges, bookServiceTier, chapterRanges, LAUGH_REWRITE_MAX_HUMOR, resolveBookPlanner, rewriteReasons, type PlannedBook } from "./engine";
import { coldReadNotes, coldReadQuestions, unansweredQuestions } from "./coldread";
import { buildImageSlots, buildPictureNotes, directBatch, pagesFor, PICTURE_EDGE, placePictures, remainingNotes } from "./illustrations";
import { buildDirectorUserPrompt, sanitizeIllustrationPlan, type VisualEntity } from "../illustration-stage";
import { CostLedger } from "../llm";
import { checkBookPlan, mergePlanRevision, parsePitch, parsePlan, parsePlanReview, planScoreCap, samePlace } from "./plan";
import { buildChapterCritiquePrompt, buildChapterStaticContext, buildChapterSystemPrompt, buildChapterSystemWithContext, buildChapterUserPrompt, buildLogbookPrompt, buildPitchPrompt, plantedSentences, planReviewNotes } from "./prompts";
import { buildQaPrompt, isPluralElement, scopeQaReport, type ImageQaReport } from "../images";

function cleanReport(): ImageQaReport {
  return { anatomyDefects: [], animalFeaturesOnHumans: [], duplicates: [], unexpectedCharacters: [], roleSwaps: [], elementMisuse: [], textVisible: false, referenceSheetVisible: false, identityMatch: 1, sceneMatch: 1, namedCharactersVisible: 1 } as ImageQaReport;
}
import { emptyBookState, type BookBrief, type BookChapter, type CatalogueEntry } from "./types";

function entry(id: string, name: string, extra: Partial<CatalogueEntry> = {}): CatalogueEntry {
  return { id, name, species: "animal", whoTheyAre: `${name} aus dem Wald`, personality: ["neugierig"], speechStyle: [], recentUses: 0, hasImage: true, imageUrl: "https://x/y.png", ...extra } as CatalogueEntry;
}

const catalogue = [
  entry("uuid-luna", "Luna", { quirk: "behauptet, alles schon gewusst zu haben" }),
  entry("uuid-theo", "Theo Zeitsam"),
  entry("uuid-fresser", "Der Geraeusche-Fresser", { hasImage: false }),
  entry("uuid-bo", "Bo Bücherfuchs", { recentUses: 3 }),
];

function brief(overrides: Partial<BookBrief> = {}): BookBrief {
  const book = resolveBookBudget("6-8", { chapters: 12 });
  const base = buildBrief({
    config: { genre: "fairy_tales", ageGroup: "6-8", language: "de", length: "long" } as any,
    band: "6-8",
    budget: bookLengthBudget(book),
    heroes: [{ id: "hero-alexander", name: "Alexander", age: 8 }, { id: "hero-adrian", name: "Adrian", age: 7 }],
    candidates: [],
    artifacts: [],
    seed: "t",
  });
  return { ...base, book, form: "mystery", catalogue, series: null, ...overrides };
}

function planJson(overrides: any = {}) {
  const chapters = Array.from({ length: 12 }, (_, index) => ({
    n: index + 1, title: `Titel ${index + 1}`, type: ["entdeckung", "verfolgung", "rätsel", "ruhiges herzenskapitel"][index % 4], place: ["Dorfplatz", "Waldweg", "Moorhütte", "Bachufer"][index % 4],
    event: "Etwas passiert.", progress: "Ein Hinweis mehr.", laugh: "Luna fällt vom Sieb.", hook: index < 11 ? "Ein Schmatzen." : "",
    cast: ["Alexander", "Adrian", index % 2 ? "Luna" : "Theo"], plants: index === 1 ? ["S1", "S2"] : index === 2 ? ["S3"] : [], payoffs: index === 10 ? ["S1", "S2"] : index === 9 ? ["S3"] : [], pictures: ["a", "b"],
  }));
  return {
    title: "Das Schmatzen hinter der Stille",
    description: "Ein Rätsel im Klangwald.",
    bible: {
      world: "Klangwald", home: "Gartenhaus", bigQuestion: "Wer nimmt dem Wald die Geräusche weg?", truth: "Der Geräusche-Fresser sammelt Klänge.",
      limits: "Nur aus der Nähe.", workaround: "Dreischritt.", stakes: "Das Konzert.", personalReason: "Lunas Schnurren.", deadline: "Konzertbeginn",
      opponent: { who: "Der Geräusche-Fresser", motive: "will auftreten", logic: "behält Klänge" },
      characters: ["Alexander", "Adrian", "Luna", "Theo Zeitsam"].map((name) => ({ name, wants: "x", can: "x", flaw: "x", avoids: "x", voice: "x", challengedBy: "x", finalChoice: "x" })),
      runningGag: { gag: "Lunas Aussichtsposten", beats: [{ chapter: 2, beat: "Sieb" }, { chapter: 5, beat: "Pilz" }, { chapter: 12, beat: "Korb" }] },
      twistChapter: 6, lowPointChapter: 9, solution: { how: "Sie folgen den Klängen.", uses: ["S1", "S2"] },
      heart: "Luna hat keinen Platz im Konzert; die Helden geben ihr einen.", secret: null,
      freshEyes: [{ chapter: 2, moment: "Luna hält „Lampenfieber“ für eine Krankheit von Lampen." }, { chapter: 5, moment: "Theo will die Zeit „totschlagen“ und holt einen Fliegenklatscher." }],
    },
    setups: [{ id: "S1", what: "Schmatzen hinter der Hecke", planted: 2, paidOff: 11 }, { id: "S2", what: "Klangfolge", planted: 2, paidOff: 11 }, { id: "S3", what: "Dreischritt öffnet Blattwege", planted: 3, paidOff: 10 }],
    chapters,
    castIds: ["uuid-luna", "uuid-theo"],
    artifact: null,
    sequelTeasers: ["Was, wenn der Mond verstummt?"],
    ...overrides,
  };
}

const checkInput = { heroNames: ["Alexander", "Adrian"], castNames: ["Luna", "Theo Zeitsam"], blockedTerms: [] };

describe("budget and form", () => {
  test("defaults by age and clamps the wizard values", () => {
    expect(resolveBookBudget("6-8").chapters).toBe(12);
    expect(resolveBookBudget("9-12").chapters).toBe(15);
    expect(resolveBookBudget("6-8", { chapters: 99 }).chapters).toBe(12);
    expect(resolveBookBudget("6-8", { chapters: 8, imagesPerChapter: 3 })).toMatchObject({ chapters: 8, imagesPerChapter: 3 });
    expect(bookLengthBudget(resolveBookBudget("6-8")).totalWordsMin).toBe(12 * 550);
  });
  test("form follows the wizard, then the feelings", () => {
    expect(resolveExperienceForm({ genre: "magic", experienceForm: "cozy" } as any)).toBe("cozy");
    expect(resolveExperienceForm({ genre: "magic", emotionalFlavors: ["lachfreude"] } as any)).toBe("funny");
    expect(resolveExperienceForm({ genre: "adventure" } as any)).toBe("journey");
    expect(resolveExperienceForm({ genre: "fairy_tales", emotionalFlavors: ["warmherzigkeit"] } as any)).toBe("cozy");
  });
});

describe("idea-first casting", () => {
  test("umlauts spelled ae match proper umlauts", () => {
    expect(foldUmlauts("Geräusche-Fresser")).toBe("Geraeusche-Fresser");
    expect(mentionsName("Der Geräusche-Fresser schmatzte.", "Der Geraeusche-Fresser")).toBe(true);
  });
  test("the catalogue uses short aliases, never UUIDs", () => {
    const lines = catalogueForPitch(catalogue).map(({ alias, entry: item }) => catalogueLine(alias, item));
    expect(lines[0].startsWith("P1 Luna")).toBe(true);
    expect(lines.join("\n")).not.toContain("uuid-");
    expect(lines.find((line) => line.includes("Geraeusche"))).toContain("no portrait");
    expect(lines.find((line) => line.includes("Bo"))).toContain("used often lately");
    expect(buildPitchPrompt(brief()).user).not.toContain("uuid-luna");
  });
  test("aliases and ids resolve; unknown ones are dropped; the cap holds", () => {
    const idea = { title: "", premise: "", bigQuestion: "", wonder: "", roles: [
      { role: "Begleiterin", castId: "P1", why: "Angeberin" },
      { role: "falsche Fährte", castId: "uuid-theo", why: "" },
      { role: "Gegenspieler", castId: "P99", why: "" },
      { role: "Statist", castId: null, why: "" },
    ] };
    const result = resolveCasting(idea, catalogue, 2);
    expect(result.cast.map((member) => member.id)).toEqual(["uuid-luna", "uuid-theo"]);
    expect(result.notes.some((note) => note.includes("P99"))).toBe(true);
    expect(resolveCasting(idea, catalogue, 1).cast).toHaveLength(1);
  });
  test("a sequel keeps its cast and admits at most one new face", () => {
    const series = { seriesTitle: "", volume: 1, castIds: ["uuid-bo"], home: "", world: "", volumes: [], openThreads: [], runningGags: [], items: [], relationships: [] };
    const idea = { title: "", premise: "", bigQuestion: "", wonder: "", roles: [{ role: "a", castId: "uuid-luna", why: "" }, { role: "b", castId: "uuid-theo", why: "" }] };
    const result = resolveCasting(idea, catalogue, 4, series);
    expect(result.cast.map((member) => member.id)).toEqual(["uuid-bo", "uuid-luna"]);
  });
});

describe("plan", () => {
  test("a sound plan has no countable defects", () => {
    const plan = parsePlan(planJson(), 12)!;
    expect(plan.chapters).toHaveLength(12);
    expect(checkBookPlan(plan, resolveBookBudget("6-8", { chapters: 12 }), checkInput)).toEqual([]);
  });
  test("a plant without payoff, a payoff without plant, a thin solution and repeated chapter types are reported", () => {
    const raw = planJson({ setups: [{ id: "S1", what: "Schmatzen", planted: 4, paidOff: 3 }] });
    raw.chapters[10].payoffs = ["S9"];
    raw.chapters[0].type = raw.chapters[1].type = raw.chapters[2].type = "rätsel";
    const issues = checkBookPlan(parsePlan(raw, 12)!, resolveBookBudget("6-8", { chapters: 12 }), checkInput).join("\n");
    expect(issues).toContain("S1");
    expect(issues).toContain("S9");
    expect(issues).toContain("mindestens zwei");
    expect(issues).toContain("dreimal hintereinander");
  });
  test("the template title „Alexander, Adrian und die …“ is reported; names in another shape are fine", () => {
    const budget = resolveBookBudget("6-8", { chapters: 12 });
    expect(checkBookPlan(parsePlan(planJson({ title: "Alexander, Adrian und die Amtspantoffeln" }), 12)!, budget, checkInput).join("\n")).toContain("Muster");
    expect(checkBookPlan(parsePlan(planJson({ title: "Alexander und Adrian und das Schmatzen" }), 12)!, budget, checkInput).join("\n")).toContain("Muster");
    expect(checkBookPlan(parsePlan(planJson({ title: "Adrian tanzt, die Schuhe auch" }), 12)!, budget, checkInput)).toEqual([]);
  });
  test("a cast member who vanishes after the first half is reported", () => {
    const raw = planJson();
    raw.chapters.forEach((chapter: any, index: number) => { chapter.cast = index < 3 ? ["Alexander", "Theo"] : ["Alexander", "Luna"]; });
    expect(checkBookPlan(parsePlan(raw, 12)!, resolveBookBudget("6-8", { chapters: 12 }), checkInput).join("\n")).toContain("Theo Zeitsam verschwindet");
  });
  test("a profile written with umlauts counts for a pool name with ae", () => {
    const raw = planJson();
    raw.bible.characters.push({ name: "Der Geräusche-Fresser", wants: "x" });
    raw.chapters.forEach((chapter: any) => chapter.cast.push("Geräusche-Fresser"));
    const issues = checkBookPlan(parsePlan(raw, 12)!, resolveBookBudget("6-8", { chapters: 12 }), { ...checkInput, castNames: [...checkInput.castNames, "Der Geraeusche-Fresser"] });
    expect(issues).toEqual([]);
  });
  test("a partial revision replaces only the changed parts", () => {
    const merged = mergePlanRevision(planJson(), { bible: { deadline: "Mondaufgang" }, chapters: [{ n: 4, laugh: "Neuer Lacher" }] });
    const plan = parsePlan(merged, 12)!;
    expect(plan.bible.deadline).toBe("Mondaufgang");
    expect(plan.bible.bigQuestion).toContain("Geräusche");
    expect(plan.chapters[3].laugh).toBe("Neuer Lacher");
    expect(plan.chapters[3].event).toBe("Etwas passiert.");
    expect(plan.chapters).toHaveLength(12);
  });
  test("pitch parsing is tolerant", () => {
    expect(parsePitch({ ideas: [{ title: "A", premise: "p", roles: [{ role: "r", castId: "P2" }] }], choice: 9 })).toMatchObject({ choice: 1 });
    expect(parsePitch({ nope: true })).toBeNull();
  });
  test("plan review caps the score and feeds every weakness into the revision", () => {
    const review = parsePlanReview({ checks: { solutionPrepared: false, gagEscalates: "true" }, scores: { overall: 9.5 }, mustFix: [], weaknesses: [{ chapter: 5, problem: "vorhersehbar", severity: "high" }, { chapter: 2, problem: "klein", severity: "low" }] })!;
    expect(review.scores.overall).toBe(5);
    expect(planScoreCap({ gagEscalates: false })).toBe(7);
    expect(planScoreCap({ noEasyWayOut: false, climaxNew: false })).toBe(6.5);
    expect(planScoreCap({ needBeforeClimax: false })).toBe(7.5);
    const notes = planReviewNotes(review).join("\n");
    expect(notes).toContain("Lösung");
    expect(notes).toContain("Kapitel 5: vorhersehbar");
    // "Schatto führt Regie": both "low" weaknesses were real and visible in the book.
    expect(notes).toContain("Kapitel 2: klein");
  });
});

describe("chapters", () => {
  const raw = [
    "KAPITEL 1: Der Stein mit dem Schluckauf",
    "Im Garten schnarchte der Stein. Alexander zählte mit.",
    "",
    "„Hörst du das?“, fragte Adrian.",
    "RÜCKBLICK: Der Stein schnarchte.",
    "## Kapitel 2 — Eine Katze ohne Brummen",
    "Am Morgen fehlte Lunas Schnurren. Fortsetzung folgt!",
  ].join("\n");
  test("markers, titles and leftovers", () => {
    const chapters = parseChapters(raw, { german: true });
    expect(chapters.map((chapter) => [chapter.order, chapter.title])).toEqual([[1, "Der Stein mit dem Schluckauf"], [2, "Eine Katze ohne Brummen"]]);
    expect(chapters[0].content).not.toContain("RÜCKBLICK");
    expect(chapters[1].content).not.toMatch(/Fortsetzung/);
  });
  test("short chapters are hard defects, repeated phrases and narrator questions soft ones", () => {
    const b = brief();
    const earlier: BookChapter = { order: 1, title: "", recap: "", content: "Sein Herz klopfte so laut wie eine Trommel im leeren Saal." };
    const chapter: BookChapter = { order: 2, title: "", recap: "", content: "Da klopfte sein Herz so laut wie eine Trommel im leeren Saal. Ob das gut geht?" };
    const issues = checkChapter(chapter, { brief: b, budget: b.book, earlier: [earlier], names: ["Alexander", "Adrian"] });
    expect(issues.find((issue) => issue.code === "chapter_short")?.severity).toBe("hard");
    expect(issues.some((issue) => issue.code === "repeated_phrase")).toBe(true);
    expect(issues.some((issue) => issue.code === "narrator_question")).toBe(true);
    expect(repeatedPhrases(chapter, [earlier], [])[0].chapter).toBe(1);
  });
  test("a critic quote counts only when it stands in the text", () => {
    const chapter: BookChapter = { order: 3, title: "", recap: "", content: "Luna setzte sich auf das Sieb und rief, ihre Pfoten seien zusätzliche Beobachter. Alle lachten." };
    expect(quoteInText("ihre Pfoten seien zusätzliche Beobachter", chapter.content)).toBe(true);
    expect(quoteInText("Luna erklärt ihre Pfoten zu Detektiven", chapter.content)).toBe(false);
    const critique = parseChapterCritique(JSON.stringify({ chapters: [{ n: 3, laugh: "Luna erklärt ihre Pfoten zu Detektiven", hook: "Alle lachten.", suspense: 4, humor: 7, progress: "false" }] }), [chapter])!;
    expect(critique.chapters[0].laugh).toBeNull();
    expect(critique.chapters[0].unmatched?.laugh).toBe("Luna erklärt ihre Pfoten zu Detektiven");
    expect(critique.chapters[0].progress).toBe(false);
  });
  test("a quote that joins two sentences or drops a word still counts, a word fragment does not", () => {
    const content = "Er drehte sich. Der Topflappen drehte sich mit. Dann drehte er sich allein weiter und landete genau auf Alexanders Ohr.";
    expect(quoteInText("Der Topflappen drehte sich mit und landete genau auf Alexanders Ohr", content)).toBe(true);
    expect(quoteInText("ter Topflappen drehte sich mit", content)).toBe(false);
  });
  test("a speech tag after direct speech gets its comma", () => {
    expect(speechTagCommas("„Welche Reise?“ fragte Alexander.")).toBe("„Welche Reise?“, fragte Alexander.");
    expect(speechTagCommas("„Hier.“ sagte er. „Komm!“ rief Adrian.")).toBe("„Hier“, sagte er. „Komm!“, rief Adrian.");
    expect(speechTagCommas("„Hörst du das?“, fragte Adrian. „Ja.“ Alexander nickte.")).toBe("„Hörst du das?“, fragte Adrian. „Ja.“ Alexander nickte.");
  });
  test("the same opening formula in a row is a soft defect", () => {
    const b = brief();
    const names = ["Alexander", "Adrian", "Mops"];
    expect(formulaicOpening("Am nächsten Morgen saßen alle am Tisch.", names)).toBe("time");
    expect(formulaicOpening("Alexander, Adrian und Mops standen vor dem Tor.", names)).toBe("roll-call");
    expect(formulaicOpening("„Halt!“, rief Adrian.", names)).toBeNull();
    const earlier: BookChapter = { order: 4, title: "", recap: "", content: "Am Abend wehte Wind über den Hof." };
    const same: BookChapter = { order: 5, title: "", recap: "", content: "Am nächsten Morgen klebte Marmelade an der Tür." };
    const fresh: BookChapter = { order: 5, title: "", recap: "", content: "Marmelade klebte an der Tür. Am Morgen war das noch nicht so." };
    expect(checkChapter(same, { brief: b, budget: b.book, earlier: [earlier], names }).some((issue) => issue.code === "formulaic_opening")).toBe(true);
    expect(checkChapter(fresh, { brief: b, budget: b.book, earlier: [earlier], names }).some((issue) => issue.code === "formulaic_opening")).toBe(false);
  });
  test("the patch may change a sentence but not rewrite a chapter", () => {
    const base = Array.from({ length: 40 }, (_, index) => `Satz ${index} handelt vom Wald und vom Bach.`).join(" ");
    const chapters: BookChapter[] = [{ order: 4, title: "T", recap: "", content: base }];
    const small = mergeChapterPatch(`KAPITEL 4: T\n${base.replace("Satz 3 handelt", "Satz 3 erzählt")}`, chapters, true);
    expect(small[0].content).toContain("Satz 3 erzählt");
    const rewrite = mergeChapterPatch("KAPITEL 4: T\nGanz neuer Text über etwas völlig anderes.", chapters, true);
    expect(rewrite[0].content).toBe(base);
    expect(mergeChapterPatch("KEINE ÄNDERUNG", chapters, true)).toBe(chapters);
  });
});

describe("batches, pictures and prompts", () => {
  test("chapter ranges by write mode", () => {
    expect(chapterRanges(8, "batch", 3)).toEqual([[1, 3], [4, 6], [7, 8]]);
    expect(chapterRanges(3, "single")).toEqual([[1, 1], [2, 2], [3, 3]]);
    expect(chapterRanges(12, "whole")).toEqual([[1, 12]]);
    // Chapter 1 alone, then even batches of at most three.
    expect(chapterRanges(8, "batch", 3, 1)).toEqual([[1, 1], [2, 4], [5, 6], [7, 8]]);
    expect(chapterRanges(12, "batch", 3, 1)).toEqual([[1, 1], [2, 4], [5, 7], [8, 10], [11, 12]]);
    expect(chapterRanges(15, "batch", 3, 1)).toEqual([[1, 1], [2, 4], [5, 7], [8, 10], [11, 13], [14, 15]]);
    expect(bookBatchRanges(brief({ book: resolveBookBudget("6-8", { chapters: 8 }) }))).toEqual([[1, 1], [2, 4], [5, 6], [7, 8]]);
    expect(bookBatchRanges(brief({ book: resolveBookBudget("6-8", { chapters: 8 }), bookExperiment: { firstBatch: 3 } }))).toEqual([[1, 3], [4, 6], [7, 8]]);
  });
  test("two pictures per chapter sit after the middle of each half", () => {
    const content = Array.from({ length: 8 }, (_, index) => `Absatz ${index}.`).join("\n\n");
    const plan = parsePlan(planJson(), 12)!;
    const slots = buildImageSlots([{ order: 1, title: "", recap: "", content }, { order: 2, title: "", recap: "", content: "Nur ein Absatz." }], plan, 2, 5);
    expect(slots.map((slot) => [slot.slot, slot.chapter, slot.afterParagraph])).toEqual([[5, 1, 1], [6, 1, 5], [7, 2, 0]]);
    expect(slots[0].picture).toBe("a");
  });
  test("planted sentences come back verbatim when they pay off", () => {
    const plan = parsePlan(planJson(), 12)!;
    const chapters: BookChapter[] = [{ order: 3, title: "", recap: "", content: "Adrian stampfte dreimal. Da öffnete der Dreischritt einen Blattweg mitten im Farn. Luna staunte." }];
    const lines = plantedSentences(plan, chapters, 10, 10);
    expect(lines[0]).toContain("S3");
    expect(lines[0]).toContain("Da öffnete der Dreischritt einen Blattweg");
  });
  test("the book's static context sits in one identical system message (prompt cache) with the safety rules", () => {
    const b = { ...brief(), candidates: [catalogue[0] as CastCandidate] };
    const plan = parsePlan(planJson(), 12)!;
    const system = buildChapterSystemWithContext(b, plan);
    expect(system).toBe(buildChapterSystemWithContext(b, plan));
    expect(system.endsWith(buildChapterStaticContext(b, plan))).toBe(true);
    expect(buildChapterSystemPrompt(b)).toMatch(/CHILD SAFETY/);
    const later = buildChapterUserPrompt(b, plan, { ...emptyBookState(), chapters: [{ order: 3, title: "x", recap: "r", content: "Text." }] }, 4, 6);
    expect(later).not.toContain("BOOK BIBLE");
    expect(later).toContain("THE LAST LINES OF CHAPTER 3");
  });
});

describe("planner choice", () => {
  test("Luna low plans by default, `writer` puts the plan back on the writer, a chosen model keeps its own effort", () => {
    expect(resolveBookPlanner()).toEqual({ plannerModel: "openai/gpt-6-luna", planEffort: "low" });
    expect(resolveBookPlanner("writer")).toEqual({ plannerModel: undefined, planEffort: undefined });
    expect(resolveBookPlanner("openai/gpt-6-luna", "medium").planEffort).toBe("medium");
    expect(resolveBookPlanner("anthropic/claude-haiku-5.5")).toEqual({ plannerModel: "anthropic/claude-haiku-5.5", planEffort: undefined });
  });
  test("a failed planner call goes to the writer, not to Flash-Lite", () => {
    const request = { stage: "book-plan", role: "writer", model: "openai/gpt-6-luna", system: "", user: "", json: true, maxTokens: 1000, fallbackModel: "openai/gpt-6.1-sol" } as LlmRequest;
    expect(retryRequestFor(request, new Error("Truncated response")).model).toBe("openai/gpt-6.1-sol");
    expect(retryRequestFor({ ...request, fallbackModel: undefined }, new Error("Truncated response")).model).toBe("google/gemini-3.5-flash-lite");
  });
});

describe("a child without Talea knowledge (Sieben Zimmer und ein Nieser, 2026-10-15)", () => {
  test("the heroes' relation is named only when the family chose one", () => {
    const unknown = buildChapterSystemPrompt(brief());
    expect(unknown).toContain("Never name a family relation");
    const siblings = buildChapterSystemPrompt(brief({ config: { genre: "fairy_tales", ageGroup: "6-8", language: "de", length: "long", heroRelation: "Brüder" } as any }));
    expect(siblings).toContain("The heroes are Brüder");
    expect(siblings).not.toContain("Never name a family relation");
    expect(siblings).toContain("A child hears this book without knowing any of the characters");
  });
  test("the cold reader asks about the relation only when it is known, and about every newcomer", () => {
    const withRelation = coldReadQuestions({ heroes: ["Alexander", "Adrian"], relation: "Brüder", orientation: true, newcomers: ["Kuno Knopf"] }).map((q) => q.id);
    expect(withRelation).toEqual(["place", "together", "goal", "cast:Kuno Knopf"]);
    expect(coldReadQuestions({ heroes: ["Alexander", "Adrian"], relation: null, orientation: true, newcomers: [] }).map((q) => q.id)).toEqual(["place", "goal"]);
    expect(coldReadQuestions({ heroes: ["Alexander"], relation: null, orientation: false, newcomers: [] })).toEqual([]);
  });
  test("an answer counts only with a sentence from the text; gaps become notes for the right chapter", () => {
    const chapters: BookChapter[] = [
      { order: 1, title: "", recap: "", content: "Alexander schob die Bücherkiste im Kinderzimmer zur Wand. Um sechs kamen die Übernachtungsgäste." },
      { order: 2, title: "", recap: "", content: "Kuno Knopf kniete daneben und nahm seine Mütze ab. Ihre vielen Knöpfe klackerten." },
    ];
    const questions = coldReadQuestions({ heroes: ["Alexander", "Adrian"], relation: null, orientation: true, newcomers: ["Kuno Knopf"] });
    const raw = JSON.stringify({ answers: [
      { id: "place", answer: "im Kinderzimmer", quote: "Alexander schob die Bücherkiste im Kinderzimmer zur Wand." },
      { id: "goal", answer: "Schlafplätze bis sechs", quote: "Sie wollten bis sechs Uhr alle Betten fertig haben." },
      { id: "cast:Kuno Knopf", answer: null, quote: null },
    ] });
    const missing = unansweredQuestions(raw, chapters, questions);
    expect(missing).toEqual(["goal", "cast:Kuno Knopf"]);
    const plan = { bible: { characters: [{ name: "Kuno Knopf", introduction: "ein junger Schneider von nebenan, der Stoffe falten kann" }] } } as any;
    const notes = coldReadNotes(missing, { chapters, plan, heroes: ["Alexander", "Adrian"], relation: null });
    expect(notes[0]).toStartWith("Kapitel 1:");
    expect(notes[1]).toStartWith("Kapitel 2: Beim ersten Auftritt von Kuno Knopf");
    expect(notes[1]).toContain("junger Schneider");
  });
  test("the state of things keeps the latest entry per thing", () => {
    const merged = mergeWorldState(
      [{ thing: "Deckenzimmer", now: "1 zusätzliches", chapter: 1 }, { thing: "Knoten See–Wiese", now: "offen", chapter: 1 }],
      [{ thing: "die Deckenzimmer", now: "6 zusätzliche, 7 mit dem Kinderzimmer", chapter: 2 }],
    );
    expect(merged).toEqual([{ thing: "Knoten See–Wiese", now: "offen", chapter: 1 }, { thing: "die Deckenzimmer", now: "6 zusätzliche, 7 mit dem Kinderzimmer", chapter: 2 }]);
  });
  test("a stilted label for a grown-up is a soft defect", () => {
    const b = brief();
    const chapter: BookChapter = { order: 4, title: "", recap: "", content: "Nebenan klapperte die vertraute erwachsene Person mit Tassen." };
    expect(checkChapter(chapter, { brief: b, budget: b.book, earlier: [], names: [] }).find((issue) => issue.code === "stilted_grownup")?.severity).toBe("soft");
  });
  test("a plan without orientation or with too many rules is capped", () => {
    expect(planScoreCap({ orientation: false })).toBe(7);
    expect(planScoreCap({ rulesSimple: false })).toBe(7);
  });
});

describe("Die segelnden Wörter (2026-10-15): one key line, one table", () => {
  test("a spell that comes back keeps its first wording", () => {
    const merged = mergeWordings(
      [{ what: "Schlusssatz", text: "Alle finden gern den Weg nach Hause." }],
      [{ what: "der Schlusssatz", text: "Alle finden gern den Weg zurück …" }, { what: "Zauberspruch", text: "Wort an Bord, segle fort!" }],
    );
    expect(merged).toEqual([{ what: "Schlusssatz", text: "Alle finden gern den Weg nach Hause." }, { what: "der Schlusssatz", text: "Alle finden gern den Weg zurück …" }, { what: "Zauberspruch", text: "Wort an Bord, segle fort!" }]);
  });
  test("the writer, the critic and the bible all carry the fixed wordings", () => {
    const b = brief();
    const plan = parsePlan(planJson({ bible: { ...planJson().bible, fixedWordings: [{ what: "Zauberspruch", text: "Wort an Bord, segle fort!" }] } }), 12)!;
    expect(plan.bible.fixedWordings).toEqual([{ what: "Zauberspruch", text: "Wort an Bord, segle fort!" }]);
    expect(buildChapterStaticContext(b, plan)).toContain("Wort an Bord, segle fort!");
    const state = { ...emptyBookState(), wordings: [{ what: "Reim", text: "Ob nah, ob fern, nach Hause kehren alle gern." }] };
    expect(buildChapterUserPrompt(b, plan, state, 2, 3)).toContain("WORDINGS THAT STAND");
    expect(buildChapterUserPrompt(b, plan, state, 2, 3)).toContain("Ob nah, ob fern");
    expect(buildChapterCritiquePrompt(b, plan, state, [{ order: 2, title: "T", recap: "", content: "x" }]).user).toContain("FIXED WORDINGS");
  });
  test("three opening chapters at one place are a plan defect, a way out is not", () => {
    expect(samePlace("Lesetisch in der Dorflesestube", "Dorflesestube, am Fenster")).toBe(true);
    expect(samePlace("Lesetisch in der Dorflesestube", "Waldweg bei der alten Eiche")).toBe(false);
    const b = brief();
    const stuck = parsePlan(planJson({ chapters: planJson().chapters.map((chapter: any, index: number) => (index < 3 ? { ...chapter, place: "Lesetisch in der Dorflesestube" } : chapter)) }), 12)!;
    const checkInput = { heroNames: ["Alexander", "Adrian"], castNames: [] as string[], blockedTerms: [] as string[], cozy: false };
    expect(checkBookPlan(stuck, b.book, checkInput).some((issue) => issue.includes("Kapitel 1–3 spielen alle am selben Ort"))).toBe(true);
    expect(checkBookPlan(stuck, b.book, { ...checkInput, cozy: true }).some((issue) => issue.includes("selben Ort"))).toBe(false);
  });
});


describe("heart and wit (Zippel, 2026-10-15)", () => {
  test("in the full genres a plan without fresh-eyes moments or a heart is a countable defect; space books are not held to it", () => {
    const b = brief();
    const bare = parsePlan(planJson({ bible: { ...planJson().bible, heart: "", freshEyes: [{ chapter: 2, moment: "nur einer" }] } }), 12)!;
    const issues = checkBookPlan(bare, b.book, { ...checkInput, genre: "fairy_tales" }).join(" | ");
    expect(issues).toContain("frischem Blick");
    expect(issues).toContain("Herz der Freundschaft");
    expect(checkBookPlan(bare, b.book, { ...checkInput, genre: "scifi" })).toEqual([]);
  });
  test("secret null stays empty; heart, secret and fresh-eyes moments reach the writer's chapter plan", () => {
    const plan = parsePlan(planJson(), 12)!;
    expect(plan.bible.secret).toBe("");
    const withSecret = parsePlan(planJson({ bible: { ...planJson().bible, secret: "Nur die Helden hören Luna sprechen." } }), 12)!;
    const b = brief();
    const context = buildChapterStaticContext(b, withSecret);
    expect(context).toContain("Heart of the friendship");
    expect(context).toContain("Nur die Helden hören Luna sprechen.");
    const chapterTwo = buildChapterUserPrompt(b, withSecret, emptyBookState(), 2, 2);
    expect(chapterTwo).toContain("Lampenfieber");
    expect(chapterTwo).not.toContain("totschlagen");
  });
  test("fairy tales, magic and everyday books get the full rules and the everyday-wonder idea", () => {
    const magic = brief({ config: { genre: "magic", ageGroup: "9-12", language: "de", length: "long" } as any, band: "9-12" });
    const pitch = buildPitchPrompt(magic).user;
    expect(pitch).toContain("wonder-someone into the heroes' everyday world");
    expect(pitch).toContain("the spell keeps its visible effect");
    expect(pitch).toContain("sharper wit");
    expect(buildChapterSystemPrompt(magic)).toContain("The wonder is a someone");
    const modern = buildPitchPrompt(brief({ config: { genre: "modern", ageGroup: "6-8", language: "de", length: "long" } as any })).user;
    expect(modern).toContain("unusual someone");
    expect(modern).not.toContain("wonder-someone");
  });
  test("space, adventure and animal books keep their own world and get only the light rules (run K2: a space mystery moved to a schoolyard)", () => {
    for (const genre of ["scifi", "adventure", "animals"]) {
      const b = brief({ config: { genre, ageGroup: "9-12", language: "de", length: "long" } as any, band: "9-12" });
      const pitch = buildPitchPrompt(b).user;
      expect(pitch).not.toContain("everyday world");
      expect(pitch).not.toContain("a someone at its heart");
      const writer = buildChapterSystemPrompt(b);
      expect(writer).toContain("HEART AND WIT");
      expect(writer).toContain("truly works in Deutsch");
      expect(writer).not.toContain("The wonder is a someone");
    }
  });
  test("a plan whose wonder is only a mechanism is capped and gets a note", () => {
    expect(planScoreCap({ heartAndWit: false })).toBe(7.5);
    const review = parsePlanReview({ checks: { heartAndWit: false }, scores: { overall: 9 }, mustFix: [], weaknesses: [] });
    expect(planReviewNotes(review).join(" | ")).toContain("Jemand mit Eigensinn");
  });
});

describe("heart and wit kill switch", () => {
  test("TALEA_HEART_AND_WIT=off removes every trace from pitch, plan, review, writer and plan checks", () => {
    const before = process.env.TALEA_HEART_AND_WIT;
    process.env.TALEA_HEART_AND_WIT = "off";
    try {
      const b = brief();
      const plan = parsePlan(planJson({ bible: { ...planJson().bible, heart: "", freshEyes: [] } }), 12)!;
      const texts = [buildPitchPrompt(b).user, buildChapterSystemPrompt(b)].join("\n");
      expect(texts).not.toMatch(/HEART AND WIT|a someone|wonder-someone|fresh eyes|freshEyes/i);
      expect(checkBookPlan(plan, b.book, checkInput)).toEqual([]);
    } finally {
      if (before === undefined) delete process.env.TALEA_HEART_AND_WIT;
      else process.env.TALEA_HEART_AND_WIT = before;
    }
  });
});

describe("Schatto führt Regie (2026-10-16): cheaper, sooner, nothing left dangling", () => {
  test("the plan and chapter 1 stay on the fast tier, everything after runs on flex; the switch turns it off or on for all", () => {
    expect(bookServiceTier("plan", "")).toBeUndefined();
    expect(bookServiceTier("first", "")).toBeUndefined();
    expect(bookServiceTier("later", "")).toBe("flex");
    expect(bookServiceTier("later", "off")).toBeUndefined();
    expect(bookServiceTier("plan", "all")).toBe("flex");
  });
  test("the flex port asks for flex unless a request names its own tier", async () => {
    const seen: Array<string | undefined> = [];
    const answer = (request: LlmRequest): LlmCallResult => {
      seen.push(request.serviceTier);
      return { text: "x", modelUsed: request.model, usage: { prompt: 0, completion: 0, total: 0, costUSD: 0 }, durationMs: 0 };
    };
    const request: LlmRequest = { stage: "a", role: "writer", model: "m", system: "", user: "", json: false, maxTokens: 10 };
    await withServiceTier(async (r) => answer(r), "flex")(request);
    await withServiceTier(async (r) => answer(r), undefined)(request);
    expect(seen).toEqual(["flex", undefined]);
  });
  test("no quotable laugh is a rewrite only when the critic also rates the humour low", () => {
    const plan = parsePlan(planJson(), 12)!;
    const planned = { plan, brief: brief() } as unknown as PlannedBook;
    const chapter = { order: 2, title: "t", recap: "", content: "Text." };
    const critique = (humor: number) => ({ n: 2, laugh: null, hook: "Ende.", suspense: 5, humor, progress: true, missingPlants: [] });
    expect(rewriteReasons(critique(LAUGH_REWRITE_MAX_HUMOR + 1), chapter, planned, []).map((reason) => reason.code)).toEqual([]);
    expect(rewriteReasons(critique(LAUGH_REWRITE_MAX_HUMOR), chapter, planned, []).map((reason) => reason.code)).toContain("no-laugh");
  });
  test("open questions get stable ids, answered ones leave, duplicates and old ones stay put", () => {
    let threads = mergeOpenThreads([], [{ chapter: 1, question: "Was ist der kleine Schatten zu Schattos Füßen?" }, { chapter: 1, question: "Wer hat die Kulisse gebaut?" }], []);
    expect(threads.map((thread) => thread.id)).toEqual(["F1", "F2"]);
    threads = mergeOpenThreads(threads, [{ chapter: 3, question: "was ist der kleine Schatten zu Schattos Füßen?" }, { chapter: 3, question: "Wer wartet vor dem Tor?" }], ["f2"]);
    expect(threads.map((thread) => `${thread.id}:${thread.chapter}`)).toEqual(["F1:1", "F3:3"]);
    const many = mergeOpenThreads([], Array.from({ length: 12 }, (_, index) => ({ chapter: 1, question: `Frage ${index}?` })), []);
    expect(many).toHaveLength(8);
    expect(many[0].question).toBe("Frage 0?");
  });
  test("writer, logbook and the final critic all see the open questions; the critic reports what stays open", () => {
    const plan = parsePlan(planJson(), 12)!;
    const state = { ...emptyBookState(), openThreads: [{ id: "F1", chapter: 1, question: "Was ist der kleine Schatten?" }] };
    const writer = buildChapterUserPrompt(brief(), plan, state, 11, 12);
    expect(writer).toContain("OPEN QUESTIONS");
    expect(writer).toContain("F1 (chapter 1): Was ist der kleine Schatten?");
    expect(writer).toContain("answer every OPEN QUESTION");
    const logbook = buildLogbookPrompt(brief(), [{ order: 2, title: "t", recap: "", content: "Text." }], [], state.openThreads).user;
    expect(logbook).toContain("F1: Was ist der kleine Schatten?");
    expect(logbook).toContain("- opened:");
    const chapters = [{ order: 11, title: "a", recap: "", content: "Text." }, { order: 12, title: "b", recap: "", content: "Ende." }];
    const finalCritic = buildChapterCritiquePrompt(brief(), plan, state, chapters);
    expect(finalCritic.system).toContain("unanswered");
    expect(finalCritic.user).toContain("F1 (chapter 1)");
    expect(finalCritic.user).toContain("LIMITS OF THE WONDER");
    const middleCritic = buildChapterCritiquePrompt(brief(), plan, state, [{ order: 4, title: "a", recap: "", content: "Text." }]);
    expect(middleCritic.system).not.toContain("unanswered");
    expect(parseChapterCritique(JSON.stringify({ chapters: [{ n: 12 }], unanswered: ["f1", "x"] }), [chapters[1]])!.unanswered).toEqual(["F1"]);
  });
  test("interchangeable heroes or unclear places cap the plan; the rules reach the writer", () => {
    expect(planScoreCap({ heroesDistinct: false })).toBe(7.5);
    expect(planScoreCap({ placesClear: false })).toBe(7.5);
    const system = buildChapterSystemPrompt(brief());
    expect(system).toContain("never interchangeable");
    expect(system).toContain("No new rhyme or spell in the last two chapters");
    expect(system).toContain("it was only the wind");
  });
  test("the checker does not count the children's shadows as a living shadow's arms", () => {
    expect(buildQaPrompt([], "Schatto an der Mauer", false, [{ name: "Schatto", look: "flat dark silhouette cast on the courtyard wall" }])).toContain("not an extra limb");
    expect(buildQaPrompt([], "Kicher am Rahmen", false, [{ name: "Rahmen", look: "wooden frame" }])).not.toContain("not an extra limb");
  });
  test("the log says what is still wrong with the picture that was printed, not only why it was redrawn", () => {
    const history = [
      { kind: "full", status: "failed", severity: 30, notes: ["Alexander has pointed ears", "Adrian missing"] },
      { kind: "redraw", status: "flawed", severity: 20, notes: ["a figure mixes features of two characters [jev 97%]", "scene 0.35"] },
    ];
    expect(remainingNotes({ history, severity: 20 })).toEqual(["a figure mixes features of two characters [jev 97%]", "scene 0.35"]);
    expect(remainingNotes({ history, severity: 30 })).toEqual(["Alexander has pointed ears", "Adrian missing"]);
    expect(remainingNotes({ history: [{ kind: "full", status: "passed", severity: 0, notes: [] }], severity: 0 })).toEqual([]);
    expect(remainingNotes({ severity: 10 })).toEqual([]);
  });
  test("things that come in numbers are never counted as drawn twice (run flex-quality-1: three of six pictures redrawn for bubbles)", () => {
    expect(isPluralElement({ name: "Geräuschblasen", noun: "hopping sound bubbles" })).toBe(true);
    expect(isPluralElement({ name: "Gans", noun: "grey goose" })).toBe(false);
    expect(isPluralElement({ name: "Glas", noun: "magnifying glass" })).toBe(false);
    expect(isPluralElement({ name: "Krake", noun: "octopus" })).toBe(false);
    const bubbles = { name: "Geräuschblasen", noun: "hopping sound bubbles", look: "small round bubbles" };
    const prompt = buildQaPrompt([], "Blasen hüpfen", false, [bubbles, { name: "Topf", noun: "copper pot", look: "copper pot" }]);
    expect(prompt).toContain("come in numbers by nature");
    expect(prompt).not.toContain("\"Geräuschblasen\":\"integer count\"");
    expect(prompt).toContain("\"Topf\":\"integer count\"");
    const report = scopeQaReport({ ...cleanReport(), duplicates: ["Geräuschblasen drawn 8 times", "Topf drawn 2 times"] }, ["Alexander"], [bubbles, { name: "Topf", noun: "copper pot", look: "copper pot" }]);
    expect(report.duplicates).toEqual([]);
    expect(report.thingDuplicates).toEqual(["Topf drawn 2 times"]);
  });
  test("a thing named in the singular but painted and told in numbers is plural too (re-run: \"sound bubble drawn 6 times\" on 6 of 15 pictures)", () => {
    const bubble = { name: "Geräuschblase", noun: "sound bubble", look: "small round shimmering bubbles that hop" };
    expect(isPluralElement(bubble)).toBe(true);
    expect(isPluralElement({ name: "Geräuschblase", noun: "sound bubble", look: "a shimmering sphere" }, "Alexander watches the sound bubbles hop along the bench.")).toBe(true);
    // One pot stays one pot, also when the scene speaks of another thing in the plural.
    expect(isPluralElement({ name: "Topf", noun: "copper pot", look: "a copper pot with a dent" }, "Adrian carries the pot past the shoes.")).toBe(false);
    const prompt = buildQaPrompt([], "Bubbles hop on the bench", false, [bubble]);
    expect(prompt).toContain("come in numbers by nature");
    expect(prompt).not.toContain("\"Geräuschblase\":\"integer count\"");
    const report = scopeQaReport({ ...cleanReport(), duplicates: ["sound bubble drawn 10 times", "sound bubble appears twice"] }, ["Alexander"], [bubble]);
    expect(report.duplicates).toEqual([]);
    expect(report.thingDuplicates).toEqual([]);
  });
  test("four or more of a single thing is a group, two or three is still a doubled thing", () => {
    const pot = { name: "Topf", noun: "copper pot", look: "a copper pot" };
    const report = scopeQaReport({ ...cleanReport(), duplicates: ["copper pot drawn 2 times", "copper pot drawn 3 times", "copper pot drawn 6 times"] }, ["Alexander"], [pot]);
    expect(report.thingDuplicates).toEqual(["copper pot drawn 2 times", "copper pot drawn 3 times"]);
  });
});

describe("pictures sit after the paragraph they show (audit 2026-10-16: 11 of 16 scenes were 3-7 paragraphs off their place)", () => {
  const long = Array.from({ length: 12 }, (_, index) => `Absatz ${index + 1}.`).join("\n\n");
  const chapters = [{ order: 1, title: "Eins", recap: "", content: long }];
  const heroes: VisualEntity[] = [["hero-alexander", "Alexander"], ["hero-adrian", "Adrian"]].map(([id, name]) => ({ id, name, kind: "character", role: "hero", species: "human", isHuman: true, appearance: "child", forbidden: [] }) as VisualEntity);
  const answer = (request: LlmRequest, data: unknown): LlmCallResult => ({ text: JSON.stringify(data), modelUsed: request.model, usage: { prompt: 1, completion: 1, total: 2, costUSD: 0 }, durationMs: 1 });

  test("slots know where their segment starts and how long it is", () => {
    const slots = buildImageSlots(chapters, parsePlan(planJson(), 12)!, 2);
    expect(slots.map((slot) => [slot.first, slot.count, slot.afterParagraph])).toEqual([[0, 6, 2], [6, 6, 8]]);
    expect(pagesFor(slots)[1].paragraphs).toEqual(["Absatz 7.", "Absatz 8.", "Absatz 9.", "Absatz 10.", "Absatz 11.", "Absatz 12."]);
  });

  test("the director's paragraph decides the place; edges keep pictures apart and the chapter's ending out", () => {
    const slots = buildImageSlots([{ ...chapters[0], content: Array.from({ length: 50 }, (_, index) => `Absatz ${index + 1}.`).join("\n\n") }], parsePlan(planJson(), 12)!, 2);
    expect(slots.map((slot) => [slot.first, slot.count])).toEqual([[0, 25], [25, 25]]);
    // p7 of the second segment = chapter paragraph 32, i.e. after index 31
    expect(placePictures(slots, [{ paragraph: 12 }, { paragraph: 7 }])).toEqual([
      { afterParagraph: 11, by: "director", paragraph: 12 },
      { afterParagraph: 31, by: "director", paragraph: 7 },
    ]);
    // too early / too late is pulled to the edge rule: at least 3 paragraphs in, at least 3 before the segment's end
    expect(placePictures(slots, [{ paragraph: 1 }, { paragraph: 25 }]).map((place) => place.paragraph)).toEqual([PICTURE_EDGE, 25 - PICTURE_EDGE]);
    expect(placePictures(slots, [{ paragraph: 25 }, { paragraph: 25 }])[1].afterParagraph).toBe(49 - PICTURE_EDGE);
  });

  test("no usable paragraph, or a segment too short for the edges: the middle of the segment, as before", () => {
    const slots = buildImageSlots(chapters, parsePlan(planJson(), 12)!, 2);
    expect(placePictures(slots, [undefined, {}]).map((place) => [place.by, place.afterParagraph])).toEqual([["middle", 2], ["middle", 8]]);
    // Six paragraphs leave exactly one place between the edges; five leave none.
    expect(placePictures(slots, [{ paragraph: 4 }, { paragraph: 4 }]).map((place) => [place.by, place.paragraph])).toEqual([["director", 3], ["director", 3]]);
    const short = buildImageSlots([{ ...chapters[0], content: Array.from({ length: 10 }, (_, index) => `A${index}.`).join("\n\n") }], parsePlan(planJson(), 12)!, 2);
    expect(short.map((slot) => slot.count)).toEqual([5, 5]);
    expect(placePictures(short, [{ paragraph: 3 }, { paragraph: 3 }]).map((place) => place.by)).toEqual(["middle", "middle"]);
    const roomy = buildImageSlots([{ ...chapters[0], content: Array.from({ length: 20 }, (_, index) => `A${index}.`).join("\n\n") }], parsePlan(planJson(), 12)!, 2);
    expect(placePictures(roomy, [{ paragraph: 0 }, { paragraph: 99 }, ]).map((place) => place.by)).toEqual(["middle", "middle"]);
  });

  test("the director gets numbered paragraphs and a paragraph field; a picture book page stays one block", () => {
    const slots = buildImageSlots(chapters, parsePlan(planJson(), 12)!, 2);
    const plan = { pages: [], title: "t" } as any;
    const numbered = buildDirectorUserPrompt({ title: "t", pages: pagesFor(slots), plan, entities: heroes, maxPerImage: 3 });
    expect(numbered).toContain("p1: Absatz 1.");
    expect(numbered).toContain("p6: Absatz 6.");
    expect(numbered).toContain('"paragraph": 0');
    const block = buildDirectorUserPrompt({ title: "t", pages: [{ order: 1, title: "S", content: "Erst. Dann." }], plan, entities: heroes, maxPerImage: 3 });
    expect(block).toContain("Erst. Dann.");
    expect(block).not.toContain("p1:");
    expect(block).not.toContain('"paragraph"');
  });

  test("the paragraph is read from 12, \"p12\" or \"Paragraph 12\"; zero, nonsense and the cover give none", () => {
    const shot = (paragraph: unknown) => sanitizeIllustrationPlan({ cover: { scene: "Alexander stands.", onStage: ["hero-alexander"], paragraph: 5 }, pages: [{ page: 1, scene: "Adrian runs.", onStage: ["hero-adrian"], paragraph }] }, 1, { pages: [] } as any, heroes, 3);
    expect(shot(12).pages[0].paragraph).toBe(12);
    expect(shot("p12").pages[0].paragraph).toBe(12);
    expect(shot("Paragraph 7").pages[0].paragraph).toBe(7);
    expect(shot(0).pages[0].paragraph).toBeUndefined();
    expect(shot("soon").pages[0].paragraph).toBeUndefined();
    expect(shot(12).cover.paragraph).toBeUndefined();
  });

  test("directing a batch: the director sees p1…, names a paragraph, and the picture is placed and noted there", async () => {
    const plan = parsePlan(planJson(), 12)!;
    const slots = buildImageSlots(chapters, plan, 1);
    const seen: LlmRequest[] = [];
    const llm = async (request: LlmRequest) => {
      seen.push(request);
      return answer(request, { pages: [{ page: 1, paragraph: "p7", scene: "Alexander laughs beside a bench in the yard.", onStage: ["hero-alexander"] }] });
    };
    const directed = await directBatch({ llm, models: { writer: "w", support: "s", critic: "c" }, ledger: new CostLedger(), brief: brief(), plan, chapters, entities: heroes, slots, withCover: false });
    expect(seen[0].user).toContain("p7: Absatz 7.");
    expect(seen[0].user).toContain("p12: Absatz 12.");
    expect(directed.placed).toEqual([{ afterParagraph: 6, by: "director", paragraph: 7 }]);
    expect(directed.notes).toHaveLength(1);
    expect(directed.notes[0]).toMatchObject({ chapter: 1, afterParagraph: 6, placedBy: "director", figures: ["Alexander"] });
  });

  test("the director's rules name the paragraph, the edges and the order of the three figure places", async () => {
    const plan = parsePlan(planJson(), 12)!;
    const seen: LlmRequest[] = [];
    await directBatch({
      llm: async (request) => { seen.push(request); return answer(request, {}); },
      models: { writer: "w", support: "s", critic: "c" }, ledger: new CostLedger(), brief: brief(), plan, chapters, entities: heroes, slots: buildImageSlots(chapters, plan, 1), withCover: false,
    });
    expect(seen[0].user).toContain('return "paragraph"');
    expect(seen[0].user).toContain(`at least ${PICTURE_EDGE} paragraphs from the start`);
    expect(seen[0].user).toContain("the heroes who are present in the scene of your paragraph");
    expect(seen[0].user).not.toContain("MIDDLE paragraph");
  });

  test("a repaired shot keeps the paragraph its first version named", async () => {
    const plan = parsePlan(planJson(), 12)!;
    let call = 0;
    const llm = async (request: LlmRequest) => {
      call += 1;
      // The first brief names a figure that does not exist (needs repair), the repair forgets the paragraph.
      return answer(request, call === 1
        ? { pages: [{ page: 1, paragraph: 5, scene: "A stranger waves at the bench.", onStage: ["nobody-here"] }] }
        : { pages: [{ page: 1, scene: "Alexander waves at the bench.", onStage: ["hero-alexander"] }] });
    };
    const directed = await directBatch({ llm, models: { writer: "w", support: "s", critic: "c" }, ledger: new CostLedger(), brief: brief(), plan, chapters, entities: heroes, slots: buildImageSlots(chapters, plan, 1), withCover: false });
    expect(call).toBe(2);
    expect(directed.illustrations.pages[0].paragraph).toBe(5);
    expect(directed.placed[0]).toMatchObject({ by: "director", afterParagraph: 4 });
  });

  test("the admin note lists who acts at the place but is not drawn", () => {
    const plan = parsePlan(planJson(), 12)!;
    const content = ["Anfang.", "Alexander kam.", "Adrian kam auch.", "Kicher kicherte.", "Alle lachten.", "Ende.", "Noch mehr.", "Und mehr."].join("\n\n");
    const slots = buildImageSlots([{ order: 1, title: "t", recap: "", content }], plan, 1);
    const cast: VisualEntity = { ...heroes[0], id: "c", name: "Kicher", role: "cast" };
    const shots = [{ page: 1, scene: "Kicher giggles.", onStage: ["c"], artifactVisible: false }];
    const notes = buildPictureNotes(slots, shots as any, [{ afterParagraph: 3, by: "director", paragraph: 4 }], [...heroes, cast], [], [{ order: 1, title: "t", recap: "", content }]);
    expect(notes[0]).toMatchObject({ chapter: 1, afterParagraph: 3, placedBy: "director", figures: ["Kicher"], missing: ["Alexander", "Adrian"] });
  });
});
