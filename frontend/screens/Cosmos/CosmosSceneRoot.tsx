/**
 * CosmosSceneRoot.tsx - Main R3F scene for the "Mein Lernkosmos"
 *
 * Assembles: starfield + star + orbits + planets + camera + HUD.
 * When planets grew since the last visit, the camera flies to each of them and
 * plays the growth live (see CosmosSeenState / CosmosCelebration).
 */

import React, { useState, useCallback, useMemo, Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { AnimatePresence, motion } from 'framer-motion';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { CosmosStarCenter } from './CosmosStarCenter';
import { CosmosPlanetDomain, PLANET_GROWTH_DURATION, type PlanetGrowthOverride } from './CosmosPlanetDomain';
import { CosmosOrbitRig } from './CosmosOrbitRig';
import { CosmosCameraController } from './CosmosCameraController';
import { CosmosStarfield } from './CosmosStarfield';
import { CosmosShootingStars } from './CosmosShootingStars';
import { CosmosDeepSpaceBackdrop } from './CosmosDeepSpaceBackdrop';
import { CosmosHudOverlay } from './CosmosHudOverlay';
import { CelebrationBurst, CelebrationCard, fireStarConfetti, playGrowthChime } from './CosmosCelebration';
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
import { getQualityConfig } from './CosmosQuality';
import { computePlanetEvolution, featuresFromEvo } from './CosmosEvolution';
import { getOrbitLayoutScale } from './CosmosOrbit';
import {
  buildSeenKey,
  diffGrowth,
  loadSeenSnapshot,
  saveSeenSnapshot,
  type GrowthEvent,
} from './CosmosSeenState';
import { useTopicSuggestions } from './useTopicSuggestions';
import { triggerHaptic } from '../../utils/haptics';

interface Props {
  cosmosState: CosmosState;
  activeAvatarId?: string;
  activeChildId?: string;
  height?: string;
  compact?: boolean;
  qualityPreference?: CosmosQualityPreference;
  cameraModeOverride?: CameraMode;
  onCameraModeChange?: (mode: CameraMode) => void;
  onFocusAvailabilityChange?: (hasFocusedDomain: boolean) => void;
  showInternalModeTabs?: boolean;
  onSceneReady?: () => void;
  /** Planet to fly to once the scene is ready (e.g. /cosmos?planet=nature). */
  initialFocusDomainId?: string | null;
}

type GrowthPhase = 'idle' | 'flying' | 'growing' | 'card';

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
  cameraModeOverride,
  onCameraModeChange,
  onFocusAvailabilityChange,
  showInternalModeTabs = true,
  onSceneReady,
  initialFocusDomainId = null,
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
  const [transitionFadeKey, setTransitionFadeKey] = useState(0);
  const [isCameraTransitioning, setIsCameraTransitioning] = useState(false);
  const [forceStandardQuality, setForceStandardQuality] = useState(false);
  const [isChildInfoVisible, setIsChildInfoVisible] = useState(false);
  const [isSuggestionDrawerOpen, setIsSuggestionDrawerOpen] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [growthQueue, setGrowthQueue] = useState<GrowthEvent[]>([]);
  const [growthIndex, setGrowthIndex] = useState(0);
  const [growthPhase, setGrowthPhase] = useState<GrowthPhase>('idle');
  const [growthToken, setGrowthToken] = useState(0);
  const [burst, setBurst] = useState<{ nonce: number; position: [number, number, number]; color: string; radius: number }>({
    nonce: 0,
    position: [0, 0, 0],
    color: '#ffffff',
    radius: 1,
  });
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 1280 : window.innerWidth,
    height: typeof window === 'undefined' ? 800 : window.innerHeight,
  }));
  const domainPositionMapRef = useRef<Map<string, [number, number, number]>>(new Map());
  const orbitAnglesRef = useRef<Map<string, number>>(new Map());
  const topicTimelineCacheRef = useRef<Map<string, TopicTimelineDTO>>(new Map());
  const lastAppliedModeOverrideRef = useRef<CameraMode | null>(null);
  const growthCheckedKeyRef = useRef<string | null>(null);
  const initialFocusDoneRef = useRef(false);
  const flightRef = useRef<{ sawTransition: boolean; startedAt: number }>({ sawTransition: false, startedAt: 0 });
  const [effectsEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const quality = useMemo(
    () => getQualityConfig(forceStandardQuality || compact ? 'standard' : qualityPreference),
    [compact, forceStandardQuality, qualityPreference]
  );
  const planetDetail = quality.tier === 'aaa' ? 1 : 0;
  const seenKey = buildSeenKey(activeChildId, activeAvatarId);
  const isCelebrating = growthPhase !== 'idle';

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const triggerSceneFade = useCallback(() => {
    setTransitionFadeKey((value) => value + 1);
  }, []);

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
  const orbitScale = getOrbitLayoutScale(viewport.width, viewport.height);
  const systemRadius = useMemo(
    () => Math.max(...sceneDomains.map((domain) => domain.orbitRadius)) * orbitScale,
    [orbitScale, sceneDomains]
  );

  const focusedDomain = focusedDomainId
    ? getDomainById(focusedDomainId, sceneDomains) ?? null
    : null;
  const focusedProgress = focusedDomainId ? getProgress(focusedDomainId) : null;
  const focusedEvolution = useMemo(
    () => (focusedDomain && focusedProgress ? computePlanetEvolution(focusedProgress, focusedDomain.planetType) : null),
    [focusedDomain, focusedProgress]
  );
  const canCycleDomains = sceneDomains.length > 1;
  const currentGrowth = isCelebrating ? growthQueue[growthIndex] ?? null : null;

  const growthOverrides = useMemo(() => {
    const overrides = new Map<string, PlanetGrowthOverride>();
    if (!isCelebrating) return overrides;
    growthQueue.forEach((event, index) => {
      if (index < growthIndex) return;
      overrides.set(event.domainId, {
        fromEvo: event.fromEvo,
        toEvo: event.toEvo,
        fromTopics: event.fromTopics,
        startToken: index === growthIndex && growthPhase !== 'flying' ? growthToken : 0,
      });
    });
    return overrides;
  }, [growthIndex, growthPhase, growthQueue, growthToken, isCelebrating]);

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
    enabled: !compact && !isCelebrating && Boolean(focusedDomainId) && cameraMode !== 'system',
  });

  const focusDomain = useCallback(
    (domainId: string, position?: [number, number, number]) => {
      const domain = getDomainById(domainId, sceneDomains);
      if (!domain) return;
      const livePosition = position ?? domainPositionMapRef.current.get(domainId);
      setIsChildInfoVisible(false);
      setIsSuggestionDrawerOpen(false);
      setFocusedDomainId(domainId);
      setFocusedPosition(
        livePosition ?? [
          Math.cos(domain.startAngle) * domain.orbitRadius * orbitScale,
          0,
          Math.sin(domain.startAngle) * domain.orbitRadius * orbitScale,
        ]
      );
      setCameraMode((current) => (current === 'detail' ? 'detail' : 'focus'));
    },
    [orbitScale, sceneDomains]
  );

  const handleSelectPlanet = useCallback(
    (domainId: string, position: [number, number, number]) => {
      if (compact) {
        navigate('/cosmos');
        return;
      }
      if (isCelebrating) return;
      if (domainId !== focusedDomainId) {
        setActiveIslands([]);
        setOtherTopics([]);
        setSelectedTopic(null);
        setSelectedTopicTimeline(null);
      }
      triggerSceneFade();
      triggerHaptic('selection');
      playFocusSound();
      focusDomain(domainId, position);
      setCameraMode('focus');
    },
    [compact, focusDomain, focusedDomainId, isCelebrating, navigate, triggerSceneFade]
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
    triggerSceneFade();
  }, [triggerSceneFade]);

  useEffect(() => {
    onFocusAvailabilityChange?.(Boolean(focusedDomainId));
  }, [focusedDomainId, onFocusAvailabilityChange]);

  useEffect(() => {
    onCameraModeChange?.(cameraMode);
  }, [cameraMode, onCameraModeChange]);

  // Apply external mode overrides only when the override value changes.
  // This prevents accidental focus reset after internal planet click transitions.
  useEffect(() => {
    if (!cameraModeOverride) return;
    if (lastAppliedModeOverrideRef.current === cameraModeOverride) return;
    lastAppliedModeOverrideRef.current = cameraModeOverride;
    if (isCelebrating) return;

    if (cameraModeOverride === 'system') {
      handleResetFocus();
      return;
    }

    if (!focusedDomainId) return;
    setCameraMode(cameraModeOverride);
  }, [cameraModeOverride, focusedDomainId, handleResetFocus, isCelebrating]);

  const handleSelectStar = useCallback(() => {
    if (compact) {
      navigate('/cosmos');
      return;
    }
    if (isCelebrating) return;
    triggerHaptic('selection');
    setIsSuggestionDrawerOpen(false);
    setIsChildInfoVisible(true);
  }, [compact, isCelebrating, navigate]);

  const handleOpenDetail = useCallback(() => {
    if (!focusedDomainId) return;
    triggerSceneFade();
    setCameraMode('detail');
  }, [focusedDomainId, triggerSceneFade]);

  const handleBackFromDetail = useCallback(() => {
    if (focusedDomainId) {
      triggerSceneFade();
      setCameraMode('focus');
      return;
    }
    handleResetFocus();
  }, [focusedDomainId, handleResetFocus, triggerSceneFade]);

  const handleCycleDomain = useCallback(
    (direction: 1 | -1) => {
      if (sceneDomains.length < 2 || isCelebrating) return;

      const currentIndex = Math.max(
        0,
        sceneDomains.findIndex((domain) => domain.id === focusedDomainId)
      );
      const nextIndex =
        (currentIndex + direction + sceneDomains.length) % sceneDomains.length;
      const nextDomain = sceneDomains[nextIndex];
      if (!nextDomain) return;

      triggerSceneFade();
      triggerHaptic('selection');
      playFocusSound();
      setActiveIslands([]);
      setOtherTopics([]);
      setSelectedTopic(null);
      setSelectedTopicTimeline(null);
      focusDomain(nextDomain.id);
    },
    [focusDomain, focusedDomainId, isCelebrating, sceneDomains, triggerSceneFade]
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
    (
      topic: TopicIsland,
      entry?: TopicTimelineDTO["docs"][number] | null
    ) => {
      const domainId = focusedDomainId || topic.topicId.split("_")[0] || "";
      if (entry?.contentId) {
        if (entry.type === "story") {
          navigate(`/story-reader/${encodeURIComponent(entry.contentId)}`);
          return;
        }
        const query = new URLSearchParams();
        if (domainId) query.set("domain", domainId);
        navigate(`/doku-reader/${encodeURIComponent(entry.contentId)}${query.toString() ? `?${query.toString()}` : ""}`);
      }
    },
    [focusedDomainId, navigate]
  );

  const handleStartTopicQuiz = useCallback(
    (
      topic: TopicIsland,
      entry?: TopicTimelineDTO["docs"][number] | null
    ) => {
      const domainId = focusedDomainId || topic.topicId.split("_")[0] || "";
      if (entry?.contentId && entry.type === "doku") {
        const query = new URLSearchParams({ open: "quiz" });
        if (domainId) query.set("domain", domainId);
        navigate(`/doku-reader/${encodeURIComponent(entry.contentId)}?${query.toString()}`);
      }
    },
    [focusedDomainId, navigate]
  );

  const handleSelectIsland = useCallback((topic: TopicIsland) => {
    triggerHaptic('tap');
    setSelectedTopic(topic);
  }, []);

  // ---------------------------------------------------------------- growth
  const finishGrowth = useCallback(() => {
    saveSeenSnapshot(seenKey, cosmosState);
    setGrowthPhase('idle');
    setGrowthQueue([]);
    setGrowthIndex(0);
  }, [cosmosState, seenKey]);

  // Once per child: compare with the last visit and queue the growth moments.
  useEffect(() => {
    if (compact || !sceneReady || cosmosState.domains.length === 0) return;
    if (growthCheckedKeyRef.current === seenKey) return;
    growthCheckedKeyRef.current = seenKey;

    const snapshot = loadSeenSnapshot(seenKey);
    if (!snapshot) {
      saveSeenSnapshot(seenKey, cosmosState);
      setShowIntro(true);
      return;
    }
    const events = diffGrowth(snapshot, cosmosState);
    if (events.length === 0) {
      saveSeenSnapshot(seenKey, cosmosState);
      return;
    }
    setGrowthQueue(events);
    setGrowthIndex(0);
    setGrowthPhase('flying');
  }, [compact, cosmosState, sceneReady, seenKey]);

  // Fly to the planet of the current growth moment.
  useEffect(() => {
    if (growthPhase !== 'flying') return;
    const event = growthQueue[growthIndex];
    if (!event || !getDomainById(event.domainId, sceneDomains)) {
      finishGrowth();
      return;
    }
    flightRef.current = { sawTransition: false, startedAt: performance.now() };
    setActiveIslands([]);
    setOtherTopics([]);
    setSelectedTopic(null);
    setSelectedTopicTimeline(null);
    triggerSceneFade();
    focusDomain(event.domainId);
    setCameraMode('focus');
  }, [finishGrowth, focusDomain, growthIndex, growthPhase, growthQueue, sceneDomains, triggerSceneFade]);

  const startGrowing = useCallback(() => {
    const event = growthQueue[growthIndex];
    const domain = event ? getDomainById(event.domainId, sceneDomains) : null;
    if (!event || !domain) return;
    const position = domainPositionMapRef.current.get(domain.id) ?? [0, 0, 0];
    setGrowthToken((value) => value + 1);
    setGrowthPhase('growing');
    setBurst((current) => ({
      nonce: current.nonce + 1,
      position,
      color: domain.color,
      radius: featuresFromEvo(event.toEvo).radius,
    }));
    playGrowthChime();
    triggerHaptic('success');
    if (event.toStage > event.fromStage) fireStarConfetti(domain.color);
  }, [growthIndex, growthQueue, sceneDomains]);

  // Start growing once the camera has arrived (with a fallback if no flight happened).
  useEffect(() => {
    if (growthPhase !== 'flying') return;
    if (isCameraTransitioning) {
      flightRef.current.sawTransition = true;
      return;
    }
    const elapsed = performance.now() - flightRef.current.startedAt;
    const wait = flightRef.current.sawTransition ? Math.max(0, 700 - elapsed) : 1800;
    const timer = window.setTimeout(startGrowing, wait);
    return () => window.clearTimeout(timer);
  }, [growthPhase, isCameraTransitioning, startGrowing]);

  useEffect(() => {
    if (growthPhase !== 'growing') return;
    const timer = window.setTimeout(() => setGrowthPhase('card'), PLANET_GROWTH_DURATION * 650);
    return () => window.clearTimeout(timer);
  }, [growthPhase]);

  const handleGrowthNext = useCallback(() => {
    if (growthIndex < growthQueue.length - 1) {
      setGrowthIndex((value) => value + 1);
      setGrowthPhase('flying');
      return;
    }
    finishGrowth();
  }, [finishGrowth, growthIndex, growthQueue.length]);

  // Deep link: /cosmos?planet=<domainId> flies there once nothing else is playing.
  useEffect(() => {
    if (compact || !sceneReady || initialFocusDoneRef.current || !initialFocusDomainId) return;
    if (growthCheckedKeyRef.current !== seenKey || isCelebrating) return;
    initialFocusDoneRef.current = true;
    if (!getDomainById(initialFocusDomainId, sceneDomains)) return;
    const timer = window.setTimeout(() => focusDomain(initialFocusDomainId), 450);
    return () => window.clearTimeout(timer);
  }, [compact, focusDomain, initialFocusDomainId, isCelebrating, sceneDomains, sceneReady, seenKey]);

  useEffect(() => {
    let active = true;
    let loadTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadDomainTopics() {
      if (!focusedDomainId || compact) return;
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

    if (focusedDomainId && !compact) {
      loadTimer = setTimeout(() => {
        if (!active) return;
        void loadDomainTopics();
      }, 220);
    }

    return () => {
      active = false;
      if (loadTimer) clearTimeout(loadTimer);
    };
  }, [activeAvatarId, activeChildId, compact, focusedDomainId, getToken]);

  useEffect(() => {
    let active = true;
    let loadTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadTopicTimeline() {
      if (!selectedTopic || compact) {
        if (active) setSelectedTopicTimeline(null);
        return;
      }
      if (cameraMode !== 'detail') return;

      const cachedTimeline = topicTimelineCacheRef.current.get(selectedTopic.topicId);
      if (cachedTimeline) {
        if (active) setSelectedTopicTimeline(cachedTimeline);
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
        topicTimelineCacheRef.current.set(selectedTopic.topicId, timeline);
        setSelectedTopicTimeline(timeline);
      } catch (error) {
        if (!active) return;
        console.warn('[CosmosSceneRoot] failed to load topic timeline', error);
        setSelectedTopicTimeline(null);
      } finally {
        if (active) setIsLoadingTopicTimeline(false);
      }
    }

    loadTimer = setTimeout(() => {
      if (!active) return;
      void loadTopicTimeline();
    }, 180);

    return () => {
      active = false;
      if (loadTimer) clearTimeout(loadTimer);
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
      if (event.key !== 'Escape' || isCelebrating) return;
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
  }, [cameraMode, handleBackFromDetail, handleResetFocus, isCelebrating]);

  const handleSceneReady = useCallback(() => {
    setSceneReady(true);
    onSceneReady?.();
  }, [onSceneReady]);

  if (!webglSupported) {
    return <CosmosFallbackList cosmosState={cosmosState} />;
  }

  const currentGrowthDomain = currentGrowth ? getDomainById(currentGrowth.domainId, sceneDomains) ?? null : null;

  return (
    <div className="relative w-full" style={{ height }}>
      <Canvas
        camera={{
          position: compact ? [8, 8, 17] : [16, 9, 30],
          fov: 46,
          near: 0.1,
          far: 400,
        }}
        dpr={quality.dprRange}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = quality.toneMappingExposure;

          const canvas = gl.domElement;
          canvas.addEventListener(
            'webglcontextlost',
            (event) => {
              event.preventDefault();
              console.warn('[CosmosSceneRoot] WebGL context lost, switching to standard quality');
              setForceStandardQuality(true);
            },
            { once: true }
          );
        }}
        style={{ background: 'transparent' }}
        onPointerMissed={() => {
          if (isCelebrating) return;
          if (cameraMode !== 'system') {
            handleResetFocus();
            return;
          }
          if (isChildInfoVisible) setIsChildInfoVisible(false);
        }}
      >
        <Suspense fallback={null}>
          <fog attach="fog" args={['#060715', 80, 260]} />

          <CosmosDeepSpaceBackdrop
            enabledNebulaBillboards={quality.enableNebulaBillboards}
            nebulaTextureSize={quality.nebulaTextureSize}
          />

          <CosmosStarfield
            count={compact ? Math.round(quality.baseStarCount * 0.55) : quality.baseStarCount}
            radius={90}
            driftSpeed={0.00045}
            sizeRange={[0.7, 2.1]}
            twinkleStrength={1}
          />
          <CosmosStarfield
            count={compact ? Math.round(quality.midStarCount * 0.5) : quality.midStarCount}
            radius={120}
            driftSpeed={0.00022}
            sizeRange={[0.45, 1.3]}
            twinkleStrength={0.72}
            opacity={0.65}
          />
          <CosmosStarfield
            count={compact ? Math.round(quality.farStarCount * 0.45) : quality.farStarCount}
            radius={150}
            driftSpeed={0.0001}
            sizeRange={[0.35, 0.95]}
            twinkleStrength={0.4}
            opacity={0.45}
          />
          {!compact && effectsEnabled && <CosmosShootingStars />}

          <SceneReadyProbe onReady={handleSceneReady} />

          <CosmosStarCenter
            avatarImageUrl={cosmosState.avatarImageUrl}
            childName={cosmosState.childName}
            cameraMode={cameraMode}
            godRaysDuration={quality.godRaysIntroDuration}
            onSelect={handleSelectStar}
          />

          <CosmosOrbitRig
            domains={sceneDomains}
            cameraMode={cameraMode}
            focusedDomainId={focusedDomainId}
            orbitScale={orbitScale}
            orbitAngles={orbitAnglesRef}
          />

          {sceneDomains.map((domain) => (
            <CosmosPlanetDomain
              key={domain.id}
              domain={domain}
              progress={getProgress(domain.id)}
              isFocused={focusedDomainId === domain.id}
              isTransitioning={isCameraTransitioning}
              cameraMode={cameraMode}
              islands={cameraMode !== 'system' && focusedDomainId === domain.id ? activeIslands : []}
              selectedTopicId={selectedTopic?.topicId}
              detail={planetDetail}
              orbitScale={orbitScale}
              feedbackPulseNonce={pulseDomainId === domain.id ? pulseNonce : 0}
              growth={growthOverrides.get(domain.id) ?? null}
              orbitAngles={orbitAnglesRef}
              onSelect={handleSelectPlanet}
              onPositionUpdate={handleDomainPositionUpdate}
              onSelectIsland={handleSelectIsland}
            />
          ))}

          {!compact && (
            <CelebrationBurst
              position={burst.position}
              color={burst.color}
              radius={burst.radius}
              nonce={burst.nonce}
            />
          )}

          {!compact && (
          <CosmosCameraController
            mode={cameraMode}
            focusedDomain={focusedDomain}
            focusedPosition={focusedPosition}
            systemRadius={systemRadius}
            onTransitionStateChange={setIsCameraTransitioning}
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

      <AnimatePresence mode="sync">
        {transitionFadeKey > 0 && (
          <motion.div
            key={`cosmos-scene-fade-${transitionFadeKey}`}
            className="absolute inset-0 z-[14] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.16, 0] }}
            transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={() => setTransitionFadeKey(0)}
            style={{
              background:
                'radial-gradient(circle at 50% 45%, rgba(29,38,92,0.2) 0%, rgba(8,12,33,0.36) 55%, rgba(3,6,18,0.56) 100%)',
            }}
          />
        )}
      </AnimatePresence>

      {!compact && (
        <CosmosHudOverlay
          domain={focusedDomain}
          progress={focusedProgress}
          evolution={focusedEvolution}
          activeIslands={activeIslands}
          otherTopics={otherTopics}
          selectedTopic={selectedTopic}
          selectedTopicTimeline={selectedTopicTimeline}
          isLoadingTopics={isLoadingTopics}
          isLoadingTopicTimeline={isLoadingTopicTimeline}
          isVisible={!isCelebrating && (cameraMode === 'focus' || cameraMode === 'detail')}
          isTransitioning={isCameraTransitioning}
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

      {!compact && (
        <CelebrationCard
          domain={currentGrowthDomain}
          event={currentGrowth}
          visible={growthPhase === 'card'}
          index={growthIndex}
          total={growthQueue.length}
          onNext={handleGrowthNext}
        />
      )}

      {!compact && isCelebrating && growthPhase !== 'card' && (
        <button
          type="button"
          onClick={finishGrowth}
          className="absolute right-3 z-40 rounded-xl border border-white/15 bg-black/35 px-3 py-1.5 text-[11px] font-bold text-white/70 backdrop-blur hover:text-white"
          style={{ bottom: 'max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))' }}
        >
          Überspringen
        </button>
      )}

      {!compact && (
        <AnimatePresence>
          {showIntro && !isCelebrating && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 240, damping: 26, delay: 0.6 }}
              className="absolute left-1/2 z-40 w-[min(92vw,26rem)] -translate-x-1/2"
              style={{ bottom: 'max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
            >
              <div
                className="rounded-3xl border border-white/12 p-5 text-center backdrop-blur-xl"
                style={{
                  background: 'linear-gradient(160deg, rgba(14,16,40,0.94) 0%, rgba(24,18,52,0.96) 100%)',
                  boxShadow: '0 24px 70px rgba(0,0,0,0.55), 0 0 60px rgba(168,85,247,0.18)',
                }}
              >
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-purple-200/70">
                  Willkommen
                </p>
                <h3 className="mt-1 text-xl font-extrabold text-white">Dein Lernkosmos</h3>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-white/75">
                  Jede Welt wächst, wenn du lernst: aus Sternenstaub werden Planeten mit Ozeanen,
                  Wolken und Leben. Jedes Thema kreist als Mond um seinen Planeten.
                </p>
                <button
                  type="button"
                  onClick={() => setShowIntro(false)}
                  className="mt-4 w-full rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-purple-500/30 active:scale-[0.98]"
                >
                  Los geht's!
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {!compact && focusedDomain && (
        <SuggestionDrawer
          open={isSuggestionDrawerOpen}
          title={`Weiterlernen in ${focusedDomain.label}`}
          subtitle="Wähle ein Thema oder lass dir ein neues vorschlagen."
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
              <div className="flex items-center gap-3">
                {cosmosState.avatarImageUrl && (
                  <img
                    src={cosmosState.avatarImageUrl}
                    alt=""
                    className="h-12 w-12 rounded-2xl border border-amber-200/40 object-cover"
                    style={{ boxShadow: '0 0 18px rgba(251,191,36,0.35)' }}
                  />
                )}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200/70">
                    Dein Wissensstern
                  </p>
                  <h3 className="mt-0.5 text-lg font-extrabold text-white">
                    {cosmosState.childName || 'Du'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChildInfoVisible(false)}
                className="rounded-lg border border-white/20 px-2.5 py-1 text-[11px] font-bold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                Schließen
              </button>
            </div>
            <p className="mt-2 text-xs text-white/65">
              Alle Welten kreisen um deinen Stern. Je mehr du lernst, desto größer werden sie.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <InfoPill label="Geschichten" value={cosmosState.totalStoriesRead} />
              <InfoPill label="Dokus" value={cosmosState.totalDokusRead} />
              <InfoPill
                label="Aktive Welten"
                value={
                  cosmosState.domains.filter(
                    (entry) =>
                      entry.topicsExplored > 0 ||
                      entry.mastery > 0 ||
                      entry.confidence > 0 ||
                      entry.stage !== "discovered"
                  ).length
                }
              />
            </div>
          </div>
        </div>
      )}

      {!compact && showInternalModeTabs && (
        <div
          className="absolute left-1/2 z-20 -translate-x-1/2 flex items-center gap-1 rounded-xl border border-white/15 bg-black/35 px-2 py-1 backdrop-blur max-w-[94vw]"
          style={{ top: 'max(5.1rem, calc(env(safe-area-inset-top, 0px) + 4.3rem))' }}
        >
          <ZoomButton
            active={cameraMode === 'system'}
            label="Übersicht"
            onClick={handleResetFocus}
          />
          <ZoomButton
            active={cameraMode === 'focus'}
            label="Planet"
            disabled={!focusedDomainId}
            onClick={() => focusedDomainId && setCameraMode('focus')}
          />
          <ZoomButton
            active={cameraMode === 'detail'}
            label="Monde"
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

const SceneReadyProbe: React.FC<{ onReady: () => void }> = ({ onReady }) => {
  const sentRef = useRef(false);

  useFrame(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    onReady();
  });

  return null;
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
        const evolution = computePlanetEvolution(progress ?? emptyProgress(domain.id), domain.planetType);

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
            <span className="text-[11px] font-semibold text-white/60">
              {evolution.stage === 0 ? 'Unentdeckt' : `Stufe ${evolution.stage} · ${evolution.current.name}`}
            </span>
            <div className="h-1.5 w-full rounded-full bg-white/10">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round(evolution.progressToNext * 100)}%`,
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
