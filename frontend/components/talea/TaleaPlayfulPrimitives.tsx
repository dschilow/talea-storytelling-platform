import React from "react";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Playful Kids design layer.
 *
 * A warmer, rounder, more child-friendly companion to TaleaPastelPrimitives.
 * Built entirely on the --talea-play-* design tokens (see index.css) so it
 * supports light/dark mode automatically and never hardcodes colors.
 *
 * Prototype phase: used by the Home screen first. Once approved, these
 * primitives roll out across the remaining screens.
 */

export const taleaPlayDisplayFont = '"Fredoka", "Baloo 2", "Nunito", sans-serif';
export const taleaPlayBodyFont = '"Nunito", "Manrope", sans-serif';

export const taleaPlayCardClass =
  "relative overflow-hidden rounded-[var(--talea-play-radius)] border-2 border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] shadow-[var(--talea-play-shadow)] backdrop-blur-2xl";

export const taleaPlayInsetClass =
  "relative overflow-hidden rounded-[var(--talea-play-radius)] border-2 border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)]";

export const taleaPlayPageShellClass =
  "mx-auto w-full max-w-[1600px] px-3 sm:px-5 md:px-6 lg:px-8 xl:px-10";

export const taleaPlayChipClass =
  "inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--talea-border-light)] bg-white/80 px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--talea-text-secondary)] shadow-[0_4px_12px_rgba(160,120,140,0.1)] dark:bg-[var(--talea-surface-inset)]";

export const taleaPlayInputClass =
  "h-12 w-full rounded-[1.4rem] border-2 border-[var(--talea-border-soft)] bg-white/85 px-5 text-sm font-semibold text-[var(--talea-text-primary)] outline-none transition-all placeholder:text-[var(--talea-text-muted)] focus:border-[var(--talea-play-pink)] focus:bg-white focus:ring-4 focus:ring-[var(--talea-play-ring)] dark:bg-[var(--talea-surface-inset)] dark:focus:bg-[var(--talea-surface-primary)]";

const enterEase = [0.34, 1.56, 0.64, 1] as const; // gentle overshoot for playful pop

export function playPop(reduceMotion: boolean, delay = 0): MotionProps {
  if (reduceMotion) {
    return {
      initial: { opacity: 1 },
      animate: { opacity: 1 },
      transition: { duration: 0.01, delay: 0 },
    };
  }

  return {
    initial: { opacity: 0, y: 22, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.5, delay, ease: enterEase },
  };
}

/* ------------------------------------------------------------------ */
/* Animated playful background — rounder, bouncier floating blobs      */
/* ------------------------------------------------------------------ */

export const TaleaPlayBackground: React.FC<{ isDark?: boolean }> = () => {
  const reduceMotion = !!useReducedMotion();

  const blob = (
    duration: number,
    x: number[],
    y: number[],
    scale: number[]
  ): MotionProps["animate"] => (reduceMotion ? { opacity: 1 } : { x, y, scale });

  const t = (duration: number, delay = 0) => ({
    duration,
    delay,
    repeat: Infinity,
    repeatType: "mirror" as const,
    ease: "easeInOut" as const,
  });

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[var(--talea-page-solid)]" />
      <motion.div
        animate={blob(18, [0, 26, -10], [0, -18, 8], [1, 1.06, 0.97])}
        transition={t(18)}
        className="absolute -top-24 right-[-12%] h-[26rem] w-[26rem] rounded-full bg-[var(--talea-play-pink)] opacity-[0.18] blur-[110px] sm:h-[36rem] sm:w-[36rem]"
      />
      <motion.div
        animate={blob(22, [0, -22, 12], [0, 18, -12], [1, 0.96, 1.05])}
        transition={t(22, 1.4)}
        className="absolute left-[-12%] top-[8%] h-[24rem] w-[24rem] rounded-full bg-[var(--talea-play-sun)] opacity-[0.16] blur-[110px] sm:h-[32rem] sm:w-[32rem]"
      />
      <motion.div
        animate={blob(26, [0, 18, -14], [0, -12, 16], [1, 1.07, 0.96])}
        transition={t(26, 2.2)}
        className="absolute bottom-[-9rem] left-[14%] h-[22rem] w-[22rem] rounded-full bg-[var(--talea-play-mint)] opacity-[0.16] blur-[110px] sm:h-[30rem] sm:w-[30rem]"
      />
      <motion.div
        animate={blob(30, [0, -14, 20], [0, 20, -12], [1, 1.04, 0.95])}
        transition={t(30, 0.7)}
        className="absolute right-[18%] top-[34%] h-[16rem] w-[16rem] rounded-full bg-[var(--talea-play-lavender)] opacity-[0.16] blur-[100px] sm:h-[22rem] sm:w-[22rem]"
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Surface — rounded playful card with optional bounce on hover        */
/* ------------------------------------------------------------------ */

type TaleaPlaySurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  delay?: number;
  hoverable?: boolean;
};

