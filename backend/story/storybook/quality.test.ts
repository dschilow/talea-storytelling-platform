// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { buildBrief } from "./context";
import { resolveLengthBudget, type AgeBand } from "./craft";
import { buildWriterSystemPrompt } from "./draft-stage";
import { runStorybookTextEngine } from "./engine";
import { assembleImagePrompt, bindNamesToLooks, describeReferenceLooks, mentionsElement, nameElementsPlainly, negativePromptFor, recomposeShot, runDirectorStage, sanitizeIllustrationPlan, type VisualEntity } from "./illustration-stage";
import { generateStorybookImages, parseQaReport, publishableImageUrl, qaSeverity, qaSeverityParts, qaStatus, scopeQaReport, type ImageOutcome } from "./images";
import { CostLedger, resolveStorybookModels, type LlmRequest, type StorybookLlm } from "./llm";
import { buildOneShotUserPrompt, buildPatchPrompt, mergeStorybookPatch, planFromOneShot } from "./oneshot-stage";
import { storybookQuality } from "./quality";
import { ledgerNotes, runReviewStage, sanitizeReview, verifyStorybookRepair } from "./review-stage";

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
    expect(prompt).toContain("Erst am Seitenende kommt die Störung");
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

describe("story 774d5a5e: no blank pages, bound roles, plain nouns", () => {
  const tagged: VisualEntity[] = people.map((entity) => ({ ...entity, tag: entity.name === "Adrian" ? "blond boy in dark T-shirt" : "brown-haired boy in cream sweater" }));
  const vignetteText = "the long wooden cart at the fork of two country paths, a wicker basket tipping over its edge";
  const withPage = { ...images, pages: [{ page: 1, scene: "Adrian braces the cart while Alexander catches the basket.", onStage: ["b", "a"], artifactVisible: false, vignette: vignetteText }] };
  const vignetteQa = { characterCounts: {}, namedCharactersVisible: 0, anatomyDefects: [], duplicates: [], unexpectedCharacters: [], identityMatch: 1, sceneMatch: .9 };

  test("a role swap alone is printed as flawed instead of leaving the page blank", async () => {
    let calls = 0;
    const result = await generateStorybookImages({ illustrations: withPage, entities: tagged, seed: "s", buildReference: reference, visionModel: "test",
      llm: async (r) => reply(r, r.stage.includes("cover") ? cleanQa : { ...cleanQa, roleSwaps: ["Alexander braces the cart instead of Adrian"] }),
      provider: async () => ({ url: `https://example.test/${++calls}.jpg` }),
    });
    const page = result.pages.get(1)!;
    expect(calls).toBe(3);
    expect(page.status).toBe("flawed");
    expect(page.vignette).toBeUndefined();
    expect(publishableImageUrl(page)).toBeDefined();
    expect(storybookQuality({ finalChecks: { ok: true, hard: [], soft: [] }, review: null, textQuality: { status: "passed", issues: [] } }, result, [1]).imagesReady).toBe(true);
  });

  test("a hard defect on both attempts becomes a people-free vignette; the cover never does", async () => {
    const requests: Array<{ page: number; prompt: string; referenceImages: string[] }> = [];
    const result = await generateStorybookImages({ illustrations: withPage, entities: tagged, seed: "s", buildReference: reference, visionModel: "test",
      llm: async (r) => reply(r, r.stage.includes("vignette") ? vignetteQa : { ...cleanQa, duplicates: ["Adrian appears twice"] }),
      provider: async (request) => { requests.push(request); return { url: `https://example.test/${requests.length}.jpg` }; },
    });
    const page = result.pages.get(1)!;
    expect(page.vignette).toBe(true);
    expect(page.status).toBe("passed");
    expect(page.attempts).toBe(3);
    expect(publishableImageUrl(page)).toBeDefined();
    const last = requests.filter((request) => request.page === 1).pop()!;
    expect(last.referenceImages).toEqual([]);
    expect(last.prompt).not.toMatch(/Alexander|Adrian/);
    expect(result.cover?.status).toBe("failed");
    expect(result.cover?.vignette).toBeUndefined();
    expect(requests.filter((request) => request.page === 0)).toHaveLength(2);
  });

  test("an incomplete QA report is read once more instead of discarding the picture", async () => {
    const stages: string[] = [];
    let calls = 0;
    const result = await generateStorybookImages({ illustrations: images, entities: people, seed: "s", buildReference: reference, visionModel: "test",
      llm: async (r) => { stages.push(r.stage); return reply(r, stages.length === 1 ? "{}" : cleanQa); },
      provider: async () => ({ url: `https://example.test/${++calls}.jpg` }),
    });
    expect(stages).toEqual(["image-qa-cover-1", "image-qa-cover-1-retry"]);
    expect(calls).toBe(1);
    expect(result.cover?.status).toBe("passed");
  });

  test("the identity sheet runs left to right like the picture", async () => {
    const sheets: string[][] = [];
    await generateStorybookImages({ illustrations: { cover: { ...images.cover, onStage: ["b", "a"] }, pages: [] }, entities: people, seed: "s",
      buildReference: async (subjects) => { sheets.push(subjects.map((subject) => subject.displayName)); return reference(); },
      provider: async () => ({ url: "https://example.test/cover.jpg" }),
    });
    expect(sheets[0]).toEqual(["Adrian", "Alexander"]);
  });

  test("QA findings about things that are not in the picture are dropped", () => {
    const qa = parseQaReport(JSON.stringify({ ...cleanQa, elementMisuse: ["The painted arrow is not visible."], roleSwaps: ["Somebody else holds the basket"] }), ["Alexander", "Adrian"])!;
    const scoped = scopeQaReport(qa, ["Alexander", "Adrian"], []);
    expect(scoped.elementMisuse).toEqual([]);
    expect(scoped.roleSwaps).toEqual([]);
    const sign = { name: "Hand-painted Wayfinder", noun: "wooden signpost", look: "a small weathered wooden signboard" };
    expect(scopeQaReport({ ...qa, elementMisuse: ["Wayfinder is depicted with a face"] }, [], [sign]).elementMisuse).toHaveLength(1);
  });

  test("hard and soft defects: a posed lineup is printed, a missing hero on the cover is not", () => {
    const qa = parseQaReport(JSON.stringify({ ...cleanQa, posing: true }), ["Alexander", "Adrian"])!;
    const posed = qaSeverityParts(qa, 2);
    expect(posed).toEqual({ hard: 0, soft: 10 });
    expect(qaStatus(qa, posed)).toBe("flawed");
    const missing = parseQaReport(JSON.stringify({ ...cleanQa, characterCounts: { Alexander: 1, Adrian: 0 } }), ["Alexander", "Adrian"])!;
    expect(qaSeverityParts(missing, 2, { heroNames: ["Alexander", "Adrian"], cover: true }).hard).toBe(10);
    expect(qaSeverityParts(missing, 2, { heroNames: ["Alexander", "Adrian"] }).hard).toBe(0);
  });

  test("names in the action carry the look; objects are drawn by their plain noun", () => {
    const sign = { name: "Hand-painted Wayfinder", noun: "wooden signpost", look: "a small weathered wooden signboard with a painted arrow" };
    const scene = "Adrian holds the Hand-painted Wayfinder. Alexander points at Adrian's hand. Adrian laughs. Adrian runs off.";
    const prompt = assembleImagePrompt({ scene, onStage: tagged, spriteOrder: tagged, elements: [sign] });
    expect(prompt).not.toContain("Wayfinder");
    expect(prompt).toContain("holds the wooden signpost");
    expect(prompt).toContain("The wooden signpost, drawn exactly like this");
    expect(prompt).toContain("Adrian (blond boy in dark T-shirt) holds");
    expect(prompt).toContain("Adrian's hand");
    expect(prompt.split("(blond boy in dark T-shirt)")).toHaveLength(3);
    expect(bindNamesToLooks("Alexander (already described) waves.", tagged)).toBe("Alexander (already described) waves.");
    expect(nameElementsPlainly("A hand-painted wayfinder on a post.", [sign])).toBe("A wooden signpost on a post.");
  });

  test("the director's vignette never names a character; the element noun is kept", () => {
    const b = brief();
    const plan = planFromOneShot("", b, { title: "Weg", description: "", pages: [{ order: 1, title: "", content: "Alexander und Adrian am Karren." }] });
    const raw = (vignette: string) => ({
      storyElements: [{ name: "Hand-painted Wayfinder", noun: "Wooden Signpost", look: "a small weathered wooden signboard" }],
      cover: images.cover,
      pages: [{ page: 1, scene: "Alexander and Adrian at the cart.", onStage: ["a", "b"], vignette }],
    });
    expect(sanitizeIllustrationPlan(raw("Alexander's signpost lying in the grass by the gate"), 1, plan, people, 3).pages[0].vignette).toBeUndefined();
    const ok = sanitizeIllustrationPlan(raw("the wooden signpost lying in the grass by the gate"), 1, plan, people, 3);
    expect(ok.pages[0].vignette).toContain("signpost");
    expect(ok.storyElements?.[0].noun).toBe("wooden signpost");
    expect(ok.cover.vignette).toBeUndefined();
  });
});

