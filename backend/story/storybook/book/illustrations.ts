/**
 * Chapter book — pictures.
 *
 * A chapter with k pictures is cut into k reading segments at paragraph
 * borders; each segment plays the role of a picture-book page for the existing
 * illustration director and image ladder (identity sheets, vision QA, redraw,
 * vignette). The art director sees the segment's paragraphs numbered and names
 * the one its picture shows; the picture is printed right after it (the middle
 * of the segment is only the fallback). Audit 2026-10-16: with the picture at
 * the middle of the segment and the moment chosen freely, 11 of 16 scenes were
 * 3-7 paragraphs away from their place, and only a quarter of those pictures fit.
 * Batches after the first skip the cover and keep the looks of recurring
 * creatures fixed by earlier batches.
 */

import { mentions } from "../checks";
import { runDirectorStage, type VisualEntity } from "../illustration-stage";
import { generateStorybookImages, publishableImageUrl, type ImageOutcome, type ImageProvider } from "../images";
import type { JevPort } from "../jev";
import type { CostLedger, StorybookLlm, StorybookModels } from "../llm";
import type { IllustrationPlan, IllustrationShot, StoryElement, StoryPlan, StorybookPage } from "../types";
import { mentionsName } from "./catalogue";
import type { CastCandidate } from "../types";
import type { BookBrief, BookChapter, BookPlan } from "./types";

export interface ImageSlot {
  /** Position of the picture in the whole book, 1-based. */
  slot: number;
  chapter: number;
  /** 0-based picture index inside the chapter. */
  part: number;
  /** The picture follows this paragraph (0-based) of the chapter — the middle of the segment until the art director names another. */
  afterParagraph: number;
  /** 0-based index of the segment's first paragraph in the chapter, and how many paragraphs it has. */
  first: number;
  count: number;
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
        first: start,
        count: segment.length,
        text: segment.join("\n\n"),
        picture: pictures[part] || "",
      });
    }
  }
  return slots;
}

/** The reading segments as the art director's pages: text plus the numbered paragraphs. */
export function pagesFor(slots: ImageSlot[]): StorybookPage[] {
  return slots.map((slot, index) => ({ order: index + 1, title: `Kapitel ${slot.chapter}`, content: slot.text, paragraphs: chapterParagraphs(slot.text) }));
}

/**
 * Paragraphs kept free at both ends of a segment: a picture at the very start or end would crowd the neighbouring
 * picture or give away the chapter's ending ("Die segelnden Wörter": a picture showed the hook twelve paragraphs early).
 */
export const PICTURE_EDGE = 3;

export interface Placement {
  /** The picture follows this paragraph (0-based) of the chapter. */
  afterParagraph: number;
  by: "director" | "middle";
  /** The paragraph the director named, after the edge rule (1-based within the segment). */
  paragraph?: number;
}

/** Where each picture goes: right after the paragraph its scene shows; the middle of the segment when the director named none. */
export function placePictures(slots: ImageSlot[], shots: Array<{ paragraph?: number } | undefined>): Placement[] {
  return slots.map((slot, index) => {
    const wanted = Number(shots[index]?.paragraph);
    const lowest = PICTURE_EDGE;
    const highest = slot.count - PICTURE_EDGE;
    if (!Number.isInteger(wanted) || wanted < 1 || wanted > slot.count || highest < lowest) return { afterParagraph: slot.afterParagraph, by: "middle" as const };
    const paragraph = Math.min(highest, Math.max(lowest, wanted));
    return { afterParagraph: slot.first + paragraph - 1, by: "director" as const, paragraph };
  });
}

/** What the admin sees per picture: where it sits, what it was told to show, and who acts there but is not in it. */
export interface PictureNote {
  chapter: number;
  part: number;
  afterParagraph: number;
  placedBy: Placement["by"];
  scene: string;
  figures: string[];
  things: string[];
  /** Named characters who act in the paragraphs leading up to the picture but are not drawn. */
  missing: string[];
}

