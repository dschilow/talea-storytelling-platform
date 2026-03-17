import { secret } from "encore.dev/config";
import { publishWithTimeout } from "../../helpers/pubsubTimeout";
import { logTopic } from "../../log/logger";

const openAIKey = secret("OpenAIKey");

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_STATUS_RETRIES = 2;
const MAX_MODEL_FALLBACKS = 4;

const OPENAI_MODEL_FALLBACKS: Record<string, string[]> = {
  "gpt-5.4": ["gpt-5", "gpt-5-mini", "gpt-5-nano"],
  "gpt-5.2": ["gpt-5", "gpt-5-mini", "gpt-5-nano"],
  "gpt-5-pro": ["gpt-5", "gpt-5-mini", "gpt-5-nano"],
  "gpt-5": ["gpt-5-mini", "gpt-5-nano"],
  "gpt-5-mini": ["gpt-5-nano"],
  "o4-mini": ["gpt-5-mini", "gpt-5-nano"],
};

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

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function uniqueModels(models: Array<string | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of models) {
    const model = String(raw || "").trim();
    if (!model || seen.has(model)) continue;
    seen.add(model);
    out.push(model);
  }
  return out;
}

function resolveOpenAiModelCandidates(primaryModel: string, explicitFallbacks?: string[]): string[] {
  const normalizedPrimary = String(primaryModel || "").trim() || "gpt-5-mini";
  const mappedFallbacks = OPENAI_MODEL_FALLBACKS[normalizedPrimary]
    ?? (normalizedPrimary.startsWith("gpt-5") ? ["gpt-5-mini", "gpt-5-nano"] : []);
  return uniqueModels([
    normalizedPrimary,
    ...(explicitFallbacks || []),
    ...mappedFallbacks,
  ]).slice(0, MAX_MODEL_FALLBACKS + 1);
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function shouldFallbackToNextModel(status: number, errorText: string): boolean {
  if (status === 404) return true;
  if (!isRetryableStatus(status) && status !== 400) return false;

  const lowered = errorText.toLowerCase();
  if (isRetryableStatus(status)) {
    return (
      lowered.includes("unavailable")
      || lowered.includes("high demand")
      || lowered.includes("overloaded")
      || lowered.includes("temporarily")
    );
  }

  // 400-series model/parameter issues that indicate wrong/unsupported model.
  return (
    lowered.includes("unknown model")
    || lowered.includes("unsupported model")
    || lowered.includes("is not supported")
    || lowered.includes("model")
    && (lowered.includes("not found") || lowered.includes("does not exist") || lowered.includes("invalid"))
  );
}

export interface ChatCompletionResult {
  content: string;
  usage?: {
    promptTokens: number;
    cachedPromptTokens?: number;
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
  fallbackModels?: string[];
  responseFormat?: "json_object" | "text";
  maxTokens?: number;
  temperature?: number;
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  seed?: number;
  context?: string;
  logSource?: string;
  logMetadata?: Record<string, any>;
  preferImmediateFallbackOnTransient?: boolean;
  maxStatusRetries?: number;
}): Promise<ChatCompletionResult> {
  const requestedMaxCompletionTokens = input.maxTokens ?? 2000;
  const modelCandidates = resolveOpenAiModelCandidates(input.model, input.fallbackModels);
  const logSource = resolveLogSource(input.logSource, input.context);
  const logMetadata = buildLogMetadata(input.context, input.logMetadata);
  const statusRetries = Number.isFinite(input.maxStatusRetries)
    ? Math.max(1, Math.min(3, Number(input.maxStatusRetries)))
    : MAX_STATUS_RETRIES;
  let lastError: Error | null = null;

  for (let modelIndex = 0; modelIndex < modelCandidates.length; modelIndex += 1) {
    const activeModel = modelCandidates[modelIndex];
    const hasFallback = modelIndex < modelCandidates.length - 1;
    let fallbackTriggered = false;
    const isReasoningModel = activeModel.includes("gpt-5") || activeModel.includes("o4");
    const isCriticContext = Boolean(input.context) && input.context!.includes("semantic-critic");
    const prefersMinimalJsonReasoning =
      input.responseFormat === "json_object"
      && (activeModel.includes("gpt-5-mini") || activeModel.includes("gpt-5-nano"))
      && !isCriticContext;
    const prefersConservativeJsonReasoning =
      input.responseFormat === "json_object"
      && Boolean(input.context)
      && input.context!.startsWith("story-writer")
      && activeModel.startsWith("gpt-5");
    const jsonHeadroomFloor =
      !prefersMinimalJsonReasoning
        ? 0
        : input.context?.startsWith("story-writer")
          ? 2200
          : input.context?.startsWith("scene-prompt-generator")
            ? 1600
            : input.context?.startsWith("story-release-surgery")
              ? 1800
              : 1400;
    const needsJsonHeadroom =
      prefersMinimalJsonReasoning
      && Boolean(input.context)
      && (
        input.context!.startsWith("story-writer")
        || input.context!.startsWith("scene-prompt-generator")
        || input.context!.startsWith("story-release-surgery")
      );

    const payload: any = {
      model: activeModel,
      messages: input.messages,
      max_completion_tokens: needsJsonHeadroom
        ? Math.max(requestedMaxCompletionTokens, jsonHeadroomFloor)
        : requestedMaxCompletionTokens,
    };

    if (input.responseFormat === "json_object") {
      payload.response_format = { type: "json_object" };
    }

    if (isReasoningModel) {
      let effectiveReasoningEffort: "minimal" | "low" | "medium" | "high" = input.reasoningEffort ?? "low";
      if (prefersMinimalJsonReasoning) {
        effectiveReasoningEffort = "minimal";
      } else if (prefersConservativeJsonReasoning && effectiveReasoningEffort === "high") {
        // gpt-5 story-writer JSON calls can burn completion budget on reasoning and return empty text.
        effectiveReasoningEffort = "low";
      }
      payload.reasoning_effort = effectiveReasoningEffort;
    } else {
      payload.temperature = input.temperature ?? 0.7;
      payload.top_p = 0.95;
    }

    if (typeof input.seed === "number") {
      payload.seed = input.seed;
    }

    for (let attempt = 1; attempt <= statusRetries; attempt += 1) {
      const requestPayload = { ...payload };
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
        if (hasFallback && isTransientNetworkError(error)) {
          console.warn(
            `[llm-client] Network error on ${activeModel}; falling back to ${modelCandidates[modelIndex + 1]}`
          );
          fallbackTriggered = true;
          break;
        }
        lastError = error as Error;
        break;
      }

      if (!response.ok) {
        const text = await response.text();
        await logLlmEvent({
          source: logSource,
          request: requestPayload,
          response: { status: response.status, error: text },
          metadata: logMetadata,
        });

        const retryableStatus = isRetryableStatus(response.status);
        const transientFallbackEnabled = input.preferImmediateFallbackOnTransient !== false;
        if (
          hasFallback
          && (
            shouldFallbackToNextModel(response.status, text)
            || (transientFallbackEnabled && retryableStatus)
          )
        ) {
          console.warn(
            `[llm-client] Model ${activeModel} failed with ${response.status}; falling back to ${modelCandidates[modelIndex + 1]}`
          );
          fallbackTriggered = true;
          break;
        }

        if (retryableStatus && attempt < statusRetries) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(
            `[llm-client] Retryable OpenAI status ${response.status} for ${activeModel}; retrying in ${delay}ms`
          );
          await sleep(delay);
          continue;
        }

        lastError = new Error(`OpenAI API error ${response.status}: ${text}`);
        break;
      }

      const data: any = await response.json();
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
            cachedPromptTokens: data.usage.prompt_tokens_details?.cached_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
            model: activeModel,
            reasoningTokens: data.usage.completion_tokens_details?.reasoning_tokens ?? 0,
          }
        : undefined;

      // Detect truncated responses — finish_reason "length" means max_tokens was hit
      if (finishReason === "length") {
        console.warn(
          `[llm-client] Response truncated (finish_reason=length) for context="${input.context ?? "unknown"}", ` +
          `model=${activeModel}, maxTokens=${input.maxTokens ?? 2000}. ` +
          `Content length: ${content.length} chars. Consider increasing maxTokens.`
        );
      }

      const isEmptyTruncated = finishReason === "length" && !String(content || "").trim();
      if (isEmptyTruncated && hasFallback) {
        console.warn(
          `[llm-client] Empty truncated response from ${activeModel}; falling back to ${modelCandidates[modelIndex + 1]}`
        );
        fallbackTriggered = true;
        break;
      }
      if (isEmptyTruncated) {
        lastError = new Error(
          `OpenAI returned empty truncated response for context="${input.context ?? "unknown"}" on model ${activeModel}`
        );
        break;
      }

      return { content, usage, finishReason };
    }

    if (fallbackTriggered) {
      continue;
    }

    if (lastError && !hasFallback) {
      break;
    }
  }

  throw lastError ?? new Error("OpenAI API error: failed to receive response");
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

