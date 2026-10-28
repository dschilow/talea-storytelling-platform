import { createHash } from 'node:crypto';
import { createIdentityReferenceCache } from '../image-reference-sprite';
import type { VisualEntity } from '../storybook/illustration-stage';
import { type ImageOutcome, type ImageProvider, type StorybookImagesResult } from '../storybook/images';
import { parseJsonObject, type StorybookLlm } from '../storybook/llm';
import type { IllustrationPlan, IllustrationShot, StorybookPage } from '../storybook/types';
import type { StoryBrief } from '../storybook/context';
import { buildImageSlots, pagesFor, placePictures, buildPictureNotes } from '../storybook/book/illustrations';
import type { EpisodeDirection } from '../episode/pictures';
import { ORIGINALS_IMAGE_STYLE, SCENE_SIZE } from '../library/images';
import { SERIES_POLICY } from './authoring';
import { readSeriesQa, seriesPicturePasses, seriesPictureSource, SERIES_IMAGE_REVIEW } from './quality';
export { seriesPicturePasses } from './quality';

interface SeriesShot extends IllustrationShot { actionKey: string; storyQuote?: string }

export const SERIES_STYLE_REFERENCE = 'https://www.talea.website/library/series/bruno-der-flunkerfisch/s1e1/ch2.webp';
export const SERIES_ART_DIRECTION = `${ORIGINALS_IMAGE_STYLE}. Match the rendering of the supplied Talea Originals art example: bold readable curved silhouettes, slightly enlarged expressive heads, clear soft ink contours, broad gouache colour shapes and varied comic expressions. Keep texture subordinate to faces and action; the setting supports the joke. Use the supplied identities in THIS illustration language.`;

/** Every shot keeps its dramatic subject; a failed picture never turns into an avatar portrait. */
export function validateSeriesShots(raw: any, pages: StorybookPage[], entities: VisualEntity[], leadId: string): IllustrationPlan {
  const ids = new Set(entities.map(e => e.id));
  const shot = (candidate: any, page: number): IllustrationShot => {
    const onStage = Array.isArray(candidate?.onStage) ? [...new Set<string>(candidate.onStage)] : [];
    if (!onStage.length || onStage.length > 2 || onStage.some(id => !ids.has(id)) || typeof candidate?.scene !== 'string' || candidate.scene.length < 45 || candidate.scene.length > 1900) throw new Error('Die Serienbildplanung hat keine klare, gültige Besetzung.');
    if ((page === 0 || page === 1) && !onStage.includes(leadId)) throw new Error('Die Serienhauptfigur fehlt in ihrem Titel- oder Einstiegsbild.');
    const paragraphs = pages[page - 1]?.content.split(/\n\n/).length || 0;
    if (page > 0 && (!Number.isInteger(candidate.paragraph) || candidate.paragraph < 1 || candidate.paragraph > paragraphs)) throw new Error('Das Serienbild gehört zu keinem Absatz des Kapitels.');
    const quote = typeof candidate.storyQuote === 'string' ? candidate.storyQuote.trim() : '';
    // Models quote German „…“ as straight quotes; only the words have to be the chapter's own.
    const norm = (s: string) => s.normalize('NFC').replace(/[„“”"«»]/g, '"').replace(/[‚‘’']/g, "'").replace(/…/g, '...').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
    if (page > 0 && (quote.length < 12 || quote.length > 500 || !norm(pages[page - 1].content).includes(norm(quote)))) throw new Error('Dem Serienbild fehlt ein wörtlicher Beleg aus seinem Kapitel.');
    return { page, onStage, scene: candidate.scene, actionKey: typeof candidate.actionKey === 'string' ? candidate.actionKey.slice(0, 300) : candidate.scene, storyQuote: quote || undefined, focus: 'scene', artifactVisible: candidate.artifactVisible === true, elements: [], ...(page ? { paragraph: candidate.paragraph } : {}) } as SeriesShot;
  };
  if (!Array.isArray(raw?.pages) || raw.pages.length !== pages.length || raw.pages.some((p: any, i: number) => p.page !== i + 1)) throw new Error('Die Serienbildplanung enthält nicht genau ein Bild je Kapitel.');
  const plan = { cover: shot(raw.cover, 0), pages: raw.pages.map((p: any, i: number) => shot(p, i + 1)), storyElements: [] };
  if (plan.pages.filter((p: IllustrationShot) => p.onStage.includes(leadId)).length < Math.min(2, pages.length)) throw new Error('Die Serienhauptfigur verschwindet aus ihren Kapitelbildern.');
  const heroes = entities.filter(e => e.role === 'hero');
  const capacity = pages.length * 2 - Math.min(2, pages.length);
  if (heroes.length <= capacity && heroes.some(e => !plan.pages.some((p: IllustrationShot) => p.onStage.includes(e.id)))) throw new Error('Ein beteiligter Avatar fehlt in allen Serienbildern.');
  return plan;
}

