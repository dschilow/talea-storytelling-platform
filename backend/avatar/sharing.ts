import { SQLDatabase } from "encore.dev/storage/sqldb";
import { avatarDB } from "./db";

const userDB = SQLDatabase.named("user");
let sharingSchemaPrepared = false;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ShareMatch {
  shareId: string;
  ownerUserId: string;
  contactId: string;
  contactEmail: string;
  contactLabel: string;
  trusted: boolean;
  sharedAt: Date;
}

export interface UserIdentity {
  id: string;
  email: string;
  name: string | null;
}

export interface UserProfileLite {
  id: string;
  email: string;
  name: string | null;
}

export function normalizeEmail(input: string | null | undefined): string | null {
  if (!input) {
    return null;
  }

  const normalized = input.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function isValidEmail(input: string): boolean {
  return EMAIL_PATTERN.test(input.trim());
}

export function defaultLabelForEmail(email: string): string {
  const localPart = email.split("@")[0]?.trim();
  return localPart && localPart.length > 0 ? localPart : email;
}

export async function ensureAvatarSharingTables(): Promise<void> {
  if (sharingSchemaPrepared) {
    return;
  }

  await avatarDB.exec`
    CREATE TABLE IF NOT EXISTS avatar_share_contacts (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      is_trusted BOOLEAN NOT NULL DEFAULT TRUE,
      target_user_id TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (owner_user_id, contact_email)
    )
  `;

  await avatarDB.exec`
    CREATE INDEX IF NOT EXISTS idx_avatar_share_contacts_owner
    ON avatar_share_contacts(owner_user_id)
  `;

  await avatarDB.exec`
    CREATE INDEX IF NOT EXISTS idx_avatar_share_contacts_target_user
    ON avatar_share_contacts(target_user_id)
  `;

  await avatarDB.exec`
    CREATE TABLE IF NOT EXISTS avatar_shares (
      id TEXT PRIMARY KEY,
      avatar_id TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      target_email TEXT NOT NULL,
      target_user_id TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_avatar_shares_avatar FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE,
      CONSTRAINT fk_avatar_shares_contact FOREIGN KEY (contact_id) REFERENCES avatar_share_contacts(id) ON DELETE CASCADE,
      UNIQUE (avatar_id, contact_id)
    )
  `;

  await avatarDB.exec`
    CREATE INDEX IF NOT EXISTS idx_avatar_shares_owner
    ON avatar_shares(owner_user_id)
  `;

  await avatarDB.exec`
    CREATE INDEX IF NOT EXISTS idx_avatar_shares_avatar
    ON avatar_shares(avatar_id)
  `;

  await avatarDB.exec`
    CREATE INDEX IF NOT EXISTS idx_avatar_shares_target_email
    ON avatar_shares(target_email)
  `;

  await avatarDB.exec`
    CREATE INDEX IF NOT EXISTS idx_avatar_shares_target_user
    ON avatar_shares(target_user_id)
  `;

  sharingSchemaPrepared = true;
}

export async function resolveUserByEmail(email: string): Promise<UserIdentity | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }

  const row = await userDB.queryRow<{ id: string; email: string; name: string | null }>`
    SELECT id, email, name
    FROM users
    WHERE lower(email) = ${normalized}
    LIMIT 1
  `;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: normalizeEmail(row.email) ?? row.email,
    name: row.name,
  };
}

export async function findAvatarShareForIdentity(input: {
  avatarId: string;
  userId: string;
  email?: string | null;
}): Promise<ShareMatch | null> {
  await ensureAvatarSharingTables();
  const normalizedEmail = normalizeEmail(input.email);

  const queryWithEmail = async () =>
    avatarDB.queryRow<{
      share_id: string;
      owner_user_id: string;
      contact_id: string;
      contact_email: string;
      display_name: string;
      is_trusted: boolean;
      created_at: Date;
    }>`
      SELECT
        s.id AS share_id,
        s.owner_user_id,
        s.contact_id,
        c.contact_email,
        c.display_name,
        c.is_trusted,
        s.created_at
      FROM avatar_shares s
      INNER JOIN avatar_share_contacts c ON c.id = s.contact_id
      WHERE s.avatar_id = ${input.avatarId}
        AND (s.target_user_id = ${input.userId} OR s.target_email = ${normalizedEmail})
      LIMIT 1
    `;

  const queryWithoutEmail = async () =>
    avatarDB.queryRow<{
      share_id: string;
      owner_user_id: string;
      contact_id: string;
      contact_email: string;
      display_name: string;
      is_trusted: boolean;
      created_at: Date;
    }>`
      SELECT
        s.id AS share_id,
        s.owner_user_id,
        s.contact_id,
        c.contact_email,
        c.display_name,
        c.is_trusted,
        s.created_at
      FROM avatar_shares s
      INNER JOIN avatar_share_contacts c ON c.id = s.contact_id
      WHERE s.avatar_id = ${input.avatarId}
        AND s.target_user_id = ${input.userId}
      LIMIT 1
    `;

  const row = normalizedEmail ? await queryWithEmail() : await queryWithoutEmail();

  if (!row) {
    return null;
  }

  return {
    shareId: row.share_id,
    ownerUserId: row.owner_user_id,
    contactId: row.contact_id,
    contactEmail: row.contact_email,
    contactLabel: row.display_name,
    trusted: row.is_trusted,
    sharedAt: row.created_at,
  };
}

export async function getUserProfilesByIds(userIds: string[]): Promise<Map<string, UserProfileLite>> {
  const uniqueIds = Array.from(new Set(userIds.filter((entry) => typeof entry === "string" && entry.trim().length > 0)));
  const result = new Map<string, UserProfileLite>();

  if (uniqueIds.length === 0) {
    return result;
  }

  const rows = await userDB.queryAll<{ id: string; email: string; name: string | null }>`
    SELECT id, email, name
    FROM users
    WHERE id = ANY(${uniqueIds})
  `;

  for (const row of rows) {
    result.set(row.id, {
      id: row.id,
      email: normalizeEmail(row.email) ?? row.email,
      name: row.name,
    });
  }

  return result;
}

export async function getUserProfileById(userId: string): Promise<UserProfileLite | null> {
  const rows = await getUserProfilesByIds([userId]);
  return rows.get(userId) ?? null;
}

export async function searchUsersByEmail(input: {
  query: string;
  excludeUserId: string;
  limit?: number;
}): Promise<UserProfileLite[]> {
  const normalizedQuery = input.query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const limit = Math.min(Math.max(input.limit ?? 8, 1), 20);
  const searchPattern = `%${normalizedQuery}%`;

  const rows = await userDB.queryAll<{ id: string; email: string; name: string | null }>`
    SELECT id, email, name
    FROM users
    WHERE id <> ${input.excludeUserId}
      AND lower(email) LIKE ${searchPattern}
    ORDER BY
      CASE WHEN lower(email) = ${normalizedQuery} THEN 0 ELSE 1 END,
      CASE WHEN lower(email) LIKE ${`${normalizedQuery}%`} THEN 0 ELSE 1 END,
      email ASC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    id: row.id,
    email: normalizeEmail(row.email) ?? row.email,
    name: row.name,
  }));
}
