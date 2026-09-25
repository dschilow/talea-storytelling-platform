/**
 * Storybook Pipeline (storybook-v2) — tests for everything that must work
 * without a model: routing, parsing, the fact gates, casting, illustration
 * locks, the image retry and the whole engine flow against a scripted port.
 */

// @ts-ignore Bun exposes this runtime-only test helper without Node typings.
import { describe, expect, test } from "bun:test";

import { normalizeAgeBand, rankEngines, resolveLengthBudget, STORY_ENGINES } from "./craft";
import { buildBrief, type StoryBrief } from "./context";
import { CostLedger, modelFamily, resolveStorybookModels, toOpenRouterModelId, type LlmRequest, type StorybookLlm } from "./llm";
import { acceptsTemperature, resolveStorybookReasoning } from "./llm-guards";
import { normalizeGermanQuotes, parseDraft } from "./parsing";
import { checkPlan, checkProse, mentions, nameTokens } from "./checks";
import { selectRewardArtifacts, shortlistCastCandidates } from "./cast-selection";
import { sanitizePitches } from "./concept-stage";
import { sanitizePlan } from "./plan-stage";
import { comprehensionGaps, needsRevision, sanitizeReview } from "./review-stage";
import { assembleImagePrompt, castAppearance, heroAppearance, negativePromptFor, sanitizeIllustrationPlan, type VisualEntity } from "./illustration-stage";
import { generateStorybookImages, qaSeverity } from "./images";
import { runStorybookTextEngine } from "./engine";
import type { CastCandidate, StoryPlan, StorybookPage } from "./types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const KOBOLD: CastCandidate = {
  id: "pool-kicher",
  name: "Kobold Kicher",
  species: "magical_creature",
  role: "antagonist",
  archetype: "trickster",
  whoTheyAre: "Kleiner Kobold mit schiefem Hut",
  personality: ["frech"],
  speechStyle: ["kichernd"],
  quirk: "sammelt knarrende Türgriffe",
  catchphrase: "Hihi - ein Trick, ein Klick, ein Glück!",
  imageUrl: "https://img.example/kicher.png",
  visualProfile: { imagePrompt: "Portrait of a small goblin with a crooked green hat and a bag full of prank tools. Storybook illustration style." },
};

function brief(overrides: Partial<Parameters<typeof buildBrief>[0]> = {}): StoryBrief {
  const band = normalizeAgeBand("6-8");
  return buildBrief({
    config: { genre: "fairy_tales", setting: "fantasy", length: "medium", ageGroup: "6-8", language: "de", humorLevel: 2 } as any,
    band,
    budget: resolveLengthBudget("medium", band),
    heroes: [
      { id: "a1", name: "Alexander", age: 7, visualProfile: { characterType: "human", hair: { color: "brown", length: "short" }, eyes: { color: "green" } } },
      { id: "a2", name: "Adrian", age: 6 },
    ],
    candidates: [KOBOLD],
    artifacts: [],
    seed: "seed-1",
    ...overrides,
  });
}

function planFor(b: StoryBrief, overrides: Partial<StoryPlan> = {}): StoryPlan {
  const pages = Array.from({ length: b.budget.pages }, (_, index) => ({
    page: index + 1,
    place: "Mühle",
    action: `Handlung ${index + 1}`,
    heroMoment: "Alexander entscheidet",
    humor: "Kicher stolpert",
    emotion: "Knie zittern",
    turn: "Wer klopft da?",
    picture: "Alexander springt über einen Sack Mehl",
    onPage: ["a1", "a2", "pool-kicher"],
  }));
  return {
    title: "Alexander und der Kobold im Mehl",
    logline: "Zwei Kinder wollen das Brot retten.",
    engine: "gaunerfalle",
    chosenPitch: 0,
    whyChosen: "",
    want: "das Brot retten",
    stakes: "kein Fest",
    worldRule: null,
    ruleIntro: null,
    solutionWhy: "Der Kobold niest immer, wenn er lügt — also verrät ihn sein Niesen.",
    refrain: "Mehl im Haar, Kobold da!",
    runningGag: { what: "Kicher niest", beats: ["1", "2", "3"] },
    dramaticIrony: "Das Kind sieht den Kobold im Sack.",
    setups: [{ what: "die Glocke", plantedOnPage: 1, paysOffOnPage: 6 }],
    heroes: [
      { id: "a1", name: "Alexander", strength: "planen", voice: "ruhig", contribution: "stellt die Falle" },
      { id: "a2", name: "Adrian", strength: "schnell", voice: "laut", contribution: "lockt den Kobold" },
    ],
    cast: [{ id: "pool-kicher", name: "Kobold Kicher", role: "Gauner", want: "Türgriffe", voice: "kichernd", signature: "niest" }],
    artifact: null,
    pages,
    ending: { resolution: "Brot gerettet", callback: "die Glocke", lastLine: "Kicher niest." },
    ...overrides,
  };
}

