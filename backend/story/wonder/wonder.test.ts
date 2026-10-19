// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { CostLedger, type LlmRequest } from "../storybook/llm";
import { fixture } from "./fixtures";
import { draftProblems, mergeRevision, planProblems, readDraft, reviewProblems, setupProblems } from "./checks";
import { selectWonderPackages, wonderBudget } from "./library";
import { runWonderTextEngine } from "./engine";
import { writerPrompt, wonderBrief } from "./prompts";
import type { WonderPlan, WonderReview } from "./types";

function setup() {
  const brief = fixture("realistic", "short");
  const plan: WonderPlan = {
    ideas: [1, 2, 3].map(n => ({ hook: `Idee ${n}`, comicEngine: "Ein ernsthafter Irrtum", whyTheseHeroes: "Noras Plan und Bens Beobachtung" })), chosenIdea: 1,
    packageId: null, title: "Das Fest", logline: "Ein Fest gerät durcheinander.", want: "Zusammen feiern", stakes: "Ben freut sich auf Besuch.", worldRule: null,
    ruleDemonstration: "Keine Magie", easyWayOut: "Nora muss ihr Missverständnis erklären.",
    heroes: brief.heroes.map(h => ({ id: h.id, name: h.name, voice: "Eine eigene Stimme", choice: "Ändert den Ablauf", contribution: "Holt die Gäste" })), guests: [], artifact: null,
    setups: [{ what: "Ein Schild", plantedOnPage: 1, paysOffOnPage: 4 }],
    scenes: [1, 2, 3, 4].map(chapter => ({ chapter, title: `Abschnitt ${chapter}`, place: "Im Garten", action: "Das Kind handelt.", cause: "Sein Plan hat Folgen.", change: "Ein Gast bleibt.", humor: "Ein Irrtum", end: "Eine Frage", onStage: brief.heroes.map(h => h.id), after: "Alle im Garten" })),
    ending: { resolution: "Sie erklären das Fest.", emotionalAction: "Teilen den Kuchen", callback: "Das Schild" }, learningCore: null,
  };
  const chapters = plan.scenes.map(s => `SEITE ${s.chapter}\nNora hält die Tüte fest. Ben dreht das Schild um. Kapitel ${s.chapter}. ${"Der Wind weht durch den Garten und bewegt die bunten Bänder. ".repeat(23)}`);
  const raw = `TITEL: Das Fest\nBESCHREIBUNG: Ein Fest geht anders los.\n${chapters.join("\n\n")}`;
  const draft = readDraft(raw, plan, "de");
  const review: WonderReview = {
    comprehension: { goal: "Feiern", obstacle: "Missverständnis", solution: "Schild drehen" },
    heroActions: [{ heroId: "hero:nora", page: 1, quote: "Nora hält die Tüte fest." }, { heroId: "hero:ben", page: 1, quote: "Ben dreht das Schild um." }],
    laughs: [{ page: 1, quote: "Ben dreht das Schild um.", why: "Erwartung kippt." }], keep: [{ page: 1, quote: "Nora hält die Tüte fest." }], issues: [], readAgainReason: "Die zwei verschiedenen Absichten.",
  };
  return { brief, plan, raw, draft, review };
}

