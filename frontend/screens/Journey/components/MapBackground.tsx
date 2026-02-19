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
        <path
          d={roadPath}
          stroke={isDark ? 'rgba(80,150,255,0.10)' : 'rgba(70,130,220,0.09)'}
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={roadPath}
          stroke={isDark ? 'rgba(120,185,255,0.22)' : 'rgba(100,160,230,0.20)'}
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
        />
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
    </>
  );
};

export default memo(MapBackground);
