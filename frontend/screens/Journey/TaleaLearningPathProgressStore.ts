/**
 * TaleaLearningPathProgressStore.ts  –  Phase A/D
 * Lokaler Progress-Store (localStorage), reaktiv via React-Hook.
 */
import { useState, useCallback, useEffect } from 'react';
import type { ProgressState } from './TaleaLearningPathTypes';

const KEY = 'talea.learningPathProgress.v1';

const DEFAULT: ProgressState = {
  doneNodeIds: [],
  inventoryArtifacts: [],
  stampsByTag: {},
  lastActiveNodeId: null,
  dailySuggestedNodeIds: [],
  quizResultsById: {},
};

function load(): ProgressState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
  } catch { return DEFAULT; }
}
function save(p: ProgressState) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* quota */ }
}

export function useLearningPathProgress() {
  const [progress, setProgress] = useState<ProgressState>(load);

  const update = useCallback((fn: (p: ProgressState) => ProgressState) => {
    setProgress((prev) => { const next = fn(prev); save(next); return next; });
  }, []);

  const markNodeDone = useCallback((nodeId: string) => {
    update((p) => ({
      ...p,
      doneNodeIds: p.doneNodeIds.includes(nodeId) ? p.doneNodeIds : [...p.doneNodeIds, nodeId],
      lastActiveNodeId: nodeId,
    }));
  }, [update]);

  const awardArtifact = useCallback((artifactId: string, rarity: 'common' | 'rare' | 'epic') => {
    update((p) => ({
      ...p,
      inventoryArtifacts: p.inventoryArtifacts.some((a) => a.id === artifactId)
        ? p.inventoryArtifacts
        : [...p.inventoryArtifacts, { id: artifactId, rarity }],
    }));
  }, [update]);

  const recordQuizResult = useCallback((quizId: string, correctCount: number, totalCount: number) => {
    update((p) => ({ ...p, quizResultsById: { ...p.quizResultsById, [quizId]: { correctCount, totalCount } } }));
  }, [update]);

  const resetProgress = useCallback(() => update(() => DEFAULT), [update]);

  // Externe Events ankoppeln (Phase D Vorbereitung)
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ nodeId?: string; artifactId?: string; rarity?: 'common'|'rare'|'epic'; quizId?: string; correctCount?: number; totalCount?: number }>;
      if (ev.detail?.nodeId) markNodeDone(ev.detail.nodeId);
      if (ev.detail?.artifactId && ev.detail?.rarity) awardArtifact(ev.detail.artifactId, ev.detail.rarity);
      if (ev.detail?.quizId && ev.detail?.correctCount != null)
        recordQuizResult(ev.detail.quizId, ev.detail.correctCount, ev.detail.totalCount ?? 0);
    };
    window.addEventListener('talea:mapProgress', handler as EventListener);
    return () => window.removeEventListener('talea:mapProgress', handler as EventListener);
  }, [markNodeDone, awardArtifact, recordQuizResult]);

  return { progress, markNodeDone, awardArtifact, recordQuizResult, resetProgress, updateProgress: update };
}

