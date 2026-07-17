// Artifact Treasury Core ("Schatzkammer 2.0")
//
// Shared domain logic for the artifact economy:
//   - ownership lookup across avatar inventories (duplicate exclusion)
//   - travel journal (Reisetagebuch) entries + journey-based level-ups
//   - Fundstücke (shards) with idempotent per-story grants
//   - set completion detection + crown rewards
//
// Used by markRead (reward flow), standard-mode-generation (casting
// exclusions / brought artifacts) and the treasury APIs.

import * as crypto from "crypto";
import { storyDB } from "./db";
import { avatarDB } from "../avatar/db";
import type { InventoryItem } from "../avatar/avatar";
import type { ArtifactTemplate } from "./types";
import { rowToArtifactTemplate } from "./artifact-matcher";
import { buildArtifactInventoryItem, appendArtifactReward } from "./artifact-reward-utils";
import { extractPoolIdFromInventoryItem, parseInventory } from "./artifact-treasury-utils";

// Pure helpers (level track, shard constants, inventory-id parsing) live in
// artifact-treasury-utils.ts so they stay unit-testable without the Encore
// runtime; re-exported here so consumers have one import surface.
export {
  ARTIFACT_LEVEL_THRESHOLDS,
  SHARDS_PER_CHOICE,
  SHARD_OFFER_SIZE,
  extractPoolIdFromInventoryItem,
  journeysUntilNextLevel,
  levelForJourneys,
} from "./artifact-treasury-utils";

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

/** Loads owned pool-artifact ids per avatar (from the avatar inventory JSON). */
export async function getOwnedPoolIdsByAvatar(avatarIds: string[]): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  const ids = Array.from(new Set(avatarIds.filter(Boolean)));
  if (ids.length === 0) return result;

  try {
    const rows = await avatarDB.queryAll<{ id: string; inventory: string }>`
      SELECT id, inventory FROM avatars WHERE id = ANY(${ids})
    `;
    for (const row of rows) {
      const owned = new Set<string>();
      for (const item of parseInventory(row.inventory)) {
        const poolId = extractPoolIdFromInventoryItem(item, row.id);
        if (poolId) owned.add(poolId);
      }
      result.set(row.id, owned);
    }
  } catch (error) {
    console.warn("[artifact-treasury] Failed to load owned artifacts:", error);
  }
  return result;
}

export async function getOwnedPoolIdsUnion(avatarIds: string[]): Promise<Set<string>> {
  const byAvatar = await getOwnedPoolIdsByAvatar(avatarIds);
  const union = new Set<string>();
  for (const owned of byAvatar.values()) {
    for (const id of owned) union.add(id);
  }
  return union;
}

/**
 * Crown artifacts are set rewards: they never drop from normal story casting
 * or shard choices. They are granted exactly once — when the set is complete.
 */
export async function loadCrownArtifactIds(): Promise<Set<string>> {
  try {
    const rows = await storyDB.queryAll<{ crown_artifact_id: string | null }>`
      SELECT crown_artifact_id FROM artifact_sets WHERE crown_artifact_id IS NOT NULL
    `;
    return new Set(rows.map((row) => row.crown_artifact_id!).filter(Boolean));
  } catch (error) {
    // Migration may not have run yet — degrade to "no crowns".
    console.warn("[artifact-treasury] Failed to load crown artifact ids:", error);
    return new Set();
  }
}

