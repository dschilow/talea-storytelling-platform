// @ts-ignore Bun exposes this runtime-only test helper without Node typings.
import { describe, expect, test } from "bun:test";
import {
  analyzeStoryCraft,
  buildCraftRepairBrief,
  buildValidatorCraftIssues,
  contentStems,
  extractQuotedLines,
  pagesCarryingPhrase,
  type CraftAnalysisInput,
} from "./craft-diagnostics";
import runs from "../__fixtures__/craft-diagnostics-runs.json";

/**
 * The two fixtures are the FINAL accepted text of production runs 69dace41 and
 * eefd3600, together with the refrain / motif / cast that the beat sheet locked
 * before the prose was written.
 *
 * They are the calibration set. Read against real picture books, 69dace41 is
 * the weaker story (planned refrain used once and abandoned, two supporting
 * figures loitering in the finale) and eefd3600 the stronger one (motif carried
 * across every page, refrain paid off as a deliberate inversion, clean finale).
 * Both scored 8.7 from the LLM validator, which is exactly the blind spot this
 * module exists to cover: a check that cannot separate these two is worthless.
 */
const brunnen = (runs as any)["69dace41"] as CraftAnalysisInput & { title: string };
const karte = (runs as any)["eefd3600"] as CraftAnalysisInput & { title: string };

describe("craft diagnostics — calibration against real runs", () => {
  test("fixtures are the real five-page stories", () => {
    expect(brunnen.chapters.length).toBe(5);
    expect(karte.chapters.length).toBe(5);
    expect(brunnen.refrainLine).toBe("Schubs es weg, plopp, da ist es wieder!");
    expect(karte.refrainLine).toBe("Ein Schritt nach links, das Papier knickt laut.");
  });

  test("flags the weaker story and stays silent on the stronger one", () => {
    const weak = analyzeStoryCraft(brunnen).map((issue) => issue.code);
    const strong = analyzeStoryCraft(karte).map((issue) => issue.code);

    expect(weak).toContain("refrain-missing");
    expect(weak).toContain("finale-crowded");
    expect(strong).toEqual([]);
  });

  test("does not mistake a deliberate refrain inversion for a dropped refrain", () => {
    // eefd3600 never repeats its refrain verbatim. Page 4 inverts it:
    // "Er machte KEINEN Schritt nach links. Er machte einen Schritt nach vorne."
    // A verbatim check would demand a repair and flatten the best line in the book.
    expect(karte.chapters[3].content).toContain("keinen Schritt nach links");
    expect(pagesCarryingPhrase(karte.chapters, karte.refrainLine!)).toBeGreaterThanOrEqual(2);
  });

  test("catches the abandoned refrain by page coverage, not by counting words", () => {
    // 69dace41 states its refrain once on page 1 and never returns to it.
    expect(brunnen.chapters[0].content).toContain("Schubs es weg, plopp, da ist es wieder!");
    expect(pagesCarryingPhrase(brunnen.chapters, brunnen.refrainLine!)).toBe(1);
  });

  test("recurring motifs of both runs are genuinely carried and are not flagged", () => {
    expect(pagesCarryingPhrase(brunnen.chapters, brunnen.recurringMotif!)).toBeGreaterThanOrEqual(3);
    expect(pagesCarryingPhrase(karte.chapters, karte.recurringMotif!)).toBeGreaterThanOrEqual(3);
  });

  test("finale-crowded names the figures that should lose the last word", () => {
    const issue = analyzeStoryCraft(brunnen).find((i) => i.code === "finale-crowded");
    expect(issue).toBeDefined();
    expect(issue!.message).toContain("Magierin Luna");
    expect(issue!.message).toContain("Silberfunke");
    expect(issue!.repairHint).toContain("Hauptfiguren");
  });
});

