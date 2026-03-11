import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { AgentId, AgentSize } from '../../types/agent';
import { agentDefinitions } from '../registry';
import { AgentIcon } from '../icons/AgentIcons';

interface AgentPulseProps {
  agentId: AgentId;
  size?: AgentSize;
  active?: boolean;
  className?: string;
}

const sizes = {
  small: { dot: 24, icon: 14, ring: 32 },
  medium: { dot: 36, icon: 20, ring: 48 },
  large: { dot: 48, icon: 28, ring: 64 },
} as const;

export function AgentPulse({ agentId, size = 'small', active = true, className }: AgentPulseProps) {
  const agent = agentDefinitions[agentId];
  const s = sizes[size];

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      {active && (
        <>
          <motion.div
            className="absolute rounded-full"
            style={{
              width: s.ring,
              height: s.ring,
              border: `1px solid ${agent.colorPalette.primary}`,
              opacity: 0.2,
            }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0, 0.2] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute rounded-full"
            style={{
              width: s.ring - 4,
              height: s.ring - 4,
              border: `1px solid ${agent.colorPalette.primary}`,
              opacity: 0.15,
            }}
            animate={{ scale: [1, 1.25, 1], opacity: [0.15, 0, 0.15] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
          />
        </>
      )}

      <div
        className="rounded-full flex items-center justify-center relative z-10"
        style={{
          width: s.dot,
          height: s.dot,
          backgroundColor: agent.colorPalette.bg,
          border: `1.5px solid ${agent.colorPalette.border}`,
          color: agent.colorPalette.primary,
        }}
      >
        <AgentIcon agentId={agentId} size={s.icon} />
      </div>
    </div>
  );
}
