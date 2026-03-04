import React from "react";
import { motion } from "framer-motion";
import type { TopicSuggestionItemDTO } from "./apiCosmosClient";
import { SuggestionCard } from "./SuggestionCard";

interface SuggestionGridProps {
  items: TopicSuggestionItemDTO[];
  isLoading?: boolean;
  onSelect: (item: TopicSuggestionItemDTO) => void;
  lastInsertedSuggestionId?: string | null;
  maxItems?: number;
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

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.05] p-3">
      <div className="h-4 w-20 animate-pulse rounded bg-white/15" />
      <div className="mt-3 h-4 w-11/12 animate-pulse rounded bg-white/15" />
      <div className="mt-2 h-3 w-8/12 animate-pulse rounded bg-white/10" />
      <div className="mt-3 h-3 w-5/12 animate-pulse rounded bg-white/10" />
    </div>
  );
}

export const SuggestionGrid: React.FC<SuggestionGridProps> = ({
  items,
  isLoading = false,
  onSelect,
  lastInsertedSuggestionId = null,
  maxItems,
}) => {
  const visibleItems = typeof maxItems === "number" ? items.slice(0, maxItems) : items;

  if (isLoading && visibleItems.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={`skeleton_${index}`} />
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
        />
      ))}
    </motion.div>
  );
};
