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

/**
 * The moments the plan built each chapter around — its laughs, the wonder's first visible effect and the running gag's
 * beats. "Das Brett bis zur Tür" (2026-10-27): the plan promised a board square popping up beside Alexander's ear, a
 * chair spinning with the cat on it and game pieces hopping over a wandering blanket; the director, who saw only the
 * text, drew the boys tapping a painted donkey, a quiet talk on a chair and the boys walking past an open door.
 */
export function storyHighlights(plan: Pick<StoryPlan, "pages" | "ruleIntro" | "runningGag">): string[] {
  const lines = plan.pages.map((page) => {
    const moments = String(page.picture || "").split("|").map((moment) => moment.trim()).filter(Boolean);
    return moments.length ? `Chapter ${page.page}: ${moments.join(" / ")}` : "";
  }).filter(Boolean);
  if (plan.ruleIntro) lines.unshift(`The wonder's first visible effect: ${plan.ruleIntro}`);
  if (plan.runningGag?.beats?.length) lines.push(`Running gag (${plan.runningGag.what}): ${plan.runningGag.beats.join(" / ")}`);
  return lines;
}

/** The brief that turns the chapter-book director into this lane's director. */
export function directorNote(chapterCount: number, perChapter: number, centralFigure?: string, highlights: string[] = []): string {
  const wonder = centralFigure ? `the title figure ${centralFigure}` : "the central wonder";
  return [
    `This is a story of ${chapterCount} chapters. These PAGES are reading segments of its chapters (${perChapter} per chapter, in reading order), numbered locally from 1.`,
    `Each PAGE lists its paragraphs numbered p1, p2, … For every picture return "paragraph": the number of the ONE paragraph whose moment the picture shows. The picture is printed right after that paragraph, so the scene must show exactly what that paragraph and the one before it tell — who acts there, the place, and every thing in the state the text gives it at that point — never something that happens later or happened earlier, and never a suggested picture that does not fit. Choose a paragraph that is at least ${PICTURE_EDGE} paragraphs from the start of its page and at least ${PICTURE_EDGE} from its end (the last paragraphs of a chapter hold its ending: a picture must not show it before the text does).`,
    // Story 26fdd23f: four of six pictures showed people standing, sitting or talking beside a still board; picture 1.1
    // was the calm opening again (the picture-book rule for page 1), though half a chapter was there to choose from.
    "The picture-book rule for page 1 (its calm opening moment) does not apply here: page 1 is half a chapter and is chosen like every other page.",
    `Pick the moment a six-year-old would point at: first ${wonder} visibly doing its magic, then a planned laugh or running gag landing, then a big physical moment (something tumbling, flying, spinning, growing, splashing, popping up). Someone entering, a conversation, an explanation or a quiet look is a picture only when its page holds none of these, and at most one picture in the whole story is such a quiet one. At least half of the pictures show ${wonder} at work.`,
    ...(highlights.length ? [`MOMENTS THE STORY WAS PLANNED AROUND (the text may tell them a little differently; when one happens in a page's paragraphs, that paragraph is the picture): ${highlights.join(" — ")}.`] : []),
    `Draw what ${wonder} does in that very instant, concretely and big (a board square springing up beside a face, a strip of squares shooting out and looping round a chair leg) — never ${wonder} just lying there while the others look.`,
    "Freeze the instant of greatest motion the paragraph allows: feet off the ground, an object in mid-air, a chair mid-spin, cloth and hair swinging. Pick a camera that adds energy — low under a leap, high over a tangle, a diagonal through the frame, the moving thing large in the foreground.",
    // The illustrator takes no negative prompt: "No text or lettering." at the end of every scene asked for lettering.
    "Never write about text, letters or lettering in a scene, not even that there is none — the illustrator draws every word it reads.",
    "Figures (at most 3): fill the places in this order — 1) the heroes who are present in the scene of your paragraph: they stay in the picture even when the paragraph is about someone else, and are left out only when they are truly elsewhere; 2) everyone else who acts or speaks in your paragraph or the one before it; 3) the story's title figure or central wonder if it is part of that moment; 4) the others.",
    "Every named figure who acts in a chapter appears in at least one picture of that chapter. When the heroes would fill all places, give the picture whose paragraph is about a cast member to that cast member and ONE hero (the one who acts with them), not to the heroes alone.",
    `${centralFigure ? `The title figure ${centralFigure}` : "The central wonder"} is in at least every second picture.`,
    "Each picture is a moment of action from its paragraph, with the things the text names there (what someone carries, wears or holds, in the state the text gives it) — never figures posing side by side.",
    "For each scene describe one focal action with a concrete weight shift or gesture and a visible expression. Give each other figure a different, meaningful reaction and an explicit gaze target inside the scene. For a quiet paragraph use small gestures, listening, hesitation or wonder rather than inventing running or danger.",
    "Compose like a modern illustrated children's book: vary wide, medium and close views across the sequence; choose an asymmetrical arrangement with foreground, middle ground and background, a clear focal point and breathing room. Let the setting frame the action instead of filling every gap with decorative objects. Keep the important faces and separate silhouettes readable. Use only movement, objects and effects supported by the chosen paragraph.",
    "Name and prominently show the physical support or target that makes the chosen action intelligible. Someone ducking UNDER something needs that thing visibly overhead; something landing IN or dripping UNDER an object keeps that exact spatial relation. Match the object's current shape, scale and state, and keep important props in the same relation across pictures. A talking place remains the place itself, with its face in its surface.",
    "Check the physical trajectory: a falling object's receiving surface must be directly below it, clear of any blocking rim or wall. Give a living place one face at one spot in its connected surface, even when that surface makes several bends. Put the action's essential spatial relations before decorative details.",
    // The cover was a copy of the last chapter's picture and showed the resolution. Story 26fdd23f: "Karo fills the
    // foreground" became a board lying in front of two boys, like a product photo.
    `The cover must differ from every page picture: ${wonder} big in the foreground in the middle of its magic, the heroes physically reacting to it (leaping back, grabbing for it, laughing), in an inviting moment from the first half of the story — never the opening scene of chapter 1, never a moment from the last chapter, never the figures lined up behind a still ${centralFigure || "wonder"}.`,
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
    note: directorNote(chapters.length, perChapter, wonder, storyHighlights(input.plan)),
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
