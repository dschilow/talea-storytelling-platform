import React, { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

/**
 * Small editorial building blocks shared across the Talea Editorial layer.
 * Deliberately minimal: hairline progress, ring, tag, rule-with-label.
 */

/** Thin reading-progress bar in the accent tone — animates fill when in view. */
export const EdProgress: React.FC<{ value: number; className?: string; delay?: number }> = ({ value, className, delay = 0 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, amount: 0.8 });
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div ref={ref} className={`relative h-[3px] w-full overflow-hidden rounded-full bg-[var(--ed-line)] ${className ?? ""}`}>
      <motion.div
        className="h-full rounded-full bg-[var(--ed-accent)]"
        initial={reduce ? { width: `${pct}%` } : { width: 0 }}
        animate={inView ? { width: `${pct}%` } : undefined}
        transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
};

/** Circular progress ring (used over the featured cover) — draws in on view. */
export const EdRing: React.FC<{ value: number; size?: number; stroke?: number; className?: string; children?: React.ReactNode }> = ({
  value, size = 52, stroke = 3, className, children,
}) => {
  const ref = useRef<SVGSVGElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, amount: 0.8 });
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <div className={`relative inline-flex items-center justify-center ${className ?? ""}`} style={{ width: size, height: size }}>
      <svg ref={ref} width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ed-paper)" strokeWidth={stroke}
          strokeDasharray={c} strokeLinecap="round"
          initial={reduce ? { strokeDashoffset: off } : { strokeDashoffset: c }}
          animate={inView ? { strokeDashoffset: off } : undefined}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">{children}</span>
    </div>
  );
};

/** Small outline tag (genre / status). */
export const EdTag: React.FC<{ children: React.ReactNode; accent?: boolean; className?: string }> = ({ children, accent, className }) => (
  <span
    className={`ed-sans inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
      accent
        ? "border-[var(--ed-accent)] text-[var(--ed-accent)]"
        : "border-[var(--ed-line-2)] text-[var(--ed-ink-3)]"
    } ${className ?? ""}`}
  >
    {children}
  </span>
);

/** A 4-pointed editorial spark/star, decorative. */
export const EdSpark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M12 0c.7 6.4 4.9 10.6 11.3 11.3C16.9 12 12.7 16.2 12 22.6 11.3 16.2 7.1 12 0.7 11.3 7.1 10.6 11.3 6.4 12 0Z" />
  </svg>
);

/** Decorative rule with a centered small-caps label, editorial style. */
export const EdRuleLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`flex items-center gap-3 ${className ?? ""}`}>
    <span className="ed-rule flex-1" />
    <span className="ed-eyebrow">{children}</span>
    <span className="ed-rule flex-1" />
  </div>
);
