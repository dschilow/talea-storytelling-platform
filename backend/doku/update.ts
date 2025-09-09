import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { getAuthData } from "~encore/auth";

const dokuDB = SQLDatabase.named("doku");

interface UpdateDokuRequest {
  id: string;
  title?: string;
  isPublic?: boolean;
}

export const updateDoku = api<UpdateDokuRequest, { success: boolean }>(
  { expose: true, method: "PUT", path: "/doku/:id", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const row = await dokuDB.queryRow<{ user_id: string }>`SELECT user_id FROM dokus WHERE id = ${req.id}`;
    if (!row) throw APIError.notFound("Doku not found");
    if (row.user_id !== auth.userID && auth.role !== "admin") {
      throw APIError.permissionDenied("You do not have permission to update this dossier.");
    }

    await dokuDB.exec`
      UPDATE dokus
      SET title = COALESCE(${req.title}, title),
          is_public = COALESCE(${req.isPublic}, is_public),
          updated_at = ${new Date()}
      WHERE id = ${req.id}
    `;
    return { success: true };
  }
);
