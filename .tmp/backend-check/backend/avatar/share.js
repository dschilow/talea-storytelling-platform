// @bun
var __using = (stack, value, async) => {
  if (value != null) {
    if (typeof value !== "object" && typeof value !== "function")
      throw TypeError('Object expected to be assigned to "using" declaration');
    let dispose;
    if (async)
      dispose = value[Symbol.asyncDispose];
    if (dispose === undefined)
      dispose = value[Symbol.dispose];
    if (typeof dispose !== "function")
      throw TypeError("Object not disposable");
    stack.push([async, dispose, value]);
  } else if (async) {
    stack.push([async]);
  }
  return value;
};
var __callDispose = (stack, error, hasError) => {
  let fail = (e) => error = hasError ? new SuppressedError(e, error, "An error was suppressed during disposal") : (hasError = true, e), next = (it) => {
    while (it = stack.pop()) {
      try {
        var result = it[1] && it[1].call(it[2]);
        if (it[0])
          return Promise.resolve(result).then(next, (e) => (fail(e), next()));
      } catch (e) {
        fail(e);
      }
    }
    if (hasError)
      throw error;
  };
  return next();
};

// backend/avatar/share.ts
import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";
import { getDefaultPersonalityTraits } from "../constants/personalityTraits";
import { ensureDefaultProfileForUser } from "../helpers/profiles";
import {
  ensureAvatarSharingTables,
  defaultLabelForEmail,
  getUserProfilesByIds,
  isValidEmail,
  normalizeEmail,
  resolveUserByEmail
} from "./sharing";
async function ensureAvatarOwnership(avatarId, ownerUserId) {
  await ensureAvatarSharingTables();
  const avatar = await avatarDB.queryRow`
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
async function loadOwnedAvatarForCopy(avatarId, ownerUserId) {
  const row = await avatarDB.queryRow`
    SELECT
      id,
      user_id,
      name,
      description,
      physical_traits,
      personality_traits,
      image_url,
      visual_profile,
      creation_type,
      avatar_role,
      source_type,
      source_avatar_id,
      original_avatar_id
    FROM avatars
    WHERE id = ${avatarId}
    LIMIT 1
  `;
  if (!row) {
    throw APIError.notFound("Avatar not found");
  }
  if (row.user_id !== ownerUserId) {
    throw APIError.permissionDenied("You do not have permission to share this avatar");
  }
  if (row.avatar_role === "child") {
    throw APIError.failedPrecondition("A dedicated child avatar cannot be shared with another account.");
  }
  return row;
}
async function authWithSharingSchema() {
  const auth = getAuthData();
  await ensureAvatarSharingTables();
  return auth;
}
async function loadShareContacts(ownerUserId) {
  const rows = await avatarDB.queryAll`
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
  const targetUserProfiles = await getUserProfilesByIds(rows.map((row) => row.target_user_id).filter((value) => Boolean(value)));
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
      updatedAt: row.updated_at.toISOString()
    };
  });
}
async function loadAvatarShares(avatarId, ownerUserId) {
  const rows = await avatarDB.queryAll`
    SELECT
      s.id AS share_id,
      s.contact_id,
      c.contact_email,
      c.display_name,
      c.is_trusted,
      s.target_user_id,
      s.copied_avatar_id,
      s.copied_profile_id,
      s.last_copied_at,
      s.created_at,
      s.updated_at
    FROM avatar_shares s
    INNER JOIN avatar_share_contacts c ON c.id = s.contact_id
    WHERE s.owner_user_id = ${ownerUserId}
      AND s.avatar_id = ${avatarId}
    ORDER BY c.display_name ASC
  `;
  const targetProfiles = await getUserProfilesByIds(rows.map((row) => row.target_user_id).filter((value) => Boolean(value)));
  return rows.map((row) => ({
    shareId: row.share_id,
    contactId: row.contact_id,
    contactEmail: row.contact_email,
    contactLabel: row.display_name,
    trusted: row.is_trusted,
    targetUserId: row.target_user_id ?? undefined,
    targetUserName: row.target_user_id ? targetProfiles.get(row.target_user_id)?.name ?? undefined : undefined,
    copiedAvatarId: row.copied_avatar_id ?? undefined,
    copiedToProfileId: row.copied_profile_id ?? undefined,
    copiedAt: row.last_copied_at?.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  }));
}
var suggestShareContacts = api({ expose: true, method: "GET", path: "/avatar/share/suggestions", auth: true }, async (req) => {
  const auth = await authWithSharingSchema();
  const exactEmail = normalizeEmail(req.q);
  const limit = Math.min(Math.max(req.limit ?? 8, 1), 20);
  if (!exactEmail || !isValidEmail(exactEmail)) {
    return { suggestions: [] };
  }
  const trustedMatches = await avatarDB.queryAll`
      SELECT id, contact_email, display_name, target_user_id
      FROM avatar_share_contacts
      WHERE owner_user_id = ${auth.userID}
        AND contact_email = ${exactEmail}
      ORDER BY display_name ASC
      LIMIT ${limit}
    `;
  const exactUser = await resolveUserByEmail(exactEmail);
  const userMatches = exactUser && exactUser.id !== auth.userID ? [exactUser] : [];
  const userMap = new Map(userMatches.map((entry) => [entry.email, entry]));
  const suggestions = [];
  const seenEmails = new Set;
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
      source: "trusted_contact"
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
      source: "registered_user"
    });
    seenEmails.add(user.email);
    if (suggestions.length >= limit) {
      break;
    }
  }
  return { suggestions };
});
var listShareContacts = api({ expose: true, method: "GET", path: "/avatar/share/contacts", auth: true }, async () => {
  const auth = await authWithSharingSchema();
  const contacts = await loadShareContacts(auth.userID);
  return { contacts };
});
var upsertShareContact = api({ expose: true, method: "POST", path: "/avatar/share/contacts", auth: true }, async (req) => {
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
  const now = new Date;
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
});
var deleteShareContact = api({ expose: true, method: "DELETE", path: "/avatar/share/contacts/:contactId", auth: true }, async ({ contactId }) => {
  const auth = await authWithSharingSchema();
  await avatarDB.exec`
      DELETE FROM avatar_share_contacts
      WHERE id = ${contactId}
        AND owner_user_id = ${auth.userID}
    `;
  return { success: true };
});
var listAvatarShares = api({ expose: true, method: "GET", path: "/avatar/:id/shares", auth: true }, async ({ id }) => {
  const auth = await authWithSharingSchema();
  await ensureAvatarOwnership(id, auth.userID);
  const shares = await loadAvatarShares(id, auth.userID);
  return { shares };
});
var shareAvatarWithContact = api({ expose: true, method: "POST", path: "/avatar/:id/share", auth: true }, async (req) => {
  throw APIError.failedPrecondition("Sharing to another account requires recipient acceptance and is not enabled yet. " + "Create an independent copy in another child profile instead.");
  const auth = await authWithSharingSchema();
  const sourceAvatar = await loadOwnedAvatarForCopy(req.id, auth.userID);
  const contact = await avatarDB.queryRow`
      SELECT id, contact_email, display_name, is_trusted, target_user_id
      FROM avatar_share_contacts
      WHERE id = ${req.contactId}
        AND owner_user_id = ${auth.userID}
      LIMIT 1
    `;
  if (!contact) {
    throw APIError.notFound("Share contact not found");
  }
  const resolvedTargetUser = contact.target_user_id ? {
    id: contact.target_user_id,
    email: normalizeEmail(contact.contact_email) ?? contact.contact_email,
    name: null
  } : await resolveUserByEmail(contact.contact_email);
  if (!resolvedTargetUser?.id) {
    throw APIError.failedPrecondition("The contact must have a registered Talea account before receiving a copy.");
  }
  if (resolvedTargetUser.id === auth.userID) {
    throw APIError.invalidArgument("You cannot copy an avatar to your own account via contact sharing.");
  }
  const targetProfile = await ensureDefaultProfileForUser(resolvedTargetUser.id, resolvedTargetUser.name ?? contact.display_name ?? contact.contact_email);
  if (contact.target_user_id !== resolvedTargetUser.id) {
    await avatarDB.exec`
        UPDATE avatar_share_contacts
        SET target_user_id = ${resolvedTargetUser.id},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${contact.id}
      `;
  }
  const now = new Date;
  let copiedAvatarId = null;
  let copiedAvatarName = null;
  let copiedToProfileId = null;
  let alreadyCopied = false;
  const existingCopy = await avatarDB.queryRow`
      SELECT copied_avatar_id, copied_profile_id
      FROM avatar_shares
      WHERE avatar_id = ${req.id}
        AND owner_user_id = ${auth.userID}
        AND contact_id = ${contact.id}
      LIMIT 1
    `;
  if (existingCopy?.copied_avatar_id) {
    const existingAvatar = await avatarDB.queryRow`
        SELECT id, user_id, profile_id, name
        FROM avatars
        WHERE id = ${existingCopy.copied_avatar_id}
        LIMIT 1
      `;
    if (existingAvatar && existingAvatar.user_id === resolvedTargetUser.id) {
      copiedAvatarId = existingAvatar.id;
      copiedAvatarName = existingAvatar.name;
      copiedToProfileId = existingAvatar.profile_id || targetProfile.id;
      alreadyCopied = true;
    }
  }
  if (!copiedAvatarId) {
    copiedAvatarId = crypto.randomUUID();
    copiedToProfileId = targetProfile.id;
    copiedAvatarName = sourceAvatar.name;
    const defaultTraits = getDefaultPersonalityTraits();
    await avatarDB.exec`
        INSERT INTO avatars (
          id,
          user_id,
          profile_id,
          name,
          description,
          physical_traits,
          personality_traits,
          image_url,
          visual_profile,
          creation_type,
          is_public,
          source_type,
          source_avatar_id,
          original_avatar_id,
          created_at,
          updated_at,
          inventory,
          skills
        )
        VALUES (
          ${copiedAvatarId},
          ${resolvedTargetUser.id},
          ${targetProfile.id},
          ${sourceAvatar.name},
          ${sourceAvatar.description},
          ${sourceAvatar.physical_traits},
          ${JSON.stringify(defaultTraits)},
          ${sourceAvatar.image_url},
          ${sourceAvatar.visual_profile},
          ${sourceAvatar.creation_type},
          FALSE,
          'clone',
          ${sourceAvatar.id},
          ${sourceAvatar.original_avatar_id || sourceAvatar.id},
          ${now},
          ${now},
          '[]',
          '[]'
        )
      `;
  }
  await avatarDB.exec`
      INSERT INTO avatar_shares (
        id,
        avatar_id,
        owner_user_id,
        contact_id,
        target_email,
        target_user_id,
        copied_avatar_id,
        copied_profile_id,
        last_copied_at,
        created_at,
        updated_at
      ) VALUES (
        ${crypto.randomUUID()},
        ${req.id},
        ${auth.userID},
        ${contact.id},
        ${contact.contact_email},
        ${resolvedTargetUser.id},
        ${copiedAvatarId},
        ${copiedToProfileId},
        ${now},
        ${now},
        ${now}
      )
      ON CONFLICT (avatar_id, contact_id)
      DO UPDATE SET
        target_email = EXCLUDED.target_email,
        target_user_id = EXCLUDED.target_user_id,
        copied_avatar_id = EXCLUDED.copied_avatar_id,
        copied_profile_id = EXCLUDED.copied_profile_id,
        last_copied_at = EXCLUDED.last_copied_at,
        updated_at = EXCLUDED.updated_at
    `;
  const shares = await loadAvatarShares(req.id, auth.userID);
  const share = shares.find((entry) => entry.contactId === req.contactId);
  if (!share) {
    throw APIError.internal("Share could not be loaded");
  }
  if (!copiedAvatarId || !copiedToProfileId || !copiedAvatarName) {
    throw APIError.internal("Avatar copy metadata could not be determined");
  }
  return {
    share,
    copiedAvatarId,
    copiedToProfileId,
    copiedAvatarName,
    alreadyCopied
  };
});
var unshareAvatarFromContact = api({ expose: true, method: "DELETE", path: "/avatar/:id/share/:contactId", auth: true }, async ({ id, contactId }) => {
  const auth = await authWithSharingSchema();
  await ensureAvatarOwnership(id, auth.userID);
  await avatarDB.exec`
      DELETE FROM avatar_shares
      WHERE avatar_id = ${id}
        AND contact_id = ${contactId}
        AND owner_user_id = ${auth.userID}
    `;
  return { success: true };
});
export {
  upsertShareContact,
  unshareAvatarFromContact,
  suggestShareContacts,
  shareAvatarWithContact,
  listShareContacts,
  listAvatarShares,
  deleteShareContact
};
