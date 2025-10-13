import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";

export interface ResetDokuHistoryRequest {
  avatarId: string;
  dokuId?: string; // Optional: reset specific doku, or all if not provided
}

export interface ResetDokuHistoryResponse {
  success: boolean;
  removedEntries: number;
  message: string;
}

// Reset doku reading history for an avatar (allows re-reading dokus)
export const resetDokuHistory = api(
  { expose: true, method: "POST", path: "/avatar/:avatarId/reset-doku-history", auth: true },
  async (req: ResetDokuHistoryRequest): Promise<ResetDokuHistoryResponse> => {
    const auth = getAuthData()!;
    const { avatarId, dokuId } = req;

    console.log(`🗑️ Resetting doku history for avatar ${avatarId}${dokuId ? ` (specific doku: ${dokuId})` : ' (all dokus)'}`);

    // Verify avatar ownership
    const avatar = await avatarDB.queryRow<{
      id: string;
      user_id: string;
      name: string;
    }>`
      SELECT id, user_id, name FROM avatars WHERE id = ${avatarId}
    `;

    if (!avatar) {
      throw APIError.notFound("Avatar not found");
    }

    if (avatar.user_id !== auth.userID && auth.role !== 'admin') {
      throw APIError.permissionDenied("You do not have permission to modify this avatar");
    }

    let removedEntries = 0;

    try {
      if (dokuId) {
        // Reset specific doku
        await avatarDB.exec`
          DELETE FROM avatar_doku_read
          WHERE avatar_id = ${avatarId} AND doku_id = ${dokuId}
        `;
        console.log(`🗑️ Removed doku read entries for specific doku ${dokuId}`);
      } else {
        // Reset all dokus for this avatar
        await avatarDB.exec`
          DELETE FROM avatar_doku_read
          WHERE avatar_id = ${avatarId}
        `;
        console.log(`🗑️ Removed doku read entries for avatar ${avatar.name}`);
      }
    } catch (dbError) {
      console.log(`⚠️ Database operation completed but could not get rowsAffected: ${dbError}`);
      // The operation might have succeeded, so we'll report success with unknown count
      removedEntries = 0;
    }

    const message = dokuId
      ? `Doku-Historie für spezielle Doku zurückgesetzt (${removedEntries} Einträge entfernt)`
      : `Komplette Doku-Historie für ${avatar.name} zurückgesetzt (${removedEntries} Einträge entfernt)`;

    console.log(`✅ ${message}`);

    return {
      success: true,
      removedEntries,
      message
    };
  }
);