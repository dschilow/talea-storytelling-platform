// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { buildBrief } from "../context";
import type { CastCandidate } from "../types";
import { retryRequestFor, type LlmRequest } from "../llm";
import { bookLengthBudget, resolveBookBudget, resolveExperienceForm } from "./budget";
import { catalogueForPitch, catalogueLine, foldUmlauts, mentionsName, resolveCasting } from "./catalogue";
import { checkChapter, formulaicOpening, mergeChapterPatch, mergeWordings, mergeWorldState, speechTagCommas, parseChapterCritique, parseChapters, quoteInText, repeatedPhrases } from "./chapters";
import { chapterRanges, resolveBookPlanner } from "./engine";
import { coldReadNotes, coldReadQuestions, unansweredQuestions } from "./coldread";
import { buildImageSlots } from "./illustrations";
import { checkBookPlan, mergePlanRevision, parsePitch, parsePlan, parsePlanReview, planScoreCap, samePlace } from "./plan";
import { buildChapterCritiquePrompt, buildChapterStaticContext, buildChapterSystemPrompt, buildChapterSystemWithContext, buildChapterUserPrompt, buildPitchPrompt, plantedSentences, planReviewNotes } from "./prompts";
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
  test("plan review caps the score and feeds high weaknesses into the revision", () => {
    const review = parsePlanReview({ checks: { solutionPrepared: false, gagEscalates: "true" }, scores: { overall: 9.5 }, mustFix: [], weaknesses: [{ chapter: 5, problem: "vorhersehbar", severity: "high" }, { chapter: 2, problem: "klein", severity: "low" }] })!;
    expect(review.scores.overall).toBe(5);
    expect(planScoreCap({ gagEscalates: false })).toBe(7);
    expect(planScoreCap({ noEasyWayOut: false, climaxNew: false })).toBe(6.5);
    expect(planScoreCap({ needBeforeClimax: false })).toBe(7.5);
    const notes = planReviewNotes(review).join("\n");
    expect(notes).toContain("Lösung");
    expect(notes).toContain("Kapitel 5: vorhersehbar");
    expect(notes).not.toContain("klein");
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

