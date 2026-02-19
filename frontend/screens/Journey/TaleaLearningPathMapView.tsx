/**
 * TaleaLearningPathMapView.tsx
 * Phase A – Reise-Karte Screen (/map)
 *
 * Visuelle Sprache 1:1 von AvatarLearningWorldMap:
 *  - Hintergrund: /assets/lernpfad_high.jpg (repeat-y)
 *  - SVG-Straße mit ROAD_POINTS + Bezier (animierter Dash)
 *  - Runde schwebende Buttons: locked / available / done
 *
 * Daten: TaleaLearningPathSeedData + TaleaLearningPathProgressStore
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Flame,
  GitFork,
  Headphones,
  HelpCircle,
  Lock,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { SEED_SEGMENTS, computeNodeStates } from './TaleaLearningPathSeedData';
import { useLearningPathProgress } from './TaleaLearningPathProgressStore';
import type { MapNode, NodeState, NodeType } from './TaleaLearningPathTypes';
import TaleaMapNodeSheet from './TaleaMapNodeSheet';

// ─── Straßen-Punkte (identisch zu AvatarLearningWorldMap) ────────────────────
interface PathPoint { y: number; x: number }

const MAP_TILE_HEIGHT = 3072;

const ROAD_POINTS: PathPoint[] = [
  { y: 0,      x: 65.5  }, { y: 0.0313, x: 49.7  }, { y: 0.0625, x: 52.1  },
  { y: 0.0938, x: 54.99 }, { y: 0.125,  x: 63.22 }, { y: 0.1563, x: 40.2  },
  { y: 0.1875, x: 36.54 }, { y: 0.2188, x: 63.76 }, { y: 0.25,   x: 55.35 },
  { y: 0.2813, x: 32.33 }, { y: 0.3125, x: 46.03 }, { y: 0.3438, x: 45.61 },
  { y: 0.375,  x: 51.32 }, { y: 0.4063, x: 32.51 }, { y: 0.4375, x: 50.0  },
  { y: 0.4688, x: 65.69 }, { y: 0.5,    x: 48.02 }, { y: 0.5313, x: 32.63 },
  { y: 0.5625, x: 50.12 }, { y: 0.5938, x: 65.14 }, { y: 0.625,  x: 51.74 },
  { y: 0.6563, x: 32.63 }, { y: 0.6875, x: 48.62 }, { y: 0.7188, x: 65.5  },
  { y: 0.75,   x: 65.5  }, { y: 0.7813, x: 32.93 }, { y: 0.8125, x: 48.32 },
  { y: 0.8438, x: 34.74 }, { y: 0.875,  x: 58.95 }, { y: 0.9063, x: 36.72 },
  { y: 0.9375, x: 36.72 }, { y: 0.9688, x: 54.57 }, { y: 1,      x: 65.5  },
];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const pathXAtPercent = (pct: number): number => {
  const n = clamp(pct, 0, 1);
  for (let i = 1; i < ROAD_POINTS.length; i++) {
    const l = ROAD_POINTS[i - 1], r = ROAD_POINTS[i];
    if (n <= r.y) {
      const seg = Math.max(0.0001, r.y - l.y);
      const t = clamp((n - l.y) / seg, 0, 1);
      return l.x + (r.x - l.x) * t;
    }
  }
  return ROAD_POINTS[ROAD_POINTS.length - 1].x;
};

const pathXAtY = (y: number): number => {
  const local = ((y % MAP_TILE_HEIGHT) + MAP_TILE_HEIGHT) % MAP_TILE_HEIGHT;
  return pathXAtPercent(local / MAP_TILE_HEIGHT);
};

const buildRoadPath = (mapHeight: number): string => {
  if (mapHeight <= 0) return '';
  const tiles = Math.ceil(mapHeight / MAP_TILE_HEIGHT) + 1;
  let d = '';
  for (let tile = 0; tile < tiles; tile++) {
    const base = tile * MAP_TILE_HEIGHT;
    for (let i = 0; i < ROAD_POINTS.length; i++) {
      const pt = ROAD_POINTS[i];
      const x = pt.x;
      const y = base + pt.y * MAP_TILE_HEIGHT;
      if (i === 0 && tile === 0) { d += `M ${x} ${y}`; continue; }
      const prev = ROAD_POINTS[i > 0 ? i - 1 : ROAD_POINTS.length - 1];
      const prevBase = i === 0 ? (tile - 1) * MAP_TILE_HEIGHT : base;
      const py = prevBase + prev.y * MAP_TILE_HEIGHT;
      const dy = y - py;
      d += ` C ${prev.x} ${py + dy * 0.45}, ${x} ${y - dy * 0.45}, ${x} ${y}`;
    }
  }
  return d;
};

// ─── Icon / Farbe / Label je Node-Typ ────────────────────────────────────────
const NODE_ICON: Record<NodeType, React.ElementType> = {
  DokuStop:    BookOpen,
  QuizStop:    HelpCircle,
  StoryGate:   Sparkles,
  StudioStage: Headphones,
  MemoryFire:  Flame,
  Fork:        GitFork,
};
const NODE_COLOR: Record<NodeType, string> = {
  DokuStop:    '#4f8cf5',
  QuizStop:    '#9b5ef5',
  StoryGate:   '#f56b9b',
  StudioStage: '#22c99a',
  MemoryFire:  '#f5a623',
  Fork:        '#5eb8f5',
};
const NODE_LABEL: Record<NodeType, string> = {
  DokuStop:    'Doku',
  QuizStop:    'Quiz',
  StoryGate:   'Story',
  StudioStage: 'Audio',
  MemoryFire:  'Feuer',
  Fork:        'Weg',
};

// ─── Flach-Node mit absoluter Map-Y-Position ──────────────────────────────────
interface FlatNode {
  node: MapNode;
  state: NodeState;
  segmentTitle: string;
  segmentIndex: number;
  mapY: number;
}

const NODE_SPACING = 190;    // px zwischen Nodes
const SEGMENT_GAP  = 240;    // px Abstand zwischen Segmenten
const TOP_OFFSET   = 140;    // px Abstand oben

// ─── Komponente ──────────────────────────────────────────────────────────────
const TaleaLearningPathMapView: React.FC = () => {
  const navigate   = useNavigate();
  const { resolvedTheme } = useTheme();
  const isDark     = resolvedTheme === 'dark';
  const reduceMotion = useReducedMotion();

  const { progress } = useLearningPathProgress();
  const [selected, setSelected] = useState<FlatNode | null>(null);
  const lastActiveRef = useRef<HTMLDivElement | null>(null);

  // ── Flache Node-Liste aller Segmente ──────────────────────────────────────
  const flatNodes = useMemo<FlatNode[]>(() => {
    const result: FlatNode[] = [];
    let y = TOP_OFFSET;
    for (const seg of SEED_SEGMENTS) {
      const { nodesWithState } = computeNodeStates(seg, progress);
      for (const { node, state } of nodesWithState) {
        result.push({ node, state, segmentTitle: seg.title, segmentIndex: seg.index, mapY: y });
        y += NODE_SPACING;
      }
      y += SEGMENT_GAP;
    }
    return result;
  }, [progress]);

  const mapHeight = Math.max(
    (flatNodes[flatNodes.length - 1]?.mapY ?? TOP_OFFSET) + 320,
    MAP_TILE_HEIGHT,
  );
  const roadPath = useMemo(() => buildRoadPath(mapHeight), [mapHeight]);

  // Scroll zu lastActiveNode
  const scrollToActive = useCallback(() => {
    lastActiveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);
  useEffect(() => {
    const t = setTimeout(scrollToActive, 500);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-screen flex-col" style={{ background: isDark ? '#121c2b' : '#f4ede2' }}>

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 backdrop-blur-xl"
        style={{
          borderColor: isDark ? '#2a3d52' : '#e0d1bf',
          background:  isDark ? 'rgba(14,22,36,0.88)' : 'rgba(253,248,240,0.92)',
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border"
          style={{ borderColor: isDark ? '#3a5068' : '#d5bfae', color: isDark ? '#c8d8ec' : '#5a6a7a' }}
          aria-label="Zurück"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: isDark ? '#7a9bbf' : '#8a9aaa' }}>
            Talea
          </p>
          <h1 className="text-lg font-bold leading-none" style={{ color: isDark ? '#e8f0fb' : '#1e2a3a' }}>
            Reise-Karte
          </h1>
        </div>

        <button
          type="button"
          onClick={scrollToActive}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-semibold"
          style={{ borderColor: isDark ? '#3a5068' : '#d5bfae', color: isDark ? '#a8c4e0' : '#4a6a80' }}
        >
          <MapPin className="h-3.5 w-3.5" />
          Zu mir
        </button>
      </header>

      {/* ── Karte ── */}
      <div
        className="relative overflow-y-auto flex-1"
        style={{ minHeight: 'calc(100vh - 56px)', backgroundColor: isDark ? '#1a2a3f' : '#edf2df' }}
      >
        <div className="relative" style={{ height: `${mapHeight}px` }}>

          {/* Hintergrundbild */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: "url('/assets/lernpfad_high.jpg')",
              backgroundRepeat: 'repeat-y',
              backgroundSize: `100% ${MAP_TILE_HEIGHT}px`,
              backgroundPosition: 'center top',
            }}
          />
          {/* Overlay */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: isDark ? 'rgba(13,22,35,0.42)' : 'rgba(255,255,255,0.04)' }}
          />

          {/* Funkeln */}
          {!reduceMotion && Array.from({ length: 14 }).map((_, i) => (
            <motion.div
              key={`s${i}`}
              className="pointer-events-none absolute rounded-full"
              style={{
                width:  `${5 + (i % 3) * 2}px`,
                height: `${5 + (i % 3) * 2}px`,
                left:   `${8 + ((i * 11) % 80)}%`,
                top:    `${2 + ((i * 9) % 96)}%`,
                background: isDark ? 'rgba(180,220,255,0.28)' : 'rgba(150,199,255,0.3)',
              }}
              animate={{ y: [0, -16, 0], opacity: [0.14, 0.32, 0.14] }}
              transition={{ duration: 3.4 + i * 0.26, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}

          {/* SVG-Straße */}
          <svg
            className="pointer-events-none absolute left-0 top-0 w-full"
            height={mapHeight}
            viewBox={`0 0 100 ${mapHeight}`}
            preserveAspectRatio="none"
          >
            <motion.path
              d={roadPath}
              stroke={isDark ? 'rgba(154,198,245,0.56)' : 'rgba(120,164,220,0.52)'}
              strokeWidth={1.8}
              fill="none"
              strokeLinecap="round"
              strokeDasharray="10 11"
              animate={reduceMotion ? undefined : { strokeDashoffset: [0, -88] }}
              transition={reduceMotion ? undefined : { duration: 3.6, repeat: Infinity, ease: 'linear' }}
            />
          </svg>

          {/* Segment-Trennlabel */}
          {SEED_SEGMENTS.map((seg) => {
            const first = flatNodes.find((f) => f.segmentIndex === seg.index);
            if (!first) return null;
            return (
              <div
                key={`lbl-${seg.segmentId}`}
                className="pointer-events-none absolute left-0 right-0 flex items-center justify-center gap-2 px-4"
                style={{ top: `${first.mapY - 110}px`, zIndex: 1 }}
              >
                <div className="h-px flex-1 opacity-30" style={{ background: isDark ? '#4a6a80' : '#b8a898' }} />
                <span
                  className="rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em]"
                  style={{
                    borderColor: isDark ? '#3a5068' : '#d5bfae',
                    color:       isDark ? '#9ab8d2' : '#6a7a8a',
                    background:  isDark ? 'rgba(18,28,44,0.82)' : 'rgba(255,252,246,0.88)',
                    backdropFilter: 'blur(6px)',
                  }}
                >
                  {seg.title}
                </span>
                <div className="h-px flex-1 opacity-30" style={{ background: isDark ? '#4a6a80' : '#b8a898' }} />
              </div>
            );
          })}

          {/* Nodes */}
          {flatNodes.map((flat, idx) => {
            const { node, state, mapY } = flat;
            const isLocked    = state === 'locked';
            const isDone      = state === 'done';
            const isAvailable = state === 'available';
            const isLastAct   = progress.lastActiveNodeId === node.nodeId;
            const isSel       = selected?.node.nodeId === node.nodeId;

            const Icon      = isLocked ? Lock : isDone ? CheckCircle2 : NODE_ICON[node.type];
            const color     = isLocked ? (isDark ? '#3a5068' : '#b8c4cc') : isDone ? '#22c99a' : NODE_COLOR[node.type];
            const borderClr = isSel
              ? (isDark ? 'rgba(160,191,230,0.8)' : 'rgba(108,138,176,0.7)')
              : color + (isLocked ? '55' : '90');
            const bgClr = isLocked
              ? (isDark ? 'rgba(22,34,50,0.78)' : 'rgba(240,235,228,0.8)')
              : isDone
                ? (isDark ? 'rgba(37,65,58,0.48)' : 'rgba(217,240,231,0.7)')
                : (isDark ? 'rgba(22,34,50,0.72)' : 'rgba(255,251,245,0.82)');

            // x: Straßen-Kurve + kleiner seitlicher Offset aus node.x (0-100 → ±9%)
            const roadX = pathXAtY(mapY);
            const rawX  = clamp(roadX + (node.x - 50) * 0.18, 8, 88);

            return (
              <div key={node.nodeId} ref={isLastAct ? lastActiveRef : undefined}>
                <motion.button
                  type="button"
                  onClick={() => !isLocked && setSelected(flat)}
                  disabled={isLocked}
                  className="absolute flex h-20 w-20 flex-col items-center justify-center rounded-full border-2 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7f96c8]"
                  style={{
                    top:    `${mapY - 40}px`,
                    left:   `calc(${rawX}% - 40px)`,
                    zIndex: 2,
                    borderColor: borderClr,
                    background:  bgClr,
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    boxShadow: isSel
                      ? `0 0 0 3px ${color}44, 0 12px 28px rgba(8,14,22,0.36)`
                      : '0 8px 20px rgba(8,14,22,0.22)',
                  }}
                  initial={{ opacity: 0, scale: 0.82 }}
                  animate={{
                    opacity: 1,
                    scale: isSel ? 1.08 : 1,
                    y: reduceMotion ? 0 : [0, -3, 0],
                  }}
                  transition={{
                    opacity: { duration: 0.24, delay: idx * 0.018 },
                    scale: { duration: 0.22, ease: 'easeOut' },
                    y: reduceMotion ? { duration: 0 } : {
                      duration: 2.8 + (idx % 3) * 0.4,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    },
                  }}
                  aria-label={`${node.title} – ${state}`}
                >
                  {/* Puls-Ring */}
                  {!reduceMotion && isAvailable && (
                    <motion.span
                      className="pointer-events-none absolute inset-0 rounded-full"
                      style={{ border: `2px solid ${color}66` }}
                      animate={{ scale: [1, 1.26, 1], opacity: [0.6, 0.04, 0.6] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
                    />
                  )}

                  {/* Reward-Badge */}
                  {!isLocked && !isDone && node.rewardPreview?.chestPossible && (
                    <span className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] shadow-md">
                      🎁
                    </span>
                  )}

                  <Icon className="h-5 w-5" style={{ color }} />
                  <span
                    className="mt-1 line-clamp-2 px-1 text-[9px] font-semibold leading-tight"
                    style={{ color: isDark ? '#e4edf9' : '#2f455d', opacity: isLocked ? 0.5 : 1 }}
                  >
                    {node.title}
                  </span>
                  <span
                    className="mt-0.5 rounded-full px-1.5 py-[1px] text-[8px] font-bold uppercase tracking-[0.08em]"
                    style={{
                      color,
                      border: `1px solid ${borderClr}`,
                      background: isDark ? 'rgba(14,22,36,0.55)' : 'rgba(255,255,255,0.72)',
                    }}
                  >
                    {NODE_LABEL[node.type]}
                  </span>

                  {isDone && (
                    <CheckCircle2
                      className="absolute -right-1 -top-1 h-4 w-4"
                      style={{ color: isDark ? '#8fd5b8' : '#4f9e7f' }}
                    />
                  )}
                </motion.button>
              </div>
            );
          })}

          {/* Ende */}
          <div
            className="absolute flex w-full items-center justify-center"
            style={{ top: `${mapHeight - 80}px`, zIndex: 2 }}
          >
            <span
              className="flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-semibold"
              style={{
                borderColor: isDark ? '#2a3d52' : '#d5bfae',
                color:       isDark ? '#5a7a9a' : '#8a9aaa',
                background:  isDark ? 'rgba(14,22,36,0.75)' : 'rgba(255,252,246,0.8)',
                backdropFilter: 'blur(6px)',
              }}
            >
              <Sparkles className="h-3.5 w-3.5 opacity-50" />
              Neue Abenteuer folgen bald…
            </span>
          </div>
        </div>
      </div>

      {/* ── Node Bottom Sheet ── */}
      {selected && (
        <TaleaMapNodeSheet
          node={selected.node}
          state={selected.state}
          isDark={isDark}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
};

export default TaleaLearningPathMapView;

