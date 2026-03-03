import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";
import { resolveRequestedProfileId } from "../helpers/profiles";
import { ensureAvatarProfileLinksTable, hasAvatarProfileLink, unlinkAvatarFromProfile } from "./profile-links";

interface DeleteAvatarParams {
  id: string;
  profileId?: string;
}

// Deletes an avatar.
export const deleteAvatar = api<DeleteAvatarParams, void>(
  { expose: true, method: "DELETE", path: "/avatar/:id", auth: true },
  async ({ id, profileId }) => {
    const auth = getAuthData()!;
    await ensureAvatarProfileLinksTable();
    const activeProfileId = await resolveRequestedProfileId({
      userId: auth.userID,
      requestedProfileId: profileId,
    });
    const existingAvatar = await avatarDB.queryRow<{ user_id: string; profile_id: string | null }>`
      SELECT user_id, profile_id FROM avatars WHERE id = ${id}
    `;

    if (!existingAvatar) {
      throw APIError.notFound("Avatar not found");
    }

    if (existingAvatar.user_id !== auth.userID && auth.role !== 'admin') {
      throw APIError.permissionDenied("You do not have permission to delete this avatar.");
    }

    if (
      existingAvatar.user_id === auth.userID &&
      existingAvatar.profile_id &&
      existingAvatar.profile_id !== activeProfileId &&
      auth.role !== "admin"
    ) {
      const linkedToActive = await hasAvatarProfileLink({
        avatarId: id,
        userId: auth.userID,
        profileId: activeProfileId,
      });
      if (!linkedToActive) {
        throw APIError.permissionDenied("Avatar belongs to another child profile.");
      }

      await unlinkAvatarFromProfile({
        avatarId: id,
        userId: auth.userID,
        profileId: activeProfileId,
      });
      return;
    }

    await avatarDB.exec`
            DELETE FROM avatars
      WHERE id = ${id}
    `;
  }
);
