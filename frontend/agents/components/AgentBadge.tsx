import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { AgentId, AgentSize, AgentState } from '../../types/agent';
import { agentDefinitions } from '../registry';
import { AgentIcon } from '../icons/AgentIcons';
import { AgentAnimation } from '../animations/AgentAnimations';

interface AgentBadgeProps {
  agentId: AgentId;
  state?: AgentState;
  size?: AgentSize;
  showLabel?: boolean;
  className?: string;
  onClick?: () => void;
}

const sizeMap = {
  small: { icon: 20, container: 36, text: 'text-xs' },
  medium: { icon: 28, container: 48, text: 'text-sm' },
  large: { icon: 40, container: 64, text: 'text-base' },
} as const;

export function AgentBadge({
  agentId,
  state = 'idle',
  size = 'medium',
  showLabel = false,
  className,
  onClick,
}: AgentBadgeProps) {
  const agent = agentDefinitions[agentId];
  const s = sizeMap[size];
  const isAnimating = state === 'preparing' || state === 'active';

  return (
    <motion.div
      className={cn('inline-flex items-center gap-2', className)}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: state === 'hidden' ? 0 : 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(); } : undefined}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <AgentAnimation agentId={agentId} state={isAnimating ? state : 'idle'}>
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            width: s.container,
            height: s.container,
            background: agent.colorPalette.bg,
            border: `1.5px solid ${agent.colorPalette.border}`,
            color: agent.colorPalette.primary,
          }}
        >
          <AgentIcon agentId={agentId} size={s.icon} />
        </div>
      </AgentAnimation>

      {showLabel && (
        <div className="flex flex-col">
          <span
            className={cn('font-medium leading-tight', s.text)}
            style={{ color: agent.colorPalette.text }}
          >
            {agent.name}
          </span>
          {size !== 'small' && (
            <span
              className="text-xs leading-tight opacity-60"
              style={{ color: agent.colorPalette.text }}
            >
              {agent.title}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}
