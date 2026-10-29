import { createHash } from 'node:crypto';
import { createIdentityReferenceCache, IdentityReferenceError } from '../image-reference-sprite';
import type { VisualEntity } from '../storybook/illustration-stage';
import { isPublishable, type ImageOutcome, type ImageProvider, type StorybookImagesResult } from '../storybook/images';
import { parseJsonObject, type StorybookLlm } from '../storybook/llm';
import type { IllustrationPlan, IllustrationShot, StoryPlan, StorybookPage } from '../storybook/types';
import type { StoryBrief } from '../storybook/context';
import { actsIn, buildImageSlots, pagesFor, placePictures, buildPictureNotes, PICTURE_EDGE } from '../storybook/book/illustrations';
import { storyHighlights, type EpisodeDirection } from '../episode/pictures';
import { wordlessLine } from '../storybook/illustration-stage';
import { ORIGINALS_IMAGE_STYLE, SCENE_SIZE } from '../library/images';
import { SERIES_POLICY } from './authoring';
import { effectiveSeriesEpisode, logsForEpisode } from './core';
import { getSeriesEpisodeBlueprint } from './episode-plans';
import { readSeriesQa, seriesPictureLastResort, seriesPicturePasses, seriesPictureSource, seriesPictureUsable, SERIES_IMAGE_REVIEW, type SeriesQa } from './quality';
import type { RunwareReferenceRegion } from '../../ai/runware-image-model-options';
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
}

