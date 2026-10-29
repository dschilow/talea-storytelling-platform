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
import { fallbackModelFor, retryRequestFor, serviceTierTimeoutMs, type LlmCallResult, type LlmRequest, type StorybookLlm } from "./llm";

const DEFAULT_TIMEOUT_MS = 180_000;

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = getOpenRouterModelPricing(model, promptTokens);
  return Number(((promptTokens * pricing.inputCostPer1M + completionTokens * pricing.outputCostPer1M) / 1_000_000).toFixed(6));
}

async function callOnce(request: LlmRequest, model: string): Promise<LlmCallResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timeoutMs = serviceTierTimeoutMs(request.timeoutMs ?? DEFAULT_TIMEOUT_MS, request.serviceTier);
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
      reasoning: resolveStorybookReasoning(model, request.effort, request.role),
      includeReasoning: false,
      signal: controller.signal,
      imageInputs: request.imageInputs,
      serviceTier: request.serviceTier === "flex" ? "flex" : undefined,
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
      cachedPromptTokens: Number(data?.usage?.prompt_tokens_details?.cached_tokens) || 0,
      cacheWriteTokens: Number(data?.usage?.prompt_tokens_details?.cache_write_tokens) || 0,
      reasoningTokens: Number(data?.usage?.completion_tokens_details?.reasoning_tokens) || 0,
    },
    durationMs: Date.now() - started,
    finishReason,
    ...(typeof data?.service_tier === "string" ? { serviceTier: data.service_tier } : {}),
  };
  if (!text) {
    const error = new Error(`[storybook/llm] Empty response from ${model} (${request.stage}, finish_reason=${finishReason}, completion_tokens=${completionTokens}, reasoning_tokens=${result.usage.reasoningTokens ?? 0}, refusal=${JSON.stringify(choice?.message?.refusal ?? null)}).`);
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
  /** Budgeted pipelines count every provider request and handle failure themselves. */
  singleAttempt?: boolean;
  /** Receives every billed attempt, including failed ones, for the cost ledger. */
  onFailedAttempt?: (request: LlmRequest, billed: LlmCallResult | undefined, error: unknown) => void;
  /**
   * Pause before a flex call that the provider refused under load is tried on flex once more; 0 = straight to the
   * standard tier. "Der Riese hinterm Teig" (2026-10-26) lost a flex call in 1.9 s and paid 5.9 ¢ for its text instead of
   * 2.7 ¢ — a capacity refusal is usually gone a few seconds later.
   */
  flexRetryDelayMs?: number;
}

const DEFAULT_FLEX_RETRY_DELAY_MS = 4_000;

/**
 * A refusal for capacity: an HTTP 429/5xx answer, never billed. Timeouts and truncated answers are something else; an
 * empty answer is too, unless nothing was written and nothing charged — story ee4971ca (2026-10-27): flex answered
 * Sol's write in 1 s with zero tokens for $0, and the story paid the standard tier, 5.1 ¢ instead of ≈ 2.5 ¢.
 */
export function isFlexRefusal(error: unknown): boolean {
  const message = String((error as Error)?.message || error);
  const billed = (error as any)?.billed as LlmCallResult | undefined;
  if (billed) {
    return /Empty response/i.test(message) && /completion_tokens=0(?!\d)/.test(message) && !((billed.usage?.costUSD ?? 0) > 0);
  }
  return /OpenRouter API error (429|5\d\d)\b|capacity|unavailable|overloaded/i.test(message);
}

export function createOpenRouterStorybookLlm(options: OpenRouterPortOptions = {}): StorybookLlm {
  const standard = standardPort(options);
  const retryDelay = options.flexRetryDelayMs ?? DEFAULT_FLEX_RETRY_DELAY_MS;
  return async (request) => {
    if (options.singleAttempt) {
      try { return await callOnce(request, request.model); }
      catch (error) { options.onFailedAttempt?.(request, (error as any)?.billed, error); throw error; }
    }
    if (request.serviceTier !== "flex") return standard(request);
    try {
      return await callOnce(request, request.model);
    } catch (err) {
      options.onFailedAttempt?.(request, (err as any)?.billed, err);
      if (retryDelay > 0 && isFlexRefusal(err)) {
        console.warn(`[storybook/llm] ${request.stage}: flex refused, trying flex again in ${retryDelay / 1000}s:`, (err as Error)?.message || err);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        try {
          return await callOnce(request, request.model);
        } catch (retryError) {
          options.onFailedAttempt?.(request, (retryError as any)?.billed, retryError);
        }
      }
      // Refused twice, too slow or unusable: the same request once more on the standard tier,
      // with the usual retry chain behind it — flex never sends a story to a weaker model.
      const { serviceTier: _flex, ...plain } = request;
      console.warn(`[storybook/llm] ${request.stage}: flex call failed, repeating on the standard tier:`, (err as Error)?.message || err);
      return standard(plain);
    }
  };
}

function standardPort(options: OpenRouterPortOptions): StorybookLlm {
  return async (request) => {
    try {
      return await callOnce(request, request.model);
    } catch (err) {
      options.onFailedAttempt?.(request, (err as any)?.billed, err);
      const retry = retryRequestFor(request, err);
      console.warn(`[storybook/llm] ${request.stage}: ${request.model} failed, retrying once with ${retry.model} (effort ${retry.request.effort || "default"}):`, (err as Error)?.message || err);
      try {
        const retried = await callOnce(retry.request, retry.model);
        return retry.model === request.model ? retried : { ...retried, fallbackFrom: request.model };
      } catch (retryError) {
        options.onFailedAttempt?.({ ...retry.request, model: retry.model }, (retryError as any)?.billed, retryError);
        // The same model failed twice (Sol 6.1 answered empty three times in one batch,
        // 2026-09-30): only now does the other model write the story.
        if (retry.model === request.model) {
          const last = retryRequestFor({ ...retry.request, effort: "low" }, new Error("Truncated"));
          const lastModel = request.fallbackModel || fallbackModelFor(request.model);
          console.warn(`[storybook/llm] ${request.stage}: ${request.model} failed twice, last try with ${lastModel}:`, (retryError as Error)?.message || retryError);
          try {
            const finalTry = await callOnce({ ...retry.request, maxTokens: last.request.maxTokens }, lastModel);
            return { ...finalTry, fallbackFrom: request.model };
          } catch (finalError) {
            options.onFailedAttempt?.({ ...retry.request, model: lastModel }, (finalError as any)?.billed, finalError);
            throw finalError;
          }
        }
        throw retryError;
      }
    }
  };
}
