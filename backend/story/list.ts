import { api } from "encore.dev/api";
import type { StorySummary } from "./generate";
import { getAuthData } from "~encore/auth";
import { storyDB } from "./db";
import { avatarDB } from "../avatar/db";
import { resolveImageUrlForClient } from "../helpers/bucket-storage";
import { buildAvatarImageUrlForClient } from "../helpers/image-proxy";

interface ListStoriesRequest {
  limit?: number;
  offset?: number;
}

interface ListStoriesResponse {
  stories: StorySummary[];
  total: number;
  hasMore: boolean;
}

// Retrieves stories for the authenticated user with pagination.
export const list = api<ListStoriesRequest, ListStoriesResponse>(
  { expose: true, method: "GET", path: "/stories", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const limit = req.limit || 10;
    const offset = req.offset || 0;

    // Get total count
    const countResult = await storyDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM stories WHERE user_id = ${auth.userID}
    `;
    const total = countResult?.count || 0;

    // Get paginated stories
    const storyRows = await storyDB.queryAll<{
      id: string;
      user_id: string;
      title: string;
      description: string;
      cover_image_url: string | null;
      config: string;
      metadata: string | null;
      status: "generating" | "complete" | "error";
      is_public: boolean;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT id, user_id, title, description, cover_image_url, config, metadata, status, is_public, created_at, updated_at
      FROM stories
      WHERE user_id = ${auth.userID}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get all unique avatar IDs from stories
    const allAvatarIds = new Set<string>();
    const parsedConfigs = storyRows.map(row => JSON.parse(row.config));

    parsedConfigs.forEach(config => {
      if (config.avatarIds && Array.isArray(config.avatarIds)) {
        config.avatarIds.forEach((id: string) => allAvatarIds.add(id));
      }
    });

    // Fetch all avatars in one query
    const avatarMap = new Map<string, { id: string; name: string; imageUrl: string | null }>();
    if (allAvatarIds.size > 0) {
      // Fetch avatars one by one to avoid SQL IN array issues
      for (const avatarId of allAvatarIds) {
        const avatar = await avatarDB.queryRow<{
          id: string;
          name: string;
          image_url: string | null;
        }>`
          SELECT id, name, image_url FROM avatars WHERE id = ${avatarId}
        `;
        if (avatar) {
          avatarMap.set(avatar.id, {
            id: avatar.id,
            name: avatar.name,
            imageUrl: await buildAvatarImageUrlForClient(avatar.id, avatar.image_url || undefined) || null
          });
        }
      }
    }

    // Get all unique character IDs from story metadata
    const allCharacterIds = new Set<string>();
    const parsedMetadata = storyRows.map(row =>
      row.metadata ? JSON.parse(row.metadata) : null
    );

    // Extract character IDs from metadata (no verbose logging)
    parsedMetadata.forEach(metadata => {
      if (metadata?.characterPoolUsed && Array.isArray(metadata.characterPoolUsed)) {
        metadata.characterPoolUsed.forEach((char: any) => {
          if (char.characterId) {
            allCharacterIds.add(char.characterId);
          }
        });
      }
    });

    // Fetch all characters from character pool
    const characterMap = new Map<string, { id: string; name: string; imageUrl: string | null }>();
    if (allCharacterIds.size > 0) {
      for (const characterId of allCharacterIds) {
        const character = await storyDB.queryRow<{
          id: string;
          name: string;
          image_url: string | null;
        }>`
          SELECT id, name, image_url FROM character_pool WHERE id = ${characterId}
        `;
        if (character) {
          characterMap.set(character.id, {
            id: character.id,
            name: character.name,
            imageUrl: await resolveImageUrlForClient(character.image_url || undefined) || null
          });
        }
      }
    }

    const stories: StorySummary[] = await Promise.all(storyRows.map(async (storyRow, idx) => {
      const config = parsedConfigs[idx];
      const metadata = parsedMetadata[idx];

      // Add avatar details to config
      const avatars = (config.avatarIds || [])
        .map((avatarId: string) => avatarMap.get(avatarId))
        .filter((avatar: { id: string; name: string; imageUrl: string | null } | undefined): avatar is { id: string; name: string; imageUrl: string | null } => avatar !== undefined);

      // Add character details from character pool
      const characters = (metadata?.characterPoolUsed || [])
        .map((char: any) => characterMap.get(char.characterId))
        .filter((character: { id: string; name: string; imageUrl: string | null } | undefined): character is { id: string; name: string; imageUrl: string | null } => character !== undefined);

      return {
        id: storyRow.id,
        userId: storyRow.user_id,
        title: storyRow.title,
        summary: storyRow.description, // Frontend expects 'summary'
        description: storyRow.description,
        coverImageUrl: await resolveImageUrlForClient(storyRow.cover_image_url || undefined),
        config: { ...config, avatars, characters },
        metadata,
        status: storyRow.status,
        isPublic: storyRow.is_public,
        createdAt: storyRow.created_at,
        updatedAt: storyRow.updated_at,
      };
    }));

    const hasMore = offset + limit < total;

    return { stories, total, hasMore };
  }
);
