import type { Avatar, Character, Story } from "../../../types/story";
import type { CharacterSeriesChoice } from "../wizard-steps/StepCharacterSeries";

/**
 * How the library shelves a family's stories: a Figurenserie is one shelf with its episodes in order (like a Talea
 * Original), every other story stands on its own. Pure functions, so the stories page and the series page agree.
 */
export const CHARACTER_SERIES_ENGINE = "character-series-v1";

const NEW_FOR_MS = 7 * 24 * 60 * 60 * 1000;

export const storyTime = (story: Pick<Story, "createdAt">): number => {
  const value = Date.parse(story.createdAt);
  return Number.isFinite(value) ? value : 0;
};
const byOldest = (a: Story, b: Story) => storyTime(a) - storyTime(b) || a.id.localeCompare(b.id);
const byNewest = (a: Story, b: Story) => byOldest(b, a);

export function seriesIdOf(story: Story): string | null {
  if (story.config?.storybookEngine !== CHARACTER_SERIES_ENGINE) return null;
  const id = (story.config.characterSeriesId || story.metadata?.characterSeries?.id || "").trim();
  return id || null;
}

export function seriesEpisodeOf(story: Story): number | null {
  const series = story.metadata?.characterSeries;
  const episode = series?.episode ?? series?.log?.episode;
  return typeof episode === "number" && Number.isSafeInteger(episode) && episode > 0 ? episode : null;
}

export const isStoryRead = (story: Story): boolean => story.profileState?.completionState === "completed";

/** Finished, not read by this profile yet and from the last week: gets the "Neu" badge. */
export function isNewStory(story: Story, now = Date.now()): boolean {
  return story.status === "complete" && !isStoryRead(story) && now - storyTime(story) < NEW_FOR_MS;
}

export interface SeriesShelf {
  id: string;
  /** Series title from the catalogue ("Kapitän Blubbert und die Insel ohne Karte"). */
  title: string;
  /** The recurring figure ("Kapitän Blubbert"). */
  characterName?: string;
  description?: string;
  portraitUrl?: string;
  coverImageUrl?: string;
  /** World of the newest episode, so the next one starts in the same one. */
  genre: string | null;
  /** The episodes that continue the series, oldest first (finished, failed and the one being written). */
  episodes: Story[];
  /** Episodes from before an admin reset or an older timeline: still readable, no longer continued. */
  earlier: Story[];
  generating?: Story;
  /** null when the series cannot be continued (no longer offered). */
  nextEpisode: number | null;
  /** The children's avatars who played along, newest episode first. */
  avatars: Avatar[];
  /** Avatars of the newest episode: the next episode starts with them. */
  lastAvatarIds: string[];
  /** The recurring figure first, then everyone the avatars met. */
  figures: Character[];
  updatedAt: number;
  completeCount: number;
  readCount: number;
  unreadCount: number;
  /** Index into `episodes` of the first finished episode not read yet; -1 when everything is read. */
  firstUnreadIndex: number;
}

/**
 * After an admin reset only the newest `counted` finished episodes continue the series (the server counts them, see
 * character-series/repository.ts). Everything before the first of them belongs to an earlier run; a story that is still
 * being written always belongs to the current one.
 */
export function splitSeriesRuns(stories: Story[], counted: number | undefined): { current: Story[]; earlier: Story[] } {
  const all = [...stories].sort(byOldest);
  const complete = all.filter((story) => story.status === "complete");
  if (counted === undefined || counted >= complete.length) return { current: all, earlier: [] };
  const cutoff = counted > 0 ? storyTime(complete[complete.length - counted]) : storyTime(complete[complete.length - 1]) + 1;
  const current = all.filter((story) => story.status === "generating" || storyTime(story) >= cutoff);
  return { current, earlier: all.filter((story) => !current.includes(story)) };
}

function uniqueById<T extends { id: string }>(items: Array<T | undefined | null>): T[] {
  const seen = new Map<string, T>();
  for (const item of items) if (item?.id && !seen.has(item.id)) seen.set(item.id, item);
  return [...seen.values()];
}

