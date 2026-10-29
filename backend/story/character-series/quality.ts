import type { VisualEntity } from '../storybook/illustration-stage';
import type { ImageQaReport } from '../storybook/images';
import { parseJsonObject } from '../storybook/llm';

const KINDS = ['anatomy', 'identity', 'safety', 'story', 'unexpected', 'text', 'style', 'composition', 'detail'] as const;
type Kind = typeof KINDS[number];
export interface SeriesImageDefect { kind: Kind; detail: string; fix: string; blocksAction?: boolean }
export type SeriesQa = ImageQaReport & {
  styleMatch: number; styleDefects: string[]; primaryActionClear: boolean; criticalSceneDefects: string[];
  defects: SeriesImageDefect[]; identityById: Record<string, number>;
  /** Everything visible agrees with the story, even when the picture shows a neighbouring instant of the chosen scene. */
  storyConsistent: boolean;
};

export const SERIES_IMAGE_REVIEW = `Review illustration 1. Attachment 2, when present, is the numbered identity sheet; the last attachment is the style example. Reference people are not extra scene figures.
Check the selected PHYSICAL ACTION and VISIBLE RESULT against the quoted source. Sources establish actors and events, not a checklist of all nearby events. A cover shows its selected motif. Set posing=true for a reference-like lineup or two passive figures merely facing each other or the viewer while the requested physical event is absent. Real purposeful work, imbalance, slapstick movement and comic consequences are action; theatrical gestures are not compulsory.
Make an independent visual check of the main action and its consequence: a stool or cup that is meant to hang from a rope must actually be visibly raised; a hat meant to fly must not merely be worn. If the picture shows a fundamentally different event or the central action is missing, set primaryActionClear=false even when the same people and props are present. Do not treat a similar object or a matching facial expression as proof of the event.
Judge observable hand-object contact, setting and meaningful object state. A held object can represent the completed catch or handover. If the central story prop is replaced by a completely different material or object (e.g. a white cloth banner drawn as a brown wooden tree log) or an indoor/courtyard setting is replaced by open sea and sailboats copied from a reference portrait, report it and set sceneMatch below 0.65 (and primaryActionClear=false when the core object/action is lost). Never require a still to prove a prior trajectory, a needle's unchanged direction during rotation, or the exact topology of a securing knot. If a caption asks for an unobservable time comparison, assess the visible physical activity without treating that impossible proof as an image defect.
The illustration is wordless: never require a word from the source or caption to be readable on a map/tile/note. A visible cleaned patch or pictorial carving can represent the discovery; the prose supplies its name. Garbled tiny prop marks are not a failure to render required text.
Compare each figure with its OWN reference slot: face, age, ears/teeth, hair/beard, species, distinctive clothes. Count arms and hands carefully on every figure: a person with three or four hands gripping an object, an extra limb, or a blurred/ghost third hand on a shirt is a mandatory kind=anatomy defect. The portrait overrides contradictory prose about appearance. 0.90–1 means a recognisable stylised identity; below 0.90 requires a specific identity defect and correction. Never average figures. Story-required outerwear such as a life jacket is allowed. Portrait poses and loose portrait props are not requirements.
Pay special attention to identity features transferred between figures: a child wearing the inventor's distinctive overalls instead of their own reference clothes is an identity defect, not a harmless variation in colour. Do not invent matching outfits for the whole group unless the story explicitly requires them.
Calibrate to a printed children's book, not a close-up identity test: a tiny tooth gap hidden by a closed mouth, distance or angle, and ears that are less prominent but still recognisable are kind=detail, not identity. Do not lower a recognisable person's identity score below 0.90 solely because a small feature is not discernible. Use kind=identity for an actual visible identity change, swapped distinctive clothing, wrong species, or a different person. Do not call a natural pose an anatomy defect without a concrete extra, missing or fused body part. A harmless framing or prop variation is kind=detail, not composition. Do not report an observed correct element as a defect. Covers need a recognisable character-in-world composition, not the exact chapter action.
Report missing/extra/merged people, changed distinctive identity, anatomy (including extra/blurred hands), dangerous support, reversed actor/action, absent central physical consequence, static posing, reference panels, prominent lettering/captions/logos, materially different rendering. An action assigned to the wrong person is kind=identity; dangerous support is kind=safety. For each story defect set blocksAction=true only when that specific defect directly contradicts or removes the selected primary physical action or its decisive result. Set it false for a secondary prop or harmless staging difference; for example, an inventor holding a wrench rather than a button does not erase a crown already landing on a child's head. Set primaryActionClear=false when the main physical interaction is actually absent or contradicted. Do not infer a spoken sentence from an open/closed mouth. Allow different camera, gaze, handhold, texture, minor prop details, tiny map/note marks and harmless pose variations. A metaphor does not add clothing; whistling does not add a mouth-held object or smoke. Give one positive drawable correction per observation, at most six.
storyConsistent is true when everything visible agrees with the story — the right people, the place, and every object in its true material, shape and state — and the picture shows either the selected instant or another instant the nearby source paragraphs really tell (just before or after it, e.g. two figures turning a crate together right before it lands). It is false when something visible contradicts the story: a swapped object or material (a wooden log for a cloth banner), a wrong setting (open sea for a courtyard), a person doing what another person does, or an event that never happens. Judge storyConsistent independently of primaryActionClear.
JSON: {"visibleIds":["id"],"identityById":{"id":0.98},"posing":false,"primaryActionClear":true,"storyConsistent":true,"sceneMatch":0.95,"styleMatch":0.9,"defects":[{"kind":"anatomy|identity|safety|story|unexpected|text|style|composition|detail","detail":"observed problem","fix":"positive correction","blocksAction":false}]}. Use the exact supplied character ids in visibleIds and identityById. All scores 0–1. Empty defects only when no fault is observed.`;

