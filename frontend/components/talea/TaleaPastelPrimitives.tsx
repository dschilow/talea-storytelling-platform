import React from "react";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export const taleaDisplayFont = '"Fraunces", "Cormorant Garamond", serif';
export const taleaBodyFont = '"Inter", "Manrope", "Sora", sans-serif';

export const taleaSurfaceClass =
  "relative overflow-hidden rounded-2xl border border-[var(--talea-border-light)] bg-white/80 shadow-[var(--talea-shadow-soft)] backdrop-blur-xl sm:rounded-2xl dark:border-[var(--talea-border-light)] dark:bg-[var(--talea-surface-primary)]";

export const taleaInsetSurfaceClass =
  "relative overflow-hidden rounded-xl border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] backdrop-blur-lg sm:rounded-xl dark:border-[var(--talea-border-light)] dark:bg-[var(--talea-surface-inset)]";

export const taleaPageShellClass =
  "mx-auto w-full max-w-[1480px] px-2.5 sm:px-4 md:px-6 lg:px-8 xl:px-10";

export const taleaGlassPanelClass =
  "relative overflow-hidden rounded-2xl border border-[var(--talea-border-light)] bg-white/80 shadow-[var(--talea-shadow-soft)] backdrop-blur-xl dark:border-[var(--talea-border-light)] dark:bg-[var(--talea-surface-primary)]";

export const taleaInputClass =
  "h-11 w-full rounded-xl border border-[var(--talea-border-soft)] bg-white/90 px-4 text-sm font-medium text-[var(--talea-text-primary)] outline-none transition-all focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 dark:border-[var(--talea-border-soft)] dark:bg-[var(--talea-surface-inset)] dark:text-[var(--talea-text-primary)] dark:focus:border-[var(--primary)] dark:focus:ring-[var(--primary)]/15";

export const taleaChipClass =
  "inline-flex items-center rounded-full border border-[var(--talea-border-light)] bg-white/60 dark:bg-[var(--talea-surface-inset)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--talea-text-secondary)]";

const enterEase = [0.25, 0.1, 0.25, 1] as const;

export function fadeUp(reduceMotion: boolean, delay = 0): MotionProps {
  if (reduceMotion) {
    return {
      initial: { opacity: 1 },
      animate: { opacity: 1 },
      transition: { duration: 0.01, delay: 0 },
    };
  }

  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay, ease: enterEase },
  };
}

export const TaleaPageBackground: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const reduceMotion = useReducedMotion();

  const makeFloat = (
    duration: number,
    x: number[],
    y: number[],
    scale: number[]
  ): MotionProps["animate"] =>
    reduceMotion
      ? { opacity: 1 }
      : { x, y, scale };

  const transitionFor = (duration: number, delay = 0) => ({
    duration,
    delay,
    repeat: Infinity,
    repeatType: "mirror" as const,
    ease: "easeInOut" as const,
  });

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div
        className={cn(
          "absolute inset-0 transition-colors duration-500",
          isDark ? "bg-[var(--talea-page-solid)]" : "bg-[var(--talea-page-solid)]"
        )}
      />

      <motion.div
        animate={makeFloat(20, [0, 20, -8], [0, -14, 6], [1, 1.04, 0.98])}
        transition={transitionFor(20)}
        className={cn(
          "absolute -top-20 right-[-28%] h-[22rem] w-[22rem] rounded-full blur-[100px] sm:-top-24 sm:right-[-8%] sm:h-[34rem] sm:w-[34rem] sm:blur-[120px]",
          isDark ? "bg-[var(--primary)]/8" : "bg-[var(--primary)]/12"
        )}
      />
      <motion.div
        animate={makeFloat(24, [0, -18, 10], [0, 16, -10], [1, 0.97, 1.03])}
        transition={transitionFor(24, 1.5)}
        className={cn(
          "absolute left-[-22%] top-[10%] h-[21rem] w-[21rem] rounded-full blur-[100px] sm:left-[-8%] sm:top-[12%] sm:h-[30rem] sm:w-[30rem] sm:blur-[120px]",
          isDark ? "bg-[var(--talea-accent-sky)]/6" : "bg-[var(--talea-accent-peach)]/10"
        )}
      />
      <motion.div
        animate={makeFloat(28, [0, 16, -12], [0, -10, 14], [1, 1.05, 0.97])}
        transition={transitionFor(28, 2.5)}
        className={cn(
          "absolute bottom-[-7rem] left-[10%] h-[20rem] w-[20rem] rounded-full blur-[100px] sm:bottom-[-10rem] sm:left-[22%] sm:h-[28rem] sm:w-[28rem] sm:blur-[130px]",
          isDark ? "bg-[var(--talea-accent-peach)]/5" : "bg-[var(--talea-accent-sky)]/8"
        )}
      />
    </div>
  );
};

type TaleaSurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  delay?: number;
  hoverable?: boolean;
};

export const TaleaSurface: React.FC<TaleaSurfaceProps> = ({
  className,
  children,
  delay = 0,
  hoverable = false,
  ...props
}) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      {...fadeUp(reduceMotion, delay)}
      whileHover={
        hoverable && !reduceMotion
          ? { y: -3, transition: { duration: 0.2, ease: "easeOut" } }
          : undefined
      }
      className={cn(taleaSurfaceClass, className)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

type TaleaActionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  icon?: React.ReactNode;
};

