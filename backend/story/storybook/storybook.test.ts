/**
 * Storybook Pipeline — tests for the parts that must never need an LLM.
 *
 * Everything covered here is deterministic: premise rotation, the anti-repeat
 * variant draw, the plan gate, the prose gate and draft parsing. These are the
 * pieces that decide whether a story is understandable and whether a family
 * ever sees the same telling twice, so they are the pieces worth pinning down.
 */

import { describe, expect, test } from "bun:test";

import {
  PREMISE_BANK,
  countDistinctTellings,
  resolvePremiseVariant,
  selectPremise,
} from "./premise-bank";
import { checkPlan, checkProse } from "./checks";
import {
  extractStorybookChoiceContent,
  isTruncatedFinishReason,
  resolveStorybookReasoning,
} from "./llm-guards";
import { evaluateJudgeAnswers, parseDraft, resolveTargetPages } from "./parsing";
import { normalizeAgeBand, resolveLengthBudget } from "./style-contract";
import type { JudgeAnswers, KidLogicCard, StorybookPage } from "./types";

const BUDGET = resolveLengthBudget("medium", "6-8");

describe("provider response guards", () => {
  test("gpt-5 support calls receive an explicit minimal reasoning budget", () => {
    expect(resolveStorybookReasoning("openai/gpt-5.6-luna")).toEqual({
      effort: "minimal",
      exclude: true,
    });
  });

  test("hybrid-thinking writer models have reasoning disabled", () => {
    expect(resolveStorybookReasoning("moonshotai/kimi-k2.6")).toEqual({
      enabled: false,
      exclude: true,
    });
  });

  test("content-part arrays are preserved instead of becoming an empty string", () => {
    expect(extractStorybookChoiceContent({
      message: { content: [{ type: "text", text: "first" }, { content: "second" }] },
    })).toBe("first\nsecond");
  });

  test("provider completion-limit finishes are treated as truncation", () => {
    expect(isTruncatedFinishReason("length")).toBe(true);
    expect(isTruncatedFinishReason("max_tokens")).toBe(true);
    expect(isTruncatedFinishReason("stop")).toBe(false);
  });
});

function validCard(overrides: Partial<KidLogicCard> = {}): KidLogicCard {
  return {
    titel: "Ben und die Schuhe, die nur geradeaus wollen",
    kurzbeschreibung: "Ben muss mit störrischen Schuhen zum Bolzplatz, doch sie biegen nicht ab.",
    kette: {
      will: "Ben will rechtzeitig zum Spiel auf dem Bolzplatz.",
      aber: "Aber die Schuhe gehen nur geradeaus.",
      also: "Also zwingt er sie durch den Sandkasten.",
      dadurch: "Dadurch löst sich ein Knoten und der Schnürsenkel wird kürzer.",
      entweder: "Jetzt kann Ben nur noch umlaufen oder den letzten Knoten opfern.",
      waehlt: "Ben wählt den Knoten, weil sonst niemand spielen kann.",
      ende: "Am Ende stehen die Schuhe am Zaun.",
    },
    wunderregel: {
      regel: "Die Schuhe gehen nur geradeaus.",
      sichtbareFolge: "Bei jeder Kurve löst sich einer der acht Knoten.",
    },
    dreierSchritt: ["Durch den Sandkasten", "Durch die Wäscheleine", "Durch die Bäckerei"],
    umkehrung: "Ben biegt nicht ab, sondern läuft absichtlich quer durch die Hecke.",
    preis: "Ben lässt den letzten Knoten und damit die Schuhe zurück.",
    schlussbild: "Die Schuhe stehen am Zaun, ein kurzer Schnürsenkel hängt heraus.",
    ankerObjekt: "die Turnschuhe",
    refrain: "Immer geradeaus, Ben!",
    laufgag: {
      typ: "koerperliche_eskalation",
      beschreibung: "Ben landet jedes Mal woanders im Dreck.",
      stellen: ["Sand in den Schuhen", "Bettlaken über dem Kopf", "Mehlwolke in der Bäckerei"],
    },
    seiten: Array.from({ length: BUDGET.pages }, (_, index) => ({
      nr: index + 1,
      was: `Auf Seite ${index + 1} passiert etwas Sichtbares.`,
      frage: `Reicht der ${index + 1}. Knoten noch?`,
    })),
    figuren: [
      { name: "Ben", werSieSind: "ein Junge mit zu großen Schuhen", willWas: "zum Spiel kommen" },
      { name: "Frau Kessler", werSieSind: "die Bäckerin von nebenan", willWas: "ihre Auslage retten" },
    ],
    ...overrides,
  };
}

