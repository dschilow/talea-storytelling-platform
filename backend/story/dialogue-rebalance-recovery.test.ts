// @ts-ignore Bun exposes this runtime-only test helper without Node typings.
import { describe, expect, test } from "bun:test";
import { recoverTruncatedReplacementsPayload } from "./provider-output-recovery";
import truncatedRebalances from "./__fixtures__/truncated-dialogue-rebalance.json";

/**
 * Fixtures are the verbatim `rawContent` of two dialogue-rebalance calls from
 * production run 69dace41 ("Alexander und der Brunnen der lauten Launen").
 *
 * Both were writer-model calls (moonshotai/kimi-k2.6) whose entire output was
 * discarded because JSON.parse threw:
 *   - unterminated-string: the model used `\"` as the German closing quote and
 *     never terminated the final string (2550 completion tokens, ~$0.011)
 *   - completion-ceiling: cut off mid-array at exactly maxTokens=4200
 *     (4200 completion tokens, ~$0.016)
 *
 * Together that was 28% of the story's LLM bill spent on nothing. Both payloads
 * still contain complete rewritten pages before the break.
 */
const fixtures = Object.entries(truncatedRebalances as Record<string, string>);

describe("recoverTruncatedReplacementsPayload", () => {
  test("has fixtures from real discarded production calls", () => {
    expect(fixtures.length).toBe(2);
  });

  for (const [run, rawContent] of fixtures) {
    describe(run, () => {
      test("raw payload is genuinely unparseable", () => {
        expect(() => JSON.parse(rawContent)).toThrow();
      });

      test("recovers the pages completed before the break", () => {
        const recovered = recoverTruncatedReplacementsPayload(rawContent);
        expect(recovered).not.toBeNull();
        expect(recovered.recoveredFromTruncatedJson).toBe(true);
        expect(recovered.recoveredReplacementCount).toBeGreaterThanOrEqual(3);
      });

      test("recovered pages carry an order and real prose", () => {
        const { replacements } = recoverTruncatedReplacementsPayload(rawContent);
        for (const page of replacements) {
          expect(Number.isFinite(Number(page.order))).toBe(true);
          const paragraphs: string[] = page.paragraphs || [];
          expect(paragraphs.length).toBeGreaterThan(0);
          expect(paragraphs.join(" ").length).toBeGreaterThan(120);
        }
      });

      test("recovered orders are unique and ascending", () => {
        const { replacements } = recoverTruncatedReplacementsPayload(rawContent);
        const orders = replacements.map((page: any) => Number(page.order));
        expect(new Set(orders).size).toBe(orders.length);
        expect([...orders].sort((a, b) => a - b)).toEqual(orders);
      });
    });
  }

  test("recovers page objects from a `chapters`-shaped payload too", () => {
    const raw = '{"chapters": [{"order": 1, "paragraphs": ["Erster Satz.", "Zweiter Satz."]}, {"order": 2, "para';
    const recovered = recoverTruncatedReplacementsPayload(raw);
    expect(recovered.recoveredReplacementCount).toBe(1);
    expect(recovered.replacements[0].order).toBe(1);
  });

  test("returns null when nothing usable survived", () => {
    expect(recoverTruncatedReplacementsPayload("")).toBeNull();
    expect(recoverTruncatedReplacementsPayload("not json at all")).toBeNull();
    expect(recoverTruncatedReplacementsPayload('{"replacements": [')).toBeNull();
    // Complete object, but no order and no prose -> not applicable downstream.
    expect(recoverTruncatedReplacementsPayload('{"replacements": [{"paragraphs": []}]')).toBeNull();
  });
});
