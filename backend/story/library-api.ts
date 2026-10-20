/**
 * Talea library API (mode 1): pre-produced series for every child.
 *
 * Readers: shelves, series pages, the episode reader, progress and the
 * collection of collectibles per child profile. Admins: the cast of a series
 * (edit, extend, draw reference pictures), the episode plan (own ideas, new
 * episodes), background generation, picture redraws, review and release.
 */

import { api, APIError, type Query } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { getAuthData } from "~encore/auth";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureAdmin } from "../admin/authz";
import { resolveRequestedProfileId } from "../helpers/profiles";
import { resolvePlanForUser } from "../helpers/billing";
import { maybeUploadImageUrlToBucket, resolveImageUrlForClient } from "../helpers/bucket-storage";
import { CostLedger, withServiceTier } from "./storybook/llm";
import { createOpenRouterStorybookLlm } from "./storybook/llm-openrouter";
import { LIBRARY_MODELS, generateEpisodeText, type CanonEntry, type EpisodeBrief } from "./library/engine";
import { createRunwareCaller, drawPortrait, LIBRARY_IMAGE_MODEL, type ReferenceLoader } from "./library/images";
import { illustrateEpisode, redrawPicture, type IllustrationContext, type SlotRef } from "./library/production";
import { nextReleaseSlot } from "./library/schedule";
import {
  ensureLibrary,
  getBible,
  getCharacter,
  getEpisode,
  getSeries,
  isVisible,
  listAllEpisodes,
  listCharacters,
  listEpisodes,
  listProgress,
  listSeries,
  saveCharacter,
  saveEpisodeState,
  saveProgress,
  createEpisode,
  updateEpisodePlan,
  type CharacterRecord,
  type EpisodeRecord,
  type GenerationInfo,
  type ProgressRecord,
  type SeriesRecord,
} from "./library/store";
import type { CharacterRole, Collectible, EpisodeContent, SeriesCharacter } from "./library/types";

const runwareApiKey = secret("RunwareApiKey");

/** A generation that has not reported for this long died with its process (deploy, crash). */
const STALE_GENERATION_MS = 25 * 60 * 1000;
const NEW_FOR_DAYS = 8;
const WORDS_PER_MINUTE = 140;

/* ── Response shapes (declared in full: Encore drops undeclared fields) ── */

export interface LibraryCollectible {
  type: string;
  title: string;
  imageUrl?: string;
  fields: Array<{ label: string; value: string }>;
}

export interface LibraryCharacter {
  id: string;
  name: string;
  role: string;
  ageYears?: number;
  personality: string;
  speechStyle: string;
  imageUrl?: string;
}

export interface LibraryAdminCharacter extends LibraryCharacter {
  visualProfileEn: string;
  allowedInBranches: boolean;
  active: boolean;
  origin: string;
  referenceStripKey: string;
}

export type EpisodeState = "planned" | "generating" | "in_review" | "scheduled" | "published" | "failed";

export interface LibraryEpisodeCard {
  id: string;
  seriesId: string;
  season: number;
  episode: number;
  title: string;
  summary: string;
  coverImageUrl?: string;
  publishAt?: string;
  readingMinutes: number;
  isNew: boolean;
  locked: boolean;
  available: boolean;
  progress: "new" | "started" | "finished";
  chapterIndex: number;
  /** Admins only: where the episode stands in production. */
  state?: EpisodeState;
}

export interface LibrarySeriesCard {
  id: string;
  slug: string;
  title: string;
  logline: string;
  genre: string;
  ageBand: string;
  coverImageUrl?: string;
  collectibleType: string;
  collectibleName: string;
  releaseLabel: string;
  episodeCount: number;
  plannedCount: number;
  newCount: number;
  finishedCount: number;
  nextRelease?: string;
  seasonTitle?: string;
  /** Where this child continues: the started episode, else the first unread one, else episode 1 again. */
  readNext?: { episodeId: string; label: string };
}

export interface LibraryShelvesResponse {
  series: LibrarySeriesCard[];
  continueReading: Array<{ seriesTitle: string; seriesSlug: string; episode: LibraryEpisodeCard }>;
  newEpisodes: Array<{ seriesTitle: string; seriesSlug: string; episode: LibraryEpisodeCard }>;
  collectedCount: number;
  isAdmin: boolean;
}

export interface LibrarySeriesResponse {
  series: LibrarySeriesCard;
  characters: LibraryCharacter[];
  episodes: LibraryEpisodeCard[];
  isAdmin: boolean;
}

export interface LibraryEpisodeResponse {
  id: string;
  seriesId: string;
  seriesSlug: string;
  seriesTitle: string;
  season: number;
  episode: number;
  title: string;
  summary: string;
  coverImageUrl?: string;
  readingMinutes: number;
  chapters: Array<{ title: string; text: string; imageUrl?: string; afterParagraph?: number }>;
  collectible: LibraryCollectible;
  teaser: string;
  cast: LibraryCharacter[];
  progress: { chapterIndex: number; finished: boolean };
  nextEpisode?: { id: string; title: string; available: boolean; publishAt?: string };
  previousEpisodeId?: string;
  state?: EpisodeState;
}

export interface LibraryProgressResponse {
  finishedNow: boolean;
  collectible?: LibraryCollectible;
}

export interface LibraryCollectionResponse {
  items: Array<{
    episodeId: string;
    seriesSlug: string;
    seriesTitle: string;
    episodeTitle: string;
    season: number;
    episode: number;
    finishedAt: string;
    collectible: LibraryCollectible;
  }>;
  total: number;
}

export interface LibraryAdminEpisode extends LibraryEpisodeCard {
  logline: string;
  idea?: string;
  plan: { fields: Record<string, string>; clue: string };
  state: EpisodeState;
  hasContent: boolean;
  generation: {
    source?: string;
    step?: string;
    startedAt?: string;
    finishedAt?: string;
    error?: string;
    costUSD?: number;
    writes?: number;
    issues?: string[];
  };
  scores?: { dimensions: Record<string, number>; mustFix: string[]; notes: string[]; passed: boolean };
}

