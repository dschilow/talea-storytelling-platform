/**
 * TaleaLearningPathMapView.tsx
 * Game-style learning path map with zoom/pan via React Flow.
 *
 * Uses custom GameMapNode + GameMapEdge components for game visuals.
 * Background layer (landscape tiles, road, particles) rendered
 * inside React Flow viewport so everything zooms/pans together.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  useReactFlow,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft, ChevronRight, List, MapPin, Sun, Trophy,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { SEED_SEGMENTS } from './TaleaLearningPathSeedData';
import { useLearningPathProgress } from './TaleaLearningPathProgressStore';
import type { MapNode, NodeState } from './TaleaLearningPathTypes';
import { useMapFlowData, type GameFlowNode } from './hooks/useMapFlowData';
import GameMapNode from './components/GameMapNode';
import GameMapEdge from './components/GameMapEdge';
import MapBackground from './components/MapBackground';
import TaleaMapNodeSheet from './TaleaMapNodeSheet';

// ─── React Flow node/edge type maps (stable reference) ─────────────────────

const nodeTypes = { gameNode: GameMapNode };
const edgeTypes = { gamePath: GameMapEdge };

// ─── MiniMap node color ─────────────────────────────────────────────────────

function miniMapNodeColor(node: GameFlowNode): string {
  const state = node.data?.state;
  if (state === 'done') return '#22c99a';
  if (state === 'available') return '#4f8cf5';
  return '#3a4a5a';
}

// ─── Inner component (needs ReactFlowProvider above) ────────────────────────

const MapInner: React.FC = () => {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const reduceMotion = useReducedMotion() ?? false;
  const { setCenter, fitView } = useReactFlow();

  const { progress } = useLearningPathProgress();
  const [selected, setSelected] = useState<{ node: MapNode; state: NodeState } | null>(null);
  const [heuteMode, setHeuteMode] = useState(false);
  const [showKapitel, setShowKapitel] = useState(false);

  // Compute "heute" node IDs
  const heuteNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (heuteMode) {
      for (const seg of SEED_SEGMENTS) {
        seg.recommendedDailyStops?.forEach(id => ids.add(id));
      }
    }
    return ids;
  }, [heuteMode]);

  // Transform segments + progress into React Flow data
  const { nodes, edges, segmentLabels, mapHeight } = useMapFlowData(
    SEED_SEGMENTS,
    progress,
    heuteNodeIds,
  );

  // Node click handler
  const onNodeClick: NodeMouseHandler<GameFlowNode> = useCallback((_event, node) => {
    const { mapNode, state } = node.data;
    if (state === 'locked') return;
    setSelected({ node: mapNode, state });
  }, []);

  // "Zu mir" - fly camera to active or first available node
  const scrollToActive = useCallback(() => {
    const activeNode = nodes.find(n => n.data.isLastActive);
    const target = activeNode ?? nodes.find(n => n.data.state === 'available');
    if (target) {
      setCenter(target.position.x + 44, target.position.y + 44, { duration: 800, zoom: 1.2 });
    } else {
      fitView({ duration: 600 });
    }
  }, [nodes, setCenter, fitView]);

  // Auto-fly to active on mount
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      const t = setTimeout(scrollToActive, 600);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasActive = !!progress.lastActiveNodeId;

  // Kapitel scroll handler
  const scrollToSegment = useCallback((segmentIndex: number) => {
    const firstNode = nodes.find(n => n.data.segmentIndex === segmentIndex);
    if (firstNode) {
      setCenter(firstNode.position.x + 44, firstNode.position.y + 44, { duration: 600, zoom: 0.9 });
    }
  }, [nodes, setCenter]);

  return (
    <div className="flex h-screen flex-col" style={{ background: isDark ? '#0d1521' : '#ede5d4' }}>
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
            Talea
          </p>
          <h1 className="text-lg font-black leading-none tracking-tight" style={{ color: isDark ? '#e8f2ff' : '#1a2a3a' }}>
            Reise-Karte
          </h1>
        </div>

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

      {/* ── React Flow Canvas ── */}
      <div className="relative flex-1" style={{ backgroundColor: isDark ? '#111a28' : '#e4dac8' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
          minZoom={0.15}
          maxZoom={2.5}
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          zoomOnDoubleClick
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
          style={{ background: 'transparent' }}
        >
          {/* Background layer inside React Flow viewport */}
          <MapBackground mapHeight={mapHeight} segmentLabels={segmentLabels} />

          {/* MiniMap */}
          <MiniMap
            nodeColor={miniMapNodeColor}
            maskColor={isDark ? 'rgba(8,14,24,0.85)' : 'rgba(228,218,200,0.85)'}
            style={{
              border: `1px solid ${isDark ? '#1e3148' : '#d8cbb8'}`,
              borderRadius: '12px',
              overflow: 'hidden',
              background: isDark ? 'rgba(15,24,38,0.92)' : 'rgba(255,252,246,0.92)',
            }}
            pannable
            zoomable
          />
        </ReactFlow>
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
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Wrapper with Provider ──────────────────────────────────────────────────

const TaleaLearningPathMapView: React.FC = () => (
  <ReactFlowProvider>
    <MapInner />
  </ReactFlowProvider>
);

export default TaleaLearningPathMapView;
