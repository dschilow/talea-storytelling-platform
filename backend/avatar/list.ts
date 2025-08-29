import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import type { Avatar } from "./create";

const avatarDB = SQLDatabase.named("avatar");

interface ListAvatarsParams {
  userId: string;
}

interface ListAvatarsResponse {
  avatars: Avatar[];
}

// Retrieves all avatars for a user.
export const list = api<ListAvatarsParams, ListAvatarsResponse>(
  { expose: true, method: "GET", path: "/avatar/user/:userId" },
  async ({ userId }) => {
    const rows = await avatarDB.queryAll<{
      id: string;
      user_id: string;
      name: string;
      description: string | null;
      physical_traits: string;
      personality_traits: string;
      image_url: string | null;
      creation_type: "ai-generated" | "photo-upload";
      is_shared: boolean;
      original_avatar_id: string | null;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT * FROM avatars WHERE user_id = ${userId} ORDER BY created_at DESC
    `;

    const avatars: Avatar[] = rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description || undefined,
      physicalTraits: JSON.parse(row.physical_traits),
      personalityTraits: JSON.parse(row.personality_traits),
      imageUrl: row.image_url || undefined,
      creationType: row.creation_type,
      isShared: row.is_shared,
      originalAvatarId: row.original_avatar_id || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { avatars };
  }
);
