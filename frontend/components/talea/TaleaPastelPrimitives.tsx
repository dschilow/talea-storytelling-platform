import React from "react";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export const taleaDisplayFont = '"Fraunces", "Cormorant Garamond", serif';
export const taleaBodyFont = '"Manrope", "Sora", sans-serif';

export const taleaSurfaceClass =
  "relative overflow-hidden rounded-[24px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(248,242,235,0.8)_100%)] shadow-[0_24px_64px_-34px_rgba(178,146,120,0.38)] backdrop-blur-2xl before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(247,221,232,0.42),transparent_30%)] before:content-[''] after:pointer-events-none after:absolute after:left-6 after:right-6 after:top-0 after:h-px after:bg-white/90 after:content-[''] sm:rounded-[32px] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(18,29,44,0.94)_0%,rgba(13,22,35,0.88)_100%)] dark:shadow-[0_34px_80px_-42px_rgba(2,8,23,0.92)] dark:before:bg-[radial-gradient(circle_at_top_left,rgba(133,110,170,0.18),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(76,126,164,0.16),transparent_28%)] dark:after:bg-white/10";

export const taleaInsetSurfaceClass =
  "relative overflow-hidden rounded-[20px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(255,252,247,0.82)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_18px_42px_-30px_rgba(186,155,129,0.34)] backdrop-blur-xl before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.8),transparent_50%),linear-gradient(135deg,rgba(245,224,235,0.4)_0%,transparent_46%,rgba(223,240,255,0.36)_100%)] before:content-[''] sm:rounded-[26px] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(19,31,47,0.92)_0%,rgba(14,24,38,0.88)_100%)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_40px_-28px_rgba(2,8,23,0.86)] dark:before:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_46%),linear-gradient(135deg,rgba(111,84,114,0.16)_0%,transparent_48%,rgba(65,96,131,0.16)_100%)]";

export const taleaPageShellClass =
  "mx-auto w-full max-w-[1440px] px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10";

export const taleaInputClass =
  "h-12 w-full rounded-[20px] border border-white/80 bg-white/88 px-4 text-sm font-semibold text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] outline-none transition focus:border-[#d8c4ef] focus:ring-4 focus:ring-[#f6eefe]/80 dark:border-white/10 dark:bg-[rgba(18,30,46,0.9)] dark:text-slate-100 dark:focus:border-[#7c82ff] dark:focus:ring-[#1d2b42]";

export const taleaChipClass =
  "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]";

const enterEase = [0.22, 1, 0.36, 1] as const;

