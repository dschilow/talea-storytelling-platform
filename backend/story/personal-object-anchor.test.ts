// @ts-ignore Bun exposes this runtime-only test helper without Node typings.
import { describe, expect, test } from "bun:test";
import { buildPersonalObjectStemMatcher } from "./personal-object-anchor";

describe("buildPersonalObjectStemMatcher", () => {
  test("accepts a cost that names the object", () => {
    const m = buildPersonalObjectStemMatcher("Rucksack des Unendlichen");
    expect(m.hasStems).toBe(true);
    expect(m.sharesStem("Alexander gibt den Rucksack her.")).toBe(true);
  });

  test("accepts German compounds whose head noun is the object", () => {
    const m = buildPersonalObjectStemMatcher("Schlüssel der halben Türen");
    expect(m.sharesStem("Alexander gibt den Schlüsselbund her.")).toBe(true);
  });

  test("rejects a cost that swaps in a different object", () => {
    const m = buildPersonalObjectStemMatcher("Rucksack des Unendlichen");
    expect(m.sharesStem("Alexander gibt die Laterne her.")).toBe(false);
  });

  test("umlaut folding matches between object and text", () => {
    const m = buildPersonalObjectStemMatcher("Türglocke");
    expect(m.sharesStem("Die Tuerglocke bleibt zurueck.")).toBe(true);
    expect(m.sharesStem("Die Türglocke bleibt zurück.")).toBe(true);
  });

  test("ß folds to ss consistently", () => {
    const m = buildPersonalObjectStemMatcher("Straßenlampe");
    expect(m.sharesStem("Die Strassenlampe zerbricht.")).toBe(true);
  });

  /**
   * The regression that took production down: the repair used substring
   * matching, so "Kreaturen" was read as referencing "Türen". The repair
   * reported success, the gate disagreed, and the run threw before any prose.
   */
  test("a stem buried mid-word is NOT a reference to the object", () => {
    const tueren = buildPersonalObjectStemMatcher("Türen");
    expect(tueren.sharesStem("Die Kreaturen im Flur halten Alexander auf.")).toBe(false);
    expect(tueren.sharesStem("Naturen aus Nebel schieben sich dazwischen.")).toBe(false);

    const schale = buildPersonalObjectStemMatcher("Schale");
    expect(schale.sharesStem("Er zerbricht die Muschale nicht, sondern die Kanne.")).toBe(false);

    const schluessel = buildPersonalObjectStemMatcher("Schlüssel der halben Türen");
    expect(schluessel.sharesStem("Die Kreaturen im Flur halten Alexander auf.")).toBe(false);
  });

  test("reports no stems when the object name is too short to anchor on", () => {
    expect(buildPersonalObjectStemMatcher("").hasStems).toBe(false);
    expect(buildPersonalObjectStemMatcher("Uhr").hasStems).toBe(false);
    expect(buildPersonalObjectStemMatcher("!!! ??").hasStems).toBe(false);
  });

  test("the deterministic fallback sentence always satisfies its own object", () => {
    // forcePersonalObjectAnchors builds costs of this shape; if this ever fails
    // the selfheal cannot converge and the gate throws again.
    for (const object of ["Rucksack des Unendlichen", "Schlüssel der halben Türen", "Türglocke", "Straßenlampe"]) {
      const m = buildPersonalObjectStemMatcher(object);
      const cost = `Alexander gibt ${object} her und lässt den Gegenstand sichtbar zurueck.`;
      expect(m.sharesStem(cost)).toBe(true);
    }
  });
});
