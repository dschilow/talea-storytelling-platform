import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import type { Story } from "./generate";

const storyDB = SQLDatabase.named("story");

interface ListStoriesParams {
  userId: string;
}

interface ListStoriesResponse {
  stories: Story[];
}

// Retrieves all stories for a user.
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
      SELECT * FROM stories WHERE user_id = ${userId} ORDER BY created_at DESC
    `;

    if (storyRows.length === 0) {
      return { stories: [] };
    }

    const storyIds = storyRows.map(s => s.id);

    const chapterRows = await storyDB.queryAll<{
      id: string;
      story_id: string;
      title: string;
      content: string;
      image_url: string | null;
      chapter_order: number;
    }>`
      SELECT id, story_id, title, content, image_url, chapter_order 
      FROM chapters 
      WHERE story_id = ANY(${storyIds}) 
      ORDER BY story_id, chapter_order
    `;

    const chaptersByStoryId = new Map<string, any[]>();
    for (const chapter of chapterRows) {
      if (!chaptersByStoryId.has(chapter.story_id)) {
        chaptersByStoryId.set(chapter.story_id, []);
      }
      chaptersByStoryId.get(chapter.story_id)!.push({
        id: chapter.id,
        title: chapter.title,
        content: chapter.content,
        imageUrl: chapter.image_url || undefined,
        order: chapter.chapter_order,
      });
    }

    const stories: Story[] = storyRows.map(storyRow => ({
      id: storyRow.id,
      userId: storyRow.user_id,
      title: storyRow.title,
      description: storyRow.description,
      coverImageUrl: storyRow.cover_image_url || undefined,
      config: JSON.parse(storyRow.config),
      metadata: storyRow.metadata ? JSON.parse(storyRow.metadata) : undefined,
      chapters: chaptersByStoryId.get(storyRow.id) || [],
      status: storyRow.status,
      createdAt: storyRow.created_at,
      updatedAt: storyRow.updated_at,
    }));

    return { stories };
  }
);
