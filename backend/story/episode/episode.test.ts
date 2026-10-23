// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { buildBrief } from "../storybook/context";
import { CostLedger, type LlmRequest } from "../storybook/llm";
import type { CastCandidate } from "../storybook/types";
import { childSituationChoices, episodeBudget, placeChoices, SAMPLE_NAMES, styleSamples } from "./craft";
import { normalizePlan, readStory, runEpisodeTextEngine, storyChecks } from "./engine";
import { planSystemPrompt, planUserPrompt, writerSystemPrompt } from "./prompts";

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
    expect(budget.totalWordsMin).toBe(1500);
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
    expect(planSystemPrompt(b)).toContain(SAMPLE_NAMES[0]);
    expect(planSystemPrompt(b)).toContain("Never invent parents");
  });
});

describe("Talea-Folge plan", () => {
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
});

describe("Talea-Folge engine", () => {
  test("plan → story; a copied name gets one revision that replaces the draft", async () => {
    const calls: LlmRequest[] = [];
    const llm = async (request: LlmRequest) => {
      calls.push(request);
      const text = request.stage.startsWith("episode-plan") ? JSON.stringify(rawPlan())
        : request.stage === "episode-write" ? story(560, "Bruno blubberte.")
          : story(560);
      return { text, modelUsed: request.model, usage: { prompt: 10, completion: 10, total: 20, costUSD: 0.001 }, durationMs: 1 };
    };
    const result = await runEpisodeTextEngine({ llm, brief: brief(), models: { writer: "openai/gpt-6.1-sol", support: "openai/gpt-6-luna", critic: "google/gemini-3.8-flash" }, ledger: new CostLedger() });
    expect(calls.map((call) => call.stage)).toEqual(["episode-plan", "episode-write", "episode-revision"]);
    expect(result.episode.revised).toBe(true);
    expect(result.pages.map((page) => page.title)).toEqual(["Fracht mit Füßen", "Noch mehr Beine", "Zu zweit"]);
    expect(result.pages.some((page) => page.content.includes("Bruno"))).toBe(false);
    expect(result.episode.guests.map((guest) => guest.id)).toEqual(["kuno"]);
    expect(result.plan.cast.map((member) => member.id)).toEqual(["pool-fox", "kuno"]);
  });

  test("a plan with structural problems is repaired once, then written", async () => {
    const stages: string[] = [];
    const llm = async (request: LlmRequest) => {
      stages.push(request.stage);
      const text = request.stage === "episode-plan" ? JSON.stringify(rawPlan(2)) : request.stage === "episode-plan-repair" ? JSON.stringify(rawPlan(3)) : story(560);
      return { text, modelUsed: request.model, usage: { prompt: 1, completion: 1, total: 2, costUSD: 0 }, durationMs: 1 };
    };
    const result = await runEpisodeTextEngine({ llm, brief: brief(), models: { writer: "w", support: "s", critic: "c" }, ledger: new CostLedger() });
    expect(stages).toEqual(["episode-plan", "episode-plan-repair", "episode-write"]);
    expect(result.planRepaired).toBe(true);
    expect(result.pages.length).toBe(3);
  });
});
