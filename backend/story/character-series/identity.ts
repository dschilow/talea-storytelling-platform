import type { CastCandidate, StorybookHero } from '../storybook/types';
import { heroAppearance } from '../storybook/illustration-stage';

/** The pool identity belongs to its portrait; a story outline must not repaint it. */
export function seriesLeadCandidate(lead: CastCandidate): CastCandidate {
  return { ...lead, canLead: true };
}

/** A loose portrait prop or portrait background theme is not a facial invariant; an actual story scene names its own setting and props. */
export function seriesReferenceAppearance(appearance: string): string {
  return appearance
    .replace(/,\s*(?:a |smoking )?pipe\b/gi, '')
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
