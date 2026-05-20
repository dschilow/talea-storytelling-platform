import type { Story } from "../types/story";

type StoryWithMetadata = Pick<Story, "metadata"> | null | undefined;

export function isStoryQualityGateDraft(story: StoryWithMetadata): boolean {
  const metadata = story?.metadata;
  if (!metadata) return false;

  return metadata.status === "quality_gate_failed" || metadata.releaseReady === false;
}

export function wereStoryImagesSkipped(story: StoryWithMetadata): boolean {
  const metadata = story?.metadata;
  if (!metadata) return false;

  return metadata.imagesSkippedDueToQualityGate === true;
}
