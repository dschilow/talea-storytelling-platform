// @ts-ignore Bun exposes this runtime-only test helper without Node typings.
import { describe, expect, test } from "bun:test";
import {
  BASE_TRAIT_MAX_VALUE,
  KNOWLEDGE_TRAIT_MAX_VALUE,
  SUBCATEGORY_MAX_VALUE,
  baseTraitMaxValue,
  rollUpBaseTraitValue,
  BASE_PERSONALITY_TRAITS,
} from "./personalityTraits";

describe("base trait ceilings", () => {
  test("knowledge accumulates far higher than the other base traits", () => {
    expect(baseTraitMaxValue("knowledge")).toBe(KNOWLEDGE_TRAIT_MAX_VALUE);
    expect(baseTraitMaxValue("knowledge.history")).toBe(KNOWLEDGE_TRAIT_MAX_VALUE);
    for (const trait of ["creativity", "courage", "empathy", "logic", "teamwork"]) {
      expect(baseTraitMaxValue(trait)).toBe(BASE_TRAIT_MAX_VALUE);
    }
  });

  test("trait definitions agree with the enforced ceiling", () => {
    // These used to say 100 while updatePersonality clamped at 250 — a trait
    // could sit at more than twice its own declared maximum.
    for (const definition of BASE_PERSONALITY_TRAITS) {
      expect(definition.maxValue).toBe(baseTraitMaxValue(definition.id));
      expect(definition.defaultValue).toBe(0);
    }
  });
});

describe("rollUpBaseTraitValue", () => {
  test("takes whichever is larger: the stored value or the subcategory sum", () => {
    expect(rollUpBaseTraitValue("creativity", 40, 10)).toBe(40);
    expect(rollUpBaseTraitValue("creativity", 10, 40)).toBe(40);
  });

  test("a subcategory sum can never push a base trait past its ceiling", () => {
    // The regression: awarding `courage.public_speaking` repeatedly used to
    // raise `courage` without limit, while awarding `courage` directly stopped
    // at 250. Two paths to the same number, two different ceilings.
    expect(rollUpBaseTraitValue("courage", 0, 4000)).toBe(BASE_TRAIT_MAX_VALUE);
    expect(rollUpBaseTraitValue("courage", 250, 900)).toBe(BASE_TRAIT_MAX_VALUE);
  });

  test("knowledge keeps its higher ceiling", () => {
    expect(rollUpBaseTraitValue("knowledge", 0, 900)).toBe(900);
    expect(rollUpBaseTraitValue("knowledge", 0, 5000)).toBe(KNOWLEDGE_TRAIT_MAX_VALUE);
  });

  test("never returns a negative value", () => {
    expect(rollUpBaseTraitValue("logic", -50, -20)).toBe(0);
    expect(rollUpBaseTraitValue("logic", 0, 0)).toBe(0);
  });

  test("a single subcategory at its own max still cannot exceed the base ceiling", () => {
    expect(SUBCATEGORY_MAX_VALUE).toBeGreaterThan(BASE_TRAIT_MAX_VALUE);
    expect(rollUpBaseTraitValue("empathy", 0, SUBCATEGORY_MAX_VALUE)).toBe(BASE_TRAIT_MAX_VALUE);
  });
});
