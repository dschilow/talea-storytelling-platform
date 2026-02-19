/**
 * MapBackground.tsx
 * Background layer rendered inside the React Flow viewport.
 * Contains: tiled landscape image, mood overlay, decorative SVG road, particles, segment labels.
 * All elements zoom/pan with the flow because they're in viewport coordinates.
 */
import React, { memo, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTheme } from '../../../contexts/ThemeContext';
import { buildRoadPath, MAP_TILE_HEIGHT, type SegmentLabel } from '../hooks/useMapFlowData';

const MAP_BACKGROUND_IMAGE = '/assets/lernpfad_no_path.png';
const CANVAS_WIDTH = 600;

// ─── Particle ───────────────────────────────────────────────────────────────

interface ParticleProps {
  x: number; y: number; size: number; color: string;
  delay: number; duration: number; isStar: boolean;
}

const Particle: React.FC<ParticleProps> = memo(({ x, y, size, color, delay, duration, isStar }) => (
  <motion.div
    className="pointer-events-none absolute"
    style={{
      left: (x / 100) * CANVAS_WIDTH,
      top: y,
      width: size,
      height: size,
      background: color,
      borderRadius: isStar ? '2px' : '50%',
      rotate: isStar ? 45 : 0,
      transformOrigin: 'center',
    }}
    animate={{
      y: [0, -(10 + size * 2.2), 0],
      opacity: [0.0, 0.72, 0.0],
      rotate: isStar ? [45, 90, 45] : [0, 0, 0],
      scale: [0.55, 1.15, 0.55],
    }}
    transition={{ duration, delay, repeat: Infinity, ease: 'easeInOut' }}
  />
));

// ─── Segment Label ──────────────────────────────────────────────────────────

const SegmentLabelItem: React.FC<{ label: SegmentLabel; isDark: boolean }> = memo(({ label, isDark }) => (
  <motion.div
    className="pointer-events-none absolute flex items-center justify-center gap-3"
    style={{
      top: label.y,
      left: 0,
      width: CANVAS_WIDTH,
      zIndex: 3,
    }}
    initial={{ opacity: 0, y: -18, scale: 0.86 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.08 + label.index * 0.13 }}
  >
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
      {label.title}
    </motion.span>
    <div className="h-px flex-1 opacity-20" style={{ background: isDark ? '#5a8ab0' : '#9a8878' }} />
  </motion.div>
));

// ─── Main Background ────────────────────────────────────────────────────────

interface MapBackgroundProps {
  mapHeight: number;
  segmentLabels: SegmentLabel[];
}

const MapBackground: React.FC<MapBackgroundProps> = ({ mapHeight, segmentLabels }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const reduceMotion = useReducedMotion() ?? false;

  const roadPath = useMemo(() => buildRoadPath(mapHeight), [mapHeight]);

  // Stable particles
  const particles = useMemo(() =>
    Array.from({ length: 22 }, (_, i) => ({
      id: i,
      x: 6 + ((i * 13) % 86),
      y: 20 + ((i * 137) % Math.max(1, mapHeight - 100)),
      size: 4 + (i % 4) * 2.5,
      color: i % 2 === 0
        ? `rgba(160,210,255,${0.18 + (i % 3) * 0.08})`
        : `rgba(200,180,255,${0.15 + (i % 4) * 0.07})`,
      delay: (i * 0.28) % 3.8,
      duration: 2.6 + (i % 6) * 0.45,
      isStar: i % 3 === 0,
    })),
    [mapHeight],
  );

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        top: -100,
        left: -50,
        width: CANVAS_WIDTH + 100,
        height: mapHeight + 200,
      }}
    >
      {/* Tiled background image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url('${MAP_BACKGROUND_IMAGE}')`,
          backgroundRepeat: 'repeat-y',
          backgroundSize: `${CANVAS_WIDTH + 100}px ${MAP_TILE_HEIGHT}px`,
          backgroundPosition: 'center top',
        }}
      />

      {/* Mood overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? 'linear-gradient(180deg,rgba(8,14,24,0.38) 0%,rgba(8,14,24,0.16) 50%,rgba(8,14,24,0.38) 100%)'
            : 'rgba(0,0,0,0.03)',
        }}
      />

      {/* Particles */}
      {!reduceMotion && particles.map((p) => (
        <Particle key={p.id} {...p} />
      ))}

      {/* SVG decorative road (3 glow layers) */}
      <svg
        className="absolute"
        style={{ top: 100, left: 50 }}
        width={CANVAS_WIDTH}
        height={mapHeight}
        viewBox={`0 0 100 ${mapHeight}`}
        preserveAspectRatio="none"
      >
        {/* Outer glow */}
        <path
          d={roadPath}
          stroke={isDark ? 'rgba(80,150,255,0.10)' : 'rgba(70,130,220,0.09)'}
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
        />
        {/* Mid glow */}
        <path
          d={roadPath}
          stroke={isDark ? 'rgba(120,185,255,0.22)' : 'rgba(100,160,230,0.20)'}
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
        />
        {/* Animated dash */}
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
      </svg>

      {/* Segment labels */}
      <div className="absolute" style={{ top: 100, left: 50, width: CANVAS_WIDTH, height: mapHeight }}>
        {segmentLabels.map((label) => (
          <SegmentLabelItem key={label.segmentId} label={label} isDark={isDark} />
        ))}
      </div>

      {/* End-of-map message */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          top: mapHeight + 50,
          left: 50,
          width: CANVAS_WIDTH,
        }}
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
          animate={!reduceMotion ? { y: [0, -5, 0] } : {}}
          transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          ✨ Neue Abenteuer folgen bald…
        </motion.span>
      </div>
    </div>
  );
};

export default memo(MapBackground);
