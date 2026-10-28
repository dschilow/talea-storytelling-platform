import { createHash } from 'node:crypto';
import { createIdentityReferenceCache } from '../image-reference-sprite';
import type { VisualEntity } from '../storybook/illustration-stage';
import { type ImageOutcome, type ImageProvider, type StorybookImagesResult } from '../storybook/images';
import { parseJsonObject, type StorybookLlm } from '../storybook/llm';
import type { IllustrationPlan, IllustrationShot, StoryPlan, StorybookPage } from '../storybook/types';
import type { StoryBrief } from '../storybook/context';
import { buildImageSlots, pagesFor, placePictures, buildPictureNotes } from '../storybook/book/illustrations';
import { storyHighlights, type EpisodeDirection } from '../episode/pictures';
import { wordlessLine } from '../storybook/illustration-stage';
import { ORIGINALS_IMAGE_STYLE, SCENE_SIZE } from '../library/images';
import { SERIES_POLICY } from './authoring';
import { readSeriesQa, seriesPicturePasses, seriesPictureSource, SERIES_IMAGE_REVIEW } from './quality';
import type { RunwareReferenceRegion } from '../../ai/runware-image-model-options';
export { seriesPicturePasses } from './quality';

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
  visualBeat: SeriesVisualBeat;
  boxes?: Record<string, SeriesBox>;
}

/** The prose carries written clues. Do not turn a tiny written clue into a giant sign/table in the illustration. */
export function seriesPaintableMoment(shot: IllustrationShot): { scene: string; fact: string } {
  const beat = (shot as SeriesShot).visualBeat;
  const label = /\b[A-ZÄÖÜ]{2,}\b/;
  const sentences = shot.scene.split(/(?<=[.!?])\s+/).filter(s => !(label.test(s) && /\b(?:sign|letters?|word|label|inscription|reads?|marked|text)\b/i.test(s)));
  const tile = Boolean(beat && /\b(?:location|place|destination) tile\b/i.test(beat.action));
  const scene = (sentences.join(' ') || shot.scene.replace(/\b[A-ZÄÖÜ]{2,}\b/g, '')) + (tile ? ' The location tile is a small palm-sized clay token, held within a child’s hand, with a visibly cleaned patch and faint pictorial scratches. Keep it small beside the cloth; its surface carries no lettering.' : '');
  const fact = beat ? `${beat.action}; ${tile ? 'a clean patch is exposed on the small clay token' : beat.result.replace(/\b[A-ZÄÖÜ]{2,}\b/g, '').trim()}` : (shot as SeriesShot).actionKey || scene;
  return { scene, fact };
}

const QUIET_ACTION = /^(?:looks?|watches?|observes?|studies|notices?|listens?|agrees?|introduces?|objects?|says?|talks?|speaks?|asks?|answers?|feels?|realises?|realizes?|decides?|understands?|thinks?|waits?|stands?|sits?|nods?)\b/i;
const HIDDEN_IDENTITY = /\b(?:completely|fully|entirely)\s+(?:hides?|obscures?|covers?)\b.*\b(?:face|head|identity)\b/i;

function isSmallCreature(entity: VisualEntity): boolean {
  return !entity.isHuman && /\b(dragon|drache|fairy|fee|mouse|maus|raven|rabe|seagull|moewe|bird|vogel|marmot|murmeltier|cat|katze|frog|frosch|squirrel|rabbit|hase|tortoise|schildkröte)\b/i.test(`${entity.species} ${entity.appearance}`);
}

function validSeriesBox(value: unknown): value is SeriesBox {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1000)) return false;
  const [top, left, bottom, right] = value;
  return bottom - top >= 180 && bottom - top <= 920 && right - left >= 120 && right - left <= 850;
}

