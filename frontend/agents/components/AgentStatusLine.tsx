import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { AgentId, AgentPhase } from '../../types/agent';
import { agentDefinitions } from '../registry';
import { AgentIcon } from '../icons/AgentIcons';

interface AgentStatusLineProps {
  agentId: AgentId;
  state: AgentPhase;
  message?: string;
  className?: string;
}

export function AgentStatusLine({ agentId, state, message, className }: AgentStatusLineProps) {
  const agent = agentDefinitions[agentId];
  const visible = state !== 'hidden';
  const isActive = state === 'preparing' || state === 'active';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-xl',
            className,
          )}
          style={{
            background: agent.colorPalette.bgSubtle,
            border: `1px solid ${agent.colorPalette.border}`,
          }}
          initial={{ opacity: 0, y: 8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        >
          <div className="shrink-0" style={{ color: agent.colorPalette.primary }}>
            <AgentIcon agentId={agentId} size={18} />
          </div>

          {isActive && (
            <span className="flex gap-0.5 shrink-0">
              {[0, 1, 2].map(i => (
                <motion.span
                  key={i}
                  className="block rounded-full"
                  style={{
                    width: 3,
                    height: 3,
                    backgroundColor: agent.colorPalette.primary,
                  }}
                  animate={{ y: [0, -4, 0] }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.15,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </span>
          )}

          <motion.span
            className="text-sm leading-snug"
            style={{ color: agent.colorPalette.text }}
            key={message}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {message}
          </motion.span>

          {state === 'success' && (
            <motion.span
              className="ml-auto text-sm"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              style={{ color: agent.colorPalette.primary }}
            >
              &#10003;
            </motion.span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
