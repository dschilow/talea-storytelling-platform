// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { afterEach, describe, expect, mock, test } from "bun:test";
import { providerSafetyReason, StorybookSafetyBlock } from "./llm-guards";

// The OpenRouter call is replaced: flex can be refused, the standard tier always answers.
const calls: Array<{ serviceTier?: string; model: string }> = [];
/** How many flex calls the provider refuses before it serves one. */
let flexRefusals = Infinity;
const supplied: Array<{ data?: unknown; error?: Error }> = [];
afterEach(() => { supplied.length = 0; });
mock.module("../openrouter-generation", () => ({
  callOpenRouterChatCompletion: async (input: { serviceTier?: string; model: string }) => {
    calls.push({ serviceTier: input.serviceTier, model: input.model });
    const next = supplied.shift();
    if (next?.error) throw next.error;
    if (next) return { data: next.data, request: {}, model: input.model };
    if (input.serviceTier === "flex" && flexRefusals-- > 0) throw new Error("OpenRouter API error 429: flex capacity unavailable");
    return {
      data: { choices: [{ finish_reason: "stop", message: { content: "Es war einmal." } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cost: 0.001 }, service_tier: input.serviceTier || "default" },
      request: {},
      model: input.model,
    };
  },
  extractOpenRouterCostUSD: (data: any) => data?.usage?.cost ?? null,
  getOpenRouterModelPricing: () => ({ inputCostPer1M: 1, outputCostPer1M: 1 }),
}));

const { createOpenRouterStorybookLlm, isFlexRefusal } = await import("./llm-openrouter");
const request = { stage: "book-chapters-2-4", role: "writer" as const, model: "openai/gpt-6.1-sol", system: "s", user: "u", json: false, maxTokens: 100, serviceTier: "flex" as const };

describe("flex tier (2026-10-16)", () => {
  test("a budgeted pipeline makes one attempt and reports failure without hidden retries", async () => {
    calls.length = 0;
    flexRefusals = Infinity;
    const failed: string[] = [];
    const llm = createOpenRouterStorybookLlm({ singleAttempt: true, onFailedAttempt: r => failed.push(r.stage) });
    await expect(llm(request)).rejects.toThrow('capacity');
    expect(calls).toHaveLength(1);
    expect(failed).toEqual([request.stage]);
  });

  describe("explicit provider blocks", () => {
    const blocked = { choices: [{ finish_reason: "error", native_finish_reason: "SAFETY", message: { refusal: null } }] };

    test("recognises native and top-level blocks but not ordinary empty replies, quota or authentication errors", () => {
      expect(providerSafetyReason(blocked)).toBe("SAFETY");
      expect(providerSafetyReason({ error: { code: 403, message: "Gemini blocked the request: PROHIBITED_CONTENT" } })).toBe("PROHIBITED_CONTENT");
      expect(providerSafetyReason({ choices: [{ finish_reason: "content_filter" }] })).toBe("CONTENT_FILTER");
      expect(providerSafetyReason({ choices: [{ message: { refusal: "I cannot process this request." } }] })).toBe("REFUSAL");
      expect(providerSafetyReason({ choices: [{ finish_reason: "error", message: { refusal: null } }] })).toBeUndefined();
      expect(providerSafetyReason({ error: { code: 403, message: "Account permission missing" } })).toBeUndefined();
      expect(providerSafetyReason(new Error("OpenRouter API error 429: quota exhausted"))).toBeUndefined();
    });

    for (const serviceTier of ["flex", undefined] as const) {
      test(`a native safety block on ${serviceTier || "standard"} is reported once without tier or model fallback`, async () => {
        calls.length = 0;
        flexRefusals = 0;
        supplied.push({ data: blocked });
        const failures: unknown[] = [];
        await expect(createOpenRouterStorybookLlm({ flexRetryDelayMs: 1, onFailedAttempt: (_r, _b, error) => failures.push(error) })({ ...request, serviceTier }))
          .rejects.toThrow("provider_reason=SAFETY");
        expect(calls).toHaveLength(1);
        expect(failures).toHaveLength(1);
        expect(failures[0]).toBeInstanceOf(StorybookSafetyBlock);
        expect(isFlexRefusal(failures[0])).toBe(false);
      });
    }

    test("an HTTP block keeps a bounded reason instead of a raw provider payload", async () => {
      calls.length = 0;
      supplied.push({ error: new Error('OpenRouter API error 403: {"error":{"message":"PROHIBITED_CONTENT","metadata":{"raw":"https://private.example/ref?token=never-log"}}}') });
      const errors: unknown[] = [];
      await expect(createOpenRouterStorybookLlm({ onFailedAttempt: (_r, _b, error) => errors.push(error) })(request)).rejects.toThrow("PROHIBITED_CONTENT");
      expect(calls).toHaveLength(1);
      expect(String(errors[0])).not.toContain("never-log");
    });

    test("a block on the second flex attempt stops before the standard tier", async () => {
      calls.length = 0;
      supplied.push({ error: new Error("OpenRouter API error 429: capacity unavailable") }, { data: blocked });
      await expect(createOpenRouterStorybookLlm({ flexRetryDelayMs: 1 })(request)).rejects.toThrow("provider_reason=SAFETY");
      expect(calls.map(c => c.serviceTier)).toEqual(["flex", "flex"]);
    });

    test("a blocked retried completion never invokes a third model", async () => {
      calls.length = 0;
      supplied.push({ data: { choices: [{ finish_reason: "stop", message: { content: "" } }] } }, { data: blocked });
      await expect(createOpenRouterStorybookLlm()({ ...request, serviceTier: undefined })).rejects.toThrow("provider_reason=SAFETY");
      expect(calls).toHaveLength(2);
    });

    test("a top-level HTTP-200 error is not mistaken for a free empty completion", async () => {
      calls.length = 0;
      supplied.push({ data: { error: { code: 403, message: "Gemini blocked the request: PROHIBITED_CONTENT" } } });
      await expect(createOpenRouterStorybookLlm()(request)).rejects.toThrow("provider_reason=PROHIBITED_CONTENT");
      expect(calls).toHaveLength(1);
    });
    test("a refused response preserves a reported charge in the failed-attempt ledger", async () => {
      calls.length = 0;
      supplied.push({ data: { ...blocked, usage: { prompt_tokens: 120, completion_tokens: 20, total_tokens: 140, cost: 0.002 } } });
      const costs: number[] = [];
      await expect(createOpenRouterStorybookLlm({ onFailedAttempt: (_r, billed) => { if (billed) costs.push(billed.usage.costUSD); } })(request))
        .rejects.toThrow("provider_reason=SAFETY");
      expect(costs).toEqual([0.002]);
      expect(calls).toHaveLength(1);
    });
  });
  test("a refused flex call is repeated once on the standard tier with the same model", async () => {
    calls.length = 0;
    flexRefusals = Infinity;
    const failed: string[] = [];
    const llm = createOpenRouterStorybookLlm({ flexRetryDelayMs: 0, onFailedAttempt: (failedRequest) => failed.push(failedRequest.serviceTier || "standard") });
    const result = await llm(request);
    expect(calls).toEqual([{ serviceTier: "flex", model: "openai/gpt-6.1-sol" }, { serviceTier: undefined, model: "openai/gpt-6.1-sol" }]);
    expect(failed).toEqual(["flex"]);
    expect(result.serviceTier).toBe("default");
    expect(result.text).toBe("Es war einmal.");
  });
  test("a served flex call reports its tier and costs one call", async () => {
    calls.length = 0;
    flexRefusals = 0;
    const result = await createOpenRouterStorybookLlm()(request);
    expect(calls).toHaveLength(1);
    expect(result.serviceTier).toBe("flex");
  });
  test("a flex call refused once under load is tried on flex again before the standard tier is paid", async () => {
    calls.length = 0;
    flexRefusals = 1;
    const failed: string[] = [];
    const result = await createOpenRouterStorybookLlm({ flexRetryDelayMs: 1, onFailedAttempt: (failedRequest) => failed.push(failedRequest.serviceTier || "standard") })(request);
    expect(calls).toEqual([{ serviceTier: "flex", model: "openai/gpt-6.1-sol" }, { serviceTier: "flex", model: "openai/gpt-6.1-sol" }]);
    expect(failed).toEqual(["flex"]);
    expect(result.serviceTier).toBe("flex");
  });
  test("a flex call refused twice goes to the standard tier after exactly one flex retry", async () => {
    calls.length = 0;
    flexRefusals = Infinity;
    const result = await createOpenRouterStorybookLlm({ flexRetryDelayMs: 1 })(request);
    expect(calls.map((call) => call.serviceTier)).toEqual(["flex", "flex", undefined]);
    expect(result.serviceTier).toBe("default");
  });
  test("only capacity refusals are worth a second flex try", () => {
    expect(isFlexRefusal(new Error("OpenRouter API error 429: flex capacity unavailable"))).toBe(true);
    expect(isFlexRefusal(new Error("OpenRouter API error 503: upstream down"))).toBe(true);
    expect(isFlexRefusal(new Error("[storybook/llm] openai/gpt-6.1-sol timed out after 840s (episode-oneshot)."))).toBe(false);
    expect(isFlexRefusal(Object.assign(new Error("Empty response (capacity)"), { billed: { text: "" } }))).toBe(false);
    // Story ee4971ca: nothing written, nothing charged, after 1 s — a capacity blip like a 429.
    const instant = "[storybook/llm] Empty response from openai/gpt-6.1-sol (episode-write, finish_reason=unknown, completion_tokens=0, reasoning_tokens=0, refusal=null).";
    expect(isFlexRefusal(Object.assign(new Error(instant), { billed: { text: "", usage: { prompt: 0, completion: 0, total: 0, costUSD: 0 } } }))).toBe(true);
    // Paid tokens that came back empty are not retried on flex.
    expect(isFlexRefusal(Object.assign(new Error(instant), { billed: { text: "", usage: { prompt: 7000, completion: 0, total: 7000, costUSD: 0.004 } } }))).toBe(false);
    expect(isFlexRefusal(Object.assign(new Error(instant.replace("completion_tokens=0", "completion_tokens=3500")), { billed: { text: "" } }))).toBe(false);
  });
});
