/**
 * CosmosPlanetDomain.tsx - One evolving Lernkosmos planet.
 *
 * The look comes entirely from the planet's evolution (CosmosEvolution):
 * stardust -> rock -> air -> oceans -> clouds -> life -> lights -> ring -> aurora.
 * Every layer is a GPU shader driven by uniforms, so a level-up can be played
 * as a live transformation. Every explored topic orbits the planet as a moon.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { CameraMode, CosmosDomain, DomainProgress, TopicIsland } from './CosmosTypes';
import { computePlanetEvolution, featuresFromEvo } from './CosmosEvolution';
import { getPlanetTheme, MOON_STAGE_COLORS } from './CosmosPlanetThemes';
import {
  getNoiseSeedOffset,
  getOrbitConfig,
  getOrbitPosition,
  getPlanetObliquity,
  hashString,
  type OrbitLayout,
} from './CosmosOrbit';
import {
  ATMOSPHERE_FRAGMENT,
  ATMOSPHERE_VERTEX,
  CLOUD_FRAGMENT,
  DUST_FRAGMENT,
  DUST_VERTEX,
  MOON_FRAGMENT,
  PLANET_FRAGMENT,
  RING_FRAGMENT,
  RING_VERTEX,
  SPHERE_VERTEX,
} from './CosmosShaders';

export interface PlanetGrowthOverride {
  fromEvo: number;
  toEvo: number;
  fromTopics: number;
  /** 0 holds the old look (camera still flying in); a new value plays the growth. */
  startToken: number;
}

interface Props {
  domain: CosmosDomain;
  progress: DomainProgress;
  isFocused: boolean;
  isTransitioning?: boolean;
  cameraMode?: CameraMode;
  islands?: TopicIsland[];
  selectedTopicId?: string | null;
  /** 1 = high quality noise, 0 = mobile-safe. */
  detail?: number;
  orbitLayout?: OrbitLayout;
  feedbackPulseNonce?: number;
  growth?: PlanetGrowthOverride | null;
  orbitAngles?: React.MutableRefObject<Map<string, number>>;
  onSelect: (domainId: string, focusPosition: [number, number, number]) => void;
  onPositionUpdate?: (domainId: string, position: [number, number, number]) => void;
  onSelectIsland?: (topic: TopicIsland) => void;
}

const SUN_POSITION = new THREE.Vector3(0, 0, 0);
const DEFAULT_LAYOUT: OrbitLayout = { scale: 1, stretch: 1 };
export const PLANET_GROWTH_DURATION = 3.2;
const MAX_MOONS = 8;
const RING_INNER = 1.45;
const RING_OUTER = 2.35;
const ATMOSPHERE_SHELL = 1.26;

const MOON_SIZE: Record<TopicIsland['stage'], number> = {
  discovered: 0.07,
  understood: 0.082,
  apply: 0.094,
  retained: 0.108,
};

