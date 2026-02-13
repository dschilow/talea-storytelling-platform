import { api } from "encore.dev/api";
import type { Avatar, AvatarVisualProfile } from "./avatar";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";
import { buildAvatarImageUrlForClient } from "../helpers/image-proxy";
import { ensureAvatarSharingTables, getUserProfilesByIds, normalizeEmail } from "./sharing";

interface ListAvatarsResponse {
  avatars: Avatar[];
}

type AvatarListRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  physical_traits: string;
  personality_traits: string;
  image_url: string | null;
  visual_profile: string | null;
  creation_type: "ai-generated" | "photo-upload";
  is_public: boolean;
  original_avatar_id: string | null;
  created_at: Date;
  updated_at: Date;
  share_count?: number;
  shared_by_user_id?: string | null;
  shared_at?: Date | null;
};

// Retrieves avatars owned by the user and avatars shared with the user.
export const list = api<void, ListAvatarsResponse>(
  { expose: true, method: "GET", path: "/avatars", auth: true },
  async () => {
    const auth = getAuthData()!;
    await ensureAvatarSharingTables();
    const normalizedEmail = normalizeEmail(auth.email);

    const ownRows = await avatarDB.queryAll<AvatarListRow>`
      SELECT
        a.id,
        a.user_id,
        a.name,
        a.description,
        a.physical_traits,
        a.personality_traits,
        a.image_url,
        a.visual_profile,
        a.creation_type,
        a.is_public,
        a.original_avatar_id,
        a.created_at,
        a.updated_at,
        COUNT(s.id)::int AS share_count
      FROM avatars a
      LEFT JOIN avatar_shares s ON s.avatar_id = a.id AND s.owner_user_id = a.user_id
      WHERE a.user_id = ${auth.userID}
      GROUP BY
        a.id,
        a.user_id,
        a.name,
        a.description,
        a.physical_traits,
        a.personality_traits,
        a.image_url,
        a.visual_profile,
        a.creation_type,
        a.is_public,
        a.original_avatar_id,
        a.created_at,
        a.updated_at
      ORDER BY a.created_at DESC
    `;

    const sharedRows = normalizedEmail
      ? await avatarDB.queryAll<AvatarListRow>`
          SELECT
            a.id,
            a.user_id,
            a.name,
            a.description,
            a.physical_traits,
            a.personality_traits,
            a.image_url,
            a.visual_profile,
            a.creation_type,
            a.is_public,
            a.original_avatar_id,
            a.created_at,
            a.updated_at,
            s.owner_user_id AS shared_by_user_id,
            MAX(s.created_at) AS shared_at
          FROM avatars a
          INNER JOIN avatar_shares s ON s.avatar_id = a.id
          WHERE a.user_id <> ${auth.userID}
            AND (s.target_user_id = ${auth.userID} OR s.target_email = ${normalizedEmail})
          GROUP BY
            a.id,
            a.user_id,
            a.name,
            a.description,
            a.physical_traits,
            a.personality_traits,
            a.image_url,
            a.visual_profile,
            a.creation_type,
            a.is_public,
            a.original_avatar_id,
            a.created_at,
            a.updated_at,
            s.owner_user_id
          ORDER BY MAX(s.updated_at) DESC
        `
      : await avatarDB.queryAll<AvatarListRow>`
          SELECT
            a.id,
            a.user_id,
            a.name,
            a.description,
            a.physical_traits,
            a.personality_traits,
            a.image_url,
            a.visual_profile,
            a.creation_type,
            a.is_public,
            a.original_avatar_id,
            a.created_at,
            a.updated_at,
            s.owner_user_id AS shared_by_user_id,
            MAX(s.created_at) AS shared_at
          FROM avatars a
          INNER JOIN avatar_shares s ON s.avatar_id = a.id
          WHERE a.user_id <> ${auth.userID}
            AND s.target_user_id = ${auth.userID}
          GROUP BY
            a.id,
            a.user_id,
            a.name,
            a.description,
            a.physical_traits,
            a.personality_traits,
            a.image_url,
            a.visual_profile,
            a.creation_type,
            a.is_public,
            a.original_avatar_id,
            a.created_at,
            a.updated_at,
            s.owner_user_id
          ORDER BY MAX(s.updated_at) DESC
        `;

    const ownerProfiles = await getUserProfilesByIds(
      sharedRows
        .map((row) => row.shared_by_user_id)
        .filter((value): value is string => Boolean(value))
    );

    const ownAvatars: Avatar[] = await Promise.all(
      ownRows.map(async (row) => ({
        id: row.id,
        userId: row.user_id,
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
        originalAvatarId: row.original_avatar_id || undefined,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        inventory: [],
        skills: [],
      }))
    );

    const sharedAvatars: Avatar[] = await Promise.all(
      sharedRows.map(async (row) => {
        const ownerUserId = row.shared_by_user_id ?? row.user_id;
        const ownerProfile = ownerProfiles.get(ownerUserId);

        return {
          id: row.id,
          userId: row.user_id,
          name: row.name,
          description: row.description || undefined,
          physicalTraits: JSON.parse(row.physical_traits),
          personalityTraits: JSON.parse(row.personality_traits),
          imageUrl: await buildAvatarImageUrlForClient(row.id, row.image_url || undefined),
          visualProfile: row.visual_profile ? (JSON.parse(row.visual_profile) as AvatarVisualProfile) : undefined,
          creationType: row.creation_type,
          isPublic: row.is_public,
          isShared: true,
          isOwnedByCurrentUser: false,
          sharedBy: {
            userId: ownerUserId,
            name: ownerProfile?.name ?? undefined,
            email: ownerProfile?.email ?? undefined,
            sharedAt: row.shared_at ? row.shared_at.toISOString() : undefined,
          },
          originalAvatarId: row.original_avatar_id || undefined,
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
          inventory: [],
          skills: [],
        };
      })
    );

    return { avatars: [...ownAvatars, ...sharedAvatars] };
  }
);
