// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { buildBrief } from "./context";
import { resolveLengthBudget, type AgeBand } from "./craft";
import { buildWriterSystemPrompt } from "./draft-stage";
import { runStorybookTextEngine } from "./engine";
import { describeReferenceLooks, negativePromptFor, runDirectorStage, sanitizeIllustrationPlan, type VisualEntity } from "./illustration-stage";
import { generateStorybookImages, parseQaReport, publishableImageUrl, qaSeverity, type ImageOutcome } from "./images";
import { CostLedger, resolveStorybookModels, type LlmRequest, type StorybookLlm } from "./llm";
import { buildOneShotUserPrompt, buildPatchPrompt, mergeStorybookPatch, planFromOneShot } from "./oneshot-stage";
import { storybookQuality } from "./quality";
import { verifyStorybookRepair } from "./review-stage";

function brief(band: AgeBand = "6-8", length: "short" | "medium" | "long" = "medium") {
  return buildBrief({ config: { ageGroup: band, length, language: "de", genre: "fairy_tales", setting: "fantasy", humorLevel: 0, suspenseLevel: 0 } as any,
    band, budget: resolveLengthBudget(length, band), heroes: [{ id: "a", name: "Alexander" }, { id: "b", name: "Adrian" }], candidates: [], artifacts: [], recentStories: [], recentEngineIds: [], heroMemories: {}, seed: "quality-regression" });
}
const people: VisualEntity[] = ["Alexander", "Adrian"].map((name, i) => ({ id: i ? "b" : "a", name, role: "hero", kind: "character", species: "human", isHuman: true, appearance: `young child ${i ? "blond blue shirt" : "brown hair cream sweater"}`, forbidden: [], referenceUrl: `https://example.test/${name}.png` }));
const reply = (request: LlmRequest, data: unknown) => ({ text: typeof data === "string" ? data : JSON.stringify(data), modelUsed: request.model, usage: { prompt: 50, completion: 20, total: 70, costUSD: .0001 }, durationMs: 1 });
const cleanQa = { characterCounts: { Alexander: 1, Adrian: 1 }, anatomyDefects: [], duplicates: [], unexpectedCharacters: [], identityMatch: .95, sceneMatch: .95 };
const images = { cover: { page: 0, scene: "Alexander and Adrian beside the stream.", onStage: ["a", "b"], artifactVisible: false }, pages: [] };
const reference = async () => ({ urls: ["https://example.test/sheet.jpg"], mode: "sprite" as const, subjects: [] });

describe("wizard budgets and compact writing", () => {
  for (const band of ["3-5", "6-8", "9-12"] as const) for (const length of ["short", "medium", "long"] as const) {
    test(`${band}/${length}: preserves the wizard's age and length`, () => {
      const b = brief(band, length);
      const perPage = { "3-5": [45, 80], "6-8": [90, 135], "9-12": [140, 195] }[band];
      expect(b.budget.pages).toBe({ short: 5, medium: 7, long: 9 }[length]);
      expect(b.budget.totalWordsMin).toBe(b.budget.pages * perPage[0]);
      expect(b.budget.totalWordsMax).toBe(b.budget.pages * perPage[1]);
      const prompt = buildOneShotUserPrompt(b);
      expect(prompt).toContain(`${b.budget.pages}`);
      expect(prompt).toContain(`${band} Jahre`);
      expect(prompt).toContain("sanft, geborgen");
      expect(prompt).toContain("wenig, eher still");
      expect(buildPatchPrompt("T", [], [], b)).toContain(`${b.budget.totalWordsMin}–${b.budget.totalWordsMax}`);
    });
  }
  test("compact writer keeps orientation and the family mood without the old prompt duplication", () => {
    const prompt = buildWriterSystemPrompt(brief(), { oneShot: true });
    expect(prompt.length).toBeLessThan(4000);
    expect(prompt).toContain("Seite 1");
    expect(prompt).toContain("erst nach"); // chronological orientation is explicit in the review; see below
  });
});

