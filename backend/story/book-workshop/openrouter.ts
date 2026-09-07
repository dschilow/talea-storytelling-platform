import type { ModelPrice, Transport } from "./types";

/** Price ceilings verified 2026-09-07. No promotional discount assumed.
 * Unknown Wizard models require a live catalogue quote before generation.
 */
export const VERIFIED_PRICES: Record<string, ModelPrice> = {
  "openai/gpt-5.6-luna": { inputPerMillion: 0.2, outputPerMillion: 1.2 },
  "moonshotai/kimi-k2.6": { inputPerMillion: 0.7, outputPerMillion: 3.5 },
  "google/gemini-3.1-flash-lite": { inputPerMillion: 0.25, outputPerMillion: 1.5 },
};
const reasoningCapabilities = new Map<string, { supported_efforts?: string[]; mandatory?: boolean }>();
export function reasoningFor(model: string): Record<string, unknown> | undefined {
  const capability = reasoningCapabilities.get(model);
  if (Array.isArray(capability?.supported_efforts)) {
    const effort = ["none", "minimal", "low", "medium", "high", "xhigh", "max"].find(e =>
      capability.supported_efforts!.includes(e) && !(e === "none" && capability.mandatory));
    return effort ? { effort, exclude: true } : undefined;
  }
  if (model.startsWith("openai/gpt-5.6-luna")) return { effort: "none", exclude: true };
  if (/^openai\/gpt-5(?:-mini|-nano)?(?:$|:\w+$)/.test(model)) return { effort: "minimal", exclude: true };
  if (/^google\/gemini-3/.test(model)) return { effort: "minimal", exclude: true };
  if (model === "moonshotai/kimi-k2.6") return { enabled: false, exclude: true };
  // Do not send an unsupported reasoning parameter to an arbitrary Wizard model.
  // max_tokens still caps all generated tokens, including internal reasoning.
  return undefined;
}
/** No model substitution, silent retry, tool call or paid prompt repair. */
export function openRouterTransport(apiKey: string, fetcher: typeof fetch = fetch): Transport {
  if (!apiKey.trim()) throw new Error("OpenRouter API key unavailable");
  return async request => {
    const response = await fetcher("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", signal: request.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "X-OpenRouter-Title": "Talea Book Workshop" },
      body: JSON.stringify({
        model: request.model,
        messages: [{ role: "system", content: request.system }, { role: "user", content: request.user }],
        response_format: { type: "json_object" }, max_tokens: request.maxTokens,
        reasoning: reasoningFor(request.model),
        usage: { include: true },
        provider: { max_price: { prompt: request.price.inputPerMillion, completion: request.price.outputPerMillion }, require_parameters: true, allow_fallbacks: false },
      }),
    });
    // Do not expose provider error bodies or authentication material in logs.
    if (!response.ok) throw new Error(`OpenRouter HTTP ${response.status}`);
    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const rawCost = data.usage?.cost;
    return {
      text: typeof content === "string" ? content : Array.isArray(content) ? content.map(p => p?.text || "").join("\n") : "",
      model: String(data.model || request.model),
      promptTokens: data.usage?.prompt_tokens ?? NaN, completionTokens: data.usage?.completion_tokens ?? NaN,
      costUSD: rawCost !== null && rawCost !== undefined && rawCost !== "" && Number.isFinite(Number(rawCost)) && Number(rawCost) >= 0 ? Number(rawCost) : undefined,
      finishReason: String(data.choices?.[0]?.finish_reason || "unknown"),
    };
  };
}
let catalog: { expires: number; prices: Record<string, ModelPrice> } | undefined;
export async function resolvePrices(models: string[]): Promise<Record<string, ModelPrice>> {
  if (models.every(m => VERIFIED_PRICES[m])) return { ...VERIFIED_PRICES };
  if (!catalog || catalog.expires < Date.now()) {
    const response = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error("Model pricing unavailable");
    const data: any = await response.json();
    const prices: Record<string, ModelPrice> = {};
    for (const entry of data.data || []) {
      if (entry.reasoning) reasoningCapabilities.set(entry.id, entry.reasoning);
      if (entry.pricing?.prompt == null || entry.pricing?.completion == null) continue;
      const input = Number(entry.pricing.prompt) * 1e6, output = Number(entry.pricing.completion) * 1e6;
      // Reject per-request fees rather than silently omitting them from a cap.
      if (Number(entry.pricing.request || 0) > 0 || !Number.isFinite(input + output) || input < 0 || output < 0) continue;
      prices[entry.id] = { inputPerMillion: input, outputPerMillion: output };
    }
    catalog = { expires: Date.now() + 3600_000, prices };
  }
  const prices = { ...VERIFIED_PRICES, ...catalog.prices };
  if (models.some(m => !prices[m])) throw new Error("The selected model has no verified token-only price");
  return prices;
}
