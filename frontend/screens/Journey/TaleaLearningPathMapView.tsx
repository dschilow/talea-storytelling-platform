/**
 * TaleaLearningPathMapView.tsx
 * Phase A – Reise-Karte Screen (/map)
 *
 * Visuelle Sprache 1:1 von AvatarLearningWorldMap:
 *  - Hintergrund: /assets/lernpfad_no_path.png (repeat-y, 2048px Tile)
 *  - SVG-Straße mit ROAD_POINTS + Bezier (animierter Dash)
 *  - Runde schwebende Buttons: locked / available / done
 *
 * Daten: TaleaLearningPathSeedData + TaleaLearningPathProgressStore
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Flame,
  GitFork,
  Headphones,
  HelpCircle,
  List,
  Lock,
  MapPin,
  Sparkles,
  Sun,
  Trophy,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { SEED_SEGMENTS, computeNodeStates } from './TaleaLearningPathSeedData';
import { useLearningPathProgress } from './TaleaLearningPathProgressStore';
import type { MapNode, NodeState, NodeType } from './TaleaLearningPathTypes';
import TaleaMapNodeSheet from './TaleaMapNodeSheet';

// ─── Straßen-Punkte (1:1 aus AvatarLearningWorldMap) ────────────────────────
interface PathPoint { y: number; x: number }

const MAP_BACKGROUND_IMAGE = '/assets/lernpfad_no_path.png';
const MAP_TILE_HEIGHT = 2048;

const ROAD_POINTS: PathPoint[] = [
  { y: 0,     x: 61 },
  { y: 0.045, x: 52 },
  { y: 0.09,  x: 40 },
  { y: 0.14,  x: 33 },
  { y: 0.19,  x: 45 },
  { y: 0.24,  x: 60 },
  { y: 0.29,  x: 67 },
  { y: 0.34,  x: 57 },
  { y: 0.39,  x: 44 },
  { y: 0.44,  x: 33 },
  { y: 0.49,  x: 31 },
  { y: 0.54,  x: 43 },
  { y: 0.59,  x: 58 },
  { y: 0.64,  x: 66 },
  { y: 0.69,  x: 57 },
  { y: 0.74,  x: 45 },
  { y: 0.79,  x: 34 },
  { y: 0.84,  x: 33 },
  { y: 0.89,  x: 47 },
  { y: 0.94,  x: 61 },
  { y: 1,     x: 57 },
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
      d += ` C ${prev.x} ${py + dy * 0.46}, ${x} ${y - dy * 0.46}, ${x} ${y}`;
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
const SEGMENT_GAP  = 260;    // px Abstand zwischen Segmenten
const TOP_OFFSET   = 160;    // px Abstand oben

// ─── Framer-Motion Variants (Disney Prinzipien) ───────────────────────────────

// Squash & Stretch + Anticipation (Prinzip 1 + 2)
const nodeEnterVariant: Variants = {
  hidden: { opacity: 0, scale: 0.35, scaleY: 1.45, y: 16 },
  show: (delay: number) => ({
    opacity: 1, scale: 1, scaleY: 1, y: 0,
    transition: {
      delay,
      type:      'spring',
      stiffness: 370,
      damping:   17,
      mass:      0.72,
    },
  }),
};

// Segment-Label: Staging (Prinzip 3)
const segLabelVariant: Variants = {
  hidden: { opacity: 0, y: -18, scale: 0.86 },
  show:   {
    opacity: 1, y: 0, scale: 1,
    transition: { type: 'spring', stiffness: 260, damping: 22 },
  },
};

// ─── Partikel ─────────────────────────────────────────────────────────────────
interface ParticleProps {
  x: number; y: number; size: number; color: string;
  delay: number; duration: number; isStar: boolean;
}

const Particle: React.FC<ParticleProps> = React.memo(({ x, y, size, color, delay, duration, isStar }) => (
  <motion.div
    className="pointer-events-none absolute"
    style={{
      left: `${x}%`, top: `${y}%`,
      width: size, height: size,
      background: color,
      borderRadius: isStar ? '2px' : '50%',
      rotate: isStar ? 45 : 0,
      transformOrigin: 'center',
    }}
    animate={{
      y:       [0, -(10 + size * 2.2), 0],
      opacity: [0.0, 0.72, 0.0],
      rotate:  isStar ? [45, 90, 45] : [0, 0, 0],
      scale:   [0.55, 1.15, 0.55],
    }}
    transition={{ duration, delay, repeat: Infinity, ease: 'easeInOut' }}
  />
));

// ─── Doppel-Pulsring für available Nodes ──────────────────────────────────────
const PulseRings: React.FC<{ color: string }> = React.memo(({ color }) => (
  <>
    <motion.span
      className="pointer-events-none absolute inset-0 rounded-full"
      style={{ border: `2.5px solid ${color}`, opacity: 0 }}
      animate={{ scale: [1, 1.58], opacity: [0.68, 0] }}
      transition={{ duration: 1.9, repeat: Infinity, ease: 'easeOut' }}
    />
    <motion.span
      className="pointer-events-none absolute inset-0 rounded-full"
      style={{ border: `1.5px solid ${color}88`, opacity: 0 }}
      animate={{ scale: [1, 1.40], opacity: [0.50, 0] }}
      transition={{ duration: 1.9, delay: 0.58, repeat: Infinity, ease: 'easeOut' }}
    />
  </>
));

// ─── Done-Sterne-Burst ────────────────────────────────────────────────────────
const DoneBurst: React.FC<{ color: string; reduceMotion: boolean }> = React.memo(
  ({ color, reduceMotion }) => {
    if (reduceMotion) return null;
    return (
      <>
        {/* Rotierender Shine-Ring */}
        <motion.span
          className="pointer-events-none absolute inset-[-4px] rounded-full"
          style={{ border: `2px dashed ${color}55` }}
          animate={{ rotate: 360 }}
          transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
        />
        {/* 5 Satellite-Sterne */}
        {[0, 72, 144, 216, 288].map((deg) => (
          <motion.span
            key={deg}
            className="pointer-events-none absolute h-1.5 w-1.5 rounded-sm"
            style={{
              background: color,
              top:  `calc(50% - 3px + ${Math.sin((deg * Math.PI) / 180) * 34}px)`,
              left: `calc(50% - 3px + ${Math.cos((deg * Math.PI) / 180) * 34}px)`,
              rotate: `${deg}deg`,
            }}
            animate={{ scale: [0.6, 1.4, 0.6], opacity: [0.45, 1, 0.45] }}
            transition={{
              duration: 2.4,
              delay:    (deg / 360) * 1.2,
              repeat:   Infinity,
              ease:     'easeInOut',
            }}
          />
        ))}
      </>
    );
  },
);

