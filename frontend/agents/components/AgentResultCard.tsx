import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { AgentResult } from '../../types/agent';
import { agentDefinitions } from '../registry';
import { AgentIcon } from '../icons/AgentIcons';

interface AgentResultCardProps {
  result: AgentResult;
  onAction?: (action: string, payload?: Record<string, unknown>) => void;
  onDismiss?: () => void;
  className?: string;
}

export function AgentResultCard({ result, onAction, onDismiss, className }: AgentResultCardProps) {
  const def = agentDefinitions[result.agentId];

  return (
    <motion.div
      layout
      className={cn('relative rounded-2xl overflow-hidden', className)}
      style={{
        background: def.colorPalette.gradient,
        border: `1px solid ${def.colorPalette.border}`,
        boxShadow: `0 4px 20px ${def.colorPalette.glow}`,
      }}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
    >
      <div className="flex gap-3.5 p-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{
            background: def.colorPalette.bg,
            border: `1.5px solid ${def.colorPalette.border}`,
            color: def.colorPalette.primary,
          }}
        >
          <AgentIcon agentId={result.agentId} size={24} />
        </div>

        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold" style={{ color: def.colorPalette.text, opacity: 0.6 }}>
            {def.name}
          </span>
          <p className="mt-0.5 text-sm font-semibold leading-snug" style={{ color: def.colorPalette.text }}>
            {result.headline}
          </p>
          {result.body && (
            <p className="mt-1 text-xs leading-relaxed" style={{ color: def.colorPalette.text, opacity: 0.75 }}>
              {result.body}
            </p>
          )}

          {result.cta && (
            <motion.button
              type="button"
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-shadow hover:shadow-md"
              style={{
                background: def.colorPalette.primary,
                color: '#fff',
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onAction?.(result.cta!.action, result.cta!.payload)}
            >
              {result.cta.label}
            </motion.button>
          )}
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-xs opacity-40 transition-opacity hover:opacity-70"
            style={{ color: def.colorPalette.text }}
            aria-label="Schließen"
          >
            ×
          </button>
        )}
      </div>
    </motion.div>
  );
}
