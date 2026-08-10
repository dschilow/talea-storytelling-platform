/**
 * Storybook Pipeline — LLM access with cost accounting.
 *
 * Two roles, on purpose:
 *
 *   SUPPORT  — normally gpt-5.6-luna. Planning, judging, developments. Cheap,
 *              strong enough for structured JSON, and after the 2026-07-31
 *              price cut the best reasoning-per-dollar in the catalogue.
 *   WRITER   — whatever the wizard selected. The prose voice stays a product
 *              decision, not a pipeline decision.
 *
 * Every call reports provider-side cost (`usage.cost`), which is authoritative
 * and already includes promotions and provider routing.
 */

import {
  callOpenRouterChatCompletion,
  extractOpenRouterCostUSD,
  getOpenRouterModelPricing,
  isOpenRouterModelId,
  splitOpenRouterCostUSD,
} from "../openrouter-generation";
import { generateWithGemini, isGeminiConfigured } from "../gemini-generation";
import { resolveConfiguredStoryModel } from "../pipeline/model-routing";
import type { StoryConfig } from "../generate";
import type { StorybookStageLog } from "./types";
import {
  extractStorybookChoiceContent,
  isTruncatedFinishReason,
  resolveStorybookReasoning,
} from "./llm-guards";

export {
  extractStorybookChoiceContent,
  isTruncatedFinishReason,
  resolveStorybookReasoning,
} from "./llm-guards";

/** Fixed for every support task in this pipeline. */
export const STORYBOOK_SUPPORT_MODEL = "openai/gpt-5.6-luna";
/** Used only after the normal support model returned no usable completion. */
export const STORYBOOK_SUPPORT_FALLBACK_MODEL = "openai/gpt-5.4-mini";

const SUPPORT_TIMEOUT_MS = 120_000;
const WRITER_TIMEOUT_MS = 240_000;

export interface LlmCallResult {
  text: string;
  modelUsed: string;
  usage: { prompt: number; completion: number; total: number; costUSD: number };
  durationMs: number;
  finishReason?: string;
}

export class CostLedger {
  private readonly stages: StorybookStageLog[] = [];

  record(entry: StorybookStageLog): void {
    this.stages.push(entry);
  }

  recordCall(stage: string, role: "support" | "selected-story", result: LlmCallResult, note?: string): void {
    this.stages.push({
      stage,
      modelUsed: result.modelUsed,
      modelRole: role,
      durationMs: result.durationMs,
      usage: {
        prompt: result.usage.prompt,
        completion: result.usage.completion,
        total: result.usage.total,
        costUSD: result.usage.costUSD,
      },
      note,
    });
  }

  all(): StorybookStageLog[] {
    return this.stages;
  }

  totals(): { prompt: number; completion: number; total: number; costUSD: number; calls: number } {
    return this.stages.reduce(
      (acc, stage) => {
        if (!stage.usage) return acc;
        return {
          prompt: acc.prompt + (stage.usage.prompt || 0),
          completion: acc.completion + (stage.usage.completion || 0),
          total: acc.total + (stage.usage.total || 0),
          costUSD: Number((acc.costUSD + (stage.usage.costUSD || 0)).toFixed(6)),
          calls: acc.calls + 1,
        };
      },
      { prompt: 0, completion: 0, total: 0, costUSD: 0, calls: 0 }
    );
  }
}

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = getOpenRouterModelPricing(model);
  return Number(
    ((promptTokens * pricing.inputCostPer1M) / 1_000_000 +
      (completionTokens * pricing.outputCostPer1M) / 1_000_000).toFixed(6)
  );
}

/** Resolves the wizard-selected prose model. Support tasks never use this. */
export function resolveWriterModel(config: StoryConfig): string {
  return resolveConfiguredStoryModel({
    aiProvider: config.aiProvider,
    aiModel: config.aiModel,
    openRouterModel: config.openRouterModel,
  });
}

