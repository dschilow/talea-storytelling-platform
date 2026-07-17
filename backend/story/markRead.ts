import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { getAuthData } from "~encore/auth";
import { avatar } from "~encore/clients";
import { InventoryItem, Skill } from "../avatar/avatar";
import { recordStoryArtifact } from "./artifact-matcher";
import {
  extractPendingArtifactReference,
  extractStoredAvatarIds,
  extractStoryConfigAvatarIds,
  resolveCompletionAvatarIds,
} from "./artifact-reward-utils";
import {
  SHARDS_PER_CHOICE,
  addJournalEntry,
  countJourneys,
  findCompletedSetGrants,
  getOwnedPoolIdsByAvatar,
  getStoryArtifactState,
  grantArtifactToAvatar,
  grantShardsForStory,
  journeysUntilNextLevel,
  levelForJourneys,
  setInventoryArtifactLevel,
} from "./artifact-treasury";
import { buildArtifactImageUrlForClient } from "../helpers/image-proxy";
import {
  assertProfilesBelongToUser,
  ensureDefaultProfileForUser,
  getProfileForUser,
  resolveRequestedProfileId,
} from "../helpers/profiles";
import {
  buildTopicId,
  inferDomainFromStoryGenre,
  trackCosmosReadEvent,
} from "../helpers/cosmos-tracking";
import { runWithCompletionClaim } from "../helpers/completion-claim";
import { getAssignedDevelopmentForAvatar } from "./avatar-development-assignment";

const avatarDB = SQLDatabase.named("avatar");
const storyDB = SQLDatabase.named("story");
async function claimStoryProgression(avatarId: string, storyId: string): Promise<boolean> {
  const claim = await avatarDB.queryRow<{ id: string }>`
    INSERT INTO avatar_completion_reward_claims (avatar_id, content_type, content_id)
    VALUES (${avatarId}, 'story', ${storyId})
    ON CONFLICT (avatar_id, content_type, content_id) DO NOTHING
    RETURNING id
  `;
  return Boolean(claim);
}

async function releaseStoryProgressionClaim(avatarId: string, storyId: string): Promise<void> {
  await avatarDB.exec`
    DELETE FROM avatar_completion_reward_claims
    WHERE avatar_id = ${avatarId}
      AND content_type = 'story'
      AND content_id = ${storyId}
  `;
}

interface MarkStoryReadRequest {
  storyId: string;
  storyTitle: string;
  genre?: string;
  profileId?: string;
  participantProfileIds?: string[];
  avatarId?: string;
  avatarIds?: string[];
}

interface MarkStoryReadResponse {
  success: boolean;
  updatedAvatars: number;
  memorySaved: boolean;
  memoriesCreated: number;
  personalityChanges: Array<{
    avatarName: string;
    changes: Array<{ trait: string; change: number; description: string }>;
    appliedChanges?: Array<{ trait: string; change: number; oldValue?: number; newValue?: number }>;
    masteryEvents?: Array<{
      trait: string;
      oldTier: string;
      newTier: string;
      newTierLevel: number;
      currentValue: number;
    }>;
    perkUnlocks?: Array<{
      id: string;
      title: string;
      rarity: "core" | "rare" | "epic";
      description: string;
    }>;
    questUnlocks?: Array<{
      id: string;
      title: string;
      reward: string;
    }>;
    questProgress?: Array<{
      id: string;
      title: string;
      progress: number;
      target: number;
      status: "active" | "completed";
    }>;
    rewards?: {
      newItems: InventoryItem[];
      upgradedItems: InventoryItem[];
      newSkills: Skill[];
    };
  }>;
  unlockedArtifact?: {
    id: string;
    name: string;
    description: string;
    category: string;
    rarity: string;
    emoji?: string;
    visualKeywords: string[];
    imageUrl?: string;
  };
  /**
   * Schatzkammer 2.0 economy: per-avatar treasure outcome of this completion.
   * Exactly one of the reward shapes applies per avatar and story:
   * a fresh artifact (see unlockedArtifact), a Fundstück (shard), or — for
   * brought artifacts — a journey entry that can level the artifact up.
   */
  treasureRewards?: {
    shardsForChoice: number;
    perAvatar: Array<{
      avatarId: string;
      avatarName: string;
      shardsEarned: number;
      shardBalance: number;
      choiceReady: boolean;
      journey?: {
        artifactId: string;
        artifactName: string;
        emoji?: string;
        imageUrl?: string;
        journeys: number;
        level: number;
        leveledUp: boolean;
        journeysUntilNextLevel?: number;
        nextLevel?: number;
      };
      completedSets: Array<{
        setId: string;
        setName: string;
        setEmoji?: string;
        crown: {
          id: string;
          name: string;
          description: string;
          category: string;
          rarity: string;
          emoji?: string;
          imageUrl?: string;
        };
      }>;
    }>;
  };
}

