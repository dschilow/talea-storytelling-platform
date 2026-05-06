import { secret } from "encore.dev/config";
import { publishWithTimeout } from "../../helpers/pubsubTimeout";
import { logTopic } from "../../log/logger";
import { isOpenRouterFamilyModel, resolveClaudeStoryModel } from "./model-routing";
import {
  callOpenRouterChatCompletion,
  getOpenRouterModelPricing,
  normalizeOpenRouterModel,
} from "../openrouter-generation";

const openAIKey = secret("OpenAIKey");
const anthropicApiKey = secret("AnthropicAPIKey");

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_STATUS_RETRIES = 2;
const MAX_MODEL_FALLBACKS = 4;

const OPENAI_MODEL_FALLBACKS: Record<string, string[]> = {
  "gpt-5.4": ["gpt-5.4-mini", "gpt-5.4-nano"],
  "gpt-5.4-mini": ["gpt-5.4-nano"],
  "gpt-5.2": ["gpt-5.4-mini", "gpt-5.4-nano"],
  "gpt-5-pro": ["gpt-5.4-mini", "gpt-5.4-nano"],
  "gpt-5": ["gpt-5.4-mini", "gpt-5.4-nano"],
  "o4-mini": ["gpt-5.4-mini", "gpt-5.4-nano"],
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

function isAbortLikeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const name = String((error as any).name || "").toLowerCase();
  const message = String(error.message || "").toLowerCase();
  const code = String((error as any).code || (error as any).cause?.code || "").toLowerCase();
  return name === "aborterror"
    || code === "abort_err"
    || message.includes("aborted")
    || message.includes("aborterror")
    || message.includes("the operation was aborted");
}

function resolveOpenRouterTimeoutMs(context?: string, maxTokens?: number): number {
  const normalized = String(context || "").toLowerCase();
  if (normalized.startsWith("story-writer-full-recovery")) return 120_000;
  if (normalized.startsWith("story-writer-full")) return 120_000;
  if (normalized.startsWith("story-writer-expand")) return 90_000;
  if (normalized.startsWith("story-writer-warning-polish")) return 75_000;
  if (normalized.startsWith("story-title")) return 45_000;
  if (normalized.includes("story-soul") || normalized.includes("blueprint")) return 120_000;
  if (normalized.includes("semantic-critic") || normalized.includes("release-surgery")) return 90_000;

  const tokenBasedTimeout = Math.round(Math.max(60_000, Math.min(180_000, Number(maxTokens || 0) * 20)));
  return Number.isFinite(tokenBasedTimeout) ? tokenBasedTimeout : 120_000;
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
  const normalizedPrimary = String(primaryModel || "").trim() || "gpt-5.4-mini";
  if (isOpenRouterFamilyModel(normalizedPrimary)) {
    return uniqueModels([
      normalizeOpenRouterModel(normalizedPrimary),
      ...(explicitFallbacks || []).filter(isOpenRouterFamilyModel),
    ]).slice(0, MAX_MODEL_FALLBACKS + 1);
  }

  const mappedFallbacks = OPENAI_MODEL_FALLBACKS[normalizedPrimary]
    ?? (normalizedPrimary.startsWith("gpt-5") ? ["gpt-5.4-mini", "gpt-5.4-nano"] : []);
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

export async function callAnthropicCompletion(input: {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  model: string;
  fallbackModels?: string[];
  maxTokens?: number;
  temperature?: number;
  context?: string;
  logSource?: string;
  logMetadata?: Record<string, any>;
}): Promise<ChatCompletionResult> {
  const requestedModel = resolveClaudeStoryModel(input.model);
  const fallbackModels = uniqueModels((input.fallbackModels || []).map(resolveClaudeStoryModel));
  const modelCandidates = uniqueModels([requestedModel, ...fallbackModels]);
  const logSource = resolveLogSource(input.logSource, input.context);
  const logMetadata = buildLogMetadata(input.context, input.logMetadata);
  let lastError: Error | null = null;

  for (const activeModel of modelCandidates) {
    const systemMessages = input.messages.filter(message => message.role === "system");
    const chatMessages = input.messages
      .filter(message => message.role !== "system")
      .map(message => ({
        role: message.role,
        content: [{ type: "text", text: message.content }],
      }));
    const requestPayload: any = {
      model: activeModel,
      max_tokens: input.maxTokens ?? 2000,
      temperature: input.temperature ?? 0.7,
      messages: chatMessages.length > 0
        ? chatMessages
        : [{ role: "user", content: [{ type: "text", text: "" }] }],
    };

    if (systemMessages.length > 0) {
      requestPayload.system = systemMessages.map(message => message.content).join("\n\n");
    }

    let response: Response;
    try {
      response = await fetchWithRetry(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicApiKey(),
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(requestPayload),
        },
        input.context ?? "anthropic-chat"
      );
    } catch (error) {
      await logLlmEvent({
        source: logSource,
        request: requestPayload,
        response: { error: String((error as Error)?.message || error) },
        metadata: logMetadata,
      });
      lastError = error as Error;
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      await logLlmEvent({
        source: logSource,
        request: requestPayload,
        response: { status: response.status, error: text },
        metadata: logMetadata,
      });
      lastError = new Error(`Anthropic API error ${response.status}: ${text}`);
      continue;
    }

    const data: any = await response.json();
    await logLlmEvent({
      source: logSource,
      request: requestPayload,
      response: data,
      metadata: logMetadata,
    });

    const content = Array.isArray(data.content)
      ? data.content
          .filter((block: any) => block?.type === "text")
          .map((block: any) => String(block?.text || ""))
          .join("")
      : "";
    const finishReason = data.stop_reason ?? "unknown";
    const usage = data.usage
      ? {
          promptTokens: data.usage.input_tokens ?? 0,
          completionTokens: data.usage.output_tokens ?? 0,
          totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
          model: activeModel,
        }
      : undefined;

    return { content, usage, finishReason };
  }

  throw lastError ?? new Error("Anthropic API error: failed to receive response");
}

