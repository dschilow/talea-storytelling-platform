import React from "react";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Storybook / Märchenbuch design layer — "voll aufgedreht".
 *
 * A living illustrated fairy-tale book: parchment, ink, watercolour washes,
 * hand-drawn ornaments and gilded titles. Built entirely from CSS textures and
 * inline SVG (no external image assets), so it stays fast and rolls out across
 * every screen. All colours come from the --tale-* tokens (see index.css) and
 * support light/dark + reduced-motion automatically.
 */

export const taleTitleFont = '"Gloock", "Fraunces", serif';
export const taleSerifFont = '"Fraunces", "Cormorant Garamond", serif';
export const taleHandFont = '"Caveat", cursive';

const enterEase = [0.22, 1, 0.36, 1] as const;

export function inkIn(reduceMotion: boolean, delay = 0): MotionProps {
  if (reduceMotion) {
    return { initial: { opacity: 1 }, animate: { opacity: 1 }, transition: { duration: 0.01 } };
  }
  return {
    initial: { opacity: 0, y: 14, filter: "blur(3px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: { duration: 0.6, delay, ease: enterEase },
  };
}

/* ================================================================== */
/* Hand-drawn SVG ornaments                                            */
/* ================================================================== */

/** Decorative corner flourish — placed in the 4 corners of a framed page. */
export const TaleCorner: React.FC<{ className?: string; flip?: boolean }> = ({ className, flip }) => (
  <svg
    viewBox="0 0 64 64"
    className={cn("pointer-events-none absolute h-10 w-10 text-[var(--tale-gold)]", className)}
    style={flip ? { transform: "scaleX(-1)" } : undefined}
    fill="none"
    aria-hidden
  >
    <path
      d="M6 58 C6 30 18 12 44 8 M6 58 C6 40 14 26 30 20 M44 8 C40 14 40 20 46 22 C40 24 38 30 42 36"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      opacity="0.85"
    />
    <circle cx="46" cy="9" r="2.1" fill="currentColor" />
    <circle cx="9" cy="46" r="2.1" fill="currentColor" />
  </svg>
);

/** Small twinkling star, scattered as decoration. */
export const TaleStar: React.FC<{ className?: string; delay?: number }> = ({ className, delay = 0 }) => (
  <span
    className={cn("tale-twinkle pointer-events-none absolute text-[var(--tale-gold)]", className)}
    style={{ animation: `tale-twinkle-soft 3s ease-in-out ${delay}s infinite` }}
    aria-hidden
  >
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor">
      <path d="M12 0 C13 7 17 11 24 12 C17 13 13 17 12 24 C11 17 7 13 0 12 C7 11 11 7 12 0Z" />
    </svg>
  </span>
);

/** Horizontal divider with a centred ornament (a small sun/compass rose). */
export const TaleDivider: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn("tale-rule my-1", className)} aria-hidden>
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--tale-gold)]" fill="none">
      <circle cx="12" cy="12" r="3.4" fill="currentColor" opacity="0.9" />
      <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
      </g>
    </svg>
  </div>
);

/** Animated quill pen — sits in the hero, gently writing. */
export const TaleQuill: React.FC<{ className?: string }> = ({ className }) => {
  const reduce = !!useReducedMotion();
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("h-10 w-10 text-[var(--tale-ink-soft)]", !reduce && "tale-animate-quill", className)}
      style={{ transformOrigin: "12px 38px" }}
      fill="none"
      aria-hidden
    >
      <path
        d="M40 8 C28 12 18 22 12 38 C20 36 30 30 38 20 C34 22 30 22 28 24 C34 20 38 14 40 8Z"
        fill="currentColor"
        opacity="0.92"
      />
      <path d="M12 38 L8 42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 26 C26 25 30 22 33 18" stroke="var(--tale-paper)" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
};

/* ================================================================== */
/* Page background — full parchment with floating washes & stars       */
/* ================================================================== */

