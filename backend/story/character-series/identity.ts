import type { CastCandidate, StorybookHero } from '../storybook/types';
import { heroAppearance } from '../storybook/illustration-stage';

/** The pool identity belongs to its portrait; a story outline must not repaint it. */
export function seriesLeadCandidate(lead: CastCandidate): CastCandidate {
  return { ...lead, canLead: true };
}

/**
 * Clean series portraits of the leads (whole figure alone on white, scripts/character-series/lead-references.ts). The
 * pool portraits carry a workbench with jars (Tilda), ships, sea and a pipe (Blubbert) or a dark wash and end at the
 * waist; FLUX 3 copied Tilda's workbench into six of nine failed pictures of a pilot (2026-10-29) and drew her legless.
 */
export const SERIES_LEAD_REFERENCES: Record<string, string> = {
  'tilda-tueftel': '/library/character-series/leads/tilda-tueftel.webp',
  'kapitaen-blubbert': '/library/character-series/leads/kapitaen-blubbert.webp',
  'funkelflug': '/library/character-series/leads/funkelflug.webp',
  'nebelfee': '/library/character-series/leads/nebelfee.webp',
  'graf-griesgram': '/library/character-series/leads/graf-griesgram.webp',
};

/** The public series portrait of a lead, or undefined while the frontend that serves it is not deployed yet. */
export async function seriesLeadReference(seriesId: string | undefined, fetcher: typeof fetch = fetch): Promise<string | undefined> {
  const path = seriesId ? SERIES_LEAD_REFERENCES[seriesId] : undefined;
  if (!path) return undefined;
  const url = `https://www.talea.website${path}`;
  try {
    const response = await fetcher(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return response.ok && /^image\//i.test(response.headers.get('content-type') || '') ? url : undefined;
  } catch {
    return undefined;
  }
}

/** A loose portrait prop or portrait background theme is not a facial invariant; an actual story scene names its own setting and props. */
export function seriesReferenceAppearance(appearance: string): string {
  return appearance
    .replace(/,\s*(?:a |smoking )?pipe\b/gi, '')
    .replace(/,?\s*(?:and|with)\s+(?:colou?rful\s+)?tools\b/gi, '')
    .replace(/[,.]?\s*\b(?:maritime|nautical|harbou?r|ocean|sea|forest|mountain|castle)\s+(?:theme|background|setting|backdrop)\b/gi, '')
    .replace(/\b(\w+)(?:\s+\1\b)+/gi, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/[,\s]+$/, '')
    .trim();
}

/** Distinctive faces and registered invariants precede generic hair/eye colours; repeated words from profile fields are collapsed. */
export function seriesAvatarAppearance(hero: StorybookHero): string {
  const v = hero.visualProfile || {};
  const shape = typeof v.face?.shape === 'string' && v.face.shape.trim()
    ? (/\bface\b/i.test(v.face.shape) ? v.face.shape.trim() : `${v.face.shape.trim()} face`)
    : undefined;
  const specific = [
    ...(Array.isArray(v.mustIncludeFeatures) ? [...v.mustIncludeFeatures].sort((a, b) => (a.priority || 3) - (b.priority || 3)).map(f => f.promptDescription || f.mustIncludeToken) : []),
    ...[shape, v.face?.nose, v.face?.mouth, v.face?.eyebrows].filter(Boolean),
    ...(Array.isArray(v.face?.otherFeatures) ? v.face.otherFeatures : []),
    ...(Array.isArray(v.skin?.distinctiveFeatures) ? v.skin.distinctiveFeatures : []),
    ...(Array.isArray(v.bodyFeatures) ? v.bodyFeatures : []),
    v.clothingCanonical?.footwear,
  ].filter((s): s is string => typeof s === 'string' && Boolean(s.trim())).map(s => s.trim());
  const fallback = typeof hero.physicalTraits?.appearance === 'string' ? hero.physicalTraits.appearance : hero.description || '';
  const merged = [...new Set([...specific, heroAppearance(v, fallback)])]
    .filter(Boolean)
    .join('; ')
    .replace(/\b(\w+)(?:\s+\1\b)+/gi, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return merged.slice(0, 1100);
}