/** Every shot keeps its dramatic subject; a failed picture never turns into an avatar portrait. */
export function validateSeriesShots(raw: any, pages: StorybookPage[], entities: VisualEntity[], leadId: string, rules: SeriesShotRules = {}): IllustrationPlan {
  // Every pictured identity needs an existing reference; a style example must never supply a missing guest.
  const ids = new Set(entities.filter(e => e.referenceUrl).map(e => e.id));
  const shot = (candidate: any, page: number): IllustrationShot => {
    const onStage = Array.isArray(candidate?.onStage) ? [...new Set<string>(candidate.onStage)] : [];
    if (!onStage.length || onStage.length > 3 || onStage.some(id => !ids.has(id)) || typeof candidate?.scene !== 'string' || candidate.scene.length < 45 || candidate.scene.length > 1900) throw new Error('Die Serienbildplanung hat keine klare, gültige Besetzung.');
    if ((page === 0 || page === 1) && !onStage.includes(leadId)) throw new Error('Die Serienhauptfigur fehlt in ihrem Titel- oder Einstiegsbild.');
    const pageParagraphs = page > 0 ? pages[page - 1]?.content.split(/\n\n/) || [] : [];
    const quote: string = typeof candidate.storyQuote === 'string' ? candidate.storyQuote.trim() : '';
    // Models quote German „…“ as straight quotes; only the words have to be the chapter's own.
    const norm = (s: string) => s.normalize('NFC').replace(/[„“”"«»]/g, '"').replace(/[‚‘’']/g, "'").replace(/…/g, '...').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
    // Story e83e44e2: the director quoted the paper flag behind Tilda's ear (paragraph 6) but named paragraph 16, the
    // clamp on the brake lever; the picture printed ten paragraphs late and its rescue redrew the brake lever. The quoted
    // words decide; a quote across paragraphs counts at its last sentence, the visible consequence.
    const lastSentence = quote.split(/(?<=[.!?…])\s+/).filter(s => s.length >= 12).pop();
    const quoted = [quote, lastSentence].filter((s): s is string => Boolean(s && s.length >= 12))
      .map(probe => pageParagraphs.findIndex(p => norm(p).includes(norm(probe)))).find(at => at >= 0);
    const paragraph = quoted !== undefined ? quoted + 1 : candidate.paragraph;
    if (page > 0 && (!Number.isInteger(paragraph) || paragraph < 1 || paragraph > pageParagraphs.length)) throw new Error('Das Serienbild gehört zu keinem Absatz des Kapitels.');
    const paragraphText = page > 0 ? pageParagraphs[paragraph - 1]?.trim() : '';
    // Ground a paraphrased model quote in the actual selected source paragraph, never in invented evidence.
    // A one-word paragraph („Hält.“) is too short as evidence (pilot 2026-10-29 lost the whole story): its neighbour joins it.
    const fallbackEvidence = paragraphText && paragraphText.length >= 12 ? paragraphText
      : (paragraph > 1 ? pageParagraphs.slice(paragraph - 2, paragraph) : pageParagraphs.slice(0, 2)).join(' ').trim();
    const evidence = page > 0 && (quote.length < 12 || quote.length > 500 || !norm(pages[page - 1].content).includes(norm(quote))) ? fallbackEvidence.slice(0, 500) : quote;
    if (page > 0 && evidence.length < 12) throw new Error('Dem Serienbild fehlt ein wörtlicher Beleg aus seinem Kapitel.');
    const beat = candidate.visualBeat;
    // Haiku may put the valid framing beside visualBeat rather than inside it; the meaning is identical.
    const framing = beat?.framing ?? candidate?.framing;
    if (!beat || !onStage.includes(beat.actorId) || typeof beat.action !== 'string' || beat.action.trim().length < 12 || beat.action.length > 220 || QUIET_ACTION.test(beat.action.trim()) || typeof beat.result !== 'string' || beat.result.trim().length < 12 || beat.result.length > 260 || HIDDEN_IDENTITY.test(beat.result) || !['wide', 'medium', 'close'].includes(framing)) throw new Error(`Serienbild ${page} braucht eine körperliche Handlung: actorId muss auf onStage stehen; Handlung und sichtbare Folge müssen konkret sein, ohne vollständig verdeckte Identität. Ein gültiger Bildausschnitt ist erforderlich.`);
    const visualBeat: SeriesVisualBeat = { actorId: beat.actorId, action: beat.action.trim(), result: beat.result.trim(), framing };
    const boxes: Record<string, SeriesBox> = {};
    if (candidate?.boxes && typeof candidate.boxes === 'object') {
      for (const id of onStage) {
        if (validSeriesBox(candidate.boxes[id])) boxes[id] = candidate.boxes[id].map((n: number) => Math.round(n)) as SeriesBox;
      }
    }
    const actor = entities.find(e => e.id === beat.actorId)!;
    return { page, onStage, scene: candidate.scene, actionKey: `${actor.name} ${visualBeat.action}; ${visualBeat.result}`, visualBeat, ...(Object.keys(boxes).length ? { boxes } : {}), storyQuote: evidence || undefined, focus: 'scene', artifactVisible: candidate.artifactVisible === true, elements: [], ...(page ? { paragraph } : {}) } as SeriesShot;
  };
  // Haiku planned pages 1, 1, 2, 3, 3, 4, 5, 6 and its repair returned the same (pilot 2026-10-29): one picture per
  // page is kept, the first that validates, instead of failing the whole story.
  const planned: any[] = Array.isArray(raw?.pages) ? raw.pages : [];
  const proposals = pages.map((_, i) => planned.filter((p: any) => p?.page === i + 1));
  // The repair has to know what is wrong; a bare "not one picture per segment" made Haiku return the same plan.
  if (proposals.some(list => !list.length)) throw new Error(`Die Serienbildplanung enthält nicht genau ein Bild je Leseabschnitt: erwartet pages ${pages.map((_, i) => i + 1).join(', ')} je einmal, erhalten ${planned.map(p => p?.page).join(', ') || 'keine'}; es fehlt page ${proposals.map((list, i) => list.length ? 0 : i + 1).filter(Boolean).join(', ')}.`);
  const firstValid = (list: any[], page: number): SeriesShot => {
    for (const [i, candidate] of list.entries()) {
      try { return shot(candidate, page) as SeriesShot; } catch (error) { if (i === list.length - 1) throw error; }
    }
    throw new Error('Die Serienbildplanung enthält nicht genau ein Bild je Leseabschnitt.');
  };
  const plan = { cover: shot(raw.cover, 0), pages: proposals.map((list, i) => firstValid(list, i + 1)), storyElements: [] };
  const leadPictures = plan.pages.filter((p: IllustrationShot) => p.onStage.includes(leadId)).length;
  if (leadPictures < Math.min(2, pages.length)) throw new Error('Die Serienhauptfigur verschwindet aus ihren Kapitelbildern.');
  const heroes = entities.filter(e => e.role === 'hero' && e.referenceUrl);
  const capacity = pages.length * 2 - Math.min(2, pages.length);
  if (heroes.length <= capacity && heroes.some(e => !plan.pages.some((p: IllustrationShot) => p.onStage.includes(e.id)))) throw new Error('Ein beteiligter Avatar fehlt in allen Serienbildern.');
  if (pages.length >= 3 && new Set(plan.pages.map((p: SeriesShot) => p.visualBeat.framing)).size < 2) throw new Error('Die Serienbilder brauchen unterschiedliche Bildausschnitte.');
  if (rules.strict) {
    if (leadPictures < Math.floor(pages.length / 2)) throw new Error(`Die Serienhauptfigur steht nur in ${leadPictures} von ${pages.length} Kapitelbildern; sie gehört in mindestens die Hälfte.`);
    if (heroes.length && !plan.cover.onStage.some((id: string) => heroes.some(e => e.id === id))) throw new Error('Das Titelbild zeigt die Serienfigur ohne die Kinder der Familie; mindestens ein Avatar gehört neben sie auf das Cover.');
    for (const id of rules.guestIds || []) {
      if (ids.has(id) && !plan.pages.some((p: IllustrationShot) => p.onStage.includes(id))) throw new Error(`${entities.find(e => e.id === id)?.name || id} spielt in der Folge mit, steht aber in keinem Kapitelbild.`);
    }
  }
  return plan;
}

