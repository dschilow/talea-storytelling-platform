import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { AgentId, AgentPhase } from '../../types/agent';
import { agentDefinitions } from '../registry';
import { AgentLoader } from './AgentLoader';

interface AgentOverlayProps {
  agentId: AgentId;
  state: AgentPhase;
  message?: string;
  visible?: boolean;
  className?: string;
}

export function AgentOverlay({
  agentId,
  state,
  message,
  visible,
  className,
}: AgentOverlayProps) {
  const agent = agentDefinitions[agentId];
  const show = visible ?? (state === 'preparing' || state === 'active');

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={cn(
            'fixed inset-0 z-50 flex items-center justify-center',
            className,
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <motion.div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at center, ${agent.colorPalette.glow} 0%, rgba(0,0,0,0.4) 100%)`,
              backdropFilter: 'blur(6px)',
            }}
          />

          <motion.div
            className="relative z-10 rounded-3xl p-8 max-w-sm w-full mx-4"
            style={{
              background: agent.colorPalette.gradient,
              border: `1px solid ${agent.colorPalette.border}`,
              boxShadow: `0 24px 64px ${agent.colorPalette.glow}, 0 0 0 1px ${agent.colorPalette.border}`,
            }}
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <AgentLoader agentId={agentId} message={message} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