export const TaleaPlaySurface: React.FC<TaleaPlaySurfaceProps> = ({
  className,
  children,
  delay = 0,
  hoverable = false,
  ...props
}) => {
  const reduceMotion = !!useReducedMotion();

  return (
    <motion.div
      {...playPop(reduceMotion, delay)}
      whileHover={
        hoverable && !reduceMotion
          ? { y: -6, scale: 1.01, transition: { type: "spring", stiffness: 300, damping: 18 } }
          : undefined
      }
      className={cn(taleaPlayCardClass, className)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/* Button — chunky, rounded, bouncy                                    */
/* ------------------------------------------------------------------ */

type TaleaPlayButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "sun" | "mint";
  size?: "md" | "lg";
  icon?: React.ReactNode;
};

export const TaleaPlayButton: React.FC<TaleaPlayButtonProps> = ({
  className,
  children,
  variant = "primary",
  size = "md",
  icon,
  type = "button",
  ...props
}) => {
  const reduceMotion = !!useReducedMotion();

  const variantClassName = {
    primary:
      "border-transparent bg-[image:var(--talea-play-gradient-pink)] text-white shadow-[0_12px_26px_rgba(247,168,196,0.4)] hover:shadow-[0_16px_32px_rgba(247,168,196,0.5)]",
    sun: "border-transparent bg-[image:var(--talea-play-gradient-sun)] text-[#7a4a1a] shadow-[0_12px_26px_rgba(255,209,102,0.4)] hover:shadow-[0_16px_32px_rgba(255,209,102,0.5)] dark:text-[#3a2408]",
    mint: "border-transparent bg-[image:var(--talea-play-gradient-mint)] text-white shadow-[0_12px_26px_rgba(142,215,184,0.4)] hover:shadow-[0_16px_32px_rgba(142,215,184,0.5)]",
    secondary:
      "border-2 border-[var(--talea-border-light)] bg-white/85 text-[var(--talea-text-primary)] shadow-[0_8px_20px_rgba(160,120,140,0.1)] hover:bg-white dark:bg-[var(--talea-surface-primary)]",
    ghost:
      "border-transparent bg-transparent text-[var(--talea-text-secondary)] shadow-none hover:bg-[var(--talea-surface-inset)]",
  }[variant];

  const sizeClassName = size === "lg" ? "min-h-13 px-7 py-3.5 text-base" : "min-h-11 px-5 py-2.5 text-sm";

  return (
    <motion.button
      whileHover={reduceMotion ? undefined : { y: -2, scale: 1.03, transition: { type: "spring", stiffness: 400, damping: 15 } }}
      whileTap={reduceMotion ? undefined : { scale: 0.95 }}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--talea-play-radius-pill)] font-bold transition-shadow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--talea-play-ring)] disabled:cursor-not-allowed disabled:opacity-50",
        sizeClassName,
        variantClassName,
        className
      )}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </motion.button>
  );
};

/* ------------------------------------------------------------------ */
/* Section heading — friendly, with optional emoji bubble              */
/* ------------------------------------------------------------------ */

