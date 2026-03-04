// @ts-ignore - bun runtime test module
import { describe, expect, test } from "bun:test";
import {
  applyConfidenceDecay,
  buildLongTailTopicId,
  computeMasteryDelta,
  computeQuizConfidenceDelta,
  computeQuizEvolutionDelta,
  computeRecallConfidenceDelta,
  computeStageTransitionEvolutionBonus,
  computeTopicStage,
  derivePlanetLevel,
  matchTopicV1,
  rollingAvg,
  sanitizeTopicStats,
  updateRollingWindow,
} from "./cosmos-mvp-logic";

describe("cosmos-mvp-logic", () => {
  test("builds deterministic longtail topic id", () => {
    const topicId = buildLongTailTopicId("space", "Unser Sonnensystem!");
    expect(topicId).toBe("space_unser_sonnensystem");
  });

  test("matches canonical topic by alias", () => {
    const result = matchTopicV1({
      domainId: "space",
      requestedTitle: "Planeten",
      candidates: [
        {
          topicId: "space_solar_system",
          title: "Sonnensystem",
          aliases: ["Planeten", "Unser Sonnensystem"],
        },
      ],
      threshold: 0.72,
    });

    expect(result.topicKind).toBe("canonical");
    expect(result.topicId).toBe("space_solar_system");
    expect(result.matching.strategy).toBe("alias_lookup");
  });

  test("falls back to longtail when canonical match is weak", () => {
    const result = matchTopicV1({
      domainId: "nature",
      requestedTitle: "Pilze im Wald",
      candidates: [
        {
          topicId: "nature_sharks",
          title: "Haie",
          aliases: ["Meeresraubtiere"],
        },
      ],
      threshold: 0.82,
    });

    expect(result.topicKind).toBe("longTail");
    expect(result.topicId.startsWith("nature_")).toBe(true);
  });

  test("computes mastery delta with damping", () => {
    const deltaLowMastery = computeMasteryDelta({
      mastery: 10,
      overallAccuracy: 0.8,
      skillStats: {
        understand: { correct: 4, total: 5 },
        apply: { correct: 3, total: 4 },
      },
    });
    const deltaHighMastery = computeMasteryDelta({
      mastery: 90,
      overallAccuracy: 0.8,
      skillStats: {
        understand: { correct: 4, total: 5 },
        apply: { correct: 3, total: 4 },
      },
    });

    expect(deltaLowMastery).toBeGreaterThan(deltaHighMastery);
    expect(deltaLowMastery).toBeGreaterThan(0);
  });

  test("computes confidence deltas for quiz and recall", () => {
    expect(computeQuizConfidenceDelta(1)).toBe(1.5);
    expect(computeQuizConfidenceDelta(0.5)).toBe(0.75);

    expect(computeRecallConfidenceDelta(1)).toBe(10);
    expect(computeRecallConfidenceDelta(0.6)).toBe(2);
  });

  test("applies soft confidence decay for overdue recall", () => {
    expect(applyConfidenceDecay(80, 2)).toBe(76);
    expect(applyConfidenceDecay(3, 4)).toBe(0);
  });

  test("rolling window keeps max size and correct average", () => {
    let window: number[] = [];
    window = updateRollingWindow(window, 0.8, 3);
    window = updateRollingWindow(window, 0.6, 3);
    window = updateRollingWindow(window, 1.0, 3);
    window = updateRollingWindow(window, 0.4, 3);

    expect(window.length).toBe(3);
    expect(window).toEqual([0.6, 1.0, 0.4]);
    expect(rollingAvg(window)).toBeCloseTo(0.6666, 3);
  });

  test("stage rules are age aware", () => {
    const stage46 = computeTopicStage({
      ageBand: "4-6",
      quizSessionsCount: 2,
      understandRollingAvg: 0.72,
      applyTransferSessionsCount: 3,
      applyTransferRollingAvg: 0.9,
      recallPassedCount: 0,
      confidence: 55,
      hasAnyActivity: true,
    });
    const stage712 = computeTopicStage({
      ageBand: "7-12",
      quizSessionsCount: 2,
      understandRollingAvg: 0.72,
      applyTransferSessionsCount: 2,
      applyTransferRollingAvg: 0.74,
      recallPassedCount: 0,
      confidence: 55,
      hasAnyActivity: true,
    });

    expect(stage46).toBe("understood");
    expect(stage712).toBe("apply");
  });

  test("retained requires recall pass and confidence", () => {
    const stage = computeTopicStage({
      ageBand: "7-12",
      quizSessionsCount: 5,
      understandRollingAvg: 0.8,
      applyTransferSessionsCount: 3,
      applyTransferRollingAvg: 0.8,
      recallPassedCount: 1,
      confidence: 71,
      hasAnyActivity: true,
    });
    expect(stage).toBe("retained");
  });

  test("evolution helper functions", () => {
    expect(computeQuizEvolutionDelta(0.2)).toBe(1);
    expect(computeQuizEvolutionDelta(0.9)).toBe(3);

    expect(derivePlanetLevel(0)).toBe(1);
    expect(derivePlanetLevel(25)).toBe(2);
    expect(derivePlanetLevel(1249)).toBe(50);
  });

  test("stage transition bonus only on forward progress", () => {
    expect(
      computeStageTransitionEvolutionBonus({
        previousStage: "discovered",
        nextStage: "understood",
        ageBand: "7-12",
      })
    ).toBe(10);

    expect(
      computeStageTransitionEvolutionBonus({
        previousStage: "apply",
        nextStage: "understood",
        ageBand: "7-12",
      })
    ).toBe(0);
  });

  test("stats sanitization keeps only safe values", () => {
    const sanitized = sanitizeTopicStats({
      quizSessionsCount: "3",
      recallPassedCount: -4,
      understandAccWindow: [1.2, 0.7, "x"],
    });

    expect(sanitized.quizSessionsCount).toBe(3);
    expect(sanitized.recallPassedCount).toBe(0);
    expect(sanitized.understandAccWindow).toEqual([1, 0.7]);
  });
});
