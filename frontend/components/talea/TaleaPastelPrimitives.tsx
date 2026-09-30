import React from "react";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { Check, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export const taleaDisplayFont = 'var(--talea-font-display)';
export const taleaBodyFont = 'var(--talea-font-ui)';

// iOS "inset grouped" look: solid card, hairline edge, barely-there shadow.
export const taleaSurfaceClass =
  "relative overflow-hidden rounded-[1.375rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] shadow-[var(--talea-shadow-soft)]";

export const taleaInsetSurfaceClass =
  "relative overflow-hidden rounded-[1.125rem] bg-[var(--talea-surface-inset)]";

export const taleaPageShellClass =
  "mx-auto w-full max-w-[1280px] px-4 md:px-6 lg:px-8";

export const taleaGlassPanelClass =
  "relative overflow-hidden rounded-[1.375rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] shadow-[var(--talea-shadow-soft)]";

export const taleaToolbarClass =
  "relative flex flex-wrap items-center gap-2.5 rounded-[1.25rem] bg-[var(--talea-surface-inset)] p-2";

export const taleaMetricCardClass =
  "relative overflow-hidden rounded-[1.125rem] bg-[var(--talea-surface-inset)] px-4 py-3.5";

// iOS search/text field: filled, borderless, focus ring only while typing.
export const taleaInputClass =
  "h-11 w-full rounded-xl border border-transparent bg-[var(--talea-surface-inset)] px-4 text-[15px] text-[var(--talea-text-primary)] outline-none transition-colors placeholder:text-[var(--talea-text-tertiary)] focus:border-[var(--primary)]/40 focus:ring-4 focus:ring-[var(--primary)]/12";

// Section label ("eyebrow"): plain text like an iOS section header, not a pill.
export const taleaChipClass =
  "inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--talea-text-tertiary)]";

/**
 * One visual language for "this option is picked".
 *
 * Before this existed, "selected" was amber in the avatar wizard's light mode,
 * teal in its dark mode, sage in the story wizard and a separate teal in the
 * step rail — four colours for one meaning. These helpers resolve through the
 * theme tokens, so a component never needs a `darkMode` prop to style itself.
 */
export function taleaSelectableClass(selected: boolean, disabled = false): string {
  return cn(
    "relative rounded-2xl border text-left transition-colors duration-200",
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/18",
    selected
      ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] shadow-[0_8px_22px_color-mix(in_srgb,var(--primary)_16%,transparent)]"
      : "border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] hover:border-[var(--talea-border-strong)] hover:bg-[var(--talea-surface-inset)]",
    disabled && "cursor-not-allowed opacity-45 hover:border-[var(--talea-border-light)]"
  );
}

/** Label colour that pairs with `taleaSelectableClass`. */
export function taleaSelectableLabelClass(selected: boolean): string {
  return selected
    ? "text-[var(--talea-text-primary)] font-semibold"
    : "text-[var(--talea-text-secondary)]";
}

/**
 * The corner check for a picked card. Replaces the literal text "OK" badge,
 * which read as a button rather than a state and did not survive translation.
 */
export const TaleaSelectedBadge: React.FC<{ className?: string; label?: string }> = ({
  className,
  label = "Ausgewählt",
}) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.span
      initial={reduceMotion ? undefined : { scale: 0 }}
      animate={reduceMotion ? undefined : { scale: 1 }}
      exit={reduceMotion ? undefined : { scale: 0 }}
      transition={{ type: "spring", stiffness: 520, damping: 30 }}
      className={cn(
        "absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-sm",
        className
      )}
      title={label}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
      <span className="sr-only">{label}</span>
    </motion.span>
  );
};

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

/**
 * Page backdrop. Deliberately calm: a flat, warm grouped-background colour like
 * iOS Settings or Books. The previous drifting colour blobs and grid kept the
 * GPU busy on every page and competed with the cover art for attention.
 * `isDark` is kept for API compatibility — the colour comes from the theme token.
 */
export const TaleaPageBackground: React.FC<{ isDark: boolean }> = () => (
  <div className="pointer-events-none fixed inset-0 -z-10 bg-[var(--talea-page-solid)]" aria-hidden />
);

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
          ? { y: -4, scale: 1.005, transition: { duration: 0.2, ease: "easeOut" } }
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
      ? "border-transparent bg-[var(--primary)] text-[var(--primary-foreground)] hover:brightness-[1.06] active:brightness-95"
      : variant === "secondary"
        ? "border-transparent bg-[var(--talea-surface-inset)] text-[var(--primary)] hover:brightness-[0.97] dark:hover:brightness-110"
        : "border-transparent bg-transparent text-[var(--primary)] shadow-none hover:bg-[var(--talea-surface-inset)]";

  return (
    <motion.button
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[15px] font-semibold transition-[filter,background-color] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/20 disabled:cursor-not-allowed disabled:opacity-45",
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
  // iOS section header: bold title with a text link on the same line, one quiet line below.
  <div className="min-w-0">
    {eyebrow ? <span className={taleaChipClass}>{eyebrow}</span> : null}
    <div className="mt-0.5 flex items-baseline justify-between gap-4">
      <h2
        className="min-w-0 text-[1.375rem] font-bold leading-tight text-[var(--talea-text-primary)] md:text-[1.625rem]"
        style={{ fontFamily: taleaDisplayFont }}
      >
        {title}
      </h2>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 rounded-lg py-1 text-[15px] font-semibold text-[var(--primary)] hover:opacity-75"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
    <p className="mt-1 max-w-2xl text-[15px] leading-snug text-[var(--talea-text-secondary)]">{subtitle}</p>
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
      "rounded-[1.3rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] px-4 py-3.5",
      className
    )}
  >
    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--talea-text-tertiary)]">
      {label}
    </p>
    <p className="mt-1.5 text-sm font-semibold text-[var(--talea-text-primary)]">{value}</p>
  </div>
);

/**
 * Wizard progress as one slim segmented bar plus "Schritt 2 von 7 · Label".
 * A row of seven labelled circles wrapped onto three lines on a phone.
 */
export const TaleaProgressSteps: React.FC<{
  steps: Array<{ id: string; label: string }>;
  activeIndex: number;
}> = ({ steps, activeIndex }) => {
  const current = steps[Math.min(Math.max(activeIndex, 0), steps.length - 1)];
  return (
    <div className="w-full" role="group" aria-label="Fortschritt">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[15px] font-semibold text-[var(--talea-text-primary)]">{current?.label}</span>
        <span className="shrink-0 text-[13px] font-medium tabular-nums text-[var(--talea-text-tertiary)]">
          Schritt {activeIndex + 1} von {steps.length}
        </span>
      </div>
      <div className="mt-2.5 flex gap-1" aria-hidden>
        {steps.map((step, index) => (
          <span
            key={step.id}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-300",
              index <= activeIndex ? "bg-[var(--primary)]" : "bg-[var(--talea-progress-track)]"
            )}
          />
        ))}
      </div>
    </div>
  );
};
