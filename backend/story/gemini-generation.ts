/**
 * Google Gemini Story Generation
 *
 * This module handles story generation using Google's Gemini API.
 * Provides high-quality, creative story generation with cost-effective pricing.
 */

import { secret } from "encore.dev/config";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { logTopic } from "../log/logger";

const geminiApiKey = secret("GeminiAPIKey");
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1500;
const MAX_RETRY_DELAY_MS = 15000;
const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
const GEMINI_FETCH_TIMEOUT_MS = 120000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseRetryDelayMs(errorText: string, response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (header) {
    const headerSeconds = Number(header);
    if (!Number.isNaN(headerSeconds)) return headerSeconds * 1000;
  }

  const match = errorText.match(/"retryDelay"\s*:\s*"(\d+)(s|ms)"/);
  if (match) {
    const value = Number(match[1]);
    if (!Number.isNaN(value)) {
      return match[2] === "ms" ? value : value * 1000;
    }
  }

  return null;
}

function resolveGeminiModelCandidates(requestedModel?: string): string[] {
  const normalized = (requestedModel || "").trim();
  const primaryModel =
    normalized.length > 0 && normalized.startsWith("gemini-")
      ? normalized
      : DEFAULT_GEMINI_MODEL;

  if (primaryModel === DEFAULT_GEMINI_MODEL) {
    return [DEFAULT_GEMINI_MODEL];
  }

  return [primaryModel, DEFAULT_GEMINI_MODEL];
}

function shouldFallbackToDefaultModel(input: {
  status: number;
  errorText: string;
  modelName: string;
}): boolean {
  const { status, errorText, modelName } = input;
  if (modelName === DEFAULT_GEMINI_MODEL) return false;
  if (status === 404) return true;

  const lowered = errorText.toLowerCase();
  if (status === 503 && (lowered.includes("high demand") || lowered.includes("unavailable"))) {
    return true;
  }

  if (status !== 400) return false;

  return (
    lowered.includes("not found") ||
    lowered.includes("unknown model") ||
    lowered.includes("unsupported model") ||
    lowered.includes("is not supported")
  );
}

function isTimeoutLikeFetchError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : String(error ?? "");
  const lowered = message.toLowerCase();
  return (
    lowered.includes("timeout") ||
    lowered.includes("headers timeout") ||
    lowered.includes("und_err_headers_timeout") ||
    lowered.includes("aborted")
  );
}

function resolveGeminiApiKey(): string | null {
  const fromEnv =
    process.env.ENCORE_SECRET_GEMINIAPIKEY ||
    process.env.GEMINI_API_KEY;

  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  try {
    const key = geminiApiKey();
    if (key && key.trim().length > 0) {
      return key.trim();
    }
  } catch {
    // Ignore secret resolution errors here; we'll throw a clearer message below.
  }

  return null;
}

interface GeminiGenerationRequest {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  maxTokens: number;
  temperature?: number;
  thinkingBudget?: number; // Optional override for internal reasoning tokens.
  logSource?: string;
  logMetadata?: Record<string, any>;
}

interface GeminiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface GeminiGenerationResponse {
  model: string;
  content: string;
  usage: GeminiUsage;
  finishReason: string;
}

async function logGeminiLlmEvent(input: {
  source: string;
  request: any;
  response: any;
  metadata?: Record<string, any>;
}) {
  try {
    await publishWithTimeout(logTopic as any, {
      source: input.source,
      timestamp: new Date(),
      request: input.request,
      response: input.response,
      metadata: input.metadata ?? null,
    });
  } catch (error) {
    console.warn("[gemini-generation] Failed to publish LLM event log", error);
  }
}

function resolveDefaultThinkingBudget(modelName: string, maxTokens: number): number {
  const normalized = (modelName || "").toLowerCase();
  if (normalized.includes("flash")) {
    if (maxTokens >= 7000) return 896;
    if (maxTokens >= 3500) return 640;
    return 192;
  }
  if (normalized.includes("gemini-3")) {
    if (maxTokens >= 9000) return 1536;
    if (maxTokens >= 4500) return 1024;
    return 320;
  }
  return 512;
}

/**
 * Generate story content using Google Gemini API
 */
