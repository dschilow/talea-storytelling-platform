import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { AgentLiveState } from '../../types/agent';
import { agentDefinitions } from '../registry';
import { AgentIcon } from '../icons/AgentIcons';
import { AgentAnimation } from '../animations/AgentAnimations';
import { useAgents } from '../AgentContext';

/**
 * Shows 1–3 currently active agents as a compact vertical stack.
 * Renders nothing when no agents are active — zero visual footprint.
 */
export function ActiveAgentStack({ className }: { className?: string }) {
  const { store } = useAgents();
  const visible = store.live.filter(a => a.phase !== 'hidden');

  if (visible.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <AnimatePresence mode="popLayout">
        {visible.map((agent) => (
          <ActiveAgentBanner key={agent.agentId} agent={agent} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ActiveAgentBanner({ agent }: { agent: AgentLiveState }) {
  const def = agentDefinitions[agent.agentId];
  const isWorking = agent.phase === 'preparing' || agent.phase === 'active';

  return (
    <motion.div
      layout
      className="flex items-center gap-3 rounded-2xl px-4 py-3"
      style={{
        background: def.colorPalette.gradient,
        border: `1px solid ${def.colorPalette.border}`,
        boxShadow: isWorking
          ? `0 6px 24px ${def.colorPalette.glow}`
          : `0 2px 12px ${def.colorPalette.glow}`,
      }}
      initial={{ opacity: 0, x: -20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
    >
      <AgentAnimation agentId={agent.agentId} state={isWorking ? agent.phase : 'hidden'}>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{
            background: def.colorPalette.bg,
            border: `1.5px solid ${def.colorPalette.border}`,
            color: def.colorPalette.primary,
          }}
        >
          <AgentIcon agentId={agent.agentId} size={22} />
        </div>
      </AgentAnimation>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: def.colorPalette.text }}>
            {def.name}
          </span>
          {isWorking && <WorkingDots color={def.colorPalette.primary} />}
          {agent.phase === 'success' && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 12 }}
              className="text-xs"
              style={{ color: def.colorPalette.primary }}
            >
              ✓
            </motion.span>
          )}
        </div>
        <motion.p
          key={agent.message}
          className="mt-0.5 text-sm leading-snug"
          style={{ color: def.colorPalette.text, opacity: 0.85 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.85 }}
          transition={{ duration: 0.25 }}
        >
          {agent.message}
        </motion.p>
      </div>
    </motion.div>
  );
}

function WorkingDots({ color }: { color: string }) {
  return (
    <span className="flex gap-0.5">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="block rounded-full"
          style={{ width: 3, height: 3, backgroundColor: color }}
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
        />
      ))}
    </span>
  );
}
