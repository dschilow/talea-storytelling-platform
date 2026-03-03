/**
 * CosmosScreen.tsx - Full-page "Mein Lernkosmos" view
 *
 * Route: /cosmos
 * Shows the full 3D solar system with HUD overlay.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Telescope } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CosmosSceneRoot } from './CosmosSceneRoot';
import { useCosmosState } from './useCosmosState';

const CosmosScreen: React.FC = () => {
  const navigate = useNavigate();
  const { cosmosState, isLoading } = useCosmosState();

  return (
    <div
      className="relative flex flex-col w-full"
      style={{
        height: 'calc(100vh - 64px)',  // account for bottom nav
        background: 'linear-gradient(135deg, #050510 0%, #0c0820 50%, #10082a 100%)',
      }}
    >
      {/* Top bar */}
      <div className="relative z-20 flex items-center justify-between px-5 py-3">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </button>

        <div className="flex items-center gap-2">
          <Telescope className="h-4 w-4 text-purple-400" />
          <h1
            className="text-base font-extrabold text-white"
            style={{ fontFamily: '"Nunito", sans-serif' }}
          >
            {cosmosState.childName
              ? `${cosmosState.childName}s Lernkosmos`
              : 'Mein Lernkosmos'}
          </h1>
        </div>

        {/* Spacer for centering */}
        <div className="w-20" />
      </div>

      {/* 3D Scene */}
      <div className="relative flex-1 min-h-0">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="h-8 w-8 rounded-full border-2 border-purple-500 border-t-transparent"
            />
          </div>
        ) : (
          <CosmosSceneRoot cosmosState={cosmosState} height="100%" />
        )}
      </div>

      {/* Legend bar (bottom) */}
      <div className="relative z-20 flex items-center justify-center gap-4 px-4 py-2 border-t border-white/5">
        {[
          { label: 'Entdeckt', color: '#94a3b8' },
          { label: 'Verstanden', color: '#60a5fa' },
          { label: 'Kann erklären', color: '#a78bfa' },
          { label: 'Sitzt wirklich', color: '#facc15' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 rounded-full"
              style={{ background: color }}
            />
            <span className="text-[10px] font-semibold text-white/40">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CosmosScreen;
