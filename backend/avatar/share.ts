import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";
import {
  ensureAvatarSharingTables,
  defaultLabelForEmail,
  getUserProfilesByIds,
  isValidEmail,
  normalizeEmail,
  resolveUserByEmail,
  searchUsersByEmail,
} from "./sharing";

interface ShareContact {
  id: string;
  email: string;
  label: string;
  trusted: boolean;
  targetUserId?: string;
  targetUserName?: string;
  targetUserEmail?: string;
  sharedAvatarCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ShareSuggestion {
  email: string;
  label: string;
  targetUserId?: string;
  targetUserName?: string;
  existingContactId?: string;
  source: "trusted_contact" | "registered_user";
}

interface AvatarShareEntry {
  shareId: string;
  contactId: string;
  contactEmail: string;
  contactLabel: string;
  trusted: boolean;
  targetUserId?: string;
  targetUserName?: string;
  createdAt: string;
  updatedAt: string;
}

interface SuggestShareContactsQuery {
  q: string;
  limit?: number;
}

interface SuggestShareContactsResponse {
  suggestions: ShareSuggestion[];
}

interface ListShareContactsResponse {
  contacts: ShareContact[];
}

interface UpsertShareContactRequest {
  email: string;
  label?: string;
  trusted?: boolean;
}

interface UpsertShareContactResponse {
  contact: ShareContact;
}

interface DeleteShareContactParams {
  contactId: string;
}

interface DeleteShareContactResponse {
  success: boolean;
}

interface ListAvatarSharesParams {
  id: string;
}

interface ListAvatarSharesResponse {
  shares: AvatarShareEntry[];
}

interface ShareAvatarParams {
  id: string;
}

interface ShareAvatarRequest {
  contactId: string;
}

interface ShareAvatarResponse {
  share: AvatarShareEntry;
}

interface UnshareAvatarParams {
  id: string;
  contactId: string;
}

interface UnshareAvatarResponse {
  success: boolean;
}

async function ensureAvatarOwnership(avatarId: string, ownerUserId: string): Promise<{ id: string; user_id: string }> {
  await ensureAvatarSharingTables();
  const avatar = await avatarDB.queryRow<{ id: string; user_id: string }>`
    SELECT id, user_id
    FROM avatars
    WHERE id = ${avatarId}
    LIMIT 1
  `;

  if (!avatar) {
    throw APIError.notFound("Avatar not found");
  }

  if (avatar.user_id !== ownerUserId) {
    throw APIError.permissionDenied("You do not have permission to share this avatar");
  }

  return avatar;
}

async function authWithSharingSchema() {
  const auth = getAuthData()!;
  await ensureAvatarSharingTables();
  return auth;
}

async function loadShareContacts(ownerUserId: string): Promise<ShareContact[]> {
  const rows = await avatarDB.queryAll<{
    id: string;
    contact_email: string;
    display_name: string;
    is_trusted: boolean;
    target_user_id: string | null;
    created_at: Date;
    updated_at: Date;
    shared_avatar_count: number;
  }>`
    SELECT
      c.id,
      c.contact_email,
      c.display_name,
      c.is_trusted,
      c.target_user_id,
      c.created_at,
      c.updated_at,
      COUNT(s.id)::int AS shared_avatar_count
    FROM avatar_share_contacts c
    LEFT JOIN avatar_shares s ON s.contact_id = c.id
    WHERE c.owner_user_id = ${ownerUserId}
    GROUP BY c.id, c.contact_email, c.display_name, c.is_trusted, c.target_user_id, c.created_at, c.updated_at
    ORDER BY c.display_name ASC
  `;

  const targetUserProfiles = await getUserProfilesByIds(
    rows.map((row) => row.target_user_id).filter((value): value is string => Boolean(value))
  );

  return rows.map((row) => {
    const profile = row.target_user_id ? targetUserProfiles.get(row.target_user_id) : null;
    return {
      id: row.id,
      email: row.contact_email,
      label: row.display_name,
      trusted: row.is_trusted,
      targetUserId: row.target_user_id ?? undefined,
      targetUserName: profile?.name ?? undefined,
      targetUserEmail: profile?.email ?? undefined,
      sharedAvatarCount: row.shared_avatar_count ?? 0,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  });
}

async function loadAvatarShares(avatarId: string, ownerUserId: string): Promise<AvatarShareEntry[]> {
  const rows = await avatarDB.queryAll<{
    share_id: string;
    contact_id: string;
    contact_email: string;
    display_name: string;
    is_trusted: boolean;
    target_user_id: string | null;
    created_at: Date;
    updated_at: Date;
  }>`
    SELECT
      s.id AS share_id,
      s.contact_id,
      c.contact_email,
      c.display_name,
      c.is_trusted,
      s.target_user_id,
      s.created_at,
      s.updated_at
    FROM avatar_shares s
    INNER JOIN avatar_share_contacts c ON c.id = s.contact_id
    WHERE s.owner_user_id = ${ownerUserId}
      AND s.avatar_id = ${avatarId}
    ORDER BY c.display_name ASC
  `;

  const targetProfiles = await getUserProfilesByIds(
    rows.map((row) => row.target_user_id).filter((value): value is string => Boolean(value))
  );

  return rows.map((row) => ({
    shareId: row.share_id,
    contactId: row.contact_id,
    contactEmail: row.contact_email,
    contactLabel: row.display_name,
    trusted: row.is_trusted,
    targetUserId: row.target_user_id ?? undefined,
    targetUserName: row.target_user_id ? targetProfiles.get(row.target_user_id)?.name ?? undefined : undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }));
}

export const suggestShareContacts = api<SuggestShareContactsQuery, SuggestShareContactsResponse>(
  { expose: true, method: "GET", path: "/avatar/share/suggestions", auth: true },
  async (req) => {
    const auth = await authWithSharingSchema();
    const normalizedQuery = req.q.trim().toLowerCase();
    const limit = Math.min(Math.max(req.limit ?? 8, 1), 20);

    if (normalizedQuery.length < 2) {
      return { suggestions: [] };
    }

    const contactPattern = `%${normalizedQuery}%`;
    const trustedMatches = await avatarDB.queryAll<{
      id: string;
      contact_email: string;
      display_name: string;
      target_user_id: string | null;
    }>`
      SELECT id, contact_email, display_name, target_user_id
      FROM avatar_share_contacts
      WHERE owner_user_id = ${auth.userID}
        AND (contact_email LIKE ${contactPattern} OR lower(display_name) LIKE ${contactPattern})
      ORDER BY display_name ASC
      LIMIT ${limit}
    `;

    const userMatches = await searchUsersByEmail({
      query: normalizedQuery,
      excludeUserId: auth.userID,
      limit,
    });

    const userMap = new Map(userMatches.map((entry) => [entry.email, entry]));
    const suggestions: ShareSuggestion[] = [];
    const seenEmails = new Set<string>();

    for (const contact of trustedMatches) {
      if (seenEmails.has(contact.contact_email)) {
        continue;
      }

      const user = userMap.get(contact.contact_email);
      suggestions.push({
        email: contact.contact_email,
        label: contact.display_name,
        targetUserId: contact.target_user_id ?? user?.id,
        targetUserName: user?.name ?? undefined,
        existingContactId: contact.id,
        source: "trusted_contact",
      });
      seenEmails.add(contact.contact_email);

      if (suggestions.length >= limit) {
        return { suggestions };
      }
    }

    for (const user of userMatches) {
      if (seenEmails.has(user.email)) {
        continue;
      }

      suggestions.push({
        email: user.email,
        label: defaultLabelForEmail(user.email),
        targetUserId: user.id,
        targetUserName: user.name ?? undefined,
        source: "registered_user",
      });
      seenEmails.add(user.email);

      if (suggestions.length >= limit) {
        break;
      }
    }

    return { suggestions };
  }
);

export const listShareContacts = api<void, ListShareContactsResponse>(
  { expose: true, method: "GET", path: "/avatar/share/contacts", auth: true },
  async () => {
    const auth = await authWithSharingSchema();
    const contacts = await loadShareContacts(auth.userID);
    return { contacts };
  }
);

export const upsertShareContact = api<UpsertShareContactRequest, UpsertShareContactResponse>(
  { expose: true, method: "POST", path: "/avatar/share/contacts", auth: true },
  async (req) => {
    const auth = await authWithSharingSchema();
    const normalizedEmail = normalizeEmail(req.email);

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      throw APIError.invalidArgument("Please provide a valid email address");
    }

    if (auth.email && normalizeEmail(auth.email) === normalizedEmail) {
      throw APIError.invalidArgument("You cannot add your own email as share contact");
    }

    const resolvedUser = await resolveUserByEmail(normalizedEmail);
    const label = req.label?.trim() || resolvedUser?.name?.trim() || defaultLabelForEmail(normalizedEmail);
    const trusted = req.trusted ?? true;
    const now = new Date();

    await avatarDB.exec`
      INSERT INTO avatar_share_contacts (
        id,
        owner_user_id,
        contact_email,
        display_name,
        is_trusted,
        target_user_id,
        created_at,
        updated_at
      ) VALUES (
        ${crypto.randomUUID()},
        ${auth.userID},
        ${normalizedEmail},
        ${label},
        ${trusted},
        ${resolvedUser?.id ?? null},
        ${now},
        ${now}
      )
      ON CONFLICT (owner_user_id, contact_email)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        is_trusted = EXCLUDED.is_trusted,
        target_user_id = EXCLUDED.target_user_id,
        updated_at = EXCLUDED.updated_at
    `;

    const contacts = await loadShareContacts(auth.userID);
    const contact = contacts.find((entry) => entry.email === normalizedEmail);

    if (!contact) {
      throw APIError.internal("Failed to load saved share contact");
    }

    return { contact };
  }
);

export const deleteShareContact = api<DeleteShareContactParams, DeleteShareContactResponse>(
  { expose: true, method: "DELETE", path: "/avatar/share/contacts/:contactId", auth: true },
  async ({ contactId }) => {
    const auth = await authWithSharingSchema();

    await avatarDB.exec`
      DELETE FROM avatar_share_contacts
      WHERE id = ${contactId}
        AND owner_user_id = ${auth.userID}
    `;

    return { success: true };
  }
);

export const listAvatarShares = api<ListAvatarSharesParams, ListAvatarSharesResponse>(
  { expose: true, method: "GET", path: "/avatar/:id/shares", auth: true },
  async ({ id }) => {
    const auth = await authWithSharingSchema();
    await ensureAvatarOwnership(id, auth.userID);
    const shares = await loadAvatarShares(id, auth.userID);
    return { shares };
  }
);

export const shareAvatarWithContact = api<ShareAvatarParams & ShareAvatarRequest, ShareAvatarResponse>(
  { expose: true, method: "POST", path: "/avatar/:id/share", auth: true },
  async (req) => {
    const auth = await authWithSharingSchema();
    await ensureAvatarOwnership(req.id, auth.userID);

    const contact = await avatarDB.queryRow<{
      id: string;
      contact_email: string;
      display_name: string;
      is_trusted: boolean;
      target_user_id: string | null;
    }>`
      SELECT id, contact_email, display_name, is_trusted, target_user_id
      FROM avatar_share_contacts
      WHERE id = ${req.contactId}
        AND owner_user_id = ${auth.userID}
      LIMIT 1
    `;

    if (!contact) {
      throw APIError.notFound("Share contact not found");
    }

    const now = new Date();

    await avatarDB.exec`
      INSERT INTO avatar_shares (
        id,
        avatar_id,
        owner_user_id,
        contact_id,
        target_email,
        target_user_id,
        created_at,
        updated_at
      ) VALUES (
        ${crypto.randomUUID()},
        ${req.id},
        ${auth.userID},
        ${contact.id},
        ${contact.contact_email},
        ${contact.target_user_id},
        ${now},
        ${now}
      )
      ON CONFLICT (avatar_id, contact_id)
      DO UPDATE SET
        target_email = EXCLUDED.target_email,
        target_user_id = EXCLUDED.target_user_id,
        updated_at = EXCLUDED.updated_at
    `;

    const shares = await loadAvatarShares(req.id, auth.userID);
    const share = shares.find((entry) => entry.contactId === req.contactId);

    if (!share) {
      throw APIError.internal("Share could not be loaded");
    }

    return { share };
  }
);

export const unshareAvatarFromContact = api<UnshareAvatarParams, UnshareAvatarResponse>(
  { expose: true, method: "DELETE", path: "/avatar/:id/share/:contactId", auth: true },
  async ({ id, contactId }) => {
    const auth = await authWithSharingSchema();
    await ensureAvatarOwnership(id, auth.userID);

    await avatarDB.exec`
      DELETE FROM avatar_shares
      WHERE avatar_id = ${id}
        AND contact_id = ${contactId}
        AND owner_user_id = ${auth.userID}
    `;

    return { success: true };
  }
);
