import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseChapters, sanitizeSlot, SCORE_DIMENSIONS, buildSeriesContext, type EpisodeBrief } from "./engine";
import { boundingBoxesFor, boxToken, buildPortraitPrompt, buildScenePrompt, buildRunwareTask, figuresFor, LIBRARY_IMAGE_MODEL } from "./images";
import { SEED_EPISODES, SEED_SEASONS, SEED_SERIES } from "./seed";
import { nextReleaseSlot, zonedTime } from "./schedule";

const PUBLIC = join(import.meta.dir, "..", "..", "..", "frontend", "public");

describe("library seed", () => {
  test("every series has a full season plan and a bible the pipeline can use", () => {
    for (const { series, bible } of SEED_SERIES) {
      const season = SEED_SEASONS.find((entry) => entry.seriesId === series.id);
      expect(season?.episodes.length).toBe(10);
      expect(bible.characters.length).toBeGreaterThan(4);
      expect(bible.seasonArcs[0].clues.length).toBe(10);
      expect(bible.imageStyleEn).not.toMatch(/no text/i);
      for (const character of bible.characters) {
        expect(character.visualProfileEn.length).toBeGreaterThan(20);
        expect(existsSync(join(PUBLIC, character.referenceStripKey))).toBe(true);
      }
    }
  });

  test("seed episodes: 3 chapters, pictures inside the chapter, known figures, files present", () => {
    for (const episode of SEED_EPISODES) {
      const { bible, series } = SEED_SERIES.find((entry) => entry.series.id === episode.seriesId)!;
      const known = new Set([...bible.characters.map((character) => character.id), ...episode.guests.map((guest) => guest.id)]);
      expect(episode.chapters.length).toBe(3);
      const words = episode.chapters.reduce((sum, chapter) => sum + chapter.text.split(/\s+/).length, 0);
      expect(words).toBeGreaterThan(1300);
      expect(words).toBeLessThan(2100);
      for (const slot of [episode.cover, ...episode.chapters.map((chapter) => chapter.image!)]) {
        expect(slot.url && existsSync(join(PUBLIC, slot.url))).toBe(true);
        for (const id of slot.characterIds) expect(known.has(id)).toBe(true);
        expect(slot.characterIds.length).toBeLessThanOrEqual(4);
        for (const id of Object.keys(slot.boxes || {})) expect(slot.characterIds).toContain(id);
      }
      for (const chapter of episode.chapters) {
        const paragraphs = chapter.text.split(/\n\n/).length;
        expect(chapter.image!.afterParagraph!).toBeGreaterThan(1);
        expect(chapter.image!.afterParagraph!).toBeLessThan(paragraphs - 1);
      }
      for (const guest of episode.guests) expect(existsSync(join(PUBLIC, guest.referenceUrl!))).toBe(true);
      expect(episode.teaser.startsWith(series.teaserPrefix)).toBe(true);
      expect(episode.collectible.fields.length).toBeGreaterThanOrEqual(4);
      expect(existsSync(join(PUBLIC, series.coverImageUrl!))).toBe(true);
    }
  });

  test("the writing context hides the season resolution before the finale", () => {
    const { series, bible } = SEED_SERIES[0];
    const brief = (episode: number): EpisodeBrief => ({
      series,
      bible,
      canon: [],
      target: { season: 1, episode, title: "x", logline: "y", fields: {}, clue: bible.seasonArcs[0].clues[episode - 1].clue },
    });
    expect(buildSeriesContext(brief(3))).not.toContain(bible.seasonArcs[0].resolution);
    expect(buildSeriesContext(brief(3))).not.toContain("E4:");
    expect(buildSeriesContext(brief(10))).toContain(bible.seasonArcs[0].resolution);
  });
});

