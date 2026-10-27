// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { buildBrief } from "../storybook/context";
import { CostLedger, type LlmRequest } from "../storybook/llm";
import type { CastCandidate } from "../storybook/types";
import { childSituationChoices, episodeBudget, episodeProductionLlm, episodeProductionModels, placeChoices, SAMPLE_NAMES, styleSamples, takenNames } from "./craft";
import { ambiguousPronouns, COUNTING_TITLE, normalizePlan, planFromHeader, tidyParagraphs, readOneShot, readStory, renameTakenNames, resolveEpisodeServiceTier, runEpisodeTextEngine, storyChecks, toStoryPlan } from "./engine";
import { storyHighlights } from "./pictures";
import { oneShotSystemPrompt, oneShotUserPrompt, planSystemPrompt, planUserPrompt, writerSystemPrompt, writerUserPrompt } from "./prompts";
import { episodePoolLead } from "./cast-focus";
import { shortlistCastCandidates } from "../storybook/cast-selection";

const fox: CastCandidate = {
  id: "pool-fox", name: "Bo Bücherfuchs", species: "animal", whoTheyAre: "Fuchs mit Brille und Büchertasche",
  personality: ["wissend"], speechStyle: ["bedacht"], quirk: "ordnet Lesezeichen", catchphrase: "Eine gute Frage braucht kein Lesezeichen.",
};

function brief(overrides: Record<string, unknown> = {}) {
  return buildBrief({
    config: { avatarIds: ["hero-a", "hero-b"], genre: "magic", ageGroup: "6-8", length: "medium", language: "de", humorLevel: 2, ...overrides } as any,
    band: "6-8",
    budget: episodeBudget("medium", "6-8"),
    heroes: [
      { id: "hero-a", name: "Alexander", age: 8, description: "Merkt sich jeden Weg." },
      { id: "hero-b", name: "Adrian", age: 7, description: "Tanzt am liebsten." },
    ],
    candidates: [fox],
    artifacts: [],
    seed: "test-seed",
  });
}

function rawPlan(chapters = 3): any {
  return {
    ideas: ["eins", "zwei", "drei"], chosen: 1, title: "Die Kiste hat Beine", summary: "Eine Kiste läuft davon. Das ist sehr unpraktisch.",
    focusHero: "hero-a", childSituation: "Alexander wartet auf etwas Großes.",
    wonder: { rule: "Wer die Kiste allein hebt, gibt ihr Beine.", who: "Kuno, eine schläfrige Kiste", firstEffect: "Ein Beinpaar wächst.", escalation: ["Zwei Paare", "Sie tanzt"], endsWhen: "Zwei tragen sie gemeinsam." },
    heroes: [{ id: "hero-a", name: "Alexander", voice: "knapp", contribution: "findet den Weg" }, { id: "hero-b", name: "Adrian", voice: "fröhlich", contribution: "gibt den Takt" }],
    cast: [
      { id: "pool-fox", name: "Bo Bücherfuchs", from: "pool", role: "companion", species: "animal", voice: "bedacht", wants: "Ordnung", comicPattern: "Lesezeichen" },
      { id: "kuno", name: "Kuno", from: "new", role: "wonder", species: "thing", voice: "gähnt", wants: "Ruhe", comicPattern: "schläft im Laufen", lookEn: "a sleepy wooden crate with yellow handles" },
    ],
    runningGags: [{ gag: "Kuno gähnt", beats: ["eins", "zwei", "drei"] }],
    attempts: ["Festbinden → sie hüpft"], nearDiscovery: "Die Wartin hört Getrappel.", quietMoment: "Bo gibt zu, dass er Angst vor Treppen hat.",
    courage: "Alexander bittet Adrian vor allen.", solution: "Zu zweit getragen hat Kuno keine Beine mehr.",
    setups: [{ what: "Griffbild mit zwei Trägern", planted: 1, paysOff: 3 }],
    chapters: Array.from({ length: chapters }, (_, index) => ({ title: `Kapitel ${index + 1}`, beats: ["a", "b", "c", "d"], laughs: ["Witz eins", "Witz zwei"], ending: "Haken" })),
    schoolyardLine: "Die Kiste hat Beine!", finalLaugh: "Kuno gähnt ein letztes Mal.", artifact: null, learningCore: null,
  };
}

