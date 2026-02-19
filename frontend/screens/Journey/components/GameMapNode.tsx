/**
 * GameMapNode.tsx
 * Custom React Flow node – looks like a game station (round button with icon/title/status).
 * Contains all animations: float, pulse, squash-tap, done-burst, reward badge.
 */
import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from 'framer-motion';
import {
  BookOpen, CheckCircle2, Flame, GitFork,
  Headphones, HelpCircle, Lock, Sparkles,
} from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import type { NodeType } from '../TaleaLearningPathTypes';
import type { GameNodeData, GameFlowNode } from '../hooks/useMapFlowData';

// ─── Icon / Color / Label mappings ──────────────────────────────────────────

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

// ─── Framer Variants ────────────────────────────────────────────────────────

const nodeEnterVariant: Variants = {
  hidden: { opacity: 0, scale: 0.35, y: 16 },
  show: (delay: number) => ({
    opacity: 1, scale: 1, y: 0,
    transition: { delay, type: 'spring', stiffness: 370, damping: 17, mass: 0.72 },
  }),
};

// ─── Sub-components ─────────────────────────────────────────────────────────

const PulseRings: React.FC<{ color: string }> = memo(({ color }) => (
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

const DoneBurst: React.FC<{ color: string }> = memo(({ color }) => (
  <>
    <motion.span
      className="pointer-events-none absolute inset-[-4px] rounded-full"
      style={{ border: `2px dashed ${color}55` }}
      animate={{ rotate: 360 }}
      transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
    />
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
          duration: 2.4, delay: (deg / 360) * 1.2,
          repeat: Infinity, ease: 'easeInOut',
        }}
      />
    ))}
  </>
));

// ─── Main Component ─────────────────────────────────────────────────────────

const GameMapNode: React.FC<NodeProps<GameFlowNode>> = ({ data }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const reduceMotion = useReducedMotion() ?? false;

  const { mapNode: node, state, isLastActive, isHeuteHighlighted, nodeIndex } = data;
  const isLocked    = state === 'locked';
  const isDone      = state === 'done';
  const isAvailable = state === 'available';

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

  const shadow = isDone
    ? `0 0 12px ${color}44, 0 8px 22px rgba(6,12,22,0.30)`
    : '0 8px 26px rgba(6,12,22,0.34)';

  return (
    <motion.div
      custom={nodeIndex * 0.038}
      variants={nodeEnterVariant}
      initial="hidden"
      animate="show"
      style={{ width: 88, height: 88 }}
    >
      {/* Invisible handles for edge connections */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 1, height: 1 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 1, height: 1 }} />

      {/* Node button */}
      <motion.div
        className="relative flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full border-2 text-center"
        style={{
          borderColor: isLocked
            ? (isDark ? '#1c3050' : '#bbb0a4')
            : `${color}80`,
          background: bgClr,
          cursor: isLocked ? 'not-allowed' : 'pointer',
          boxShadow: shadow,
          opacity: isLocked ? 0.58 : 1,
        }}
        animate={!reduceMotion && isAvailable ? {
          y: [0, -8, 0],
          rotate: [-0.7, 0.7, -0.7],
        } : {}}
        transition={!reduceMotion && isAvailable ? {
          y: { duration: 2.9 + (nodeIndex % 4) * 0.38, repeat: Infinity, ease: 'easeInOut' },
          rotate: { duration: 3.4 + (nodeIndex % 3) * 0.44, repeat: Infinity, ease: 'easeInOut' },
        } : {}}
        whileTap={isLocked ? {} : { scaleX: 1.16, scaleY: 0.84, transition: { duration: 0.07 } }}
        whileHover={isLocked ? {} : { scale: 1.07, transition: { type: 'spring', stiffness: 380, damping: 18 } }}
      >
        {/* Pulse rings for available */}
        {!reduceMotion && isAvailable && <PulseRings color={color} />}

        {/* Heute-Highlight */}
        {isHeuteHighlighted && !isLocked && (
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

        {/* Done burst */}
        {isDone && !reduceMotion && <DoneBurst color={color} />}

        {/* Reward badge */}
        {!isLocked && !isDone && node.rewardPreview?.chestPossible && (
          <motion.span
            className="absolute -right-1.5 -top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-[11px] shadow-lg"
            animate={!reduceMotion ? { scale: [1, 1.22, 1], rotate: [0, 14, -14, 0] } : {}}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            🎁
          </motion.span>
        )}

        {/* Icon */}
        <motion.span
          className="flex items-center justify-center"
          animate={!reduceMotion && isAvailable ? { rotate: [0, 8, -8, 0] } : { rotate: 0 }}
          transition={!reduceMotion && isAvailable ? { duration: 4.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
        >
          <Icon
            className="h-6 w-6"
            style={{ color, filter: isDone ? `drop-shadow(0 0 5px ${color}90)` : 'none' }}
          />
        </motion.span>

        {/* Title */}
        <span
          className="mt-1 line-clamp-2 px-1.5 text-[9px] font-bold leading-tight"
          style={{ color: isDark ? '#ddeeff' : '#283850', opacity: isLocked ? 0.42 : 1 }}
        >
          {node.title}
        </span>

        {/* Type badge */}
        <span
          className="mt-0.5 rounded-full px-1.5 py-[2px] text-[8px] font-black uppercase tracking-[0.06em]"
          style={{
            color,
            border: `1px solid ${color}${isLocked ? '28' : '60'}`,
            background: isDark ? 'rgba(8,16,28,0.68)' : 'rgba(255,254,250,0.82)',
          }}
        >
          {NODE_LABEL[node.type]}
        </span>

        {/* Fork direction badges */}
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

        {/* Done check badge */}
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
                  color: isDark ? '#72e4b8' : '#38967a',
                  filter: `drop-shadow(0 0 5px ${color}80)`,
                }}
              />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>

      {/* "Du bist hier!" marker */}
      {isLastActive && (
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
};

export default memo(GameMapNode);
