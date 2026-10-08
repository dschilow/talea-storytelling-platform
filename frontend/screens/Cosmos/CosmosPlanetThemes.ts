/**
 * CosmosPlanetThemes.ts - Look of each world type for the evolving planet shader.
 *
 * A theme only describes colours and a few style switches. What is visible
 * (water, life, lights, ...) is decided by the evolution stage, so every world
 * goes through the same ladder but ends up looking like itself.
 */

import * as THREE from 'three';
import type { CosmosDomain } from './CosmosTypes';

export interface PlanetTheme {
  rockLow: string;
  rockHigh: string;
  sand: string;
  oceanShallow: string;
  oceanDeep: string;
  lifeA: string;
  lifeB: string;
  snow: string;
  lights: string;
  atmosphere: string;
  cloud: string;
  ring: [string, string];
  /** Polar ice amount once the planet has an atmosphere. */
  ice: number;
  /** Highest sea level (0..1 of the terrain height). */
  seaLevel: number;
  /** Glowing cell seams: circuits (tech), lava cracks (logic), facets (arts). */
  seams: number;
  /** Seams follow a panel grid instead of organic cells. */
  seamGrid: number;
  /** Dune stripes in the rock. */
  dunes: number;
  /** Rainbow shimmer on life and lights. */
  iridescence: number;
  /** Self-lit oceans (lava, glowing seas). */
  oceanGlow: number;
  /** Lights beat like a heart. */
  heartbeat: number;
}