// ─── Komponente ──────────────────────────────────────────────────────────────
const TaleaLearningPathMapView: React.FC = () => {
  const navigate         = useNavigate();
  const { resolvedTheme } = useTheme();
  const isDark           = resolvedTheme === 'dark';
  const reduceMotion     = useReducedMotion() ?? false;

  const { progress }     = useLearningPathProgress();
  const [selected, setSelected] = useState<FlatNode | null>(null);
  const [heuteMode, setHeuteMode] = useState(false);
  const [showKapitel, setShowKapitel] = useState(false);
  const lastActiveRef    = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // ── Flache Node-Liste ──────────────────────────────────────────────────────
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

  // ── Node-Positionen für Edge-SVG ──
  const nodePositions = useMemo(() => {
    const posMap = new Map<string, { x: number; y: number }>();
    for (const flat of flatNodes) {
      const roadX = pathXAtY(flat.mapY);
      const rawX = clamp(roadX + (flat.node.x - 50) * 0.16, 7, 89);
      posMap.set(flat.node.nodeId, { x: rawX, y: flat.mapY });
    }
    return posMap;
  }, [flatNodes]);

  // ── Kanten zwischen Nodes (done / available / locked) ──
  const edgesWithState = useMemo(() => {
    const doneSet = new Set(progress.doneNodeIds);
    const result: Array<{
      from: { x: number; y: number }; to: { x: number; y: number };
      edgeState: 'done' | 'available' | 'locked';
    }> = [];
    for (const seg of SEED_SEGMENTS) {
      for (const edge of seg.edges) {
        const fromPos = nodePositions.get(edge.fromNodeId);
        const toPos   = nodePositions.get(edge.toNodeId);
        if (!fromPos || !toPos) continue;
        const fromDone = doneSet.has(edge.fromNodeId);
        const toDone   = doneSet.has(edge.toNodeId);
        result.push({
          from: fromPos, to: toPos,
          edgeState: (fromDone && toDone) ? 'done' : fromDone ? 'available' : 'locked',
        });
      }
    }
    return result;
  }, [nodePositions, progress.doneNodeIds]);

  // ── Heute-empfohlene Nodes ──
  const todayNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const seg of SEED_SEGMENTS) {
      if (seg.recommendedDailyStops) seg.recommendedDailyStops.forEach(id => ids.add(id));
    }
    return ids;
  }, []);

  const mapHeight = Math.max(
    (flatNodes[flatNodes.length - 1]?.mapY ?? TOP_OFFSET) + 420,
    MAP_TILE_HEIGHT,
  );
  const roadPath = useMemo(() => buildRoadPath(mapHeight), [mapHeight]);

  // ── Partikel (stabil per useMemo, Color-unabhängig in isDark) ─────────────
  const particles = useMemo(() =>
    Array.from({ length: 22 }, (_, i) => ({
      id:       i,
      x:        6  + ((i * 13) % 86),
      y:        1  + ((i * 7)  % 97),
      size:     4  + (i % 4) * 2.5,
      color:    i % 2 === 0
        ? `rgba(160,210,255,${0.18 + (i % 3) * 0.08})`
        : `rgba(200,180,255,${0.15 + (i % 4) * 0.07})`,
      delay:    (i * 0.28) % 3.8,
      duration: 2.6 + (i % 6) * 0.45,
      isStar:   i % 3 === 0,
    })),
  []);

  // ── Zoom-to-Active: Game-Kamera fliegt zum aktuellen Node ──
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
  useEffect(() => {
    const t = setTimeout(scrollToActive, 600);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasActive = !!progress.lastActiveNodeId;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col" style={{ background: isDark ? '#0d1521' : '#ede5d4' }}>

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3"
        style={{
          borderColor: isDark ? '#1e3148' : '#d8cbb8',
          background:  isDark ? 'rgba(10,17,28,0.92)' : 'rgba(253,247,238,0.94)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        {/* Zurück-Button – Appeal (Prinzip 12) */}
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

        {/* Titel */}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: isDark ? '#3a6a8a' : '#8a9aaa' }}>
            Talea
          </p>
          <h1 className="text-lg font-black leading-none tracking-tight" style={{ color: isDark ? '#e8f2ff' : '#1a2a3a' }}>
            Reise-Karte ✨
          </h1>
        </div>

        {/* "Zu mir" – Exaggeration Puls (Prinzip 10) wenn aktiver Node */}
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
              ]}
            : {}}
          transition={hasActive && !reduceMotion ? { duration: 2.6, repeat: Infinity } : {}}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold"
          style={{
            borderColor: isDark ? '#2e4a64' : '#c0b0a0',
            color:       isDark ? '#88b8e0' : '#3a6a88',
            background:  isDark ? 'rgba(20,36,56,0.65)' : 'rgba(255,252,246,0.85)',
          }}
        >
          <MapPin className="h-3.5 w-3.5" />
          Zu mir
        </motion.button>

        {/* Heute – Tages-Empfehlungen hervorheben */}
        <motion.button
          type="button"
          onClick={() => setHeuteMode(m => !m)}
          whileTap={{ scale: 0.9 }}
          className="flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold"
          style={{
            borderColor: heuteMode ? '#f5a623' : (isDark ? '#2e4a64' : '#c0b0a0'),
            color:       heuteMode ? '#f5a623' : (isDark ? '#88b8e0' : '#3a6a88'),
            background:  heuteMode
              ? (isDark ? 'rgba(245,166,35,0.15)' : 'rgba(245,166,35,0.12)')
              : (isDark ? 'rgba(20,36,56,0.65)' : 'rgba(255,252,246,0.85)'),
          }}
        >
          <Sun className="h-3.5 w-3.5" />
          Heute
        </motion.button>

        {/* Kapitel – Segment-Navigation */}
        <motion.button
          type="button"
          onClick={() => setShowKapitel(true)}
          whileTap={{ scale: 0.9 }}
          className="flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold"
          style={{
            borderColor: isDark ? '#2e4a64' : '#c0b0a0',
            color:       isDark ? '#88b8e0' : '#3a6a88',
            background:  isDark ? 'rgba(20,36,56,0.65)' : 'rgba(255,252,246,0.85)',
          }}
        >
          <List className="h-3.5 w-3.5" />
        </motion.button>
      </header>

      {/* ── Karte ── */}
      <div
        ref={scrollContainerRef}
        className="relative flex-1 overflow-y-auto overflow-x-hidden"
        style={{ minHeight: 'calc(100vh - 56px)', backgroundColor: isDark ? '#111a28' : '#e4dac8' }}
      >
        <motion.div
          className="relative"
          style={{ height: `${mapHeight}px`, transformOrigin: 'center top' }}
          initial={{ opacity: 0.3, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        >

          {/* ── Hintergrundbild (Landscape Tile) ── */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:    `url('${MAP_BACKGROUND_IMAGE}')`,
              backgroundRepeat:   'repeat-y',
              backgroundSize:     `100% ${MAP_TILE_HEIGHT}px`,
              backgroundPosition: 'center top',
            }}
          />

          {/* ── Mood-Overlay ── */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: isDark
                ? 'linear-gradient(180deg,rgba(8,14,24,0.38) 0%,rgba(8,14,24,0.16) 50%,rgba(8,14,24,0.38) 100%)'
                : 'rgba(0,0,0,0.03)',
            }}
          />

          {/* ── Partikel: 4-Zack-Sterne + Kreise (Follow Through, Prinzip 6) ── */}
          {!reduceMotion && particles.map((p) => (
            <Particle key={p.id} {...p} />
          ))}

          {/* ── SVG-Pfad: 3 Schichten für Game-Glow ── */}
          <svg
            className="pointer-events-none absolute left-0 top-0 w-full"
            height={mapHeight}
            viewBox={`0 0 100 ${mapHeight}`}
            preserveAspectRatio="none"
          >
            {/* Schicht 1 – äußerer Weich-Glow */}
            <path
              d={roadPath}
              stroke={isDark ? 'rgba(80,150,255,0.10)' : 'rgba(70,130,220,0.09)'}
              strokeWidth={8}
              fill="none"
              strokeLinecap="round"
            />
            {/* Schicht 2 – mittlerer Glow */}
            <path
              d={roadPath}
              stroke={isDark ? 'rgba(120,185,255,0.22)' : 'rgba(100,160,230,0.20)'}
              strokeWidth={3.5}
              fill="none"
              strokeLinecap="round"
            />
            {/* Schicht 3 – animierter Dash-Flow */}
            <motion.path
              d={roadPath}
              stroke={isDark ? 'rgba(170,215,255,0.72)' : 'rgba(100,165,235,0.68)'}
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
              strokeDasharray="5 17"
              animate={reduceMotion ? undefined : { strokeDashoffset: [0, -88] }}
              transition={reduceMotion ? undefined : { duration: 4.0, repeat: Infinity, ease: 'linear' }}
            />

            {/* ── Kanten-Verbindungen zwischen Nodes ── */}
            {edgesWithState.map((edge, ei) => {
              const { from, to, edgeState } = edge;
              const dy = Math.abs(to.y - from.y) * 0.35;
              const d = `M ${from.x} ${from.y} C ${from.x} ${from.y + dy}, ${to.x} ${to.y - dy}, ${to.x} ${to.y}`;
              const edgeColor = {
                done:      isDark ? 'rgba(34,201,154,0.6)'  : 'rgba(34,180,140,0.55)',
                available: isDark ? 'rgba(100,180,255,0.55)' : 'rgba(80,150,240,0.50)',
                locked:    isDark ? 'rgba(50,70,100,0.18)'   : 'rgba(120,120,140,0.13)',
              }[edgeState];
              return (
                <g key={`edge-${ei}`}>
                  {edgeState !== 'locked' && (
                    <path d={d} stroke={edgeColor} strokeWidth={edgeState === 'done' ? 4.5 : 3.5}
                      fill="none" strokeLinecap="round" opacity={0.35} />
                  )}
                  <path d={d} stroke={edgeColor}
                    strokeWidth={edgeState === 'locked' ? 0.8 : 1.8}
                    fill="none" strokeLinecap="round"
                    strokeDasharray={edgeState === 'locked' ? '2 5' : 'none'} />
                  {edgeState === 'available' && !reduceMotion && (
                    <motion.circle r={2} fill={isDark ? '#88ccff' : '#60a0e8'}
                      animate={{
                        cx: [from.x, (from.x + to.x) / 2, to.x],
                        cy: [from.y, (from.y + to.y) / 2, to.y],
                        opacity: [0, 0.85, 0],
                      }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: ei * 0.35 }}
                    />
                  )}
                  {edgeState === 'done' && !reduceMotion && (
                    <motion.circle r={1.5} fill="#22c99a"
                      animate={{
                        cx: [from.x, (from.x + to.x) / 2, to.x],
                        cy: [from.y, (from.y + to.y) / 2, to.y],
                        opacity: [0, 0.55, 0],
                      }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: ei * 0.4 }}
                    />
                  )}
                </g>
              );
            })}

            <defs>
              <filter id="edgeGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
              </filter>
            </defs>
          </svg>

          {/* ── Segment-Labels (Staging, Prinzip 3) ── */}
          {SEED_SEGMENTS.map((seg, si) => {
            const first = flatNodes.find((f) => f.segmentIndex === seg.index);
            if (!first) return null;
            return (
              <motion.div
                key={`lbl-${seg.segmentId}`}
                className="pointer-events-none absolute left-0 right-0 flex items-center justify-center gap-3 px-6"
                style={{ top: `${first.mapY - 122}px`, zIndex: 3 }}
                variants={segLabelVariant}
                initial="hidden"
                animate="show"
                custom={0.08 + si * 0.13}
              >
                <div className="h-px flex-1 opacity-20" style={{ background: isDark ? '#5a8ab0' : '#9a8878' }} />
                <motion.span
                  className="rounded-full border px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.16em]"
                  style={{
                    borderColor: isDark ? '#243a54' : '#c0a888',
                    color:       isDark ? '#6aaad2' : '#6a5a48',
                    background:  isDark ? 'rgba(8,18,32,0.88)' : 'rgba(252,246,236,0.92)',
                    backdropFilter: 'blur(10px)',
                    boxShadow:   isDark
                      ? '0 3px 14px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)'
                      : '0 2px 10px rgba(0,0,0,0.10)',
                  }}
                  whileHover={{ scale: 1.04 }}
                >
                  {seg.title}
                </motion.span>
                <div className="h-px flex-1 opacity-20" style={{ background: isDark ? '#5a8ab0' : '#9a8878' }} />
              </motion.div>
            );
          })}

          {/* ── Nodes ── */}
          {flatNodes.map((flat, idx) => {
            const { node, state, mapY } = flat;
            const isLocked    = state === 'locked';
            const isDone      = state === 'done';
            const isAvailable = state === 'available';
            const isLastAct   = progress.lastActiveNodeId === node.nodeId;
            const isSel       = selected?.node.nodeId === node.nodeId;

            const Icon  = isLocked ? Lock : isDone ? CheckCircle2 : NODE_ICON[node.type];
            const color = isLocked
              ? (isDark ? '#2a4060' : '#b0bcc8')
              : isDone ? '#22c99a'
              : NODE_COLOR[node.type];

            const bgClr = isLocked
              ? (isDark ? 'rgba(16,26,42,0.84)' : 'rgba(232,225,214,0.88)')
              : isDone
                ? (isDark ? 'rgba(26,55,46,0.72)' : 'rgba(205,238,220,0.82)')
                : (isDark ? 'rgba(14,24,40,0.82)' : 'rgba(255,252,244,0.90)');

            const shadow = isSel
              ? `0 0 0 5px ${color}44, 0 18px 40px rgba(6,12,22,0.56)`
              : isDone
                ? `0 0 12px ${color}44, 0 8px 22px rgba(6,12,22,0.30)`
                : '0 8px 26px rgba(6,12,22,0.34)';

            // X = Pfad-Kurve + sanfter Offset
            const roadX = pathXAtY(mapY);
            const rawX  = clamp(roadX + (node.x - 50) * 0.16, 7, 89);

            return (
              <motion.div
                key={node.nodeId}
                ref={isLastAct ? lastActiveRef : undefined}
                style={{ position: 'absolute', top: `${mapY - 44}px`, left: `calc(${rawX}% - 44px)`, zIndex: 4 }}
                custom={idx * 0.038}
                variants={nodeEnterVariant}
                initial="hidden"
                animate="show"
              >
                {/* Auswahlring (rotierend, Follow-Through Prinzip 5) */}
                <AnimatePresence>
                  {isSel && (
                    <motion.span
                      key="selring"
                      className="pointer-events-none absolute inset-[-6px] rounded-full"
                      style={{ border: `2px dashed ${color}99` }}
                      initial={{ opacity: 0, scale: 0.75 }}
                      animate={{ opacity: 1, scale: 1, rotate: 360 }}
                      exit={{ opacity: 0, scale: 0.75, transition: { duration: 0.18 } }}
                      transition={{
                        opacity:  { duration: 0.22 },
                        scale:    { duration: 0.22 },
                        rotate:   { duration: 9, repeat: Infinity, ease: 'linear' },
                      }}
                    />
                  )}
                </AnimatePresence>

                {/* ── Node-Button: Float + Hover + Tap ── */}
                <motion.button
                  type="button"
                  onClick={() => !isLocked && setSelected(isSel ? null : flat)}
                  disabled={isLocked}
                  className="relative flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full border-2 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  style={{
                    borderColor: isLocked
                      ? (isDark ? '#1c3050' : '#bbb0a4')
                      : isSel
                        ? color
                        : `${color}80`,
                    background: bgClr,
                    cursor:    isLocked ? 'not-allowed' : 'pointer',
                    boxShadow: shadow,
                    opacity:   isLocked ? 0.58 : 1,
                  }}

                  // ── Float + Wackeln für available (Follow-Through, Prinzip 5) ──
                  animate={!reduceMotion && isAvailable ? {
                    y:      [0, -8, 0],
                    rotate: [-0.7, 0.7, -0.7],
                    scale:  isSel ? 1.11 : 1,
                  } : { scale: isSel ? 1.11 : 1 }}
                  transition={!reduceMotion && isAvailable ? {
                    y:      { duration: 2.9 + (idx % 4) * 0.38, repeat: Infinity, ease: 'easeInOut' },
                    rotate: { duration: 3.4 + (idx % 3) * 0.44, repeat: Infinity, ease: 'easeInOut' },
                    scale:  { type: 'spring', stiffness: 280, damping: 22 },
                  } : { type: 'spring', stiffness: 300, damping: 24 }}

                  // ── Tap: Squash-Feedback (Disney Prinzip 1) ──
                  whileTap={isLocked ? {} : {
                    scaleX: 1.16,
                    scaleY: 0.84,
                    transition: { duration: 0.07 },
                  }}
                  whileHover={isLocked ? {} : {
                    scale: isSel ? 1.13 : 1.07,
                    transition: { type: 'spring', stiffness: 380, damping: 18 },
                  }}
                  aria-label={`${node.title} – ${state}`}
                >
                  {/* Doppel-Puls für available */}
                  {!reduceMotion && isAvailable && <PulseRings color={color} />}

                  {/* Heute-Highlight: goldener Puls-Ring */}
                  {heuteMode && todayNodeIds.has(node.nodeId) && !isLocked && (
                    <motion.span
                      className="pointer-events-none absolute inset-[-7px] rounded-full"
                      style={{ border: '2.5px solid #f5a623', boxShadow: '0 0 14px rgba(245,166,35,0.35)' }}
                      animate={!reduceMotion ? {
                        scale: [1, 1.06, 1], opacity: [0.65, 1, 0.65],
                        boxShadow: ['0 0 6px rgba(245,166,35,0.25)', '0 0 20px rgba(245,166,35,0.5)', '0 0 6px rgba(245,166,35,0.25)'],
                      } : {}}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}

                  {/* Done Sterne-Burst */}
                  {isDone && <DoneBurst color={color} reduceMotion={reduceMotion} />}

                  {/* Reward-Badge (Exaggeration, Prinzip 10) */}
                  {!isLocked && !isDone && node.rewardPreview?.chestPossible && (
                    <motion.span
                      className="absolute -right-1.5 -top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-[11px] shadow-lg"
                      animate={!reduceMotion
                        ? { scale: [1, 1.22, 1], rotate: [0, 14, -14, 0] }
                        : {}}
                      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      🎁
                    </motion.span>
                  )}

                  {/* Icon (Secondary Action, Prinzip 8) */}
                  <motion.span
                    className="flex items-center justify-center"
                    animate={!reduceMotion && isAvailable
                      ? { rotate: [0, 8, -8, 0] }
                      : { rotate: 0 }}
                    transition={!reduceMotion && isAvailable
                      ? { duration: 4.2, repeat: Infinity, ease: 'easeInOut' }
                      : { duration: 0 }}
                  >
                    <Icon
                      className="h-6 w-6"
                      style={{
                        color,
                        filter: isDone ? `drop-shadow(0 0 5px ${color}90)` : 'none',
                      }}
                    />
                  </motion.span>

                  {/* Titel */}
                  <span
                    className="mt-1 line-clamp-2 px-1.5 text-[9px] font-bold leading-tight"
                    style={{ color: isDark ? '#ddeeff' : '#283850', opacity: isLocked ? 0.42 : 1 }}
                  >
                    {node.title}
                  </span>

                  {/* Typ-Badge */}
                  <span
                    className="mt-0.5 rounded-full px-1.5 py-[2px] text-[8px] font-black uppercase tracking-[0.06em]"
                    style={{
                      color,
                      border:     `1px solid ${color}${isLocked ? '28' : '60'}`,
                      background: isDark ? 'rgba(8,16,28,0.68)' : 'rgba(255,254,250,0.82)',
                    }}
                  >
                    {NODE_LABEL[node.type]}
                  </span>

                  {/* Fork: Richtungs-Badges */}
                  {node.type === 'Fork' && !isLocked && node.action.type === 'fork' && (
                    <div className="absolute -bottom-5 left-1/2 flex -translate-x-1/2 gap-1">
                      {node.action.options.map((opt, oi) => (
                        <motion.span
                          key={opt.id}
                          className="flex h-[18px] items-center rounded-full px-1.5 text-[9px] font-bold shadow-md"
                          style={{
                            background: isDark ? 'rgba(14,24,40,0.92)' : 'rgba(255,252,244,0.95)',
                            border: `1px solid ${color}55`,
                            color: isDark ? '#b8d0e8' : '#3a5a70',
                          }}
                          animate={!reduceMotion && isAvailable ? { y: [0, -2.5, 0] } : {}}
                          transition={{ duration: 1.8, delay: oi * 0.25, repeat: Infinity, ease: 'easeInOut' }}
                        >
                          {opt.icon}
                        </motion.span>
                      ))}
                    </div>
                  )}

                  {/* Done-Check (Anticipation → Squash → Snap, Prinzip 2) */}
                  <AnimatePresence>
                    {isDone && (
                      <motion.span
                        key="done-badge"
                        className="absolute -right-1.5 -top-1.5 z-20"
                        initial={{ scale: 0, rotate: -200, opacity: 0 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 440, damping: 14 }}
                      >
                        <CheckCircle2
                          className="h-5 w-5"
                          style={{
                            color:  isDark ? '#72e4b8' : '#38967a',
                            filter: `drop-shadow(0 0 5px ${color}80)`,
                          }}
                        />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>

                {/* Du bist hier! Marker am aktiven Node */}
                {isLastAct && (
                  <motion.div
                    className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap"
                    initial={{ opacity: 0, y: 8, scale: 0.7 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 1.0, type: 'spring', stiffness: 300, damping: 18 }}
                  >
                    <motion.span
                      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-black shadow-lg"
                      style={{
                        background: isDark ? 'rgba(80,160,255,0.22)' : 'rgba(80,140,240,0.14)',
                        border: `1.5px solid ${isDark ? '#4a90d0' : '#80b0e0'}`,
                        color: isDark ? '#88ccff' : '#2a6aaa',
                        backdropFilter: 'blur(8px)',
                      }}
                      animate={!reduceMotion ? { y: [0, -3, 0] } : {}}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      📍 Du bist hier!
                    </motion.span>
                  </motion.div>
                )}
              </motion.div>
            );
          })}

          {/* ── Karten-Ende ── */}
          <motion.div
            className="absolute flex w-full items-center justify-center"
            style={{ top: `${mapHeight - 100}px`, zIndex: 5 }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.7, ease: 'easeOut' }}
          >
            <motion.span
              className="flex items-center gap-2 rounded-full border px-5 py-2.5 text-xs font-bold"
              style={{
                borderColor: isDark ? '#1c3050' : '#c0a888',
                color:       isDark ? '#426888' : '#7a6858',
                background:  isDark ? 'rgba(8,16,28,0.84)' : 'rgba(252,246,236,0.90)',
                backdropFilter: 'blur(10px)',
                boxShadow:   '0 4px 18px rgba(0,0,0,0.22)',
              }}
              animate={!reduceMotion ? { y: [0, -5, 0] } : {}}
              transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sparkles className="h-3.5 w-3.5 opacity-50" />
              Neue Abenteuer folgen bald…
            </motion.span>
          </motion.div>

        </motion.div>
      </div>

      {/* ── Kapitel-Overlay (Segment-Navigation) ── */}
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
                📖 Kapitel
              </h3>
              <div className="space-y-3">
                {SEED_SEGMENTS.map((seg) => {
                  const total = seg.nodes.length;
                  const done  = seg.nodes.filter(n => progress.doneNodeIds.includes(n.nodeId)).length;
                  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
                  const firstFlat = flatNodes.find(f => f.segmentIndex === seg.index);
                  return (
                    <motion.button
                      key={seg.segmentId}
                      type="button"
                      onClick={() => {
                        setShowKapitel(false);
                        if (firstFlat && scrollContainerRef.current) {
                          setTimeout(() => {
                            scrollContainerRef.current?.scrollTo({
                              top: Math.max(0, firstFlat.mapY - 200),
                              behavior: 'smooth',
                            });
                          }, 350);
                        }
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl border p-4 text-left"
                      style={{
                        borderColor: isDark ? '#2a3d52' : '#e0d1bf',
                        background:  isDark ? 'rgba(20,32,48,0.6)' : 'rgba(255,252,246,0.8)',
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
                          {done}/{total} Stationen · {seg.themeTags.join(', ')}
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

export default TaleaLearningPathMapView;