async function callOpenRouter(input: {
  system: string;
  user: string;
  model: string;
  json: boolean;
  maxTokens: number;
  temperature?: number;
  timeoutMs?: number;
}): Promise<LlmCallResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timeoutMs = input.timeoutMs ?? SUPPORT_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Awaited<ReturnType<typeof callOpenRouterChatCompletion>>;
  try {
    response = await callOpenRouterChatCompletion({
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
      model: input.model,
      responseFormat: input.json ? "json_object" : "text",
      maxTokens: input.maxTokens,
      temperature: input.temperature,
      reasoning: resolveStorybookReasoning(input.model),
      includeReasoning: false,
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as any)?.name === "AbortError") {
      throw new Error(`[storybook/llm] ${input.model} timed out after ${timeoutMs / 1000}s.`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const { data, model } = response;
  const choice = data?.choices?.[0];
  const finishReason = String(choice?.finish_reason || "unknown");
  const text = extractStorybookChoiceContent(choice);
  if (!text) {
    throw new Error(
      `[storybook/llm] Empty response from ${model} (finish_reason=${finishReason}, completion_tokens=${Number(data?.usage?.completion_tokens) || 0}).`
    );
  }
  if (isTruncatedFinishReason(finishReason)) {
    throw new Error(
      `[storybook/llm] Truncated response from ${model} (finish_reason=${finishReason}, max_tokens=${input.maxTokens}).`
    );
  }
  const promptTokens = Number(data?.usage?.prompt_tokens) || 0;
  const completionTokens = Number(data?.usage?.completion_tokens) || 0;
  const reported = extractOpenRouterCostUSD(data);

  return {
    text,
    modelUsed: model,
    usage: {
      prompt: promptTokens,
      completion: completionTokens,
      total: Number(data?.usage?.total_tokens) || promptTokens + completionTokens,
      costUSD: reported ?? estimateCost(model, promptTokens, completionTokens),
    },
    durationMs: Date.now() - started,
    finishReason,
  };
}

async function callGemini(input: {
  system: string;
  user: string;
  model: string;
  json: boolean;
  maxTokens: number;
}): Promise<LlmCallResult> {
  const started = Date.now();
  const result = await generateWithGemini({
    systemPrompt: input.system,
    userPrompt: input.user,
    model: input.model,
    maxTokens: input.maxTokens,
    logSource: "storybook-generation",
  });

  const promptTokens = Number(result?.usage?.promptTokens) || 0;
  const completionTokens = Number(result?.usage?.completionTokens) || 0;

  return {
    text: String(result?.content || ""),
    modelUsed: result?.model || input.model,
    usage: {
      prompt: promptTokens,
      completion: completionTokens,
      total: Number(result?.usage?.totalTokens) || promptTokens + completionTokens,
      costUSD: estimateCost(input.model, promptTokens, completionTokens),
    },
    durationMs: Date.now() - started,
  };
}

/** Support-role call. Always gpt-5.6-luna, always JSON unless told otherwise. */
export async function callSupport(input: {
  system: string;
  user: string;
  maxTokens?: number;
  json?: boolean;
  temperature?: number;
  model?: string;
  timeoutMs?: number;
}): Promise<LlmCallResult> {
  return callOpenRouter({
    system: input.system,
    user: input.user,
    model: input.model || STORYBOOK_SUPPORT_MODEL,
    json: input.json !== false,
    maxTokens: input.maxTokens ?? 1400,
    temperature: input.temperature ?? 0.6,
    timeoutMs: input.timeoutMs ?? SUPPORT_TIMEOUT_MS,
  });
}

/** Writer-role call. Uses the wizard model; falls back to support on failure. */
export async function callWriter(input: {
  system: string;
  user: string;
  model: string;
  maxTokens?: number;
  json?: boolean;
  temperature?: number;
}): Promise<LlmCallResult> {
  const maxTokens = input.maxTokens ?? 3200;

  if (isOpenRouterModelId(input.model)) {
    try {
      return await callOpenRouter({
        system: input.system,
        user: input.user,
        model: input.model,
        json: input.json === true,
        maxTokens,
        temperature: input.temperature ?? 0.85,
        timeoutMs: WRITER_TIMEOUT_MS,
      });
    } catch (err) {
      const fallbackModel = input.model === STORYBOOK_SUPPORT_MODEL
        ? STORYBOOK_SUPPORT_FALLBACK_MODEL
        : STORYBOOK_SUPPORT_MODEL;
      console.warn(
        `[storybook/llm] OpenRouter writer ${input.model} failed; retrying once with ${fallbackModel}:`,
        err
      );
      return callOpenRouter({
        system: input.system,
        user: input.user,
        model: fallbackModel,
        json: input.json === true,
        maxTokens,
        temperature: input.temperature ?? 0.85,
        timeoutMs: WRITER_TIMEOUT_MS,
      });
    }
  }

  if (isGeminiConfigured()) {
    try {
      return await callGemini({
        system: input.system,
        user: input.user,
        model: input.model,
        json: input.json === true,
        maxTokens,
      });
    } catch (err) {
      console.warn("[storybook/llm] Gemini writer call failed, falling back to support model:", err);
    }
  }

  return callOpenRouter({
    system: input.system,
    user: input.user,
    model: STORYBOOK_SUPPORT_MODEL,
    json: input.json === true,
    maxTokens,
    temperature: input.temperature ?? 0.85,
    timeoutMs: WRITER_TIMEOUT_MS,
  });
}

/**
 * Parses a JSON object out of a model response. Models occasionally wrap JSON
 * in prose or fences even when asked not to, and a whole generation should not
 * die because of a stray ``` — so we recover rather than throw.
 */
export function parseJsonObject<T>(raw: string): T | null {
  const text = String(raw || "").trim();
  if (!text) return null;

  const attempts: string[] = [text];

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) attempts.push(fenced[1].trim());

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    attempts.push(text.slice(firstBrace, lastBrace + 1));
  }

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (parsed && typeof parsed === "object") return parsed as T;
    } catch {
      // try the next shape
    }
  }
  return null;
}

export { splitOpenRouterCostUSD };
