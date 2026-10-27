/**
 * Talea-Folge — pictures.
 *
 * Audit of "Der Riese hinterm Teig" (2026-10-26): the art director named the right paragraphs (22 and 58), but the
 * story kept only one URL per chapter, so the PDF printed each picture at the top of its chapter (the resolution before
 * the story told it); Magd Elsa acts in all three chapters and stood in none of four pictures (two heroes and the
 * title creature fill the three places of every picture); and the cover was a copy of the last chapter's picture.
 *
 * The chapter book solved all three, so this lane reuses its picture machinery: every chapter is cut into reading
 * segments at paragraph borders, each segment is one page of the art director, the director names the paragraph its
 * picture shows, the code makes sure every acting figure is drawn at least once, and each picture is printed right after
 * its paragraph (`chapters.images`, read by the reader and the PDF export).
 *
 * Pure apart from the director call.
 */

import { mentions } from "../storybook/checks";
import type { StoryBrief } from "../storybook/context";
import { runDirectorStage, type DirectorStageResult, type VisualEntity } from "../storybook/illustration-stage";
import { publishableImageUrl, type ImageOutcome } from "../storybook/images";
import type { StorybookLlm } from "../storybook/llm";
import {
  actsIn,
  buildImageSlots,
  buildPictureNotes,
  enforceCastPresence,
  pagesFor,
  placePictures,
  PICTURE_EDGE,
  type CastPresenceChange,
  type ImageSlot,
  type PictureNote,
  type Placement,
} from "../storybook/book/illustrations";
import type { IllustrationPlan, StoryPlan, StorybookPage } from "../storybook/types";

/** Pictures per chapter: two at 0.12 ¢ each are nearly free next to 3 ¢ of text, and they tell the chapter's two halves. */
export function episodePicturesPerChapter(value = process.env.TALEA_EPISODE_PICTURES): number {
  const count = Number(value);
  return Number.isInteger(count) && count >= 1 && count <= 3 ? count : 2;
}

export interface EpisodeDirection {
  /** One slot per picture: its chapter, its part of the chapter and its default place. */
  slots: ImageSlot[];
  /** The reading segments — the art director's pages and the picture stage's pages (order 1…n). */
  pages: StorybookPage[];
  illustrations: IllustrationPlan;
  /** Where each picture is printed (0-based paragraph of its chapter). */
  placed: Placement[];
  /** What the admin sees per picture. */
  notes: PictureNote[];
  /** Figures the code put into pictures after the director left them out. */
  changes: CastPresenceChange[];
  /** Named figures who act in the story but stand in no picture. */
  unplaced: string[];
  director: DirectorStageResult;
}

/** The planner's chapter pages, re-cut to the reading segments. */
export function segmentPlan(plan: StoryPlan, slots: ImageSlot[], entities: VisualEntity[]): StoryPlan {
  const people = entities.filter((entity) => entity.kind === "character");
  return {
    ...plan,
    pages: slots.map((slot, index) => ({
      page: index + 1,
      place: plan.pages.find((entry) => entry.page === slot.chapter)?.place || "",
      action: slot.text.slice(0, 500),
      heroMoment: "", humor: "", emotion: "", turn: "",
      // The director reads the text itself; the planner's laugh is no picture.
      picture: "",
      onPage: people.filter((person) => mentions(slot.text, person.name)).map((person) => person.id),
      after: "",
    })),
  };
}

/** The brief that turns the chapter-book director into this lane's director. */
export function directorNote(chapterCount: number, perChapter: number, centralFigure?: string): string {
  return [
    `This is a story of ${chapterCount} chapters. These PAGES are reading segments of its chapters (${perChapter} per chapter, in reading order), numbered locally from 1.`,
    `Each PAGE lists its paragraphs numbered p1, p2, … For every picture return "paragraph": the number of the ONE paragraph whose moment the picture shows. The picture is printed right after that paragraph, so the scene must show exactly what that paragraph and the one before it tell — who acts there, the place, and every thing in the state the text gives it at that point — never something that happens later or happened earlier, and never a suggested picture that does not fit. Choose a paragraph with a clear, visible action that is at least ${PICTURE_EDGE} paragraphs from the start of its page and at least ${PICTURE_EDGE} from its end (the last paragraphs of a chapter hold its ending: a picture must not show it before the text does).`,
    "Figures (at most 3): fill the places in this order — 1) the heroes who are present in the scene of your paragraph: they stay in the picture even when the paragraph is about someone else, and are left out only when they are truly elsewhere; 2) everyone else who acts or speaks in your paragraph or the one before it; 3) the story's title figure or central wonder if it is part of that moment; 4) the others.",
    "Every named figure who acts in a chapter appears in at least one picture of that chapter. When the heroes would fill all places, give the picture whose paragraph is about a cast member to that cast member and ONE hero (the one who acts with them), not to the heroes alone.",
    `${centralFigure ? `The title figure ${centralFigure}` : "The central wonder"} is in at least every second picture.`,
    "Each picture is a moment of action from its paragraph, with the things the text names there (what someone carries, wears or holds, in the state the text gives it) — never figures posing side by side.",
    "For each scene describe one focal action with a concrete weight shift or gesture and a visible expression. Give each other figure a different, meaningful reaction and an explicit gaze target inside the scene. For a quiet paragraph use small gestures, listening, hesitation or wonder rather than inventing running or danger.",
    "Compose like a modern illustrated children's book: vary wide, medium and close views across the sequence; choose an asymmetrical arrangement with foreground, middle ground and background, a clear focal point and breathing room. Let the setting frame the action instead of filling every gap with decorative objects. Keep the important faces and separate silhouettes readable. Use only movement, objects and effects supported by the chosen paragraph.",
    // The cover was a copy of the last chapter's picture and showed the resolution.
    `The cover must differ from every page picture: ${centralFigure ? `show ${centralFigure}` : "show the central wonder"} big in the foreground with the heroes reacting to it, in an inviting moment from the first half of the story — never the opening scene of chapter 1 and never a moment from the last chapter.`,
  ].join(" ");
}

