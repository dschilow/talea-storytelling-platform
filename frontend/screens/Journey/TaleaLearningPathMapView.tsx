/**
 * TaleaLearningPathMapView.tsx
 * Game-style learning path map – vertically scrollable.
 *
 * Architecture: scrollable container with absolute-positioned nodes.
 * Components extracted into GameMapNode, GameMapEdge, MapBackground.
 * Segments generated dynamically from user's real backend data (dokus, stories, memories).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import GameMapNode from './components/GameMapNode';
import GameMapEdge from './components/GameMapEdge';
import MapBackground from './components/MapBackground';
import TaleaMapNodeSheet from './TaleaMapNodeSheet';
import { getTraitIcon, getTraitLabel } from '../../constants/traits';

// ─── Segment Label ──────────────────────────────────────────────────────────

const segLabelVariant = {
  hidden: { opacity: 0, y: -18, scale: 0.86 },
  show: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: 'spring' as const, stiffness: 260, damping: 22 },
  },
};

// ─── Component ──────────────────────────────────────────────────────────────

const TaleaLearningPathMapView: React.FC = () => {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const reduceMotion = useReducedMotion() ?? false;

  const { progress } = useLearningPathProgress();
  const avatarTraits = useAvatarTraitsForMap();
  const [selected, setSelected] = useState<FlatNode | null>(null);
  const [heuteMode, setHeuteMode] = useState(false);
  const [showKapitel, setShowKapitel] = useState(false);
  const lastActiveRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const mapContentRef = useRef<HTMLDivElement | null>(null);
  const endOfMapRef = useRef<HTMLDivElement | null>(null);

  // ── Infinite scroll: visible segment count ──
  const [visibleSegmentCount, setVisibleSegmentCount] = useState(6);

  // ── Dynamic segment generation from backend data ──
  const { segments, backendDoneNodeIds, loading: segmentsLoading } = useMapSegmentGenerator(
    avatarTraits.avatarId ?? null,
    visibleSegmentCount,
  );

  // ── Merge localStorage progress with backend-derived done IDs ──
  const mergedProgress = useMemo(
    () => mergeBackendDoneIds(progress, backendDoneNodeIds),
    [progress, backendDoneNodeIds],
  );

  // ── Zoom state: scale + transform-origin for zoom-to-node effect ──
  const [zoomState, setZoomState] = useState<{
    scale: number;
    originX: string;
    originY: string;
  }>({ scale: 1, originX: '50%', originY: '50%' });

  // Fallback "heute" node IDs from segment data
  const seedHeuteIds = useMemo(() => {
    const ids = new Set<string>();
    for (const seg of segments) {
      if (seg.recommendedDailyStops) seg.recommendedDailyStops.forEach(id => ids.add(id));
    }
    return ids;
  }, [segments]);

  // Transform segments + merged progress into flat data
  const { flatNodes, flatEdges, segmentLabels, mapHeight } = useMapFlowData(
    segments,
    mergedProgress,
    seedHeuteIds,
    avatarTraits.loading ? undefined : avatarTraits.byId,
  );

  // Smart daily recommendations: use trait-based when available, else seed fallback
  const smartHeuteIds = useDailyRecommendations(flatNodes, avatarTraits.byId);
  const heuteNodeIds = !avatarTraits.loading && Object.keys(avatarTraits.byId).length > 0
    ? smartHeuteIds
    : seedHeuteIds;

  // ── Infinite scroll observer ──
  useEffect(() => {
    const el = endOfMapRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleSegmentCount(prev => prev + 4);
        }
      },
      { rootMargin: '400px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mapHeight]); // re-attach when map grows

  // "Zu mir" – scroll to active/first-available node
  const scrollToActive = useCallback(() => {
    if (lastActiveRef.current) {
      lastActiveRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      const firstAvail = flatNodes.find(f => f.state === 'available');
      if (firstAvail && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: Math.max(0, firstAvail.mapY - window.innerHeight / 2),
          behavior: 'smooth',
        });
      }
    }
  }, [flatNodes]);

  // Auto-scroll to active on mount
  useEffect(() => {
    const t = setTimeout(scrollToActive, 600);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasActive = !!mergedProgress.lastActiveNodeId;

  // ── Node click: zoom to node + open sheet ────────────────────────────────
  const handleNodeClick = useCallback((flat: FlatNode) => {
    const isDeselect = selected?.node.nodeId === flat.node.nodeId;
    if (isDeselect) {
      setSelected(null);
      setZoomState({ scale: 1, originX: '50%', originY: '50%' });
      return;
    }

    // Zoom into the clicked node
    setSelected(flat);
    setZoomState({
      scale: 1.35,
      originX: `${flat.xPercent}%`,
      originY: `${flat.mapY}px`,
    });

    // Scroll the node into view (center)
    if (scrollContainerRef.current) {
      const containerH = scrollContainerRef.current.clientHeight;
      scrollContainerRef.current.scrollTo({
        top: Math.max(0, flat.mapY * 1.35 - containerH / 2),
        behavior: 'smooth',
      });
    }
  }, [selected]);

  // Reset zoom when sheet is closed
  const handleSheetClose = useCallback(() => {
    setSelected(null);
    setZoomState({ scale: 1, originX: '50%', originY: '50%' });
  }, []);

  // ── Kapitel scroll ────────────────────────────────────────────────────────
  const scrollToSegment = useCallback((segIdx: number) => {
    const first = flatNodes.find(f => f.segmentIndex === segIdx);
    if (first && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: Math.max(0, first.mapY - 200),
        behavior: 'smooth',
      });
    }
  }, [flatNodes]);

  return (
    <div className="flex min-h-screen flex-col" style={{ background: isDark ? '#0d1521' : '#ede5d4' }}>

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3"
        style={{
          borderColor: isDark ? '#1e3148' : '#d8cbb8',
          background: isDark ? 'rgba(10,17,28,0.92)' : 'rgba(253,247,238,0.94)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <motion.button
          type="button"
          onClick={() => navigate(-1)}
          whileHover={{ scale: 1.10, rotate: -4 }}
          whileTap={{ scale: 0.88 }}
          className="flex h-9 w-9 items-center justify-center rounded-full border"
          style={{ borderColor: isDark ? '#2e4a64' : '#c0b0a0', color: isDark ? '#b0c8e4' : '#5a6a7a' }}
          aria-label="Zurück"
        >
          <ArrowLeft className="h-4 w-4" />
        </motion.button>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: isDark ? '#3a6a8a' : '#8a9aaa' }}>
            {avatarTraits.avatarName ?? 'Talea'}
          </p>
          <h1 className="text-lg font-black leading-none tracking-tight" style={{ color: isDark ? '#e8f2ff' : '#1a2a3a' }}>
            Reise-Karte
          </h1>
        </div>

        {/* Loading indicator */}
        {segmentsLoading && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="h-4 w-4" style={{ color: isDark ? '#4a7a9a' : '#8a9aaa' }} />
          </motion.div>
        )}

        {/* "Zu mir" */}
        <motion.button
          type="button"
          onClick={scrollToActive}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scaleX: 1.14, scaleY: 0.86 }}
          animate={hasActive && !reduceMotion
            ? { boxShadow: [
                '0 0 0 0px rgba(80,160,255,0.0)',
                '0 0 0 7px rgba(80,160,255,0.30)',
                '0 0 0 0px rgba(80,160,255,0.0)',
              ] }
            : {}}
          transition={hasActive && !reduceMotion ? { duration: 2.6, repeat: Infinity } : {}}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold"
          style={{
            borderColor: isDark ? '#2e4a64' : '#c0b0a0',
            color: isDark ? '#88b8e0' : '#3a6a88',
            background: isDark ? 'rgba(20,36,56,0.65)' : 'rgba(255,252,246,0.85)',
          }}
        >
          <MapPin className="h-3.5 w-3.5" />
          Zu mir
        </motion.button>

        {/* Heute */}
        <motion.button
          type="button"
          onClick={() => setHeuteMode(m => !m)}
          whileTap={{ scale: 0.9 }}
          className="flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold"
          style={{
            borderColor: heuteMode ? '#f5a623' : (isDark ? '#2e4a64' : '#c0b0a0'),
            color: heuteMode ? '#f5a623' : (isDark ? '#88b8e0' : '#3a6a88'),
            background: heuteMode
              ? (isDark ? 'rgba(245,166,35,0.15)' : 'rgba(245,166,35,0.12)')
              : (isDark ? 'rgba(20,36,56,0.65)' : 'rgba(255,252,246,0.85)'),
          }}
        >
          <Sun className="h-3.5 w-3.5" />
          Heute
        </motion.button>

        {/* Kapitel */}
        <motion.button
          type="button"
          onClick={() => setShowKapitel(true)}
          whileTap={{ scale: 0.9 }}
          className="flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold"
          style={{
            borderColor: isDark ? '#2e4a64' : '#c0b0a0',
            color: isDark ? '#88b8e0' : '#3a6a88',
            background: isDark ? 'rgba(20,36,56,0.65)' : 'rgba(255,252,246,0.85)',
          }}
        >
          <List className="h-3.5 w-3.5" />
        </motion.button>
      </header>

      {/* ── Scrollable Map ── */}
      <div
        ref={scrollContainerRef}
        className="relative flex-1 overflow-y-auto overflow-x-hidden"
        style={{ minHeight: 'calc(100vh - 56px)', backgroundColor: isDark ? '#111a28' : '#e4dac8' }}
      >
        <motion.div
          ref={mapContentRef}
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
          {/* Background: tiles, overlay, particles, road */}
          <MapBackground mapHeight={mapHeight} isDark={isDark} />

          {/* Edge SVG overlay */}
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

          {/* Segment Labels (with trait progress) */}
          {segmentLabels.map((seg) => (
            <motion.div
              key={`lbl-${seg.segmentId}`}
              className="pointer-events-none absolute left-0 right-0 flex flex-col items-center gap-1 px-6"
              style={{ top: `${seg.y}px`, zIndex: 3 }}
              variants={segLabelVariant}
              initial="hidden"
              animate="show"
            >
              <div className="flex w-full items-center gap-3">
                <div className="h-px flex-1 opacity-20" style={{ background: isDark ? '#5a8ab0' : '#9a8878' }} />
                <motion.span
                  className="rounded-full border px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.16em]"
                  style={{
                    borderColor: isDark ? '#243a54' : '#c0a888',
                    color: isDark ? '#6aaad2' : '#6a5a48',
                    background: isDark ? 'rgba(8,18,32,0.88)' : 'rgba(252,246,236,0.92)',
                    backdropFilter: 'blur(10px)',
                    boxShadow: isDark
                      ? '0 3px 14px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)'
                      : '0 2px 10px rgba(0,0,0,0.10)',
                  }}
                  whileHover={{ scale: 1.04 }}
                >
                  {seg.title}
                </motion.span>
                <div className="h-px flex-1 opacity-20" style={{ background: isDark ? '#5a8ab0' : '#9a8878' }} />
              </div>

              {/* Trait progress pill below segment title */}
              {seg.dominantTraitId && !avatarTraits.loading && (
                <span
                  className="rounded-full border px-2.5 py-0.5 text-[9px] font-bold"
                  style={{
                    borderColor: isDark ? '#1c3050' : '#d5c5b0',
                    color: isDark ? '#8aa8c8' : '#5a7080',
                    background: isDark ? 'rgba(14,24,40,0.8)' : 'rgba(255,254,250,0.85)',
                  }}
                >
                  {getTraitIcon(seg.dominantTraitId)} {getTraitLabel(seg.dominantTraitId, 'de')}: {seg.dominantTraitValue ?? 0} Pkt
                </span>
              )}
            </motion.div>
          ))}

          {/* Nodes */}
          {flatNodes.map((flat) => {
            const isSel = selected?.node.nodeId === flat.node.nodeId;
            const isLastAct = mergedProgress.lastActiveNodeId === flat.node.nodeId;

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
                onClick={() => flat.state !== 'locked' && handleNodeClick(flat)}
              />
            );
          })}

          {/* End-of-map sentinel (infinite scroll trigger) */}
          <div
            ref={endOfMapRef}
            className="absolute flex w-full items-center justify-center"
            style={{ top: `${mapHeight - 100}px`, zIndex: 5 }}
          >
            <motion.span
              className="flex items-center gap-2 rounded-full border px-5 py-2.5 text-xs font-bold"
              style={{
                borderColor: isDark ? '#1c3050' : '#c0a888',
                color: isDark ? '#426888' : '#7a6858',
                background: isDark ? 'rgba(8,16,28,0.84)' : 'rgba(252,246,236,0.90)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 4px 18px rgba(0,0,0,0.22)',
              }}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.7, ease: 'easeOut' }}
            >
              <motion.span
                animate={!reduceMotion ? { y: [0, -5, 0] } : {}}
                transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-3.5 w-3.5 opacity-50" />
                Scrolle weiter für neue Abenteuer…
              </motion.span>
            </motion.span>
          </div>
        </motion.div>
      </div>

      {/* ── Kapitel Overlay ── */}
      <AnimatePresence>
        {showKapitel && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/40"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowKapitel(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-3xl border-t px-5 pb-8 pt-4 shadow-2xl"
              style={{
                background: isDark ? 'rgba(15,24,38,0.97)' : 'rgba(255,252,246,0.98)',
                borderColor: isDark ? '#2a3d52' : '#e0d1bf',
              }}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: isDark ? '#3a5068' : '#d5bfae' }} />
              <h3 className="mb-4 text-lg font-black" style={{ color: isDark ? '#e8f0fb' : '#1e2a3a' }}>
                Kapitel
              </h3>
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
                      className="flex w-full items-center gap-3 rounded-2xl border p-4 text-left"
                      style={{
                        borderColor: isDark ? '#2a3d52' : '#e0d1bf',
                        background: isDark ? 'rgba(20,32,48,0.6)' : 'rgba(255,252,246,0.8)',
                      }}
                      whileHover={{ scale: 1.015 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                        <svg width="48" height="48" viewBox="0 0 48 48">
                          <circle cx="24" cy="24" r="20" fill="none" stroke={isDark ? '#1c3050' : '#e0d1bf'} strokeWidth="3" />
                          <circle cx="24" cy="24" r="20" fill="none"
                            stroke={pct === 100 ? '#22c99a' : '#4f8cf5'} strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray={`${(pct / 100) * 125.6} 125.6`}
                            transform="rotate(-90 24 24)" />
                        </svg>
                        <span className="absolute text-[10px] font-black" style={{ color: isDark ? '#a0c0e0' : '#4a6a80' }}>{pct}%</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold" style={{ color: isDark ? '#e0eaf8' : '#1e2a3a' }}>{seg.title}</p>
                        <p className="text-[11px]" style={{ color: isDark ? '#7a9bbf' : '#7a8a9a' }}>
                          {seg.doneCount}/{seg.totalCount} Stationen
                        </p>
                      </div>
                      {pct === 100
                        ? <Trophy className="h-5 w-5 shrink-0 text-[#22c99a]" />
                        : <ChevronRight className="h-5 w-5 shrink-0" style={{ color: isDark ? '#4a6a88' : '#aabac8' }} />}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Node Bottom Sheet ── */}
      <AnimatePresence>
        {selected && (
          <TaleaMapNodeSheet
            key="node-sheet"
            node={selected.node}
            state={selected.state}
            isDark={isDark}
            onClose={handleSheetClose}
            traitValues={avatarTraits.loading ? undefined : avatarTraits.byId}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default TaleaLearningPathMapView;
