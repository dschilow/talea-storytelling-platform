import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import type { Avatar } from "./create";

const avatarDB = SQLDatabase.named("avatar");

interface GetAvatarParams {
  id: string;
}

// Retrieves a specific avatar by ID.
export const get = api<GetAvatarParams, Avatar>(
  { expose: true, method: "GET", path: "/avatar/:id" },
  async ({ id }) => {
    const row = await avatarDB.queryRow<{
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
      SELECT * FROM avatars WHERE id = ${id}
    `;

    if (!row) {
      throw APIError.notFound("Avatar not found");
    }

    return {
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
    };
  }
);
