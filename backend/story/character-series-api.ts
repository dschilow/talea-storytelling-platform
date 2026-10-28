import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { ensureAdmin } from "../admin/authz";
import { resolveRequestedProfileId } from "../helpers/profiles";
import { resolveImageUrlForClient } from "../helpers/bucket-storage";
import { storyDB } from "./db";
import { resetSeriesProgress, SERIES, seriesProgress } from "./character-series/repository";

interface CharacterSeriesSummary {
  id: string;
  characterId: string;
  characterName: string;
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
        id: series.id, characterId: series.characterId, characterName: series.characterName, title: series.title,
        description: series.description, genres: series.genres,
        ...(image ? { imageUrl: (await resolveImageUrlForClient(image).catch(() => undefined)) || image } : {}),
        episodeCount: episodes.length, ...(episodes.length ? { lastStoryId: episodes[episodes.length - 1].id } : {}),
      };
    })) };
  },
);

/** Admin test tool: the counter of one series starts again at 0 for the chosen profile; the stories stay in the library. */
export const resetCharacterSeries = api<{ seriesId: string; profileId?: string }, { seriesId: string; resetEpisodes: number }>(
  { expose: true, method: "POST", path: "/story/character-series/reset", auth: true },
  async ({ seriesId, profileId }) => {
    const admin = ensureAdmin();
    const series = SERIES.find((entry) => entry.id === seriesId);
    if (!series) throw APIError.invalidArgument("Diese Figurenserie gibt es nicht.");
    const auth = getAuthData()!;
    const activeProfileId = await resolveRequestedProfileId({ userId: admin.userID, requestedProfileId: profileId, fallbackName: auth.email ?? undefined });
    const result = await resetSeriesProgress({ userId: admin.userID, profileId: activeProfileId, seriesId: series.id, resetBy: admin.userID });
    console.log("[character-series] admin reset", { seriesId: series.id, profileId: activeProfileId, resetEpisodes: result.resetEpisodes });
    return { seriesId: series.id, resetEpisodes: result.resetEpisodes };
  },
);
