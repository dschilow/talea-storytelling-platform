import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { agentDefinitions } from '../registry';
import { AgentIcon } from '../icons/AgentIcons';
import type { AgentId } from '../../types/agent';

interface InsightLine {
  agentId: AgentId;
  text: string;
}

interface ParentInsightCardProps {
  title?: string;
  insights: InsightLine[];
  className?: string;
}

/**
 * Parent-facing card showing educational/developmental insights.
 * Uses Leuchtglas, Traumwächter, Flüsterfeder in a calm, informative style.
 */
export function ParentInsightCard({
  title = 'Einblick in diese Reise',
  insights,
  className,
}: ParentInsightCardProps) {
  const leuchtglas = agentDefinitions.leuchtglas;

  if (insights.length === 0) return null;

  return (
    <motion.div
      className={cn('rounded-2xl p-5', className)}
      style={{
        background: leuchtglas.colorPalette.gradient,
        border: `1px solid ${leuchtglas.colorPalette.border}`,
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{
            background: leuchtglas.colorPalette.bg,
            border: `1px solid ${leuchtglas.colorPalette.border}`,
            color: leuchtglas.colorPalette.primary,
          }}
        >
          <AgentIcon agentId="leuchtglas" size={16} />
        </div>
        <span className="text-sm font-semibold" style={{ color: leuchtglas.colorPalette.text }}>
          {title}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {insights.map((insight, i) => {
          const def = agentDefinitions[insight.agentId];
          return (
            <motion.div
              key={i}
              className="flex items-start gap-2.5"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <div
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{ color: def.colorPalette.primary }}
              >
                <AgentIcon agentId={insight.agentId} size={13} />
              </div>
              <p className="text-xs leading-relaxed" style={{ color: leuchtglas.colorPalette.text, opacity: 0.85 }}>
                {insight.text}
              </p>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
