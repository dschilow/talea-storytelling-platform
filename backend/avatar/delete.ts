import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const avatarDB = SQLDatabase.named("avatar");

interface DeleteAvatarParams {
  id: string;
}

// Deletes an avatar.
export const deleteAvatar = api<DeleteAvatarParams, void>(
  { expose: true, method: "DELETE", path: "/avatar/:id" },
  async ({ id }) => {
    const existingAvatar = await avatarDB.queryRow`
      SELECT id FROM avatars WHERE id = ${id}
    `;

    if (!existingAvatar) {
      throw APIError.notFound("Avatar not found");
    }

    await avatarDB.exec`
      DELETE FROM avatars WHERE id = ${id}
    `;
  }
);
