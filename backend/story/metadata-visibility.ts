export function storyMetadataForViewer(
  metadata: Record<string, any> | null | undefined,
  isAdmin: boolean,
): Record<string, any> | null | undefined {
  if (!metadata || isAdmin) return metadata;

  // bookAdmin holds a chapter book's plan and bible: future chapters must never reach the reader.
  const { adminGenerationMetrics: _adminGenerationMetrics, bookAdmin: _bookAdmin, ...publicMetadata } = metadata;
  return publicMetadata;
}
