import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { getAuthData } from "~encore/auth";

const storyDB = new SQLDatabase("story", {
  migrations: "./migrations",
});

interface SearchStoriesRequest {
  query?: string;
  isPublic?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: "recent" | "popular" | "title";
}

interface SearchStoriesResponse {
  stories: Array<{
    id: string;
    userId: string;
    userName: string;
    title: string;
    summary: string;
    coverImageUrl?: string;
    isPublic: boolean;
    createdAt: Date;
    chapterCount: number;
  }>;
  total: number;
  hasMore: boolean;
}

// Search stories (authenticated users can search all public + own stories)
export const search = api<SearchStoriesRequest, SearchStoriesResponse>(
  { expose: true, method: "POST", path: "/story/search", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const limit = req.limit || 20;
    const offset = req.offset || 0;

    let whereClause = "";
    const params: any[] = [auth.userID];
    let paramIndex = 1;

    // User can see: own stories OR public stories
    whereClause = `(s.user_id = $${paramIndex} OR s.is_public = true)`;
    paramIndex++;

    // Add search query if provided
    if (req.query && req.query.trim().length > 0) {
      const searchTerm = `%${req.query.trim().toLowerCase()}%`;
      whereClause += ` AND (LOWER(s.title) LIKE $${paramIndex} OR LOWER(s.summary) LIKE $${paramIndex})`;
      params.push(searchTerm);
      paramIndex++;
    }

    // Filter by public/private if specified
    if (req.isPublic !== undefined) {
      whereClause += ` AND s.is_public = $${paramIndex}`;
      params.push(req.isPublic);
      paramIndex++;
    }

    // Determine sort order
    let orderBy = "s.created_at DESC"; // default: recent
    if (req.sortBy === "title") {
      orderBy = "s.title ASC";
    }
    // Note: "popular" would require view counts, which we don't have yet

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count
      FROM stories s
      WHERE ${whereClause}
    `;
    const countResult = await storyDB.queryRow<{ count: number }>(countQuery, ...params);
    const total = countResult?.count || 0;

    // Get stories with user info and chapter count
    params.push(limit);
    params.push(offset);

    const query = `
      SELECT
        s.id,
        s.user_id,
        s.title,
        s.summary,
        s.cover_image_url,
        s.is_public,
        s.created_at,
        (SELECT COUNT(*) FROM story_chapters WHERE story_id = s.id) as chapter_count
      FROM stories s
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const stories = await storyDB.query(query, ...params);

    // Get user names (we'll need to join with user service later, for now use userId)
    const result: SearchStoriesResponse = {
      stories: stories.map((s: any) => ({
        id: s.id,
        userId: s.user_id,
        userName: `User ${s.user_id.substring(0, 8)}`, // Placeholder until we have user names
        title: s.title,
        summary: s.summary,
        coverImageUrl: s.cover_image_url,
        isPublic: s.is_public,
        createdAt: s.created_at,
        chapterCount: s.chapter_count,
      })),
      total,
      hasMore: offset + limit < total,
    };

    return result;
  }
);

// Get public stories (no auth required for future public gallery)
export const getPublicStories = api<{ limit?: number; offset?: number }, SearchStoriesResponse>(
  { expose: true, method: "GET", path: "/story/public" },
  async (req) => {
    const limit = req.limit || 20;
    const offset = req.offset || 0;

    // Count public stories
    const countResult = await storyDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM stories
      WHERE is_public = true
    `;
    const total = countResult?.count || 0;

    // Get public stories
    const stories = await storyDB.query`
      SELECT
        s.id,
        s.user_id,
        s.title,
        s.summary,
        s.cover_image_url,
        s.is_public,
        s.created_at,
        (SELECT COUNT(*) FROM story_chapters WHERE story_id = s.id) as chapter_count
      FROM stories s
      WHERE s.is_public = true
      ORDER BY s.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const result: SearchStoriesResponse = {
      stories: stories.map((s: any) => ({
        id: s.id,
        userId: s.user_id,
        userName: `User ${s.user_id.substring(0, 8)}`, // Placeholder
        title: s.title,
        summary: s.summary,
        coverImageUrl: s.cover_image_url,
        isPublic: s.is_public,
        createdAt: s.created_at,
        chapterCount: s.chapter_count,
      })),
      total,
      hasMore: offset + limit < total,
    };

    return result;
  }
);

// Toggle story visibility
interface TogglePublicRequest {
  storyId: string;
  isPublic: boolean;
}

export const togglePublic = api<TogglePublicRequest, { success: boolean }>(
  { expose: true, method: "PUT", path: "/story/toggle-public", auth: true },
  async (req) => {
    const auth = getAuthData()!;

    // Verify ownership
    const story = await storyDB.queryRow<{ user_id: string }>`
      SELECT user_id FROM stories WHERE id = ${req.storyId}
    `;

    if (!story) {
      throw new Error("Story not found");
    }

    if (story.user_id !== auth.userID) {
      throw new Error("Not authorized to modify this story");
    }

    // Update visibility
    await storyDB.exec`
      UPDATE stories
      SET is_public = ${req.isPublic}, updated_at = NOW()
      WHERE id = ${req.storyId}
    `;

    return { success: true };
  }
);