export async function callChatCompletion(input: {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  model: string;
  fallbackModels?: string[];
  responseFormat?: "json_object" | "text";
  maxTokens?: number;
  temperature?: number;
  reasoningEffort?: "minimal" | "none" | "low" | "medium" | "high" | "xhigh";
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
    const isOpenRouterModel = isOpenRouterFamilyModel(activeModel);
    const isReasoningModel = !isOpenRouterModel && (activeModel.includes("gpt-5") || activeModel.includes("o4"));
    const isCriticContext = Boolean(input.context) && input.context!.includes("semantic-critic");
    const prefersMinimalJsonReasoning =
      input.responseFormat === "json_object"
      && (activeModel.includes("gpt-5.4-mini") || activeModel.includes("gpt-5.4-nano"))
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

    const effectiveMaxTokens = needsJsonHeadroom
      ? Math.max(requestedMaxCompletionTokens, jsonHeadroomFloor)
      : requestedMaxCompletionTokens;
    const payload: any = {
      model: activeModel,
      messages: input.messages,
    };

    if (isOpenRouterModel) {
      payload.max_tokens = effectiveMaxTokens;
    } else {
      payload.max_completion_tokens = effectiveMaxTokens;
    }

    if (input.responseFormat === "json_object") {
      payload.response_format = { type: "json_object" };
    }

    if (isReasoningModel) {
      let effectiveReasoningEffort: "none" | "low" | "medium" | "high" | "xhigh" =
        normalizeReasoningEffort(input.reasoningEffort);
      if (prefersMinimalJsonReasoning) {
        effectiveReasoningEffort = "none";
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
        if (isOpenRouterModel) {
          const timeoutMs = resolveOpenRouterTimeoutMs(input.context, effectiveMaxTokens);
          const abortController = new AbortController();
          const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);
          const startedAt = Date.now();
          const heartbeatHandle = timeoutMs > 45_000
            ? setInterval(() => {
                const elapsedMs = Date.now() - startedAt;
                console.info(
                  `[llm-client] OpenRouter still running context="${input.context ?? "unknown"}" model=${activeModel} elapsedMs=${elapsedMs} timeoutMs=${timeoutMs} maxTokens=${effectiveMaxTokens}`
                );
              }, 30_000)
            : undefined;
          if (heartbeatHandle && typeof (heartbeatHandle as any).unref === "function") {
            (heartbeatHandle as any).unref();
          }
          if (typeof (timeoutHandle as any).unref === "function") {
            (timeoutHandle as any).unref();
          }

          let openRouterResult: Awaited<ReturnType<typeof callOpenRouterChatCompletion>>;
          try {
            console.info(
              `[llm-client] Calling OpenRouter context="${input.context ?? "unknown"}" model=${activeModel} maxTokens=${effectiveMaxTokens} timeoutMs=${timeoutMs}`
            );
            openRouterResult = await callOpenRouterChatCompletion({
              messages: input.messages,
              model: activeModel,
              responseFormat: input.responseFormat,
              maxTokens: effectiveMaxTokens,
              temperature: input.temperature ?? 0.7,
              seed: input.seed,
              signal: abortController.signal,
            });
          } catch (error) {
            if (isAbortLikeError(error)) {
              const timeoutResponse = {
                error: `OpenRouter request timed out after ${timeoutMs}ms`,
                finishReason: "timeout",
              };
              await logLlmEvent({
                source: logSource,
                request: requestPayload,
                response: timeoutResponse,
                metadata: { ...logMetadata, provider: "openrouter", timeoutMs },
              });
              console.warn(
                `[llm-client] OpenRouter request timed out for context="${input.context ?? "unknown"}" model=${activeModel} after ${timeoutMs}ms.`
              );
              if (input.context?.startsWith("story-writer")) {
                return { content: "", finishReason: "timeout" };
              }
            }
            throw error;
          } finally {
            clearTimeout(timeoutHandle);
            if (heartbeatHandle) clearInterval(heartbeatHandle);
          }
          const data: any = openRouterResult.data;
          await logLlmEvent({
            source: logSource,
            request: openRouterResult.request,
            response: data,
            metadata: { ...logMetadata, provider: "openrouter" },
          });

          const finishReason = data.choices?.[0]?.finish_reason ?? "unknown";
          const content = data.choices?.[0]?.message?.content ?? "";
          const actualModel = data.model || openRouterResult.model || activeModel;
          const usage = data.usage
            ? {
                promptTokens: data.usage.prompt_tokens ?? 0,
                cachedPromptTokens: data.usage.prompt_tokens_details?.cached_tokens ?? 0,
                completionTokens: data.usage.completion_tokens ?? 0,
                totalTokens: data.usage.total_tokens ?? 0,
                model: actualModel,
                reasoningTokens: data.usage.completion_tokens_details?.reasoning_tokens ?? 0,
              }
            : undefined;

          if (finishReason === "length") {
            console.warn(
              `[llm-client] OpenRouter response truncated for context="${input.context ?? "unknown"}", model=${actualModel}.`
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
            if (input.context?.startsWith("story-writer")) {
              console.warn(
                `[llm-client] Returning empty truncated OpenRouter response to story-writer recovery for context="${input.context}" on model ${activeModel}`
              );
              return { content, usage, finishReason };
            }
            lastError = new Error(
              `OpenRouter returned empty truncated response for context="${input.context ?? "unknown"}" on model ${activeModel}`
            );
            break;
          }

          return { content, usage, finishReason };
        }

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
      const actualModel = data.model || activeModel;
      const usage = data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            cachedPromptTokens: data.usage.prompt_tokens_details?.cached_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
            model: actualModel,
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
  const model = usage.model || "gpt-5.4-mini";
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
  if (isOpenRouterFamilyModel(model)) return getOpenRouterModelPricing(model).inputCostPer1M;
  if (model.includes("claude-sonnet-4-6")) return 3.0;
  if (model.includes("gemini-3.1-flash-lite")) return 0.25;
  if (model.includes("gemini-3-flash")) return 0.5;
  if (model.includes("gemini")) return 0.0;
  if (model.includes("gpt-5.4-nano")) return 0.20;
  if (model.includes("gpt-5.4-mini")) return 0.75;
  if (model.includes("gpt-5-pro")) return 5.0;
  if (model.includes("gpt-5")) return 2.5;
  if (model.includes("o4-mini")) return 1.1;
  if (model.includes("gpt-4")) return 2.5;
  return 0.75;
}

function cachedInputPricePerMillion(model: string): number {
  return inputPricePerMillion(model);
}

function normalizeReasoningEffort(
  reasoningEffort?: "minimal" | "none" | "low" | "medium" | "high" | "xhigh"
): "none" | "low" | "medium" | "high" | "xhigh" {
  if (!reasoningEffort || reasoningEffort === "minimal") return "none";
  return reasoningEffort;
}

function outputPricePerMillion(model: string): number {
  if (isOpenRouterFamilyModel(model)) return getOpenRouterModelPricing(model).outputCostPer1M;
  if (model.includes("claude-sonnet-4-6")) return 15.0;
  if (model.includes("gemini-3.1-flash-lite")) return 1.5;
  if (model.includes("gemini-3-flash")) return 3.0;
  if (model.includes("gemini")) return 0.0;
  if (model.includes("gpt-5.4-nano")) return 1.25;
  if (model.includes("gpt-5.4-mini")) return 4.50;
  if (model.includes("gpt-5-pro")) return 20.0;
  if (model.includes("gpt-5")) return 10.0;
  if (model.includes("o4-mini")) return 4.4;
  if (model.includes("gpt-4")) return 10.0;
  return 4.5;
}
