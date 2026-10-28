import type { VisualEntity } from '../storybook/illustration-stage';
import type { ImageQaReport } from '../storybook/images';
import { parseJsonObject } from '../storybook/llm';

const KINDS = ['anatomy', 'identity', 'safety', 'story', 'unexpected', 'text', 'style', 'composition'] as const;
type Kind = typeof KINDS[number];
export interface SeriesImageDefect { kind: Kind; detail: string; fix: string }
export type SeriesQa = ImageQaReport & {
  styleMatch: number; styleDefects: string[]; primaryActionClear: boolean; criticalSceneDefects: string[];
  defects: SeriesImageDefect[]; identityById: Record<string, number>;
};

export const SERIES_IMAGE_REVIEW = `Review illustration 1. Attachment 2, when present, is the numbered identity sheet; the last attachment is the style example. Reference people are not extra scene figures.
Check the selected PHYSICAL ACTION and VISIBLE RESULT against the quoted source. Sources establish actors and events, not a checklist of all nearby events. A cover shows its selected motif. Set posing=true for a reference-like lineup or two passive figures merely facing each other or the viewer while the requested physical event is absent. Real purposeful work, imbalance, slapstick movement and comic consequences are action; theatrical gestures are not compulsory.
Judge observable hand-object contact, setting and meaningful object state. A held object can represent the completed catch or handover. If the central story prop is replaced by a completely different material or object (e.g. a white cloth banner drawn as a brown wooden tree log) or an indoor/courtyard setting is replaced by open sea and sailboats copied from a reference portrait, report it and set sceneMatch below 0.65 (and primaryActionClear=false when the core object/action is lost). Never require a still to prove a prior trajectory, a needle's unchanged direction during rotation, or the exact topology of a securing knot. If a caption asks for an unobservable time comparison, assess the visible physical activity without treating that impossible proof as an image defect.
The illustration is wordless: never require a word from the source or caption to be readable on a map/tile/note. A visible cleaned patch or pictorial carving can represent the discovery; the prose supplies its name. Garbled tiny prop marks are not a failure to render required text.
Compare each figure with its OWN reference slot: face, age, ears/teeth, hair/beard, species, distinctive clothes. Count arms and hands carefully on every figure: a person with three or four hands gripping an object, an extra limb, or a blurred/ghost third hand on a shirt is a mandatory kind=anatomy defect. The portrait overrides contradictory prose about appearance. 0.90–1 means a recognisable stylised identity; below 0.90 requires a specific identity defect and correction. Never average figures. Story-required outerwear such as a life jacket is allowed. Portrait poses and loose portrait props are not requirements.
Report missing/extra/merged people, changed distinctive identity, anatomy (including extra/blurred hands), dangerous support, reversed actor/action, absent central physical consequence, static posing, reference panels, prominent lettering/captions/logos, materially different rendering. An action assigned to the wrong person is kind=identity; dangerous support is kind=safety. Small staging/prop differences are kind=story and do not by themselves negate an otherwise clear physical action. Set primaryActionClear=false when the main physical interaction is actually absent or contradicted. Do not infer a spoken sentence from an open/closed mouth. Allow different camera, gaze, handhold, texture, minor prop details, tiny map/note marks and harmless pose variations. A metaphor does not add clothing; whistling does not add a mouth-held object or smoke. Give one positive drawable correction per observation, at most six.
JSON: {"visibleIds":["id"],"identityById":{"id":0.98},"posing":false,"primaryActionClear":true,"sceneMatch":0.95,"styleMatch":0.9,"defects":[{"kind":"anatomy|identity|safety|story|unexpected|text|style|composition","detail":"observed problem","fix":"positive correction"}]}. Use the exact supplied character ids in visibleIds and identityById. All scores 0–1. Empty defects only when no fault is observed.`;

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
  if (rawDefects.some((d: any) => !KINDS.includes(d?.kind) || typeof d.detail !== 'string' || d.detail.trim().length < 3 || d.detail.length > 400 || typeof d.fix !== 'string' || d.fix.trim().length < 3 || d.fix.length > 400)) return undefined;
  const defects = rawDefects as SeriesImageDefect[];
  const visibleIds = (raw.visibleIds as string[]).map(resolveId);
  const ofKind = (kind: Kind) => defects.filter(d => d.kind === kind).map(d => d.detail);
  const known = new Map(expected.map(e => [e.id, e.name]));
  const missing = expected.filter(e => !visibleIds.includes(e.id)).map(e => e.name);
  const duplicates = visibleIds.filter((id: string, i: number) => visibleIds.indexOf(id) !== i).map((id: string) => known.get(id) || id);
  return {
    identityMatch: Math.min(...identities), sceneMatch: raw.sceneMatch, styleMatch: raw.styleMatch, primaryActionClear: raw.primaryActionClear, posing: raw.posing,
    identityById: Object.fromEntries(expected.map((e, i) => [e.id, identities[i]])),
    defects, criticalSceneDefects: defects.filter(d => d.kind !== 'style' && d.kind !== 'story').map(d => d.detail),
    anatomyDefects: ofKind('anatomy'), featureBleed: ofKind('identity'), sceneDefects: ofKind('story'), styleDefects: ofKind('style'),
    sceneFixes: defects.map(d => d.fix), missing, duplicates,
    unexpectedCharacters: visibleIds.filter((id: string) => !known.has(id)),
    textVisible: defects.some(d => d.kind === 'text'), referenceSheetVisible: false,
    animalFeaturesOnHumans: [], roleSwaps: [], elementMisuse: [],
    namedCharactersVisible: new Set(visibleIds.filter((id: string) => known.has(id))).size,
  };
}

export function seriesPicturePasses(qa: SeriesQa | undefined): boolean {
  return Boolean(qa && !qa.posing && !qa.defects.some(d => d.kind !== 'story') && !qa.missing?.length && !qa.duplicates.length && !qa.unexpectedCharacters.length && qa.primaryActionClear && qa.identityMatch >= 0.9 && qa.sceneMatch >= 0.7 && qa.styleMatch >= 0.75);
}

/** Bounded literal evidence near the selected paragraph; no second model or whole chapter per picture read. */
export function seriesPictureSource(text: string, paragraph?: number, quote?: string): string {
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  const at = Math.max(0, Math.min(paragraphs.length - 1, (paragraph || 1) - 1));
  const nearby = paragraphs.slice(Math.max(0, at - 2), at + 3).join('\n\n').slice(0, 2200);
  return [quote ? `EXACT STORY QUOTE: ${quote}` : '', `NEARBY SOURCE PARAGRAPHS:\n${nearby}`].filter(Boolean).join('\n');
}