/** Identity/anatomy/safety remain blocking; harmless staging is retained separately from the release decision. */
export function readSeriesQa(text: string, expected: VisualEntity[]): SeriesQa | undefined {
  let raw: any;
  try { raw = parseJsonObject(text); } catch { return undefined; }
  const resolveId = (key: string): string => {
    const trimmed = String(key || '').trim();
    if (expected.some(e => e.id === trimmed)) return trimmed;
    const lower = trimmed.toLocaleLowerCase('de-DE');
    const byName = expected.find(e => e.id.toLocaleLowerCase('de-DE') === lower || e.name.toLocaleLowerCase('de-DE') === lower);
    if (byName) return byName.id;
    const slotMatch = lower.match(/^(?:seriesfigure|slot\s*)(\d+)$/);
    if (slotMatch) {
      const idx = Number(slotMatch[1]) - 1;
      if (expected[idx]) return expected[idx].id;
    }
    return trimmed;
  };
  const idMap: Record<string, any> = raw?.identityById && typeof raw.identityById === 'object'
    ? Object.fromEntries(Object.entries(raw.identityById).map(([k, v]) => [resolveId(k), v]))
    : {};
  const identities: number[] = expected.map(e => idMap[e.id]);
  const scores = [...identities, raw?.sceneMatch, raw?.styleMatch];
  if (scores.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1) || typeof raw.primaryActionClear !== 'boolean' || typeof raw.posing !== 'boolean' || !Array.isArray(raw.visibleIds) || raw.visibleIds.some((id: unknown) => typeof id !== 'string') || !Array.isArray(raw.defects)) return undefined;
  const rawDefects = raw.defects.slice(0, 6);
  if (rawDefects.some((d: any) => !KINDS.includes(d?.kind) || typeof d.detail !== 'string' || d.detail.trim().length < 3 || d.detail.length > 400 || typeof d.fix !== 'string' || d.fix.trim().length < 3 || d.fix.length > 400 || (d.blocksAction !== undefined && typeof d.blocksAction !== 'boolean'))) return undefined;
  // A missing tooth gap is a detail of a printed child, not a different person (Gemini filed it as identity three times in
  // story 289c11a4 and failed two pictures with it); everything else about the identity keeps its kind.
  const TOOTH_GAP = /\b(?:tooth|teeth)\b/i;
  const defects = (rawDefects as SeriesImageDefect[]).map(d => d.kind === 'identity' && TOOTH_GAP.test(d.detail) && !/\b(?:different|another|wrong|swapped|replaced)\b.*\b(?:person|child|boy|girl|face)\b/i.test(d.detail) ? { ...d, kind: 'detail' as Kind } : d);
  const visibleIds = (raw.visibleIds as string[]).map(resolveId);
  const ofKind = (kind: Kind) => defects.filter(d => d.kind === kind).map(d => d.detail);
  const known = new Map(expected.map(e => [e.id, e.name]));
  const missing = expected.filter(e => !visibleIds.includes(e.id)).map(e => e.name);
  const duplicates = visibleIds.filter((id: string, i: number) => visibleIds.indexOf(id) !== i).map((id: string) => known.get(id) || id);
  return {
    identityMatch: Math.min(...identities), sceneMatch: raw.sceneMatch, styleMatch: raw.styleMatch, primaryActionClear: raw.primaryActionClear, posing: raw.posing,
    identityById: Object.fromEntries(expected.map((e, i) => [e.id, identities[i]])),
    defects, criticalSceneDefects: defects.filter(d => d.kind !== 'style' && d.kind !== 'story' && d.kind !== 'detail').map(d => d.detail),
    storyConsistent: raw.storyConsistent === true,
    anatomyDefects: ofKind('anatomy'), featureBleed: ofKind('identity'), sceneDefects: ofKind('story'), styleDefects: ofKind('style'),
    sceneFixes: defects.map(d => d.fix), missing, duplicates,
    unexpectedCharacters: visibleIds.filter((id: string) => !known.has(id)),
    textVisible: defects.some(d => d.kind === 'text'), referenceSheetVisible: false,
    animalFeaturesOnHumans: [], roleSwaps: [], elementMisuse: [],
    namedCharactersVisible: new Set(visibleIds.filter((id: string) => known.has(id))).size,
  };
}

