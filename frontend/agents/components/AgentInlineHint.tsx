import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { AgentId } from '../../types/agent';
import { agentDefinitions } from '../registry';
import { AgentIcon } from '../icons/AgentIcons';

interface AgentInlineHintProps {
  agentId: AgentId;
  message: string;
  visible?: boolean;
  className?: string;
}

export function AgentInlineHint({
  agentId,
  message,
  visible = true,
  className,
}: AgentInlineHintProps) {
  const agent = agentDefinitions[agentId];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg', className)}
          style={{
            background: agent.colorPalette.bgSubtle,
            border: `1px solid ${agent.colorPalette.border}`,
          }}
          initial={{ opacity: 0, x: -8, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 8, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        >
          <span style={{ color: agent.colorPalette.primary }} className="shrink-0">
            <AgentIcon agentId={agentId} size={14} />
          </span>
          <span className="text-xs leading-snug" style={{ color: agent.colorPalette.text, opacity: 0.8 }}>
            {message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
