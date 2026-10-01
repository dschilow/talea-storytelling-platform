// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import {
  LIFE_STORY_WRITER_MODEL,
  buildLifeStoryPrompt,
  deriveLifeStoryMood,
  lifeStoryToneConfig,
  type LifeStoryCharacter,
} from "./character-life-story-prompt";

function character(overrides: Partial<LifeStoryCharacter>): LifeStoryCharacter {
  return {
    name: "Testfigur",
    role: "guide",
    archetype: "helpful_elder",
    emotional_nature: { dominant: "wise", secondary: ["kind"], triggers: ["children in danger"] },
    visual_profile: { species: "human", description: "freundliche Person" },
    canon_settings: ["village"],
    personality_keywords: null,
    physical_description: null,
    backstory: null,
    dominant_personality: null,
    secondary_traits: null,
    catchphrase: null,
    catchphrase_context: null,
    speech_style: null,
    emotional_triggers: null,
    quirk: null,
    ...overrides,
  };
}

const wizard = character({
  name: "Meister Zorbas",
  role: "Magier",
  archetype: "MENTOR",
  dominant_personality: "geheimnisvoll",
  catchphrase: "Nichts ist, wie es scheint.",
  catchphrase_context: "wenn er etwas verbirgt",
});

describe("Ton der Charaktergeschichten", () => {
  test("schreibt mit GPT-6.1 Sol", () => {
    expect(LIFE_STORY_WRITER_MODEL).toBe("openai/gpt-6.1-sol");
  });

  test("Magier, Hexen und Nebelwesen bekommen das wohlige Gruseln", () => {
    expect(deriveLifeStoryMood(wizard).mood).toBe("spooky");
    expect(deriveLifeStoryMood(character({ name: "Die Nebelhexe", role: "obstacle", archetype: "trickster_witch", dominant_personality: "mischievous" })).mood).toBe("spooky");
    expect(deriveLifeStoryMood(character({ name: "Der Hofmagier", role: "support" })).mood).toBe("spooky");
    expect(deriveLifeStoryMood(character({ name: "Der Zeitweber", archetype: "time_mystical" })).mood).toBe("spooky");
  });

  test("eine verschmitzte Hexe ist gruselig UND lustig", () => {
    const witch = deriveLifeStoryMood(character({ name: "Die Nebelhexe", archetype: "trickster_witch", dominant_personality: "mischievous" }));
    expect(witch).toEqual({ mood: "spooky", funny: true });
  });

  test("Tricksterfiguren und Griesgrame bekommen die laute Komödie", () => {
    expect(deriveLifeStoryMood(character({ name: "Pip", archetype: "playful_helper", dominant_personality: "playful" })).mood).toBe("comic");
    expect(deriveLifeStoryMood(character({ name: "Graf Griesgram", role: "obstacle", archetype: "misunderstood_grump", dominant_personality: "grumpy" })).mood).toBe("comic");
  });

  test("gewöhnliche Helfer bekommen ein flottes Abenteuer", () => {
    expect(deriveLifeStoryMood(character({ name: "Bäcker Braun", role: "support", archetype: "helpful_villager", dominant_personality: "kind" })).mood).toBe("adventure");
  });

  test("„begeistert“, „geistreich“ oder „Flucht“ machen niemanden gruselig", () => {
    const cheerful = character({ name: "Professor Lichtweis", dominant_personality: "begeistert", personality_keywords: ["geistreich", "neugierig", "flucht-erfahren"] });
    expect(deriveLifeStoryMood(cheerful).mood).toBe("adventure");
  });

  test("ein echter Geist wird erkannt", () => {
    expect(deriveLifeStoryMood(character({ name: "Der freundliche Geist", role: "support" })).mood).toBe("spooky");
    expect(deriveLifeStoryMood(character({ name: "Die Geister vom Turm", role: "support" })).mood).toBe("spooky");
  });

  test("ein düsterer Gegenspieler ohne Magie-Wörter ist trotzdem unheimlich", () => {
    const dark = character({ name: "Ritter Kalt", role: "antagonist", archetype: "obstacle", dominant_personality: "grausam" });
    expect(deriveLifeStoryMood(dark).mood).toBe("spooky");
  });

  test("jede Stimmung ist spannend (Spannung 3) und mindestens verspielt", () => {
    for (const figure of [wizard, character({ name: "Pip", dominant_personality: "playful" }), character({})]) {
      const config = lifeStoryToneConfig(figure, "6-8");
      expect(config.suspenseLevel).toBe(3);
      expect(config.humorLevel).toBeGreaterThanOrEqual(2);
      expect(config.hasTwist).toBe(true);
      expect(config.emotionalFlavors).toContain("prickeln");
      expect(config.emotionalFlavors).toContain("lachfreude");
    }
  });

  test("Gruselgenre bleibt über das Abenteuer-Handwerk des Generators erreichbar", () => {
    // genreCraftGuidance matches on "abenteuer"; a plain "Gruselgeschichte" would fall back to the empty label.
    expect(lifeStoryToneConfig(wizard, "6-8").genre.toLowerCase()).toContain("abenteuer");
    expect(lifeStoryToneConfig(wizard, "6-8").stylePreset).toBe("quirky_dark_sweet");
  });

  test("die Kleinsten bekommen weniger Spannung, aber mehr Humor", () => {
    const config = lifeStoryToneConfig(wizard, "3-5");
    expect(config.suspenseLevel).toBe(2);
    expect(config.humorLevel).toBe(3);
  });
});

