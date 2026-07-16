import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";

export interface DeleteMemoryRequest {
  avatarId: string;
  memoryId: string;
}

export interface DeleteMemoryResponse {
  success: boolean;
  deletedMemoryId: string;
}

/**
 * Removes a diary entry only. Learned traits, completion claims and read history
 * are immutable completion facts and must not be rolled back from the diary UI.
 */
export const deleteMemory = api(
  { expose: true, method: "DELETE", path: "/avatar/:avatarId/memory/:memoryId", auth: true },
  async (req: DeleteMemoryRequest): Promise<DeleteMemoryResponse> => {
    const auth = getAuthData()!;
    const avatar = await avatarDB.queryRow<{ user_id: string }>`
      SELECT user_id
      FROM avatars
      WHERE id = ${req.avatarId}
      LIMIT 1
    `;

    if (!avatar) {
      throw APIError.notFound("Avatar not found");
    }
    if (avatar.user_id !== auth.userID && auth.role !== "admin") {
      throw APIError.permissionDenied("You do not have permission to modify this avatar");
    }

    const deleted = await avatarDB.queryRow<{ id: string }>`
      DELETE FROM avatar_memories
      WHERE id = ${req.memoryId}
        AND avatar_id = ${req.avatarId}
      RETURNING id
    `;

    if (!deleted) {
      throw APIError.notFound("Memory not found");
    }

    return {
      success: true,
      deletedMemoryId: deleted.id,
    };
  }
);
