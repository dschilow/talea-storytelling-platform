import { calculateTokenCosts } from "./llm-client";
import type { StoryCostEntry, TokenUsage } from "./types";

export function normalizeTokenUsage(
  usage?: Partial<TokenUsage> | null,
  fallbackModel?: string,
): TokenUsage | undefined {
  if (!usage) return undefined;

  const promptTokens = toNumber(usage.promptTokens);
  const completionTokens = toNumber(usage.completionTokens);
  const totalTokens = toNumber(usage.totalTokens, promptTokens + completionTokens);
  const model = String(usage.model || fallbackModel || "gpt-5-mini");
  const costs = calculateTokenCosts({ promptTokens, completionTokens, model });

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    model,
    inputCostUSD: isFiniteNumber(usage.inputCostUSD) ? Number(usage.inputCostUSD) : costs.inputCostUSD,
    outputCostUSD: isFiniteNumber(usage.outputCostUSD) ? Number(usage.outputCostUSD) : costs.outputCostUSD,
    totalCostUSD: isFiniteNumber(usage.totalCostUSD) ? Number(usage.totalCostUSD) : costs.totalCostUSD,
  };
}

export function mergeNormalizedTokenUsage(
  current?: TokenUsage,
  next?: Partial<TokenUsage> | null,
  fallbackModel?: string,
): TokenUsage | undefined {
  const normalizedNext = normalizeTokenUsage(next, fallbackModel);
  if (!normalizedNext) return current;
  if (!current) return normalizedNext;

  const mergedPrompt = toNumber(current.promptTokens) + normalizedNext.promptTokens;
  const mergedCompletion = toNumber(current.completionTokens) + normalizedNext.completionTokens;
  const mergedTotal = toNumber(current.totalTokens) + normalizedNext.totalTokens;
  const model =
    current.model && normalizedNext.model && current.model !== normalizedNext.model
      ? "mixed"
      : (current.model || normalizedNext.model || fallbackModel || "gpt-5-mini");

  return {
    promptTokens: mergedPrompt,
    completionTokens: mergedCompletion,
    totalTokens: mergedTotal,
    model,
    inputCostUSD: round6(toNumber(current.inputCostUSD) + toNumber(normalizedNext.inputCostUSD)),
    outputCostUSD: round6(toNumber(current.outputCostUSD) + toNumber(normalizedNext.outputCostUSD)),
    totalCostUSD: round6(toNumber(current.totalCostUSD) + toNumber(normalizedNext.totalCostUSD)),
  };
}

export function buildLlmCostEntry(input: {
  phase: string;
  step: string;
  usage?: Partial<TokenUsage> | null;
  fallbackModel?: string;
  provider?: string;
  candidateTag?: string;
  chapter?: number;
  attempt?: number;
  slotKey?: string;
  success?: boolean;
  itemCount?: number;
  metadata?: Record<string, any>;
}): StoryCostEntry | null {
  const usage = normalizeTokenUsage(input.usage, input.fallbackModel);
  if (!usage) return null;

  return {
    kind: "llm",
    phase: input.phase,
    step: input.step,
    provider: input.provider || inferProviderFromModel(usage.model),
    model: usage.model,
    candidateTag: input.candidateTag,
    chapter: input.chapter,
    attempt: input.attempt,
    slotKey: input.slotKey,
    success: input.success,
    itemCount: input.itemCount,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    inputCostUSD: usage.inputCostUSD,
    outputCostUSD: usage.outputCostUSD,
    totalCostUSD: usage.totalCostUSD,
    metadata: input.metadata,
  };
}

export function buildImageCostEntry(input: {
  phase: string;
  step: string;
  provider: string;
  model?: string;
  chapter?: number;
  attempt?: number;
  success?: boolean;
  prompt?: string;
  negativePrompt?: string;
  referenceCount?: number;
  providerCostUSD?: number | null;
  providerCostCredits?: number | null;
  itemCount?: number;
  metadata?: Record<string, any>;
}): StoryCostEntry {
  return {
    kind: "image",
    phase: input.phase,
    step: input.step,
    provider: input.provider,
    model: input.model,
    chapter: input.chapter,
    attempt: input.attempt,
    success: input.success,
    itemCount: input.itemCount,
    providerCostUSD: normalizeNullableNumber(input.providerCostUSD),
    providerCostCredits: normalizeNullableNumber(input.providerCostCredits),
    promptChars: String(input.prompt || "").length,
    negativePromptChars: String(input.negativePrompt || "").length,
    referenceCount: toNumber(input.referenceCount),
    metadata: input.metadata,
  };
}

