// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import type { StoryBrief } from "../storybook/context";
import type { VisualEntity } from "../storybook/illustration-stage";
import type { ImageOutcome } from "../storybook/images";
import type { LlmCallResult, StorybookLlm } from "../storybook/llm";
import type { StoryPlan, StorybookPage } from "../storybook/types";
import { chapterPictures, coverStandIn, directEpisodePictures, directorNote, episodePicturesPerChapter, segmentPlan, type ChapterPicture } from "./pictures";

// "Der Riese hinterm Teig" (2026-10-26): the director named paragraph 22 and 58, the story kept one URL per chapter, and
// Magd Elsa acted in all three chapters while two heroes and the title creature filled every picture.
const entity = (id: string, name: string, role: "hero" | "cast", species = "human"): VisualEntity => ({ id, name, kind: "character", role, species, isHuman: species === "human", appearance: "x", forbidden: [] });
const entities = [entity("alexander", "Alexander", "hero"), entity("adrian", "Adrian", "hero"), entity("elsa", "Magd Elsa", "cast"), entity("knisterich", "Knisterich", "cast", "magical creature")];

/** 24 paragraphs per chapter; the given lines replace the filler at their paragraph (1-based). */
function chapter(order: number, lines: Record<number, string>): StorybookPage {
  const paragraphs = Array.from({ length: 24 }, (_, index) => lines[index + 1] || (index % 2 ? "Adrian lachte." : "Alexander ging weiter."));
  return { order, title: `Kapitel ${order}`, content: paragraphs.join("\n\n"), paragraphs };
}
const pages = [
  chapter(1, { 5: "Magd Elsa summte vor einem Korb voller Handschuhe.", 10: "Knisterich entfaltete einen Flügel.", 16: "Knisterich wuchs bis zur Tischkante." }),
  chapter(2, { 6: "Knisterich zog den Mehlsack über den Kopf.", 18: "Adrian setzte einen Fuß vor.", 19: "Knisterich schrumpfte." }),
  chapter(3, { 8: "Knisterich duckte sich hinter den Teigtrog.", 20: "Magd Elsa blieb in der Tür stehen.", 21: "Magd Elsa ließ den Besen sinken." }),
];
const plan = {
  title: "Der Riese hinterm Teig", logline: "x", pages: [], heroes: [{ id: "alexander", name: "Alexander" }, { id: "adrian", name: "Adrian" }],
  cast: [{ id: "elsa", name: "Magd Elsa", role: "grownup" }, { id: "knisterich", name: "Knisterich", role: "wonder" }],
} as unknown as StoryPlan;
const brief = { config: { genre: "fairy_tales", setting: "village" }, budget: { maxCharactersPerImage: 3 } } as unknown as StoryBrief;

const answer = (value: unknown): LlmCallResult => ({ text: JSON.stringify(value), modelUsed: "m", usage: { prompt: 1, completion: 1, total: 2, costUSD: 0 }, durationMs: 1 });
/** A director who fills every picture with both heroes and the creature — and never thinks of Elsa. */
const director: StorybookLlm = async () => answer({
  storyElements: [],
  cover: { scene: "Alexander and Adrian watch Knisterich shrink beside a loaf.", onStage: ["alexander", "adrian", "knisterich"], artifactVisible: false, elements: [] },
  pages: [
    { page: 1, paragraph: 5, scene: "Alexander stacks tins while Adrian reaches up to the shelf.", onStage: ["alexander", "adrian"], focus: "scene" },
    { page: 2, paragraph: 10, scene: "Knisterich unfolds a wing; Alexander and Adrian step back.", onStage: ["alexander", "adrian", "knisterich"], focus: "scene" },
    { page: 3, paragraph: 6, scene: "Knisterich pulls the flour sack over its head; Alexander and Adrian watch.", onStage: ["alexander", "adrian", "knisterich"], focus: "scene" },
    { page: 4, paragraph: 6, scene: "Adrian places one foot forward while Knisterich shrinks.", onStage: ["alexander", "adrian", "knisterich"], focus: "scene" },
    { page: 5, paragraph: 5, scene: "Knisterich hides behind the dough trough; Alexander and Adrian whisper.", onStage: ["alexander", "adrian", "knisterich"], focus: "scene" },
    { page: 6, paragraph: 8, scene: "Alexander and Adrian stand at the door, Knisterich towers over them.", onStage: ["alexander", "adrian", "knisterich"], focus: "scene" },
  ],
});

