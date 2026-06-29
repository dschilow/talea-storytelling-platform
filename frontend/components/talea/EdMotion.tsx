import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  animate,
  type Variants,
} from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Motion building blocks for the Talea Editorial layer.
 * Framer Motion 12 — staggered reveals, spring hovers, animated counters,
 * magnetic tilt, shimmering accents. All respect prefers-reduced-motion.
 */

const EASE = [0.22, 1, 0.36, 1] as const;
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/* ---- container / item variants for staggered reveals ---- */

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

export const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 22, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: EASE } },
};

export const fadeItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/** Wraps a block; reveals its children with a stagger when scrolled into view. */
export const Reveal: React.FC<{
  children: React.ReactNode;
  className?: string;
  amount?: number;
  delay?: number;
  as?: "div" | "section" | "ul" | "header";
}> = ({ children, className, amount = 0.2, delay = 0, as = "div" }) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, amount, margin: "0px 0px -10% 0px" });
  const MotionTag = motion[as] as typeof motion.div;
  return (
    <MotionTag
      ref={ref as React.RefObject<HTMLDivElement>}
      variants={staggerContainer}
      initial={reduce ? undefined : "hidden"}
      animate={reduce ? undefined : inView ? "show" : "hidden"}
      transition={{ delayChildren: delay }}
      className={className}
    >
      {children}
    </MotionTag>
  );
};

/** A single staggered child (use inside <Reveal>). */
export const RevealItem: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { variant?: "up" | "fade"; as?: "div" | "article" | "li" }
> = ({ children, className, variant = "up", as = "div", ...props }) => {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] as typeof motion.div;
  return (
    <MotionTag variants={reduce ? undefined : variant === "up" ? fadeUpItem : fadeItem} className={className} {...props}>
      {children}
    </MotionTag>
  );
};

/* ---- animated number counter ---- */

export const Counter: React.FC<{ to: number; className?: string; durationMs?: number; suffix?: string }> = ({
  to, className, durationMs = 1100, suffix = "",
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [val, setVal] = useState(reduce ? to : 0);

  useEffect(() => {
    if (reduce || !inView) return;
    const controls = animate(0, to, {
      duration: durationMs / 1000,
      ease: EASE_OUT,
      onUpdate: (v) => setVal(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, to, durationMs, reduce]);

  return <span ref={ref} className={className}>{val}{suffix}</span>;
};

/* ---- magnetic / tilt card ---- */

export const TiltCard: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { intensity?: number; lift?: number }
> = ({ children, className, intensity = 6, lift = 6, ...props }) => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const rx = useSpring(useMotionValue(0), { stiffness: 220, damping: 18 });
  const ry = useSpring(useMotionValue(0), { stiffness: 220, damping: 18 });
  const y = useSpring(useMotionValue(0), { stiffness: 260, damping: 20 });

  const onMove = (e: React.MouseEvent) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * intensity);
    rx.set(-py * intensity);
  };
  const onEnter = () => !reduce && y.set(-lift);
  const onLeave = () => { rx.set(0); ry.set(0); y.set(0); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={reduce ? undefined : { rotateX: rx, rotateY: ry, y, transformPerspective: 900 }}
      className={cn("[transform-style:preserve-3d]", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

/* ---- shimmer sweep (for accents / skeletons) ---- */

export const Shimmer: React.FC<{ className?: string }> = ({ className }) => {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <span className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <motion.span
        initial={{ x: "-120%" }}
        animate={{ x: "120%" }}
        transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 3.5, ease: "easeInOut" }}
        className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)]"
      />
    </span>
  );
};

/* ---- animated underline link ---- */

export const UnderlineLink: React.FC<React.HTMLAttributes<HTMLButtonElement>> = ({ children, className, ...props }) => (
  <button className={cn("group relative inline-flex items-center gap-1.5 font-bold", className)} {...props}>
    <span className="relative">
      {children}
      <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-current transition-transform duration-300 ease-out group-hover:scale-x-100" />
    </span>
  </button>
);

export { EASE, EASE_OUT, useReducedMotion, useTransform };
