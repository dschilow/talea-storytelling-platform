// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { buildLifeStoryMessages, countWords, lifeStoryDraftIssues, parseLifeStoryDraft } from "./character-life-story-writer";
import type { LifeStoryCharacter } from "./character-life-story-prompt";

const words = (n: number, seed = "wort") => Array.from({ length: n }, (_, i) => `${seed}${i % 7}`).join(" ");

function story(parts: { intro?: string; chapterWords?: number; extra?: string } = {}) {
  const intro = parts.intro ?? `Das ist Wilhelm. „Hoppla, Brot!“, sagt er. ${words(180)}`;
  const chapters = [2, 3, 4, 5, 6].map((n) => `KAPITEL ${n}: Abenteuer ${n}\n${words(parts.chapterWords ?? 290, `k${n}x`)}`).join("\n\n");
  return `TITEL: Der Teig, der flüsterte\nBESCHREIBUNG: Ein Bäcker, ein Geist und sehr viel Mehl.\nKAPITEL 1: Das ist Wilhelm\n${intro}\n\n${chapters}${parts.extra || ""}`;
}

const wilhelm = { name: "Bäcker Wilhelm", catchphrase: "Hoppla, Brot!" } as Pick<LifeStoryCharacter, "name" | "catchphrase">;

describe("Ausgabe des Schreibers lesen", () => {
  test("liest Titel, Beschreibung und sechs Kapitel", () => {
    const draft = parseLifeStoryDraft(story())!;
    expect(draft.title).toBe("Der Teig, der flüsterte");
    expect(draft.description).toContain("Geist");
    expect(draft.chapters).toHaveLength(6);
    expect(draft.chapters[0]).toMatchObject({ order: 1, title: "Das ist Wilhelm" });
    expect(draft.chapters[5].title).toBe("Abenteuer 6");
    expect(countWords(draft.chapters[1].content)).toBe(290);
  });

  test("verträgt Markdown-Zierrat um Marker und Titel", () => {
    const raw = story().replace("KAPITEL 3: Abenteuer 3", "**KAPITEL 3:** *Abenteuer 3*").replace("TITEL:", "**TITEL:**");
    const draft = parseLifeStoryDraft(raw)!;
    expect(draft.chapters[2].title).toBe("Abenteuer 3");
    expect(draft.title).toBe("Der Teig, der flüsterte");
  });

  test("zu wenige oder zu viele Kapitel, fehlender Titel oder leeres Kapitel ergeben null", () => {
    expect(parseLifeStoryDraft(story().replace(/KAPITEL 6:[\s\S]*$/, ""))).toBeNull();
    expect(parseLifeStoryDraft(story({ extra: "\n\nKAPITEL 7: Zugabe\n" + words(100) }))).toBeNull();
    expect(parseLifeStoryDraft(story().replace(/^TITEL:.*\n/, ""))).toBeNull();
    expect(parseLifeStoryDraft(story().replace(/KAPITEL 4: Abenteuer 4\n[^\n]*/, "KAPITEL 4: Abenteuer 4\nZu kurz."))).toBeNull();
    expect(parseLifeStoryDraft("Hier ist deine Geschichte, aber ohne Format.")).toBeNull();
  });

  test("falsch nummerierte Kapitel werden abgelehnt", () => {
    expect(parseLifeStoryDraft(story().replace("KAPITEL 3:", "KAPITEL 5:"))).toBeNull();
  });
});

describe("Prüfung ohne zweites Modell", () => {
  test("eine saubere Geschichte hat keine Anmerkungen", () => {
    expect(lifeStoryDraftIssues(parseLifeStoryDraft(story())!, wilhelm)).toEqual([]);
  });

  test("zu kurze Kapitel werden gemeldet", () => {
    const issues = lifeStoryDraftIssues(parseLifeStoryDraft(story({ chapterWords: 150 }))!, wilhelm);
    expect(issues.some((issue) => issue.includes("Abenteuer zu kurz"))).toBe(true);
  });

  test("fehlender oder zu häufiger Lieblingsspruch wird gemeldet", () => {
    const noSaying = lifeStoryDraftIssues(parseLifeStoryDraft(story({ intro: `Das ist Wilhelm. ${words(180)}` }))!, wilhelm);
    expect(noSaying).toContain("Der Lieblingsspruch fehlt in der Einleitung");
    const tooOften = lifeStoryDraftIssues(parseLifeStoryDraft(story({ extra: "" }).replace("wort", "wort Hoppla, Brot! wort Hoppla, Brot!"))!, wilhelm);
    expect(tooOften.some((issue) => issue.includes("höchstens 2"))).toBe(true);
  });

  test("Umlaut-Umschrift und fehlender Name in der Einleitung werden gemeldet", () => {
    const issues = lifeStoryDraftIssues(parseLifeStoryDraft(story({ intro: `Er sagt: Hoppla, Brot! Ein Maerchen fuer alle. ${words(180)}` }))!, wilhelm);
    expect(issues).toContain("Umlaut-Umschrift (ae/oe/ue) im Text");
    expect(issues).toContain("Die Einleitung nennt die Figur nicht beim Namen");
  });
});

describe("Auftrag an den Schreiber", () => {
  test("ein System- und ein Nutzer-Prompt, keine Mehrstufenkette", () => {
    const { system, user } = buildLifeStoryMessages({ name: "Wilhelm" } as LifeStoryCharacter, "6-8");
    expect(system).toContain("Deutsch");
    expect(user).toContain("KAPITEL 1 — EINLEITUNG");
  });
});
