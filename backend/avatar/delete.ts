import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { getAuthData } from "~encore/auth";

const avatarDB = SQLDatabase.named("avatar");

interface DeleteAvatarParams {
  id: string;
}

// Deletes an avatar.
export const deleteAvatar = api<DeleteAvatarParams, void>(
  { expose: true, method: "DELETE", path: "/avatar/:id", auth: true },
  async ({ id }) => {
    const auth = getAuthData()!;
    const existingAvatar = await avatarDB.queryRow<{ user_id: string }>`
      SELECT user_id FROM avatars WHERE id = ${id}
    `;

    if (!existingAvatar) {
      throw APIError.notFound("Avatar not found");
    }

    if (existingAvatar.user_id !== auth.userID && auth.role !== 'admin') {
      throw APIError.permissionDenied("You do not have permission to delete this avatar.");
    }

    await avatarDB.exec`
      DELETE FROM avatars WHERE id = ${id}
    `;
  }
);
