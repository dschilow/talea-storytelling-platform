// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { generateStorybookImages, publishableImageUrl } from "./images";
import type { VisualEntity } from "./illustration-stage";
import { interpretJev, jevQuestionsFor, parseJevScores, type JevPort, type JevReply } from "./jev";
import type { LlmRequest } from "./llm";

const people: VisualEntity[] = ["Alexander", "Adrian"].map((name, i) => ({ id: i ? "b" : "a", name, role: "hero", kind: "character", species: "human", isHuman: true, appearance: `young child ${i ? "blond blue shirt" : "brown hair cream sweater"}`, forbidden: [], referenceUrl: `https://example.test/${name}.png` }));
const reply = (request: LlmRequest, data: unknown) => ({ text: JSON.stringify(data), modelUsed: request.model, usage: { prompt: 50, completion: 20, total: 70, costUSD: .0001 }, durationMs: 1 });
const cleanQa = { characterCounts: { Alexander: 1, Adrian: 1 }, anatomyDefects: [], duplicates: [], unexpectedCharacters: [], identityMatch: .95, sceneMatch: .95 };
const cover = { cover: { page: 0, scene: "Alexander and Adrian beside the stream.", onStage: ["a", "b"], artifactVisible: false }, pages: [] };
const withPage = { ...cover, pages: [{ page: 1, scene: "Adrian braces the cart while Alexander catches the basket.", onStage: ["b", "a"], artifactVisible: false, vignette: "the long wooden cart at the fork of two country paths" }] };
const sheet = async () => ({ urls: ["https://example.test/sheet.jpg"], mode: "sprite" as const, subjects: [] });
const none = { hybrid: 0.02, twins: 0.03, fused: 0.1, mirror: 0.02, text: 0.03 };
const read = (answers: Partial<typeof none>): JevReply => ({ answers: { ...none, ...answers }, costUSD: 0.00008, inputTokens: 2000, durationMs: 600 });

describe("Jev: what counts as a finding", () => {
  test("a human with animal parts counts at 0.7, below it is silent", () => {
    expect(interpretJev({ ...none, hybrid: 0.8 }).hybrid).toHaveLength(1);
    expect(interpretJev({ ...none, hybrid: 0.69 }).hybrid).toHaveLength(0);
  });
  test("twins and fused bodies are soft findings with their own cut-offs", () => {
    const found = interpretJev({ ...none, twins: 0.7, fused: 0.8 });
    expect(found.soft).toHaveLength(2);
    expect(found.hybrid).toHaveLength(0);
    expect(interpretJev({ ...none, twins: 0.6, fused: 0.7 }).soft).toHaveLength(0);
  });
  test("in a mirror, a pond or a window the same figure is there twice and legs end in water", () => {
    expect(interpretJev({ ...none, twins: 0.9, fused: 0.9, mirror: 0.9 }).soft).toHaveLength(0);
    // …but a tail is a tail, also in a mirror.
    expect(interpretJev({ ...none, hybrid: 0.9, mirror: 0.9 }).hybrid).toHaveLength(1);
  });
  test("writing is read from 0.75", () => {
    expect(interpretJev({ ...none, text: 0.84 }).text).toBe(true);
    expect(interpretJev({ ...none, text: 0.6 }).text).toBe(false);
  });
  test("scores come back only for questions that were asked", () => {
    expect(parseJevScores(undefined)).toBeNull();
    expect(parseJevScores({ unrelated: 1 })).toBeNull();
    expect(parseJevScores({ hybrid: 0.9 })).toEqual({ hybrid: 0.9, twins: 0, fused: 0, mirror: 0, text: 0 });
    expect(parseJevScores({ hybrid: 7, twins: NaN })).toMatchObject({ hybrid: 1, twins: 0 });
  });
  test("a cast that is meant to be half animal or look alike is not asked", () => {
    expect(Object.keys(jevQuestionsFor(people)).sort()).toEqual(["fused", "hybrid", "mirror", "text", "twins"]);
    const mermaid: VisualEntity = { ...people[0], id: "m", name: "Marina", species: "mermaid", isHuman: false };
    expect(Object.keys(jevQuestionsFor([...people, mermaid]))).not.toContain("hybrid");
    const twins: VisualEntity = { ...people[1], id: "t", appearance: "one of the identical twins in green" };
    expect(Object.keys(jevQuestionsFor([people[0], twins]))).not.toContain("twins");
  });
});

describe("Jev in the picture loop", () => {
  const run = async (jev: JevPort | undefined, illustrations: any = cover, calls: Array<{ prompt: string }> = []) => {
    const result = await generateStorybookImages({
      illustrations, entities: people, seed: "s", buildReference: sheet, visionModel: "test", jev,
      llm: async (request) => reply(request, cleanQa),
      provider: async (request) => { calls.push(request); return { url: `https://example.test/${calls.length}.jpg`, costUSD: .001 }; },
    });
    return { result, calls };
  };

  test("a child with a tail that the checker let through is redrawn with a positive correction", async () => {
    let asked = 0;
    const { result, calls } = await run(async () => read(++asked === 1 ? { hybrid: 0.9 } : {}));
    expect(calls).toHaveLength(2);
    expect(calls[1].prompt).toContain("ordinary human kids");
    expect(result.cover?.status).toBe("passed");
    expect(result.cover?.attempts).toBe(2);
    expect(result.cover?.history?.[0].notes.join(" ")).toContain("animal body parts");
    expect(result.jevCalls).toHaveLength(2);
    expect(result.jevCalls![0].modelUsed).toContain("jev");
    expect(result.jevCalls![0].usage.costUSD).toBe(0.00008);
  });

  test("the same figure twice is a soft finding: one redraw, and the page is still printed", async () => {
    const { result, calls } = await run(async () => read({ twins: 0.8 }));
    expect(calls).toHaveLength(2);
    expect(calls[1].prompt).toContain("each exactly once");
    expect(result.cover?.status).toBe("flawed");
    expect(publishableImageUrl(result.cover)).toBeDefined();
  });

  test("a hybrid on every attempt is never printed; the page falls back to the people-free picture", async () => {
    const { result } = await run(async () => read({ hybrid: 0.9 }), withPage);
    const page = result.pages.get(1)!;
    expect(page.vignette).toBe(true);
    expect(result.cover?.status).toBe("failed");
    expect(publishableImageUrl(result.cover)).toBeUndefined();
  });

  test("a failing second reader changes nothing and costs no extra picture", async () => {
    const { result, calls } = await run(async () => { throw new Error("alpha API down"); });
    expect(calls).toHaveLength(1);
    expect(result.cover?.status).toBe("passed");
    expect(result.jevCalls).toHaveLength(0);
  });

  test("without the port the loop is the old one", async () => {
    const { result, calls } = await run(undefined);
    expect(calls).toHaveLength(1);
    expect(result.cover?.status).toBe("passed");
    expect(result.cover?.qa?.jev).toBeUndefined();
  });

  test("it never starts a picture the checker could not read", async () => {
    let calls = 0;
    const result = await generateStorybookImages({
      illustrations: cover, entities: people, seed: "s", buildReference: sheet, visionModel: "test",
      jev: async () => read({ hybrid: 0.95 }),
      llm: async () => { throw new Error("vision unavailable"); },
      provider: async () => { calls++; return { url: "https://example.test/cover.jpg" }; },
    });
    expect(calls).toBe(1);
    expect(result.cover?.status).toBe("unverified");
  });
});
