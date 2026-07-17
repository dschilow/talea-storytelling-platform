// Pure helpers of the artifact treasury ("Schatzkammer 2.0").
// No encore.dev imports here — this module must stay unit-testable with
// `bun test` (same convention as artifact-reward-utils.ts).

import type { InventoryItem } from "../avatar/avatar";

// ---------------------------------------------------------------------------
// Level track: journeys (times an artifact was brought along on a finished
// story) unlock levels. Level 1 = freshly found.
// ---------------------------------------------------------------------------

export const ARTIFACT_LEVEL_THRESHOLDS: Array<{ level: number; journeys: number }> = [
  { level: 2, journeys: 3 },
  { level: 3, journeys: 7 },
  { level: 4, journeys: 12 },
  { level: 5, journeys: 20 },
];

export function levelForJourneys(journeys: number): number {
  let level = 1;
  for (const step of ARTIFACT_LEVEL_THRESHOLDS) {
    if (journeys >= step.journeys) level = step.level;
  }
  return level;
}

export function journeysUntilNextLevel(journeys: number): { nextLevel: number; missing: number } | null {
  for (const step of ARTIFACT_LEVEL_THRESHOLDS) {
    if (journeys < step.journeys) {
      return { nextLevel: step.level, missing: step.journeys - journeys };
    }
  }
  return null;
}

export const SHARDS_PER_CHOICE = 5;
export const SHARD_OFFER_SIZE = 3;

// ---------------------------------------------------------------------------
// Inventory parsing
// ---------------------------------------------------------------------------

/**
 * Inventory item ids for pool artifacts follow the stable pattern
 * `artifact_<poolId>_<avatarId>` (see buildArtifactInventoryItem). The pool id
 * itself contains underscores, so parsing strips the known prefix and suffix.
 */
export function extractPoolIdFromInventoryItem(item: InventoryItem, avatarId: string): string | null {
  const id = String(item?.id || "");
  const prefix = "artifact_";
  const suffix = `_${avatarId}`;
  if (!id.startsWith(prefix) || !id.endsWith(suffix)) return null;
  const poolId = id.slice(prefix.length, id.length - suffix.length);
  return poolId.length > 0 ? poolId : null;
}

export function parseInventory(raw: unknown): InventoryItem[] {
  if (Array.isArray(raw)) return raw as InventoryItem[];
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
