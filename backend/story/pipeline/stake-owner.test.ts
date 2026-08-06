// @ts-ignore Bun exposes this runtime-only test helper without Node typings.
import { describe, expect, test } from "bun:test";
import { collectStakeOwnerDrift, resolveStakeOwner } from "./stake-owner";

/**
 * Verbatim planning fields of run 4848aa03 ("Das Regal mit dem schiefen
 * Knopf"). The locked idea builds the story on Alexander's fear of losing his
 * keepsake; the beat sheet one stage later hands the keepsake, the secret and
 * the decisive action to Adrian. The shipped book has Alexander holding a
 * drawer open while Adrian has the arc.
 */
const LOCKED_EMOTIONAL_ENGINE =
  "Alexander fürchtet, dass sein Lieblingsknopf nicht mehr zu ihm gehört; "
  + "Adrian zögert, eine eigene kleine Schuld zuzugeben.";

const DRIFTED_BEAT_SHEET = {
  mainWant: "Alexander will Adrians roten Lieblingsknopf vor dem Fest aus der großen roten Schublade holen und den richtigen Haken finden.",
  personalObject: {
    object: "Adrians roter Lieblingsknopf",
    whyPersonal: "Adrian hat den roten Lieblingsknopf selbst an seine Festjacke genäht und ihn wegen eines losen Fadens in die große rote Schublade gelegt.",
    risk: "Wenn Adrian weiter schweigt, folgt der rote Lieblingsknopf dem falschen Etikett.",
    payoff: "Am Ende holt Adrian ihn aus der geöffneten Schublade.",
  },
};

const HEROES = ["Alexander", "Adrian"];

describe("stake-owner contract", () => {
  test("reads the owner the locked idea named first", () => {
    expect(resolveStakeOwner(LOCKED_EMOTIONAL_ENGINE, HEROES)).toBe("Alexander");
  });

  test("catches run 4848aa03's silent hand-off to the co-protagonist", () => {
    const drift = collectStakeOwnerDrift({
      lockedEmotionalEngine: LOCKED_EMOTIONAL_ENGINE,
      beatSheet: DRIFTED_BEAT_SHEET,
      heroNames: HEROES,
    });
    expect(drift.length).toBe(1);
    expect(drift[0]).toContain("Alexander");
    expect(drift[0]).toContain("Adrian");
    // The repair must not simply flip the two — the co-protagonist keeps a stake.
    expect(drift[0]).toContain("separate visible stake");
  });

  test("stays silent when the beat sheet honours the locked owner", () => {
    expect(collectStakeOwnerDrift({
      lockedEmotionalEngine: LOCKED_EMOTIONAL_ENGINE,
      beatSheet: {
        mainWant: "Alexander will seinen roten Lieblingsknopf vor dem Fest zurückholen.",
        personalObject: {
          object: "Alexanders roter Lieblingsknopf",
          whyPersonal: "Alexander hat ihn selbst angenäht.",
        },
      },
      heroNames: HEROES,
    })).toEqual([]);
  });

  test("accepts the legacy string-shaped personalObject", () => {
    expect(collectStakeOwnerDrift({
      lockedEmotionalEngine: LOCKED_EMOTIONAL_ENGINE,
      beatSheet: { personalObject: "Adrians roter Lieblingsknopf von seiner Festjacke" },
      heroNames: HEROES,
    }).length).toBe(1);
  });

  test("says nothing when it cannot be sure", () => {
    // Single-hero story: no drift is possible.
    expect(collectStakeOwnerDrift({
      lockedEmotionalEngine: LOCKED_EMOTIONAL_ENGINE,
      beatSheet: DRIFTED_BEAT_SHEET,
      heroNames: ["Alexander"],
    })).toEqual([]);
    // Idea names no hero: a different defect, covered by the personal-object gates.
    expect(collectStakeOwnerDrift({
      lockedEmotionalEngine: "Ein Kind fürchtet, etwas Wichtiges zu verlieren.",
      beatSheet: DRIFTED_BEAT_SHEET,
      heroNames: HEROES,
    })).toEqual([]);
    // Beat sheet names no hero: nothing to compare against.
    expect(collectStakeOwnerDrift({
      lockedEmotionalEngine: LOCKED_EMOTIONAL_ENGINE,
      beatSheet: { personalObject: { object: "der rote Lieblingsknopf" }, mainWant: "" },
      heroNames: HEROES,
    })).toEqual([]);
    expect(collectStakeOwnerDrift({ heroNames: HEROES })).toEqual([]);
  });
});
