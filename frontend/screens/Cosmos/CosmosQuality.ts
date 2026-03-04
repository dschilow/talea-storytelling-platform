import type { CameraMode } from './CosmosTypes';

export type CosmosQualityTier = 'low' | 'standard' | 'aaa';
export type CosmosQualityPreference = 'auto' | CosmosQualityTier;

export interface CosmosQualityConfig {
  tier: CosmosQualityTier;
  dprRange: [number, number];
  baseStarCount: number;
  midStarCount: number;
  farStarCount: number;
  enableNebulaBillboards: boolean;
  enableBloom: boolean;
  bloomIntensity: number;
  bloomThreshold: number;
  bloomSmoothing: number;
  toneMappingExposure: number;
  useHdri: boolean;
  hdriPreset?: 'night' | 'city' | 'dawn';
  hdriFile?: string;
  planetTextureBaseSize: number;
  planetTextureHeroSize: number;
  ringTextureSize: number;
  nebulaTextureSize: number;
  godRaysIntroDuration: number;
}

const QUALITY_STORAGE_KEY = 'talea.cosmos.quality';

export function loadQualityPreference(): CosmosQualityPreference {
  if (typeof window === 'undefined') return 'auto';
  const value = window.localStorage.getItem(QUALITY_STORAGE_KEY);
  if (value === 'low' || value === 'standard' || value === 'aaa' || value === 'auto') {
    return value;
  }
  return 'auto';
}

export function saveQualityPreference(preference: CosmosQualityPreference): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(QUALITY_STORAGE_KEY, preference);
}

export function resolveQualityTier(preference: CosmosQualityPreference): CosmosQualityTier {
  if (preference !== 'auto') return preference;
  if (typeof window === 'undefined') return 'standard';

  const memory = (navigator as any).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const smallScreen = window.matchMedia('(max-width: 900px)').matches;

  if (reducedMotion || memory <= 3 || cores <= 4) return 'low';
  if (smallScreen || memory <= 6 || cores <= 6) return 'standard';
  return 'aaa';
}

export function getQualityConfig(preference: CosmosQualityPreference): CosmosQualityConfig {
  const tier = resolveQualityTier(preference);

  if (tier === 'low') {
    return {
      tier,
      dprRange: [1, 1.2],
      baseStarCount: 900,
      midStarCount: 700,
      farStarCount: 400,
      enableNebulaBillboards: false,
      enableBloom: false,
      bloomIntensity: 0.12,
      bloomThreshold: 0.85,
      bloomSmoothing: 0.9,
      toneMappingExposure: 0.92,
      useHdri: false,
      planetTextureBaseSize: 256,
      planetTextureHeroSize: 512,
      ringTextureSize: 256,
      nebulaTextureSize: 512,
      godRaysIntroDuration: 1.2,
    };
  }

  if (tier === 'aaa') {
    return {
      tier,
      dprRange: [1, 1.5],
      baseStarCount: 2200,
      midStarCount: 1800,
      farStarCount: 1100,
      enableNebulaBillboards: true,
      enableBloom: true,
      bloomIntensity: 0.22,
      bloomThreshold: 0.74,
      bloomSmoothing: 0.92,
      toneMappingExposure: 0.95,
      useHdri: true,
      hdriFile: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/rogland_clear_night_2k.hdr',
      hdriPreset: 'night',
      planetTextureBaseSize: 512,
      planetTextureHeroSize: 2048,
      ringTextureSize: 512,
      nebulaTextureSize: 1024,
      godRaysIntroDuration: 2.2,
    };
  }

  return {
    tier: 'standard',
    dprRange: [1, 1.35],
    baseStarCount: 1500,
    midStarCount: 1200,
    farStarCount: 700,
    enableNebulaBillboards: true,
    enableBloom: true,
    bloomIntensity: 0.16,
    bloomThreshold: 0.8,
    bloomSmoothing: 0.9,
    toneMappingExposure: 0.94,
    useHdri: true,
    hdriPreset: 'night',
    planetTextureBaseSize: 512,
    planetTextureHeroSize: 1024,
    ringTextureSize: 512,
    nebulaTextureSize: 1024,
    godRaysIntroDuration: 1.6,
  };
}

export function getTextureSizeForPlanet(
  quality: CosmosQualityConfig,
  mode: CameraMode,
  isFocused: boolean
): number {
  if (quality.tier === 'aaa' && isFocused && (mode === 'focus' || mode === 'detail')) {
    return quality.planetTextureHeroSize;
  }
  if (quality.tier === 'standard' && isFocused && mode === 'detail') {
    return quality.planetTextureHeroSize;
  }
  return quality.planetTextureBaseSize;
}
