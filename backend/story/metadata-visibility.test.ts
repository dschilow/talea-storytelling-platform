// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { storyMetadataForList, storyMetadataForViewer } from "./metadata-visibility";

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
  test("a saved series manuscript stays private after a later illustration failure", () => {
    const metadata = { pipeline: "character-series-v1", error: { message: "Bildplanung fehlgeschlagen" },
      adminGenerationMetrics: { seriesDraft: { stage: "text-ready", result: { title: "Glocke", pages: [{ content: "Bezahlter, geprüfter Text." }] } } } };
    expect(storyMetadataForViewer(metadata, false)).not.toHaveProperty("adminGenerationMetrics");
    expect(storyMetadataForViewer(metadata, true)?.adminGenerationMetrics.seriesDraft.result.pages[0].content).toBe("Bezahlter, geprüfter Text.");
    expect(storyMetadataForList(metadata)).toEqual({ pipeline: "character-series-v1" });
    expect(metadata.adminGenerationMetrics.seriesDraft.stage).toBe("text-ready");
  });
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

  test("a Figurenserie episode keeps only its series and episode number, never the episode log", () => {
    const log = { episode: 4, storyId: "s4", avatarIds: ["a1"], events: [{ fact: "x".repeat(300), quote: "y".repeat(300) }], relationships: [], openThreads: [], context: ["z".repeat(2000)] };
    const slim = storyMetadataForList({ ...heavy, characterSeries: { id: "kapitaen-blubbert", log } });
    expect(slim).toEqual({ characterSeries: { id: "kapitaen-blubbert", episode: 4 } });
    expect(storyMetadataForList({ characterSeries: { id: "kapitaen-blubbert", log: { ...log, episode: 0 } } })).toBeUndefined();
    expect(storyMetadataForList({ characterSeries: { id: "", log } })).toBeUndefined();
    expect(storyMetadataForList({ characterSeries: { id: "kapitaen-blubbert" } })).toBeUndefined();
  });
});
