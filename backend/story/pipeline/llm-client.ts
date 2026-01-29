import { secret } from "encore.dev/config";

const openAIKey = secret("OpenAIKey");

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

function isTransientNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("fetch failed") || message.includes("socket") || message.includes("econnreset") || message.includes("econnrefused") || message.includes("etimedout") || message.includes("network")) {
      return true;
    }
    const cause = (error as any).cause;
    if (cause && typeof cause === "object") {
      const code = (cause as any).code;
      if (code === "UND_ERR_SOCKET" || code === "ECONNRESET" || code === "ETIMEDOUT") {
        return true;
      }
    }
  }
  return false;
}

async function fetchWithRetry(url: string, options: RequestInit, context: string): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error as Error;
      if (isTransientNetworkError(error) && attempt < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[${context}] Transient network error, retrying in ${delay}ms`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw lastError ?? new Error("Unknown network error");
}

export interface ChatCompletionResult {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    model?: string;
    reasoningTokens?: number;
  };
}

export async function callChatCompletion(input: {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  model: string;
  responseFormat?: "json_object" | "text";
  maxTokens?: number;
  temperature?: number;
  reasoningEffort?: "low" | "medium" | "high";
  seed?: number;
  context?: string;
}): Promise<ChatCompletionResult> {
  const isReasoningModel = input.model.includes("gpt-5") || input.model.includes("o4");
  
  const payload: any = {
    model: input.model,
    messages: input.messages,
    max_completion_tokens: input.maxTokens ?? 2000,
  };

  // Reasoning models don't support json_object response format
  // They need plain text and we parse the JSON from the response
  if (input.responseFormat === "json_object" && !isReasoningModel) {
    payload.response_format = { type: "json_object" };
  }

  if (isReasoningModel) {
    payload.reasoning_effort = input.reasoningEffort ?? "low";
    console.log(`[${input.context}] Using reasoning model with effort: ${payload.reasoning_effort}`);
  } else {
    payload.temperature = input.temperature ?? 0.7;
    payload.top_p = 0.95;
  }

  if (typeof input.seed === "number") {
    payload.seed = input.seed;
  }

  const response = await fetchWithRetry(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAIKey()}`,
      },
      body: JSON.stringify(payload),
    },
    input.context ?? "chat"
  );

  if (!response.ok) {
    const text = await response.text();
    console.error(`[${input.context}] OpenAI API error ${response.status}:`, text);
    throw new Error(`OpenAI API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  
  // Debug logging for empty responses
  if (!data.choices || data.choices.length === 0) {
    console.error(`[${input.context}] OpenAI returned no choices!`, JSON.stringify(data, null, 2));
  }
  
  const content = data.choices?.[0]?.message?.content ?? "";
  
  if (!content || content.length === 0) {
    console.error(`[${input.context}] OpenAI returned empty content!`, {
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length,
      firstChoice: data.choices?.[0],
      fullResponse: JSON.stringify(data, null, 2)
    });
  }
  
  const usage = data.usage
    ? {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
        totalTokens: data.usage.total_tokens ?? 0,
        model: input.model,
        reasoningTokens: data.usage.completion_tokens_details?.reasoning_tokens ?? 0,
      }
    : undefined;

  return { content, usage };
}

export function calculateTokenCosts(usage: { promptTokens: number; completionTokens: number; model?: string }) {
  const model = usage.model || "gpt-5-mini";
  const inputCost = (usage.promptTokens * inputPricePerMillion(model)) / 1_000_000;
  const outputCost = (usage.completionTokens * outputPricePerMillion(model)) / 1_000_000;
  return {
    inputCostUSD: inputCost,
    outputCostUSD: outputCost,
    totalCostUSD: inputCost + outputCost,
  };
}

function inputPricePerMillion(model: string): number {
  if (model.includes("gpt-5-nano")) return 0.03;
  if (model.includes("gpt-5-mini")) return 0.075;
  if (model.includes("gpt-5-pro")) return 5.0;
  if (model.includes("gpt-5")) return 2.5;
  if (model.includes("o4-mini")) return 1.1;
  if (model.includes("gpt-4")) return 2.5;
  return 0.075;
}

function outputPricePerMillion(model: string): number {
  if (model.includes("gpt-5-nano")) return 0.12;
  if (model.includes("gpt-5-mini")) return 0.3;
  if (model.includes("gpt-5-pro")) return 20.0;
  if (model.includes("gpt-5")) return 10.0;
  if (model.includes("o4-mini")) return 4.4;
  if (model.includes("gpt-4")) return 10.0;
  return 0.3;
}
