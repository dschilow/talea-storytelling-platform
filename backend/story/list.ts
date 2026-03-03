import { api } from "encore.dev/api";
import type { StorySummary } from "./generate";
import { getAuthData } from "~encore/auth";
import { storyDB } from "./db";
import { avatarDB } from "../avatar/db";
import { resolveImageUrlForClient } from "../helpers/bucket-storage";
import { buildAvatarImageUrlForClient } from "../helpers/image-proxy";
import { resolveRequestedProfileId } from "../helpers/profiles";

interface ListStoriesRequest {
  limit?: number;
  offset?: number;
  profileId?: string;
  includeFamily?: boolean;
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
    const includeFamily = req.includeFamily === true;
    const activeProfileId = await resolveRequestedProfileId({
      userId: auth.userID,
      requestedProfileId: req.profileId,
      fallbackName: auth.email ?? undefined,
    });

    // Get total count
    const countResult = await storyDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM stories s
      WHERE s.user_id = ${auth.userID}
        AND (
          ${includeFamily}
          OR s.primary_profile_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM story_participants sp
            WHERE sp.story_id = s.id
              AND sp.profile_id = ${activeProfileId}
          )
        )
    `;
    const total = countResult?.count || 0;

    // Get paginated stories
    const storyRows = await storyDB.queryAll<{
      id: string;
      user_id: string;
      primary_profile_id: string | null;
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
      SELECT
        s.id,
        s.user_id,
        s.primary_profile_id,
        s.title,
        s.description,
        s.cover_image_url,
        s.config,
        s.metadata,
        s.status,
        s.is_public,
        s.created_at,
        s.updated_at
      FROM stories s
      WHERE s.user_id = ${auth.userID}
        AND (
          ${includeFamily}
          OR s.primary_profile_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM story_participants sp
            WHERE sp.story_id = s.id
              AND sp.profile_id = ${activeProfileId}
          )
        )
      ORDER BY s.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const storyIds = storyRows.map((row) => row.id);
    const participantRows = storyIds.length > 0
      ? await storyDB.queryAll<{
          story_id: string;
          profile_id: string;
        }>`
          SELECT story_id, profile_id
          FROM story_participants
          WHERE story_id = ANY(${storyIds})
        `
      : [];
    const participantsByStoryId = new Map<string, string[]>();
    for (const row of participantRows) {
      const entries = participantsByStoryId.get(row.story_id) || [];
      entries.push(row.profile_id);
      participantsByStoryId.set(row.story_id, entries);
    }

    const profileStateRows = storyIds.length > 0
      ? await storyDB.queryAll<{
          story_id: string;
          is_favorite: boolean;
          progress_pct: number;
          completion_state: "not_started" | "in_progress" | "completed";
          last_position_sec: number | null;
          last_played_at: Date | null;
        }>`
          SELECT
            story_id,
            is_favorite,
            progress_pct,
            completion_state,
            last_position_sec,
            last_played_at
          FROM story_profile_state
          WHERE profile_id = ${activeProfileId}
            AND story_id = ANY(${storyIds})
        `
      : [];
    const profileStateByStoryId = new Map<string, (typeof profileStateRows)[number]>(
      profileStateRows.map((row) => [row.story_id, row])
    );

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
    const parsedMetadata = await Promise.all(storyRows.map(async row => {
      let base = row.metadata ? JSON.parse(row.metadata) : null;
      if (base?.characterPoolUsed && Array.isArray(base.characterPoolUsed) && base.characterPoolUsed.length > 0) {
        return base;
      }

      const castRow = await storyDB.queryRow<{ cast_set: any }>`
        SELECT cast_set FROM story_cast_sets WHERE story_instance_id = ${row.id}
      `;
      if (!castRow?.cast_set) {
        return base;
      }

      let castSet: any = castRow.cast_set;
      if (typeof castSet === "string") {
        try {
          castSet = JSON.parse(castSet);
        } catch {
          return base;
        }
      }

      const poolCharacters = Array.isArray(castSet?.poolCharacters) ? castSet.poolCharacters : [];
      if (poolCharacters.length === 0) {
        return base;
      }

      const characterPoolUsed = poolCharacters.map((character: any) => ({
        characterId: character.characterId,
        characterName: character.displayName,
      }));

      base = base || {};
      base.characterPoolUsed = characterPoolUsed;
      return base;
    }));

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
        primaryProfileId: storyRow.primary_profile_id || undefined,
        participantProfileIds: participantsByStoryId.get(storyRow.id) || [],
        title: storyRow.title,
        summary: storyRow.description, // Frontend expects 'summary'
        description: storyRow.description,
        coverImageUrl: await resolveImageUrlForClient(storyRow.cover_image_url || undefined),
        config: { ...config, avatars, characters },
        profileState: profileStateByStoryId.get(storyRow.id)
          ? {
              profileId: activeProfileId,
              isFavorite: profileStateByStoryId.get(storyRow.id)!.is_favorite,
              progressPct: Number(profileStateByStoryId.get(storyRow.id)!.progress_pct || 0),
              completionState: profileStateByStoryId.get(storyRow.id)!.completion_state,
              lastPositionSec: profileStateByStoryId.get(storyRow.id)!.last_position_sec ?? undefined,
              lastPlayedAt: profileStateByStoryId.get(storyRow.id)!.last_played_at ?? undefined,
            }
          : undefined,
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
