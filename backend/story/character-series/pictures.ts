import { createHash } from 'node:crypto';
import { storyImageStyleProfile, type StoryImageStyleId } from '../../ai/image-style';
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
  /** Luna rewrote this scene after reading the failed picture next to its full prompt (`readSeriesShotRewrite`). */
  rewritten?: boolean;
  rewriteCause?: string;
  /** Luna's complete corrected prompt, without the blocks the code adds back (identity line with its binding, object references, style, wordless line). */
  promptOverride?: string;
}

/**
 * A redraw with a corrected prompt (user proposal, 2026-11-04): Luna sees the failed picture, the identity sheet, the
 * COMPLETE prompt it was drawn from, the story passage and every finding (her review, Jev, the panel check), finds what in
 * the prompt caused each fault and rewrites the scene part. Until then a redraw kept the scene and appended "Correct these
 * observed problems: …" or edited the old picture; in the pilots of 2026-11-04 those repairs fixed 3 of 14 pictures, and
 * a painter that draws every noun it reads paints "a second bear" when a fix names it. The fixed blocks of the prompt
 * (identity sheet, anatomy, object designs, style) stay with the code: they carry the measured fixes of v20–v27.
 */
export const SERIES_PROMPT_REWRITE = [
  'You correct an illustration prompt for FLUX.2 klein, an image model that paints a children\'s book scene from one identity sheet. It paints every noun it reads and ignores negations: "no additional children", "without letters" or "not a second bear" bring exactly those children, letters and that bear into the picture.',
  'You get: image 1 = the picture drawn from the prompt; image 2 (when present) = the identity sheet, not part of the scene; the COMPLETE prompt; the story passage the picture must show; the reviewers\' findings.',
  'First find, for each finding, what in the prompt caused it: a sentence that names what must not appear, a crowded or repeated caption, two figures given the same place, a held object nobody holds, a word that brings writing (sign, label, poster, notice, title), an object named twice, an action the model could not stage.',
  'Then write the corrected COMPLETE prompt. The code-owned blocks are added back unchanged, so leave them out: the IDENTITY SHEET line (which slot is which figure, faces and outfits stay with their owner, the anatomy of each human, one continuous setting), the OBJECT REFERENCES and STORY-CRITICAL OBJECT DESIGNS lines, the art style paragraphs and the wordless line. Everything else is yours: the scene, the visible moment, who is in the picture, the anatomy of non-human figures, the object designs, the props. Keep what serves the picture, drop what caused a fault, say each thing once:',
  '- The same story moment from the passage, the same place and the same acting figure. Never invent another event or prop.',
  '- Only positive, visible statements. Never name a fault, a missing thing or something to avoid. Instead of "No additional children" write "The only people in the picture are Nora and Ben".',
  '- Name every figure of the cast exactly once, each with its own position in depth and its own action or gaze; name who holds each held object. Do not describe the referenced figures\' faces, hair or clothes: the identity sheet supplies them. State the anatomy of a non-human figure once as a positive sentence (two arms, four paws, one tail); the code states it for humans.',
  '- Keep each story object\'s design (material, colour, shape, size) as one sentence. Plain objects without words: shelves with plain boxes, a blank board, closed books. Fewer props rather than more.',
  '- If a figure was doubled, merged or an extra figure appeared in a picture of THREE figures, you may drop ONE figure that is not the actor; otherwise keep the cast.',
  'Return JSON {"cause":"one short sentence: what in the prompt caused the faults","prompt":"the corrected complete prompt without the code-owned blocks, 500–2500 characters","scene":"the scene as a 35–90 word English caption for the reviewer, starting with the place","action":"English physical verb phrase of the acting figure","result":"what is visibly the case in this one still","framing":"wide|medium|close","onStage":["ids of the figures that remain"]}.',
].join('\n');

/** A rewrite keeps the moment, the actor and (minus at most one) the cast; anything else falls back to the old repair. */
export function readSeriesShotRewrite(raw: any, shot: IllustrationShot, names?: Record<string, string>): IllustrationShot | undefined {
  const original = shot as SeriesShot;
  const scene = typeof raw?.scene === 'string' ? raw.scene.replace(/\s+/g, ' ').trim() : '';
  const action = typeof raw?.action === 'string' ? raw.action.trim() : '';
  const result = typeof raw?.result === 'string' ? raw.result.trim() : '';
  const framing = typeof raw?.framing === 'string' ? raw.framing.trim().toLowerCase() : '';
  if (scene.length < 45 || scene.length > 1200 || action.length < 3 || action.length > 220 || NON_VISUAL_ACTION.test(action)
    || result.length < 3 || result.length > 260 || HIDDEN_IDENTITY.test(result) || !['wide', 'medium', 'close'].includes(framing)) return undefined;
  const actorId = original.visualBeat?.actorId || shot.onStage[0];
  const ids: string[] = Array.isArray(raw?.onStage) ? [...new Set<string>(raw.onStage.filter((id: unknown): id is string => typeof id === 'string'))] : shot.onStage;
  const onStage = ids.length >= Math.max(1, shot.onStage.length - 1) && ids.every(id => shot.onStage.includes(id)) && ids.includes(actorId) ? ids : shot.onStage;
  const boxes = original.boxes ? Object.fromEntries(Object.entries(original.boxes).filter(([id]) => onStage.includes(id))) : undefined;
  const promptOverride = seriesRewrittenPrompt(raw?.prompt, onStage.map(id => names?.[id] || id));
  return { ...original, scene, onStage, visualBeat: { actorId, action, result, framing: framing as SeriesVisualBeat['framing'] },
    ...(boxes ? { boxes } : {}), ...(promptOverride ? { promptOverride } : {}),
    rewritten: true, rewriteCause: typeof raw?.cause === 'string' ? raw.cause.slice(0, 300) : undefined } as SeriesShot;
}

/**
 * Luna's complete prompt is used when it names every remaining figure and stays in size; the code-owned parts she was
 * told to leave out are cut if she copied them anyway, and words that bring writing reach the painter as plain surfaces.
 * Otherwise the redraw uses her rewritten scene inside the code-built prompt.
 */