export const CosmosPlanetDomain: React.FC<Props> = ({
  domain,
  progress,
  isFocused,
  isTransitioning = false,
  cameraMode = 'system',
  islands = [],
  selectedTopicId = null,
  detail = 1,
  orbitLayout = DEFAULT_LAYOUT,
  feedbackPulseNonce = 0,
  growth = null,
  orbitAngles,
  onSelect,
  onPositionUpdate,
  onSelectIsland,
}) => {
  const groupRef = useRef<THREE.Group>(null!);
  const planetRef = useRef<THREE.Mesh>(null!);
  const cloudRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const atmosphereRef = useRef<THREE.Mesh>(null!);
  const dustRef = useRef<THREE.Points>(null!);
  const hitRef = useRef<THREE.Mesh>(null!);
  const haloRef = useRef<THREE.Mesh>(null!);
  const labelAnchorRef = useRef<THREE.Group>(null!);
  const planetRadiusRef = useRef(0.5);
  const feedbackPulseRef = useRef(0);
  const growthStartRef = useRef<number | null>(null);
  const growthTokenRef = useRef(0);
  const moonRevealRef = useRef<number>(-Infinity);
  const gl = useThree((state) => state.gl);
  const compactLabel = useThree((state) => state.size.width < 640);

  const theme = useMemo(() => getPlanetTheme(domain.planetType), [domain.planetType]);
  const orbitConfig = useMemo(() => getOrbitConfig(domain.id), [domain.id]);
  const obliquity = useMemo(() => getPlanetObliquity(domain.id), [domain.id]);
  const pole = useMemo(
    () => new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...obliquity)).normalize(),
    [obliquity]
  );
  const evolution = useMemo(
    () => computePlanetEvolution(progress, domain.planetType),
    [domain.planetType, progress]
  );
  const angleRef = useRef(domain.startAngle);
  const displayEvoRef = useRef(growth ? growth.fromEvo : evolution.evo);

  const initialPosition = useMemo<[number, number, number]>(
    () => getOrbitPosition(domain.startAngle, domain.orbitRadius * orbitLayout.scale, orbitConfig, orbitLayout.stretch),
    // Only the first frame uses it; afterwards useFrame drives the position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const surfaceMaterial = useMemo(() => {
    const seed = getNoiseSeedOffset(domain.id);
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSeedOffset: { value: new THREE.Vector3(seed[0], seed[1], seed[2]) },
        uSunPos: { value: SUN_POSITION },
        uBumpScale: { value: 0.07 },
        uDetail: { value: 1 },
        uObjectToWorld: { value: new THREE.Matrix3() },
        uForm: { value: 0 },
        uAtmosphere: { value: 0 },
        uWater: { value: 0 },
        uLife: { value: 0 },
        uLights: { value: 0 },
        uGlow: { value: 0 },
        uRockLow: { value: new THREE.Color(theme.rockLow) },
        uRockHigh: { value: new THREE.Color(theme.rockHigh) },
        uSand: { value: new THREE.Color(theme.sand) },
        uOceanShallow: { value: new THREE.Color(theme.oceanShallow) },
        uOceanDeep: { value: new THREE.Color(theme.oceanDeep) },
        uLifeA: { value: new THREE.Color(theme.lifeA) },
        uLifeB: { value: new THREE.Color(theme.lifeB) },
        uSnow: { value: new THREE.Color(theme.snow) },
        uLightColor: { value: new THREE.Color(theme.lights) },
        uAtmoColor: { value: new THREE.Color(theme.atmosphere) },
        uGlowColor: { value: new THREE.Color(domain.color) },
        uIce: { value: theme.ice },
        uSeaLevel: { value: theme.seaLevel },
        uSeams: { value: theme.seams },
        uSeamGrid: { value: theme.seamGrid },
        uDunes: { value: theme.dunes },
        uIridescence: { value: theme.iridescence },
        uOceanGlow: { value: theme.oceanGlow },
        uHeartbeat: { value: theme.heartbeat },
      },
      vertexShader: SPHERE_VERTEX,
      fragmentShader: PLANET_FRAGMENT,
    });
  }, [domain.color, domain.id, theme]);

  const cloudMaterial = useMemo(() => {
    const seed = getNoiseSeedOffset(domain.id);
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSeedOffset: { value: new THREE.Vector3(seed[2], seed[0], seed[1]) },
        uSunPos: { value: SUN_POSITION },
        uCoverage: { value: 0 },
        uOpacity: { value: 0 },
        uCloudColor: { value: new THREE.Color(theme.cloud) },
      },
      vertexShader: SPHERE_VERTEX,
      fragmentShader: CLOUD_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
  }, [domain.id, theme]);

  const atmosphereMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uCenter: { value: new THREE.Vector3() },
          uPlanetRadius: { value: 0.5 },
          uShellRadius: { value: 0.5 * ATMOSPHERE_SHELL },
          uSunPos: { value: SUN_POSITION },
          uColor: { value: new THREE.Color(theme.atmosphere) },
          uStrength: { value: 0 },
          uAurora: { value: 0 },
          uAuroraA: { value: new THREE.Color('#5dffb4') },
          uAuroraB: { value: new THREE.Color(domain.color) },
          uPole: { value: pole },
          uTime: { value: 0 },
        },
        vertexShader: ATMOSPHERE_VERTEX,
        fragmentShader: ATMOSPHERE_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [domain.color, pole, theme]
  );

  const ringMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uInner: { value: RING_INNER },
          uOuter: { value: RING_OUTER },
          uColorA: { value: new THREE.Color(theme.ring[0]) },
          uColorB: { value: new THREE.Color(theme.ring[1]) },
          uOpacity: { value: 0 },
          uCenter: { value: new THREE.Vector3() },
          uPlanetRadius: { value: 0.5 },
          uSunPos: { value: SUN_POSITION },
          uSeed: { value: (orbitConfig.seed % 1000) / 37 },
          uTime: { value: 0 },
        },
        vertexShader: RING_VERTEX,
        fragmentShader: RING_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [orbitConfig.seed, theme]
  );

  const dust = useMemo(() => {
    const count = 240;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);
    let s = orbitConfig.seed || 1;
    const rand = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    for (let i = 0; i < count; i += 1) {
      const r = 0.3 + Math.pow(rand(), 0.75) * 0.95;
      positions[i * 3] = r;
      positions[i * 3 + 1] = (rand() - 0.5) * 0.16 * (1.3 - r);
      positions[i * 3 + 2] = 0;
      sizes[i] = 1.2 + rand() * 3.2;
      phases[i] = rand() * Math.PI * 2;
      speeds[i] = 0.32 / Math.sqrt(r);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uContract: { value: 0 },
        uColor: { value: new THREE.Color(domain.color) },
        uOpacity: { value: 1 },
      },
      vertexShader: DUST_VERTEX,
      fragmentShader: DUST_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry, material };
  }, [domain.color, orbitConfig.seed]);

  const haloMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: domain.color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [domain.color]
  );

  useEffect(() => {
    surfaceMaterial.uniforms.uDetail.value = detail;
  }, [detail, surfaceMaterial]);

  useEffect(() => {
    dust.material.uniforms.uPixelRatio.value = gl.getPixelRatio();
  }, [dust.material, gl]);

  useEffect(() => {
    if (feedbackPulseNonce > 0) feedbackPulseRef.current = 1;
  }, [feedbackPulseNonce]);

  useEffect(
    () => () => {
      surfaceMaterial.dispose();
      cloudMaterial.dispose();
      atmosphereMaterial.dispose();
      ringMaterial.dispose();
      haloMaterial.dispose();
      dust.material.dispose();
      dust.geometry.dispose();
    },
    [atmosphereMaterial, cloudMaterial, dust, haloMaterial, ringMaterial, surfaceMaterial]
  );

  // New moons of a growth celebration stay hidden until the planet has grown.
  useEffect(() => {
    if (!growth) {
      moonRevealRef.current = -Infinity;
      growthStartRef.current = null;
      return;
    }
    if (growth.startToken === 0) {
      moonRevealRef.current = Infinity;
      growthStartRef.current = null;
    }
  }, [growth]);

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      const p = groupRef.current?.position;
      onSelect(domain.id, p ? [p.x, p.y, p.z] : [0, 0, 0]);
    },
    [domain.id, onSelect]
  );

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);

    // Orbit: focused planets hold still so the camera can frame them.
    if (!isFocused) angleRef.current += domain.orbitSpeed * dt;
    const position = getOrbitPosition(
      angleRef.current,
      domain.orbitRadius * orbitLayout.scale,
      orbitConfig,
      orbitLayout.stretch
    );
    group.position.set(position[0], position[1], position[2]);
    orbitAngles?.current.set(domain.id, angleRef.current);
    onPositionUpdate?.(domain.id, position);

    // Evolution: either the celebration timeline or a soft approach to the target.
    let evo: number;
    let growthGlow = 0;
    if (growth) {
      if (growth.startToken > 0) {
        if (growthTokenRef.current !== growth.startToken || growthStartRef.current === null) {
          growthTokenRef.current = growth.startToken;
          growthStartRef.current = t;
          moonRevealRef.current = t + PLANET_GROWTH_DURATION * 0.62;
        }
        const k = Math.min(1, (t - growthStartRef.current) / PLANET_GROWTH_DURATION);
        evo = growth.fromEvo + (growth.toEvo - growth.fromEvo) * easeInOutCubic(k);
        growthGlow = Math.sin(Math.PI * k) * 0.85;
      } else {
        evo = growth.fromEvo;
      }
      displayEvoRef.current = evo;
    } else {
      displayEvoRef.current += (evolution.evo - displayEvoRef.current) * (1 - Math.exp(-dt * 2.2));
      evo = displayEvoRef.current;
    }

    const features = featuresFromEvo(evo);
    const radius = features.radius * (0.3 + 0.7 * features.form);
    planetRadiusRef.current = radius;

    feedbackPulseRef.current = Math.max(0, feedbackPulseRef.current - dt * 1.1);
    const pulse = feedbackPulseRef.current;

    const surface = surfaceMaterial.uniforms;
    surface.uTime.value = t;
    surface.uForm.value = features.form;
    surface.uAtmosphere.value = features.atmosphere;
    surface.uWater.value = features.water;
    surface.uLife.value = features.life;
    surface.uLights.value = features.lights;
    surface.uGlow.value = (isFocused ? 0.16 : 0) + pulse * 0.9 + growthGlow;

    if (planetRef.current) {
      planetRef.current.scale.setScalar(radius);
      planetRef.current.rotation.y += dt * (0.07 + evo * 0.008);
      planetRef.current.updateMatrixWorld();
      surface.uObjectToWorld.value.setFromMatrix4(planetRef.current.matrixWorld);
    }

    if (cloudRef.current) {
      const visible = features.clouds > 0.01;
      cloudRef.current.visible = visible;
      if (visible) {
        cloudRef.current.scale.setScalar(radius * 1.022);
        cloudRef.current.rotation.y += dt * (0.085 + evo * 0.008);
        const cloud = cloudMaterial.uniforms;
        cloud.uTime.value = t;
        cloud.uCoverage.value = 0.35 + features.clouds * 0.45 + features.life * 0.1;
        cloud.uOpacity.value = features.clouds;
      }
    }

    if (atmosphereRef.current) {
      const visible = features.atmosphere > 0.01 || features.aurora > 0.01;
      atmosphereRef.current.visible = visible;
      if (visible) {
        atmosphereRef.current.scale.setScalar(radius * ATMOSPHERE_SHELL);
        const atmosphere = atmosphereMaterial.uniforms;
        atmosphere.uCenter.value.copy(group.position);
        atmosphere.uPlanetRadius.value = radius;
        atmosphere.uShellRadius.value = radius * ATMOSPHERE_SHELL;
        atmosphere.uStrength.value = features.atmosphere * (1 + growthGlow * 0.6 + pulse * 0.4);
        atmosphere.uAurora.value = features.aurora;
        atmosphere.uTime.value = t;
      }
    }

    if (ringRef.current) {
      const visible = features.ring > 0.01;
      ringRef.current.visible = visible;
      if (visible) {
        ringRef.current.scale.setScalar(radius * (0.85 + features.ring * 0.15));
        ringRef.current.rotation.z += dt * 0.02;
        const ring = ringMaterial.uniforms;
        ring.uOpacity.value = features.ring;
        ring.uCenter.value.copy(group.position);
        ring.uPlanetRadius.value = radius;
        ring.uTime.value = t;
      }
    }

    if (dustRef.current) {
      const dustOpacity = 1 - features.form;
      dustRef.current.visible = dustOpacity > 0.01;
      if (dustOpacity > 0.01) {
        const material = dust.material.uniforms;
        material.uTime.value = t;
        material.uOpacity.value = dustOpacity * (0.75 + pulse * 0.5);
        material.uContract.value = Math.min(1, features.form * 1.4);
        dustRef.current.scale.setScalar(features.radius * 1.5);
      }
    }

    if (hitRef.current) {
      hitRef.current.scale.setScalar(Math.max(radius * 1.45, 0.95));
    }

    if (haloRef.current) {
      const strength = Math.max(pulse, growthGlow);
      haloRef.current.visible = strength > 0.01;
      if (strength > 0.01) {
        haloRef.current.scale.setScalar(radius * (1.55 + Math.sin(t * 2) * 0.03 + pulse * 0.5));
        haloMaterial.opacity = strength * 0.55;
      }
    }

    if (labelAnchorRef.current) {
      labelAnchorRef.current.position.y = -(Math.max(radius, features.radius * 0.8) + 0.42);
    }
  });

  const moonTopics = isFocused && islands.length > 0 ? islands.slice(0, MAX_MOONS) : null;
  const moonCount = moonTopics ? moonTopics.length : Math.min(MAX_MOONS, Math.max(0, progress.topicsExplored || 0));
  const showPlanetLabel = cameraMode === 'system';
  const moonsInteractive = isFocused && cameraMode !== 'system';

  return (
    <group ref={groupRef} position={initialPosition}>
      <group rotation={obliquity}>
        <mesh ref={planetRef} material={surfaceMaterial}>
          <sphereGeometry args={[1, 128, 96]} />
        </mesh>
        <mesh ref={cloudRef} material={cloudMaterial} visible={false}>
          <sphereGeometry args={[1, 96, 72]} />
        </mesh>
        <mesh ref={ringRef} material={ringMaterial} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <ringGeometry args={[RING_INNER, RING_OUTER, 160, 1]} />
        </mesh>
      </group>

      <mesh ref={atmosphereRef} material={atmosphereMaterial} visible={false}>
        <sphereGeometry args={[1, 64, 48]} />
      </mesh>

      <points ref={dustRef} geometry={dust.geometry} material={dust.material} frustumCulled={false} />

      <Billboard follow>
        <mesh ref={haloRef} material={haloMaterial} visible={false}>
          <ringGeometry args={[1, 1.035, 96]} />
        </mesh>
      </Billboard>

      {/* Generous, invisible hit area: small fingers should not miss a planet. */}
      <mesh
        ref={hitRef}
        onClick={handleClick}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {Array.from({ length: moonCount }).map((_, index) => {
        const topic = moonTopics?.[index] ?? null;
        const isNew = Boolean(growth) && index >= (growth?.fromTopics ?? Infinity);
        return (
          <TopicMoon
            key={topic ? `moon_${topic.topicId}` : `moon_${index}`}
            index={index}
            seed={hashString(`${domain.id}:moon:${index}`)}
            topic={topic}
            color={topic ? MOON_STAGE_COLORS[topic.stage] ?? domain.color : domain.color}
            planetRadiusRef={planetRadiusRef}
            revealRef={isNew ? moonRevealRef : null}
            interactive={moonsInteractive}
            selected={Boolean(topic && topic.topicId === selectedTopicId)}
            showLabels={moonsInteractive && !isTransitioning}
            onSelect={onSelectIsland}
          />
        );
      })}

      <group ref={labelAnchorRef}>
        <Html
          center
          zIndexRange={[12, 0]}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
            opacity: showPlanetLabel ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        >
          <PlanetLabel
            domain={domain}
            stage={evolution.stage}
            stageName={evolution.current.name}
            compact={compactLabel}
          />
        </Html>
      </group>
    </group>
  );
};

