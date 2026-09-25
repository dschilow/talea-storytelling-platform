/**
 * Production implementation of the storybook LLM port (OpenRouter).
 *
 * One retry policy for every stage: when a model returns nothing usable (HTTP
 * error, empty, truncated, timeout) the same request goes ONCE to the model of
 * the other family. The ledger records both attempts' real cost.
 */

import {
  callOpenRouterChatCompletion,
  extractOpenRouterCostUSD,
  getOpenRouterModelPricing,
} from "../openrouter-generation";
import { acceptsTemperature, extractStorybookChoiceContent, isTruncatedFinishReason, resolveStorybookReasoning } from "./llm-guards";
import { fallbackModelFor, type LlmCallResult, type LlmRequest, type StorybookLlm } from "./llm";

const DEFAULT_TIMEOUT_MS = 180_000;

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = getOpenRouterModelPricing(model);
  return Number(((promptTokens * pricing.inputCostPer1M + completionTokens * pricing.outputCostPer1M) / 1_000_000).toFixed(6));
}

async function callOnce(request: LlmRequest, model: string): Promise<LlmCallResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Awaited<ReturnType<typeof callOpenRouterChatCompletion>>;
  try {
    response = await callOpenRouterChatCompletion({
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
      model,
      responseFormat: request.json ? "json_object" : "text",
      maxTokens: request.maxTokens,
      temperature: acceptsTemperature(model) ? request.temperature : undefined,
      reasoning: resolveStorybookReasoning(model, request.effort),
      includeReasoning: false,
      signal: controller.signal,
      imageInputs: request.imageInputs,
    });
  } catch (err) {
    if ((err as any)?.name === "AbortError") throw new Error(`[storybook/llm] ${model} timed out after ${timeoutMs / 1000}s (${request.stage}).`);
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const { data } = response;
  const choice = data?.choices?.[0];
  const finishReason = String(choice?.finish_reason || "unknown");
  const text = extractStorybookChoiceContent(choice);
  const promptTokens = Number(data?.usage?.prompt_tokens) || 0;
  const completionTokens = Number(data?.usage?.completion_tokens) || 0;
  const reported = extractOpenRouterCostUSD(data);
  const result: LlmCallResult = {
    text,
    modelUsed: response.model || model,
    usage: {
      prompt: promptTokens,
      completion: completionTokens,
      total: Number(data?.usage?.total_tokens) || promptTokens + completionTokens,
      costUSD: reported ?? estimateCost(model, promptTokens, completionTokens),
    },
    durationMs: Date.now() - started,
    finishReason,
  };
  if (!text) {
    const error = new Error(`[storybook/llm] Empty response from ${model} (${request.stage}, finish_reason=${finishReason}, completion_tokens=${completionTokens}).`);
    (error as any).billed = result;
    throw error;
  }
  if (isTruncatedFinishReason(finishReason)) {
    const error = new Error(`[storybook/llm] Truncated response from ${model} (${request.stage}, max_tokens=${request.maxTokens}).`);
    (error as any).billed = result;
    throw error;
  }
  return result;
}

export interface OpenRouterPortOptions {
  /** Receives every billed attempt, including failed ones, for the cost ledger. */
  onFailedAttempt?: (request: LlmRequest, billed: LlmCallResult | undefined, error: unknown) => void;
}

export function createOpenRouterStorybookLlm(options: OpenRouterPortOptions = {}): StorybookLlm {
  return async (request) => {
    try {
      return await callOnce(request, request.model);
    } catch (err) {
      options.onFailedAttempt?.(request, (err as any)?.billed, err);
      const fallback = fallbackModelFor(request.model);
      console.warn(`[storybook/llm] ${request.stage}: ${request.model} failed, retrying once with ${fallback}:`, (err as Error)?.message || err);
      // A truncated answer gets more room; everything else the same request.
      const truncated = /Truncated response/.test(String((err as Error)?.message || ""));
      const retried = await callOnce(
        { ...request, maxTokens: truncated ? Math.ceil(request.maxTokens * 1.5) : request.maxTokens },
        fallback
      );
      return { ...retried, fallbackFrom: request.model };
    }
  };
}
