import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { storyDB } from "./db";
import { resolveRequestedProfileId } from "../helpers/profiles";

interface DeleteStoryParams {
  id: string;
  profileId?: string;
}

// Deletes a story and all its chapters.
export const deleteStory = api<DeleteStoryParams, void>(
  { expose: true, method: "DELETE", path: "/story/:id", auth: true },
  async ({ id, profileId }) => {
    const auth = getAuthData()!;
    const activeProfileId = await resolveRequestedProfileId({
      userId: auth.userID,
      requestedProfileId: profileId,
      fallbackName: auth.email ?? undefined,
    });
    const existingStory = await storyDB.queryRow<{ user_id: string; is_public: boolean }>`
      SELECT user_id, is_public FROM stories WHERE id = ${id}
    `;

    if (!existingStory) {
      throw APIError.notFound("Story not found");
    }

    if (existingStory.user_id !== auth.userID && auth.role !== 'admin') {
      throw APIError.permissionDenied("You do not have permission to delete this story.");
    }
    if (existingStory.user_id === auth.userID && auth.role !== "admin") {
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
      if (hasParticipants?.has_any && !participant && !existingStory.is_public) {
        throw APIError.permissionDenied("Story belongs to another child profile.");
      }
    }

    // Deletion will cascade to chapters due to foreign key constraint
    await storyDB.exec`
      DELETE FROM stories WHERE id = ${id}
    `;
  }
);
