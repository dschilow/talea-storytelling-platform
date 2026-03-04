/**
 * CosmosSceneRoot.tsx - Main R3F scene for the "Mein Lernkosmos"
 *
 * Assembles: starfield + star + orbits + planets + camera + HUD.
 * Includes quality tiers for mobile-safe rendering and AAA mode.
 */

import React, { useState, useCallback, useMemo, Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import { CosmosStarCenter } from './CosmosStarCenter';
import { CosmosPlanetDomain } from './CosmosPlanetDomain';
import { CosmosOrbitRig } from './CosmosOrbitRig';
import { CosmosCameraController } from './CosmosCameraController';
import { CosmosStarfield } from './CosmosStarfield';
import { CosmosDeepSpaceBackdrop } from './CosmosDeepSpaceBackdrop';
import { CosmosHudOverlay } from './CosmosHudOverlay';
import {
  getDomainById,
  getDomainLearningPreset,
  resolveCosmosDomains,
} from './CosmosAssetsRegistry';
import type { CameraMode, CosmosState, DomainProgress } from './CosmosTypes';
import type { CosmosQualityPreference } from './CosmosQuality';
import {
  getQualityConfig,
} from './CosmosQuality';

interface Props {
  cosmosState: CosmosState;
  height?: string;
  compact?: boolean;
  qualityPreference?: CosmosQualityPreference;
}

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
  qualityPreference = 'auto',
}) => {
  const navigate = useNavigate();
  const [cameraMode, setCameraMode] = useState<CameraMode>('system');
  const [focusedDomainId, setFocusedDomainId] = useState<string | null>(null);
  const [focusedPosition, setFocusedPosition] = useState<[number, number, number] | null>(null);
  const [effectsEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const quality = useMemo(
    () => getQualityConfig(compact ? 'low' : qualityPreference),
    [compact, qualityPreference]
  );

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
      playFocusSound();
      setFocusedDomainId(domainId);
      setFocusedPosition(position);
      setCameraMode('focus');
    },
    [compact, navigate]
  );

  const handleResetFocus = useCallback(() => {
    setFocusedDomainId(null);
    setFocusedPosition(null);
    setCameraMode('system');
  }, []);

  const handleOpenDetail = useCallback(() => {
    if (focusedDomainId) setCameraMode('detail');
  }, [focusedDomainId]);

  const handleBackFromDetail = useCallback(() => {
    if (focusedDomainId) {
      setCameraMode('focus');
      return;
    }
    handleResetFocus();
  }, [focusedDomainId, handleResetFocus]);

  const handleStartLearning = useCallback(
    (domainId: string) => {
      const preset = getDomainLearningPreset(domainId);
      const params = new URLSearchParams({
        domain: domainId,
        topic: preset.topic,
        perspective: preset.perspective,
      });
      navigate(`/doku/create?${params.toString()}`);
    },
    [navigate]
  );

  const [webglSupported] = useState(() => {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (cameraMode === 'detail') {
        handleBackFromDetail();
        return;
      }
      if (cameraMode === 'focus') {
        handleResetFocus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cameraMode, handleBackFromDetail, handleResetFocus]);

  if (!webglSupported) {
    return <CosmosFallbackList cosmosState={cosmosState} />;
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <Canvas
        camera={{
          position: compact ? [8, 8, 17] : [16, 9, 30],
          fov: 46,
          near: 0.1,
          far: 260,
        }}
        dpr={quality.dprRange}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl }) => {
          (gl as any).useLegacyLights = false;
          gl.physicallyCorrectLights = true;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = quality.toneMappingExposure;
        }}
        style={{ background: 'transparent' }}
        onPointerMissed={() => {
          if (cameraMode !== 'system') handleResetFocus();
        }}
        onDoubleClick={() => {
          if (cameraMode !== 'system') handleResetFocus();
        }}
      >
        <Suspense fallback={null}>
          <fog attach="fog" args={['#060715', 44, 130]} />

          {quality.useHdri && (
            quality.hdriFile ? (
              <Environment files={quality.hdriFile} background={false} />
            ) : (
              <Environment preset={quality.hdriPreset ?? 'night'} background={false} />
            )
          )}

          <CosmosDeepSpaceBackdrop
            enabledNebulaBillboards={quality.enableNebulaBillboards}
            nebulaTextureSize={quality.nebulaTextureSize}
          />

          <CosmosStarfield
            count={compact ? Math.round(quality.baseStarCount * 0.55) : quality.baseStarCount}
            radius={70}
            driftSpeed={0.00045}
            sizeRange={[0.7, 2.1]}
            twinkleStrength={1}
          />
          <CosmosStarfield
            count={compact ? Math.round(quality.midStarCount * 0.5) : quality.midStarCount}
            radius={94}
            driftSpeed={0.00022}
            sizeRange={[0.45, 1.3]}
            twinkleStrength={0.72}
            opacity={0.65}
          />
          <CosmosStarfield
            count={compact ? Math.round(quality.farStarCount * 0.45) : quality.farStarCount}
            radius={128}
            driftSpeed={0.0001}
            sizeRange={[0.35, 0.95]}
            twinkleStrength={0.4}
            opacity={0.45}
          />

          <CosmosStarCenter
            avatarImageUrl={cosmosState.avatarImageUrl}
            cameraMode={cameraMode}
            godRaysDuration={quality.godRaysIntroDuration}
          />

          <CosmosOrbitRig
            domains={sceneDomains}
            cameraMode={cameraMode}
            focusedDomainId={focusedDomainId}
          />

          {sceneDomains.map((domain) => (
            <CosmosPlanetDomain
              key={domain.id}
              domain={domain}
              progress={getProgress(domain.id)}
              isFocused={focusedDomainId === domain.id}
              isDetailMode={cameraMode === 'detail' && focusedDomainId === domain.id}
              textureSize={quality.planetTextureBaseSize}
              ringTextureSize={quality.ringTextureSize}
              onSelect={handleSelectPlanet}
            />
          ))}

          {!compact && (
            <CosmosCameraController
              mode={cameraMode}
              focusedDomain={focusedDomain}
              focusedPosition={focusedPosition}
            />
          )}

          {!compact && effectsEnabled && quality.enableBloom && (
            <EffectComposer multisampling={0}>
              <Bloom
                luminanceThreshold={quality.bloomThreshold}
                luminanceSmoothing={quality.bloomSmoothing}
                intensity={quality.bloomIntensity}
                mipmapBlur
              />
            </EffectComposer>
          )}
        </Suspense>
      </Canvas>

      {!compact && (
        <CosmosHudOverlay
          domain={focusedDomain}
          progress={focusedProgress}
          isVisible={cameraMode === 'focus' || cameraMode === 'detail'}
          isDetailMode={cameraMode === 'detail'}
          onClose={handleResetFocus}
          onOpenDetail={handleOpenDetail}
          onBackFromDetail={handleBackFromDetail}
          onStartLearning={handleStartLearning}
        />
      )}

      {!compact && (
        <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2 flex items-center gap-1 rounded-xl border border-white/15 bg-black/35 px-2 py-1 backdrop-blur">
          <ZoomButton
            active={cameraMode === 'system'}
            label="System"
            onClick={handleResetFocus}
          />
          <ZoomButton
            active={cameraMode === 'focus'}
            label="Fokus"
            disabled={!focusedDomainId}
            onClick={() => focusedDomainId && setCameraMode('focus')}
          />
          <ZoomButton
            active={cameraMode === 'detail'}
            label="Detail"
            disabled={!focusedDomainId}
            onClick={() => focusedDomainId && setCameraMode('detail')}
          />
        </div>
      )}

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

