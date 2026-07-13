import assert from "node:assert/strict";
// @ts-ignore Bun exposes this runtime-only test helper without Node typings.
import { mock } from "bun:test";
import {
  calculateGenerationUsageResidual,
  normalizeGeneratedImageCount,
  resolveAdminImageCallCount,
} from "../../generation-cost-residual";

console.log("\n=== deterministic TTS and generation cost accounting ===");

mock.module("encore.dev/storage/sqldb", () => ({
  SQLDatabase: class {
    constructor(..._args: any[]) {}
  },
}));

const {
  enrichChapterForTTS,
  enrichTtsTextDeterministically,
  stripTTSTagsPreservingLayout,
} = await import("../../tts-enrichment");

{
  const source = "Mia fl\u00fcsterte: \u201eNicht bewegen.\u201c\n\n\u201eJetzt!\u201c, rief Tom.";
  const enriched = enrichTtsTextDeterministically(source);
  assert.ok(enriched.includes("<whisper>\u201eNicht bewegen.\u201c</whisper>"));
  assert.ok(enriched.includes("<loud>\u201eJetzt!\u201c</loud>"));
  assert.ok(enriched.includes("[long-pause]\n\n"));
  assert.equal(stripTTSTagsPreservingLayout(enriched), source);
  assert.equal(enrichTtsTextDeterministically(enriched), enriched);

  const result = await enrichChapterForTTS({
    chapterId: "chapter-1",
    chapterOrder: 1,
    chapterTitle: "Test",
    text: source,
    totalChapters: 1,
    aiModel: "gemini-3.1-flash-lite-preview",
  });
  assert.equal(result.ttsText, enriched);
  assert.equal(result.tagsInserted, 3);
  console.log("  ok TTS enrichment is deterministic, sparse, and word-exact");
}

{
  const plain = "Ein ruhiger Satz ohne ausdrueckliche Regie.";
  const result = await enrichChapterForTTS({
    chapterId: "chapter-2",
    chapterOrder: 2,
    chapterTitle: "Test",
    text: plain,
    totalChapters: 2,
  });
  assert.equal(result.ttsText, plain);
  assert.equal(result.tagsInserted, 0);
  console.log("  ok TTS enrichment leaves unsupported semantics untouched");
}

{
  const residual = calculateGenerationUsageResidual({
    metadataUsage: {
      prompt: 1_000,
      completion: 200,
      total: 1_200,
      inputCostUSD: 0.01,
      outputCostUSD: 0.02,
      totalCostUSD: 0.03,
    },
    trackedEntries: [{
      kind: "llm",
      promptTokens: 800,
      completionTokens: 150,
      totalTokens: 950,
      inputCostUSD: 0.008,
      outputCostUSD: 0.015,
      totalCostUSD: 0.023,
    }],
    residualModel: "gemini-3.1-flash-lite-preview",
  });
  assert.ok(residual);
  assert.equal(residual.promptTokens, 200);
  assert.equal(residual.completionTokens, 50);
  assert.equal(residual.totalTokens, 250);
  assert.equal(residual.inputCostUSD, 0.002);
  assert.equal(residual.outputCostUSD, 0.005);
  assert.equal(residual.totalCostUSD, 0.007);
  console.log("  ok only untracked metadata usage/cost becomes residual");
}

{
  const noResidual = calculateGenerationUsageResidual({
    metadataUsage: { prompt: 100, completion: 20, total: 120, totalCostUSD: 0.001 },
    trackedEntries: [{
      kind: "llm",
      promptTokens: 150,
      completionTokens: 30,
      totalTokens: 180,
      totalCostUSD: 0.002,
    }],
    residualModel: "gpt-5.4-mini",
  });
  assert.equal(noResidual, null);

  const imageEntryIsIgnored = calculateGenerationUsageResidual({
    metadataUsage: { prompt: 100, completion: 0, total: 100 },
    trackedEntries: [{ kind: "image", promptTokens: 999, totalTokens: 999 }],
    residualModel: "gpt-5.4-mini",
  });
  assert.equal(imageEntryIsIgnored?.totalTokens, 100);
  console.log("  ok residuals clamp negatives, omit empty rows, and ignore image ledger rows");
}

{
  assert.equal(normalizeGeneratedImageCount(6), 6);
  assert.equal(normalizeGeneratedImageCount(3.9), 3);
  assert.equal(normalizeGeneratedImageCount(-4), 0);
  assert.equal(normalizeGeneratedImageCount(undefined), undefined);
  console.log("  ok image counters normalize missing and invalid metadata safely");
}

{
  mock.module("../llm-client", () => ({
    calculateTokenCosts: () => ({
      cachedInputCostUSD: 0,
      inputCostUSD: 0,
      outputCostUSD: 0,
      totalCostUSD: 0,
    }),
  }));
  const { buildImageCostEntry, summarizeStoryCostEntries } = await import("../cost-ledger");
  const summary = summarizeStoryCostEntries([
    buildImageCostEntry({
      phase: "phase9-imagegen",
      step: "image-generation",
      provider: "runware",
      success: true,
      itemCount: 2,
      providerCostUSD: 0.003,
    }),
    buildImageCostEntry({
      phase: "phase9-imagegen",
      step: "image-generation",
      provider: "runware",
      success: false,
      itemCount: 3,
      providerCostUSD: 0.004,
    }),
  ]);
  assert.equal(summary.totals.images.calls, 5);
  assert.equal(summary.totals.images.successCount, 1);
  assert.equal(summary.sections.images.imageCalls, 5);
  assert.equal(summary.breakdown.byStep[0]?.calls, 5);
  console.log("  ok admin image-call totals count provider attempts, not final slots");
}
{
  const standardPipelineCalls = resolveAdminImageCallCount({
    reportedImageCalls: undefined,
    ledgerImageCalls: 2,
    ledgerImageSuccessCount: 1,
    reportedImagesGenerated: 1,
    hasImageLedgerEntries: true,
  });
  assert.equal(standardPipelineCalls, 2);

  const legacyCalls = resolveAdminImageCallCount({
    reportedImageCalls: undefined,
    ledgerImageCalls: 0,
    ledgerImageSuccessCount: 0,
    reportedImagesGenerated: 4,
    hasImageLedgerEntries: false,
  });
  assert.equal(legacyCalls, 4);

  const explicitCalls = resolveAdminImageCallCount({
    reportedImageCalls: 3,
    ledgerImageCalls: 2,
    ledgerImageSuccessCount: 1,
    reportedImagesGenerated: 1,
    hasImageLedgerEntries: true,
  });
  assert.equal(explicitCalls, 3);
  console.log("  ok admin header prefers provider attempts and preserves the legacy slot fallback");
}
console.log("\nAll deterministic TTS/cost accounting checks passed.");