export async function directSeriesPictures(input: { llm: StorybookLlm; model: string; brief: StoryBrief; title: string; pages: StorybookPage[]; plan?: StoryPlan; entities: VisualEntity[] }): Promise<EpisodeDirection> {
  const series = input.brief.characterSeries!;
  const leadId = series.bible.characterId;
  const perChapter = SERIES_POLICY.picturesPerChapter;
  const chapters = input.pages.map(p => ({ order: p.order, content: p.content }));
  // Two pictures per chapter (story ff6eff04 had four pictures for 1,400 words): every chapter is cut into reading
  // segments at paragraph borders, one picture per segment, printed right after the paragraph it shows — the
  // Talea-Folge machinery (../episode/pictures.ts).
  const slots = buildImageSlots(chapters, { chapters: [] }, perChapter);
  const pages = pagesFor(slots);
  const highlights = input.plan ? storyHighlights(input.plan) : [];
  const episode = effectiveSeriesEpisode(series.logs, series.episodeOverride);
  const firstEncounter = episode === 1 && logsForEpisode(series.logs, series.episodeOverride).length === 0;
  const blueprint = getSeriesEpisodeBlueprint(series.bible.id, episode);
  const heroes = input.entities.filter(e => e.role === 'hero' && e.referenceUrl);
  const guests = input.entities.filter(e => e.kind === 'character' && e.role === 'cast' && e.id !== leadId && e.referenceUrl && chapters.some(c => actsIn(c.content, e.name)));
  const rules: SeriesShotRules = { strict: true, guestIds: guests.map(e => e.id) };
  // Only the shared fictional pool lead is newly shown to the director. Private avatar portraits stay out.
  const publicLead = input.entities.find(e => e.id === leadId && e.role === 'cast');
  const leadShare = Math.max(Math.min(2, pages.length), Math.floor(pages.length / 2));
  const coverage = [
    `SERIES LEAD ${leadId}: on the cover, on page 1 and in at least ${leadShare} of the ${pages.length} page pictures.`,
    heroes.length ? `AVATARS (each in at least one page picture, better two, in the part of their own contribution; at least one of them beside the lead on the cover): ${heroes.map(e => `${e.id} (${e.name})`).join(', ')}.` : '',
    guests.length ? `RECURRING GUEST${guests.length > 1 ? 'S' : ''} OF THIS EPISODE (in at least one page picture, where the guest does the most): ${guests.map(e => `${e.id} (${e.name})`).join(', ')}.` : '',
  ].filter(Boolean).join('\n');
  const pageText = pages.map((p, i) => `PAGE ${p.order} — chapter ${slots[i].chapter}, part ${slots[i].part + 1} of ${slots.filter(s => s.chapter === slots[i].chapter).length}\n${p.content.split(/\n\n/).map((t, k) => `p${k + 1}: ${t}`).join('\n')}`).join('\n\n');
  // A ceiling, not a price: only used tokens are billed, and a thinking model needs the room before its JSON.
  const directionTokens = 3000 + pages.length * 1800;
  const call = await input.llm({ stage: 'series-picture-direction', role: 'support', model: input.model, json: true, effort: 'low', maxTokens: directionTokens,
    imageInputs: [...(publicLead?.referenceUrl ? [publicLead.referenceUrl] : []), SERIES_STYLE_REFERENCE],
    system: [
      // Haiku planned two pictures per chapter instead of one per page in all three runs on 2026-10-29 ([1,1,2,2,3,3,4,5]).
      `Direct hilarious, action-packed children's book landscape illustrations in the spirit of Talea Originals („Bruno, der Flunkerfisch“, „Die Monster-Müllabfuhr“): exactly ONE picture per PAGE plus a distinct cover. A PAGE is already a reading segment of a chapter (a chapter has up to ${perChapter} PAGES), so "pages" holds exactly ${pages.length} entries with page = ${pages.map(p => p.order).join(', ')}, each number once and in this order — never two pictures for one PAGE. Its paragraphs are numbered locally p1, p2, … 1 to 3 visible referenced characters per image. English complete captions, 70–110 words.`,
      'CAST COVERAGE (see the task): the lead on the cover, on page 1 and in at least half of the page pictures; every avatar in at least one page picture, in the part of its own contribution; every recurring guest of the episode in at least one page picture, where the guest does the most. The cover shows the lead WITH the avatars (all of them when lead and avatars are at most three, otherwise those with the biggest part): the family wants to find its children on the cover.',
      "PRIORITISE SLAPSTICK & VISUAL COMEDY OVER CHORES: for each PAGE pick its funniest, most dramatic physical mishap, slapstick turn or visual punchline (use the PLANNED HIGHLIGHTS / LACHER when they happen in that page's paragraphs!): something springing loose, tipping over, splashing, landing on someone's hat, tangling, a runaway cart or cloth, or an absurd visual contrast. NEVER pick a mundane transport or tidy work beat (merely carrying a roll, holding a frame still, standing by a table, or tying a routine knot) when the page contains a funnier physical mishap. The two pictures of a chapter show two different beats with different framing. Show what a six-year-old would laugh at and point to, caught mid-motion. A physical action and its consequence must exist in the source; never invent unsupported props or magic.",
      // Measured on 70 first attempts of the pilots (2026-10-29): 2 figures passed the picture check first time in 48 %, 3 figures in 31 %;
      // wide framing 26 %, medium 47 %; a result that hides a body part ("only knees and face stick out") 1 of 5; and pictures with two
      // different jobs for two figures swapped the jobs (Nora carries, Tilda watches). Every failed first picture costs a redraw and a check.
      'DRAWABLE FIRST TIME (the image model fails on these, every redraw costs money): (1) ONE figure does the physical action and the visible result is on that figure or on an object flying, falling, tipping or spilling; the other figure only REACTS (laughs, ducks, catches, points, covers its ears) and never has its own separate job in the same picture. (2) Prefer exactly TWO figures per page picture, the series lead being one of them on page 1 and on at least half of the pages; a third figure only on the cover or when it is the one catching or reacting. (3) Prefer MEDIUM framing, CLOSE for a small prop, and WIDE for at most one page picture. (4) The result must show every body part, never "only the knees and face stick out", "the lid hides her head" or "half inside the box". (5) A machine part is a plain big shape (an arm, a crate, a cart); never a mechanism closing, clamping, locking or catching a thing the picture must show working: show its comic EFFECT instead (the person pulled along, the books flying). (6) No tiny props (a clip, a peg, a lever, a needle) as the point of the picture. If the page\'s funniest beat breaks these, pick another beat of the page.',
      'READABLE AT A GLANCE: choose moments whose action reads from across the room — big bodies and big objects in motion (a captain riding a sliding crate across the deck, a tarp billowing over two heads, a gull landing on a hat). Avoid moments that hinge on a small spatial detail (a nose inside a bucket, a sleeve between two shoes, which way a needle points): the illustrator cannot place those reliably and the picture check rejects them. Unnamed animals and crowds the text names (a flock of gulls, a market crowd) may fill the scene without being listed in onStage.',
      "SETTING FIRST (NO PORTRAIT BACKGROUND BLEED): Start every `scene` caption with the exact setting and lighting of that paragraph (e.g. \"Inside the warm wooden paper-mill courtyard with drying racks and a tipped water basin on the stone ground, away from the harbour:\"). Explicitly state the indoor room, workshop, forest or mountain setting so the lead's portrait background never bleeds into the scene.",
      'Every shot needs visualBeat {actorId, action, result, framing} and boxes {"id":[top,left,bottom,right]} on a 0–1000 scale of the 3:2 landscape canvas. Start action with an English physical VERB, not watching, speaking, agreeing or deciding. The result must be observable in ONE still. framing is wide, medium or close; use at least TWO scales across three or more page pictures. In `boxes`, keep realistic relative sizes (adult ~650–820 tall, child ~480–640 tall and visibly shorter than adults, small creature/dragon/mouse/bird ~260–440 tall) and vary left/center/right placement so consecutive pictures never repeat a side-by-side 50/50 split.',
      "Compose an asymmetrical full-body or three-quarter scene with depth, varied camera height, expressive comic faces (wide-eyed surprise, burst of laughter, puffed cheeks, startled leap) and clear hand-to-object contact. The cover shows an inviting, funny physical motif from the first half of the story (the PLANNED KEY VISUAL when the text tells it), with the lead's face recognisable and the avatars beside the lead, and differs from every page picture. Only identities with an existing supplied reference may be listed in onStage.",
      `Every page needs storyQuote: an exact 12–500 character passage from THAT page evidencing the selected physical event, and "paragraph": the local number of the ONE paragraph of that page whose moment the picture shows. The picture prints right AFTER that paragraph, so it never shows what the text tells later; when the page allows, choose a paragraph at least ${PICTURE_EDGE} paragraphs from its start and from its end. The illustration is wordless. JSON {"cover":{"onStage":["id","id"],"boxes":{"id":[160,220,920,760]},"visualBeat":{"actorId":"id","action":"pulls the loose strap","result":"the released roll curls over the rail","framing":"wide"},"scene":"..."},"pages":[{"page":1,"paragraph":4,"onStage":["id","id"],"boxes":{"id":[160,60,920,460],"id2":[300,520,920,880]},"storyQuote":"exact source passage","visualBeat":{"actorId":"id","action":"physical verb and object","result":"visible physical consequence","framing":"medium"},"scene":"..."}]}.`,
    ].join('\n'),
    user: [
      firstEncounter ? 'FIRST CHAPTER PICTURE: choose the physical first encounter or its funniest prop mishap/exchange. The introductions remain in the text. Keep identifying faces visible.' : '',
      highlights.length ? `PLANNED HIGHLIGHTS / LACHER (prefer these comic set-pieces when they happen in a page's paragraphs):\n${highlights.join('\n')}` : '',
      blueprint?.keyVisual ? `PLANNED KEY VISUAL OF THIS EPISODE (German; the best cover motif when the text tells it, otherwise a page picture): ${blueprint.keyVisual}` : '',
      'Draw different physical story beats that read in one still, with different camera scales and varied left/center/right staging. Choose funny slapstick consequences and vivid character reactions rather than calm carrying or sorting chores.',
      `${publicLead?.referenceUrl ? 'Image 1 is ONLY the public series lead; take face, species and clothes, NEVER its sea/room background or loose portrait props. ' : ''}The last image is ONLY the art style (notice the full-room depth, expressive faces and true child-to-creature scale). Reference poses are not scene poses.`,
      `REQUIRED CAST COVERAGE:\n${coverage}`,
      `TITLE ${input.title}`,
      `PICTURABLE IDENTITIES (only these have references):\n${input.entities.filter(e => e.referenceUrl).map(e => `${e.id}: ${e.name} (${isChildFigure(e) ? 'human child, shorter than adults' : e.isHuman ? 'adult human' : e.species}); ${e.appearance}`).join('\n')}`,
      `PAGES (${pages.length}):\n${pageText}`,
    ].filter(Boolean).join('\n') });
  let illustrations!: IllustrationPlan;
  let repairCall: Awaited<ReturnType<StorybookLlm>> | undefined;
  let repairReasons: Array<{ page: number; errors: string[] }> | undefined;
  const first = parseJsonObject<any>(call.text);
  try { illustrations = validateSeriesShots(first, pages, input.entities, leadId, rules); }
  catch (error) {
    repairReasons = [{ page: 0, errors: [String((error as Error).message)] }];
    try {
      repairCall = await input.llm({ stage: 'series-picture-plan-repair', role: 'support', model: input.model, json: true, effort: 'low', maxTokens: directionTokens,
        system: 'Repair only the supplied illustration plan JSON: one picture per PAGE (a reading segment of a chapter), exactly the given pages in order, plus the cover. The DEFECT is real: never return the plan unchanged; for a missing page choose a funny physical event from that page\'s own paragraphs. Each image has 1 to 3 visible referenced characters. Preserve the actual selected physical event unless its evidence or activity is invalid; then choose a funny physical event from that page. Every cover/page needs visualBeat {actorId, action, result, framing}; actorId is onStage, action starts with an English physical verb, result is a visible consequence, framing is wide|medium|close. Across three or more page pictures use at least TWO framing scales. An introduction, objection, agreement, look or nod alone is not a physical event. Cast: the lead on the cover, on page 1 and in at least half of the page pictures; every avatar in at least one page picture; at least one avatar beside the lead on the cover; every listed recurring guest in at least one page picture. "paragraph" is the local paragraph number within its page. Keep captions, page order and paragraph numbers where valid, with no invented objects or events. Return only the corrected plan.',
        user: `DEFECT ${repairReasons[0].errors.join('; ')}\nLEAD ${leadId}\nAVATARS ${heroes.map(e => e.id).join(', ')}\n${guests.length ? `RECURRING GUESTS ${guests.map(e => e.id).join(', ')}\n` : ''}ALLOWED REFERENCED IDENTITIES ${input.entities.filter(e => e.referenceUrl).map(e => `${e.id}: ${e.name}`).join('; ')}\nEXACTLY ${pages.length} PAGES\nEvery page needs storyQuote: an exact 12–500 character passage from THAT page proving the physical event. Its result must read in one still without a temporal comparison. Keep identifying faces visible. Use only source-present props.\nSOURCE PAGES:\n${pageText}\nPLAN\n${call.text}` });
      illustrations = validateSeriesShots(parseJsonObject(repairCall.text), pages, input.entities, leadId);
    } catch (repairError) {
      // The first plan may have missed only a wish of the strict pass (the family on the cover, a guest): it still draws.
      try { illustrations = validateSeriesShots(first, pages, input.entities, leadId); } catch { throw repairError; }
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
  buildReference?: ReturnType<typeof createIdentityReferenceCache>;
}): Promise<StorybookImagesResult> {
  const shots = [input.illustrations.cover, ...input.illustrations.pages];
  const maxShots = 1 + SERIES_POLICY.picturesPerChapter * 4;
  if (shots.length > maxShots) throw new Error(`Die Figurenserie zeichnet höchstens ${maxShots} geplante Bilder.`);
  const buildReference = input.buildReference || createIdentityReferenceCache();
  const byId = new Map(input.entities.map(e => [e.id, e]));
  const style = input.styleReferenceUrl || SERIES_STYLE_REFERENCE;
  let imageCalls = 0, imageCostUSD = 0;
  const editableImages = new Map<number, string>();
  // Every reviewed attempt per page: after the last redraw a page keeps its best one rather than staying empty.
  const reviewed = new Map<number, ImageOutcome[]>();
  // Keep the generated image and its exact evidence when only the vision call failed.
  const visionRecoveries = new Map<number, () => Promise<ImageOutcome>>();
  const qaCalls: StorybookImagesResult['qaCalls'] = [], regenerated: number[] = [];
  const canReview = () => (input.llm as StorybookLlm & { canCall?: () => boolean }).canCall?.() !== false;
  const slotPositionLabel = (index: number, total: number): string => {
    if (total === 2) return index === 0 ? ' (left half)' : ' (right half)';
    if (total === 3) return index === 0 ? ' (left third)' : index === 1 ? ' (middle third)' : ' (right third)';
    return '';
  };
  const render = async (shot: IllustrationShot, number = 1, previous?: ImageOutcome, simplified = false): Promise<ImageOutcome> => {
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
      const editing = number === 2 ? editableImages.get(shot.page) : undefined;
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
        references.length ? `IDENTITY SHEET, image ${identityAttachment}: ${identities.map((e, i) => `slot ${i + 1}${slotPositionLabel(i, identities.length)} is ONLY ${e.name}: ${e.appearance}`).join('; ')}. Keep each face, ears, teeth, species and outfit with its OWN person. ${drawn.filter(e => e.isHuman).map(e => `${e.name} has an ordinary human silhouette, with human back and shoulders, rounded human ears, and exactly two arms and two hands, each with five separate fingers${e.role === 'hero' ? ', drawn at natural child height (shorter than adults)' : ''}.`).join(' ')} Their faces are large enough to recognise. The sheet's resting poses change to the action in the scene.` : '',
        ...drawn.filter(e => !e.referenceUrl).map(e => `${e.name}: ${e.appearance}.`),
        'Every described object keeps its true material and shape (a cloth banner is flexible fabric, never a wooden log); a joke never adds a garment or a mouth-held prop.',
        simplified
          ? `A solitary scene with exactly one character, ${drawn[0]?.name}, shown only once. The surrounding landscape is uninhabited: no other figures, creatures, spectators, faces or portraits anywhere in the background. Keep only the setting of this scene, not the reference portrait's background.`
          : `Exactly ${drawn.length} named characters, once each: ${drawn.map(e => e.name).join(', ')}; only unnamed animals or crowds that the caption itself mentions may join them as extra figures. A story instant in one continuous full-bleed setting reaching every edge; completely ignore any sea, ships, sky or background from the reference portraits and paint only the scene's own environment.`,
        fixes.length ? `Correct these observed problems in the same scene: ${fixes.join(' ')}` : '',
        wordlessLine(moment.scene),
        'Use the shared Talea Originals medium described above; only the identity sheet supplies characters.',
      ].filter(Boolean).join('\n');
      if (imageCalls >= SERIES_POLICY.maxImageCalls) {
        history.push({ kind: 'series-budget', status: 'failed', severity: 999, notes: ['Kein weiteres Bild erzeugt: Bildbudget erreicht.'] });
        return { page: shot.page, prompt, attempts: number, costUSD, severity: 999, status: 'failed', errors: ['series_image_budget_exhausted'], history };
      }
      imageCalls++;
      const seed = parseInt(createHash('sha256').update(`${input.seed}:${shot.page}:${number}`).digest('hex').slice(0, 8), 16) % 2147483647;
      try {
      const response = await input.provider({ prompt: editing ? prompt + '\n' + regions.map(r => `<${r.id}> is ${r.description}.`).join(' ') : prompt, negativePrompt: '', referenceImages: [...(editing ? [editing] : []), ...references], referenceRegions: regions, width: SCENE_SIZE.width, height: SCENE_SIZE.height, seed, page: shot.page, logStage: editing ? 'series-image-edit' : shot.page === 0 ? 'series-image-cover' : 'series-image-chapter' });
      imageUrl = response.url;
      const editable = response.viewUrl || response.url;
      if (editable && /^(https?:\/\/|data:image\/)/i.test(editable)) editableImages.set(shot.page, editable);
      costUSD += response.costUSD || 0; imageCostUSD += response.costUSD || 0;
      if (!response.url) {
        const reason = response.refused && response.httpStatus ? `series_provider_http_${response.httpStatus}` : 'series_provider_missing';
        history.push({ kind: 'series-provider', status: 'missing', severity: 999, notes: [reason] });
        return { page: shot.page, prompt, attempts: number, costUSD, severity: 999, status: 'missing', errors: [reason], history };
      }
      const reviewUser = `${shot.page === 0 ? 'COVER: judge the selected character-in-world composition. No chapter action is compulsory.' : 'CHAPTER PICTURE: judge this selected moment, allowing harmless staging differences.'}\nEXPECTED IDENTITIES:\n${drawn.map(e => `${e.id}: ${e.name}; ${e.appearance}; forbidden features: ${e.forbidden.join(', ') || 'none specified'}`).join('\n')}\nPROPOSED CAPTION:\n${moment.scene}\nPRIMARY STORY FACT: ${moment.fact}\n${shot.page === 0 ? '' : seriesPictureSource(input.pageTexts[shot.page] || '', shot.paragraph, (shot as SeriesShot).storyQuote)}\n${references.length ? `Attachment 2 is the identity sheet, left to right: ${identities.map((e, i) => `slot ${i + 1} = ${e.id} (${e.name})`).join('; ')}.` : 'No identity sheet is attached.'} The last attachment is the public style example.`;
      const review = async (stage: string, model = input.visionModel) => {
        try {
          // Gemini thinks at effort low before its JSON; 1,000 tokens left it cut short.
          const reply = await input.llm({ stage, role: 'support', model, effort: 'low', json: true, maxTokens: 4000, timeoutMs: 60000,
            system: SERIES_IMAGE_REVIEW, user: reviewUser, imageInputs: [response.viewUrl || response.url!, ...references, style] });
          qaCalls.push(reply);
          return readSeriesQa(reply.text, drawn);
        } catch { return undefined; }
      };
      const verdict = (qa: NonNullable<ReturnType<typeof readSeriesQa>>): ImageOutcome => {
        const pass = seriesPicturePasses(qa, shot.page === 0);
        const usable = !pass && seriesPictureUsable(qa);
        const status: ImageOutcome['status'] = pass ? 'passed' : usable ? 'flawed' : 'failed';
        const severity = pass ? 0 : usable ? 5 : 10;
        const notes = [...qa.defects.map(d => d.detail), ...(qa.missing || []), ...qa.duplicates];
        history.push({ kind: number === 1 ? 'series-scene' : editing ? 'targeted-scene-edit' : simplified ? 'simplified-scene-repair' : 'same-scene-repair', status, severity, notes, url: response.url });
        const outcome: ImageOutcome = { page: shot.page, url: response.url, prompt, attempts: number, costUSD, qa, severity, status, history: [...history] };
        reviewed.set(shot.page, [...(reviewed.get(shot.page) || []), outcome]);
        return outcome;
      };
      let qa = await review(`series-image-qa-${shot.page}-${number}`);
      if (!qa && canReview()) qa = await review(`series-image-qa-${shot.page}-${number}-retry`, input.visionFallbackModel);
      if (qa) return verdict(qa);
      history.push({ kind: 'series-vision', status: 'failed', severity: 999, notes: ['Bildprüfung nicht verfügbar oder unlesbar; das erzeugte Bild bleibt für eine erneute Prüfung erhalten.'], url: response.url });
      const unverified: ImageOutcome = { page: shot.page, url: response.url, prompt, attempts: number, costUSD, severity: 999, status: 'failed', errors: ['series_vision_error'], history };
      visionRecoveries.set(shot.page, async () => {
        const recovered = await review(`series-image-qa-${shot.page}-${number}-recovery`);
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
  const outcomes = await mapLimited(shots, SERIES_POLICY.imageConcurrency, shot => render(shot));
  // Give transient preparation failures one recovery pass after all first attempts have settled.
  // These pictures have never reached the provider: keep attempt/seed 1 and the paid redraw allowance.
  const referenceRecoveries = outcomes.map((outcome, index) => ({ outcome, index }))
    .filter(({ outcome }) => outcome.attempts === 0 && outcome.errors?.includes('series_reference_error'));
  await mapLimited(referenceRecoveries, SERIES_POLICY.imageConcurrency, async ({ outcome, index }) => {
    outcomes[index] = await render(shots[index], 1, outcome);
  });
  // A temporary vision outage must not throw away a paid image or force a redraw.
  // Review the original image once more after the initial wave, keeping the same safety gates.
  const reviewedAgain = new Set<string>();
  const recoverUnverified = async () => {
    const unverified = outcomes.map((outcome, index) => ({ outcome, index }))
      .filter(({ outcome }) => outcome.errors?.includes('series_vision_error') && visionRecoveries.has(outcome.page) && !reviewedAgain.has(`${outcome.page}:${outcome.attempts}`));
    await mapLimited(unverified, SERIES_POLICY.imageConcurrency, async ({ outcome, index }) => {
      if (!canReview()) return;
      reviewedAgain.add(`${outcome.page}:${outcome.attempts}`);
      outcomes[index] = await visionRecoveries.get(outcome.page)!();
    });
  };
  await recoverUnverified();
  // Repairs go only to hard faults, chapters before the cover: a printed "flawed" picture was never improved by a redraw
  // (ff6eff04 chapter 3, Talea-Folge 0ee9af53).
  const canRetryOutcome = (o: ImageOutcome) => (o.status === 'failed' && (Boolean(o.qa) || o.errors?.includes('series_provider_error'))) ||
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
      const reply = await input.llm({ stage: 'series-picture-rescue-plan', role: 'support', model: input.visionModel, effort: 'low', json: true, maxTokens: 5000, timeoutMs: 60000,
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
        if (!beat || !ids.includes(beat.actorId) || typeof beat.action !== 'string' || beat.action.length < 12 || beat.action.length > 220 || QUIET_ACTION.test(beat.action.trim()) || typeof beat.result !== 'string' || beat.result.length < 12 || beat.result.length > 260 || HIDDEN_IDENTITY.test(beat.result) || !['wide', 'medium', 'close'].includes(beat.framing)) continue;
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
    const available = Math.max(0, Math.min(SERIES_POLICY.imageRetries - regenerated.length, SERIES_POLICY.maxImageCalls - imageCalls));
    // Keep room for one more attempt per empty chapter instead of using every retry on first edits or the cover.
    const reserved = number === 2 ? Math.min(priority.length, Math.max(0, available - priority.length)) : 0;
    const retries = [...priority, ...candidates.filter(({ index }) => !selected.has(index))].slice(0, available - reserved);
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
  return { cover: outcomes[0], pages: new Map(outcomes.slice(1).map(o => [o.page, o])), imagesGenerated: outcomes.filter(o => isPublishable(o)).length, imageCalls, imageCostUSD, qaCalls, regenerated };
}
