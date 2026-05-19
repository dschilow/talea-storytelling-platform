import { secret } from "encore.dev/config";

const openRouterApiKey = secret("OpenRouterAPIKey");

export const DEFAULT_OPENROUTER_STORY_MODEL = "moonshotai/kimi-k2.6";
export const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";

type OpenRouterPricing = {
  inputCostPer1M: number;
  outputCostPer1M: number;
};

const OPENROUTER_MODEL_PRICING: Record<string, OpenRouterPricing> = {
  "moonshotai/kimi-k2.6": { inputCostPer1M: 0.15, outputCostPer1M: 0.45 },
  "~moonshotai/kimi-latest": { inputCostPer1M: 0.75, outputCostPer1M: 3.5 },
  "moonshotai/kimi-k2.5": { inputCostPer1M: 0.44, outputCostPer1M: 2.0 },
  "minimax/minimax-m2.7": { inputCostPer1M: 0.3, outputCostPer1M: 1.2 },
  "x-ai/grok-4.3": { inputCostPer1M: 1.25, outputCostPer1M: 2.5 },
  "openrouter/owl-alpha": { inputCostPer1M: 0, outputCostPer1M: 0 },
  "google/gemini-3.1-flash-lite": { inputCostPer1M: 0.25, outputCostPer1M: 1.5 },
  "google/gemini-3.1-flash-lite-preview": { inputCostPer1M: 0.25, outputCostPer1M: 1.5 },
  "~google/gemini-pro-latest": { inputCostPer1M: 2.0, outputCostPer1M: 12.0 },
  "~google/gemini-flash-latest": { inputCostPer1M: 0.5, outputCostPer1M: 3.0 },
  "~anthropic/claude-sonnet-latest": { inputCostPer1M: 3.0, outputCostPer1M: 15.0 },
  "~openai/gpt-mini-latest": { inputCostPer1M: 0.75, outputCostPer1M: 4.5 },
  "openai/gpt-5.4-mini": { inputCostPer1M: 0.75, outputCostPer1M: 4.5 },
  "~openai/gpt-5.4-mini": { inputCostPer1M: 0.75, outputCostPer1M: 4.5 },
  "openai/gpt-5.4-nano": { inputCostPer1M: 0.2, outputCostPer1M: 1.25 },
  "~openai/gpt-5.4-nano": { inputCostPer1M: 0.2, outputCostPer1M: 1.25 },
  "deepseek/deepseek-v4-pro": { inputCostPer1M: 0.435, outputCostPer1M: 0.87 },
  "qwen/qwen3.6-max-preview": { inputCostPer1M: 1.04, outputCostPer1M: 6.24 },
};

export interface OpenRouterChatCompletionResult {
  data: any;
  request: any;
  model: string;
}

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

  if (typeof input.temperature === "number") {
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
