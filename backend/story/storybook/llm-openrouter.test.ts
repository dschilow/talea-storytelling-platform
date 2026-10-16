// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, mock, test } from "bun:test";

// The OpenRouter call is replaced: flex can be refused, the standard tier always answers.
const calls: Array<{ serviceTier?: string; model: string }> = [];
let refuseFlex = true;
mock.module("../openrouter-generation", () => ({
  callOpenRouterChatCompletion: async (input: { serviceTier?: string; model: string }) => {
    calls.push({ serviceTier: input.serviceTier, model: input.model });
    if (input.serviceTier === "flex" && refuseFlex) throw new Error("OpenRouter API error 429: flex capacity unavailable");
    return {
      data: { choices: [{ finish_reason: "stop", message: { content: "Es war einmal." } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cost: 0.001 }, service_tier: input.serviceTier || "default" },
      request: {},
      model: input.model,
    };
  },
  extractOpenRouterCostUSD: (data: any) => data?.usage?.cost ?? null,
  getOpenRouterModelPricing: () => ({ inputCostPer1M: 1, outputCostPer1M: 1 }),
}));

const { createOpenRouterStorybookLlm } = await import("./llm-openrouter");
const request = { stage: "book-chapters-2-4", role: "writer" as const, model: "openai/gpt-6.1-sol", system: "s", user: "u", json: false, maxTokens: 100, serviceTier: "flex" as const };

describe("flex tier (2026-10-16)", () => {
  test("a refused flex call is repeated once on the standard tier with the same model", async () => {
    calls.length = 0;
    refuseFlex = true;
    const failed: string[] = [];
    const llm = createOpenRouterStorybookLlm({ onFailedAttempt: (failedRequest) => failed.push(failedRequest.serviceTier || "standard") });
    const result = await llm(request);
    expect(calls).toEqual([{ serviceTier: "flex", model: "openai/gpt-6.1-sol" }, { serviceTier: undefined, model: "openai/gpt-6.1-sol" }]);
    expect(failed).toEqual(["flex"]);
    expect(result.serviceTier).toBe("default");
    expect(result.text).toBe("Es war einmal.");
  });
  test("a served flex call reports its tier and costs one call", async () => {
    calls.length = 0;
    refuseFlex = false;
    const result = await createOpenRouterStorybookLlm()(request);
    expect(calls).toHaveLength(1);
    expect(result.serviceTier).toBe("flex");
  });
});
