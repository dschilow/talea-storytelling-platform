import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { getAuthData } from "~encore/auth";

const userDB = SQLDatabase.named("user");

interface PromoteResponse {
  success: boolean;
  message: string;
}

// Allows the first-ever user to promote themselves to an admin.
// This endpoint is a one-time-use mechanism for bootstrapping the first admin account.
export const promoteToAdmin = api<void, PromoteResponse>(
  { expose: true, method: "POST", path: "/admin/promote-first-admin", auth: true },
  async () => {
    const auth = getAuthData();
    if (!auth) {
      // This should not happen due to `auth: true`, but as a safeguard.
      throw APIError.unauthenticated("authentication required");
    }

    await using tx = await userDB.begin();

    const adminCountRow = await tx.queryRow<{ count: string }>`
      SELECT COUNT(*)::text as count FROM users WHERE role = 'admin'
    `;
    const adminCount = parseInt(adminCountRow?.count ?? "0", 10);

    if (adminCount > 0) {
      throw APIError.permissionDenied("An admin account already exists.");
    }

    await tx.exec`
      UPDATE users SET role = 'admin' WHERE id = ${auth.userID}
    `;
    
    await tx.commit();

    return {
      success: true,
      message: `User ${auth.userID} has been promoted to admin. Please refresh the page.`,
    };
  }
);
