// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { buildBrief } from "../context";
import type { CastCandidate } from "../types";
import { bookLengthBudget, resolveBookBudget, resolveExperienceForm } from "./budget";
import { catalogueForPitch, catalogueLine, foldUmlauts, mentionsName, resolveCasting } from "./catalogue";
import { checkChapter, mergeChapterPatch, parseChapterCritique, parseChapters, quoteInText, repeatedPhrases } from "./chapters";
import { chapterRanges } from "./engine";
import { buildImageSlots } from "./illustrations";
import { checkBookPlan, mergePlanRevision, parsePitch, parsePlan, parsePlanReview, planScoreCap } from "./plan";
import { buildChapterStaticContext, buildChapterSystemPrompt, buildChapterSystemWithContext, buildChapterUserPrompt, buildPitchPrompt, plantedSentences, planReviewNotes } from "./prompts";
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
    n: index + 1, title: `Titel ${index + 1}`, type: ["entdeckung", "verfolgung", "rätsel", "ruhiges herzenskapitel"][index % 4], place: "Wald",
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
    expect(critique.chapters[0].progress).toBe(false);
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