export async function generateWithGemini(
  request: GeminiGenerationRequest
): Promise<GeminiGenerationResponse> {
  const apiKey = resolveGeminiApiKey();

  if (!apiKey) {
    throw new Error(
      "Gemini API key not configured. Set ENCORE_SECRET_GEMINIAPIKEY or GEMINI_API_KEY."
    );
  }
  const modelCandidates = resolveGeminiModelCandidates(request.model);
  const maxOutputTokens = request.maxTokens || 65536;

  let lastError: Error | null = null;

  for (let modelIndex = 0; modelIndex < modelCandidates.length; modelIndex += 1) {
    const modelName = modelCandidates[modelIndex];
    const thinkingBudget = request.thinkingBudget ?? resolveDefaultThinkingBudget(modelName, maxOutputTokens);
    const payload = {
      systemInstruction: {
        parts: [{ text: request.systemPrompt }]
      },
      contents: [
        {
          parts: [
            {
              text: request.userPrompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: request.temperature ?? 0.85,
        maxOutputTokens,
        responseMimeType: "application/json",
        thinkingConfig: {
          thinkingBudget,
        },
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE"
        }
      ]
    };
    const hasFallback = modelIndex < modelCandidates.length - 1;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${apiKey}`;
    let data: any = null;
    let responseTime = 0;
    let fallbackTriggered = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      console.log(
        `[gemini-generation] Calling Gemini API model=${modelName} (attempt ${attempt}/${MAX_RETRIES}), maxOutputTokens=${maxOutputTokens}, thinkingBudget=${thinkingBudget}...`
      );
      const startTime = Date.now();

      const abortController = new AbortController();
      const timeoutHandle = setTimeout(() => abortController.abort(), GEMINI_FETCH_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: abortController.signal,
        });
      } catch (fetchError) {
        responseTime = Date.now() - startTime;
        clearTimeout(timeoutHandle);
        console.error("[gemini-generation] Gemini fetch failed:", {
          model: modelName,
          attempt,
          responseTimeMs: responseTime,
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
        });

        if (hasFallback && isTimeoutLikeFetchError(fetchError)) {
          console.warn(
            `[gemini-generation] Model ${modelName} timed out. Falling back to ${DEFAULT_GEMINI_MODEL}.`
          );
          fallbackTriggered = true;
          break;
        }

        if (attempt < MAX_RETRIES) {
          const delay = Math.min(INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1), MAX_RETRY_DELAY_MS);
          console.warn(`[gemini-generation] Network/fetch error; waiting ${delay}ms before retry`);
          await sleep(delay);
          continue;
        }

        lastError = new Error(
          `Gemini API fetch failed (${modelName}): ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`
        );
        break;
      } finally {
        clearTimeout(timeoutHandle);
      }

      responseTime = Date.now() - startTime;
      console.log(`[gemini-generation] Response received in ${responseTime}ms`);

      if (response.ok) {
        data = await response.json();
        break;
      }

      const errorText = await response.text();
      console.error("[gemini-generation] Gemini API error:", {
        model: modelName,
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });

      if (
        hasFallback &&
        shouldFallbackToDefaultModel({
          status: response.status,
          errorText,
          modelName,
        })
      ) {
        console.warn(
          `[gemini-generation] Model ${modelName} unavailable. Falling back to ${DEFAULT_GEMINI_MODEL}.`
        );
        fallbackTriggered = true;
        break;
      }

      const retryable = response.status === 429 || response.status === 503 || response.status === 500;
      if (retryable && attempt < MAX_RETRIES) {
        const delay = Math.min(
          parseRetryDelayMs(errorText, response) ?? INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1),
          MAX_RETRY_DELAY_MS
        );
        console.warn(`[gemini-generation] Retryable error (${response.status}); waiting ${delay}ms before retry`);
        await sleep(delay);
        continue;
      }

      lastError = new Error(`Gemini API error (${modelName}): ${response.status} - ${errorText}`);
      break;
    }

    if (fallbackTriggered) {
      continue;
    }

    if (!data) {
      if (lastError) {
        break;
      }
      lastError = new Error(`Gemini API error (${modelName}): failed to receive response after retries`);
      break;
    }

    // Extract content from Gemini response
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      console.error("[gemini-generation] Invalid Gemini response structure:", data);
      throw new Error("Invalid response from Gemini API - no content found");
    }

    // Extract usage metadata
    const usageMetadata = data.usageMetadata || {};
    const usage: GeminiUsage = {
      promptTokens: usageMetadata.promptTokenCount || 0,
      completionTokens: usageMetadata.candidatesTokenCount || 0,
      totalTokens: usageMetadata.totalTokenCount || 0,
    };
    const thoughtsTokenCount = usageMetadata.thoughtsTokenCount || 0;

    const finishReason = data.candidates?.[0]?.finishReason || "STOP";

    console.log("[gemini-generation] Generation successful:", {
      model: modelName,
      contentLength: content.length,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      thoughtsTokens: thoughtsTokenCount,
      totalTokens: usage.totalTokens,
      finishReason,
      maxOutputTokensRequested: request.maxTokens,
      responseTimeMs: responseTime,
    });

    await logGeminiLlmEvent({
      source: request.logSource || "gemini-story-generation",
      request: {
        model: modelName,
        payload,
      },
      response: data,
      metadata: request.logMetadata,
    });

    return {
      model: modelName,
      content,
      usage,
      finishReason,
    };
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Gemini API error: failed to receive response after retries");
}

/**
 * Check if Gemini API is properly configured
 */
export function isGeminiConfigured(): boolean {
  return Boolean(resolveGeminiApiKey());
}