function story(words = 560, extra = ""): string {
  const filler = (n: number) => Array.from({ length: n }, (_, index) => `Wort${index}`).join(" ");
  return [
    "TITEL: Die Kiste hat Beine",
    "BESCHREIBUNG: Eine Kiste läuft davon.",
    "",
    "KAPITEL 1: Fracht mit Füßen",
    `Bo Bücherfuchs lacht. ${filler(words)} ${extra}`,
    "",
    "KAPITEL 2: Noch mehr Beine",
    `„Halt!“, rief Adrian. ${filler(words)}`,
    "",
    "KAPITEL 3: Zu zweit",
    `Alexander nickte. ${filler(words)}`,
  ].join("\n");
}

describe("Talea-Folge craft", () => {
  test("three chapters of 500–700 words for a medium story at 6–8", () => {
    const budget = episodeBudget("medium", "6-8");
    expect(budget.pages).toBe(3);
    expect(budget.totalWordsMin).toBe(1800);
    expect(episodeBudget("short", "3-5").totalWordsMax).toBeLessThan(budget.totalWordsMin);
  });

  test("child situations and places are drawn per seed, distinct and stable", () => {
    expect(childSituationChoices("a")).toEqual(childSituationChoices("a"));
    expect(new Set(childSituationChoices("a")).size).toBe(4);
    expect(childSituationChoices("a")).not.toEqual(childSituationChoices("b"));
    expect(placeChoices("scifi", "a").length).toBe(3);
    expect(placeChoices("unknown-genre", "a").length).toBe(3);
  });

  test("the writer learns from two Originals chapters and may copy nothing", () => {
    expect(styleSamples().length).toBe(2);
    const system = writerSystemPrompt(brief());
    expect(system).toContain("Copy NOTHING");
    expect(system).toContain(styleSamples()[0].text.slice(0, 80));
  });

  test("the planner gets today's choices, the method and the taken names", () => {
    const b = brief();
    const user = planUserPrompt(b);
    expect(user).toContain("TODAY'S CHILD SITUATIONS");
    expect(user).toContain("TODAY'S PLACES");
    expect(user).toContain("pool-fox");
    expect(user).toContain(SAMPLE_NAMES[0]);
    expect(planSystemPrompt(b)).toContain("Never invent parents");
  });

  test("the one-shot system prompt is the same for every family of a band, so the provider can cache it", () => {
    const other = { ...brief(), heroes: [{ id: "hero-x", name: "Ella", age: 6 }] as any, candidates: [], seed: "other" };
    const cacheable = (text: string) => text.slice(0, text.indexOf("TITEL:"));
    expect(cacheable(oneShotSystemPrompt(other))).toBe(cacheable(oneShotSystemPrompt(brief())));
    // Rules, style reference and method — about 5,000 tokens — come before the first family-specific line.
    expect(oneShotSystemPrompt(brief()).indexOf("TITEL:")).toBeGreaterThan(15000);
  });

  test("the writer runs on flex unless switched off", () => {
    expect(resolveEpisodeServiceTier(undefined)).toBe("flex");
    expect(resolveEpisodeServiceTier("off")).toBeUndefined();
  });
});

