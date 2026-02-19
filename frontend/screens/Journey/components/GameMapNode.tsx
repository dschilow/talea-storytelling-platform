/**
 * GameMapNode.tsx
 * Game station node – round button with icon/title/status.
 * Absolute-positioned in the scrollable map container.
 * All animations: float, pulse, squash-tap, done-burst, reward badge.
 */
import React, { memo, forwardRef } from 'react';
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
import type { NodeType, MapNode, NodeState } from '../TaleaLearningPathTypes';
import { ROUTE_TO_TRAITS, ROUTE_META } from '../constants/routeTraitMapping';
import { getTraitIcon } from '../../../constants/traits';

// ─── Icon / Color / Label mappings ──────────────────────────────────────────

const NODE_ICON: Record<NodeType, React.ElementType> = {
  DokuStop: BookOpen,
  QuizStop: HelpCircle,
  StoryGate: Sparkles,
  StudioStage: Headphones,
  MemoryFire: Flame,
  Fork: GitFork,
};

export const NODE_COLOR: Record<NodeType, string> = {
  DokuStop: '#4f8cf5',
  QuizStop: '#9b5ef5',
  StoryGate: '#f56b9b',
  StudioStage: '#22c99a',
  MemoryFire: '#f5a623',
  Fork: '#5eb8f5',
};

const NODE_LABEL: Record<NodeType, string> = {
  DokuStop: 'Doku',
  QuizStop: 'Quiz',
  StoryGate: 'Story',
  StudioStage: 'Audio',
  MemoryFire: 'Feuer',
  Fork: 'Weg',
};

// ─── Framer Variants ────────────────────────────────────────────────────────

const nodeEnterVariant: Variants = {
  hidden: { opacity: 0, scale: 0.35, scaleY: 1.45, y: 16 },
  show: (delay: number) => ({
    opacity: 1, scale: 1, scaleY: 1, y: 0,
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
          top: `calc(50% - 3px + ${Math.sin((deg * Math.PI) / 180) * 34}px)`,
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

// ─── Props ──────────────────────────────────────────────────────────────────

export interface GameMapNodeProps {
  node: MapNode;
  state: NodeState;
  isDark: boolean;
  isLastActive: boolean;
  isHeuteHighlighted: boolean;
  isSelected: boolean;
  nodeIndex: number;
  mapY: number;
  xPercent: number;
  onClick: () => void;
  progressToNextRank?: number; // 0-100
}

// ─── Progress Ring Sub-component ─────────────────────────────────────────────

const ProgressRing: React.FC<{ progress: number; color: string; size: number }> = ({
  progress, color, size
}) => {
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="pointer-events-none absolute inset-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(148,163,184,0.12)"
        strokeWidth="3"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        style={{ strokeDasharray: circumference, rotate: -90, transformOrigin: 'center' }}
      />
    </svg>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

const GameMapNode = forwardRef<HTMLDivElement, GameMapNodeProps>(({
  node, state, isDark, isLastActive, isHeuteHighlighted, isSelected,
  nodeIndex, mapY, xPercent, onClick, progressToNextRank = 0,
}, ref) => {
  const reduceMotion = useReducedMotion() ?? false;

  const isLocked = state === 'locked';
  const isDone = state === 'done';
  const isAvailable = state === 'available';

  const Icon = isLocked ? Lock : isDone ? CheckCircle2 : NODE_ICON[node.type];
  const color = isLocked
    ? (isDark ? '#2a4060' : '#b0bcc8')
    : isDone ? '#22c99a'
      : NODE_COLOR[node.type];

  const bgClr = isLocked
    ? (isDark ? 'rgba(16,26,42,0.84)' : 'rgba(232,225,214,0.88)')
    : isDone
      ? (isDark ? 'rgba(26,55,46,0.72)' : 'rgba(205,238,220,0.82)')
      : (isDark ? 'rgba(14,24,40,0.82)' : 'rgba(255,252,244,0.90)');

  const shadow = isSelected
    ? `0 0 0 5px ${color}44, 0 18px 40px rgba(6,12,22,0.56)`
    : isDone
      ? `0 0 12px ${color}44, 0 8px 22px rgba(6,12,22,0.30)`
      : '0 8px 26px rgba(6,12,22,0.34)';

  return (
    <motion.div
      ref={ref}
      style={{
        position: 'absolute',
        top: `${mapY - 44}px`,
        left: `calc(${xPercent}% - 44px)`,
        zIndex: 4,
      }}
      custom={nodeIndex * 0.038}
      variants={nodeEnterVariant}
      initial="hidden"
      animate="show"
    >
      {/* Selection ring */}
      <AnimatePresence>
        {isSelected && (
          <motion.span
            key="selring"
            className="pointer-events-none absolute inset-[-6px] rounded-full"
            style={{ border: `2px dashed ${color}99` }}
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1, rotate: 360 }}
            exit={{ opacity: 0, scale: 0.75, transition: { duration: 0.18 } }}
            transition={{
              opacity: { duration: 0.22 },
              scale: { duration: 0.22 },
              rotate: { duration: 9, repeat: Infinity, ease: 'linear' },
            }}
          />
        )}
      </AnimatePresence>

      {/* Node button */}
      <motion.button
        type="button"
        onClick={onClick}
        disabled={isLocked}
        className="relative flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full border-2 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        style={{
          borderColor: isLocked
            ? (isDark ? '#1c3050' : '#bbb0a4')
            : isSelected ? color : `${color}80`,
          background: bgClr,
          cursor: isLocked ? 'not-allowed' : 'pointer',
          boxShadow: shadow,
          opacity: isLocked ? 0.58 : 1,
        }}
        animate={!reduceMotion && isAvailable ? {
          y: [0, -8, 0],
          rotate: [-0.7, 0.7, -0.7],
          scale: isSelected ? 1.11 : 1,
        } : { scale: isSelected ? 1.11 : 1 }}
        transition={!reduceMotion && isAvailable ? {
          y: { duration: 2.9 + (nodeIndex % 4) * 0.38, repeat: Infinity, ease: 'easeInOut' },
          rotate: { duration: 3.4 + (nodeIndex % 3) * 0.44, repeat: Infinity, ease: 'easeInOut' },
          scale: { type: 'spring', stiffness: 280, damping: 22 },
        } : { type: 'spring', stiffness: 300, damping: 24 }}
        whileTap={isLocked ? {} : { scaleX: 1.16, scaleY: 0.84, transition: { duration: 0.07 } }}
        whileHover={isLocked ? {} : {
          scale: isSelected ? 1.13 : 1.07,
          transition: { type: 'spring', stiffness: 380, damping: 18 },
        }}
        aria-label={`${node.title} – ${state}`}
      >
        {/* Progress ring around icon */}
        {!isLocked && (
          <div className="absolute inset-[15px] flex items-center justify-center">
            <ProgressRing progress={progressToNextRank} color={color} size={58} />
          </div>
        )}

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

        {/* Route trait icons (small row below type badge) */}
        {!isLocked && (
          <span
            className="mt-0.5 flex items-center gap-[2px] text-[8px] leading-none opacity-70"
            title={ROUTE_TO_TRAITS[node.route]?.map(t => getTraitIcon(t)).join(' ')}
          >
            {ROUTE_META[node.route] && (
              <span style={{ color: ROUTE_META[node.route].color }}>
                {ROUTE_TO_TRAITS[node.route]?.map(t => getTraitIcon(t)).join('')}
              </span>
            )}
          </span>
        )}

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
      </motion.button>

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
});

GameMapNode.displayName = 'GameMapNode';

export default memo(GameMapNode);
