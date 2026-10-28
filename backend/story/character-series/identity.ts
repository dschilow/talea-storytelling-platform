import type { CastCandidate, StorybookHero } from '../storybook/types';
import { heroAppearance } from '../storybook/illustration-stage';

/** The pool identity belongs to its portrait; a story outline must not repaint it. */
export function seriesLeadCandidate(lead: CastCandidate): CastCandidate {
  return { ...lead, canLead: true };
}

/** A loose portrait prop is not a facial invariant; an actual story scene can still name its own props. */
export function seriesReferenceAppearance(appearance: string): string {
  return appearance.replace(/,\s*(?:a |smoking )?pipe\b/gi, '').replace(/\s{2,}/g, ' ').trim();
}

/** Distinctive faces and registered invariants precede generic hair/eye colours. */
export function seriesAvatarAppearance(hero: StorybookHero): string {
  const v = hero.visualProfile || {};
  const specific = [
    ...(Array.isArray(v.mustIncludeFeatures) ? [...v.mustIncludeFeatures].sort((a, b) => (a.priority || 3) - (b.priority || 3)).map(f => f.promptDescription || f.mustIncludeToken) : []),
    ...[v.face?.shape, v.face?.nose, v.face?.mouth, v.face?.eyebrows].filter(Boolean),
    ...(Array.isArray(v.face?.otherFeatures) ? v.face.otherFeatures : []),
    ...(Array.isArray(v.skin?.distinctiveFeatures) ? v.skin.distinctiveFeatures : []),
    ...(Array.isArray(v.bodyFeatures) ? v.bodyFeatures : []),
    v.clothingCanonical?.footwear,
  ].filter((s): s is string => typeof s === 'string' && Boolean(s.trim())).map(s => s.trim());
  const fallback = typeof hero.physicalTraits?.appearance === 'string' ? hero.physicalTraits.appearance : hero.description || '';
  return [...new Set([...specific, heroAppearance(v, fallback)])].filter(Boolean).join('; ').slice(0, 1100);
}