describe("image acceptance regressions from the mill story", () => {
  test("empty, partial and malformed counts are unverified, never clean", () => {
    expect(parseQaReport("{}", ["Alexander"])).toBeNull();
    expect(parseQaReport(JSON.stringify({ ...cleanQa, characterCounts: { Alexander: 1 } }), ["Alexander", "Adrian"])).toBeNull();
    expect(parseQaReport(JSON.stringify({ ...cleanQa, characterCounts: { Alexander: -1 } }), ["Alexander"])).toBeNull();
    expect(qaSeverity(undefined, 2)).toBeGreaterThanOrEqual(10);
  });
  for (const defect of [
    { anatomyDefects: ["Alexander has four arms"] },
    { anatomyDefects: ["Goat has a human arm in a sweater"] },
    { identityMatch: .2 },
    { sceneMatch: .2 },
    { duplicates: ["Two goats"] },
    { unexpectedCharacters: ["Unknown adult"] },
    { roleSwaps: ["Adrian blows instead of Alexander"] },
  ]) test(`blocks visible defect ${JSON.stringify(defect)}`, () => {
    const qa = parseQaReport(JSON.stringify({ ...cleanQa, ...defect }), people.map((p) => p.name))!;
    expect(qaSeverity(qa, 2)).toBeGreaterThanOrEqual(10);
  });
  test("a failed redraw is retained for diagnosis but cannot be published", async () => {
    let calls = 0;
    const result = await generateStorybookImages({ illustrations: images, entities: people, seed: "s", buildReference: reference,
      visionModel: "test", llm: async (r) => reply(r, { ...cleanQa, anatomyDefects: ["four arms"] }),
      provider: async () => ({ url: `https://example.test/${++calls}.jpg`, costUSD: .001 }),
    });
    expect(calls).toBe(2);
    expect(result.imageCostUSD).toBe(.002);
    expect(result.cover?.status).toBe("failed");
    expect(result.cover?.url).toBeDefined();
    expect(publishableImageUrl(result.cover)).toBeUndefined();
  });
  test("QA failure never buys a new image or marks it accepted", async () => {
    let calls = 0;
    const result = await generateStorybookImages({ illustrations: images, entities: people, seed: "s", buildReference: reference,
      visionModel: "test", llm: async () => { throw new Error("vision unavailable"); },
      provider: async () => { calls++; return { url: "https://example.test/cover.jpg" }; },
    });
    expect(calls).toBe(1);
    expect(result.cover?.status).toBe("unverified");
    expect(publishableImageUrl(result.cover)).toBeUndefined();
  });
  test("unresolved composition does not spend on an image", async () => {
    let calls = 0;
    const result = await generateStorybookImages({ illustrations: { ...images, cover: { ...images.cover, planningErrors: ["cast mismatch"] } }, entities: people, seed: "s",
      provider: async () => { calls++; return {}; },
    });
    expect(calls).toBe(0);
    expect(result.cover?.status).toBe("unverified");
  });
  test("a modern wizard setting may contain modern objects", () => {
    expect(negativePromptFor(people, true)).not.toContain("washing machine");
    expect(negativePromptFor(people, true, true)).toContain("washing machine");
  });
});

describe("direction and stable identities", () => {
  const b = brief();
  const page = { order: 1, title: "", content: "Alexander und Adrian standen am Bach." };
  const plan = planFromOneShot("", b, { title: "Am Bach", description: "", pages: [page] });
  test("short ids, full names and omitted visible names resolve to canonical ids", () => {
    const result = sanitizeIllustrationPlan({ cover: images.cover, pages: [{ page: 1, scene: "Alexander holds a sack beside Adrian.", onStage: ["e1"] }] }, 1, plan, people, 3);
    expect(result.pages[0].onStage).toEqual(["a", "b"]);
    expect(result.pages[0].planningErrors).toBeUndefined();
  });
  test("empty manifests require an explicit close-up", () => {
    const normal = sanitizeIllustrationPlan({ pages: [{ page: 1, scene: "Two boys at a stream", onStage: [] }] }, 1, plan, people, 3);
    expect(normal.pages[0].planningErrors?.length).toBeGreaterThan(0);
    const detail = sanitizeIllustrationPlan({ pages: [{ page: 1, scene: "Close-up of ripples", onStage: [], focus: "detail" }] }, 1, plan, people, 3);
    expect(detail.pages[0].planningErrors).toBeUndefined();
  });
  test("repairs invalid manifests once before generating", async () => {
    const stages: string[] = [];
    const result = await runDirectorStage(async (r) => {
      stages.push(r.stage);
      return reply(r, { cover: images.cover, pages: [{ page: 1, scene: "Two boys at the stream.", onStage: r.stage === "illustration-direction" ? [] : ["e1", "e2"] }] });
    }, { brief: b, title: "Bach", pages: [page], plan, entities: people }, "test");
    expect(stages).toEqual(["illustration-direction", "illustration-plan-repair"]);
    expect(result.illustrations.pages[0].onStage).toEqual(["a", "b"]);
    expect(result.illustrations.pages[0].planningErrors).toBeUndefined();
    expect(result.repairCall).toBeDefined();
  });
  test("reference descriptions reuse stable assets across signed URLs, but invalidate changed assets", async () => {
    let calls = 0;
    const llm: StorybookLlm = async (r) => { calls++; return reply(r, { looks: { e1: "young boy with brown hair wearing a cream sweater" } }); };
    const entity = { ...people[0], id: "cache-regression", referenceKey: "bucket://avatar/version-1" };
    await describeReferenceLooks(llm, [entity], "test-cache");
    const cached = await describeReferenceLooks(llm, [{ ...entity, referenceUrl: "https://example.test/new-signature" }], "test-cache");
    expect(calls).toBe(1);
    expect(cached.call).toBeUndefined();
    expect(cached.entities[0].appearance).toContain("cream sweater");
    await describeReferenceLooks(llm, [{ ...entity, referenceKey: "bucket://avatar/version-2" }], "test-cache");
    expect(calls).toBe(2);
  });
});

