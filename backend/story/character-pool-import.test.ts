// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { sanitizeCharacter } from "./character-pool-import";

const now = new Date("2026-10-26T09:00:00Z");
describe("character pool import round-trip", () => {
  test("retains legacy ids, images and the complete exported bible, including false flags", () => {
    const input = {
      id: "char_008_nebelfee", name: "Die Nebelfee", imageUrl: "bucket://images/fairy.webp",
      visualProfile: { description: "Nebelgestalt", species: "fairy", colorPalette: ["silver"], imagePrompt: "silver fairy" },
      want: "Den eigenen Heimweg finden.", fear: "Verschwinden.", secret: "Sie kennt den eigenen Heimweg nicht.",
      runningGag: "Ein scheinbar allein wandernder Fund verrät ihr Versteck.", gesture: "Hält einen Finger an die Lippen.",
      comicRole: "dreamer", canLead: true, canOppose: false, introLine: "Ich bin nur ein bisschen hier.",
      signatureVisual: "translucent silver fairy", bibleVersion: 2, isActive: false,
    };
    const result = sanitizeCharacter(JSON.parse(JSON.stringify(input)), 0, now);
    for (const [key, value] of Object.entries(input)) expect((result as any)[key]).toEqual(value);
    expect(result.canOppose).toBe(false);
    expect(result.isActive).toBe(false);
  });

  test("reads snake_case bibles without changing an existing text id", () => {
    const result = sanitizeCharacter({ id: "existing-pool-figure", name: "Wächter", want: "Den Weg kennen.",
      running_gag: "Bewacht die falsche Seite.", can_lead: false, can_oppose: true,
      villain_style: "comic", bible_version: 1 }, 0, now);
    expect(result.id).toBe("existing-pool-figure");
    expect(result.runningGag).toBe("Bewacht die falsche Seite.");
    expect(result.canLead).toBe(false);
    expect(result.canOppose).toBe(true);
    expect(result.villainStyle).toBe("comic");
    expect(result.bibleVersion).toBe(1);
  });

  test("an older export does not invent empty bible fields that would overwrite enrichment", () => {
    const result = sanitizeCharacter({ id: "old-figure", name: "Alter Export" }, 0, now);
    expect(result.want).toBeUndefined();
    expect(result.canLead).toBeUndefined();
    expect(result.canOppose).toBeUndefined();
    expect(result.bibleVersion).toBeUndefined();
  });

  test("rejects nameless records and control characters before import", () => {
    for (const value of [null, "a figure", {}, { name: "  " }, { name: "X", id: "bad\u0000id" }]) {
      expect(() => sanitizeCharacter(value, 0, now)).toThrow();
    }
    expect(sanitizeCharacter({ name: "Neu" }, 0, now).id).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("the import path does not delete rows that own origins or story links", () => {
    const source = readFileSync(new URL("./character-pool-api.ts", import.meta.url), "utf8");
    const importBody = source.slice(source.indexOf("export const importCharacters"), source.indexOf("function buildCharacterImagePrompt"));
    expect(importBody).not.toMatch(/DELETE\s+FROM\s+(character_pool|story_characters|character_life_stories)/i);
    expect(importBody).toMatch(/ON CONFLICT\s*\(id\)\s*DO UPDATE/);
    expect(importBody).toMatch(/SET is_active = FALSE/);
  });
});
