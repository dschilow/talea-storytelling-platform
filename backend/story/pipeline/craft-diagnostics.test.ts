// @ts-ignore Bun exposes this runtime-only test helper without Node typings.
import { describe, expect, test } from "bun:test";
import {
  analyzeStoryCraft,
  buildCraftRepairBrief,
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

  test("flags a figure that only ever repeats its own catchphrase", () => {
    const issues = analyzeStoryCraft({
      chapters: [
        { order: 1, content: 'Silberfunke tanzte. „Glitzer, Funkel, Sternenstaub überall!“' },
        { order: 2, content: 'Silberfunke wirbelte. „Glitzer und Funkel, Sternenstaub!“' },
      ],
      supportingCast: [{ name: "Silberfunke", catchphrase: "Glitzer, Funkel, Sternenstaub" }],
    });
    expect(issues.map((i) => i.code)).toContain("cast-catchphrase-only");
  });

  test("a figure with a real line of its own is not flagged", () => {
    const issues = analyzeStoryCraft({
      chapters: [
        { order: 1, content: 'Silberfunke tanzte. „Glitzer, Funkel, Sternenstaub überall!“' },
        { order: 2, content: 'Silberfunke zeigte auf die Tür. „Der Riegel klemmt von innen.“' },
      ],
      supportingCast: [{ name: "Silberfunke", catchphrase: "Glitzer, Funkel, Sternenstaub" }],
    });
    expect(issues.map((i) => i.code)).not.toContain("cast-catchphrase-only");
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