export async function directEpisodePictures(input: {
  llm: StorybookLlm;
  model: string;
  brief: StoryBrief;
  title: string;
  /** The chapters of the finished story. */
  pages: StorybookPage[];
  plan: StoryPlan;
  entities: VisualEntity[];
  perChapter?: number;
}): Promise<EpisodeDirection> {
  const perChapter = input.perChapter ?? episodePicturesPerChapter();
  const chapters = input.pages.map((page) => ({ order: page.order, content: page.content }));
  const slots = buildImageSlots(chapters, { chapters: [] }, perChapter);
  const pages = pagesFor(slots);
  const wonder = input.plan.cast.find((member) => member.role === "wonder")?.name;
  const director = await runDirectorStage(input.llm, {
    brief: input.brief,
    title: input.title,
    pages,
    plan: segmentPlan(input.plan, slots, input.entities),
    entities: input.entities,
    stage: "illustration-direction",
    note: directorNote(chapters.length, perChapter, wonder),
  }, input.model);
  // The prompt asked for every acting figure; the code makes sure of it.
  const enforced = enforceCastPresence({ slots, shots: director.illustrations.pages, entities: input.entities, chapters, maxPerImage: input.brief.budget.maxCharactersPerImage, engineFigure: wonder });
  const illustrations: IllustrationPlan = { ...director.illustrations, pages: enforced.shots };
  const placed = placePictures(slots, illustrations.pages);
  const notes = buildPictureNotes(slots, illustrations.pages, placed, input.entities, illustrations.storyElements || [], chapters);
  const drawn = new Set([...illustrations.pages, illustrations.cover].flatMap((shot) => shot.onStage));
  const unplaced = input.entities
    .filter((entity) => entity.kind === "character" && entity.role === "cast" && !drawn.has(entity.id) && chapters.some((chapter) => actsIn(chapter.content, entity.name)))
    .map((entity) => entity.name);
  return { slots, pages, illustrations, placed, notes, changes: enforced.changes, unplaced, director };
}

export interface ChapterPicture {
  chapter: number;
  /** The picture follows this paragraph (0-based) of the chapter. */
  afterParagraph: number;
  url: string;
  prompt?: string;
  status: ImageOutcome["status"];
}

/** The delivered pictures of every chapter, in reading order. */
export function chapterPictures(direction: Pick<EpisodeDirection, "slots" | "placed">, outcomes: Map<number, ImageOutcome>): ChapterPicture[] {
  return direction.slots.flatMap((slot, index) => {
    const outcome = outcomes.get(index + 1);
    const url = publishableImageUrl(outcome);
    if (!url || !outcome) return [];
    return [{ chapter: slot.chapter, afterParagraph: direction.placed[index]?.afterParagraph ?? slot.afterParagraph, url, prompt: outcome.prompt, status: outcome.status }];
  }).sort((a, b) => a.chapter - b.chapter || a.afterParagraph - b.afterParagraph);
}

/**
 * The picture that stands in for a failed cover. The story's last picture shows its resolution ("Der Riese hinterm
 * Teig": the cover was chapter 3's picture and gave the ending away), so it is the last choice; of the others a clean picture beats a
 * flawed one (soft flaws only: a picture with writing in it is never delivered).
 */
export function coverStandIn(pictures: ChapterPicture[]): ChapterPicture | undefined {
  const early = pictures.slice(0, -1);
  return early.find((picture) => picture.status === "passed") || early[0] || pictures[0];
}
