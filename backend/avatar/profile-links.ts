import { avatarDB } from "./db";

let profileLinkSchemaPrepared = false;

export async function ensureAvatarProfileLinksTable(): Promise<void> {
  if (profileLinkSchemaPrepared) {
    return;
  }

  await avatarDB.exec`
    CREATE TABLE IF NOT EXISTS avatar_profile_links (
      avatar_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_avatar_profile_links_avatar FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE,
      PRIMARY KEY (avatar_id, profile_id)
    )
  `;

  await avatarDB.exec`
    CREATE INDEX IF NOT EXISTS idx_avatar_profile_links_user_profile
    ON avatar_profile_links(user_id, profile_id)
  `;

  await avatarDB.exec`
    CREATE INDEX IF NOT EXISTS idx_avatar_profile_links_avatar
    ON avatar_profile_links(avatar_id)
  `;

  profileLinkSchemaPrepared = true;
}

export async function hasAvatarProfileLink(input: {
  avatarId: string;
  userId: string;
  profileId: string;
}): Promise<boolean> {
  await ensureAvatarProfileLinksTable();

  const row = await avatarDB.queryRow<{ has_link: boolean }>`
    SELECT EXISTS (
      SELECT 1
      FROM avatar_profile_links
      WHERE avatar_id = ${input.avatarId}
        AND user_id = ${input.userId}
        AND profile_id = ${input.profileId}
    ) AS has_link
  `;

  return Boolean(row?.has_link);
}

export async function hasAvatarProfileLinkForAny(input: {
  avatarId: string;
  userId: string;
  profileIds: string[];
}): Promise<boolean> {
  await ensureAvatarProfileLinksTable();
  if (input.profileIds.length === 0) {
    return false;
  }

  const row = await avatarDB.queryRow<{ has_link: boolean }>`
    SELECT EXISTS (
      SELECT 1
      FROM avatar_profile_links
      WHERE avatar_id = ${input.avatarId}
        AND user_id = ${input.userId}
        AND profile_id = ANY(${input.profileIds})
    ) AS has_link
  `;

  return Boolean(row?.has_link);
}

export async function linkAvatarToProfile(input: {
  avatarId: string;
  userId: string;
  profileId: string;
}): Promise<void> {
  await ensureAvatarProfileLinksTable();
  await avatarDB.exec`
    INSERT INTO avatar_profile_links (
      avatar_id,
      user_id,
      profile_id,
      created_at,
      updated_at
    )
    VALUES (
      ${input.avatarId},
      ${input.userId},
      ${input.profileId},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (avatar_id, profile_id)
    DO UPDATE SET
      updated_at = CURRENT_TIMESTAMP
  `;
}

export async function unlinkAvatarFromProfile(input: {
  avatarId: string;
  userId: string;
  profileId: string;
}): Promise<void> {
  await ensureAvatarProfileLinksTable();
  await avatarDB.exec`
    DELETE FROM avatar_profile_links
    WHERE avatar_id = ${input.avatarId}
      AND user_id = ${input.userId}
      AND profile_id = ${input.profileId}
  `;
}