export interface LibraryAdminSeriesResponse {
  series: LibrarySeriesCard;
  bibleVersion: number;
  bible: {
    setting: string;
    tone: string;
    rules: string[];
    runningGags: string[];
    catchphrases: string[];
    episodeFormula: string[];
    canonInvariants: string[];
    forbiddenTopics: string[];
    seasons: Array<{ season: number; title: string; mystery: string }>;
    imageStyleEn: string;
  };
  characters: LibraryAdminCharacter[];
  episodes: LibraryAdminEpisode[];
  models: { writer: string; support: string; critic: string; image: string };
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

const COLLECTIBLE_NAMES: Record<string, string> = { flunker_card: "Flunker-Karten", monster_profile: "Monster-Steckbriefe" };
const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function auth() {
  const data = getAuthData();
  if (!data) throw APIError.unauthenticated("authentication required");
  return data;
}

async function resolveImage(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  if (url.startsWith("/")) return url;
  return (await resolveImageUrlForClient(url)) || url;
}

async function profileFor(requested?: string): Promise<{ userId: string; profileId: string; isAdmin: boolean; clerkToken: string }> {
  const data = auth();
  const profileId = await resolveRequestedProfileId({ userId: data.userID, requestedProfileId: requested, fallbackName: data.email ?? undefined });
  return { userId: data.userID, profileId, isAdmin: data.role === "admin", clerkToken: data.clerkToken };
}

/** Free accounts read the first episodes of every series (concept: free plan = first 2 episodes); everything else is unlocked. */
async function freePlan(userId: string, clerkToken: string, isAdmin: boolean): Promise<boolean> {
  if (isAdmin) return false;
  try {
    return (await resolvePlanForUser(userId, clerkToken)) === "free";
  } catch {
    return true;
  }
}

function readingMinutes(content: EpisodeContent | null): number {
  if (!content) return 0;
  const words = content.chapters.reduce((sum, chapter) => sum + chapter.text.split(/\s+/).filter(Boolean).length, 0);
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

function generationIsStale(episode: EpisodeRecord): boolean {
  const started = episode.generation.startedAt ? Date.parse(episode.generation.startedAt) : 0;
  return episode.status === "generating" && (!started || Date.now() - started > STALE_GENERATION_MS);
}

function stateOf(episode: EpisodeRecord): EpisodeState {
  if (episode.status === "generating") return generationIsStale(episode) ? "failed" : "generating";
  if (episode.status === "approved" || episode.status === "published") {
    return episode.publishAt && episode.publishAt.getTime() <= Date.now() ? "published" : "scheduled";
  }
  if (episode.status === "in_review" || episode.status === "failed" || episode.status === "planned") return episode.status;
  return "planned";
}

function releaseLabel(info: SeriesRecord["info"]): string {
  const day = WEEKDAYS[info.releaseCadence.weekday] ?? "Freitag";
  return `Jeden ${day}, ${info.releaseCadence.hourLocal} Uhr`;
}

async function collectibleView(collectible: Collectible): Promise<LibraryCollectible> {
  return { type: collectible.type, title: collectible.title, imageUrl: await resolveImage(collectible.imageUrl), fields: collectible.fields };
}

async function characterView(character: SeriesCharacter): Promise<LibraryCharacter> {
  return {
    id: character.id,
    name: character.name,
    role: character.role,
    ...(character.ageYears ? { ageYears: character.ageYears } : {}),
    personality: character.personality,
    speechStyle: character.speechStyle,
    imageUrl: await resolveImage(character.referenceStripKey),
  };
}

async function adminCharacterView(character: CharacterRecord): Promise<LibraryAdminCharacter> {
  return {
    ...(await characterView(character)),
    visualProfileEn: character.visualProfileEn,
    allowedInBranches: character.allowedInBranches,
    active: character.active,
    origin: character.origin,
    referenceStripKey: character.referenceStripKey,
  };
}

interface CardContext {
  progress: Map<string, ProgressRecord>;
  locked: (episode: EpisodeRecord, visibleIndex: number) => boolean;
  isAdmin: boolean;
}

async function episodeCard(episode: EpisodeRecord, visibleIndex: number, context: CardContext): Promise<LibraryEpisodeCard> {
  const progress = context.progress.get(episode.id);
  const visible = isVisible(episode);
  const fresh = visible && episode.publishAt ? Date.now() - episode.publishAt.getTime() < NEW_FOR_DAYS * 86_400_000 : false;
  const locked = visible && context.locked(episode, visibleIndex);
  return {
    id: episode.id,
    seriesId: episode.seriesId,
    season: episode.season,
    episode: episode.episode,
    title: episode.content?.title || episode.title,
    summary: episode.content?.summary || episode.logline,
    coverImageUrl: await resolveImage(episode.content?.cover.url),
    publishAt: episode.publishAt?.toISOString(),
    readingMinutes: readingMinutes(episode.content),
    isNew: fresh && !progress,
    locked,
    available: (visible && !locked) || (context.isAdmin && Boolean(episode.content)),
    progress: progress?.finishedAt ? "finished" : progress ? "started" : "new",
    chapterIndex: progress?.chapterIndex ?? 0,
    ...(context.isAdmin ? { state: stateOf(episode) } : {}),
  };
}

async function seriesCard(series: SeriesRecord, episodes: EpisodeRecord[], progress: Map<string, ProgressRecord>): Promise<LibrarySeriesCard> {
  const visible = episodes.filter((episode) => isVisible(episode));
  const upcoming = episodes
    .filter((episode) => (episode.status === "approved" || episode.status === "published") && episode.publishAt && episode.publishAt.getTime() > Date.now())
    .sort((a, b) => a.publishAt!.getTime() - b.publishAt!.getTime())[0];
  const arc = (await getBible(series.info.id, series.activeBibleVersion))?.seasonArcs[0];
  return {
    id: series.info.id,
    slug: series.info.slug,
    title: series.info.title,
    logline: series.info.logline,
    genre: series.info.genre,
    ageBand: series.info.ageBand,
    coverImageUrl: await resolveImage(series.info.coverImageUrl),
    collectibleType: series.info.collectibleType,
    collectibleName: COLLECTIBLE_NAMES[series.info.collectibleType] ?? "Sammelkarten",
    releaseLabel: releaseLabel(series.info),
    episodeCount: visible.length,
    plannedCount: episodes.length,
    newCount: visible.filter((episode) => !progress.has(episode.id) && Date.now() - episode.publishAt!.getTime() < NEW_FOR_DAYS * 86_400_000).length,
    finishedCount: visible.filter((episode) => progress.get(episode.id)?.finishedAt).length,
    nextRelease: upcoming?.publishAt?.toISOString(),
    seasonTitle: arc?.title,
    ...(readNextOf(visible, progress) ? { readNext: readNextOf(visible, progress)! } : {}),
  };
}

function readNextOf(visible: EpisodeRecord[], progress: Map<string, ProgressRecord>): { episodeId: string; label: string } | null {
  if (!visible.length) return null;
  const started = visible.find((episode) => progress.has(episode.id) && !progress.get(episode.id)!.finishedAt);
  if (started) return { episodeId: started.id, label: `Weiterlesen: Folge ${started.episode}` };
  const unread = visible.find((episode) => !progress.has(episode.id));
  if (unread) return { episodeId: unread.id, label: `Folge ${unread.episode} lesen` };
  return { episodeId: visible[0].id, label: "Noch einmal von vorn" };
}

function lockRule(series: SeriesRecord, isFree: boolean) {
  return (_episode: EpisodeRecord, visibleIndex: number) => isFree && visibleIndex >= series.info.freeEpisodeCount;
}

async function requireSeries(slug: string): Promise<SeriesRecord> {
  const series = await getSeries(slug);
  if (!series) throw APIError.notFound("Reihe nicht gefunden");
  return series;
}

/* ── Reader endpoints ──────────────────────────────────────────────────── */

export const libraryShelves = api<{ profileId?: Query<string> }, LibraryShelvesResponse>(
  { expose: true, method: "GET", path: "/library/shelves", auth: true },
  async (req) => {
    await ensureLibrary();
    const { userId, profileId, isAdmin, clerkToken } = await profileFor(req.profileId);
    const [allSeries, allEpisodes, progressRows, isFree] = await Promise.all([listSeries(), listAllEpisodes(), listProgress(profileId), freePlan(userId, clerkToken, isAdmin)]);
    const progress = new Map(progressRows.map((row) => [row.episodeId, row]));
    const series: LibrarySeriesCard[] = [];
    const continueReading: LibraryShelvesResponse["continueReading"] = [];
    const newEpisodes: LibraryShelvesResponse["newEpisodes"] = [];

    for (const entry of allSeries) {
      const episodes = allEpisodes.filter((episode) => episode.seriesId === entry.info.id);
      series.push(await seriesCard(entry, episodes, progress));
      const visible = episodes.filter((episode) => isVisible(episode));
      const context: CardContext = { progress, locked: lockRule(entry, isFree), isAdmin: false };
      for (const [index, episode] of visible.entries()) {
        const card = await episodeCard(episode, index, context);
        const row = progress.get(episode.id);
        if (row && !row.finishedAt && !card.locked) continueReading.push({ seriesTitle: entry.info.title, seriesSlug: entry.info.slug, episode: card });
        if (card.isNew && !card.locked) newEpisodes.push({ seriesTitle: entry.info.title, seriesSlug: entry.info.slug, episode: card });
      }
    }
    continueReading.sort((a, b) => (progress.get(b.episode.id)?.updatedAt.getTime() ?? 0) - (progress.get(a.episode.id)?.updatedAt.getTime() ?? 0));
    newEpisodes.sort((a, b) => Date.parse(b.episode.publishAt || "") - Date.parse(a.episode.publishAt || ""));
    return {
      series,
      continueReading: continueReading.slice(0, 10),
      newEpisodes: newEpisodes.slice(0, 10),
      collectedCount: progressRows.filter((row) => row.finishedAt).length,
      isAdmin,
    };
  }
);

export const librarySeries = api<{ slug: string; profileId?: Query<string> }, LibrarySeriesResponse>(
  { expose: true, method: "GET", path: "/library/series/:slug", auth: true },
  async (req) => {
    await ensureLibrary();
    const series = await requireSeries(req.slug);
    const { userId, profileId, isAdmin, clerkToken } = await profileFor(req.profileId);
    const [episodes, progressRows, characters, isFree] = await Promise.all([
      listEpisodes(series.info.id),
      listProgress(profileId),
      listCharacters(series.info.id, false),
      freePlan(userId, clerkToken, isAdmin),
    ]);
    const progress = new Map(progressRows.map((row) => [row.episodeId, row]));
    const context: CardContext = { progress, locked: lockRule(series, isFree), isAdmin };
    const cards: LibraryEpisodeCard[] = [];
    let visibleIndex = 0;
    for (const episode of episodes) {
      const visible = isVisible(episode);
      if (!visible && !isAdmin) continue;
      cards.push(await episodeCard(episode, visible ? visibleIndex : 0, context));
      if (visible) visibleIndex += 1;
    }
    return {
      series: await seriesCard(series, episodes, progress),
      // Season secrets stay hidden: a figure that only appears in the finale is not introduced on the series page.
      characters: await Promise.all(characters.filter((character) => character.allowedInBranches).map(characterView)),
      episodes: cards,
      isAdmin,
    };
  }
);

export const librarySeriesCharacters = api<{ slug: string }, { characters: LibraryCharacter[] }>(
  { expose: true, method: "GET", path: "/library/series/:slug/characters", auth: true },
  async (req) => {
    await ensureLibrary();
    const series = await requireSeries(req.slug);
    const characters = await listCharacters(series.info.id, false);
    return { characters: await Promise.all(characters.filter((character) => character.allowedInBranches).map(characterView)) };
  }
);

export const libraryEpisode = api<{ id: string; profileId?: Query<string> }, LibraryEpisodeResponse>(
  { expose: true, method: "GET", path: "/library/episodes/:id", auth: true },
  async (req) => {
    await ensureLibrary();
    const episode = await getEpisode(req.id);
    if (!episode?.content) throw APIError.notFound("Folge nicht gefunden");
    const series = await requireSeries(episode.seriesId);
    const { userId, profileId, isAdmin, clerkToken } = await profileFor(req.profileId);
    const episodes = await listEpisodes(series.info.id);
    const visible = episodes.filter((entry) => isVisible(entry));
    if (!isAdmin) {
      const index = visible.findIndex((entry) => entry.id === episode.id);
      if (index < 0) throw APIError.notFound("Folge nicht gefunden");
      if (lockRule(series, await freePlan(userId, clerkToken, isAdmin))(episode, index)) {
        throw APIError.permissionDenied("Diese Folge gibt es mit einem Abo.");
      }
    }
    const progressRows = await listProgress(profileId);
    const progress = progressRows.find((row) => row.episodeId === episode.id);
    const position = episodes.findIndex((entry) => entry.id === episode.id);
    const next = episodes.slice(position + 1).find((entry) => isAdmin ? Boolean(entry.content) || entry.status !== "planned" : isVisible(entry) || entry.status === "approved");
    const previous = [...episodes.slice(0, position)].reverse().find((entry) => isAdmin ? Boolean(entry.content) : isVisible(entry));
    const characters = await listCharacters(series.info.id, true);
    const content = episode.content;
    const inPictures = new Set([content.cover, ...content.chapters.map((chapter) => chapter.image)].flatMap((slot) => slot?.characterIds || []));
    const cast = characters.filter((character) => inPictures.has(character.id) && character.allowedInBranches);

    return {
      id: episode.id,
      seriesId: series.info.id,
      seriesSlug: series.info.slug,
      seriesTitle: series.info.title,
      season: episode.season,
      episode: episode.episode,
      title: content.title,
      summary: content.summary,
      coverImageUrl: await resolveImage(content.cover.url),
      readingMinutes: readingMinutes(content),
      chapters: await Promise.all(content.chapters.map(async (chapter) => ({
        title: chapter.title,
        text: chapter.text,
        imageUrl: await resolveImage(chapter.image?.url),
        ...(chapter.image && typeof chapter.image.afterParagraph === "number" ? { afterParagraph: chapter.image.afterParagraph } : {}),
      }))),
      collectible: await collectibleView(content.collectible),
      teaser: content.teaser,
      cast: await Promise.all(cast.map(characterView)),
      progress: { chapterIndex: progress?.chapterIndex ?? 0, finished: Boolean(progress?.finishedAt) },
      ...(next ? { nextEpisode: { id: next.id, title: next.content?.title || next.title, available: isAdmin ? Boolean(next.content) : isVisible(next), publishAt: next.publishAt?.toISOString() } } : {}),
      ...(previous ? { previousEpisodeId: previous.id } : {}),
      ...(isAdmin ? { state: stateOf(episode) } : {}),
    };
  }
);

export const saveLibraryProgress = api<{ episodeId: string; profileId?: string; chapterIndex: number; finished?: boolean }, LibraryProgressResponse>(
  { expose: true, method: "POST", path: "/library/progress", auth: true },
  async (req) => {
    await ensureLibrary();
    const { userId, profileId, isAdmin } = await profileFor(req.profileId);
    const episode = await getEpisode(req.episodeId);
    if (!episode?.content || (!isVisible(episode) && !isAdmin)) throw APIError.notFound("Folge nicht gefunden");
    const chapterIndex = Math.max(0, Math.min(episode.content.chapters.length - 1, Math.floor(Number(req.chapterIndex) || 0)));
    const finishedNow = await saveProgress({ profileId, userId, episodeId: episode.id, chapterIndex, finished: Boolean(req.finished) });
    return finishedNow ? { finishedNow, collectible: await collectibleView(episode.content.collectible) } : { finishedNow };
  }
);

export const libraryCollection = api<{ profileId?: Query<string> }, LibraryCollectionResponse>(
  { expose: true, method: "GET", path: "/library/collection", auth: true },
  async (req) => {
    await ensureLibrary();
    const { profileId } = await profileFor(req.profileId);
    const [progressRows, allEpisodes, allSeries] = await Promise.all([listProgress(profileId), listAllEpisodes(), listSeries()]);
    const finished = new Map(progressRows.filter((row) => row.finishedAt).map((row) => [row.episodeId, row.finishedAt!]));
    const items: LibraryCollectionResponse["items"] = [];
    for (const episode of allEpisodes) {
      const finishedAt = finished.get(episode.id);
      const series = allSeries.find((entry) => entry.info.id === episode.seriesId);
      if (!finishedAt || !episode.content || !series) continue;
      items.push({
        episodeId: episode.id,
        seriesSlug: series.info.slug,
        seriesTitle: series.info.title,
        episodeTitle: episode.content.title,
        season: episode.season,
        episode: episode.episode,
        finishedAt: finishedAt.toISOString(),
        collectible: await collectibleView(episode.content.collectible),
      });
    }
    return { items, total: allEpisodes.filter((episode) => isVisible(episode)).length };
  }
);

/* ── Admin: series, cast, plan ─────────────────────────────────────────── */

async function adminEpisodeView(episode: EpisodeRecord, index: number): Promise<LibraryAdminEpisode> {
  const card = await episodeCard(episode, index, { progress: new Map(), locked: () => false, isAdmin: true });
  const state = stateOf(episode);
  const generation = episode.generation;
  return {
    ...card,
    state,
    logline: episode.logline,
    ...(episode.idea ? { idea: episode.idea } : {}),
    plan: { fields: episode.plan.fields || {}, clue: episode.plan.clue || "" },
    hasContent: Boolean(episode.content),
    generation: {
      source: generation.source,
      step: generation.step,
      startedAt: generation.startedAt,
      finishedAt: generation.finishedAt,
      error: state === "failed" && !generation.error ? "Die Erzeugung wurde unterbrochen (z. B. durch ein Deployment). Bitte neu starten." : generation.error,
      costUSD: generation.costUSD,
      writes: generation.writes,
      issues: generation.issues,
    },
    ...(episode.scores ? { scores: episode.scores } : {}),
  };
}

export const libraryAdminSeries = api<{ slug: string }, LibraryAdminSeriesResponse>(
  { expose: true, method: "GET", path: "/library/admin/series/:slug", auth: true },
  async (req) => {
    ensureAdmin();
    await ensureLibrary();
    const series = await requireSeries(req.slug);
    const [episodes, characters, bible] = await Promise.all([
      listEpisodes(series.info.id),
      listCharacters(series.info.id, true),
      getBible(series.info.id, series.activeBibleVersion),
    ]);
    if (!bible) throw APIError.internal("Serien-Bibel fehlt");
    return {
      series: await seriesCard(series, episodes, new Map()),
      bibleVersion: bible.version,
      bible: {
        setting: bible.world.setting,
        tone: bible.world.tone,
        rules: bible.world.rules,
        runningGags: bible.runningGags,
        catchphrases: bible.catchphrases,
        episodeFormula: bible.episodeFormula,
        canonInvariants: bible.canonInvariants,
        forbiddenTopics: bible.forbiddenTopics,
        seasons: bible.seasonArcs.map((arc) => ({ season: arc.season, title: arc.title, mystery: arc.mystery })),
        imageStyleEn: bible.imageStyleEn,
      },
      characters: await Promise.all(characters.map(adminCharacterView)),
      episodes: await Promise.all(episodes.map((episode, index) => adminEpisodeView(episode, index))),
      models: { writer: LIBRARY_MODELS.writer, support: LIBRARY_MODELS.support, critic: LIBRARY_MODELS.critic, image: LIBRARY_IMAGE_MODEL },
    };
  }
);

interface CharacterInput {
  name: string;
  role: CharacterRole;
  ageYears?: number;
  personality: string;
  speechStyle: string;
  visualProfileEn: string;
  allowedInBranches?: boolean;
}

export interface LibraryCreateCharacterRequest {
  slug: string;
  name: string;
  role: CharacterRole;
  ageYears?: number;
  personality: string;
  speechStyle: string;
  visualProfileEn: string;
  allowedInBranches?: boolean;
}

export interface LibraryUpdateCharacterRequest {
  slug: string;
  characterId: string;
  name?: string;
  role?: CharacterRole;
  ageYears?: number;
  personality?: string;
  speechStyle?: string;
  visualProfileEn?: string;
  allowedInBranches?: boolean;
  active?: boolean;
}

const ROLES: CharacterRole[] = ["protagonist", "sidekick", "antagonist", "recurring"];

function cleanCharacterInput(input: CharacterInput): CharacterInput {
  const name = String(input.name || "").trim();
  if (!name) throw APIError.invalidArgument("Name fehlt");
  if (!String(input.visualProfileEn || "").trim()) throw APIError.invalidArgument("Aussehen (Englisch) fehlt — daraus entsteht das Referenzbild.");
  return {
    name: name.slice(0, 80),
    role: ROLES.includes(input.role) ? input.role : "recurring",
    ...(Number(input.ageYears) > 0 ? { ageYears: Math.round(Number(input.ageYears)) } : {}),
    personality: String(input.personality || "").trim().slice(0, 800),
    speechStyle: String(input.speechStyle || "").trim().slice(0, 500),
    visualProfileEn: String(input.visualProfileEn).trim().slice(0, 600),
    allowedInBranches: input.allowedInBranches !== false,
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "figur";
}

export const libraryAdminCreateCharacter = api<LibraryCreateCharacterRequest, LibraryAdminCharacter>(
  { expose: true, method: "POST", path: "/library/admin/series/:slug/characters", auth: true },
  async (req) => {
    ensureAdmin();
    await ensureLibrary();
    const series = await requireSeries(req.slug);
    const input = cleanCharacterInput(req);
    const existing = new Set((await listCharacters(series.info.id, true)).map((character) => character.id));
    let id = slugify(input.name);
    for (let suffix = 2; existing.has(id); suffix += 1) id = `${slugify(input.name)}-${suffix}`;
    await saveCharacter(series.info.id, { id, ...input, referenceStripKey: "", allowedInBranches: input.allowedInBranches ?? true }, true);
    return adminCharacterView((await getCharacter(series.info.id, id))!);
  }
);

export const libraryAdminUpdateCharacter = api<LibraryUpdateCharacterRequest, LibraryAdminCharacter>(
  { expose: true, method: "PUT", path: "/library/admin/series/:slug/characters/:characterId", auth: true },
  async (req) => {
    ensureAdmin();
    await ensureLibrary();
    const series = await requireSeries(req.slug);
    const current = await getCharacter(series.info.id, req.characterId);
    if (!current) throw APIError.notFound("Figur nicht gefunden");
    const input = cleanCharacterInput({
      name: req.name ?? current.name,
      role: req.role ?? current.role,
      ageYears: req.ageYears ?? current.ageYears,
      personality: req.personality ?? current.personality,
      speechStyle: req.speechStyle ?? current.speechStyle,
      visualProfileEn: req.visualProfileEn ?? current.visualProfileEn,
      allowedInBranches: req.allowedInBranches ?? current.allowedInBranches,
    });
    const { active: _active, sortOrder, origin: _origin, ...base } = current;
    await saveCharacter(series.info.id, { ...base, ...input, allowedInBranches: input.allowedInBranches ?? true }, req.active ?? current.active, sortOrder);
    return adminCharacterView((await getCharacter(series.info.id, current.id))!);
  }
);

/* Reference pictures of the seed live in the web app (frontend/public/library). */
const KNOWN_ASSET_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*(talea\.website|up\.railway\.app)$|^http:\/\/localhost(:\d+)?$/i;

function referenceLoader(assetOrigin?: string): ReferenceLoader {
  const origins = [process.env.TALEA_ASSET_ORIGIN, assetOrigin && KNOWN_ASSET_ORIGIN.test(assetOrigin) ? assetOrigin : undefined, "https://www.talea.website"]
    .filter((origin): origin is string => Boolean(origin));
  return async (url) => {
    if (url.startsWith("data:")) return Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
    if (url.startsWith("/")) {
      const relative = url.replace(/^\/+/, "");
      for (const root of [join(process.cwd(), "..", "frontend", "public"), join(process.cwd(), "frontend", "public"), join(process.cwd(), "frontend", "dist")]) {
        try {
          return await readFile(join(root, relative));
        } catch {
          // next root
        }
      }
      for (const origin of origins) {
        const response = await fetch(`${origin}${url}`, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
        if (response?.ok && (response.headers.get("content-type") || "").startsWith("image/")) return Buffer.from(await response.arrayBuffer());
      }
      throw new Error(`Referenzbild nicht erreichbar: ${url}`);
    }
    const resolved = (await resolveImageUrlForClient(url)) || url;
    const response = await fetch(resolved, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Referenzbild HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  };
}

async function storeImage(imageUrl: string, key: string): Promise<string> {
  const slash = key.lastIndexOf("/");
  const uploaded = await maybeUploadImageUrlToBucket(imageUrl, {
    prefix: slash > 0 ? key.slice(0, slash) : "library",
    filenameHint: key.slice(slash + 1),
    uploadMode: "always",
  });
  return uploaded?.url || imageUrl;
}

export const libraryAdminDrawPortrait = api<{ slug: string; characterId: string }, LibraryAdminCharacter>(
  { expose: true, method: "POST", path: "/library/admin/series/:slug/characters/:characterId/portrait", auth: true },
  async (req) => {
    ensureAdmin();
    await ensureLibrary();
    const series = await requireSeries(req.slug);
    const character = await getCharacter(series.info.id, req.characterId);
    if (!character) throw APIError.notFound("Figur nicht gefunden");
    const bible = await getBible(series.info.id, series.activeBibleVersion);
    const drawn = await drawPortrait(
      { id: character.id, name: character.name, visualProfileEn: character.visualProfileEn },
      bible?.imageStyleEn || "",
      createRunwareCaller(runwareApiKey()),
    );
    const url = await storeImage(drawn.imageUrl, `library/${series.info.slug}/characters/${character.id}-${Date.now()}`);
    const { active, sortOrder, origin: _origin, ...base } = character;
    await saveCharacter(series.info.id, { ...base, referenceStripKey: url }, active, sortOrder);
    return adminCharacterView((await getCharacter(series.info.id, character.id))!);
  }
);

export const libraryAdminCreateEpisode = api<{ slug: string; title: string; idea?: string; logline?: string; season?: number }, LibraryAdminEpisode>(
  { expose: true, method: "POST", path: "/library/admin/series/:slug/episodes", auth: true },
  async (req) => {
    ensureAdmin();
    await ensureLibrary();
    const series = await requireSeries(req.slug);
    const title = String(req.title || "").trim();
    if (!title) throw APIError.invalidArgument("Titel fehlt");
    const episodes = await listEpisodes(series.info.id);
    const season = Math.max(1, Math.round(Number(req.season) || episodes[episodes.length - 1]?.season || 1));
    const episode = Math.max(0, ...episodes.filter((entry) => entry.season === season).map((entry) => entry.episode)) + 1;
    const id = await createEpisode({
      seriesId: series.info.id,
      season,
      episode,
      title: title.slice(0, 120),
      logline: String(req.logline || "").trim().slice(0, 800),
      idea: String(req.idea || "").trim().slice(0, 2000) || null,
      plan: { fields: {}, clue: "" },
    });
    const created = (await listEpisodes(series.info.id)).findIndex((entry) => entry.id === id);
    return adminEpisodeView((await getEpisode(id))!, created);
  }
);

export const libraryAdminUpdateEpisode = api<{ id: string; title?: string; logline?: string; idea?: string; clue?: string; fields?: Record<string, string>; publishAt?: string }, LibraryAdminEpisode>(
  { expose: true, method: "PUT", path: "/library/admin/episodes/:id", auth: true },
  async (req) => {
    ensureAdmin();
    await ensureLibrary();
    const episode = await getEpisode(req.id);
    if (!episode) throw APIError.notFound("Folge nicht gefunden");
    const publishAt = req.publishAt === undefined ? episode.publishAt : req.publishAt ? new Date(req.publishAt) : null;
    if (publishAt && Number.isNaN(publishAt.getTime())) throw APIError.invalidArgument("Ungültiges Datum");
    await updateEpisodePlan(episode.id, {
      title: String(req.title ?? episode.title).trim().slice(0, 120) || episode.title,
      logline: String(req.logline ?? episode.logline).trim().slice(0, 800),
      idea: req.idea === undefined ? episode.idea : String(req.idea).trim().slice(0, 2000) || null,
      plan: { fields: req.fields ?? episode.plan.fields, clue: String(req.clue ?? episode.plan.clue ?? "").trim() },
      publishAt,
    }, { ...episode.generation, planEdited: true });
    const index = (await listEpisodes(episode.seriesId)).findIndex((entry) => entry.id === episode.id);
    return adminEpisodeView((await getEpisode(episode.id))!, index);
  }
);

export const libraryAdminUpdateEpisodeText = api<{ id: string; title?: string; summary?: string; teaser?: string; chapters?: Array<{ title: string; text: string }> }, LibraryAdminEpisode>(
  { expose: true, method: "PUT", path: "/library/admin/episodes/:id/text", auth: true },
  async (req) => {
    ensureAdmin();
    await ensureLibrary();
    const episode = await getEpisode(req.id);
    if (!episode?.content) throw APIError.notFound("Folge hat noch keinen Text");
    const chapters = episode.content.chapters.map((chapter, index) => {
      const edit = req.chapters?.[index];
      return edit ? { ...chapter, title: String(edit.title || chapter.title).trim(), text: String(edit.text || chapter.text).replace(/\r\n/g, "\n").trim() } : chapter;
    });
    const content: EpisodeContent = {
      ...episode.content,
      title: String(req.title ?? episode.content.title).trim() || episode.content.title,
      summary: String(req.summary ?? episode.content.summary).trim(),
      teaser: String(req.teaser ?? episode.content.teaser).trim(),
      chapters,
    };
    // Edited by hand: the seed must never write over it again.
    await saveEpisodeState(episode.id, { status: episode.status, content, generation: { ...episode.generation, source: "manual" } });
    const index = (await listEpisodes(episode.seriesId)).findIndex((entry) => entry.id === episode.id);
    return adminEpisodeView((await getEpisode(episode.id))!, index);
  }
);

/* ── Admin: production ─────────────────────────────────────────────────── */

async function buildBrief(episode: EpisodeRecord, idea: string | null): Promise<{ brief: EpisodeBrief; series: SeriesRecord }> {
  const series = await requireSeries(episode.seriesId);
  const bible = await getBible(series.info.id, series.activeBibleVersion);
  if (!bible) throw new Error("Serien-Bibel fehlt");
  const episodes = await listEpisodes(series.info.id);
  const before = (entry: EpisodeRecord) => entry.season < episode.season || (entry.season === episode.season && entry.episode < episode.episode);
  // Only approved episodes are canon: a draft in review never becomes a fact for the next one.
  const canon: CanonEntry[] = episodes
    .filter((entry) => before(entry) && entry.content && (entry.status === "approved" || entry.status === "published"))
    .map((entry) => ({ season: entry.season, episode: entry.episode, title: entry.content!.title, summary: entry.content!.summary, facts: entry.content!.canonFactsAdded }));
  const next = episodes.find((entry) => entry.season === episode.season && entry.episode === episode.episode + 1);
  return {
    series,
    brief: {
      series: series.info,
      bible,
      canon,
      target: {
        season: episode.season,
        episode: episode.episode,
        title: episode.title,
        logline: episode.logline,
        fields: episode.plan.fields || {},
        clue: episode.plan.clue || "",
        idea,
        next: next ? { title: next.title, logline: next.logline } : null,
      },
    },
  };
}

async function runGeneration(episodeId: string, idea: string | null, assetOrigin?: string): Promise<void> {
  const started = new Date().toISOString();
  const ledger = new CostLedger();
  const generation: GenerationInfo = { source: "pipeline", step: "blueprint", startedAt: started, idea: idea ?? undefined };
  const report = async (step: string) => {
    generation.step = step;
    await saveEpisodeState(episodeId, { status: "generating", generation: { ...generation } });
  };
  try {
    const episode = await getEpisode(episodeId);
    if (!episode) return;
    const { brief, series } = await buildBrief(episode, idea);
    const llm = withServiceTier(createOpenRouterStorybookLlm({
      onFailedAttempt: (request, billed) => {
        if (billed) ledger.recordCall(`${request.stage}-failed`, billed, request.role);
      },
    }), "flex");
    const draft = await generateEpisodeText(brief, llm, ledger, report);

    await report("pictures");
    const context: IllustrationContext = {
      style: brief.bible.imageStyleEn,
      characters: brief.bible.characters,
      keyPrefix: `library/${series.info.slug}/s${episode.season}e${episode.episode}`,
      ports: { call: createRunwareCaller(runwareApiKey()), load: referenceLoader(assetOrigin), store: storeImage },
    };
    const illustrated = await illustrateEpisode(draft.content, context);
    const totals = ledger.totals();
    await saveEpisodeState(episodeId, {
      status: "in_review",
      content: illustrated.content,
      scores: draft.scores,
      bibleVersion: brief.bible.version,
      generation: {
        ...generation,
        step: "done",
        finishedAt: new Date().toISOString(),
        writes: draft.writes,
        textCostUSD: totals.costUSD,
        imageCostUSD: Number(illustrated.costUSD.toFixed(4)),
        costUSD: Number((totals.costUSD + illustrated.costUSD).toFixed(4)),
        models: { ...LIBRARY_MODELS, image: LIBRARY_IMAGE_MODEL },
        stages: ledger.all().map((stage) => ({ stage: stage.stage, model: stage.modelUsed, costUSD: stage.usage?.costUSD, seconds: stage.durationMs ? Math.round(stage.durationMs / 1000) : undefined, note: stage.note })),
        issues: illustrated.issues,
      },
    });
    console.log(`[library] ${episodeId} written (${draft.writes} writes, $${(totals.costUSD + illustrated.costUSD).toFixed(3)}), waiting for review`);
  } catch (error) {
    console.error(`[library] generation of ${episodeId} failed:`, error);
    await saveEpisodeState(episodeId, {
      status: "failed",
      generation: { ...generation, finishedAt: new Date().toISOString(), error: (error as Error)?.message || String(error), costUSD: ledger.totals().costUSD },
    }).catch(() => undefined);
  }
}

export const libraryAdminGenerateEpisode = api<{ id: string; idea?: string; assetOrigin?: string }, LibraryAdminEpisode>(
  { expose: true, method: "POST", path: "/library/admin/episodes/:id/generate", auth: true },
  async (req) => {
    ensureAdmin();
    await ensureLibrary();
    const episode = await getEpisode(req.id);
    if (!episode) throw APIError.notFound("Folge nicht gefunden");
    if (stateOf(episode) === "generating") throw APIError.failedPrecondition("Diese Folge wird gerade geschrieben.");
    if (stateOf(episode) === "published") throw APIError.failedPrecondition("Veröffentlichte Folgen sind Kanon. Erst zurückziehen, dann neu schreiben.");
    const idea = req.idea === undefined ? episode.idea : String(req.idea).trim().slice(0, 2000) || null;
    if (req.idea !== undefined) {
      await updateEpisodePlan(episode.id, { title: episode.title, logline: episode.logline, idea, plan: episode.plan, publishAt: episode.publishAt }, episode.generation);
    }
    await saveEpisodeState(episode.id, { status: "generating", generation: { source: "pipeline", step: "queued", startedAt: new Date().toISOString(), idea: idea ?? undefined } });
    // The job outlives the request: the Railway edge cuts long requests, the page polls the state instead.
    void runGeneration(episode.id, idea, req.assetOrigin);
    const index = (await listEpisodes(episode.seriesId)).findIndex((entry) => entry.id === episode.id);
    return adminEpisodeView((await getEpisode(episode.id))!, index);
  }
);

export const libraryAdminRedrawPicture = api<{ id: string; slot: string; assetOrigin?: string }, LibraryAdminEpisode>(
  { expose: true, method: "POST", path: "/library/admin/episodes/:id/redraw", auth: true },
  async (req) => {
    ensureAdmin();
    await ensureLibrary();
    const episode = await getEpisode(req.id);
    if (!episode?.content) throw APIError.notFound("Folge hat noch keinen Inhalt");
    const slot: SlotRef = req.slot === "cover" ? "cover" : Math.max(0, Math.min(episode.content.chapters.length - 1, Number(req.slot) - 1));
    const series = await requireSeries(episode.seriesId);
    const bible = await getBible(series.info.id, series.activeBibleVersion);
    if (!bible) throw APIError.internal("Serien-Bibel fehlt");
    const result = await redrawPicture(episode.content, slot, {
      style: bible.imageStyleEn,
      characters: bible.characters,
      keyPrefix: `library/${series.info.slug}/s${episode.season}e${episode.episode}`,
      ports: { call: createRunwareCaller(runwareApiKey()), load: referenceLoader(req.assetOrigin), store: storeImage },
    });
    const generation = { ...episode.generation, ...(episode.generation.source === "seed" ? { source: "manual" as const } : {}), imageCostUSD: Number(((episode.generation.imageCostUSD || 0) + result.costUSD).toFixed(4)) };
    await saveEpisodeState(episode.id, { status: episode.status, content: result.content, generation });
    const index = (await listEpisodes(episode.seriesId)).findIndex((entry) => entry.id === episode.id);
    return adminEpisodeView((await getEpisode(episode.id))!, index);
  }
);

export const libraryAdminApproveEpisode = api<{ id: string; publishAt?: string; now?: boolean }, LibraryAdminEpisode>(
  { expose: true, method: "POST", path: "/library/admin/episodes/:id/approve", auth: true },
  async (req) => {
    ensureAdmin();
    await ensureLibrary();
    const episode = await getEpisode(req.id);
    if (!episode?.content) throw APIError.failedPrecondition("Ohne Text gibt es nichts freizugeben.");
    if (stateOf(episode) === "generating") throw APIError.failedPrecondition("Die Folge wird noch geschrieben.");
    const series = await requireSeries(episode.seriesId);
    let publishAt: Date;
    if (req.now) {
      publishAt = new Date();
    } else if (req.publishAt) {
      publishAt = new Date(req.publishAt);
      if (Number.isNaN(publishAt.getTime())) throw APIError.invalidArgument("Ungültiges Datum");
    } else {
      // Next free release slot after the series' last scheduled episode (one episode per week).
      const scheduled = (await listEpisodes(series.info.id))
        .filter((entry) => entry.id !== episode.id && (entry.status === "approved" || entry.status === "published") && entry.publishAt)
        .map((entry) => entry.publishAt!.getTime());
      const after = new Date(Math.max(Date.now(), ...scheduled));
      publishAt = nextReleaseSlot(series.info.releaseCadence, after);
    }
    await saveEpisodeState(episode.id, { status: "approved", generation: { ...episode.generation }, publishAt });
    const index = (await listEpisodes(series.info.id)).findIndex((entry) => entry.id === episode.id);
    return adminEpisodeView((await getEpisode(episode.id))!, index);
  }
);

export const libraryAdminUnpublishEpisode = api<{ id: string }, LibraryAdminEpisode>(
  { expose: true, method: "POST", path: "/library/admin/episodes/:id/unpublish", auth: true },
  async (req) => {
    ensureAdmin();
    await ensureLibrary();
    const episode = await getEpisode(req.id);
    if (!episode?.content) throw APIError.notFound("Folge nicht gefunden");
    await saveEpisodeState(episode.id, { status: "in_review", generation: { ...episode.generation }, publishAt: null });
    const index = (await listEpisodes(episode.seriesId)).findIndex((entry) => entry.id === episode.id);
    return adminEpisodeView((await getEpisode(episode.id))!, index);
  }
);

