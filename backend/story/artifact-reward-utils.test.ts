import { describe, expect, test } from "bun:test";

import {
  appendArtifactReward,
  artifactCategoryToInventoryType,
  buildArtifactInventoryItem,
  extractPendingArtifactReference,
  extractStoredAvatarIds,
  extractStoryConfigAvatarIds,
  resolveCompletionAvatarIds,
} from "./artifact-reward-utils";
import type { ArtifactTemplate } from "./types";

const artifact: ArtifactTemplate = {
  id: "artifact_test",
  name: { de: "Sternenkompass", en: "Star Compass" },
  description: { de: "Zeigt den mutigsten Weg.", en: "Shows the bravest way." },
  category: "map",
  rarity: "rare",
  storyRole: "Hilft beim Orientieren.",
  discoveryScenarios: [],
  usageScenarios: [],
  visualKeywords: ["brass compass", "blue star"],
  genreAffinity: {
    adventure: 1,
    fantasy: 1,
    mystery: 1,
    nature: 1,
    friendship: 1,
    courage: 1,
    learning: 1,
  },
  recentUsageCount: 0,
  totalUsageCount: 0,
  isActive: true,
};

describe("artifact reward recovery", () => {
  test("extracts a persisted pending artifact from TEXT and JSONB shapes", () => {
    const metadata = { pendingArtifact: { id: "artifact_42", discoveryChapter: 3, usageChapter: 6 } };
    expect(extractPendingArtifactReference(metadata)).toEqual({
      artifactId: "artifact_42",
      discoveryChapter: 3,
      usageChapter: 6,
    });
    expect(extractPendingArtifactReference(JSON.stringify(metadata))).toEqual({
      artifactId: "artifact_42",
      discoveryChapter: 3,
      usageChapter: 6,
    });
  });

  test("rejects malformed metadata instead of granting an arbitrary artifact", () => {
    expect(extractPendingArtifactReference("not-json")).toBeNull();
    expect(extractPendingArtifactReference({ pendingArtifact: { id: "" } })).toBeNull();
    expect(extractPendingArtifactReference({ pendingArtifact: null })).toBeNull();
  });

  test("builds a localized inventory item and remains idempotent per story", () => {
    const reward = buildArtifactInventoryItem({
      artifact,
      avatarId: "avatar_1",
      storyId: "story_1",
      acquiredAt: "2026-07-16T10:00:00.000Z",
    });
    expect(reward.type).toBe("KNOWLEDGE");
    expect(reward.name).toBe("Sternenkompass");
    expect(reward.tags).toEqual(["map", "rare"]);

    const first = appendArtifactReward([], reward);
    expect(first.added).toBe(true);
    expect(first.inventory).toHaveLength(1);

    const duplicate = appendArtifactReward(first.inventory, { ...reward, id: "another-id" });
    expect(duplicate.added).toBe(false);
    expect(duplicate.inventory).toHaveLength(1);
  });

  test("uses persisted participants when the client omits avatar ids", () => {
    expect(extractStoredAvatarIds('["avatar_1", {"id":"avatar_2"}, "avatar_1"]')).toEqual([
      "avatar_1",
      "avatar_2",
    ]);
    expect(extractStoryConfigAvatarIds({ avatarIds: ["avatar_3"] })).toEqual(["avatar_3"]);
    expect(resolveCompletionAvatarIds({
      requestedAvatarIds: [],
      participantAvatarIds: ["avatar_1"],
      configAvatarIds: ["avatar_3"],
    })).toEqual(["avatar_1"]);
  });

  test("does not escape an explicitly empty profile participant record", () => {
    expect(resolveCompletionAvatarIds({
      requestedAvatarIds: ["avatar_from_another_profile"],
      participantAvatarIds: [],
      configAvatarIds: ["avatar_from_original_profile"],
      hasParticipantRecord: true,
    })).toEqual([]);
  });
  test("intersects client ids with the story-owned recipient set", () => {
    expect(resolveCompletionAvatarIds({
      requestedAvatarIds: ["avatar_1", "unrelated_avatar"],
      participantAvatarIds: ["avatar_1", "avatar_2"],
      configAvatarIds: [],
    })).toEqual(["avatar_1"]);
  });
  test("maps every pool category to a supported inventory type", () => {
    expect(artifactCategoryToInventoryType("weapon")).toBe("WEAPON");
    expect(artifactCategoryToInventoryType("armor")).toBe("WEAPON");
    expect(artifactCategoryToInventoryType("book")).toBe("KNOWLEDGE");
    expect(artifactCategoryToInventoryType("map")).toBe("KNOWLEDGE");
    expect(artifactCategoryToInventoryType("companion")).toBe("COMPANION");
    expect(artifactCategoryToInventoryType("magic")).toBe("TOOL");
  });
});