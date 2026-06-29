import React from "react";

/**
 * Editorial geometric cover system.
 *
 * Replaces emoji/illustration placeholders with composed, flat-geometric
 * "book-jacket" artwork — like a designed publishing series. Each cover is
 * deterministic (driven by `seed`) so the same story always gets the same
 * artwork, and the whole set shares one visual grammar: a tinted ground,
 * 2–3 large shapes, a thin baseline rule. No gradients, no clipart.
 */

const GROUNDS = ["var(--ed-clay)", "var(--ed-sage)", "var(--ed-ochre)", "var(--ed-slate)", "var(--ed-plum)"];

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

type Variant = "arc" | "moon" | "peaks" | "orbit" | "stack" | "window" | "waves" | "sun" | "path";

const VARIANTS: Variant[] = ["arc", "moon", "peaks", "orbit", "stack", "window", "waves", "sun", "path"];

export const EdCover: React.FC<{
  seed: string;
  className?: string;
  /** force a ground tone instead of deriving from seed */
  tone?: number;
  label?: string;
}> = ({ seed, className, tone, label }) => {
  const h = hash(seed);
  // Decouple ground tone and shape variant onto two independent hashes so
  // neighbouring covers don't collide on the same tone+shape pairing.
  const h2 = hash(seed + "·tone");
  const ground = GROUNDS[(tone ?? h2) % GROUNDS.length];
  const variant = VARIANTS[h % VARIANTS.length];
  // paper-cream ink color that reads on every ground
  const ink = "#f5f0e6";
  const inkSoft = "rgba(245,240,230,0.55)";
  const shade = "rgba(0,0,0,0.16)";

  return (
    <div className={`ed-cover ${className ?? ""}`} style={{ background: ground }}>
      <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <radialGradient id={`sheen-${h % 9999}`} cx="30%" cy="14%" r="90%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        {variant === "arc" && (
          <>
            <circle cx="100" cy="150" r="78" fill={ink} opacity="0.92" />
            <circle cx="100" cy="150" r="78" fill="none" stroke={shade} strokeWidth="1" />
            <rect x="0" y="0" width="200" height="40" fill={shade} opacity="0.5" />
          </>
        )}
        {variant === "moon" && (
          <>
            <circle cx="130" cy="72" r="46" fill={ink} opacity="0.95" />
            <circle cx="146" cy="62" r="46" fill={ground} />
            <line x1="0" y1="150" x2="200" y2="150" stroke={inkSoft} strokeWidth="2" />
            <circle cx="46" cy="150" r="6" fill={ink} />
          </>
        )}
        {variant === "peaks" && (
          <>
            <path d="M0 200 L60 96 L108 200 Z" fill={ink} opacity="0.92" />
            <path d="M86 200 L150 70 L200 168 L200 200 Z" fill={shade} opacity="0.7" />
            <circle cx="158" cy="48" r="20" fill={ink} opacity="0.95" />
          </>
        )}
        {variant === "orbit" && (
          <>
            <circle cx="100" cy="100" r="58" fill="none" stroke={inkSoft} strokeWidth="2" />
            <circle cx="100" cy="100" r="22" fill={ink} opacity="0.95" />
            <circle cx="158" cy="100" r="9" fill={ink} />
            <circle cx="64" cy="58" r="5" fill={ink} opacity="0.8" />
          </>
        )}
        {variant === "stack" && (
          <>
            <rect x="34" y="120" width="132" height="20" rx="3" fill={ink} opacity="0.95" />
            <rect x="46" y="92" width="108" height="20" rx="3" fill={shade} opacity="0.7" />
            <rect x="58" y="64" width="84" height="20" rx="3" fill={ink} opacity="0.8" />
            <line x1="0" y1="160" x2="200" y2="160" stroke={inkSoft} strokeWidth="2" />
          </>
        )}
        {variant === "window" && (
          <>
            <rect x="56" y="40" width="88" height="120" rx="44" fill={ink} opacity="0.95" />
            <rect x="56" y="40" width="88" height="120" rx="44" fill="none" stroke={shade} strokeWidth="1.5" />
            <line x1="100" y1="40" x2="100" y2="160" stroke={ground} strokeWidth="2" />
            <line x1="56" y1="100" x2="144" y2="100" stroke={ground} strokeWidth="2" />
          </>
        )}
        {variant === "waves" && (
          <>
            <path d="M0 120 Q50 96 100 120 T200 120 V200 H0 Z" fill={ink} opacity="0.9" />
            <path d="M0 142 Q50 120 100 142 T200 142 V200 H0 Z" fill={shade} opacity="0.6" />
            <circle cx="150" cy="56" r="18" fill={ink} opacity="0.95" />
          </>
        )}
        {variant === "sun" && (
          <>
            <circle cx="100" cy="104" r="40" fill={ink} opacity="0.95" />
            <g stroke={inkSoft} strokeWidth="3" strokeLinecap="round">
              <line x1="100" y1="34" x2="100" y2="50" />
              <line x1="100" y1="158" x2="100" y2="174" />
              <line x1="30" y1="104" x2="46" y2="104" />
              <line x1="154" y1="104" x2="170" y2="104" />
              <line x1="52" y1="56" x2="63" y2="67" />
              <line x1="137" y1="141" x2="148" y2="152" />
              <line x1="148" y1="56" x2="137" y2="67" />
              <line x1="63" y1="141" x2="52" y2="152" />
            </g>
          </>
        )}
        {variant === "path" && (
          <>
            <path d="M40 200 C40 150 160 130 160 80 C160 50 110 44 80 40" fill="none" stroke={ink} strokeWidth="6" strokeLinecap="round" opacity="0.9" strokeDasharray="2 14" />
            <circle cx="80" cy="40" r="10" fill={ink} />
            <circle cx="40" cy="190" r="7" fill={shade} />
          </>
        )}
        {/* top-light sheen for depth */}
        <rect x="0" y="0" width="200" height="200" fill={`url(#sheen-${h % 9999})`} />
      </svg>
      {/* fine paper grain inside the cover */}
      <span className="ed-grain pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay" aria-hidden />
      {label ? (
        <span
          className="ed-serif absolute bottom-2.5 left-3 right-3 text-[11px] font-medium leading-tight"
          style={{ color: ink, opacity: 0.85 }}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
};

/** Round geometric avatar token, same grammar, for characters. */
export const EdAvatar: React.FC<{ seed: string; className?: string }> = ({ seed, className }) => {
  const h = hash(seed);
  const ground = GROUNDS[h % GROUNDS.length];
  const ink = "#f5f0e6";
  const shade = "rgba(0,0,0,0.18)";
  const v = h % 4;
  return (
    <div className={`relative overflow-hidden rounded-full ${className ?? ""}`} style={{ background: ground }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        {v === 0 && (<><circle cx="50" cy="64" r="30" fill={ink} opacity="0.92" /><circle cx="50" cy="34" r="14" fill={ink} /></>)}
        {v === 1 && (<><rect x="26" y="40" width="48" height="44" rx="14" fill={ink} opacity="0.92" /><circle cx="50" cy="30" r="12" fill={ink} /></>)}
        {v === 2 && (<><path d="M22 86 Q50 30 78 86 Z" fill={ink} opacity="0.92" /><circle cx="50" cy="36" r="11" fill={shade} /></>)}
        {v === 3 && (<><circle cx="50" cy="50" r="26" fill={ink} opacity="0.92" /><circle cx="50" cy="50" r="11" fill={ground} /></>)}
      </svg>
    </div>
  );
};
