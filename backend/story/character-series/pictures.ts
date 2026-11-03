import { createHash } from 'node:crypto';
import { createIdentityReferenceCache, IdentityReferenceError } from '../image-reference-sprite';
import type { VisualEntity } from '../storybook/illustration-stage';
import { isPublishable, type ImageOutcome, type ImageProvider, type StorybookImagesResult } from '../storybook/images';
import { parseJsonObject, type StorybookLlm } from '../storybook/llm';
import type { IllustrationPlan, IllustrationShot, StoryPlan, StorybookPage } from '../storybook/types';
import type { StoryBrief } from '../storybook/context';
import { actsIn, buildImageSlots, pagesFor, placePictures, buildPictureNotes, PICTURE_EDGE } from '../storybook/book/illustrations';
import type { EpisodeDirection } from '../episode/pictures';
import { wordlessLine } from '../storybook/illustration-stage';
import { ORIGINALS_IMAGE_STYLE, SCENE_SIZE } from '../library/images';
import { SERIES_IMAGE_REVIEW_EFFORT, SERIES_POLICY } from './authoring';
import { effectiveSeriesEpisode, logsForEpisode } from './core';
import { readSeriesQa, seriesPictureLastResort, seriesPicturePasses, seriesPictureSource, seriesPictureUsable, seriesSecondReaderRedraw, SERIES_IMAGE_REVIEW_COMPACT, withJevDefects, withPanelDefect, type SeriesQa } from './quality';
import { jevCallResult, readWithJev, type JevPort, type JevReading } from '../storybook/jev';
import { FLUX3_KLEIN_MODEL, type RunwareReferenceRegion } from '../../ai/runware-image-model-options';
import { StorybookSafetyBlock } from '../storybook/llm-guards';
import { seriesReferenceMention } from './identity';
import { readSeriesVisualContracts, seriesShotContinuity, seriesVisualContractText, type SeriesVisualContract } from './visual-continuity';
export { seriesPicturePasses, seriesPictureUsable } from './quality';

export type SeriesBox = [number, number, number, number];
export interface SeriesVisualBeat {
  actorId: string;
  /** Starts with the physical verb, not the person's name or an interpretation of their feelings. */
  action: string;
  result: string;
  framing: 'wide' | 'medium' | 'close';
}
interface SeriesShot extends IllustrationShot {
  actionKey: string;
  storyQuote?: string;
  visualBeat?: SeriesVisualBeat;
  boxes?: Record<string, SeriesBox>;
  planningRecovery?: string[];
  /** A malformed cover plan reused this valid, source-grounded chapter motif instead of losing the paid manuscript. */
  coverSourcePage?: number;
}

export type SeriesIllustrationPlan = IllustrationPlan & { continuity?: SeriesVisualContract[] };

/**
 * Story 3ca4f3d5 asked for "its yellow lettering turned toward the masonry" and got „KASEN!“ on the board; 1a2fa8a4's
 * "demonstration notice" became a banner reading „KAPTIÄN BLUBBERT“. Both passed the check. Whatever a caption calls
 * writing is painted as writing, so it reaches the painter as a plain painted surface.
 */
export function seriesWordlessCaption(text: string): string {
  return text
    .replace(/\b(?:lettering|inscriptions?|slogans?|letters)\b/gi, 'painted stripes')
    .replace(/\bnotices\b/gi, 'sheets of paper')
    .replace(/\bnotice\b/gi, 'sheet of paper');
}

/**
 * A painter draws what it reads, "no" included: "The repaired seam stays shut, with no pale thread hanging out" came
 * back with the thread (probe 2026-11-03, story 9a84d5e0 page 6). Clauses about what is absent leave the caption; the
 * check still has the story quote.
 */
export function withoutAbsentThings(text: string): string {
  return text
    .replace(/,\s*with\s+no\s+[^,.;!?]*/gi, '')
    .replace(/\s+and\s+no\s+[^,.;!?]*/gi, '')
    .replace(/,?\s+without\s+[^,.;!?]*/gi, '')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** The prose carries written clues. Do not turn a tiny written clue into a giant sign/table in the illustration. */
export function seriesPaintableMoment(shot: IllustrationShot): { scene: string; fact: string } {
  const beat = (shot as SeriesShot).visualBeat;
  const label = /\b[A-ZÄÖÜ]{2,}\b/;
  const sentences = shot.scene.split(/(?<=[.!?])\s+/).filter(s => !(label.test(s) && /\b(?:sign|letters?|word|label|inscription|reads?|marked|text)\b/i.test(s))).map(withoutAbsentThings).filter(Boolean);
  const tile = Boolean(beat && /\b(?:location|place|destination) tile\b/i.test(beat.action));
  const scene = seriesWordlessCaption(sentences.join(' ') || shot.scene.replace(/\b[A-ZÄÖÜ]{2,}\b/g, '')) + (tile ? ' The location tile is a small palm-sized clay token, held within a child’s hand, with a visibly cleaned patch and faint pictorial scratches. Keep it small beside the cloth; its surface carries no lettering.' : '');
  const fact = beat ? seriesWordlessCaption(`${beat.action}; ${tile ? 'a clean patch is exposed on the small clay token' : withoutAbsentThings(beat.result.replace(/\b[A-ZÄÖÜ]{2,}\b/g, '').trim())}`) : seriesWordlessCaption((shot as SeriesShot).actionKey || scene);
  return { scene, fact };
}

const NON_VISUAL_ACTION = /^(?:looks?|watches?|observes?|studies|notices?|listens?|agrees?|introduces?|objects?|says?|talks?|speaks?|asks?|answers?|feels?|realises?|realizes?|decides?|understands?|thinks?|waits?|nods?)\b/i;
const HIDDEN_IDENTITY = /\b(?:completely|fully|entirely)\s+(?:hides?|obscures?|covers?)\b.*\b(?:face|head|identity)\b/i;
const VISIBLE_STAGING = 'ONLY VISIBLE STAGING in scene and visualBeat: every noun can become an object in the image. Exclude dialogue topics, memories, comparisons, wishes, future plans and invisible thoughts from these fields; quoted story evidence may retain them. Something merely mentioned in speech is NOT physically there. For a quiet conversation describe the actual people, their positions, expressions and empty resting hands, not what they discuss. A drawing is an image ON paper, never a living extra figure; include one only if the source says that drawing is actually present.';

function isSmallCreature(entity: VisualEntity): boolean {
  return !entity.isHuman && /\b(dragon|drache|fairy|fee|mouse|maus|raven|rabe|seagull|moewe|bird|vogel|marmot|murmeltier|cat|katze|frog|frosch|squirrel|rabbit|hase|tortoise|schildkröte)\b/i.test(`${entity.species} ${entity.appearance}`);
}

/** Tilda is a nine-year-old series lead; a human pool figure is not necessarily an adult. */
function isChildFigure(entity: VisualEntity): boolean {
  return entity.isHuman && (entity.role === 'hero' || /\b(?:child|boy|girl)\b/i.test(entity.appearance));
}

function validSeriesBox(value: unknown): value is SeriesBox {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1000)) return false;
  const [top, left, bottom, right] = value;
  return bottom - top >= 180 && bottom - top <= 920 && right - left >= 120 && right - left <= 850;
}

function defaultTargetBox(entity: VisualEntity, index: number, total: number, primary: boolean, page: number): SeriesBox {
  const [top, bottom]: [number, number] = isSmallCreature(entity)
    ? [primary ? 420 : 460, primary ? 920 : 940]
    : isChildFigure(entity)
    ? [primary ? 280 : 320, primary ? 940 : 920]
    : [primary ? 140 : 180, primary ? 940 : 920];
  if (total === 1) return [top, 200, bottom, 800];
  if (total === 2) {
    const flip = page > 0 && page % 2 === 0;
    const leftSlot = (index === 0) !== flip;
    return leftSlot
      ? [top, primary ? 50 : 70, bottom, primary ? 470 : 450]
      : [top, primary ? 510 : 530, bottom, primary ? 930 : 910];
  }
  const cols: Array<[number, number]> = [[30, 330], [350, 650], [670, 960]];
  const col = cols[(index + Math.max(0, page)) % 3];
  return [top, col[0], bottom, col[1]];
}

/** Bind the existing sheet cells to separate subjects with realistic scale and varied scene placement; never attach individual portraits. */
export function seriesReferenceRegions(
  identities: VisualEntity[],
  beat?: SeriesVisualBeat,
  referenceIndex = 0,
  boxes?: Record<string, SeriesBox>,
  page = 1,
): RunwareReferenceRegion[] {
  const cell = 1000 / identities.length;
  const hasAdultHuman = identities.some(e => e.isHuman && !isChildFigure(e));
  const rawBoxes = identities.map((entity, i) => {
    const primary = entity.id === beat?.actorId;
    const custom = boxes?.[entity.id];
    if (validSeriesBox(custom)) {
      const [t, l, b, r] = custom.map(n => Math.round(n)) as SeriesBox;
      const adjustedTop = isChildFigure(entity) && hasAdultHuman ? Math.max(t, 280) : t;
      if (b - adjustedTop >= 180) return [adjustedTop, l, b, r] as SeriesBox;
    }
    return defaultTargetBox(entity, i, identities.length, primary, page);
  });
  return identities.map((entity, i) => ({
    id: `seriesfigure${i + 1}`,
    description: entity.name,
    referenceIndex,
    sourceBox: [0, Math.round(i * cell), 1000, Math.round((i + 1) * cell)],
    targetBox: rawBoxes[i],
  }));
}

/** Figures plus referenced objects on one identity sheet; a fourth cell carries no position and lost a child (3ca4f3d5). */
export const SERIES_SHEET_CELLS = 3;

