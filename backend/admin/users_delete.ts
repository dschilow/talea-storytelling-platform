import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { ensureAdmin } from "./authz";

const userDB = SQLDatabase.named("user");
const storyDB = SQLDatabase.named("story");
const avatarDB = SQLDatabase.named("avatar");

interface DeleteUserParams {
  id: string;
}

interface DeleteUserResponse {
  success: boolean;
  removed: {
    avatars: number;
    stories: number;
    user: boolean;
  };
}

// Deletes a user and their related content (avatars and stories).
export const deleteUser = api<DeleteUserParams, DeleteUserResponse>(
  { expose: true, method: "DELETE", path: "/admin/users/:id", auth: true },
  async ({ id }) => {
    ensureAdmin();

    const existing = await userDB.queryRow`SELECT id FROM users WHERE id = ${id}`;
    if (!existing) {
      throw APIError.notFound("user not found");
    }

    // Count items to return.
    const avatarCountRow = await avatarDB.rawQueryRow<{ count: string }>("SELECT COUNT(*)::text as count FROM avatars WHERE user_id = $1", id);
    const storyCountRow = await storyDB.rawQueryRow<{ count: string }>("SELECT COUNT(*)::text as count FROM stories WHERE user_id = $1", id);

    // Delete related entities.
    await avatarDB.exec`DELETE FROM avatars WHERE user_id = ${id}`;
    // First delete chapters via cascade (chapters references stories with ON DELETE CASCADE),
    // but we still delete stories explicitly.
    await storyDB.exec`DELETE FROM stories WHERE user_id = ${id}`;
    await userDB.exec`DELETE FROM users WHERE id = ${id}`;

    return {
      success: true,
      removed: {
        avatars: parseInt(avatarCountRow?.count ?? "0", 10),
        stories: parseInt(storyCountRow?.count ?? "0", 10),
        user: true,
      },
    };
  }
);
