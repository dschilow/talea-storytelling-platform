import { api, APIError } from "encore.dev/api";
import type { Story } from "./generate";
import { getAuthData } from "~encore/auth";
import { storyDB } from "./db";
import { resolveRequestedProfileId } from "../helpers/profiles";

interface UpdateStoryRequest {
  id: string;
  profileId?: string;
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
    const activeProfileId = await resolveRequestedProfileId({
      userId: auth.userID,
      requestedProfileId: req.profileId,
      fallbackName: auth.email ?? undefined,
    });

    const story = await storyDB.queryRow<{ user_id: string; is_public: boolean }>`
      SELECT user_id, is_public FROM stories WHERE id = ${id}
    `;

    if (!story) {
      throw APIError.notFound("Story not found");
    }

    if (story.user_id !== auth.userID && auth.role !== 'admin') {
      throw APIError.permissionDenied("You do not have permission to update this story.");
    }
    if (story.user_id === auth.userID && auth.role !== "admin") {
      const participant = await storyDB.queryRow<{ profile_id: string }>`
        SELECT profile_id
        FROM story_participants
        WHERE story_id = ${id}
          AND profile_id = ${activeProfileId}
        LIMIT 1
      `;
      const hasParticipants = await storyDB.queryRow<{ has_any: boolean }>`
        SELECT EXISTS (
          SELECT 1 FROM story_participants WHERE story_id = ${id}
        ) AS has_any
      `;
      if (hasParticipants?.has_any && !participant && !story.is_public) {
        throw APIError.permissionDenied("Story belongs to another child profile.");
      }
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
