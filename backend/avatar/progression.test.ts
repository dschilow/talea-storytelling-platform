import { describe, expect, test } from "bun:test";
import type { PersonalityTraits } from "./avatar";
import { buildAvatarProgressionSummary } from "./progression";

const zeroTraits: PersonalityTraits = {
  knowledge: { value: 0, subcategories: {} },
  creativity: { value: 0, subcategories: {} },
  vocabulary: { value: 0, subcategories: {} },
  courage: { value: 0, subcategories: {} },
  curiosity: { value: 0, subcategories: {} },
  teamwork: { value: 0, subcategories: {} },
  empathy: { value: 0, subcategories: {} },
  persistence: { value: 0, subcategories: {} },
  logic: { value: 0, subcategories: {} },
};

describe("avatar journey level", () => {
  test("starts an undiscovered avatar at level one", () => {
    const progression = buildAvatarProgressionSummary({
      traits: zeroTraits,
      stats: { storiesRead: 0, dokusRead: 0, memoryCount: 0 },
    });
    expect(progression.overallLevel).toBe(1);
  });