export function calculateTokenCosts(usage: {
  promptTokens: number;
  cachedPromptTokens?: number;
  completionTokens: number;
  model?: string;
}) {
  const model = usage.model || "gpt-5-mini";
  const cachedPromptTokens = Math.max(0, Number(usage.cachedPromptTokens || 0));
  const uncachedPromptTokens = Math.max(0, usage.promptTokens - cachedPromptTokens);
  const cachedInputCost = (cachedPromptTokens * cachedInputPricePerMillion(model)) / 1_000_000;
  const uncachedInputCost = (uncachedPromptTokens * inputPricePerMillion(model)) / 1_000_000;
  const inputCost = uncachedInputCost + cachedInputCost;
  const outputCost = (usage.completionTokens * outputPricePerMillion(model)) / 1_000_000;
  return {
    inputCostUSD: inputCost,
    cachedInputCostUSD: cachedInputCost,
    outputCostUSD: outputCost,
    totalCostUSD: inputCost + outputCost,
  };
}

function inputPricePerMillion(model: string): number {
  if (model.includes("gemini-3-flash")) return 0.5;
  if (model.includes("gemini")) return 0.0;
  if (model.includes("gpt-5-nano")) return 0.05;
  if (model.includes("gpt-5-mini")) return 0.25;
  if (model.includes("gpt-5-pro")) return 5.0;
  if (model.includes("gpt-5")) return 2.5;
  if (model.includes("o4-mini")) return 1.1;
  if (model.includes("gpt-4")) return 2.5;
  return 0.25;
}

function cachedInputPricePerMillion(model: string): number {
  if (model.includes("gpt-5-mini")) return 0.025;
  return inputPricePerMillion(model);
}

function outputPricePerMillion(model: string): number {
  if (model.includes("gemini-3-flash")) return 3.0;
  if (model.includes("gemini")) return 0.0;
  if (model.includes("gpt-5-nano")) return 0.25;
  if (model.includes("gpt-5-mini")) return 2.0;
  if (model.includes("gpt-5-pro")) return 20.0;
  if (model.includes("gpt-5")) return 10.0;
  if (model.includes("o4-mini")) return 4.4;
  if (model.includes("gpt-4")) return 10.0;
  return 2.0;
}


