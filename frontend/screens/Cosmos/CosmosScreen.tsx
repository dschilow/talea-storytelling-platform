/**
 * CosmosScreen.tsx - Full-page "Mein Lernkosmos" view
 *
 * Route: /cosmos
 * Shows the full 3D solar system with HUD overlay.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Telescope } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CosmosSceneRoot } from './CosmosSceneRoot';
import { useCosmosState } from './useCosmosState';
import type { CosmosQualityPreference } from './CosmosQuality';
import {
  loadQualityPreference,
  saveQualityPreference,
  resolveQualityTier,
} from './CosmosQuality';

const CosmosScreen: React.FC = () => {
  const navigate = useNavigate();
  const { cosmosState, isLoading, activeAvatarId, activeChildId } = useCosmosState();
  const [qualityPreference, setQualityPreference] = useState<CosmosQualityPreference>('auto');

  useEffect(() => {
    setQualityPreference(loadQualityPreference());
  }, []);

  const activeQualityLabel = useMemo(() => {
    const effective = resolveQualityTier(qualityPreference);
    if (qualityPreference === 'auto') {
      return `Auto (${effective.toUpperCase()})`;
    }
    return qualityPreference.toUpperCase();
  }, [qualityPreference]);

  return (
    <div
      className="relative flex flex-col w-full"
      style={{
        height: '100dvh',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #050510 0%, #0c0820 50%, #10082a 100%)',
      }}
    >
      {/* Top bar */}
      <div
        className="relative z-30 px-3 pb-2 pt-2 md:px-5"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs md:text-sm font-bold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurueck
          </button>

          <button
            type="button"
            onClick={() => {
              const next: CosmosQualityPreference =
                qualityPreference === 'auto'
                  ? 'low'
                  : qualityPreference === 'low'
                  ? 'standard'
                  : qualityPreference === 'standard'
                  ? 'aaa'
                  : 'auto';
              setQualityPreference(next);
              saveQualityPreference(next);
            }}
            className="shrink-0 rounded-xl border border-white/15 bg-white/5 px-2.5 py-2 text-[10px] md:text-[11px] font-bold text-white/85 hover:bg-white/10 transition-colors"
          >
            Quality: {activeQualityLabel}
          </button>
        </div>

        <div className="mt-1.5 flex items-center justify-center gap-1.5 px-2">
          <Telescope className="h-4 w-4 text-purple-400 shrink-0" />
          <h1
            className="text-sm md:text-base font-extrabold text-white truncate max-w-[85vw]"
            style={{ fontFamily: '"Nunito", sans-serif' }}
            title={
              cosmosState.childName
                ? `${cosmosState.childName}s Lernkosmos`
                : 'Mein Lernkosmos'
            }
          >
            {cosmosState.childName
              ? `${cosmosState.childName}s Lernkosmos`
              : 'Mein Lernkosmos'}
          </h1>
        </div>
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
          <CosmosSceneRoot
            cosmosState={cosmosState}
            activeAvatarId={activeAvatarId || undefined}
            activeChildId={activeChildId || undefined}
            height="100%"
            qualityPreference={qualityPreference}
          />
        )}
      </div>
    </div>
  );
};

export default CosmosScreen;