const ZoomButton: React.FC<{
  active: boolean;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}> = ({ active, label, disabled = false, onClick }) => (
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

function playFocusSound() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;
    const globalWindow = window as typeof window & { __taleaFocusAudioCtx?: AudioContext };
    const audioContext =
      globalWindow.__taleaFocusAudioCtx ?? (globalWindow.__taleaFocusAudioCtx = new AudioContextCtor());
    if (audioContext.state === 'suspended') {
      void audioContext.resume().catch(() => {});
    }
    const now = audioContext.currentTime;

    const oscillatorA = audioContext.createOscillator();
    const oscillatorB = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillatorA.type = 'sine';
    oscillatorB.type = 'triangle';

    oscillatorA.frequency.setValueAtTime(280, now);
    oscillatorA.frequency.exponentialRampToValueAtTime(520, now + 0.16);
    oscillatorB.frequency.setValueAtTime(140, now);
    oscillatorB.frequency.exponentialRampToValueAtTime(260, now + 0.16);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.03, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);

    oscillatorA.connect(gain);
    oscillatorB.connect(gain);
    gain.connect(audioContext.destination);

    oscillatorA.start(now);
    oscillatorB.start(now);
    oscillatorA.stop(now + 0.2);
    oscillatorB.stop(now + 0.2);
  } catch {
    // Audio cue is optional.
  }
}

const CosmosFallbackList: React.FC<{ cosmosState: CosmosState }> = ({
  cosmosState,
}) => {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {resolveCosmosDomains(cosmosState.domains.map((entry) => entry.domainId)).map((domain) => {
        const progress = cosmosState.domains.find((d) => d.domainId === domain.id);
        const mastery = progress?.mastery ?? 0;

        return (
          <button
            key={domain.id}
            onClick={() => {
              const preset = getDomainLearningPreset(domain.id);
              const params = new URLSearchParams({
                domain: domain.id,
                topic: preset.topic,
                perspective: preset.perspective,
              });
              navigate(`/doku/create?${params.toString()}`);
            }}
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