export async function loadArtifactTemplateById(artifactId: string): Promise<ArtifactTemplate | null> {
  try {
    const row = await storyDB.queryRow<any>`
      SELECT * FROM artifact_pool WHERE id = ${artifactId} LIMIT 1
    `;
    return row ? rowToArtifactTemplate(row) : null;
  } catch (error) {
    console.warn("[artifact-treasury] Failed to load artifact:", { artifactId, error });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

export type ArtifactJournalEvent = "found" | "journey" | "levelup" | "set_crown" | "shard_choice";

export async function addJournalEntry(entry: {
  avatarId: string;
  artifactId: string;
  storyId?: string | null;
  storyTitle?: string | null;
  event: ArtifactJournalEvent;
  note?: string | null;
}): Promise<boolean> {
  try {
    const id = `aj_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    if (entry.storyId) {
      const inserted = await storyDB.queryRow<{ id: string }>`
        INSERT INTO artifact_journal (id, avatar_id, artifact_id, story_id, story_title, event, note)
        VALUES (${id}, ${entry.avatarId}, ${entry.artifactId}, ${entry.storyId}, ${entry.storyTitle || null}, ${entry.event}, ${entry.note || null})
        ON CONFLICT (avatar_id, artifact_id, story_id, event) WHERE story_id IS NOT NULL
        DO NOTHING
        RETURNING id
      `;
      return Boolean(inserted);
    }
    await storyDB.exec`
      INSERT INTO artifact_journal (id, avatar_id, artifact_id, story_id, story_title, event, note)
      VALUES (${id}, ${entry.avatarId}, ${entry.artifactId}, NULL, ${entry.storyTitle || null}, ${entry.event}, ${entry.note || null})
    `;
    return true;
  } catch (error) {
    console.warn("[artifact-treasury] Failed to add journal entry:", { entry, error });
    return false;
  }
}

export async function countJourneys(avatarId: string, artifactId: string): Promise<number> {
  try {
    const row = await storyDB.queryRow<{ count: string }>`
      SELECT COUNT(*) AS count
      FROM artifact_journal
      WHERE avatar_id = ${avatarId}
        AND artifact_id = ${artifactId}
        AND event = 'journey'
    `;
    return parseInt(row?.count || "0", 10) || 0;
  } catch {
    return 0;
  }
}

export async function loadJourneyCounts(avatarId: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  try {
    const rows = await storyDB.queryAll<{ artifact_id: string; count: string }>`
      SELECT artifact_id, COUNT(*) AS count
      FROM artifact_journal
      WHERE avatar_id = ${avatarId} AND event = 'journey'
      GROUP BY artifact_id
    `;
    for (const row of rows) {
      counts.set(row.artifact_id, parseInt(row.count, 10) || 0);
    }
  } catch (error) {
    console.warn("[artifact-treasury] Failed to load journey counts:", error);
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Fundstücke (shards)
// ---------------------------------------------------------------------------

export interface ShardGrantResult {
  granted: boolean;
  shards: number;
  totalEarned: number;
}

/** Grants shards exactly once per (avatar, story) and returns the new balance. */
export async function grantShardsForStory(avatarId: string, storyId: string, amount: number): Promise<ShardGrantResult> {
  try {
    const claimed = await storyDB.queryRow<{ avatar_id: string }>`
      INSERT INTO avatar_shard_grants (avatar_id, story_id, amount)
      VALUES (${avatarId}, ${storyId}, ${amount})
      ON CONFLICT (avatar_id, story_id) DO NOTHING
      RETURNING avatar_id
    `;
    if (!claimed) {
      const balance = await getShardBalance(avatarId);
      return { granted: false, ...balance };
    }
    const row = await storyDB.queryRow<{ shards: number; total_earned: number }>`
      INSERT INTO avatar_artifact_shards (avatar_id, shards, total_earned, updated_at)
      VALUES (${avatarId}, ${amount}, ${amount}, CURRENT_TIMESTAMP)
      ON CONFLICT (avatar_id) DO UPDATE
      SET shards = avatar_artifact_shards.shards + ${amount},
          total_earned = avatar_artifact_shards.total_earned + ${amount},
          updated_at = CURRENT_TIMESTAMP
      RETURNING shards, total_earned
    `;
    return {
      granted: true,
      shards: row?.shards ?? amount,
      totalEarned: row?.total_earned ?? amount,
    };
  } catch (error) {
    console.warn("[artifact-treasury] Failed to grant shards:", { avatarId, storyId, error });
    return { granted: false, shards: 0, totalEarned: 0 };
  }
}

export async function getShardBalance(avatarId: string): Promise<{ shards: number; totalEarned: number }> {
  try {
    const row = await storyDB.queryRow<{ shards: number; total_earned: number }>`
      SELECT shards, total_earned FROM avatar_artifact_shards WHERE avatar_id = ${avatarId}
    `;
    return { shards: row?.shards ?? 0, totalEarned: row?.total_earned ?? 0 };
  } catch {
    return { shards: 0, totalEarned: 0 };
  }
}

/** Atomically spends shards; returns false when the balance is insufficient. */
export async function spendShards(avatarId: string, amount: number): Promise<boolean> {
  try {
    const row = await storyDB.queryRow<{ shards: number }>`
      UPDATE avatar_artifact_shards
      SET shards = shards - ${amount}, updated_at = CURRENT_TIMESTAMP
      WHERE avatar_id = ${avatarId} AND shards >= ${amount}
      RETURNING shards
    `;
    return Boolean(row);
  } catch (error) {
    console.warn("[artifact-treasury] Failed to spend shards:", { avatarId, amount, error });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Inventory grants + level updates (avatar DB)
// ---------------------------------------------------------------------------

export async function grantArtifactToAvatar(args: {
  artifact: ArtifactTemplate;
  avatarId: string;
  storyId: string;
  storyTitle?: string;
  imageUrl?: string;
  journalEvent?: ArtifactJournalEvent;
  journalNote?: string;
}): Promise<boolean> {
  const inventoryItem = buildArtifactInventoryItem({
    artifact: args.artifact,
    avatarId: args.avatarId,
    storyId: args.storyId,
    imageUrl: args.imageUrl,
  });

  let added = false;
  await using tx = await avatarDB.begin();
  const row = await tx.queryRow<{ inventory: string }>`
    SELECT inventory FROM avatars WHERE id = ${args.avatarId} FOR UPDATE
  `;
  if (!row) {
    await tx.commit();
    return false;
  }
  const current = parseInventory(row.inventory);
  const reward = appendArtifactReward(current, inventoryItem);
  if (reward.added) {
    await tx.exec`
      UPDATE avatars
      SET inventory = ${JSON.stringify(reward.inventory)}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${args.avatarId}
    `;
    added = true;
  }
  await tx.commit();

  if (added) {
    await addJournalEntry({
      avatarId: args.avatarId,
      artifactId: args.artifact.id,
      storyId: args.storyId,
      storyTitle: args.storyTitle,
      event: args.journalEvent || "found",
      note: args.journalNote,
    });
  }
  return added;
}

/**
 * Sets the level of an owned pool artifact in the avatar inventory JSON.
 * Returns the updated item or null when the artifact is not owned.
 */
export async function setInventoryArtifactLevel(
  avatarId: string,
  poolArtifactId: string,
  level: number
): Promise<InventoryItem | null> {
  try {
    await using tx = await avatarDB.begin();
    const row = await tx.queryRow<{ inventory: string }>`
      SELECT inventory FROM avatars WHERE id = ${avatarId} FOR UPDATE
    `;
    if (!row) {
      await tx.commit();
      return null;
    }
    const inventory = parseInventory(row.inventory);
    const expectedId = `artifact_${poolArtifactId}_${avatarId}`;
    const item = inventory.find((entry) => entry.id === expectedId);
    if (!item || (item.level || 1) >= level) {
      await tx.commit();
      return null;
    }
    item.level = level;
    await tx.exec`
      UPDATE avatars
      SET inventory = ${JSON.stringify(inventory)}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${avatarId}
    `;
    await tx.commit();
    return item;
  } catch (error) {
    console.warn("[artifact-treasury] Failed to set artifact level:", { avatarId, poolArtifactId, level, error });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Set completion
// ---------------------------------------------------------------------------

export interface CompletedSetGrant {
  setId: string;
  setNameDe: string;
  setNameEn: string;
  setEmoji?: string;
  crown: ArtifactTemplate;
}

/**
 * Finds sets that the avatar just completed: every non-crown member owned,
 * crown not owned yet. `ownedPoolIds` must reflect the CURRENT inventory
 * (including artifacts granted a moment ago).
 */
export async function findCompletedSetGrants(ownedPoolIds: Set<string>): Promise<CompletedSetGrant[]> {
  const grants: CompletedSetGrant[] = [];
  try {
    const sets = await storyDB.queryAll<{
      id: string;
      name_de: string;
      name_en: string;
      emoji: string | null;
      crown_artifact_id: string | null;
    }>`
      SELECT id, name_de, name_en, emoji, crown_artifact_id
      FROM artifact_sets
      WHERE crown_artifact_id IS NOT NULL
    `;

    for (const set of sets) {
      const crownId = set.crown_artifact_id!;
      if (ownedPoolIds.has(crownId)) continue;

      const members = await storyDB.queryAll<{ id: string }>`
        SELECT id FROM artifact_pool
        WHERE set_id = ${set.id} AND id <> ${crownId} AND is_active = TRUE
      `;
      if (members.length === 0) continue;
      const allOwned = members.every((member) => ownedPoolIds.has(member.id));
      if (!allOwned) continue;

      const crown = await loadArtifactTemplateById(crownId);
      if (!crown) continue;
      grants.push({
        setId: set.id,
        setNameDe: set.name_de,
        setNameEn: set.name_en,
        setEmoji: set.emoji || undefined,
        crown,
      });
    }
  } catch (error) {
    console.warn("[artifact-treasury] Set completion check failed:", error);
  }
  return grants;
}

// ---------------------------------------------------------------------------
// Story artifact state (assignment + Mitnehmen info)
// ---------------------------------------------------------------------------

export interface StoryArtifactState {
  artifact: ArtifactTemplate;
  presence: string;
  broughtByAvatarId: string | null;
  isUnlocked: boolean;
}

export async function getStoryArtifactState(storyId: string): Promise<StoryArtifactState | null> {
  try {
    const row = await storyDB.queryRow<any>`
      SELECT ap.*, sa.presence, sa.brought_by_avatar_id, sa.is_unlocked
      FROM story_artifacts sa
      JOIN artifact_pool ap ON sa.artifact_id = ap.id
      WHERE sa.story_id = ${storyId}
      ORDER BY sa.created_at ASC
      LIMIT 1
    `;
    if (!row) return null;
    return {
      artifact: rowToArtifactTemplate(row),
      presence: String(row.presence || "central"),
      broughtByAvatarId: row.brought_by_avatar_id || null,
      isUnlocked: Boolean(row.is_unlocked),
    };
  } catch (error) {
    console.warn("[artifact-treasury] Failed to load story artifact state:", { storyId, error });
    return null;
  }
}

/** Marks a story artifact as brought along by an avatar (Mitnehmen-Loop). */
export async function recordBroughtArtifact(args: {
  storyId: string;
  artifactId: string;
  avatarId: string;
  chapterCount: number;
}): Promise<void> {
  try {
    const id = `sa_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    await storyDB.exec`
      INSERT INTO story_artifacts (id, story_id, artifact_id, discovery_chapter, usage_chapter, is_unlocked, presence, brought_by_avatar_id, created_at)
      VALUES (${id}, ${args.storyId}, ${args.artifactId}, 1, ${Math.max(2, args.chapterCount - 1)}, FALSE, 'companion', ${args.avatarId}, NOW())
      ON CONFLICT (story_id, artifact_id) DO UPDATE SET
        presence = 'companion',
        brought_by_avatar_id = EXCLUDED.brought_by_avatar_id
    `;
  } catch (error) {
    console.warn("[artifact-treasury] Failed to record brought artifact:", { args, error });
  }
}
