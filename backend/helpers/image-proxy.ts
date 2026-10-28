import { getProxyBaseUrl, resolveImageUrlForClient } from "./bucket-storage";
import { avatarImageProxyUrl } from "./avatar-image-url";

const encodePathSegment = (value: string): string => encodeURIComponent(value);

export async function buildAvatarImageUrlForClient(
  avatarId: string,
  fallbackImageUrl?: string
): Promise<string | undefined> {
  const base = await getProxyBaseUrl();
  if (base && avatarId) {
    return avatarImageProxyUrl(base, avatarId, fallbackImageUrl);
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
  // Do not advertise an endpoint that cannot return an image for an empty chapter.
  if (!fallbackImageUrl) return undefined;
  const base = await getProxyBaseUrl();
  if (base && storyId && Number.isFinite(chapterNumber) && chapterNumber > 0) {
    return `${base}/story/image/story/${encodePathSegment(storyId)}/chapter/${chapterNumber}`;
  }
  return await resolveImageUrlForClient(fallbackImageUrl);
}
