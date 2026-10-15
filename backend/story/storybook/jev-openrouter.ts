/**
 * Production implementation of the Jev port (OpenRouter Decisions API).
 *
 * Not the chat endpoint: POST /api/alpha/decisions takes the picture as a base64
 * JPEG in `state` and one typed question per check, and answers with a probability
 * per question. Jev accepts only data URLs (no remote URLs), 256–1568 px per side.
 * The image input is flagged an early feature by TypeSafe, so the caller treats
 * every failure as "no second opinion", never as a verdict.
 */

import sharp from "sharp";
import { JEV_MODEL, type JevPort } from "./jev";

const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";
const FETCH_TIMEOUT_MS = 20_000;
const REQUEST_TIMEOUT_MS = 30_000;

async function imageBytes(url: string): Promise<Buffer> {
  if (url.startsWith("data:")) return Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`picture download failed (HTTP ${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

/**
 * The key comes from the caller (Encore secret in the service, env in local scripts), so this file
 * stays free of the Encore runtime. Undefined when switched off (TALEA_JEV_CHECK=off) or no key is set.
 */
export function createOpenRouterJevPort(getApiKey: () => string | null | undefined): JevPort | undefined {
  if (process.env.TALEA_JEV_CHECK === "off") return undefined;
  if (!getApiKey()) return undefined;
  return async ({ imageUrl, questions }) => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("OpenRouter API key not configured");
    const started = Date.now();
    const jpeg = await sharp(await imageBytes(imageUrl), { limitInputPixels: 40_000_000 })
      .resize(768, 768, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    const response = await fetch(DECISIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://www.talea.website",
        "X-OpenRouter-Title": process.env.OPENROUTER_APP_TITLE || "Talea Storytelling Platform",
      },
      body: JSON.stringify({
        model: JEV_MODEL,
        state: ["Illustration from a children's book:", { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` } }],
        questions,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`OpenRouter decisions API error ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const data: any = await response.json();
    const answers: Record<string, number> = {};
    for (const [key, answer] of Object.entries<any>(data?.answers || {})) if (Number.isFinite(Number(answer?.noul))) answers[key] = Number(answer.noul);
    return {
      answers,
      costUSD: Number(data?.usage?.cost) || 0,
      inputTokens: Number(data?.usage?.input_tokens) || 0,
      durationMs: Date.now() - started,
    };
  };
}
