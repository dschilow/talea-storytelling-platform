import { motion, type TargetAndTransition, type Transition } from 'framer-motion';
import type { ReactNode } from 'react';
import type { AgentAnimationType, AgentId, AgentPhase } from '../../types/agent';
import { agentDefinitions } from '../registry';

interface AnimationWrapperProps {
  agentId: AgentId;
  state: AgentPhase;
  children: ReactNode;
  className?: string;
}

const stateToAnimating = (state: AgentPhase) =>
  state === 'preparing' || state === 'active';

export function AgentAnimation({ agentId, state, children, className }: AnimationWrapperProps) {
  const { animationType, colorPalette } = agentDefinitions[agentId];
  const animating = stateToAnimating(state);

  return (
    <div className={className} data-agent-animated style={{ position: 'relative', display: 'inline-flex' }}>
      {animating && <GlowRing color={colorPalette.glow} animationType={animationType} />}
      <AnimationShell animationType={animationType} animating={animating}>
        {children}
      </AnimationShell>
      {animating && <ParticleField color={colorPalette.primary} animationType={animationType} />}
    </div>
  );
}

function AnimationShell({
  animationType,
  animating,
  children,
}: {
  animationType: AgentAnimationType;
  animating: boolean;
  children: ReactNode;
}) {
  const config = animationConfigs[animationType];

  if (!animating) {
    return <motion.div initial={false} animate={{ scale: 1, opacity: 1 }}>{children}</motion.div>;
  }

  return (
    <motion.div
      animate={config.animate}
      transition={config.transition}
      style={{ position: 'relative', zIndex: 1 }}
    >
      {children}
    </motion.div>
  );
}

function GlowRing({ color, animationType }: { color: string; animationType: AgentAnimationType }) {
  const isShield = animationType === 'shield-glow';
  return (
    <motion.div
      style={{
        position: 'absolute',
        inset: isShield ? -6 : -4,
        borderRadius: '50%',
        border: `1.5px solid ${color}`,
        boxShadow: `0 0 12px ${color}`,
        zIndex: 0,
        pointerEvents: 'none',
      }}
      animate={{
        opacity: [0.3, 0.6, 0.3],
        scale: [1, isShield ? 1.12 : 1.08, 1],
      }}
      transition={{
        duration: isShield ? 3 : 2.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

function ParticleField({ color, animationType }: { color: string; animationType: AgentAnimationType }) {
  const count = particleCount[animationType] ?? 3;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            width: particleSize(animationType),
            height: particleSize(animationType),
            borderRadius: '50%',
            backgroundColor: color,
            bottom: '20%',
            left: `${25 + (i * 50) / count}%`,
            zIndex: 0,
            pointerEvents: 'none',
          }}
          animate={{
            y: [0, -18 - i * 4],
            x: [0, (i % 2 === 0 ? 1 : -1) * (4 + i * 2)],
            opacity: [0, 0.8, 0],
            scale: [0.8, 1, 0.3],
          }}
          transition={{
            duration: 1.8 + i * 0.3,
            repeat: Infinity,
            delay: i * 0.4,
            ease: 'easeOut',
          }}
        />
      ))}
    </>
  );
}

function particleSize(type: AgentAnimationType): number {
  switch (type) {
    case 'spark-bounce': return 4;
    case 'crystal-forge': return 5;
    case 'star-connect': return 3;
    default: return 3;
  }
}

const particleCount: Partial<Record<AgentAnimationType, number>> = {
  'spark-bounce': 5,
  'crystal-forge': 4,
  'star-connect': 4,
  'feather-trail': 2,
  'float-pulse': 3,
  'shield-glow': 0,
  'compass-spin': 2,
  'lens-shimmer': 2,
};

const animationConfigs: Record<AgentAnimationType, { animate: TargetAndTransition; transition: Transition }> = {
  'float-pulse': {
    animate: { y: [0, -6, 0], scale: [1, 1.03, 1] },
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
  },
  'feather-trail': {
    animate: { x: [0, 3, -2, 1, 0], y: [0, -4, -7, -3, 0], rotate: [0, 2, -1, 1, 0] },
    transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
  },
  'star-connect': {
    animate: { scale: [0.97, 1.04, 0.97], opacity: [0.85, 1, 0.85] },
    transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
  },
  'shield-glow': {
    animate: { scale: [1, 1.01, 1] },
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
  },
  'spark-bounce': {
    animate: { y: [0, -5, 0, -3, 0] },
    transition: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
  },
  'crystal-forge': {
    animate: { scale: [1, 1.04, 1.01, 1], filter: ['brightness(1)', 'brightness(1.15)', 'brightness(1.05)', 'brightness(1)'] },
    transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' },
  },
  'compass-spin': {
    animate: { rotate: [0, 15, -10, 5, 0] },
    transition: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' },
  },
  'lens-shimmer': {
    animate: { opacity: [0.85, 1, 0.85], filter: ['brightness(1)', 'brightness(1.12)', 'brightness(1)'] },
    transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
  },
};
