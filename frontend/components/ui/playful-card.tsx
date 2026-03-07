"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

interface PlayfulCardContextType {
  expandedCardId: string | null;
  expandCard: (cardId: string) => void;
  collapseCard: () => void;
}

const PlayfulCardContext = createContext<PlayfulCardContextType | undefined>(undefined);

export const usePlayfulCard = () => {
  const context = useContext(PlayfulCardContext);
  if (!context) {
    throw new Error("usePlayfulCard must be used within a PlayfulCardProvider");
  }
  return context;
};

interface PlayfulCardProviderProps {
  children: React.ReactNode;
}

export const PlayfulCardProvider: React.FC<PlayfulCardProviderProps> = ({ children }) => {
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  return (
    <PlayfulCardContext.Provider
      value={{
        expandedCardId,
        expandCard: (cardId) => setExpandedCardId(cardId),
        collapseCard: () => setExpandedCardId(null),
      }}
    >
      {children}
    </PlayfulCardContext.Provider>
  );
};

type PlayfulTone = {
  ribbon: string;
  halo: string;
  accent: string;
  pill: string;
};

const LIGHT_TONES: Record<NonNullable<PlayfulCardProps["color"]>, PlayfulTone> = {
  blue: {
    ribbon: "linear-gradient(135deg, rgba(216,233,248,0.96), rgba(232,241,252,0.92))",
    halo: "rgba(143, 176, 212, 0.34)",
    accent: "#7d9bbd",
    pill: "rgba(125,155,189,0.16)",
  },
  pink: {
    ribbon: "linear-gradient(135deg, rgba(247,220,230,0.96), rgba(251,233,239,0.92))",
    halo: "rgba(209, 146, 169, 0.32)",
    accent: "#c27f99",
    pill: "rgba(194,127,153,0.16)",
  },
  green: {
    ribbon: "linear-gradient(135deg, rgba(221,241,232,0.96), rgba(235,247,240,0.92))",
    halo: "rgba(118, 171, 152, 0.3)",
    accent: "#6fa28f",
    pill: "rgba(111,162,143,0.16)",
  },
  purple: {
    ribbon: "linear-gradient(135deg, rgba(233,226,248,0.96), rgba(242,238,251,0.92))",
    halo: "rgba(154, 141, 187, 0.32)",
    accent: "#9388bb",
    pill: "rgba(147,136,187,0.16)",
  },
  orange: {
    ribbon: "linear-gradient(135deg, rgba(247,227,216,0.96), rgba(251,239,228,0.92))",
    halo: "rgba(214, 156, 112, 0.32)",
    accent: "#d08c63",
    pill: "rgba(208,140,99,0.16)",
  },
  yellow: {
    ribbon: "linear-gradient(135deg, rgba(249,239,214,0.96), rgba(251,244,228,0.92))",
    halo: "rgba(196, 164, 110, 0.3)",
    accent: "#c1a06a",
    pill: "rgba(193,160,106,0.16)",
  },
};

const DARK_TONES: Record<NonNullable<PlayfulCardProps["color"]>, PlayfulTone> = {
  blue: {
    ribbon: "linear-gradient(135deg, rgba(44,65,92,0.96), rgba(26,39,58,0.94))",
    halo: "rgba(92, 133, 177, 0.28)",
    accent: "#98b7db",
    pill: "rgba(152,183,219,0.14)",
  },
  pink: {
    ribbon: "linear-gradient(135deg, rgba(74,52,68,0.96), rgba(39,30,44,0.94))",
    halo: "rgba(183, 120, 148, 0.28)",
    accent: "#d0a0b6",
    pill: "rgba(208,160,182,0.14)",
  },
  green: {
    ribbon: "linear-gradient(135deg, rgba(37,67,62,0.96), rgba(21,37,35,0.94))",
    halo: "rgba(106, 177, 150, 0.26)",
    accent: "#92d0ba",
    pill: "rgba(146,208,186,0.14)",
  },
  purple: {
    ribbon: "linear-gradient(135deg, rgba(60,50,86,0.96), rgba(32,28,49,0.94))",
    halo: "rgba(151, 135, 196, 0.26)",
    accent: "#c5baf2",
    pill: "rgba(197,186,242,0.14)",
  },
  orange: {
    ribbon: "linear-gradient(135deg, rgba(82,58,43,0.96), rgba(42,31,25,0.94))",
    halo: "rgba(208, 149, 111, 0.26)",
    accent: "#e1bc9f",
    pill: "rgba(225,188,159,0.14)",
  },
  yellow: {
    ribbon: "linear-gradient(135deg, rgba(86,68,44,0.96), rgba(42,34,24,0.94))",
    halo: "rgba(196, 167, 112, 0.24)",
    accent: "#ddc697",
    pill: "rgba(221,198,151,0.14)",
  },
};

interface PlayfulCardProps {
  cardId: string;
  children: React.ReactNode;
  className?: string;
  color?: "blue" | "pink" | "green" | "purple" | "orange" | "yellow";
  size?: "small" | "medium" | "large";
  onClick?: () => void;
}

