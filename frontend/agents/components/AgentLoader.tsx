import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { AgentId } from '../../types/agent';
import { agentDefinitions, getRandomStatusMessage } from '../registry';
import { AgentIcon } from '../icons/AgentIcons';
import { AgentAnimation } from '../animations/AgentAnimations';

interface AgentLoaderProps {
  agentId: AgentId;
  message?: string;
  className?: string;
}

export function AgentLoader({ agentId, message, className }: AgentLoaderProps) {
  const agent = agentDefinitions[agentId];
  const text = message ?? getRandomStatusMessage(agentId, 'active');

  return (
    <motion.div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-8',
        className,
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <AgentAnimation agentId={agentId} state="active">
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            width: 72,
            height: 72,
            background: agent.colorPalette.gradient,
            color: agent.colorPalette.primary,
            boxShadow: `0 8px 32px ${agent.colorPalette.glow}`,
          }}
        >
          <AgentIcon agentId={agentId} size={40} />
        </div>
      </AgentAnimation>

      <div className="flex flex-col items-center gap-1.5">
        <span
          className="text-sm font-medium"
          style={{ color: agent.colorPalette.text }}
        >
          {agent.name}
        </span>
        <motion.span
          className="text-sm text-center max-w-[260px] leading-relaxed"
          style={{ color: agent.colorPalette.text, opacity: 0.75 }}
          key={text}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 0.75, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {text}
        </motion.span>
      </div>

      <ProgressDots color={agent.colorPalette.primary} />
    </motion.div>
  );
}

function ProgressDots({ color }: { color: string }) {
  return (
    <div className="flex gap-1.5 mt-1">
      {[0, 1, 2, 3, 4].map(i => (
        <motion.span
          key={i}
          className="block rounded-full"
          style={{ width: 4, height: 4, backgroundColor: color }}
          animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.2, 0.8] }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            delay: i * 0.18,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}