describe("Wunder & Witz contracts", () => {
  test("templates respect genre, age and family history", () => {
    const b = fixture("space");
    expect(selectWonderPackages(b).map(p => p.id)).toEqual(["wonder:robot-picnic"]);
    b.recentEngineIds = ["wonder:robot-picnic"];
    expect(selectWonderPackages(b)).toEqual([]);
    expect(selectWonderPackages(fixture("realistic")).every(p => p.genres.includes("modern"))).toBe(true);
    expect(wonderBudget("medium", "3-5").totalWordsMax).toBeLessThan(wonderBudget("medium", "6-8").totalWordsMin);
    expect(selectWonderPackages(fixture("magic")).some(p => p.id === "wonder:shadow-afternoon")).toBe(false);
  });
  test("preserves wishes, anatomy and parent guidance at every stage", () => {
    const b = fixture("dragon");
    b.config.pov = "ich"; b.config.parentalGuidance = "Keine Trennung"; b.blockedTerms = ["Donner"];
    const request = wonderBrief(b);
    expect(request.heroes[0].anatomy.wings).toBe(true);
    expect(request.narration.pov).toBe("ich");
    expect(request.parentalGuidance).toBe("Keine Trennung");
    expect(request.blockedTerms).toEqual(["Donner"]);
  });
  test("rejects missing avatars, invented catalogue IDs and unprepared payoffs", () => {
    const { brief, plan } = setup();
    expect(planProblems(plan, brief, [])).toEqual([]);
    expect(planProblems({ ...plan, heroes: plan.heroes.slice(0, 1) }, brief, []).length).toBeGreaterThan(0);
    expect(planProblems({ ...plan, artifact: { id: "made-up" } }, brief, []).length).toBeGreaterThan(0);
    expect(planProblems({ ...plan, setups: [{ what: "Rettung", plantedOnPage: 4, paysOffOnPage: 2 }] }, brief, []).length).toBeGreaterThan(0);
    expect(planProblems({ ...plan, packageId: "wonder:robot-picnic" }, brief, []).length).toBeGreaterThan(0);
  });
  test("a brought artifact cannot be silently dropped or acquired again", () => {
    const { brief, plan } = setup();
    brief.artifacts = [{ id: "a1", name: "Laterne", rule: "Leuchtet", visualKeywords: [], broughtBy: "hero:nora" }];
    expect(planProblems(plan, brief, [])).toContain("Mitgebrachtes Artefakt fehlt.");
    plan.artifact = { id: "a1", name: "Laterne", role: "Licht", carried: true, firstPage: 1, usePage: 3 };
    expect(planProblems(plan, brief, [])).toEqual([]);
  });
  test("invalid setup references identify the exact entry without relaxing preparation rules", () => {
    expect(setupProblems([{ what: "Schild", plantedOnPage: 2, paysOffOnPage: 2 }], 4).join(" ")).toContain("setups[0]: Auflösung in Kapitel 2 muss NACH");
    expect(setupProblems([{ what: "Schild", plantedOnPage: 0, paysOffOnPage: 5 }], 4)).toHaveLength(2);
    expect(setupProblems([{ what: "Schild", plantedOnPage: "1", paysOffOnPage: 4 }], 4)[0]).toContain("ganze Kapitelnummer");
    const { brief, plan } = setup();
    expect(planProblems({ ...plan, setups: [...plan.setups, { what: "Sofortwirkung", plantedOnPage: 2, paysOffOnPage: 2 }] }, brief, []).join(" ")).toContain("setups[1]");
  });
  test("requires exact page order and evidence, never repairs by silently renumbering", () => {
    const { brief, plan, raw, draft, review } = setup();
    expect(() => readDraft(raw.replace("SEITE 2", "SEITE 3"), plan)).toThrow();
    expect(reviewProblems(review, draft, brief)).toEqual([]);
    expect(reviewProblems({ ...review, keep: [{ page: 1, quote: "Nora rettet alle Menschen." }] }, draft, brief)).toContain("Unbelegtes Zitat in keep.");
    expect(reviewProblems({ ...review, issues: [{ severity: "improve", kind: "logic", page: 1, quote: "Nora hält die Tüte fest.", problem: "Reihenfolge", fix: "Umstellen", affectedPages: [99] }] }, draft, brief)).toContain("Ungültige betroffene Kapitel.");
    expect(draftProblems({ ...draft, title: "Verboten" }, { ...brief, blockedTerms: ["verboten"] }).length).toBeGreaterThan(0);
  });
  test("targeted revision preserves unedited chapters exactly and rejects stray chapters", () => {
    const { draft } = setup();
    const revised = mergeRevision(draft, "SEITE 2\nEin neuer zweiter Abschnitt.", [2]);
    expect(revised.pages[0]).toBe(draft.pages[0]);
    expect(revised.pages[2]).toBe(draft.pages[2]);
    expect(revised.pages[1].content).toBe("Ein neuer zweiter Abschnitt.");
    expect(() => mergeRevision(draft, "SEITE 1\nFalsch.", [2])).toThrow();
  });
});