const HOLDING_VERB = String.raw`(?:holds?|holding|held|hugs?|hugging|hugged|cuddles?|cuddling|cuddled|press(?:es|ing|ed)?|squeez(?:es|ing|ed|e)|carr(?:y|ies|ying|ied)|rais(?:es|ing|ed|e)|lifts?|lifting|lifted|clutch(?:es|ing|ed)?|cradl(?:es|ing|ed|e)|grips?|gripping|gripped|clasps?|clasping|clasped)`;
/** "squeezes past the cart", "presses into the box": the verb moves the figure, it holds nothing. */
const NOT_A_HOLD = String.raw`(?!\s+(?:past|through|into|onto|against|behind|under|over|toward|towards|beside|between|at|on|in|to|off|from|out)\b)`;
/** Only a sliver of the object shows: a whole portrait of it on the sheet comes back as the whole object (story 9a84d5e0 page 4). */
const HIDDEN_OBJECT = /\b(?:hidden|hides?|hiding|inside|beneath|underneath|buried|tucked|glimpses?|glimmers?|peeks?|peeking|peeps?|peeping)\b/i;
const SMALL_WORD = /\b(?:tiny|small|little|mini|miniature|palm-sized|pocket-sized|pocket)\b/i;
const SMALL_THING = /\b(?:keys?|coins?|rings?|buttons?|pebbles?|marbles?|whistles?|clamps?|clips?|pegs?|clothes-?pegs?|clothespins?|needles?|thimbles?|shells?|seeds?|feathers?|beads?|badges?|medals?|lockets?|bells?|acorns?|dice|crayons?|pencils?|chalk|brush(?:es)?|spoons?|candles?|tokens?|stones?|tickets?|stamps?|cards?|notes?|letters?|envelopes?)\b/i;
/** Too big for a portrait: carried, a machine or a cart would come back toy-sized. */
const LARGE_THING = /\b(?:large|big|huge|giant|enormous|heavy|machines?|machinery|devices?|contraptions?|carts?|wagons?|wheelbarrows?|barrows?|trolleys?|boats?|ships?|rafts?|cars?|bikes?|bicycles?|sleds?|sledges?|benches?|tables?|desks?|chairs?|beds?|doors?|gates?|walls?|cupboards?|wardrobes?|shelf|shelves|crates?|barrels?|tents?|houses?|huts?|towers?|trees?|statues?|pianos?|robots?|fronts?|panels?)\b/i;

/** How big an object is in a holder's hands: small (one hand), held (a toy, a lantern), or too large to carry. */
export function seriesObjectSize(object: VisualEntity): 'small' | 'held' | 'large' {
  // The name, its aliases and the appearance up to its first detail ("Soft teddy bear with … a small seam" is no small thing).
  const head = [object.name, ...(object.referenceAliases || []), object.appearance.split(/\s+with\s+|[,;.]/i)[0]].join(' ');
  if (SMALL_WORD.test(head) || (SMALL_THING.test(head) && !LARGE_THING.test(head))) return 'small';
  return LARGE_THING.test(head) ? 'large' : 'held';
}

export interface SeriesPropPlacement {
  /** Object id → the figure that holds it in this picture. */
  carriedBy: Map<string, string>;
  /** Objects of which only a sliver shows. */
  hidden: Set<string>;
}

/**
 * Where each referenced object is in the picture. FLUX.2 klein copies every sheet cell into the scene as a thing of its
 * own: in story 9a84d5e0 (2026-11-03) the Teddy's cell came back as a second, seated teddy beside the one Alexander
 * hugs on 6 of 6 attempts, and as a whole teddy on the page where only its ribbon peeks out of the box. A held object
 * therefore travels in its holder's cell, and a hidden one gets no cell. The beat decides first ("Alexander presses
 * Teddy against himself"); in the caption the holding verb must govern the object ("lifting a sock clear of the bear"
 * is no hold of the bear), and the holder is the figure named last before the verb.
 */
export function seriesPropPlacement(shot: IllustrationShot, figures: VisualEntity[], objects: VisualEntity[]): SeriesPropPlacement {
  const beat = (shot as SeriesShot).visualBeat;
  const actor = beat ? figures.find(f => f.id === beat.actorId) : undefined;
  const sentences = [actor && beat ? `${actor.name} ${beat.action}` : '', ...shot.scene.split(/(?<=[.!?;])\s+/)].filter(Boolean);
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lower = (value: string) => value.normalize('NFC').toLocaleLowerCase('en');
  const lastMention = (text: string, figure: VisualEntity) => Math.max(...[figure.name, ...figure.name.split(/\s+/).filter(part => part.length >= 3)]
    .map(name => lower(text).lastIndexOf(lower(name))));
  const carriedBy = new Map<string, string>();
  const hidden = new Set<string>();
  for (const object of objects) {
    const names = [object.name, ...(object.referenceAliases || [])].filter(name => name.trim().length >= 3).map(name => escape(name.trim()));
    const held = new RegExp(`\\b${HOLDING_VERB}${NOT_A_HOLD}\\s+(?:[\\p{L}’'-]+\\s+){0,2}?(?:${names.join('|')})(?![\\p{L}\\p{N}’'])`, 'iu');
    // A machine, a cart or a boat keeps its own cell: in a child's cell it would shrink to a toy.
    if (seriesObjectSize(object) === 'large') {
      if (sentences.some(sentence => seriesReferenceMention(sentence, object) && HIDDEN_OBJECT.test(sentence))) hidden.add(object.id);
      continue;
    }
    for (const sentence of sentences) {
      const match = held.exec(sentence);
      if (!match) continue;
      const before = sentence.slice(0, match.index);
      const holder = figures.map(figure => ({ figure, at: lastMention(before, figure) })).filter(item => item.at >= 0).sort((a, b) => b.at - a.at)[0];
      if (holder) { carriedBy.set(object.id, holder.figure.id); break; }
    }
    if (!carriedBy.has(object.id) && sentences.some(sentence => seriesReferenceMention(sentence, object) && HIDDEN_OBJECT.test(sentence))) hidden.add(object.id);
  }
  return { carriedBy, hidden };
}
export const SERIES_STYLE_REFERENCE = 'https://www.talea.website/library/series/bruno-der-flunkerfisch/s1e1/ch2.webp';
export const SERIES_ART_DIRECTION = `${ORIGINALS_IMAGE_STYLE}. Bold readable curved silhouettes, slightly enlarged expressive heads, clear soft ink contours, broad gouache colour shapes and varied comic expressions. Keep texture subordinate to faces and action; the setting supports the joke. Render the referenced identities in this illustration language.`;

export interface SeriesShotRules {
  /**
   * The director's first plan must also put the family on the cover, the lead into half of the pictures and every acting
   * guest into a picture. After the one repair these become wishes, so a story never fails over them.
   */
  strict?: boolean;
  /** Recurring guests with a portrait who act in the story (story ff6eff04: Pia acted in all three chapters and stood in no picture). */
  guestIds?: string[];
  /** After the bounded repair, retain a source-grounded caption without malformed auxiliary beat metadata. */
  allowSceneFallback?: boolean;
}

class SeriesPicturePlanError extends Error {
  constructor(public readonly page: number, public readonly fields: string[]) {
    super(`Serienbild ${page} braucht eine körperliche Handlung und einen gültigen Bildausschnitt: ${fields.join('; ')}.`);
    this.name = 'SeriesPicturePlanError';
  }
}

