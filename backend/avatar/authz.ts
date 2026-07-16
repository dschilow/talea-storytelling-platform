import { APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";

export async function assertAvatarOwnedByCurrentUser(avatarId: string): Promise<void> {
  const auth = getAuthData()!;
  const avatar = await avatarDB.queryRow<{ user_id: string }>`
    SELECT user_id FROM avatars WHERE id = ${avatarId}
  `;

  if (!avatar) {
    throw APIError.notFound("Avatar not found");
  }
  if (avatar.user_id !== auth.userID && auth.role !== "admin") {
    throw APIError.permissionDenied("You do not have access to this avatar");
  }
}