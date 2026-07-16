import type { InventoryItem } from "../avatar/avatar";
import type { ArtifactTemplate } from "./types";

export interface PendingArtifactReference {
  artifactId: string;
  discoveryChapter: number;
  usageChapter: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function positiveChapter(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Reads the persisted pending-artifact pointer without trusting client input.
 * Stories historically stored metadata as either TEXT or JSONB, so both are
 * accepted. Invalid/legacy metadata deliberately produces no reward pointer.
 */
export function extractPendingArtifactReference(metadata: unknown): PendingArtifactReference | null {
  let decoded: unknown = metadata;
  if (typeof decoded === "string") {
    try {
      decoded = JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  const root = asRecord(decoded);
  const pending = asRecord(root?.pendingArtifact);
  const artifactId = typeof pending?.id === "string" ? pending.id.trim() : "";
  if (!artifactId || artifactId.length > 160) return null;

  return {
    artifactId,
    discoveryChapter: positiveChapter(pending?.discoveryChapter, 2),
    usageChapter: positiveChapter(pending?.usageChapter, 4),
  };
}

export function artifactCategoryToInventoryType(category: string): InventoryItem["type"] {
  const normalized = String(category || "").trim().toLowerCase();
  if (normalized === "weapon" || normalized === "armor") return "WEAPON";
  if (["book", "map", "knowledge"].includes(normalized)) return "KNOWLEDGE";
  if (normalized === "companion") return "COMPANION";
  return "TOOL";
}

export function buildArtifactInventoryItem(args: {
  artifact: ArtifactTemplate;
  avatarId: string;
  storyId: string;
  imageUrl?: string;
  acquiredAt?: string;
}): InventoryItem {
  const { artifact, avatarId, storyId } = args;
  return {
    id: "artifact_" + artifact.id + "_" + avatarId,
    name: artifact.name.de || artifact.name.en,
    type: artifactCategoryToInventoryType(artifact.category),
    level: 1,
    sourceStoryId: storyId,
    description: artifact.description.de || artifact.description.en,
    visualPrompt: (artifact.visualKeywords || []).join(", "),
    tags: [artifact.category, artifact.rarity].filter(Boolean),
    acquiredAt: args.acquiredAt || new Date().toISOString(),
    storyEffect: artifact.storyRole,
    imageUrl: args.imageUrl || artifact.imageUrl,
  };
}

/** Returns a new array and never mutates the caller's inventory. */
export function appendArtifactReward(
  inventory: InventoryItem[],
  reward: InventoryItem
): { inventory: InventoryItem[]; added: boolean } {
  const alreadyPresent = inventory.some((item) =>
    item.id === reward.id ||
    (Boolean(item.sourceStoryId) && item.sourceStoryId === reward.sourceStoryId)
  );
  return alreadyPresent
    ? { inventory: [...inventory], added: false }
    : { inventory: [...inventory, reward], added: true };
}
function uniqueIds(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function extractStoredAvatarIds(value: unknown): string[] {
  let decoded: unknown = value;
  if (typeof decoded === "string") {
    try {
      decoded = JSON.parse(decoded);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(decoded)) return [];

  const ids = decoded.flatMap((entry): string[] => {
    if (typeof entry === "string") return [entry];
    const record = asRecord(entry);
    return typeof record?.id === "string" ? [record.id] : [];
  });
  return uniqueIds(ids);
}

export function extractStoryConfigAvatarIds(config: unknown): string[] {
  let decoded: unknown = config;
  if (typeof decoded === "string") {
    try {
      decoded = JSON.parse(decoded);
    } catch {
      return [];
    }
  }
  const root = asRecord(decoded);
  return extractStoredAvatarIds(root?.avatarIds ?? root?.avatars);
}

export function resolveCompletionAvatarIds(args: {
  requestedAvatarIds: string[];
  participantAvatarIds: string[];
  configAvatarIds: string[];
  hasParticipantRecord?: boolean;
}): string[] {
  const requested = uniqueIds(args.requestedAvatarIds);
  const authoritative = uniqueIds(
    args.hasParticipantRecord || args.participantAvatarIds.length > 0
      ? args.participantAvatarIds
      : args.configAvatarIds
  );
  if (requested.length === 0) return authoritative;
  if (authoritative.length === 0) return args.hasParticipantRecord ? [] : requested;

  const allowed = new Set(authoritative);
  return requested.filter((id) => allowed.has(id));
}