describe("Talea-Folge pictures", () => {
  test("two pictures per chapter unless TALEA_EPISODE_PICTURES says otherwise", () => {
    expect(episodePicturesPerChapter(undefined)).toBe(2);
    expect(episodePicturesPerChapter("3")).toBe(3);
    expect(episodePicturesPerChapter("1")).toBe(1);
    expect(episodePicturesPerChapter("9")).toBe(2);
    expect(episodePicturesPerChapter("viele")).toBe(2);
  });

  test("each picture is printed right after the paragraph the director named; every acting figure is drawn at least once", async () => {
    const direction = await directEpisodePictures({ llm: director, model: "m", brief, title: "Der Riese hinterm Teig", pages, plan, entities });
    expect(direction.slots.map((slot) => `${slot.chapter}.${slot.part}`)).toEqual(["1.0", "1.1", "2.0", "2.1", "3.0", "3.1"]);
    // Segment 2 of chapter 2 starts at paragraph 13 (0-based 12); the director's paragraph 6 → after 0-based paragraph 17.
    expect(direction.placed.map((placement) => placement.by)).toEqual(Array(6).fill("director"));
    expect(direction.placed[3].afterParagraph).toBe(12 + 6 - 1);
    expect(direction.placed[0].afterParagraph).toBe(4);
    // Elsa acts in chapter 1 (paragraph 5) and chapter 3 (paragraphs 20–21) and was in none of the director's pictures.
    const withElsa = direction.illustrations.pages.filter((shot) => shot.onStage.includes("elsa")).map((shot) => shot.page);
    expect(withElsa.length).toBeGreaterThanOrEqual(1);
    expect(direction.changes.some((change) => change.name === "Magd Elsa")).toBe(true);
    expect(direction.unplaced).toEqual([]);
    // Nobody is crowded out of a three-figure picture, and the heroes stay.
    for (const shot of direction.illustrations.pages) {
      expect(shot.onStage.length).toBeLessThanOrEqual(3);
      expect(shot.onStage).toContain("alexander");
      expect(shot.onStage).toContain("adrian");
    }
  });

  test("a figure who acts but fits no picture is reported, not silently dropped", async () => {
    const lonely = [...pages.slice(0, 2), chapter(3, { 8: "Knisterich duckte sich hinter den Teigtrog." })];
    const crowded: StorybookLlm = async () => answer({
      storyElements: [],
      cover: { scene: "c", onStage: ["alexander", "adrian", "knisterich"], artifactVisible: false },
      pages: Array.from({ length: 6 }, (_, index) => ({ page: index + 1, paragraph: 6, scene: "Knisterich between the boys.", onStage: ["alexander", "adrian", "knisterich"], focus: "scene" })),
    });
    // Elsa acts only in chapter 1 paragraph 5; every picture's moment is Knisterich's — she waits for a picture of hers or is reported.
    const withElsa = [{ ...lonely[0], content: lonely[0].content.replace("Alexander ging weiter.", "Magd Elsa lachte laut.") }, lonely[1], lonely[2]];
    const direction = await directEpisodePictures({ llm: crowded, model: "m", brief, title: "t", pages: withElsa, plan, entities });
    const drawn = direction.illustrations.pages.some((shot) => shot.onStage.includes("elsa"));
    expect(drawn || direction.unplaced.includes("Magd Elsa")).toBe(true);
  });

  test("the director's brief names the paragraph rule, the title figure and a cover that never shows the ending", () => {
    const note = directorNote(3, 2, "Knisterich");
    expect(note).toContain("3 chapters");
    expect(note).toContain('"paragraph"');
    expect(note).toContain("The title figure Knisterich is in at least every second picture");
    expect(note).toContain("never a moment from the last chapter");
  });

  test("the director sees the segments' own figures, not the planner's laughs", () => {
    const slots = [{ slot: 1, chapter: 1, part: 0, afterParagraph: 3, first: 0, count: 12, text: "Magd Elsa summte.\n\nAdrian lachte.", picture: "" }];
    const segmented = segmentPlan(plan, slots, entities);
    expect(segmented.pages).toHaveLength(1);
    expect(segmented.pages[0].onPage).toEqual(["adrian", "elsa"]);
    expect(segmented.pages[0].picture).toBe("");
  });

  test("the delivered pictures keep their paragraph; a failed cover is replaced by an early clean picture, never the ending", async () => {
    const direction = await directEpisodePictures({ llm: director, model: "m", brief, title: "t", pages, plan, entities });
    const outcome = (page: number, status: ImageOutcome["status"]): ImageOutcome => ({ page, url: `https://img/${page}.jpg`, prompt: `p${page}`, attempts: 1, costUSD: 0, severity: 0, status });
    const outcomes = new Map<number, ImageOutcome>([
      [1, outcome(1, "flawed")], [2, outcome(2, "passed")], [3, outcome(3, "failed")], [4, outcome(4, "passed")], [5, outcome(5, "passed")], [6, outcome(6, "passed")],
    ]);
    const pictures = chapterPictures(direction, outcomes);
    // The failed picture is not delivered; the rest are in reading order with the director's paragraph.
    expect(pictures.map((picture) => picture.url)).toEqual(["https://img/1.jpg", "https://img/2.jpg", "https://img/4.jpg", "https://img/5.jpg", "https://img/6.jpg"]);
    expect(pictures[2].afterParagraph).toBe(direction.placed[3].afterParagraph);
    expect(coverStandIn(pictures)?.url).toBe("https://img/2.jpg");
  });

  test("cover stand-in: early flawed before the last picture; the last picture only when nothing else exists", () => {
    const picture = (chapter: number, status: ChapterPicture["status"]): ChapterPicture => ({ chapter, afterParagraph: 3, url: `u${chapter}`, status });
    expect(coverStandIn([picture(1, "flawed"), picture(2, "flawed"), picture(3, "passed")])?.url).toBe("u1");
    expect(coverStandIn([picture(3, "passed")])?.url).toBe("u3");
    expect(coverStandIn([])).toBeUndefined();
  });
});
