import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { getAuthData } from "~encore/auth";

const storyDB = SQLDatabase.named("story");

interface DeleteStoryParams {
  id: string;
}

// Deletes a story and all its chapters.
export const deleteStory = api<DeleteStoryParams, void>(
  { expose: true, method: "DELETE", path: "/story/:id", auth: true },
  async ({ id }) => {
    const auth = getAuthData()!;
    const existingStory = await storyDB.queryRow<{ user_id: string }>`
      SELECT user_id FROM stories WHERE id = ${id}
    `;

    if (!existingStory) {
      throw APIError.notFound("Story not found");
    }

    if (existingStory.user_id !== auth.userID && auth.role !== 'admin') {
      throw APIError.permissionDenied("You do not have permission to delete this story.");
    }

    // Deletion will cascade to chapters due to foreign key constraint
    await storyDB.exec`
      DELETE FROM stories WHERE id = ${id}
    `;
  }
);
