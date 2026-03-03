/**
 * CosmosPlanetDomain.tsx - High-fidelity domain planet
 *
 * Visuals evolve continuously with mastery/confidence:
 * - Procedural surface map and bump detail
 * - Dynamic cloud layer and aura
 * - Progressive ring intensity and satellite count
 * - Life-signal particles for advanced progression
 */

import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Sphere, Ring, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { CosmosDomain, DomainProgress } from './CosmosTypes';
import { mapProgressToVisuals } from './CosmosProgressMapper';

interface Props {
  domain: CosmosDomain;
  progress: DomainProgress;
  isFocused: boolean;
  onSelect: (domainId: string, focusPosition: [number, number, number]) => void;
}

const MAX_LIFE_PARTICLES = 10;

export const CosmosPlanetDomain: React.FC<Props> = ({
  domain,
  progress,
  isFocused,
  onSelect,
}) => {
  const groupRef = useRef<THREE.Group>(null!);
  const planetRef = useRef<THREE.Mesh>(null!);
  const cloudRef = useRef<THREE.Mesh>(null!);
  const atmosphereRef = useRef<THREE.Mesh>(null!);
  const auraRef = useRef<THREE.Mesh>(null!);
  const satelliteRefs = useRef<Array<THREE.Mesh | null>>([]);
  const lifeParticleRefs = useRef<Array<THREE.Mesh | null>>([]);

  const visuals = useMemo(() => mapProgressToVisuals(progress), [progress]);

  const orbitConfig = useMemo(() => {
    const seed = hashString(domain.id);
    const inclination = (((seed % 18) - 9) * Math.PI) / 180;
    const eccentricity = 0.82 + (((seed >> 3) % 16) / 100);
    const phase = ((seed >> 8) % 628) / 100;
    return {
      seed,
      inclination,
      eccentricity,
      phase,
    };
  }, [domain.id]);

  const initialPosition = useMemo<[number, number, number]>(() => {
    const angle = domain.startAngle;
    const y =
      Math.sin(angle + orbitConfig.phase) *
      domain.orbitRadius *
      Math.sin(orbitConfig.inclination) *
      0.22;
    return [
      Math.cos(angle) * domain.orbitRadius,
      y,
      Math.sin(angle) * domain.orbitRadius * orbitConfig.eccentricity,
    ];
  }, [
    domain.orbitRadius,
    domain.startAngle,
    orbitConfig.eccentricity,
    orbitConfig.inclination,
    orbitConfig.phase,
  ]);

  const maps = useMemo(
    () => createPlanetMaps(domain.color, orbitConfig.seed),
    [domain.color, orbitConfig.seed]
  );

  const planetMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#ffffff'),
        map: maps.surfaceMap,
        bumpMap: maps.bumpMap,
        bumpScale: 0.07 + visuals.surfaceDetail * 0.18,
        roughnessMap: maps.roughnessMap,
        roughness: Math.max(0.22, 0.64 - visuals.surfaceDetail * 0.24),
        metalness: 0.04 + visuals.developmentLevel * 0.05,
        clearcoat: 0.18 + visuals.developmentLevel * 0.4,
        clearcoatRoughness: 0.45 - visuals.developmentLevel * 0.15,
        emissive: new THREE.Color(domain.emissiveColor),
        emissiveIntensity: visuals.emissiveIntensity,
      }),
    [domain.emissiveColor, maps.bumpMap, maps.roughnessMap, maps.surfaceMap, visuals.developmentLevel, visuals.emissiveIntensity, visuals.surfaceDetail]
  );

  const cloudMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: maps.cloudMap,
        color: '#eaf2ff',
        transparent: true,
        opacity: visuals.cloudOpacity,
        depthWrite: false,
      }),
    [maps.cloudMap, visuals.cloudOpacity]
  );

  const atmosphereMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(domain.color),
        transparent: true,
        opacity: visuals.atmosphereOpacity,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [domain.color, visuals.atmosphereOpacity]
  );

  const auraMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(domain.emissiveColor),
        transparent: true,
        opacity: visuals.auraOpacity,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [domain.emissiveColor, visuals.auraOpacity]
  );

  const lifeParticleSeeds = useMemo(
    () =>
      Array.from({ length: MAX_LIFE_PARTICLES }, (_, index) => {
        const phase = ((orbitConfig.seed + index * 37) % 628) / 100;
        const offset = ((orbitConfig.seed + index * 91) % 100) / 100;
        return { phase, offset };
      }),
    [orbitConfig.seed]
  );

  const activeLifeParticles = Math.min(
    MAX_LIFE_PARTICLES,
    Math.floor(visuals.lifeSignalStrength * MAX_LIFE_PARTICLES)
  );

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const currentPosition = groupRef.current?.position;
      if (!currentPosition) {
        onSelect(domain.id, [0, 0, 0]);
        return;
      }
      onSelect(domain.id, [currentPosition.x, currentPosition.y, currentPosition.z]);
    },
    [domain.id, onSelect]
  );

  useEffect(() => {
    return () => {
      planetMaterial.dispose();
      cloudMaterial.dispose();
      atmosphereMaterial.dispose();
      auraMaterial.dispose();
      maps.surfaceMap.dispose();
      maps.bumpMap.dispose();
      maps.roughnessMap.dispose();
      maps.cloudMap.dispose();
    };
  }, [atmosphereMaterial, auraMaterial, cloudMaterial, maps.bumpMap, maps.cloudMap, maps.roughnessMap, maps.surfaceMap, planetMaterial]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();

    if (!isFocused) {
      const angle = domain.startAngle + t * domain.orbitSpeed;
      const wobble =
        (1 - visuals.orbitStability) *
        Math.sin(t * 3 + domain.startAngle + orbitConfig.phase) *
        0.14;
      const orbitalY =
        Math.sin(angle + orbitConfig.phase) *
        domain.orbitRadius *
        Math.sin(orbitConfig.inclination) *
        0.22;

      groupRef.current.position.x = Math.cos(angle) * domain.orbitRadius;
      groupRef.current.position.z =
        Math.sin(angle) * domain.orbitRadius * orbitConfig.eccentricity;
      groupRef.current.position.y = orbitalY + wobble;
    }

    if (planetRef.current) {
      planetRef.current.rotation.y += 0.002 + visuals.developmentLevel * 0.0014;
      planetRef.current.rotation.x += 0.00045;
    }

    if (cloudRef.current) {
      cloudRef.current.rotation.y += 0.0016;
      cloudRef.current.rotation.z += 0.0005;
    }

    if (auraRef.current) {
      auraRef.current.scale.setScalar(1 + Math.sin(t * 0.8 + orbitConfig.phase) * 0.02);
    }

    satelliteRefs.current.forEach((satellite, index) => {
      if (!satellite) return;
      const angle = t * (1.2 + index * 0.23) + index * 1.37;
      const radius = 1.1 + visuals.scale * 0.36 + index * 0.28;
      satellite.position.x = Math.cos(angle) * radius;
      satellite.position.z = Math.sin(angle) * radius;
      satellite.position.y = Math.sin(angle * 0.6) * (0.12 + index * 0.03);
    });

    lifeParticleRefs.current.forEach((particle, index) => {
      if (!particle || index >= activeLifeParticles) return;
      const seed = lifeParticleSeeds[index];
      const angle = t * (1.8 + seed.offset * 1.2) + seed.phase;
      const radius = 0.92 + visuals.scale * 0.38 + seed.offset * 0.36;
      particle.position.x = Math.cos(angle) * radius;
      particle.position.z = Math.sin(angle) * radius;
      particle.position.y = Math.sin(angle * 1.7 + seed.phase) * 0.3;
      particle.scale.setScalar(0.6 + Math.sin(t * 3 + seed.phase) * 0.08);
    });
  });

  const baseRadius = 0.52;
  const ringLayers = visuals.ringOpacity > 0 ? Math.max(1, Math.round(visuals.ringOpacity * 3)) : 0;

  return (
    <group ref={groupRef} position={initialPosition}>
      <Sphere
        ref={planetRef}
        args={[baseRadius * visuals.scale, 42, 42]}
        material={planetMaterial}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      />

      <Sphere
        ref={cloudRef}
        args={[baseRadius * visuals.scale * 1.03, 32, 32]}
        material={cloudMaterial}
      />

      <Sphere
        ref={atmosphereRef}
        args={[baseRadius * visuals.scale * 1.17, 28, 28]}
        material={atmosphereMaterial}
      />

      <Sphere
        ref={auraRef}
        args={[baseRadius * visuals.scale * 1.34, 22, 22]}
        material={auraMaterial}
      />

      {ringLayers > 0 &&
        Array.from({ length: ringLayers }).map((_, index) => {
          const inner = baseRadius * visuals.scale * (1.42 + index * 0.22);
          const outer = inner + baseRadius * visuals.scale * (0.32 + index * 0.08);
          const opacity = Math.max(0.08, visuals.ringOpacity * (0.8 - index * 0.22));
          return (
            <Ring
              key={`ring_${index}`}
              args={[inner, outer, 60]}
              rotation={[Math.PI / (2.45 + index * 0.04), 0, index * 0.05]}
            >
              <meshBasicMaterial
                color={domain.color}
                transparent
                opacity={opacity}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </Ring>
          );
        })}

      {Array.from({ length: visuals.satelliteCount }).map((_, index) => (
        <Sphere
          key={`sat_${index}`}
          ref={(node) => {
            satelliteRefs.current[index] = node;
          }}
          args={[0.05 + index * 0.014, 14, 14]}
        >
          <meshStandardMaterial
            color="#dbe6ff"
            emissive={domain.emissiveColor}
            emissiveIntensity={0.24}
            roughness={0.55}
            metalness={0.12}
          />
        </Sphere>
      ))}

      {Array.from({ length: activeLifeParticles }).map((_, index) => (
        <Sphere
          key={`life_${index}`}
          ref={(node) => {
            lifeParticleRefs.current[index] = node;
          }}
          args={[0.028, 8, 8]}
        >
          <meshBasicMaterial
            color={domain.emissiveColor}
            transparent
            opacity={0.65}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </Sphere>
      ))}

      <Html
        position={[0, baseRadius * visuals.scale + 0.6, 0]}
        center
        distanceFactor={14}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <span style={{ fontSize: '18px' }}>{domain.icon}</span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'white',
              textShadow: '0 1px 4px rgba(0,0,0,0.85)',
              whiteSpace: 'nowrap',
              fontFamily: '"Nunito", sans-serif',
            }}
          >
            {domain.label}
          </span>
        </div>
      </Html>
    </group>
  );
};

