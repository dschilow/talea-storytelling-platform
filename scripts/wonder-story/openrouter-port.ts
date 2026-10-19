import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { LlmCallResult, StorybookLlm } from "../../backend/story/storybook/llm";
import { acceptsTemperature, extractStorybookChoiceContent, resolveStorybookReasoning } from "../../backend/story/storybook/llm-guards";

/** Explicitly selected test transport; never silently spends API credits after Codex fails. */
export function openRouterPort(out: string, maxCalls = 12): StorybookLlm {
  let calls = 0;
  return async request => {
    if (++calls > maxCalls) throw new Error(`Test call ceiling reached (${maxCalls}).`);
    const key = process.env.OPENROUTER_API_KEY || process.env.OpenRouterAPIKey;
    if (!key) throw new Error("OPENROUTER_API_KEY is missing.");
    const prefix = `${String(calls).padStart(2, "0")}-${request.stage}`;
    await writeFile(join(out, `${prefix}.request.json`), JSON.stringify(request, null, 2));
    console.log(`  ${request.stage} · ${request.model} · OpenRouter`);
    const started = Date.now();
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(request.timeoutMs || 360_000),
      body: JSON.stringify({ model: request.model, messages: [{ role: "system", content: request.system }, { role: "user", content: request.user }],
        max_tokens: request.maxTokens, response_format: { type: request.json ? "json_object" : "text" },
        reasoning: resolveStorybookReasoning(request.model, request.effort, request.role),
        ...(acceptsTemperature(request.model) ? { temperature: request.temperature } : {}), usage: { include: true } }),
    });
    if (!response.ok) throw new Error(`OpenRouter returned HTTP ${response.status}; no automatic retry.`);
    const data: any = await response.json();
    if (data.error) throw new Error(`OpenRouter provider error: ${data.error.code || "unknown"}`);
    const u = data.usage || {};
    const result: LlmCallResult = { text: extractStorybookChoiceContent(data.choices?.[0]), modelUsed: data.model || request.model,
      usage: { prompt: u.prompt_tokens || 0, completion: u.completion_tokens || 0, total: u.total_tokens || 0, costUSD: u.cost ?? 0,
        reasoningTokens: u.completion_tokens_details?.reasoning_tokens || 0, cachedPromptTokens: u.prompt_tokens_details?.cached_tokens || 0 },
      durationMs: Date.now() - started, finishReason: data.choices?.[0]?.finish_reason };
    // Persist even unusable paid answers; reports must not erase their cost.
    await writeFile(join(out, `${prefix}.response.json`), JSON.stringify({ ...result, providerCostReported: typeof u.cost === "number" }, null, 2));
    await writeFile(join(out, `${prefix}.txt`), result.text);
    return result;
  };
}

/** Replay only identical stage instructions; changed prompts always require a new call. */
export async function withReplay(port: StorybookLlm, source: string, out: string, seen = new Set<string>()): Promise<StorybookLlm> {
  source = resolve(source);
  if (seen.has(source)) return port;
  seen.add(source);
  const files = await readdir(source);
  const records = await Promise.all(files.filter(f => f.endsWith(".request.json")).map(async file => {
    const prefix = file.replace(/\.request\.json$/, "");
    try {
      const request = JSON.parse(await readFile(join(source, file), "utf8"));
      const text = await readFile(join(source, `${prefix}.txt`), "utf8");
      if (!text.trim()) return null;
      let result: LlmCallResult;
      try { result = JSON.parse(await readFile(join(source, `${prefix}.response.json`), "utf8")); }
      catch {
        const events = (await readFile(join(source, `${prefix}.events.jsonl`), "utf8")).split(/\r?\n/).flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } });
        if (!events.some(e => e.type === "turn.completed")) return null;
        result = { text, modelUsed: request.actualModel, usage: { prompt: 0, completion: 0, total: 0, costUSD: 0 }, durationMs: 0, finishReason: "stop" };
      }
      return { request, result, prefix };
    } catch { return null; }
  }));
  // A resumed run may itself consist mostly of replays. Carry their original
  // answers forward so a second resume does not buy the same planning again.
  const upstream = new Set<string>();
  for (const file of files.filter(f => f.endsWith(".replay.json"))) {
    const saved = JSON.parse(await readFile(join(source, file), "utf8"));
    if (typeof saved.source === "string" && saved.source !== source && saved.source !== out) upstream.add(saved.source);
  }
  let fallback = port;
  for (const directory of upstream) fallback = await withReplay(fallback, directory, out, seen);
  return async request => {
    const hit = records.find(r => r && ["stage", "system", "user", "json"].every(k => r.request[k] === request[k as keyof typeof request]));
    if (!hit) return fallback(request);
    console.log(`  ${request.stage} · saved answer (${hit.result.modelUsed})`);
    await writeFile(join(out, `${request.stage}.replay.json`), JSON.stringify({ source, prefix: hit.prefix, modelUsed: hit.result.modelUsed, note: "No new inference or charge; original usage remains in source logs." }, null, 2));
    return { ...hit.result, usage: { prompt: 0, completion: 0, total: 0, costUSD: 0 }, durationMs: 0 };
  };
}