export function summarizeStoryCostEntries(entries: StoryCostEntry[]) {
  const normalizedEntries = [...entries].map(normalizeEntry);

  const llmEntries = normalizedEntries.filter(entry => entry.kind === "llm");
  const imageEntries = normalizedEntries.filter(entry => entry.kind === "image");

  const llmTotals = aggregateEntries(llmEntries);
  const imageTotals = aggregateEntries(imageEntries);

  const trackedImageCostUSD = Number((imageTotals.providerCostUSD || 0).toFixed(6));
  const trackedLlmCostUSD = Number((llmTotals.totalCostUSD || 0).toFixed(6));

  return {
    totals: {
      llm: {
        calls: llmEntries.length,
        inputTokens: llmTotals.promptTokens,
        outputTokens: llmTotals.completionTokens,
        totalTokens: llmTotals.totalTokens,
        inputCostUSD: llmTotals.inputCostUSD,
        outputCostUSD: llmTotals.outputCostUSD,
        totalCostUSD: llmTotals.totalCostUSD,
      },
      images: {
        calls: imageEntries.length,
        successCount: imageEntries.filter(entry => entry.success !== false).length,
        providerCostUSD: trackedImageCostUSD,
        providerCostCredits: imageTotals.providerCostCredits,
        trackedUsdEntries: imageEntries.filter(entry => isFiniteNumber(entry.providerCostUSD)).length,
        trackedCreditEntries: imageEntries.filter(entry => isFiniteNumber(entry.providerCostCredits)).length,
        untrackedEntries: imageEntries.filter(entry => !isFiniteNumber(entry.providerCostUSD) && !isFiniteNumber(entry.providerCostCredits)).length,
      },
      overall: {
        trackedCostUSD: Number((trackedLlmCostUSD + trackedImageCostUSD).toFixed(6)),
        llmCostUSD: trackedLlmCostUSD,
        imageCostUSD: trackedImageCostUSD,
        imageCostCredits: imageTotals.providerCostCredits,
        totalTokens: llmTotals.totalTokens,
      },
    },
    breakdown: {
      byPhase: aggregateGrouped(normalizedEntries, entry => entry.phase),
      byStep: aggregateGrouped(normalizedEntries, entry => `${entry.phase}:${entry.step}`),
      byModel: aggregateGrouped(
        llmEntries.filter(entry => entry.model),
        entry => entry.model as string,
      ),
      byProvider: aggregateGrouped(normalizedEntries, entry => entry.provider || "unknown"),
      entries: normalizedEntries,
    },
  };
}

export function extractRunwareCostMetrics(payload: any): {
  providerCostUSD: number | null;
  providerCostCredits: number | null;
  matches: Array<{ path: string; key: string; value: number }>;
} {
  const matches: Array<{ path: string; key: string; value: number }> = [];
  const seen = new Set<any>();

  const visit = (value: any, path: string[], depth: number) => {
    if (!value || depth > 6) return;
    if (typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...path, String(index)], depth + 1));
      return;
    }

    for (const [rawKey, rawVal] of Object.entries(value)) {
      const key = String(rawKey);
      const lowered = key.toLowerCase();
      if (typeof rawVal === "number" && Number.isFinite(rawVal)) {
        if (
          lowered === "cost"
          || lowered.endsWith("_cost")
          || lowered.endsWith("cost")
          || lowered.includes("costusd")
          || lowered.includes("cost_usd")
          || lowered.includes("credit")
        ) {
          matches.push({
            path: [...path, key].join("."),
            key: lowered,
            value: rawVal,
          });
        }
      } else {
        visit(rawVal, [...path, key], depth + 1);
      }
    }
  };

  visit(payload, [], 0);

  const usdMatch = matches.find(match => match.key.includes("usd"))
    || matches.find(match => match.key === "cost" || match.key.endsWith("_cost") || match.key.endsWith("cost"));
  const creditMatch = matches.find(match => match.key.includes("credit"));

  return {
    providerCostUSD: usdMatch ? usdMatch.value : null,
    providerCostCredits: creditMatch ? creditMatch.value : null,
    matches,
  };
}

