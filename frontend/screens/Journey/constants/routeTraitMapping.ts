/**
 * routeTraitMapping.ts
 * Maps the 4 learning path route tags to the 9 real avatar personality traits.
 */
import type { RouteTag } from '../TaleaLearningPathTypes';

/** Which personality traits each route develops */
export const ROUTE_TO_TRAITS: Record<RouteTag, string[]> = {
  heart:    ['empathy', 'teamwork'],
  mind:     ['knowledge', 'logic', 'vocabulary'],
  courage:  ['courage', 'persistence'],
  creative: ['creativity', 'curiosity'],
};

/** Reverse lookup: trait → routes that develop it */
export const TRAIT_TO_ROUTES: Record<string, RouteTag[]> = (() => {
  const map: Record<string, RouteTag[]> = {};
  for (const [route, traits] of Object.entries(ROUTE_TO_TRAITS)) {
    for (const t of traits) {
      (map[t] ??= []).push(route as RouteTag);
    }
  }
  return map;
})();

/** Route display metadata (German labels + colors + icons) */
export const ROUTE_META: Record<RouteTag, { label: string; icon: string; color: string }> = {
  heart:    { label: 'Herz',    icon: '❤️', color: '#f56b9b' },
  mind:     { label: 'Wissen',  icon: '🧠', color: '#4f8cf5' },
  courage:  { label: 'Mut',     icon: '🛡️', color: '#f5a623' },
  creative: { label: 'Kreativ', icon: '🎨', color: '#9b5ef5' },
};
