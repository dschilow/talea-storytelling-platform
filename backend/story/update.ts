import { api, APIError } from "encore.dev/api";
import type { Story } from "./generate";
import { getAuthData } from "~encore/auth";
import { storyDB } from "./db";

interface UpdateStoryRequest {
  id: string;
  title?: string;
  description?: string;
  isPublic?: boolean;
}

// Updates an existing story's metadata.
export const update = api<UpdateStoryRequest, { success: boolean }>(
  { expose: true, method: "PUT", path: "/story/:id", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const { id, ...updates } = req;

    const story = await storyDB.queryRow<{ user_id: string }>`
      SELECT user_id FROM stories WHERE id = ${id}
    `;

    if (!story) {
      throw APIError.notFound("Story not found");
    }

    if (story.user_id !== auth.userID && auth.role !== 'admin') {
      throw APIError.permissionDenied("You do not have permission to update this story.");
    }

    const now = new Date();
    
    await storyDB.exec`
      UPDATE stories SET
        title = COALESCE(${updates.title}, title),
        description = COALESCE(${updates.description}, description),
        is_public = COALESCE(${updates.isPublic}, is_public),
        updated_at = ${now}
      WHERE id = ${id}
    `;

    return { success: true };
  }
);