describe("Prompt der Charaktergeschichten", () => {
  const prompt = buildLifeStoryPrompt(wizard, "6-8");

  test("verlangt ein Abenteuer statt einer Biografie", () => {
    expect(prompt).toContain("Abenteuer, das Meister Zorbas zu der Figur gemacht hat");
    expect(prompt).toContain("KEINE Biografie");
    expect(prompt).not.toContain("Lebensbogen");
  });

  test("Spannung und Humor stehen im Auftrag und in jedem Kapitel", () => {
    expect(prompt).toContain("spannend, witzig und wohlig gruselig");
    expect(prompt).toContain("mindestens einen Moment zum Lachen UND einen zum Zittern");
    for (const chapter of ["Kapitel 1 — Mittendrin", "Kapitel 2 —", "Kapitel 3 —", "Kapitel 4 —", "Kapitel 5 —"]) {
      expect(prompt).toContain(chapter);
    }
    expect(prompt).toContain("Haken");
  });

  test("Gruselbogen mit konkreten Bildern, Entlastung durch Witz und klaren Grenzen", () => {
    expect(prompt).toContain("GRUSELIGES ABENTEUER");
    expect(prompt).toContain("Gruselhöhepunkt");
    expect(prompt).toContain("Gleich nach jedem Schreck kommt ein Lacher");
    expect(prompt).toContain("Kein Blut, keine Gewalt, kein Tod");
  });

  test("kein Gruselbogen für gewöhnliche Figuren", () => {
    const plain = buildLifeStoryPrompt(character({ name: "Bäcker Braun", role: "support", dominant_personality: "kind" }), "6-8");
    expect(plain).not.toContain("GRUSELIGES ABENTEUER");
    expect(plain).not.toContain("wohlig gruselig");
    expect(plain).toContain("TEMPOREICHES ABENTEUER");
  });

  test("Kanon bleibt verbindlich: Spruch höchstens einmal, Erscheinung und Form", () => {
    expect(prompt).toContain("Der kanonische Spruch lautet „Nichts ist, wie es scheint.“");
    expect(prompt).toContain("höchstens einmal");
    expect(prompt).toContain("exakt 5 Kapitel");
    expect(prompt).toContain("1400 bis 1500");
  });

  test("echte Umlaute statt ae/ue-Umschrift in den Anweisungen", () => {
    expect(prompt).not.toMatch(/\b(Saetze|Woerter|Ueberraschung|Raetsel|Hindernis-,\s*Ueber)/);
  });
});