describe("Talea-Folge plan", () => {
  test("a companion choice gives the eligible pool figure the goal and avatars decisive contributions", () => {
    const b = brief({ avatarIsHero: false });
    b.candidates = [{ ...fox, canLead: true }];
    expect(episodePoolLead(b)?.id).toBe(fox.id);
    for (const prompt of [planUserPrompt(b), oneShotUserPrompt(b), writerUserPrompt(b, normalizePlan(rawPlan(), b).plan)]) {
      expect(prompt).toContain("Bo Bücherfuchs [pool-fox] is this story's leading figure");
      expect(prompt).toContain("each with an indispensable idea or deed");
      expect(prompt).not.toContain("THE HEROES (they are the main characters");
    }
  });

  test("explicit avatar leadership and a pool with only support figures keep avatars in front", () => {
    const b = brief({ avatarIsHero: true });
    b.candidates = [{ ...fox, canLead: true }];
    expect(episodePoolLead(b)).toBeUndefined();
    b.config.avatarIsHero = false;
    b.candidates[0].canLead = false;
    expect(episodePoolLead(b)).toBeUndefined();
    expect(oneShotUserPrompt(b)).toContain("the family's avatars are the main characters");
  });

  test("the leading figure's supplied want anchors the plot rather than a generic child situation", () => {
    const b = brief({ avatarIsHero: false });
    b.candidates = [{ ...fox, canLead: true, want: "Das letzte unbeschriftete Regal seiner Bibliothek füllen." }];
    for (const prompt of [oneShotUserPrompt(b), planUserPrompt(b), writerUserPrompt(b, normalizePlan(rawPlan(), b).plan)]) {
      expect(prompt).toContain("THE STORY ENGINE IS THIS FIGURE'S SUPPLIED WANT");
      expect(prompt).toContain(b.candidates[0].want!);
      expect(prompt).toContain("they do not replace it with an unrelated lesson");
    }
    b.config.avatarIsHero = true;
    expect(oneShotUserPrompt(b)).not.toContain("THE STORY ENGINE IS THIS FIGURE'S SUPPLIED WANT");
  });

  test("the selected leading figure cannot disappear from the plan or story", () => {
    const b = brief({ avatarIsHero: false });
    b.candidates = [{ ...fox, canLead: true }];
    const missing = rawPlan();
    missing.cast = missing.cast.filter((member: any) => member.id !== fox.id);
    const { plan, problems } = normalizePlan(missing, b);
    expect(problems.some(problem => problem.includes("leading figure"))).toBe(true);
    expect(storyChecks(readStory(story(560).replaceAll("Bo Bücherfuchs", "Niemand")).chapters, plan, b).hard.some(problem => problem.includes("leading pool figure"))).toBe(true);
  });

  test("a German spelling or genitive of the leading figure is recognised", () => {
    const b = brief({ avatarIsHero: false });
    b.candidates = [{ ...fox, name: "Der Geraeusche-Fresser", canLead: true }];
    const raw = rawPlan();
    raw.cast[0].name = "Der Geraeusche-Fresser";
    const { plan } = normalizePlan(raw, b);
    const chapters = readStory(story(560).replaceAll("Bo Bücherfuchs", "Des Geräusche-Fressers Sack")).chapters;
    expect(storyChecks(chapters, plan, b).hard.filter(problem => problem.includes("leading pool figure"))).toEqual([]);
  });

  test("companion casting keeps a leading candidate even below high-scoring support candidates", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: `support-${i}`, name: `Helfer ${i}`, role: "helper", image_url: "https://example.test/helper.webp", canon_settings: ["forest"], catchphrase: "Hallo", quirk: "winkt", can_lead: false }));
    const lead = { id: "lead", name: "Wunderwesen", role: "companion", can_lead: true, image_url: "", canon_settings: [] };
    const picks = shortlistCastCandidates({ rows: [...rows, lead], band: "6-8", setting: "forest", excludeNames: new Set(), seed: "roles", limit: 2, preferLead: true });
    expect(picks).toHaveLength(2);
    expect(picks.some(candidate => candidate.id === lead.id && candidate.canLead)).toBe(true);
  });

  test("a complete plan has no problems", () => {
    const { plan, problems } = normalizePlan(rawPlan(), brief());
    expect(problems).toEqual([]);
    expect(plan.cast.map((member) => member.from)).toEqual(["pool", "new"]);
    expect(plan.chapters[0].laugh).toContain("Witz zwei");
  });

  test("structural defects are named for the repair", () => {
    const raw = rawPlan(2);
    raw.cast[0].id = "pool-unknown";
    raw.cast[0].name = "Unbekannt";
    delete raw.cast[1].lookEn;
    const { problems } = normalizePlan(raw, brief());
    expect(problems.some((problem) => problem.includes("exactly 3 chapters"))).toBe(true);
    expect(problems.some((problem) => problem.includes("not in the character pool"))).toBe(true);
    expect(problems.some((problem) => problem.includes("lookEn"))).toBe(true);
  });

  test("a brought artifact is always in the plan", () => {
    const b = brief();
    b.artifacts = [{ id: "art-1", name: "Abenteuerkompass", rule: "zeigt eine Richtung", broughtBy: "hero-a" } as any];
    const { plan, problems } = normalizePlan(rawPlan(), b);
    expect(plan.artifact?.id).toBe("art-1");
    expect(problems.some((problem) => problem.includes("brought artifact"))).toBe(true);
  });
});

