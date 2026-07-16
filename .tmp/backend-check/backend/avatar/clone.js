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

// backend/avatar/clone.ts
import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";
import { getDefaultPersonalityTraits } from "../constants/personalityTraits";
import { buildAvatarImageUrlForClient } from "../helpers/image-proxy";
import { ensureDefaultProfileForUser, resolveRequestedProfileId } from "../helpers/profiles";
import { ensureAvatarColumns, normalizeAvatarRole } from "./schema";
async function mapAvatarRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id || undefined,
    name: row.name,
    description: row.description || undefined,
    physicalTraits: JSON.parse(row.physical_traits),
    personalityTraits: JSON.parse(row.personality_traits),
    imageUrl: await buildAvatarImageUrlForClient(row.id, row.image_url || undefined),
    visualProfile: row.visual_profile ? JSON.parse(row.visual_profile) : undefined,
    creationType: row.creation_type,
    isPublic: row.is_public,
    avatarRole: normalizeAvatarRole(row.avatar_role),
    sourceType: row.source_type || "clone",
    sourceAvatarId: row.source_avatar_id || undefined,
    originalAvatarId: row.original_avatar_id || undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    inventory: row.inventory ? JSON.parse(row.inventory) : [],
    skills: row.skills ? JSON.parse(row.skills) : []
  };
}
var cloneToProfile = api({ expose: true, method: "POST", path: "/avatar/:id/clone-to-profile", auth: true }, async (req) => {
  let __stack = [];
  try {
    const auth = getAuthData();
    await ensureAvatarColumns();
    const targetProfileId = await resolveRequestedProfileId({
      userId: auth.userID,
      requestedProfileId: req.targetProfileId
    });
    const source = await avatarDB.queryRow`
      SELECT
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
        avatar_role,
        source_avatar_id,
        original_avatar_id
      FROM avatars
      WHERE id = ${req.id}
      LIMIT 1
    `;
    if (!source) {
      throw APIError.notFound("Source avatar not found");
    }
    const ownAvatar = source.user_id === auth.userID;
    const defaultProfile = await ensureDefaultProfileForUser(auth.userID, auth.email ?? undefined);
    if (!ownAvatar && !source.is_public) {
      throw APIError.permissionDenied("Avatar is not available for cloning");
    }
    if (normalizeAvatarRole(source.avatar_role) === "child") {
      throw APIError.failedPrecondition("A dedicated child avatar cannot be copied to another profile.");
    }
    if (ownAvatar && (source.profile_id || defaultProfile.id) === targetProfileId) {
      throw APIError.failedPrecondition("This avatar already belongs to the selected child profile.");
    }
    const rootAvatarId = source.original_avatar_id || source.source_avatar_id || source.id;
    const tx = __using(__stack, await avatarDB.begin(), 1);
    const cloneLockKey = `avatar-clone:${auth.userID}:${targetProfileId}:${rootAvatarId}`;
    await tx.rawQueryRow("SELECT pg_advisory_xact_lock(hashtextextended($1, 0)) IS NOT NULL AS locked", cloneLockKey);
    const existingCopy = await tx.queryRow`
      SELECT *
      FROM avatars
      WHERE user_id = ${auth.userID}
        AND profile_id = ${targetProfileId}
        AND avatar_role <> 'child'
        AND (
          source_avatar_id = ${source.id}
          OR original_avatar_id = ${rootAvatarId}
        )
      ORDER BY created_at ASC
      LIMIT 1
    `;
    if (existingCopy) {
      await tx.commit();
      return mapAvatarRow(existingCopy);
    }
    const cloneId = crypto.randomUUID();
    const now = new Date;
    const defaultTraits = getDefaultPersonalityTraits();
    await tx.exec`
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
        avatar_role,
        source_avatar_id,
        original_avatar_id,
        created_at,
        updated_at,
        inventory,
        skills
      )
      VALUES (
        ${cloneId},
        ${auth.userID},
        ${targetProfileId},
        ${req.name?.trim() || source.name},
        ${source.description},
        ${source.physical_traits},
        ${JSON.stringify(defaultTraits)},
        ${source.image_url},
        ${source.visual_profile},
        ${source.creation_type},
        FALSE,
        'clone',
        'companion',
        ${source.id},
        ${source.original_avatar_id || source.id},
        ${now},
        ${now},
        '[]',
        '[]'
      )
    `;
    const created = await tx.queryRow`
      SELECT *
      FROM avatars
      WHERE id = ${cloneId}
      LIMIT 1
    `;
    if (!created) {
      throw APIError.internal("Failed to load cloned avatar");
    }
    await tx.commit();
    return mapAvatarRow(created);
  } catch (_catch) {
    var _err = _catch, _hasErr = 1;
  } finally {
    var _promise = __callDispose(__stack, _err, _hasErr);
    _promise && await _promise;
  }
});
var listPoolTemplates = api({ expose: true, method: "GET", path: "/avatar/pool", auth: true }, async () => {
  await ensureAvatarColumns();
  await avatarDB.exec`
      CREATE TABLE IF NOT EXISTS avatar_pool_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        physical_traits TEXT NOT NULL,
        personality_traits TEXT NOT NULL,
        image_url TEXT,
        visual_profile TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
  const rows = await avatarDB.queryAll`
      SELECT id, name, description, physical_traits, personality_traits, image_url, visual_profile, is_active
      FROM avatar_pool_templates
      WHERE is_active = TRUE
      ORDER BY created_at DESC
    `;
  const templates = await Promise.all(rows.map(async (row) => ({
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    imageUrl: await buildAvatarImageUrlForClient(row.id, row.image_url || undefined)
  })));
  return { templates };
});
var adoptPoolTemplate = api({ expose: true, method: "POST", path: "/avatar/pool/:templateId/adopt", auth: true }, async (req) => {
  const auth = getAuthData();
  await ensureAvatarColumns();
  const targetProfileId = await resolveRequestedProfileId({
    userId: auth.userID,
    requestedProfileId: req.targetProfileId
  });
  const template = await avatarDB.queryRow`
      SELECT id, name, description, physical_traits, personality_traits, image_url, visual_profile, is_active
      FROM avatar_pool_templates
      WHERE id = ${req.templateId}
        AND is_active = TRUE
      LIMIT 1
    `;
  if (!template) {
    throw APIError.notFound("Pool template not found");
  }
  const id = crypto.randomUUID();
  const now = new Date;
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
        avatar_role,
        source_avatar_id,
        original_avatar_id,
        created_at,
        updated_at,
        inventory,
        skills
      )
      VALUES (
        ${id},
        ${auth.userID},
        ${targetProfileId},
        ${req.name?.trim() || template.name},
        ${template.description},
        ${template.physical_traits},
        ${JSON.stringify(defaultTraits)},
        ${template.image_url},
        ${template.visual_profile},
        'ai-generated',
        FALSE,
        'pool',
        'companion',
        ${template.id},
        NULL,
        ${now},
        ${now},
        '[]',
        '[]'
      )
    `;
  const created = await avatarDB.queryRow`
      SELECT *
      FROM avatars
      WHERE id = ${id}
      LIMIT 1
    `;
  if (!created) {
    throw APIError.internal("Failed to create avatar from template");
  }
  return mapAvatarRow(created);
});
export {
  listPoolTemplates,
  cloneToProfile,
  adoptPoolTemplate
};
