export function storyMetadataForViewer(
  metadata: Record<string, any> | null | undefined,
  isAdmin: boolean,
): Record<string, any> | null | undefined {
  if (!metadata || isAdmin) return metadata;

  const { adminGenerationMetrics: _adminGenerationMetrics, ...publicMetadata } = metadata;
  return publicMetadata;
}
