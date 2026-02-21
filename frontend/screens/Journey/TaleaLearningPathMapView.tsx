/**
 * TaleaLearningPathMapView.tsx
 * Game-style learning path map - vertically scrollable.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft, ChevronRight, List, Loader2, MapPin, Sparkles, Sun, Trophy,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLearningPathProgress, mergeBackendDoneIds } from './TaleaLearningPathProgressStore';
import { useMapFlowData, type FlatNode } from './hooks/useMapFlowData';
import { useMapSegmentGenerator } from './hooks/useMapSegmentGenerator';
import { useAvatarTraitsForMap } from './hooks/useAvatarTraitsForMap';
import { useDailyRecommendations } from './hooks/useDailyRecommendations';
import type { MapNode, MapSegment } from './TaleaLearningPathTypes';
import GameMapNode from './components/GameMapNode';
import GameMapEdge from './components/GameMapEdge';
import MapBackground from './components/MapBackground';
import TaleaMapNodeSheet from './TaleaMapNodeSheet';
import { getTraitIcon, getTraitLabel } from '../../constants/traits';
import { ROUTE_TO_TRAITS } from './constants/routeTraitMapping';
import { getNextRankProgress } from '../../utils/TaleaProgressionUtils';
import TaleaChestReward from './components/TaleaChestReward';
import type { MapProgressEventDetail } from './TaleaLearningPathProgressStore';

const segLabelVariant = {
  hidden: { opacity: 0, y: -18, scale: 0.86 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 260, damping: 22 },
  },
};

function filterSegmentsByForkChoices(
  segments: MapSegment[],
  forkSelectionsByNodeId: Record<string, { nextSegmentId: string }>,
): MapSegment[] {
  if (segments.length <= 1) return segments;

  const byId = new Map(segments.map((s) => [s.segmentId, s]));
  const sorted = [...segments].sort((a, b) => a.index - b.index);
  const visited = new Set<string>();
  const result: MapSegment[] = [];

  let current: MapSegment | undefined = sorted[0];

  while (current && !visited.has(current.segmentId)) {
    visited.add(current.segmentId);
    result.push(current);

    const forkNode: MapNode | undefined = current.nodes.find((n) => n.type === 'Fork' && n.action.type === 'fork');
    const chosenNext: string | undefined = forkNode
      ? forkSelectionsByNodeId[forkNode.nodeId]?.nextSegmentId
      : undefined;
    const chosenSegment: MapSegment | undefined = chosenNext ? byId.get(chosenNext) : undefined;

    if (chosenNext) {
      if (chosenSegment && !visited.has(chosenSegment.segmentId)) {
        current = chosenSegment;
        continue;
      }
      break;
    }

    const currentIndex: number = current.index;
    current = sorted.find((s) => !visited.has(s.segmentId) && s.index > currentIndex);
  }

  return result;
}

const TaleaLearningPathMapView: React.FC = () => {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const reduceMotion = useReducedMotion() ?? false;
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeReward, setActiveReward] = useState<{ id: string; rarity: 'common' | 'rare' | 'epic' } | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<MapProgressEventDetail>;
      if (ev.detail.artifactId && ev.detail.rarity) {
        setActiveReward({ id: ev.detail.artifactId, rarity: ev.detail.rarity });
      }
    };
    window.addEventListener('talea:mapProgress', handler as EventListener);
    return () => window.removeEventListener('talea:mapProgress', handler as EventListener);
  }, []);

  const avatarIdParam = searchParams.get('avatarId');
  const avatarTraits = useAvatarTraitsForMap(avatarIdParam);
  const { progress } = useLearningPathProgress(avatarTraits.avatarId);

  const [selected, setSelected] = useState<FlatNode | null>(null);
  const [heuteMode, setHeuteMode] = useState(false);
  const [showKapitel, setShowKapitel] = useState(false);
  const lastActiveRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const endOfMapRef = useRef<HTMLDivElement | null>(null);

  const [visibleSegmentCount, setVisibleSegmentCount] = useState(6);

  useEffect(() => {
    if (avatarIdParam || !avatarTraits.avatarId) return;
    const next = new URLSearchParams(searchParams);
    next.set('avatarId', avatarTraits.avatarId);
    setSearchParams(next, { replace: true });
  }, [avatarIdParam, avatarTraits.avatarId, searchParams, setSearchParams]);

  const {
    segments: rawSegments,
    backendDoneNodeIds,
    loading: segmentsLoading,
  } = useMapSegmentGenerator(avatarTraits.avatarId ?? null, visibleSegmentCount);

  const mergedProgress = useMemo(
    () => mergeBackendDoneIds(progress, backendDoneNodeIds),
    [progress, backendDoneNodeIds],
  );

  const segments = useMemo(
    () => filterSegmentsByForkChoices(rawSegments, mergedProgress.forkSelectionsByNodeId),
    [rawSegments, mergedProgress.forkSelectionsByNodeId],
  );

  const [zoomState, setZoomState] = useState<{
    scale: number;
    originX: string;
    originY: string;
  }>({ scale: 1, originX: '50%', originY: '50%' });

  const seedHeuteIds = useMemo(() => {
    const ids = new Set<string>();
    for (const seg of segments) {
      if (seg.recommendedDailyStops) seg.recommendedDailyStops.forEach((id) => ids.add(id));
    }
    return ids;
  }, [segments]);

  const { flatNodes, flatEdges, segmentLabels, segmentBlocks, mapHeight } = useMapFlowData(
    segments,
    mergedProgress,
    seedHeuteIds,
    avatarTraits.loading ? undefined : avatarTraits.byId,
  );

  const smartHeuteIds = useDailyRecommendations(flatNodes, avatarTraits.byId);
  const heuteNodeIds = !avatarTraits.loading && Object.keys(avatarTraits.byId).length > 0
    ? smartHeuteIds
    : seedHeuteIds;

  const heuteDoneCount = useMemo(() => {
    let count = 0;
    heuteNodeIds.forEach((id) => {
      if (mergedProgress.doneNodeIds.includes(id)) count++;
    });
    return count;
  }, [heuteNodeIds, mergedProgress.doneNodeIds]);

  useEffect(() => {
    const el = endOfMapRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleSegmentCount((prev) => prev + 4);
        }
      },
      { rootMargin: '400px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mapHeight]);

  const scrollToActive = useCallback(() => {
    if (lastActiveRef.current) {
      lastActiveRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const firstAvail = flatNodes.find((f) => f.state === 'available');
    if (firstAvail && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: Math.max(0, firstAvail.mapY - window.innerHeight / 2),
        behavior: 'smooth',
      });
    }
  }, [flatNodes]);

  const [hasInitialScrolled, setHasInitialScrolled] = useState(false);

  useEffect(() => {
    if (!hasInitialScrolled && flatNodes.length > 0) {
      const t = setTimeout(() => {
        scrollToActive();
        setHasInitialScrolled(true);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [hasInitialScrolled, flatNodes.length, scrollToActive]);

  const hasActive = !!mergedProgress.lastActiveNodeId;

  const handleNodeClick = useCallback((flat: FlatNode) => {
    const isDeselect = selected?.node.nodeId === flat.node.nodeId;
    if (isDeselect) {
      setSelected(null);
      setZoomState({ scale: 1, originX: '50%', originY: '50%' });
      return;
    }

    setSelected(flat);
    setZoomState({
      scale: 1.35,
      originX: `${flat.xPercent}%`,
      originY: `${flat.mapY}px`,
    });

    if (scrollContainerRef.current) {
      const containerH = scrollContainerRef.current.clientHeight;
      scrollContainerRef.current.scrollTo({
        top: Math.max(0, flat.mapY - containerH / 2),
        behavior: 'smooth',
      });
    }
  }, [selected]);

  const handleSheetClose = useCallback(() => {
    setSelected(null);
    setZoomState({ scale: 1, originX: '50%', originY: '50%' });
  }, []);

  const scrollToSegment = useCallback((segIdx: number) => {
    const first = flatNodes.find((f) => f.segmentIndex === segIdx);
    if (first && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: Math.max(0, first.mapY - 200),
        behavior: 'smooth',
      });
    }
  }, [flatNodes]);

  return (
    <div className="flex min-h-screen flex-col" style={{ background: isDark ? '#0d1521' : '#ede5d4' }}>
      {/* Premium Header */}
      <header
        className="sticky top-0 z-30 flex flex-col gap-3 border-b px-4 py-4 backdrop-blur-xl"
        style={{
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          background: isDark ? 'rgba(10,20,32,0.85)' : 'rgba(253,247,238,0.92)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button
              type="button"
              onClick={() => navigate(-1)}
              whileHover={{ scale: 1.10, rotate: -4 }}
              whileTap={{ scale: 0.88 }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border"
              style={{
                borderColor: isDark ? '#2e4a64' : '#c0b0a0',
                color: isDark ? '#b0c8e4' : '#5a6a7a',
                background: isDark ? 'rgba(30,45,65,0.4)' : 'rgba(255,255,255,0.6)',
              }}
              aria-label="Zuruck"
            >
              <ArrowLeft className="h-4 w-4" />
            </motion.button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-black leading-none tracking-tight" style={{ color: isDark ? '#e8f2ff' : '#1a2a3a' }}>
                Reise-Karte
              </h1>
              <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.18em] opacity-50" style={{ color: isDark ? '#3a6a8a' : '#8a9aaa' }}>
                {avatarTraits.avatarName ?? 'Talea Explorer'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              onClick={() => setHeuteMode((m) => !m)}
              whileTap={{ scale: 0.9 }}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-colors"
              style={{
                borderColor: heuteMode ? '#f5a623' : (isDark ? '#2e4a64' : '#c0b0a0'),
                color: heuteMode ? '#ffffff' : (isDark ? '#88b8e0' : '#3a6a88'),
                background: heuteMode
                  ? '#f5a623'
                  : (isDark ? 'rgba(20,36,56,0.65)' : 'rgba(255,255,255,0.8)'),
              }}
            >
              <Sun className={`h-3.5 w-3.5 ${heuteMode ? 'animate-spin-slow' : ''}`} />
              Heute
            </motion.button>

            <motion.button
              type="button"
              onClick={() => setShowKapitel(true)}
              whileTap={{ scale: 0.9 }}
              className="flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold"
              style={{
                borderColor: isDark ? '#2e4a64' : '#c0b0a0',
                color: isDark ? '#88b8e0' : '#3a6a88',
                background: isDark ? 'rgba(20,36,56,0.65)' : 'rgba(255,255,255,0.8)',
              }}
            >
              <List className="h-3.5 w-3.5" />
            </motion.button>
          </div>
        </div>

        {/* Daily Progress Bar */}
        <div
          className="flex flex-col gap-1.5 rounded-xl border px-3 py-2"
          style={{
            borderColor: isDark ? 'rgba(34,201,154,0.2)' : 'rgba(34,201,154,0.15)',
            background: isDark ? 'rgba(34,201,154,0.06)' : 'rgba(34,201,154,0.03)'
          }}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#22c99a]">
              <Sparkles className="h-3 w-3" /> Deine Route
            </span>
            <span className="text-[10px] font-black text-[#22c99a]">
              {heuteDoneCount} / {Math.max(3, heuteNodeIds.size)} Stationen
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/20">
            <motion.div
              className="h-full bg-[#22c99a] shadow-[0_0_12px_rgba(34,201,154,0.5)]"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (heuteDoneCount / Math.max(3, heuteNodeIds.size)) * 100)}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </div>
        </div>
      </header>

      <div
        ref={scrollContainerRef}
        className="relative flex-1 overflow-y-auto overflow-x-hidden"
        style={{ minHeight: 'calc(100vh - 120px)', backgroundColor: isDark ? '#0d1521' : '#ede5d4' }}
      >
        <motion.div
          className="relative"
          style={{
            height: `${mapHeight}px`,
            transformOrigin: `${zoomState.originX} ${zoomState.originY}`,
          }}
          initial={{ opacity: 0.3, scale: 0.92 }}
          animate={{ opacity: 1, scale: zoomState.scale }}
          transition={{
            opacity: { duration: 1.1, ease: [0.16, 1, 0.3, 1] },
            scale: { type: 'spring', stiffness: 200, damping: 26 },
          }}
        >
          <MapBackground mapHeight={mapHeight} isDark={isDark} segmentBlocks={segmentBlocks} />

          <svg
            className="pointer-events-none absolute left-0 top-0 w-full"
            height={mapHeight}
            viewBox={`0 0 100 ${mapHeight}`}
            preserveAspectRatio="none"
          >
            {flatEdges.map((edge, ei) => (
              <GameMapEdge
                key={`e-${edge.fromNodeId}-${edge.toNodeId}`}
                fromX={edge.fromX}
                fromY={edge.fromY}
                toX={edge.toX}
                toY={edge.toY}
                edgeState={edge.edgeState}
                isDark={isDark}
                edgeIndex={ei}
              />
            ))}
          </svg>

          {segmentLabels.map((seg) => (
            <motion.div
              key={`lbl-${seg.segmentId}`}
              className="pointer-events-none absolute left-0 right-0 flex flex-col items-center gap-1.5"
              style={{ top: `${seg.y}px`, zIndex: 3 }}
              variants={segLabelVariant}
              initial="hidden"
              animate="show"
            >
              <div className="relative flex w-full max-w-sm flex-col items-center">
                <div
                  className="absolute h-px w-full -translate-y-1/2 opacity-30"
                  style={{ top: '50%', background: `linear-gradient(90deg, transparent, ${isDark ? '#5a8ab0' : '#9a8878'}, transparent)` }}
                />

                <motion.div
                  className="relative flex flex-col items-center rounded-2xl border px-6 py-2 text-center shadow-xl"
                  style={{
                    borderColor: isDark ? '#243a54' : '#c0a888',
                    color: isDark ? '#e0f0ff' : '#4a3a2a',
                    background: isDark ? 'rgba(10,22,38,0.95)' : 'rgba(252,248,242,0.98)',
                    backdropFilter: 'blur(12px)',
                  }}
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="text-[9px] font-black uppercase tracking-[0.25em] opacity-60">
                    Gebiet {seg.index + 1}
                  </span>
                  <h2 className="text-sm font-black tracking-tight">
                    {seg.title}
                  </h2>

                  {seg.dominantTraitId && !avatarTraits.loading && (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold">
                        {getTraitIcon(seg.dominantTraitId)} {getTraitLabel(seg.dominantTraitId, 'de')}
                      </span>
                      <div className="h-3 w-px bg-current opacity-10" />
                      <span className="text-[9px] font-black italic opacity-70">
                        {seg.doneCount} / {seg.totalCount} Fertig
                      </span>
                    </div>
                  )}
                </motion.div>
              </div>
            </motion.div>
          ))}

          {flatNodes.map((flat) => {
            const isSel = selected?.node.nodeId === flat.node.nodeId;
            const isLastAct = mergedProgress.lastActiveNodeId === flat.node.nodeId;

            const routeTraits = ROUTE_TO_TRAITS[flat.node.route] || [];
            const primaryTrait = routeTraits[0];
            const traitVal = (primaryTrait && avatarTraits.byId?.[primaryTrait]) || 0;
            const { progress: rankProg } = getNextRankProgress(traitVal);

            return (
              <GameMapNode
                key={flat.node.nodeId}
                ref={isLastAct ? lastActiveRef : undefined}
                node={flat.node}
                state={flat.state}
                isDark={isDark}
                isLastActive={isLastAct}
                isHeuteHighlighted={heuteMode && heuteNodeIds.has(flat.node.nodeId)}
                isSelected={isSel}
                nodeIndex={flat.nodeIndex}
                mapY={flat.mapY}
                xPercent={flat.xPercent}
                progressToNextRank={rankProg}
                onClick={() => flat.state !== 'locked' && handleNodeClick(flat)}
              />
            );
          })}

          <div
            ref={endOfMapRef}
            className="absolute flex w-full items-center justify-center"
            style={{ top: `${mapHeight - 120}px`, zIndex: 5 }}
          >
            <motion.span
              className="flex items-center gap-2 rounded-full border px-5 py-2.5 text-xs font-bold"
              style={{
                borderColor: isDark ? '#1c3050' : '#c0a888',
                color: isDark ? '#426888' : '#7a6858',
                background: isDark ? 'rgba(8,16,28,0.84)' : 'rgba(252,246,236,0.90)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <Sparkles className="h-3.5 w-3.5 opacity-50" />
              Entdecke mehr...
            </motion.span>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showKapitel && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowKapitel(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-[32px] border-t px-6 pb-12 pt-4 shadow-2xl"
              style={{
                background: isDark ? 'rgba(15,24,38,0.98)' : 'rgba(255,252,246,0.98)',
                borderColor: isDark ? '#2a3d52' : '#e0d1bf',
              }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <div className="mx-auto mb-6 h-1.5 w-12 rounded-full opacity-20" style={{ background: isDark ? '#ffffff' : '#000000' }} />
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-black" style={{ color: isDark ? '#e8f0fb' : '#1e2a3a' }}>
                  Kartenabschnitte
                </h3>
                <Loader2 className={`h-4 w-4 opacity-50 ${segmentsLoading ? 'animate-spin' : 'hidden'}`} />
              </div>

              <div className="space-y-3">
                {segmentLabels.map((seg) => {
                  const pct = seg.totalCount > 0 ? Math.round((seg.doneCount / seg.totalCount) * 100) : 0;
                  return (
                    <motion.button
                      key={seg.segmentId}
                      type="button"
                      onClick={() => {
                        setShowKapitel(false);
                        setTimeout(() => scrollToSegment(seg.index), 350);
                      }}
                      className="flex w-full items-center gap-4 rounded-3xl border p-4 text-left transition-colors"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      }}
                      whileHover={{ scale: 1.01, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
                        <svg width="56" height="56" viewBox="0 0 56 56">
                          <circle cx="28" cy="28" r="24" fill="none" stroke={isDark ? '#1c3050' : '#e0d1bf'} strokeWidth="3.5" />
                          <motion.circle
                            cx="28"
                            cy="28"
                            r="24"
                            fill="none"
                            stroke={pct === 100 ? '#22c99a' : '#4f8cf5'}
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            initial={{ strokeDasharray: "0 150.8" }}
                            animate={{ strokeDasharray: `${(pct / 100) * 150.8} 150.8` }}
                            transition={{ duration: 1, delay: 0.2 }}
                            transform="rotate(-90 28 28)"
                          />
                        </svg>
                        <span className="absolute text-[11px] font-black" style={{ color: isDark ? '#a0c0e0' : '#4a6a80' }}>
                          {pct}%
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-black" style={{ color: isDark ? '#e0eaf8' : '#1e2a3a' }}>{seg.title}</p>
                        <p className="text-xs font-bold opacity-50" style={{ color: isDark ? '#7a9bbf' : '#7a8a9a' }}>
                          {seg.doneCount} von {seg.totalCount} Stationen
                        </p>
                      </div>
                      {pct === 100 && <Trophy className="h-5 w-5 shrink-0 text-[#22c99a]" />}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && (
          <TaleaMapNodeSheet
            key="node-sheet"
            node={selected.node}
            state={selected.state}
            isDark={isDark}
            onClose={handleSheetClose}
            traitValues={avatarTraits.loading ? undefined : avatarTraits.byId}
            avatarId={avatarTraits.avatarId}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeReward && (
          <TaleaChestReward
            artifactId={activeReward.id}
            rarity={activeReward.rarity}
            isDark={isDark}
            onClose={() => setActiveReward(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default TaleaLearningPathMapView;