interface StoryChange {
  trait: string;
  change: number;
  description: string;
}
function parseStoredDevelopments(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function buildStoryMemoryExperience(params: {
  avatarName: string;
  storyTitle: string;
  genre?: string;
  changes: StoryChange[];
}): string {
  const details = Array.from(
    new Set(
      params.changes
        .map((change) => String(change.description || "").replace(/\s+/g, " ").trim())
        .filter(Boolean),
    ),
  )
    .slice(0, 2)
    .join(" ")
    .slice(0, 320);
  if (details) {
    return `${params.avatarName} erinnert sich an "${params.storyTitle}": ${details}`;
  }
  const genreHint = params.genre ? ` (${params.genre})` : "";
  return `${params.avatarName} hat die Geschichte "${params.storyTitle}"${genreHint} erlebt.`;
}



export const markRead = api<MarkStoryReadRequest, MarkStoryReadResponse>(
  { expose: true, method: "POST", path: "/story/mark-read", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const userId = auth.userID;
    const activeProfileId = await resolveRequestedProfileId({
      userId,
      requestedProfileId: req.profileId,
      fallbackName: auth.email ?? undefined,
    });
    const defaultProfile = await ensureDefaultProfileForUser(userId, auth.email ?? undefined);
    const extraProfiles = Array.from(
      new Set(
        (req.participantProfileIds || [])
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      )
    );
    const validatedProfiles = extraProfiles.length > 0
      ? await assertProfilesBelongToUser(userId, extraProfiles)
      : [];
    const targetProfileIds = Array.from(new Set([activeProfileId, ...validatedProfiles]));
    const profileIdsForAvatarSelection = targetProfileIds;

    const storyOwner = await storyDB.queryRow<{
      user_id: string;
      is_public: boolean;
      config: unknown;
      avatar_developments: string | null;
    }>`
      SELECT user_id, is_public, config, avatar_developments
      FROM stories
      WHERE id = ${req.storyId}
      LIMIT 1
    `;
    if (!storyOwner) {
      throw APIError.notFound("Story not found.");
    }
    const storedAvatarDevelopments = storyOwner.user_id === userId
      ? parseStoredDevelopments(storyOwner.avatar_developments)
      : [];
    if (storyOwner && storyOwner.user_id !== userId && auth.role !== "admin" && !storyOwner.is_public) {
      throw APIError.permissionDenied("You do not have permission to update this story.");
    }
    if (storyOwner && storyOwner.user_id === userId && auth.role !== "admin" && !storyOwner.is_public) {
      const participant = await storyDB.queryRow<{ profile_id: string }>`
        SELECT profile_id
        FROM story_participants
        WHERE story_id = ${req.storyId}
          AND profile_id = ${activeProfileId}
        LIMIT 1
      `;
      const hasParticipants = await storyDB.queryRow<{ has_any: boolean }>`
        SELECT EXISTS (
          SELECT 1 FROM story_participants WHERE story_id = ${req.storyId}
        ) AS has_any
      `;
      if (hasParticipants?.has_any && !participant) {
        throw APIError.permissionDenied("Story belongs to another child profile.");
      }
    }

    console.log(`Story finished by user ${userId}: "${req.storyTitle}"`);

    let userAvatars: { id: string; name: string; profile_id: string | null }[] = [];
    const clientRequestedAvatarIds = Array.from(
      new Set([
        ...(req.avatarIds || []),
        ...(req.avatarId ? [req.avatarId] : []),
      ].filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0))
    );
    const participantRowsForTargets = await storyDB.queryAll<{ avatar_ids: unknown }>`
      SELECT avatar_ids
      FROM story_participants
      WHERE story_id = ${req.storyId}
        AND profile_id = ANY(${targetProfileIds})
      ORDER BY created_at ASC
    `;
    const participantAvatarIds = participantRowsForTargets.flatMap((row) =>
      extractStoredAvatarIds(row.avatar_ids)
    );
    const completionAvatarIds = resolveCompletionAvatarIds({
      requestedAvatarIds: clientRequestedAvatarIds,
      participantAvatarIds,
      configAvatarIds: extractStoryConfigAvatarIds(storyOwner.config),
      hasParticipantRecord: participantRowsForTargets.length > 0,
    });

    const includeLegacyUnscoped = profileIdsForAvatarSelection.includes(defaultProfile.id);
    if (completionAvatarIds.length > 0) {
      userAvatars = await avatarDB.queryAll<{ id: string; name: string; profile_id: string | null }>`
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
        const fallbackAvatar = await avatarDB.queryRow<{ id: string; name: string; profile_id: string | null }>`
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
        if (fallbackAvatar) userAvatars = [fallbackAvatar];
      }
    }
    if (userAvatars.length === 0) {
      return {
        success: true,
        updatedAvatars: 0,
        personalityChanges: [],
        memorySaved: false,
        memoriesCreated: 0,
      };
    }
    const developmentEligibleAvatars = userAvatars.map(({ id: avatarId, name }) => ({
      id: avatarId,
      name,
    }));

    const personalityChanges: MarkStoryReadResponse["personalityChanges"] = [];
    let updatedCount = 0;

    for (const userAvatar of userAvatars) {
      try {

        const avatarRow = await avatarDB.queryRow<{ personality_traits: string; inventory: string }>`
          SELECT personality_traits, inventory
          FROM avatars
          WHERE id = ${userAvatar.id}
        `;

        const assignedDevelopment = getAssignedDevelopmentForAvatar({
          developments: storedAvatarDevelopments,
          eligibleAvatars: developmentEligibleAvatars,
          avatarId: userAvatar.id,
        });
        const changes: StoryChange[] = assignedDevelopment?.changedTraits.length
          ? assignedDevelopment.changedTraits
          : buildStoryReadChanges(
              req, userAvatar.id, avatarRow?.personality_traits ?? "{}",
            );
        if (changes.length === 0) {
          continue;
        }

        const progression = await runWithCompletionClaim({
          claim: () => claimStoryProgression(userAvatar.id, req.storyId),
          apply: () =>
            avatar.updatePersonality({
              id: userAvatar.id,
              changes,
              storyId: req.storyId,
              contentTitle: req.storyTitle,
              contentType: "story",
            }),
          release: () => releaseStoryProgressionClaim(userAvatar.id, req.storyId),
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
                changes,
              }),
              emotionalImpact: "positive",
              personalityChanges: changes,
              developmentDescription: `Persoenlichkeitsentwicklung: ${changes.map((item) => item.description).join(", ")}`,
              contentType: "story",
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
              changes,
            }),
            emotionalImpact: "positive",
            personalityChanges: changes,
            developmentDescription: `Persoenlichkeitsentwicklung: ${changes.map((item) => item.description).join(", ")}`,
            contentType: "story",
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
            label: req.genre || req.storyTitle,
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
            summary: `Story gelesen: ${req.storyTitle}`,
          });
        } catch (trackingError) {
          console.warn("Failed to track cosmos story-read event", trackingError);
        }

        let rewards: MarkStoryReadResponse["personalityChanges"][number]["rewards"] | undefined = undefined;
        try {
          await using rewardTx = await avatarDB.begin();
          const lockedAvatar = await rewardTx.queryRow<{ inventory: string }>`
            SELECT inventory FROM avatars WHERE id = ${userAvatar.id} FOR UPDATE
          `;
          if (!lockedAvatar) {
            throw APIError.notFound("Avatar not found while updating rewards");
          }
          const inventory: InventoryItem[] = JSON.parse(lockedAvatar.inventory || "[]");
          const storyTags = req.genre ? [req.genre.toLowerCase()] : ["adventure"];
          const upgradedItems: InventoryItem[] = [];

          for (const item of inventory) {
            const hasTagMatch = item.tags?.some((tag) => storyTags.includes(tag)) ?? false;
            if (hasTagMatch && item.level < 3) {
              item.level += 1;
              const baseName = item.name.replace(/^(Novice|Advanced|Master)\s+/, "");
              if (item.level === 2) item.name = `Advanced ${baseName}`;
              if (item.level === 3) item.name = `Master ${baseName}`;
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
              newSkills: [],
            };
          }
          await rewardTx.commit();
        } catch (rewardError) {
          console.error(`Failed reward update for ${userAvatar.name}`, rewardError);
        }

        personalityChanges.push({
          avatarName: userAvatar.name,
          changes,
          appliedChanges: personalityResult.appliedChanges.map((entry) => ({
            trait: entry.trait,
            change: entry.change,
          })),
          masteryEvents: personalityResult.masteryEvents.map((entry) => ({
            trait: entry.trait,
            oldTier: entry.oldTier.name,
            newTier: entry.newTier.name,
            newTierLevel: entry.newTier.level,
            currentValue: entry.newValue,
          })),
          perkUnlocks: (personalityResult.perkUnlocks || []).map((entry) => ({
            id: entry.id,
            title: entry.title,
            rarity: entry.rarity,
            description: entry.description,
          })),
          questUnlocks: (personalityResult.questUnlocks || []).map((entry) => ({
            id: entry.id,
            title: entry.title,
            reward: entry.reward,
          })),
          questProgress: (personalityResult.questProgress || []).map((entry) => ({
            id: entry.id,
            title: entry.title,
            progress: entry.progress,
            target: entry.target,
            status: entry.status,
          })),
          rewards,
        });

        updatedCount += 1;
      } catch (error) {
        console.error(`Failed to update avatar ${userAvatar.name}`, error);
      }
    }

    let unlockedArtifact: MarkStoryReadResponse["unlockedArtifact"] | undefined;
    let memoriesCreated = 0;
    for (const userAvatar of userAvatars) {
      try {
        const memory = await avatarDB.queryRow<{ id: string }>`
          SELECT id FROM avatar_memories
          WHERE avatar_id = ${userAvatar.id}
            AND content_type = 'story'
            AND story_id = ${req.storyId}
          LIMIT 1
        `;

        if (memory) memoriesCreated += 1;
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
        personalityChanges: [],
      };
    }

    let treasureRewards: MarkStoryReadResponse["treasureRewards"];
    try {
      // 1) Resolve the story's artifact assignment (with the historical
      //    metadata-recovery path for stories whose junction write failed).
      let artifactState = await getStoryArtifactState(req.storyId);
      if (!artifactState) {
        const storyMeta = await storyDB.queryRow<{ metadata: unknown }>`
          SELECT metadata FROM stories WHERE id = ${req.storyId} LIMIT 1
        `;
        const pending = extractPendingArtifactReference(storyMeta?.metadata);
        if (pending) {
          await recordStoryArtifact(
            req.storyId,
            pending.artifactId,
            pending.discoveryChapter,
            pending.usageChapter
          );
          artifactState = await getStoryArtifactState(req.storyId);
        }
      }

      const ownedBefore = await getOwnedPoolIdsByAvatar(userAvatars.map((entry) => entry.id));
      const perAvatar: NonNullable<MarkStoryReadResponse["treasureRewards"]>["perAvatar"] = [];

      const artifact = artifactState?.artifact;
      const broughtBy = artifactState?.broughtByAvatarId || null;
      const resolvedArtifactImageUrl = artifact
        ? (await buildArtifactImageUrlForClient(artifact.id, artifact.imageUrl)) ?? artifact.imageUrl
        : undefined;

      // 2) Mitnehmen-Loop: the journey counts for the owner's artifact even
      //    when someone else finishes the story first (idempotent journal).
      let journeyReward: { journeys: number; level: number; leveledUp: boolean } | null = null;
      if (artifact && broughtBy) {
        const journeyAdded = await addJournalEntry({
          avatarId: broughtBy,
          artifactId: artifact.id,
          storyId: req.storyId,
          storyTitle: req.storyTitle,
          event: "journey",
          note: `Reiste mit durch "${req.storyTitle}".`,
        });
        const journeys = await countJourneys(broughtBy, artifact.id);
        const level = levelForJourneys(journeys);
        const updatedItem = await setInventoryArtifactLevel(broughtBy, artifact.id, level);
        if (updatedItem) {
          await addJournalEntry({
            avatarId: broughtBy,
            artifactId: artifact.id,
            storyId: req.storyId,
            storyTitle: req.storyTitle,
            event: "levelup",
            note: `Nach ${journeys} Reisen auf Stufe ${level} gestiegen!`,
          });
        }
        journeyReward = { journeys, level, leveledUp: Boolean(updatedItem) };
        void journeyAdded;
      }

      // 3) Per-avatar reward: fresh artifact (only when the story genuinely
      //    embraced it and it was not brought along), otherwise a Fundstück.
      let grantedToAtLeastOneAvatar = false;
      for (const userAvatar of userAvatars) {
        const alreadyOwns = ownedBefore.get(userAvatar.id)?.has(artifact?.id || "") ?? false;
        const shouldAwardArtifact = Boolean(artifact) && !broughtBy && !alreadyOwns;

        let shardsEarned = 0;
        let shardBalance = 0;

        if (shouldAwardArtifact && artifact) {
          try {
            const added = await grantArtifactToAvatar({
              artifact,
              avatarId: userAvatar.id,
              storyId: req.storyId,
              storyTitle: req.storyTitle,
              imageUrl: resolvedArtifactImageUrl,
              journalEvent: "found",
              journalNote: `Gefunden in "${req.storyTitle}".`,
            });
            if (added) grantedToAtLeastOneAvatar = true;
          } catch (inventoryError) {
            console.error(`Failed to add unlocked artifact for ${userAvatar.name}`, inventoryError);
          }
        } else {
          // Fundstück: idempotent per (avatar, story).
          const grant = await grantShardsForStory(userAvatar.id, req.storyId, 1);
          shardsEarned = grant.granted ? 1 : 0;
          shardBalance = grant.shards;
        }

        perAvatar.push({
          avatarId: userAvatar.id,
          avatarName: userAvatar.name,
          shardsEarned,
          shardBalance,
          choiceReady: shardBalance >= SHARDS_PER_CHOICE,
          journey:
            broughtBy === userAvatar.id && artifact && journeyReward
              ? {
                  artifactId: artifact.id,
                  artifactName: artifact.name.de || artifact.name.en,
                  emoji: artifact.emoji,
                  imageUrl: resolvedArtifactImageUrl,
                  journeys: journeyReward.journeys,
                  level: journeyReward.level,
                  leveledUp: journeyReward.leveledUp,
                  ...(journeysUntilNextLevel(journeyReward.journeys)
                    ? {
                        journeysUntilNextLevel: journeysUntilNextLevel(journeyReward.journeys)!.missing,
                        nextLevel: journeysUntilNextLevel(journeyReward.journeys)!.nextLevel,
                      }
                    : {}),
                }
              : undefined,
          completedSets: [],
        });
      }

      // 4) Set completion: crowns are granted when every other member of a
      //    set is owned. Checked AFTER the awards above.
      const ownedAfter = await getOwnedPoolIdsByAvatar(userAvatars.map((entry) => entry.id));
      for (const entry of perAvatar) {
        const owned = ownedAfter.get(entry.avatarId);
        if (!owned || owned.size === 0) continue;
        const setGrants = await findCompletedSetGrants(owned);
        for (const setGrant of setGrants) {
          const crownImageUrl =
            (await buildArtifactImageUrlForClient(setGrant.crown.id, setGrant.crown.imageUrl)) ??
            setGrant.crown.imageUrl;
          const added = await grantArtifactToAvatar({
            artifact: setGrant.crown,
            avatarId: entry.avatarId,
            storyId: req.storyId,
            storyTitle: req.storyTitle,
            imageUrl: crownImageUrl,
            journalEvent: "set_crown",
            journalNote: `Belohnung für das vollendete Set "${setGrant.setNameDe}".`,
          });
          if (!added) continue;
          entry.completedSets.push({
            setId: setGrant.setId,
            setName: setGrant.setNameDe,
            setEmoji: setGrant.setEmoji,
            crown: {
              id: setGrant.crown.id,
              name: setGrant.crown.name.de || setGrant.crown.name.en,
              description: setGrant.crown.description.de || setGrant.crown.description.en,
              category: setGrant.crown.category,
              rarity: setGrant.crown.rarity,
              emoji: setGrant.crown.emoji,
              imageUrl: crownImageUrl,
            },
          });
        }
      }

      // 5) Mark the story artifact as unlocked (display state).
      if (artifactState && !artifactState.isUnlocked) {
        await storyDB.exec`
          UPDATE story_artifacts
          SET is_unlocked = TRUE, unlocked_at = NOW()
          WHERE story_id = ${req.storyId} AND is_unlocked = FALSE
        `;
      }

      if (grantedToAtLeastOneAvatar && artifact) {
        unlockedArtifact = {
          id: artifact.id,
          name: artifact.name.de,
          description: artifact.description.de,
          category: artifact.category,
          rarity: artifact.rarity,
          emoji: artifact.emoji,
          visualKeywords: artifact.visualKeywords,
          imageUrl: resolvedArtifactImageUrl,
        };
      }

      treasureRewards = { shardsForChoice: SHARDS_PER_CHOICE, perAvatar };
    } catch (artifactError) {
      console.error("Failed to process treasure rewards", artifactError);
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
      treasureRewards,
      memorySaved: memoriesCreated > 0,
      memoriesCreated,
    };
  }
);

