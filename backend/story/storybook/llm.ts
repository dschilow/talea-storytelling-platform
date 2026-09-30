/**
 * Storybook Pipeline — model roles, the LLM port and cost accounting.
 *
 * Everything in this file is pure. The engine stages only ever see the
 * `StorybookLlm` port; production plugs in OpenRouter (llm-openrouter.ts), a
 * local harness or a test plugs in whatever it likes. That is what makes the
 * whole text pipeline runnable and testable without Encore standing up.
 *
 * Three roles:
 *
 *   SUPPORT — openai/gpt-6-luna. Concept, plan, illustration direction,
 *             developments, vision checks. $0.10 / $0.50 per 1M tokens (list,
 *             2026-09-22) — half of gpt-5.6-luna, a newer generation, and it
 *             reads images.
 *   WRITER  — the wizard's choice. Defaults to gpt-6-luna as well.
 *   CRITIC  — always from a DIFFERENT model family than the writer. A model
 *             grading its own prose grades it generously; that exact
 *             collision inflated a 6.5/10 story to 8.1 (audit 2026-08-06) and
 *             produced storybook-v1's weakest run (6683b402).
 *             History: Gemini 3.5 Flash-Lite without score caps rated story
 *             0039344e 8/10 (a careful read: ~5.5). Claude Sonnet 5 with the
 *             caps rated the next draft an honest 5.5 — but cost $0.061 of an
 *             $0.085 story (422a3ba3). Default now (product decision
 *             2026-09-28): Gemini 3.8 Flash ($0.75/$3.75) with the caps — the
 *             Flash line judges creative writing well (Judgemark v2: Gemini 3
 *             Flash 85 vs 3.1 Flash-Lite 81) at a fraction of Claude's price.
 *             Other critics stay one env var away (TALEA_STORYBOOK_CRITIC_MODEL).
 */

import type { StoryConfig } from "../generate";

export const STORYBOOK_SUPPORT_MODEL = "openai/gpt-6-luna";
/**
 * Sol writes the story in one call (measured 2026-09-28: 7.0 vs Luna's 6.0 at
 * about the same total price, because Sol needs no plan/review/rewrite chain).
 */
export const STORYBOOK_DEFAULT_WRITER_MODEL = "openai/gpt-6.1-sol";
/** Independent critic for every writer that is not itself a Gemini model. */
export const STORYBOOK_CROSS_FAMILY_CRITIC_MODEL = "google/gemini-3.8-flash";
/** Used once, only after a model returned nothing usable. */
export const STORYBOOK_FALLBACK_MODEL = "google/gemini-3.5-flash-lite";

export type ReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh" | "max";
export type LlmRole = "support" | "writer" | "critic";

export interface LlmRequest {
  stage: string;
  role: LlmRole;
  model: string;
  system: string;
  user: string;
  json: boolean;
  /** Ceiling for visible output PLUS hidden reasoning. Only used tokens are billed. */
  maxTokens: number;
  effort?: ReasoningEffort;
  temperature?: number;
  /** Image URLs / data URIs for vision-capable models. */
  imageInputs?: string[];
  timeoutMs?: number;
}

export interface LlmCallResult {
  text: string;
  modelUsed: string;
  usage: { prompt: number; completion: number; total: number; costUSD: number; cachedPromptTokens?: number; cacheWriteTokens?: number; reasoningTokens?: number };
  durationMs: number;
  finishReason?: string;
  /** Set when the port had to switch models to get an answer. */
  fallbackFrom?: string;
}

export type StorybookLlm = (request: LlmRequest) => Promise<LlmCallResult>;

export interface StorybookModels {
  writer: string;
  support: string;
  critic: string;
}

/** Maps the wizard's native model ids onto OpenRouter ids; this lane routes everything through OpenRouter. */
export function toOpenRouterModelId(model: string): string {
  const value = String(model || "").trim();
  if (!value) return STORYBOOK_DEFAULT_WRITER_MODEL;
  if (value.includes("/") || value.startsWith("~")) return value;
  if (value === "claude-sonnet-4-6") return "anthropic/claude-sonnet-4.6";
  if (value.startsWith("claude-")) return `anthropic/${value}`;
  if (value.startsWith("minimax-")) return `minimax/${value}`;
  if (value.startsWith("gemini-")) return `google/${value}`;
  if (value.startsWith("gpt-") || /^o\d/.test(value)) return `openai/${value}`;
  return value;
}

export function modelFamily(model: string): "openai" | "google" | "anthropic" | "other" {
  const value = String(model || "").toLowerCase().replace(/^~/, "");
  if (value.startsWith("openai/")) return "openai";
  if (value.startsWith("google/")) return "google";
  if (value.startsWith("anthropic/")) return "anthropic";
  return "other";
}

/**
 * Resolves the three roles. The wizard picks the writer; the critic is always
 * chosen from the other big family so it can never be the writer's twin.
 */