describe("story 774d5a5e: the reader writes its evidence down", () => {
  const ledgerReview = {
    scores: { overall: 8 },
    comprehension: { want: "a", problem: "b", solution: "c", ending: "d" },
    ledger: {
      goal: { want: "Die Gäste finden den Weg zur Lese-Wiese", fulfilled: "nicht erreicht" },
      solutionKey: { what: "Karte unter der Decke", firstShown: 5, usedOn: 6, foundByChance: true },
      props: [
        { thing: "Pfeil", track: "S1 aufgemalt / S4 mit Holzstift", contradiction: "S1 aufgemalt, S4 ein loses Holzteil mit Stift" },
        { thing: "Korb", track: "S5 auf dem Karren", contradiction: "kein Widerspruch" },
      ],
      setups: [{ setup: "Adrian hat einen lustigen Satz geübt", page: 2, payoff: null }, { setup: "Martha trocknet ein Glas", page: 1, payoff: "Seite 7: stellt das Glas ab" }],
      introduction: { relationship: null, traits: "Alexander malt sorgfältig, Adrian hüpft" },
    },
  };

  test("chance solution, unreached goal and a changing prop cap the score and become notes", () => {
    const review = sanitizeReview(ledgerReview, 7)!;
    expect(review.scores.overall).toBe(6);
    expect(review.ledger?.props[1].contradiction).toBeNull();
    const notes = ledgerNotes(review);
    expect(notes).toHaveLength(4);
    expect(notes.join(" ")).toContain("zufällig bereitliegt");
    expect(notes.join(" ")).toContain("vor Seite 6");
    expect(notes.join(" ")).toContain("Pfeil");
    expect(notes.join(" ")).toContain("lustigen Satz");
    // The brief does not know whether the heroes are brothers or friends: no edit may invent it.
    expect(notes.join(" ")).not.toMatch(/Geschwister|Freunde/);
  });

  test("a review without a ledger keeps its own score and adds no notes", () => {
    const review = sanitizeReview({ ...ledgerReview, ledger: undefined }, 7)!;
    expect(review.scores.overall).toBe(8);
    expect(ledgerNotes(review)).toEqual([]);
  });

  test("the compact read on the other family asks for the ledger", async () => {
    let request: LlmRequest | undefined;
    await runReviewStage(async (r) => { request = r; return reply(r, ledgerReview); }, brief(), "T", [{ order: 1, title: "", content: "Alexander malte." }], [], "google/gemini-3.8-flash", "review", true);
    expect(request?.system).toContain("Schreib ZUERST das ledger");
    expect(request?.user).toContain("\"solutionKey\"");
  });
});

