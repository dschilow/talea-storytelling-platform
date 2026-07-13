export interface GenerationMetadataUsage {
  prompt?: number;
  completion?: number;
  total?: number;
  cachedPromptTokens?: number;
  inputCostUSD?: number;
  cachedInputCostUSD?: number;
  outputCostUSD?: number;
  totalCostUSD?: number;
  modelUsed?: string;
}

export interface TrackedLlmCostLike {
  kind?: string;
  promptTokens?: number;
  cachedPromptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  inputCostUSD?: number;
  cachedInputCostUSD?: number;
  outputCostUSD?: number;
  totalCostUSD?: number;
}

export interface ResidualLlmUsage {
  promptTokens: number;
  cachedPromptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  inputCostUSD?: number;
  cachedInputCostUSD?: number;
  outputCostUSD?: number;
  totalCostUSD?: number;
}

/**
 * Returns only metadata usage/cost that is not already represented by the
 * supplied stage ledger. Negative differences are clamped and an empty
 * residual is omitted, preventing both negative rows and double counting.
 */
export function calculateGenerationUsageResidual(input: {
  metadataUsage?: GenerationMetadataUsage | null;
  trackedEntries?: TrackedLlmCostLike[] | null;
  residualModel: string;
}): ResidualLlmUsage | null {
  const metadata = input.metadataUsage;
  if (!metadata) return null;

  const tracked = (input.trackedEntries || []).filter((entry) => entry?.kind !== "image");
  const trackedPrompt = sum(tracked, "promptTokens");
  const trackedCachedPrompt = sum(tracked, "cachedPromptTokens");
  const trackedCompletion = sum(tracked, "completionTokens");
  const trackedTotal = sum(tracked, "totalTokens");

  const metadataPrompt = nonNegative(metadata.prompt);
  const metadataCachedPrompt = Math.min(metadataPrompt, nonNegative(metadata.cachedPromptTokens));
  const metadataCompletion = nonNegative(metadata.completion);
  const metadataTotal = isFiniteNumber(metadata.total)
    ? nonNegative(metadata.total)
    : metadataPrompt + metadataCompletion;

  const promptTokens = positiveDifference(metadataPrompt, trackedPrompt);
  const cachedPromptTokens = Math.min(promptTokens, positiveDifference(metadataCachedPrompt, trackedCachedPrompt));
  const completionTokens = positiveDifference(metadataCompletion, trackedCompletion);
  const totalTokens = Math.max(
    positiveDifference(metadataTotal, trackedTotal),
    promptTokens + completionTokens,
  );

  const inputCostUSD = residualCost(metadata.inputCostUSD, sum(tracked, "inputCostUSD"));
  const cachedInputCostUSD = residualCost(metadata.cachedInputCostUSD, sum(tracked, "cachedInputCostUSD"));
  const outputCostUSD = residualCost(metadata.outputCostUSD, sum(tracked, "outputCostUSD"));
  let totalCostUSD = residualCost(metadata.totalCostUSD, sum(tracked, "totalCostUSD"));
  if (totalCostUSD === undefined && inputCostUSD !== undefined && outputCostUSD !== undefined) {
    totalCostUSD = round6(inputCostUSD + outputCostUSD);
  }

  const hasTokens = totalTokens > 0 || promptTokens > 0 || completionTokens > 0;
  const hasExplicitCost = [inputCostUSD, cachedInputCostUSD, outputCostUSD, totalCostUSD]
    .some((value) => value !== undefined && value > 0);
  if (!hasTokens && !hasExplicitCost) return null;

  return {
    promptTokens,
    cachedPromptTokens,
    completionTokens,
    totalTokens,
    model: String(input.residualModel || metadata.modelUsed || "gpt-5.4-mini"),
    ...(inputCostUSD !== undefined ? { inputCostUSD } : {}),
    ...(cachedInputCostUSD !== undefined ? { cachedInputCostUSD } : {}),
    ...(outputCostUSD !== undefined ? { outputCostUSD } : {}),
    ...(totalCostUSD !== undefined ? { totalCostUSD } : {}),
  };
}

function sum(entries: TrackedLlmCostLike[], key: keyof TrackedLlmCostLike): number {
  return entries.reduce((total, entry) => total + nonNegative(entry?.[key]), 0);
}

function residualCost(metadataValue: unknown, trackedValue: number): number | undefined {
  if (!isFiniteNumber(metadataValue)) return undefined;
  return round6(positiveDifference(metadataValue, trackedValue));
}

function positiveDifference(total: unknown, tracked: unknown): number {
  return Math.max(0, nonNegative(total) - nonNegative(tracked));
}

function nonNegative(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}

export function normalizeGeneratedImageCount(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : undefined;
}

export interface AdminImageCallCountInput {
  reportedImageCalls?: unknown;
  ledgerImageCalls?: unknown;
  ledgerImageSuccessCount?: unknown;
  reportedImagesGenerated?: unknown;
  hasImageLedgerEntries: boolean;
}

/**
 * Keeps provider attempts separate from successful image slots. New pipelines
 * use the cost ledger; only legacy runs without image ledger rows fall back to
 * the number of generated images.
 */
export function resolveAdminImageCallCount(input: AdminImageCallCountInput): number {
  const explicitCalls = normalizeGeneratedImageCount(input.reportedImageCalls);
  if (explicitCalls !== undefined) return explicitCalls;

  const generatedSlots = normalizeGeneratedImageCount(input.reportedImagesGenerated);
  if (!input.hasImageLedgerEntries) return generatedSlots ?? 0;

  const ledgerCalls = normalizeGeneratedImageCount(input.ledgerImageCalls);
  if (ledgerCalls !== undefined && ledgerCalls > 0) return ledgerCalls;

  const ledgerSuccesses = normalizeGeneratedImageCount(input.ledgerImageSuccessCount);
  return ledgerSuccesses
    ?? generatedSlots
    ?? ledgerCalls
    ?? 0;
}