describe("library pictures", () => {
  const { bible } = SEED_SERIES[0];
  const figures = figuresFor(["kater-kaiser", "mats", "bruno"], bible.characters, []);

  test("figures use short first names and keep titles", () => {
    expect(figures.map((figure) => figure.name)).toEqual(["Kater Kaiser", "Mats", "Bruno"]);
  });

  test("each figure is lifted from its own sheet cell into its box", () => {
    const boxes = boundingBoxesFor(figures, { "kater-kaiser": [480, 30, 1000, 420], mats: [180, 400, 1000, 600], bruno: [1, 2, 3] as unknown as number[] });
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toMatchObject({ id: "katerkaiser", referenceIndex: 0, sourceBox: [0, 0, 1000, 333], targetBox: [480, 30, 1000, 420] });
    expect(boxes[1].sourceBox).toEqual([0, 333, 1000, 667]);
  });

  test("scene tokens become <tokens> for boxed figures and names otherwise", () => {
    const prompt = buildScenePrompt("Room. [kater-kaiser] falls, [mats] stares at [bruno]", "Style", figures, [], {}, new Set(["kater-kaiser", "mats"]));
    expect(prompt).toContain("<katerkaiser> falls, <mats> stares at Bruno");
    expect(prompt).toContain("Exactly 3 characters appear in the picture, each of them only once: Kater Kaiser, Mats and Bruno.");
    expect(prompt).toMatch(/eyes on each other or on the event/);
    expect(boxToken("socken-schnueffler")).toBe("sockenschnueffler");
  });

  test("an outfit override keeps the face and changes the clothes", () => {
    const jona = figuresFor(["jona"], SEED_SERIES[1].bible.characters, []);
    const prompt = buildScenePrompt("Kitchen. [jona] stares", "Style", jona, [], { jona: "blue pyjamas" });
    expect(prompt).toContain("same face, hair and body as on the sheet, but here wearing blue pyjamas");
  });

  test("portraits never ask a fish to stand", () => {
    expect(buildPortraitPrompt("Style", { visualProfileEn: "goldfish" })).not.toMatch(/standing/i);
  });

  test("the Runware task only carries fields FLUX 3 Klein accepts", () => {
    const task = buildRunwareTask({ prompt: "p", width: 1216, height: 832, seed: 1, referenceImages: ["data:image/jpeg;base64,AA"] });
    expect(task.model).toBe(LIBRARY_IMAGE_MODEL);
    expect(task).not.toHaveProperty("CFGScale");
    expect(task).not.toHaveProperty("negativePrompt");
    expect(task.width % 16).toBe(0);
    expect(task.height % 16).toBe(0);
  });
});

describe("library pipeline helpers", () => {
  test("chapters are parsed from KAPITEL markers, paragraphs joined", () => {
    const chapters = parseChapters("KAPITEL 1: Der Fisch\nErster Satz.\nNoch einer.\n\nZweiter Absatz.\n\n## KAPITEL 2 – Hugo\nText zwei.\n\nKAPITEL 3: Ende\nSchluss.\n\nTEASER: weg");
    expect(chapters.map((chapter) => chapter.title)).toEqual(["Der Fisch", "Hugo", "Ende"]);
    expect(chapters[0].text).toBe("Erster Satz. Noch einer.\n\nZweiter Absatz.");
    expect(chapters[2].text).toBe("Schluss.");
  });

  test("picture slots keep known figures, valid boxes and at most four figures", () => {
    const slot = sanitizeSlot(
      { sceneEn: "x", characterIds: ["ella", "ghost", "mats", "bruno", "hugo", "kater-kaiser"], boxes: { ella: [0, 0, 500, 500], mats: [500, 0, 100, 100] } },
      new Set(["ella", "mats", "bruno", "hugo", "kater-kaiser"]),
    );
    expect(slot?.characterIds).toEqual(["ella", "mats", "bruno", "hugo"]);
    expect(Object.keys(slot?.boxes || {})).toEqual(["ella"]);
  });

  test("eight scoring dimensions as in the concept", () => {
    expect(SCORE_DIMENSIONS.map((dimension) => dimension.label)).toEqual([
      "Figurenkonsistenz", "Plot-Kohärenz", "Sprachqualität", "Emotionale Tiefe", "Altersangemessenheit", "Ende", "Kanon-Treue", "Weitererzähl-Faktor",
    ]);
  });

  test("release slots: Friday 15:00 Berlin in summer and winter time", () => {
    expect(zonedTime(2026, 10, 23, 15, "Europe/Berlin").toISOString()).toBe("2026-10-23T13:00:00.000Z");
    expect(zonedTime(2026, 11, 6, 15, "Europe/Berlin").toISOString()).toBe("2026-11-06T14:00:00.000Z");
    const cadence = { weekday: 5, hourLocal: 15, timezone: "Europe/Berlin" };
    expect(nextReleaseSlot(cadence, new Date("2026-10-20T10:00:00Z")).toISOString()).toBe("2026-10-23T13:00:00.000Z");
    expect(nextReleaseSlot(cadence, new Date("2026-10-23T13:00:00Z")).toISOString()).toBe("2026-10-30T14:00:00.000Z");
  });
});
