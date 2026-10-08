// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { buildDokuPayload, normalizeDokuOutput, parseDokuJson, toDokuContent } from "./doku-prompt";
import { applyFactCheck, parseFactCheckIssues } from "./doku-factcheck";

const config = {
  topic: "Wie wird aus Milch Käse?",
  depth: "standard" as const,
  ageGroup: "6-8" as const,
  includeInteractive: true,
  quizQuestions: 4,
  handsOnActivities: 1,
  length: "medium" as const,
};

function question(text: string, answerIndex = 1) {
  return {
    question: text,
    options: ["Falsch eins", "Richtig", "Falsch zwei"],
    answerIndex,
    explanation: "Genau! Weil die Molke abfließt.",
    skillType: "understand",
    difficulty: 2,
  };
}

function rawDoku() {
  return {
    title: "Der Käse-Check",
    summary: "Wie wird Milch fest?",
    hook: "Ich hebe einen Löffel.\n\nDaran zittert etwas Weißes.",
    mainQuestion: "Wie wird aus Milch Käse?",
    guess: { question: "Rate mal: Wie viel Milch?", options: ["10 Liter", "2 Liter", "50 Liter"], answerIndex: 0, reveal: "Etwa zehn Liter." },
    sections: [
      {
        kind: "station",
        place: "In der Käserei",
        expert: { role: "Käsermeisterin", name: "Anna" },
        title: "Ein Kessel voller Pudding",
        content: "Absatz eins.\n\nAbsatz zwei.",
        keyFacts: [{ title: "Zahl des Tages", fact: "Ein Fakt.", comparison: "Wie ein Eimer." }],
        interactive: {
          quiz: { enabled: true, questions: [question("Frage 1?"), question("Frage 2?")] },
          activities: { enabled: false, items: [] },
        },
      },
      {
        kind: "wissen",
        title: "Ein Netz hält alles fest",
        content: "Erklärung.",
        keyFacts: [],
        interactive: {
          quiz: { enabled: true, questions: [question("Frage 3?"), question("Frage 4?"), question("Frage 5?")] },
          activities: {
            enabled: true,
            items: [
              { title: "Milch flockt", description: "Säure trennt Milch.", steps: ["Gieße", "Rühre"], safetyNote: "keine" },
              { title: "Zweites", description: "Zu viel." },
            ],
          },
        },
      },
      { title: "", content: "ohne Titel wird verworfen", keyFacts: [] },
    ],
    recap: ["✔ Punkt eins", "Punkt zwei", "Punkt drei", "Punkt vier"],
    closingLine: "Mich beeindruckt das.",
  };
}

describe("doku payload", () => {
  test("builds the checker prompt with the requested counts and no child name instruction leak", () => {
    const payload = buildDokuPayload({ ...config, personalizationPrompt: "CHILD PROFILE CONTEXT:\n- Explain the topic for Mia." });
    const user = payload.messages[1].content;
    expect(payload.messages[0].content).toContain("TAVI");
    expect(user).toContain("Genau 5 Kapitel");
    expect(user).toContain("genau 4 Quizfrage(n) mit je genau 3 Antworten");
    expect(user).toContain("den Namen des Kindes NICHT in den Text schreiben");
  });

  test("asks for four options from nine years on", () => {
    const user = buildDokuPayload({ ...config, ageGroup: "9-12" }).messages[1].content;
    expect(user).toContain("mit je genau 4 Antworten");
  });
});

