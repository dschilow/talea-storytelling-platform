/**
 * CosmosHomeCard.tsx - Compact cosmos tile for the Home Screen
 * Replaces the old TaleaJourneyCard.
 *
 * Shows a mini 3D cosmos scene that's clickable to navigate to /cosmos.
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { CosmosSceneRoot } from './CosmosSceneRoot';
import type { CosmosState } from './CosmosTypes';

interface Props {
  isDark: boolean;
  cosmosState: CosmosState;
}

const CosmosHomeCard: React.FC<Props> = ({ isDark, cosmosState }) => {
  const navigate = useNavigate();

  const activeDomains = useMemo(
    () => cosmosState.domains.filter((d) => d.mastery > 0).length,
    [cosmosState.domains]
  );

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
      {/* 3D Scene background */}
      <div className="absolute inset-0 opacity-80">
        <CosmosSceneRoot
          cosmosState={cosmosState}
          height="100%"
          compact
        />
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
            <p className="mt-1 text-[12px] font-semibold text-white/50">
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