describe("premise bank", () => {
  test("every premise carries the fields the plan gate depends on", () => {
    for (const premise of PREMISE_BANK) {
      expect(premise.situation.length).toBeGreaterThan(20);
      expect(premise.childWant.length).toBeGreaterThan(10);
      expect(premise.whyItHurts.length).toBeGreaterThan(10);
      // An opponent whose want is boredom produces no plot — the exact defect
      // the old engine shipped with "Die Nebelhexe will nicht gelangweilt sein".
      expect(premise.opponent.want.length).toBeGreaterThan(10);
      expect(/langeweile|gelangweilt/i.test(premise.opponent.want)).toBe(false);
      // Magic with no visible trace does not exist for a child.
      expect(premise.wonderRule.visibleSideEffect.length).toBeGreaterThan(10);
      expect(premise.escalation).toHaveLength(3);
      expect(new Set(premise.escalation).size).toBe(3);
      expect(premise.price.length).toBeGreaterThan(10);
      expect(premise.closingImage.length).toBeGreaterThan(10);
      expect(premise.roleNeeds.length).toBeGreaterThan(0);
    }
  });

  test("every premise has full variation axes", () => {
    for (const premise of PREMISE_BANK) {
      expect(premise.variants.objekt.length).toBeGreaterThanOrEqual(3);
      expect(premise.variants.einheit.length).toBeGreaterThanOrEqual(3);
      expect(premise.variants.arena.length).toBeGreaterThanOrEqual(3);
      expect(premise.variants.gegnerWunsch.length).toBeGreaterThanOrEqual(3);
      expect(premise.variants.gag.length).toBeGreaterThanOrEqual(3);
      // Each arena entry must name three places, one per escalation beat.
      for (const arena of premise.variants.arena) {
        expect(arena.split(",").length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  test("the bank can tell thousands of distinct stories before repeating", () => {
    expect(countDistinctTellings()).toBeGreaterThan(2000);
  });

  test("selection is deterministic for the same seed", () => {
    const args = { genre: "adventure", setting: "village", ageGroup: "6-8", seed: "abc123" };
    expect(selectPremise(args).premise.id).toBe(selectPremise(args).premise.id);
  });

  test("recently used premises are pushed out of the draw", () => {
    const base = selectPremise({ genre: "adventure", setting: "village", ageGroup: "6-8", seed: "seed-1" });
    const next = selectPremise({
      genre: "adventure",
      setting: "village",
      ageGroup: "6-8",
      seed: "seed-1",
      recentPremiseIds: [base.premise.id],
    });
    expect(next.premise.id).not.toBe(base.premise.id);
  });

  test("variant draw walks the space instead of repeating a used key", () => {
    const premise = PREMISE_BANK[0];
    const first = resolvePremiseVariant(premise, "seed-x");
    const second = resolvePremiseVariant(premise, "seed-x", new Set([first.variant.key]));
    expect(second.variant.key).not.toBe(first.variant.key);
    expect(second.directives).toHaveLength(5);
  });

  test("a family walking the whole space gets unique tellings all the way", () => {
    const premise = PREMISE_BANK[0];
    const axes = premise.variants;
    const combos = axes.objekt.length * axes.einheit.length * axes.arena.length * axes.gegnerWunsch.length * axes.gag.length;
    const used = new Set<string>();
    for (let i = 0; i < combos; i += 1) {
      const drawn = resolvePremiseVariant(premise, `seed-${i}`, used);
      used.add(drawn.variant.key);
    }
    expect(used.size).toBe(combos);
  });
});

describe("plan gate", () => {
  test("a complete card passes", () => {
    expect(checkPlan(validCard(), BUDGET).ok).toBe(true);
  });

  test("a missing chain link is a hard failure", () => {
    const card = validCard();
    (card.kette as any).dadurch = "";
    const report = checkPlan(card, BUDGET);
    expect(report.ok).toBe(false);
    expect(report.hard.some((issue) => issue.code === "chain_missing_dadurch")).toBe(true);
  });

  test("magic without a visible trace is a hard failure", () => {
    const card = validCard({ wunderregel: { regel: "Eine Ausrede verschwindet.", sichtbareFolge: "" } });
    const report = checkPlan(card, BUDGET);
    expect(report.hard.some((issue) => issue.code === "rule_invisible")).toBe(true);
  });

  test("vague page questions are flagged", () => {
    const card = validCard();
    card.seiten[1].frage = "Schafft er es?";
    expect(checkPlan(card, BUDGET).soft.some((issue) => issue.code === "page_question_vague")).toBe(true);
  });

  test("a figure without an introduction sentence is a hard failure", () => {
    const card = validCard();
    card.figuren[1].werSieSind = "";
    expect(checkPlan(card, BUDGET).hard.some((issue) => issue.code === "figure_no_intro")).toBe(true);
  });

  test("an escalation that does not escalate is caught", () => {
    const card = validCard({ dreierSchritt: ["gleich", "gleich", "gleich"] });
    expect(checkPlan(card, BUDGET).hard.some((issue) => issue.code === "escalation_repeats")).toBe(true);
  });
});

describe("prose gate", () => {
  const page = (order: number, content: string): StorybookPage => ({
    order,
    title: `Leseseite ${order}`,
    content,
  });

  test("fragment staccato is a hard failure", () => {
    const report = checkProse({
      pages: [page(1, "Die Taste erlosch. Schwarz. Stumm. Tot. Der Korb ruckte los, weil niemand ihn hielt.")],
      budget: BUDGET,
      card: validCard(),
      knownNames: ["Ben"],
    });
    expect(report.hard.some((issue) => issue.code === "fragment_staccato")).toBe(true);
  });

  test("paragraphs without causal connectives are a hard failure", () => {
    const flat = [
      "Ben rutschte aus. Die Schüssel kippte. Sein Kinn traf den Tisch.",
      "",
      "Der Korb fuhr los. Teig spritzte. Die Fahnen wurden nass.",
      "",
      "Eine Taste leuchtete. Ben drückte sie. Der Korb sank.",
    ].join("\n");
    const report = checkProse({ pages: [page(1, flat)], budget: BUDGET, card: validCard(), knownNames: ["Ben"] });
    expect(report.hard.some((issue) => issue.code === "no_causality")).toBe(true);
  });

  test("connected prose passes the causality check", () => {
    const connected = [
      "Ben rutschte aus, weil der Boden voller Teig war, und die Schüssel kippte vom Tisch.",
      "",
      "Also lief er los, aber die Schuhe wollten nur geradeaus und trugen ihn quer durch den Sand.",
    ].join("\n");
    const report = checkProse({ pages: [page(1, connected)], budget: BUDGET, card: validCard(), knownNames: ["Ben"] });
    expect(report.hard.some((issue) => issue.code === "no_causality")).toBe(false);
  });

  test("a moral ending is a hard failure", () => {
    const card = validCard();
    const report = checkProse({
      pages: [
        page(1, "Ben lief los, weil das Spiel gleich begann, und die Schuhe zogen ihn geradeaus."),
        page(2, "Sie lernten, dass Freundschaft am wichtigsten ist, und deshalb gingen alle nach Hause."),
      ],
      budget: BUDGET,
      card,
      knownNames: ["Ben"],
    });
    expect(report.hard.some((issue) => issue.code === "moral_ending")).toBe(true);
  });

  test("a missing refrain is caught", () => {
    const report = checkProse({
      pages: [page(1, "Ben lief los, weil das Spiel begann, und niemand sagte etwas dazu.")],
      budget: BUDGET,
      card: validCard(),
      knownNames: ["Ben"],
    });
    expect(report.hard.concat(report.soft).some((issue) => issue.code === "refrain_missing")).toBe(true);
  });

  test("technical leftovers are a hard failure", () => {
    const report = checkProse({
      pages: [page(1, "Ben nahm [object Object] in die Hand, weil er nichts anderes fand.")],
      budget: BUDGET,
      card: validCard(),
      knownNames: ["Ben"],
    });
    expect(report.hard.some((issue) => issue.code === "serialization_artifact")).toBe(true);
  });
});

describe("draft parsing", () => {
  test("reads title, description and pages", () => {
    const raw = [
      "TITEL: Ben und die störrischen Schuhe",
      "BESCHREIBUNG: Ben will zum Spiel, aber seine Schuhe biegen nicht ab.",
      "SEITE 1",
      "Ben zog die Schuhe an, weil das Spiel gleich begann.",
      "",
      "SEITE 2",
      "Die Schuhe liefen geradeaus, also lief Ben mit.",
    ].join("\n");
    const parsed = parseDraft(raw, 2);
    expect(parsed.title).toBe("Ben und die störrischen Schuhe");
    expect(parsed.description).toContain("Ben will zum Spiel");
    expect(parsed.pages).toHaveLength(2);
    expect(parsed.pages[1].content).toContain("geradeaus");
  });

  test("falls back to even blocks when the model forgets the markers", () => {
    const raw = ["TITEL: Ohne Marker", "", "Erster Absatz.", "", "Zweiter Absatz.", "", "Dritter Absatz.", "", "Vierter Absatz."].join("\n");
    const parsed = parseDraft(raw, 2);
    expect(parsed.pages).toHaveLength(2);
    expect(parsed.pages[0].content.length).toBeGreaterThan(0);
  });

  test("renumbers pages so a skipped marker cannot break the reader", () => {
    const raw = ["SEITE 1", "Eins.", "SEITE 3", "Drei."].join("\n");
    const parsed = parseDraft(raw, 2);
    expect(parsed.pages.map((page) => page.order)).toEqual([1, 2]);
  });
});

describe("comprehension judge", () => {
  const answers = (overrides: Partial<JudgeAnswers> = {}): JudgeAnswers => ({
    wollte: "Ben will rechtzeitig zum Spiel auf dem Bolzplatz kommen.",
    schiefgegangen: "Die Schuhe gehen nur geradeaus und tragen ihn überall hin.",
    andersGemacht: "Am Ende nutzt er das Geradeaus absichtlich und läuft durch die Hecke.",
    wiederholung: ["Immer geradeaus, Ben!", "Bei jeder Kurve löst sich ein Knoten"],
    lachstelle: "Ben steht mit einem Bettlaken über dem Kopf da.",
    unerklaerteFigur: "keine",
    unverstaendlicherSatz: "keiner",
    verstaendlichkeit: 5,
    ...overrides,
  });

  test("a readable story passes", () => {
    expect(evaluateJudgeAnswers(answers(), validCard()).passed).toBe(true);
  });

  test("an unreadable want is a hard failure", () => {
    const report = evaluateJudgeAnswers(answers({ wollte: "Das steht nicht drin." }), validCard());
    expect(report.passed).toBe(false);
    expect(report.issues.some((issue) => issue.code === "want_unreadable")).toBe(true);
  });

  test("an unintroduced figure is a hard failure", () => {
    const report = evaluateJudgeAnswers(answers({ unerklaerteFigur: "Müller Hans' Tochter" }), validCard());
    expect(report.issues.some((issue) => issue.code === "figure_unexplained")).toBe(true);
    expect(report.passed).toBe(false);
  });

  test("a low comprehension score fails even when the answers look filled in", () => {
    const report = evaluateJudgeAnswers(answers({ verstaendlichkeit: 2 }), validCard());
    expect(report.passed).toBe(false);
  });

  test("a story with no laugh is only a soft issue", () => {
    const report = evaluateJudgeAnswers(answers({ lachstelle: "keine" }), validCard());
    expect(report.passed).toBe(true);
    expect(report.issues.some((issue) => issue.code === "no_laugh")).toBe(true);
  });
});

describe("edit targeting", () => {
  test("never rewrites more than three pages", () => {
    const issues = Array.from({ length: 8 }, (_, index) => ({
      code: "no_causality",
      severity: "hard" as const,
      message: "x",
      page: index + 1,
    }));
    expect(resolveTargetPages(issues, 8).length).toBeLessThanOrEqual(3);
  });

  test("story-wide defects map onto fixable pages", () => {
    const targets = resolveTargetPages([{ code: "refrain_missing", severity: "hard", message: "x" }], 5);
    expect(targets).toContain(1);
    expect(targets).toContain(5);
  });
});

describe("length budgets", () => {
  test("age bands normalise, including 13+", () => {
    expect(normalizeAgeBand("13+")).toBe("9-12");
    expect(normalizeAgeBand(undefined)).toBe("6-8");
  });

  test("younger readers get shorter sentences and fewer new names", () => {
    const young = resolveLengthBudget("medium", "3-5");
    const older = resolveLengthBudget("medium", "9-12");
    expect(young.maxSentenceChars).toBeLessThan(older.maxSentenceChars);
    expect(young.maxNewNamesPerPage).toBeLessThan(older.maxNewNamesPerPage);
  });
});
