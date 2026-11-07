import { describe, expect, test } from "bun:test";

import { withAppliedAmounts } from "./applied-trait-changes";

describe("withAppliedAmounts", () => {
  test("shows the points that were written, with the reason kept", () => {
    const shown = withAppliedAmounts(
      [
        { trait: "courage", change: 5, description: "Ging allein in den dunklen Keller." },
        { trait: "knowledge.history", change: 2, description: "Lernte, warum Burgen Gräben hatten." },
        { trait: "empathy", change: 3, description: "Tröstete den kleinen Drachen." },
      ],
      [
        { trait: "courage", change: 3 },
        { trait: "knowledge.history", change: 2 },
      ],
    );
    expect(shown).toEqual([
      { trait: "courage", change: 3, description: "Ging allein in den dunklen Keller." },
      { trait: "knowledge.history", change: 2, description: "Lernte, warum Burgen Gräben hatten." },
    ]);
  });

  test("a reason that names the requested amount shows the written amount", () => {
    const shown = withAppliedAmounts(
      [{ trait: "courage", change: 3, description: "+3 Mut durch Geschichte \"Der Keller\"" }],
      [{ trait: "courage", change: 2 }],
    );
    expect(shown).toEqual([
      { trait: "courage", change: 2, description: "+2 Mut durch Geschichte \"Der Keller\"" },
    ]);
  });

  test("uses the subcategory id that was written", () => {
    const shown = withAppliedAmounts(
      [{ trait: "knowledge.History", change: 2, description: "Burgen" }],
      [{ trait: "knowledge.history", change: 2 }],
    );
    expect(shown).toEqual([{ trait: "knowledge.history", change: 2, description: "Burgen" }]);
  });
});
