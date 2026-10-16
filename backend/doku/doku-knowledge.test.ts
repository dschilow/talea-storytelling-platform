import { describe, expect, test } from "bun:test";

import { resolveDokuKnowledgeTrait } from "./doku-knowledge";

describe("resolveDokuKnowledgeTrait", () => {
  test("follows the doku world the Lernkosmos files it under", () => {
    expect(resolveDokuKnowledgeTrait({ domainId: "nature", topic: "Haie" })).toBe("knowledge.biology");
    expect(resolveDokuKnowledgeTrait({ domainId: "space", topic: "Raketen" })).toBe("knowledge.astronomy");
    expect(resolveDokuKnowledgeTrait({ domainId: "body", topic: "Der Körper" })).toBe("knowledge.biology");
    expect(resolveDokuKnowledgeTrait({ domainId: "earth", topic: "Vulkanausbruch" })).toBe("knowledge.geography");
    expect(resolveDokuKnowledgeTrait({ domainId: "tech", topic: "Wie funktioniert ein Computer?" })).toBe("knowledge.physics");
    expect(resolveDokuKnowledgeTrait({ domainId: "dinosaurs", topic: "Wer war der T-Rex?" })).toBe("knowledge.biology");
  });

  test("never files an unknown topic under history", () => {
    // Before: every topic without a keyword hit became knowledge.history.
    for (const topic of ["Haie", "Diamanten", "Musikinstrumente", "Fußball", "Bienen", "Raketen"]) {
      expect(resolveDokuKnowledgeTrait({ topic })).not.toBe("knowledge.history");
    }
    expect(resolveDokuKnowledgeTrait({ domainId: "arts", topic: "Wie macht Musik Stimmung?" })).toBe("knowledge");
  });

  test("reads umlauts in the keyword fallback", () => {
    expect(resolveDokuKnowledgeTrait({ topic: "Der Körper" })).toBe("knowledge.biology");
    expect(resolveDokuKnowledgeTrait({ topic: "Das alte Ägypten und seine Geschichte" })).toBe("knowledge.history");
  });
});