function defaultTargetBox(entity: VisualEntity, index: number, total: number, primary: boolean, page: number): SeriesBox {
  const [top, bottom]: [number, number] = isSmallCreature(entity)
    ? [primary ? 420 : 460, primary ? 920 : 940]
    : entity.role === 'hero'
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
  const hasAdultHuman = identities.some(e => e.isHuman && e.role !== 'hero');
  const rawBoxes = identities.map((entity, i) => {
    const primary = entity.id === beat?.actorId;
    const custom = boxes?.[entity.id];
    if (validSeriesBox(custom)) {
      const [t, l, b, r] = custom.map(n => Math.round(n)) as SeriesBox;
      const adjustedTop = entity.role === 'hero' && hasAdultHuman ? Math.max(t, 280) : t;
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

export const SERIES_STYLE_REFERENCE = 'https://www.talea.website/library/series/bruno-der-flunkerfisch/s1e1/ch2.webp';
export const SERIES_ART_DIRECTION = `${ORIGINALS_IMAGE_STYLE}. Bold readable curved silhouettes, slightly enlarged expressive heads, clear soft ink contours, broad gouache colour shapes and varied comic expressions. Keep texture subordinate to faces and action; the setting supports the joke. Render the referenced identities in this illustration language.`;

/** Every shot keeps its dramatic subject; a failed picture never turns into an avatar portrait. */
export function validateSeriesShots(raw: any, pages: StorybookPage[], entities: VisualEntity[], leadId: string): IllustrationPlan {
  // Every pictured identity needs an existing reference; a style example must never supply a missing guest.
  const ids = new Set(entities.filter(e => e.referenceUrl).map(e => e.id));
  const shot = (candidate: any, page: number): IllustrationShot => {
    const onStage = Array.isArray(candidate?.onStage) ? [...new Set<string>(candidate.onStage)] : [];
    if (!onStage.length || onStage.length > 3 || onStage.some(id => !ids.has(id)) || typeof candidate?.scene !== 'string' || candidate.scene.length < 45 || candidate.scene.length > 1900) throw new Error('Die Serienbildplanung hat keine klare, gültige Besetzung.');
    if ((page === 0 || page === 1) && !onStage.includes(leadId)) throw new Error('Die Serienhauptfigur fehlt in ihrem Titel- oder Einstiegsbild.');
    const paragraphs = pages[page - 1]?.content.split(/\n\n/).length || 0;
    if (page > 0 && (!Number.isInteger(candidate.paragraph) || candidate.paragraph < 1 || candidate.paragraph > paragraphs)) throw new Error('Das Serienbild gehört zu keinem Absatz des Kapitels.');
    const quote = typeof candidate.storyQuote === 'string' ? candidate.storyQuote.trim() : '';
    // Models quote German „…“ as straight quotes; only the words have to be the chapter's own.
    const norm = (s: string) => s.normalize('NFC').replace(/[„“”"«»]/g, '"').replace(/[‚‘’']/g, "'").replace(/…/g, '...').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
    const paragraphText = page > 0 ? pages[page - 1].content.split(/\n\n+/)[candidate.paragraph - 1]?.trim() : '';
    // Ground a paraphrased model quote in the actual selected source paragraph, never in invented evidence.
    const evidence = page > 0 && (quote.length < 12 || quote.length > 500 || !norm(pages[page - 1].content).includes(norm(quote))) ? (paragraphText || '').slice(0, 500) : quote;
    if (page > 0 && evidence.length < 12) throw new Error('Dem Serienbild fehlt ein wörtlicher Beleg aus seinem Kapitel.');
    const beat = candidate.visualBeat;
    if (!beat || !onStage.includes(beat.actorId) || typeof beat.action !== 'string' || beat.action.trim().length < 12 || beat.action.length > 220 || QUIET_ACTION.test(beat.action.trim()) || typeof beat.result !== 'string' || beat.result.trim().length < 12 || beat.result.length > 260 || HIDDEN_IDENTITY.test(beat.result) || !['wide', 'medium', 'close'].includes(beat.framing)) throw new Error(`Serienbild ${page} braucht eine körperliche Handlung: actorId muss auf onStage stehen; Handlung und sichtbare Folge müssen konkret sein, ohne vollständig verdeckte Identität. Ein gültiger Bildausschnitt ist erforderlich.`);
    const visualBeat: SeriesVisualBeat = { actorId: beat.actorId, action: beat.action.trim(), result: beat.result.trim(), framing: beat.framing };
    const boxes: Record<string, SeriesBox> = {};
    if (candidate?.boxes && typeof candidate.boxes === 'object') {
      for (const id of onStage) {
        if (validSeriesBox(candidate.boxes[id])) boxes[id] = candidate.boxes[id].map((n: number) => Math.round(n)) as SeriesBox;
      }
    }
    const actor = entities.find(e => e.id === beat.actorId)!;
    return { page, onStage, scene: candidate.scene, actionKey: `${actor.name} ${visualBeat.action}; ${visualBeat.result}`, visualBeat, ...(Object.keys(boxes).length ? { boxes } : {}), storyQuote: evidence || undefined, focus: 'scene', artifactVisible: candidate.artifactVisible === true, elements: [], ...(page ? { paragraph: candidate.paragraph } : {}) } as SeriesShot;
  };
  if (!Array.isArray(raw?.pages) || raw.pages.length !== pages.length || raw.pages.some((p: any, i: number) => p.page !== i + 1)) throw new Error('Die Serienbildplanung enthält nicht genau ein Bild je Kapitel.');
  const plan = { cover: shot(raw.cover, 0), pages: raw.pages.map((p: any, i: number) => shot(p, i + 1)), storyElements: [] };
  if (plan.pages.filter((p: IllustrationShot) => p.onStage.includes(leadId)).length < Math.min(2, pages.length)) throw new Error('Die Serienhauptfigur verschwindet aus ihren Kapitelbildern.');
  const heroes = entities.filter(e => e.role === 'hero' && e.referenceUrl);
  const capacity = pages.length * 2 - Math.min(2, pages.length);
  if (heroes.length <= capacity && heroes.some(e => !plan.pages.some((p: IllustrationShot) => p.onStage.includes(e.id)))) throw new Error('Ein beteiligter Avatar fehlt in allen Serienbildern.');
  if (pages.length >= 3 && new Set(plan.pages.map((p: SeriesShot) => p.visualBeat.framing)).size < 2) throw new Error('Die Serienbilder brauchen unterschiedliche Bildausschnitte.');
  return plan;
}

export async function directSeriesPictures(input: { llm: StorybookLlm; model: string; brief: StoryBrief; title: string; pages: StorybookPage[]; plan?: StoryPlan; entities: VisualEntity[] }): Promise<EpisodeDirection> {
  const leadId = input.brief.characterSeries!.bible.characterId;
  const slots = buildImageSlots(input.pages.map(p => ({ order: p.order, content: p.content })), { chapters: [] }, 1);
  const pages = pagesFor(slots);
  const highlights = input.plan ? storyHighlights(input.plan) : [];
  // Only the shared fictional pool lead is newly shown to the director. Private avatar portraits stay out.
  const publicLead = input.entities.find(e => e.id === leadId && e.role === 'cast');
  const call = await input.llm({ stage: 'series-picture-direction', role: 'support', model: input.model, json: true, effort: 'low', maxTokens: 1000 + pages.length * 600,
    imageInputs: [...(publicLead?.referenceUrl ? [publicLead.referenceUrl] : []), SERIES_STYLE_REFERENCE],
    system: [
      'Direct ONE hilarious, action-packed children\'s book landscape illustration per chapter plus a distinct cover, in the spirit of Talea Originals („Bruno, der Flunkerfisch“, „Die Monster-Müllabfuhr“). 1 to 3 visible referenced characters per image. Lead on cover, page 1 and at least two chapter pictures; include the avatars across their actual contributions (siblings may appear together with the lead). English complete captions, 95–140 words.',
      'PRIORITISE SLAPSTICK & VISUAL COMEDY OVER CHORES: For each chapter pick its funniest, most dramatic physical mishap, slapstick turn or visual punchline (use the PLANNED CHAPTER HIGHLIGHTS / LACHER when present in the chapter!): something springing loose, tipping over, splashing, landing on someone\'s hat, tangling, a runaway cart/cloth, or an absurd visual contrast. NEVER pick a mundane transport or tidy work beat (merely carrying a roll, holding a frame still, standing by a table, or tying a routine knot) when the chapter contains a funnier physical mishap! Show what a six-year-old would laugh at and point to, caught mid-motion. A physical action and its consequence must exist in the source; never invent unsupported props or magic.',
      'SETTING FIRST (NO PORTRAIT BACKGROUND BLEED): Start every `scene` caption with the exact setting and lighting of that paragraph (e.g. "Inside the warm wooden paper-mill courtyard with drying racks and a tipped water basin on the stone ground, away from the harbour:"). Explicitly state the indoor room, workshop, forest or mountain setting so the lead\'s portrait background never bleeds into the scene.',
      'Every shot needs visualBeat {actorId, action, result, framing} and boxes {"id":[top,left,bottom,right]} on a 0–1000 scale of the 3:2 landscape canvas. Start action with an English physical VERB, not watching, speaking, agreeing or deciding. The result must be observable in ONE still. framing is wide, medium or close; use at least TWO scales across three or more chapter pictures. In `boxes`, keep realistic relative sizes (adult ~650–820 tall, child ~480–640 tall and visibly shorter than adults, small creature/dragon/mouse/bird ~260–440 tall) and vary left/center/right placement across chapters so consecutive chapters never repeat a side-by-side 50/50 split.',
      'Compose an asymmetrical full-body or three-quarter scene with depth, varied camera height, expressive comic faces (wide-eyed surprise, burst of laughter, puffed cheeks, startled leap) and clear hand-to-object contact. The cover shows an inviting, funny physical motif from the first half, with the lead\'s face recognisable, and differs from the chapter pictures. Only identities with an existing supplied reference may be listed in onStage.',
      'Every page needs storyQuote: an exact 12–500 character passage from THAT chapter evidencing the selected physical event. Give the nearby paragraph number; the image prints AFTER that paragraph. The illustration is wordless. JSON {"cover":{"onStage":["id"],"boxes":{"id":[160,220,920,760]},"visualBeat":{"actorId":"id","action":"pulls the loose strap","result":"the released roll curls over the rail","framing":"wide"},"scene":"..."},"pages":[{"page":1,"paragraph":4,"onStage":["id","id"],"boxes":{"id":[160,60,920,460],"id2":[300,520,920,880]},"storyQuote":"exact source passage","visualBeat":{"actorId":"id","action":"physical verb and object","result":"visible physical consequence","framing":"medium"},"scene":"..."}]}.',
    ].join('\n'),
    user: (input.brief.characterSeries?.logs.length === 0 ? 'FIRST CHAPTER PICTURE: choose the physical first encounter or its funniest prop mishap/exchange. The introductions remain in the text. Keep identifying faces visible.\n' : '') + (highlights.length ? `PLANNED CHAPTER HIGHLIGHTS / LACHER (prefer these comic set-pieces when choosing the paragraph for each chapter):\n${highlights.join('\n')}\n` : '') + `Draw different physical story beats that read in one still, with different camera scales and varied left/center/right staging. Choose funny slapstick consequences and vivid character reactions rather than calm carrying or sorting chores.\n${publicLead?.referenceUrl ? 'Image 1 is ONLY the public series lead; take face, species and clothes, NEVER its sea/room background or loose portrait props.' : ''} The last image is ONLY the art style (notice the full-room depth, expressive faces and true child-to-creature scale). Reference poses are not scene poses.\nREQUIRED CAST COVERAGE: each avatar appears in a chapter if slots allow: ${input.entities.filter(e => e.role === 'hero').map(e => e.id).join(', ')}. Lead on cover, first encounter and at least two chapters.\nTITLE ${input.title}\nSERIES LEAD ${leadId}\nPICTURABLE IDENTITIES (only these have references):\n${input.entities.filter(e => e.referenceUrl).map(e => `${e.id}: ${e.name} (${e.role === 'hero' ? 'human child, shorter than adults' : e.isHuman ? 'adult human' : e.species}); ${e.appearance}`).join('\n')}\nCHAPTERS:\n${pages.map(p => `CHAPTER ${p.order}: ${p.title}\n${p.content.split(/\n\n/).map((t, i) => `p${i + 1}: ${t}`).join('\n')}`).join('\n\n')}` });
  let illustrations: IllustrationPlan;
  let repairCall: Awaited<ReturnType<StorybookLlm>> | undefined;
  let repairReasons: Array<{ page: number; errors: string[] }> | undefined;
  try { illustrations = validateSeriesShots(parseJsonObject(call.text), pages, input.entities, leadId); }
  catch (error) {
    repairReasons = [{ page: 0, errors: [String((error as Error).message)] }];
    repairCall = await input.llm({ stage: 'series-picture-plan-repair', role: 'support', model: input.model, json: true, effort: 'low', maxTokens: 1000 + pages.length * 600,
      system: 'Repair only the supplied illustration plan JSON. Each image has 1 to 3 visible referenced characters. Preserve the actual selected physical event unless its evidence or activity is invalid; then choose a funny physical event from that chapter. Every cover/page needs visualBeat {actorId, action, result, framing}; actorId is onStage, action starts with an English physical verb, result is a visible consequence, framing is wide|medium|close. Across three or more chapter pictures use at least TWO framing scales. An introduction, objection, agreement, look or nod alone is not a physical event. Lead on cover, page 1 and at least two chapter images; each avatar appears in at least one image if slots allow. Keep captions, exact page order and paragraph numbers, with no invented objects or events. Return only the corrected plan.',
      user: `DEFECT ${repairReasons[0].errors.join('; ')}\nLEAD ${leadId}\nAVATARS ${input.entities.filter(e => e.role === 'hero').map(e => e.id).join(', ')}\nALLOWED REFERENCED IDENTITIES ${input.entities.filter(e => e.referenceUrl).map(e => `${e.id}: ${e.name}`).join('; ')}\nEXACTLY ${pages.length} PAGES\nEvery page needs storyQuote: an exact 12–500 character passage from THAT chapter proving the physical event. Its result must read in one still without a temporal comparison. Keep identifying faces visible. Use only source-present props.\nSOURCE CHAPTERS:\n${pages.map(p => `CHAPTER ${p.order}\n${p.content}`).join('\n\n')}\nPLAN\n${call.text}` });
    illustrations = validateSeriesShots(parseJsonObject(repairCall.text), pages, input.entities, leadId);
  }
  const placed = placePictures(slots, illustrations.pages);
  const notes = buildPictureNotes(slots, illustrations.pages, placed, input.entities, [], input.pages.map(p => ({ order: p.order, content: p.content })));
  return { slots, pages, illustrations, placed, notes, changes: [], unplaced: [], director: { illustrations, call, repairCall, repairReasons } };
}

export async function generateSeriesImages(input: {
  illustrations: IllustrationPlan; entities: VisualEntity[]; provider: ImageProvider; seed: string; llm: StorybookLlm; visionModel: string;
  pageTexts: Record<number, string>; styleReferenceUrl?: string;
  buildReference?: ReturnType<typeof createIdentityReferenceCache>;
}): Promise<StorybookImagesResult> {
  const shots = [input.illustrations.cover, ...input.illustrations.pages];
  if (shots.length > 5) throw new Error('Die Figurenserie zeichnet höchstens fünf geplante Bilder.');
  const buildReference = input.buildReference || createIdentityReferenceCache();
  const byId = new Map(input.entities.map(e => [e.id, e]));
  const style = input.styleReferenceUrl || SERIES_STYLE_REFERENCE;
  let imageCalls = 0, imageCostUSD = 0;
  const editableImages = new Map<number, string>();
  const qaCalls: StorybookImagesResult['qaCalls'] = [], regenerated: number[] = [];
  const canReview = () => (input.llm as StorybookLlm & { canCall?: () => boolean }).canCall?.() !== false;
  const slotPositionLabel = (index: number, total: number): string => {
    if (total === 2) return index === 0 ? ' (left half)' : ' (right half)';
    if (total === 3) return index === 0 ? ' (left third)' : index === 1 ? ' (middle third)' : ' (right third)';
    return '';
  };
  const render = async (shot: IllustrationShot, number = 1, previous?: ImageOutcome): Promise<ImageOutcome> => {
    const history: NonNullable<ImageOutcome['history']> = [...(previous?.history || [])];
    let costUSD = previous?.costUSD || 0;
    if (!canReview()) return { page: shot.page, prompt: shot.scene, attempts: 0, costUSD, status: 'failed', severity: 999, errors: ['series_budget_exhausted'], history: [...history, { kind: 'series-budget', status: 'failed', severity: 999, notes: ['Kein weiteres Bild erzeugt: Prüfbudget erreicht.'] }] };
    const drawn = shot.onStage.map(id => byId.get(id)).filter((e): e is VisualEntity => Boolean(e));
    if (drawn.some(e => e.role === 'hero' && !e.referenceUrl)) return { page: shot.page, prompt: shot.scene, attempts: 0, costUSD, severity: 999, status: 'failed', errors: ['series_avatar_reference_missing'], history: [...history, { kind: 'series-identity', status: 'failed', severity: 999, notes: ['Avatarreferenz fehlt; kein erfundenes Ersatzkind erzeugt.'] }] };
    const identities = drawn.filter(e => e.referenceUrl);
    let references: string[];
    try {
      const slots = identities.map(e => ({ imageUrl: e.referenceUrl!, displayName: e.name, kind: e.kind }));
      // One free preparation retry; no image or LLM is billed until the complete sheet is ready.
      const prepared = identities.length ? await buildReference(slots).catch(() => buildReference(slots)) : undefined;
      references = prepared?.urls.slice(0, 1) || [];
    } catch {
      return { page: shot.page, prompt: shot.scene, attempts: 0, costUSD, severity: 999, status: 'failed', errors: ['series_reference_error'], history: [...history, { kind: 'series-reference', status: 'failed', severity: 999, notes: ['Identitätsreferenz nicht verfügbar; kein Ersatzkind erzeugt und kein Bildaufruf bezahlt.'] }] };
    }
    const attempt = async (fixes: string[]): Promise<ImageOutcome> => {
      let imageUrl: string | undefined;
      const beat = (shot as SeriesShot).visualBeat;
      const moment = seriesPaintableMoment(shot);
      const editing = number > 1 ? editableImages.get(shot.page) : undefined;
      const identityAttachment = editing ? 2 : 1;
      const regions = seriesReferenceRegions(identities, beat, editing ? 1 : 0, (shot as SeriesShot).boxes, shot.page);
      const bindNames = (text: string) => identities.reduce((caption, entity, i) => {
        const aliases = [...new Set([entity.name, ...entity.name.split(/\s+/).filter(n => n.length >= 3 && !/^(der|die|das|graf|captain|kapitän)$/i.test(n))])].sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        return caption.replace(new RegExp(`\\b(?:${aliases.join('|')})\\b`, 'gi'), `<${regions[i].id}>`);
      }, text);
      const prompt = editing ? [
        'Image 1 is the existing scene to edit. Make a local correction, preserving its rendering and every already correct person, object and action. Image 2 is only the identity sheet; do not add its figures or poses to the scene.',
        `Corrections: ${fixes.join(' ')}`,
        `The finished scene has exactly one ${drawn.map(e => e.name).join(' and one ')}. Each human has exactly two arms and two hands with five fingers. If a person or hand is duplicated, keep the one integrated with the main interaction and remove the extra copy completely, restoring the setting behind it.`,
        'Keep the original framing and successful details. Do not reconstruct the entire scene from the identity portraits.',
      ].join('\n') : [bindNames(moment.scene),
        beat ? bindNames(`Freeze the physical instant: ${byId.get(beat.actorId)?.name} ${moment.fact}. ${beat.framing.toUpperCase()} framing, asymmetric foreground and depth, dynamic three-quarter or side postures and vivid comic facial expressions. Bodies change balance with the action; each hand visibly works on its own object. The depicted scene determines setting, gesture and camera, while the reference sheet determines only character identity.`) : '',
        SERIES_ART_DIRECTION,
        regions.map(r => `<${r.id}> is ${r.description}, taken only from its own sheet cell and placed in its assigned scene region. Draw this figure exactly once in the caption's new action; the cell's resting pose and portrait background have no part in this scene.`).join('\n'),
        references.length ? `IDENTITY SHEET, image ${identityAttachment}: ${identities.map((e, i) => `slot ${i + 1}${slotPositionLabel(i, identities.length)} is ONLY ${e.name}: ${e.appearance}`).join('; ')}. Keep each face, ears, teeth, species and outfit with its OWN person. ${drawn.filter(e => e.isHuman).map(e => `${e.name} has an ordinary human silhouette, with human back and shoulders, and exactly two arms and two hands with five fingers${e.role === 'hero' ? ', drawn at natural child height (shorter than adults)' : ''}.`).join(' ')} Their faces are large enough to recognise. The sheet's resting poses change to the action in the scene.` : '',
        ...drawn.filter(e => !e.referenceUrl).map(e => `${e.name}: ${e.appearance}.`),
        'Every described object keeps its true material and shape (a cloth banner is flexible fabric, never a wooden log); a joke never adds a garment or a mouth-held prop.',
        `Exactly ${drawn.length} visible characters, once each: ${drawn.map(e => e.name).join(', ')}. A story instant in one continuous full-bleed setting reaching every edge; completely ignore any sea, ships, sky or background from the reference portraits and paint only the scene's own environment.`,
        fixes.length ? `Correct these observed problems in the same scene: ${fixes.join(' ')}` : '',
        wordlessLine(moment.scene),
        'Use the shared Talea Originals medium described above; only the identity sheet supplies characters.',
      ].filter(Boolean).join('\n');
      if (imageCalls >= SERIES_POLICY.maxImageCalls) throw new Error('Das Bildbudget der Figurenfolge ist erreicht.');
      imageCalls++;
      const seed = parseInt(createHash('sha256').update(`${input.seed}:${shot.page}:${number}`).digest('hex').slice(0, 8), 16) % 2147483647;
      try {
      const response = await input.provider({ prompt: editing ? prompt + '\n' + regions.map(r => `<${r.id}> is ${r.description}.`).join(' ') : prompt, negativePrompt: '', referenceImages: [...(editing ? [editing] : []), ...references], referenceRegions: regions, width: SCENE_SIZE.width, height: SCENE_SIZE.height, seed, page: shot.page, logStage: editing ? 'series-image-edit' : shot.page === 0 ? 'series-image-cover' : 'series-image-chapter' });
      imageUrl = response.url;
      const editable = response.viewUrl || response.url;
      if (editable && /^(https?:\/\/|data:image\/)/i.test(editable)) editableImages.set(shot.page, editable);
      costUSD += response.costUSD || 0; imageCostUSD += response.costUSD || 0;
      if (!response.url) return { page: shot.page, prompt, attempts: number, costUSD, severity: 999, status: 'missing', history };
      const reviewUser = `${shot.page === 0 ? 'COVER: judge the selected character-in-world composition. No chapter action is compulsory.' : 'CHAPTER PICTURE: judge this selected moment, allowing harmless staging differences.'}\nEXPECTED IDENTITIES:\n${drawn.map(e => `${e.id}: ${e.name}; ${e.appearance}; forbidden features: ${e.forbidden.join(', ') || 'none specified'}`).join('\n')}\nPROPOSED CAPTION:\n${moment.scene}\nPRIMARY STORY FACT: ${moment.fact}\n${shot.page === 0 ? '' : seriesPictureSource(input.pageTexts[shot.page] || '', shot.paragraph, (shot as SeriesShot).storyQuote)}\n${references.length ? `Attachment 2 is the identity sheet, left to right: ${identities.map((e, i) => `slot ${i + 1} = ${e.id} (${e.name})`).join('; ')}.` : 'No identity sheet is attached.'} The last attachment is the public style example.`;
      let reply = await input.llm({ stage: `series-image-qa-${shot.page}-${number}`, role: 'support', model: input.visionModel, effort: 'low', json: true, maxTokens: 1000, timeoutMs: 60000,
        system: SERIES_IMAGE_REVIEW,
        user: reviewUser,
        imageInputs: [response.viewUrl || response.url, ...references, style] });
      qaCalls.push(reply);
      let qa = readSeriesQa(reply.text, drawn);
      if (!qa && canReview()) {
        reply = await input.llm({ stage: `series-image-qa-${shot.page}-${number}-retry`, role: 'support', model: input.visionModel, effort: 'low', json: true, maxTokens: 1000, timeoutMs: 60000,
          system: SERIES_IMAGE_REVIEW,
          user: reviewUser,
          imageInputs: [response.viewUrl || response.url, ...references, style] });
        qaCalls.push(reply);
        qa = readSeriesQa(reply.text, drawn);
      }
      const pass = seriesPicturePasses(qa);
      const notes = qa ? [...qa.defects.map(d => d.detail), ...(qa.missing || []), ...qa.duplicates] : ['Bildprüfung unvollständig'];
      history.push({ kind: number === 1 ? 'series-scene' : editing ? 'targeted-scene-edit' : 'same-scene-repair', status: pass ? 'passed' : 'failed', severity: pass ? 0 : 10, notes, url: response.url });
      return { page: shot.page, url: response.url, prompt, attempts: number, costUSD, qa, severity: pass ? 0 : 10, status: pass ? 'passed' : 'failed', history };
      } catch (error) {
        history.push({ kind: 'series-image-error', status: 'failed', severity: 999, notes: ['Bild oder Bildprüfung nicht vollständig verfügbar'], ...(imageUrl ? { url: imageUrl } : {}) });
        return { page: shot.page, url: imageUrl, prompt, attempts: number, costUSD, severity: 999, status: 'failed', errors: [(error as any)?.code === 'series_budget_exhausted' ? 'series_budget_exhausted' : imageUrl ? 'series_vision_error' : 'series_provider_error'], history };
      }
    };
    return attempt(previous?.qa?.posing && !previous.qa.sceneFixes?.length ? ['Show the selected hand-object interaction and its visible result, with purposeful balance rather than portrait poses.'] : previous?.qa?.sceneFixes || []);
  };
  // Review every planned picture BEFORE spending the one optional redraw on an earlier chapter.
  const outcomes: ImageOutcome[] = [];
  for (const shot of shots) outcomes.push(await render(shot));
  // Prioritise a missing chapter illustration over a decorative cover correction.
  const canRetryOutcome = (o: ImageOutcome) => o.status !== 'passed' && (Boolean(o.qa) || (!o.errors?.length && Boolean(o.url)));
  const chapterRetry = outcomes.findIndex(o => o.page > 0 && canRetryOutcome(o));
  const retry = chapterRetry >= 0 ? chapterRetry : outcomes.findIndex(canRetryOutcome);
  if (retry >= 0 && imageCalls < SERIES_POLICY.maxImageCalls && canReview()) {
    regenerated.push(shots[retry].page);
    outcomes[retry] = await render(shots[retry], 2, outcomes[retry]);
  }
  return { cover: outcomes[0], pages: new Map(outcomes.slice(1).map(o => [o.page, o])), imagesGenerated: outcomes.filter(o => o.status === 'passed').length, imageCalls, imageCostUSD, qaCalls, regenerated };
}
