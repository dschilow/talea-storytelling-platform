import { secret } from "encore.dev/config";
import { publishWithTimeout } from "../../helpers/pubsubTimeout";
import { logTopic } from "../../log/logger";

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
  /** OpenAI finish_reason: "stop" | "length" | "content_filter" | etc. */
  finishReason?: string;
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
  logSource?: string;
  logMetadata?: Record<string, any>;
}): Promise<ChatCompletionResult> {
  const payload: any = {
    model: input.model,
    messages: input.messages,
    max_completion_tokens: input.maxTokens ?? 2000,
  };

  if (input.responseFormat === "json_object") {
    payload.response_format = { type: "json_object" };
  }

  const isReasoningModel = input.model.includes("gpt-5") || input.model.includes("o4");
  if (isReasoningModel) {
    payload.reasoning_effort = input.reasoningEffort ?? "low";
  } else {
    payload.temperature = input.temperature ?? 0.7;
    payload.top_p = 0.95;
  }

  if (typeof input.seed === "number") {
    payload.seed = input.seed;
  }

  const requestPayload = { ...payload };
  const logSource = resolveLogSource(input.logSource, input.context);
  const logMetadata = buildLogMetadata(input.context, input.logMetadata);

  let response: Response;
  try {
    response = await fetchWithRetry(
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
  } catch (error) {
    await logLlmEvent({
      source: logSource,
      request: requestPayload,
      response: { error: String((error as Error)?.message || error) },
      metadata: logMetadata,
    });
    throw error;
  }

  if (!response.ok) {
    const text = await response.text();
    await logLlmEvent({
      source: logSource,
      request: requestPayload,
      response: { status: response.status, error: text },
      metadata: logMetadata,
    });
    throw new Error(`OpenAI API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  await logLlmEvent({
    source: logSource,
    request: requestPayload,
    response: data,
    metadata: logMetadata,
  });
  const finishReason = data.choices?.[0]?.finish_reason ?? "unknown";
  const content = data.choices?.[0]?.message?.content ?? "";
  const usage = data.usage
    ? {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
        totalTokens: data.usage.total_tokens ?? 0,
        model: input.model,
        reasoningTokens: data.usage.completion_tokens_details?.reasoning_tokens ?? 0,
      }
    : undefined;

  // Detect truncated responses — finish_reason "length" means max_tokens was hit
  if (finishReason === "length") {
    console.warn(
      `[llm-client] Response truncated (finish_reason=length) for context="${input.context ?? "unknown"}", ` +
      `model=${input.model}, maxTokens=${input.maxTokens ?? 2000}. ` +
      `Content length: ${content.length} chars. Consider increasing maxTokens.`
    );
  }

  return { content, usage, finishReason };
}

function resolveLogSource(explicitSource?: string, context?: string): string {
  if (explicitSource) return explicitSource;
  if (!context) return "openai-story-generation";
  if (context.startsWith("scene-prompt-generator")) return "phase6.5-scene-prompts-llm";
  if (context.startsWith("story-writer") || context === "story-title") return "phase6-story-llm";
  if (context.startsWith("vision-validator")) return "phase10-vision-llm";
  return "openai-story-generation";
}

function buildLogMetadata(context?: string, extra?: Record<string, any>) {
  const base = context ? { context } : {};
  return extra ? { ...base, ...extra } : base;
}

async function logLlmEvent(input: {
  source: string;
  request: any;
  response: any;
  metadata?: any;
}) {
  await publishWithTimeout(logTopic as any, {
    source: input.source,
    timestamp: new Date(),
    request: input.request,
    response: input.response,
    metadata: input.metadata ?? null,
  });
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
  if (model.includes("gemini")) return 0.0;
  if (model.includes("gpt-5-nano")) return 0.03;
  if (model.includes("gpt-5-mini")) return 0.25;   // $0.25 per 1M input tokens (corrected 2025-07)
  if (model.includes("gpt-5-pro")) return 5.0;
  if (model.includes("gpt-5")) return 2.5;
  if (model.includes("o4-mini")) return 1.1;
  if (model.includes("gpt-4")) return 2.5;
  return 0.25;
}

function outputPricePerMillion(model: string): number {
  if (model.includes("gemini")) return 0.0;
  if (model.includes("gpt-5-nano")) return 0.12;
  if (model.includes("gpt-5-mini")) return 2.0;    // $2.00 per 1M output tokens (corrected 2025-07)
  if (model.includes("gpt-5-pro")) return 20.0;
  if (model.includes("gpt-5")) return 10.0;
  if (model.includes("o4-mini")) return 4.4;
  if (model.includes("gpt-4")) return 10.0;
  return 2.0;
}