function getPersonalityDisplayName(traitId: string): string {
  const displayNames: Record<string, string> = {
    creativity: "Kreativitaet",
    courage: "Mut",
    empathy: "Empathie",
    curiosity: "Neugier",
    teamwork: "Teamgeist",
    persistence: "Ausdauer",
    logic: "Logik",
    vocabulary: "Wortschatz",
  };

  return displayNames[traitId] || traitId;
}

function inferPersonalityTrait(genre?: string): string {
  if (!genre) return "empathy";

  const value = genre.toLowerCase();
  const map: Array<{ keywords: string[]; trait: string }> = [
    { keywords: ["fantasy", "magie", "zauber", "fee", "drache"], trait: "creativity" },
    { keywords: ["abenteuer", "reise", "expedition", "herausforderung", "kampf"], trait: "courage" },
    { keywords: ["freundschaft", "familie", "liebe", "gemeinschaft"], trait: "empathy" },
    { keywords: ["wissenschaft", "raetsel", "geheimnis", "detektiv"], trait: "curiosity" },
    { keywords: ["tier", "natur", "umwelt", "wald"], trait: "empathy" },
    { keywords: ["humor", "komoedie", "lustig"], trait: "creativity" },
    { keywords: ["problem", "loesung", "ausdauer", "durchhalten"], trait: "persistence" },
    { keywords: ["maerchen", "weisheit", "lehre", "moral"], trait: "vocabulary" },
    { keywords: ["team", "zusammen", "gemeinsam", "helfen"], trait: "teamwork" },
    { keywords: ["logik", "denken", "strategie", "plan"], trait: "logic" },
  ];

  for (const entry of map) {
    if (entry.keywords.some((keyword) => value.includes(keyword))) {
      return entry.trait;
    }
  }
  return "empathy";
}

