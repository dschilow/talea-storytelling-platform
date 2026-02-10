import { api, APIError } from "encore.dev/api";
import type { PersonalityTraits } from "./avatar";
import { upgradePersonalityTraits } from "./upgradePersonalityTraits";
import { avatarDB } from "./db";
import {
  evaluateProgressionEvents,
  type AvatarProgressionSummary,
  type MasteryTier,
  type PerkUnlockEvent,
  type QuestUnlockEvent,
} from "./progression";

interface TraitChange {
  trait: string;
  change: number;
  description?: string;
}

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

const BASE_TRAITS = new Set([
  "knowledge",
  "creativity",
  "vocabulary",
  "courage",
  "curiosity",
  "teamwork",
  "empathy",
  "persistence",
  "logic",
]);

function applyDiminishingReturns(currentValue: number, rawChange: number): number {
  if (rawChange <= 0) return rawChange;
  const scaleFactor = Math.max(0.12, 1 - currentValue / 220);
  return Math.max(1, Math.round(rawChange * scaleFactor));
}

function parseTraitValue(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, raw);
  }
  if (raw && typeof raw === "object") {
    const candidate = (raw as { value?: unknown }).value;
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return Math.max(0, candidate);
    }
  }
  return 0;
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

function mergeDuplicateChanges(changes: TraitChange[]): TraitChange[] {
  const merged = new Map<string, TraitChange>();

  for (const change of changes) {
    if (!change.trait || !Number.isFinite(change.change) || change.change === 0) {
      continue;
    }

    const existing = merged.get(change.trait);
    if (!existing) {
      merged.set(change.trait, { ...change });
      continue;
    }

    existing.change += change.change;
    existing.description = [existing.description, change.description]
      .filter(Boolean)
      .join("; ");
    merged.set(change.trait, existing);
  }

  return Array.from(merged.values());
}

export const updatePersonality = api(
  { expose: true, method: "POST", path: "/avatar/personality" },
  async (req: UpdatePersonalityRequest): Promise<UpdatePersonalityResponse> => {
    const { id } = req;
    const mergedChanges = mergeDuplicateChanges(req.changes || []);

    if (mergedChanges.length === 0) {
      throw APIError.invalidArgument("No valid trait changes provided.");
    }

    const existingAvatar = await avatarDB.queryRow<{
      id: string;
      personality_traits: string;
    }>`
      SELECT id, personality_traits FROM avatars WHERE id = ${id}
    `;

    if (!existingAvatar) {
      throw APIError.notFound("Avatar not found");
    }

    const currentTraitsRaw = JSON.parse(existingAvatar.personality_traits);
    const currentTraits = upgradePersonalityTraits(currentTraitsRaw);
    const previousTraits = JSON.parse(JSON.stringify(currentTraits)) as PersonalityTraits;
    const updatedTraits = JSON.parse(JSON.stringify(currentTraits)) as PersonalityTraits;
    const mutableTraits = updatedTraits as unknown as Record<string, unknown>;
    const appliedChanges: TraitChange[] = [];

    for (const change of mergedChanges) {
      const traitId = change.trait;
      const defaultDescription =
        change.description ||
        `Entwicklung durch ${req.contentType || "Inhalt"}: ${req.contentTitle || "Unbekannt"}`;

      if (traitId.includes(".")) {
        const [baseKey, subcategory] = traitId.split(".");
        if (!baseKey || !subcategory || !BASE_TRAITS.has(baseKey)) {
          continue;
        }

        const baseTrait = mutableTraits[baseKey];
        if (typeof baseTrait === "number" || !baseTrait || typeof baseTrait !== "object") {
          mutableTraits[baseKey] = {
            value: parseTraitValue(baseTrait),
            subcategories: {},
          };
        }

        const baseTraitObject = mutableTraits[baseKey] as {
          value: number;
          subcategories?: Record<string, number>;
        };

        if (!baseTraitObject.subcategories || typeof baseTraitObject.subcategories !== "object") {
          baseTraitObject.subcategories = {};
        }

        const currentSubcategoryValue = Math.max(
          0,
          baseTraitObject.subcategories[subcategory] || 0
        );
        const maxValue = 1000;
        const nextSubcategoryValue = Math.max(
          0,
          Math.min(maxValue, currentSubcategoryValue + change.change)
        );

        baseTraitObject.subcategories[subcategory] = nextSubcategoryValue;

        const subcategoryTotal = Object.values(baseTraitObject.subcategories).reduce(
          (sum, value) => sum + Math.max(0, value),
          0
        );
        baseTraitObject.value = Math.max(baseTraitObject.value || 0, subcategoryTotal);

        const actualChange = nextSubcategoryValue - currentSubcategoryValue;
        if (actualChange !== 0) {
          appliedChanges.push({
            trait: traitId,
            change: actualChange,
            description: defaultDescription,
          });
        }
        continue;
      }

      if (!BASE_TRAITS.has(traitId)) {
        continue;
      }

      const currentTraitValue = parseTraitValue(
        mutableTraits[traitId]
      );
      const effectiveChange = applyDiminishingReturns(currentTraitValue, change.change);
      const maxValue = traitId === "knowledge" ? 1000 : 250;
      const nextValue = Math.max(
        0,
        Math.min(maxValue, currentTraitValue + effectiveChange)
      );

      const currentRaw = mutableTraits[traitId];
      if (typeof currentRaw === "number" || !currentRaw || typeof currentRaw !== "object") {
        mutableTraits[traitId] = {
          value: nextValue,
          subcategories: {},
        };
      } else {
        (currentRaw as { value: number }).value = nextValue;
      }

      const actualChange = nextValue - currentTraitValue;
      if (actualChange !== 0) {
        appliedChanges.push({
          trait: traitId,
          change: actualChange,
          description: defaultDescription,
        });
      }
    }

    await avatarDB.exec`
      UPDATE avatars
      SET personality_traits = ${JSON.stringify(updatedTraits)},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    const rawStats = await avatarDB.queryRow<{
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
