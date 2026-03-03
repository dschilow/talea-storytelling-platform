import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import type { Avatar } from "./avatar";
import { avatarDB } from "./db";
import { getDefaultPersonalityTraits } from "../constants/personalityTraits";
import { buildAvatarImageUrlForClient } from "../helpers/image-proxy";
import { resolveRequestedProfileId } from "../helpers/profiles";
import { ensureAvatarProfileLinksTable, linkAvatarToProfile } from "./profile-links";

type CloneAvatarParams = {
  id: string;
  targetProfileId?: string;
  name?: string;
};

type PoolTemplate = {
  id: string;
  name: string;
  description: string | null;
  physical_traits: string;
  personality_traits: string;
  image_url: string | null;
  visual_profile: string | null;
  is_active: boolean;
};

type PoolListResponse = {
  templates: Array<{
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
  }>;
};

type AdoptPoolParams = {
  templateId: string;
  targetProfileId?: string;
  name?: string;
};

async function ensureAvatarColumns(): Promise<void> {
  await avatarDB.exec`
    ALTER TABLE avatars
    ADD COLUMN IF NOT EXISTS profile_id TEXT
  `;
  await avatarDB.exec`
    ALTER TABLE avatars
    ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'profile'
  `;
  await avatarDB.exec`
    ALTER TABLE avatars
    ADD COLUMN IF NOT EXISTS source_avatar_id TEXT
  `;
}

async function mapAvatarRow(row: {
  id: string;
  user_id: string;
  profile_id: string | null;
  name: string;
  description: string | null;
  physical_traits: string;
  personality_traits: string;
  image_url: string | null;
  visual_profile: string | null;
  creation_type: "ai-generated" | "photo-upload";
  is_public: boolean;
  source_type: string | null;
  source_avatar_id: string | null;
  original_avatar_id: string | null;
  created_at: Date;
  updated_at: Date;
  inventory: string | null;
  skills: string | null;
}): Promise<Avatar> {
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id || undefined,
    name: row.name,
    description: row.description || undefined,
    physicalTraits: JSON.parse(row.physical_traits),
    personalityTraits: JSON.parse(row.personality_traits),
    imageUrl: await buildAvatarImageUrlForClient(row.id, row.image_url || undefined),
    visualProfile: row.visual_profile ? JSON.parse(row.visual_profile) : undefined,
    creationType: row.creation_type,
    isPublic: row.is_public,
    sourceType: (row.source_type as Avatar["sourceType"]) || "clone",
    sourceAvatarId: row.source_avatar_id || undefined,
    originalAvatarId: row.original_avatar_id || undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    inventory: row.inventory ? JSON.parse(row.inventory) : [],
    skills: row.skills ? JSON.parse(row.skills) : [],
  };
}

export const cloneToProfile = api<CloneAvatarParams, Avatar>(
  { expose: true, method: "POST", path: "/avatar/:id/clone-to-profile", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    await ensureAvatarColumns();
    await ensureAvatarProfileLinksTable();
    const targetProfileId = await resolveRequestedProfileId({
      userId: auth.userID,
      requestedProfileId: req.targetProfileId,
    });

    const source = await avatarDB.queryRow<{
      id: string;
      user_id: string;
      profile_id: string | null;
      name: string;
      description: string | null;
      physical_traits: string;
      personality_traits: string;
      image_url: string | null;
      visual_profile: string | null;
      creation_type: "ai-generated" | "photo-upload";
      is_public: boolean;
      source_type: string | null;
      source_avatar_id: string | null;
      original_avatar_id: string | null;
    }>`
      SELECT
        id,
        user_id,
        profile_id,
        name,
        description,
        physical_traits,
        personality_traits,
        image_url,
        visual_profile,
        creation_type,
        is_public,
        source_type,
        source_avatar_id,
        original_avatar_id
      FROM avatars
      WHERE id = ${req.id}
      LIMIT 1
    `;

    if (!source) {
      throw APIError.notFound("Source avatar not found");
    }

    const ownAvatar = source.user_id === auth.userID;
    if (!ownAvatar && !source.is_public) {
      throw APIError.permissionDenied("Avatar is not available for cloning");
    }

    if (ownAvatar) {
      if (source.profile_id !== targetProfileId) {
        await linkAvatarToProfile({
          avatarId: source.id,
          userId: auth.userID,
          profileId: targetProfileId,
        });
      }

      const existing = await avatarDB.queryRow<{
        id: string;
        user_id: string;
        profile_id: string | null;
        name: string;
        description: string | null;
        physical_traits: string;
        personality_traits: string;
        image_url: string | null;
        visual_profile: string | null;
        creation_type: "ai-generated" | "photo-upload";
        is_public: boolean;
        source_type: string | null;
        source_avatar_id: string | null;
        original_avatar_id: string | null;
        created_at: Date;
        updated_at: Date;
        inventory: string | null;
        skills: string | null;
      }>`
        SELECT *
        FROM avatars
        WHERE id = ${source.id}
        LIMIT 1
      `;

      if (!existing) {
        throw APIError.internal("Failed to load shared avatar");
      }

      return mapAvatarRow(existing);
    }

    const cloneId = crypto.randomUUID();
    const now = new Date();
    const defaultTraits = getDefaultPersonalityTraits();

    await avatarDB.exec`
      INSERT INTO avatars (
        id,
        user_id,
        profile_id,
        name,
        description,
        physical_traits,
        personality_traits,
        image_url,
        visual_profile,
        creation_type,
        is_public,
        source_type,
        source_avatar_id,
        original_avatar_id,
        created_at,
        updated_at,
        inventory,
        skills
      )
      VALUES (
        ${cloneId},
        ${auth.userID},
        ${targetProfileId},
        ${req.name?.trim() || source.name},
        ${source.description},
        ${source.physical_traits},
        ${JSON.stringify(defaultTraits)},
        ${source.image_url},
        ${source.visual_profile},
        ${source.creation_type},
        FALSE,
        'clone',
        ${source.id},
        ${source.original_avatar_id || source.id},
        ${now},
        ${now},
        '[]',
        '[]'
      )
    `;

    const created = await avatarDB.queryRow<{
      id: string;
      user_id: string;
      profile_id: string | null;
      name: string;
      description: string | null;
      physical_traits: string;
      personality_traits: string;
      image_url: string | null;
      visual_profile: string | null;
      creation_type: "ai-generated" | "photo-upload";
      is_public: boolean;
      source_type: string | null;
      source_avatar_id: string | null;
      original_avatar_id: string | null;
      created_at: Date;
      updated_at: Date;
      inventory: string | null;
      skills: string | null;
    }>`
      SELECT *
      FROM avatars
      WHERE id = ${cloneId}
      LIMIT 1
    `;

    if (!created) {
      throw APIError.internal("Failed to load cloned avatar");
    }

    return mapAvatarRow(created);
  }
);

