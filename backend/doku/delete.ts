import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { getAuthData } from "~encore/auth";
import { resolveRequestedProfileId } from "../helpers/profiles";

const dokuDB = SQLDatabase.named("doku");

interface DeleteDokuParams {
  id: string;
  profileId?: string;
}

export const deleteDoku = api<DeleteDokuParams, void>(
  { expose: true, method: "DELETE", path: "/doku/:id", auth: true },
  async ({ id, profileId }) => {
    const auth = getAuthData()!;
    const activeProfileId = await resolveRequestedProfileId({
      userId: auth.userID,
      requestedProfileId: profileId,
      fallbackName: auth.email ?? undefined,
    });
    const row = await dokuDB.queryRow<{ user_id: string; is_public: boolean }>`
      SELECT user_id, is_public
      FROM dokus
      WHERE id = ${id}
    `;
    if (!row) throw APIError.notFound("Doku not found");
    if (row.user_id !== auth.userID && auth.role !== "admin") {
      throw APIError.permissionDenied("You do not have permission to delete this dossier.");
    }
    if (row.user_id === auth.userID && auth.role !== "admin") {
      const participant = await dokuDB.queryRow<{ profile_id: string }>`
        SELECT profile_id
        FROM doku_participants
        WHERE doku_id = ${id}
          AND profile_id = ${activeProfileId}
        LIMIT 1
      `;
      const hasParticipants = await dokuDB.queryRow<{ has_any: boolean }>`
        SELECT EXISTS (
          SELECT 1 FROM doku_participants WHERE doku_id = ${id}
        ) AS has_any
      `;
      if (hasParticipants?.has_any && !participant && !row.is_public) {
        throw APIError.permissionDenied("Doku belongs to another child profile.");
      }
    }
    await dokuDB.exec`DELETE FROM dokus WHERE id = ${id}`;
  }
);
