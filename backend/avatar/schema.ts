import { APIError } from "encore.dev/api";
import type { AvatarVisualProfile } from "./avatar";
import { avatarDB } from "./db";
import { userDB } from "../user/db";

let avatarColumnsEnsured = false;

export type AvatarRole = "child" | "companion";

export async function ensureAvatarColumns(): Promise<void> {
  if (avatarColumnsEnsured) {
    return;
  }

  await avatarDB.exec`
    ALTER TABLE avatars
    ADD COLUMN IF NOT EXISTS profile_id TEXT
  `;
  await avatarDB.exec`
    ALTER TABLE avatars
    ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'profile'
  `;
  await avatarDB.exec`
    ALTER TABLE avatars
    ADD COLUMN IF NOT EXISTS source_avatar_id TEXT
  `;
  await avatarDB.exec`
    ALTER TABLE avatars
    ADD COLUMN IF NOT EXISTS avatar_role TEXT NOT NULL DEFAULT 'companion'
  `;

  avatarColumnsEnsured = true;
}

export function normalizeAvatarRole(value?: string | null): AvatarRole {
  return value === "child" ? "child" : "companion";
}

function looksHuman(value?: string | null): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    normalized.includes("human") ||
    normalized.includes("mensch") ||
    normalized.includes("boy") ||
    normalized.includes("girl") ||
    normalized.includes("child") ||
    normalized.includes("kid")
  );
}

export function isHumanAvatarInput(params: {
  physicalTraits?: { characterType?: string | null };
  visualProfile?: AvatarVisualProfile | null;
}): boolean {
  if (params.visualProfile?.speciesCategory === "human") {
    return true;
  }

  if (looksHuman(params.visualProfile?.characterType)) {
    return true;
  }

  return looksHuman(params.physicalTraits?.characterType);
}

export async function assertCanAssignChildAvatar(params: {
  userId: string;
  profileId: string;
  avatarId?: string;
}): Promise<void> {
  await ensureAvatarColumns();
  const existing = await avatarDB.queryRow<{ id: string }>`
    SELECT id
    FROM avatars
    WHERE user_id = ${params.userId}
      AND profile_id = ${params.profileId}
      AND avatar_role = 'child'
      AND (${params.avatarId ?? null}::TEXT IS NULL OR id <> ${params.avatarId ?? null})
    LIMIT 1
  `;

  if (existing) {
    throw APIError.failedPrecondition("This child profile already has a dedicated child avatar.");
  }
}

export async function syncChildAvatarLink(params: {
  userId: string;
  profileId: string;
  avatarId: string;
  role: AvatarRole;
}): Promise<void> {
  if (params.role !== "child") {
    return;
  }

  await userDB.exec`
    UPDATE child_profiles
    SET child_avatar_id = ${params.avatarId},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${params.profileId}
      AND user_id = ${params.userId}
  `;
}

export async function clearChildAvatarLink(params: {
  userId: string;
  avatarId: string;
}): Promise<void> {
  await userDB.exec`
    UPDATE child_profiles
    SET child_avatar_id = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${params.userId}
      AND child_avatar_id = ${params.avatarId}
  `;
}