function storyPages(count: number, text: (page: number) => string): StorybookPage[] {
  return Array.from({ length: count }, (_, index) => ({ order: index + 1, title: `Seite ${index + 1}`, content: text(index + 1) }));
}

const WORDS = (n: number) => Array.from({ length: n }, (_, i) => (i % 9 === 0 ? "Mehl." : "Wort")).join(" ");

// ---------------------------------------------------------------------------

describe("model routing", () => {
  test("GPT-6 Luna is the default writer and the critic comes from another family", () => {
    const models = resolveStorybookModels({ aiProvider: "openrouter", openRouterModel: "openai/gpt-6-luna" } as any);
    expect(models.writer).toBe("openai/gpt-6-luna");
    expect(models.support).toBe("openai/gpt-6-luna");
    expect(modelFamily(models.critic)).not.toBe(modelFamily(models.writer));
  });

  test("run 0039344e: Flash-Lite scored a ~5.5 story 8/10 — the default critic is Claude Sonnet 5", () => {
    const models = resolveStorybookModels({ aiProvider: "openrouter", openRouterModel: "openai/gpt-6-luna" } as any);
    expect(models.critic).toBe("anthropic/claude-sonnet-5");
    const gemini = resolveStorybookModels({ aiProvider: "native", aiModel: "gemini-3.1-pro-preview" } as any);
    expect(gemini.writer).toBe("google/gemini-3.1-pro-preview");
    expect(gemini.critic).toBe("anthropic/claude-sonnet-5");
  });

  test("a Claude writer is never graded by a Claude critic", () => {
    const models = resolveStorybookModels({ aiProvider: "native", aiModel: "claude-sonnet-4-6" } as any);
    expect(models.critic).toBe("openai/gpt-6-luna");
  });

  test("an override critic from the writer's own family is rejected", () => {
    const models = resolveStorybookModels({ aiProvider: "openrouter", openRouterModel: "openai/gpt-6-luna" } as any, { critic: "openai/gpt-6-luna-pro" });
    expect(modelFamily(models.critic)).toBe("anthropic");
  });

  test("native wizard ids map onto OpenRouter ids", () => {
    expect(toOpenRouterModelId("claude-sonnet-4-6")).toBe("anthropic/claude-sonnet-4.6");
    expect(toOpenRouterModelId("gpt-5.4-mini")).toBe("openai/gpt-5.4-mini");
    expect(toOpenRouterModelId("minimax-m2.7")).toBe("minimax/minimax-m2.7");
    expect(toOpenRouterModelId("moonshotai/kimi-k2.6")).toBe("moonshotai/kimi-k2.6");
  });

  test("gpt-6 gets an explicit effort; hidden medium reasoning would eat max_tokens", () => {
    expect(resolveStorybookReasoning("openai/gpt-6-luna", "low")).toEqual({ effort: "low", exclude: true });
    expect(resolveStorybookReasoning("openai/gpt-6-luna")).toEqual({ effort: "none", exclude: true });
    expect(resolveStorybookReasoning("google/gemini-3.5-flash-lite", "none")).toEqual({ effort: "minimal", exclude: true });
    expect(resolveStorybookReasoning("moonshotai/kimi-k2.6", "medium")).toEqual({ enabled: false, exclude: true });
    expect(acceptsTemperature("openai/gpt-6-luna")).toBe(false);
    expect(acceptsTemperature("moonshotai/kimi-k2.6")).toBe(true);
    expect(acceptsTemperature("anthropic/claude-sonnet-5")).toBe(false);
    expect(resolveStorybookReasoning("anthropic/claude-sonnet-5", "medium", "critic")).toEqual({ effort: "low", exclude: true });
    expect(resolveStorybookReasoning("anthropic/claude-sonnet-5", "none", "critic")).toEqual({ enabled: false, exclude: true });
    expect(resolveStorybookReasoning("anthropic/claude-sonnet-5", "low", "writer")).toEqual({ enabled: false, exclude: true });
  });
});

