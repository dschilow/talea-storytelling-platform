import type { LlmCallResult, LlmRole, ReasoningEffort } from "./llm";

export class StorybookSafetyBlock extends Error {
  readonly code = "llm_safety_blocked";

  constructor(model: string, stage: string, public readonly reason: string, public readonly billed?: LlmCallResult) {
    super(`[storybook/llm] ${model} blocked the request (${stage}, provider_reason=${reason}). No automatic retry.`);
    this.name = "StorybookSafetyBlock";
  }
}

/** A provider refusal is not an empty completion or a capacity outage. Never log its raw payload here. */
export function providerSafetyReason(value: unknown): string | undefined {
  if (value instanceof StorybookSafetyBlock) return value.reason;
  if (value instanceof Error) {
    const body = value.message.match(/^OpenRouter API error \d{3}:\s*([\s\S]+)$/)?.[1];
    if (!body) return undefined;
    try { return providerSafetyReason(JSON.parse(body)); }
    catch { return providerSafetyReason({ error: { message: body } }); }
  }
  const record = (entry: unknown): Record<string, unknown> | undefined =>
    entry && typeof entry === "object" && !Array.isArray(entry) ? entry as Record<string, unknown> : undefined;
  const data = record(value);
  if (!data) return undefined;
  const code = (entry: unknown): string | undefined => {
    if (typeof entry !== "string") return undefined;
    return entry.toUpperCase().match(/\b(PROHIBITED_CONTENT|IMAGE_SAFETY|SAFETY|CONTENT_FILTER|BLOCKLIST)\b/)?.[1];
  };
  const errorReason = (entry: unknown): string | undefined => {
    const error = record(entry);
    const metadata = record(error?.metadata);
    return code(error?.code) || code(metadata?.provider_code) || code(metadata?.error_type) || code(error?.message);
  };
  const rootReason = errorReason(data.error);
  if (rootReason) return rootReason;
  for (const item of Array.isArray(data.choices) ? data.choices : []) {
    const choice = record(item);
    const reason = code(choice?.native_finish_reason) || code(choice?.finish_reason) || errorReason(choice?.error);
    if (reason) return reason;
    const refusal = record(choice?.message)?.refusal;
    if (typeof refusal === "string" && refusal.trim()) return "REFUSAL";
  }
  return undefined;
}

export type StorybookReasoningOptions = {
  effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
  enabled?: boolean;
  exclude: boolean;
};

/** Hybrid-thinking families: a reasoning object without enabled:false turns thinking ON. */
function isHybridThinkingModel(model: string): boolean {
  return /claude|anthropic|moonshot|kimi|mini.?max|minimax|qwen|deepseek|zhipu|glm|baidu|ernie|alibaba|dashscope|tencent|hunyuan|stepfun|01-ai|yi-|bytedance|doubao/i.test(model);
}

/**
 * Translates the stage's wanted effort into what each family accepts.
 *
 * `exclude` hides reasoning but does NOT disable it, and hidden reasoning
 * still counts against max_tokens. gpt-5.x/gpt-6 reason at "medium" by
 * default: left implicit, that ate a 1800-token beat-sheet budget whole in
 * production (2026-08-06). So OpenAI models always get an explicit effort.
 */
export function resolveStorybookReasoning(model: string, effort: ReasoningEffort = "none", role?: LlmRole): StorybookReasoningOptions {
  const normalized = String(model || "").toLowerCase();

  // Claude as critic: a little thinking finds logic gaps (who is where, why the
  // solution works). Kept at "low" — thinking tokens bill at output price.
  if (role === "critic" && /claude|anthropic/.test(normalized) && effort !== "none") {
    return { effort: "low", exclude: true };
  }

  if (/(^|\/)gpt-6/.test(normalized)) {
    return { effort, exclude: true };
  }
  // Everything else stops at "high" (fallback models must not get a 400).
  const capped = effort === "xhigh" || effort === "max" ? "high" : effort;
  // Sonnet 5.5 reasons mandatorily (default "high", no "none"); "low" keeps a one-shot story affordable.
  // Opus 5.5 and Fable 5.1 too: "Reasoning is mandatory for this endpoint" (400 with enabled:false, 2026-10-14).
  if (/claude-(sonnet-5\.5|opus-5\.5|fable-5)/.test(normalized)) {
    return { effort: capped === "none" ? "low" : capped, exclude: true };
  }
  if (/(^|\/)gpt-5|(^|\/)o\d/.test(normalized)) {
    return { effort: capped, exclude: true };
  }
  // Gemini 3.x reasoning is mandatory; "none" would be a 400. Flash-Lite and
  // 3.6 Flash accept "minimal"; 3.7/3.8 Flash list only low/medium/high.
  if (/gemini/.test(normalized)) {
    const floor = /gemini-3\.(7|8)-flash(?!-lite)/.test(normalized) ? "low" : "minimal";
    return { effort: capped === "none" ? floor : capped, exclude: true };
  }
  // Aion (storytelling-tuned) has mandatory reasoning with max/high/low only.
  if (/aion/.test(normalized)) {
    return { effort: effort === "high" ? "high" : "low", exclude: true };
  }
  // GLM-5.3 reasons mandatorily ("cannot be disabled" → 400, batch 2026-09-28).
  if (/glm-5\.3/.test(normalized)) {
    return { effort: capped === "none" ? "low" : capped, exclude: true };
  }
  // Writer stages need plain prose; hidden thinking on these families has
  // returned EMPTY completions with finish_reason=length (runs a5059aef, 38b65185).
  if (isHybridThinkingModel(normalized)) {
    return { enabled: false, exclude: true };
  }
  return { exclude: true };
}

/** OpenAI reasoning models reject `temperature`; do not provoke a failing first call. */
export function acceptsTemperature(model: string): boolean {
  const normalized = String(model || "").toLowerCase();
  if (/(^|\/)gpt-(5|6)|(^|\/)o\d/.test(normalized)) return false;
  if (normalized === "google/gemini-3.5-flash-lite") return false;
  // The Claude 5 generation lists no `temperature` on OpenRouter.
  if (/claude-(sonnet|opus|haiku|fable)-5/.test(normalized)) return false;
  return true;
}

/** Handles both OpenAI-style strings and providers that return content parts. */
export function extractStorybookChoiceContent(choice: any): string {
  const content = choice?.message?.content ?? choice?.text ?? "";
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content.map((part) => {
    if (typeof part === "string") return part;
    if (typeof part?.text === "string") return part.text;
    if (typeof part?.content === "string") return part.content;
    return "";
  }).join("\n").trim();
}

export function isTruncatedFinishReason(value: unknown): boolean {
  const normalized = String(value || "").toLowerCase();
  return normalized === "length" || normalized === "max_tokens";
}