export function fadeUp(reduceMotion: boolean, delay = 0): MotionProps {
  if (reduceMotion) {
    return {
      initial: { opacity: 1 },
      animate: { opacity: 1 },
      transition: { duration: 0.01, delay: 0 },
    };
  }

  return {
    initial: { opacity: 0, y: 20, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.48, delay, ease: enterEase },
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
      : {
          x,
          y,
          scale,
        };

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
          isDark ? "bg-[#0d1724]" : "bg-[#fbf7f2]"
        )}
      />

      <motion.div
        animate={makeFloat(18, [0, 28, -12], [0, -18, 8], [1, 1.06, 0.98])}
        transition={transitionFor(18)}
        className={cn(
          "absolute -top-20 right-[-28%] h-[22rem] w-[22rem] rounded-full blur-[90px] sm:-top-24 sm:right-[-8%] sm:h-[34rem] sm:w-[34rem] sm:blur-[110px]",
          isDark ? "bg-[#4b628f]/25" : "bg-[#f3d6e5]/70"
        )}
      />
      <motion.div
        animate={makeFloat(22, [0, -24, 12], [0, 20, -14], [1, 0.96, 1.05])}
        transition={transitionFor(22, 1.2)}
        className={cn(
          "absolute left-[-22%] top-[10%] h-[21rem] w-[21rem] rounded-full blur-[90px] sm:left-[-8%] sm:top-[12%] sm:h-[30rem] sm:w-[30rem] sm:blur-[110px]",
          isDark ? "bg-[#365a6d]/22" : "bg-[#d6efe7]/78"
        )}
      />
      <motion.div
        animate={makeFloat(26, [0, 20, -16], [0, -12, 18], [1, 1.08, 0.97])}
        transition={transitionFor(26, 2.1)}
        className={cn(
          "absolute bottom-[-7rem] left-[10%] h-[20rem] w-[20rem] rounded-full blur-[96px] sm:bottom-[-10rem] sm:left-[22%] sm:h-[28rem] sm:w-[28rem] sm:blur-[120px]",
          isDark ? "bg-[#77649f]/18" : "bg-[#f5e2bf]/72"
        )}
      />

      <div
        className={cn(
          "absolute inset-0",
          isDark
            ? "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_44%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_26%)]"
            : "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.85),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.45),transparent_24%)]"
        )}
      />
      <div
        className={cn(
          "absolute inset-0 opacity-50",
          isDark
            ? "bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_0)] bg-[size:26px_26px]"
            : "bg-[radial-gradient(circle_at_1px_1px,rgba(199,172,148,0.16)_1px,transparent_0)] bg-[size:26px_26px]"
        )}
      />
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-56",
          isDark
            ? "bg-gradient-to-b from-white/[0.04] to-transparent"
            : "bg-gradient-to-b from-white/65 to-transparent"
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
          ? { y: -4, scale: 1.01, transition: { duration: 0.22, ease: "easeOut" } }
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
      ? "border-white/80 bg-[linear-gradient(135deg,#f6dbe7_0%,#fae9c8_48%,#ddeefe_100%)] text-[#4b3c43] shadow-[0_18px_42px_-24px_rgba(210,154,177,0.6)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(137,106,135,0.45)_0%,rgba(126,156,187,0.34)_100%)] dark:text-white"
      : variant === "secondary"
        ? "border-white/80 bg-white/86 text-slate-700 shadow-[0_14px_32px_-24px_rgba(167,146,123,0.45)] dark:border-white/10 dark:bg-[rgba(18,29,44,0.9)] dark:text-slate-100"
        : "border-transparent bg-transparent text-slate-600 shadow-none dark:text-slate-300";

  return (
    <motion.button
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: -2,
              scale: 1.01,
              transition: { duration: 0.18, ease: "easeOut" },
            }
      }
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition sm:px-5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f2e9fb]/90 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-[#23344d]",
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
        <span className="inline-flex items-center rounded-full border border-white/80 bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9b7c8b] dark:border-white/10 dark:bg-white/5 dark:text-[#d1c4ff]">
          {eyebrow}
        </span>
      ) : null}
      <div>
        <h2
          className="text-[2rem] font-semibold leading-tight text-slate-900 dark:text-white md:text-[2.35rem]"
          style={{ fontFamily: taleaDisplayFont }}
        >
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300 md:text-base">
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
        className={cn(taleaSurfaceClass, "w-full max-w-lg p-8 text-center sm:p-10")}
      >
        <div className="mx-auto flex w-fit flex-col items-center gap-5">
          <motion.div
            animate={
              reduceMotion
                ? undefined
                : {
                    y: [0, -6, 0],
                    scale: [1, 1.03, 1],
                  }
            }
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            className={cn(
              taleaInsetSurfaceClass,
              "relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-[28px]"
            )}
          >
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(245,212,228,0.72),rgba(225,239,252,0.72))] dark:bg-[linear-gradient(135deg,rgba(106,86,131,0.44),rgba(65,96,135,0.28))]" />
            <div className="relative z-10 text-[#7e6d73] dark:text-[#f5f7fb]">
              {icon ?? <Sparkles className="h-9 w-9" />}
            </div>
          </motion.div>

          <div className="flex items-center gap-2" aria-hidden>
            {[0, 1, 2].map((index) => (
              <motion.span
                key={index}
                animate={reduceMotion ? undefined : { y: [0, -8, 0], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: index * 0.12, ease: "easeInOut" }}
                className="h-2.5 w-2.5 rounded-full bg-[#d7b6ca] dark:bg-[#8ea7cc]"
              />
            ))}
          </div>
        </div>

        <h1
          className="mt-6 text-[2rem] font-semibold text-slate-900 dark:text-white"
          style={{ fontFamily: taleaDisplayFont }}
        >
          {title}
        </h1>
        <p className="mt-3 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
          {subtitle}
        </p>
      </motion.div>
    </div>
  );
};