const PlanetLabel: React.FC<{ domain: CosmosDomain; stage: number; stageName: string; compact: boolean }> = ({
  domain,
  stage,
  stageName,
  compact,
}) => (
  <div
    className="flex flex-col items-center gap-0.5 whitespace-nowrap"
    style={{ fontFamily: '"Nunito", sans-serif' }}
  >
    <span
      className={[
        'rounded-full border border-white/15 bg-black/45 font-extrabold tracking-wide text-white backdrop-blur-md',
        compact ? 'px-2 py-px text-[10px]' : 'px-2.5 py-0.5 text-[11px]',
      ].join(' ')}
      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
    >
      <span aria-hidden className="mr-1">
        {domain.icon}
      </span>
      {compact ? domain.label.split(' & ')[0] : domain.label}
    </span>
    <span
      className={compact ? 'text-[9px] font-bold' : 'text-[10px] font-bold'}
      style={{
        color: stage === 0 ? 'rgba(226,232,240,0.6)' : domain.color,
        textShadow: '0 1px 3px rgba(0,0,0,0.9)',
      }}
    >
      {stage === 0 ? 'Unentdeckt' : compact ? `Stufe ${stage}` : `Stufe ${stage} · ${stageName}`}
    </span>
  </div>
);

interface MoonProps {
  index: number;
  seed: number;
  topic: TopicIsland | null;
  color: string;
  planetRadiusRef: React.MutableRefObject<number>;
  /** Clock time from which a new moon pops in; null = always visible. */
  revealRef: React.MutableRefObject<number> | null;
  interactive: boolean;
  selected: boolean;
  showLabels: boolean;
  onSelect?: (topic: TopicIsland) => void;
}