export const listPoolTemplates = api<void, PoolListResponse>(
  { expose: true, method: "GET", path: "/avatar/pool", auth: true },
  async () => {
    await ensureAvatarColumns();
    await avatarDB.exec`
      CREATE TABLE IF NOT EXISTS avatar_pool_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        physical_traits TEXT NOT NULL,
        personality_traits TEXT NOT NULL,
        image_url TEXT,
        visual_profile TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const rows = await avatarDB.queryAll<PoolTemplate>`
      SELECT id, name, description, physical_traits, personality_traits, image_url, visual_profile, is_active
      FROM avatar_pool_templates
      WHERE is_active = TRUE
      ORDER BY created_at DESC
    `;

    const templates = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        name: row.name,
        description: row.description || undefined,
        imageUrl: await buildAvatarImageUrlForClient(row.id, row.image_url || undefined),
      }))
    );

    return { templates };
  }
);

export const adoptPoolTemplate = api<AdoptPoolParams, Avatar>(
  { expose: true, method: "POST", path: "/avatar/pool/:templateId/adopt", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    await ensureAvatarColumns();
    const targetProfileId = await resolveRequestedProfileId({
      userId: auth.userID,
      requestedProfileId: req.targetProfileId,
    });

    const template = await avatarDB.queryRow<PoolTemplate>`
      SELECT id, name, description, physical_traits, personality_traits, image_url, visual_profile, is_active
      FROM avatar_pool_templates
      WHERE id = ${req.templateId}
        AND is_active = TRUE
      LIMIT 1
    `;

    if (!template) {
      throw APIError.notFound("Pool template not found");
    }

    const id = crypto.randomUUID();
    const now = new Date();
    const defaultTraits = getDefaultPersonalityTraits();

    await avatarDB.exec`
      INSERT INTO avatars (
        id,
        user_id,
        profile_id,
        name,
        description,
        physical_traits,
        personality_traits,
        image_url,
        visual_profile,
        creation_type,
        is_public,
        source_type,
        source_avatar_id,
        original_avatar_id,
        created_at,
        updated_at,
        inventory,
        skills
      )
      VALUES (
        ${id},
        ${auth.userID},
        ${targetProfileId},
        ${req.name?.trim() || template.name},
        ${template.description},
        ${template.physical_traits},
        ${JSON.stringify(defaultTraits)},
        ${template.image_url},
        ${template.visual_profile},
        'ai-generated',
        FALSE,
        'pool',
        ${template.id},
        NULL,
        ${now},
        ${now},
        '[]',
        '[]'
      )
    `;

    const created = await avatarDB.queryRow<{
      id: string;
      user_id: string;
      profile_id: string | null;
      name: string;
      description: string | null;
      physical_traits: string;
      personality_traits: string;
      image_url: string | null;
      visual_profile: string | null;
      creation_type: "ai-generated" | "photo-upload";
      is_public: boolean;
      source_type: string | null;
      source_avatar_id: string | null;
      original_avatar_id: string | null;
      created_at: Date;
      updated_at: Date;
      inventory: string | null;
      skills: string | null;
    }>`
      SELECT *
      FROM avatars
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!created) {
      throw APIError.internal("Failed to create avatar from template");
    }

    return mapAvatarRow(created);
  }
);