export const TalePageBackground: React.FC = () => {
  const reduce = !!useReducedMotion();
  const wash = (animate: MotionProps["animate"]): MotionProps["animate"] => (reduce ? {} : animate);
  const t = (d: number, delay = 0) => ({ duration: d, delay, repeat: Infinity, repeatType: "mirror" as const, ease: "easeInOut" as const });

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden tale-page" aria-hidden>
      <motion.div
        animate={wash({ x: [0, 24, -10], y: [0, -16, 8] })}
        transition={t(26)}
        className="tale-wash h-[30rem] w-[30rem]"
        style={{ background: "var(--tale-rose)", top: "-8rem", right: "-6rem" }}
      />
      <motion.div
        animate={wash({ x: [0, -20, 12], y: [0, 18, -8] })}
        transition={t(30, 1.5)}
        className="tale-wash h-[26rem] w-[26rem]"
        style={{ background: "var(--tale-teal)", top: "12%", left: "-7rem" }}
      />
      <motion.div
        animate={wash({ x: [0, 16, -14], y: [0, -12, 14] })}
        transition={t(34, 2.4)}
        className="tale-wash h-[24rem] w-[24rem]"
        style={{ background: "var(--tale-plum)", bottom: "-8rem", left: "18%" }}
      />
      <TaleStar className="left-[12%] top-[18%] h-3 w-3" delay={0} />
      <TaleStar className="right-[16%] top-[26%] h-4 w-4" delay={1.1} />
      <TaleStar className="left-[28%] bottom-[22%] h-2.5 w-2.5" delay={2} />
      <TaleStar className="right-[24%] bottom-[30%] h-3 w-3" delay={0.6} />
    </div>
  );
};

/* ================================================================== */
/* Page card — an open book leaf, optionally framed with corners       */
/* ================================================================== */

type TaleCardProps = React.HTMLAttributes<HTMLDivElement> & {
  delay?: number;
  framed?: boolean;
  hoverable?: boolean;
  wash?: "rose" | "teal" | "gold" | "plum" | "sky" | "none";
};

const WASH_COLOR: Record<NonNullable<TaleCardProps["wash"]>, string> = {
  rose: "var(--tale-rose)",
  teal: "var(--tale-teal)",
  gold: "var(--tale-gold)",
  plum: "var(--tale-plum)",
  sky: "var(--tale-sky)",
  none: "transparent",
};

export const TaleCard: React.FC<TaleCardProps> = ({
  className,
  children,
  delay = 0,
  framed = false,
  hoverable = false,
  wash = "none",
  ...props
}) => {
  const reduce = !!useReducedMotion();
  return (
    <motion.div
      {...inkIn(reduce, delay)}
      whileHover={hoverable && !reduce ? { y: -5, rotate: -0.3, boxShadow: "var(--tale-shadow-page-lift)" } : undefined}
      className={cn("tale-card overflow-hidden", className)}
      {...props}
    >
      {wash !== "none" ? (
        <span className="tale-wash h-40 w-40" style={{ background: WASH_COLOR[wash], top: "-3rem", right: "-2rem" }} />
      ) : null}
      {framed ? (
        <>
          <TaleCorner className="left-1.5 top-1.5" />
          <TaleCorner className="right-1.5 top-1.5" flip />
          <TaleCorner className="bottom-1.5 left-1.5 rotate-[-90deg]" />
          <TaleCorner className="bottom-1.5 right-1.5 rotate-90" />
        </>
      ) : null}
      <div className="relative">{children}</div>
    </motion.div>
  );
};

/* ================================================================== */
/* Button — a wax-seal / ribbon-styled action                          */
/* ================================================================== */

type TaleButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "ink" | "parchment" | "ghost";
  size?: "md" | "lg";
  icon?: React.ReactNode;
};

