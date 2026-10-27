// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { storyMetadataForList } from "./metadata-visibility";

const heavy = {
  devModeStages: Array.from({ length: 32 }, (_, index) => ({ stage: `step-${index}`, usage: { prompt: 3000, completion: 400, total: 3400 }, modelUsed: "openai/gpt-6-luna", durationMs: 8000 })),
  storybook: { plan: { pages: Array.from({ length: 6 }, () => ({ action: "x".repeat(400) })) }, imageQa: Array.from({ length: 7 }, () => ({ qa: { jev: { blend: 0.3 }, notes: "y".repeat(500) } })) },
  episode: { plan: { bible: "z".repeat(3000) } },
  adminGenerationMetrics: { totals: { costUSD: 0.06 } },
  bookAdmin: { plan: "future chapters" },
  storyText: "t".repeat(5000),
  characterPoolUsed: [{ characterId: "c1", characterName: "Kork" }],
  hardIssueList: ["a long note".repeat(40)],
};

describe("story list metadata", () => {
  test("keeps what the library reads", () => {
    const slim = storyMetadataForList({
      ...heavy,
      pipeline: "talea-folge-v1",
      releaseReady: false,
      imagesSkippedDueToQualityGate: true,
      book: { format: "chapter-book", chaptersPlanned: 8, chaptersReady: 3, state: "writing" },
    });
    expect(slim?.book).toEqual({ format: "chapter-book", chaptersPlanned: 8, chaptersReady: 3, state: "writing" });
    expect(slim?.releaseReady).toBe(false);
    expect(slim?.imagesSkippedDueToQualityGate).toBe(true);
    expect(slim?.pipeline).toBe("talea-folge-v1");
  });

  test("drops the diagnostics, the plan, the text copy and the admin-only keys", () => {
    const slim = storyMetadataForList({ ...heavy, releaseReady: true });
    for (const key of Object.keys(heavy)) expect(slim).not.toHaveProperty(key);
    expect(JSON.stringify(slim).length).toBeLessThan(100);
  });

  test("nothing to keep is nothing, not an empty object", () => {
    expect(storyMetadataForList(null)).toBeUndefined();
    expect(storyMetadataForList({ ...heavy })).toBeUndefined();
  });
});
