import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const storyDB = SQLDatabase.named("story");

interface DeleteStoryParams {
  id: string;
}

// Deletes a story and all its chapters.
export const deleteStory = api<DeleteStoryParams, void>(
  { expose: true, method: "DELETE", path: "/story/:id" },
  async ({ id }) => {
    const existingStory = await storyDB.queryRow`
      SELECT id FROM stories WHERE id = ${id}
    `;

    if (!existingStory) {
      throw APIError.notFound("Story not found");
    }

    // Delete chapters first (due to foreign key constraint)
    await storyDB.exec`
      DELETE FROM chapters WHERE story_id = ${id}
    `;

    // Then delete the story
    await storyDB.exec`
      DELETE FROM stories WHERE id = ${id}
    `;
  }
);
