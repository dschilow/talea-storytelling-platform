import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { getAuthData } from "~encore/auth";

const dokuDB = SQLDatabase.named("doku");

interface DeleteDokuParams {
  id: string;
}

export const deleteDoku = api<DeleteDokuParams, void>(
  { expose: true, method: "DELETE", path: "/doku/:id", auth: true },
  async ({ id }) => {
    const auth = getAuthData()!;
    const row = await dokuDB.queryRow<{ user_id: string }>`SELECT user_id FROM dokus WHERE id = ${id}`;
    if (!row) throw APIError.notFound("Doku not found");
    if (row.user_id !== auth.userID && auth.role !== "admin") {
      throw APIError.permissionDenied("You do not have permission to delete this dossier.");
    }
    await dokuDB.exec`DELETE FROM dokus WHERE id = ${id}`;
  }
);
