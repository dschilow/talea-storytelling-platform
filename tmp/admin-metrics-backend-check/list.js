// @bun
// backend/story/list.ts
import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { storyDB } from "./db";
import { avatarDB } from "../avatar/db";
import { resolveImageUrlForClient } from "../helpers/bucket-storage";
import { buildAvatarImageUrlForClient } from "../helpers/image-proxy";
import { ensureDefaultProfileForUser, resolveRequestedProfileId } from "../helpers/profiles";
import { storyMetadataForViewer } from "./metadata-visibility";
var DEFAULT_PAGE_SIZE = 10;
var MAX_PAGE_SIZE = 50;
function clampLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.max(1, Math.min(MAX_PAGE_SIZE, Math.trunc(parsed)));
}
function clampOffset(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.trunc(parsed));
}
function parseJsonObject(value) {
  if (!value)
    return null;
  if (typeof value === "object")
    return value;
  if (typeof value !== "string")
    return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
function normalizeAvatarIds(config) {
  if (!Array.isArray(config?.avatarIds)) {
    return [];
  }
  return config.avatarIds.filter((value) => typeof value === "string").map((value) => value.trim()).filter((value) => value.length > 0);
}
function extractCharacterPoolUsed(castSet) {
  const poolCharacters = Array.isArray(castSet?.poolCharacters) ? castSet.poolCharacters : [];
  if (poolCharacters.length === 0) {
    return [];
  }
  return poolCharacters.map((character) => ({
    characterId: typeof character?.characterId === "string" ? character.characterId : undefined,
    characterName: typeof character?.displayName === "string" ? character.displayName : undefined
  }));
}
var list = api({ expose: true, method: "GET", path: "/stories", auth: true }, async (req) => {
  const auth = getAuthData();
  const limit = clampLimit(req.limit);
  const offset = clampOffset(req.offset);
  const includeFamily = req.includeFamily === true;
  const activeProfileId = await resolveRequestedProfileId({
    userId: auth.userID,
    requestedProfileId: req.profileId,
    fallbackName: auth.email ?? undefined
  });
  const defaultProfile = await ensureDefaultProfileForUser(auth.userID, auth.email ?? undefined);
  const includeLegacyUnscoped = activeProfileId === defaultProfile.id;
  const countResult = await storyDB.queryRow`
      SELECT COUNT(*) as count
      FROM stories s
      WHERE s.user_id = ${auth.userID}
        AND (
          ${includeFamily}
          OR s.primary_profile_id = ${activeProfileId}
          OR EXISTS (
            SELECT 1
            FROM story_participants sp
            WHERE sp.story_id = s.id
              AND sp.profile_id = ${activeProfileId}
          )
          OR (
            ${includeLegacyUnscoped}
            AND s.primary_profile_id IS NULL
            AND NOT EXISTS (
              SELECT 1
              FROM story_participants sp_legacy
              WHERE sp_legacy.story_id = s.id
            )
          )
        )
    `;
  const total = countResult?.count || 0;
  const storyRows = await storyDB.queryAll`
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
          OR s.primary_profile_id = ${activeProfileId}
          OR EXISTS (
            SELECT 1
            FROM story_participants sp
            WHERE sp.story_id = s.id
              AND sp.profile_id = ${activeProfileId}
          )
          OR (
            ${includeLegacyUnscoped}
            AND s.primary_profile_id IS NULL
            AND NOT EXISTS (
              SELECT 1
              FROM story_participants sp_legacy
              WHERE sp_legacy.story_id = s.id
            )
          )
        )
      ORDER BY s.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  const storyIds = storyRows.map((row) => row.id);
  const participantRows = storyIds.length > 0 ? await storyDB.queryAll`
          SELECT story_id, profile_id
          FROM story_participants
          WHERE story_id = ANY(${storyIds})
        ` : [];
  const participantsByStoryId = new Map;
  for (const row of participantRows) {
    const existing = participantsByStoryId.get(row.story_id) || [];
    existing.push(row.profile_id);
    participantsByStoryId.set(row.story_id, existing);
  }
  const profileStateRows = storyIds.length > 0 ? await storyDB.queryAll`
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
        ` : [];
  const profileStateByStoryId = new Map(profileStateRows.map((row) => [row.story_id, row]));
  const parsedConfigs = storyRows.map((row) => parseJsonObject(row.config));
  const avatarIds = Array.from(new Set(parsedConfigs.flatMap((config) => normalizeAvatarIds(config))));
  const avatarRows = avatarIds.length > 0 ? await avatarDB.queryAll`
          SELECT id, name, image_url
          FROM avatars
          WHERE id = ANY(${avatarIds})
        ` : [];
  const avatarEntries = await Promise.all(avatarRows.map(async (avatar) => [
    avatar.id,
    {
      id: avatar.id,
      name: avatar.name,
      imageUrl: await buildAvatarImageUrlForClient(avatar.id, avatar.image_url || undefined) || null
    }
  ]));
  const avatarMap = new Map(avatarEntries);
  const baseMetadataByIndex = storyRows.map((row) => parseJsonObject(row.metadata));
  const castRows = storyIds.length > 0 ? await storyDB.queryAll`
          SELECT story_instance_id, cast_set
          FROM story_cast_sets
          WHERE story_instance_id = ANY(${storyIds})
        ` : [];
  const castSetByStoryId = new Map(castRows.map((row) => [row.story_instance_id, parseJsonObject(row.cast_set)]));
  const parsedMetadata = storyRows.map((row, index) => {
    const baseMetadata = baseMetadataByIndex[index];
    if (Array.isArray(baseMetadata?.characterPoolUsed) && baseMetadata.characterPoolUsed.length > 0) {
      return baseMetadata;
    }
    const characterPoolUsed = extractCharacterPoolUsed(castSetByStoryId.get(row.id) || null);
    if (characterPoolUsed.length === 0) {
      return baseMetadata;
    }
    return {
      ...baseMetadata || {},
      characterPoolUsed
    };
  });
  const characterIds = Array.from(new Set(parsedMetadata.flatMap((metadata) => (Array.isArray(metadata?.characterPoolUsed) ? metadata.characterPoolUsed : []).map((entry) => typeof entry.characterId === "string" ? entry.characterId.trim() : "").filter((entry) => entry.length > 0))));
  const characterRows = characterIds.length > 0 ? await storyDB.queryAll`
          SELECT id, name, image_url
          FROM character_pool
          WHERE id = ANY(${characterIds})
        ` : [];
  const characterEntries = await Promise.all(characterRows.map(async (character) => [
    character.id,
    {
      id: character.id,
      name: character.name,
      imageUrl: await resolveImageUrlForClient(character.image_url || undefined) || null
    }
  ]));
  const characterMap = new Map(characterEntries);
  const stories = await Promise.all(storyRows.map(async (storyRow, index) => {
    const config = parsedConfigs[index] || {};
    const metadata = parsedMetadata[index];
    const characterPoolUsed = Array.isArray(metadata?.characterPoolUsed) ? metadata.characterPoolUsed : [];
    const avatars = normalizeAvatarIds(config).map((avatarId) => avatarMap.get(avatarId)).filter((avatar) => Boolean(avatar));
    const characters = characterPoolUsed.map((entry) => entry.characterId).filter((characterId) => typeof characterId === "string").map((characterId) => characterMap.get(characterId)).filter((character) => Boolean(character));
    const profileState = profileStateByStoryId.get(storyRow.id);
    return {
      id: storyRow.id,
      userId: storyRow.user_id,
      primaryProfileId: storyRow.primary_profile_id || undefined,
      participantProfileIds: participantsByStoryId.get(storyRow.id) || [],
      title: storyRow.title,
      summary: storyRow.description,
      description: storyRow.description,
      coverImageUrl: await resolveImageUrlForClient(storyRow.cover_image_url || undefined),
      config: { ...config, avatars, characters },
      profileState: profileState ? {
        profileId: activeProfileId,
        isFavorite: profileState.is_favorite,
        progressPct: Number(profileState.progress_pct || 0),
        completionState: profileState.completion_state,
        lastPositionSec: profileState.last_position_sec ?? undefined,
        lastPlayedAt: profileState.last_played_at ?? undefined
      } : undefined,
      metadata: storyMetadataForViewer(metadata, auth.role === "admin") || undefined,
      status: storyRow.status,
      isPublic: storyRow.is_public,
      createdAt: storyRow.created_at,
      updatedAt: storyRow.updated_at
    };
  }));
  return {
    stories,
    total,
    hasMore: offset + limit < total
  };
});
export {
  list
};