describe("normalizeDokuOutput", () => {
  test("keeps the reportage frame and drops unusable sections", () => {
    const out = normalizeDokuOutput(rawDoku(), config);
    expect(out.sections).toHaveLength(2);
    expect(out.sections[0].kind).toBe("station");
    expect(out.sections[0].expert).toEqual({ role: "Käsermeisterin", name: "Anna" });
    expect(out.sections[0].content).toBe("Absatz eins.\n\nAbsatz zwei.");
    expect(out.mainQuestion).toBe("Wie wird aus Milch Käse?");
    expect(out.recap).toEqual(["Punkt eins", "Punkt zwei", "Punkt drei"]);
  });

  test("caps quiz and activities at the requested size", () => {
    const out = normalizeDokuOutput(rawDoku(), config);
    const questions = out.sections.flatMap((section) => section.interactive?.quiz?.questions ?? []);
    const activities = out.sections.flatMap((section) => section.interactive?.activities?.items ?? []);
    expect(questions).toHaveLength(4);
    expect(activities).toHaveLength(1);
    expect(activities[0].safetyNote).toBeUndefined();
  });

  test("spreads the correct answers over the positions and keeps them correct", () => {
    const out = normalizeDokuOutput(rawDoku(), config);
    const questions = out.sections.flatMap((section) => section.interactive?.quiz?.questions ?? []);
    for (const entry of questions) expect(entry.options[entry.answerIndex]).toBe("Richtig");
    expect(new Set(questions.map((entry) => entry.answerIndex)).size).toBeGreaterThan(1);
  });

  test("removes praise openers from explanations, which also show after wrong answers", () => {
    const out = normalizeDokuOutput(rawDoku(), config);
    const first = out.sections[0].interactive?.quiz?.questions[0];
    expect(first?.explanation).toBe("Weil die Molke abfließt.");
    expect(first?.skillType).toBe("UNDERSTAND");
  });

  test("keeps the guess answer correct after placing it", () => {
    const out = normalizeDokuOutput(rawDoku(), config);
    expect(out.guess?.options[out.guess.answerIndex]).toBe("10 Liter");
  });

  test("toDokuContent exposes old and new frame fields only", () => {
    const content = toDokuContent({ ...rawDoku(), finale: "Altes Finale", wowFacts: ["A"], twist: "intern" }, []);
    expect(content.hook).toContain("Löffel");
    expect(content.finale).toBe("Altes Finale");
    expect(content.wowFacts).toEqual(["A"]);
    expect((content as unknown as Record<string, unknown>).twist).toBeUndefined();
  });

  test("parseDokuJson names a cut-off answer", () => {
    expect(() => parseDokuJson('{"title": "Abgeschn', "length")).toThrow(/token limit/);
    expect(parseDokuJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
});

describe("applyFactCheck", () => {
  test("replaces a quoted sentence, even with a copied render label", () => {
    const doku = normalizeDokuOutput(rawDoku(), config);
    const issues = parseFactCheckIssues({
      issues: [{ ref: "[S1.F1]", kind: "fact", quote: "Wow-Karte: Ein Fakt.", problem: "falsch", fix: "Ein richtiger Fakt." }],
    });
    const outcome = applyFactCheck(doku, issues);
    expect(doku.sections[0].keyFacts[0].fact).toBe("Ein richtiger Fakt.");
    expect(outcome.applied[0].action).toBe("replaced");
  });

  test("adds an adult note to a risky experiment instead of deleting it", () => {
    const doku = normalizeDokuOutput(rawDoku(), config);
    applyFactCheck(doku, [{ ref: "S2.A1", kind: "safety", quote: "Sicherheit: —", problem: "Glas kann brechen" }]);
    const item = doku.sections[1].interactive?.activities?.items[0];
    expect(item?.title).toBe("Milch flockt");
    expect(item?.safetyNote).toContain("Erwachsenen");
  });

  test("drops a quiz question with a wrong answer and keeps the rest", () => {
    const doku = normalizeDokuOutput(rawDoku(), config);
    applyFactCheck(doku, [{ ref: "S1.Q2", kind: "quiz", problem: "zwei Antworten richtig" }]);
    expect(doku.sections[0].interactive?.quiz?.questions.map((entry) => entry.question)).toEqual(["Frage 1?"]);
  });

  test("ignores fixes that would rewrite far more than the quote", () => {
    const doku = normalizeDokuOutput(rawDoku(), config);
    const outcome = applyFactCheck(doku, [
      { ref: "S2", kind: "fact", quote: "Erklärung.", problem: "x", fix: "Ein ganz anderer, sehr viel längerer Absatz, der alles neu schreibt und nichts mehr mit dem alten Satz zu tun hat." },
    ]);
    expect(doku.sections[1].content).toBe("Erklärung.");
    expect(outcome.skipped).toHaveLength(1);
  });
});
