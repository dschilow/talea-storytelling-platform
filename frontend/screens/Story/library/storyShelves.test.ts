// @ts-ignore Bun executes these tests; it is not a dependency of the browser bundle.
import { describe, expect, test } from "bun:test";
import type { Story } from "../../../types/story";
import {
  buildSeriesShelves,
  freeStoriesOf,
  isNewStory,
  joinNames,
  pickFeaturedStory,
  seriesStoryPath,
  splitSeriesRuns,
  wizardCategoryOf,
} from "./storyShelves";

const BASE = Date.parse("2026-10-20T10:00:00Z");

function story(id: string, options: {
  minute: number;
  series?: string;
  episode?: number;
  status?: Story["status"];
  read?: boolean;
  avatars?: string[];
  figures?: string[];
  genre?: string;
  cover?: string;
}): Story {
  return {
    id,
    userId: "u1",
    title: id,
    summary: "",
    status: options.status ?? "complete",
    isPublic: false,
    coverImageUrl: options.cover,
    createdAt: new Date(BASE + options.minute * 60_000).toISOString(),
    updatedAt: new Date(BASE + options.minute * 60_000).toISOString(),
    config: {
      genre: options.genre ?? "adventure",
      style: "",
      ageGroup: "6-8",
      avatars: (options.avatars ?? []).map((name) => ({ id: `avatar-${name}`, name })),
      characters: (options.figures ?? []).map((name) => ({ id: `figure-${name}`, name, imageUrl: `/${name}.webp` })),
      ...(options.series ? { storybookEngine: "character-series-v1", characterSeriesId: options.series } : { storybookEngine: "talea-folge-v1" }),
    },
    ...(options.read ? { profileState: { profileId: "p1", isFavorite: false, progressPct: 100, completionState: "completed" as const } } : {}),
    ...(options.episode ? { metadata: { characterSeries: { id: options.series!, episode: options.episode } } } : {}),
  };
}

const blubbert = { id: "kapitaen-blubbert", title: "Kapitän Blubbert und die Insel ohne Karte", description: "Inselreisen", characterId: "figure-Blubbert", characterName: "Kapitän Blubbert", imageUrl: "/blubbert.webp", genres: ["adventure", "magic"], episodeCount: 3 };
const nebelfee = { id: "nebelfee", title: "Die Nebelfee und das Haus der verlorenen Wege", description: "Wege", characterName: "Die Nebelfee", genres: ["fairy_tales"], episodeCount: 1 };

