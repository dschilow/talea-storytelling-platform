/**
 * Chapter book — pictures.
 *
 * A chapter with k pictures is cut into k reading segments at paragraph
 * borders; each segment plays the role of a picture-book page for the existing
 * illustration director and image ladder (identity sheets, vision QA, redraw,
 * vignette). The picture then sits after the middle paragraph of its segment.
 * Batches after the first skip the cover and keep the looks of recurring
 * creatures fixed by earlier batches.
 */

import { mentions } from "../checks";
import { runDirectorStage, type VisualEntity } from "../illustration-stage";
import { generateStorybookImages, publishableImageUrl, type ImageOutcome, type ImageProvider } from "../images";
import type { CostLedger, StorybookLlm, StorybookModels } from "../llm";
import type { StoryElement, StoryPlan, StorybookPage } from "../types";
import type { BookBrief, BookChapter, BookPlan } from "./types";

export interface ImageSlot {
  /** Position of the picture in the whole book, 1-based. */
  slot: number;
  chapter: number;
  /** 0-based picture index inside the chapter. */
  part: number;
  /** The picture follows this paragraph (0-based) of the chapter. */
  afterParagraph: number;
  text: string;
  picture: string;
}

export function chapterParagraphs(content: string): string[] {
  return String(content || "").split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

export function buildImageSlots(chapters: BookChapter[], plan: BookPlan, perChapter: number, startSlot = 1): ImageSlot[] {
  const slots: ImageSlot[] = [];
  let slot = startSlot;
  for (const chapter of chapters) {
    const paragraphs = chapterParagraphs(chapter.content);
    const count = Math.max(1, Math.min(perChapter, paragraphs.length));
    const size = Math.ceil(paragraphs.length / count);
    const pictures = plan.chapters.find((entry) => entry.n === chapter.order)?.pictures || [];
    for (let part = 0; part < count; part += 1) {
      const start = part * size;
      const segment = paragraphs.slice(start, start + size);
      if (!segment.length) continue;
      slots.push({
        slot: slot++,
        chapter: chapter.order,
        part,
        afterParagraph: start + Math.max(0, Math.floor(segment.length / 2) - 1),
        text: segment.join("\n\n"),
        picture: pictures[part] || "",
      });
    }
  }
  return slots;
}

/** The thin StoryPlan the director needs (planned pictures, cast, fallback shots). */
function slotPlan(brief: BookBrief, plan: BookPlan, slots: ImageSlot[]): StoryPlan {
  const cast = brief.candidates.map((candidate) => ({ id: candidate.id, name: candidate.name, role: "", want: "", voice: "", signature: "" }));
  const people = [...brief.heroes.map((hero) => ({ id: hero.id, name: hero.name })), ...cast];
  return {
    title: plan.title, logline: plan.description, engine: "chapter-book", chosenPitch: 0, whyChosen: "", want: "", stakes: "",
    worldRule: null, ruleIntro: null, solutionWhy: "", refrain: null, runningGag: { what: "", beats: [] }, dramaticIrony: "",
    setups: [], obstacleMotive: "", props: [],
    heroes: brief.heroes.map((hero) => ({ id: hero.id, name: hero.name, strength: "", voice: "", contribution: "" })),
    cast,
    artifact: null,
    pages: slots.map((slot, index) => ({
      page: index + 1,
      place: plan.chapters.find((entry) => entry.n === slot.chapter)?.place || "",
      action: slot.text.slice(0, 500), heroMoment: "", humor: "", emotion: "", turn: "",
      picture: slot.picture,
      onPage: people.filter((person) => mentions(slot.text, person.name)).map((person) => person.id),
      after: "",
    })),
    ending: { resolution: "", callback: "", lastLine: "" },
  };
}

export interface BookImage {
  chapter: number;
  afterParagraph: number;
  url: string;
  status: ImageOutcome["status"];
  vignette?: boolean;
}

export interface BatchImagesResult {
  coverUrl?: string;
  images: BookImage[];
  missing: Array<{ chapter: number; part: number }>;
  storyElements: StoryElement[];
  imageCostUSD: number;
  imagesGenerated: number;
  /** Provider calls including redraws (imagesGenerated counts only delivered pictures). */
  imageCalls?: number;
  /** Pictures that needed more than one attempt, with the checker's reasons — redraws were half the image bill. */
  redraws?: Array<{ chapter: number; part: number; attempts: number; reasons: string[] }>;
}

/** Director + images for the chapters of one batch. Never throws: a failed picture leaves a text-only spot. */
export async function illustrateBatch(input: {
  llm: StorybookLlm;
  models: StorybookModels;
  ledger: CostLedger;
  brief: BookBrief;
  plan: BookPlan;
  chapters: BookChapter[];
  entities: VisualEntity[];
  provider: ImageProvider;
  seed: string;
  withCover: boolean;
  fixedElements?: StoryElement[];
  startSlot?: number;
}): Promise<BatchImagesResult> {
  const slots = buildImageSlots(input.chapters, input.plan, input.brief.book.imagesPerChapter, input.startSlot || 1);
  const empty: BatchImagesResult = { images: [], missing: slots.map((slot) => ({ chapter: slot.chapter, part: slot.part })), storyElements: input.fixedElements || [], imageCostUSD: 0, imagesGenerated: 0 };
  if (!slots.length) return empty;
  const range = `${input.chapters[0].order}-${input.chapters[input.chapters.length - 1].order}`;
  const pages: StorybookPage[] = slots.map((slot, index) => ({ order: index + 1, title: `Kapitel ${slot.chapter}`, content: slot.text }));
  try {
    const director = await runDirectorStage(input.llm, {
      brief: input.brief,
      title: input.plan.title,
      pages,
      plan: slotPlan(input.brief, input.plan, slots),
      entities: input.entities,
      fixedElements: input.fixedElements,
      skipCover: !input.withCover,
      stage: `book-illustration-${range}`,
      note: `This is a chapter book. These PAGES are reading segments of chapters ${range} (pictures ${slots[0].slot}–${slots[slots.length - 1].slot} of the book), numbered locally from 1.${input.withCover ? "" : " The cover already exists: answer cover briefly, it is not drawn."}`,
    }, input.models.support);
    if (director.call) input.ledger.recordCall(`book-illustration-${range}`, director.call, "support");
    if (director.repairCall) input.ledger.recordCall(`book-illustration-repair-${range}`, director.repairCall, "support");
    const images = await generateStorybookImages({
      illustrations: director.illustrations,
      entities: input.entities,
      provider: input.provider,
      seed: `${input.seed}:${range}`,
      llm: input.llm,
      visionModel: input.models.support,
      fallbackVisionModel: input.models.critic,
      pageTexts: Object.fromEntries(pages.map((page) => [page.order, page.content])),
      skipCover: !input.withCover,
    });
    images.qaCalls.forEach((qaCall, index) => input.ledger.recordCall(`book-image-qa-${range}-${index + 1}`, qaCall, "support"));
    const result: BatchImagesResult = { images: [], missing: [], storyElements: director.illustrations.storyElements || [], imageCostUSD: images.imageCostUSD, imagesGenerated: images.imagesGenerated, imageCalls: images.imageCalls, redraws: [] };
    if (input.withCover) result.coverUrl = publishableImageUrl(images.cover);
    const reasonsOf = (outcome: NonNullable<typeof images.cover>) =>
      [...new Set((outcome.history || []).filter((entry) => entry.severity >= 10).flatMap((entry) => entry.notes))].slice(0, 6);
    if (images.cover && images.cover.attempts > 1) result.redraws!.push({ chapter: 0, part: 0, attempts: images.cover.attempts, reasons: reasonsOf(images.cover) });
    for (const [index, slot] of slots.entries()) {
      const outcome = images.pages.get(index + 1);
      if (outcome && outcome.attempts > 1) result.redraws!.push({ chapter: slot.chapter, part: slot.part, attempts: outcome.attempts, reasons: reasonsOf(outcome) });
      const url = publishableImageUrl(outcome);
      if (url && outcome) result.images.push({ chapter: slot.chapter, afterParagraph: slot.afterParagraph, url, status: outcome.status, ...(outcome.vignette ? { vignette: true } : {}) });
      else result.missing.push({ chapter: slot.chapter, part: slot.part });
    }
    return result;
  } catch (err) {
    console.warn(`[book] pictures for chapters ${range} failed:`, (err as Error)?.message || err);
    return empty;
  }
}