describe("craft", () => {
  test("picture-book budgets: more pages, fewer words each", () => {
    expect(resolveLengthBudget("medium", "6-8").pages).toBe(7);
    expect(resolveLengthBudget("short", "3-5").wordsPerPageMax).toBeLessThan(resolveLengthBudget("short", "9-12").wordsPerPageMin);
    expect(normalizeAgeBand("13+")).toBe("9-12");
    expect(normalizeAgeBand(undefined)).toBe("6-8");
  });

  test("engine ranking respects the age band and pushes recent engines back", () => {
    const small = rankEngines({ band: "3-5", flavors: [], recentEngineIds: [], seed: "x" });
    expect(small.every((engine) => engine.ages.includes("3-5"))).toBe(true);
    const fresh = rankEngines({ band: "6-8", flavors: ["lachfreude"], recentEngineIds: [], seed: "x" });
    const afterUse = rankEngines({ band: "6-8", flavors: ["lachfreude"], recentEngineIds: [fresh[0].id], seed: "x" });
    expect(afterUse[0].id).not.toBe(fresh[0].id);
    expect(STORY_ENGINES.length).toBeGreaterThanOrEqual(10);
  });
});

describe("draft parsing", () => {
  test("reads title, description and markdown-decorated page markers", () => {
    const parsed = parseDraft("TITEL: Der Kobold\nBESCHREIBUNG: Ein Satz.\n**SEITE 1**\nEins.\n\n## SEITE 2\nZwei.", 2, { german: true });
    expect(parsed.title).toBe("Der Kobold");
    expect(parsed.pages.map((p) => p.content)).toEqual(["Eins.", "Zwei."]);
  });

  test("renumbers skipped markers", () => {
    const parsed = parseDraft("SEITE 1\nA\n\nSEITE 3\nB", 2);
    expect(parsed.pages.map((p) => p.order)).toEqual([1, 2]);
  });

  test("straight quotes become German quotes only when they pair up", () => {
    expect(normalizeGermanQuotes('"Hallo", sagte er. "Komm!"')).toBe("„Hallo“, sagte er. „Komm!“");
    expect(normalizeGermanQuotes('Er sagte "Hallo')).toBe('Er sagte "Hallo');
  });
});