const TopicMoon: React.FC<MoonProps> = ({
  index,
  seed,
  topic,
  color,
  planetRadiusRef,
  revealRef,
  interactive,
  selected,
  showLabels,
  onSelect,
}) => {
  const orbitRef = useRef<THREE.Group>(null!);
  const bodyRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);
  const size = topic ? MOON_SIZE[topic.stage] ?? 0.08 : 0.072;

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uSunPos: { value: SUN_POSITION },
          uSeed: { value: (seed % 1000) / 61 },
          uGlow: { value: 0 },
        },
        vertexShader: SPHERE_VERTEX,
        fragmentShader: MOON_FRAGMENT,
      }),
    // Colour updates go through the uniform below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed]
  );
  const glowMaterial = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    material.uniforms.uColor.value.set(color);
    glowMaterial.color.set(color);
  }, [color, glowMaterial, material]);

  useEffect(() => {
    material.uniforms.uGlow.value = selected || hovered ? 0.6 : 0;
    glowMaterial.opacity = selected || hovered ? 0.85 : 0.5;
  }, [glowMaterial, hovered, material, selected]);

  useEffect(
    () => () => {
      material.dispose();
      glowMaterial.dispose();
    },
    [glowMaterial, material]
  );

  const orbit = useMemo(() => {
    const r1 = hash01(seed, 1);
    const r2 = hash01(seed, 2);
    const r3 = hash01(seed, 3);
    return {
      tiltX: (r1 - 0.5) * 1.2,
      tiltZ: (r2 - 0.5) * 0.9,
      phase: r3 * Math.PI * 2,
      speedJitter: 0.8 + r1 * 0.45,
    };
  }, [seed]);

  useFrame(({ clock }, delta) => {
    const group = orbitRef.current;
    if (!group) return;
    const t = clock.elapsedTime;
    const radius = planetRadiusRef.current * 1.5 + 0.25 + index * 0.17;
    const angle = t * (0.5 / Math.sqrt(radius)) * orbit.speedJitter + orbit.phase;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y1 = -z * Math.sin(orbit.tiltX);
    const z1 = z * Math.cos(orbit.tiltX);
    group.position.set(
      x * Math.cos(orbit.tiltZ) - y1 * Math.sin(orbit.tiltZ),
      x * Math.sin(orbit.tiltZ) + y1 * Math.cos(orbit.tiltZ),
      z1
    );

    let scale = 1;
    if (revealRef) {
      const since = t - revealRef.current;
      scale = since <= 0 ? 0 : since >= 0.7 ? 1 : easeOutBack(since / 0.7);
    }
    group.scale.setScalar(scale);
    if (bodyRef.current) bodyRef.current.rotation.y += Math.min(delta, 0.05) * 0.6;
  });

  return (
    <group ref={orbitRef}>
      <mesh ref={bodyRef} material={material} scale={size}>
        <sphereGeometry args={[1, 32, 24]} />
      </mesh>
      <sprite material={glowMaterial} scale={size * 6.5} />

      {interactive && topic && (
        <mesh
          scale={Math.max(size * 3.2, 0.2)}
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.(topic);
          }}
          onPointerOver={(event) => {
            event.stopPropagation();
            setHovered(true);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHovered(false);
            document.body.style.cursor = 'auto';
          }}
        >
          <sphereGeometry args={[1, 12, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {selected && (
        <Billboard follow>
          <mesh>
            <ringGeometry args={[size * 2.3, size * 2.6, 48]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.9}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </Billboard>
      )}

      {topic && showLabels && (selected || hovered) && (
        <Html center position={[0, -size * 3.4, 0]} zIndexRange={[14, 0]} style={{ pointerEvents: 'none' }}>
          <span
            className="whitespace-nowrap rounded-full border border-white/20 bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md"
            style={{ fontFamily: '"Nunito", sans-serif', boxShadow: `0 0 12px ${color}55` }}
          >
            {formatTopicTitle(topic.topicTitle)}
          </span>
        </Html>
      )}
    </group>
  );
};

let glowTexture: THREE.CanvasTexture | null = null;

function getGlowTexture(): THREE.CanvasTexture {
  if (glowTexture) return glowTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.08)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(canvas);
  return glowTexture;
}

export function formatTopicTitle(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return 'Unbenanntes Thema';
  if (!raw.includes('_') && !raw.includes('-')) return raw;
  return raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Well-mixed 0..1 value; neighbouring seeds give unrelated results. */
function hash01(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function easeInOutCubic(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutBack(value: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const t = value - 1;
  return 1 + c3 * t * t * t + c1 * t * t;
}
