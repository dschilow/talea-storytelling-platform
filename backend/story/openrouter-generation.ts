import { secret } from "encore.dev/config";

const openRouterApiKey = secret("OpenRouterAPIKey");

export const DEFAULT_OPENROUTER_STORY_MODEL = "moonshotai/kimi-k2.6";
export const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";

type OpenRouterPricing = {
  inputCostPer1M: number;
  outputCostPer1M: number;
};

// Verified against the live OpenRouter /api/v1/models catalog on 2026-07-09.
// Several entries had drifted significantly from OpenRouter's actual current
// pricing (e.g. kimi-k2.6 output was hardcoded at $0.45/1M vs the real
// $3.41/1M — a 7.6x understatement that skewed every cost comparison and
// model recommendation made from tracked story costs). Re-verify periodically;
// OpenRouter prices change without notice and this table has no live fallback.
const OPENROUTER_MODEL_PRICING: Record<string, OpenRouterPricing> = {
  "moonshotai/kimi-k2.6": { inputCostPer1M: 0.65, outputCostPer1M: 3.41 },
  "~moonshotai/kimi-latest": { inputCostPer1M: 0.65, outputCostPer1M: 3.41 },
  "moonshotai/kimi-k2.5": { inputCostPer1M: 0.375, outputCostPer1M: 2.025 },
  "minimax/minimax-m2.7": { inputCostPer1M: 0.18, outputCostPer1M: 0.72 },
  "x-ai/grok-4.3": { inputCostPer1M: 1.25, outputCostPer1M: 2.5 },
  "openrouter/owl-alpha": { inputCostPer1M: 0, outputCostPer1M: 0 },
  "google/gemini-3.5-flash": { inputCostPer1M: 1.5, outputCostPer1M: 9.0 },
  "google/gemini-3.5-flash-lite": { inputCostPer1M: 0.3, outputCostPer1M: 2.5 },
  "google/gemini-3.1-flash-lite": { inputCostPer1M: 0.25, outputCostPer1M: 1.5 },
  "google/gemini-3.1-flash-lite-preview": { inputCostPer1M: 0.25, outputCostPer1M: 1.5 },
  "~google/gemini-pro-latest": { inputCostPer1M: 2.0, outputCostPer1M: 12.0 },
  "~google/gemini-flash-latest": { inputCostPer1M: 1.5, outputCostPer1M: 9.0 },
  "~anthropic/claude-sonnet-latest": { inputCostPer1M: 2.0, outputCostPer1M: 10.0 },
  "~openai/gpt-mini-latest": { inputCostPer1M: 0.75, outputCostPer1M: 4.5 },
  "openai/gpt-5.4-mini": { inputCostPer1M: 0.75, outputCostPer1M: 4.5 },
  "~openai/gpt-5.4-mini": { inputCostPer1M: 0.75, outputCostPer1M: 4.5 },
  "openai/gpt-5.4-nano": { inputCostPer1M: 0.2, outputCostPer1M: 1.25 },
  "~openai/gpt-5.4-nano": { inputCostPer1M: 0.2, outputCostPer1M: 1.25 },
  "deepseek/deepseek-v4-pro": { inputCostPer1M: 0.435, outputCostPer1M: 0.87 },
  "deepseek/deepseek-v4-flash": { inputCostPer1M: 0.09, outputCostPer1M: 0.18 },
  "qwen/qwen3.6-max-preview": { inputCostPer1M: 1.04, outputCostPer1M: 6.24 },
  "qwen/qwen3.7-max": { inputCostPer1M: 1.25, outputCostPer1M: 3.75 },
  "qwen/qwen3.7-plus": { inputCostPer1M: 0.32, outputCostPer1M: 1.28 },
  "minimax/minimax-m3": { inputCostPer1M: 0.3, outputCostPer1M: 1.2 },
  "z-ai/glm-5.2": { inputCostPer1M: 0.9, outputCostPer1M: 3.08 },
  "openai/gpt-5.6-luna": { inputCostPer1M: 1.0, outputCostPer1M: 6.0 },
  "openai/gpt-5.6-terra": { inputCostPer1M: 2.5, outputCostPer1M: 15.0 },
};

export interface OpenRouterChatCompletionResult {
  data: any;
  request: any;
  model: string;
}

type OpenRouterReasoningOptions = {
  effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
  max_tokens?: number;
  exclude?: boolean;
  enabled?: boolean;
};

