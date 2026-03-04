import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X, RotateCw } from "lucide-react";
import type { TopicSuggestionItemDTO } from "./apiCosmosClient";
import { SuggestionGrid } from "./SuggestionGrid";

interface SuggestionDrawerProps {
  open: boolean;
  title?: string;
  subtitle?: string;
  items: TopicSuggestionItemDTO[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: string | null;
  lastInsertedSuggestionId?: string | null;
  onClose: () => void;
  onRefreshOne: () => void;
  onSelect: (item: TopicSuggestionItemDTO) => void;
}

export const SuggestionDrawer: React.FC<SuggestionDrawerProps> = ({
  open,
  title = "Weiterlernen",
  subtitle = "Passende Themenvorschlaege",
  items,
  isLoading = false,
  isRefreshing = false,
  error = null,
  lastInsertedSuggestionId = null,
  onClose,
  onRefreshOne,
  onSelect,
}) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0 z-40 bg-black/45 backdrop-blur-[2px]"
            onClick={onClose}
          />

          <motion.section
            role="dialog"
            aria-modal="true"
            initial={{ y: 56, opacity: 0.9, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 48, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute inset-x-0 bottom-0 z-50 mx-auto w-full max-w-3xl px-3 pb-3 md:px-5 md:pb-5"
            style={{ paddingBottom: "max(0.75rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))" }}
          >
            <div
              className="rounded-3xl border border-white/12 p-4 md:p-5"
              style={{
                background:
                  "linear-gradient(145deg, rgba(10,12,30,0.95) 0%, rgba(20,20,46,0.96) 55%, rgba(28,16,48,0.94) 100%)",
                boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
              }}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
                    AI Topic Suggestions
                  </p>
                  <h3 className="mt-1 text-lg font-extrabold text-white">{title}</h3>
                  <p className="text-xs text-white/65">{subtitle}</p>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-white/20 bg-white/5 p-2 text-white/80 hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onRefreshOne}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <RotateCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                  Neuen Vorschlag
                </button>
                <span className="inline-flex items-center gap-1 text-xs text-white/55">
                  <Sparkles className="h-3.5 w-3.5" />
                  {items.length} Themen verfuegbar
                </span>
              </div>

              {error && (
                <div className="mb-3 rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                  {error}
                </div>
              )}

              <SuggestionGrid
                items={items}
                isLoading={isLoading}
                onSelect={onSelect}
                lastInsertedSuggestionId={lastInsertedSuggestionId}
                maxItems={8}
              />
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
};
