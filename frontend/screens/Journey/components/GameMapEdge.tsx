import React, { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface GameMapEdgeProps {
  fromX: number;  // % of container width
  fromY: number;  // px
  toX: number;
  toY: number;
  edgeState: 'done' | 'available' | 'locked' | 'echo';
  isDark: boolean;
  edgeIndex: number;
}

const GameMapEdge: React.FC<GameMapEdgeProps> = ({
  fromX, fromY, toX, toY, edgeState, isDark, edgeIndex,
}) => {
  const reduceMotion = useReducedMotion() ?? false;

  const dy = Math.abs(toY - fromY) * 0.45;
  const d = `M ${fromX} ${fromY} C ${fromX} ${fromY + dy}, ${toX} ${toY - dy}, ${toX} ${toY}`;

  const colors = {
    done: {
      glow: isDark ? 'rgba(34,201,154,0.8)' : 'rgba(34,180,140,0.7)',
      main: isDark ? 'rgba(44,221,174,1)' : 'rgba(28,150,116,1)',
      inner: isDark ? 'rgba(200,255,230,0.8)' : 'rgba(200,255,230,0.5)',
      dot: '#22c99a',
    },
    available: {
      glow: isDark ? 'rgba(100,180,255,0.7)' : 'rgba(80,150,240,0.6)',
      main: isDark ? 'rgba(120,195,255,1)' : 'rgba(60,130,220,1)',
      inner: isDark ? 'rgba(220,240,255,0.8)' : 'rgba(220,240,255,0.5)',
      dot: isDark ? '#aaddff' : '#4080e8',
    },
    locked: {
      glow: 'transparent',
      main: isDark ? 'rgba(50,70,100,0.4)' : 'rgba(150,150,170,0.4)',
      inner: 'transparent',
      dot: 'transparent',
    },
    echo: { // New state for dynamically generated paths (e.g. Doku unlocked through Story)
      glow: isDark ? 'rgba(255,180,50,0.8)' : 'rgba(240,160,30,0.7)',
      main: isDark ? 'rgba(255,200,70,1)' : 'rgba(230,140,20,1)',
      inner: isDark ? 'rgba(255,240,200,0.8)' : 'rgba(255,240,200,0.5)',
      dot: '#ffb432',
    }
  }[edgeState];

  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;
  const strokeW = edgeState === 'locked' ? 2 : (edgeState === 'echo' ? 4 : 3.5);

  return (
    <g>
      {/* Heavy outer glow for active/done/echo paths */}
      {edgeState !== 'locked' && (
        <>
          <path
            d={d}
            stroke={colors.glow}
            strokeWidth={strokeW * 4}
            fill="none"
            strokeLinecap="round"
            opacity={0.25}
            style={{ filter: 'blur(4px)' }}
          />
          <path
            d={d}
            stroke={colors.glow}
            strokeWidth={strokeW * 2}
            fill="none"
            strokeLinecap="round"
            opacity={0.4}
            style={{ filter: 'blur(2px)' }}
          />
        </>
      )}

      {/* Main core path */}
      <path
        d={d}
        stroke={colors.main}
        strokeWidth={strokeW}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={edgeState === 'locked' ? '4 8' : 'none'}
      />

      {/* Inner highlight core to make it pop like a neon tube */}
      {edgeState !== 'locked' && (
        <path
          d={d}
          stroke={colors.inner}
          strokeWidth={strokeW * 0.4}
          fill="none"
          strokeLinecap="round"
        />
      )}

      {/* Animated traveling dot */}
      {(edgeState === 'available' || edgeState === 'echo') && !reduceMotion && (
        <motion.circle
          r={edgeState === 'echo' ? 3 : 2.5}
          fill={colors.dot}
          animate={{
            cx: [fromX, midX, toX],
            cy: [fromY, midY, toY],
            opacity: [0, 1, 0],
            scale: edgeState === 'echo' ? [0.8, 1.4, 0.8] : [1, 1, 1],
          }}
          transition={{
            duration: edgeState === 'echo' ? 2.0 : 2.5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: edgeIndex * 0.35,
          }}
          style={{
            filter: `drop-shadow(0 0 6px ${colors.glow})`
          }}
        />
      )}

      {edgeState === 'done' && !reduceMotion && (
        <motion.circle
          r={2}
          fill="#22c99a"
          animate={{
            cx: [fromX, midX, toX],
            cy: [fromY, midY, toY],
            opacity: [0, 0.7, 0],
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