describe("fact gates", () => {
  test("name matching uses the distinctive part of a pool name", () => {
    expect(nameTokens("Hexe Griselda")).toEqual(["Griselda"]);
    expect(mentions("Die Hexe kicherte.", "Hexe Griselda")).toBe(false);
    expect(mentions("Griseldas Hut flog weg.", "Hexe Griselda")).toBe(true);
  });

  test("a plan without pool casting is a hard failure when the pool offered someone", () => {
    const b = brief();
    const report = checkPlan(planFor(b, { cast: [] }), b);
    expect(report.hard.some((issue) => issue.code === "cast_empty")).toBe(true);
  });

  test("a forgotten brought artifact is a hard failure", () => {
    const b = brief({ artifacts: [{ id: "art-1", name: "Kompass der Winde", rule: "zeigt, wo der Wind herkommt", visualKeywords: [], broughtBy: "a1" }] });
    const report = checkPlan(planFor(b), b);
    expect(report.hard.some((issue) => issue.code === "brought_artifact_missing")).toBe(true);
  });

  test("run 0039344e: an unexplainable solution, an unshown rule and a vanishing pool character are hard failures", () => {
    const b = brief();
    const plan = planFor(b, { solutionWhy: "", worldRule: "Das Becken erfüllt Wünsche wörtlich.", ruleIntro: null });
    plan.pages = plan.pages.map((page) => ({ ...page, onPage: page.page <= 2 ? page.onPage : ["a1", "a2"] }));
    const codes = checkPlan(plan, b).hard.map((issue) => issue.code);
    expect(codes).toContain("solution_unexplained");
    expect(codes).toContain("rule_not_introduced");
    expect(codes).toContain("cast_vanishes");
  });

  test("a page ending on a narrator's question is flagged, a character's question is not", () => {
    const b = brief();
    const pages = storyPages(7, (page) => `Alexander, Adrian und Kicher ${WORDS(100)} ${page === 3 ? "Ob das wohl gut geht?" : "„Wer war das?“, fragte Adrian."}`);
    const flagged = checkProse({ pages, budget: b.budget, plan: planFor(b), brief: b }).soft.filter((issue) => issue.code === "narrator_question");
    expect(flagged.map((issue) => issue.page)).toEqual([3]);
  });

  test("a complete plan passes", () => {
    const b = brief();
    expect(checkPlan(planFor(b), b).ok).toBe(true);
  });

  test("prose: missing pool character, moral ending and blocked terms are hard", () => {
    const b = brief({ blockedTerms: ["Gespenst"] });
    const pages = storyPages(7, (page) => `Alexander und Adrian ${WORDS(100)}${page === 7 ? " Sie lernten, dass Freundschaft zählt. Ein Gespenst winkte." : ""}`);
    const report = checkProse({ pages, budget: b.budget, plan: planFor(b), brief: b });
    const codes = report.hard.map((issue) => issue.code);
    expect(codes).toContain("cast_missing");
    expect(codes).toContain("moral_ending");
    expect(codes).toContain("blocked_term");
  });

  test("prose: a clean story with every character passes the hard gates", () => {
    const b = brief();
    const pages = storyPages(7, () => `Alexander rief Adrian. Kicher kicherte. „Mehl im Haar, Kobold da!“ ${WORDS(95)}`);
    const report = checkProse({ pages, budget: b.budget, plan: planFor(b), brief: b });
    expect(report.hard).toEqual([]);
  });

  test("prose: far too long is hard, so the revision has to cut", () => {
    const b = brief();
    const pages = storyPages(7, () => `Alexander Adrian Kicher ${WORDS(260)}`);
    expect(checkProse({ pages, budget: b.budget, plan: planFor(b), brief: b }).hard.map((i) => i.code)).toContain("too_long");
  });
});

describe("casting", () => {
  const rows = [
    { id: "1", name: "Bäcker Wilhelm", role: "support", archetype: "craftsman", species_category: "human", canon_settings: ["village"], image_url: null },
    { id: "2", name: "Bäcker Wilhelm", role: "support", archetype: "craftsman", species_category: "human", canon_settings: ["village"], image_url: "https://img/w.png", quirk: "schnuppert" },
    { id: "3", name: "Räuber Rolf", role: "antagonist", archetype: "villain", species_category: "human", canon_settings: ["forest"], image_url: "https://img/r.png" },
    { id: "4", name: "Frosch Quak", role: "helper", archetype: "creature", species_category: "animal", canon_settings: ["forest"], image_url: "https://img/q.png" },
    { id: "5", name: "Alexander", role: "main", archetype: "hero", species_category: "human", image_url: "https://img/a.png" },
  ];

  test("dedupes by name, prefers the row with an image, excludes hero names, keeps variety", () => {
    const list = shortlistCastCandidates({ rows, band: "6-8", genre: "fairy_tales", setting: "forest", excludeNames: new Set(["alexander"]), seed: "s" });
    const names = list.map((candidate) => candidate.name);
    expect(names).not.toContain("Alexander");
    expect(names.filter((name) => name === "Bäcker Wilhelm").length).toBe(1);
    expect(list.find((candidate) => candidate.name === "Bäcker Wilhelm")?.imageUrl).toBe("https://img/w.png");
    expect(names).toContain("Räuber Rolf");
    expect(names).toContain("Frosch Quak");
  });

  test("reward artifacts skip owned, crowned and legendary ones", () => {
    const artifacts = [
      { id: "x1", name_de: "Kompass", story_role: "zeigt Wege", rarity: "common", genre_fantasy: 0.9 },
      { id: "x2", name_de: "Krone", story_role: "Krone", rarity: "legendary", genre_fantasy: 1 },
      { id: "x3", name_de: "Laterne", story_role: "leuchtet", rarity: "rare", genre_fantasy: 0.8 },
    ];
    const options = selectRewardArtifacts({ rows: artifacts, genre: "fairy_tales", excludeIds: new Set(["x3"]), seed: "s" });
    expect(options.map((option) => option.id)).toEqual(["x1"]);
  });
});