function createPlanetMaps(baseHex: string, seed: number): {
  surfaceMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  cloudMap: THREE.CanvasTexture;
} {
  const size = 256;
  const surfaceCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  const cloudCanvas = document.createElement('canvas');
  surfaceCanvas.width = surfaceCanvas.height = size;
  bumpCanvas.width = bumpCanvas.height = size;
  roughCanvas.width = roughCanvas.height = size;
  cloudCanvas.width = cloudCanvas.height = size;

  const surfaceCtx = surfaceCanvas.getContext('2d');
  const bumpCtx = bumpCanvas.getContext('2d');
  const roughCtx = roughCanvas.getContext('2d');
  const cloudCtx = cloudCanvas.getContext('2d');
  if (!surfaceCtx || !bumpCtx || !roughCtx || !cloudCtx) {
    throw new Error('Could not create 2D canvas context for planet maps');
  }

  const surfaceData = surfaceCtx.createImageData(size, size);
  const bumpData = bumpCtx.createImageData(size, size);
  const roughData = roughCtx.createImageData(size, size);
  const cloudData = cloudCtx.createImageData(size, size);

  const baseColor = new THREE.Color(baseHex);
  const baseR = Math.floor(baseColor.r * 255);
  const baseG = Math.floor(baseColor.g * 255);
  const baseB = Math.floor(baseColor.b * 255);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const nx = x / size;
      const ny = y / size;

      const n1 = fbm2D(nx * 4.5, ny * 4.5, seed, 4);
      const n2 = fbm2D(nx * 11.0, ny * 11.0, seed + 71, 3);
      const ridge = Math.abs(0.5 - n2) * 2;
      const altitude = clamp01(n1 * 0.8 + ridge * 0.2);

      const shade = 0.62 + altitude * 0.55;
      const tint = 0.88 + n2 * 0.24;
      surfaceData.data[i] = clamp255(baseR * shade * tint);
      surfaceData.data[i + 1] = clamp255(baseG * shade * (0.9 + n1 * 0.2));
      surfaceData.data[i + 2] = clamp255(baseB * shade * (0.88 + ridge * 0.2));
      surfaceData.data[i + 3] = 255;

      const bump = clamp255(altitude * 255);
      bumpData.data[i] = bump;
      bumpData.data[i + 1] = bump;
      bumpData.data[i + 2] = bump;
      bumpData.data[i + 3] = 255;

      const rough = clamp255((0.3 + ridge * 0.55 + n1 * 0.15) * 255);
      roughData.data[i] = rough;
      roughData.data[i + 1] = rough;
      roughData.data[i + 2] = rough;
      roughData.data[i + 3] = 255;

      const cloudNoise = fbm2D(nx * 6.2, ny * 6.2, seed + 133, 5);
      const cloudAlpha = clamp255(Math.max(0, cloudNoise - 0.56) * 640);
      cloudData.data[i] = 255;
      cloudData.data[i + 1] = 255;
      cloudData.data[i + 2] = 255;
      cloudData.data[i + 3] = cloudAlpha;
    }
  }

  surfaceCtx.putImageData(surfaceData, 0, 0);
  bumpCtx.putImageData(bumpData, 0, 0);
  roughCtx.putImageData(roughData, 0, 0);
  cloudCtx.putImageData(cloudData, 0, 0);

  const surfaceMap = new THREE.CanvasTexture(surfaceCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  const cloudMap = new THREE.CanvasTexture(cloudCanvas);

  [surfaceMap, bumpMap, roughnessMap, cloudMap].forEach((texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.25, 1.25);
    texture.needsUpdate = true;
  });
  surfaceMap.colorSpace = THREE.SRGBColorSpace;

  return { surfaceMap, bumpMap, roughnessMap, cloudMap };
}

function fbm2D(x: number, y: number, seed: number, octaves: number): number {
  let amplitude = 0.5;
  let frequency = 1;
  let value = 0;
  let max = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    value += noise2D(x * frequency, y * frequency, seed + octave * 31) * amplitude;
    max += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return max > 0 ? value / max : 0;
}

function noise2D(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 0.037) * 43758.5453123;
  return n - Math.floor(n);
}

function clamp255(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}
