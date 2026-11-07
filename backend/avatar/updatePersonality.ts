import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import type { PersonalityTraits } from "./avatar";
import { upgradePersonalityTraits } from "./upgradePersonalityTraits";
import { avatarDB } from "./db";
import { applyTraitChanges, mergeDuplicateChanges, type TraitChange } from "./apply-trait-changes";
import {
  evaluateProgressionEvents,
  type AvatarProgressionSummary,
  type MasteryTier,
  type PerkUnlockEvent,
  type QuestUnlockEvent,
} from "./progression";

interface UpdatePersonalityRequest {
  id: string;
  changes: TraitChange[];
  storyId?: string;
  contentTitle?: string;
  contentType?: "story" | "doku";
}

interface UpdatePersonalityResponse {
  success: boolean;
  updatedTraits: PersonalityTraits;
  appliedChanges: TraitChange[];
  masteryEvents: Array<{
    trait: string;
    traitDisplayName: string;
    oldTier: MasteryTier;
    newTier: MasteryTier;
    newValue: number;
  }>;
  perkUnlocks: PerkUnlockEvent[];
  questUnlocks: QuestUnlockEvent[];
  questProgress: AvatarProgressionSummary["quests"];
  progressionSummary: AvatarProgressionSummary;
}

function normalizeStatsRow(
  row: { stories_read: number; dokus_read: number; memory_count: number } | null
) {
  return {
    storiesRead: row?.stories_read ?? 0,
    dokusRead: row?.dokus_read ?? 0,
    memoryCount: row?.memory_count ?? 0,
  };
}

export const updatePersonality = api(
  { expose: false, method: "POST", path: "/avatar/personality", auth: true },
  async (req: UpdatePersonalityRequest): Promise<UpdatePersonalityResponse> => {
    const auth = getAuthData()!;
    const { id } = req;
    const mergedChanges = mergeDuplicateChanges(req.changes || []);

    if (mergedChanges.length === 0) {
      throw APIError.invalidArgument("No valid trait changes provided.");
    }

    await using tx = await avatarDB.begin();
    const existingAvatar = await tx.queryRow<{
      id: string;
      user_id: string;
      personality_traits: string;
    }>`
      SELECT id, user_id, personality_traits FROM avatars WHERE id = ${id}
      FOR UPDATE
    `;

    if (!existingAvatar) {
      throw APIError.notFound("Avatar not found");
    }


    if (existingAvatar.user_id !== auth.userID && auth.role !== "admin") {
      throw APIError.permissionDenied("You do not have permission to update this avatar.");
    }
    const currentTraitsRaw = JSON.parse(existingAvatar.personality_traits);
    const currentTraits = upgradePersonalityTraits(currentTraitsRaw);
    const previousTraits = JSON.parse(JSON.stringify(currentTraits)) as PersonalityTraits;
    const { updatedTraits, appliedChanges } = applyTraitChanges(
      currentTraits,
      mergedChanges,
      `Entwicklung durch ${req.contentType === "doku" ? "die Doku" : "die Geschichte"} „${req.contentTitle || "Unbekannt"}“`,
    );

    await tx.exec`
      UPDATE avatars
      SET personality_traits = ${JSON.stringify(updatedTraits)},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    const rawStats = await tx.queryRow<{
      stories_read: number;
      dokus_read: number;
      memory_count: number;
    }>`
      SELECT
        (SELECT COUNT(*)::int FROM avatar_story_read WHERE avatar_id = ${id}) AS stories_read,
        (SELECT COUNT(*)::int FROM avatar_doku_read WHERE avatar_id = ${id}) AS dokus_read,
        (SELECT COUNT(*)::int FROM avatar_memories WHERE avatar_id = ${id}) AS memory_count
    `;

    const previousStats = normalizeStatsRow(rawStats);
    const nextStats = {
      storiesRead:
        previousStats.storiesRead + (req.contentType === "story" ? 1 : 0),
      dokusRead: previousStats.dokusRead + (req.contentType === "doku" ? 1 : 0),
      memoryCount:
        previousStats.memoryCount + (req.contentType === "story" || req.contentType === "doku" ? 1 : 0),
    };

    const progressionEvents = evaluateProgressionEvents({
      previousTraits,
      nextTraits: updatedTraits,
      previousStats,
      nextStats,
    });

    await tx.commit();

    return {
      success: true,
      updatedTraits,
      appliedChanges,
      masteryEvents: progressionEvents.masteryEvents,
      perkUnlocks: progressionEvents.perkUnlocks,
      questUnlocks: progressionEvents.questUnlocks,
      questProgress: progressionEvents.progressionSummary.quests,
      progressionSummary: progressionEvents.progressionSummary,
    };
  }
);
