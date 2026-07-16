import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";
import { ensureDefaultProfileForUser, resolveRequestedProfileId } from "../helpers/profiles";
import { clearChildAvatarLink, ensureAvatarColumns, normalizeAvatarRole } from "./schema";

interface DeleteAvatarParams {
  id: string;
  profileId?: string;
}

// Deletes an avatar.
export const deleteAvatar = api<DeleteAvatarParams, void>(
  { expose: true, method: "DELETE", path: "/avatar/:id", auth: true },
  async ({ id, profileId }) => {
    const auth = getAuthData()!;
    await ensureAvatarColumns();
    const activeProfileId = await resolveRequestedProfileId({
      userId: auth.userID,
      requestedProfileId: profileId,
    });
    const defaultProfile = await ensureDefaultProfileForUser(auth.userID, auth.email ?? undefined);
    const existingAvatar = await avatarDB.queryRow<{
      user_id: string;
      profile_id: string | null;
      avatar_role: string | null;
    }>`
      SELECT user_id, profile_id, avatar_role FROM avatars WHERE id = ${id}
    `;

    if (!existingAvatar) {
      throw APIError.notFound("Avatar not found");
    }

    if (existingAvatar.user_id !== auth.userID && auth.role !== 'admin') {
      throw APIError.permissionDenied("You do not have permission to delete this avatar.");
    }

    const ownerProfileId = existingAvatar.profile_id || defaultProfile.id;
    if (existingAvatar.user_id === auth.userID && ownerProfileId !== activeProfileId && auth.role !== "admin") {
      throw APIError.permissionDenied("Avatar belongs to another child profile.");
    }

    await avatarDB.exec`
            DELETE FROM avatars
      WHERE id = ${id}
    `;

    if (normalizeAvatarRole(existingAvatar.avatar_role) === "child") {
      await clearChildAvatarLink({
        userId: auth.userID,
        avatarId: id,
      });
    }
  }
);
