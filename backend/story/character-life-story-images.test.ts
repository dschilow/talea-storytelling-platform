// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import {
  LIFE_STORY_IMAGE_MODEL,
  LIFE_STORY_IMAGE_NEGATIVE,
  buildShotListMessages,
  composeShotPrompt,
  fallbackShotList,
  parseShotList,
  planLifeStoryShots,
  shotListIssues,
  type LifeStoryShotList,
} from "./character-life-story-images";

const chapters = [1, 2, 3, 4, 5].map((order) => ({ order, title: `Kapitel ${order}`, content: `Text von Kapitel ${order}.` }));
const input = { heroName: "Bäcker Wilhelm", heroLook: "plump jolly baker, white apron, bushy grey beard", mood: "spooky" as const, title: "Der Teig, der flüsterte", chapters };

function shot(location: string, camera: string, extra: Record<string, unknown> = {}) {
  return { camera, location, light: "candlelight", action: "HERO sprints across the beams", emotion: "wide-eyed panic", with: [], details: "flour swirls", ...extra };
}

const goodList = {
  figures: [{ id: "f1", look: "a tall pale ghost in a torn baker's cap, translucent, blue glow" }],
  cover: shot("a giant bread oven glowing in a cavern", "wide establishing shot"),
  chapters: [
    { order: 1, ...shot("a sleepy village bakery at dawn", "medium action shot") },
    { order: 2, ...shot("a moonlit rope bridge over a misty gorge", "low angle looking up", { with: ["f1"] }) },
    { order: 3, ...shot("a flooded cellar full of floating barrels", "close-up on face and hands") },
    { order: 4, ...shot("the crooked tower of the clock mill during a storm", "high angle looking down", { with: ["f1"] }) },
    { order: 5, ...shot("a lantern-lit market square at midnight", "wide establishing shot") },
  ],
};

describe("Shot-Liste für die Charaktergeschichten", () => {
  test("Bilder kommen vom 9B-Modell, ohne das Verbot weiterer Figuren", () => {
    expect(LIFE_STORY_IMAGE_MODEL).toBe("runware:400@2");
    expect(LIFE_STORY_IMAGE_NEGATIVE).not.toMatch(/extra character|unlisted creature|unlisted animal|unlisted person/);
    expect(LIFE_STORY_IMAGE_NEGATIVE).toContain("watermarks");
  });

  test("der Auftrag verlangt anderen Ort, anderes Licht, andere Kamera, Aktion und Gegenspieler", () => {
    const { system, user } = buildShotListMessages(input);
    expect(system).toContain("SHOT LIST");
    for (const phrase of ["A DIFFERENT PLACE", "A DIFFERENT LIGHT", "A DIFFERENT CAMERA", "MID-ACTION", "Opponents and companions", "HERO"]) {
      expect(user).toContain(phrase);
    }
    expect(user).toContain("Text von Kapitel 5.");
    expect(user).toContain("pleasantly spooky");
  });

  test("Rückmeldung zum letzten Versuch landet im zweiten Auftrag", () => {
    const { user } = buildShotListMessages(input, ["chapters 2 and 3 use the same camera. Change one."]);
    expect(user).toContain("YOUR LAST ATTEMPT HAD THESE PROBLEMS");
    expect(user).toContain("chapters 2 and 3 use the same camera");
  });

  test("parseShotList liest gültiges JSON, auch mit Code-Zaun", () => {
    const list = parseShotList("```json\n" + JSON.stringify(goodList) + "\n```", [1, 2, 3, 4, 5]);
    expect(list?.chapters).toHaveLength(5);
    expect(list?.chapters[1].with).toEqual(["f1"]);
    expect(list?.figures[0].id).toBe("f1");
  });

  test("unbekannte Figuren-Ids und mehr als zwei Figuren pro Bild werden entfernt", () => {
    const raw = JSON.stringify({ ...goodList, chapters: goodList.chapters.map((c) => (c.order === 2 ? { ...c, with: ["f1", "f9", "f1"] } : c)) });
    expect(parseShotList(raw, [1, 2, 3, 4, 5])?.chapters[1].with).toEqual(["f1"]);
  });

  test("fehlendes Kapitel oder kaputtes JSON ergibt null", () => {
    expect(parseShotList("kein json", [1])).toBeNull();
    expect(parseShotList(JSON.stringify({ ...goodList, chapters: goodList.chapters.slice(0, 4) }), [1, 2, 3, 4, 5])).toBeNull();
  });

  test("eine abwechslungsreiche Liste hat keine Beanstandungen", () => {
    expect(shotListIssues(goodList as unknown as LifeStoryShotList)).toEqual([]);
  });

  test("derselbe Ort in zwei Bildern wird beanstandet", () => {
    const same = {
      ...goodList,
      chapters: goodList.chapters.map((c) => (c.order === 3 ? { ...c, location: "a sleepy village bakery at night" } : c)),
    };
    const issues = shotListIssues(same as unknown as LifeStoryShotList);
    expect(issues.some((issue) => issue.includes("chapter 1 and chapter 3") && issue.includes("same place"))).toBe(true);
  });

  test("zweimal dieselbe Kamera hintereinander wird beanstandet", () => {
    const same = {
      ...goodList,
      chapters: goodList.chapters.map((c) => (c.order === 2 ? { ...c, camera: "medium shot" } : c)),
    };
    expect(shotListIssues(same as unknown as LifeStoryShotList).some((issue) => issue.includes("chapters 1 and 2 use the same camera"))).toBe(true);
  });

  test("Dastehen und Posieren wird beanstandet", () => {
    const posing = {
      ...goodList,
      chapters: goodList.chapters.map((c) => (c.order === 4 ? { ...c, action: "HERO stands proudly and smiles at the camera" } : c)),
    };
    expect(shotListIssues(posing as unknown as LifeStoryShotList).some((issue) => issue.includes("chapter 4") && issue.includes("posing"))).toBe(true);
  });

  test("definierte Figuren, die nie vorkommen, werden beanstandet", () => {
    const lonely = { ...goodList, chapters: goodList.chapters.map((c) => ({ ...c, with: [] })) };
    expect(shotListIssues(lonely as unknown as LifeStoryShotList).some((issue) => issue.includes("no chapter shows one"))).toBe(true);
  });

  test("planLifeStoryShots korrigiert einmal und nimmt die bessere Liste", async () => {
    const bad = { ...goodList, chapters: goodList.chapters.map((c) => ({ ...c, location: "a sleepy village bakery" })) };
    const calls: string[] = [];
    const answers = [JSON.stringify(bad), JSON.stringify(goodList)];
    const result = await planLifeStoryShots(async ({ user }) => {
      calls.push(user);
      return answers[calls.length - 1];
    }, input);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("YOUR LAST ATTEMPT HAD THESE PROBLEMS");
    expect(result?.issues).toEqual([]);
    expect(result?.attempts).toBe(2);
  });

  test("planLifeStoryShots liefert null, wenn das Modell zweimal nichts Brauchbares sagt", async () => {
    expect(await planLifeStoryShots(async () => "nope", input)).toBeNull();
    expect(await planLifeStoryShots(async () => { throw new Error("Empty response"); }, input)).toBeNull();
  });
});