describe("story c2ff7f42: the duck on every page and the missing cover", () => {
  const frog: VisualEntity = { id: "q", name: "Frosch Quak", role: "cast", kind: "character", species: "frog", isHuman: false, appearance: "green frog with a golden crown and a lily-pad cloak", forbidden: [], referenceUrl: "https://example.test/quak.png" };
  const cast = [...people, frog];
  const duck = { name: "The duck", noun: "brown duck", look: "a brown mallard duck with a wet green leaf on its head", figure: true };
  const cloth = { name: "The red cloth", noun: "red picnic cloth", look: "a red checked picnic cloth with an embroidered hem" };
  const b = brief();
  const plan = planFromOneShot("", b, { title: "Tuch", description: "", pages: [{ order: 1, title: "", content: "Alexander und Adrian am Teich." }] });
  const crowded = {
    storyElements: [duck, cloth],
    cover: { scene: "Alexander and Adrian laugh as the red picnic cloth glides over the pond with Frosch Quak. A brown duck waddles behind them.", onStage: ["a", "b", "q"], elements: ["The red cloth", "The duck"] },
    pages: [{ page: 1, scene: "Alexander reads on the red picnic cloth while Adrian sets out cups. Frosch Quak hops onto a lily pad. One corner of the cloth lifts like an ear.", onStage: ["a", "b", "q"], vignette: "The red picnic cloth on the grass beside the pond, one corner lifted like an ear." }],
  };

  test("an element named with an article is found by its noun, not by 'the'", () => {
    expect(mentionsElement("The red picnic cloth lies on the grass.", duck)).toBe(false);
    expect(mentionsElement("A brown duck waddles from the reeds.", duck)).toBe(true);
    expect(mentionsElement("Two ducks paddle by.", duck)).toBe(true);
    expect(mentionsElement("The red picnic cloth lies on the grass.", cloth)).toBe(true);
    expect(mentionsElement("Adrian holds the red cloth.", cloth)).toBe(true);
  });

  test("a page without the duck in its scene is not crowded by it", () => {
    const result = sanitizeIllustrationPlan(crowded, 1, plan, cast, 3);
    expect(result.pages[0].elements).toEqual(["The red cloth"]);
    expect(result.pages[0].planningErrors).toBeUndefined();
    expect(result.pages[0].vignette).toContain("red picnic cloth");
  });

  test("a vignette with a creature in it is no vignette", () => {
    const result = sanitizeIllustrationPlan({ ...crowded, pages: [{ ...crowded.pages[0], vignette: "The brown duck sits alone on the red picnic cloth by the pond." }] }, 1, plan, cast, 3);
    expect(result.pages[0].vignette).toBeUndefined();
  });

  test("a shot the repair could not simplify is trimmed and drawn, heroes first", async () => {
    const stages: string[] = [];
    const result = await runDirectorStage(async (r) => { stages.push(r.stage); return reply(r, crowded); },
      { brief: b, title: "Tuch", pages: [{ order: 1, title: "", content: "Alexander und Adrian am Teich." }], plan, entities: cast }, "test");
    expect(stages).toEqual(["illustration-direction", "illustration-plan-repair"]);
    const cover = result.illustrations.cover;
    expect(cover.planningErrors).toBeUndefined();
    expect(cover.onStage).toEqual(["a", "b", "q"]);
    expect(cover.elements).toEqual(["The red cloth"]);
    expect(cover.scene).not.toContain("duck");
    expect(cover.recomposed).toEqual(["The duck"]);
  });

  test("recomposition keeps the heroes and drops the last cast member when heroes alone fill the page", () => {
    const shot = { page: 2, scene: "Alexander pulls. Adrian pushes. Frosch Quak drums his toes.", onStage: ["q", "a", "b"], artifactVisible: false, elements: [], planningErrors: ["Composition exceeds 2 figures; recompose instead of dropping identities."] };
    const trimmed = recomposeShot(shot, cast, [], 2);
    expect(trimmed.onStage).toEqual(["a", "b"]);
    expect(trimmed.scene).toBe("Alexander pulls. Adrian pushes.");
    expect(recomposeShot({ ...shot, planningErrors: ["Empty character manifest; explicitly choose a detail shot or identify the visible figures."] }, cast, [], 2).planningErrors).toHaveLength(1);
  });

  test("a flawed vignette is never printed", async () => {
    const result = await generateStorybookImages({
      illustrations: { cover: images.cover, pages: [{ page: 1, scene: "Nothing to draw.", onStage: [], artifactVisible: false, vignette: "The red picnic cloth on the grass by the pond.", planningErrors: ["Empty character manifest; explicitly choose a detail shot or identify the visible figures."] }], storyElements: [cloth] },
      entities: people, seed: "s", buildReference: reference, visionModel: "test",
      llm: async (r) => reply(r, r.stage.includes("vignette") ? { characterCounts: { "The red cloth": 1 }, namedCharactersVisible: 1, anatomyDefects: [], duplicates: [], unexpectedCharacters: [], identityMatch: 1, sceneMatch: .3, posing: true } : cleanQa),
      provider: async () => ({ url: "https://example.test/x.jpg" }),
    });
    expect(result.pages.get(1)?.vignette).toBe(true);
    expect(publishableImageUrl(result.pages.get(1))).toBeUndefined();
  });

  test("titles like real books: the heroes' names are allowed, never required", () => {
    const prompt = buildOneShotUserPrompt(b);
    expect(prompt).toContain("müssen aber nicht");
    expect(prompt).not.toContain("die Helden gehören in den Titel");
    expect(prompt).toContain("höchstens zwei Seiten");
  });
});

