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
});