/** Every shot keeps its dramatic subject; a failed picture never turns into an avatar portrait. */
export function validateSeriesShots(raw: any, pages: StorybookPage[], entities: VisualEntity[], leadId: string, rules: SeriesShotRules = {}): SeriesIllustrationPlan {
  // Every pictured identity needs an existing reference; a style example must never supply a missing guest.
  const ids = new Set(entities.filter(e => e.kind === 'character' && e.referenceUrl).map(e => e.id));
  const ordinal = (value: unknown): number | undefined => {
    const number = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : value;
    return typeof number === 'number' && Number.isSafeInteger(number) && number >= 0 ? number : undefined;
  };
  const resolveId = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    const id = value.trim();
    if (ids.has(id)) return id;
    const name = id.toLocaleLowerCase('de-DE');
    const matches = entities.filter(e => ids.has(e.id) && (e.name.toLocaleLowerCase('de-DE') === name ||
      e.name.split(/\s+/).some(part => part.length >= 3 && !/^(der|die|das|graf|captain|kapitän)$/i.test(part) && part.toLocaleLowerCase('de-DE') === name)));
    return matches.length === 1 ? matches[0].id : id;
  };
  const shot = (candidate: any, page: number, allowSceneFallback = rules.allowSceneFallback): SeriesShot => {
    const onStage = Array.isArray(candidate?.onStage) ? [...new Set<string>(candidate.onStage.map(resolveId))] : [];
    if (!onStage.length || onStage.length > 3 || onStage.some(id => !ids.has(id)) || typeof candidate?.scene !== 'string' || candidate.scene.length < 45 || candidate.scene.length > 1900) throw new Error('Die Serienbildplanung hat keine klare, gültige Besetzung.');
    if ((page === 0 || page === 1) && !onStage.includes(leadId)) throw new Error('Die Serienhauptfigur fehlt in ihrem Titel- oder Einstiegsbild.');
    const pageParagraphs = page > 0 ? pages[page - 1]?.content.split(/\n\n/) || [] : [];
    const quote: string = typeof candidate.storyQuote === 'string' ? candidate.storyQuote.trim() : '';
    // Models quote German „…“ as straight quotes; only the words have to be the chapter's own.
    const norm = (s: string) => s.normalize('NFC').replace(/[„“”"«»]/g, '"').replace(/[‚‘’']/g, "'").replace(/…/g, '...').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
    // Story e83e44e2: the director quoted the paper flag behind Tilda's ear (paragraph 6) but named paragraph 16, the
    // clamp on the brake lever; the picture printed ten paragraphs late and its rescue redrew the brake lever. The quoted
    // words decide; a quote across paragraphs counts at its last sentence, the visible consequence.
    const quoted = (() => {
      if (quote.length < 12 || quote.length > 500) return undefined;
      const paragraphs = pageParagraphs.map(norm);
      const source = paragraphs.join(' ');
      const needle = norm(quote);
      let end = -1;
      const ends = paragraphs.map(p => (end += p.length + 1));
      const matches = new Set<number>();
      for (let at = source.indexOf(needle); at >= 0; at = source.indexOf(needle, at + 1)) {
        const index = ends.findIndex(boundary => boundary >= at + needle.length - 1);
        if (index >= 0) matches.add(index);
      }
      if (matches.size === 1) return [...matches][0];
      const preferred = ordinal(candidate.paragraph);
      return preferred !== undefined && matches.has(preferred - 1) ? preferred - 1 : undefined;
    })();
    const paragraph = quoted !== undefined ? quoted + 1 : ordinal(candidate.paragraph);
    if (page > 0 && (paragraph === undefined || !Number.isInteger(paragraph) || paragraph < 1 || paragraph > pageParagraphs.length)) throw new Error('Das Serienbild gehört zu keinem Absatz des Kapitels.');
    const paragraphText = page > 0 && paragraph !== undefined ? pageParagraphs[paragraph - 1]?.trim() : '';
    // Ground a paraphrased model quote in the actual selected source paragraph, never in invented evidence.
    // A one-word paragraph („Hält.“) is too short as evidence (pilot 2026-10-29 lost the whole story): its neighbour joins it.
    const fallbackEvidence = paragraphText && paragraphText.length >= 12 ? paragraphText
      : (paragraph !== undefined && paragraph > 1 ? pageParagraphs.slice(paragraph - 2, paragraph) : pageParagraphs.slice(0, 2)).join(' ').trim();
    const evidence = page > 0 && quoted === undefined ? fallbackEvidence.slice(0, 500) : quote;
    if (page > 0 && evidence.length < 12) throw new Error('Dem Serienbild fehlt ein wörtlicher Beleg aus seinem Kapitel.');
    const beat = candidate.visualBeat;
    // Haiku may put the valid framing beside visualBeat rather than inside it; the meaning is identical.
    const frameValue = beat?.framing ?? candidate?.framing;
    const framing = typeof frameValue === 'string'
      ? frameValue.trim().toLowerCase().replace(/\s+shot$/, '').replace(/[- ]up$/, '') : '';
    const actorId = resolveId(beat?.actorId);
    const action = typeof beat?.action === 'string' ? beat.action.trim() : '';
    const result = typeof beat?.result === 'string' ? beat.result.trim() : '';
    const errors: string[] = [];
    if (!onStage.includes(actorId)) errors.push('visualBeat.actorId fehlt oder steht nicht auf onStage');
    if (action.length < 3 || action.length > 220 || NON_VISUAL_ACTION.test(action)) errors.push('visualBeat.action ist leer, unbrauchbar oder nur eine Gesprächshandlung');
    if (result.length < 3 || result.length > 260 || HIDDEN_IDENTITY.test(result)) errors.push('visualBeat.result ist leer, unbrauchbar oder verdeckt die Identität vollständig');
    if (framing !== 'wide' && framing !== 'medium' && framing !== 'close') errors.push('visualBeat.framing muss wide, medium oder close sein');
    if (errors.length && (!allowSceneFallback || page === 0)) throw new SeriesPicturePlanError(page, errors);
    const visualBeat: SeriesVisualBeat | undefined = !errors.length && (framing === 'wide' || framing === 'medium' || framing === 'close')
      ? { actorId, action, result, framing } : undefined;
    const requestedProps = Array.isArray(candidate.elements) ? candidate.elements : [];
    const propSource = page > 0 ? [evidence, ...pageParagraphs.slice(Math.max(0, (paragraph || 1) - 3), paragraph)].join('\n') : candidate.scene;
    // Story 3ca4f3d5: three children plus the teddy (and the machine on the cover) made sheets of four and five cells, and
    // Alexander was missing from all five attempts at them. A prop gets a cell only while the sheet stays at three.
    const props = entities.filter(e => e.kind === 'artifact' && e.referenceUrl &&
      (requestedProps.includes(e.id) || requestedProps.includes(e.name) || candidate.artifactVisible === true || seriesReferenceMention(candidate.scene, e)) &&
      seriesReferenceMention(propSource, e)).slice(0, Math.max(0, Math.min(SERIES_POLICY.maxVisualReferences, SERIES_SHEET_CELLS - onStage.length)));
    const boxes: Record<string, SeriesBox> = {};
    if (candidate?.boxes && typeof candidate.boxes === 'object') {
      for (const id of [...onStage, ...props.map(e => e.id)]) {
        if (validSeriesBox(candidate.boxes[id])) boxes[id] = candidate.boxes[id].map((n: number) => Math.round(n)) as SeriesBox;
      }
    }
    const actor = visualBeat ? entities.find(e => e.id === visualBeat.actorId) : undefined;
    return { page, onStage, scene: candidate.scene, actionKey: visualBeat && actor ? `${actor.name} ${visualBeat.action}; ${visualBeat.result}` : candidate.scene,
      ...(visualBeat ? { visualBeat } : {}), ...(errors.length ? { planningRecovery: errors } : {}),
      ...(Object.keys(boxes).length ? { boxes } : {}), storyQuote: evidence || undefined, focus: 'scene', artifactVisible: props.length > 0, elements: props.map(e => e.id), ...(page ? { paragraph } : {}) };
  };
  // Haiku planned pages 1, 1, 2, 3, 3, 4, 5, 6 and its repair returned the same (pilot 2026-10-29): one picture per
  // page is kept, the first that validates, instead of failing the whole story.
  const planned: any[] = Array.isArray(raw?.pages) ? raw.pages : [];
  const proposals = pages.map((_, i) => planned.filter((p: any) => ordinal(p?.page) === i + 1));
  // The repair has to know what is wrong; a bare "not one picture per segment" made Haiku return the same plan.
  if (proposals.some(list => !list.length)) throw new Error(`Die Serienbildplanung enthält nicht genau ein Bild je Leseabschnitt: erwartet pages ${pages.map((_, i) => i + 1).join(', ')} je einmal, erhalten ${planned.map(p => p?.page).join(', ') || 'keine'}; es fehlt page ${proposals.map((list, i) => list.length ? 0 : i + 1).filter(Boolean).join(', ')}.`);
  const firstValid = (list: any[], page: number): SeriesShot => {
    let failure: unknown;
    for (const allowSceneFallback of rules.allowSceneFallback ? [false, true] : [false]) {
      for (const candidate of list) {
        try { return shot(candidate, page, allowSceneFallback); } catch (error) { failure = error; }
      }
    }
    if (failure) throw failure;
    throw new Error('Die Serienbildplanung enthält nicht genau ein Bild je Leseabschnitt.');
  };
  const pageShots = proposals.map((list, i) => firstValid(list, i + 1));
  let cover: IllustrationShot;
  try { cover = shot(raw.cover, 0); }
  catch (error) {
    // 9019823b and 23302f05 lost their completed text on the cover's visualBeat schema. Reuse a chapter motif that
    // passed every cast, evidence and physical-action check; never manufacture a new action or accept an invalid cast.
    const heroes = entities.filter(e => e.role === 'hero' && e.referenceUrl);
    const source = pageShots.find(p => p.onStage.includes(leadId) && p.onStage.some(id => heroes.some(e => e.id === id)))
      || pageShots.find(p => p.onStage.includes(leadId));
    if (!source) throw error;
    const { paragraph: _paragraph, storyQuote: _quote, ...motif } = source;
    cover = { ...motif, page: 0, coverSourcePage: source.page, onStage: [...source.onStage],
      ...(source.visualBeat ? { visualBeat: { ...source.visualBeat, framing: 'wide' } } : {}),
      scene: `${source.scene} Distinct wide cover composition of this same story moment, with the lead's face clearly visible.` } as SeriesShot;
  }
  const plan = { cover, pages: pageShots, storyElements: [], continuity: readSeriesVisualContracts(raw?.continuity, pages) };
  const leadPictures = plan.pages.filter((p: IllustrationShot) => p.onStage.includes(leadId)).length;
  if (leadPictures < Math.min(2, pages.length)) throw new Error('Die Serienhauptfigur verschwindet aus ihren Kapitelbildern.');
  const heroes = entities.filter(e => e.role === 'hero' && e.referenceUrl);
  const capacity = pages.length * 2 - Math.min(2, pages.length);
  if (heroes.length <= capacity && heroes.some(e => !plan.pages.some((p: IllustrationShot) => p.onStage.includes(e.id)))) throw new Error('Ein beteiligter Avatar fehlt in allen Serienbildern.');
  if (pages.length >= 3 && new Set(plan.pages.map(p => p.visualBeat?.framing).filter(Boolean)).size < 2) {
    // Story 439d746c: Luna framed all six pages "medium" and a whole plan repair (0.39 ¢, 62 s) changed three words. The
    // smallest cast after page 1 is moved closer instead; its scene and evidence stay as planned.
    const uniform = plan.pages.find(p => p.visualBeat)?.visualBeat?.framing;
    const target = plan.pages.slice(1).filter(p => p.visualBeat).sort((a, b) => a.onStage.length - b.onStage.length || b.page - a.page)[0];
    if (target?.visualBeat && uniform) target.visualBeat = { ...target.visualBeat, framing: uniform === 'close' ? 'medium' : 'close' };
    else if (!rules.allowSceneFallback) throw new Error('Die Serienbilder brauchen unterschiedliche Bildausschnitte.');
    else plan.pages[0].planningRecovery = [...(plan.pages[0].planningRecovery || []), 'Bildausschnitt-Variation ist nach der Reparatur unvollständig; die belegten Szenen bleiben erhalten'];
  }
  if (rules.strict) {
    if (leadPictures < Math.floor(pages.length / 2)) throw new Error(`Die Serienhauptfigur steht nur in ${leadPictures} von ${pages.length} Kapitelbildern; sie gehört in mindestens die Hälfte.`);
    if (heroes.length && !plan.cover.onStage.some((id: string) => heroes.some(e => e.id === id))) throw new Error('Das Titelbild zeigt die Serienfigur ohne die Kinder der Familie; mindestens ein Avatar gehört neben sie auf das Cover.');
    for (const id of rules.guestIds || []) {
      if (ids.has(id) && !plan.pages.some((p: IllustrationShot) => p.onStage.includes(id))) throw new Error(`${entities.find(e => e.id === id)?.name || id} spielt in der Folge mit, steht aber in keinem Kapitelbild.`);
    }
  }
  return plan;
}