function buildStoryReadChanges(
  req: MarkStoryReadRequest,
  avatarId: string,
  personalityTraitsRaw: string
): StoryChange[] {
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
    "frage",
  ]);

  const variation = (stableHash(`${req.storyId}:${avatarId}`) % 3) - 1;

  const primaryCurrent = getTraitValue(traits, primaryTrait);
  const primaryPenalty = primaryCurrent >= 85 ? 2 : primaryCurrent >= 65 ? 1 : 0;
  const primaryPoints = clamp(3 + Math.min(2, complexityHits) + variation - primaryPenalty, 1, 6);

  const secondaryCurrent = getTraitValue(traits, secondaryTrait);
  const secondaryPenalty = secondaryCurrent >= 90 ? 1 : 0;
  const secondaryPoints = clamp(1 + (complexityHits >= 2 ? 1 : 0) - secondaryPenalty, 1, 3);

  const reflectionTrait = inferReflectionTrait(context, primaryTrait, secondaryTrait);
  const reflectionCurrent = reflectionTrait ? getTraitValue(traits, reflectionTrait) : 0;
  const reflectionPoints = reflectionTrait
    ? clamp((complexityHits >= 1 ? 1 : 0) + (variation > 0 ? 1 : 0) - (reflectionCurrent >= 92 ? 1 : 0), 0, 2)
    : 0;

  const changes: StoryChange[] = [
    {
      trait: primaryTrait,
      change: primaryPoints,
      description: `+${primaryPoints} ${getPersonalityDisplayName(primaryTrait)} durch Geschichte "${req.storyTitle}"`,
    },
    {
      trait: secondaryTrait,
      change: secondaryPoints,
      description: `+${secondaryPoints} ${getPersonalityDisplayName(secondaryTrait)} durch Reflexion der Handlung`,
    },
  ];

  if (reflectionTrait && reflectionPoints > 0) {
    changes.push({
      trait: reflectionTrait,
      change: reflectionPoints,
      description: `+${reflectionPoints} ${getPersonalityDisplayName(reflectionTrait)} durch Schluesselmomente der Geschichte`,
    });
  }

  return mergeStoryChanges(changes);
}

function inferReflectionTrait(context: string, primaryTrait: string, secondaryTrait: string): string | null {
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

function parseTraits(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function getTraitValue(traits: Record<string, unknown>, traitId: string): number {
  const raw = traits[traitId];
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, raw);
  }
  if (raw && typeof raw === "object" && typeof (raw as { value?: unknown }).value === "number") {
    const value = (raw as { value: number }).value;
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }
  return 0;
}

function mergeStoryChanges(changes: StoryChange[]): StoryChange[] {
  const merged = new Map<string, StoryChange>();

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

function countKeywordMatches(source: string, keywords: string[]): number {
  return keywords.reduce((count, keyword) => (source.includes(keyword) ? count + 1 : count), 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}
