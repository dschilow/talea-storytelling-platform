// @ts-ignore Bun exposes this runtime-only test helper without Node typings.
import { describe, expect, test } from "bun:test";
import { resolveIdeaCast } from "./idea-cast";

/** Verbatim idea-lab output of run 5d8696ee. */
const C2_AUFZUG = {
  id: "c2",
  title: "Alexander und der Aufzug zum Pfannkuchen von gestern",
  oneLineHook: "Ein Wurzelkorb fährt in die gestrige Minute zurück, doch jede Fahrt nimmt Alexander eine Ausrede weg.",
  centralObjectOrPlace: "Ein alter Wurzelaufzug unter einer Pfannkuchenwiese",
  wonderRule: "Die beschriftete Taste „Hoppla“ bringt genau eine vergangene Minute zurück; nach jeder Fahrt verschwindet eine Ausrede.",
  emotionalEngine: "Alexander sucht den bequemen Rückweg zu einem peinlichen Fehler.",
  coreConflict: "Beim Fest hat er den Teig für Rosalindes Pfannkuchen vertauscht. Die Nebelhexe lockt ihn zu immer neuen Fahrten.",
  recommendedSupportingCast: ["Die Nebelhexe", "Prinzessin Rosalinde"],
};

const POOL = [
  "Stiefmutter Brunhilde", "König Wilhelm", "Zauberer Merlin", "Müller Hans",
  "Prinzessin Rosalinde", "Magierin Luna", "Händler Gustav", "Die Nebelhexe",
];

describe("idea cast contract", () => {
  test("run 5d8696ee: the audit's pick keeps its own cast, not the model's", () => {
    // The model chose c3 and named c3's cast; the deterministic audit re-picked
    // c2. Taking the model's cast gave the pancake story a cast that excluded
    // the girl whose pancakes were ruined.
    const cast = resolveIdeaCast({
      chosenCandidate: C2_AUFZUG,
      modelChosenIdeaId: "c3",
      auditChosenIdeaId: "c2",
      modelCast: ["Die Nebelhexe", "Müller Hans"],
      poolNames: POOL,
    });
    expect(cast).toContain("Prinzessin Rosalinde");
    expect(cast).not.toContain("Müller Hans");
  });

  test("the model's cast is honoured when its pick survived the audit", () => {
    expect(resolveIdeaCast({
      chosenCandidate: { ...C2_AUFZUG, coreConflict: "Die Nebelhexe lockt ihn zu neuen Fahrten." },
      modelChosenIdeaId: "c2",
      auditChosenIdeaId: "c2",
      modelCast: ["Die Nebelhexe", "Müller Hans"],
      poolNames: POOL,
    })).toEqual(["Die Nebelhexe", "Müller Hans"]);
  });

  test("a pool character the premise names is added back even to the model's own cast", () => {
    const cast = resolveIdeaCast({
      chosenCandidate: C2_AUFZUG,
      modelChosenIdeaId: "c2",
      auditChosenIdeaId: "c2",
      modelCast: ["Die Nebelhexe"],
      poolNames: POOL,
    });
    expect(cast).toEqual(["Die Nebelhexe", "Prinzessin Rosalinde"]);
  });

  test("a shared title never drags an unrelated character in", () => {
    // "Prinzessin" alone must not pull Rosalinde into a story about a king.
    const cast = resolveIdeaCast({
      chosenCandidate: {
        id: "x",
        coreConflict: "Eine Prinzessin aus einem anderen Land schickt einen Brief an König Wilhelm.",
        recommendedSupportingCast: ["König Wilhelm"],
      },
      auditChosenIdeaId: "x",
      modelChosenIdeaId: "x",
      modelCast: ["König Wilhelm"],
      poolNames: POOL,
    });
    expect(cast).toEqual(["König Wilhelm"]);
  });

  test("never grows the cast into a parade", () => {
    const cast = resolveIdeaCast({
      chosenCandidate: {
        id: "y",
        coreConflict: "Brunhilde, Wilhelm, Merlin, Hans, Rosalinde, Luna und Gustav streiten alle mit der Nebelhexe.",
        recommendedSupportingCast: ["Die Nebelhexe"],
      },
      auditChosenIdeaId: "y",
      modelChosenIdeaId: "y",
      modelCast: ["Die Nebelhexe"],
      poolNames: POOL,
    });
    expect(cast.length).toBeLessThanOrEqual(3);
    expect(cast[0]).toBe("Die Nebelhexe");
  });

  test("degrades quietly without a candidate or a pool", () => {
    expect(resolveIdeaCast({ modelCast: ["Die Nebelhexe"], auditChosenIdeaId: "c1", modelChosenIdeaId: "c1" }))
      .toEqual(["Die Nebelhexe"]);
    expect(resolveIdeaCast({ chosenCandidate: C2_AUFZUG, modelCast: ["Die Nebelhexe"] }))
      .toEqual(["Die Nebelhexe"]);
    expect(resolveIdeaCast({})).toEqual([]);
  });
});