/** The figure in the most episodes is the series' lead; the catalogue names it when it is available. */
function seriesFigures(stories: Story[], leadId?: string): Character[] {
  const counts = new Map<string, number>();
  for (const story of stories) for (const figure of uniqueById(story.config?.characters ?? [])) counts.set(figure.id, (counts.get(figure.id) ?? 0) + 1);
  const figures = uniqueById(stories.flatMap((story) => story.config?.characters ?? []));
  const lead = leadId && counts.has(leadId) ? leadId : [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  return [...figures.filter((figure) => figure.id === lead), ...figures.filter((figure) => figure.id !== lead)];
}

export function buildSeriesShelves(stories: Story[], catalogue: CharacterSeriesChoice[] | null): SeriesShelf[] {
  const groups = new Map<string, Story[]>();
  for (const story of stories) {
    const id = seriesIdOf(story);
    if (!id) continue;
    const group = groups.get(id) ?? [];
    group.push(story);
    groups.set(id, group);
  }
  const catalogueById = new Map((catalogue ?? []).map((entry) => [entry.id, entry]));

  const shelves = [...groups].map(([id, group]): SeriesShelf => {
    const entry = catalogueById.get(id);
    const { current, earlier } = splitSeriesRuns(group, entry?.episodeCount);
    const all = [...earlier, ...current];
    const complete = current.filter((story) => story.status === "complete");
    const newest = [...all].sort(byNewest)[0];
    const lastComplete = complete[complete.length - 1];
    const newestFirst = [...current].reverse();
    const figures = seriesFigures(all, entry?.characterId);
    const lead = figures[0];
    const highestEpisode = Math.max(0, ...complete.map((story) => seriesEpisodeOf(story) ?? 0));
    const lastAvatars = (lastComplete ?? newest)?.config?.avatars?.map((avatar) => avatar.id) ?? [];
    return {
      id,
      title: entry?.title ?? lead?.name ?? "Figurenabenteuer",
      characterName: entry?.characterName ?? lead?.name,
      description: entry?.description,
      portraitUrl: entry?.imageUrl || lead?.imageUrl || undefined,
      coverImageUrl: [...complete].reverse().find((story) => story.coverImageUrl)?.coverImageUrl
        ?? [...all].reverse().find((story) => story.coverImageUrl)?.coverImageUrl,
      genre: (lastComplete ?? newest)?.config?.genre || entry?.genres?.[0] || null,
      episodes: current,
      earlier,
      generating: newestFirst.find((story) => story.status === "generating"),
      // Unknown catalogue (offline, failed request): continue after the highest episode we know of.
      nextEpisode: catalogue === null ? Math.max(highestEpisode, complete.length) + 1 : entry ? entry.episodeCount + 1 : null,
      avatars: uniqueById(newestFirst.flatMap((story) => story.config?.avatars ?? [])),
      lastAvatarIds: lastAvatars.length ? lastAvatars : (newest?.config?.avatarIds ?? []),
      figures,
      updatedAt: newest ? storyTime(newest) : 0,
      completeCount: complete.length,
      readCount: complete.filter(isStoryRead).length,
      unreadCount: complete.filter((story) => !isStoryRead(story)).length,
      firstUnreadIndex: current.findIndex((story) => story.status === "complete" && !isStoryRead(story)),
    };
  });
  return shelves.sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title, "de"));
}

/** Figurenserie episodes live on their series shelf; everything else is a story of its own. */
export function freeStoriesOf(stories: Story[]): Story[] {
  return stories.filter((story) => !seriesIdOf(story));
}

/**
 * The billboard: the newest finished story this profile has not read, else the newest finished one. A series is read in
 * order, so for a series episode it is the series' first unread episode instead of the newest one.
 */
export function pickFeaturedStory(stories: Story[], shelves: SeriesShelf[] = []): Story | undefined {
  const complete = stories.filter((story) => story.status === "complete").sort(byNewest);
  const pick = complete.find((story) => !isStoryRead(story)) ?? complete[0];
  const seriesId = pick ? seriesIdOf(pick) : null;
  const shelf = seriesId ? shelves.find((entry) => entry.id === seriesId) : undefined;
  if (pick && shelf && !isStoryRead(pick) && shelf.firstUnreadIndex >= 0) return shelf.episodes[shelf.firstUnreadIndex];
  return pick;
}

const WIZARD_CATEGORIES: Record<string, string> = {
  fairy_tales: "fairy-tales",
  fairytale: "fairy-tales",
  fairy_tale: "fairy-tales",
  adventure: "adventure",
  magic: "magic",
  animals: "animals",
  scifi: "scifi",
  modern: "modern",
};

/** The story world as the wizard names it ("fairy_tales" → "fairy-tales"). */
export function wizardCategoryOf(genre?: string | null): string | null {
  return WIZARD_CATEGORIES[(genre || "").trim().toLowerCase().replace(/-/g, "_")] ?? null;
}

/** Opens the wizard with the series, its avatars and its world already chosen. */
export function seriesStoryPath(input: { seriesId: string; avatarIds?: string[]; genre?: string | null }): string {
  const params = new URLSearchParams({ series: input.seriesId });
  const avatars = (input.avatarIds ?? []).filter(Boolean).slice(0, 3);
  if (avatars.length) params.set("avatars", avatars.join(","));
  const category = wizardCategoryOf(input.genre);
  if (category) params.set("tags", category);
  return `/story?${params.toString()}`;
}

export const seriesPagePath = (seriesId: string) => `/stories/series/${encodeURIComponent(seriesId)}`;

/** "Mia", "Mia und Tom", "Mia, Tom und Ben", "Mia, Tom, Ben und 2 weitere". */
export function joinNames(names: string[], max = 3): string {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  if (unique.length <= 1) return unique[0] ?? "";
  if (unique.length <= max) return `${unique.slice(0, -1).join(", ")} und ${unique[unique.length - 1]}`;
  const rest = unique.length - max;
  return `${unique.slice(0, max).join(", ")} und ${rest} ${rest === 1 ? "weiterer" : "weitere"}`;
}

export const episodeWord = (count: number) => `${count} ${count === 1 ? "Folge" : "Folgen"}`;