/**
 * The review asks for a named identity defect below 0.90. A lower score without one is an unsupported number: Gemini
 * scored two recognisable children 0.82/0.78 without a word in story e83e44e2, after 0.97/0.96 for the same picture
 * a run before. Below 0.75 a figure counts as replaced even unexplained.
 */
function identityHolds(qa: SeriesQa): boolean {
  return qa.identityMatch >= 0.9 || (qa.identityMatch >= 0.75 && !qa.defects.some(d => d.kind === 'identity'));
}

export function seriesPicturePasses(qa: SeriesQa | undefined, cover = false): boolean {
  // A reviewer can mark the action clear while explicitly describing a contradiction (e.g. berries on hair
  // instead of the hat in the source). Do not let that optimistic flag silently override its own finding in
  // chapter pictures. Covers are character-in-world compositions and do not promise one exact story instant.
  return Boolean(qa && !qa.posing && !qa.defects.some(d => d.kind !== 'story') && !(qa.defects.some(d => d.kind === 'story' && d.blocksAction) && !cover) && !qa.missing?.length && !qa.duplicates.length && !qa.unexpectedCharacters.length && (cover || qa.primaryActionClear) && identityHolds(qa) && qa.sceneMatch >= 0.7 && qa.styleMatch >= 0.75);
}

/**
 * Story ff6eff04: chapter 3 lost its only picture because the check wanted the crate landing ON the coat; the repair
 * showed the three turning the crate together — the instant the paragraph before tells — and was dropped as well.
 * A picture with the right people, intact, in a moment the chapter really tells is printed (status "flawed"); a picture
 * that contradicts the story or harms an identity, a hand or a face stays out.
 */
export function seriesPictureUsable(qa: SeriesQa | undefined): boolean {
  return Boolean(qa && qa.storyConsistent && !qa.posing && !qa.defects.some(d => d.kind !== 'story' && d.kind !== 'detail') && !qa.missing?.length && !qa.duplicates.length && !qa.unexpectedCharacters.length && identityHolds(qa) && qa.sceneMatch >= 0.45 && qa.styleMatch >= 0.75);
}

/**
 * After the last paid redraw a page keeps its best reviewed attempt instead of a hole in the book (story e83e44e2
 * printed one of seven pictures): the action may be loose or a neighbouring instant; a posed picture only fills a
 * chapter that would otherwise have none. Anatomy, identity, safety, lettering, unexpected things, extra or missing
 * figures, reference panels and a different object or setting (the review puts those below sceneMatch 0.65) still keep
 * a picture out.
 */
export function seriesPictureLastResort(qa: SeriesQa | undefined, emptyChapter = false): boolean {
  return Boolean(qa && (!qa.posing || emptyChapter) && !qa.defects.some(d => d.kind !== 'story' && d.kind !== 'detail' && d.kind !== 'style') && !qa.missing?.length && !qa.duplicates.length && !qa.unexpectedCharacters.length && identityHolds(qa) && qa.sceneMatch >= 0.65 && qa.styleMatch >= 0.75);
}

/** Bounded literal evidence near the selected paragraph; no second model or whole chapter per picture read. */
export function seriesPictureSource(text: string, paragraph?: number, quote?: string): string {
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  const at = Math.max(0, Math.min(paragraphs.length - 1, (paragraph || 1) - 1));
  const nearby = paragraphs.slice(Math.max(0, at - 2), at + 3).join('\n\n').slice(0, 2200);
  return [quote ? `EXACT STORY QUOTE: ${quote}` : '', `NEARBY SOURCE PARAGRAPHS:\n${nearby}`].filter(Boolean).join('\n');
}