export function seriesRewrittenPrompt(value: unknown, castNames: string[]): string | undefined {
  if (typeof value !== 'string') return undefined;
  const kept = value.split(/\n+/).map(line => line.trim()).filter(line => line && !/^(?:IDENTITY SHEET|STYLE REFERENCE|OBJECT REFERENCES|STORY-CRITICAL OBJECT DESIGNS)\b/i.test(line) && !/^A wordless illustration\.?$/i.test(line));
  const prompt = seriesWordlessCaption(kept.join('\n')).trim();
  if (prompt.length < 300 || prompt.length > 3500) return undefined;
  const named = (name: string) => [name, ...name.split(/\s+/).filter(part => part.length >= 3)].some(part => new RegExp(`(?<![\\p{L}])${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu').test(prompt));
  return castNames.every(named) ? prompt : undefined;
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
    .replace(/\bnotice\b/gi, 'sheet of paper')
    // Story 0aa83e90: "his broad sign" came back as „GRAF GRIESGRAM“, "loose rule sheets" as „Hausordnung“ in three of
    // four attempts (Jev 77–88 %, Luna saw none). A board or a page reaches the painter as a blank one.
    .replace(/\b(?:sign ?boards?|signs|placards?|posters?)\b/gi, 'plain wooden boards')
    .replace(/\bsign\b/gi, 'plain wooden board')
    .replace(/\b(?:house |garden )?rules? (sheets?|pages?|papers?|lists?)\b/gi, (_, kind: string) => `blank paper ${kind.replace(/lists?/i, 'sheets')}`)
    .replace(/\b(?:house|garden) rules\b/gi, 'blank paper sheets')
    .replace(/\b(?:notes|lists|pages)\b/gi, 'blank pages')
    .replace(/\b(?:note|list)\b/gi, 'blank page');
}

/**
 * A painter draws what it reads, "no" included: "The repaired seam stays shut, with no pale thread hanging out" came
 * back with the thread (probe 2026-11-03, story 9a84d5e0 page 6). Clauses about what is absent leave the caption; the
 * check still has the story quote.
 */
export function withoutAbsentThings(text: string): string {
  // "… and the swallowed teddy kept out of view" put a face into the machine's window (story 3169e3d5, cover).
  const unseen = String.raw`(?:kept\s+)?(?:out\s+of\s+(?:view|sight)|hidden\s+from\s+view|not\s+(?:yet\s+)?(?:visible|shown|in\s+view)|unseen|off-?screen)`;
  const cleaned = text
    .replace(/,\s*with\s+no\s+[^,.;!?]*/gi, '')
    .replace(/\s+and\s+no\s+[^,.;!?]*/gi, '')
    .replace(/,?\s+without\s+[^,.;!?]*/gi, '')
    .replace(new RegExp(String.raw`(?:,|\s+and|\s+with|\s+while)\s+[^,.;!?]*?\b${unseen}\b[^,.;!?]*`, 'gi'), '')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // A whole sentence about something unseen leaves the caption.
  return new RegExp(String.raw`\b${unseen}\b`, 'i').test(cleaned) ? '' : cleaned;
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

/**
 * What a figure that is not one of the family's avatars is, in the first words of its own look: "elderly nobleman",
 * "capable adult woman shipwright", "Round ochre snail". Since v28 the sheet line named these figures only by name;
 * Pia, an adult shipwright, then came back as a girl of the children's size and Trödel the snail with paws and arms
 * (story 7fac1369, 2026-11-04). No clothes: the portrait carries those, and a scene may change them.
 */
export function seriesFigureKind(entity: VisualEntity): string {
  if (entity.role === 'hero' || entity.kind !== 'character') return '';
  // "Graf Griesgram, elderly nobleman with …", "Tilda Tueftel, nine-year-old girl inventor with …": the name goes.
  const look = entity.appearance.trim().replace(/^(?:[A-ZÄÖÜ][\p{L}'’-]*\s+){0,3}[A-ZÄÖÜ][\p{L}'’-]*\s*,\s*/u, '');
  const head = look.split(/\s+(?:with|wearing|in|holding|who|whose)\s+|[,;.:(—–]/iu)[0].replace(/^(?:a|an|the)\s+/i, '').trim();
  if (head.length < 4 || head.length > 60 || /^(?:portrait|picture|illustration|image)\b/i.test(head)
    || head.toLocaleLowerCase('de-DE').includes(entity.name.toLocaleLowerCase('de-DE'))) return '';
  return head;
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

// Holding, and the moments an object is in a figure's hands: placing it, handing it over, showing it (story 3169e3d5:
// "Alexander places the teddy on a low bench" got the Teddy's own cell and two teddies, twice).
const HOLDING_VERB = String.raw`(?:holds?|holding|held|hugs?|hugging|hugged|cuddles?|cuddling|cuddled|press(?:es|ing|ed)?|squeez(?:es|ing|ed|e)|carr(?:y|ies|ying|ied)|rais(?:es|ing|ed|e)|lifts?|lifting|lifted|clutch(?:es|ing|ed)?|cradl(?:es|ing|ed|e)|grips?|gripping|gripped|clasps?|clasping|clasped|plac(?:es|ing|ed|e)|puts?|putting|sets?|setting|lays?|laying|laid|lowers?|lowering|lowered|hands?|handing|handed|gives?|giving|gave|offers?|offering|offered|shows?|showing|showed|presents?|presenting|presented|pass(?:es|ing|ed)?|takes?|taking|took|grabs?|grabbing|grabbed|catch(?:es|ing)?|caught|brings?|bringing|brought|picks?\s+up|picking\s+up|picked\s+up)`;
/** "squeezes past the cart", "presses into the box": the verb moves the figure, it holds nothing. ("holds out the teddy" is a hold.) */
const NOT_A_HOLD = String.raw`(?!\s+(?:past|through|into|onto|against|behind|under|over|toward|towards|beside|between|at|on|in|to|from)\b)`;
/**
 * Only a sliver of the object shows, or none: a whole portrait of it on the sheet comes back as the whole object (story
 * 9a84d5e0 page 4), and "the swallowed teddy kept out of view" must not bring it into the cover.
 */
const HIDDEN_OBJECT = /\b(?:hidden|hides?|hiding|inside|beneath|underneath|buried|tucked|swallowed|glimpses?|glimmers?|peeks?|peeking|peeps?|peeping|out of (?:view|sight)|not (?:yet )?visible|unseen)\b/i;
/** The beat's end state: "the teddy rests on the low bench" is a resting teddy, also when the caption has it placed there. */
const RESTING_OBJECT = /\b(?:rests?|resting|lies|lying|sits?|sitting|stands?|standing|remains?|remaining|stays?|staying|waits?|waiting)\b/i;
/** A reader's words for a second copy ("a second teddy on the shelf", "Keep exactly one teddy; remove the extra copy"). */
const OBJECT_COPY = /\b(?:second|extra|additional|duplicat\w*|two|twice|copies|copy|another)\b/i;
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
  /** Objects that rest somewhere in the scene (on the bench, on the floor): painted from their design text alone. */
  resting: Set<string>;
  /** Objects of which only a sliver shows, or none. */
  hidden: Set<string>;
}

/**
 * Where each referenced object is in the picture. FLUX.2 klein copies every sheet cell into the scene as a thing of its
 * own: in story 9a84d5e0 (2026-11-03) the Teddy's cell came back as a second, seated teddy beside the one Alexander
 * hugs on 6 of 6 attempts, and as a whole teddy on the page where only its ribbon peeks out of the box. A held object
 * therefore travels in its holder's cell, and a hidden one gets no cell. The beat decides first ("Alexander presses
 * Teddy against himself"); in the caption the holding verb must govern the object ("lifting a sock clear of the bear"
 * is no hold of the bear), and the holder is the figure named last before the verb.
 * A resting object gets no portrait at all. Probe with the production prompt (2026-11-03, story 3169e3d5): its portrait
 * came back as a second teddy beside a figure on 9 of 12 pictures and in its own cell on 5 of 8 (one of them giant),
 * while its design text alone drew exactly one teddy on 7 of 8.
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
  const resting = new Set<string>();
  const hidden = new Set<string>();
  for (const object of objects) {
    const names = [object.name, ...(object.referenceAliases || [])].filter(name => name.trim().length >= 3).map(name => escape(name.trim()));
    const held = new RegExp(`\\b${HOLDING_VERB}${NOT_A_HOLD}\\s+(?:[\\p{L}’'-]+\\s+){0,2}?(?:${names.join('|')})(?![\\p{L}\\p{N}’'])`, 'iu');
    const mentioning = sentences.filter(sentence => seriesReferenceMention(sentence, object));
    // Hidden in the object's own clause: "Inside the workshop, Alexander places the teddy" hid a visible teddy (probe 2026-11-03).
    const hiddenIn = (sentence: string) => sentence.split(/[,;:]|\s+(?:while|and|as|but|whereas)\s+/i).some(clause => seriesReferenceMention(clause, object) && HIDDEN_OBJECT.test(clause));
    // A machine, a cart or a boat keeps its own cell: in a child's cell it would shrink to a toy.
    if (seriesObjectSize(object) === 'large') {
      if (mentioning.some(sentence => hiddenIn(sentence))) hidden.add(object.id);
      continue;
    }
    // Probe 2026-11-03, page 2: "Alexander places the teddy on a low bench" read as a hold, and Alexander held one teddy
    // while a second rested on the bench (2 of 3 seeds); the beat's result had it resting.
    const result = beat?.result || '';
    // "holds the red teddy; the teddy rests on the table" stays a hold: the action decides over the result.
    const restsInBeat = seriesReferenceMention(result, object) && RESTING_OBJECT.test(result) && !held.test(result) && !held.test(beat?.action || '');
    for (const sentence of restsInBeat ? [] : sentences) {
      const match = held.exec(sentence);
      if (!match) continue;
      const before = sentence.slice(0, match.index);
      const holder = figures.map(figure => ({ figure, at: lastMention(before, figure) })).filter(item => item.at >= 0).sort((a, b) => b.at - a.at)[0];
      if (holder) { carriedBy.set(object.id, holder.figure.id); break; }
    }
    if (carriedBy.has(object.id)) continue;
    if (mentioning.some(sentence => hiddenIn(sentence))) hidden.add(object.id);
    else resting.add(object.id);
  }
  return { carriedBy, resting, hidden };
}
export const SERIES_STYLE_REFERENCE = 'https://www.talea.website/library/series/bruno-der-flunkerfisch/s1e1/ch2.webp';

const styleReferenceChecks = new Map<string, { ok: boolean; at: number }>();

/**
 * A style swatch the painter cannot load would cost every picture of a story (the backend may run before the frontend
 * that serves the swatch is deployed); then the style text alone paints. Checked like the series portraits
 * (identity.ts seriesLeadReference); an answer is kept ten minutes, a failure one.
 */
export async function reachableStyleReference(url: string | undefined, fetcher: typeof fetch = fetch): Promise<string | undefined> {
  if (!url || !/^https?:\/\//i.test(url)) return url;
  const cached = styleReferenceChecks.get(url);
  if (cached && Date.now() - cached.at < (cached.ok ? 600_000 : 60_000)) return cached.ok ? url : undefined;
  let ok = false;
  try {
    const response = await fetcher(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    ok = response.ok && /^image\//i.test(response.headers.get('content-type') || '');
  } catch { ok = false; }
  styleReferenceChecks.set(url, { ok, at: Date.now() });
  if (!ok) console.warn(`[character-series] style reference unavailable, the style text alone paints: ${url}`);
  return ok ? url : undefined;
}

/**
 * The line that hands the painter a selectable style's swatch. Until 2026-11-06 the reference was the wizard's preview
 * picture, a curly red-haired girl (round glasses in the painted one) and a purple monster among mushrooms: curly
 * strangers like her came back in 6 of 14 attempts of story db0d92d8, her glasses on Alexander on the cover of 429dd9c9,
 * the forest and a toadstool in the workshop of 6fa2cd2e. Probe (scripts/image-bench/style-reference-probe.ts, five real
 * scenes, two seeds): 7 of 20 preview pictures carried her, the monster or the toadstools, 0 of 20 swatch pictures. The
 * swatch shows only the medium, so the line names only that.
 */
export function seriesStyleGuide(imageNumber: number, artDirection: string): string {
  return `STYLE REFERENCE, image ${imageNumber}: an abstract swatch of the selected medium, its strokes, pigment texture, paper and palette. Paint every figure and every surface of this picture in that medium. Re-draw the identity-sheet figures in it, retaining their identifying face, hair, species, clothing and colors and replacing only the portraits' original rendering and shading. The story scene supplies the place and the objects; the identity sheet supplies the cast. One continuous scene in this medium. ${artDirection}`;
}
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

/**
 * Every shot keeps its dramatic subject; a failed picture never turns into an avatar portrait. `leadId` is the series
 * lead, or several figures of whom any one leads (Talea-Folge: the family's heroes).
 */
export function validateSeriesShots(raw: any, pages: StorybookPage[], entities: VisualEntity[], leadId: string | readonly string[], rules: SeriesShotRules = {}): SeriesIllustrationPlan {
  // Every pictured identity needs an existing reference; a style example must never supply a missing guest.
  const ids = new Set(entities.filter(e => e.kind === 'character' && e.referenceUrl).map(e => e.id));
  const leadIds: readonly string[] = typeof leadId === 'string' ? [leadId] : leadId;
  const hasLead = (onStage: string[]) => onStage.some(id => leadIds.includes(id));
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
    if ((page === 0 || page === 1) && !hasLead(onStage)) throw new Error('Die Serienhauptfigur fehlt in ihrem Titel- oder Einstiegsbild.');
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
    const source = pageShots.find(p => hasLead(p.onStage) && p.onStage.some(id => heroes.some(e => e.id === id)))
      || pageShots.find(p => hasLead(p.onStage));
    if (!source) throw error;
    const { paragraph: _paragraph, storyQuote: _quote, ...motif } = source;
    cover = { ...motif, page: 0, coverSourcePage: source.page, onStage: [...source.onStage],
      ...(source.visualBeat ? { visualBeat: { ...source.visualBeat, framing: 'wide' } } : {}),
      scene: `${source.scene} Distinct wide cover composition of this same story moment, with the lead's face clearly visible.` } as SeriesShot;
  }
  const plan = { cover, pages: pageShots, storyElements: [], continuity: readSeriesVisualContracts(raw?.continuity, pages) };
  const leadPictures = plan.pages.filter((p: IllustrationShot) => hasLead(p.onStage)).length;
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

/**
 * Who the picture director has to place where. The character series names its lead and its recurring guests; Talea-Folge
 * names the family's heroes as leads (any one of them) and the story's own acting figures as guests (../episode/pictures.ts).
 */
export interface SourcePictureCast {
  /** At least one of them is on the cover, on page 1 and in about half of the page pictures. */
  leadIds: string[];
  /** Acting supporting figures with a portrait: each in at least one page picture. */
  guests: VisualEntity[];
  /** REQUIRED CAST COVERAGE of the task. */
  coverage: string;
  /** The CAST COVERAGE rule of the system prompt. */
  coverageRule: string;
  /** Appended to the DRAWABLE rule (a creature lead). */
  drawable: string;
  /** Who the cover shows, in the composition rule ("with the lead and avatars"). */
  coverMotif: string;
  /** The repair's cast rule and the cast lines of its task. */
  repairRule: string;
  repairCast: string;
  /** Image 1 of the direction: a PUBLIC portrait. Private avatar portraits never go to the director. */
  publicReference?: VisualEntity;
  firstEncounter?: boolean;
  /** Moments the writer built the story around (Talea-Folge: the planned laughs and the wonder's first effect). */
  highlights?: string[];
}

export async function directSeriesPictures(input: {
  llm: StorybookLlm; model: string; brief: StoryBrief; title: string; pages: StorybookPage[];
  plan?: StoryPlan; entities: VisualEntity[];
  observe?: (stage: string, payload: Record<string, unknown>) => void | Promise<void>;
}): Promise<EpisodeDirection> {
  const series = input.brief.characterSeries!;
  const leadId = series.bible.characterId;
  const episode = effectiveSeriesEpisode(series.logs, series.episodeOverride);
  const firstEncounter = episode === 1 && logsForEpisode(series.logs, series.episodeOverride).length === 0;
  return directSourcePictures(input, (pageCount, chapters) => {
    const heroes = input.entities.filter(e => e.role === 'hero' && e.referenceUrl);
    const guests = input.entities.filter(e => e.kind === 'character' && e.role === 'cast' && e.id !== leadId && e.referenceUrl && chapters.some(c => actsIn(c.content, e.name)));
    // Pilots 2026-11-02, first attempts: three figures passed 8 of 16 with a human lead and 2 of 7 with the dragon
    // (doubled children, a second dragon, the dragon missing); two figures passed 10 of 12 and 3 of 5.
    const creatureLead = input.entities.some(e => e.id === leadId && !e.isHuman);
    const leadShare = Math.max(Math.min(2, pageCount), Math.floor(pageCount / 2));
    return {
      leadIds: [leadId], guests, firstEncounter,
      // Only the shared fictional pool lead is newly shown to the director. Private avatar portraits stay out.
      publicReference: input.entities.find(e => e.id === leadId && e.role === 'cast'),
      coverage: [
        `SERIES LEAD ${leadId}: on the cover, on page 1 and in at least ${leadShare} of the ${pageCount} page pictures.`,
        heroes.length ? `AVATARS (each in at least one page picture, better two, in the part of their own contribution; at least one of them beside the lead on the cover): ${heroes.map(e => `${e.id} (${e.name})`).join(', ')}.` : '',
        guests.length ? `RECURRING GUEST${guests.length > 1 ? 'S' : ''} OF THIS EPISODE (in at least one page picture, where the guest does the most): ${guests.map(e => `${e.id} (${e.name})`).join(', ')}.` : '',
      ].filter(Boolean).join('\n'),
      coverageRule: `CAST COVERAGE (see the task): the lead on the cover, on page 1 and in at least half of the page pictures; every avatar in at least one page picture, in the part of its own contribution; every recurring guest of the episode in at least one page picture, where the guest does the most. The cover shows the lead WITH ${creatureLead ? 'exactly ONE avatar, the one with the biggest part (this lead is not human, and its three-figure pictures came back with doubled children or a missing creature)' : 'the avatars (all of them when lead and avatars are at most three, otherwise those with the biggest part)'}: the family wants to find its children on the cover.`,
      drawable: creatureLead ? ' This lead is not human: every picture shows it with at most ONE other figure.' : '',
      coverMotif: 'with the lead and avatars',
      repairRule: 'Cast: the lead on the cover, on page 1 and in at least half of the page pictures; every avatar in at least one page picture; at least one avatar beside the lead on the cover; every listed recurring guest in at least one page picture.',
      repairCast: `LEAD ${leadId}\nAVATARS ${heroes.map(e => e.id).join(', ')}\n${guests.length ? `RECURRING GUESTS ${guests.map(e => e.id).join(', ')}\n` : ''}`,
    };
  });
}

/**
 * Luna directs the finished story: one picture per reading segment (two per chapter), each from an exact quote of its
 * segment, with a physical action, a framing and the shared designs of the story's objects. The cast rules come from
 * `castFor`; everything else is the character series' proven direction.
 */
export async function directSourcePictures(input: {
  llm: StorybookLlm; model: string; brief: StoryBrief; title: string; pages: StorybookPage[];
  plan?: StoryPlan; entities: VisualEntity[];
  observe?: (stage: string, payload: Record<string, unknown>) => void | Promise<void>;
}, castFor: (pageCount: number, chapters: Array<{ order: number; content: string }>) => SourcePictureCast): Promise<EpisodeDirection> {
  const perChapter = SERIES_POLICY.picturesPerChapter;
  const chapters = input.pages.map(p => ({ order: p.order, content: p.content }));
  // Two pictures per chapter (story ff6eff04 had four pictures for 1,400 words): every chapter is cut into reading
  // segments at paragraph borders, one picture per segment, printed right after the paragraph it shows — the
  // Talea-Folge machinery (../episode/pictures.ts).
  const slots = buildImageSlots(chapters, { chapters: [] }, perChapter);
  const pages = pagesFor(slots);
  const cast = castFor(pages.length, chapters);
  const { guests, firstEncounter, coverage } = cast;
  const rules: SeriesShotRules = { strict: true, guestIds: guests.map(e => e.id) };
  const publicLead = cast.publicReference;
  const pageText = pages.map((p, i) => `PAGE ${p.order} — chapter ${slots[i].chapter}, part ${slots[i].part + 1} of ${slots.filter(s => s.chapter === slots[i].chapter).length}\n${p.content.split(/\n\n/).map((t, k) => `p${k + 1}: ${t}`).join('\n')}`).join('\n\n');
  // A ceiling, not a price: only used tokens are billed, and a thinking model needs the room before its JSON.
  // Luna used 6.0k and 6.7k of 8k for six pages (3.3k/4.0k thinking) and twice ran out (2026-11-02): two stories failed.
  const directionTokens = 4000 + pages.length * 1500;
  const call = await input.llm({ stage: 'series-picture-direction', role: 'support', model: input.model, json: true, effort: 'medium', maxTokens: directionTokens, serviceTier: 'standard', timeoutMs: 120000,
    imageInputs: [...(publicLead?.referenceUrl ? [publicLead.referenceUrl] : []), SERIES_STYLE_REFERENCE],
    system: [
      // Haiku planned two pictures per chapter instead of one per page in all three runs on 2026-10-29 ([1,1,2,2,3,3,4,5]).
      `Illustrate the FINISHED children's story faithfully, with lively expressions and clear landscape compositions. Exactly ONE picture per PAGE plus a distinct cover. A PAGE is already a reading segment of a chapter (up to ${perChapter} PAGES per chapter): return exactly ${pages.length} page entries, numbered ${pages.map(p => p.order).join(', ')} in order. Paragraph numbers p1, p2, ... restart on each PAGE. Each picture has 1 to 3 referenced figures and a concise English scene caption of 35–65 words.`,
      cast.coverageRule,
      'For a referenced avatar identify them by name and action only; do not describe their hair, ears, teeth, face, clothing or other visible appearance in captions. The identity sheet supplies those details. Exception: explicitly donned story garments such as lifejackets MUST be described and stay worn until removed in the source. Nonvisual age or height may be used for scale.',
      'SOURCE FIRST: for each PAGE, first copy storyQuote, a consecutive 12–500 character passage that actually states the selected action AND its visible result. Then set paragraph to the LAST local paragraph needed for that result, even if it is the last paragraph of the page. Only then derive onStage, visualBeat and scene from that passage. Do not cite a vague lead-in, an earlier dialogue line or the start of an action while drawing its later result. Never borrow an event from another PAGE. The finished prose, not a planned gag or an imagined improvement, is the authority.',
      VISIBLE_STAGING,
      'SHARED PROP DESIGNS: return top-level continuity for at most FOUR plot-important objects, including a title device or beloved toy even when it has no portrait or sheet cell. Each entry is {name:"source name",aliases:["source names","English caption nouns"],appearance:"concise English material, shape, scale and distinctive parts",evidence:[{page:number,quote:"exact 12–500 character source passage naming and describing this object"}]}. Use only source-grounded stable design facts, no invented machinery, powers or people. Keep temporary states such as an open seam, removed boots or a detached panel in the individual scene, not in the shared appearance. So is a size, number or material the story\'s magic gives an object: the appearance describes it as first shown ("they can grow to enormous geese" painted flocks of living geese), and it names no other object (a board\'s "grooves for the sliding geese" painted eight geese where none belonged). When the magic has changed an object, its caption keeps the material and kind with the new size ("the green wooden goose game piece, now as tall as Ben"). A collection box attached to a machine is part of that same device, never a second freestanding object. Resolve every caption against these same designs. A floor-level broom/pedal/box stays that device, not a different factory machine; a cardboard sign stays cardboard. Include worn lifejackets or other consequential garments in each caption AFTER the prose establishes them. A wide overview of an occupied vehicle must not imply that its other passengers vanished: choose a tighter crop if the cast limit prevents an honest overview.',
      'CAST AT THIS MOMENT: include only figures physically present at this source moment. A caption never names a person who is not onStage, not even as an owner or job ("the big padded seat", never "the captain\'s seat": a named captain is painted). If a child arrives later in the PAGE, choose a moment after that arrival or leave the child out. Prefer the actual participants, not an extra spectator to meet coverage. Keep the source actor and helper; do not replace them with a guest to satisfy a quota. Cover and coverage wishes never override chronology.',
      'Choose the most expressive TRUE moment in the segment. A physical joke is welcome when it actually occurs there. A quiet arrival, someone carrying an object or helping with a real task is better than an invented mishap. A funny result from an earlier page must not be repeated in a later picture. Give the two pictures of each chapter different moments.',
      ...(cast.highlights?.length ? [`MOMENTS THE WRITER BUILT THE STORY AROUND (candidates only: when one actually happens in a PAGE's paragraphs, it is that page's best picture; the prose decides how it looks): ${cast.highlights.join(' — ')}.`] : []),
      // In 70 pilot first attempts, two figures were more reliable than three (48% vs. 31%).
      `DRAWABLE: prefer TWO figures and medium framing, with one clear action and readable faces. A third figure belongs only when actually participating, and at most TWO page pictures show three figures.${cast.drawable} Cooperating figures may keep their real roles; never invent a different action to simplify the composition. Prefer a large object or visible consequence over tiny mechanical workings. Keep each recurring prop’s established material, size and shape. All prominent figures are listed in onStage; an explicitly mentioned distant crowd may be incidental silhouettes, not extra foreground children.`,
      'SETTING: start scene with the actual location already established by this text, followed by the figures and the visible action. An outdoor courtyard is outdoors, not an indoor room. Name a boat, house, shop or place by what it is in plain English (aboard the small wooden sailboat at the jetty), never by its German proper name: "on the Seegras" was painted as a grassy meadow with a park bench. Reference images supply identity and rendering only, never their background or props. Do not add irrelevant settings, excluded places or appearance details.',
      'Every shot needs visualBeat {actorId, action, result, framing} and boxes {"id":[top,left,bottom,right]} on a 0–1000 scale of the 3:2 landscape canvas. Start action with an English physical VERB, not watching, speaking, agreeing or deciding. The result must be observable in ONE still. framing is wide, medium or close; use at least TWO scales across three or more page pictures. In `boxes`, keep realistic relative sizes (adult ~650–820 tall, child ~480–640 tall and visibly shorter than adults, small creature/dragon/mouse/bird ~260–440 tall) and vary left/center/right placement so consecutive pictures never repeat a side-by-side 50/50 split.',
      `Compose a full-body or three-quarter scene with depth and expressive faces. The cover uses a real motif from the first half of the story, ${cast.coverMotif}, never the resolved ending and never the moment of the PAGE 1 picture (Blubbert's cover repeated it). The illustration is wordless: never write lettering, letters, slogans or what a sign, note or paper says into a caption; a lettered board is a painted board, a notice a sheet of paper. Only CHARACTER identities with supplied references may be onStage. A referenced OBJECT is never a character: put its exact id in elements when it is visible in the selected source moment. The identity sheet holds ${SERIES_SHEET_CELLS} cells: a picture with three figures has elements:[], one with two figures at most one element. Keep the object's stable shape, colours, material and scale, allowing only the state changes explicitly in the prose. Include the source-language object name in the cover caption when elements names that object, so its presence can be verified.`,
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
  const leadId = cast.leadIds;
  try { illustrations = validateSeriesShots(first, pages, input.entities, leadId, rules); }
  catch (error) {
    repairReasons = [issue(error)];
    await input.observe?.('series-picture-plan-invalid', { issues: [...repairReasons], plan: first, usage: call.usage });
    try {
      repairCall = await input.llm({ stage: 'series-picture-plan-repair', role: 'support', model: input.model, json: true, effort: 'medium', maxTokens: directionTokens, serviceTier: 'standard', timeoutMs: 120000,
        system: 'Repair only the supplied illustration plan JSON: one picture per PAGE (a reading segment of a chapter), exactly the given pages in order, plus the cover. The DEFECT is real: never return the plan unchanged; for a missing page choose a real physical event from that page\'s own paragraphs. Each image has 1 to 3 visible referenced characters. Preserve the selected event unless its evidence or activity is invalid; then choose a true moment from that page. Every cover/page needs visualBeat {actorId, action, result, framing}; actorId is onStage, action starts with an English physical verb or concrete posture, result is visible, framing is wide|medium|close. Across three or more page pictures use at least TWO framing scales. An introduction, objection or agreement alone is not a visible event; a concrete seated or standing arrangement can be. ' + cast.repairRule + ' "paragraph" is the local paragraph number within its page. Keep captions, page order and paragraph numbers where valid, with no invented objects or events. Return only the corrected plan.',
        user: `DEFECT ${repairReasons[0].errors.join('; ')}\n${cast.repairCast}ALLOWED REFERENCED IDENTITIES ${input.entities.filter(e => e.referenceUrl).map(e => `${e.id}: ${e.name}`).join('; ')}\nEXACTLY ${pages.length} PAGES\nEvery page needs storyQuote: an exact 12–500 character passage from THAT page proving the physical event AND its result. paragraph is the LAST paragraph needed for the complete event. Include only people already physically present there; never borrow a later gag or add a spectator to meet coverage. A quiet true action is better than an invented mishap. Its result must read in one still without a temporal comparison. Keep identifying faces visible. Use only source-present props.\n${VISIBLE_STAGING}\nSOURCE PAGES:\n${pageText}\nPLAN\n${call.text}` });
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
  imageStyle?: StoryImageStyleId;
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
  /** Whether a style profile's swatch can be loaded (production: a cached HEAD request). */
  styleReferenceCheck?: (url: string) => Promise<string | undefined>;
}): Promise<StorybookImagesResult> {
  const policy = input.policy || SERIES_POLICY;
  const shots = [input.illustrations.cover, ...input.illustrations.pages];
  const maxShots = 1 + SERIES_POLICY.picturesPerChapter * 4;
  if (shots.length > maxShots) throw new Error(`Die Figurenserie zeichnet höchstens ${maxShots} geplante Bilder.`);
  const buildReference = input.buildReference || createIdentityReferenceCache();
  const styleProfile = storyImageStyleProfile(input.imageStyle);
  const artDirection = styleProfile?.artDirection || SERIES_ART_DIRECTION;
  const styleReference = input.styleReferenceUrl
    || (styleProfile ? await (input.styleReferenceCheck || reachableStyleReference)(styleProfile.referenceUrl) : undefined);
  const byId = new Map(input.entities.map(e => [e.id, e]));
  const contracts = (input.illustrations as SeriesIllustrationPlan).continuity || [];
  let imageCalls = 0, imageCostUSD = 0;
  // Per episode, never process-global: one family's provider outage cannot change another family's route.
  let primaryReadFailures = 0;
  const regionBound = !input.imageModel || input.imageModel === FLUX3_KLEIN_MODEL;
  const editableImages = new Map<number, string>();
  // The last drawn picture and identity sheet of each page, for the prompt rewrite before its redraw.
  const lastPicture = new Map<number, string>();
  const lastSheet = new Map<number, string>();
  // Every reviewed attempt per page: after the last redraw a page keeps its best one rather than staying empty.
  const reviewed = new Map<number, ImageOutcome[]>();
  // Page → objects a reader saw twice there; their next attempts leave the portrait out (see the sheet below).
  const doubledObjects = new Map<number, Set<string>>();
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
    // Only what the caption paints: an object "kept out of view" brings no design line that would paint it.
    const paintable = seriesPaintableMoment(shot).scene;
    const visibleObjects = input.entities.filter(e => e.kind === 'artifact' && seriesReferenceMention(paintable, e));
    // One design line per object: the Teddy came twice (contract and portrait text) on pages that drew two teddies. An
    // object with a portrait keeps the text that matches its portrait.
    const sceneObjects = [...new Map([...props, ...visibleObjects].map(e => [e.id, e])).values()];
    const continuity = seriesShotContinuity(contracts, { ...shot, scene: paintable })
      .filter(contract => !sceneObjects.some(e => [contract.name, ...contract.aliases].some(alias => seriesReferenceMention(alias, e))));
    const designText = seriesWordlessCaption([seriesVisualContractText(continuity), ...sceneObjects.map(e => `${e.name}: ${e.appearance}`)].filter(Boolean).join('\n'));
    // A held object rides in its holder's cell, also when three people fill the sheet; a resting or hidden one is painted
    // from its design text; only a large thing keeps a cell of its own (see seriesPropPlacement). Once a reader saw a
    // second copy of an object on this page, later attempts paint it from its text too: the held Teddy's portrait came
    // back as a second teddy on 4 of 4 close hugs (probe 2026-11-03), its text alone on 0 of 4.
    // TALEA_SERIES_HELD_PROPS=off: every listed object gets its own cell again.
    const sheetFigures = drawn.filter(e => e.referenceUrl);
    const copied = doubledObjects.get(shot.page);
    const candidates = [...new Map([...props, ...visibleObjects.filter(e => e.referenceUrl)].map(e => [e.id, e])).values()].filter(e => !copied?.has(e.id));
    const placement = process.env.TALEA_SERIES_HELD_PROPS === 'off' ? { carriedBy: new Map<string, string>(), resting: new Set<string>(), hidden: new Set<string>() }
      : seriesPropPlacement(shot, sheetFigures, candidates);
    // One object per figure.
    const carried = new Map<string, VisualEntity>();
    for (const object of candidates) {
      const holder = placement.carriedBy.get(object.id);
      if (holder && !carried.has(holder)) carried.set(holder, object);
    }
    const carriedObjects = [...carried.values()];
    const cellProps = props.filter(e => !carriedObjects.includes(e) && !placement.hidden.has(e.id) && !placement.resting.has(e.id) && !copied?.has(e.id));
    // A referenced object's design is stated in OBJECT REFERENCES, never a second time in this block.
    // The 2026-11-04 Tilda run drew a separate collection box beside the same machine through four attempts.
    const referencedObjects = new Set([...cellProps, ...carriedObjects].map(e => e.id));
    const designOnly = seriesWordlessCaption([seriesVisualContractText(continuity), ...sceneObjects
      .filter(e => !referencedObjects.has(e.id) && (!placement.hidden.has(e.id) || visibleObjects.some(visible => visible.id === e.id)))
      .map(e => `${e.name}: ${e.appearance}`)].filter(Boolean).join('; '));
    const designLock = designOnly ? `STORY-CRITICAL OBJECT DESIGNS: ${designOnly}. Preserve material, shape, scale and distinctive parts; current state and placement follow the scene.` : '';
    // What the reviewer inventories as referenced objects: every story object of this picture with a portrait.
    const objects = [...new Set([...props, ...carriedObjects])];
    // The holder goes first on the sheet. FLUX.2 klein hands the caption's action to the first, most described figure:
    // with Tilda in front, she hugged a second teddy while Alexander brought his own from his cell (probe 2026-11-03).
    const holders = sheetFigures.filter(e => carried.has(e.id));
    const identities = [...holders, ...sheetFigures.filter(e => !holders.includes(e)), ...cellProps];
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
      const interior = /^\s*(?:inside|indoors|within)\b/i.test(moment.scene)
        ? 'An enclosed interior with a continuous floor and enclosing walls; outdoor scenery is visible only through openings.' : '';
      // An edit can preserve a stubborn defect. The final attempt starts a fresh scene with a different seed.
      // Pilot Funkelflug 1 (2026-11-02): edits of a doubled Ben, a doubled dragon and a missing dragon returned the same
      // picture three times; only a new scene recasts its figures. Hands and stray extras are still edited.
      const previousQa = previous?.qa as SeriesQa | undefined;
      const recast = Boolean(previousQa?.missing?.length || previousQa?.duplicates?.length || previousQa?.jevFindings?.some(finding => /drawn twice/.test(finding)) || copied?.size);
      // A rewritten scene is drawn fresh: the old picture would carry the faults the rewrite removes.
      const editing = number === 2 && !recast && !(shot as SeriesShot).rewritten ? editableImages.get(shot.page) : undefined;
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
      const sheetSlots = `IDENTITY SHEET, image ${identityAttachment}: ${identities.map((e, i) => {
        const kind = seriesFigureKind(e);
        return `slot ${i + 1}${afterPanels ? '' : slotPositionLabel(i, identities.length)} is ONLY ${e.name}${e.role === 'hero' && e.referenceContext ? ` (${e.referenceContext})` : kind ? ` (${kind})` : ''}${holding(e) ? `, holding ${holding(e)!.name}` : ''}`;
      }).join('; ')}.`;
      const sheetBinding = `Keep each face, hair, species and outfit with its OWN person. The scene determines expressly changed clothing and accessories; the portrait supplies the remaining identity. Each creature keeps its referenced body plan. Garments expressly worn at this moment remain visible. Only scene-required props belong in the picture. ${drawn.filter(e => e.isHuman).map(e => `${e.name} has an ordinary human silhouette, natural human ears matching the reference, exactly two arms and two hands, each with five separate fingers, plus two legs${e.role === 'hero' ? ', at natural child height (shorter than adults)' : ''}.`).join(' ')} Their faces are large enough to recognise. Change the portrait poses to the scene's action.`;
      const objectReferences = cellProps.length || carried.size ? `OBJECT REFERENCES (not people; no added human anatomy): ${[...cellProps.map(e => `${e.name}: ${e.appearance}`), ...[...carried].map(([holderId, e]) => `${e.name}: ${e.appearance}, shown in ${byId.get(holderId)?.name}'s portrait, the only ${e.name} in the picture, in ${byId.get(holderId)?.name}'s hands`)].join('; ')}. Preserve a toy's own stitched face and limbs when present in its reference. Match the same design in every picture. The source determines its current state and position, never the white reference background.` : '';
      const override = !editing && !regionBound ? (shot as SeriesShot).promptOverride : undefined;
      // Luna's complete corrected prompt; the code adds back the identity line with its binding (pilot 2026-11-04: without
      // it Nora lost her glasses and the sheet's portraits floated over the scene), the object references, the style and
      // the wordless line.
      const prompt = override ? [
        override,
        interior,
        artDirection,
        references.length ? `${sheetSlots} ${sheetBinding} A story instant in one continuous full-bleed setting reaching every edge; ignore the reference portraits' backgrounds and paint only the scene's own environment.` : '',
        designLock,
        objectReferences,
        wordlessLine(override),
        styleProfile ? 'Use the selected illustration medium described above consistently for figures and environment; only the identity sheet supplies characters.' : 'Use the shared Talea Originals medium described above; only the identity sheet supplies characters.',
      ].filter(Boolean).join('\n') : editing ? [
        'Image 1 is the existing scene to edit. Make a local correction, preserving its rendering and every already correct person, object and action. Image 2 is only the identity sheet; do not add its figures or poses to the scene.',
        `Corrections: ${fixes.join(' ')}`,
        designLock,
        `The finished scene has exactly one ${drawn.map(e => e.name).join(' and one ')}. Each human has exactly two arms and two hands with five fingers. If a person or hand is duplicated, keep the one integrated with the main interaction and remove the extra copy completely, restoring the setting behind it.`,
        'Keep the original framing and successful details. Do not reconstruct the entire scene from the identity portraits.',
      ].join('\n') : [bindNames(moment.scene),
        interior,
        beat ? `${beat.framing.toUpperCase()} framing with foreground and depth. Posture and expression follow the caption's instant. Hands perform that action or rest naturally. The scene supplies setting, gesture and camera; the reference supplies identity.` : '',
        artDirection,
        regionBound ? regions.map((r, i) => `<${r.id}> is ${r.description}, taken only from its own sheet cell and placed in its assigned scene region. Draw this ${identities[i].kind === 'artifact' ? 'object' : 'figure'} exactly once in the caption's new action; the cell's resting pose and portrait background have no part in this scene.`).join('\n') : '',
        references.length ? `${sheetSlots} ${sheetBinding}` : '',
        ...drawn.filter(e => !e.referenceUrl).map(e => `${e.name}: ${e.appearance}.`),
        'Every described object keeps its source material, size and shape. Props come only from this scene, never from a portrait or a conversation topic.',
        designLock,
        objectReferences,
        simplified
          ? `A solitary scene with exactly one character, shown once in the caption's location and moment. The surrounding space is the same continuous environment.`
          : `Exactly ${drawn.length} foreground characters, each shown once. One continuous full-bleed scene reaching every edge, in the caption's own environment.${drawn.length > 1 && (afterPanels || drawn.length === 2) ? ' The figures share ONE place close together, overlapping in depth with one nearer the viewer.' : ''}`,
        fixes.length ? `Correct these observed problems in the same scene: ${fixes.join(' ')}` : '',
        wordlessLine(moment.scene),
        styleProfile ? 'Use the selected illustration medium described above consistently for figures and environment; only the identity sheet supplies characters.' : 'Use the shared Talea Originals medium described above; only the identity sheet supplies characters.',
      ].filter(Boolean).join('\n');
      const styleGuide = styleReference ? seriesStyleGuide(references.length + (editing ? 1 : 0) + 1, artDirection) : '';
      const styledPrompt = styleGuide ? `${prompt}\n${styleGuide}` : prompt;
      if (imageCalls + (input.reservedImageCalls || 0) >= policy.maxImageCalls) {
        history.push({ kind: 'series-budget', status: 'failed', severity: 999, notes: ['Kein weiteres Bild erzeugt: Bildbudget erreicht.'] });
        return { page: shot.page, prompt, attempts: number, costUSD, severity: 999, status: 'failed', errors: ['series_image_budget_exhausted'], history };
      }
      imageCalls++;
      const seed = parseInt(createHash('sha256').update(`${input.seed}:${shot.page}:${number}`).digest('hex').slice(0, 8), 16) % 2147483647;
      try {
      const response = await input.provider({ prompt: editing && regionBound ? styledPrompt + '\n' + regions.map(r => `<${r.id}> is ${r.description}.`).join(' ') : styledPrompt, negativePrompt: '', referenceImages: [...(editing ? [editing] : []), ...references, ...(styleReference ? [styleReference] : [])], ...(styleProfile ? { imageStyle: styleProfile.id } : {}), referenceRegions: regions, width: SCENE_SIZE.width, height: SCENE_SIZE.height, seed, page: shot.page, logStage: editing ? 'series-image-edit' : shot.page === 0 ? 'series-image-cover' : 'series-image-chapter' });
      imageUrl = response.url;
      const editable = response.viewUrl || response.url;
      if (editable && /^(https?:\/\/|data:image\/)/i.test(editable)) {
        editableImages.set(shot.page, editable);
        lastPicture.set(shot.page, editable);
        if (references[0]) lastSheet.set(shot.page, references[0]); else lastSheet.delete(shot.page);
      }
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
        // The blocked picture is never printed, edited or shown to another reader; the page may be drawn once more from
        // its scene (story 6fa2cd2e lost the repaired-teddy picture, its emotional payoff, to one blocked read).
        editableImages.delete(shot.page);
        lastPicture.delete(shot.page);
        lastSheet.delete(shot.page);
        history.push({ kind: 'series-vision-blocked', status: 'failed', severity: 999,
          notes: [`Prüfanbieter hat die Anfrage gesperrt (${reason}); kein Bildurteil, dieses Bild wird nie gedruckt. Die Seite darf einmal neu gezeichnet werden.`], url: response.url });
        return { page: shot.page, url: response.url, prompt, attempts: number, costUSD, severity: 999, status: 'failed',
          errors: ['series_vision_safety_blocked', reason], history };
      };
      // Whether the last read reached its reader (and was unreadable) or failed on the way there.
      let answered = false;
      // ef08de38: three Flex timeouts sent the remaining checks to Gemini ($0.0413).
      // The inexpensive primary stays on its normal tier; only a genuine reader outage uses the fallback.
      const review = async (stage: string, model = input.visionModel) => {
        answered = false;
        try {
          const reply = await input.llm({ stage, role: 'support', model, effort: SERIES_IMAGE_REVIEW_EFFORT, json: true, maxTokens: 6000, timeoutMs: 60000, serviceTier: 'standard',
            system: SERIES_IMAGE_REVIEW_COMPACT, user: reviewUser, imageInputs: [response.viewUrl || response.url!, ...references] });
          qaCalls.push(reply);
          answered = true;
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
        history.push({ kind: number === 1 ? 'series-scene' : editing ? 'targeted-scene-edit' : simplified ? 'simplified-scene-repair' : (shot as SeriesShot).rewritten ? 'rewritten-scene' : 'same-scene-repair', status, severity, notes, url: response.url,
          ...(reading?.boxes && qa.jevFindings?.length ? { boxes: reading.boxes } : {}) });
        // A second copy of an object with a portrait: from now on this page paints it from its design text alone.
        for (const object of [...cellProps, ...carriedObjects]) {
          if (qa.defects.some(d => d.kind === 'continuity' && OBJECT_COPY.test(`${d.detail} ${d.fix}`) && seriesReferenceMention(`${d.detail} ${d.fix}`, object))) {
            doubledObjects.set(shot.page, new Set([...(doubledObjects.get(shot.page) || []), object.id]));
          }
        }
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
      // An answer the parser could not read is the primary's own slip (a field too long, a cut-off JSON): it reads once
      // more at about a tenth of the fallback's price (Gemini 0.79 ¢ for one check in story db0d92d8; in 6fa2cd2e Gemini
      // then refused the picture outright and the page stayed empty). A primary that did not answer counts as an outage.
      const primarySlipped = !bypassPrimary && answered;
      if (!qa && !bypassPrimary && !primarySlipped) primaryReadFailures++;
      // 10d99c0f paid eight Terra readers after 17 empty Gemini calls, then lost two drawn pictures to the call cap.
      // At most two immediate reads; no repeated empty primary before the independent reader.
      const secondOnPrimary = bypassPrimary || !fallback || primarySlipped;
      if (!qa && canReview()) qa = await review(`series-image-qa-${shot.page}-${number}-${secondOnPrimary ? 'retry' : 'fallback'}`,
        secondOnPrimary ? input.visionModel : fallback);
      if (!qa && primarySlipped) primaryReadFailures++;
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
    if ((shot as SeriesShot).rewritten && number > 1) history.push({ kind: 'prompt-rewrite', status: 'info', severity: 0, notes: [(shot as SeriesShot).rewriteCause || 'Szene neu formuliert'] });
    // The rewrite already turned the findings into the scene; appended fix sentences would name the faults again.
    return attempt(simplified || (shot as SeriesShot).rewritten ? [] : previous?.qa?.posing && !previous.qa.sceneFixes?.length ? ['Show the selected hand-object interaction and its visible result, with purposeful balance rather than portrait poses.'] : previous?.qa?.sceneFixes || []);
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
  // A picture a reader's safety filter refused is drawn once more (a new picture, never the refused one edited); a
  // scene that is refused twice stays without a picture.
  const blockedOnce = (o: ImageOutcome) => Boolean(o.errors?.includes('series_vision_safety_blocked'))
    && (o.history || []).filter(h => h.kind === 'series-vision-blocked').length < 2;
  const canRetryOutcome = (o: ImageOutcome) => (o.status === 'failed' && ((Boolean(o.qa) && (!seriesPictureLastResort(o.qa as SeriesQa) || seriesSecondReaderRedraw(o.qa as SeriesQa))) || o.errors?.includes('series_provider_error') || blockedOnce(o))) ||
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
        // The rescue is its own one-figure scene: an earlier rewrite's complete prompt (with the full cast) stays behind.
        const { promptOverride: _prompt, rewritten: _rewritten, rewriteCause: _cause, ...base } = shot as SeriesShot;
        result.set(index, { ...base, onStage: ids, scene: candidate.scene, storyQuote: quote, visualBeat: beat } as SeriesShot);
      }
      return result;
    } catch {
      return new Map(); // The original selected scene remains available if redirection fails.
    }
  };
  // TALEA_SERIES_PROMPT_REWRITE=off: the redraw keeps its scene (an edit, then the same scene with fix sentences) as before.
  const rewriteShot = async (index: number): Promise<IllustrationShot | undefined> => {
    const shot = shots[index], outcome = outcomes[index];
    const picture = lastPicture.get(shot.page);
    const findings = [...new Set([...(outcome.history?.filter(h => h.kind !== 'prompt-rewrite').at(-1)?.notes || []), ...((outcome.qa?.sceneFixes as string[] | undefined) || [])])].filter(Boolean).slice(0, 10);
    if (process.env.TALEA_SERIES_PROMPT_REWRITE === 'off' || !picture || !outcome.prompt || !findings.length || !canReview()) return undefined;
    const sheet = lastSheet.get(shot.page);
    const source = shot.page === 0 ? '' : seriesPictureSource(input.pageTexts[shot.page] || '', shot.paragraph, (shot as SeriesShot).storyQuote).slice(0, 1800);
    try {
      // The same reader as the checks: after two failed primary reads the fallback reader rewrites too.
      const model = primaryReadFailures >= 2 && input.visionFallbackModel ? input.visionFallbackModel : input.visionModel;
      const reply = await input.llm({ stage: `series-image-rewrite-${shot.page}-${outcome.attempts + 1}`, role: 'support', model, effort: 'medium', json: true, maxTokens: 5000, timeoutMs: 90000, serviceTier: 'standard',
        system: SERIES_PROMPT_REWRITE,
        user: [
          `FINDINGS OF THE REVIEW:\n${findings.map(finding => `- ${finding}`).join('\n')}`,
          `CAST OF THIS PICTURE (ids): ${shot.onStage.map(id => `${id} (${byId.get(id)?.name || id}${(shot as SeriesShot).visualBeat?.actorId === id ? ', the acting figure' : ''})`).join(', ')}`,
          source ? `STORY PASSAGE (the picture prints after it):\n${source}` : 'COVER: an inviting moment from the first half of the story with these figures.',
          `COMPLETE PROMPT OF THE FAILED PICTURE:\n${outcome.prompt}`,
        ].join('\n\n'),
        imageInputs: [picture, ...(sheet ? [sheet] : [])] });
      qaCalls.push(reply);
      return readSeriesShotRewrite(parseJsonObject(reply.text), shot, Object.fromEntries(shot.onStage.map(id => [id, byId.get(id)?.name || id])));
    } catch (error) {
      if (error instanceof StorybookSafetyBlock) throw error;
      return undefined; // The old repair remains.
    }
  };
  // First edit the failed scene; only if it still fails, spend any remaining budget on a fresh variant.
  // Recompute coverage between waves so chapters with no usable picture receive priority each time.
  // A fourth wave (v27): a doubled object comes back on about half of the fresh seeds (probe 2026-11-03, 6 of 12), so
  // three attempts left one picture in eight empty; the fourth only runs for pictures that still fail.
  for (const number of [2, 3, 4]) {
    const candidates = outcomes.map((outcome, index) => ({ outcome, index }))
      .filter(({ outcome }) => canRetryOutcome(outcome) && outcome.attempts < number)
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
      // Each further wave rewrites the latest prompt, after the latest picture.
      await Promise.all(retries.map(async ({ index }) => {
        if (!simplified.has(index)) {
          const rewritten = await rewriteShot(index);
          if (rewritten) shots[index] = rewritten;
        }
        outcomes[index] = await render(simplified.get(index) || shots[index], outcomes[index].attempts + 1, outcomes[index], simplified.has(index));
      }));
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
