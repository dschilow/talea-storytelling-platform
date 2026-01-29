import { getProxyBaseUrl, resolveImageUrlForClient } from "./bucket-storage";

const encodePathSegment = (value: string): string => encodeURIComponent(value);

export async function buildAvatarImageUrlForClient(
  avatarId: string,
  fallbackImageUrl?: string
): Promise<string | undefined> {
  const base = await getProxyBaseUrl();
  if (base && avatarId) {
    return `${base}/story/image/avatar/${encodePathSegment(avatarId)}`;
  }
  return await resolveImageUrlForClient(fallbackImageUrl);
}

export async function buildArtifactImageUrlForClient(
  artifactId: string,
  fallbackImageUrl?: string
): Promise<string | undefined> {
  const base = await getProxyBaseUrl();
  if (base && artifactId) {
    return `${base}/story/image/artifact/${encodePathSegment(artifactId)}`;
  }
  return await resolveImageUrlForClient(fallbackImageUrl);
}

export async function buildStoryChapterImageUrlForClient(
  storyId: string,
  chapterNumber: number,
  fallbackImageUrl?: string
): Promise<string | undefined> {
  const base = await getProxyBaseUrl();
  if (base && storyId && Number.isFinite(chapterNumber) && chapterNumber > 0) {
    return `${base}/story/image/story/${encodePathSegment(storyId)}/chapter/${chapterNumber}`;
  }
  return await resolveImageUrlForClient(fallbackImageUrl);
}
