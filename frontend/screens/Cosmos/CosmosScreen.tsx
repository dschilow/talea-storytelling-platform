/**
 * CosmosScreen.tsx - Full-page "Mein Lernkosmos" view
 *
 * Route: /cosmos
 * Shows the full 3D solar system with HUD overlay.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CosmosFallbackList, CosmosSceneRoot } from './CosmosSceneRoot';
import { useCosmosState } from './useCosmosState';
import type { CameraMode } from './CosmosTypes';

// If the 3D scene has not drawn its first frame by then (old GPU, blocked WebGL,
// software rendering), the 2D view takes over instead of an endless spinner.
const SCENE_START_TIMEOUT_MS = 10_000;
const VIEW_STORAGE_KEY = 'talea.cosmos.view';

type CosmosView = '3d' | '2d';

function loadView(): CosmosView {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === '2d' ? '2d' : '3d';
  } catch {
    return '3d';
  }
}

function saveView(view: CosmosView) {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // Remembering the view is a convenience only.
  }
}

const CosmosScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cosmosState, isLoading, activeAvatarId, activeChildId } = useCosmosState();
  const initialPlanet = useMemo(() => new URLSearchParams(location.search).get('planet'), [location.search]);
  const [cameraMode, setCameraMode] = useState<CameraMode>('system');
  const [hasFocusedDomain, setHasFocusedDomain] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [view, setView] = useState<CosmosView>(loadView);
  const [fellBack, setFellBack] = useState(false);

  useEffect(() => {
    setSceneReady(false);
  }, [activeAvatarId, activeChildId]);

  const switchView = (next: CosmosView, automatic = false) => {
    setView(next);
    setFellBack(automatic);
    setSceneReady(false);
    saveView(next);
    if (next === '2d') setCameraMode('system');
  };

  useEffect(() => {
    if (view !== '3d' || isLoading || sceneReady) return;
    const timer = window.setTimeout(() => switchView('2d', true), SCENE_START_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [view, isLoading, sceneReady]);

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
            Zurück
          </button>

          <div className="ml-auto flex items-center gap-1 rounded-xl border border-white/15 bg-black/35 px-1.5 py-1 backdrop-blur">
            <HeaderModeButton
              label={view === '3d' ? '2D' : '3D'}
              active={false}
              onClick={() => switchView(view === '3d' ? '2d' : '3d')}
            />
            {view === '3d' && <>
            <HeaderModeButton
              label="Übersicht"
              active={cameraMode === 'system'}
              onClick={() => setCameraMode('system')}
            />
            <HeaderModeButton
              label="Planet"
              active={cameraMode === 'focus'}
              disabled={!hasFocusedDomain}
              onClick={() => setCameraMode('focus')}
            />
            <HeaderModeButton
              label="Monde"
              active={cameraMode === 'detail'}
              disabled={!hasFocusedDomain}
              onClick={() => setCameraMode('detail')}
            />
            </>}
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
        ) : view === '2d' ? (
          <div className="flex h-full flex-col">
            {fellBack && (
              <p className="mx-4 mt-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-center text-xs font-semibold text-white/75">
                Die 3D-Ansicht startet auf diesem Gerät gerade nicht. Hier sind deine Welten als Übersicht.
              </p>
            )}
            <div className="min-h-0 flex-1">
              <CosmosFallbackList cosmosState={cosmosState} />
            </div>
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
            onSceneReady={() => setSceneReady(true)}
            onSceneFailed={() => switchView('2d', true)}
            initialFocusDomainId={initialPlanet}
          />
        )}

        {!isLoading && view === '3d' && !sceneReady && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/15 bg-black/45 px-5 py-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                className="h-7 w-7 rounded-full border-2 border-white/70 border-t-transparent"
              />
              <p className="text-xs font-semibold text-white/80">Lernkosmos wird geladen...</p>
            </div>
          </div>
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
