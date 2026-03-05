/**
 * CosmosScreen.tsx - Full-page "Mein Lernkosmos" view
 *
 * Route: /cosmos
 * Shows the full 3D solar system with HUD overlay.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CosmosSceneRoot } from './CosmosSceneRoot';
import { useCosmosState } from './useCosmosState';
import type { CameraMode } from './CosmosTypes';

const CosmosScreen: React.FC = () => {
  const navigate = useNavigate();
  const { cosmosState, isLoading, activeAvatarId, activeChildId } = useCosmosState();
  const [cameraMode, setCameraMode] = useState<CameraMode>('system');
  const [hasFocusedDomain, setHasFocusedDomain] = useState(false);

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs md:text-sm font-bold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurueck
          </button>

          <div className="ml-auto flex items-center gap-1 rounded-xl border border-white/15 bg-black/35 px-1.5 py-1 backdrop-blur">
            <HeaderModeButton
              label="System"
              active={cameraMode === 'system'}
              onClick={() => setCameraMode('system')}
            />
            <HeaderModeButton
              label="Fokus"
              active={cameraMode === 'focus'}
              disabled={!hasFocusedDomain}
              onClick={() => setCameraMode('focus')}
            />
            <HeaderModeButton
              label="Detail"
              active={cameraMode === 'detail'}
              disabled={!hasFocusedDomain}
              onClick={() => setCameraMode('detail')}
            />
          </div>
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
            qualityPreference="auto"
            cameraModeOverride={cameraMode}
            onCameraModeChange={setCameraMode}
            onFocusAvailabilityChange={setHasFocusedDomain}
            showInternalModeTabs={false}
          />
        )}
      </div>
    </div>
  );
};

const HeaderModeButton: React.FC<{
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}> = ({ label, active, disabled = false, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors disabled:opacity-35"
    style={{
      background: active ? 'rgba(164, 120, 255, 0.35)' : 'transparent',
      color: active ? '#f5eaff' : '#d6d8ec',
    }}
  >
    {label}
  </button>
);

export default CosmosScreen;