describe("Bild-Prompt für ein Kapitel", () => {
  const list = parseShotList(JSON.stringify(goodList), [1, 2, 3, 4, 5])!;
  const prompt = composeShotPrompt({ shot: list.chapters[1], figures: list.figures, heroName: input.heroName, heroLook: input.heroLook, mood: "spooky", kind: "chapter", hasReference: true });

  test("Ort, Kamera, Aktion und Gegenspieler stehen vorn im Prompt", () => {
    expect(prompt.indexOf("moonlit rope bridge")).toBeLessThan(prompt.indexOf("Soft watercolour"));
    expect(prompt).toContain("low angle looking up");
    expect(prompt).toContain("Bäcker Wilhelm sprints across the beams");
    expect(prompt).toContain("Clearly apart from Bäcker Wilhelm");
    expect(prompt).toContain("tall pale ghost");
  });

  test("zählt die Figuren genau und hält jede für sich", () => {
    expect(prompt).toContain("Exactly 2 figures, each drawn once as its own separate body");
    const alone = composeShotPrompt({ shot: list.chapters[0], figures: list.figures, heroName: input.heroName, heroLook: input.heroLook, mood: "spooky", kind: "chapter", hasReference: true });
    expect(alone).toContain("Exactly 1 figure, each drawn once");
    expect(alone).not.toContain("ghost");
  });

  test("das Referenzbild liefert nur die Identität, nicht Pose oder Ort", () => {
    expect(prompt).toContain("use it only for Bäcker Wilhelm's face, hair, colours and outfit, in a completely new pose, place and framing");
  });

  test("nur positive Formulierungen, kein \"no\" im Positiv-Prompt", () => {
    expect(prompt).not.toMatch(/\b(no|never|without|don't)\b/i);
  });

  test("ohne Referenzbild fehlt der Referenzsatz; das Cover wird als Titelbild angelegt", () => {
    const cover = composeShotPrompt({ shot: list.cover, figures: list.figures, heroName: input.heroName, heroLook: "", mood: "comic", kind: "cover", hasReference: false });
    expect(cover).toContain("A bold, iconic frontispiece");
    expect(cover).not.toContain("attached image");
    expect(cover).toContain("exaggerated comic expressions");
  });

  test("bleibt unter der Längengrenze", () => {
    const long = { ...list.chapters[1], details: "x ".repeat(80), action: "HERO " + "runs ".repeat(40) };
    expect(composeShotPrompt({ shot: long, figures: list.figures, heroName: input.heroName, heroLook: input.heroLook, mood: "adventure", kind: "chapter", hasReference: true }).length).toBeLessThanOrEqual(1700);
  });
});

describe("Einleitung und Fallback", () => {
  test("das Einleitungskapitel wird als Vorstellung der Figur markiert", () => {
    const { user } = buildShotListMessages({ ...input, chapters: chapters.map((c) => (c.order === 1 ? { ...c, kind: "intro" as const } : c)) });
    expect(user).toContain("[1] Kapitel 1 (INTRODUCTION of the hero");
    expect(user).toContain("signature habit or quirk");
    expect(user).not.toContain("[2] Kapitel 2 (INTRODUCTION");
  });

  test("der Fallback liefert für jedes Kapitel andere Kamera und anderes Licht", () => {
    const list = fallbackShotList(chapters);
    expect(list.chapters).toHaveLength(5);
    expect(new Set(list.chapters.map((c) => c.camera)).size).toBe(5);
    expect(new Set(list.chapters.map((c) => c.light)).size).toBe(5);
    expect(list.chapters.map((c) => c.order)).toEqual([1, 2, 3, 4, 5]);
    expect(shotListIssues(list).filter((issue) => issue.includes("same camera"))).toEqual([]);
  });
});