describe("Talea-Folge story checks", () => {
  test("reads title, description and chapters", () => {
    const parsed = readStory(story(20));
    expect(parsed.title).toBe("Die Kiste hat Beine");
    expect(parsed.description).toBe("Eine Kiste läuft davon.");
    expect(parsed.chapters.map((chapter) => chapter.title)).toEqual(["Fracht mit Füßen", "Noch mehr Beine", "Zu zweit"]);
  });

  test("copied sample names, blocked terms and a thin story are hard defects", () => {
    const b = { ...brief(), blockedTerms: ["Gespenst"] };
    const { plan } = normalizePlan(rawPlan(), b);
    expect(storyChecks(readStory(story(560)).chapters, plan, b).hard).toEqual([]);
    const copied = storyChecks(readStory(story(560, "Bruno blubberte.")).chapters, plan, b).hard;
    expect(copied.some((issue) => issue.includes("„Bruno“"))).toBe(true);
    expect(storyChecks(readStory(story(560, "Ein Gespenst!")).chapters, plan, b).hard.some((issue) => issue.includes("Gespenst"))).toBe(true);
    expect(storyChecks(readStory(story(100)).chapters, plan, b).hard.some((issue) => issue.includes("words"))).toBe(true);
  });

  // Story 0ee9af53 paid a full revision for „Süßer Saft lief über seine Finger“.
  test("Oma's pet names count as a copy only as an address", () => {
    const b = brief();
    const { plan } = normalizePlan(rawPlan(), b);
    const hard = (extra: string) => storyChecks(readStory(story(560, extra)).chapters, plan, b).hard.filter((issue) => issue.includes("Süß"));
    expect(hard("Süßer Saft lief über seine Finger. Die Süße der Birne blieb.")).toEqual([]);
    expect(hard("„Stiefel an, Süßer!“")).toHaveLength(1);
    expect(hard("„Süße“, sagte sie.")).toHaveLength(1);
    expect(hard("„Falscher Alarm, Süßer“, sagte Oma.")).toHaveLength(1);
  });
});

const MODELS = { writer: "openai/gpt-6.1-sol", support: "openai/gpt-6-luna", critic: "google/gemini-3.8-flash" };
const answer = (request: LlmRequest, text: string) => ({ text, modelUsed: request.model, usage: { prompt: 10, completion: 10, total: 20, costUSD: 0.001 }, durationMs: 1 });

function oneShotText(words = 560, extra = ""): string {
  return [
    "IDEE: Alexander wartet auf den großen Umzug, eine Kiste bekommt Beine.",
    "REGEL: Wer die Kiste allein hebt, gibt ihr ein neues Beinpaar.",
    "FIGUR: Bo Bücherfuchs | pool | pool-fox | companion",
    "FIGUR: Kuno | neu | wonder | thing | a sleepy wooden crate with yellow handles",
    "FUNDSTÜCK: keins",
    story(words, `Kuno gähnte. ${extra}`),
  ].join("\n");
}