export function resolveStorybookModels(
  config: Pick<StoryConfig, "aiProvider" | "aiModel" | "openRouterModel">,
  overrides: { critic?: string; support?: string } = {}
): StorybookModels {
  const selected = config.aiProvider === "openrouter"
    ? String(config.openRouterModel || "").trim()
    : String(config.aiModel || "").trim();
  const writer = toOpenRouterModelId(selected || STORYBOOK_DEFAULT_WRITER_MODEL);
  const support = overrides.support || STORYBOOK_SUPPORT_MODEL;

  let critic = overrides.critic || "";
  if (!critic || modelFamily(critic) === modelFamily(writer)) {
    critic = modelFamily(writer) === modelFamily(STORYBOOK_CROSS_FAMILY_CRITIC_MODEL) ? STORYBOOK_SUPPORT_MODEL : STORYBOOK_CROSS_FAMILY_CRITIC_MODEL;
  }
  return { writer, support, critic };
}

/** The other model to try once when a call returned nothing usable. */
export function fallbackModelFor(model: string): string {
  // A failing premium writer (Sol, Claude) falls back to Luna — it knows the
  // prompts; Flash-Lite wrote a 3.5/10 story after a Sonnet failure.
  if (/gpt-6(\.\d+)?-sol/.test(model) || modelFamily(model) === "anthropic") return STORYBOOK_SUPPORT_MODEL;
  return modelFamily(model) === "google" ? STORYBOOK_SUPPORT_MODEL : STORYBOOK_FALLBACK_MODEL;
}

/**
 * The one retry after a failed call. A deep-thinking call that ran out of time
 * is not a bad model: it retries on the SAME model at "medium" (batch
 * 2026-09-28: xhigh drafts timed out and fell to Flash-Lite, which wrote
 * visibly worse stories at a higher price). Everything else goes once to the
 * other family; a truncated answer gets more room.
 */
export function retryRequestFor(request: LlmRequest, error: unknown): { request: LlmRequest; model: string } {
  const message = String((error as Error)?.message || error || "");
  const deep = request.effort === "high" || request.effort === "xhigh" || request.effort === "max";
  // "Empty" after deep thinking = the whole budget went into reasoning
  // (batch 2026-09-28T10-41: a "high" draft burnt 36k tokens, wrote nothing).
  if (deep && /timed out|timeout|aborted|Empty response/i.test(message)) {
    return { request: { ...request, effort: "medium" }, model: request.model };
  }
  // Sol 6.1 (2026-09-30): once an instant empty reply with ZERO output tokens.
  // That is a provider blip, not a weak model — the same model answers again
  // before a lesser family writes the story.
  if (/Empty response/i.test(message) && /completion_tokens=0(?!\d)/.test(message) && !/gpt-6(\.\d+)?-luna/.test(request.model)) {
    return { request, model: request.model };
  }
  const truncated = /Truncated/i.test(message);
  return {
    request: { ...request, maxTokens: truncated ? Math.ceil(request.maxTokens * 1.5) : request.maxTokens },
    model: fallbackModelFor(request.model),
  };
}

export interface StorybookStageLog {
  stage: string;
  modelUsed?: string;
  modelRole?: "support" | "selected-story";
  durationMs?: number;
  usage?: LlmCallResult["usage"];
  note?: string;
}

export class CostLedger {
  private readonly stages: StorybookStageLog[] = [];

  recordCall(stage: string, result: LlmCallResult, role: LlmRole): void {
    this.stages.push({
      stage,
      modelUsed: result.modelUsed,
      modelRole: role === "writer" ? "selected-story" : "support",
      durationMs: result.durationMs,
      usage: {
        ...result.usage,
      },
      note: result.fallbackFrom ? `fallback from ${result.fallbackFrom}` : undefined,
    });
  }

  all(): StorybookStageLog[] {
    return [...this.stages];
  }

  totals(): { prompt: number; completion: number; total: number; costUSD: number; calls: number } {
    return this.stages.reduce(
      (acc, stage) => ({
        prompt: acc.prompt + (stage.usage?.prompt || 0),
        completion: acc.completion + (stage.usage?.completion || 0),
        total: acc.total + (stage.usage?.total || 0),
        costUSD: Number((acc.costUSD + (stage.usage?.costUSD || 0)).toFixed(6)),
        calls: acc.calls + 1,
      }),
      { prompt: 0, completion: 0, total: 0, costUSD: 0, calls: 0 }
    );
  }
}

/**
 * Parses a JSON object out of a model response. Models occasionally wrap JSON
 * in prose or fences even when asked not to; recover rather than throw.
 */
export function parseJsonObject<T>(raw: string): T | null {
  const text = String(raw || "").trim();
  if (!text) return null;

  const attempts: string[] = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) attempts.push(fenced[1].trim());
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) attempts.push(text.slice(firstBrace, lastBrace + 1));

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as T;
    } catch {
      // next shape
    }
  }
  return null;
}
