import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { AgentId, AgentPhase } from '../../types/agent';
import { agentDefinitions } from '../registry';
import { AgentIcon } from '../icons/AgentIcons';
import { AgentAnimation } from '../animations/AgentAnimations';

interface AgentCardProps {
  agentId: AgentId;
  state?: AgentPhase;
  message?: string;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

export function AgentCard({
  agentId,
  state = 'hidden',
  message,
  className,
  children,
  onClick,
}: AgentCardProps) {
  const agent = agentDefinitions[agentId];
  const isAnimating = state === 'preparing' || state === 'active';

  return (
    <motion.div
      className={cn(
        'relative rounded-2xl overflow-hidden p-5',
        onClick && 'cursor-pointer',
        className,
      )}
      style={{
        background: agent.colorPalette.gradient,
        border: `1px solid ${agent.colorPalette.border}`,
        boxShadow: isAnimating
          ? `0 8px 32px ${agent.colorPalette.glow}`
          : `0 4px 16px ${agent.colorPalette.glow}`,
      }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      whileHover={onClick ? { y: -2, boxShadow: `0 12px 40px ${agent.colorPalette.glow}` } : undefined}
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        <AgentAnimation agentId={agentId} state={isAnimating ? state : 'hidden'}>
          <div
            className="rounded-full flex items-center justify-center shrink-0"
            style={{
              width: 52,
              height: 52,
              background: `${agent.colorPalette.bg}`,
              border: `1.5px solid ${agent.colorPalette.border}`,
              color: agent.colorPalette.primary,
            }}
          >
            <AgentIcon agentId={agentId} size={30} />
          </div>
        </AgentAnimation>

        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm" style={{ color: agent.colorPalette.text }}>
              {agent.name}
            </span>
            <span className="text-xs opacity-50" style={{ color: agent.colorPalette.text }}>
              {agent.title}
            </span>
          </div>

          {message && (
            <motion.p
              className="text-sm leading-relaxed"
              style={{ color: agent.colorPalette.text, opacity: 0.8 }}
              key={message}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
            >
              {message}
            </motion.p>
          )}

          {children && <div className="mt-2">{children}</div>}
        </div>
      </div>

      {state === 'success' && (
        <motion.div
          className="absolute top-3 right-3"
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              background: agent.colorPalette.primary,
              color: 'white',
            }}
          >
            &#10003;
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
