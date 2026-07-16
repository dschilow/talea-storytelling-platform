import { describe, expect, test } from "bun:test";
import { classifyMemory, sanitizeMemoryText } from "./memory-ranking";

describe("memory ranking", () => {
  test("keeps a small acute event in working memory", () => {
    const result = classifyMemory({
      storyTitle: "Der Waldweg",
      experience: "Ein kurzer mutiger Moment.",
      emotionalImpact: "neutral",
      personalityChanges: [{ trait: "courage", change: 1 }],
      developmentDescription: "[ACUTE] kurzer Moment",
      contentType: "story",
    });

    expect(result.tier).toBe("working");
    expect(result.importance).toBe(1);
    expect(result.tags).toEqual(["story", "courage"]);
  });

  test("promotes identity-shaping events to core memory", () => {
    const result = classifyMemory({
      storyTitle: "Das Versprechen",
      experience: "Sie halfen einander und hielten ihr Versprechen.",
      emotionalImpact: "positive",
      personalityChanges: [
        { trait: "empathy", change: 4 },
        { trait: "teamwork", change: 3 },
      ],
      developmentDescription: "PERSONALITY: wichtiges Versprechen",
      contentType: "story",
    });

    expect(result.tier).toBe("core");
    expect(result.importance).toBe(5);
    expect(result.tags).toEqual(["story", "empathy", "teamwork"]);
  });
  test("keeps a normal production story development episodic", () => {
    const result = classifyMemory({
      storyTitle: "Der neue Weg",
      experience: "Der Avatar hat geduldig nach einer Lösung gesucht.",
      emotionalImpact: "positive",
      personalityChanges: [{ trait: "persistence", change: 2 }],
      developmentDescription: "Persoenlichkeitsentwicklung: Geduldig weitergemacht",
      contentType: "story",
    });

    expect(result.tier).toBe("episodic");
    expect(result.importance).toBe(4);
  });

  test("recognizes strong production developments as long-term memories", () => {
    const result = classifyMemory({
      storyTitle: "Das große Versprechen",
      experience: "Der Avatar hat Verantwortung für die Gruppe übernommen.",
      emotionalImpact: "positive",
      personalityChanges: [
        { trait: "empathy", change: 4 },
        { trait: "teamwork", change: 3 },
      ],
      developmentDescription: "Persoenlichkeitsentwicklung: Verantwortung übernommen",
      contentType: "story",
    });

    expect(result.tier).toBe("core");
    expect(result.importance).toBe(5);
  });


  test("sanitizes control characters and caps prompt text", () => {
    expect(sanitizeMemoryText(" Hallo\n\tWelt ", 11)).toBe("Hallo Welt");
  });
});
