import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import type { StorySummary } from "./generate";

const storyDB = SQLDatabase.named("story");

interface ListStoriesParams {
  userId: string;
}

interface ListStoriesResponse {
  stories: StorySummary[];
}

// Retrieves all stories for a user, without chapters.
export const list = api<ListStoriesParams, ListStoriesResponse>(
  { expose: true, method: "GET", path: "/story/user/:userId" },
  async ({ userId }) => {
    const storyRows = await storyDB.queryAll<{
      id: string;
      user_id: string;
      title: string;
      description: string;
      cover_image_url: string | null;
      config: string;
      metadata: string | null;
      status: "generating" | "complete" | "error";
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT id, user_id, title, description, cover_image_url, config, metadata, status, created_at, updated_at 
      FROM stories 
      WHERE user_id = ${userId} ORDER BY created_at DESC
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
      createdAt: storyRow.created_at,
      updatedAt: storyRow.updated_at,
    }));

    return { stories };
  }
);