describe("craft diagnostics — unit behaviour", () => {
  test("stems fold umlauts and survive German inflection", () => {
    expect(contentStems("Das Papier knickt laut")).toContain("knick");
    expect(contentStems("Ein letztes Knicken")).toContain("knick");
    expect(contentStems("Die Höhle")).toContain("hoehl");
  });

  test("stems drop function words and short words", () => {
    const stems = contentStems("und wenn das nicht mehr wieder da ist");
    expect(stems).toEqual([]);
  });

  test("a phrase with no usable stems never reports coverage", () => {
    expect(pagesCarryingPhrase([{ order: 1, content: "egal was" }], "und da")).toBe(0);
  });

  test("single-stem phrases fall back to a one-hit bar", () => {
    const chapters = [{ order: 1, content: "Die Brunnenkurbel quietschte." }];
    expect(pagesCarryingPhrase(chapters, "Brunnenkurbel")).toBe(1);
  });

  test("extracts German typographic and ASCII dialogue", () => {
    const lines = extractQuotedLines('„Hallo da drüben“, sagte er. "Und tschüss", rief sie.');
    expect(lines).toContain("Hallo da drüben");
    expect(lines).toContain("Und tschüss");
  });

  test("flags a figure that plays its catchphrase twice", () => {
    // Verbatim from run c5d98e71: Merlin delivers the same slogan on two pages
    // and changes nothing about the plot. The first version of this check
    // required EVERY quoted line in the story to echo the catchphrase, which a
    // real story with talking heroes can never satisfy — so it never fired.
    const issues = analyzeStoryCraft({
      chapters: [
        { order: 1, content: 'Merlin trat vor. „Magie liegt nicht im Zauberstab“, sagte er. „Sie liegt in dir.“ Alexander zog an der Karte. „Sie beißt!“' },
        { order: 2, content: 'Adrian pfiff. „Der Riss glänzt.“ Merlin stand still. „Magie liegt nicht im Zauberstab“, sagte er leise. „Sie liegt in dir.“' },
      ],
      supportingCast: [{ name: "Zauberer Merlin", catchphrase: "Magie liegt nicht im Zauberstab. Sie liegt in dir." }],
    });
    expect(issues.map((i) => i.code)).toContain("cast-catchphrase-repeated");
  });

  test("a figure that says its line once is not flagged", () => {
    const issues = analyzeStoryCraft({
      chapters: [
        { order: 1, content: 'Silberfunke tanzte. „Glitzer, Funkel, Sternenstaub überall!“ Alexander lachte. „Hör auf damit!“' },
        { order: 2, content: 'Silberfunke zeigte auf die Tür. „Der Riegel klemmt von innen.“ Adrian nickte langsam.' },
      ],
      supportingCast: [{ name: "Silberfunke", catchphrase: "Glitzer, Funkel, Sternenstaub" }],
    });
    expect(issues.map((i) => i.code)).not.toContain("cast-catchphrase-repeated");
  });

  test("the check survives heroes doing most of the talking", () => {
    // The regression that made the original check dead code.
    const issues = analyzeStoryCraft({
      chapters: [
        { order: 1, content: 'Merlin: „Magie liegt nicht im Zauberstab. Sie liegt in dir.“ „Und jetzt?“, fragte Alexander. „Keine Ahnung“, sagte Adrian. „Frag ihn nochmal.“ „Nein danke.“' },
        { order: 2, content: '„Magie liegt nicht im Zauberstab“, wiederholte Merlin. „Sie liegt in dir.“ „Das hilft uns kein Stück“, seufzte Alexander laut.' },
      ],
      supportingCast: [{ name: "Merlin", catchphrase: "Magie liegt nicht im Zauberstab. Sie liegt in dir." }],
    });
    expect(issues.map((i) => i.code)).toContain("cast-catchphrase-repeated");
  });

  test("returns nothing without chapters or without locked craft inputs", () => {
    expect(analyzeStoryCraft({ chapters: [] })).toEqual([]);
    expect(analyzeStoryCraft({ chapters: [{ order: 1, content: "Text." }] })).toEqual([]);
  });

  test("the repair brief is empty for a craft-clean story and prioritised otherwise", () => {
    expect(buildCraftRepairBrief([])).toBe("");
    const brief = buildCraftRepairBrief(analyzeStoryCraft(brunnen));
    expect(brief).toContain("CRAFT-BEFUND");
    expect(brief).toContain("PRIORITÄT");
    expect(brief).toContain("Schubs es weg");
  });
});

