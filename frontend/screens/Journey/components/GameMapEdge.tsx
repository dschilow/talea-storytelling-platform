/**
 * GameMapEdge.tsx
 * SVG edge between two node positions in the scrollable map.
 * Three states: done (green glow + dot), available (blue + animated dot), locked (faint dashed).
 */
import React, { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface GameMapEdgeProps {
  fromX: number;  // % of container width
  fromY: number;  // px
  toX: number;
  toY: number;
  edgeState: 'done' | 'available' | 'locked';
  isDark: boolean;
  edgeIndex: number;
}

const GameMapEdge: React.FC<GameMapEdgeProps> = ({
  fromX, fromY, toX, toY, edgeState, isDark, edgeIndex,
}) => {
  const reduceMotion = useReducedMotion() ?? false;

  const dy = Math.abs(toY - fromY) * 0.35;
  const d = `M ${fromX} ${fromY} C ${fromX} ${fromY + dy}, ${toX} ${toY - dy}, ${toX} ${toY}`;

  const colors = {
    done: {
      glow: isDark ? 'rgba(34,201,154,0.6)' : 'rgba(34,180,140,0.55)',
      main: isDark ? 'rgba(34,201,154,0.7)' : 'rgba(34,180,140,0.65)',
      dot:  '#22c99a',
    },
    available: {
      glow: isDark ? 'rgba(100,180,255,0.55)' : 'rgba(80,150,240,0.50)',
      main: isDark ? 'rgba(100,180,255,0.65)' : 'rgba(80,150,240,0.60)',
      dot:  isDark ? '#88ccff' : '#60a0e8',
    },
    locked: {
      glow: 'transparent',
      main: isDark ? 'rgba(50,70,100,0.18)' : 'rgba(120,120,140,0.13)',
      dot:  'transparent',
    },
  }[edgeState];

  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;

  return (
    <g>
      {/* Outer glow */}
      {edgeState !== 'locked' && (
        <path
          d={d}
          stroke={colors.glow}
          strokeWidth={edgeState === 'done' ? 4.5 : 3.5}
          fill="none"
          strokeLinecap="round"
          opacity={0.35}
        />
      )}

      {/* Main path */}
      <path
        d={d}
        stroke={colors.main}
        strokeWidth={edgeState === 'locked' ? 0.8 : 1.8}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={edgeState === 'locked' ? '2 5' : 'none'}
      />

      {/* Animated traveling dot */}
      {edgeState === 'available' && !reduceMotion && (
        <motion.circle
          r={2}
          fill={colors.dot}
          animate={{
            cx: [fromX, midX, toX],
            cy: [fromY, midY, toY],
            opacity: [0, 0.85, 0],
          }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: edgeIndex * 0.35,
          }}
        />
      )}
      {edgeState === 'done' && !reduceMotion && (
        <motion.circle
          r={1.5}
          fill="#22c99a"
          animate={{
            cx: [fromX, midX, toX],
            cy: [fromY, midY, toY],
            opacity: [0, 0.55, 0],
          }}
          transition={{
            duration: 3.5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: edgeIndex * 0.4,
          }}
        />
      )}
    </g>
  );
};

export default memo(GameMapEdge);