function aggregateGrouped(
  entries: StoryCostEntry[],
  getKey: (entry: StoryCostEntry) => string,
) {
  const grouped = new Map<string, StoryCostEntry[]>();
  for (const entry of entries) {
    const key = getKey(entry);
    const list = grouped.get(key) ?? [];
    list.push(entry);
    grouped.set(key, list);
  }

  return [...grouped.entries()]
    .map(([key, groupEntries]) => {
      const totals = aggregateEntries(groupEntries);
      return {
        key,
        kind: groupEntries[0]?.kind,
        calls: groupEntries.length,
        successCount: groupEntries.filter(entry => entry.success !== false).length,
        inputTokens: totals.promptTokens,
        outputTokens: totals.completionTokens,
        totalTokens: totals.totalTokens,
        inputCostUSD: totals.inputCostUSD,
        outputCostUSD: totals.outputCostUSD,
        totalCostUSD: totals.totalCostUSD,
        providerCostUSD: totals.providerCostUSD,
        providerCostCredits: totals.providerCostCredits,
      };
    })
    .sort((left, right) => {
      if (right.totalTokens !== left.totalTokens) return right.totalTokens - left.totalTokens;
      const leftCost = (left.totalCostUSD || 0) + (left.providerCostUSD || 0);
      const rightCost = (right.totalCostUSD || 0) + (right.providerCostUSD || 0);
      return rightCost - leftCost;
    });
}

function aggregateEntries(entries: StoryCostEntry[]) {
  return {
    promptTokens: entries.reduce((sum, entry) => sum + toNumber(entry.promptTokens), 0),
    completionTokens: entries.reduce((sum, entry) => sum + toNumber(entry.completionTokens), 0),
    totalTokens: entries.reduce((sum, entry) => sum + toNumber(entry.totalTokens), 0),
    inputCostUSD: round6(entries.reduce((sum, entry) => sum + toNumber(entry.inputCostUSD), 0)),
    outputCostUSD: round6(entries.reduce((sum, entry) => sum + toNumber(entry.outputCostUSD), 0)),
    totalCostUSD: round6(entries.reduce((sum, entry) => sum + toNumber(entry.totalCostUSD), 0)),
    providerCostUSD: round6(entries.reduce((sum, entry) => sum + toNumber(entry.providerCostUSD), 0)),
    providerCostCredits: round6(entries.reduce((sum, entry) => sum + toNumber(entry.providerCostCredits), 0)),
  };
}

function normalizeEntry(entry: StoryCostEntry): StoryCostEntry {
  return {
    ...entry,
    promptTokens: toNumber(entry.promptTokens),
    completionTokens: toNumber(entry.completionTokens),
    totalTokens: toNumber(entry.totalTokens),
    inputCostUSD: round6(toNumber(entry.inputCostUSD)),
    outputCostUSD: round6(toNumber(entry.outputCostUSD)),
    totalCostUSD: round6(toNumber(entry.totalCostUSD)),
    providerCostUSD: normalizeNullableNumber(entry.providerCostUSD),
    providerCostCredits: normalizeNullableNumber(entry.providerCostCredits),
    promptChars: toNumber(entry.promptChars),
    negativePromptChars: toNumber(entry.negativePromptChars),
    referenceCount: toNumber(entry.referenceCount),
    itemCount: toNumber(entry.itemCount),
  };
}

function inferProviderFromModel(model?: string): string {
  const normalized = String(model || "").toLowerCase();
  if (normalized.startsWith("gemini")) return "gemini";
  if (normalized.startsWith("gpt") || normalized.startsWith("o4")) return "openai";
  if (normalized.startsWith("runware")) return "runware";
  return "unknown";
}

function toNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeNullableNumber(value: unknown): number | null {
  return isFiniteNumber(value) ? round6(Number(value)) : null;
}

function isFiniteNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}
