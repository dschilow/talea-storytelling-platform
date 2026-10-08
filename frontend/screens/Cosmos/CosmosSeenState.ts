/**
 * CosmosSeenState.ts - Remembers what a child last saw in the Lernkosmos.
 *
 * Comparing the current state with that snapshot tells us which planets grew
 * since the last visit, so the cosmos can fly there and play the growth. It is
 * a per-device convenience only: a lost snapshot just skips one celebration.
 */

import type { CosmosState } from './CosmosTypes';
import { computePlanetEvolution, evoFromPoints, evolutionPointsFor } from './CosmosEvolution';
import { resolveCosmosDomains } from './CosmosAssetsRegistry';

const STORAGE_PREFIX = 'talea.cosmos.seen.v1';
const MAX_CELEBRATIONS = 3;

interface SeenSnapshot {
  savedAt: string;
  domains: Record<string, { points: number; topics: number }>;
}

export interface GrowthEvent {
  domainId: string;
  fromPoints: number;
  toPoints: number;
  fromEvo: number;
  toEvo: number;
  fromStage: number;
  toStage: number;
  fromTopics: number;
  toTopics: number;
}

export function buildSeenKey(childId?: string | null, avatarId?: string | null): string {
  return `${STORAGE_PREFIX}:${childId || 'nochild'}:${avatarId || 'noavatar'}`;
}

export function loadSeenSnapshot(key: string): SeenSnapshot | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SeenSnapshot;
    if (!parsed || typeof parsed !== 'object' || !parsed.domains) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSeenSnapshot(key: string, state: CosmosState): void {
  const domains: SeenSnapshot['domains'] = {};
  for (const progress of state.domains) {
    domains[progress.domainId] = {
      points: evolutionPointsFor(progress),
      topics: Math.max(0, progress.topicsExplored || 0),
    };
  }
  try {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), domains }));
  } catch {
    // Private mode or full storage: the next visit simply celebrates nothing.
  }
}

/**
 * Planets that reached a new stage or got a new topic moon since the snapshot,
 * biggest jumps first.
 */
export function diffGrowth(snapshot: SeenSnapshot, state: CosmosState): GrowthEvent[] {
  const planetTypes = new Map(
    resolveCosmosDomains(state.domains.map((entry) => entry.domainId)).map((domain) => [domain.id, domain.planetType])
  );
  const events: GrowthEvent[] = [];
  for (const progress of state.domains) {
    const before = snapshot.domains[progress.domainId] ?? { points: 0, topics: 0 };
    const now = computePlanetEvolution(progress, planetTypes.get(progress.domainId));
    const toTopics = Math.max(0, progress.topicsExplored || 0);
    const fromEvo = evoFromPoints(before.points);
    const fromStage = Math.floor(fromEvo);
    const grewStage = now.stage > fromStage;
    const newMoon = toTopics > before.topics;
    if (!grewStage && !newMoon) continue;
    events.push({
      domainId: progress.domainId,
      fromPoints: before.points,
      toPoints: now.points,
      fromEvo,
      toEvo: now.evo,
      fromStage,
      toStage: now.stage,
      fromTopics: Math.min(before.topics, toTopics),
      toTopics,
    });
  }
  events.sort(
    (a, b) =>
      b.toStage - b.fromStage - (a.toStage - a.fromStage) ||
      b.toTopics - b.fromTopics - (a.toTopics - a.fromTopics)
  );
  return events.slice(0, MAX_CELEBRATIONS);
}

/** Domains that grew since the last visit (used by the home tile badge). */
export function countUnseenGrowth(key: string, state: CosmosState): number {
  const snapshot = loadSeenSnapshot(key);
  if (!snapshot) return 0;
  return diffGrowth(snapshot, state).length;
}
