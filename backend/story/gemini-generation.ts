/**
 * Google Gemini 2.0 Flash Story Generation
 *
 * This module handles story generation using Google's Gemini 2.0 Flash model.
 * Provides high-quality, creative story generation with cost-effective pricing.
 */

import { secret } from "encore.dev/config";

const geminiApiKey = secret("GeminiAPIKey");

interface GeminiGenerationRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature?: number;
}

interface GeminiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface GeminiGenerationResponse {
  content: string;
  usage: GeminiUsage;
  finishReason: string;
}

/**
 * Generate story content using Google Gemini 2.0 Flash
 */
export async function generateWithGemini(
  request: GeminiGenerationRequest
): Promise<GeminiGenerationResponse> {
  const apiKey = geminiApiKey();

  if (!apiKey) {
    throw new Error("Gemini API key not configured. Please set GeminiAPIKey secret.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

  // Combine system and user prompts for Gemini
  const combinedPrompt = `${request.systemPrompt}\n\n${request.userPrompt}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: combinedPrompt
          }
        ]
      }
    ],
    generationConfig: {
      temperature: request.temperature ?? 0.9,
      maxOutputTokens: request.maxTokens,
      responseMimeType: "application/json",
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

  console.log("[gemini-generation] Calling Gemini API...");
  const startTime = Date.now();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseTime = Date.now() - startTime;
  console.log(`[gemini-generation] Response received in ${responseTime}ms`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[gemini-generation] Gemini API error:", {
      status: response.status,
      statusText: response.statusText,
      body: errorText
    });
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

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

  const finishReason = data.candidates?.[0]?.finishReason || "STOP";

  console.log("[gemini-generation] Generation successful:", {
    contentLength: content.length,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    finishReason,
    responseTimeMs: responseTime
  });

  return {
    content,
    usage,
    finishReason
  };
}

/**
 * Check if Gemini API is properly configured
 */
export function isGeminiConfigured(): boolean {
  try {
    const key = geminiApiKey();
    return Boolean(key && key.length > 0);
  } catch {
    return false;
  }
}
