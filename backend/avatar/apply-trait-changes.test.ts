// @ts-ignore Bun exposes this runtime-only test helper without Node typings.
import { describe, expect, test } from "bun:test";

import type { PersonalityTraits } from "./avatar";
import { applyTraitChanges } from "./apply-trait-changes";
import { getDefaultPersonalityTraits } from "../constants/personalityTraits";

const FALLBACK = "Entwicklung durch die Geschichte „Test“";

function fresh(): PersonalityTraits {
  return getDefaultPersonalityTraits();
}

function trait(traits: PersonalityTraits, id: string) {
  return (traits as unknown as Record<string, { value: number; subcategories?: Record<string, number> }>)[id];
}

describe("a new avatar", () => {
  test("starts with all nine base traits at 0 and no subcategories", () => {
    const traits = fresh();
    const ids = Object.keys(traits).sort();
    expect(ids).toEqual(
      ["courage", "creativity", "curiosity", "empathy", "knowledge", "logic", "persistence", "teamwork", "vocabulary"],
    );
    for (const id of ids) {
      expect(trait(traits, id).value).toBe(0);
      expect(trait(traits, id).subcategories).toEqual({});
    }
  });
});

describe("applyTraitChanges", () => {
  test("a base update raises exactly that trait and keeps its reason", () => {
    const { updatedTraits, appliedChanges } = applyTraitChanges(
      fresh(),
      [{ trait: "persistence", change: 3, description: "Kletterte trotz Regen bis zum Gipfel." }],
      FALLBACK,
    );
    expect(trait(updatedTraits, "persistence").value).toBe(3);
    expect(trait(updatedTraits, "courage").value).toBe(0);
    expect(appliedChanges).toEqual([
      { trait: "persistence", change: 3, description: "Kletterte trotz Regen bis zum Gipfel." },
    ]);
  });

  test("knowledge.history creates the child under Wissen and Wissen grows with it", () => {
    const { updatedTraits, appliedChanges } = applyTraitChanges(
      fresh(),
      [{ trait: "knowledge.history", change: 2, description: "Lernte, warum Burgen Gräben hatten." }],
      FALLBACK,
    );
    expect(trait(updatedTraits, "knowledge").subcategories).toEqual({ history: 2 });
    expect(trait(updatedTraits, "knowledge").value).toBe(2);
    expect(appliedChanges).toEqual([
      { trait: "knowledge.history", change: 2, description: "Lernte, warum Burgen Gräben hatten." },
    ]);
  });

  test("subcategory points still count when the parent already has points of its own", () => {
    // The old max(value, sum) rollup kept Wissen at 5 here: Geschichte +2 vanished.
    const first = applyTraitChanges(fresh(), [{ trait: "knowledge", change: 5, description: "Doku" }], FALLBACK);
    expect(trait(first.updatedTraits, "knowledge").value).toBe(5);

    const second = applyTraitChanges(
      first.updatedTraits,
      [{ trait: "knowledge.history", change: 2, description: "Ritter-Doku" }],
      FALLBACK,
    );
    expect(trait(second.updatedTraits, "knowledge").value).toBe(7);
    expect(trait(second.updatedTraits, "knowledge").subcategories).toEqual({ history: 2 });
  });

  test("an existing subcategory is reused whatever the spelling", () => {
    const first = applyTraitChanges(fresh(), [{ trait: "knowledge.history", change: 2 }], FALLBACK);
    const second = applyTraitChanges(first.updatedTraits, [{ trait: "knowledge.History", change: 3 }], FALLBACK);
    expect(trait(second.updatedTraits, "knowledge").subcategories).toEqual({ history: 5 });
    expect(trait(second.updatedTraits, "knowledge").value).toBe(5);
    expect(second.appliedChanges[0].trait).toBe("knowledge.history");
  });

  test("subcategories are only created when an update names them", () => {
    const { updatedTraits } = applyTraitChanges(
      fresh(),
      [
        { trait: "courage", change: 2 },
        { trait: "courage.public_speaking", change: 1 },
      ],
      FALLBACK,
    );
    expect(trait(updatedTraits, "courage").subcategories).toEqual({ public_speaking: 1 });
    expect(trait(updatedTraits, "courage").value).toBe(3);
    expect(trait(updatedTraits, "knowledge").subcategories).toEqual({});
  });

  test("a change without its own reason gets the content's reason", () => {
    const { appliedChanges } = applyTraitChanges(fresh(), [{ trait: "empathy", change: 2 }], FALLBACK);
    expect(appliedChanges[0].description).toBe(FALLBACK);
  });

  test("unknown traits and malformed ids are ignored", () => {
    const { updatedTraits, appliedChanges } = applyTraitChanges(
      fresh(),
      [
        { trait: "strength", change: 3 },
        { trait: "knowledge.", change: 3 },
        { trait: "knowledge.a.b", change: 3 },
      ],
      FALLBACK,
    );
    expect(appliedChanges).toEqual([]);
    expect(updatedTraits).toEqual(fresh());
  });

  test("the input traits are not mutated", () => {
    const before = fresh();
    applyTraitChanges(before, [{ trait: "knowledge.biology", change: 4 }], FALLBACK);
    expect(before).toEqual(fresh());
  });
});