describe("Talea-Folge engine, two-step", () => {
  test("the episode wrapper applies flex and preserves the model for all role retries", async () => {
    const calls: LlmRequest[] = [];
    const llm = episodeProductionLlm(async (request) => { calls.push(request); return answer(request, "ok"); }, "flex");
    for (const [stage, model, role] of [["episode-write", "openai/gpt-6.1-sol", "writer"], ["episode-editorial-review", "openai/gpt-6.1-terra", "critic"], ["illustration-direction", "openai/gpt-6.1-terra", "support"]] as const) {
      await llm({ stage, model, role, system: "", user: "", json: false, maxTokens: 20 });
    }
    expect(calls.map((call) => [call.serviceTier, call.fallbackModel])).toEqual([["flex", "openai/gpt-6.1-sol"], ["flex", "openai/gpt-6.1-terra"], ["flex", "openai/gpt-6.1-terra"]]);
    const standard = episodeProductionLlm(async (request) => { calls.push(request); return answer(request, "ok"); }, undefined);
    await standard({ stage: "review", model: "openai/gpt-6.1-terra", role: "critic", system: "", user: "", json: true, maxTokens: 20 });
    expect(calls[3].serviceTier).toBeUndefined();
  });
  test("production roles: Terra plans and reviews, Sol writes and revises; a checked rewrite replaces the draft", async () => {
    const calls: LlmRequest[] = [];
    const ledger = new CostLedger();
    const llm = async (request: LlmRequest) => {
      calls.push(request);
      if (request.stage === "episode-plan") return answer(request, JSON.stringify(rawPlan()));
      if (request.stage === "episode-editorial-review") return answer(request, JSON.stringify({ issues: [{ severity: "major", quote: "Bo Bücherfuchs lacht.", problem: "Ein Fehler", change: "Verbessern" }], verdict: "prüfen" }));
      if (request.stage === "episode-editorial-recheck") return answer(request, JSON.stringify({ issues: [], verdict: "gut" }));
      return answer(request, request.stage === "episode-editorial-revision" ? story(560, "Verbesserter Schluss.") : story(560));
    };
    const result = await runEpisodeTextEngine({ llm, brief: brief(), models: episodeProductionModels(), ledger, options: { mode: "two-step", editorialReview: true } });
    expect(calls.map((call) => [call.stage, call.model])).toEqual([
      ["episode-plan", "openai/gpt-6.1-terra"], ["episode-write", "openai/gpt-6.1-sol"],
      ["episode-editorial-review", "openai/gpt-6.1-terra"], ["episode-editorial-revision", "openai/gpt-6.1-sol"],
      ["episode-editorial-recheck", "openai/gpt-6.1-terra"],
    ]);
    expect(ledger.all().map((entry) => entry.modelRole)).toEqual(["support", "selected-story", "support", "selected-story", "support"]);
    expect(result.episode.revised).toBe(true);
    expect(result.pages[0].content).toContain("Verbesserter Schluss.");
  });

  test("unsupported evidence and a failed recheck cannot replace the manuscript", async () => {
    for (const invalid of ["invented quote", "Bo Bücherfuchs lacht."]) {
      const calls: string[] = [];
      const llm = async (request: LlmRequest) => {
        calls.push(request.stage);
        if (request.stage === "episode-plan") return answer(request, JSON.stringify(rawPlan()));
        if (request.stage === "episode-editorial-review") return answer(request, JSON.stringify({ issues: [{ severity: "major", quote: invalid, problem: "Problem", change: "Fix" }] }));
        if (request.stage === "episode-editorial-recheck") return answer(request, "not JSON");
        return answer(request, request.stage === "episode-editorial-revision" ? story(560, "Neue Fassung.") : story(560));
      };
      const result = await runEpisodeTextEngine({ llm, brief: brief(), models: episodeProductionModels(), ledger: new CostLedger(), options: { mode: "two-step", editorialReview: true } });
      expect(result.episode.revised).toBe(false);
      expect(result.pages[0].content).not.toContain("Neue Fassung.");
      expect(calls.includes("episode-editorial-revision")).toBe(invalid !== "invented quote");
    }
  });

  test("plan → story; a series name of a new figure is renamed, not rewritten", async () => {
    const calls: LlmRequest[] = [];
    const llm = async (request: LlmRequest) => {
      calls.push(request);
      return answer(request, request.stage.startsWith("episode-plan") ? JSON.stringify(rawPlan()) : story(560, "Bruno bellte. Brunos Napf war leer."));
    };
    const result = await runEpisodeTextEngine({ llm, brief: brief(), models: MODELS, ledger: new CostLedger(), options: { mode: "two-step" } });
    expect(calls.map((call) => call.stage)).toEqual(["episode-plan", "episode-write"]);
    expect(result.episode.revised).toBe(false);
    expect(result.episode.renamed).toEqual([{ from: "Bruno", to: "Pimpel" }]);
    const full = result.pages.map((page) => page.content).join("\n");
    expect(full).toContain("Pimpel bellte. Pimpels Napf");
    expect(full.includes("Bruno")).toBe(false);
    expect(result.pages.map((page) => page.title)).toEqual(["Fracht mit Füßen", "Noch mehr Beine", "Zu zweit"]);
    expect(result.episode.guests.map((guest) => guest.id)).toEqual(["kuno"]);
    expect(result.plan.cast.map((member) => member.id)).toEqual(["pool-fox", "kuno"]);
  });

  test("a copied sample word that is no name still gets one revision", async () => {
    const stages: string[] = [];
    const llm = async (request: LlmRequest) => {
      stages.push(request.stage);
      return answer(request, request.stage.startsWith("episode-plan") ? JSON.stringify(rawPlan()) : request.stage === "episode-write" ? story(560, "Das Gähnmonster kam.") : story(560));
    };
    const result = await runEpisodeTextEngine({ llm, brief: brief(), models: MODELS, ledger: new CostLedger(), options: { mode: "two-step" } });
    expect(stages).toEqual(["episode-plan", "episode-write", "episode-revision"]);
    expect(result.episode.revised).toBe(true);
  });

  test("a plan with structural problems is repaired once, then written", async () => {
    const stages: string[] = [];
    const llm = async (request: LlmRequest) => {
      stages.push(request.stage);
      return answer(request, request.stage === "episode-plan" ? JSON.stringify(rawPlan(2)) : request.stage === "episode-plan-repair" ? JSON.stringify(rawPlan(3)) : story(560));
    };
    const result = await runEpisodeTextEngine({ llm, brief: brief(), models: MODELS, ledger: new CostLedger(), options: { mode: "two-step" } });
    expect(stages).toEqual(["episode-plan", "episode-plan-repair", "episode-write"]);
    expect(result.planRepaired).toBe(true);
    expect(result.pages.length).toBe(3);
  });
});

