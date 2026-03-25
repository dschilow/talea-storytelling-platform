import { secret } from "encore.dev/config";

const runwareApiKey = secret("RunwareApiKey");

const RUNWARE_API_URL = "https://api.runware.ai/v1";
const RUNWARE_TEXT_TIMEOUT_MS = 300_000; // 5 min for story generation
const RUNWARE_TEXT_MAX_RETRIES = 3;
const RUNWARE_TEXT_RETRY_BASE_DELAY_MS = 1_000;

// Map internal model IDs to Runware model references.
// Prefer the standard M2.7 variant for long, schema-heavy story jobs.
const RUNWARE_MODEL_MAP: Record<string, string> = {
  "minimax-m2.7": "minimax:m2.7@0",
};

export interface RunwareTextRequest {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface RunwareTextResponse {
  content: string;
  model: string;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;
}

export function isRunwareConfigured(): boolean {
  try {
    const key = runwareApiKey();
    return Boolean(key);
  } catch {
    return false;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503 || status >= 500;
}

export async function generateWithRunwareText(
  req: RunwareTextRequest,
): Promise<RunwareTextResponse> {
  if (!isRunwareConfigured()) {
    throw new Error("RunwareApiKey is not configured.");
  }

  const runwareModel = RUNWARE_MODEL_MAP[req.model] || req.model;

  const requestBody = {
    taskType: "textInference",
    taskUUID: crypto.randomUUID(),
    model: runwareModel,
    messages: [
      { role: "user", content: req.userPrompt },
    ],
    settings: {
      systemPrompt: req.systemPrompt,
      maxTokens: req.maxTokens || 32768,
      temperature: req.temperature ?? 0.9,
    },
    includeCost: true,
  };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RUNWARE_TEXT_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RUNWARE_TEXT_TIMEOUT_MS);

    try {
      const retryInfo = attempt > 1 ? ` (retry ${attempt}/${RUNWARE_TEXT_MAX_RETRIES})` : "";
      console.log(
        `[Runware Text] Generating with ${runwareModel}${retryInfo}, maxTokens=${requestBody.settings.maxTokens}`
      );

      const response = await fetch(RUNWARE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runwareApiKey()}`,
        },
        body: JSON.stringify([requestBody]),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        const msg = `Runware textInference failed (${response.status}): ${errBody || "<empty>"}`;

        if (attempt < RUNWARE_TEXT_MAX_RETRIES && isRetryableStatus(response.status)) {
          lastError = new Error(msg);
          const backoff = RUNWARE_TEXT_RETRY_BASE_DELAY_MS * attempt;
          console.warn(`Runware text attempt ${attempt}/${RUNWARE_TEXT_MAX_RETRIES} failed: ${msg}. Retrying in ${backoff}ms.`);
          await delay(backoff);
          continue;
        }

        throw new Error(msg);
      }

      const responseText = await response.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`Failed to parse Runware text response: ${responseText.slice(0, 500)}`);
      }

      // Extract text from Runware response
      // Response format: { data: [{ taskType: "textInference", text: "...", usage: {...} }] }
      const result = extractRunwareTextResult(data);
      if (!result) {
        console.error(`[Runware Text] No text in response: ${JSON.stringify(data).slice(0, 500)}`);
        throw new Error("No text data found in Runware textInference response");
      }

      console.log(
        `[Runware Text] Generation successful: ${result.usage.totalTokens} tokens, finishReason=${result.finishReason}`
      );

      return {
        content: result.text,
        model: runwareModel,
        finishReason: result.finishReason,
        usage: result.usage,
        cost: result.cost,
      };
    } catch (error) {
      const isAbort = error instanceof Error && error.name === "AbortError";
      if (isAbort && attempt < RUNWARE_TEXT_MAX_RETRIES) {
        lastError = new Error(`Runware text request timed out (attempt ${attempt})`);
        const backoff = RUNWARE_TEXT_RETRY_BASE_DELAY_MS * attempt;
        console.warn(`Runware text timeout on attempt ${attempt}/${RUNWARE_TEXT_MAX_RETRIES}. Retrying in ${backoff}ms.`);
        await delay(backoff);
        continue;
      }
      if (error instanceof Error) {
        lastError = error;
      }
      throw lastError || error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("Runware textInference failed after all retries.");
}

interface RunwareTextResultExtracted {
  text: string;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;
}

function extractRunwareTextResult(data: any): RunwareTextResultExtracted | null {
  const tryExtract = (obj: any): RunwareTextResultExtracted | null => {
    if (!obj || typeof obj !== "object") return null;
    if (typeof obj.text === "string" && obj.text.length > 0) {
      return {
        text: obj.text,
        finishReason: obj.finishReason || "stop",
        usage: {
          promptTokens: obj.usage?.promptTokens ?? 0,
          completionTokens: obj.usage?.completionTokens ?? 0,
          totalTokens: obj.usage?.totalTokens ?? 0,
        },
        cost: obj.cost,
      };
    }
    return null;
  };

  // Case 1: response is an array (Runware wraps responses in arrays)
  if (Array.isArray(data)) {
    for (const item of data) {
      const result = tryExtract(item);
      if (result) return result;
    }
  }

  // Case 2: response has data array
  if (data && typeof data === "object") {
    const result = tryExtract(data);
    if (result) return result;

    for (const key of ["data", "results", "output"]) {
      const arr = data[key];
      if (Array.isArray(arr)) {
        for (const item of arr) {
          const nested = tryExtract(item);
          if (nested) return nested;
        }
      }
    }
  }

  return null;
}
