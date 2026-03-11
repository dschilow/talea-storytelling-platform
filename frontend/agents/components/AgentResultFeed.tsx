import { AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useAgents } from '../AgentContext';
import { AgentResultCard } from './AgentResultCard';

interface AgentResultFeedProps {
  className?: string;
  onAction?: (action: string, payload?: Record<string, unknown>) => void;
}

/**
 * Renders all queued agent results as a stacked feed.
 * Appears only when there are results to show.
 */
export function AgentResultFeed({ className, onAction }: AgentResultFeedProps) {
  const { store, dismissResult } = useAgents();

  if (store.results.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <AnimatePresence mode="popLayout">
        {store.results.map((result, i) => (
          <AgentResultCard
            key={`${result.agentId}-${result.timestamp}`}
            result={result}
            onAction={onAction}
            onDismiss={() => dismissResult(i)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