export const PlayfulCard: React.FC<PlayfulCardProps> = ({
  cardId,
  children,
  className = "",
  color = "blue",
  size = "medium",
  onClick,
}) => {
  const { expandedCardId, expandCard, collapseCard } = usePlayfulCard();
  const { resolvedTheme } = useTheme();
  const reduceMotion = useReducedMotion();
  const isExpanded = expandedCardId === cardId;
  const isDark = resolvedTheme === "dark";

  const tone = useMemo(
    () => (isDark ? DARK_TONES[color] : LIGHT_TONES[color]),
    [color, isDark]
  );

  const sizeClasses = {
    small: "min-h-[15rem] w-full max-w-[18rem]",
    medium: "min-h-[17rem] w-full max-w-[20rem]",
    large: "min-h-[19rem] w-full max-w-[22rem]",
  };

  const handleClick = () => {
    if (isExpanded) {
      collapseCard();
      return;
    }
    expandCard(cardId);
    onClick?.();
  };

  const cardBody = (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at top left, rgba(255,255,255,0.78), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.14), transparent 34%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-20 rounded-t-[30px]"
        style={{ background: tone.ribbon }}
      />
      <div
        className="pointer-events-none absolute -right-6 top-4 h-20 w-20 rounded-full blur-2xl"
        style={{ background: tone.halo }}
      />
      <div
        className="pointer-events-none absolute left-5 top-5 h-px w-20 rounded-full bg-white/70 dark:bg-white/10"
      />
      <div className="relative z-[1] flex h-full flex-col">{children}</div>
    </>
  );

  if (isExpanded) {
    return (
      <>
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#2e2522]/18 backdrop-blur-xl dark:bg-black/50"
            onClick={collapseCard}
          />
        </AnimatePresence>

        <motion.div
          layoutId={`playful-card-${cardId}`}
          initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: 12, scale: 0.98 }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className={cn(
            "fixed left-1/2 top-1/2 z-[101] flex max-h-[86vh] w-[min(92vw,36rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[32px] border backdrop-blur-2xl",
            isDark ? "bg-[rgba(16,26,39,0.94)]" : "bg-[rgba(255,251,246,0.95)]"
          )}
          style={{
            borderColor: "var(--talea-glass-border)",
            boxShadow: "var(--talea-shadow-strong)",
          }}
        >
          <div className="relative min-h-[7rem] overflow-hidden px-6 pb-4 pt-5">
            <div className="absolute inset-0" style={{ background: tone.ribbon }} />
            <div className="absolute -right-6 top-3 h-24 w-24 rounded-full blur-3xl" style={{ background: tone.halo }} />
            <div className="relative z-[1] flex items-start justify-between gap-4">
              <div className="inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ borderColor: `${tone.accent}40`, background: tone.pill, color: tone.accent }}>
                Talea Collection
              </div>
              <button
                type="button"
                onClick={collapseCard}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border bg-white/70 text-slate-700 transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f2e7fb] dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/14 dark:focus-visible:ring-[#243753]"
                aria-label="Karte schliessen"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="talea-soft-scrollbar relative flex-1 overflow-y-auto px-6 pb-6">
            <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[var(--talea-shadow-soft)] dark:border-white/10 dark:bg-white/5">
              {children}
            </div>
          </div>
        </motion.div>
      </>
    );
  }

  return (
    <motion.button
      type="button"
      layoutId={`playful-card-${cardId}`}
      whileHover={reduceMotion ? undefined : { y: -4, scale: 1.01 }}
      whileTap={reduceMotion ? undefined : { scale: 0.992 }}
      onClick={handleClick}
      className={cn(
        "relative overflow-hidden rounded-[28px] border text-left backdrop-blur-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f2e7fb] dark:focus-visible:ring-[#243753]",
        sizeClasses[size],
        className
      )}
      style={{
        borderColor: "var(--talea-glass-border)",
        background: isDark
          ? "linear-gradient(180deg, rgba(18,29,44,0.9) 0%, rgba(13,22,35,0.82) 100%)"
          : "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(248,241,233,0.82) 100%)",
        boxShadow: "var(--talea-shadow-medium)",
      }}
    >
      {cardBody}
    </motion.button>
  );
};

interface PlayfulCardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const PlayfulCardHeader: React.FC<PlayfulCardHeaderProps> = ({ children, className = "" }) => {
  return <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>{children}</div>;
};

interface PlayfulCardTitleProps {
  children: React.ReactNode;
  className?: string;
  emoji?: string;
}

export const PlayfulCardTitle: React.FC<PlayfulCardTitleProps> = ({
  children,
  className = "",
  emoji,
}) => {
  return (
    <h3 className={cn("flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white", className)}>
      {emoji ? <span className="text-xl">{emoji}</span> : null}
      {children}
    </h3>
  );
};

interface PlayfulCardDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export const PlayfulCardDescription: React.FC<PlayfulCardDescriptionProps> = ({
  children,
  className = "",
}) => {
  return <p className={cn("text-sm leading-relaxed text-slate-600 dark:text-slate-300", className)}>{children}</p>;
};

interface PlayfulButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  color?: "blue" | "pink" | "green" | "purple" | "orange" | "yellow";
  size?: "small" | "medium" | "large";
  className?: string;
  emoji?: string;
}

export const PlayfulButton: React.FC<PlayfulButtonProps> = ({
  children,
  onClick,
  color = "blue",
  size = "medium",
  className = "",
  emoji,
}) => {
  const { resolvedTheme } = useTheme();
  const reduceMotion = useReducedMotion();
  const tone = resolvedTheme === "dark" ? DARK_TONES[color] : LIGHT_TONES[color];

  const sizeClasses = {
    small: "min-h-10 px-3.5 py-2 text-sm",
    medium: "min-h-11 px-4 py-2.5 text-sm",
    large: "min-h-12 px-5 py-3 text-base",
  };

  return (
    <motion.button
      type="button"
      whileHover={reduceMotion ? undefined : { y: -2, scale: 1.01 }}
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f2e7fb] dark:focus-visible:ring-[#243753]",
        sizeClasses[size],
        className
      )}
      style={{
        borderColor: `${tone.accent}40`,
        background: tone.ribbon,
        color: resolvedTheme === "dark" ? "#f6f8fc" : "#314053",
        boxShadow: "var(--talea-shadow-soft)",
      }}
      onClick={onClick}
    >
      {emoji ? <span>{emoji}</span> : null}
      {children}
    </motion.button>
  );
};