describe("text repair and book readiness", () => {
  test("ambiguous patch numbering cannot overwrite unrelated pages", () => {
    const pages = [{ order: 1, title: "", content: "Alexander saß am Bach." }, { order: 2, title: "", content: "Adrian kam dazu." }];
    expect(mergeStorybookPatch("SEITE 1\nAlexander saß am Bach.\nSEITE 1\nAdrian kam dazu.", pages, brief())).toBe(pages);
    expect(mergeStorybookPatch("SEITE 99\nAlexander saß am Bach.", pages, brief())).toBe(pages);
  });
  test("a verification must account for every reported issue", async () => {
    const b = brief();
    const incomplete = await verifyStorybookRepair(async (r) => reply(r, { checks: [], newProblems: [] }), b, "T", [], ["Introduction missing"], "test");
    expect(incomplete.unresolved).toBeNull();
    const unresolved = await verifyStorybookRepair(async (r) => reply(r, { checks: [{ id: 0, resolved: false }], newProblems: [] }), b, "T", [], ["Introduction missing"], "test");
    expect(unresolved.unresolved).toEqual(["Introduction missing"]);
  });
  test("invalid manuscript retries once and stops before illustration spending", async () => {
    const stages: string[] = [];
    await expect(runStorybookTextEngine({ brief: brief(), models: resolveStorybookModels({}), ledger: new CostLedger(),
      llm: async (r) => { stages.push(r.stage); return reply(r, "TITEL: T\nSEITE 1\nZu kurz."); },
    })).rejects.toThrow("gewählte Länge");
    expect(stages).toEqual(["oneshot", "oneshot-repair"]);
  });
  test("ready requires verified text and every image including the cover", () => {
    const text = { finalChecks: { ok: true, hard: [], soft: [] }, review: null, textQuality: { status: "passed" as const, issues: [] } };
    const ok: ImageOutcome = { page: 0, url: "https://example.test/image", prompt: "", status: "passed", severity: 0, attempts: 1, costUSD: 0 };
    const imgs = { cover: ok, pages: new Map([[1, { ...ok, page: 1 }]]), imageCalls: 2, imagesGenerated: 2, imageCostUSD: 0, qaCalls: [], regenerated: [] };
    expect(storybookQuality(text, imgs, [1]).releaseReady).toBe(true);
    expect(storybookQuality(text, { ...imgs, cover: { ...ok, status: "unverified" } }, [1]).releaseReady).toBe(false);
    expect(storybookQuality(text, imgs, [1, 2]).releaseReady).toBe(false);
    expect(storybookQuality({ ...text, textQuality: { status: "failed", issues: ["bad introduction"] } }, imgs, [1]).releaseReady).toBe(false);
  });
  test("cost ledger retains cache and reasoning metrics", () => {
    const ledger = new CostLedger();
    ledger.recordCall("writer", { text: "", modelUsed: "test", durationMs: 1, usage: { prompt: 1000, completion: 300, total: 1300, costUSD: .001, cachedPromptTokens: 800, cacheWriteTokens: 100, reasoningTokens: 50 } }, "writer");
    expect(ledger.all()[0].usage?.cachedPromptTokens).toBe(800);
    expect(ledger.all()[0].usage?.reasoningTokens).toBe(50);
  });
});
