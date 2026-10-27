// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { buildBrief } from "./context";
import { resolveLengthBudget, type AgeBand } from "./craft";
import { buildWriterSystemPrompt } from "./draft-stage";
import { runStorybookTextEngine } from "./engine";
import { assembleImagePrompt, bindNamesToLooks, describeReferenceLooks, mentionsElement, nameElementsPlainly, negativePromptFor, recomposeShot, runDirectorStage, sanitizeIllustrationPlan, type VisualEntity } from "./illustration-stage";
import { generateStorybookImages, REDRAW_KEEPS_SCENE, parseQaReport, publishableImageUrl, qaSeverity, qaSeverityParts, qaStatus, salvageable, scopeQaReport, type ImageOutcome } from "./images";
import { CostLedger, resolveStorybookModels, retryRequestFor, type LlmRequest, type StorybookLlm } from "./llm";
import { buildOneShotUserPrompt, buildPatchPrompt, mergeStorybookPatch, planFromOneShot } from "./oneshot-stage";
import { storybookQuality } from "./quality";
import { inventedHeroLooks } from "./checks";
import { buildOneShotSystemPromptEn, buildOneShotUserPromptEn } from "./oneshot-prompt-en";
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
    expect(prompt.length).toBeLessThan(5600); // 4000 + the CHILD SAFETY block (2026-10-14)
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

  test("a vignette that shows a person is never printed; one that is merely off is", async () => {
    const run = async (extra: Record<string, unknown>) => generateStorybookImages({
      illustrations: { cover: images.cover, pages: [{ page: 1, scene: "Nothing to draw.", onStage: [], artifactVisible: false, vignette: "The red picnic cloth on the grass by the pond.", planningErrors: ["Empty character manifest; explicitly choose a detail shot or identify the visible figures."] }], storyElements: [cloth] },
      entities: people, seed: "s", buildReference: reference, visionModel: "test",
      llm: async (r) => reply(r, r.stage.includes("vignette") ? { characterCounts: { "The red cloth": 1 }, namedCharactersVisible: 1, anatomyDefects: [], duplicates: [], unexpectedCharacters: [], identityMatch: 1, sceneMatch: .3, ...extra } : cleanQa),
      provider: async () => ({ url: "https://example.test/x.jpg" }),
    });
    expect(publishableImageUrl((await run({ unexpectedCharacters: ["a boy"] })).pages.get(1))).toBeUndefined();
    expect(publishableImageUrl((await run({})).pages.get(1))).toBeDefined();
  });

  test("OLD: a flawed vignette is never printed (kept for the rule above)", async () => {
    const result = await generateStorybookImages({
      illustrations: { cover: images.cover, pages: [{ page: 1, scene: "Nothing to draw.", onStage: [], artifactVisible: false, vignette: "The red picnic cloth on the grass by the pond.", planningErrors: ["Empty character manifest; explicitly choose a detail shot or identify the visible figures."] }], storyElements: [cloth] },
      entities: people, seed: "s", buildReference: reference, visionModel: "test",
      llm: async (r) => reply(r, r.stage.includes("vignette") ? { characterCounts: { "The red cloth": 1 }, namedCharactersVisible: 1, anatomyDefects: [], duplicates: [], unexpectedCharacters: [], identityMatch: 1, sceneMatch: .3, posing: true } : cleanQa),
      provider: async () => ({ url: "https://example.test/x.jpg" }),
    });
    expect(result.pages.get(1)?.vignette).toBe(true);
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

describe("story 2b414c45: a drawn picture dropped for an unreadable checker reply", () => {
  test("short names, string counts and percentages are read, not rejected", () => {
    const qa = parseQaReport(JSON.stringify({ ...cleanQa, characterCounts: { alexander: "1", Adrian: 1, Rolf: "1 time" }, identityMatch: 95, sceneMatch: "0.8" }), ["Alexander", "Adrian", "Räuber Rolf"]);
    expect(qa).not.toBeNull();
    expect(qa!.identityMatch).toBe(.95);
    expect(qa!.sceneMatch).toBe(.8);
    expect(qa!.missing).toEqual([]);
  });

  test("the second read goes to the other family", async () => {
    const models: string[] = [];
    const result = await generateStorybookImages({ illustrations: images, entities: people, seed: "s", buildReference: reference, visionModel: "luna", fallbackVisionModel: "gemini",
      llm: async (r) => { models.push(r.model); return reply(r, r.model === "luna" ? "not json" : cleanQa); },
      provider: async () => ({ url: "https://example.test/cover.jpg" }),
    });
    expect(models).toEqual(["luna", "gemini"]);
    expect(result.cover?.status).toBe("passed");
  });
});

describe("Sol 6.1 test 2026-09-30", () => {
  test("an instant empty reply is retried on the same model, a truncated one still falls back", () => {
    const req = { stage: "oneshot", role: "writer" as const, model: "openai/gpt-6.1-sol", system: "", user: "", json: false, maxTokens: 4000, effort: "low" as const };
    expect(retryRequestFor(req, new Error("Empty response from openai/gpt-6.1-sol (oneshot, finish_reason=stop, completion_tokens=0).")).model).toBe("openai/gpt-6.1-sol");
    expect(retryRequestFor(req, new Error("Empty response from x (oneshot, finish_reason=length, completion_tokens=3500).")).model).toBe("openai/gpt-6-luna");
  });
  test("the writer is told: no moral, no invented relationship, no character sheet", () => {
    const prompt = buildWriterSystemPrompt(brief(), { oneShot: true });
    expect(prompt).toContain("Keine Lehre");
    expect(prompt).toContain("nenne keine Verwandtschaft");
    expect(prompt.length).toBeLessThan(6200); // + CHILD SAFETY block (2026-10-14)
  });
});

describe("catchphrase spelling", () => {
  test("pool spelling errors are corrected before the writer copies them", async () => {
    const { fixCatchphrase } = await import("./context");
    expect(fixCatchphrase("Erst qualmts, dann klaerts sich!")).toBe("Erst qualm's, dann klärt's sich!");
    expect(fixCatchphrase("Fest wie Stein, so soll es sein!")).toBe("Fest wie Stein, so soll es sein!");
  });
});

describe("story b10f2dad: the last page must not stay blank", () => {
  const dragon: VisualEntity = { id: "f", name: "Drache Fauchi", role: "cast", kind: "character", species: "dragon", isHuman: false, appearance: "small green dragon with orange wings", forbidden: [], referenceUrl: "https://example.test/fauchi.png" };
  const pot = { name: "Schwebetopf", noun: "copper floating pot", look: "a round copper pot with a whistle tube" };
  const crowd = { cover: images.cover, pages: [{ page: 7, scene: "Adrian laughs with a spoon. Alexander steps on the chain. Drache Fauchi closes his eyes over a bite of pudding. Three portions stand beside the copper pot.", onStage: ["a", "b", "f"], artifactVisible: false, elements: ["Schwebetopf"], vignette: "A firm pudding with a deep hole in three portions on plates beside the copper pot." }], storyElements: [pot] };
  const qaWith = (extra: Record<string, unknown>) => ({ characterCounts: { Alexander: 1, Adrian: 1, "Drache Fauchi": 1, Schwebetopf: 1 }, namedCharactersVisible: 4, anatomyDefects: [], duplicates: [], unexpectedCharacters: [], identityMatch: 1, sceneMatch: .8, ...extra });

  test("a doubled THING is soft, a doubled person stays hard", () => {
    const qa = parseQaReport(JSON.stringify(qaWith({ duplicates: ["Schwebetopf appears twice", "Adrian drawn 2 times"] })), ["Alexander", "Adrian", "Drache Fauchi", "Schwebetopf"])!;
    const scoped = scopeQaReport(qa, ["Alexander", "Adrian", "Drache Fauchi"], [pot]);
    expect(scoped.thingDuplicates).toEqual(["Schwebetopf appears twice"]);
    expect(scoped.duplicates).toEqual(["Adrian drawn 2 times"]);
    expect(qaSeverityParts(scopeQaReport(qa, [], [pot]), 4).soft).toBeGreaterThanOrEqual(10);
    expect(salvageable(scoped)).toBe(false);
    expect(salvageable(scopeQaReport(parseQaReport(JSON.stringify(qaWith({ duplicates: ["Schwebetopf appears twice"], featureBleed: ["Fauchi wears sleeves"] })), ["Alexander", "Adrian", "Drache Fauchi", "Schwebetopf"])!, ["Alexander", "Adrian", "Drache Fauchi"], [pot]))).toBe(true);
    // "Die Flotte der Minuten": a child with the troll's beard is never the least bad picture.
    expect(salvageable(scopeQaReport(parseQaReport(JSON.stringify(qaWith({ featureBleed: ["Adrian has Brumm-like green beard and moustache"] })), ["Alexander", "Adrian", "Drache Fauchi", "Schwebetopf"])!, ["Alexander", "Adrian", "Drache Fauchi"], [pot]))).toBe(false);
  });

  test("full picture and redraw fail, the heroes-only attempt rescues the page", async () => {
    const requests: string[] = [];
    let qaCalls = 0;
    const result = await generateStorybookImages({ illustrations: crowd, entities: [...people, dragon], seed: "s", buildReference: reference, visionModel: "test", concurrency: 1,
      llm: async (r) => { qaCalls++; return reply(r, r.user.includes("Drache Fauchi") ? qaWith({ duplicates: ["Adrian drawn 2 times"] }) : { ...qaWith({}), characterCounts: { Alexander: 1, Adrian: 1, Schwebetopf: 1 }, namedCharactersVisible: 3 }); },
      provider: async (request) => { requests.push(request.prompt); return { url: `https://example.test/${requests.length}.jpg` }; },
    });
    const page = result.pages.get(7)!;
    expect(page.status).toBe("passed");
    expect(page.attempts).toBe(3);
    expect(publishableImageUrl(page)).toBeDefined();
    const reducedPrompt = requests.filter((prompt) => prompt.length > 0).pop()!;
    expect(reducedPrompt).not.toContain("Fauchi");
    expect(page.history?.map((entry) => entry.kind)).toEqual(["full", "redraw", "reduced"]);
  });

  // Story 5e583e1e: the slowest picture walked full → redraw → reduced → vignette one after another (60 s).
  test("parallelRedraw draws the heroes-only attempt next to the redraw; the choice stays the same", async () => {
    let inFlight = 0;
    let most = 0;
    const result = await generateStorybookImages({ illustrations: crowd, entities: [...people, dragon], seed: "s", buildReference: reference, visionModel: "test", concurrency: 1, parallelRedraw: true,
      llm: async (r) => reply(r, r.user.includes("Drache Fauchi") ? qaWith({ duplicates: ["Adrian drawn 2 times"] }) : { ...qaWith({}), characterCounts: { Alexander: 1, Adrian: 1, Schwebetopf: 1 }, namedCharactersVisible: 3 }),
      provider: async (request) => {
        inFlight++;
        most = Math.max(most, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
        return { url: `https://example.test/${request.page}-${request.seed}.jpg` };
      },
    });
    const page = result.pages.get(7)!;
    expect(most).toBe(2);
    expect(page.status).toBe("passed");
    expect(page.attempts).toBe(3);
    expect(page.history?.map((entry) => entry.kind)).toEqual(["full", "redraw", "reduced"]);
  });

  test("a redraw that passes ships; the spare heroes-only picture is logged as unused, before it", async () => {
    const pages: number[] = [];
    const result = await generateStorybookImages({ illustrations: crowd, entities: [...people, dragon], seed: "s", buildReference: reference, visionModel: "test", concurrency: 1, parallelRedraw: true,
      llm: async (r) => reply(r, r.stage === "image-qa-p7-1" ? qaWith({ duplicates: ["Adrian drawn 2 times"] }) : qaWith({})),
      provider: async (request) => { pages.push(request.page); return { url: `https://example.test/${request.page}-${request.seed}.jpg` }; },
    });
    const page = result.pages.get(7)!;
    expect(page.status).toBe("passed");
    expect(page.attempts).toBe(2);
    expect(pages.filter((p) => p === 7)).toHaveLength(3);
    expect(page.history?.map((entry) => entry.kind)).toEqual(["full", "reduced-unused", "redraw"]);
  });

  // Story 0ee9af53: two scene-only redraws went from 0.45 to 0.3 and from 0.3 to 0.35 plus a doubled magpie.
  test("redrawLooseScene off keeps a picture whose only fault is a loose scene; any other fault is still redrawn", async () => {
    const pages: number[] = [];
    const loose = await generateStorybookImages({ illustrations: crowd, entities: [...people, dragon], seed: "s", buildReference: reference, visionModel: "test", concurrency: 1, redrawLooseScene: false,
      llm: async (r) => reply(r, { ...qaWith({}), sceneMatch: 0.3 }),
      provider: async (request) => { pages.push(request.page); return { url: `https://example.test/${request.page}-${request.seed}.jpg` }; },
    });
    const kept = loose.pages.get(7)!;
    expect(kept.attempts).toBe(1);
    expect(kept.status).toBe("flawed");
    expect(publishableImageUrl(kept)).toBeDefined();
    expect(pages.filter((p) => p === 7)).toHaveLength(1);

    const doubled = await generateStorybookImages({ illustrations: crowd, entities: [...people, dragon], seed: "s", buildReference: reference, visionModel: "test", concurrency: 1, redrawLooseScene: false,
      llm: async (r) => reply(r, r.stage === "image-qa-p7-1" ? { ...qaWith({ duplicates: ["Adrian drawn 2 times"] }), sceneMatch: 0.3 } : qaWith({})),
      provider: async (request) => ({ url: `https://example.test/${request.page}-${request.seed}.jpg` }),
    });
    expect(doubled.pages.get(7)!.history?.map((entry) => entry.kind)).toEqual(["full", "redraw"]);
  });

  test("when everything fails the least bad salvageable picture is printed, never a blank page", async () => {
    const result = await generateStorybookImages({ illustrations: crowd, entities: [...people, dragon], seed: "s", buildReference: reference, visionModel: "test", concurrency: 1,
      llm: async (r) => reply(r, r.stage.includes("vignette") ? qaWith({ unexpectedCharacters: ["a boy"] }) : qaWith({ featureBleed: ["Fauchi wears sleeves"], duplicates: ["Schwebetopf appears twice"] })),
      provider: async () => ({ url: "https://example.test/x.jpg" }),
    });
    const page = result.pages.get(7)!;
    expect(page.salvaged).toBe(true);
    expect(page.status).toBe("flawed");
    expect(publishableImageUrl(page)).toBeDefined();
  });

  test("a body defect on every attempt is still not printed", async () => {
    const result = await generateStorybookImages({ illustrations: crowd, entities: [...people, dragon], seed: "s", buildReference: reference, visionModel: "test", concurrency: 1,
      llm: async (r) => reply(r, qaWith({ anatomyDefects: ["Adrian has three hands"] })),
      provider: async () => ({ url: "https://example.test/x.jpg" }),
    });
    expect(publishableImageUrl(result.pages.get(7))).toBeUndefined();
  });
});

describe("wizard promises and hero looks (release audit 2026-10-14)", () => {
  test("learning objective, depth and German subject reach the writer", () => {
    const b = brief();
    b.config.learningMode = { enabled: true, subjects: ["science"], difficulty: "beginner", learningObjectives: ["Warum Igel Winterschlaf halten"], assessmentType: "interactive" };
    const prompt = buildOneShotUserPrompt(b);
    expect(prompt).toContain("Warum Igel Winterschlaf halten");
    expect(prompt).toContain("Naturwissenschaft");
    expect(prompt).not.toContain("Nebenbei lernen: science");
    expect(buildPatchPrompt("T", [], [], b)).toContain("Warum Igel Winterschlaf halten");
  });
  test("genre, twist and fairy-tale guest are binding, and the guest may keep its name", () => {
    const b = brief();
    b.config.hasTwist = true;
    b.config.allowFamousCharacters = true;
    const prompt = buildOneShotUserPrompt(b);
    expect(prompt).toContain("Genre Märchen (Pflicht)");
    expect(prompt).toContain("Überraschende Wendung (Pflicht)");
    expect(prompt).toContain("bekannte Märchenfigur mit ihrem bekannten Namen");
  });
  test("invented hero looks are found and attributed to the right hero", () => {
    const heroes = [
      { id: "a", name: "Alexander", age: 8, description: "Ein Junge mit braunen, zerzausten Haaren", visualProfile: { consistentDescriptors: ["boy, messy brown hair"] } },
      { id: "b", name: "Adrian", age: 7, description: "Ein Junge mit blonden Haaren", visualProfile: { consistentDescriptors: ["boy, blond hair"] } },
    ] as any;
    const pages = [{ order: 1, title: "", content: "Alexander kniete neben Adrian mit den Sommersprossen. Der große Adrian lachte. Alexander mit den braunen Haaren nickte, Adrians blonde Haare wippten." }];
    const issues = inventedHeroLooks(pages, heroes);
    expect(issues.map((issue) => issue.message.match(/gibt (\w+)/)?.[1])).toEqual(["Adrian", "Adrian"]);
    expect(issues.every((issue) => issue.severity === "hard")).toBe(true);
  });
});

describe("English writer prompt (default since 2026-10-14)", () => {
  test("carries every wizard promise and keeps the family's words and the German markers", () => {
    const b = brief();
    b.config.hasTwist = true;
    b.config.allowFamousCharacters = true;
    b.config.customPrompt = "Ein kleiner Drache, der Angst im Dunkeln hat";
    b.config.learningMode = { enabled: true, subjects: ["math"], difficulty: "beginner", learningObjectives: ["Verdoppeln"], assessmentType: "quiz" };
    const prompt = buildOneShotSystemPromptEn(b) + "\n" + buildOneShotUserPromptEn(b);
    for (const expected of ["Genre fairy tale (mandatory)", "Surprising twist (mandatory)", "famous fairy-tale character", "„Verdoppeln“", "maths", "Learning style quiz", "„Ein kleiner Drache, der Angst im Dunkeln hat“", "TITEL:", "BESCHREIBUNG:", "SEITE 1", "IDEEN:", "Präteritum", "Für einen ist noch Platz!"]) {
      expect(prompt).toContain(expected);
    }
    expect(buildOneShotUserPromptEn(brief("3-5", "short"))).toContain("For three- to five-year-olds");
  });
});

describe("director plan with several creatures of one kind (story ea253b27, 4 of 7 pages without picture)", () => {
  const entities: VisualEntity[] = [
    { id: "alex", name: "Alexander", role: "hero", kind: "character", species: "human", isHuman: true, appearance: "boy", forbidden: [] },
    { id: "adri", name: "Adrian", role: "hero", kind: "character", species: "human", isHuman: true, appearance: "boy", forbidden: [] },
    { id: "hexe", name: "Die Nebelhexe", role: "cast", kind: "character", species: "human", isHuman: true, appearance: "witch", forbidden: [] },
  ];
  const birds = [
    { name: "blue bird", noun: "blue songbird", look: "small bright-blue songbird", figure: true },
    { name: "yellow bird", noun: "yellow songbird", look: "small golden-yellow songbird", figure: true },
    { name: "violet bird", noun: "violet songbird", look: "huge violet songbird as wide as a parasol", figure: true },
  ];
  const plan = { heroes: [], pages: [], title: "T", logline: "L" } as any;
  const raw = {
    storyElements: birds,
    cover: { scene: "Wide view of the winter garden.", onStage: ["alex", "adri"], elements: ["blue bird"] },
    pages: [
      { page: 1, scene: "Alexander and Adrian whistle between the lemon tubs.", onStage: ["alex", "adri"], elements: [], vignette: "Three wooden armchairs among lemon tubs in a quiet glass winter garden." },
      // creature names inside onStage, all three birds listed although the scene shows one
      { page: 2, scene: "Low angle: Alexander leaps toward the blue songbird on a crossbar. The Nebelhexe stands at the right with raised hands.", onStage: ["alex", "hexe", "blue bird"], elements: ["blue bird", "yellow bird", "violet bird"] },
      { page: 3, scene: "Alexander purses his lips and whistles; the blue songbird bursts into a soft blue cloud above him. Adrian points at the yellow songbird hiding behind a broad leaf.", onStage: ["alex", "adri"], elements: ["blue bird", "yellow bird", "violet bird"] },
      { page: 4, scene: "The Nebelhexe stamps one boot as the enormous violet songbird bursts upward beside her. The yellow songbird darts in a tight circle near the glass roof.", onStage: ["hexe", "violet bird", "yellow bird"], elements: ["violet bird", "yellow bird", "blue bird"] },
    ],
  };
  const result = sanitizeIllustrationPlan(raw, 4, plan, entities, 3);

  test("an element name is the same word as a bird, but three birds do not match each other", () => {
    expect(mentionsElement("the blue songbird sings", result.storyElements![0])).toBe(true);
    expect(mentionsElement("the blue songbird sings", result.storyElements![1])).toBe(false);
    expect(mentionsElement("the huge violet songbird", result.storyElements![2])).toBe(true);
    expect(result.storyElements!.every((element) => element.distinct)).toBe(true);
    // a lone element keeps the head-noun match ("the red cloth")
    const cloth = sanitizeIllustrationPlan({ storyElements: [{ name: "red picnic cloth", noun: "red picnic cloth", look: "a red cloth" }] }, 1, plan, entities, 3).storyElements![0];
    expect(cloth.distinct).toBeUndefined();
    expect(mentionsElement("Alexander sits on the red cloth", cloth)).toBe(true);
  });
  test("creature names in onStage are elements, not unknown characters", () => {
    expect(result.pages[1].planningErrors).toBeUndefined();
    expect(result.pages[1].onStage).toEqual(["alex", "hexe"]);
    expect(result.pages[1].elements).toEqual(["blue bird"]);
  });
  test("only creatures named in the scene count against the three figures", () => {
    // two heroes + two named birds = four: a plain "crowded" error that recomposeShot can trim (no unknown ids)
    expect(result.pages[2].elements?.sort()).toEqual(["blue bird", "yellow bird"]);
    expect(result.pages[2].planningErrors).toEqual(["Composition exceeds 3 figures; recompose instead of dropping identities."]);
    const trimmed = recomposeShot(result.pages[2], entities, result.storyElements!, 3);
    expect(trimmed.planningErrors).toBeUndefined();
    expect(trimmed.onStage).toEqual(["alex", "adri"]);
    expect(trimmed.elements).toEqual(["blue bird"]);
    expect(trimmed.scene).toContain("Alexander purses his lips");
    expect(result.pages[3].onStage).toEqual(["hexe"]);
    expect(result.pages[3].elements?.sort()).toEqual(["violet bird", "yellow bird"]);
    expect(result.pages[3].planningErrors).toBeUndefined();
  });
  test("a page that cannot be composed borrows the book's place picture instead of staying blank", () => {
    expect(result.pages[1].vignette).toBeUndefined();
    expect(result.pages[1].fallbackVignette).toContain("armchairs");
    expect(result.pages[0].fallbackVignette).toBeUndefined();
  });
  test("a trimmed scene that no longer mentions anyone who stays keeps its wording", () => {
    const shot = { page: 3, scene: "Alexander whistles at the blue songbird. Adrian points at the yellow songbird behind a leaf. The violet songbird flaps.", onStage: ["alex", "adri"], elements: ["blue bird", "yellow bird", "violet bird"], artifactVisible: false, planningErrors: ["Composition exceeds 3 figures; recompose instead of dropping identities."] };
    const trimmed = recomposeShot(shot as any, entities, birds.map((bird) => ({ ...bird, distinct: true })) as any, 3);
    expect(trimmed.scene).toContain("Alexander whistles");
    expect(trimmed.scene).not.toContain("violet songbird");
  });
});

describe("a lone creature called by a shorter word stays in the picture", () => {
  test("'the frog' keeps the 'green frog king' element, the three birds still need their colour", () => {
    const entities: VisualEntity[] = [{ id: "alex", name: "Alexander", role: "hero", kind: "character", species: "human", isHuman: true, appearance: "boy", forbidden: [] }];
    const elements = [{ name: "Froschkönig", noun: "green frog king", look: "a green frog with a gold crown", figure: true }];
    const plan = { heroes: [], pages: [], title: "T", logline: "L" } as any;
    const raw = { storyElements: elements, cover: { scene: "x", onStage: ["alex"] }, pages: [{ page: 1, scene: "Alexander hands the book to the frog on the armchair.", onStage: ["alex"], elements: ["Froschkönig"] }] };
    expect(sanitizeIllustrationPlan(raw, 1, plan, entities, 3).pages[0].elements).toEqual(["Froschkönig"]);
  });
});

describe("image prompting from the benchmark of 2026-10-15 (scripts/image-bench)", () => {
  const hero: VisualEntity = { id: "h", name: "Adrian", role: "hero", kind: "character", species: "human", isHuman: true, appearance: "boy with short blond hair, grey t-shirt", forbidden: [], referenceUrl: "https://example.test/adrian.png" };
  const dragon: VisualEntity = { id: "f", name: "Drache Fauchi", role: "cast", kind: "character", species: "dragon", isHuman: false, appearance: "small green dragon with orange wings", forbidden: [], referenceUrl: "https://example.test/fauchi.png" };
  const cloud: VisualEntity = { id: "w", name: "Wolke Wuschel", role: "cast", kind: "character", species: "cloud", isHuman: false, appearance: "small white cloud with a rainbow scarf", forbidden: [], referenceUrl: "https://example.test/wuschel.png" };
  const cave = { cover: { page: 0, scene: "Adrian at the cave entrance.", onStage: ["h"], artifactVisible: false }, pages: [{ page: 1, scene: "Fauchi puffs a flame and Wuschel rains while Adrian holds out his hands.", onStage: ["f", "w", "h"], artifactVisible: false }] };
  const qa = (stage: string, defect: Record<string, unknown>) => ({ ...cleanQa, characterCounts: stage.includes("cover") ? { Adrian: 1 } : { Adrian: 1, "Drache Fauchi": 1, "Wolke Wuschel": 1 }, ...defect });

  test("a redraw keeps the full scene — place and action — instead of the director's bare simpleScene (book 29ae501d: plain, posed pictures)", async () => {
    const prompts: string[] = [];
    const place = "weathered stage frame and birch trees behind them in warm afternoon sun";
    const scene = `Wide shot: Fauchi puffs a flame, Wuschel rains and Adrian holds out his hands, ${place}.`;
    const simple = "Adrian, Fauchi and Wuschel stand separately.";
    await generateStorybookImages({
      illustrations: { cover: cave.cover, pages: [{ page: 1, scene, simpleScene: simple, onStage: ["f", "w", "h"], artifactVisible: false }] },
      entities: [hero, dragon, cloud], seed: "s", visionModel: "test", concurrency: 1, buildReference: reference,
      llm: async (r) => reply(r, qa(r.stage, r.stage === "image-qa-p1-1" ? { duplicates: ["Adrian drawn 2 times"] } : {})),
      provider: async (request) => { if (request.page === 1) prompts.push(request.prompt); return { url: `https://example.test/${request.page}-${request.seed}.jpg` }; },
    });
    expect(prompts.length).toBe(2);
    expect(prompts[1]).toContain(place);
    expect(prompts[1]).toContain(REDRAW_KEEPS_SCENE);
    expect(prompts[1]).not.toContain(simple);
    expect(prompts[1]).not.toContain("Simple clear composition");
    expect(prompts[1]).not.toContain("one pose per figure");
  });

  test("a doubled figure is redrawn with only the heroes on the sheet", async () => {
    const sheets: string[][] = [];
    const result = await generateStorybookImages({ illustrations: cave, entities: [hero, dragon, cloud], seed: "s", visionModel: "test", concurrency: 1,
      buildReference: async (slots) => { sheets.push(slots.map((slot) => slot.displayName)); return { urls: ["data:image/png;base64,AAA"], mode: slots.length > 1 ? "sprite" : "single", subjects: [] }; },
      llm: async (r) => reply(r, qa(r.stage, r.stage === "image-qa-p1-1" ? { duplicates: ["Adrian drawn 2 times"] } : {})),
      provider: async (request) => ({ url: `https://example.test/${request.page}-${request.seed}.jpg` }),
    });
    // page 1: full sheet first, then the heroes-only sheet for the redraw
    expect(sheets).toContainEqual(["Drache Fauchi", "Wolke Wuschel", "Adrian"]);
    expect(sheets.filter((sheet) => sheet.join() === "Adrian").length).toBe(2); // cover + redraw
    expect(result.pages.get(1)?.attempts).toBe(2);
    expect(result.pages.get(1)?.status).toBe("passed");
  });
});


describe("story 26fdd23f: writing in the pictures, the spare picture and the checker's evidence", () => {
  const dragon: VisualEntity = { id: "f", name: "Drache Fauchi", role: "cast", kind: "character", species: "dragon", isHuman: false, appearance: "small green dragon with orange wings", forbidden: [], referenceUrl: "https://example.test/fauchi.png" };
  const pot = { name: "Schwebetopf", noun: "copper floating pot", look: "a round copper pot with a whistle tube" };
  const crowd = { cover: images.cover, pages: [{ page: 7, scene: "Adrian laughs with a spoon. Alexander steps on the chain. Drache Fauchi closes his eyes over a bite of pudding.", onStage: ["a", "b", "f"], artifactVisible: false, elements: ["Schwebetopf"], vignette: "A firm pudding in three portions on plates beside the copper pot." }], storyElements: [pot] };
  const qaWith = (extra: Record<string, unknown>) => ({ characterCounts: { Alexander: 1, Adrian: 1, "Drache Fauchi": 1, Schwebetopf: 1 }, namedCharactersVisible: 4, anatomyDefects: [], duplicates: [], unexpectedCharacters: [], identityMatch: 1, sceneMatch: .8, ...extra });

  test("writing draws no spare heroes-only picture, and writing twice skips that rung; the checker says where it was", async () => {
    const calls: number[] = [];
    const result = await generateStorybookImages({ illustrations: crowd, entities: [...people, dragon], seed: "s", buildReference: reference, visionModel: "test", concurrency: 1, parallelRedraw: true,
      llm: async (r) => reply(r, r.stage.includes("vignette") ? qaWith({}) : qaWith({ textVisible: true, textSeen: "scribbled word under a logo on Adrian's shirt" })),
      provider: async (request) => { calls.push(request.page); return { url: `https://example.test/${request.page}-${calls.length}.jpg` }; },
    });
    const page = result.pages.get(7)!;
    // Before: full, redraw ∥ heroes-only, vignette — four pictures and four checks for a page printed as a vignette.
    expect(calls.filter((p) => p === 7)).toHaveLength(3);
    expect(page.history?.map((entry) => entry.kind)).toEqual(["full", "redraw", "vignette"]);
    expect(page.vignette).toBe(true);
    expect(page.history?.[0].notes).toContain("text visible: scribbled word under a logo on Adrian's shirt");
    expect(page.history?.[0].url).toMatch(/^https:\/\/example\.test\/7-/);
    // The cover has no vignette: two pictures, then it borrows a page picture.
    expect(calls.filter((p) => p === 0)).toHaveLength(2);
  });

  test("a crowd fault still draws the spare next to the redraw", async () => {
    const calls: number[] = [];
    await generateStorybookImages({ illustrations: crowd, entities: [...people, dragon], seed: "s", buildReference: reference, visionModel: "test", concurrency: 1, parallelRedraw: true,
      llm: async (r) => reply(r, r.stage === "image-qa-p7-1" ? qaWith({ duplicates: ["Adrian drawn 2 times"] }) : qaWith({})),
      provider: async (request) => { calls.push(request.page); return { url: `https://example.test/${calls.length}.jpg` }; },
    });
    expect(calls.filter((p) => p === 7)).toHaveLength(3);
  });

  test("logos on a portrait's clothes are boxed by the looks reader and reach the identity sheet", async () => {
    const llm: StorybookLlm = async (r) => reply(r, { looks: { e1: "young boy with spiky blond hair, plain navy T-shirt, jeans" }, tags: { e1: "blond boy in navy T-shirt" }, marks: { e1: [[535, 432, 617, 490], [0, 0, 900, 900]] } });
    const { entities } = await describeReferenceLooks(llm, [{ ...people[1], id: "marks-1", referenceKey: "bucket://avatar/marks-1" }], "test-marks");
    // A box over most of the portrait is a misread, never painted.
    expect(entities[0].marks).toEqual([[535, 432, 617, 490]]);
    const slots: Array<{ marks?: unknown }> = [];
    await generateStorybookImages({ illustrations: { cover: { page: 0, scene: "Adrian waves.", onStage: ["marks-1"], artifactVisible: false }, pages: [] }, entities, seed: "s",
      buildReference: async (sheet) => { slots.push(...sheet); return reference(); }, provider: async () => ({ url: "https://example.test/c.jpg" }) });
    expect(slots[0].marks).toEqual([[535, 432, 617, 490]]);
  });

  test("a crowded shot keeps the figure whose action opens the scene", () => {
    const karo: VisualEntity = { id: "k", name: "Karo", role: "cast", kind: "character", species: "thing", isHuman: false, appearance: "red-and-cream wooden game board", forbidden: [] };
    const rosa: VisualEntity = { id: "r", name: "Prinzessin Rosalinde", role: "cast", kind: "character", species: "human", isHuman: true, appearance: "princess in a pink gown", forbidden: [] };
    const shot = { page: 1, scene: "Karo springs a square up beside Alexander's ear. Adrian laughs. Prinzessin Rosalinde watches from the door.", onStage: ["r", "a", "b", "k"], artifactVisible: false, elements: [], planningErrors: ["Composition exceeds 3 figures; recompose instead of dropping identities."] };
    const trimmed = recomposeShot(shot, [...people, karo, rosa], [], 3);
    expect(trimmed.onStage).toEqual(["a", "b", "k"]);
    expect(trimmed.scene).toBe("Karo springs a square up beside Alexander's ear. Adrian laughs.");
  });

  test("a dropped animal leaves with every sentence that calls it by its noun", () => {
    const karo: VisualEntity = { id: "k", name: "Karo", role: "cast", kind: "character", species: "thing", isHuman: false, appearance: "red-and-cream wooden game board", tag: "red-and-cream wooden game board", forbidden: [] };
    const cat: VisualEntity = { id: "c", name: "Der gestiefelte Kater", role: "cast", kind: "character", species: "animal", isHuman: false, appearance: "orange tabby cat", tag: "orange tabby cat in feathered hat", forbidden: [] };
    const crowded = ["Composition exceeds 3 figures; recompose instead of dropping identities."];
    // The cat is the action (named twice, once as "the cat"): the board gives way, the cat's sentences stay.
    const ride = recomposeShot({ page: 6, scene: "Der gestiefelte Kater rides the cushion past Alexander. Karo's lane whips back under the table. The cat throws up his paws. Adrian laughs.", onStage: ["a", "c", "b", "k"], artifactVisible: false, elements: [], planningErrors: crowded }, [...people, karo, cat], [], 3);
    expect(ride.onStage).toEqual(["a", "c", "b"]);
    expect(ride.scene).toBe("Der gestiefelte Kater rides the cushion past Alexander. The cat throws up his paws. Adrian laughs.");
    // The board is the action: the cat gives way, and "the cat" goes with him.
    const square = recomposeShot({ page: 1, scene: "Karo flips a square up beside Alexander's ear. The board's lane loops round the chair. The cat yawns. Adrian laughs at Der gestiefelte Kater.", onStage: ["a", "b", "k", "c"], artifactVisible: false, elements: [], planningErrors: crowded }, [...people, karo, cat], [], 3);
    expect(square.onStage).toEqual(["a", "b", "k"]);
    expect(square.scene).toBe("Karo flips a square up beside Alexander's ear. The board's lane loops round the chair.");
  });
});