export const TaleaActionButton: React.FC<TaleaActionButtonProps> = ({
  className,
  children,
  variant = "primary",
  icon,
  type = "button",
  ...props
}) => {
  const reduceMotion = useReducedMotion();

  const variantClassName =
    variant === "primary"
      ? "bg-[var(--primary)] text-white border-transparent shadow-sm hover:shadow-md dark:bg-[var(--primary)] dark:text-[var(--talea-text-inverse)]"
      : variant === "secondary"
        ? "border-[var(--talea-border-light)] bg-white/80 text-[var(--talea-text-primary)] shadow-sm hover:shadow-md dark:border-[var(--talea-border-light)] dark:bg-[var(--talea-surface-primary)] dark:text-[var(--talea-text-primary)]"
        : "border-transparent bg-transparent text-[var(--talea-text-secondary)] shadow-none";

  return (
    <motion.button
      whileHover={
        reduceMotion
          ? undefined
          : { y: -1, scale: 1.01, transition: { duration: 0.15, ease: "easeOut" } }
      }
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      type={type}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/20 disabled:cursor-not-allowed disabled:opacity-50",
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

export const TaleaSectionHeading: React.FC<{
  eyebrow?: string;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ eyebrow, title, subtitle, actionLabel, onAction }) => (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="space-y-2">
      {eyebrow ? (
        <span className={taleaChipClass}>
          {eyebrow}
        </span>
      ) : null}
      <div>
        <h2
          className="text-2xl font-semibold leading-tight text-[var(--talea-text-primary)] md:text-3xl"
          style={{ fontFamily: taleaDisplayFont }}
        >
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-[var(--talea-text-secondary)] md:text-base">
          {subtitle}
        </p>
      </div>
    </div>

    {actionLabel && onAction ? (
      <TaleaActionButton variant="secondary" onClick={onAction} className="w-full justify-center sm:w-auto">
        {actionLabel}
      </TaleaActionButton>
    ) : null}
  </div>
);

export const TaleaLoadingState: React.FC<{
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
}> = ({
  title = "Talea ordnet gerade alles neu",
  subtitle = "Einen Moment, die Geschichten und Welten werden vorbereitet.",
  icon,
}) => {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <motion.div
        {...fadeUp(reduceMotion, 0)}
        className="w-full max-w-md text-center"
      >
        <div className="mx-auto flex w-fit flex-col items-center gap-5">
          <motion.div
            animate={
              reduceMotion
                ? undefined
                : { y: [0, -4, 0], scale: [1, 1.02, 1] }
            }
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary)]/10"
          >
            <div className="text-[var(--primary)]">
              {icon ?? <Sparkles className="h-7 w-7" />}
            </div>
          </motion.div>

          {/* Loading dots */}
          <div className="flex items-center gap-1.5" aria-hidden>
            {[0, 1, 2].map((index) => (
              <motion.span
                key={index}
                animate={reduceMotion ? undefined : { opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: index * 0.15, ease: "easeInOut" }}
                className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]"
              />
            ))}
          </div>
        </div>

        <h1
          className="mt-6 text-2xl font-semibold text-[var(--talea-text-primary)]"
          style={{ fontFamily: taleaDisplayFont }}
        >
          {title}
        </h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--talea-text-secondary)]">
          {subtitle}
        </p>
      </motion.div>
    </div>
  );
};

export const TaleaMetricPill: React.FC<{
  label: string;
  value: string;
  className?: string;
}> = ({ label, value, className }) => (
  <div
    className={cn(
      "rounded-xl border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] px-4 py-3",
      className
    )}
  >
    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--talea-text-tertiary)]">
      {label}
    </p>
    <p className="mt-1 text-sm font-semibold text-[var(--talea-text-primary)]">{value}</p>
  </div>
);

export const TaleaProgressSteps: React.FC<{
  steps: Array<{ id: string; label: string }>;
  activeIndex: number;
}> = ({ steps, activeIndex }) => (
  <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
    {steps.map((step, index) => {
      const isDone = index < activeIndex;
      const isActive = index === activeIndex;

      return (
        <React.Fragment key={step.id}>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all",
                isDone
                  ? "bg-[var(--primary)] text-white"
                  : isActive
                    ? "border-2 border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "border border-[var(--talea-border-light)] bg-white/60 text-[var(--talea-text-muted)] dark:bg-[var(--talea-surface-inset)]"
              )}
            >
              {isDone ? "✓" : index + 1}
            </span>
            <span
              className={cn(
                "max-w-[5.5rem] text-[11px] font-medium tracking-wide",
                isActive || isDone ? "text-[var(--talea-text-primary)]" : "text-[var(--talea-text-muted)]"
              )}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 ? (
            <span
              className={cn(
                "hidden h-px w-5 rounded-full sm:block",
                isDone ? "bg-[var(--primary)]" : "bg-[var(--talea-border-light)]"
              )}
            />
          ) : null}
        </React.Fragment>
      );
    })}
  </div>
);