export type OpenRouterTool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

export function normalizeOpenRouterModel(model?: string | null): string {
  const normalized = String(model || "").trim();
  return normalized.length > 0 ? normalized : DEFAULT_OPENROUTER_STORY_MODEL;
}

export function isOpenRouterModelId(model?: string | null): boolean {
  const normalized = String(model || "").trim();
  return normalized.includes("/") || normalized.startsWith("~");
}

export function getOpenRouterModelPricing(model?: string | null): OpenRouterPricing {
  const normalized = normalizeOpenRouterModel(model);
  return OPENROUTER_MODEL_PRICING[normalized] || {
    inputCostPer1M: 0.75,
    outputCostPer1M: 3.5,
  };
}

export function resolveOpenRouterApiKey(): string | null {
  const fromEnv =
    process.env.ENCORE_SECRET_OPENROUTERAPIKEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.OpenRouterAPIKey;

  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  try {
    const key = openRouterApiKey();
    if (key && key.trim().length > 0) {
      return key.trim();
    }
  } catch {
    // Secret may not exist in local/dev environments. The caller throws a clearer error.
  }

  return null;
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(resolveOpenRouterApiKey());
}

export async function callOpenRouterChatCompletion(input: {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  model: string;
  responseFormat?: "json_object" | "text";
  maxTokens?: number;
  temperature?: number;
  seed?: number;
  signal?: AbortSignal;
  reasoning?: OpenRouterReasoningOptions | false;
  includeReasoning?: boolean;
  tools?: readonly OpenRouterTool[];
  toolChoice?: "auto" | "none" | "required";
  /**
   * Optional: attach images to the FINAL user message for vision-capable
   * models (Gemini, GPT-4V, Claude 3, etc.). When set, the last user
   * message is upgraded to the multimodal content-parts shape per
   * OpenAI / OpenRouter spec.
   */
  imageInputs?: string[];
}): Promise<OpenRouterChatCompletionResult> {
  const apiKey = resolveOpenRouterApiKey();
  if (!apiKey) {
    throw new Error(
      "OpenRouter API key not configured. Set OPENROUTER_API_KEY or ENCORE_SECRET_OPENROUTERAPIKEY."
    );
  }

  const model = normalizeOpenRouterModel(input.model);

  // Multimodal upgrade: if imageInputs are present, rewrite the last user
  // message as content-parts array. Other messages stay as plain strings.
  let outgoingMessages: any[] = input.messages;
  if (input.imageInputs && input.imageInputs.length > 0) {
    outgoingMessages = input.messages.map((m, idx) => {
      const isLastUser = idx === input.messages.length - 1 && m.role === "user";
      if (!isLastUser) return m;
      const parts: any[] = [{ type: "text", text: m.content }];
      for (const url of input.imageInputs!) {
        parts.push({ type: "image_url", image_url: { url } });
      }
      return { role: m.role, content: parts };
    });
  }

  const payload: any = {
    model,
    messages: outgoingMessages,
    max_tokens: input.maxTokens ?? 2000,
  };

  if (input.responseFormat === "json_object") {
    payload.response_format = { type: "json_object" };
  }

  if (input.tools && input.tools.length > 0) {
    payload.tools = input.tools;
    payload.tool_choice = input.toolChoice || "auto";
  }

  if (input.reasoning !== false) {
    const reasoning = { ...(input.reasoning || { exclude: true }) };
    if (input.includeReasoning !== true && typeof reasoning.exclude !== "boolean") {
      reasoning.exclude = true;
    }
    if (Object.keys(reasoning).length > 0) {
      payload.reasoning = reasoning;
    }
    if (input.includeReasoning === false || reasoning.exclude === true) {
      payload.include_reasoning = false;
    }
  }

  // Gemini 3.5 Flash-Lite no longer accepts sampling parameters in Google's API.
  // Omit temperature here too, so OpenRouter provider routing cannot surface a 400.
  if (typeof input.temperature === "number" && model !== "google/gemini-3.5-flash-lite") {
    payload.temperature = input.temperature;
  }

  if (typeof input.seed === "number") {
    payload.seed = input.seed;
  }

  const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://www.talea.website",
      "X-OpenRouter-Title": process.env.OPENROUTER_APP_TITLE || "Talea Storytelling Platform",
    },
    body: JSON.stringify(payload),
    signal: input.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
  }

  return {
    data: await response.json(),
    request: payload,
    model,
  };
}