export function buildPictureNotes(slots: ImageSlot[], shots: IllustrationPlan["pages"], placed: Placement[], entities: VisualEntity[], storyElements: StoryElement[], chapters: BookChapter[]): PictureNote[] {
  return slots.flatMap((slot, index) => {
    const shot = shots[index];
    if (!shot) return [];
    const paragraphs = chapterParagraphs(chapters.find((chapter) => chapter.order === slot.chapter)?.content || "");
    const after = placed[index].afterParagraph;
    const near = paragraphs.slice(Math.max(0, after - 2), after + 2).join(" ");
    const figures = shot.onStage.map((id) => entities.find((entity) => entity.id === id)?.name).filter((name): name is string => Boolean(name));
    const things = (shot.elements || []).filter((name) => storyElements.some((element) => element.name === name));
    const missing = entities.filter((entity) => entity.kind === "character" && mentions(near, entity.name) && !figures.includes(entity.name)).map((entity) => entity.name);
    return [{ chapter: slot.chapter, part: slot.part, afterParagraph: after, placedBy: placed[index].by, scene: shot.scene.slice(0, 600), figures, things, missing }];
  });
}

export interface CastPresenceChange {
  chapter: number;
  part: number;
  name: string;
  /** The hero who gave way when the picture was full. */
  replaced?: string;
}

/**
 * Every cast figure who acts in a chapter stands in at least one picture of that chapter, and the engine figure
 * (when it is a cast member) in at least every second picture of the batch — enforced on the director's plan, not
 * only asked for in its prompt ("Die Türlaunische": the rule stood in the prompt, and Schnüffel and Bäcker Braun were
 * in 0 of 16 pictures). The figure goes into the picture whose paragraphs mention it most; when that picture is full,
 * the hero who is not named near the picture gives way, and at least one hero always stays.
 */