export async function directSeriesPictures(input: { llm: StorybookLlm; model: string; brief: StoryBrief; title: string; pages: StorybookPage[]; entities: VisualEntity[] }): Promise<EpisodeDirection> {
  const leadId = input.brief.characterSeries!.bible.characterId;
  const slots = buildImageSlots(input.pages.map(p => ({ order: p.order, content: p.content })), { chapters: [] }, 1);
  const pages = pagesFor(slots);
  // Only the shared fictional pool lead is newly shown to the director. Private avatar portraits stay out.
  const publicLead = input.entities.find(e => e.id === leadId && e.role === 'cast');
  const call = await input.llm({ stage: 'series-picture-direction', role: 'support', model: input.model, json: true, effort: 'low', maxTokens: 1000 + pages.length * 600,
    imageInputs: [...(publicLead?.referenceUrl ? [publicLead.referenceUrl] : []), SERIES_STYLE_REFERENCE],
    system: 'Direct ONE landscape illustration per chapter plus a distinct cover. At most TWO visible characters per image. Lead on cover, page 1 and at least two chapter pictures; distribute the avatars across their actual contributions. English complete captions, 120–160 words, varied expressive poses and a quiet background. Pick a strong, simply drawable story moment, not a smiling group or a mechanical diagram. Avoid a gag that requires an arrow to point precisely at a body, several simultaneous supports, or exact small mechanisms; use a decisive choice, an actual exchange or an aftermath instead.\nKeep action ownership: only the person who whistles, gestures or has a tooth gap in the SOURCE has it in the caption. Someone off-panel does not lend their action to someone visible. Translate sounds into expressions and gestures, with empty mouths; do not add visible sound props or trails. Translate figurative language into the actual physical object: a wreath around a bare dragon stays a wreath, never actual trousers. Preserve canonical outfits and species.\nEach page needs storyQuote: an exact 12–500 character passage from THAT chapter evidencing its moment. Choose a paragraph number near that passage; print the image AFTER that paragraph. No writing in pictures. JSON {"cover":{"onStage":["id"],"actionKey":"visible fact","scene":"..."},"pages":[{"page":1,"paragraph":4,"onStage":["id","id"],"storyQuote":"exact source passage","actionKey":"visible fact","scene":"..."}]}.',
    user: (input.brief.characterSeries?.logs.length === 0 ? 'FIRST CHAPTER PICTURE: show the actual first conversation between the series figure and an avatar, with different reactions. Pick the encounter after the surprise rather than an exact impact or transformation.\n' : '') + `COMPLETE CAPTIONS: one readable exchange or visual joke, faces large enough for their distinctive features. Include actionKey: the single essential visible fact. Treat that fact as the requirement; camera, hands and background serve it. Depict a mist fairy as a recognisable fairy with visible features and softly fading edges, not disembodied body parts or a different human child. Choose an exchange or clear aftermath over a tiny insect that must balance on an exactly oriented arrow. If source-required paper appears, it is a small quiet prop without readable lettering. Avoid impossible supports and unstable mechanisms.\n${publicLead?.referenceUrl ? 'Image 1 is ONLY the public series lead.' : ''} The last image is ONLY the art style, never another cast member. The supplied identity descriptions override generic story adjectives such as narrow or round. Keep each avatar\'s own face, ears, teeth, hair and outfit; do not transfer fairy wings to a human. Characters act inside the scene and look at each other or their task.\nREQUIRED CAST COVERAGE: each avatar appears in at least one chapter picture if slots allow: ${input.entities.filter(e => e.role === 'hero').map(e => e.id).join(', ')}. Lead on the cover, first meeting and at least two chapters. Cover can be a character-in-world composition and need not show a chapter-opening gag.\nTITLE ${input.title}\nSERIES LEAD ${leadId}\nIDENTITIES:\n${input.entities.map(e => `${e.id}: ${e.name}; ${e.appearance}`).join('\n')}\nCHAPTERS:\n${pages.map(p => `CHAPTER ${p.order}: ${p.title}\n${p.content.split(/\n\n/).map((t, i) => `p${i + 1}: ${t}`).join('\n')}`).join('\n\n')}` });
  let illustrations: IllustrationPlan;
  let repairCall: Awaited<ReturnType<StorybookLlm>> | undefined;
  let repairReasons: Array<{ page: number; errors: string[] }> | undefined;
  try { illustrations = validateSeriesShots(parseJsonObject(call.text), pages, input.entities, leadId); }
  catch (error) {
    repairReasons = [{ page: 0, errors: [String((error as Error).message)] }];
    repairCall = await input.llm({ stage: 'series-picture-plan-repair', role: 'support', model: input.model, json: true, effort: 'low', maxTokens: 1000 + pages.length * 600,
      system: 'Repair only the supplied illustration plan JSON. Each image has at most TWO visible characters, including the cover. When removing a character remove them from the caption too; preserve the selected actual story moment and its actionKey. The lead must appear on the cover, page 1 and at least two chapter images; each avatar appears in at least one image if slots allow. Keep English complete captions, exact page order and paragraph numbers, no new objects or events. Return only the corrected plan.',
      user: `DEFECT ${repairReasons[0].errors.join('; ')}\nLEAD ${leadId}\nAVATARS ${input.entities.filter(e => e.role === 'hero').map(e => e.id).join(', ')}\nALLOWED IDENTITIES ${input.entities.map(e => `${e.id}: ${e.name}`).join('; ')}\nEXACTLY ${pages.length} PAGES\nEvery page needs storyQuote: an exact 12–500 character passage from THAT chapter proving the selected moment, with actions belonging to the right person. Never add a sound, gesture or physical trait from another person. Translate metaphors into the actual object only, without extra clothes.\nSOURCE CHAPTERS:\n${pages.map(p => `CHAPTER ${p.order}\n${p.content}`).join('\n\n')}\nPLAN\n${call.text}` });
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
  const qaCalls: StorybookImagesResult['qaCalls'] = [], regenerated: number[] = [];
  const canReview = () => (input.llm as StorybookLlm & { canCall?: () => boolean }).canCall?.() !== false;
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
      const artAttachment = references.length ? 2 : 1;
      const prompt = [shot.scene, SERIES_ART_DIRECTION,
        references.length ? `IDENTITY SHEET, image 1: ${identities.map((e, i) => `slot ${i + 1}${identities.length === 2 ? i === 0 ? ' (left half)' : ' (right half)' : ''} is ONLY ${e.name}: ${e.appearance}`).join('; ')}. Keep each face, ears, teeth, species and outfit with its OWN person. ${drawn.filter(e => e.isHuman).map(e => `${e.name} has an ordinary human silhouette, with human back and shoulders.`).join(' ')} Their faces are large enough to recognise. The sheet's resting poses change to the action in the scene.` : '',
        ...drawn.filter(e => !e.referenceUrl).map(e => `${e.name}: ${e.appearance}.`),
        'Every described object stays that object; a joke never adds a garment or a mouth-held prop.',
        `Exactly ${drawn.length} visible characters, once each: ${drawn.map(e => e.name).join(', ')}. One continuous wordless illustration.`,
        fixes.length ? `Correct these observed problems in the same scene: ${fixes.join(' ')}` : '',
        `Image ${artAttachment} is a Talea Originals STYLE EXAMPLE only: use its ink strokes, expressive proportions and gouache colour treatment. Its characters and objects are not part of this scene.`,
      ].filter(Boolean).join('\n');
      if (imageCalls >= SERIES_POLICY.maxImageCalls) throw new Error('Das Bildbudget der Figurenfolge ist erreicht.');
      imageCalls++;
      const seed = parseInt(createHash('sha256').update(`${input.seed}:${shot.page}:${number}`).digest('hex').slice(0, 8), 16) % 2147483647;
      try {
      const response = await input.provider({ prompt, negativePrompt: '', referenceImages: [...references, style], width: SCENE_SIZE.width, height: SCENE_SIZE.height, seed, page: shot.page, logStage: shot.page === 0 ? 'series-image-cover' : 'series-image-chapter' });
      imageUrl = response.url;
      costUSD += response.costUSD || 0; imageCostUSD += response.costUSD || 0;
      if (!response.url) return { page: shot.page, prompt, attempts: number, costUSD, severity: 999, status: 'missing', history };
      const reply = await input.llm({ stage: `series-image-qa-${shot.page}-${number}`, role: 'support', model: input.visionModel, effort: 'low', json: true, maxTokens: 1000, timeoutMs: 60000,
        system: SERIES_IMAGE_REVIEW,
        user: `${shot.page === 0 ? 'COVER: judge the selected character-in-world composition. No chapter action is compulsory.' : 'CHAPTER PICTURE: judge this selected moment, allowing harmless staging differences.'}\nEXPECTED IDENTITIES:\n${drawn.map(e => `${e.id}: ${e.name}; ${e.appearance}; forbidden features: ${e.forbidden.join(', ') || 'none specified'}`).join('\n')}\nPROPOSED CAPTION:\n${shot.scene}\nPRIMARY STORY FACT: ${(shot as SeriesShot).actionKey || shot.scene}\n${shot.page === 0 ? '' : seriesPictureSource(input.pageTexts[shot.page] || '', shot.paragraph, (shot as SeriesShot).storyQuote)}\n${references.length ? `Attachment 2 is the identity sheet, left to right: ${identities.map((e, i) => `slot ${i + 1} = ${e.id} (${e.name})`).join('; ')}.` : 'No identity sheet is attached.'} The last attachment is the public style example.`,
        imageInputs: [response.viewUrl || response.url, ...references, style] });
      qaCalls.push(reply);
      const qa = readSeriesQa(reply.text, drawn);
      const pass = seriesPicturePasses(qa);
      const notes = qa ? [...qa.defects.map(d => d.detail), ...(qa.missing || []), ...qa.duplicates] : ['Bildprüfung unvollständig'];
      history.push({ kind: number === 1 ? 'series-scene' : 'same-scene-repair', status: pass ? 'passed' : 'failed', severity: pass ? 0 : 10, notes, url: response.url });
      return { page: shot.page, url: response.url, prompt, attempts: number, costUSD, qa, severity: pass ? 0 : 10, status: pass ? 'passed' : 'failed', history };
      } catch (error) {
        history.push({ kind: 'series-image-error', status: 'failed', severity: 999, notes: ['Bild oder Bildprüfung nicht vollständig verfügbar'], ...(imageUrl ? { url: imageUrl } : {}) });
        return { page: shot.page, url: imageUrl, prompt, attempts: number, costUSD, severity: 999, status: 'failed', errors: [(error as any)?.code === 'series_budget_exhausted' ? 'series_budget_exhausted' : imageUrl ? 'series_vision_error' : 'series_provider_error'], history };
      }
    };
    return attempt(previous?.qa?.sceneFixes || []);
  };
  // Review every planned picture BEFORE spending the one optional redraw on an earlier chapter.
  const outcomes: ImageOutcome[] = [];
  for (const shot of shots) outcomes.push(await render(shot));
  // Prioritise a missing chapter illustration over a decorative cover correction.
  const chapterRetry = outcomes.findIndex(o => o.page > 0 && o.status !== 'passed' && o.qa);
  const retry = chapterRetry >= 0 ? chapterRetry : outcomes.findIndex(o => o.status !== 'passed' && o.qa);
  if (retry >= 0 && imageCalls < SERIES_POLICY.maxImageCalls && canReview()) {
    regenerated.push(shots[retry].page);
    outcomes[retry] = await render(shots[retry], 2, outcomes[retry]);
  }
  return { cover: outcomes[0], pages: new Map(outcomes.slice(1).map(o => [o.page, o])), imagesGenerated: outcomes.filter(o => o.status === 'passed').length, imageCalls, imageCostUSD, qaCalls, regenerated };
}
