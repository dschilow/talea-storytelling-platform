type StorybookReasoningOptions = {
  effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
  enabled?: boolean;
  exclude: boolean;
};

function isTextCompatibilityModel(model: string): boolean {
  return /claude|anthropic|google\/gemini|gemini-pro|gemini-flash|moonshot|kimi|mini.?max|minimax|qwen|deepseek|zhipu|glm|baidu|ernie|alibaba|dashscope|tencent|hunyuan|stepfun|01-ai|yi-|bytedance|doubao/i.test(model);
}

/** `exclude` hides reasoning but does not disable it; budget it explicitly. */
export function resolveStorybookReasoning(model: string): StorybookReasoningOptions {
  const normalized = String(model || "").toLowerCase();
  if (isTextCompatibilityModel(normalized)) return { enabled: false, exclude: true };
  if (/gpt-5/.test(normalized)) return { effort: "minimal", exclude: true };
  return { exclude: true };
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
