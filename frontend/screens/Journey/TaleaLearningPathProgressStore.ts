/**
 * TaleaLearningPathProgressStore.ts
 * Avatar-scoped local progress + event bridge for completion updates.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NodeType, ProgressState } from './TaleaLearningPathTypes';

export type MapProgressSource = 'story' | 'doku' | 'quiz' | 'audio';

export interface MapProgressEventDetail {
  avatarId?: string | null;
  nodeId?: string;
  source?: MapProgressSource;
  artifactId?: string;
  rarity?: 'common' | 'rare' | 'epic';
  quizId?: string;
  correctCount?: number;
  totalCount?: number;
}

const STORAGE_VERSION = 'v2';
const KEY_PREFIX = `talea.learningPathProgress.${STORAGE_VERSION}`;
const GLOBAL_AVATAR_KEY = 'global';

const SOURCE_TO_NODE_TYPES: Record<MapProgressSource, NodeType[]> = {
  story: ['StoryGate'],
  doku: ['DokuStop', 'StudioStage'],
  quiz: ['QuizStop'],
  audio: ['StudioStage'],
};

const DEFAULT: ProgressState = {
  doneNodeIds: [],
  inventoryArtifacts: [],
  stampsByTag: {},
  lastActiveNodeId: null,
  dailySuggestedNodeIds: [],
  quizResultsById: {},
  pendingNodeActions: [],
  forkSelectionsByNodeId: {},
};

const keyForAvatar = (avatarId?: string | null) => `${KEY_PREFIX}.${avatarId ?? GLOBAL_AVATAR_KEY}`;

const ensureUnique = (ids: string[]) => [...new Set(ids.filter(Boolean))];

const normalizeProgress = (raw: Partial<ProgressState> | null | undefined): ProgressState => ({
  ...DEFAULT,
  ...(raw ?? {}),
  doneNodeIds: ensureUnique(raw?.doneNodeIds ?? []),
  inventoryArtifacts: raw?.inventoryArtifacts ?? [],
  dailySuggestedNodeIds: raw?.dailySuggestedNodeIds ?? [],
  quizResultsById: raw?.quizResultsById ?? {},
  pendingNodeActions: raw?.pendingNodeActions ?? [],
  forkSelectionsByNodeId: raw?.forkSelectionsByNodeId ?? {},
});

const loadByKey = (storageKey: string): ProgressState => {
  try {
    const raw = localStorage.getItem(storageKey);
    return normalizeProgress(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT;
  }
};

const saveByKey = (storageKey: string, progress: ProgressState) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(progress));
  } catch {
    // ignore quota / private mode errors
  }
};

export function loadLearningPathProgress(avatarId?: string | null): ProgressState {
  return loadByKey(keyForAvatar(avatarId));
}

export function saveLearningPathProgress(avatarId: string | null | undefined, progress: ProgressState) {
  saveByKey(keyForAvatar(avatarId), normalizeProgress(progress));
}

const markNodeDoneInState = (state: ProgressState, nodeId: string): ProgressState => {
  const done = new Set(state.doneNodeIds);
  done.add(nodeId);
  return {
    ...state,
    doneNodeIds: [...done],
    lastActiveNodeId: nodeId,
    pendingNodeActions: state.pendingNodeActions.filter((p) => p.nodeId !== nodeId),
  };
};

const registerNodeStartInState = (state: ProgressState, nodeId: string, nodeType: NodeType): ProgressState => {
  const pendingWithoutNode = state.pendingNodeActions.filter((entry) => entry.nodeId !== nodeId);
  return {
    ...state,
    lastActiveNodeId: nodeId,
    pendingNodeActions: [
      ...pendingWithoutNode,
      { nodeId, nodeType, startedAt: Date.now() },
    ],
  };
};

const resolveLatestPendingByTypes = (state: ProgressState, nodeTypes: NodeType[]): ProgressState => {
  const candidates = state.pendingNodeActions
    .filter((entry) => nodeTypes.includes(entry.nodeType))
    .sort((a, b) => b.startedAt - a.startedAt);
  const latest = candidates[0];
  if (!latest) return state;
  return markNodeDoneInState(state, latest.nodeId);
};

const applyMapProgressDetail = (state: ProgressState, detail: MapProgressEventDetail): ProgressState => {
  let next = state;

  if (detail.nodeId) {
    next = markNodeDoneInState(next, detail.nodeId);
  } else if (detail.source) {
    next = resolveLatestPendingByTypes(next, SOURCE_TO_NODE_TYPES[detail.source]);
  }

  if (detail.artifactId && detail.rarity) {
    if (!next.inventoryArtifacts.some((a) => a.id === detail.artifactId)) {
      next = {
        ...next,
        inventoryArtifacts: [...next.inventoryArtifacts, { id: detail.artifactId, rarity: detail.rarity }],
      };
    }
  }

  if (detail.quizId && detail.correctCount != null) {
    next = {
      ...next,
      quizResultsById: {
        ...next.quizResultsById,
        [detail.quizId]: { correctCount: detail.correctCount, totalCount: detail.totalCount ?? 0 },
      },
    };
  }

  return next;
};

export function emitMapProgress(detail: MapProgressEventDetail) {
  const targetedAvatarId = detail.avatarId ?? null;
  if (targetedAvatarId) {
    const storageKey = keyForAvatar(targetedAvatarId);
    const current = loadByKey(storageKey);
    const next = applyMapProgressDetail(current, detail);
    saveByKey(storageKey, next);
  } else {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(`${KEY_PREFIX}.`));
    if (keys.length === 0) {
      const storageKey = keyForAvatar(null);
      const current = loadByKey(storageKey);
      const next = applyMapProgressDetail(current, detail);
      saveByKey(storageKey, next);
    } else {
      for (const storageKey of keys) {
        const current = loadByKey(storageKey);
        const next = applyMapProgressDetail(current, detail);
        saveByKey(storageKey, next);
      }
    }
  }
  window.dispatchEvent(new CustomEvent<MapProgressEventDetail>('talea:mapProgress', { detail }));
}

export function useLearningPathProgress(avatarId?: string | null) {
  const storageKey = useMemo(() => keyForAvatar(avatarId), [avatarId]);
  const [progress, setProgress] = useState<ProgressState>(() => loadByKey(storageKey));

  useEffect(() => {
    setProgress(loadByKey(storageKey));
  }, [storageKey]);

  const update = useCallback((fn: (p: ProgressState) => ProgressState) => {
    setProgress((prev) => {
      const next = normalizeProgress(fn(prev));
      saveByKey(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const markNodeDone = useCallback((nodeId: string) => {
    update((p) => markNodeDoneInState(p, nodeId));
  }, [update]);

  const registerNodeStart = useCallback((nodeId: string, nodeType: NodeType) => {
    update((p) => registerNodeStartInState(p, nodeId, nodeType));
  }, [update]);

  const setForkSelection = useCallback((forkNodeId: string, optionId: string, nextSegmentId: string) => {
    update((p) => {
      const withSelection = {
        ...p,
        forkSelectionsByNodeId: {
          ...p.forkSelectionsByNodeId,
          [forkNodeId]: { optionId, nextSegmentId, selectedAt: Date.now() },
        },
      };
      return markNodeDoneInState(withSelection, forkNodeId);
    });
  }, [update]);

  const resolveCompletionBySource = useCallback((source: MapProgressSource) => {
    update((p) => resolveLatestPendingByTypes(p, SOURCE_TO_NODE_TYPES[source]));
  }, [update]);

  const awardArtifact = useCallback((artifactId: string, rarity: 'common' | 'rare' | 'epic') => {
    update((p) => (p.inventoryArtifacts.some((a) => a.id === artifactId)
      ? p
      : { ...p, inventoryArtifacts: [...p.inventoryArtifacts, { id: artifactId, rarity }] }));
  }, [update]);

  const recordQuizResult = useCallback((quizId: string, correctCount: number, totalCount: number) => {
    update((p) => ({
      ...p,
      quizResultsById: { ...p.quizResultsById, [quizId]: { correctCount, totalCount } },
    }));
  }, [update]);

  const resetProgress = useCallback(() => {
    update(() => DEFAULT);
  }, [update]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<MapProgressEventDetail>;
      if (!ev.detail) return;

      // If the event has a concrete avatar target, only apply for the exact same avatar context.
      if (ev.detail.avatarId && ev.detail.avatarId !== avatarId) return;

      setProgress((prev) => {
        const next = applyMapProgressDetail(prev, ev.detail);
        saveByKey(storageKey, next);
        return next;
      });
    };

    window.addEventListener('talea:mapProgress', handler as EventListener);
    return () => window.removeEventListener('talea:mapProgress', handler as EventListener);
  }, [avatarId, storageKey]);

  return {
    progress,
    markNodeDone,
    registerNodeStart,
    setForkSelection,
    resolveCompletionBySource,
    awardArtifact,
    recordQuizResult,
    resetProgress,
    updateProgress: update,
  };
}

/** Merge local avatar progress with backend-derived done IDs (pure function, no storage mutation). */
export function mergeBackendDoneIds(
  localProgress: ProgressState,
  backendDoneIds: Set<string>,
): ProgressState {
  if (backendDoneIds.size === 0) return localProgress;
  const merged = new Set(localProgress.doneNodeIds);
  for (const id of backendDoneIds) merged.add(id);
  if (merged.size === localProgress.doneNodeIds.length) return localProgress;
  return { ...localProgress, doneNodeIds: [...merged] };
}