describe("concept and plan sanitising", () => {
  test("pitches lose unknown cast ids; a brought artifact is forced in", () => {
    const b = brief({ artifacts: [{ id: "art-1", name: "Kompass", rule: "zeigt Wege", visualKeywords: [], broughtBy: "a1" }] });
    const pitches = sanitizePitches({ pitches: [{ engine: "bluff", logline: "x", cast: [{ id: "pool-kicher", role: "Gauner" }, { id: "erfunden", role: "?" }], artifact: null, heroRoles: [{ heroId: "a1" }, { heroId: "nobody" }] }] }, b, STORY_ENGINES);
    expect(pitches[0].cast.map((member) => member.id)).toEqual(["pool-kicher"]);
    expect(pitches[0].artifact?.id).toBe("art-1");
    expect(pitches[0].heroRoles.map((role) => role.heroId)).toEqual(["a1"]);
  });

  test("the plan keeps only known ids on its pages and marks a brought artifact as carried", () => {
    const b = brief({ artifacts: [{ id: "art-1", name: "Kompass", rule: "zeigt Wege", visualKeywords: [], broughtBy: "a1" }] });
    const raw = { title: "T", cast: [{ id: "pool-kicher" }], artifact: { id: "art-1", usePage: 5 }, pages: [{ action: "x", onPage: ["a1", "ghost", "pool-kicher"] }], heroes: [{ id: "a1", contribution: "c" }] };
    const plan = sanitizePlan(raw, b, [])!;
    expect(plan.pages[0].onPage).toEqual(["a1", "pool-kicher"]);
    expect(plan.artifact).toMatchObject({ id: "art-1", carried: true, firstPage: 1, usePage: 5 });
  });
});

describe("editorial review", () => {
  test("scores are clamped to 0-10 and unanswerable comprehension becomes a revision note", () => {
    const review = sanitizeReview({ scores: { overall: 14, humor: -2 }, comprehension: { want: "Brot retten", problem: null, solution: "steht nicht drin", ending: "gut" }, mustFix: [] }, 7)!;
    expect(review.scores.overall).toBe(10);
    expect(review.scores.humor).toBe(0);
    expect(comprehensionGaps(review).length).toBe(2);
    expect(needsRevision(review, [])).toBe(true);
  });

  test("a publishable story with nothing to fix is not rewritten", () => {
    const review = sanitizeReview({ scores: { overall: 9.2 }, comprehension: { want: "a", problem: "b", solution: "c", ending: "d" }, mustFix: [], languageErrors: [] }, 7)!;
    expect(needsRevision(review, [])).toBe(false);
    expect(needsRevision(review, ["Held fehlt"])).toBe(true);
  });
});

