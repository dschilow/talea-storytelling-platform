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
const none = { hybrid: 0.02, twins: 0.03, fused: 0.1, mirror: 0.02, text: 0.03, blend: 0.05, garment: 0.05 };
const creature: VisualEntity = { id: "c", name: "Fresser", role: "cast", kind: "character", species: "grey long-eared creature", isHuman: false, appearance: "small grey creature with big ears and a sack", forbidden: [], referenceUrl: "https://example.test/fresser.png" };
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
    expect(parseJevScores({ hybrid: 0.9 })).toEqual({ hybrid: 0.9, twins: 0, fused: 0, mirror: 0, text: 0, blend: 0, garment: 0 });
    expect(parseJevScores({ hybrid: 7, twins: NaN })).toMatchObject({ hybrid: 1, twins: 0 });
  });
  test("a cast that is meant to be half animal or look alike is not asked", () => {
    expect(Object.keys(jevQuestionsFor(people)).sort()).toEqual(["fused", "garment", "hybrid", "mirror", "text", "twins"]);
    const mermaid: VisualEntity = { ...people[0], id: "m", name: "Marina", species: "mermaid", isHuman: false };
    expect(Object.keys(jevQuestionsFor([...people, mermaid]))).not.toContain("hybrid");
    const twins: VisualEntity = { ...people[1], id: "t", appearance: "one of the identical twins in green" };
    expect(Object.keys(jevQuestionsFor([people[0], twins]))).not.toContain("twins");
  });
});

describe("Jev: a mixed figure and a borrowed garment (book \"Die hüpfenden Geräusche\", 2026-10-16)", () => {
  test("blend is asked only when a child and a creature share the picture, garment when two figures do", () => {
    expect(Object.keys(jevQuestionsFor(people))).not.toContain("blend");
    expect(Object.keys(jevQuestionsFor([people[0], creature]))).toEqual(expect.arrayContaining(["blend", "garment"]));
    expect(Object.keys(jevQuestionsFor([people[0]]))).not.toContain("garment");
    expect(Object.keys(jevQuestionsFor([creature]))).not.toContain("blend");
    const mermaid: VisualEntity = { ...people[0], id: "m", name: "Marina", species: "mermaid", isHuman: false };
    expect(Object.keys(jevQuestionsFor([people[1], mermaid]))).not.toContain("blend");
    const twins: VisualEntity = { ...people[1], id: "t", appearance: "one of the identical twins in green" };
    expect(Object.keys(jevQuestionsFor([people[0], twins, creature]))).not.toContain("garment");
  });
  test("both are soft findings with their own cut-offs (blend 0.85, garment 0.9)", () => {
    const found = interpretJev({ ...none, blend: 0.97, garment: 0.95 });
    expect(found.soft).toHaveLength(2);
    expect(found.hybrid).toHaveLength(0);
    expect(found.soft.join(" ")).toContain("mixes features");
    expect(found.soft.join(" ")).toContain("same garment");
    expect(interpretJev({ ...none, blend: 0.84, garment: 0.89 }).soft).toHaveLength(0);
  });
  test("in a mirror two people wear the same vest, a mixed figure stays mixed", () => {
    const found = interpretJev({ ...none, blend: 0.9, garment: 0.95, mirror: 0.9 });
    expect(found.soft).toHaveLength(1);
    expect(found.soft[0]).toContain("mixes features");
  });
  test("the scores measured on the two pictures of the book: the old questions were silent, the new ones are not", () => {
    // Picture 13: Adrian's hair and shirt on the sack creature. Picture 6: the librarian's vest on Alexander.
    expect(interpretJev({ ...none, hybrid: 0.08, twins: 0.07, fused: 0.16, blend: 0.97, garment: 0.14 }).soft).toHaveLength(1);
    expect(interpretJev({ ...none, hybrid: 0.02, twins: 0.1, fused: 0.51, blend: 0.05, garment: 0.97 }).soft).toHaveLength(1);
    expect(interpretJev({ ...none, hybrid: 0.08, twins: 0.07, fused: 0.16 }).soft).toHaveLength(0);
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

  test("a mixed figure is redrawn from separate portraits with a named correction, and is still printed", async () => {
    const calls: Array<{ prompt: string; referenceImages: string[] }> = [];
    let asked = 0;
    const result = await generateStorybookImages({
      illustrations: { cover: { page: 0, scene: "Alexander kneels beside the creature.", onStage: ["a", "c"], artifactVisible: false }, pages: [] },
      entities: [people[0], creature], seed: "s", buildReference: sheet, visionModel: "test",
      jev: async () => read({ blend: ++asked <= 2 ? 0.96 : 0.1 }),
      llm: async (request) => reply(request, { ...cleanQa, characterCounts: { Alexander: 1, Fresser: 1 } }),
      provider: async (request) => { calls.push(request as any); return { url: `https://example.test/${calls.length}.jpg`, costUSD: .001 }; },
    });
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls[1].prompt).toContain("creatures never wear a child's hair or clothes");
    expect(result.cover?.history?.[0].notes.join(" ")).toContain("mixes features");
    expect(publishableImageUrl(result.cover)).toBeDefined();
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