export async function directSeriesPictures(input: {
  llm: StorybookLlm; model: string; brief: StoryBrief; title: string; pages: StorybookPage[];
  plan?: StoryPlan; entities: VisualEntity[];
  observe?: (stage: string, payload: Record<string, unknown>) => void | Promise<void>;
}): Promise<EpisodeDirection> {
  const series = input.brief.characterSeries!;
  const leadId = series.bible.characterId;
  const perChapter = SERIES_POLICY.picturesPerChapter;
  const chapters = input.pages.map(p => ({ order: p.order, content: p.content }));
  // Two pictures per chapter (story ff6eff04 had four pictures for 1,400 words): every chapter is cut into reading
  // segments at paragraph borders, one picture per segment, printed right after the paragraph it shows — the
  // Talea-Folge machinery (../episode/pictures.ts).
  const slots = buildImageSlots(chapters, { chapters: [] }, perChapter);
  const pages = pagesFor(slots);
  const episode = effectiveSeriesEpisode(series.logs, series.episodeOverride);
  const firstEncounter = episode === 1 && logsForEpisode(series.logs, series.episodeOverride).length === 0;
  const heroes = input.entities.filter(e => e.role === 'hero' && e.referenceUrl);
  const guests = input.entities.filter(e => e.kind === 'character' && e.role === 'cast' && e.id !== leadId && e.referenceUrl && chapters.some(c => actsIn(c.content, e.name)));
  const rules: SeriesShotRules = { strict: true, guestIds: guests.map(e => e.id) };
  // Only the shared fictional pool lead is newly shown to the director. Private avatar portraits stay out.
  const publicLead = input.entities.find(e => e.id === leadId && e.role === 'cast');
  // Pilots 2026-11-02, first attempts: three figures passed 8 of 16 with a human lead and 2 of 7 with the dragon
  // (doubled children, a second dragon, the dragon missing); two figures passed 10 of 12 and 3 of 5.
  const creatureLead = input.entities.some(e => e.id === leadId && !e.isHuman);
  const leadShare = Math.max(Math.min(2, pages.length), Math.floor(pages.length / 2));
  const coverage = [
    `SERIES LEAD ${leadId}: on the cover, on page 1 and in at least ${leadShare} of the ${pages.length} page pictures.`,
    heroes.length ? `AVATARS (each in at least one page picture, better two, in the part of their own contribution; at least one of them beside the lead on the cover): ${heroes.map(e => `${e.id} (${e.name})`).join(', ')}.` : '',
    guests.length ? `RECURRING GUEST${guests.length > 1 ? 'S' : ''} OF THIS EPISODE (in at least one page picture, where the guest does the most): ${guests.map(e => `${e.id} (${e.name})`).join(', ')}.` : '',
  ].filter(Boolean).join('\n');
  const pageText = pages.map((p, i) => `PAGE ${p.order} — chapter ${slots[i].chapter}, part ${slots[i].part + 1} of ${slots.filter(s => s.chapter === slots[i].chapter).length}\n${p.content.split(/\n\n/).map((t, k) => `p${k + 1}: ${t}`).join('\n')}`).join('\n\n');
  // A ceiling, not a price: only used tokens are billed, and a thinking model needs the room before its JSON.
  // Luna used 6.0k and 6.7k of 8k for six pages (3.3k/4.0k thinking) and twice ran out (2026-11-02): two stories failed.
  const directionTokens = 4000 + pages.length * 1500;
  const call = await input.llm({ stage: 'series-picture-direction', role: 'support', model: input.model, json: true, effort: 'medium', maxTokens: directionTokens, serviceTier: 'standard', timeoutMs: 120000,
    imageInputs: [...(publicLead?.referenceUrl ? [publicLead.referenceUrl] : []), SERIES_STYLE_REFERENCE],
    system: [
      // Haiku planned two pictures per chapter instead of one per page in all three runs on 2026-10-29 ([1,1,2,2,3,3,4,5]).
      `Illustrate the FINISHED children's story faithfully, with lively expressions and clear landscape compositions. Exactly ONE picture per PAGE plus a distinct cover. A PAGE is already a reading segment of a chapter (up to ${perChapter} PAGES per chapter): return exactly ${pages.length} page entries, numbered ${pages.map(p => p.order).join(', ')} in order. Paragraph numbers p1, p2, ... restart on each PAGE. Each picture has 1 to 3 referenced figures and a concise English scene caption of 35–65 words.`,
      `CAST COVERAGE (see the task): the lead on the cover, on page 1 and in at least half of the page pictures; every avatar in at least one page picture, in the part of its own contribution; every recurring guest of the episode in at least one page picture, where the guest does the most. The cover shows the lead WITH ${creatureLead ? 'exactly ONE avatar, the one with the biggest part (this lead is not human, and its three-figure pictures came back with doubled children or a missing creature)' : 'the avatars (all of them when lead and avatars are at most three, otherwise those with the biggest part)'}: the family wants to find its children on the cover.`,
      'For a referenced avatar identify them by name and action only; do not describe their hair, ears, teeth, face, clothing or other visible appearance in captions. The identity sheet supplies those details. Exception: explicitly donned story garments such as lifejackets MUST be described and stay worn until removed in the source. Nonvisual age or height may be used for scale.',
      'SOURCE FIRST: for each PAGE, first copy storyQuote, a consecutive 12–500 character passage that actually states the selected action AND its visible result. Then set paragraph to the LAST local paragraph needed for that result, even if it is the last paragraph of the page. Only then derive onStage, visualBeat and scene from that passage. Do not cite a vague lead-in, an earlier dialogue line or the start of an action while drawing its later result. Never borrow an event from another PAGE. The finished prose, not a planned gag or an imagined improvement, is the authority.',
      VISIBLE_STAGING,
      'SHARED PROP DESIGNS: return top-level continuity for at most FOUR plot-important objects, including a title device or beloved toy even when it has no portrait or sheet cell. Each entry is {name:"source name",aliases:["source names","English caption nouns"],appearance:"concise English material, shape, scale and distinctive parts",evidence:[{page:number,quote:"exact 12–500 character source passage naming and describing this object"}]}. Use only source-grounded design facts, no invented machinery, powers or people. Resolve every caption against these same designs. A floor-level broom/pedal/box stays that device, not a different factory machine; a cardboard sign stays cardboard. Include worn lifejackets or other consequential garments in each caption AFTER the prose establishes them. A wide overview of an occupied vehicle must not imply that its other passengers vanished: choose a tighter crop if the cast limit prevents an honest overview.',
      'CAST AT THIS MOMENT: include only figures physically present at this source moment. A caption never names a person who is not onStage, not even as an owner or job ("the big padded seat", never "the captain\'s seat": a named captain is painted). If a child arrives later in the PAGE, choose a moment after that arrival or leave the child out. Prefer the actual participants, not an extra spectator to meet coverage. Keep the source actor and helper; do not replace them with a guest to satisfy a quota. Cover and coverage wishes never override chronology.',
      'Choose the most expressive TRUE moment in the segment. A physical joke is welcome when it actually occurs there. A quiet arrival, someone carrying an object or helping with a real task is better than an invented mishap. A funny result from an earlier page must not be repeated in a later picture. Give the two pictures of each chapter different moments.',
      // In 70 pilot first attempts, two figures were more reliable than three (48% vs. 31%).
      `DRAWABLE: prefer TWO figures and medium framing, with one clear action and readable faces. A third figure belongs only when actually participating, and at most TWO page pictures show three figures.${creatureLead ? ' This lead is not human: every picture shows it with at most ONE other figure.' : ''} Cooperating figures may keep their real roles; never invent a different action to simplify the composition. Prefer a large object or visible consequence over tiny mechanical workings. Keep each recurring prop’s established material, size and shape. All prominent figures are listed in onStage; an explicitly mentioned distant crowd may be incidental silhouettes, not extra foreground children.`,
      'SETTING: start scene with the actual location already established by this text, followed by the figures and the visible action. An outdoor courtyard is outdoors, not an indoor room. Name a boat, house, shop or place by what it is in plain English (aboard the small wooden sailboat at the jetty), never by its German proper name: "on the Seegras" was painted as a grassy meadow with a park bench. Reference images supply identity and rendering only, never their background or props. Do not add irrelevant settings, excluded places or appearance details.',
      'Every shot needs visualBeat {actorId, action, result, framing} and boxes {"id":[top,left,bottom,right]} on a 0–1000 scale of the 3:2 landscape canvas. Start action with an English physical VERB, not watching, speaking, agreeing or deciding. The result must be observable in ONE still. framing is wide, medium or close; use at least TWO scales across three or more page pictures. In `boxes`, keep realistic relative sizes (adult ~650–820 tall, child ~480–640 tall and visibly shorter than adults, small creature/dragon/mouse/bird ~260–440 tall) and vary left/center/right placement so consecutive pictures never repeat a side-by-side 50/50 split.',
      `Compose a full-body or three-quarter scene with depth and expressive faces. The cover uses a real motif from the first half of the story, with the lead and avatars, never the resolved ending and never the moment of the PAGE 1 picture (Blubbert's cover repeated it). The illustration is wordless: never write lettering, letters, slogans or what a sign, note or paper says into a caption; a lettered board is a painted board, a notice a sheet of paper. Only CHARACTER identities with supplied references may be onStage. A referenced OBJECT is never a character: put its exact id in elements when it is visible in the selected source moment. The identity sheet holds ${SERIES_SHEET_CELLS} cells: a picture with three figures has elements:[], one with two figures at most one element. Keep the object's stable shape, colours, material and scale, allowing only the state changes explicitly in the prose. Include the source-language object name in the cover caption when elements names that object, so its presence can be verified.`,
      `The picture prints right AFTER paragraph; never draw a result before its text. Prefer ${PICTURE_EDGE} paragraphs of spacing from segment edges only when the true moment allows it. Before returning, check each caption's actors, objects and result against its quote and ensure paragraph is not earlier than any part of the depicted event. Then count the page entries with three onStage ids: more than two means reducing the others to the two figures who act (story e2d5890a planned four; every one of them failed or came back flawed). JSON {"continuity":[{"name":"source object name","aliases":["English caption noun"],"appearance":"source-grounded stable design","evidence":[{"page":1,"quote":"exact source passage"}]}],"cover":{"onStage":["id","id"],"elements":["visible-object-id"],"boxes":{"id":[160,220,920,760]},"visualBeat":{"actorId":"id","action":"physical verb and object","result":"source-grounded visible result","framing":"wide"},"scene":"..."},"pages":[{"page":1,"storyQuote":"exact passage stating the event AND result","paragraph":4,"onStage":["id","id"],"elements":["visible-object-id"],"boxes":{"id":[160,60,920,460],"id2":[300,520,920,880]},"visualBeat":{"actorId":"id","action":"physical verb and object","result":"visible result already stated in the quote","framing":"medium"},"scene":"..."}]}. Use elements:[] when no referenced object is visible.`,
    ].join('\n'),
    user: [
      firstEncounter ? 'FIRST CHAPTER PICTURE: choose a real encounter or exchange from this segment, after the relevant people arrive. Keep identifying faces visible.' : '',
      'Work from the finished PAGES below, one segment at a time. Copy the complete source event before describing its picture.',
      'Return the shared continuity designs alongside cover and pages. They do not consume identity-sheet cells. Preserve an existing OBJECT appearance where it agrees with the prose; do not describe a second copy as background decoration.',
      `${publicLead?.referenceUrl ? 'Image 1 is ONLY the public series lead; take face, species and clothes, NEVER its sea/room background or loose portrait props. ' : ''}The last image is ONLY the art style (notice the full-room depth, expressive faces and true child-to-creature scale). Reference poses are not scene poses.`,
      `REQUIRED CAST COVERAGE:\n${coverage}`,
      `TITLE ${input.title}`,
      `PICTURABLE IDENTITIES (only these have references; OBJECT ids belong in elements, CHARACTER ids in onStage):\n${input.entities.filter(e => e.referenceUrl).map(e => `${e.id}: ${e.name} [${e.kind === 'artifact' ? 'OBJECT' : 'CHARACTER'}] (${isChildFigure(e) ? 'human child, shorter than adults' : e.isHuman ? 'adult human' : e.species}); ${e.role === 'hero' ? (e.referenceContext || 'identity from reference') : e.appearance}`).join('\n')}`,
      `PAGES (${pages.length}):\n${pageText}`,
    ].filter(Boolean).join('\n') });
  let illustrations!: IllustrationPlan;
  let repairCall: Awaited<ReturnType<StorybookLlm>> | undefined;
  let repairReasons: Array<{ page: number; errors: string[] }> | undefined;
  const first = parseJsonObject<Record<string, unknown>>(call.text);
  let repaired: Record<string, unknown> | null = null;
  const issue = (error: unknown) => ({ page: error instanceof SeriesPicturePlanError ? error.page : 0,
    errors: [error instanceof Error ? error.message : String(error)] });
  try { illustrations = validateSeriesShots(first, pages, input.entities, leadId, rules); }
  catch (error) {
    repairReasons = [issue(error)];
    await input.observe?.('series-picture-plan-invalid', { issues: [...repairReasons], plan: first, usage: call.usage });
    try {
      repairCall = await input.llm({ stage: 'series-picture-plan-repair', role: 'support', model: input.model, json: true, effort: 'medium', maxTokens: directionTokens, serviceTier: 'standard', timeoutMs: 120000,
        system: 'Repair only the supplied illustration plan JSON: one picture per PAGE (a reading segment of a chapter), exactly the given pages in order, plus the cover. The DEFECT is real: never return the plan unchanged; for a missing page choose a real physical event from that page\'s own paragraphs. Each image has 1 to 3 visible referenced characters. Preserve the selected event unless its evidence or activity is invalid; then choose a true moment from that page. Every cover/page needs visualBeat {actorId, action, result, framing}; actorId is onStage, action starts with an English physical verb or concrete posture, result is visible, framing is wide|medium|close. Across three or more page pictures use at least TWO framing scales. An introduction, objection or agreement alone is not a visible event; a concrete seated or standing arrangement can be. Cast: the lead on the cover, on page 1 and in at least half of the page pictures; every avatar in at least one page picture; at least one avatar beside the lead on the cover; every listed recurring guest in at least one page picture. "paragraph" is the local paragraph number within its page. Keep captions, page order and paragraph numbers where valid, with no invented objects or events. Return only the corrected plan.',
        user: `DEFECT ${repairReasons[0].errors.join('; ')}\nLEAD ${leadId}\nAVATARS ${heroes.map(e => e.id).join(', ')}\n${guests.length ? `RECURRING GUESTS ${guests.map(e => e.id).join(', ')}\n` : ''}ALLOWED REFERENCED IDENTITIES ${input.entities.filter(e => e.referenceUrl).map(e => `${e.id}: ${e.name}`).join('; ')}\nEXACTLY ${pages.length} PAGES\nEvery page needs storyQuote: an exact 12–500 character passage from THAT page proving the physical event AND its result. paragraph is the LAST paragraph needed for the complete event. Include only people already physically present there; never borrow a later gag or add a spectator to meet coverage. A quiet true action is better than an invented mishap. Its result must read in one still without a temporal comparison. Keep identifying faces visible. Use only source-present props.\n${VISIBLE_STAGING}\nSOURCE PAGES:\n${pageText}\nPLAN\n${call.text}` });
      repaired = parseJsonObject<Record<string, unknown>>(repairCall.text);
      if (repaired && !Array.isArray(repaired.continuity)) repaired.continuity = first?.continuity;
      illustrations = validateSeriesShots(repaired, pages, input.entities, leadId);
    } catch (repairError) {
      if (repairError instanceof StorybookSafetyBlock) throw repairError;
      repairReasons.push(issue(repairError));
      await input.observe?.('series-picture-plan-repair-invalid', { issues: [...repairReasons], plan: repaired, usage: repairCall?.usage });
      // Keep valid first-plan shots when a repair fixes one page but damages another.
      const combined = { cover: repaired?.cover ?? first?.cover,
        continuity: [...(Array.isArray(repaired?.continuity) ? repaired.continuity : []), ...(Array.isArray(first?.continuity) ? first.continuity : [])],
        pages: [...(Array.isArray(first?.pages) ? first.pages : []), ...(Array.isArray(repaired?.pages) ? repaired.pages : [])] };
      try {
        illustrations = validateSeriesShots(combined, pages, input.entities, leadId);
      } catch {
        // Only auxiliary beat metadata and camera variety are optional here. Cast, references, paragraph and
        // literal source evidence still validate before any image is bought; the normal image QA remains mandatory.
        illustrations = validateSeriesShots(combined, pages, input.entities, leadId, { allowSceneFallback: true });
      }
      const recovered = [illustrations.cover, ...illustrations.pages].flatMap(p => {
        const notes = (p as SeriesShot).planningRecovery;
        return notes?.length ? [{ page: p.page, errors: notes }] : [];
      });
      repairReasons.push(...recovered);
      console.warn('[character-series] Illustration plan recovered after bounded repair', {
        recoveredPages: recovered.map(p => p.page), issues: repairReasons,
      });
      await input.observe?.('series-picture-plan-recovered', { mode: recovered.length ? 'source-grounded-scenes' : 'valid-shots-merged',
        issues: repairReasons, illustrations });
    }
  }
  const placed = placePictures(slots, illustrations.pages);
  const notes = buildPictureNotes(slots, illustrations.pages, placed, input.entities, [], chapters);
  const drawn = new Set([illustrations.cover, ...illustrations.pages].flatMap(shot => shot.onStage));
  const unplaced = guests.filter(e => !drawn.has(e.id)).map(e => e.name);
  return { slots, pages, illustrations, placed, notes, changes: [], unplaced, director: { illustrations, call, repairCall, repairReasons } };
}