describe("illustration locks", () => {
  const human: VisualEntity = { id: "a1", name: "Alexander", kind: "character", species: "human", isHuman: true, appearance: "7-year-old boy, brown hair", forbidden: ["glasses"], referenceUrl: "https://r/a.png" };
  const goblin: VisualEntity = { id: "pool-kicher", name: "Kobold Kicher", kind: "character", species: "magical creature", isHuman: false, appearance: "small goblin", forbidden: [], referenceUrl: "https://r/k.png" };

  test("every human on stage gets the anatomy lock; the sheet order is spelled out", () => {
    const prompt = assembleImagePrompt({ scene: "Alexander dives under a table.", onStage: [human, goblin], spriteOrder: [human, goblin] });
    expect(prompt.startsWith("Alexander dives")).toBe(true);
    expect(prompt).toContain("fully human");
    expect(prompt).toContain("five fingers");
    expect(prompt).toContain("1: Alexander; 2: Kobold Kicher");
    expect(prompt).toContain("Exactly 2 named characters");
  });

  test("negatives ban animal features on humans and the painted sheet", () => {
    const negative = negativePromptFor([human, goblin], true);
    expect(negative).toContain("animal ears on a human");
    expect(negative).toContain("three hands");
    expect(negative).toContain("glasses");
    expect(negative.toLowerCase()).toContain("strip");
  });

  test("appearance lines come from structured profiles and English pool prompts", () => {
    expect(heroAppearance({ hair: { color: "brown", length: "short" }, eyes: { color: "green" } })).toContain("brown short hair");
    expect(castAppearance(KOBOLD.visualProfile)).toContain("goblin");
    expect(castAppearance({ description: "Kleiner Kobold mit Hut" })).toBe("Kleiner Kobold mit Hut");
  });

  test("the director may draw at most three characters and missing pages fall back to the plan", () => {
    const b = brief();
    const plan = planFor(b);
    const entities: VisualEntity[] = [human, goblin, { ...human, id: "a2", name: "Adrian" }, { ...goblin, id: "x", name: "X" }];
    const shots = sanitizeIllustrationPlan({ cover: { scene: "cover", onStage: ["a1", "a2", "pool-kicher", "x"] }, pages: [{ page: 1, scene: "one", onStage: ["a1", "nobody"] }] }, 3, plan, entities, 3);
    expect(shots.cover.onStage).toEqual(["a1", "a2", "pool-kicher"]);
    expect(shots.pages[0].onStage).toEqual(["a1"]);
    expect(shots.pages[1].scene).toBe(plan.pages[1].picture);
  });
});

