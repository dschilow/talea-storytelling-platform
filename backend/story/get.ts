import { api, APIError } from "encore.dev/api";
import type { Story } from "./generate";
import { getAuthData } from "~encore/auth";
import { storyDB } from "./db";
import { resolveImageUrlForClient } from "../helpers/bucket-storage";
import { buildStoryChapterImageUrlForClient } from "../helpers/image-proxy";

interface GetStoryParams {
  id: string;
}

// Retrieves a specific story by ID with all chapters.
export const get = api<GetStoryParams, Story>(
  { expose: true, method: "GET", path: "/story/:id", auth: true },
  async ({ id }) => {
    const auth = getAuthData()!;
    const requestedId = String(id || "").trim();
    const studioPrefixedEpisodeId = requestedId.startsWith("studio-")
      ? requestedId.slice("studio-".length)
      : null;

    const storyRow = await storyDB.queryRow<{
      id: string;
      user_id: string;
      title: string;
      description: string;
      cover_image_url: string | null;
      config: string;
      avatar_developments: string | null;
      metadata: string | null;
      status: "generating" | "complete" | "error";
      is_public: boolean;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT * FROM stories WHERE id = ${id}
    `;

    if (!storyRow) {
      const studioEpisodeId = studioPrefixedEpisodeId || requestedId;
      const studioRow = await storyDB.queryRow<{
        id: string;
        series_id: string;
        user_id: string;
        episode_number: number;
        title: string;
        summary: string | null;
        approved_story_text: string | null;
        story_text: string | null;
        status: string;
        created_at: Date;
        updated_at: Date;
        series_title: string;
        series_logline: string | null;
      }>`
        SELECT
          e.id,
          e.series_id,
          e.user_id,
          e.episode_number,
          e.title,
          e.summary,
          e.approved_story_text,
          e.story_text,
          e.status,
          e.created_at,
          e.updated_at,
          s.title AS series_title,
          s.logline AS series_logline
        FROM studio_episodes e
        JOIN studio_series s ON s.id = e.series_id
        WHERE e.id = ${studioEpisodeId}
          AND e.status = 'published'
      `;

      if (!studioRow) {
        throw APIError.notFound("Story not found");
      }

      if (studioRow.user_id !== auth.userID && auth.role !== "admin") {
        throw APIError.permissionDenied("You do not have permission to view this story.");
      }

      const sceneRows = await storyDB.queryAll<{
        id: string;
        scene_order: number;
        title: string;
        scene_text: string;
        image_url: string | null;
      }>`
        SELECT id, scene_order, title, scene_text, image_url
        FROM studio_episode_scenes
        WHERE episode_id = ${studioEpisodeId}
        ORDER BY scene_order ASC
      `;

      if (sceneRows.length === 0) {
        throw APIError.notFound("Published studio episode has no scenes");
      }

      const coverImageUrl =
        (await resolveImageUrlForClient(sceneRows.find((scene) => scene.image_url)?.image_url || undefined)) ||
        undefined;

      const description =
        studioRow.summary?.trim() ||
        studioRow.series_logline?.trim() ||
        (studioRow.approved_story_text || studioRow.story_text || "")
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 220) ||
        `Talea Studio Folge ${studioRow.episode_number}`;

      const chapters = await Promise.all(
        sceneRows.map(async (scene) => ({
          id: scene.id,
          title: scene.title || `Szene ${scene.scene_order}`,
          content: scene.scene_text,
          imageUrl: (await resolveImageUrlForClient(scene.image_url || undefined)) || scene.image_url || undefined,
          order: scene.scene_order,
        }))
      );

      return {
        id: `studio-${studioRow.id}`,
        userId: studioRow.user_id,
        title: `${studioRow.series_title} - Folge ${studioRow.episode_number}: ${studioRow.title}`,
        summary: description,
        description,
        coverImageUrl,
        config: {
          avatarIds: [],
          genre: "Talea Studio",
          setting: studioRow.series_title,
          length: sceneRows.length <= 6 ? "short" : sceneRows.length <= 10 ? "medium" : "long",
          complexity: "medium",
          ageGroup: "6-8",
        },
        chapters,
        status: "complete",
        metadata: {
          model: "talea-studio",
          processingTime: 0,
          imagesGenerated: sceneRows.filter((scene) => Boolean(scene.image_url)).length,
        },
        createdAt: studioRow.created_at,
        updatedAt: studioRow.updated_at,
      };
    }

    if (storyRow.user_id !== auth.userID && auth.role !== 'admin' && !storyRow.is_public) {
      throw APIError.permissionDenied("You do not have permission to view this story.");
    }

    const chapterRows = await storyDB.queryAll<{
      id: string;
      title: string;
      content: string;
      image_url: string | null;
      chapter_order: number;
    }>`
      SELECT id, title, content, image_url, chapter_order 
      FROM chapters 
      WHERE story_id = ${id} 
      ORDER BY chapter_order
    `;

    const parsedMetadata = parseJsonObject(storyRow.metadata);
    const chapterVisuals = (parsedMetadata?.chapterVisuals && typeof parsedMetadata.chapterVisuals === "object")
      ? parsedMetadata.chapterVisuals as Record<string, { scenicImageUrl?: string; scenicImagePrompt?: string }>
      : {};
    const coverImageUrl = await resolveImageUrlForClient(storyRow.cover_image_url || undefined);
    const chapters = await Promise.all(chapterRows.map(async (ch) => {
      const scenicRawUrl = chapterVisuals[String(ch.chapter_order)]?.scenicImageUrl || undefined;
      const scenicResolvedUrl = scenicRawUrl ? await resolveImageUrlForClient(scenicRawUrl) : undefined;
      return {
        id: ch.id,
        title: ch.title,
        content: ch.content,
        imageUrl: await buildStoryChapterImageUrlForClient(id, ch.chapter_order, ch.image_url || undefined),
        scenicImageUrl: scenicResolvedUrl || scenicRawUrl,
        scenicImagePrompt: chapterVisuals[String(ch.chapter_order)]?.scenicImagePrompt || undefined,
        order: ch.chapter_order,
      };
    }));

    return {
      id: storyRow.id,
      userId: storyRow.user_id,
      title: storyRow.title,
      summary: storyRow.description, // Frontend expects 'summary'
      description: storyRow.description,
      coverImageUrl,
      config: JSON.parse(storyRow.config),
      avatarDevelopments: storyRow.avatar_developments ? JSON.parse(storyRow.avatar_developments) : undefined,
      metadata: parsedMetadata || undefined,
      chapters,
      status: storyRow.status,
      isPublic: storyRow.is_public,
      createdAt: storyRow.created_at,
      updatedAt: storyRow.updated_at,
    };
  }
);

function parseJsonObject(value: any): any {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