describe("Talea-Folge engine, one-shot", () => {
  test("one call: header gives cast and artifact, chapters come from the text", async () => {
    const stages: string[] = [];
    const b = brief();
    b.artifacts = [{ id: "artifact_097", name: "Abenteuerkompass", rule: "zeigt eine Richtung" } as any];
    const llm = async (request: LlmRequest) => {
      stages.push(request.stage);
      return answer(request, oneShotText(560, "Der Abenteuerkompass zitterte.").replace("FUNDSTÜCK: keins", "FUNDSTÜCK: artifact_097 (Abenteuerkompass)"));
    };
    const result = await runEpisodeTextEngine({ llm, brief: b, models: MODELS, ledger: new CostLedger(), options: { mode: "one-shot" } });
    expect(stages).toEqual(["episode-oneshot"]);
    expect(result.episode.mode).toBe("one-shot");
    expect(result.plan.cast.map((member) => member.id)).toEqual(["pool-fox", "kuno"]);
    expect(result.episode.guests[0].physicalDescription).toContain("wooden crate");
    expect(result.plan.artifact?.id).toBe("artifact_097");
    expect(result.plan.worldRule).toContain("Beinpaar");
    expect(result.pages.map((page) => page.title)).toEqual(["Fracht mit Füßen", "Noch mehr Beine", "Zu zweit"]);
  });

  test("the header parser reads every marker", () => {
    const parsed = readOneShot(oneShotText(20));
    expect(parsed.header.rule).toContain("Beinpaar");
    expect(parsed.header.figures.length).toBe(2);
    expect(parsed.header.artifactId).toBeNull();
    expect(parsed.story.chapters.length).toBe(3);
  });

  test("the first effect and the chapter laughs reach the plan the picture director reads", () => {
    const text = oneShotText(20).replace("FUNDSTÜCK: keins", ["FUNDSTÜCK: keins", "WIRKUNG: Der Kiste wachsen zwei Holzbeine.", "LACHER: 1 | Die Kiste stolpert über die Fußmatte.", "LACHER: 3 | **Kuno trägt Alexander.**"].join("\n"));
    const parsed = readOneShot(text);
    const plan = planFromHeader(parsed.header, parsed.story, brief());
    expect(plan.wonder.firstEffect).toBe("Der Kiste wachsen zwei Holzbeine.");
    expect(plan.chapters.map((chapter) => chapter.laugh)).toEqual(["Die Kiste stolpert über die Fußmatte.", "", "Kuno trägt Alexander."]);
    expect(storyHighlights(toStoryPlan(plan, parsed.story.chapters))).toEqual([
      "The wonder's first visible effect: Der Kiste wachsen zwei Holzbeine.",
      "Chapter 1: Die Kiste stolpert über die Fußmatte.",
      "Chapter 3: Kuno trägt Alexander.",
    ]);
  });

  test("a figure listed in the header but absent from the text is not drawn", () => {
    const parsed = readOneShot(oneShotText(20).replace("Kuno gähnte.", ""));
    const plan = planFromHeader(parsed.header, parsed.story, brief());
    expect(plan.cast.map((member) => member.id)).toEqual(["pool-fox"]);
  });

  test("a too-thin one-shot gets one revision of the whole story", async () => {
    const stages: string[] = [];
    const llm = async (request: LlmRequest) => {
      stages.push(request.stage);
      return answer(request, request.stage === "episode-oneshot" ? oneShotText(60) : oneShotText(560));
    };
    const result = await runEpisodeTextEngine({ llm, brief: brief(), models: MODELS, ledger: new CostLedger(), options: { mode: "one-shot" } });
    expect(stages).toEqual(["episode-oneshot", "episode-revision"]);
    expect(result.episode.revised).toBe(true);
    expect(result.finalChecks.ok).toBe(true);
  });
});

