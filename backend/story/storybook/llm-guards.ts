import type { ReasoningEffort } from "./llm";

export type StorybookReasoningOptions = {
  effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
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
export function resolveStorybookReasoning(model: string, effort: ReasoningEffort = "none"): StorybookReasoningOptions {
  const normalized = String(model || "").toLowerCase();

  if (/(^|\/)gpt-(5|6)|(^|\/)o\d/.test(normalized)) {
    return { effort, exclude: true };
  }
  // Gemini 3.x reasoning is mandatory; "none" would be a 400, "minimal" is its floor.
  if (/gemini/.test(normalized)) {
    return { effort: effort === "none" ? "minimal" : effort, exclude: true };
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
