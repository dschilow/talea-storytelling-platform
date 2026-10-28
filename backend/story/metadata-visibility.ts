export function storyMetadataForViewer(
  metadata: Record<string, any> | null | undefined,
  isAdmin: boolean,
): Record<string, any> | null | undefined {
  if (!metadata || isAdmin) return metadata;

  // bookAdmin holds a chapter book's plan and bible: future chapters must never reach the reader.
  const { adminGenerationMetrics: _adminGenerationMetrics, bookAdmin: _bookAdmin, ...publicMetadata } = metadata;
  return publicMetadata;
}

/**
 * What a story LIST needs of a story's metadata: the book chip, the quality-gate flags, the few facts the cards show.
 * The rest (the call ledger, the plan, the image checks, a copy of the text, a chapter book's plan) is for the reader
 * and the admin, and `story.get` still returns all of it. A Talea-Folge or storybook story carries tens of KB of it,
 * and the library asked for every story of the family at once. An allow-list, not a deny-list, so a pipeline that
 * adds a big diagnostic key tomorrow does not slow the library down again.
 */
const LIST_METADATA_KEYS = [
  "pipeline", "generationMode", "displayMode", "model", "processingTime", "imagesGenerated", "developerMode",
  "releaseReady", "status", "imagesSkippedDueToQualityGate", "qualityGatePassed", "qualityGateFailureReason",
  "returnedWithQualityGateWarnings", "totalCost", "tokensUsed", "book", "newArtifact",
] as const;

export function storyMetadataForList(
  metadata: Record<string, any> | null | undefined,
): Record<string, any> | undefined {
  if (!metadata) return undefined;
  const slim: Record<string, any> = {};
  for (const key of LIST_METADATA_KEYS) if (metadata[key] !== undefined) slim[key] = metadata[key];
  // The library shelves a Figurenserie by series and episode number; the episode log itself (events, quotes,
  // literal context) stays in story.get.
  const series = metadata.characterSeries;
  const episode = series?.log?.episode;
  if (typeof series?.id === "string" && series.id && Number.isSafeInteger(episode) && episode > 0) {
    slim.characterSeries = { id: series.id, episode };
  }
  return Object.keys(slim).length > 0 ? slim : undefined;
}