describe("images", () => {
  const entities: VisualEntity[] = [
    { id: "a1", name: "Alexander", kind: "character", species: "human", isHuman: true, appearance: "boy", forbidden: [], referenceUrl: "https://r/a.png" },
    { id: "k", name: "Kicher", kind: "character", species: "goblin", isHuman: false, appearance: "goblin", forbidden: [], referenceUrl: "https://r/k.png" },
  ];

  test("each picture's identity sheet holds only the characters drawn on it; a severe defect is regenerated once", async () => {
    const sheets: string[][] = [];
    let calls = 0;
    const llm: StorybookLlm = async (request) => {
      const defective = String(request.imageInputs?.[0]).includes("attempt-1") && request.stage.includes("p1");
      return {
        text: JSON.stringify({ namedCharactersVisible: 1, anatomyDefects: defective ? ["three hands"] : [], animalFeaturesOnHumans: [], duplicates: [], identityMatch: 0.9, sceneMatch: 0.9 }),
        modelUsed: request.model,
        usage: { prompt: 10, completion: 10, total: 20, costUSD: 0.0001 },
        durationMs: 1,
      };
    };
    const result = await generateStorybookImages({
      illustrations: {
        cover: { page: 0, scene: "cover", onStage: ["a1", "k"], artifactVisible: false },
        pages: [{ page: 1, scene: "p1", onStage: ["a1"], artifactVisible: false }],
      },
      entities,
      seed: "s",
      llm,
      visionModel: "openai/gpt-6-luna",
      buildReference: async (slots) => {
        sheets.push(slots.map((slot) => slot.displayName));
        return { urls: [slots.length > 1 ? "data:image/png;base64,AAA" : slots[0].imageUrl], mode: slots.length > 1 ? "sprite" : "single", subjects: slots.map((slot) => ({ displayName: slot.displayName, kind: slot.kind || "character" })) };
      },
      provider: async (request) => {
        calls += 1;
        const attempt = request.prompt.includes("Correct anatomy") ? 2 : 1;
        return { url: `https://img/${request.page}-attempt-${attempt}.jpg`, costUSD: 0.0013 };
      },
    });
    expect(sheets).toContainEqual(["Alexander", "Kicher"]);
    expect(sheets).toContainEqual(["Alexander"]);
    expect(result.regenerated).toEqual([1]);
    expect(result.pages.get(1)?.url).toBe("https://img/1-attempt-2.jpg");
    expect(calls).toBe(3);
    expect(result.imageCostUSD).toBeCloseTo(0.0039, 6);
  });

  test("severity: anatomy and bleed are severe, a missing background figure is not", () => {
    const clean = { anatomyDefects: [], animalFeaturesOnHumans: [], duplicates: [], unexpectedCharacters: [], roleSwaps: [], textVisible: false, referenceSheetVisible: false, identityMatch: 0.9, sceneMatch: 0.9, namedCharactersVisible: 2 };
    expect(qaSeverity(clean, 2)).toBe(0);
    expect(qaSeverity({ ...clean, namedCharactersVisible: 1 }, 2)).toBeLessThan(10);
    expect(qaSeverity({ ...clean, animalFeaturesOnHumans: ["fox ears"] }, 2)).toBeGreaterThanOrEqual(10);
    expect(qaSeverity({ ...clean, roleSwaps: ["Alexander climbs instead of Adrian"] }, 2)).toBeGreaterThanOrEqual(10);
  });

  test("run 0039344e: a sheet the provider rejects never leaves the page blank", async () => {
    const three: VisualEntity[] = [
      { id: "a1", name: "Alexander", kind: "character", role: "hero", species: "human", isHuman: true, appearance: "boy", forbidden: [], referenceUrl: "https://r/a.png" },
      { id: "bo", name: "Bo", kind: "character", role: "cast", species: "fox", isHuman: false, appearance: "fox", forbidden: [], referenceUrl: "https://r/bo.png" },
      { id: "a2", name: "Adrian", kind: "character", role: "hero", species: "human", isHuman: true, appearance: "boy", forbidden: [], referenceUrl: "https://r/b.png" },
    ];
    const sheetsSent: string[][] = [];
    const result = await generateStorybookImages({
      illustrations: { cover: { page: 0, scene: "cover", onStage: ["a1", "a2"], artifactVisible: false }, pages: [{ page: 1, scene: "p1", onStage: ["bo", "a1", "a2"], artifactVisible: false }] },
      entities: three,
      seed: "s",
      buildReference: async (slots) => ({ urls: [`sheet:${slots.map((slot) => slot.displayName).join("+")}`], mode: slots.length > 1 ? "sprite" : "single", subjects: slots.map((slot) => ({ displayName: slot.displayName, kind: slot.kind || "character" })) }),
      provider: async (request) => {
        sheetsSent.push(request.referenceImages);
        // The internal RPC refused the three-identity sheet (too large).
        if (request.referenceImages[0]?.split("+").length === 3) throw new Error("payload too large");
        return { url: `https://img/${request.page}.jpg`, costUSD: 0.0006 };
      },
    });
    const page = result.pages.get(1)!;
    expect(page.url).toBe("https://img/1.jpg");
    expect(page.referenceLevel).toBe(1);
    // Heroes keep their place when the sheet shrinks.
    expect(sheetsSent).toContainEqual(["sheet:Alexander+Adrian"]);
    expect(page.errors?.[0]).toContain("payload too large");
    expect(result.imagesGenerated).toBe(2);
  });

  test("with every sheet refused, the picture is drawn without a reference rather than skipped", async () => {
    const entities: VisualEntity[] = [
      { id: "a1", name: "Alexander", kind: "character", role: "hero", species: "human", isHuman: true, appearance: "boy", forbidden: [], referenceUrl: "https://r/a.png" },
    ];
    const result = await generateStorybookImages({
      illustrations: { cover: { page: 0, scene: "cover", onStage: ["a1"], artifactVisible: false }, pages: [] },
      entities,
      seed: "s",
      buildReference: async () => { throw new Error("download 403"); },
      provider: async (request) => ({ url: request.referenceImages.length === 0 ? "https://img/cover.jpg" : undefined }),
    });
    expect(result.cover?.url).toBe("https://img/cover.jpg");
    expect(result.cover?.referenceLevel).toBe(1);
  });
});

