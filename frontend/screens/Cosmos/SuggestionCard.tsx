import React from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  PlusCircle,
  Compass,
  Layers3,
  RotateCcw,
} from "lucide-react";
import type { TopicSuggestionItemDTO } from "./apiCosmosClient";

interface SuggestionCardProps {
  item: TopicSuggestionItemDTO;
  onSelect: (item: TopicSuggestionItemDTO) => void;
  isComet?: boolean;
  isOptimistic?: boolean;
}

const KIND_LABEL: Record<TopicSuggestionItemDTO["kind"], string> = {
  broaden: "Erweitern",
  deepen: "Vertiefen",
  retention: "Merken",
};

const KIND_ICON: Record<TopicSuggestionItemDTO["kind"], React.ReactNode> = {
  broaden: <Compass className="h-3.5 w-3.5" />,
  deepen: <Layers3 className="h-3.5 w-3.5" />,
  retention: <RotateCcw className="h-3.5 w-3.5" />,
};

const KIND_ACCENT: Record<TopicSuggestionItemDTO["kind"], string> = {
  broaden: "rgba(96,165,250,0.36)",
  deepen: "rgba(168,85,247,0.34)",
  retention: "rgba(245,158,11,0.34)",
};

export const SuggestionCard: React.FC<SuggestionCardProps> = ({
  item,
  onSelect,
  isComet = false,
  isOptimistic = false,
}) => {
  return (
    <motion.button
      type="button"
      layout
      initial={
        isComet
          ? { opacity: 0, x: 54, y: -22, scale: 0.76, filter: "blur(3px)" }
          : { opacity: 0, y: 16, scale: 0.98 }
      }
      animate={
        isComet
          ? {
              opacity: 1,
              x: 0,
              y: 0,
              scale: 1,
              filter: "blur(0px)",
              boxShadow: [
                "0 0 0 rgba(99,102,241,0)",
                "0 0 24px rgba(99,102,241,0.35)",
                "0 0 0 rgba(99,102,241,0)",
              ],
            }
          : { opacity: 1, y: 0, scale: 1 }
      }
      exit={{ opacity: 0, scale: 0.95 }}
      transition={
        isComet
          ? { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
          : { duration: 0.28, ease: [0.25, 1, 0.5, 1] }
      }
      onClick={() => onSelect(item)}
      className="group relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.06] p-3 text-left transition-colors hover:bg-white/[0.1] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-55"
        style={{
          background:
            "radial-gradient(circle at 10% 6%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.06) 32%, rgba(0,0,0,0) 72%)",
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/80"
          style={{ boxShadow: `0 0 0 1px ${KIND_ACCENT[item.kind]} inset` }}
        >
          {KIND_ICON[item.kind]}
          {KIND_LABEL[item.kind]}
        </span>
        <span className="text-[11px] font-semibold text-white/55">Stufe {item.difficulty}</span>
      </div>

      <h4 className="mt-2 line-clamp-2 text-sm font-extrabold text-white">{item.topicTitle}</h4>
      <p className="mt-1 line-clamp-2 text-xs text-white/75">{item.teaserKid}</p>
      <p className="mt-1 line-clamp-2 text-[11px] text-white/58">{item.reasonParent}</p>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
          Fokus: {item.skillFocus}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white/80">
          {isOptimistic ? (
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          ) : (
            <PlusCircle className="h-3.5 w-3.5" />
          )}
          {isOptimistic ? "Generiert..." : "Auswaehlen"}
        </span>
      </div>
    </motion.button>
  );
};
