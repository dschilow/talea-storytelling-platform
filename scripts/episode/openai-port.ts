/**
 * Test transport for the story engines: OpenAI models (Sol, Luna) go straight
 * to api.openai.com with the family's own OPENAI_API_KEY; anything else goes
 * to OpenRouter, but only when `allowOpenRouter` is set. Every request and
 * answer is written to the output folder, with its cost.
 *
 * Local test tool only — production keeps llm-openrouter.ts.
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LlmCallResult, LlmRequest, StorybookLlm } from "../../backend/story/storybook/llm";
import { acceptsTemperature, extractStorybookChoiceContent, resolveStorybookReasoning } from "../../backend/story/storybook/llm-guards";

/** $ per 1M tokens (OpenAI list prices as in the backend catalogue; cached input at a tenth). */
const OPENAI_PRICES: Record<string, { input: number; cached: number; output: number }> = {
  "gpt-6.1-sol": { input: 2.0, cached: 0.2, output: 10.0 },
  "gpt-6-sol": { input: 2.0, cached: 0.2, output: 10.0 },
  "gpt-6-luna": { input: 0.1, cached: 0.01, output: 0.5 },
  "gpt-5.6-luna": { input: 0.2, cached: 0.02, output: 1.0 },
};

export interface PortOptions {
  out: string;
  maxCalls?: number;
  allowOpenRouter?: boolean;
  /** Send OpenAI models through OpenRouter too — the production path (needs allowOpenRouter). */
  forceOpenRouter?: boolean;
  serviceTier?: "flex";
}

export function createTestPort(options: PortOptions): StorybookLlm & { spent: () => number } {
  let calls = 0;
  let spent = 0;
  const port = (async (request: LlmRequest) => {
    if (++calls > (options.maxCalls ?? 12)) throw new Error(`Test call ceiling reached (${options.maxCalls ?? 12}).`);
    const prefix = `${String(calls).padStart(2, "0")}-${request.stage}`;
    await writeFile(join(options.out, `${prefix}.request.json`), JSON.stringify(request, null, 2));
    const openai = !options.forceOpenRouter && (/^openai\//.test(request.model) || !request.model.includes("/"));
    const result = openai ? await callOpenAI(request, options) : await callOpenRouter(request, options);
    spent += result.usage.costUSD;
    await writeFile(join(options.out, `${prefix}.response.json`), JSON.stringify(result, null, 2));
    await writeFile(join(options.out, `${prefix}.txt`), result.text);
    console.log(`  ${request.stage} · ${result.modelUsed} · ${(result.durationMs / 1000).toFixed(0)} s · ${result.usage.prompt}+${result.usage.completion} tok (reasoning ${result.usage.reasoningTokens ?? 0}, cached ${result.usage.cachedPromptTokens ?? 0}) · $${result.usage.costUSD.toFixed(4)}`);
    return result;
  }) as StorybookLlm & { spent: () => number };
  port.spent = () => spent;
  return port;
}

async function callOpenAI(request: LlmRequest, options: PortOptions): Promise<LlmCallResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is missing (bun --env-file=.env.local …).");
  const model = request.model.replace(/^openai\//, "");
  const effort = request.effort === "xhigh" || request.effort === "max" ? "high" : request.effort;
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "system", content: request.system }, { role: "user", content: request.user }],
    max_completion_tokens: request.maxTokens,
    ...(request.json ? { response_format: { type: "json_object" } } : {}),
    ...(effort ? { reasoning_effort: effort } : {}),
    prompt_cache_key: `talea-${request.stage.replace(/-(repair|retry|revision).*$/, "")}`,
    ...(options.serviceTier ? { service_tier: options.serviceTier } : {}),
  };
  const started = Date.now();
  let response = await post("https://api.openai.com/v1/chat/completions", key, body, request.timeoutMs);
  // Flex is refused under load (429 flex_unavailable) or not offered (400): same request on the default tier.
  if ((response.status === 400 || response.status === 429) && options.serviceTier) {
    console.log(`  ${request.stage}: flex refused (${response.status}), default tier`);
    delete body.service_tier;
    response = await post("https://api.openai.com/v1/chat/completions", key, body, request.timeoutMs);
  }
  const raw = await response.text();
  if (!response.ok) throw new Error(`OpenAI ${response.status} (${request.stage}, ${model}): ${raw.slice(0, 400)}`);
  const data = JSON.parse(raw);
  const usage = data.usage || {};
  const prompt = Number(usage.prompt_tokens) || 0;
  const cached = Number(usage.prompt_tokens_details?.cached_tokens) || 0;
  const completion = Number(usage.completion_tokens) || 0;
  const price = OPENAI_PRICES[model] || OPENAI_PRICES["gpt-6.1-sol"];
  const tier = data.service_tier === "flex" ? 0.5 : 1;
  const costUSD = Number((((prompt - cached) * price.input + cached * price.cached + completion * price.output) / 1_000_000 * tier).toFixed(6));
  const choice = data.choices?.[0];
  const text = extractStorybookChoiceContent(choice);
  if (!text) throw new Error(`OpenAI empty answer (${request.stage}, finish_reason=${choice?.finish_reason}, completion_tokens=${completion}).`);
  return {
    text,
    modelUsed: `openai/${data.model || model}`,
    usage: { prompt, completion, total: Number(usage.total_tokens) || prompt + completion, costUSD, cachedPromptTokens: cached, reasoningTokens: Number(usage.completion_tokens_details?.reasoning_tokens) || 0 },
    durationMs: Date.now() - started,
    finishReason: choice?.finish_reason,
    ...(data.service_tier ? { serviceTier: data.service_tier } : {}),
  };
}

