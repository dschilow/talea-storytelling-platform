import { describe, expect, test } from "bun:test";

import {
  assignAvatarDevelopmentIds,
  getAssignedDevelopmentForAvatar,
} from "./avatar-development-assignment";

const avatars = [
  { id: "alexander-profile", name: "Alexander" },
  { id: "adrian-profile", name: "Adrian" },
];

describe("avatar development assignment", () => {
  test("uses avatarId before a conflicting display name", () => {
    expect(assignAvatarDevelopmentIds([
      {
        avatarId: "adrian-profile",
        name: "Alexander",
        changedTraits: [{ trait: "courage", change: 3, description: "Adrian war mutig." }],
      },
    ], avatars)).toEqual([
      {
        avatarId: "adrian-profile",
        name: "Adrian",
        changedTraits: [{ trait: "courage", change: 3, description: "Adrian war mutig." }],
      },
    ]);
  });

  test("never redirects an explicit unknown id by matching its name", () => {
    expect(assignAvatarDevelopmentIds([
      {
        avatarId: "avatar-from-another-profile",
        name: "Alexander",
        changedTraits: [{ trait: "empathy", change: 2 }],
      },
    ], avatars)).toEqual([]);
  });

  test("supports a unique legacy name-only development", () => {
    expect(getAssignedDevelopmentForAvatar({
      developments: [
        {
          avatarName: "  ALEXANDER ",
          updates: [{ trait: "teamwork", change: 2, description: "Er half der Gruppe." }],
        },
      ],
      eligibleAvatars: avatars,
      avatarId: "alexander-profile",
    })).toEqual({
      avatarId: "alexander-profile",
      name: "Alexander",
      changedTraits: [{ trait: "teamwork", change: 2, description: "Er half der Gruppe." }],
    });
  });

  test("rejects ambiguous legacy names across profile-local avatar copies", () => {
    const duplicateParents = [
      { id: "papa-alexander", name: "Papa" },
      { id: "papa-adrian", name: "Papa" },
    ];
    expect(assignAvatarDevelopmentIds([
      {
        name: "Papa",
        changedTraits: [{ trait: "logic", change: 2, description: "Papa loeste das Raetsel." }],
      },
    ], duplicateParents)).toEqual([]);
  });

  test("normalizes legacy object changes and caps unsafe point values", () => {
    expect(assignAvatarDevelopmentIds([
      {
        avatarId: "alexander-profile",
        changedTraits: {
          courage: { before: 10, after: 99, reason: "Er stellte sich der Gefahr." },
          "knowledge.biology": { change: 99, reason: "Er erkannte die Spuren." },
          unknown: { change: 9 },
        },
      },
    ], avatars)[0]?.changedTraits).toEqual([
      { trait: "courage", change: 6, description: "Er stellte sich der Gefahr." },
      { trait: "knowledge.biology", change: 5, description: "Er erkannte die Spuren." },
    ]);
  });
});
