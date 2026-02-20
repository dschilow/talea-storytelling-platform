/**
 * Google Gemini Story Generation
 *
 * This module handles story generation using Google's Gemini API.
 * Provides high-quality, creative story generation with cost-effective pricing.
 */

import { secret } from "encore.dev/config";

const geminiApiKey = secret("GeminiAPIKey");
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1500;
const MAX_RETRY_DELAY_MS = 15000;
const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";

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

function shouldFallbackToDefaultModel(status: number, errorText: string): boolean {
  if (status === 404) return true;
  if (status !== 400) return false;

  const lowered = errorText.toLowerCase();
  return (
    lowered.includes("not found") ||
    lowered.includes("unknown model") ||
    lowered.includes("unsupported model") ||
    lowered.includes("is not supported")
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
  thinkingBudget?: number; // Thinking tokens for internal reasoning (default: 4096)
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
      maxOutputTokens: request.maxTokens || 65536,
      responseMimeType: "application/json",
      thinkingConfig: {
        thinkingBudget: request.thinkingBudget ?? 4096, // Internal reasoning before story generation
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

  let lastError: Error | null = null;

  for (let modelIndex = 0; modelIndex < modelCandidates.length; modelIndex += 1) {
    const modelName = modelCandidates[modelIndex];
    const hasFallback = modelIndex < modelCandidates.length - 1;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${apiKey}`;
    let data: any = null;
    let responseTime = 0;
    let fallbackTriggered = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      console.log(
        `[gemini-generation] Calling Gemini API model=${modelName} (attempt ${attempt}/${MAX_RETRIES}), maxOutputTokens=${request.maxTokens}...`
      );
      const startTime = Date.now();

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

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

      if (hasFallback && shouldFallbackToDefaultModel(response.status, errorText)) {
        console.warn(
          `[gemini-generation] Model ${modelName} unavailable. Falling back to ${DEFAULT_GEMINI_MODEL}.`
        );
        fallbackTriggered = true;
        break;
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