describe("engine flow (scripted port)", () => {
  test("concept → plan → draft → review → revision → blind A/B; the chosen revision ships", async () => {
    const b = brief();
    const stages: string[] = [];
    const plan = planFor(b);
    const storyText = (tag: string) =>
      ["TITEL: Der Kobold im Mehl", "BESCHREIBUNG: Zwei Kinder jagen einen Kobold.", ...plan.pages.map((page) => `SEITE ${page.page}\nAlexander und Adrian sehen Kobold Kicher. „Mehl im Haar, Kobold da!“ ${tag} ${WORDS(100)}`)].join("\n\n");
    const llm: StorybookLlm = async (request: LlmRequest) => {
      stages.push(`${request.stage}:${request.role}:${request.model}`);
      const reply = (text: string) => ({ text, modelUsed: request.model, usage: { prompt: 100, completion: 50, total: 150, costUSD: 0.001 }, durationMs: 1 });
      switch (request.stage) {
        case "concept":
          return reply(JSON.stringify({ pitches: [{ engine: "gaunerfalle", title: "T", logline: "L", cast: [{ id: "pool-kicher", role: "Gauner" }], heroRoles: [{ heroId: "a1" }, { heroId: "a2" }] }] }));
        case "plan":
          return reply(JSON.stringify(plan));
        case "draft":
          return reply(storyText("ENTWURF"));
        case "review":
          return reply(JSON.stringify({ scores: { overall: 6.5 }, comprehension: { want: "a", problem: "b", solution: "c", ending: "d" }, mustFix: [{ page: 2, quote: "x", problem: "Witz ohne Aufbau", fix: "aufbauen" }] }));
        case "revision":
          return reply(storyText("FASSUNG2"));
        case "final-ab": {
          const revisionIsA = request.user.indexOf("FASSUNG2") < request.user.indexOf("ENTWURF");
          return reply(JSON.stringify({ winner: revisionIsA ? "A" : "B", reason: "lustiger", remainingProblems: [], winnerScore: 8.4 }));
        }
        default:
          throw new Error(`unexpected stage ${request.stage}`);
      }
    };
    const ledger = new CostLedger();
    const models = resolveStorybookModels({ aiProvider: "openrouter", openRouterModel: "openai/gpt-6-luna" } as any);
    const result = await runStorybookTextEngine({ llm, brief: b, models, ledger });

    expect(stages.map((stage) => stage.split(":")[0])).toEqual(["concept", "plan", "draft", "review", "revision", "final-ab"]);
    expect(stages.find((stage) => stage.startsWith("review"))).toContain("anthropic/");
    expect(result.chosen).toBe("revision");
    expect(result.pages[0].content).toContain("FASSUNG2");
    expect(result.benchmarkScore).toBe(8.4);
    expect(result.draftScore).toBe(6.5);
    expect(result.plan.cast.map((member) => member.id)).toEqual(["pool-kicher"]);
    expect(ledger.totals().calls).toBe(6);
  });
});

describe("image prompt budget", () => {
  test("a crowded page stays under Runware's limit and keeps every lock", () => {
    const long = "x".repeat(400);
    const entity = (id: string, isHuman: boolean): VisualEntity => ({ id, name: `Figur ${id}`, kind: "character", species: isHuman ? "human" : "dragon", isHuman, appearance: long, forbidden: [], referenceUrl: "https://r" });
    const onStage = [entity("1", true), entity("2", true), entity("3", false)];
    const prompt = assembleImagePrompt({ scene: "y".repeat(900), onStage, spriteOrder: onStage });
    expect(prompt.length).toBeLessThanOrEqual(2900);
    expect(prompt).toContain("five fingers");
    expect(prompt).toContain("technical identity sheet");
  });
});
