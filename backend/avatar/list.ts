import { api } from "encore.dev/api";
import type { Avatar, AvatarVisualProfile } from "./avatar";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";
import { buildAvatarImageUrlForClient } from "../helpers/image-proxy";
import { ensureAvatarSharingTables } from "./sharing";
import { ensureDefaultProfileForUser, resolveRequestedProfileId } from "../helpers/profiles";
import { ensureAvatarColumns, normalizeAvatarRole } from "./schema";

interface ListAvatarsRequest {
  profileId?: string;
  includeShared?: boolean;
}

interface ListAvatarsResponse {
  avatars: Avatar[];
}

type AvatarListRow = {
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
  avatar_role: string | null;
  source_avatar_id: string | null;
  original_avatar_id: string | null;
  created_at: Date;
  updated_at: Date;
  inventory: string | null;
  skills: string | null;
  share_count?: number;
  shared_by_user_id?: string | null;
  shared_at?: Date | null;
};

// Retrieves profile-local avatars. A mutable avatar instance never crosses child-profile boundaries.
export const list = api<ListAvatarsRequest, ListAvatarsResponse>(
  { expose: true, method: "GET", path: "/avatars", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    await ensureAvatarColumns();
    await ensureAvatarSharingTables();
    const activeProfileId = await resolveRequestedProfileId({
      userId: auth.userID,
      requestedProfileId: req.profileId,
    });
    const defaultProfile = await ensureDefaultProfileForUser(auth.userID, auth.email ?? undefined);
    const includeLegacyUnscoped = activeProfileId === defaultProfile.id;

    const ownRows = await avatarDB.queryAll<AvatarListRow>`
      SELECT
        a.id,
        a.user_id,
        a.profile_id,
        a.name,
        a.description,
        a.physical_traits,
        a.personality_traits,
        a.image_url,
        a.visual_profile,
        a.creation_type,
        a.is_public,
        a.source_type,
        a.avatar_role,
        a.source_avatar_id,
        a.original_avatar_id,
        a.created_at,
        a.updated_at,
        a.inventory,
        a.skills,
        COUNT(s.id)::int AS share_count
      FROM avatars a
      LEFT JOIN avatar_shares s ON s.avatar_id = a.id AND s.owner_user_id = a.user_id
      WHERE a.user_id = ${auth.userID}
        AND (
          a.profile_id = ${activeProfileId}
          OR (${includeLegacyUnscoped} AND a.profile_id IS NULL)
        )
      GROUP BY
        a.id,
        a.user_id,
        a.profile_id,
        a.name,
        a.description,
        a.physical_traits,
        a.personality_traits,
        a.image_url,
        a.visual_profile,
        a.creation_type,
        a.is_public,
        a.source_type,
        a.avatar_role,
        a.source_avatar_id,
        a.original_avatar_id,
        a.created_at,
        a.updated_at,
        a.inventory,
        a.skills
      ORDER BY a.created_at DESC
    `;

    const ownAvatars: Avatar[] = await Promise.all(
      ownRows.map(async (row) => ({
        id: row.id,
        userId: row.user_id,
        profileId: row.profile_id || activeProfileId,
        name: row.name,
        description: row.description || undefined,
        physicalTraits: JSON.parse(row.physical_traits),
        personalityTraits: JSON.parse(row.personality_traits),
        imageUrl: await buildAvatarImageUrlForClient(row.id, row.image_url || undefined),
        visualProfile: row.visual_profile ? (JSON.parse(row.visual_profile) as AvatarVisualProfile) : undefined,
        creationType: row.creation_type,
        isPublic: row.is_public,
        isShared: (row.share_count ?? 0) > 0,
        isOwnedByCurrentUser: true,
        sharedWithCount: row.share_count ?? 0,
        avatarRole: normalizeAvatarRole(row.avatar_role),
        sourceType: (row.source_type as Avatar["sourceType"]) || "profile",
        sourceAvatarId: row.source_avatar_id || undefined,
        originalAvatarId: row.original_avatar_id || undefined,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        inventory: row.inventory ? JSON.parse(row.inventory) : [],
        skills: row.skills ? JSON.parse(row.skills) : [],
      }))
    );
    return { avatars: ownAvatars };
  }
);
