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
    () => cosmosState.domains.filter((d) => d.mastery > 0).length,
    [cosmosState.domains]
  );
  const resolvedDomains = useMemo(
    () => resolveCosmosDomains(cosmosState.domains.map((entry) => entry.domainId)),
    [cosmosState.domains]
  );

  // Pre-compute planet positions for preview
  const planetDots = useMemo(() => {
    return resolvedDomains.slice(0, 10).map((domain, idx) => {
      const progress = cosmosState.domains.find(d => d.domainId === domain.id);
      const mastery = progress?.mastery ?? 0;
      const angle = (idx / Math.max(1, Math.min(10, resolvedDomains.length))) * Math.PI * 2;
      const radius = 25 + idx * 3;
      return {
        id: domain.id,
        color: domain.color,
        size: 6 + (mastery / 100) * 10, // 6–16px
        x: 50 + Math.cos(angle) * radius,
        y: 50 + Math.sin(angle) * radius,
        delay: idx * 0.4,
      };
    });
  }, [cosmosState.domains, resolvedDomains]);

  return (
    <motion.button
      type="button"
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => navigate('/cosmos')}
      className="group relative w-full h-full overflow-hidden rounded-3xl border text-left"
      style={{
        borderColor: isDark ? '#1e293b' : '#c8b8d8',
        background: isDark
          ? 'linear-gradient(135deg, rgba(8,8,24,0.95) 0%, rgba(15,10,35,0.98) 100%)'
          : 'linear-gradient(135deg, #0c0c20 0%, #1a1040 100%)',
        boxShadow: isDark
          ? '0 12px 40px rgba(80,60,180,0.15)'
          : '0 12px 40px rgba(80,60,180,0.2)',
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

      {/* Bottom gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(8,8,24,0.9) 0%, transparent 60%)',
        }}
      />

      {/* Content overlay */}
      <div className="relative z-10 flex flex-col justify-end h-full p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-300/80">
              Dein Universum
            </p>
            <h2
              className="mt-0.5 text-lg font-extrabold leading-tight text-white"
              style={{ fontFamily: '"Nunito", sans-serif' }}
            >
              Lernkosmos
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold text-white/50">
              <Telescope className="h-3 w-3" />
              {activeDomains > 0
                ? `${activeDomains} Welten aktiv`
                : '8 Welten warten'}
            </p>
          </div>

          {/* CTA */}
          <div className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-purple-500/30">
            <Sparkles className="h-3.5 w-3.5" />
            Los!
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </motion.button>
  );
};

export default CosmosHomeCard;
