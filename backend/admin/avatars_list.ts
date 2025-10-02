import { api, Query } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { ensureAdmin } from "./authz";
import type { Avatar } from "../avatar/avatar";

const avatarDB = SQLDatabase.named("avatar");

interface ListAvatarsParams {
  limit?: Query<number>;
  cursor?: Query<string>;
  userId?: Query<string>;
  q?: Query<string>;
}

interface ListAvatarsResponse {
  avatars: Avatar[];
  nextCursor?: string | null;
}

// Lists avatars across all users (admin only).
export const listAvatarsAdmin = api<ListAvatarsParams, ListAvatarsResponse>(
  { expose: true, method: "GET", path: "/admin/avatars", auth: true },
  async (req) => {
    ensureAdmin();

    const limit = Math.min(Math.max((req.limit as unknown as number) || 25, 1), 100);
    const cursor = (req.cursor as unknown as string) || null;
    const userId = (req.userId as unknown as string) || "";
    const q = (req.q as unknown as string) || "";

    const rows = await avatarDB.queryAll<any>`
      SELECT *
      FROM avatars
      WHERE (${userId} = '' OR user_id = ${userId})
        AND (${q} = '' OR name ILIKE '%' || ${q} || '%' OR description ILIKE '%' || ${q} || '%')
        AND (${cursor} IS NULL OR id > ${cursor})
      ORDER BY id
      LIMIT ${limit + 1}
    `;

    const avatars: Avatar[] = rows.slice(0, limit).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description || undefined,
      physicalTraits: JSON.parse(row.physical_traits),
      personalityTraits: JSON.parse(row.personality_traits),
      imageUrl: row.image_url || undefined,
      visualProfile: row.visual_profile ? JSON.parse(row.visual_profile) : undefined,
      creationType: row.creation_type,
      isPublic: row.is_public,
      originalAvatarId: row.original_avatar_id || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const nextCursor = rows.length > limit ? rows[limit].id : null;

    return { avatars, nextCursor };
  }
);
