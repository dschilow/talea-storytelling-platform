/**
 * useDailyRecommendations.ts
 * Identifies the avatar's weakest traits, maps them to route tags,
 * then selects up to 3 available nodes that develop those traits.
 * Replaces hardcoded `recommendedDailyStops` from seed data.
 */
import { useMemo } from 'react';
import type { RouteTag } from '../TaleaLearningPathTypes';
import type { FlatNode } from './useMapFlowData';
import { TRAIT_TO_ROUTES } from '../constants/routeTraitMapping';

const MAX_RECOMMENDATIONS = 3;

/**
 * Returns a Set of nodeIds recommended for today's session.
 *
 * Strategy:
 * 1. Sort traits by value (ascending) → weakest first
 * 2. Map weakest traits to route tags
 * 3. Pick available (not done, not locked) nodes matching those routes
 * 4. Prefer variety across segments
 */
export function useDailyRecommendations(
  flatNodes: FlatNode[],
  traitValues: Record<string, number>,
): Set<string> {
  return useMemo(() => {
    const ids = new Set<string>();

    // If no trait data, return empty (fallback to seed recommendations)
    const entries = Object.entries(traitValues);
    if (entries.length === 0) return ids;

    // Sort traits by value ascending (weakest first)
    const sorted = [...entries].sort((a, b) => a[1] - b[1]);

    // Build priority route set from weakest traits
    const priorityRoutes: RouteTag[] = [];
    for (const [traitId] of sorted) {
      const routes = TRAIT_TO_ROUTES[traitId];
      if (routes) {
        for (const r of routes) {
          if (!priorityRoutes.includes(r)) priorityRoutes.push(r);
        }
      }
      if (priorityRoutes.length >= 4) break;
    }

    // Available nodes only
    const available = flatNodes.filter(f => f.state === 'available');

    // Pick nodes matching priority routes, preferring different segments
    const usedSegments = new Set<number>();

    for (const route of priorityRoutes) {
      if (ids.size >= MAX_RECOMMENDATIONS) break;

      // Prefer nodes from segments we haven't picked from yet
      const candidates = available
        .filter(f => f.node.route === route && !ids.has(f.node.nodeId))
        .sort((a, b) => {
          const aUsed = usedSegments.has(a.segmentIndex) ? 1 : 0;
          const bUsed = usedSegments.has(b.segmentIndex) ? 1 : 0;
          return aUsed - bUsed;
        });

      if (candidates.length > 0) {
        ids.add(candidates[0].node.nodeId);
        usedSegments.add(candidates[0].segmentIndex);
      }
    }

    // Fill remaining slots with any available nodes not yet picked
    if (ids.size < MAX_RECOMMENDATIONS) {
      for (const f of available) {
        if (ids.size >= MAX_RECOMMENDATIONS) break;
        if (!ids.has(f.node.nodeId)) {
          ids.add(f.node.nodeId);
        }
      }
    }

    return ids;
  }, [flatNodes, traitValues]);
}
