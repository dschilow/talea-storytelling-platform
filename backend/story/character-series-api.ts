import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { resolveRequestedProfileId } from "../helpers/profiles";
import { resolveImageUrlForClient } from "../helpers/bucket-storage";
import { storyDB } from "./db";
import { SERIES, seriesProgress } from "./character-series/repository";

interface CharacterSeriesSummary {
  id: string;
  characterId: string;
  title: string;
  description: string;
  genres: string[];
  imageUrl?: string;
  episodeCount: number;
  lastStoryId?: string;
}

export const listCharacterSeries = api<{ profileId?: string }, { series: CharacterSeriesSummary[] }>(
  { expose: true, method: "GET", path: "/story/character-series", auth: true },
  async ({ profileId }) => {
    const auth = getAuthData()!;
    const activeProfileId = await resolveRequestedProfileId({ userId: auth.userID, requestedProfileId: profileId, fallbackName: auth.email ?? undefined });
    const [progress, images] = await Promise.all([
      seriesProgress(auth.userID, activeProfileId),
      storyDB.queryAll<{ id: string; image_url: string | null }>`SELECT id, image_url FROM character_pool WHERE id = ANY(${SERIES.map((series) => series.characterId)}) AND is_active = TRUE`,
    ]);
    const imageById = new Map(images.map((image) => [image.id, image.image_url]));
    return { series: await Promise.all(SERIES.filter((series) => imageById.has(series.characterId)).map(async (series) => {
      const episodes = progress.filter((row) => row.character_series_id === series.id);
      const image = imageById.get(series.characterId);
      return {
        id: series.id, characterId: series.characterId, title: series.title,
        description: series.description, genres: series.genres,
        ...(image ? { imageUrl: (await resolveImageUrlForClient(image).catch(() => undefined)) || image } : {}),
        episodeCount: episodes.length, ...(episodes.length ? { lastStoryId: episodes[episodes.length - 1].id } : {}),
      };
    })) };
  },
);