async function callOpenRouter(request: LlmRequest, options: PortOptions): Promise<LlmCallResult> {
  if (!options.allowOpenRouter) throw new Error(`${request.model} is not an OpenAI model and OpenRouter is not allowed for this run (--allow-openrouter).`);
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is missing.");
  const started = Date.now();
  const body: Record<string, unknown> = {
    model: request.model,
    messages: [{ role: "system", content: request.system }, { role: "user", content: request.user }],
    max_tokens: request.maxTokens,
    response_format: { type: request.json ? "json_object" : "text" },
    reasoning: resolveStorybookReasoning(request.model, request.effort, request.role),
    ...(acceptsTemperature(request.model) && request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(options.serviceTier ? { service_tier: options.serviceTier } : {}),
    usage: { include: true },
  };
  let response = await post("https://openrouter.ai/api/v1/chat/completions", key, body, request.timeoutMs);
  if (!response.ok && options.serviceTier) {
    console.log(`  ${request.stage}: flex refused on OpenRouter (${response.status}), default tier`);
    delete body.service_tier;
    response = await post("https://openrouter.ai/api/v1/chat/completions", key, body, request.timeoutMs);
  }
  const raw = await response.text();
  if (!response.ok) throw new Error(`OpenRouter ${response.status} (${request.stage}, ${request.model}): ${raw.slice(0, 400)}`);
  const data = JSON.parse(raw);
  const u = data.usage || {};
  const text = extractStorybookChoiceContent(data.choices?.[0]);
  if (!text) throw new Error(`OpenRouter empty answer (${request.stage}).`);
  return {
    text,
    modelUsed: data.model || request.model,
    usage: { prompt: u.prompt_tokens || 0, completion: u.completion_tokens || 0, total: u.total_tokens || 0, costUSD: Number(u.cost) || 0, reasoningTokens: u.completion_tokens_details?.reasoning_tokens || 0, cachedPromptTokens: u.prompt_tokens_details?.cached_tokens || 0 },
    durationMs: Date.now() - started,
    finishReason: data.choices?.[0]?.finish_reason,
    ...(typeof data.service_tier === "string" ? { serviceTier: data.service_tier } : {}),
  };
}

function post(url: string, key: string, body: unknown, timeoutMs = 360_000) {
  return fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify(body),
  });
}