describe("validator-derived craft issues", () => {
  const laughless = (pages: number[], laughing: number[] = []) =>
    pages.map((page) => ({
      page,
      hasKidLaugh: laughing.includes(page),
      device: "",
      missedOpportunity: `Reaktion auf Seite ${page}`,
    }));

  test("flags humour once half the pages have no laugh", () => {
    const issues = buildValidatorCraftIssues({ humorPerPage: laughless([1, 2, 3, 4, 5], [1, 2]) });
    expect(issues.map((i) => i.code)).toContain("humor-missing");
  });

  test("a mostly funny story is left alone", () => {
    const issues = buildValidatorCraftIssues({ humorPerPage: laughless([1, 2, 3, 4, 5], [1, 2, 3]) });
    expect(issues.map((i) => i.code)).not.toContain("humor-missing");
  });

  test("humour hint carries the concrete spots the validator named", () => {
    const issues = buildValidatorCraftIssues({
      humorPerPage: [
        { page: 1, hasKidLaugh: false, missedOpportunity: "Adrians Reaktion auf die Statue" },
        { page: 2, hasKidLaugh: false, missedOpportunity: "Konrads Bart" },
      ],
    });
    const humor = issues.find((i) => i.code === "humor-missing")!;
    expect(humor.repairHint).toContain("Seite 1: Adrians Reaktion auf die Statue");
    expect(humor.repairHint).toContain("Seite 2: Konrads Bart");
    // Humour must never be bought with tension.
    expect(humor.repairHint).toContain("NICHT entschärfen");
  });

  test("no humour verdict at all produces no issue", () => {
    expect(buildValidatorCraftIssues({})).toEqual([]);
    expect(buildValidatorCraftIssues({ humorPerPage: [] })).toEqual([]);
  });

  test("turns the run e7b2d09c dimension misses into concrete instructions", () => {
    // The real verdict of the Sanduhr run. These exact numbers were computed,
    // written into qualityGateFailureReason — and never reached a repair prompt.
    const issues = buildValidatorCraftIssues({
      dimensionScores: { iconicCharacters: 8, voiceDistinctiveness: 8, endingPayoff: 8.2, emotionalEngine: 8.5 },
      dimensionFloors: { iconicCharacters: 8.2, voiceDistinctiveness: 8.2, endingPayoff: 8.5, emotionalEngine: 8.5 },
    });
    const codes = issues.map((i) => i.code);
    expect(codes).toEqual(["dimension-below-floor", "dimension-below-floor", "dimension-below-floor"]);
    // emotionalEngine sits exactly on its floor and must not be flagged.
    expect(issues.some((i) => i.message.includes("emotionalEngine"))).toBe(false);
    expect(issues.find((i) => i.message.includes("voiceDistinctiveness"))!.repairHint)
      .toContain("ohne Sprecherangabe zuordnen");
  });

  test("caps at the three widest gaps so a pass gets orders, not a wish list", () => {
    // Verbatim first-validation dimensionScores of run e7b2d09c: eight of nine
    // advisory floors missed at once.
    const issues = buildValidatorCraftIssues({
      dimensionScores: {
        emotionalEngine: 8, iconicCharacters: 7.5, voiceDistinctiveness: 7,
        endingPayoff: 8, keyMomentPayoff: 8, chapterEndPull: 7.5,
        pageTurnDrive: 8, rereadValue: 7.5,
      },
      dimensionFloors: {
        emotionalEngine: 8.5, iconicCharacters: 8.2, voiceDistinctiveness: 8.2,
        endingPayoff: 8.5, keyMomentPayoff: 8.5, chapterEndPull: 8.5,
        pageTurnDrive: 8.5, rereadValue: 8.5,
      },
    });
    expect(issues.length).toBe(3);
    // Widest gap first: voiceDistinctiveness is 1.2 under, then the two 1.0s.
    expect(issues[0].message).toContain("voiceDistinctiveness");
    expect(issues.map((i) => i.message).join(" ")).toContain("chapterEndPull");
    expect(issues.map((i) => i.message).join(" ")).toContain("rereadValue");
  });

  test("humour is exempt from the dimension cap", () => {
    const issues = buildValidatorCraftIssues({
      humorPerPage: laughless([1, 2, 3, 4, 5]),
      dimensionScores: {
        emotionalEngine: 8, iconicCharacters: 7.5, voiceDistinctiveness: 7,
        endingPayoff: 8, keyMomentPayoff: 8,
      },
      dimensionFloors: {
        emotionalEngine: 8.5, iconicCharacters: 8.2, voiceDistinctiveness: 8.2,
        endingPayoff: 8.5, keyMomentPayoff: 8.5,
      },
    });
    expect(issues.filter((i) => i.code === "humor-missing").length).toBe(1);
    expect(issues.filter((i) => i.code === "dimension-below-floor").length).toBe(3);
  });

  test("ignores dimensions above their floor, unknown dimensions, and missing scores", () => {
    expect(buildValidatorCraftIssues({
      dimensionScores: { iconicCharacters: 9 },
      dimensionFloors: { iconicCharacters: 8.2 },
    })).toEqual([]);
    // A floor without a repair hint would produce a finding nobody can act on.
    expect(buildValidatorCraftIssues({
      dimensionScores: { languageCorrectness: 8.4 },
      dimensionFloors: { languageCorrectness: 9.5 },
    })).toEqual([]);
    expect(buildValidatorCraftIssues({
      dimensionScores: {},
      dimensionFloors: { iconicCharacters: 8.2 },
    })).toEqual([]);
  });

  test("validator issues render into the same prioritised brief", () => {
    const brief = buildCraftRepairBrief(buildValidatorCraftIssues({
      humorPerPage: laughless([1, 2, 3]),
      dimensionScores: { voiceDistinctiveness: 7.5 },
      dimensionFloors: { voiceDistinctiveness: 8.2 },
    }));
    expect(brief).toContain("CRAFT-BEFUND");
    expect(brief).toContain("lacht");
    expect(brief).toContain("voiceDistinctiveness");
  });
});
