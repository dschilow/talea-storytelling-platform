/**
 * CosmosHomeCard.tsx - Compact cosmos tile for the Home Screen
 * Replaces the old TaleaJourneyCard.
 *
 * Uses a CSS-only starfield preview (no Three.js!) to keep bundle small.
 * Three.js is only loaded when navigating to /cosmos.
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Telescope } from 'lucide-react';
import type { CosmosState } from './CosmosTypes';
import { resolveCosmosDomains } from './CosmosAssetsRegistry';
import { computePlanetEvolution } from './CosmosEvolution';
import { countUnseenGrowth } from './CosmosSeenState';

interface Props {
  isDark: boolean;
  cosmosState: CosmosState;
}

/** Tiny CSS planet dots for the preview */
const PlanetDot: React.FC<{
  color: string;
  size: number;
  x: number;
  y: number;
  delay: number;
}> = ({ color, size, x, y, delay }) => (
  <motion.div
    className="absolute rounded-full"
    style={{
      width: size,
      height: size,
      left: `${x}%`,
      top: `${y}%`,
      background: `radial-gradient(circle at 35% 35%, ${color}, ${color}88)`,
      boxShadow: `0 0 ${size}px ${color}44`,
    }}
    animate={{
      y: [0, -3, 0, 3, 0],
      opacity: [0.7, 1, 0.7],
    }}
    transition={{
      duration: 4 + delay,
      repeat: Infinity,
      ease: 'easeInOut',
      delay,
    }}
  />
);

const CosmosHomeCard: React.FC<Props> = ({ isDark, cosmosState }) => {
  const navigate = useNavigate();

  const activeDomains = useMemo(
    () => cosmosState.domains.filter((d) => computePlanetEvolution(d).stage > 0).length,
    [cosmosState.domains]
  );
  const grownWorlds = useMemo(
    () => (cosmosState.seenKey ? countUnseenGrowth(cosmosState.seenKey, cosmosState) : 0),
    [cosmosState]
  );
  const resolvedDomains = useMemo(
    () => resolveCosmosDomains(cosmosState.domains.map((entry) => entry.domainId)),
    [cosmosState.domains]
  );

  // Pre-compute planet positions for preview
  const planetDots = useMemo(() => {
    return resolvedDomains.slice(0, 10).map((domain, idx) => {
      const progress = cosmosState.domains.find(d => d.domainId === domain.id);
      const stage = progress ? computePlanetEvolution(progress, domain.planetType).stage : 0;
      const angle = (idx / Math.max(1, Math.min(10, resolvedDomains.length))) * Math.PI * 2;
      const radius = 25 + idx * 3;
      return {
        id: domain.id,
        color: domain.color,
        size: stage === 0 ? 4 : 7 + stage * 1.2, // stardust 4px, Sternenwelt ~17px
        x: 50 + Math.cos(angle) * radius,
        y: 50 + Math.sin(angle) * radius,
        delay: idx * 0.4,
      };
    });
  }, [cosmosState.domains, resolvedDomains]);

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.985 }}
      onClick={() => navigate('/cosmos')}
      className="group relative h-full w-full overflow-hidden rounded-[inherit] text-left focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--talea-brand-cream)]"
      style={{
        // A warm night sky in the Talea palette instead of the generic purple space look.
        background: isDark
          ? 'linear-gradient(135deg, #15101a 0%, #221822 55%, #2e1c1c 100%)'
          : 'linear-gradient(135deg, #1b1424 0%, #2a1c2e 55%, #3b2422 100%)',
        minHeight: '200px',
      }}
    >
      {/* CSS Starfield background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Static stars via radial gradients */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `
              radial-gradient(1px 1px at 20% 30%, white, transparent),
              radial-gradient(1px 1px at 40% 70%, white, transparent),
              radial-gradient(1px 1px at 60% 20%, white, transparent),
              radial-gradient(1px 1px at 80% 60%, white, transparent),
              radial-gradient(1px 1px at 10% 80%, white, transparent),
              radial-gradient(1px 1px at 70% 40%, white, transparent),
              radial-gradient(1.5px 1.5px at 30% 50%, white, transparent),
              radial-gradient(1.5px 1.5px at 90% 10%, white, transparent),
              radial-gradient(1px 1px at 50% 90%, white, transparent),
              radial-gradient(1px 1px at 15% 15%, white, transparent),
              radial-gradient(1px 1px at 85% 85%, white, transparent),
              radial-gradient(1px 1px at 55% 45%, white, transparent)
            `,
          }}
        />

        {/* Central star glow */}
        <div
          className="absolute rounded-full"
          style={{
            width: 24,
            height: 24,
            left: 'calc(50% - 12px)',
            top: 'calc(50% - 12px)',
            background: 'radial-gradient(circle, #fff4d6 0%, #ffb347 40%, transparent 70%)',
            boxShadow: '0 0 30px #ffcc6644, 0 0 60px #ffb34722',
          }}
        />

        {/* Planet dots */}
        {planetDots.map((dot) => (
          <PlanetDot key={dot.id} {...dot} />
        ))}
      </div>

      {grownWorlds > 0 && (
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [1, 1.08, 1], opacity: 1 }}
          transition={{ scale: { duration: 1.6, repeat: Infinity }, opacity: { duration: 0.3 } }}
          className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-full bg-[#f3d58f] px-2.5 py-1 text-[11px] font-bold text-[#3e281f] shadow-[0_6px_16px_-6px_rgba(243,213,143,0.7)]"
        >
          <Sparkles className="h-3 w-3" />
          {grownWorlds === 1 ? 'Eine Welt ist gewachsen!' : `${grownWorlds} Welten sind gewachsen!`}
        </motion.span>
      )}

      {/* Bottom gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(20,13,14,0.88) 0%, transparent 62%)',
        }}
      />

      {/* Content overlay */}
      <div className="relative z-10 flex flex-col justify-end h-full p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#f3c3a6]">
              Dein Universum
            </p>
            <h2
              className="mt-0.5 text-[1.35rem] font-semibold leading-tight text-[var(--talea-brand-cream)]"
              style={{ fontFamily: 'var(--talea-font-display)' }}
            >
              Lernkosmos
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-medium text-[#fff7ec]/65">
              <Telescope className="h-3 w-3" />
              {activeDomains > 0
                ? `${activeDomains} ${activeDomains === 1 ? 'Welt wächst' : 'Welten wachsen'}`
                : `${resolvedDomains.length} Welten warten auf dich`}
            </p>
          </div>

          {/* CTA */}
          <div className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-[var(--talea-brand-cream)] px-5 text-[15px] font-semibold text-[var(--talea-brand-brown)] shadow-[0_8px_20px_-10px_rgba(0,0,0,0.6)] transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none">
            Los!
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </div>
        </div>
      </div>
    </motion.button>
  );
};

export default CosmosHomeCard;
