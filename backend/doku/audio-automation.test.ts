// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { buildAudioCoverPrompt, sanitizeCoverPrompt } from "./cover-prompt";
import { castSpeakerVoices, FIXED_SPEAKER_VOICES } from "./voice-casting";
import { automationKeyMatches, countSpokenWords, normalizeJobItem } from "./audio-automation-input";

describe("cover prompt", () => {
  const legacy =
    "Square 1:1  Theme: Fire station check. A sunlit fire station hall with a red engine, warm light. Foreground: the show's cheerful cartoon hosts on location. Modern clean premium illustration, smooth gradients, crisp outlines, kid-friendly, no writing, no symbols that resemble letters or numbers.";

  test("drops the label sentence the image model used to render as a title", () => {
    const out = sanitizeCoverPrompt(legacy);
    expect(out).not.toMatch(/Square 1:1|Theme/i);
    expect(out.startsWith("A sunlit fire station hall")).toBe(true);
  });

  test("drops clauses that merely name text, keeps the scene", () => {
    const out = sanitizeCoverPrompt(legacy);
    expect(out).not.toMatch(/writing|letters|numbers/i);
    expect(out).toContain("kid-friendly");
    expect(out).toContain("cartoon hosts");
  });

  test("final prompt has no title-card wrapper and no mention of text", () => {
    const out = buildAudioCoverPrompt(legacy, "Fire");
    expect(out).not.toMatch(/\btext\b|writing|letters|educational cover art|documentary/i);
  });

  test("is idempotent and never empties a scene", () => {
    const once = sanitizeCoverPrompt(legacy);
    expect(sanitizeCoverPrompt(once)).toBe(once);
    expect(sanitizeCoverPrompt("Theme: only a label.").length).toBeGreaterThan(0);
  });
});

describe("voice casting", () => {
  const voices = [
    { voiceId: "m1", name: "Max", labels: { gender: "male", age: "middle_aged", language: "de" } },
    { voiceId: "f1", name: "Mara", labels: { gender: "female", age: "middle_aged", language: "de" } },
    { voiceId: "f2", name: "Ida", labels: { gender: "female", age: "young", language: "de" } },
    { voiceId: "m2", name: "Opa", labels: { gender: "male", age: "old", language: "de" } },
  ];

  test("TAVI and LUMI stay fixed, guests get distinct fitting voices", () => {
    const map = castSpeakerVoices(
      [
        { name: "FÖRSTERIN MARA", gender: "female", age: "adult" },
        { name: "TISCHLER OTTO", gender: "male", age: "old" },
      ],
      voices,
    );
    expect(map.TAVI).toBe(FIXED_SPEAKER_VOICES.TAVI);
    expect(map.LUMI).toBe(FIXED_SPEAKER_VOICES.LUMI);
    expect(map["FÖRSTERIN MARA"]).toBe("f1");
    expect(map["TISCHLER OTTO"]).toBe("m2");
  });

  test("never gives two guests the same voice", () => {
    const map = castSpeakerVoices([{ name: "A", gender: "female" }, { name: "B", gender: "female" }], voices);
    expect(map.A).not.toBe(map.B);
  });

  test("throws when the account has no voices", () => {
    expect(() => castSpeakerVoices([{ name: "FÖRSTERIN MARA" }], [])).toThrow();
  });
});

describe("job item validation", () => {
  test("applies defaults", () => {
    const item = normalizeJobItem({ topic: "Wie fliegt ein Flugzeug?" });
    expect(item).toMatchObject({ ageFrom: 6, ageTo: 10, durationMinutes: 14, autoPublish: false, extraSpeakers: [] });
  });

  test("caps the duration and keeps the age range ordered", () => {
    const item = normalizeJobItem({ topic: "Wie fliegt ein Flugzeug?", durationMinutes: 99, ageFrom: 9, ageTo: 3 });
    expect(item.durationMinutes).toBe(20);
    expect(item.ageTo).toBeGreaterThanOrEqual(item.ageFrom);
  });

  test("rejects speaker names that would break the script format", () => {
    for (const name of ["TAVI", "LUMI", "PILOT: EVIL", "A"]) {
      expect(() => normalizeJobItem({ topic: "Wie fliegt ein Flugzeug?", extraSpeakers: [{ name }] })).toThrow();
    }
  });

  test("allows at most two guests", () => {
    const guests = ["PILOTIN ANNA", "LOTSE KARL", "MECHANIKER JAN"].map((name) => ({ name }));
    expect(() => normalizeJobItem({ topic: "Wie fliegt ein Flugzeug?", extraSpeakers: guests })).toThrow();
  });
});

describe("script length", () => {
  test("counts spoken words without speaker labels and audio tags", () => {
    expect(countSpokenWords("TAVI: [excited] Heute checke ich das!\nLUMI: Echt jetzt? [pause] Wow.")).toBe(7);
  });
});

describe("automation key", () => {
  const key = "k".repeat(40);
  test("accepts only the exact key", () => {
    expect(automationKeyMatches(key, key)).toBe(true);
    expect(automationKeyMatches(`${key}x`, key)).toBe(false);
    expect(automationKeyMatches(undefined, key)).toBe(false);
    expect(automationKeyMatches("", key)).toBe(false);
  });
  test("a missing or short configured key switches the feature off", () => {
    expect(automationKeyMatches("short", "short")).toBe(false);
    expect(automationKeyMatches("", "")).toBe(false);
    expect(automationKeyMatches(undefined, undefined)).toBe(false);
  });
});
