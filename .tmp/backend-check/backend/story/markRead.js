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

// backend/story/markRead.ts
import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { getAuthData } from "~encore/auth";
import { avatar } from "~encore/clients";
import { unlockStoryArtifact } from "./artifact-matcher";
import {
  appendArtifactReward,
  buildArtifactInventoryItem,
  extractStoredAvatarIds,
  extractStoryConfigAvatarIds,
  resolveCompletionAvatarIds
} from "./artifact-reward-utils";
import { buildArtifactImageUrlForClient } from "../helpers/image-proxy";
import {
  assertProfilesBelongToUser,
  ensureDefaultProfileForUser,
  getProfileForUser,
  resolveRequestedProfileId
} from "../helpers/profiles";
import {
  buildTopicId,
  inferDomainFromStoryGenre,
  trackCosmosReadEvent
} from "../helpers/cosmos-tracking";
import { runWithCompletionClaim } from "../helpers/completion-claim";
import { getAssignedDevelopmentForAvatar } from "./avatar-development-assignment";
var avatarDB = SQLDatabase.named("avatar");
var storyDB = SQLDatabase.named("story");
async function claimStoryProgression(avatarId, storyId) {
  const claim = await avatarDB.queryRow`
    INSERT INTO avatar_completion_reward_claims (avatar_id, content_type, content_id)
    VALUES (${avatarId}, 'story', ${storyId})
    ON CONFLICT (avatar_id, content_type, content_id) DO NOTHING
    RETURNING id
  `;
  return Boolean(claim);
}
async function releaseStoryProgressionClaim(avatarId, storyId) {
  await avatarDB.exec`
    DELETE FROM avatar_completion_reward_claims
    WHERE avatar_id = ${avatarId}
      AND content_type = 'story'
      AND content_id = ${storyId}
  `;
}
function parseStoredDevelopments(value) {
  if (Array.isArray(value))
    return value;
  if (typeof value !== "string" || !value.trim())
    return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function buildStoryMemoryExperience(params) {
  const details = Array.from(new Set(params.changes.map((change) => String(change.description || "").replace(/\s+/g, " ").trim()).filter(Boolean))).slice(0, 2).join(" ").slice(0, 320);
  if (details) {
    return `${params.avatarName} erinnert sich an "${params.storyTitle}": ${details}`;
  }
  const genreHint = params.genre ? ` (${params.genre})` : "";
  return `${params.avatarName} hat die Geschichte "${params.storyTitle}"${genreHint} erlebt.`;
}
var markRead = api({ expose: true, method: "POST", path: "/story/mark-read", auth: true }, async (req) => {
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
  const profileIdsForAvatarSelection = targetProfileIds;
  const storyOwner = await storyDB.queryRow`
      SELECT user_id, is_public, config, avatar_developments
      FROM stories
      WHERE id = ${req.storyId}
      LIMIT 1
    `;
  if (!storyOwner) {
    throw APIError.notFound("Story not found.");
  }
  const storedAvatarDevelopments = storyOwner.user_id === userId ? parseStoredDevelopments(storyOwner.avatar_developments) : [];
  if (storyOwner && storyOwner.user_id !== userId && auth.role !== "admin" && !storyOwner.is_public) {
    throw APIError.permissionDenied("You do not have permission to update this story.");
  }
  if (storyOwner && storyOwner.user_id === userId && auth.role !== "admin" && !storyOwner.is_public) {
    const participant = await storyDB.queryRow`
        SELECT profile_id
        FROM story_participants
        WHERE story_id = ${req.storyId}
          AND profile_id = ${activeProfileId}
        LIMIT 1
      `;
    const hasParticipants = await storyDB.queryRow`
        SELECT EXISTS (
          SELECT 1 FROM story_participants WHERE story_id = ${req.storyId}
        ) AS has_any
      `;
    if (hasParticipants?.has_any && !participant) {
      throw APIError.permissionDenied("Story belongs to another child profile.");
    }
  }
  console.log(`Story finished by user ${userId}: "${req.storyTitle}"`);
  let userAvatars = [];
  const clientRequestedAvatarIds = Array.from(new Set([
    ...req.avatarIds || [],
    ...req.avatarId ? [req.avatarId] : []
  ].filter((entry) => typeof entry === "string" && entry.trim().length > 0)));
  const participantRowsForTargets = await storyDB.queryAll`
      SELECT avatar_ids
      FROM story_participants
      WHERE story_id = ${req.storyId}
        AND profile_id = ANY(${targetProfileIds})
      ORDER BY created_at ASC
    `;
  const participantAvatarIds = participantRowsForTargets.flatMap((row) => extractStoredAvatarIds(row.avatar_ids));
  const completionAvatarIds = resolveCompletionAvatarIds({
    requestedAvatarIds: clientRequestedAvatarIds,
    participantAvatarIds,
    configAvatarIds: extractStoryConfigAvatarIds(storyOwner.config),
    hasParticipantRecord: participantRowsForTargets.length > 0
  });
  const includeLegacyUnscoped = profileIdsForAvatarSelection.includes(defaultProfile.id);
  if (completionAvatarIds.length > 0) {
    userAvatars = await avatarDB.queryAll`
        SELECT a.id, a.name, a.profile_id
        FROM avatars a
        WHERE a.user_id = ${userId}
          AND a.id = ANY(${completionAvatarIds})
          AND (
            a.profile_id = ANY(${profileIdsForAvatarSelection})
            OR (${includeLegacyUnscoped} AND a.profile_id IS NULL)
          )
      `;
  }
  if (userAvatars.length === 0) {
    const activeProfile = await getProfileForUser({ userId, profileId: activeProfileId });
    const fallbackAvatarId = activeProfile.childAvatarId || activeProfile.preferredAvatarIds[0];
    if (fallbackAvatarId) {
      const fallbackAvatar = await avatarDB.queryRow`
          SELECT a.id, a.name, a.profile_id
          FROM avatars a
          WHERE a.id = ${fallbackAvatarId}
            AND a.user_id = ${userId}
            AND (
              a.profile_id = ${activeProfileId}
              OR (${activeProfileId === defaultProfile.id} AND a.profile_id IS NULL)
            )
          LIMIT 1
        `;
      if (fallbackAvatar)
        userAvatars = [fallbackAvatar];
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
  const developmentEligibleAvatars = userAvatars.map(({ id: avatarId, name }) => ({
    id: avatarId,
    name
  }));
  const personalityChanges = [];
  let updatedCount = 0;
  for (const userAvatar of userAvatars) {
    try {
      const avatarRow = await avatarDB.queryRow`
          SELECT personality_traits, inventory
          FROM avatars
          WHERE id = ${userAvatar.id}
        `;
      const assignedDevelopment = getAssignedDevelopmentForAvatar({
        developments: storedAvatarDevelopments,
        eligibleAvatars: developmentEligibleAvatars,
        avatarId: userAvatar.id
      });
      const changes = assignedDevelopment?.changedTraits.length ? assignedDevelopment.changedTraits : buildStoryReadChanges(req, userAvatar.id, avatarRow?.personality_traits ?? "{}");
      if (changes.length === 0) {
        continue;
      }
      const progression = await runWithCompletionClaim({
        claim: () => claimStoryProgression(userAvatar.id, req.storyId),
        apply: () => avatar.updatePersonality({
          id: userAvatar.id,
          changes,
          storyId: req.storyId,
          contentTitle: req.storyTitle,
          contentType: "story"
        }),
        release: () => releaseStoryProgressionClaim(userAvatar.id, req.storyId)
      });
      if (progression.status === "duplicate") {
        await avatarDB.exec`
            INSERT INTO avatar_story_read (avatar_id, story_id, story_title)
            VALUES (${userAvatar.id}, ${req.storyId}, ${req.storyTitle})
            ON CONFLICT (avatar_id, story_id) DO NOTHING
          `;
        try {
          await avatar.addMemory({
            id: userAvatar.id,
            storyId: req.storyId,
            storyTitle: req.storyTitle,
            experience: buildStoryMemoryExperience({
              avatarName: userAvatar.name,
              storyTitle: req.storyTitle,
              genre: req.genre,
              changes
            }),
            emotionalImpact: "positive",
            personalityChanges: changes,
            developmentDescription: `Persoenlichkeitsentwicklung: ${changes.map((item) => item.description).join(", ")}`,
            contentType: "story"
          });
        } catch (memoryError) {
          console.warn(`Failed to repair story memory for ${userAvatar.name}`, memoryError);
        }
        continue;
      }
      const personalityResult = progression.value;
      await avatarDB.exec`
          INSERT INTO avatar_story_read (avatar_id, story_id, story_title)
          VALUES (${userAvatar.id}, ${req.storyId}, ${req.storyTitle})
          ON CONFLICT (avatar_id, story_id) DO NOTHING
        `;
      try {
        await avatar.addMemory({
          id: userAvatar.id,
          storyId: req.storyId,
          storyTitle: req.storyTitle,
          experience: buildStoryMemoryExperience({
            avatarName: userAvatar.name,
            storyTitle: req.storyTitle,
            genre: req.genre,
            changes
          }),
          emotionalImpact: "positive",
          personalityChanges: changes,
          developmentDescription: `Persoenlichkeitsentwicklung: ${changes.map((item) => item.description).join(", ")}`,
          contentType: "story"
        });
      } catch (memoryError) {
        console.warn(`Failed to store story memory for ${userAvatar.name}`, memoryError);
      }
      try {
        const domainId = inferDomainFromStoryGenre(req.genre);
        const topicId = buildTopicId({
          sourceContentType: "story",
          sourceContentId: req.storyId,
          domainId,
          label: req.genre || req.storyTitle
        });
        await trackCosmosReadEvent({
          avatarId: userAvatar.id,
          profileId: userAvatar.profile_id || defaultProfile.id,
          sourceContentId: req.storyId,
          sourceContentType: "story",
          domainId,
          topicId,
          contentTitle: req.storyTitle,
          topicTitle: req.genre || req.storyTitle,
          summary: `Story gelesen: ${req.storyTitle}`
        });
      } catch (trackingError) {
        console.warn("Failed to track cosmos story-read event", trackingError);
      }
      let rewards = undefined;
      try {
        let __stack = [];
        try {
          const rewardTx = __using(__stack, await avatarDB.begin(), 1);
          const lockedAvatar = await rewardTx.queryRow`
            SELECT inventory FROM avatars WHERE id = ${userAvatar.id} FOR UPDATE
          `;
          if (!lockedAvatar) {
            throw APIError.notFound("Avatar not found while updating rewards");
          }
          const inventory = JSON.parse(lockedAvatar.inventory || "[]");
          const storyTags = req.genre ? [req.genre.toLowerCase()] : ["adventure"];
          const upgradedItems = [];
          for (const item of inventory) {
            const hasTagMatch = item.tags?.some((tag) => storyTags.includes(tag)) ?? false;
            if (hasTagMatch && item.level < 3) {
              item.level += 1;
              const baseName = item.name.replace(/^(Novice|Advanced|Master)\s+/, "");
              if (item.level === 2)
                item.name = `Advanced ${baseName}`;
              if (item.level === 3)
                item.name = `Master ${baseName}`;
              item.description = `Verstaerkte Version: ${item.name}. Level ${item.level}!`;
              upgradedItems.push(item);
              break;
            }
          }
          if (upgradedItems.length > 0) {
            await rewardTx.exec`
              UPDATE avatars
              SET inventory = ${JSON.stringify(inventory)},
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ${userAvatar.id}
            `;
            rewards = {
              newItems: [],
              upgradedItems,
              newSkills: []
            };
          }
          await rewardTx.commit();
        } catch (_catch) {
          var _err = _catch, _hasErr = 1;
        } finally {
          var _promise = __callDispose(__stack, _err, _hasErr);
          _promise && await _promise;
        }
      } catch (rewardError) {
        console.error(`Failed reward update for ${userAvatar.name}`, rewardError);
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
        })),
        rewards
      });
      updatedCount += 1;
    } catch (error) {
      console.error(`Failed to update avatar ${userAvatar.name}`, error);
    }
  }
  let unlockedArtifact;
  let memoriesCreated = 0;
  for (const userAvatar of userAvatars) {
    try {
      const memory = await avatarDB.queryRow`
          SELECT id FROM avatar_memories
          WHERE avatar_id = ${userAvatar.id}
            AND content_type = 'story'
            AND story_id = ${req.storyId}
          LIMIT 1
        `;
      if (memory)
        memoriesCreated += 1;
    } catch (memoryCheckError) {
      console.warn("Could not confirm stored story memory", memoryCheckError);
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
  try {
    const artifact = await unlockStoryArtifact(req.storyId);
    if (artifact) {
      const resolvedArtifactImageUrl = await buildArtifactImageUrlForClient(artifact.id, artifact.imageUrl);
      const artifactPayload = {
        id: artifact.id,
        name: artifact.name.de,
        description: artifact.description.de,
        category: artifact.category,
        rarity: artifact.rarity,
        emoji: artifact.emoji,
        visualKeywords: artifact.visualKeywords,
        imageUrl: resolvedArtifactImageUrl ?? artifact.imageUrl
      };
      let grantedToAtLeastOneAvatar = false;
      for (const userAvatar of userAvatars) {
        try {
          let __stack2 = [];
          try {
            const inventoryItem = buildArtifactInventoryItem({
              artifact,
              avatarId: userAvatar.id,
              storyId: req.storyId,
              imageUrl: artifactPayload.imageUrl
            });
            const inventoryTx = __using(__stack2, await avatarDB.begin(), 1);
            const avatarRow = await inventoryTx.queryRow`
              SELECT inventory
              FROM avatars
              WHERE id = ${userAvatar.id}
              FOR UPDATE
            `;
            if (!avatarRow) {
              continue;
            }
            const currentInventory = JSON.parse(avatarRow.inventory || "[]");
            const reward = appendArtifactReward(currentInventory, inventoryItem);
            if (reward.added) {
              await inventoryTx.exec`
                UPDATE avatars
                SET inventory = ${JSON.stringify(reward.inventory)},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${userAvatar.id}
              `;
              grantedToAtLeastOneAvatar = true;
            }
            await inventoryTx.commit();
          } catch (_catch2) {
            var _err2 = _catch2, _hasErr2 = 1;
          } finally {
            var _promise2 = __callDispose(__stack2, _err2, _hasErr2);
            _promise2 && await _promise2;
          }
        } catch (inventoryError) {
          console.error(`Failed to add unlocked artifact for ${userAvatar.name}`, inventoryError);
        }
      }
      if (grantedToAtLeastOneAvatar) {
        unlockedArtifact = artifactPayload;
      }
    }
  } catch (artifactError) {
    console.error("Failed to unlock artifact", artifactError);
  }
  for (const profileId of targetProfileIds) {
    await storyDB.exec`
        INSERT INTO story_profile_state (
          profile_id,
          story_id,
          progress_pct,
          completion_state,
          last_played_at,
          updated_at
        )
        VALUES (
          ${profileId},
          ${req.storyId},
          100,
          'completed',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (profile_id, story_id) DO UPDATE
        SET progress_pct = GREATEST(story_profile_state.progress_pct, 100),
            completion_state = 'completed',
            last_played_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
      `;
  }
  return {
    success: true,
    updatedAvatars: updatedCount,
    personalityChanges,
    unlockedArtifact,
    memorySaved: memoriesCreated > 0,
    memoriesCreated
  };
});
function getPersonalityDisplayName(traitId) {
  const displayNames = {
    creativity: "Kreativitaet",
    courage: "Mut",
    empathy: "Empathie",
    curiosity: "Neugier",
    teamwork: "Teamgeist",
    persistence: "Ausdauer",
    logic: "Logik",
    vocabulary: "Wortschatz"
  };
  return displayNames[traitId] || traitId;
}
function inferPersonalityTrait(genre) {
  if (!genre)
    return "empathy";
  const value = genre.toLowerCase();
  const map = [
    { keywords: ["fantasy", "magie", "zauber", "fee", "drache"], trait: "creativity" },
    { keywords: ["abenteuer", "reise", "expedition", "herausforderung", "kampf"], trait: "courage" },
    { keywords: ["freundschaft", "familie", "liebe", "gemeinschaft"], trait: "empathy" },
    { keywords: ["wissenschaft", "raetsel", "geheimnis", "detektiv"], trait: "curiosity" },
    { keywords: ["tier", "natur", "umwelt", "wald"], trait: "empathy" },
    { keywords: ["humor", "komoedie", "lustig"], trait: "creativity" },
    { keywords: ["problem", "loesung", "ausdauer", "durchhalten"], trait: "persistence" },
    { keywords: ["maerchen", "weisheit", "lehre", "moral"], trait: "vocabulary" },
    { keywords: ["team", "zusammen", "gemeinsam", "helfen"], trait: "teamwork" },
    { keywords: ["logik", "denken", "strategie", "plan"], trait: "logic" }
  ];
  for (const entry of map) {
    if (entry.keywords.some((keyword) => value.includes(keyword))) {
      return entry.trait;
    }
  }
  return "empathy";
}
function buildStoryReadChanges(req, avatarId, personalityTraitsRaw) {
  const traits = parseTraits(personalityTraitsRaw);
  const primaryTrait = inferPersonalityTrait(req.genre);
  const secondaryTrait = primaryTrait === "empathy" ? "teamwork" : "empathy";
  const context = `${req.storyTitle} ${req.genre ?? ""}`.toLowerCase();
  const complexityHits = countKeywordMatches(context, [
    "strategie",
    "entscheid",
    "konflikt",
    "myster",
    "lernen",
    "freund",
    "problem",
    "held",
    "mission",
    "frage"
  ]);
  const variation = stableHash(`${req.storyId}:${avatarId}`) % 3 - 1;
  const primaryCurrent = getTraitValue(traits, primaryTrait);
  const primaryPenalty = primaryCurrent >= 85 ? 2 : primaryCurrent >= 65 ? 1 : 0;
  const primaryPoints = clamp(3 + Math.min(2, complexityHits) + variation - primaryPenalty, 1, 6);
  const secondaryCurrent = getTraitValue(traits, secondaryTrait);
  const secondaryPenalty = secondaryCurrent >= 90 ? 1 : 0;
  const secondaryPoints = clamp(1 + (complexityHits >= 2 ? 1 : 0) - secondaryPenalty, 1, 3);
  const reflectionTrait = inferReflectionTrait(context, primaryTrait, secondaryTrait);
  const reflectionCurrent = reflectionTrait ? getTraitValue(traits, reflectionTrait) : 0;
  const reflectionPoints = reflectionTrait ? clamp((complexityHits >= 1 ? 1 : 0) + (variation > 0 ? 1 : 0) - (reflectionCurrent >= 92 ? 1 : 0), 0, 2) : 0;
  const changes = [
    {
      trait: primaryTrait,
      change: primaryPoints,
      description: `+${primaryPoints} ${getPersonalityDisplayName(primaryTrait)} durch Geschichte "${req.storyTitle}"`
    },
    {
      trait: secondaryTrait,
      change: secondaryPoints,
      description: `+${secondaryPoints} ${getPersonalityDisplayName(secondaryTrait)} durch Reflexion der Handlung`
    }
  ];
  if (reflectionTrait && reflectionPoints > 0) {
    changes.push({
      trait: reflectionTrait,
      change: reflectionPoints,
      description: `+${reflectionPoints} ${getPersonalityDisplayName(reflectionTrait)} durch Schluesselmomente der Geschichte`
    });
  }
  return mergeStoryChanges(changes);
}
function inferReflectionTrait(context, primaryTrait, secondaryTrait) {
  if (/(raetsel|plan|strategie|detektiv|schlussfolger)/.test(context)) {
    return "logic";
  }
  if (/(sprache|wort|dialog|erz[a-z]*hl|frage)/.test(context)) {
    return "vocabulary";
  }
  if (/(wieder|durchhalten|lange|schritt|uebung)/.test(context)) {
    return "persistence";
  }
  if (/(team|gemeinsam|gruppe|hilfe)/.test(context)) {
    return "teamwork";
  }
  const fallback = "curiosity";
  if (fallback !== primaryTrait && fallback !== secondaryTrait) {
    return fallback;
  }
  return null;
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
function mergeStoryChanges(changes) {
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