describe("story c6df0e94: Runware refused every request", () => {
  test("a refusing provider is asked at most three times per book: no ladder, no vignette", async () => {
    let calls = 0;
    const pages = [1, 2, 3, 4, 5].map((page) => ({ page, scene: "Alexander and Adrian chase the cart.", onStage: ["a", "b"], artifactVisible: false, vignette: "The wooden cart on the empty village square." }));
    const result = await generateStorybookImages({ illustrations: { cover: images.cover, pages }, entities: people, seed: "s", buildReference: reference, visionModel: "test", concurrency: 1,
      llm: async (r) => reply(r, cleanQa),
      provider: async () => { calls++; return { refused: true, httpStatus: 429 }; },
    });
    expect(calls).toBe(3);
    expect(result.imagesGenerated).toBe(0);
    expect(result.pages.get(5)?.errors?.join(" ")).toContain("provider unavailable");
    expect([...result.pages.values()].some((outcome) => outcome.vignette)).toBe(false);
  });

  test("Runware's error code and message reach the log", async () => {
    const { summarizeRunwareResponse } = await import("../../ai/image-cost-summary");
    const summary: any = summarizeRunwareResponse({ errors: [{ code: "rateLimitExceeded", message: "Too many requests" }] });
    expect(summary.hasError).toBe(true);
    expect(summary.errorCode).toBe("rateLimitExceeded");
    expect(summary.errorMessage).toBe("Too many requests");
  });
});
