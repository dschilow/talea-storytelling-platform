/**
 * GameMapEdge.tsx
 * Custom React Flow edge – glowing game-style path connection between nodes.
 * Three states: done (green glow), available (blue + animated dot), locked (faint dashed).
 */
import React, { memo } from 'react';
import { getBezierPath, type EdgeProps } from '@xyflow/react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTheme } from '../../../contexts/ThemeContext';
import type { GameFlowEdge } from '../hooks/useMapFlowData';

const GameMapEdge: React.FC<EdgeProps<GameFlowEdge>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const reduceMotion = useReducedMotion() ?? false;
  const edgeState = data?.edgeState ?? 'locked';

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const colors = {
    done: {
      glow:   isDark ? 'rgba(34,201,154,0.35)' : 'rgba(34,180,140,0.30)',
      main:   isDark ? 'rgba(34,201,154,0.7)'  : 'rgba(34,180,140,0.65)',
      dot:    '#22c99a',
    },
    available: {
      glow:   isDark ? 'rgba(100,180,255,0.30)' : 'rgba(80,150,240,0.25)',
      main:   isDark ? 'rgba(100,180,255,0.65)' : 'rgba(80,150,240,0.60)',
      dot:    isDark ? '#88ccff' : '#60a0e8',
    },
    locked: {
      glow:   'transparent',
      main:   isDark ? 'rgba(50,70,100,0.22)' : 'rgba(120,120,140,0.16)',
      dot:    'transparent',
    },
  }[edgeState];

  // Midpoint for animated dot
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  return (
    <g>
      {/* Glow layer */}
      {edgeState !== 'locked' && (
        <path
          d={edgePath}
          stroke={colors.glow}
          strokeWidth={edgeState === 'done' ? 6 : 5}
          fill="none"
          strokeLinecap="round"
        />
      )}

      {/* Main path */}
      <path
        d={edgePath}
        stroke={colors.main}
        strokeWidth={edgeState === 'locked' ? 1 : 2}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={edgeState === 'locked' ? '3 8' : 'none'}
      />

      {/* Animated traveling dot */}
      {edgeState !== 'locked' && !reduceMotion && (
        <motion.circle
          r={edgeState === 'done' ? 2 : 2.5}
          fill={colors.dot}
          animate={{
            cx: [sourceX, midX, targetX],
            cy: [sourceY, midY, targetY],
            opacity: [0, 0.85, 0],
          }}
          transition={{
            duration: edgeState === 'done' ? 3.5 : 2.4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </g>
  );
};

export default memo(GameMapEdge);
