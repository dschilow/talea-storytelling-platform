// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import {
  LIFE_STORY_CHAPTER_COUNT,
  LIFE_STORY_SYSTEM_PROMPT,
  LIFE_STORY_TARGET_WORDS,
  LIFE_STORY_WRITER_MODEL,
  buildLifeStoryPrompt,
  deriveLifeStoryMood,
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
  quirk: "schnuppert an allem, als wäre es frisches Brot",
  speech_style: ["bedächtig", "rätselhaft"],
  emotional_triggers: ["Zugluft", "unbezahlte Rechnungen"],
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
});

describe("Prompt der Charaktergeschichten", () => {
  const prompt = buildLifeStoryPrompt(wizard, "6-8");

  test("eine Einleitung plus fünf Abenteuerkapitel", () => {
    expect(LIFE_STORY_CHAPTER_COUNT).toBe(6);
    expect(prompt).toContain("KAPITEL 1 — EINLEITUNG");
    expect(prompt).toContain("KAPITEL 2 BIS 6 — DAS ABENTEUER");
    for (const chapter of ["Kapitel 2 — Mittendrin", "Kapitel 3 —", "Kapitel 4 —", "Kapitel 5 —", "Kapitel 6 — Finale und Pointe"]) {
      expect(prompt).toContain(chapter);
    }
    expect(prompt).toContain("Genau 6 Kapitel");
    expect(LIFE_STORY_TARGET_WORDS).toEqual({ min: 1560, max: 1720 });
  });

  test("die Einleitung stellt die Figur mit Macke, Spruch, Sprechweise und Auslösern vor", () => {
    const intro = prompt.slice(prompt.indexOf("KAPITEL 1 — EINLEITUNG"), prompt.indexOf("KAPITEL 2 BIS 6"));
    expect(intro).toContain("Hier lernt der Leser Meister Zorbas kennen");
    expect(intro).toContain("kein Steckbrief");
    for (const part of ["wie Meister Zorbas aussieht", "die Macke oder Eigenart in Aktion", "wie Meister Zorbas redet", "auf die Palme bringt oder begeistert"]) {
      expect(intro).toContain(part);
    }
    expect(intro).toContain("den Lieblingsspruch „Nichts ist, wie es scheint.“ wörtlich");
    expect(intro).toContain("Überleitung");
  });

  test("Profilfelder stehen als Quelle im Prompt", () => {
    expect(prompt).toContain("Eigenart / Macke: schnuppert an allem, als wäre es frisches Brot");
    expect(prompt).toContain("Lieblingsspruch: „Nichts ist, wie es scheint.“ — wenn er etwas verbirgt");
    expect(prompt).toContain("Sprachstil: bedächtig, rätselhaft");
    expect(prompt).toContain("Zugluft, unbezahlte Rechnungen");
  });

  test("der Spruch kommt höchstens zweimal vor: Einleitung und Pointe", () => {
    expect(prompt).toContain("der zweite und letzte Auftritt des Spruchs");
  });

  test("ohne Spruch wird keiner erfunden und die Einleitung verlangt keinen", () => {
    const plain = buildLifeStoryPrompt(character({ name: "Bäcker Braun", role: "support", dominant_personality: "kind" }), "6-8");
    expect(plain).toContain("Lieblingsspruch: keiner");
    expect(plain).not.toContain("Lieblingsspruch „");
    expect(plain).not.toContain("zweite und letzte Auftritt");
  });

  test("verlangt ein Abenteuer statt einer Biografie", () => {
    expect(prompt).toContain("das Abenteuer, das Meister Zorbas zu der Figur gemacht hat");
    expect(prompt).toContain("keine Biografie");
    expect(prompt).not.toContain("Lebensbogen");
  });

  test("Spannung und Humor stehen im Auftrag und in jedem Kapitel", () => {
    expect(prompt).toContain("spannend, witzig und wohlig gruselig");
    expect(prompt).toContain("mindestens einen Moment zum Lachen und einen zum Zittern");
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

  test("festes Ausgabeformat für den Parser", () => {
    for (const line of ["TITEL:", "BESCHREIBUNG:", "KAPITEL 1:", "KAPITEL 2:"]) expect(prompt).toContain(line);
    expect(prompt).toContain("keine Markdown-Zeichen");
  });

  test("echte Umlaute in Prompt und Systemanweisung", () => {
    expect(prompt).not.toMatch(/\b(Saetze|Woerter|Ueberraschung|Raetsel|fuer|ueber)\b/);
    expect(LIFE_STORY_SYSTEM_PROMPT).toContain("echten Umlauten");
  });

  test("bleibt kompakt: der Prompt kostet nur wenige tausend Eingabetokens", () => {
    // ~4 characters per token in German; the writer's own output dominates the bill.
    expect(prompt.length).toBeLessThan(9000);
  });
});