/** Runs `work` over `items` with at most `limit` running at once; the results keep the order of the items. */
async function mapLimited<T, R>(items: T[], limit: number, work: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, lane));
  return results;
}

export async function generateSeriesImages(input: {
  illustrations: IllustrationPlan; entities: VisualEntity[]; provider: ImageProvider; seed: string; llm: StorybookLlm; visionModel: string;
  /** Reads a picture once when the vision model answers empty or unreadably (Gemini refused one picture on every try). */
  visionFallbackModel?: string;
  pageTexts: Record<number, string>; chapterByPage?: Record<number, number>; styleReferenceUrl?: string;
  /** The model behind `provider`. Only FLUX 3 Klein binds sheet cells to scene regions; others get plain names. */
  imageModel?: string;
  buildReference?: ReturnType<typeof createIdentityReferenceCache>;
  /** Reference portraits use the same total episode image-call allowance as chapter pictures. */
  reservedImageCalls?: number;
  /** True when a drawn picture is split into sheet-like panels (production: pictureHasPanels). */
  panelCheck?: (url: string) => Promise<boolean>;
  /** Independent quality-lane limits; omitted in the original lane. */
  policy?: { maxImageCalls: number; imageRetries: number; imageConcurrency: number };
  /** Jev, the cheap second reader (../storybook/jev.ts), run next to the review; its failure never changes a verdict. */
  jev?: JevPort;
}): Promise<StorybookImagesResult> {
  const policy = input.policy || SERIES_POLICY;
  const shots = [input.illustrations.cover, ...input.illustrations.pages];
  const maxShots = 1 + SERIES_POLICY.picturesPerChapter * 4;
  if (shots.length > maxShots) throw new Error(`Die Figurenserie zeichnet höchstens ${maxShots} geplante Bilder.`);
  const buildReference = input.buildReference || createIdentityReferenceCache();
  const byId = new Map(input.entities.map(e => [e.id, e]));
  const contracts = (input.illustrations as SeriesIllustrationPlan).continuity || [];
  let imageCalls = 0, imageCostUSD = 0;
  // Per episode, never process-global: one family's provider outage cannot change another family's route.
  let primaryReadFailures = 0;
  const regionBound = !input.imageModel || input.imageModel === FLUX3_KLEIN_MODEL;
  const editableImages = new Map<number, string>();
  // Every reviewed attempt per page: after the last redraw a page keeps its best one rather than staying empty.
  const reviewed = new Map<number, ImageOutcome[]>();
  // Keep the generated image and its exact evidence when only the vision call failed.
  const visionRecoveries = new Map<number, () => Promise<ImageOutcome>>();
  const qaCalls: StorybookImagesResult['qaCalls'] = [], jevCalls: NonNullable<StorybookImagesResult['jevCalls']> = [], regenerated: number[] = [];
  const canReview = () => (input.llm as StorybookLlm & { canCall?: () => boolean }).canCall?.() !== false;
  // Story 439d746c: with "slot 1 (left half) … slot 2 (right half)" three of four two-figure pictures came back as two
  // panels split down the middle. The labels name the sheet's portraits, not halves of the scene.
  const slotPositionLabel = (index: number, total: number): string => {
    if (total === 2) return index === 0 ? ' (left portrait)' : ' (right portrait)';
    if (total === 3) return index === 0 ? ' (left portrait)' : index === 1 ? ' (middle portrait)' : ' (right portrait)';
    return '';
  };
  const render = async (shot: IllustrationShot, number = 1, previous?: ImageOutcome, simplified = false): Promise<ImageOutcome> => {
    const history: NonNullable<ImageOutcome['history']> = [...(previous?.history || [])];
    let costUSD = previous?.costUSD || 0;
    if (!canReview()) return { page: shot.page, prompt: shot.scene, attempts: 0, costUSD, status: 'failed', severity: 999, errors: ['series_budget_exhausted'], history: [...history, { kind: 'series-budget', status: 'failed', severity: 999, notes: ['Kein weiteres Bild erzeugt: Prüfbudget erreicht.'] }] };
    const drawn = shot.onStage.map(id => byId.get(id)).filter((e): e is VisualEntity => Boolean(e));
    if (drawn.some(e => e.role === 'hero' && !e.referenceUrl)) return { page: shot.page, prompt: shot.scene, attempts: 0, costUSD, severity: 999, status: 'failed', errors: ['series_avatar_reference_missing'], history: [...history, { kind: 'series-identity', status: 'failed', severity: 999, notes: ['Avatarreferenz fehlt; kein erfundenes Ersatzkind erzeugt.'] }] };
    const props = (shot.elements || []).map(id => byId.get(id)).filter((e): e is VisualEntity => Boolean(e?.kind === 'artifact' && e.referenceUrl));
    // Textual designs survive the three-cell sheet limit (the Teddy was omitted when three people filled the sheet).
    const continuity = seriesShotContinuity(contracts, shot);
    const visibleObjects = input.entities.filter(e => e.kind === 'artifact' && seriesReferenceMention(shot.scene, e));
    const designText = [seriesVisualContractText(continuity), ...visibleObjects.map(e => `${e.name}: ${e.appearance}`)].filter(Boolean).join('\n');
    const designLock = designText ? `STORY-CRITICAL OBJECT DESIGNS, only for objects already in this scene:\n${designText}\nKeep the same material, shape, scale and distinctive parts. Exactly one copy of each singular story object; no matching toy on a background shelf. Current state and placement follow the scene, never a reference pose.` : '';
    // A held object rides in its holder's cell, also when three people fill the sheet; a hidden one gets no cell (see
    // seriesPropPlacement). TALEA_SERIES_HELD_PROPS=off: every listed object gets its own cell again.
    const sheetFigures = drawn.filter(e => e.referenceUrl);
    const placement = process.env.TALEA_SERIES_HELD_PROPS === 'off' ? { carriedBy: new Map<string, string>(), hidden: new Set<string>() }
      : seriesPropPlacement(shot, sheetFigures, [...new Map([...props, ...visibleObjects.filter(e => e.referenceUrl)].map(e => [e.id, e])).values()]);
    const carried = new Map(sheetFigures.flatMap(figure => {
      const object = input.entities.find(e => e.kind === 'artifact' && e.referenceUrl && placement.carriedBy.get(e.id) === figure.id);
      return object ? [[figure.id, object] as const] : [];
    }));
    const carriedObjects = [...carried.values()];
    const cellProps = props.filter(e => !carriedObjects.includes(e) && !placement.hidden.has(e.id));
    // What the reviewer inventories as referenced objects: every object with a portrait in this picture.
    const objects = [...new Set([...props, ...carriedObjects])];
    // The holder goes first on the sheet. FLUX.2 klein hands the caption's action to the first, most described figure:
    // with Tilda in front, she hugged a second teddy while Alexander brought his own from his cell (probe 2026-11-03).
    const holders = sheetFigures.filter(e => carried.has(e.id));
    const identities = [...holders, ...sheetFigures.filter(e => !carried.has(e.id)), ...cellProps];
    const holding = (e: VisualEntity) => carried.get(e.id);
    let references: string[];
    try {
      const slots = identities.map(e => ({ imageUrl: e.referenceUrl!, displayName: e.name, kind: e.kind,
        ...(holding(e) ? { holds: { imageUrl: holding(e)!.referenceUrl!, displayName: holding(e)!.name, size: seriesObjectSize(holding(e)!) === 'small' ? 'small' as const : 'held' as const } } : {}) }));
      // One free preparation retry; no image or LLM is billed until the complete sheet is ready.
      const prepared = identities.length ? await buildReference(slots).catch(() => buildReference(slots)) : undefined;
      references = prepared?.urls.slice(0, 1) || [];
    } catch (error) {
      const diagnostic = error instanceof IdentityReferenceError
        ? `${error.code}${error.httpStatus ? ` (HTTP ${error.httpStatus})` : ''}`
        : 'reference_preparation_failed';
      return { page: shot.page, prompt: shot.scene, attempts: 0, costUSD, severity: 999, status: 'failed', errors: ['series_reference_error', diagnostic], history: [...history, { kind: 'series-reference', status: 'failed', severity: 999, notes: [`Identitätsreferenz nicht verfügbar: ${diagnostic}; kein Ersatzkind erzeugt und kein Bildaufruf bezahlt.`] }] };
    }
    const attempt = async (fixes: string[]): Promise<ImageOutcome> => {
      let imageUrl: string | undefined;
      const beat = (shot as SeriesShot).visualBeat;
      const moment = seriesPaintableMoment(shot);
      // An edit can preserve a stubborn defect. The final attempt starts a fresh scene with a different seed.
      // Pilot Funkelflug 1 (2026-11-02): edits of a doubled Ben, a doubled dragon and a missing dragon returned the same
      // picture three times; only a new scene recasts its figures. Hands and stray extras are still edited.
      const previousQa = previous?.qa as SeriesQa | undefined;
      const recast = Boolean(previousQa?.missing?.length || previousQa?.duplicates?.length || previousQa?.jevFindings?.some(finding => /drawn twice/.test(finding)));
      const editing = number === 2 && !recast ? editableImages.get(shot.page) : undefined;
      // Story 1a2fa8a4: "slot 1 (left half) is ONLY Adrian; slot 2 (right half) is ONLY the seal" came back as the sheet's
      // two panels from three seeds; the "fix" line alone changed nothing. After a split the halves are not named and the
      // figures share one space in depth.
      const afterPanels = Boolean(previousQa?.referenceSheetVisible);
      const identityAttachment = editing ? 2 : 1;
      const regions = seriesReferenceRegions(identities, beat, editing ? 1 : 0, (shot as SeriesShot).boxes, shot.page);
      const bindNames = (text: string) => !regionBound ? text : identities.reduce((caption, entity, i) => {
        const aliases = [...new Set([entity.name, ...entity.name.split(/\s+/).filter(n => n.length >= 3 && !/^(der|die|das|graf|captain|kapitän)$/i.test(n))])].sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        return caption.replace(new RegExp(`\\b(?:${aliases.join('|')})\\b`, 'gi'), `<${regions[i].id}>`);
      }, text);
      const prompt = editing ? [
        'Image 1 is the existing scene to edit. Make a local correction, preserving its rendering and every already correct person, object and action. Image 2 is only the identity sheet; do not add its figures or poses to the scene.',
        `Corrections: ${fixes.join(' ')}`,
        designLock,
        `The finished scene has exactly one ${drawn.map(e => e.name).join(' and one ')}. Each human has exactly two arms and two hands with five fingers. If a person or hand is duplicated, keep the one integrated with the main interaction and remove the extra copy completely, restoring the setting behind it.`,
        'Keep the original framing and successful details. Do not reconstruct the entire scene from the identity portraits.',
      ].join('\n') : [bindNames(moment.scene),
        beat ? bindNames(`Depict this visible moment: ${byId.get(beat.actorId)?.name} ${moment.fact}. ${beat.framing.toUpperCase()} framing with foreground and depth. Posture and expression follow this actual moment: lively during a mishap, gentle during a quiet exchange. Hands perform only the described action or rest naturally; do not invent objects to occupy them. The scene determines setting, gesture and camera; the reference sheet determines character identity, not its pose or held props.`) : '',
        SERIES_ART_DIRECTION,
        regionBound ? regions.map((r, i) => `<${r.id}> is ${r.description}, taken only from its own sheet cell and placed in its assigned scene region. Draw this ${identities[i].kind === 'artifact' ? 'object' : 'figure'} exactly once in the caption's new action; the cell's resting pose and portrait background have no part in this scene.`).join('\n') : '',
        references.length ? `IDENTITY SHEET, image ${identityAttachment}: ${identities.map((e, i) => `slot ${i + 1}${afterPanels ? '' : slotPositionLabel(i, identities.length)} is ONLY ${e.name}${e.role === 'hero' ? (e.referenceContext ? ` (${e.referenceContext})` : '') : `: ${e.appearance}`}${holding(e) ? `, together with ${holding(e)!.name} in front of ${e.name}: the one ${holding(e)!.name} of this scene, which ${e.name} holds` : ''}`).join('; ')}. Keep each face, hair, species and outfit with its OWN person; glasses, hats, vests and jackets never move to another figure or onto a creature. Ignore objects held in the portraits unless this scene explicitly needs them. A story garment explicitly worn in the scene, such as a lifejacket, goes over the portrait outfit and must remain visible. ${drawn.filter(e => e.isHuman).map(e => `${e.name} has an ordinary human silhouette, with human back and shoulders, natural human ears matching the reference, and exactly two arms and two hands, each with five separate fingers, plus two legs${e.role === 'hero' ? ', drawn at natural child height (shorter than adults)' : ''}.`).join(' ')} Their faces are large enough to recognise. The sheet's resting poses change to the action in the scene.` : '',
        ...drawn.filter(e => !e.referenceUrl).map(e => `${e.name}: ${e.appearance}.`),
        'Every described object keeps its source material, size and shape. Props come only from this scene, never from a portrait or a conversation topic.',
        designLock,
        objects.length ? `OBJECT REFERENCES (not people; no added human anatomy): ${[...cellProps.map(e => `${e.name}: ${e.appearance}`), ...[...carried].map(([holderId, e]) => `${e.name}: ${e.appearance}, shown in ${byId.get(holderId)?.name}'s portrait, the only ${e.name} in the picture, in ${byId.get(holderId)?.name}'s hands`), ...props.filter(e => placement.hidden.has(e.id)).map(e => `${e.name}: ${e.appearance}`)].join('; ')}. Preserve a toy's own stitched face and limbs when present in its reference. Match the same design in every picture. The source determines its current state and position, never the white reference background.` : '',
        simplified
          ? `A solitary scene with exactly one character, ${drawn[0]?.name}, shown only once. The surrounding landscape is uninhabited: no other figures, creatures, spectators, faces or portraits anywhere in the background. Keep only the setting of this scene, not the reference portrait's background.`
          : `Exactly ${drawn.length} foreground characters, once each: ${drawn.map(e => e.name).join(', ')}. No additional foreground children or replacement faces. A crowd explicitly named in the caption stays distant incidental silhouettes. A story instant in one continuous full-bleed setting reaching every edge; ignore the reference portraits' backgrounds and paint only the scene's own environment.${drawn.length > 1 && (afterPanels || drawn.length === 2) ? ` ${drawn.map(e => e.name).join(' and ')} share ONE place close together, overlapping in depth with one nearer the viewer, never side by side in separate halves.` : ''}`,
        fixes.length ? `Correct these observed problems in the same scene: ${fixes.join(' ')}` : '',
        wordlessLine(moment.scene),
        'Use the shared Talea Originals medium described above; only the identity sheet supplies characters.',
      ].filter(Boolean).join('\n');
      if (imageCalls + (input.reservedImageCalls || 0) >= policy.maxImageCalls) {
        history.push({ kind: 'series-budget', status: 'failed', severity: 999, notes: ['Kein weiteres Bild erzeugt: Bildbudget erreicht.'] });
        return { page: shot.page, prompt, attempts: number, costUSD, severity: 999, status: 'failed', errors: ['series_image_budget_exhausted'], history };
      }
      imageCalls++;
      const seed = parseInt(createHash('sha256').update(`${input.seed}:${shot.page}:${number}`).digest('hex').slice(0, 8), 16) % 2147483647;
      try {
      const response = await input.provider({ prompt: editing && regionBound ? prompt + '\n' + regions.map(r => `<${r.id}> is ${r.description}.`).join(' ') : prompt, negativePrompt: '', referenceImages: [...(editing ? [editing] : []), ...references], referenceRegions: regions, width: SCENE_SIZE.width, height: SCENE_SIZE.height, seed, page: shot.page, logStage: editing ? 'series-image-edit' : shot.page === 0 ? 'series-image-cover' : 'series-image-chapter' });
      imageUrl = response.url;
      const editable = response.viewUrl || response.url;
      if (editable && /^(https?:\/\/|data:image\/)/i.test(editable)) editableImages.set(shot.page, editable);
      costUSD += response.costUSD || 0; imageCostUSD += response.costUSD || 0;
      if (!response.url) {
        const reason = response.refused && response.httpStatus ? `series_provider_http_${response.httpStatus}` : 'series_provider_missing';
        history.push({ kind: 'series-provider', status: 'missing', severity: 999, notes: [reason] });
        return { page: shot.page, prompt, attempts: number, costUSD, severity: 999, status: 'missing', errors: [reason], history };
      }
      const sourceQuote = (shot as SeriesShot).storyQuote;
      const source = shot.page === 0 ? '' : seriesPictureSource(input.pageTexts[shot.page] || '', shot.paragraph, sourceQuote).slice(0, 1800);
      const reviewUser = `${shot.page === 0 ? 'COVER: recognisable characters in their world; no exact chapter action is compulsory.' : 'CHAPTER PICTURE: recognisable intact characters in this setting and activity. Harmless actor/pose differences are minor; plot-important object contradictions block.'}\nEXPECTED IDENTITIES (human or nonhuman anatomy as specified):\n${drawn.map(e => `${e.id}: ${e.name}; ${e.isHuman ? 'human' : e.species}; ${e.role === 'hero' && e.referenceUrl ? (e.referenceContext || 'identity from reference sheet') : e.appearance}; forbidden features: ${e.forbidden.join(', ') || 'none specified'}`).join('\n')}\n${objects.length ? `REFERENCED OBJECTS (not people in identityById; inventory each visible toy separately with matchedId:null): ${objects.map(e => `${e.id}: ${e.name}, ${e.appearance}`).join('; ')}. A materially different object design or an object drawn as a person is a contradiction; ordinary source-grounded pose/state changes remain fine.\n` : ''}STORY-CRITICAL DESIGNS (source-grounded, including objects without a sheet cell):\n${designText || 'No additional shared design.'}\n${continuity.length ? `SHARED DESIGN EVIDENCE:\n${continuity.map(c => c.evidence[0].quote).join('\n')}\n` : ''}SCENE CONTEXT, not an exact-action test:\n${moment.scene}\n${source}\n${references.length ? `Attachment 2 is the identity sheet, left to right: ${identities.map((e, i) => `slot ${i + 1} = ${e.id} (${e.name}; ${e.kind === 'artifact' ? 'OBJECT, not a figure' : 'character'}${holding(e) ? `, shown with ${holding(e)!.id} (${holding(e)!.name}, OBJECT) that this character holds` : ''})`).join('; ')}.` : 'No identity sheet is attached.'}`;
      let safetyBlock: StorybookSafetyBlock | undefined;
      const blockedOutcome = (block: StorybookSafetyBlock): ImageOutcome => {
        const reason = block.reason;
        history.push({ kind: 'series-vision-blocked', status: 'failed', severity: 999,
          notes: [`Prüfanbieter hat die Anfrage gesperrt (${reason}); kein Bildurteil, keine automatische Wiederholung oder Ersatzprüfung.`], url: response.url });
        return { page: shot.page, url: response.url, prompt, attempts: number, costUSD, severity: 999, status: 'failed',
          errors: ['series_vision_safety_blocked', reason], history };
      };
      // ef08de38: three Flex timeouts sent the remaining checks to Gemini ($0.0413).
      // The inexpensive primary stays on its normal tier; only a genuine reader outage uses the fallback.
      const review = async (stage: string, model = input.visionModel) => {
        try {
          const reply = await input.llm({ stage, role: 'support', model, effort: SERIES_IMAGE_REVIEW_EFFORT, json: true, maxTokens: 6000, timeoutMs: 60000, serviceTier: 'standard',
            system: SERIES_IMAGE_REVIEW_COMPACT, user: reviewUser, imageInputs: [response.viewUrl || response.url!, ...references] });
          qaCalls.push(reply);
          return readSeriesQa(reply.text, drawn, { sceneText: [moment.scene, sourceQuote || '', ...objects.map(e => `${e.name} ${e.appearance}`)].join('\n') });
        } catch (error) {
          if (error instanceof StorybookSafetyBlock) safetyBlock = error;
          return undefined;
        }
      };
      const panels = input.panelCheck && (response.viewUrl || response.url) ? input.panelCheck(response.viewUrl || response.url!).catch(() => false) : Promise.resolve(false);
      // The second reader runs next to the review (≈ 0.6 s against 20–45 s) and is awaited only for the verdict.
      const second: Promise<JevReading | undefined> = input.jev && drawn.length
        ? readWithJev(input.jev, response.viewUrl || response.url!, drawn, moment.scene).then(reading => {
          jevCalls.push(...reading.replies.map(jevCallResult));
          return reading.scores ? reading : undefined;
        }).catch(error => {
          console.warn(`[character-series] second reader failed (page ${shot.page} attempt ${number}):`, (error as Error)?.message || error);
          return undefined;
        })
        : Promise.resolve(undefined);
      const verdict = async (read: NonNullable<ReturnType<typeof readSeriesQa>>): Promise<ImageOutcome> => {
        const reading = await second;
        const qa = withJevDefects(split ? withPanelDefect(read) : read, reading?.scores ?? undefined);
        const pass = seriesPicturePasses(qa, shot.page === 0);
        const usable = !pass && seriesPictureUsable(qa);
        const status: ImageOutcome['status'] = pass ? 'passed' : usable ? 'flawed' : 'failed';
        const severity = pass ? 0 : usable ? 5 : 10;
        const notes = [...qa.defects.map(d => d.detail), ...(qa.missing || []), ...qa.duplicates];
        history.push({ kind: number === 1 ? 'series-scene' : editing ? 'targeted-scene-edit' : simplified ? 'simplified-scene-repair' : 'same-scene-repair', status, severity, notes, url: response.url,
          ...(reading?.boxes && qa.jevFindings?.length ? { boxes: reading.boxes } : {}) });
        const outcome: ImageOutcome = { page: shot.page, url: response.url, prompt, attempts: number, costUSD, qa, severity, status, history: [...history] };
        reviewed.set(shot.page, [...(reviewed.get(shot.page) || []), outcome]);
        return outcome;
      };
      // An edit keeps the panel layout; a split picture is redrawn from the scene instead.
      const split = await panels;
      if (split) editableImages.delete(shot.page);
      const fallback = input.visionFallbackModel && input.visionFallbackModel !== input.visionModel ? input.visionFallbackModel : undefined;
      const bypassPrimary = primaryReadFailures >= 2 && Boolean(fallback);
      let qa = bypassPrimary
        ? await review(`series-image-qa-${shot.page}-${number}-fallback`, fallback!)
        : await review(`series-image-qa-${shot.page}-${number}`);
      if (safetyBlock) return blockedOutcome(safetyBlock);
      if (!qa && !bypassPrimary) primaryReadFailures++;
      // 10d99c0f paid eight Terra readers after 17 empty Gemini calls, then lost two drawn pictures to the call cap.
      // At most two immediate reads; no repeated empty primary before the independent reader.
      if (!qa && canReview()) qa = await review(`series-image-qa-${shot.page}-${number}-${bypassPrimary || !fallback ? 'retry' : 'fallback'}`,
        bypassPrimary || !fallback ? input.visionModel : fallback);
      if (safetyBlock) return blockedOutcome(safetyBlock);
      if (qa) return verdict(qa);
      history.push({ kind: 'series-vision', status: 'failed', severity: 999, notes: ['Bildprüfung nicht verfügbar oder unlesbar; das erzeugte Bild bleibt für eine erneute Prüfung erhalten.'], url: response.url });
      const unverified: ImageOutcome = { page: shot.page, url: response.url, prompt, attempts: number, costUSD, severity: 999, status: 'failed', errors: ['series_vision_error'], history };
      visionRecoveries.set(shot.page, async () => {
        const recovered = await review(`series-image-qa-${shot.page}-${number}-recovery`, fallback || input.visionModel);
        if (safetyBlock) return blockedOutcome(safetyBlock);
        return recovered ? verdict(recovered) : unverified;
      });
      return unverified;
      } catch (error) {
        history.push({ kind: 'series-image-error', status: 'failed', severity: 999, notes: ['Bild oder Bildprüfung nicht vollständig verfügbar'], ...(imageUrl ? { url: imageUrl } : {}) });
        return { page: shot.page, url: imageUrl, prompt, attempts: number, costUSD, severity: 999, status: 'failed', errors: [(error as any)?.code === 'series_budget_exhausted' ? 'series_budget_exhausted' : imageUrl ? 'series_vision_error' : 'series_provider_error'], history };
      }
    };
    return attempt(simplified ? [] : previous?.qa?.posing && !previous.qa.sceneFixes?.length ? ['Show the selected hand-object interaction and its visible result, with purposeful balance rather than portrait poses.'] : previous?.qa?.sceneFixes || []);
  };
  // Every planned picture is drawn and checked at once: one after another, each waited for its 20–45 s check (story
  // ff6eff04: 211 s for four pictures). Repairs start only when every planned picture has its verdict.
  const outcomes = await mapLimited(shots, policy.imageConcurrency, shot => render(shot));
  // Give transient preparation failures one recovery pass after all first attempts have settled.
  // These pictures have never reached the provider: keep attempt/seed 1 and the paid redraw allowance.
  const referenceRecoveries = outcomes.map((outcome, index) => ({ outcome, index }))
    .filter(({ outcome }) => outcome.attempts === 0 && outcome.errors?.includes('series_reference_error'));
  await mapLimited(referenceRecoveries, policy.imageConcurrency, async ({ outcome, index }) => {
    outcomes[index] = await render(shots[index], 1, outcome);
  });
  // A temporary vision outage must not throw away a paid image or force a redraw.
  // Review the original image once more after the initial wave, keeping the same safety gates.
  const reviewedAgain = new Set<string>();
  const recoverUnverified = async () => {
    const unverified = outcomes.map((outcome, index) => ({ outcome, index }))
      .filter(({ outcome }) => outcome.errors?.includes('series_vision_error') && visionRecoveries.has(outcome.page) && !reviewedAgain.has(`${outcome.page}:${outcome.attempts}`));
    await mapLimited(unverified, policy.imageConcurrency, async ({ outcome, index }) => {
      if (!canReview()) return;
      reviewedAgain.add(`${outcome.page}:${outcome.attempts}`);
      outcomes[index] = await visionRecoveries.get(outcome.page)!();
    });
  };
  await recoverUnverified();
  // Repairs go only to hard faults, chapters before the cover: a printed "flawed" picture was never improved by a redraw
  // (ff6eff04 chapter 3, Talea-Folge 0ee9af53).
  // A picture whose only fault is a loose action (right people, right setting, nothing broken) is not redrawn: it is printed
  // as the best attempt below. Story 289c11a4 spent 7 redraws, 2.3 ct of pictures and 1.6 ct of checks on such pictures and
  // none of them got better; the redraws are for what a new seed can fix (a hand, a face, a double, lettering, a lost figure).
  // A second-reader finding (a double, merged bodies) is redrawn, though the picture would do as a last resort.
  const canRetryOutcome = (o: ImageOutcome) => (o.status === 'failed' && ((Boolean(o.qa) && (!seriesPictureLastResort(o.qa as SeriesQa) || seriesSecondReaderRedraw(o.qa as SeriesQa))) || o.errors?.includes('series_provider_error'))) ||
    (o.status === 'missing' && !o.errors?.includes('series_provider_http_402'));
  // A complicated multi-person action may fail even after an edit. For a still-pictureless chapter, ask for a
  // simpler moment from the very same paragraph, so it can remain at its original position in the book.
  const simplerShots = async (indexes: number[]): Promise<Map<number, IllustrationShot>> => {
    const eligible = indexes.map(index => {
      const shot = shots[index];
      const paragraphs = (input.pageTexts[shot.page] || '').split(/\n\n+/).filter(Boolean);
      const paragraph = paragraphs[(shot.paragraph || 1) - 1];
      return { index, shot, paragraph };
    }).filter(item => Boolean(item.paragraph));
    if (!eligible.length || !canReview()) return new Map();
    try {
      // Standard tier like every other Luna call of this lane: on flex it answered empty twice (story 9a84d5e0), 23 s
      // went by and the third chapter stayed without a picture.
      const reply = await input.llm({ stage: 'series-picture-rescue-plan', role: 'support', model: input.visionModel, effort: 'low', json: true, maxTokens: 5000, timeoutMs: 60000, serviceTier: 'standard',
        system: 'Choose a simpler, drawable moment from each exact source paragraph for a children’s book. It replaces a failed complex illustration at the same paragraph. Show exactly ONE of the allowed characters doing one visible physical action already stated in the paragraph. Choose one simpler part of the event, not the full interaction that already failed. Do not include other people or infer new events, props, clothes or words in the image. Use an exact literal source quote from that paragraph. The original scene is context for the location, not a mandate to repeat the failed action. Describe the simpler action and established setting in English. If no honest single-character moment exists, omit that page. Return JSON {"pages":[{"page":number,"onStage":["id"],"storyQuote":"exact quote","scene":"English visual scene","visualBeat":{"actorId":"id","action":"physical verb and action","result":"visible consequence","framing":"wide|medium|close"}}]}.',
        user: JSON.stringify(eligible.map(({ shot, paragraph }) => ({ page: shot.page, paragraph, originalScene: shot.scene, allowed: shot.onStage.map(id => ({ id, name: byId.get(id)?.name })) }))),
      });
      qaCalls.push(reply);
      const raw = parseJsonObject(reply.text) as any;
      if (!Array.isArray(raw.pages)) return new Map();
      const result = new Map<number, IllustrationShot>();
      for (const { index, shot, paragraph } of eligible) {
        const candidate = raw.pages.find((item: any) => item?.page === shot.page);
        const ids = candidate?.onStage;
        const beat = candidate?.visualBeat;
        const quote = typeof candidate?.storyQuote === 'string' ? candidate.storyQuote.trim() : '';
        const normalise = (value: string) => value.normalize('NFC').replace(/\s+/g, ' ').trim();
        if (!Array.isArray(ids) || ids.length !== 1 || ids.some((id: unknown) => typeof id !== 'string' || !shot.onStage.includes(id))) continue;
        if (typeof candidate.scene !== 'string' || candidate.scene.trim().length < 20 || candidate.scene.length > 1200 || quote.length < 12 || quote.length > 500 || !normalise(paragraph).includes(normalise(quote))) continue;
        if (!beat || !ids.includes(beat.actorId) || typeof beat.action !== 'string' || beat.action.length < 12 || beat.action.length > 220 || NON_VISUAL_ACTION.test(beat.action.trim()) || typeof beat.result !== 'string' || beat.result.length < 12 || beat.result.length > 260 || HIDDEN_IDENTITY.test(beat.result) || !['wide', 'medium', 'close'].includes(beat.framing)) continue;
        result.set(index, { ...shot, onStage: ids, scene: candidate.scene, storyQuote: quote, visualBeat: beat } as SeriesShot);
      }
      return result;
    } catch {
      return new Map(); // The original selected scene remains available if redirection fails.
    }
  };
  // First edit the failed scene; only if it still fails, spend any remaining budget on a fresh variant.
  // Recompute coverage between waves so chapters with no usable picture receive priority each time.
  for (const number of [2, 3]) {
    const candidates = outcomes.map((outcome, index) => ({ outcome, index }))
      .filter(({ outcome }) => canRetryOutcome(outcome) && outcome.attempts <= 2)
      .sort((a, b) => Number(a.outcome.page === 0) - Number(b.outcome.page === 0) || a.index - b.index);
    const covered = new Set(outcomes.filter(o => o.page !== 0 && isPublishable(o)).map(o => input.chapterByPage?.[o.page]).filter((chapter): chapter is number => chapter !== undefined));
    const firstInEmptyChapter = new Set<number>();
    const priority = candidates.filter(({ outcome }) => {
      const chapter = input.chapterByPage?.[outcome.page];
      if (outcome.page === 0 || chapter === undefined || covered.has(chapter) || firstInEmptyChapter.has(chapter)) return false;
      firstInEmptyChapter.add(chapter);
      return true;
    });
    const selected = new Set(priority.map(({ index }) => index));
    const available = Math.max(0, Math.min(policy.imageRetries - regenerated.length, policy.maxImageCalls - imageCalls));
    // Keep room for one more attempt per empty chapter instead of using every retry on first edits or the cover.
    const reserved = number === 2 ? Math.min(priority.length, Math.max(0, available - priority.length)) : 0;
    // Story 439d746c spent its last redraw on a third try of the same doubled boy while a split picture and the cover had
    // never been redrawn: after the pictureless chapters, a picture with fewer attempts goes first (stable sort).
    const rest = candidates.filter(({ index }) => !selected.has(index)).sort((a, b) => a.outcome.attempts - b.outcome.attempts);
    const retries = [...priority, ...rest].slice(0, available - reserved);
    if (retries.length && canReview()) {
      const rescueIndexes = number === 3 ? priority.filter(({ outcome }) => outcome.attempts === 2 && Boolean(outcome.qa)).map(({ index }) => index).filter(index => retries.some(item => item.index === index)) : [];
      const simplified = await simplerShots(rescueIndexes);
      for (const { index } of retries) regenerated.push(shots[index].page);
      await Promise.all(retries.map(async ({ index }) => { outcomes[index] = await render(simplified.get(index) || shots[index], outcomes[index].attempts + 1, outcomes[index], simplified.has(index)); }));
      await recoverUnverified();
    }
  }
  // A page (and the cover) keeps its best reviewed attempt whose only fault is a loose action or moment, rather than
  // printing nothing; a posed attempt only fills a chapter that has no picture at all. It remains marked flawed;
  // identity, safety, anatomy, lettering, extra figures and a different object or setting still prevent publication.
  for (const posedForEmptyChapter of [false, true]) {
    const covered = new Set(outcomes.filter(o => o.page !== 0 && isPublishable(o)).map(o => input.chapterByPage?.[o.page]).filter((chapter): chapter is number => chapter !== undefined));
    for (let index = 0; index < outcomes.length; index++) {
      const current = outcomes[index];
      if (isPublishable(current)) continue;
      const chapter = input.chapterByPage?.[current.page];
      const emptyChapter = posedForEmptyChapter && current.page !== 0 && chapter !== undefined && !covered.has(chapter);
      if (posedForEmptyChapter && !emptyChapter) continue;
      const best = (reviewed.get(current.page) || []).filter(o => o.url && seriesPictureLastResort(o.qa as SeriesQa, emptyChapter))
        .sort((a, b) => (b.qa!.sceneMatch - a.qa!.sceneMatch) || (b.qa!.identityMatch - a.qa!.identityMatch))[0];
      if (!best) continue;
      outcomes[index] = { ...best, status: 'flawed', severity: 5, salvaged: true, attempts: current.attempts, costUSD: current.costUSD,
        history: [...(current.history || []), { kind: 'series-best-attempt', status: 'flawed', severity: 5, notes: [best.qa?.posing ? 'Texttreuer, aber gestellter Moment statt eines bildlosen Kapitels.' : 'Bester geprüfter Versuch, nur die Handlung sitzt lose, statt eines fehlenden Bildes.'], url: best.url }] };
      if (chapter !== undefined) covered.add(chapter);
    }
  }
  return { cover: outcomes[0], pages: new Map(outcomes.slice(1).map(o => [o.page, o])), imagesGenerated: outcomes.filter(o => isPublishable(o)).length, imageCalls, imageCostUSD, qaCalls, jevCalls, regenerated };
}
