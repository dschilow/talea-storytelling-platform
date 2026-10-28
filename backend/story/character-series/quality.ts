import type { VisualEntity } from '../storybook/illustration-stage';
import type { ImageQaReport } from '../storybook/images';
import { parseJsonObject } from '../storybook/llm';

const KINDS = ['anatomy', 'identity', 'story', 'unexpected', 'text', 'style'] as const;
type Kind = typeof KINDS[number];
export interface SeriesImageDefect { kind: Kind; detail: string; fix: string }
export type SeriesQa = ImageQaReport & {
  styleMatch: number; styleDefects: string[]; primaryActionClear: boolean; criticalSceneDefects: string[];
  defects: SeriesImageDefect[]; identityById: Record<string, number>;
};

export const SERIES_IMAGE_REVIEW = `Inspect image 1 for a children's series. The optional identity sheet contains ONLY the expected identities; the last attachment is ONLY a public style example. Judge image 1, never count reference people as extras. Judge the SELECTED MOMENT and its PRIMARY STORY FACT, not every event in the nearby source. A cover is a character-in-world composition, not a literal freeze-frame of the chapter opening: a fairy carrying a boot does not also need the earlier footprint gag. Source paragraphs verify who acts and what actually exists; they are not a checklist of things to draw simultaneously. A caption can itself contradict the source. Preserve who performs each action. A clear main event never excuses another material defect.
Report ALL observed material defects: anatomy, changed identity/species/outfit, one person's traits or action assigned to another, a visual metaphor turned into real clothing, unrequested objects (especially a cigarette-like stick or smoke at a child's mouth), unsafe prop/body relationships, missing gag-defining action, extra figures, writing or a reference sheet. A whistling sound is conveyed by expression, not a mouth-held object or smoke. Ignore harmless stance, gaze-angle and decorative variations. Style defects mean a materially different rendering, not minor texture differences. Give one drawable fix per defect, at most six; for an unwanted object state the desired empty hand or mouth rather than asking to depict that object again.
Allow staging variations that preserve the event: one hand instead of two holding an object, a different camera angle, stance or gaze, partial occlusion, faint mist edges in a painted medium, and blank or tiny indistinct marks on a story note. Prop material or decorative construction (a leather versus rubber boot, laces, shelf height) is not a defect unless the difference changes the actual event, joke or function. Do not reject a fairy simply for having a visible body; she can become visible and carry things. Reject a different creature, a human child with fairy wings, a missing person, a changed signature face/outfit, a reversed action, a dangerous relationship or a lost central visual joke. Visible readable words, captions or conspicuous pseudo-lettering are text defects; a few indistinct strokes on a source-required note are not. Never demand an earlier event, every described hand, or exact shelf height when the selected exchange remains clear. Every reported defect must change the child's understanding of WHO is there or WHAT happens, or show a concrete anatomy, safety or identity fault; do not turn caption adjectives into new requirements.
Compare EACH expected person or creature separately with their OWN numbered slot on the supplied identity sheet: face shape, ears, mouth/teeth, age, hairstyle, body and outfit. A generic child with similar hair and eye colour is not a recognisable avatar. The portrait determines identity; preserve its distinctive features in the illustration medium. Never average a poor match into the other figure's good match. A recognisable stylised match scores 0.90–1.0 despite harmless pose or shading changes. A score below 0.90 needs a concrete identity defect explaining which distinguishing feature changed, with a positive correction; do not lower identity for scene composition or translucency alone.
JSON only: {"visibleIds":["expected id"],"identityById":{"expected id":0.0},"primaryActionClear":true,"sceneMatch":0.0,"styleMatch":0.0,"defects":[{"kind":"anatomy|identity|story|unexpected|text|style","detail":"observed problem","fix":"drawable correction"}]}. Scores 0–1. Empty defects only when no material fault is observed.`;

/** A single material-defect list prevents recognised clothing/prop errors being demoted to ignored notes. */
export function readSeriesQa(text: string, expected: VisualEntity[]): SeriesQa | undefined {
  let raw: any;
  try { raw = parseJsonObject(text); } catch { return undefined; }
  const identities = expected.map(e => raw?.identityById?.[e.id]);
  const scores = [...identities, raw?.sceneMatch, raw?.styleMatch];
  if (scores.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1) || typeof raw.primaryActionClear !== 'boolean' || !Array.isArray(raw.visibleIds) || raw.visibleIds.some((id: unknown) => typeof id !== 'string') || !Array.isArray(raw.defects) || raw.defects.length > 6) return undefined;
  if (raw.defects.some((d: any) => !KINDS.includes(d?.kind) || typeof d.detail !== 'string' || d.detail.trim().length < 3 || d.detail.length > 400 || typeof d.fix !== 'string' || d.fix.trim().length < 3 || d.fix.length > 400)) return undefined;
  const defects = raw.defects as SeriesImageDefect[];
  const ofKind = (kind: Kind) => defects.filter(d => d.kind === kind).map(d => d.detail);
  const known = new Map(expected.map(e => [e.id, e.name]));
  const missing = expected.filter(e => !raw.visibleIds.includes(e.id)).map(e => e.name);
  const duplicates = raw.visibleIds.filter((id: string, i: number) => raw.visibleIds.indexOf(id) !== i).map((id: string) => known.get(id) || id);
  return {
    identityMatch: Math.min(...identities), sceneMatch: raw.sceneMatch, styleMatch: raw.styleMatch, primaryActionClear: raw.primaryActionClear,
    identityById: Object.fromEntries(expected.map((e, i) => [e.id, identities[i]])),
    defects, criticalSceneDefects: defects.filter(d => d.kind !== 'style').map(d => d.detail),
    anatomyDefects: ofKind('anatomy'), featureBleed: ofKind('identity'), sceneDefects: ofKind('story'), styleDefects: ofKind('style'),
    sceneFixes: defects.map(d => d.fix), missing, duplicates,
    unexpectedCharacters: raw.visibleIds.filter((id: string) => !known.has(id)),
    textVisible: defects.some(d => d.kind === 'text'), referenceSheetVisible: false,
    animalFeaturesOnHumans: [], roleSwaps: [], elementMisuse: [],
    namedCharactersVisible: new Set(raw.visibleIds.filter((id: string) => known.has(id))).size,
  };
}

export function seriesPicturePasses(qa: SeriesQa | undefined): boolean {
  return Boolean(qa && !qa.defects.length && !qa.missing?.length && !qa.duplicates.length && !qa.unexpectedCharacters.length && qa.primaryActionClear && qa.identityMatch >= 0.9 && qa.sceneMatch >= 0.7 && qa.styleMatch >= 0.75);
}

/** Bounded literal evidence near the selected paragraph; no second model or whole chapter per picture read. */
export function seriesPictureSource(text: string, paragraph?: number, quote?: string): string {
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  const at = Math.max(0, Math.min(paragraphs.length - 1, (paragraph || 1) - 1));
  const nearby = paragraphs.slice(Math.max(0, at - 2), at + 3).join('\n\n').slice(0, 2200);
  return [quote ? `EXACT STORY QUOTE: ${quote}` : '', `NEARBY SOURCE PARAGRAPHS:\n${nearby}`].filter(Boolean).join('\n');
}
