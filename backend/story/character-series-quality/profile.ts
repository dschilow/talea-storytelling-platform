/** Opt-in fork of Figurenwelt v25. The original lane keeps its models and defaults. */
export const QUALITY_SERIES_ENGINE = 'character-series-quality-v1';
export const QUALITY_SERIES_MODELS = {
  writer: 'openai/gpt-6.1-sol', support: 'openai/gpt-6-luna', critic: 'google/gemini-3.8-flash',
};
export const QUALITY_SERIES_POLICY = {
  version: 1, baseVersion: 25, maxLlmCalls: 44, llmStopAfterUSD: 0.085, longLlmStopAfterUSD: 0.12,
  maxImageCalls: 22, maxImageCostUSD: 0.035, imageRetries: 4, imageConcurrency: 7,
  selectionModel: 'openai/gpt-6.1-terra', variantsPerPicture: 2, maxComparisons: 3,
} as const;

export function isCharacterSeriesEngine(engine: string | undefined): boolean {
  return engine === 'character-series-v1' || engine === QUALITY_SERIES_ENGINE;
}
