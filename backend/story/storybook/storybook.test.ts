/**
 * Storybook Pipeline (storybook-v2) — tests for everything that must work
 * without a model: routing, parsing, the fact gates, casting, illustration
 * locks, the image retry and the whole engine flow against a scripted port.
 */

// @ts-ignore Bun exposes this runtime-only test helper without Node typings.
import { describe, expect, test } from "bun:test";

import { normalizeAgeBand, rankEngines, resolveLengthBudget, STORY_ENGINES } from "./craft";
import { buildBrief, type StoryBrief } from "./context";
import { CostLedger, modelFamily, resolveStorybookModels, retryRequestFor, toOpenRouterModelId, type LlmRequest, type StorybookLlm } from "./llm";
import { acceptsTemperature, resolveStorybookReasoning } from "./llm-guards";
import { ensureParagraphs, normalizeGermanQuotes, parseDraft } from "./parsing";
import { checkPlan, checkProse, containsBlockedTerm, mentions, nameTokens } from "./checks";
import { selectRewardArtifacts, shortlistCastCandidates } from "./cast-selection";
import { sanitizePitches } from "./concept-stage";
import { sanitizePlan } from "./plan-stage";
import { comprehensionGaps, needsRevision, sanitizeReview } from "./review-stage";
import { assembleImagePrompt, castAppearance, heroAppearance, negativePromptFor, ownershipLine, sanitizeIllustrationPlan, signatureNegatives, speciesFromProfile, type VisualEntity } from "./illustration-stage";
import { correctionFor, generateStorybookImages, parseQaReport, qaSeverity } from "./images";
import { runStorybookTextEngine } from "./engine";
import { acceptablePatch, planFromOneShot } from "./oneshot-stage";
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
    after: "",
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
    obstacleMotive: "Kicher sammelt Türgriffe.",
    props: [{ thing: "die Glocke", start: "am Turm", firstPage: 1 }],
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

  test("the default critic is Gemini 3.8 Flash (Claude cost 72% of story 422a3ba3)", () => {
    const models = resolveStorybookModels({ aiProvider: "openrouter", openRouterModel: "openai/gpt-6-luna" } as any);
    expect(models.critic).toBe("google/gemini-3.8-flash");
    const claude = resolveStorybookModels({ aiProvider: "native", aiModel: "claude-sonnet-4-6" } as any);
    expect(claude.critic).toBe("google/gemini-3.8-flash");
  });

  test("Gemini 3.8 Flash has no 'minimal' effort: the blind A/B read asks for 'low' instead", () => {
    expect(resolveStorybookReasoning("google/gemini-3.8-flash", "none", "critic")).toEqual({ effort: "low", exclude: true });
    expect(resolveStorybookReasoning("google/gemini-3.8-flash", "medium", "critic")).toEqual({ effort: "medium", exclude: true });
    expect(resolveStorybookReasoning("google/gemini-3.1-flash-lite", "none")).toEqual({ effort: "minimal", exclude: true });
    expect(resolveStorybookReasoning("google/gemini-3.5-flash-lite", "none")).toEqual({ effort: "minimal", exclude: true });
  });

  test("a Gemini writer is never graded by a Gemini critic", () => {
    const models = resolveStorybookModels({ aiProvider: "native", aiModel: "gemini-3.1-pro-preview" } as any);
    expect(models.writer).toBe("google/gemini-3.1-pro-preview");
    expect(models.critic).toBe("openai/gpt-6-luna");
  });

  test("Claude remains selectable as critic by override", () => {
    const models = resolveStorybookModels({ aiProvider: "openrouter", openRouterModel: "openai/gpt-6-luna" } as any, { critic: "anthropic/claude-sonnet-5" });
    expect(models.critic).toBe("anthropic/claude-sonnet-5");
  });

  test("an override critic from the writer's own family is rejected", () => {
    const models = resolveStorybookModels({ aiProvider: "openrouter", openRouterModel: "openai/gpt-6-luna" } as any, { critic: "openai/gpt-6-luna-pro" });
    expect(modelFamily(models.critic)).toBe("google");
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

describe("retry policy", () => {
  const base: LlmRequest = { stage: "draft", role: "writer", model: "openai/gpt-6-luna", system: "", user: "", json: false, maxTokens: 1000, effort: "xhigh" };
  test("a deep-thinking timeout retries the same model at medium", () => {
    const retry = retryRequestFor(base, new Error("[storybook/llm] openai/gpt-6-luna timed out after 540s (draft)."));
    expect(retry.model).toBe("openai/gpt-6-luna");
    expect(retry.request.effort).toBe("medium");
  });
  test("other failures go once to the other family, truncation gets more room", () => {
    const retry = retryRequestFor(base, new Error("Truncated response from openai/gpt-6-luna (draft)"));
    expect(retry.model).not.toBe("openai/gpt-6-luna");
    expect(retry.request.maxTokens).toBe(1500);
    expect(retryRequestFor({ ...base, effort: "low" }, new Error("timed out")).model).not.toBe("openai/gpt-6-luna");
  });
});

describe("paragraphs and picture counts", () => {
  test("a one-block page gets paragraphs at speech, the same speaker stays together", () => {
    const page = "Das Papier flatterte zwischen Johanns Händen. Alexander griff danach, doch der Diener stellte sich quer auf die schmale Brücke. „Wir müssen Rosalinde die Karte bringen“, sagte Adrian. „Sie braucht den Weg.“ Drüben lief Rosalinde auf und ab, und Johann hielt das Blatt fest an seine gebügelte Livree, während der Wind am Tuch zerrte und das große Leinentuch über den alten Bohlen der Brücke knatterte.";
    const fixed = ensureParagraphs(page);
    expect(fixed).toContain("Brücke.\n\n„Wir müssen");
    expect(fixed).toContain("sagte Adrian. „Sie braucht");
    expect(fixed).toContain("Weg.“\n\nDrüben");
    expect(ensureParagraphs("Kurz. „Hallo.“ Ende.")).toBe("Kurz. „Hallo.“ Ende.");
  });
  test("character counts reveal duplicates the checker did not list", () => {
    const report = parseQaReport(JSON.stringify({ characterCounts: { Johann: 2, Alexander: 1, Adrian: 0 }, duplicates: [] }))!;
    expect(report.duplicates).toEqual(["Johann drawn 2 times"]);
    expect(report.namedCharactersVisible).toBe(2);
    expect(qaSeverity(report, 3)).toBeGreaterThanOrEqual(10);
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
    expect(prompt).toContain("ordinary human");
    expect(prompt).toContain("five-fingered hands");
    expect(prompt).toContain("left to right Alexander, Kobold Kicher");
    expect(prompt).toContain("Kobold Kicher (magical creature: small goblin, second on the identity sheet)");
    expect(prompt).toContain("Exactly 2 figures");
    // Negations belong in the negative prompt; FLUX draws what it reads.
    expect(prompt).not.toMatch(/\bno (beard|moustache|wings|tail|fur)\b/);
  });

  test("negatives ban animal features on humans and the painted sheet", () => {
    const negative = negativePromptFor([human, goblin], true);
    expect(negative).toContain("animal ears on a human");
    expect(negative).toContain("three hands");
    expect(negative).toContain("glasses");
    expect(negative.toLowerCase()).toContain("strip");
  });

  test("run 422a3ba3: a recurring magic thing gets one fixed look instead of becoming a cap", () => {
    const b = brief();
    const plan = planFor(b);
    const shots = sanitizeIllustrationPlan({
      storyElements: [{ name: "Wish hat", look: "a big red felt hat walking on two very long thin legs, no body, nobody wears it" }],
      cover: { scene: "cover", onStage: ["a1"], elements: ["Wish hat", "Unknown thing"] },
      pages: [{ page: 1, scene: "The wish hat runs off with the basket.", onStage: ["a1"], elements: ["Wish hat"] }],
    }, 1, plan, [human], 3);
    expect(shots.storyElements).toEqual([{ name: "Wish hat", look: "a big red felt hat walking on two very long thin legs, no body, nobody wears it" }]);
    expect(shots.cover.elements).toEqual(["Wish hat"]);
    const prompt = assembleImagePrompt({ scene: shots.pages[0].scene, onStage: [human], spriteOrder: [human], elements: shots.storyElements });
    // Story 774d5a5e: the image model sees the plain noun, never a title-like name.
    expect(prompt).toContain("The wish hat, drawn exactly like this: a big red felt hat walking on two very long thin legs");
  });

  test("appearance lines come from structured profiles and English pool prompts", () => {
    expect(heroAppearance({ hair: { color: "brown", length: "short" }, eyes: { color: "green" } })).toContain("brown short hair");
    expect(castAppearance(KOBOLD.visualProfile)).toContain("goblin");
    expect(castAppearance({ description: "Kleiner Kobold mit Hut" })).toBe("Kleiner Kobold mit Hut");
  });

  test("crowded or incomplete direction is flagged before drawing, without dropping identities", () => {
    const b = brief();
    const plan = planFor(b);
    const entities: VisualEntity[] = [human, goblin, { ...human, id: "a2", name: "Adrian" }, { ...goblin, id: "x", name: "X" }];
    const shots = sanitizeIllustrationPlan({ cover: { scene: "cover", onStage: ["a1", "a2", "pool-kicher", "x"] }, pages: [{ page: 1, scene: "one", onStage: ["a1", "nobody"] }] }, 3, plan, entities, 3);
    expect(shots.cover.onStage).toEqual(["a1", "a2", "pool-kicher", "x"]);
    expect(shots.cover.planningErrors?.length).toBeGreaterThan(0);
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
        text: JSON.stringify({ characterCounts: request.stage.includes("cover") ? { Alexander: 1, Kicher: 1 } : { Alexander: 1 }, anatomyDefects: defective ? ["three hands"] : [], animalFeaturesOnHumans: [], duplicates: [], unexpectedCharacters: [], identityMatch: 0.9, sceneMatch: 0.9 }),
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
        const attempt = request.prompt.includes("one separate, complete body") ? 2 : 1;
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
    const clean = { anatomyDefects: [], animalFeaturesOnHumans: [], duplicates: [], unexpectedCharacters: [], roleSwaps: [], elementMisuse: [], textVisible: false, referenceSheetVisible: false, identityMatch: 0.9, sceneMatch: 0.9, namedCharactersVisible: 2 };
    expect(qaSeverity(clean, 2)).toBe(0);
    expect(qaSeverity({ ...clean, namedCharactersVisible: 1 }, 2)).toBeLessThan(10);
    expect(qaSeverity({ ...clean, animalFeaturesOnHumans: ["fox ears"] }, 2)).toBeGreaterThanOrEqual(10);
    // The page's key action must belong to the right child.
    expect(qaSeverity({ ...clean, roleSwaps: ["Alexander climbs instead of Adrian"] }, 2)).toBeGreaterThanOrEqual(10);
    expect(qaSeverity({ ...clean, elementMisuse: ["the wish hat is worn as a cap"] } as any, 2)).toBeGreaterThanOrEqual(10);
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
  test("concept → plan → plan review → repair → draft → review → revision → blind A/B; the chosen revision ships", async () => {
    const b = { ...brief(), experiment: { legacy: true } };
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
        case "plan-review":
          return reply(JSON.stringify({ verdict: "fix", problems: ["Seite 6: Die Falle ist nicht vorstellbar → einfacher machen"] }));
        case "plan-repair":
          // The repair sees its previous plan and the critic's problem.
          expect(request.user).toContain("DEIN LETZTER PLAN (behalte");
          expect(request.user).toContain("Die Falle ist nicht vorstellbar");
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

    expect(stages.map((stage) => stage.split(":")[0])).toEqual(["concept", "plan", "plan-review", "plan-repair", "draft", "review", "revision", "final-ab"]);
    expect(stages.find((stage) => stage.startsWith("plan-review"))).toContain("google/");
    expect(stages.find((stage) => stage.startsWith("review"))).toContain("google/");
    expect(result.chosen).toBe("revision");
    expect(result.pages[0].content).toContain("FASSUNG2");
    expect(result.benchmarkScore).toBe(8.4);
    expect(result.draftScore).toBe(6.5);
    expect(result.plan.cast.map((member) => member.id)).toEqual(["pool-kicher"]);
    expect(ledger.totals().calls).toBe(8);
  });
});

describe("engine flow (one shot, the standard)", () => {
  test("Sol invents and writes in one call, the other family reads, Luna patches only the flagged page; cast and checks survive", async () => {
    const b = brief();
    const stages: string[] = [];
    const page = (n: number, tag: string) => `SEITE ${n}\nAlexander und Adrian laufen los. ${n === 3 ? "Kobold Kicher niest. " : ""}${tag} ${WORDS(100)}`;
    const story = ["BAUPLAN: gaunerfalle", "BESETZUNG: pool-kicher", "FUNDSTÜCK: keins", "REFRAIN: Mehl im Haar, Kobold da!", "TITEL: Alexander und der Kobold", "BESCHREIBUNG: Zwei Kinder jagen einen Kobold.", ...Array.from({ length: b.budget.pages }, (_, i) => page(i + 1, "ALT"))].join("\n\n");
    const llm: StorybookLlm = async (request: LlmRequest) => {
      stages.push(`${request.stage}:${request.model}`);
      const reply = (text: string) => ({ text, modelUsed: request.model, usage: { prompt: 100, completion: 50, total: 150, costUSD: 0.001 }, durationMs: 1 });
      if (request.stage === "oneshot") return reply(story);
      if (request.stage === "review") return reply(JSON.stringify({ scores: { overall: 7 }, comprehension: { want: "a", problem: "b", solution: "c", ending: "d" }, mustFix: [{ page: 2, quote: "x", problem: "Wer hat den Sack?", fix: "klären" }] }));
      if (request.stage === "patch") return reply(page(2, "NEU"));
      if (request.stage === "patch-check") return reply(JSON.stringify({ checks: [{ id: 0, resolved: true }], newProblems: [] }));
      throw new Error(`unexpected stage ${request.stage}`);
    };
    const ledger = new CostLedger();
    const models = resolveStorybookModels({ aiProvider: "openrouter", openRouterModel: "openai/gpt-6-sol" } as any);
    const result = await runStorybookTextEngine({ llm, brief: b, models, ledger });

    expect(stages.map((stage) => stage.split(":")[0])).toEqual(["oneshot", "review", "patch", "patch-check"]);
    expect(stages[0]).toContain("gpt-6-sol");
    // Story 774d5a5e: Luna, Sol's own family, missed every plan-level defect.
    expect(stages[1]).toContain("google/gemini");
    expect(stages[2]).toContain("gpt-6-luna");
    expect(result.pages[1].content).toContain("NEU");
    expect(result.pages[0].content).toContain("ALT");
    expect(result.plan.cast.map((member) => member.id)).toEqual(["pool-kicher"]);
    expect(result.plan.refrain).toBe("Mehl im Haar, Kobold da!");
    expect(result.chosen).toBe("revision");
    expect(result.textQuality?.status).toBe("passed");
    expect(result.benchmarkScore).toBeNull();
  });
});

describe("image prompt budget", () => {
  test("a crowded page stays under Runware's limit and keeps every lock", () => {
    const long = "x".repeat(400);
    const entity = (id: string, isHuman: boolean): VisualEntity => ({ id, name: `Figur ${id}`, kind: "character", species: isHuman ? "human" : "dragon", isHuman, appearance: long, forbidden: [], referenceUrl: "https://r" });
    const onStage = [entity("1", true), entity("2", true), entity("3", false)];
    const prompt = assembleImagePrompt({ scene: "y".repeat(900), onStage, spriteOrder: onStage });
    expect(prompt.length).toBeLessThanOrEqual(1900);
    expect(prompt).toContain("five-fingered hands");
    expect(prompt).toContain("identity sheet");
  });
});

describe("story 2db50859 fixes", () => {
  test("a missing hero and a stranger in the scene are redraws; a story element is counted", () => {
    const missing = parseQaReport(JSON.stringify({ characterCounts: { Alexander: 1, Adrian: 0 } }))!;
    expect(missing.missing).toEqual(["Adrian"]);
    expect(qaSeverity(missing, 2, ["Alexander", "Adrian"])).toBeGreaterThanOrEqual(10);
    // Every figure selected for this image is required; off-panel figures are excluded in direction.
    expect(qaSeverity(missing, 2, ["Alexander"])).toBeGreaterThanOrEqual(10);
    const goose = parseQaReport(JSON.stringify({ characterCounts: { Alexander: 1, Gans: 2 } }))!;
    expect(qaSeverity(goose, 1)).toBeGreaterThanOrEqual(10);
    const stranger = parseQaReport(JSON.stringify({ characterCounts: { Elsa: 1 }, unexpectedCharacters: ["a second blonde girl in a maid's dress"] }))!;
    expect(qaSeverity(stranger, 1)).toBeGreaterThanOrEqual(10);
  });

  test("the cover always carries every hero", () => {
    const heroes: VisualEntity[] = ["h1", "h2"].map((id) => ({ id, name: id, kind: "character", role: "hero", species: "human", isHuman: true, appearance: "", forbidden: [] }));
    const cast: VisualEntity = { id: "c1", name: "Elsa", kind: "character", role: "cast", species: "human", isHuman: true, appearance: "", forbidden: [] };
    const plan = { title: "T", logline: "L", heroes: [], pages: [] } as any;
    const shots = sanitizeIllustrationPlan({ cover: { scene: "Elsa and Alexander at the fountain", onStage: ["h1", "c1"] }, pages: [] }, 0, plan, [...heroes, cast], 3);
    expect(shots.cover.onStage).toEqual(["h1", "h2", "c1"]);
  });

  test("a patch is a touch-up, not a rewrite", () => {
    const page = "Die Gans hob einen Fuß. Alexander streckte die Hand aus. Sofort setzte sie ihn wieder hin. Adrian hielt sein rotes Band hoch. Die Gans drehte den Kopf.";
    expect(acceptablePatch(page, `${page} Bo nickte.`)).toBe(true);
    expect(acceptablePatch(page, "Ganz etwas anderes passiert hier jetzt auf dieser Seite, und niemand erinnert sich an das Band oder die Gans, denn alle gehen nach Hause.")).toBe(false);
    expect(acceptablePatch(page, `${page} ${"Und dann passierte noch sehr viel mehr auf dieser Seite. ".repeat(4)}`)).toBe(false);
  });
});

describe("feature bleed (runs fix-0929-a/b)", () => {
  const mina: VisualEntity = { id: "m", name: "Mina", kind: "character", role: "hero", species: "human", isHuman: true, appearance: "girl with curly hair, orange top", forbidden: [], referenceUrl: "https://r/m.png" };
  const fauchi: VisualEntity = { id: "f", name: "Drache Fauchi", kind: "character", role: "cast", species: "dragon", isHuman: false, appearance: "small green dragon with orange wings and a long tail", forbidden: [], referenceUrl: "https://r/f.png" };
  const griselda: VisualEntity = { id: "g", name: "Hexe Griselda", kind: "character", role: "cast", species: "human", isHuman: true, appearance: "old witch with a pointed black witch hat and black cloak", forbidden: [], referenceUrl: "https://r/g.png" };

  test("the other figures' signature features are forbidden on the children", () => {
    const negatives = signatureNegatives([mina, fauchi, griselda]);
    expect(negatives).toContain("child with wings");
    expect(negatives).toContain("child with a tail");
    expect(negatives).toContain("child with a witch hat");
    expect(negativePromptFor([mina, fauchi], true)).toContain("child with wings");
    expect(signatureNegatives([griselda])).toEqual([]);
  });

  test("after wings on a child, the redraw keeps only the heroes on the sheet", async () => {
    const sheets: string[][] = [];
    let calls = 0;
    const llm: StorybookLlm = async (request) => ({
      text: JSON.stringify({ characterCounts: request.stage.includes("cover") ? { Mina: 1 } : { Mina: 1, "Drache Fauchi": 1 }, anatomyDefects: [], duplicates: [], unexpectedCharacters: [], animalFeaturesOnHumans: request.stage === "image-qa-p1-1" ? ["Mina has dragon wings"] : [], identityMatch: 0.9, sceneMatch: 0.9 }),
      modelUsed: request.model,
      usage: { prompt: 10, completion: 10, total: 20, costUSD: 0.0001 },
      durationMs: 1,
    });
    const result = await generateStorybookImages({
      illustrations: { cover: { page: 0, scene: "cover", onStage: ["m"], artifactVisible: false }, pages: [{ page: 1, scene: "p1", onStage: ["m", "f"], artifactVisible: false }] },
      entities: [mina, fauchi],
      seed: "s",
      llm,
      visionModel: "openai/gpt-6-luna",
      buildReference: async (slots) => {
        sheets.push(slots.map((slot) => slot.displayName));
        return { urls: ["data:image/png;base64,AAA"], mode: slots.length > 1 ? "sprite" : "single", subjects: [] };
      },
      provider: async (request) => {
        calls += 1;
        return { url: `https://img/${request.page}-${calls}.jpg`, costUSD: 0.0006 };
      },
    });
    expect(sheets).toContainEqual(["Mina", "Drache Fauchi"]);
    // The cover (Mina alone) builds the single sheet once; the redraw of page 1 builds it again from the human-only ladder.
    expect(sheets.filter((sheet) => sheet.join() === "Mina").length).toBe(2);
    expect(result.regenerated).toEqual([1]);
    expect(result.pages.get(1)?.attempts).toBe(2);
    expect(result.pages.get(1)?.severity).toBe(0);
  });
});

describe("crowding (runs fix2-0929, story 31a7a59d)", () => {
  test("figure elements are marked; ids the scene names are never dropped (a figure in the text without its reference is worse)", () => {
    const e = (id: string, role: "hero" | "cast"): VisualEntity => ({ id, name: id, kind: "character", role, species: "human", isHuman: true, appearance: "", forbidden: [] });
    const plan = { title: "T", logline: "L", heroes: [], pages: [] } as any;
    const shots = sanitizeIllustrationPlan({
      storyElements: [{ name: "Troll", look: "grey-green troll in a brown tunic", figure: true }, { name: "red yarn", look: "a red strand of wool" }],
      cover: { scene: "c", onStage: ["h1"] },
      pages: [
        { page: 1, scene: "p1", onStage: ["h1", "h2", "c1"], elements: ["Troll", "red yarn"] },
        { page: 2, scene: "p2", onStage: ["h1", "h2", "c1"], elements: ["red yarn"] },
      ],
    }, 2, plan, [e("h1", "hero"), e("h2", "hero"), e("c1", "cast")], 3);
    expect(shots.storyElements?.[0]?.figure).toBe(true);
    expect(shots.pages[0].onStage).toEqual(["h1", "h2", "c1"]);
    expect(shots.pages[1].onStage).toEqual(["h1", "h2", "c1"]);
  });
});

describe("story 31a7a59d: compact, positive image prompts", () => {
  const adrian: VisualEntity = { id: "a2", name: "Adrian", kind: "character", role: "hero", species: "human", isHuman: true, appearance: "boy with short blond hair, grey t-shirt, blue jeans", forbidden: [], referenceUrl: "https://r/a2.png" };
  const theo: VisualEntity = { id: "t", name: "Theo Zeitsam", kind: "character", role: "cast", species: "tortoise", isHuman: false, appearance: "elderly land tortoise, golden-brown shell, red satchel, brass pocket watch", forbidden: [], referenceUrl: "https://r/t.png" };

  test("a redraw correction never quotes the defect", () => {
    const qa = parseQaReport(JSON.stringify({ characterCounts: { Adrian: 1, "Theo Zeitsam": 1 }, featureBleed: ["Theo has the troll's shaggy orange beard"], roleSwaps: ["the boy holds the mud instead of Theo"], elementMisuse: ["Troll is missing entirely"] }))!;
    const correction = correctionFor(qa, ["Troll"]);
    expect(correction).not.toContain("beard");
    expect(correction).not.toContain("mud");
    expect(correction).toContain("Troll shown as its own separate figure");
    const prompt = assembleImagePrompt({ scene: "Adrian and Theo look at the water.", onStage: [adrian, theo], spriteOrder: [adrian, theo], correction });
    expect(prompt.indexOf("identity sheet; the children")).toBeLessThan(prompt.indexOf("Exactly 2 figures"));
    expect(prompt.length).toBeLessThanOrEqual(1900);
  });

  test("the tortoise's shell is forbidden on the children; pool boilerplate is stripped", () => {
    expect(signatureNegatives([adrian, theo])).toContain("child with a shell");
    const elsa: VisualEntity = { id: "e", name: "Magd Elsa", kind: "character", role: "cast", species: "human", isHuman: true, appearance: "young maid, brown hair in a bun, white headband, grey dress, white apron", forbidden: [], referenceUrl: "https://r/e.png" };
    const griselda: VisualEntity = { id: "g", name: "Hexe Griselda", kind: "character", role: "cast", species: "human", isHuman: true, appearance: "old witch, pointed black witch hat, black robe", forbidden: [], referenceUrl: "https://r/g.png" };
    // Run fix6-0929: Elsa's apron and a felt hat landed on Amir.
    expect(signatureNegatives([adrian, elsa, griselda])).toEqual(expect.arrayContaining(["child with an apron", "child with a headband", "child with a witch hat", "child with a hat"]));
    expect(castAppearance({ imagePrompt: "Portrait of Theo Zeitsam, old tortoise with amber shell, red satchel and stopped pocket watch, European storybook illustration, no text." })).toBe("Theo Zeitsam, old tortoise with amber shell, red satchel and stopped pocket watch");
  });

  test("blocked terms: whole words, and 'ich glaube' is not religion", () => {
    expect(containsBlockedTerm("Ich glaube, das ist ein Däumchen.", ["glaube"])).toBeNull();
    expect(containsBlockedTerm("Sie sprachen über den Glauben der Leute.", ["glaube"])).toBe("glaube");
    expect(containsBlockedTerm("Die Mutter lachte.", ["mut"])).toBeNull();
    expect(containsBlockedTerm("Das braucht Mut.", ["mut"])).toBe("mut");
  });
});

describe("species (A/B 2026-09-29)", () => {
  test("'human child astronomer' is a human; a dragon stays a dragon", () => {
    expect(speciesFromProfile({ characterType: "human child astronomer" }).isHuman).toBe(true);
    expect(speciesFromProfile({ characterType: "human child" })).toEqual({ species: "human", isHuman: true });
    expect(speciesFromProfile({ characterType: "dragon small" }).isHuman).toBe(false);
    expect(speciesFromProfile({ characterType: "fox child" }).isHuman).toBe(false);
    expect(speciesFromProfile(undefined, "human").isHuman).toBe(true);
  });

  test("the ownership line keeps a creature's wings and tail on it; clothing is never named", () => {
    const hero: VisualEntity = { id: "h", name: "Mia", kind: "character", role: "hero", species: "human", isHuman: true, appearance: "blue denim overalls, brown pigtails", forbidden: [] };
    const dragon: VisualEntity = { id: "d", name: "Drache Fauchi", kind: "character", role: "cast", species: "dragon", isHuman: false, appearance: "small green dragon with orange wings and a long tail", forbidden: [] };
    const witch: VisualEntity = { id: "w", name: "Hexe Griselda", kind: "character", role: "cast", species: "human", isHuman: true, appearance: "a pointed black witch hat, long gray hair, black robe", forbidden: [] };
    expect(ownershipLine([hero, dragon, witch])).toBe("Only Drache Fauchi has wings and a tail.");
    expect(ownershipLine([hero, witch])).toBe("");
    const prompt = assembleImagePrompt({ scene: "Mia meets Fauchi and Griselda.", onStage: [hero, dragon, witch], spriteOrder: [hero, dragon, witch] });
    expect(prompt).toContain("Only Drache Fauchi has wings");
    expect(prompt.length).toBeLessThanOrEqual(1900);
  });
});

describe("one-shot cast detection (run intro-0929-2)", () => {
  test("two candidates named Wilhelm: only the one the text names in full is cast", () => {
    const baker: CastCandidate = { ...KOBOLD, id: "baker", name: "Bäcker Wilhelm", whoTheyAre: "Bäcker" };
    const king: CastCandidate = { ...KOBOLD, id: "king", name: "König Wilhelm", whoTheyAre: "König" };
    const b = brief({ candidates: [baker, king] });
    const pages = Array.from({ length: b.budget.pages }, (_, index) => ({ order: index + 1, title: "", content: index === 0 ? "Bäcker Wilhelm schnupperte am Kuchen. Wilhelm lachte." : "Die Jungen liefen weiter." }));
    const plan = planFromOneShot("BAUPLAN: frei\nBESETZUNG: \nFUNDSTÜCK: keins\nREFRAIN: keiner", b, { title: "T", description: "D", pages });
    expect(plan.cast.map((member) => member.id)).toEqual(["baker"]);
  });
});