export const TaleButton: React.FC<TaleButtonProps> = ({
  className,
  children,
  variant = "ink",
  size = "md",
  icon,
  type = "button",
  ...props
}) => {
  const reduce = !!useReducedMotion();
  const variantCls = {
    ink: "border-[var(--tale-ink)]/30 bg-[image:var(--tale-gilt)] text-[#3a2410] shadow-[0_8px_18px_rgba(140,96,40,0.3),0_1px_0_rgba(255,240,200,0.6)_inset]",
    parchment:
      "border-[var(--tale-paper-edge)] bg-[var(--tale-paper)] text-[var(--tale-ink)] shadow-[var(--tale-shadow-page)] hover:bg-[var(--tale-paper-deep)]",
    ghost: "border-transparent bg-transparent text-[var(--tale-ink-soft)] hover:bg-[var(--tale-rose-wash)]",
  }[variant];
  const sizeCls = size === "lg" ? "px-7 py-3 text-base" : "px-5 py-2.5 text-sm";

  return (
    <motion.button
      whileHover={reduce ? undefined : { y: -2, scale: 1.02 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      type={type}
      className={cn(
        "tale-serif inline-flex items-center justify-center gap-2 rounded-[12px_14px_13px_15px] border-2 font-semibold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tale-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--tale-paper)] disabled:cursor-not-allowed disabled:opacity-50",
        sizeCls,
        variantCls,
        className
      )}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </motion.button>
  );
};

/* ================================================================== */
/* Section heading — a chapter opener                                  */
/* ================================================================== */

export const TaleChapterHeading: React.FC<{
  eyebrow?: string;
  title: string;
  subtitle?: string;
  ornament?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ eyebrow, title, subtitle, ornament, actionLabel, onAction }) => (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="relative">
      {eyebrow ? (
        <p className="tale-hand text-xl text-[var(--tale-ink-faint)] sm:text-2xl">{eyebrow}</p>
      ) : null}
      <h2 className="tale-title flex items-center gap-3 text-[2rem] sm:text-[2.6rem]">
        {ornament ? <span className="text-[var(--tale-gold)]">{ornament}</span> : null}
        {title}
      </h2>
      {subtitle ? <p className="tale-serif mt-1 max-w-2xl text-base leading-relaxed sm:text-lg">{subtitle}</p> : null}
      <div className="mt-2 max-w-[14rem]">
        <TaleDivider />
      </div>
    </div>
    {actionLabel && onAction ? (
      <TaleButton variant="parchment" onClick={onAction} className="w-full justify-center sm:w-auto">
        {actionLabel}
      </TaleButton>
    ) : null}
  </div>
);

/* ================================================================== */
/* Loading state — a quill writing on parchment                        */
/* ================================================================== */

export const TaleLoadingState: React.FC<{ title?: string; subtitle?: string }> = ({
  title = "Die Geschichte wird geschrieben …",
  subtitle = "Die Feder taucht in die Tinte. Einen Augenblick noch.",
}) => {
  const reduce = !!useReducedMotion();
  return (
    <div className="tale-page flex min-h-[60vh] items-center justify-center px-4 py-12">
      <motion.div {...inkIn(reduce)} className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border-2 border-[var(--tale-paper-edge)] bg-[var(--tale-paper-warm)] shadow-[var(--tale-shadow-page)]">
          <TaleQuill className="h-11 w-11" />
        </div>
        <TaleDivider className="mx-auto max-w-[12rem]" />
        <h1 className="tale-title mt-4 text-2xl">{title}</h1>
        <p className="tale-serif mt-2 text-base leading-relaxed">{subtitle}</p>
      </motion.div>
    </div>
  );
};

/* ================================================================== */
/* Stat — a "bookmark ribbon" tally                                    */
/* ================================================================== */

export const TaleTally: React.FC<{
  icon?: React.ReactNode;
  value: React.ReactNode;
  label: string;
  tone?: "rose" | "teal" | "gold" | "plum" | "sky";
}> = ({ icon, value, label, tone = "gold" }) => {
  const washVar = `var(--tale-${tone}-wash)`;
  const inkVar = `var(--tale-${tone})`;
  return (
    <span
      className="inline-flex items-center gap-2 rounded-[10px_12px_11px_13px] border border-[var(--tale-paper-edge)] px-3.5 py-1.5 shadow-[0_3px_8px_rgba(120,86,40,0.12)]"
      style={{ background: washVar }}
    >
      <span style={{ color: inkVar }}>{icon}</span>
      <span className="tale-title text-base leading-none text-[var(--tale-ink)]">{value}</span>
      <span className="tale-serif text-xs text-[var(--tale-ink-faint)]">{label}</span>
    </span>
  );
};