const THEMES: Record<CosmosDomain['planetType'], PlanetTheme> = {
  // Natur & Tiere
  lush: {
    rockLow: '#5b4636',
    rockHigh: '#a38f73',
    sand: '#dcc68e',
    oceanShallow: '#2fb8c2',
    oceanDeep: '#0b3a6b',
    lifeA: '#2f8f3a',
    lifeB: '#a6d14a',
    snow: '#f4f8ff',
    lights: '#ffe27a',
    atmosphere: '#7fd8ff',
    cloud: '#ffffff',
    ring: ['#d9f99d', '#86efac'],
    ice: 0.45,
    seaLevel: 0.5,
    seams: 0,
    seamGrid: 0,
    dunes: 0,
    iridescence: 0,
    oceanGlow: 0,
    heartbeat: 0,
  },
  // Weltraum
  icy: {
    rockLow: '#353a66',
    rockHigh: '#a9b6e6',
    sand: '#cfdcff',
    oceanShallow: '#5b86ff',
    oceanDeep: '#16185a',
    lifeA: '#8b6cff',
    lifeB: '#55e6ff',
    snow: '#f5f8ff',
    lights: '#9af3ff',
    atmosphere: '#9d8cff',
    cloud: '#e8eeff',
    ring: ['#c7d2fe', '#a5f3fc'],
    ice: 1,
    seaLevel: 0.46,
    seams: 0,
    seamGrid: 0,
    dunes: 0,
    iridescence: 0.25,
    oceanGlow: 0.12,
    heartbeat: 0,
  },
  // Geschichte & Kulturen
  desert: {
    rockLow: '#7c4a2b',
    rockHigh: '#dcab68',
    sand: '#f2d59b',
    oceanShallow: '#3fd3c3',
    oceanDeep: '#126b78',
    lifeA: '#6f8f2f',
    lifeB: '#c2b04e',
    snow: '#fff4e2',
    lights: '#ffb347',
    atmosphere: '#ffc98a',
    cloud: '#fff1dc',
    ring: ['#fde68a', '#fdba74'],
    ice: 0.15,
    seaLevel: 0.34,
    seams: 0,
    seamGrid: 0,
    dunes: 1,
    iridescence: 0,
    oceanGlow: 0,
    heartbeat: 0,
  },
  // Technik & Erfindungen
  gaseous: {
    rockLow: '#2a323e',
    rockHigh: '#8a9ab0',
    sand: '#b3bfcd',
    oceanShallow: '#2fe4d6',
    oceanDeep: '#08394a',
    lifeA: '#27d3ff',
    lifeB: '#5be7c4',
    snow: '#eaf5ff',
    lights: '#4ff7ff',
    atmosphere: '#5fe3ff',
    cloud: '#e2f6ff',
    ring: ['#a5f3fc', '#93c5fd'],
    ice: 0.2,
    seaLevel: 0.4,
    seams: 1,
    seamGrid: 1,
    dunes: 0,
    iridescence: 0,
    oceanGlow: 0.18,
    heartbeat: 0,
  },
  // Mensch & Körper
  terrestrial: {
    rockLow: '#7d4256',
    rockHigh: '#e8a8a6',
    sand: '#ffd6c4',
    oceanShallow: '#ff7eb0',
    oceanDeep: '#5b1849',
    lifeA: '#ff5c7f',
    lifeB: '#ffb36b',
    snow: '#fff1f5',
    lights: '#ff6fa3',
    atmosphere: '#ff9ec9',
    cloud: '#fff3f7',
    ring: ['#fbcfe8', '#fda4af'],
    ice: 0.1,
    seaLevel: 0.46,
    seams: 0,
    seamGrid: 0,
    dunes: 0,
    iridescence: 0,
    oceanGlow: 0.08,
    heartbeat: 1,
  },
  // Erde & Klima
  oceanic: {
    rockLow: '#57503f',
    rockHigh: '#a69c88',
    sand: '#e4d4a6',
    oceanShallow: '#2f93db',
    oceanDeep: '#08285c',
    lifeA: '#2e7d32',
    lifeB: '#93c24a',
    snow: '#ffffff',
    lights: '#ffd27a',
    atmosphere: '#6fb6ff',
    cloud: '#ffffff',
    ring: ['#bae6fd', '#e0f2fe'],
    ice: 0.7,
    seaLevel: 0.56,
    seams: 0,
    seamGrid: 0,
    dunes: 0,
    iridescence: 0,
    oceanGlow: 0,
    heartbeat: 0,
  },
  // Kunst & Musik
  crystalline: {
    rockLow: '#4a3a6c',
    rockHigh: '#cdb9f2',
    sand: '#f4d9ff',
    oceanShallow: '#b86cff',
    oceanDeep: '#341672',
    lifeA: '#ff7ad9',
    lifeB: '#7affd8',
    snow: '#fdf7ff',
    lights: '#ffe36e',
    atmosphere: '#e09bff',
    cloud: '#fbefff',
    ring: ['#f5d0fe', '#a5f3fc'],
    ice: 0.35,
    seaLevel: 0.44,
    seams: 0.45,
    seamGrid: 0,
    dunes: 0,
    iridescence: 1,
    oceanGlow: 0.15,
    heartbeat: 0,
  },
  // Logik & Rätsel
  volcanic: {
    rockLow: '#1f1a20',
    rockHigh: '#5e5157',
    sand: '#7d5c4c',
    oceanShallow: '#ff9a3c',
    oceanDeep: '#b9330c',
    lifeA: '#ffd25c',
    lifeB: '#ff7a2f',
    snow: '#dad5d9',
    lights: '#ff8a2a',
    atmosphere: '#ff9a5c',
    cloud: '#8c8189',
    ring: ['#fed7aa', '#fca5a5'],
    ice: 0,
    seaLevel: 0.4,
    seams: 1,
    seamGrid: 0,
    dunes: 0,
    iridescence: 0,
    oceanGlow: 1,
    heartbeat: 0,
  },
};

export function getPlanetTheme(planetType: CosmosDomain['planetType']): PlanetTheme {
  return THEMES[planetType] ?? THEMES.terrestrial;
}

/** Linear-space colours for shader uniforms. */
export function themeColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

/** Learning-stage colours of the topic moons (same scale as the HUD). */
export const MOON_STAGE_COLORS: Record<string, string> = {
  discovered: '#a5b4cb',
  understood: '#60a5fa',
  apply: '#4ade80',
  retained: '#fbbf24',
};
