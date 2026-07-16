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

// backend/doku/markRead.ts
import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { getAuthData } from "~encore/auth";
import { avatar } from "~encore/clients";
import {
  assertProfilesBelongToUser,
  ensureDefaultProfileForUser,
  getProfileForUser,
  resolveRequestedProfileId
} from "../helpers/profiles";
import {
  buildTopicId,
  inferDomainFromDokuTopic,
  trackCosmosReadEvent
} from "../helpers/cosmos-tracking";
import { runWithCompletionClaim } from "../helpers/completion-claim";
var avatarDB = SQLDatabase.named("avatar");
var dokuDB = SQLDatabase.named("doku");
async function claimDokuProgression(avatarId, dokuId) {
  const claim = await avatarDB.queryRow`
    INSERT INTO avatar_completion_reward_claims (avatar_id, content_type, content_id)
    VALUES (${avatarId}, 'doku', ${dokuId})
    ON CONFLICT (avatar_id, content_type, content_id) DO NOTHING
    RETURNING id
  `;
  return Boolean(claim);
}
async function releaseDokuProgressionClaim(avatarId, dokuId) {
  await avatarDB.exec`
    DELETE FROM avatar_completion_reward_claims
    WHERE avatar_id = ${avatarId}
      AND content_type = 'doku'
      AND content_id = ${dokuId}
  `;
}
function buildDokuMemoryExperience(params) {
  const details = Array.from(new Set(params.changes.map((change) => String(change.description || "").replace(/\s+/g, " ").trim()).filter(Boolean))).slice(0, 2).join(" ").slice(0, 320);
  return details ? `${params.avatarName} erinnert sich aus der Doku "${params.dokuTitle}": ${details}` : `${params.avatarName} hat in "${params.dokuTitle}" etwas \xFCber ${params.topic} gelernt.`;
}
function normalizeDomainId(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw)
    return "";
  const normalized = raw === "art" ? "arts" : raw;
  return normalized.replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").replace(/_{2,}/g, "_").slice(0, 40);
}
function uniqueAvatarIds(values) {
  return Array.from(new Set(values.filter((value) => typeof value === "string").map((value) => value.trim()).filter(Boolean)));
}
function extractStoredAvatarIds(value) {
  let decoded = value;
  if (typeof decoded === "string") {
    try {
      decoded = JSON.parse(decoded);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(decoded))
    return [];
  return uniqueAvatarIds(decoded.map((entry) => {
    if (typeof entry === "string")
      return entry;
    if (entry && typeof entry === "object" && typeof entry.id === "string") {
      return entry.id;
    }
    return;
  }));
}
async function loadProfileScopedAvatars(params) {
  if (params.avatarIds.length === 0)
    return [];
  const includeLegacyUnscoped = params.targetProfileIds.includes(params.defaultProfileId);
  const rows = await avatarDB.queryAll`
    SELECT id, name, profile_id
    FROM avatars
    WHERE user_id = ${params.userId}
      AND id = ANY(${params.avatarIds})
      AND (
        profile_id = ANY(${params.targetProfileIds})
        OR (${includeLegacyUnscoped} AND profile_id IS NULL)
      )
  `;
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  return params.avatarIds.flatMap((avatarId) => {
    const row = rowsById.get(avatarId);
    if (!row)
      return [];
    return [{
      id: row.id,
      name: row.name,
      profileId: row.profile_id || params.defaultProfileId
    }];
  });
}
var markRead = api({ expose: true, method: "POST", path: "/doku/mark-read", auth: true }, async (req) => {
  const auth = getAuthData();
  const userId = auth.userID;
  const activeProfileId = await resolveRequestedProfileId({
    userId,
    requestedProfileId: req.profileId,
    fallbackName: auth.email ?? undefined
  });
  const defaultProfile = await ensureDefaultProfileForUser(userId, auth.email ?? undefined);
  const extraProfiles = Array.from(new Set((req.participantProfileIds || []).filter((value) => typeof value === "string").map((value) => value.trim()).filter((value) => value.length > 0)));
  const validatedProfiles = extraProfiles.length > 0 ? await assertProfilesBelongToUser(userId, extraProfiles) : [];
  const targetProfileIds = Array.from(new Set([activeProfileId, ...validatedProfiles]));
  const dokuOwner = await dokuDB.queryRow`
      SELECT user_id, is_public
      FROM dokus
      WHERE id = ${req.dokuId}
      LIMIT 1
    `;
  if (!dokuOwner) {
    throw APIError.notFound("Doku not found.");
  }
  if (dokuOwner && dokuOwner.user_id !== userId && auth.role !== "admin" && !dokuOwner.is_public) {
    throw APIError.permissionDenied("You do not have permission to update this doku.");
  }
  const participantRows = dokuOwner.user_id === userId ? await dokuDB.queryAll`
          SELECT profile_id, avatar_ids
          FROM doku_participants
          WHERE doku_id = ${req.dokuId}
        ` : [];
  if (dokuOwner.user_id === userId && auth.role !== "admin" && !dokuOwner.is_public && participantRows.length > 0) {
    const allowedProfileIds = new Set(participantRows.map((row) => row.profile_id));
    if (targetProfileIds.some((profileId) => !allowedProfileIds.has(profileId))) {
      throw APIError.permissionDenied("Doku belongs to another child profile.");
    }
  }
  const participantAvatarIds = participantRows.filter((row) => targetProfileIds.includes(row.profile_id)).flatMap((row) => extractStoredAvatarIds(row.avatar_ids));
  const dokuDomainRow = await dokuDB.queryRow`
      SELECT
        (metadata::jsonb)->'configSnapshot'->>'domainId' AS domain_id,
        topic
      FROM dokus
      WHERE id = ${req.dokuId}
      LIMIT 1
    `;
  const resolvedTopicTitle = String(req.topic || "").trim() || String(dokuDomainRow?.topic || "").trim() || String(req.dokuTitle || "").trim();
  const resolvedDomainId = normalizeDomainId(dokuDomainRow?.domain_id) || normalizeDomainId(req.domainId) || inferDomainFromDokuTopic(resolvedTopicTitle, req.perspective);
  let userAvatars = [];
  const requestedAvatarIds = uniqueAvatarIds([
    ...req.avatarIds || [],
    req.avatarId
  ]);
  const completionAvatarIds = requestedAvatarIds.length > 0 ? requestedAvatarIds : uniqueAvatarIds(participantAvatarIds);
  if (completionAvatarIds.length > 0) {
    userAvatars = await loadProfileScopedAvatars({
      userId,
      avatarIds: completionAvatarIds,
      targetProfileIds,
      defaultProfileId: defaultProfile.id
    });
  }
  if (requestedAvatarIds.length > 0 && userAvatars.length !== requestedAvatarIds.length) {
    throw APIError.permissionDenied("Avatar belongs to another child profile.");
  }
  if (userAvatars.length === 0) {
    const activeProfile = await getProfileForUser({ userId, profileId: activeProfileId });
    const fallbackAvatarIds = uniqueAvatarIds([
      activeProfile.childAvatarId,
      ...activeProfile.preferredAvatarIds
    ]);
    const fallbackAvatars = await loadProfileScopedAvatars({
      userId,
      avatarIds: fallbackAvatarIds,
      targetProfileIds: [activeProfileId],
      defaultProfileId: defaultProfile.id
    });
    if (fallbackAvatars.length > 0) {
      userAvatars = [fallbackAvatars[0]];
    }
  }
  if (userAvatars.length === 0) {
    return {
      success: true,
      updatedAvatars: 0,
      personalityChanges: [],
      memorySaved: false,
      memoriesCreated: 0
    };
  }
  const personalityChanges = [];
  let updatedCount = 0;
  for (const userAvatar of userAvatars) {
    try {
      const avatarRow = await avatarDB.queryRow`
          SELECT personality_traits
          FROM avatars
          WHERE id = ${userAvatar.id}
        `;
      const changes = buildDokuReadChanges(req, userAvatar.id, avatarRow?.personality_traits ?? "{}");
      if (changes.length === 0) {
        continue;
      }
      const progression = await runWithCompletionClaim({
        claim: () => claimDokuProgression(userAvatar.id, req.dokuId),
        apply: () => avatar.updatePersonality({
          id: userAvatar.id,
          changes,
          storyId: req.dokuId,
          contentTitle: req.dokuTitle,
          contentType: "doku"
        }),
        release: () => releaseDokuProgressionClaim(userAvatar.id, req.dokuId)
      });
      if (progression.status === "duplicate") {
        await avatarDB.exec`
            INSERT INTO avatar_doku_read (avatar_id, doku_id, doku_title)
            VALUES (${userAvatar.id}, ${req.dokuId}, ${req.dokuTitle})
            ON CONFLICT (avatar_id, doku_id) DO NOTHING
          `;
        try {
          await avatar.addMemory({
            id: userAvatar.id,
            storyId: req.dokuId,
            storyTitle: req.dokuTitle,
            experience: buildDokuMemoryExperience({
              avatarName: userAvatar.name,
              dokuTitle: req.dokuTitle,
              topic: req.topic,
              changes
            }),
            emotionalImpact: "positive",
            personalityChanges: changes,
            developmentDescription: `Wissensentwicklung: ${changes.map((item) => item.description).join(", ")}`,
            contentType: "doku"
          });
        } catch (memoryError) {
          console.warn(`Failed to repair doku memory for ${userAvatar.name}`, memoryError);
        }
        continue;
      }
      const personalityResult = progression.value;
      await avatarDB.exec`
          INSERT INTO avatar_doku_read (avatar_id, doku_id, doku_title)
          VALUES (${userAvatar.id}, ${req.dokuId}, ${req.dokuTitle})
          ON CONFLICT (avatar_id, doku_id) DO NOTHING
        `;
      try {
        await avatar.addMemory({
          id: userAvatar.id,
          storyId: req.dokuId,
          storyTitle: req.dokuTitle,
          experience: buildDokuMemoryExperience({
            avatarName: userAvatar.name,
            dokuTitle: req.dokuTitle,
            topic: req.topic,
            changes
          }),
          emotionalImpact: "positive",
          personalityChanges: changes,
          developmentDescription: `Wissensentwicklung: ${changes.map((item) => item.description).join(", ")}`,
          contentType: "doku"
        });
      } catch (memoryError) {
        console.warn(`Failed to store doku memory for ${userAvatar.name}`, memoryError);
      }
      try {
        const topicId = buildTopicId({
          sourceContentType: "doku",
          sourceContentId: req.dokuId,
          domainId: resolvedDomainId,
          label: resolvedTopicTitle
        });
        await trackCosmosReadEvent({
          avatarId: userAvatar.id,
          profileId: userAvatar.profileId,
          sourceContentId: req.dokuId,
          sourceContentType: "doku",
          domainId: resolvedDomainId,
          topicId,
          contentTitle: req.dokuTitle,
          topicTitle: resolvedTopicTitle,
          summary: `Doku gelesen: ${req.dokuTitle}`
        });
      } catch (trackingError) {
        console.warn("Failed to track cosmos doku-read event", trackingError);
      }
      personalityChanges.push({
        avatarName: userAvatar.name,
        changes,
        appliedChanges: personalityResult.appliedChanges.map((entry) => ({
          trait: entry.trait,
          change: entry.change
        })),
        masteryEvents: personalityResult.masteryEvents.map((entry) => ({
          trait: entry.trait,
          oldTier: entry.oldTier.name,
          newTier: entry.newTier.name,
          newTierLevel: entry.newTier.level,
          currentValue: entry.newValue
        })),
        perkUnlocks: (personalityResult.perkUnlocks || []).map((entry) => ({
          id: entry.id,
          title: entry.title,
          rarity: entry.rarity,
          description: entry.description
        })),
        questUnlocks: (personalityResult.questUnlocks || []).map((entry) => ({
          id: entry.id,
          title: entry.title,
          reward: entry.reward
        })),
        questProgress: (personalityResult.questProgress || []).map((entry) => ({
          id: entry.id,
          title: entry.title,
          progress: entry.progress,
          target: entry.target,
          status: entry.status
        }))
      });
      updatedCount += 1;
    } catch (error) {
      console.error(`Failed to update doku progression for ${userAvatar.name}`, error);
    }
  }
  let memoriesCreated = 0;
  for (const userAvatar of userAvatars) {
    try {
      const memory = await avatarDB.queryRow`
          SELECT id FROM avatar_memories
          WHERE avatar_id = ${userAvatar.id}
            AND content_type = 'doku'
            AND story_id = ${req.dokuId}
          LIMIT 1
        `;
      if (memory)
        memoriesCreated += 1;
    } catch (memoryCheckError) {
      console.warn("Could not confirm stored doku memory", memoryCheckError);
    }
  }
  if (updatedCount === 0 && memoriesCreated === 0) {
    return {
      success: false,
      updatedAvatars: 0,
      memorySaved: false,
      memoriesCreated: 0,
      personalityChanges: []
    };
  }
  for (const profileId of targetProfileIds) {
    await dokuDB.exec`
        INSERT INTO doku_profile_state (
          profile_id,
          doku_id,
          progress_pct,
          completion_state,
          last_played_at,
          updated_at
        )
        VALUES (
          ${profileId},
          ${req.dokuId},
          100,
          'completed',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (profile_id, doku_id) DO UPDATE
        SET progress_pct = GREATEST(doku_profile_state.progress_pct, 100),
            completion_state = 'completed',
            last_played_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
      `;
  }
  return {
    success: true,
    updatedAvatars: updatedCount,
    personalityChanges,
    memorySaved: memoriesCreated > 0,
    memoriesCreated
  };
});
function getKnowledgeDisplayName(knowledgeTrait) {
  const displayNames = {
    "knowledge.biology": "Biologie",
    "knowledge.history": "Geschichte",
    "knowledge.physics": "Physik",
    "knowledge.geography": "Geografie",
    "knowledge.astronomy": "Astronomie",
    "knowledge.mathematics": "Mathematik",
    "knowledge.chemistry": "Chemie"
  };
  return displayNames[knowledgeTrait] || knowledgeTrait.split(".")[1] || "Wissen";
}
function inferKnowledgeSubcategory(topic, perspective) {
  const value = `${topic} ${perspective ?? ""}`.toLowerCase();
  const map = [
    { keywords: ["bio", "tier", "pflanz", "zoo", "mensch", "koerper", "leben"], id: "knowledge.biology" },
    { keywords: ["geschichte", "histor", "antike", "mittelalter", "krieg", "kultur", "pyramiden"], id: "knowledge.history" },
    { keywords: ["physik", "kraft", "energie", "bewegung", "elektr", "licht", "atom"], id: "knowledge.physics" },
    { keywords: ["erde", "karte", "kontinent", "geografie", "ocean", "meer", "berg"], id: "knowledge.geography" },
    { keywords: ["stern", "planet", "weltall", "galax", "kosmos", "astronom", "mond"], id: "knowledge.astronomy" },
    { keywords: ["mathe", "zahl", "rechnen", "geometr", "bruch", "plus", "minus"], id: "knowledge.mathematics" },
    { keywords: ["chemie", "stoff", "reaktion", "element", "molekuel", "labor"], id: "knowledge.chemistry" }
  ];
  for (const entry of map) {
    if (entry.keywords.some((keyword) => value.includes(keyword))) {
      return entry.id;
    }
  }
  return "knowledge.history";
}
function buildDokuReadChanges(req, avatarId, personalityTraitsRaw) {
  const traits = parseTraits(personalityTraitsRaw);
  const knowledgeTrait = inferKnowledgeSubcategory(req.topic, req.perspective);
  const context = `${req.topic} ${req.perspective ?? ""} ${req.dokuTitle}`.toLowerCase();
  const variation = stableHash(`${req.dokuId}:${avatarId}`) % 2;
  const depthSignals = countKeywordMatches(context, [
    "warum",
    "wie",
    "zusammenhang",
    "ursache",
    "modell",
    "experiment",
    "vergleich",
    "analyse",
    "perspektive",
    "fakten"
  ]);
  const knowledgeCurrent = getKnowledgeSubcategoryValue(traits, knowledgeTrait);
  const knowledgePenalty = knowledgeCurrent >= 130 ? 2 : knowledgeCurrent >= 90 ? 1 : 0;
  const knowledgePoints = clamp(2 + Math.min(2, depthSignals) + variation - knowledgePenalty, 1, 5);
  const curiosityCurrent = getTraitValue(traits, "curiosity");
  const curiosityPenalty = curiosityCurrent >= 90 ? 1 : 0;
  const curiosityPoints = clamp(1 + (depthSignals >= 2 ? 1 : 0) - curiosityPenalty, 1, 3);
  const supportTrait = inferDokuSupportTrait(context);
  const supportCurrent = supportTrait ? getTraitValue(traits, supportTrait) : 0;
  const supportPoints = supportTrait ? clamp((depthSignals >= 1 ? 1 : 0) + variation - (supportCurrent >= 92 ? 1 : 0), 0, 2) : 0;
  const changes = [
    {
      trait: knowledgeTrait,
      change: knowledgePoints,
      description: `+${knowledgePoints} ${getKnowledgeDisplayName(knowledgeTrait)} durch Doku "${req.dokuTitle}"`
    },
    {
      trait: "curiosity",
      change: curiosityPoints,
      description: `+${curiosityPoints} Neugier durch vertiefte Doku-Lektuere`
    }
  ];
  if (supportTrait && supportPoints > 0) {
    changes.push({
      trait: supportTrait,
      change: supportPoints,
      description: `+${supportPoints} ${getSupportDisplayName(supportTrait)} durch Transfer des Gelernten`
    });
  }
  return mergeDokuChanges(changes);
}
function inferDokuSupportTrait(context) {
  if (/(mathe|physik|modell|analyse|logik|beweis)/.test(context)) {
    return "logic";
  }
  if (/(sprache|begriff|vokabel|definition|erklaer)/.test(context)) {
    return "vocabulary";
  }
  if (/(team|gruppe|zusammen|gesellschaft|kultur)/.test(context)) {
    return "teamwork";
  }
  return null;
}
function getSupportDisplayName(traitId) {
  const labels = {
    logic: "Logik",
    vocabulary: "Wortschatz",
    teamwork: "Teamgeist"
  };
  return labels[traitId] || traitId;
}
function parseTraits(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}
function getTraitValue(traits, traitId) {
  const raw = traits[traitId];
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, raw);
  }
  if (raw && typeof raw === "object" && typeof raw.value === "number") {
    const value = raw.value;
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }
  return 0;
}
function getKnowledgeSubcategoryValue(traits, traitId) {
  const [baseKey, subcategory] = traitId.split(".");
  if (!baseKey || !subcategory) {
    return 0;
  }
  const baseTrait = traits[baseKey];
  if (!baseTrait || typeof baseTrait !== "object") {
    return 0;
  }
  const rawSubcategories = baseTrait.subcategories;
  if (!rawSubcategories || typeof rawSubcategories !== "object") {
    return 0;
  }
  const rawValue = rawSubcategories[subcategory];
  if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
    return 0;
  }
  return Math.max(0, rawValue);
}
function mergeDokuChanges(changes) {
  const merged = new Map;
  for (const change of changes) {
    if (!change.trait || !Number.isFinite(change.change) || change.change <= 0) {
      continue;
    }
    const existing = merged.get(change.trait);
    if (!existing) {
      merged.set(change.trait, { ...change });
      continue;
    }
    existing.change += change.change;
    existing.description = `${existing.description}; ${change.description}`;
    merged.set(change.trait, existing);
  }
  return Array.from(merged.values());
}
function countKeywordMatches(source, keywords) {
  return keywords.reduce((count, keyword) => source.includes(keyword) ? count + 1 : count, 0);
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function stableHash(value) {
  let hash = 0;
  for (let index = 0;index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}
export {
  markRead
};
