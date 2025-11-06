import { api } from "encore.dev/api";
import type { StorySummary } from "./generate";
import { getAuthData } from "~encore/auth";
import { storyDB } from "./db";

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

    const stories: StorySummary[] = storyRows.map(storyRow => ({
      id: storyRow.id,
      userId: storyRow.user_id,
      title: storyRow.title,
      description: storyRow.description,
      coverImageUrl: storyRow.cover_image_url || undefined,
      config: JSON.parse(storyRow.config),
      metadata: storyRow.metadata ? JSON.parse(storyRow.metadata) : undefined,
      status: storyRow.status,
      isPublic: storyRow.is_public,
      createdAt: storyRow.created_at,
      updatedAt: storyRow.updated_at,
    }));

    const hasMore = offset + limit < total;

    return { stories, total, hasMore };
  }
);
