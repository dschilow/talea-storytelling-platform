// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { buildBrief } from "../storybook/context";
import { CostLedger, type LlmRequest } from "../storybook/llm";
import type { CastCandidate } from "../storybook/types";
import { childSituationChoices, episodeBudget, placeChoices, SAMPLE_NAMES, styleSamples, takenNames } from "./craft";
import { normalizePlan, planFromHeader, readOneShot, readStory, renameTakenNames, runEpisodeTextEngine, storyChecks } from "./engine";
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
    expect(planSystemPrompt(b)).not.toMatch(/TAKEN NAMES:[^\n]*Ella/);
  });
});
