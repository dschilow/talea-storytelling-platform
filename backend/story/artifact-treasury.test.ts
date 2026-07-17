import { describe, expect, test } from "bun:test";
import {
  ARTIFACT_LEVEL_THRESHOLDS,
  SHARDS_PER_CHOICE,
  extractPoolIdFromInventoryItem,
  journeysUntilNextLevel,
  levelForJourneys,
} from "./artifact-treasury-utils";
import type { InventoryItem } from "../avatar/avatar";

function makeItem(id: string): InventoryItem {
  return {
    id,
    name: "Testschatz",
    type: "TOOL",
    level: 1,
    sourceStoryId: "story_1",
    description: "",
    visualPrompt: "",
    tags: [],
    acquiredAt: new Date().toISOString(),
  };
}

describe("levelForJourneys", () => {
  test("starts at level 1 with no journeys", () => {
    expect(levelForJourneys(0)).toBe(1);
    expect(levelForJourneys(2)).toBe(1);
  });

  test("levels up exactly at the documented thresholds", () => {
    expect(levelForJourneys(3)).toBe(2);
    expect(levelForJourneys(6)).toBe(2);
    expect(levelForJourneys(7)).toBe(3);
    expect(levelForJourneys(12)).toBe(4);
    expect(levelForJourneys(20)).toBe(5);
    expect(levelForJourneys(99)).toBe(5);
  });

  test("thresholds are strictly increasing", () => {
    for (let i = 1; i < ARTIFACT_LEVEL_THRESHOLDS.length; i += 1) {
      expect(ARTIFACT_LEVEL_THRESHOLDS[i].journeys).toBeGreaterThan(ARTIFACT_LEVEL_THRESHOLDS[i - 1].journeys);
      expect(ARTIFACT_LEVEL_THRESHOLDS[i].level).toBeGreaterThan(ARTIFACT_LEVEL_THRESHOLDS[i - 1].level);
    }
  });
});

describe("journeysUntilNextLevel", () => {
  test("reports missing journeys to the next level", () => {
    expect(journeysUntilNextLevel(0)).toEqual({ nextLevel: 2, missing: 3 });
    expect(journeysUntilNextLevel(2)).toEqual({ nextLevel: 2, missing: 1 });
    expect(journeysUntilNextLevel(3)).toEqual({ nextLevel: 3, missing: 4 });
    expect(journeysUntilNextLevel(19)).toEqual({ nextLevel: 5, missing: 1 });
  });

  test("returns null at max level", () => {
    expect(journeysUntilNextLevel(20)).toBeNull();
    expect(journeysUntilNextLevel(50)).toBeNull();
  });
});

describe("extractPoolIdFromInventoryItem", () => {
  test("extracts pool ids that themselves contain underscores", () => {
    const item = makeItem("artifact_artifact_080_avatar-123");
    expect(extractPoolIdFromInventoryItem(item, "avatar-123")).toBe("artifact_080");
  });

  test("ignores foreign avatar suffixes", () => {
    const item = makeItem("artifact_artifact_080_avatar-123");
    expect(extractPoolIdFromInventoryItem(item, "avatar-999")).toBeNull();
  });

  test("ignores non-pool legacy items", () => {
    expect(extractPoolIdFromInventoryItem(makeItem("random-uuid"), "avatar-123")).toBeNull();
    expect(extractPoolIdFromInventoryItem(makeItem(""), "avatar-123")).toBeNull();
  });

  test("round-trips the id format used by buildArtifactInventoryItem", () => {
    const poolId = "fallback_lucky_charm";
    const avatarId = "av_1";
    const item = makeItem(`artifact_${poolId}_${avatarId}`);
    expect(extractPoolIdFromInventoryItem(item, avatarId)).toBe(poolId);
  });
});

describe("shard economy constants", () => {
  test("five Fundstücke buy one choice", () => {
    expect(SHARDS_PER_CHOICE).toBe(5);
  });
});
