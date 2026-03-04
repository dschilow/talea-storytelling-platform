/**
 * CosmosSceneRoot.tsx - Main R3F scene for the "Mein Lernkosmos"
 *
 * Assembles: starfield + star + orbits + planets + camera + HUD.
 * Includes quality tiers for mobile-safe rendering and AAA mode.
 */

import React, { useState, useCallback, useMemo, Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { CosmosStarCenter } from './CosmosStarCenter';
import { CosmosPlanetDomain } from './CosmosPlanetDomain';
import { CosmosOrbitRig } from './CosmosOrbitRig';
import { CosmosCameraController } from './CosmosCameraController';
import { CosmosStarfield } from './CosmosStarfield';
import { CosmosDeepSpaceBackdrop } from './CosmosDeepSpaceBackdrop';
import { CosmosHudOverlay } from './CosmosHudOverlay';
import {
  fetchDomainTopics,
  fetchTopicTimeline,
  type TopicTimelineDTO,
  type TopicSuggestionItemDTO,
} from './apiCosmosClient';
import { SuggestionDrawer } from './SuggestionDrawer';
import {
  getDomainById,
  getDomainLearningPreset,
  resolveCosmosDomains,
} from './CosmosAssetsRegistry';
import type { CameraMode, CosmosState, DomainProgress, TopicIsland } from './CosmosTypes';
import type { CosmosQualityPreference } from './CosmosQuality';
import {
  getQualityConfig,
} from './CosmosQuality';
import { useTopicSuggestions } from './useTopicSuggestions';

interface Props {
  cosmosState: CosmosState;
  activeAvatarId?: string;
  activeChildId?: string;
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
  activeAvatarId,
  activeChildId,
  height = '100%',
  compact = false,
  qualityPreference = 'auto',
}) => {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [cameraMode, setCameraMode] = useState<CameraMode>('system');
  const [focusedDomainId, setFocusedDomainId] = useState<string | null>(null);
  const [focusedPosition, setFocusedPosition] = useState<[number, number, number] | null>(null);
  const [activeIslands, setActiveIslands] = useState<TopicIsland[]>([]);
  const [otherTopics, setOtherTopics] = useState<TopicIsland[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<TopicIsland | null>(null);
  const [selectedTopicTimeline, setSelectedTopicTimeline] = useState<TopicTimelineDTO | null>(null);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [isLoadingTopicTimeline, setIsLoadingTopicTimeline] = useState(false);
  const [pulseDomainId, setPulseDomainId] = useState<string | null>(null);
  const [pulseNonce, setPulseNonce] = useState(0);
  const [forceLowQuality, setForceLowQuality] = useState(false);
  const [isChildInfoVisible, setIsChildInfoVisible] = useState(false);
  const [isSuggestionDrawerOpen, setIsSuggestionDrawerOpen] = useState(false);
  const domainPositionMapRef = useRef<Map<string, [number, number, number]>>(new Map());
  const [effectsEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const quality = useMemo(
    () => getQualityConfig(forceLowQuality || compact ? 'low' : qualityPreference),
    [compact, forceLowQuality, qualityPreference]
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
  const visibleDomains = useMemo(() => {
    if (cameraMode === 'detail' && focusedDomainId) {
      return sceneDomains.filter((domain) => domain.id === focusedDomainId);
    }
    return sceneDomains;
  }, [cameraMode, focusedDomainId, sceneDomains]);

  const focusedDomain = focusedDomainId
    ? getDomainById(focusedDomainId, sceneDomains) ?? null
    : null;
  const focusedProgress = focusedDomainId ? getProgress(focusedDomainId) : null;
  const canCycleDomains = sceneDomains.length > 1;

  const {
    suggestions,
    isLoading: isLoadingSuggestions,
    isRefreshing: isRefreshingSuggestions,
    error: suggestionsError,
    lastInsertedSuggestionId,
    prefetch: prefetchSuggestions,
    refreshOne: refreshOneSuggestion,
    selectSuggestion: selectSuggestionAndLog,
  } = useTopicSuggestions({
    domainId: focusedDomainId,
    childId: activeChildId || undefined,
    profileId: activeChildId || undefined,
    avatarId: activeAvatarId || undefined,
    enabled: !compact && Boolean(focusedDomainId) && cameraMode !== 'system',
  });

  const handleSelectPlanet = useCallback(
    (domainId: string, position: [number, number, number]) => {
      if (compact) {
        navigate('/cosmos');
        return;
      }
      playFocusSound();
      setIsChildInfoVisible(false);
      setIsSuggestionDrawerOpen(false);
      setFocusedDomainId(domainId);
      setFocusedPosition(position);
      setCameraMode('focus');
    },
    [compact, navigate]
  );

  const handleResetFocus = useCallback(() => {
    setFocusedDomainId(null);
    setFocusedPosition(null);
    setActiveIslands([]);
    setOtherTopics([]);
    setSelectedTopic(null);
    setSelectedTopicTimeline(null);
    setIsSuggestionDrawerOpen(false);
    setCameraMode('system');
  }, []);

  const handleSelectStar = useCallback(() => {
    if (compact) {
      navigate('/cosmos');
      return;
    }
    setIsSuggestionDrawerOpen(false);
    setIsChildInfoVisible(true);
  }, [compact, navigate]);

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

  const handleCycleDomain = useCallback(
    (direction: 1 | -1) => {
      if (sceneDomains.length < 2) return;

      const currentIndex = Math.max(
        0,
        sceneDomains.findIndex((domain) => domain.id === focusedDomainId)
      );
      const nextIndex =
        (currentIndex + direction + sceneDomains.length) % sceneDomains.length;
      const nextDomain = sceneDomains[nextIndex];
      if (!nextDomain) return;

      playFocusSound();
      setIsChildInfoVisible(false);
      setIsSuggestionDrawerOpen(false);
      setFocusedDomainId(nextDomain.id);
      const livePosition = domainPositionMapRef.current.get(nextDomain.id);
      if (livePosition) {
        setFocusedPosition(livePosition);
      } else {
        setFocusedPosition([
          Math.cos(nextDomain.startAngle) * nextDomain.orbitRadius,
          0,
          Math.sin(nextDomain.startAngle) * nextDomain.orbitRadius,
        ]);
      }
      setActiveIslands([]);
      setOtherTopics([]);
      setSelectedTopic(null);
      setSelectedTopicTimeline(null);
      setCameraMode((current) => (current === 'system' ? 'focus' : current));
    },
    [focusedDomainId, sceneDomains]
  );

  const handleDomainPositionUpdate = useCallback(
    (domainId: string, position: [number, number, number]) => {
      domainPositionMapRef.current.set(domainId, position);
    },
    []
  );

  const handleFocusPrev = useCallback(() => {
    handleCycleDomain(-1);
  }, [handleCycleDomain]);

  const handleFocusNext = useCallback(() => {
    handleCycleDomain(1);
  }, [handleCycleDomain]);

  const handleOpenSuggestions = useCallback(
    (domainId: string) => {
      if (focusedDomainId !== domainId) {
        setFocusedDomainId(domainId);
      }
      setIsChildInfoVisible(false);
      setIsSuggestionDrawerOpen(true);
      void prefetchSuggestions(false);
    },
    [focusedDomainId, prefetchSuggestions]
  );

  const handleSelectSuggestionItem = useCallback(
    (item: TopicSuggestionItemDTO) => {
      if (!focusedDomainId) return;
      void selectSuggestionAndLog(item);
      const preset = getDomainLearningPreset(focusedDomainId);
      const params = new URLSearchParams({
        domain: focusedDomainId,
        topic: item.topicTitle,
        topicSlug: item.topicSlug,
        perspective: preset.perspective,
      });
      setIsSuggestionDrawerOpen(false);
      navigate(`/doku/create?${params.toString()}`);
    },
    [focusedDomainId, navigate, selectSuggestionAndLog]
  );

  const handleStartTopicDoku = useCallback(
    (topic: TopicIsland) => {
      const domainId = focusedDomainId ?? '';
      const preset = getDomainLearningPreset(domainId);
      const params = new URLSearchParams({
        topic: topic.topicTitle,
        perspective: preset.perspective,
      });
      if (domainId) {
        params.set('domain', domainId);
      }
      navigate(`/doku/create?${params.toString()}`);
    },
    [focusedDomainId, navigate]
  );

  const handleStartTopicQuiz = useCallback(
    (topic: TopicIsland) => {
      const params = new URLSearchParams({
        tags: topic.topicTitle,
      });
      navigate(`/quiz?${params.toString()}`);
    },
    [navigate]
  );

  const handleSelectIsland = useCallback((topic: TopicIsland) => {
    setSelectedTopic(topic);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDomainTopics() {
      if (!focusedDomainId || cameraMode === 'system' || compact) return;
      setIsLoadingTopics(true);
      try {
        const token = await getToken();
        const domainTopics = await fetchDomainTopics(
          {
            domainId: focusedDomainId,
            childId: activeChildId || undefined,
            avatarId: activeAvatarId || undefined,
          },
          { token }
        );
        if (!active) return;
        setActiveIslands(domainTopics.activeIslands || []);
        setOtherTopics(domainTopics.otherTopics || []);
        setSelectedTopic((current) => {
          if (current && domainTopics.activeIslands.some((island) => island.topicId === current.topicId)) {
            return current;
          }
          return domainTopics.activeIslands[0] || null;
        });
      } catch (error) {
        if (!active) return;
        console.warn('[CosmosSceneRoot] failed to load domain topics', error);
        setActiveIslands([]);
        setOtherTopics([]);
      } finally {
        if (active) setIsLoadingTopics(false);
      }
    }

    void loadDomainTopics();
    return () => {
      active = false;
    };
  }, [activeAvatarId, activeChildId, cameraMode, compact, focusedDomainId, getToken]);

  useEffect(() => {
    let active = true;

    async function loadTopicTimeline() {
      if (!selectedTopic || cameraMode === 'system' || compact) {
        if (active) setSelectedTopicTimeline(null);
        return;
      }
      setIsLoadingTopicTimeline(true);
      try {
        const token = await getToken();
        const timeline = await fetchTopicTimeline(
          {
            topicId: selectedTopic.topicId,
            childId: activeChildId || undefined,
            avatarId: activeAvatarId || undefined,
          },
          { token }
        );
        if (!active) return;
        setSelectedTopicTimeline(timeline);
      } catch (error) {
        if (!active) return;
        console.warn('[CosmosSceneRoot] failed to load topic timeline', error);
        setSelectedTopicTimeline(null);
      } finally {
        if (active) setIsLoadingTopicTimeline(false);
      }
    }

    void loadTopicTimeline();
    return () => {
      active = false;
    };
  }, [activeAvatarId, activeChildId, cameraMode, compact, getToken, selectedTopic]);

  const [webglSupported] = useState(() => {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onMapProgress = (event: Event) => {
      const detail = (event as CustomEvent<{ avatarId?: string | null; domainId?: string }>).detail;
      if (!detail) return;

      if (activeAvatarId && detail.avatarId && detail.avatarId !== activeAvatarId) {
        return;
      }

      const candidateDomainId = detail.domainId || focusedDomainId || selectedTopic?.topicId?.split('_')[0];
      if (!candidateDomainId) return;

      setPulseDomainId(candidateDomainId);
      setPulseNonce((value) => value + 1);
    };

    window.addEventListener('talea:mapProgress', onMapProgress as EventListener);
    return () => {
      window.removeEventListener('talea:mapProgress', onMapProgress as EventListener);
    };
  }, [activeAvatarId, focusedDomainId, selectedTopic?.topicId]);

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
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = quality.toneMappingExposure;

          const canvas = gl.domElement;
          canvas.addEventListener(
            'webglcontextlost',
            (event) => {
              event.preventDefault();
              console.warn('[CosmosSceneRoot] WebGL context lost, switching to low quality');
              setForceLowQuality(true);
            },
            { once: true }
          );
        }}
        style={{ background: 'transparent' }}
        onPointerMissed={() => {
          if (cameraMode !== 'system') {
            handleResetFocus();
            return;
          }
          if (isChildInfoVisible) setIsChildInfoVisible(false);
        }}
        onDoubleClick={() => {
          if (cameraMode !== 'system') {
            handleResetFocus();
            return;
          }
          if (isChildInfoVisible) setIsChildInfoVisible(false);
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
            onSelect={handleSelectStar}
          />

          <CosmosOrbitRig
            domains={sceneDomains}
            cameraMode={cameraMode}
            focusedDomainId={focusedDomainId}
          />

          {visibleDomains.map((domain) => (
            <CosmosPlanetDomain
              key={domain.id}
              domain={domain}
              progress={getProgress(domain.id)}
              isFocused={focusedDomainId === domain.id}
              cameraMode={cameraMode}
              isDetailMode={cameraMode === 'detail' && focusedDomainId === domain.id}
              islands={cameraMode !== 'system' && focusedDomainId === domain.id ? activeIslands : []}
              selectedTopicId={selectedTopic?.topicId}
              textureSize={quality.planetTextureBaseSize}
              ringTextureSize={quality.ringTextureSize}
              feedbackPulseNonce={pulseDomainId === domain.id ? pulseNonce : 0}
              onSelect={handleSelectPlanet}
              onPositionUpdate={handleDomainPositionUpdate}
              onSelectIsland={handleSelectIsland}
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
          activeIslands={activeIslands}
          otherTopics={otherTopics}
          selectedTopic={selectedTopic}
          selectedTopicTimeline={selectedTopicTimeline}
          isLoadingTopics={isLoadingTopics}
          isLoadingTopicTimeline={isLoadingTopicTimeline}
          isVisible={cameraMode === 'focus' || cameraMode === 'detail'}
          isDetailMode={cameraMode === 'detail'}
          onClose={handleResetFocus}
          onOpenDetail={handleOpenDetail}
          onBackFromDetail={handleBackFromDetail}
          canFocusCycle={canCycleDomains}
          onFocusPrev={handleFocusPrev}
          onFocusNext={handleFocusNext}
          onOpenSuggestions={handleOpenSuggestions}
          onStartTopicDoku={handleStartTopicDoku}
          onStartTopicQuiz={handleStartTopicQuiz}
          onSelectTopic={handleSelectIsland}
        />
      )}

      {!compact && focusedDomain && (
        <SuggestionDrawer
          open={isSuggestionDrawerOpen}
          title={`Weiterlernen in ${focusedDomain.label}`}
          subtitle="Waehle ein Thema oder lass die KI ein neues finden."
          items={suggestions?.items || []}
          isLoading={isLoadingSuggestions}
          isRefreshing={isRefreshingSuggestions}
          error={suggestionsError}
          lastInsertedSuggestionId={lastInsertedSuggestionId}
          onClose={() => setIsSuggestionDrawerOpen(false)}
          onRefreshOne={() => {
            void refreshOneSuggestion();
          }}
          onSelect={handleSelectSuggestionItem}
        />
      )}

      {!compact && isChildInfoVisible && (
        <div
          className="absolute left-3 right-3 top-20 z-40 md:left-6 md:right-auto md:top-20 md:w-[24rem]"
          style={{
            top: 'max(6.25rem, calc(env(safe-area-inset-top, 0px) + 5.4rem))',
          }}
        >
          <div
            className="rounded-3xl border border-white/15 p-4 md:p-5 backdrop-blur-xl"
            style={{
              background: 'linear-gradient(145deg, rgba(11,16,36,0.92) 0%, rgba(18,24,52,0.95) 100%)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
                  Zentralstern
                </p>
                <h3 className="mt-0.5 text-lg font-extrabold text-white">
                  {cosmosState.childName || 'Dein Kind'}
                </h3>
                <p className="mt-1 text-xs text-white/65">
                  Dieser Stern repraesentiert den aktuellen Lernfortschritt des Kindes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsChildInfoVisible(false)}
                className="rounded-lg border border-white/20 px-2.5 py-1 text-[11px] font-bold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                Schliessen
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <InfoPill label="Stories" value={cosmosState.totalStoriesRead} />
              <InfoPill label="Dokus" value={cosmosState.totalDokusRead} />
              <InfoPill
                label="Aktive Welten"
                value={cosmosState.domains.filter((entry) => entry.mastery > 0).length}
              />
            </div>
          </div>
        </div>
      )}

      {!compact && (
        <div
          className="absolute left-1/2 z-20 -translate-x-1/2 flex items-center gap-1 rounded-xl border border-white/15 bg-black/35 px-2 py-1 backdrop-blur max-w-[94vw]"
          style={{ top: 'max(5.1rem, calc(env(safe-area-inset-top, 0px) + 4.3rem))' }}
        >
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

const InfoPill: React.FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
    <div className="text-[10px] font-semibold uppercase tracking-wide text-white/50">
      {label}
    </div>
    <div className="mt-0.5 text-sm font-extrabold text-white">{value}</div>
  </div>
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