describe("library shelves", () => {
  test("series episodes form one shelf each, in reading order; every other story stands on its own", () => {
    const stories = [
      story("free-1", { minute: 1 }),
      story("b3", { minute: 30, series: blubbert.id, episode: 3, avatars: ["Adrian", "Alexander"], figures: ["Blubbert", "Pia"], genre: "magic", cover: "/b3.webp" }),
      story("b1", { minute: 10, series: blubbert.id, episode: 1, read: true, avatars: ["Alexander"], figures: ["Blubbert"] }),
      story("n1", { minute: 40, series: nebelfee.id, episode: 1, figures: ["Nebelfee"] }),
      story("b2", { minute: 20, series: blubbert.id, episode: 2, read: true, avatars: ["Alexander"], figures: ["Blubbert", "Pia"] }),
      story("free-2", { minute: 50 }),
    ];
    expect(freeStoriesOf(stories).map((entry) => entry.id)).toEqual(["free-1", "free-2"]);
    const shelves = buildSeriesShelves(stories, [blubbert, nebelfee]);
    expect(shelves.map((shelf) => shelf.id)).toEqual(["nebelfee", "kapitaen-blubbert"]);
    const shelf = shelves[1];
    expect(shelf.episodes.map((entry) => entry.id)).toEqual(["b1", "b2", "b3"]);
    expect(shelf.earlier).toEqual([]);
    expect(shelf.nextEpisode).toBe(4);
    expect(shelf.title).toBe(blubbert.title);
    expect(shelf.characterName).toBe("Kapitän Blubbert");
    expect(shelf.portraitUrl).toBe("/blubbert.webp");
    expect(shelf.coverImageUrl).toBe("/b3.webp");
    expect(shelf.genre).toBe("magic");
    expect(shelf.avatars.map((avatar) => avatar.name)).toEqual(["Adrian", "Alexander"]);
    expect(shelf.lastAvatarIds).toEqual(["avatar-Adrian", "avatar-Alexander"]);
    expect(shelf.figures.map((figure) => figure.name)).toEqual(["Blubbert", "Pia"]);
    expect([shelf.completeCount, shelf.readCount, shelf.unreadCount, shelf.firstUnreadIndex]).toEqual([3, 2, 1, 2]);
  });

  test("after an admin reset only the newest counted episodes continue; the older ones stay as an earlier run", () => {
    const stories = [
      story("old-1", { minute: 1, series: blubbert.id, episode: 1 }),
      story("old-2", { minute: 2, series: blubbert.id, episode: 2 }),
      story("old-error", { minute: 3, series: blubbert.id, status: "error" }),
      story("new-1", { minute: 10, series: blubbert.id, episode: 1 }),
      story("new-2", { minute: 11, series: blubbert.id, status: "generating" }),
    ];
    const runs = splitSeriesRuns(stories, 1);
    expect(runs.current.map((entry) => entry.id)).toEqual(["new-1", "new-2"]);
    expect(runs.earlier.map((entry) => entry.id)).toEqual(["old-1", "old-2", "old-error"]);
    const [shelf] = buildSeriesShelves(stories, [{ ...blubbert, episodeCount: 1 }]);
    expect(shelf.nextEpisode).toBe(2);
    expect(shelf.generating?.id).toBe("new-2");
    expect(shelf.completeCount).toBe(1);
  });

  test("right after a reset nothing counts: every finished episode is earlier, the next one is episode 1", () => {
    const stories = [
      story("old-1", { minute: 1, series: blubbert.id, episode: 1 }),
      story("old-2", { minute: 2, series: blubbert.id, episode: 2 }),
      story("failed-after", { minute: 5, series: blubbert.id, status: "error" }),
    ];
    const [shelf] = buildSeriesShelves(stories, [{ ...blubbert, episodeCount: 0 }]);
    expect(shelf.episodes.map((entry) => entry.id)).toEqual(["failed-after"]);
    expect(shelf.earlier.map((entry) => entry.id)).toEqual(["old-1", "old-2"]);
    expect(shelf.nextEpisode).toBe(1);
    expect(shelf.firstUnreadIndex).toBe(-1);
  });

  test("a first attempt that failed is not an earlier run", () => {
    const [shelf] = buildSeriesShelves([story("failed", { minute: 1, series: blubbert.id, status: "error" })], [{ ...blubbert, episodeCount: 0 }]);
    expect(shelf.episodes.map((entry) => entry.id)).toEqual(["failed"]);
    expect(shelf.earlier).toEqual([]);
  });

  test("without the catalogue the next episode follows the highest known one; a series no longer offered cannot continue", () => {
    const stories = [story("b1", { minute: 1, series: blubbert.id, episode: 1, figures: ["Blubbert", "Pia"] }), story("b2", { minute: 2, series: blubbert.id, episode: 2, figures: ["Pia", "Blubbert"] }), story("b3", { minute: 3, series: blubbert.id, figures: ["Blubbert"] })];
    const [unknown] = buildSeriesShelves(stories, null);
    expect(unknown.nextEpisode).toBe(4);
    expect(unknown.title).toBe("Blubbert");
    expect(unknown.portraitUrl).toBe("/Blubbert.webp");
    const [retired] = buildSeriesShelves(stories, [nebelfee]);
    expect(retired.nextEpisode).toBeNull();
  });

  test("the billboard shows the newest unread story, else the newest finished one", () => {
    const stories = [
      story("read-new", { minute: 30, read: true }),
      story("unread-old", { minute: 10 }),
      story("writing", { minute: 40, status: "generating" }),
      story("failed", { minute: 50, status: "error" }),
    ];
    expect(pickFeaturedStory(stories)?.id).toBe("unread-old");
    expect(pickFeaturedStory(stories.filter((entry) => entry.id !== "unread-old"))?.id).toBe("read-new");
    expect(pickFeaturedStory([story("writing", { minute: 1, status: "generating" })])).toBeUndefined();
  });

  test("for a series the billboard offers the first unread episode, not the newest one", () => {
    const stories = [
      story("b1", { minute: 1, series: blubbert.id, episode: 1, read: true }),
      story("b2", { minute: 2, series: blubbert.id, episode: 2 }),
      story("b3", { minute: 3, series: blubbert.id, episode: 3 }),
      story("free-old", { minute: 0 }),
    ];
    const shelves = buildSeriesShelves(stories, [blubbert]);
    expect(pickFeaturedStory(stories, shelves)?.id).toBe("b2");
    expect(pickFeaturedStory(stories)?.id).toBe("b3");
  });

  test("the next episode opens the wizard with series, avatars and world", () => {
    expect(seriesStoryPath({ seriesId: "nebelfee", avatarIds: ["a", "b", "c", "d"], genre: "fairy_tales" })).toBe("/story?series=nebelfee&avatars=a%2Cb%2Cc&tags=fairy-tales");
    expect(seriesStoryPath({ seriesId: "graf-griesgram", genre: "something-new" })).toBe("/story?series=graf-griesgram");
    expect(wizardCategoryOf("fairy-tales")).toBe("fairy-tales");
    expect(wizardCategoryOf("Magic")).toBe("magic");
  });

  test("names read like a sentence", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["Mia"])).toBe("Mia");
    expect(joinNames(["Mia", "Tom", "Mia"])).toBe("Mia und Tom");
    expect(joinNames(["Mia", "Tom", "Ben"])).toBe("Mia, Tom und Ben");
    expect(joinNames(["Mia", "Tom", "Ben", "Ida"])).toBe("Mia, Tom, Ben und 1 weiterer");
  });

  test("the new badge is for finished, unread stories of the last week", () => {
    const now = BASE + 60 * 60_000;
    expect(isNewStory(story("fresh", { minute: 1 }), now)).toBe(true);
    expect(isNewStory(story("read", { minute: 1, read: true }), now)).toBe(false);
    expect(isNewStory(story("writing", { minute: 1, status: "generating" }), now)).toBe(false);
    expect(isNewStory(story("old", { minute: -8 * 24 * 60 }), now)).toBe(false);
  });
});
