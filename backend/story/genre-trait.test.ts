import { describe, expect, test } from "bun:test";

import { inferPersonalityTrait } from "./genre-trait";

describe("inferPersonalityTrait", () => {
  test("understands the genre ids the story wizard sends", () => {
    expect(inferPersonalityTrait("fairy_tales")).toBe("vocabulary");
    expect(inferPersonalityTrait("adventure")).toBe("courage");
    expect(inferPersonalityTrait("magic")).toBe("creativity");
    expect(inferPersonalityTrait("animals")).toBe("empathy");
    expect(inferPersonalityTrait("scifi")).toBe("curiosity");
    expect(inferPersonalityTrait("modern")).toBe("empathy");
  });

  test("keeps the German genres of older stories", () => {
    expect(inferPersonalityTrait("Abenteuer")).toBe("courage");
    expect(inferPersonalityTrait("maerchen")).toBe("vocabulary");
  });
});
