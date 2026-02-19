/**
 * TaleaMapNodeRenderer.tsx
 * Phase A – Runde Stationsbuttons auf der Reise-Karte
 *
 * Positionen werden in % (x, y relativ zum Segment) übergeben.
 * Jeder Node-Typ hat ein eigenes Icon + Farbe.
 * Status: locked (grau), available (farbig), done (grün+Häkchen).
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Lock, CheckCircle2, BookOpen, HelpCircle, Sparkles, Headphones, Flame, GitFork, Gift } from 'lucide-react';
import type { MapNode, NodeState, NodeType } from './TaleaLearningPathTypes';

// ─── Node-Stil-Config ─────────────────────────────────────────────────────────
const NODE_CONFIG: Record<NodeType, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  DokuStop: {
    icon: <BookOpen className="h-6 w-6" />,
    color: '#4f8cf5',
    bg: 'rgba(79,140,245,0.15)',
    label: 'Doku',
  },
  QuizStop: {
    icon: <HelpCircle className="h-6 w-6" />,
    color: '#9b5ef5',
    bg: 'rgba(155,94,245,0.15)',
    label: 'Quiz',
  },
  StoryGate: {
    icon: <Sparkles className="h-6 w-6" />,
    color: '#f56b9b',
    bg: 'rgba(245,107,155,0.15)',
    label: 'Story',
  },
  StudioStage: {
    icon: <Headphones className="h-6 w-6" />,
    color: '#22c99a',
    bg: 'rgba(34,201,154,0.15)',
    label: 'Audio',
  },
  MemoryFire: {
    icon: <Flame className="h-6 w-6" />,
    color: '#f5a623',
    bg: 'rgba(245,166,35,0.15)',
    label: 'Erinnerung',
  },
  Fork: {
    icon: <GitFork className="h-6 w-6" />,
    color: '#5eb8f5',
    bg: 'rgba(94,184,245,0.15)',
    label: 'Abzweigung',
  },
};

const NODE_SIZE = 72; // px Durchmesser

interface Props {
  node: MapNode;
  state: NodeState;
  accent: string;
  glow: string;
  isDark: boolean;
  isLastActive: boolean;
  containerWidth: number;
  onClick: () => void;
}

const TaleaMapNodeRenderer: React.FC<Props> = ({
  node,
  state,
  accent,
  glow,
  isDark,
  isLastActive,
  containerWidth,
  onClick,
}) => {
  const cfg = NODE_CONFIG[node.type];
  const isLocked = state === 'locked';
  const isDone = state === 'done';
  const isAvailable = state === 'available';

  // Positionierung: x/y in % → absolute Pixel
  const left = `calc(${node.x}% - ${NODE_SIZE / 2}px)`;
  const top = `calc(${node.y}% - ${NODE_SIZE / 2}px)`;

  // Farben je Status
  const borderColor = isLocked
    ? isDark ? '#2a3d52' : '#d8cfc2'
    : isDone
      ? '#22c99a'
      : cfg.color;

  const iconColor = isLocked
    ? isDark ? '#3d5168' : '#b8c4cc'
    : isDone
      ? '#22c99a'
      : cfg.color;

  const bgColor = isLocked
    ? isDark ? 'rgba(20,32,46,0.8)' : 'rgba(240,235,228,0.8)'
    : isDone
      ? 'rgba(34,201,154,0.12)'
      : cfg.bg;

  return (
    <motion.button
      type="button"
      aria-label={`${node.title} – ${state}`}
      onClick={isLocked ? undefined : onClick}
      disabled={isLocked}
      style={{
        position: 'absolute',
        left,
        top,
        width: NODE_SIZE,
        height: NODE_SIZE,
        zIndex: 2,
        cursor: isLocked ? 'not-allowed' : 'pointer',
      }}
      whileHover={isLocked ? undefined : { scale: 1.08 }}
      whileTap={isLocked ? undefined : { scale: 0.94 }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {/* Glow-Ring bei "available" oder "isLastActive" */}
      {(isAvailable || isLastActive) && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow: `0 0 0 4px ${borderColor}40, 0 0 18px ${borderColor}30`,
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Haupt-Kreis */}
      <div
        className="relative flex h-full w-full flex-col items-center justify-center rounded-full border-2 transition-colors"
        style={{
          borderColor,
          background: bgColor,
          boxShadow: isLocked
            ? 'none'
            : `0 4px 16px ${cfg.color}22, 0 2px 6px rgba(0,0,0,0.1)`,
        }}
      >
        {/* Icon oder Lock */}
        <span style={{ color: iconColor }}>
          {isLocked ? (
            <Lock className="h-6 w-6" />
          ) : isDone ? (
            <CheckCircle2 className="h-6 w-6" />
          ) : (
            cfg.icon
          )}
        </span>

        {/* Reward-Badge */}
        {!isLocked && !isDone && node.rewardPreview?.chestPossible && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] shadow-md">
            🎁
          </span>
        )}

        {/* Typ-Label – klein unter dem Icon */}
        <span
          className="mt-0.5 text-[9px] font-bold uppercase tracking-wide leading-none"
          style={{ color: iconColor, opacity: isLocked ? 0.4 : 0.7 }}
        >
          {cfg.label}
        </span>
      </div>

      {/* Titel-Chip unter dem Kreis */}
      <div
        className="absolute left-1/2 top-full mt-1.5 max-w-[120px] -translate-x-1/2 rounded-full border px-2 py-0.5 text-center"
        style={{
          borderColor: isLocked ? (isDark ? '#2a3d52' : '#ddd4c8') : `${borderColor}50`,
          background: isDark ? 'rgba(14,22,36,0.85)' : 'rgba(255,252,246,0.9)',
          backdropFilter: 'blur(4px)',
        }}
      >
        <p
          className="truncate text-[10px] font-semibold leading-snug"
          style={{ color: isLocked ? (isDark ? '#4a6070' : '#a0a8b0') : (isDark ? '#d8e8f8' : '#1e2a3a') }}
        >
          {node.title}
        </p>
      </div>
    </motion.button>
  );
};

export default TaleaMapNodeRenderer;