describe("Talea-Folge names", () => {
  test("a hero called Ella is the family's, never flagged, renamed or forbidden", () => {
    const b = buildBrief({
      config: { avatarIds: ["hero-e"], genre: "magic", ageGroup: "6-8", length: "medium", language: "de" } as any,
      band: "6-8", budget: episodeBudget("medium", "6-8"),
      heroes: [{ id: "hero-e", name: "Ella", age: 7 }], candidates: [], artifacts: [], seed: "ella",
    });
    expect(takenNames(b)).not.toContain("Ella");
    const { plan } = normalizePlan(rawPlan(), b);
    const chapters = readStory(story(560, "Ella lachte.")).chapters;
    expect(storyChecks(chapters, plan, b).hard).toEqual([]);
    expect(renameTakenNames(chapters, plan, b).renamed).toEqual([]);
    expect(planUserPrompt(b)).not.toMatch(/TAKEN NAMES:[^\n]*Ella/);
    expect(oneShotUserPrompt(b)).not.toMatch(/TAKEN NAMES:[^\n]*Ella/);
  });
});

// "Der Riese hinterm Teig" (2026-10-26)
describe("clear pronouns, honest titles, a fuller story", () => {
  const names = ["Alexander", "Adrian", "Magd Elsa", "Knisterich"];
  test("an \"Er\" after two possible figures, or after one figure and \"ihm\", is flagged; a clear one is not", () => {
    expect(ambiguousPronouns("Alexander stapelte Backformen. Adrian stellte sich auf die Zehenspitzen neben ihm. Er schob die letzte Sternform ins Regal.", names)).toHaveLength(1);
    expect(ambiguousPronouns("Alexander reichte Adrian den Korb. Er lachte.", names)).toHaveLength(1);
    expect(ambiguousPronouns("Alexander stellte den Korb ab. Er sah sich um.", names)).toEqual([]);
    expect(ambiguousPronouns("Adrian stand auf.\n\nEr lachte.", names)).toEqual([]);
    expect(ambiguousPronouns("„Komm“, sagte Alexander. Er winkte Adrian.", names)).toEqual([]);
  });

  test("a title that counts things is a soft defect, an article is not", () => {
    expect(COUNTING_TITLE.test("Drei schlechte Einfälle")).toBe(true);
    expect(COUNTING_TITLE.test("2 Wünsche")).toBe(true);
    expect(COUNTING_TITLE.test("Ein Schritt vor den Riesen")).toBe(false);
    expect(COUNTING_TITLE.test("Das Rascheln im Mehl")).toBe(false);
    const b = brief();
    const { plan } = normalizePlan(rawPlan(), b);
    const chapters = readStory(story(600).replace("Noch mehr Beine", "Drei schlechte Einfälle")).chapters;
    expect(storyChecks(chapters, plan, b).soft.some((issue) => issue.includes("counts things"))).toBe(true);
    expect(storyChecks(readStory(story(600)).chapters, plan, b).soft.some((issue) => issue.includes("counts things"))).toBe(false);
  });

  test("ages 6-8 get 600–800 words per chapter, and the writer is told about pronouns, titles and new attempts", () => {
    const budget = episodeBudget("medium", "6-8");
    expect([budget.wordsPerPageMin, budget.wordsPerPageMax, budget.totalWordsMin, budget.totalWordsMax]).toEqual([600, 800, 1800, 2400]);
    expect(episodeBudget("long", "6-8").totalWordsMin).toBe(2400);
    expect(episodeBudget("short", "6-8").totalWordsMax).toBe(1600);
    const prompt = oneShotSystemPrompt(brief());
    expect(prompt).toContain("A sentence never starts with „Er“");
    expect(prompt).toContain("A chapter title never counts anything");
    expect(oneShotUserPrompt(brief())).toContain("never the same failure twice");
  });

  test("every line break is a paragraph break, so reader, PDF and picture placement count the same paragraphs", () => {
    expect(tidyParagraphs("Eins.\nZwei.\n\n\nDrei.  \n")).toBe("Eins.\n\nZwei.\n\nDrei.");
    expect(tidyParagraphs("")).toBe("");
  });
});
