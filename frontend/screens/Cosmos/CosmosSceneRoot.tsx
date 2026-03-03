/**
 * CosmosSceneRoot.tsx - Main R3F scene for the "Mein Lernkosmos"
 *
 * Assembles: Starfield + Star + Orbits + Planets + Camera + HUD
 * Supports WebGL fallback to 2D list view.
 */

import React, { useState, useCallback, useMemo, Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { CosmosStarCenter } from './CosmosStarCenter';
import { CosmosPlanetDomain } from './CosmosPlanetDomain';
import { CosmosOrbitRig } from './CosmosOrbitRig';
import { CosmosCameraController } from './CosmosCameraController';
import { CosmosStarfield } from './CosmosStarfield';
import { CosmosDeepSpaceBackdrop } from './CosmosDeepSpaceBackdrop';
import { CosmosHudOverlay } from './CosmosHudOverlay';
import { getDomainById, resolveCosmosDomains } from './CosmosAssetsRegistry';
import type { CameraMode, CosmosState, DomainProgress } from './CosmosTypes';
import { useNavigate } from 'react-router-dom';

interface Props {
  cosmosState: CosmosState;
  /** Height of the canvas container */
  height?: string;
  /** Compact mode for home screen tile (smaller, no HUD) */
  compact?: boolean;
}

// Default empty progress for domains not yet tracked
const emptyProgress = (domainId: string): DomainProgress => ({
  domainId,
  mastery: 0,
  confidence: 0,
  stage: 'discovered',
  topicsExplored: 0,
  lastActivityAt: null,
});

export const CosmosSceneRoot: React.FC<Props> = ({
  cosmosState,
  height = '100%',
  compact = false,
}) => {
  const navigate = useNavigate();
  const [cameraMode, setCameraMode] = useState<CameraMode>('overview');
  const [focusedDomainId, setFocusedDomainId] = useState<string | null>(null);
  const [focusedPosition, setFocusedPosition] = useState<[number, number, number] | null>(null);
  const [effectsEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  // Build progress map
  const progressMap = useMemo(() => {
    const map = new Map<string, DomainProgress>();
    for (const dp of cosmosState.domains) {
      map.set(dp.domainId, dp);
    }
    return map;
  }, [cosmosState.domains]);

  const getProgress = useCallback(
    (domainId: string) => progressMap.get(domainId) ?? emptyProgress(domainId),
    [progressMap]
  );

  const sceneDomains = useMemo(
    () => resolveCosmosDomains(cosmosState.domains.map((entry) => entry.domainId)),
    [cosmosState.domains]
  );

  const focusedDomain = focusedDomainId
    ? getDomainById(focusedDomainId, sceneDomains) ?? null
    : null;
  const focusedProgress = focusedDomainId ? getProgress(focusedDomainId) : null;

  const handleSelectPlanet = useCallback(
    (domainId: string, position: [number, number, number]) => {
      if (compact) {
        navigate('/cosmos');
        return;
      }
      setFocusedDomainId(domainId);
      setFocusedPosition(position);
      setCameraMode('focused');
    },
    [compact, navigate]
  );

  const handleResetFocus = useCallback(() => {
    setFocusedDomainId(null);
    setFocusedPosition(null);
    setCameraMode('overview');
  }, []);

  const handleStartLearning = useCallback(
    (domainId: string) => {
      // Navigate to doku creation with domain context
      navigate(`/doku/create?domain=${domainId}`);
    },
    [navigate]
  );

  // WebGL availability check
  const [webglSupported] = useState(() => {
    try {
      const canvas = document.createElement('canvas');
      return !!(
        canvas.getContext('webgl2') || canvas.getContext('webgl')
      );
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && cameraMode === 'focused') {
        handleResetFocus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cameraMode, handleResetFocus]);

  if (!webglSupported) {
    return <CosmosFallbackList cosmosState={cosmosState} />;
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <Canvas
        camera={{
          position: compact ? [6, 11, 17] : [8, 14, 24],
          fov: 50,
          near: 0.1,
          far: 200,
        }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        style={{ background: 'transparent' }}
        onPointerMissed={() => {
          if (cameraMode === 'focused') handleResetFocus();
        }}
        onDoubleClick={() => {
          if (cameraMode === 'focused') handleResetFocus();
        }}
      >
        <Suspense fallback={null}>
          {/* Cinematic deep-space back layer */}
          <CosmosDeepSpaceBackdrop />

          {/* Background stars */}
          <CosmosStarfield count={compact ? 2000 : 4000} />

          {/* Central star (the child) */}
          <CosmosStarCenter avatarImageUrl={cosmosState.avatarImageUrl} />

          {/* Orbit paths */}
          <CosmosOrbitRig domains={sceneDomains} />

          {/* Domain planets */}
          {sceneDomains.map((domain) => (
            <CosmosPlanetDomain
              key={domain.id}
              domain={domain}
              progress={getProgress(domain.id)}
              isFocused={focusedDomainId === domain.id}
              onSelect={handleSelectPlanet}
            />
          ))}

          {/* Camera */}
          {!compact && (
            <CosmosCameraController
              mode={cameraMode}
              focusedDomain={focusedDomain}
              focusedPosition={focusedPosition}
            />
          )}

          {!compact && effectsEnabled && (
            <EffectComposer multisampling={0}>
              <Bloom
                luminanceThreshold={0.35}
                luminanceSmoothing={0.55}
                intensity={0.45}
                mipmapBlur
              />
            </EffectComposer>
          )}
        </Suspense>
      </Canvas>

      {/* HUD Overlay (only in full mode) */}
      {!compact && (
        <CosmosHudOverlay
          domain={focusedDomain}
          progress={focusedProgress}
          isVisible={cameraMode === 'focused'}
          onClose={handleResetFocus}
          onStartLearning={handleStartLearning}
        />
      )}

      {/* Compact mode title overlay */}
      {compact && (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-end p-4">
          <div className="text-center">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-300/80"
              style={{ fontFamily: '"Nunito", sans-serif' }}
            >
              Dein Universum
            </p>
            <h2
              className="text-lg font-extrabold text-white mt-0.5"
              style={{
                fontFamily: '"Nunito", sans-serif',
                textShadow: '0 2px 8px rgba(0,0,0,0.6)',
              }}
            >
              Lernkosmos
            </h2>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 2D Fallback for non-WebGL devices ────────────────────────────
const CosmosFallbackList: React.FC<{ cosmosState: CosmosState }> = ({
  cosmosState,
}) => {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {resolveCosmosDomains(cosmosState.domains.map((entry) => entry.domainId)).map((domain) => {
        const progress = cosmosState.domains.find(
          (d) => d.domainId === domain.id
        );
        const mastery = progress?.mastery ?? 0;

        return (
          <button
            key={domain.id}
            onClick={() => navigate(`/doku/create?domain=${domain.id}`)}
            className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-all hover:bg-white/10 hover:scale-[1.02]"
          >
            <span className="text-3xl">{domain.icon}</span>
            <span className="text-sm font-bold text-white">{domain.label}</span>
            <div className="h-1.5 w-full rounded-full bg-white/10">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${mastery}%`,
                  background: domain.color,
                }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
};