export const TaleaPlaySectionHeading: React.FC<{
  eyebrow?: string;
  title: string;
  subtitle?: string;
  emoji?: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ eyebrow, title, subtitle, emoji, actionLabel, onAction }) => (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="flex items-start gap-4">
      {emoji ? (
        <div className="talea-animate-float flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.4rem] bg-[var(--talea-play-pink-soft)] text-3xl shadow-[0_8px_18px_rgba(160,120,140,0.12)]">
          {emoji}
        </div>
      ) : null}
      <div className="space-y-1.5">
        {eyebrow ? <span className={taleaPlayChipClass}>{eyebrow}</span> : null}
        <h2
          className="talea-play-display text-[1.9rem] font-bold leading-[1.05] text-[var(--talea-text-primary)] md:text-[2.4rem]"
        >
          {title}
        </h2>
        {subtitle ? (
          <p className="max-w-2xl text-sm font-semibold leading-6 text-[var(--talea-text-secondary)] md:text-base">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>

    {actionLabel && onAction ? (
      <TaleaPlayButton variant="secondary" onClick={onAction} className="w-full justify-center sm:w-auto">
        {actionLabel}
      </TaleaPlayButton>
    ) : null}
  </div>
);

/* ------------------------------------------------------------------ */
/* Stat pill — colorful, rounded                                       */
/* ------------------------------------------------------------------ */

const STAT_TONES = {
  pink: "bg-[var(--talea-play-pink-soft)]",
  sun: "bg-[var(--talea-play-sun-soft)]",
  mint: "bg-[var(--talea-play-mint-soft)]",
  sky: "bg-[var(--talea-play-sky-soft)]",
  lavender: "bg-[var(--talea-play-lavender-soft)]",
  coral: "bg-[var(--talea-play-coral-soft)]",
} as const;

export const TaleaPlayStatPill: React.FC<{
  icon?: React.ReactNode;
  value: React.ReactNode;
  label: string;
  tone?: keyof typeof STAT_TONES;
}> = ({ icon, value, label, tone = "pink" }) => {
  const reduceMotion = !!useReducedMotion();
  return (
    <motion.span
      whileHover={reduceMotion ? undefined : { scale: 1.06, y: -2 }}
      className={cn(
        "inline-flex cursor-default items-center gap-2 rounded-full border-2 border-[var(--talea-border-light)] px-4 py-2 text-sm shadow-[0_4px_12px_rgba(160,120,140,0.1)]",
        STAT_TONES[tone]
      )}
    >
      {icon ? <span className="text-[var(--talea-text-secondary)]">{icon}</span> : null}
      <span className="font-extrabold text-[var(--talea-text-primary)]">{value}</span>
      <span className="font-semibold text-[var(--talea-text-tertiary)]">{label}</span>
    </motion.span>
  );
};

/* ------------------------------------------------------------------ */
/* Loading state — bouncy                                              */
/* ------------------------------------------------------------------ */

export const TaleaPlayLoadingState: React.FC<{
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
}> = ({
  title = "Talea zaubert gerade",
  subtitle = "Einen kleinen Moment, deine Welt wird vorbereitet.",
  icon,
}) => {
  const reduceMotion = !!useReducedMotion();

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <motion.div {...playPop(reduceMotion, 0)} className="w-full max-w-md text-center">
        <div className="mx-auto flex w-fit flex-col items-center gap-5">
          <motion.div
            animate={reduceMotion ? undefined : { y: [0, -10, 0], rotate: [0, -6, 6, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-[image:var(--talea-play-gradient-pink)] text-white shadow-[0_14px_30px_rgba(247,168,196,0.4)]"
          >
            <div className="[&>svg]:h-9 [&>svg]:w-9">{icon ?? <Sparkles className="h-9 w-9" />}</div>
          </motion.div>

          <div className="flex items-center gap-2" aria-hidden>
            {[0, 1, 2].map((index) => (
              <motion.span
                key={index}
                animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: index * 0.15, ease: "easeInOut" }}
                className="h-2.5 w-2.5 rounded-full bg-[var(--talea-play-pink)]"
              />
            ))}
          </div>
        </div>

        <h1 className="talea-play-display mt-6 text-2xl font-bold text-[var(--talea-text-primary)]">{title}</h1>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-[var(--talea-text-secondary)]">{subtitle}</p>
      </motion.div>
    </div>
  );
};
