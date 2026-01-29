import { api } from "encore.dev/api";
import type { Avatar, AvatarVisualProfile } from "./avatar";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";
import { buildAvatarImageUrlForClient } from "../helpers/image-proxy";

interface ListAvatarsResponse {
  avatars: Avatar[];
}

// Retrieves all avatars for the authenticated user.
export const list = api<void, ListAvatarsResponse>(
  { expose: true, method: "GET", path: "/avatars", auth: true },
  async () => {
    const auth = getAuthData()!;
    const rows = await avatarDB.queryAll<{
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
    }>`
      SELECT * FROM avatars WHERE user_id = ${auth.userID} ORDER BY created_at DESC
    `;

    const avatars: Avatar[] = await Promise.all(rows.map(async row => ({
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
      originalAvatarId: row.original_avatar_id || undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    })));

    return { avatars };
  }
);
