/**
 * MapBackground.tsx
 * Background layer for the scrollable map container.
 * Renders per-segment landscape tiles + global overlays + decorative road.
 */
import React, { memo, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { buildRoadPath, type SegmentBlock } from '../hooks/useMapFlowData';

interface ParticleProps {
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  isStar: boolean;
}

const Particle: React.FC<ParticleProps> = memo(({ x, y, size, color, delay, duration, isStar }) => (
  <motion.div
    className="pointer-events-none absolute"
    style={{
      left: `${x}%`,
      top: `${y}%`,
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

interface MapBackgroundProps {
  mapHeight: number;
  isDark: boolean;
  segmentBlocks: SegmentBlock[];
}

const MapBackground: React.FC<MapBackgroundProps> = ({ mapHeight, isDark, segmentBlocks }) => {
  const reduceMotion = useReducedMotion() ?? false;
  const roadPath = useMemo(() => buildRoadPath(mapHeight), [mapHeight]);
  const TILE_IMAGE = '/assets/lernpfad_no_path.png';
  const TILE_HEIGHT = 2048;
  const firstTileTop = useMemo(() => {
    const anchorTop = segmentBlocks[0]?.top ?? 0;
    return anchorTop - (anchorTop % TILE_HEIGHT);
  }, [segmentBlocks]);
  const backgroundTiles = useMemo(() => {
    const visibleHeight = Math.max(0, mapHeight - firstTileTop);
    const tileCount = Math.max(1, Math.ceil(visibleHeight / TILE_HEIGHT) + 1);
    return Array.from({ length: tileCount }, (_, index) => ({
      id: index,
      top: firstTileTop + index * TILE_HEIGHT,
    }));
  }, [mapHeight, firstTileTop]);

  const particles = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    id: i,
    x: 6 + ((i * 13) % 86),
    y: 1 + ((i * 7) % 97),
    size: 4 + (i % 4) * 2.5,
    color: i % 2 === 0
      ? `rgba(160,210,255,${0.18 + (i % 3) * 0.08})`
      : `rgba(200,180,255,${0.15 + (i % 4) * 0.07})`,
    delay: (i * 0.28) % 3.8,
    duration: 2.6 + (i % 6) * 0.45,
    isStar: i % 3 === 0,
  })), []);

  return (
    <>
      {backgroundTiles.map((tile) => (
        <div
          key={`bg-tile-${tile.id}`}
          className="pointer-events-none absolute left-0 right-0"
          style={{
            top: `${tile.top}px`,
            height: `${TILE_HEIGHT}px`,
            backgroundImage: `url('${TILE_IMAGE}')`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: '100% 100%',
            backgroundPosition: 'center top',
          }}
        />
      ))}

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isDark
            ? 'linear-gradient(180deg,rgba(8,14,24,0.38) 0%,rgba(8,14,24,0.16) 50%,rgba(8,14,24,0.38) 100%)'
            : 'rgba(0,0,0,0.03)',
        }}
      />

      {!reduceMotion && particles.map((p) => (
        <Particle key={p.id} {...p} />
      ))}

      <svg
        className="pointer-events-none absolute left-0 top-0 w-full"
        height={mapHeight}
        viewBox={`0 0 100 ${mapHeight}`}
        preserveAspectRatio="none"
      >
        {/* Glow Layer */}
        <path
          d={roadPath}
          stroke={isDark ? 'rgba(80,150,255,0.15)' : 'rgba(70,130,220,0.12)'}
          strokeWidth={18}
          fill="none"
          strokeLinecap="round"
          style={{ filter: 'blur(8px)' }}
        />
        {/* Base Thick Path */}
        <path
          d={roadPath}
          stroke={isDark ? 'rgba(40,80,140,0.4)' : 'rgba(160,190,230,0.3)'}
          strokeWidth={12}
          fill="none"
          strokeLinecap="round"
        />
        {/* Inner core road */}
        <path
          d={roadPath}
          stroke={isDark ? 'rgba(100,160,240,0.4)' : 'rgba(120,170,240,0.35)'}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
        />
        {/* Animated Dashes for a stream/flow effect */}
        <motion.path
          d={roadPath}
          stroke={isDark ? 'rgba(180,225,255,0.8)' : 'rgba(140,190,255,0.7)'}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeDasharray="8 24"
          animate={reduceMotion ? undefined : { strokeDashoffset: [0, -128] }}
          transition={reduceMotion ? undefined : { duration: 6.0, repeat: Infinity, ease: 'linear' }}
          style={{ filter: 'drop-shadow(0 0 4px rgba(200,230,255,0.5))' }}
        />
      </svg>
    </>
  );
};

export default memo(MapBackground);
