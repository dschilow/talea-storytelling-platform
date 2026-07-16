import React from "react";
import { motion } from "framer-motion";
import type { TopicSuggestionItemDTO } from "./apiCosmosClient";
import { SuggestionCard } from "./SuggestionCard";

type SuggestionGridVariant = "cosmos" | "talea";

interface SuggestionGridProps {
  items: TopicSuggestionItemDTO[];
  isLoading?: boolean;
  onSelect: (item: TopicSuggestionItemDTO) => void;
  lastInsertedSuggestionId?: string | null;
  maxItems?: number;
  variant?: SuggestionGridVariant;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

function SkeletonCard({ variant }: { variant: SuggestionGridVariant }) {
  const talea = variant === "talea";
  return (
    <div
      className={
        talea
          ? "rounded-2xl border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] p-3 shadow-sm"
          : "rounded-2xl border border-white/8 bg-white/[0.05] p-3"
      }
    >
      <div className={talea ? "h-4 w-20 animate-pulse rounded bg-[var(--talea-border-soft)]" : "h-4 w-20 animate-pulse rounded bg-white/15"} />
      <div className={talea ? "mt-3 h-4 w-11/12 animate-pulse rounded bg-[var(--talea-border-light)]" : "mt-3 h-4 w-11/12 animate-pulse rounded bg-white/15"} />
      <div className={talea ? "mt-2 h-3 w-8/12 animate-pulse rounded bg-[var(--talea-border-light)]" : "mt-2 h-3 w-8/12 animate-pulse rounded bg-white/10"} />
      <div className={talea ? "mt-3 h-3 w-5/12 animate-pulse rounded bg-[var(--talea-border-light)]" : "mt-3 h-3 w-5/12 animate-pulse rounded bg-white/10"} />
    </div>
  );
}

export const SuggestionGrid: React.FC<SuggestionGridProps> = ({
  items,
  isLoading = false,
  onSelect,
  lastInsertedSuggestionId = null,
  maxItems,
  variant = "cosmos",
}) => {
  const visibleItems = React.useMemo(() => {
    if (typeof maxItems !== "number") return items;
    const sliced = items.slice(0, maxItems);
    if (!lastInsertedSuggestionId) return sliced;
    if (sliced.some((item) => item.suggestionId === lastInsertedSuggestionId)) {
      return sliced;
    }
    const inserted = items.find((item) => item.suggestionId === lastInsertedSuggestionId);
    if (!inserted) return sliced;
    if (sliced.length < maxItems) return [...sliced, inserted];
    return [...sliced.slice(0, maxItems - 1), inserted];
  }, [items, lastInsertedSuggestionId, maxItems]);

  if (isLoading && visibleItems.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" aria-busy="true" aria-live="polite">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={`skeleton_${index}`} variant={variant} />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
    >
      {visibleItems.map((item) => (
        <SuggestionCard
          key={item.suggestionId}
          item={item}
          onSelect={onSelect}
          isComet={item.suggestionId === lastInsertedSuggestionId}
          isOptimistic={item.suggestionId.startsWith("optimistic_")}
          variant={variant}
        />
      ))}
    </motion.div>
  );
};