describe("Wunder engine release decisions", () => {
  test("repairs only malformed setup metadata and preserves the complete plan before independent review", async () => {
    const { brief, plan, raw, review } = setup();
    const broken = { ...plan, setups: [{ what: "Ein Schild", plantedOnPage: 4, paysOffOnPage: 4 }] };
    const requests: LlmRequest[] = []; const observations: string[] = [];
    const result = await runWonderTextEngine({ brief, ledger: new CostLedger(), models: { writer: "sol", support: "luna", critic: "independent" },
      observe: async stage => { observations.push(stage); }, llm: async r => {
        requests.push(r);
        if (r.stage === "wonder-plan-setups-repair") { expect(r.effort).toBe("low"); expect(r.maxTokens).toBe(1600); expect(r.user).toContain("Auflösung in Kapitel 4"); }
        if (r.stage === "wonder-plan-read") expect(JSON.parse(r.user).plan).toEqual(plan);
        const response = r.stage === "wonder-plan" ? JSON.stringify(broken)
          : r.stage === "wonder-plan-setups-repair" ? JSON.stringify({ setups: plan.setups })
          : r.stage === "wonder-plan-read" ? '{"issues":[],"keep":[]}'
          : r.stage === "wonder-draft" ? raw : JSON.stringify(review);
        return { text: response, modelUsed: r.model, usage: { prompt: 0, completion: 0, total: 0, costUSD: 0 }, durationMs: 0 };
      } });
    expect(result.textQuality?.status).toBe("passed");
    expect(result.wonder.plan).toEqual(plan);
    expect(requests.map(r => r.stage)).toEqual(["wonder-plan", "wonder-plan-setups-repair", "wonder-plan-read", "wonder-draft", "wonder-cold-read"]);
    expect(observations).toContain("wonder-plan-validation-failed");
  });
  test("a setup repair that stays invalid never reaches writing or illustration", async () => {
    const { brief, plan } = setup(); const stages: string[] = [];
    const broken = { ...plan, setups: [{ what: "Ein Schild", plantedOnPage: 4, paysOffOnPage: 1 }] };
    await expect(runWonderTextEngine({ brief, ledger: new CostLedger(), models: { writer: "sol", support: "luna", critic: "independent" }, llm: async r => {
      stages.push(r.stage);
      return { text: JSON.stringify(r.stage.includes("setups-repair") ? { setups: broken.setups } : broken), modelUsed: r.model, usage: { prompt: 0, completion: 0, total: 0, costUSD: 0 }, durationMs: 0 };
    } })).rejects.toThrow("Auflösung in Kapitel 1 muss NACH");
    expect(stages).not.toContain("wonder-draft");
    expect(stages).toHaveLength(4);
  });
  test("full format retries receive the rejected plan and specific errors", async () => {
    const { brief, plan, raw, review } = setup();
    await runWonderTextEngine({ brief, ledger: new CostLedger(), models: { writer: "sol", support: "luna", critic: "independent" }, llm: async r => {
      if (r.stage === "wonder-plan-format-retry") {
        expect(r.user).toContain('"previousOutput"');
        expect(r.user).toContain('"title":"Vorhandener Plan"');
        expect(r.user).toContain('"validationErrors"');
      }
      const response = r.stage === "wonder-plan" ? JSON.stringify({ ...plan, title: "Vorhandener Plan", heroes: [] })
        : r.stage === "wonder-plan-format-retry" ? JSON.stringify(plan)
        : r.stage === "wonder-plan-read" ? '{"issues":[],"keep":[]}'
        : r.stage === "wonder-draft" ? raw : JSON.stringify(review);
      return { text: response, modelUsed: r.model, usage: { prompt: 0, completion: 0, total: 0, costUSD: 0 }, durationMs: 0 };
    } });
  });
  test("runs the real flow with a text-only port and records model usage", async () => {
    const { brief, plan, raw, review } = setup();
    const requests: LlmRequest[] = []; const ledger = new CostLedger();
    const result = await runWonderTextEngine({ brief, ledger, models: { writer: "sol", support: "luna", critic: "independent" }, llm: async request => {
      requests.push(request);
      const response = request.stage === "wonder-plan" ? JSON.stringify(plan) : request.stage === "wonder-plan-read" ? '{"issues":[],"keep":["Stimmen"]}' : request.stage === "wonder-draft" ? raw : JSON.stringify(review);
      return { text: response, modelUsed: request.model, usage: { prompt: 10, completion: 20, total: 30, costUSD: 0.001 }, durationMs: 5, finishReason: "stop" };
    } });
    expect(result.textQuality?.status).toBe("passed");
    expect(result.chosen).toBe("draft");
    expect(requests.map(r => r.stage)).toEqual(["wonder-plan", "wonder-plan-read", "wonder-draft", "wonder-cold-read"]);
    expect(requests[3].model).toBe("independent");
    expect(requests[3].user).not.toContain('"easyWayOut"');
    expect(ledger.totals().calls).toBe(4);
    expect(result.benchmarkScore).toBeNull();
  });
  test("unresolved plan problems never reach the writer", async () => {
    const { brief, plan } = setup(); const stages: string[] = [];
    await expect(runWonderTextEngine({ brief, ledger: new CostLedger(), models: { writer: "sol", support: "luna", critic: "independent" }, llm: async r => {
      stages.push(r.stage);
      return { text: JSON.stringify(r.stage.includes("read") ? { issues: ["Fliegen würde das Problem sofort lösen."], keep: [] } : plan), modelUsed: r.model, usage: { prompt: 0, completion: 0, total: 0, costUSD: 0 }, durationMs: 0 };
    } })).rejects.toThrow("offene Probleme");
    expect(stages).not.toContain("wonder-draft");
  });
  test("revision prompts name the exact chapters and protect quoted strengths", () => {
    const { brief, plan, draft, review } = setup();
    const p = writerPrompt(brief, plan, [], { draft, review, chapters: [2], mechanical: [] });
    expect(JSON.parse(p.user).chapters).toEqual([2]);
    expect(p.system).toContain("ORIGINALNUMMERN");
    expect(p.user).toContain("Nora hält die Tüte fest.");
  });
  test("a revision with a new contradiction never replaces a clean original", async () => {
    const { brief, plan, raw, review } = setup();
    const improvement = { severity: "improve" as const, kind: "logic" as const, page: 2, affectedPages: [2], quote: "Der Wind weht durch den Garten", problem: "Ein lokaler Ablauf ist unnötig umständlich.", fix: "Kapitel 2 straffen." };
    const draftReview = { ...review, issues: [improvement] };
    const reread = { ...review, issues: [{ ...improvement, severity: "blocker" as const, kind: "logic" as const, problem: "Der neue Text widerspricht Kapitel 1." }] };
    const result = await runWonderTextEngine({ brief, ledger: new CostLedger(), models: { writer: "sol", support: "luna", critic: "independent" }, llm: async r => {
      if (r.stage === "wonder-revision") expect(JSON.parse(r.user).chapters).toEqual([2]);
      const response = r.stage === "wonder-plan" ? JSON.stringify(plan)
        : r.stage === "wonder-plan-read" ? '{"issues":[],"keep":[]}'
        : r.stage === "wonder-draft" ? raw
        : r.stage === "wonder-cold-read" ? JSON.stringify(draftReview)
        : r.stage === "wonder-revision" ? `SEITE 2\n${readDraft(raw, plan).pages[1].content} Ein neuer Schluss.` : JSON.stringify(reread);
      return { text: response, modelUsed: r.model, usage: { prompt: 0, completion: 0, total: 0, costUSD: 0 }, durationMs: 0 };
    } });
    expect(result.chosen).toBe("draft");
    expect(result.pages).toEqual(readDraft(raw, plan, "de").pages);
    expect(result.wonder.review.issues[0].severity).toBe("improve");
  });
});