export function enforceCastPresence(input: {
  slots: ImageSlot[];
  shots: IllustrationShot[];
  entities: VisualEntity[];
  chapters: BookChapter[];
  maxPerImage: number;
  engineFigure?: string;
}): { shots: IllustrationShot[]; changes: CastPresenceChange[] } {
  const shots = input.shots.map((shot) => ({ ...shot, onStage: [...shot.onStage] }));
  const changes: CastPresenceChange[] = [];
  const cast = input.entities.filter((entity) => entity.kind === "character" && entity.role === "cast");
  const heroIds = new Set(input.entities.filter((entity) => entity.role === "hero").map((entity) => entity.id));
  const byId = new Map(input.entities.map((entity) => [entity.id, entity]));
  const count = (text: string, name: string) => (text.match(new RegExp(name.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu")) || []).length;

  const place = (slotIndex: number, entity: VisualEntity): boolean => {
    const slot = input.slots[slotIndex];
    const shot = shots[slotIndex];
    if (!slot || !shot || shot.onStage.includes(entity.id)) return false;
    if (shot.onStage.length < input.maxPerImage) {
      shot.onStage.push(entity.id);
      shot.scene = `${shot.scene.replace(/\s+$/, "")} ${entity.name} is in this picture, taking part in the action.`;
      changes.push({ chapter: slot.chapter, part: slot.part, name: entity.name });
      return true;
    }
    const heroesOn = shot.onStage.filter((id) => heroIds.has(id));
    if (heroesOn.length < 2) return false;
    // The hero who is not named near the picture gives way; the last-listed one when both are.
    const paragraphs = chapterParagraphs(slot.text);
    const near = paragraphs.slice(Math.max(0, (shot.paragraph || Math.ceil(paragraphs.length / 2)) - 2), (shot.paragraph || Math.ceil(paragraphs.length / 2)) + 1).join(" ");
    const away = heroesOn.filter((id) => !mentionsName(near, byId.get(id)?.name || ""));
    const victim = (away.length ? away : heroesOn)[away.length ? 0 : heroesOn.length - 1];
    shot.onStage = shot.onStage.map((id) => (id === victim ? entity.id : id));
    shot.scene = `${shot.scene.replace(/\s+$/, "")} ${entity.name} is in this picture instead of ${byId.get(victim)?.name || "one hero"}, taking part in the action.`;
    changes.push({ chapter: slot.chapter, part: slot.part, name: entity.name, replaced: byId.get(victim)?.name });
    return true;
  };

  for (const chapter of input.chapters) {
    const indices = input.slots.map((slot, index) => (slot.chapter === chapter.order ? index : -1)).filter((index) => index >= 0);
    if (!indices.length) continue;
    for (const entity of cast) {
      if (!mentionsName(chapter.content, entity.name)) continue;
      if (indices.some((index) => shots[index]?.onStage.includes(entity.id))) continue;
      const ranked = [...indices].sort((a, b) => count(input.slots[b].text, entity.name) - count(input.slots[a].text, entity.name));
      for (const index of ranked) if (place(index, entity)) break;
    }
  }

  // The figure that drives the book is in at least every second picture of the batch — a book about it must show it.
  const engine = input.engineFigure ? cast.find((entity) => mentionsName(entity.name, input.engineFigure!) || mentionsName(input.engineFigure!, entity.name)) : undefined;
  if (engine) {
    const wanted = Math.ceil(input.slots.length / 2);
    const has = () => shots.filter((shot) => shot.onStage.includes(engine.id)).length;
    const candidates = input.slots
      .map((slot, index) => ({ index, hits: count(slot.text, engine.name) }))
      .filter((entry) => entry.hits > 0 && !shots[entry.index].onStage.includes(engine.id))
      .sort((a, b) => b.hits - a.hits);
    for (const entry of candidates) {
      if (has() >= wanted) break;
      place(entry.index, engine);
    }
  }
  return { shots, changes };
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

// ---------------------------------------------------------------------------
// 2026-10-16, "Die rollende Woche": Rotkäppchen had no picture identity, the Zeitweber was drawn as a woman, and the
// cover and three pictures failed on writing because the stake was a school calendar.
// ---------------------------------------------------------------------------

/**
 * Picture identities for the plan's figures without a portrait (neither hero nor pool cast): the planner's look is the
 * identity lock, the kind decides species. Things (a talking door) stay story elements of the director.
 */
export function bibleFigureEntities(plan: BookPlan, takenNames: string[]): VisualEntity[] {
  const entities: VisualEntity[] = [];
  for (const profile of plan.bible.characters) {
    if (!profile.look || profile.kind === "thing") continue;
    if (takenNames.some((name) => mentionsName(profile.name, name) || mentionsName(name, profile.name))) continue;
    const kind = profile.kind || (/\b(girl|boy|man|woman|child|kid|lady|gentleman|grand(mother|father)|witch|wizard|knight|king|queen|prince(ss)?)\b/i.test(profile.look) ? "person" : "creature");
    const slug = foldName(profile.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `figure-${entities.length + 1}`;
    entities.push({
      id: `bible:${slug}`, name: profile.name, kind: "character", role: "cast",
      species: kind === "person" ? "human" : kind === "animal" ? "animal" : "magical creature", isHuman: kind === "person",
      appearance: profile.look.replace(/\s+/g, " ").trim().slice(0, 260), forbidden: [],
    });
  }
  return entities;
}

function foldName(value: string): string {
  return value.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue").replace(/ß/g, "ss");
}

const MALE_DE = /\b(Mann|Herr|Opa|Großvater|Grossvater|Vater|Papa|Onkel|Junge|Bub|Knabe|König|Koenig|Prinz|Ritter|Zauberer|Bauer|Kapitän|Kapitaen|Händler|Haendler|Wächter|Waechter|Bäcker|Baecker|Lehrer|Doktor|Professor|Gärtner|Gaertner|Hausmeister|Schäfer|Schaefer|Weber|Müller|Mueller|Schmied|Fischer|Förster|Foerster|Mönch|Moench|Pirat|Räuber|Raeuber|Riese|Zwerg|Kobold|Troll|Er)\b/;
const FEMALE_DE = /\b(Frau|Dame|Oma|Großmutter|Grossmutter|Mutter|Mama|Tante|Mädchen|Maedchen|Königin|Koenigin|Prinzessin|Hexe|Fee|Bäuerin|Baeuerin|Lehrerin|Händlerin|Haendlerin|Wächterin|Waechterin|Bäckerin|Baeckerin|Gärtnerin|Gaertnerin|Nixe|Meerjungfrau|Zauberin|Doktorin|Riesin|Sie)\b/;
const GENDER_EN = /\b(man|woman|boy|girl|male|female|lady|gentleman|grandmother|grandfather|grandma|grandpa|king|queen|prince|princess|witch|wizard|he|she|his|her)\b/i;

/**
 * The identity line of a pool figure starts with what it is: a human figure's gender and age ("an old man, …"), when
 * the pool prompt lacks it ("Der Zeitweber" was drawn as a woman). Non-human figures keep their species in front.
 */
export function castIdentityLine(member: Pick<CastCandidate, "visualProfile" | "physicalDescription" | "whoTheyAre" | "ageCategory" | "species" | "backstory" | "role" | "archetype">, appearance: string, isHuman: boolean): string {
  const line = appearance.replace(/\s+/g, " ").trim();
  if (!isHuman) return line;
  if (GENDER_EN.test(line)) return line;
  const profile = member.visualProfile && typeof member.visualProfile === "object" ? member.visualProfile : {};
  const declared = String(profile.gender || "").toLowerCase();
  const german = [member.whoTheyAre, member.physicalDescription, member.backstory, member.role, member.archetype].filter(Boolean).join(" ");
  const gender = /^(m|male|mann|männlich|maennlich|boy|junge)/.test(declared) ? "male"
    : /^(f|w|female|frau|weiblich|girl|mädchen|maedchen)/.test(declared) ? "female"
    : FEMALE_DE.test(german) && !MALE_DE.test(german) ? "female"
    : MALE_DE.test(german) && !FEMALE_DE.test(german) ? "male"
    : "";
  if (!gender) return line;
  const age = String(member.ageCategory || profile.ageDescription || profile.ageApprox || "").toLowerCase();
  const young = /child|kind|teen|jugend|young|jung/.test(age) || /\b(Junge|Mädchen|Maedchen|Bub|Knabe)\b/.test(german);
  const old = /elder|senior|old|alt|grand|oma|opa/.test(age) || /\b(Oma|Opa|Großmutter|Grossmutter|Großvater|Grossvater|alte[rn]?)\b/.test(german);
  const noun = gender === "male" ? (young ? "boy" : old ? "old man" : "man") : young ? "girl" : old ? "old woman" : "woman";
  return `${/^[aeiou]/.test(noun) ? "an" : "a"} ${noun}, ${line}`.slice(0, 280);
}

// Compounds count (Schulkalender, Namensschild, Schatzkarte); a clock or an hourglass does not.
const TEXT_THINGS_DE = /[A-Za-zÄÖÜäöüß]*(?:[Kk]alender|[Ss]tundenplan|[Ww]ochenplan|[Ss]child(?:er)?|[Pp]lakat|[Bb]rief(?:e)?|[Zz]ettel|[Nn]otiz|[Bb]uch|[Bb][üu]e?cher|[Kk]arte|[Zz]eitung|[Tt]afel|[Ee]tikett|[Ff]ahrplan|[Ll]iste|[Rr]ezept|[Uu]rkunde|[Tt]icket|[Hh]eft|[Tt]agebuch|[Ww]egweiser|[Ss]chriftrolle)\b/g;

/**
 * A note for the director when the plan's things carry writing in the text (a calendar, a sign, a letter): in the
 * pictures they show only coloured fields and painted symbols. Empty when nothing in the plan carries writing.
 */
export function wordlessThingsNote(plan: BookPlan): string {
  const sources = [plan.bible.stakeVisible || "", plan.bible.truth || "", ...plan.setups.map((setup) => setup.what), ...plan.chapters.flatMap((chapter) => chapter.pictures)].join(" ");
  const found = [...new Set((sources.match(TEXT_THINGS_DE) || []).map((word) => word.trim()))].slice(0, 5);
  if (!found.length) return "";
  return `Things of this story that carry writing in the text (${found.join(", ")}) are drawn WITHOUT any letters or digits: a calendar is a grid of coloured squares with one bright square, a sign or page shows a single painted symbol, a letter is a folded sheet with a wax seal, a map has only painted hills and a dotted path. Define each such thing as a storyElement with exactly that wordless look and use it on every page it appears.`;
}

/**
 * What is still wrong with the picture that was delivered. The history holds every attempt; the severity of the
 * delivered one tells which it was. Empty for a clean picture (severity under 10).
 */
export function remainingNotes(outcome: Pick<ImageOutcome, "history" | "severity">): string[] {
  const delivered = [...(outcome.history || [])].reverse().find((entry) => entry.severity === outcome.severity);
  return delivered && delivered.severity >= 10 ? delivered.notes.slice(0, 4) : [];
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
  redraws?: Array<{ chapter: number; part: number; attempts: number; reasons: string[]; /** How the delivered picture ended (passed, flawed, failed) … */ status?: string; /** … and what is still wrong with it. "flawed" prints; without this a parent finds the fault before the log does. */ remaining?: string[] }>;
}

/** What the job keeps between the text step (directing, placing) and the picture step (drawing). */
export interface StoredDirection {
  range: string;
  illustrations: IllustrationPlan;
  placed: Placement[];
  notes: PictureNote[];
}

export interface DirectedBatch extends StoredDirection {
  pages: StorybookPage[];
  director: Awaited<ReturnType<typeof runDirectorStage>>;
  /** Figures the code put into pictures after the director left them out (enforceCastPresence). */
  changes: CastPresenceChange[];
}

/** The art director's brief for the reading segments of one batch: a scene, the figures, the things and the paragraph of every picture. */
export async function directBatch(input: {
  llm: StorybookLlm;
  models: StorybookModels;
  ledger: CostLedger;
  brief: BookBrief;
  plan: BookPlan;
  chapters: BookChapter[];
  entities: VisualEntity[];
  slots: ImageSlot[];
  withCover: boolean;
  fixedElements?: StoryElement[];
}): Promise<DirectedBatch> {
  const { slots } = input;
  const range = `${input.chapters[0].order}-${input.chapters[input.chapters.length - 1].order}`;
  const pages = pagesFor(slots);
  const director = await runDirectorStage(input.llm, {
    brief: input.brief,
    title: input.plan.title,
    pages,
    plan: slotPlan(input.brief, input.plan, slots),
    entities: input.entities,
    fixedElements: input.fixedElements,
    skipCover: !input.withCover,
    stage: `book-illustration-${range}`,
    note: [
      `This is a chapter book. These PAGES are reading segments of chapters ${range} (pictures ${slots[0].slot}–${slots[slots.length - 1].slot} of the book), numbered locally from 1.`,
      // Audit 2026-10-16: pictures sat after the middle paragraph while the scene came from anywhere in the segment (3-7 paragraphs off in 11 of 16).
      // "Die segelnden Wörter": a picture showed the paper boat twelve paragraphs before the text had it — the chapter's hook.
      `Each PAGE lists its paragraphs numbered p1, p2, … For every picture return "paragraph": the number of the ONE paragraph whose moment the picture shows. The picture is printed right after that paragraph, so the scene must show exactly what that paragraph and the one before it tell — who acts there, the place, and every thing in the state the text gives it at that point — never something that happens later or happened earlier, and never a suggested picture of the planner that does not fit. Choose a paragraph with a clear, visible action that is at least ${PICTURE_EDGE} paragraphs from the start of its page and at least ${PICTURE_EDGE} from its end (the last paragraphs of a chapter hold its ending: a picture must not show it before the text does).`,
      // Audit 2026-10-16: the title figure was missing on 4 of 16 "Schatto" pictures, a hero on 13 of 77 — the 3-figure cap had no order.
      // First re-run with "who acts in the paragraph first": a paragraph about the librarian drew the librarian alone, the heroes standing right there were gone.
      "Figures (at most 3): fill the places in this order — 1) the heroes who are present in the scene of your paragraph: they stay in the picture even when the paragraph is about someone else, and are left out only when they are truly elsewhere; 2) everyone else who acts or speaks in your paragraph or the one before it; 3) the book's title figure or central wonder if it is part of that moment; 4) the others.",
      // 2026-10-16 ("Der Regen sagt rückwärts"): two cast members acted in five chapters and appeared in none of 13 pictures — the heroes filled every place.
      "Every named figure who acts in a chapter appears in at least one picture of that chapter. When the heroes would fill all places, give the picture whose paragraph is about a cast member to that cast member and ONE hero (the one who acts with them), not to the heroes alone. The central wonder or title figure is in at least every second picture of the book — a book about it must show it.",
      "Each picture is a moment of action from its paragraph, with the things the text names there (what someone carries, wears or holds, in the state the text gives it) — never figures posing side by side.",
      input.withCover
        // The cover and the first picture were nearly the same table scene.
        ? "The cover must differ from every page picture: show the book's central wonder big in the foreground with the heroes reacting to it — never the opening scene of chapter 1."
        : "The cover already exists: answer cover briefly, it is not drawn.",
      // 2026-10-16 ("Die rollende Woche"): the stake was a school calendar — the cover and three pictures failed on writing.
      wordlessThingsNote(input.plan),
    ].filter(Boolean).join(" "),
  }, input.models.support);
  if (director.call) input.ledger.recordCall(`book-illustration-${range}`, director.call, "support");
  if (director.repairCall) input.ledger.recordCall(`book-illustration-repair-${range}`, director.repairCall, "support");
  // 2026-10-16: the prompt asked for every acting figure in a picture; now the code makes sure of it.
  const enforced = enforceCastPresence({ slots, shots: director.illustrations.pages, entities: input.entities, chapters: input.chapters, maxPerImage: input.brief.book.maxCharactersPerImage, engineFigure: input.plan.bible.engineFigure });
  const illustrations: IllustrationPlan = { ...director.illustrations, pages: enforced.shots };
  const placed = placePictures(slots, illustrations.pages);
  const notes = buildPictureNotes(slots, illustrations.pages, placed, input.entities, illustrations.storyElements || [], input.chapters);
  return { range, pages, director, illustrations, placed, notes, changes: enforced.changes };
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
  /** Second reader for tails, doubles and fused bodies (see ../jev.ts). */
  jev?: JevPort;
  /** The direction the text step already made (and printed the placeholders from); without it the director runs here. */
  directed?: StoredDirection;
}): Promise<BatchImagesResult> {
  const slots = buildImageSlots(input.chapters, input.plan, input.brief.book.imagesPerChapter, input.startSlot || 1);
  const empty: BatchImagesResult = { images: [], missing: slots.map((slot) => ({ chapter: slot.chapter, part: slot.part })), storyElements: input.fixedElements || [], imageCostUSD: 0, imagesGenerated: 0 };
  if (!slots.length) return empty;
  try {
    const directed: StoredDirection & { pages: StorybookPage[] } = input.directed
      ? { ...input.directed, pages: pagesFor(slots) }
      : await directBatch({ ...input, slots });
    const { range, pages } = directed;
    const director = { illustrations: directed.illustrations };
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
      jev: input.jev,
    });
    images.qaCalls.forEach((qaCall, index) => input.ledger.recordCall(`book-image-qa-${range}-${index + 1}`, qaCall, "support"));
    images.jevCalls?.forEach((jevCall, index) => input.ledger.recordCall(`book-image-jev-${range}-${index + 1}`, jevCall, "support"));
    const result: BatchImagesResult = { images: [], missing: [], storyElements: director.illustrations.storyElements || [], imageCostUSD: images.imageCostUSD, imagesGenerated: images.imagesGenerated, imageCalls: images.imageCalls, redraws: [] };
    if (input.withCover) result.coverUrl = publishableImageUrl(images.cover);
    const reasonsOf = (outcome: NonNullable<typeof images.cover>) =>
      [...new Set((outcome.history || []).filter((entry) => entry.severity >= 10).flatMap((entry) => entry.notes))].slice(0, 6);
    const redrawEntry = (outcome: NonNullable<typeof images.cover>) => ({ attempts: outcome.attempts, reasons: reasonsOf(outcome), status: outcome.vignette ? `${outcome.status}/vignette` : outcome.status, remaining: remainingNotes(outcome) });
    if (images.cover && images.cover.attempts > 1) result.redraws!.push({ chapter: 0, part: 0, ...redrawEntry(images.cover) });
    for (const [index, slot] of slots.entries()) {
      const outcome = images.pages.get(index + 1);
      if (outcome && outcome.attempts > 1) result.redraws!.push({ chapter: slot.chapter, part: slot.part, ...redrawEntry(outcome) });
      const url = publishableImageUrl(outcome);
      if (url && outcome) result.images.push({ chapter: slot.chapter, afterParagraph: directed.placed[index]?.afterParagraph ?? slot.afterParagraph, url, status: outcome.status, ...(outcome.vignette ? { vignette: true } : {}) });
      else result.missing.push({ chapter: slot.chapter, part: slot.part });
    }
    return result;
  } catch (err) {
    console.warn(`[book] pictures for chapters ${input.chapters[0].order}-${input.chapters[input.chapters.length - 1].order} failed:`, (err as Error)?.message || err);
    return empty;
  }
}
