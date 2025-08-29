import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import type { Story } from "./generate";

const storyDB = SQLDatabase.named("story");

interface GetStoryParams {
  id: string;
}

// Retrieves a specific story by ID with all chapters.
export const get = api<GetStoryParams, Story>(
  { expose: true, method: "GET", path: "/story/:id" },
  async ({ id }) => {
    const storyRow = await storyDB.queryRow<{
      id: string;
      user_id: string;
      title: string;
      description: string;
      cover_image_url: string | null;
      config: string;
      status: "generating" | "complete" | "error";
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT * FROM stories WHERE id = ${id}
    `;

    if (!storyRow) {
      throw APIError.notFound("Story not found");
    }

    const chapterRows = await storyDB.queryAll<{
      id: string;
      title: string;
      content: string;
      image_url: string | null;
      chapter_order: number;
    }>`
      SELECT id, title, content, image_url, chapter_order 
      FROM chapters 
      WHERE story_id = ${id} 
      ORDER BY chapter_order
    `;

    return {
      id: storyRow.id,
      userId: storyRow.user_id,
      title: storyRow.title,
      description: storyRow.description,
      coverImageUrl: storyRow.cover_image_url || undefined,
      config: JSON.parse(storyRow.config),
      chapters: chapterRows.map(ch => ({
        id: ch.id,
        title: ch.title,
        content: ch.content,
        imageUrl: ch.image_url || undefined,
        order: ch.chapter_order,
      })),
      status: storyRow.status,
      createdAt: storyRow.created_at,
      updatedAt: storyRow.updated_at,
    };
  }
);
