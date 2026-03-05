/**
 * CosmosPlanetDomain.tsx - High-fidelity domain planet
 *
 * Uses real NASA/Solar System Scope textures (CC BY 4.0) for photo-realistic
 * planet surfaces, with procedural bump/roughness/cloud/night maps for depth.
 * Each planetType maps to a different real texture; domain color tinting
 * ensures uniqueness even for same-type planets.
 *
 * Texture credits: Solar System Scope (https://www.solarsystemscope.com/textures/)
 * License: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
 */

import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { useFrame, ThreeEvent, useLoader } from '@react-three/fiber';
import { Sphere, Html, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import type { CameraMode, CosmosDomain, DomainProgress, TopicIsland } from './CosmosTypes';
import { mapProgressToVisuals } from './CosmosProgressMapper';

interface Props {
  domain: CosmosDomain;
  progress: DomainProgress;
  isFocused: boolean;
  cameraMode?: CameraMode;
  islands?: TopicIsland[];
  selectedTopicId?: string | null;
  textureSize?: number;
  feedbackPulseNonce?: number;
  onSelect: (domainId: string, focusPosition: [number, number, number]) => void;
  onPositionUpdate?: (domainId: string, position: [number, number, number]) => void;
  onSelectIsland?: (topic: TopicIsland) => void;
}

const MAX_LIFE_PARTICLES = 10;
const MAX_TOPIC_MOONS = 8;
type PlanetMapSet = {
  surfaceMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  cloudMap: THREE.CanvasTexture;
  nightMap: THREE.CanvasTexture;
};

const PLANET_MAP_CACHE = new Map<string, PlanetMapSet>();
const RING_MAP_CACHE = new Map<string, THREE.CanvasTexture>();

// NASA texture paths per planet type (Solar System Scope, CC BY 4.0)
// Each planetType maps to a unique texture — no duplicates!
function getNasaTexturePath(planetType: CosmosDomain['planetType'], _seed: number): string {
  const base = '/textures/planets/';
  switch (planetType) {
    case 'oceanic': return base + 'earth_daymap.jpg';      // Erde & Klima → Earth
    case 'lush': return base + 'jupiter.jpg';              // Natur & Tiere → Jupiter
    case 'terrestrial': return base + 'moon.jpg';          // Mensch & Körper → Moon
    case 'desert': return base + 'mars.jpg';               // Geschichte → Mars
    case 'icy': return base + 'neptune.jpg';               // Weltraum → Neptune
    case 'volcanic': return base + 'venus_surface.jpg';    // Logik & Rätsel → Venus
    case 'gaseous': return base + 'saturn.jpg';            // Technik → Saturn
    case 'crystalline': return base + 'mercury.jpg';       // Kunst & Musik → Mercury
    default: return base + 'moon.jpg';
  }
}

function getNasaNightTexturePath(planetType: CosmosDomain['planetType']): string | null {
  // Only Erde & Klima (oceanic) gets real city-lights night map
  if (planetType === 'oceanic') {
    return '/textures/planets/earth_nightmap.jpg';
  }
  return null;
}

function getNasaCloudTexturePath(planetType: CosmosDomain['planetType']): string | null {
  // Only Erde & Klima (oceanic) gets real cloud texture
  if (planetType === 'oceanic') {
    return '/textures/planets/earth_clouds.jpg';
  }
  return null;
}

function getCachedPlanetMaps(
  baseHex: string,
  seed: number,
  planetType: CosmosDomain['planetType'],
  detailFactor: number,
  textureSize: number
): PlanetMapSet {
  const quantizedDetail = Math.round(detailFactor * 4) / 4;
  // Version 5: 3D spherical noise (no equator seam), 2048px default.
  const key = `V5|${baseHex}|${seed}|${planetType}|${quantizedDetail}|${textureSize}`;
  const existing = PLANET_MAP_CACHE.get(key);
  if (existing) return existing;
  const created = createPlanetMaps(baseHex, seed, planetType, quantizedDetail, textureSize);
  PLANET_MAP_CACHE.set(key, created);
  return created;
}

function getCachedRingMap(color: string, seed: number, textureSize: number): THREE.CanvasTexture {
  const key = `${color}|${seed}|${textureSize}`;
  const existing = RING_MAP_CACHE.get(key);
  if (existing) return existing;
  const created = createRingTexture(color, seed, textureSize);
  RING_MAP_CACHE.set(key, created);
  return created;
}

const ATMOSPHERE_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ATMOSPHERE_FRAGMENT = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform vec3 uSunPos;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(vViewDir);
    vec3 sunDir = normalize(uSunPos - vWorldPos);

    // Fresnel rim
    float fresnel = max(0.0, dot(n, viewDir));
    float rim = pow(1.0 - fresnel, 3.8);

    // Terminator transition (Sun Illumination)
    float sunAlignment = dot(n, sunDir);
    float dayLight = smoothstep(-0.15, 0.35, sunAlignment);

    // Forward/Back-Scattering (Mie)
    float sunView = max(0.0, dot(-viewDir, sunDir));
    float mie = pow(sunView, 12.0) * 1.5;

    // Atmospheric Scattering (Rayleigh)
    vec3 rayleighColor = uColor * vec3(1.2, 1.5, 2.0); // Shift blue
    vec3 rayleigh = rayleighColor * rim * dayLight * 2.5;
    
    // Twilight color band
    float twilightBand = smoothstep(-0.25, 0.15, sunAlignment) * (1.0 - smoothstep(0.0, 0.3, sunAlignment));
    vec3 twilightColor = mix(uColor, vec3(1.0, 0.45, 0.15), 0.7); // Orange/red sunset
    vec3 twilight = twilightColor * rim * twilightBand * 2.0;

    // Mie contribution (sunset / sunrise glows brilliantly when backlit)
    vec3 mieGlow = vec3(1.0, 0.9, 0.8) * mie * rim * (dayLight + twilightBand);

    vec3 finalGlow = rayleigh + twilight + mieGlow;
    
    // Night-side ambient glow (very faint)
    float nightGlow = pow(1.0 - fresnel, 6.0) * 0.12 * (1.0 - dayLight);
    vec3 nightColor = uColor * nightGlow;
    
    finalGlow += nightColor;

    float alpha = length(finalGlow) * uOpacity;
    gl_FragColor = vec4(finalGlow, smoothstep(0.0, 1.0, alpha));
  }
`;

export const CosmosPlanetDomain: React.FC<Props> = ({
  domain,
  progress,
  isFocused,
  cameraMode = 'system',
  islands = [],
  selectedTopicId = null,
  textureSize = 2048,
  feedbackPulseNonce = 0,
  onSelect,
  onPositionUpdate,
  onSelectIsland,
}) => {
  const groupRef = useRef<THREE.Group>(null!);
  const planetRef = useRef<THREE.Mesh>(null!);
  const cloudRef = useRef<THREE.Mesh>(null!);
  const atmosphereRef = useRef<THREE.Mesh>(null!);
  const auraRef = useRef<THREE.Mesh>(null!);
  const satelliteRefs = useRef<Array<THREE.Group | null>>([]);
  const topicMoonRefs = useRef<Array<THREE.Group | null>>([]);
  const lifeParticleRefs = useRef<Array<THREE.Mesh | null>>([]);
  const selectionHaloRef = useRef<THREE.Mesh>(null!);
  const islandAnchorRef = useRef<THREE.Group>(null!);
  const feedbackPulseRef = useRef(0);
  const [labelExpanded, setLabelExpanded] = useState(false);

  const visuals = useMemo(() => mapProgressToVisuals(progress), [progress]);
  const mapDetailLevel = useMemo(
    () => Math.round(visuals.surfaceDetail * 6) / 6,
    [visuals.surfaceDetail]
  );

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
    return getOrbitPosition(angle, domain.orbitRadius, orbitConfig);
  }, [
    domain.orbitRadius,
    domain.startAngle,
    orbitConfig.eccentricity,
    orbitConfig.inclination,
    orbitConfig.phase,
  ]);

  const maps = useMemo(
    () =>
      getCachedPlanetMaps(
        domain.color,
        orbitConfig.seed,
        domain.planetType,
        mapDetailLevel,
        textureSize
      ),
    [domain.color, domain.planetType, mapDetailLevel, orbitConfig.seed, textureSize]
  );

  // Load real NASA surface texture for photo-realistic appearance
  const nasaTexturePath = useMemo(
    () => getNasaTexturePath(domain.planetType, orbitConfig.seed),
    [domain.planetType, orbitConfig.seed]
  );
  const nasaSurfaceTexture = useLoader(THREE.TextureLoader, nasaTexturePath);
  useMemo(() => {
    nasaSurfaceTexture.colorSpace = THREE.SRGBColorSpace;
    nasaSurfaceTexture.minFilter = THREE.LinearMipmapLinearFilter;
    nasaSurfaceTexture.magFilter = THREE.LinearFilter;
    nasaSurfaceTexture.generateMipmaps = true;
    nasaSurfaceTexture.wrapS = THREE.RepeatWrapping;
    nasaSurfaceTexture.wrapT = THREE.RepeatWrapping;
  }, [nasaSurfaceTexture]);

  // Load real NASA night map if available (Earth has city lights)
  const nasaNightPath = useMemo(
    () => getNasaNightTexturePath(domain.planetType),
    [domain.planetType]
  );
  const nasaNightTexture = useLoader(
    THREE.TextureLoader,
    nasaNightPath || nasaTexturePath // fallback to surface (won't be used)
  );
  useMemo(() => {
    if (nasaNightPath) {
      nasaNightTexture.colorSpace = THREE.SRGBColorSpace;
      nasaNightTexture.minFilter = THREE.LinearMipmapLinearFilter;
      nasaNightTexture.generateMipmaps = true;
    }
  }, [nasaNightTexture, nasaNightPath]);

  // Load real cloud texture if available
  const nasaCloudPath = useMemo(
    () => getNasaCloudTexturePath(domain.planetType),
    [domain.planetType]
  );
  const nasaCloudTexture = useLoader(
    THREE.TextureLoader,
    nasaCloudPath || nasaTexturePath // fallback to surface (won't be used)
  );

  // Subtle domain-color tint so same-type planets look unique
  const surfaceTint = useMemo(() => {
    const base = new THREE.Color(domain.color);
    // Lerp towards white to keep it subtle — just enough to distinguish domains
    return base.lerp(new THREE.Color('#ffffff'), 0.65);
  }, [domain.color]);

  const planetMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: surfaceTint,
        map: nasaSurfaceTexture,
        bumpMap: maps.bumpMap,
        bumpScale: 0.62 + visuals.surfaceDetail * 0.95,
        roughnessMap: maps.roughnessMap,
        roughness:
          progress.stage === 'discovered'
            ? 0.92
            : Math.max(0.22, 0.74 - visuals.surfaceDetail * 0.4),
        metalness: 0.015 + visuals.developmentLevel * 0.03,
        clearcoat:
          progress.stage === 'discovered'
            ? 0.02
            : 0.09 + visuals.developmentLevel * 0.34,
        clearcoatRoughness:
          progress.stage === 'discovered'
            ? 0.85
            : 0.48 - visuals.developmentLevel * 0.14,
        emissiveMap: nasaNightPath ? nasaNightTexture : maps.nightMap,
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: 0.018,
        envMapIntensity: 0.26 + visuals.developmentLevel * 0.34,
        sheen: 0.12 + visuals.developmentLevel * 0.26,
        sheenRoughness: 0.72,
        sheenColor: new THREE.Color(domain.color).multiplyScalar(0.5),
        iridescence: visuals.developmentLevel * 0.15,
        iridescenceIOR: 1.3,
      }),
    [
      domain.color,
      surfaceTint,
      maps.bumpMap,
      maps.nightMap,
      maps.roughnessMap,
      nasaSurfaceTexture,
      nasaNightTexture,
      nasaNightPath,
      progress.stage,
      visuals.developmentLevel,
      visuals.surfaceDetail,
    ]
  );

  const cloudMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: nasaCloudPath ? nasaCloudTexture : maps.cloudMap,
        alphaMap: nasaCloudPath ? nasaCloudTexture : maps.cloudMap,
        color: getCloudTint(domain.planetType),
        transparent: true,
        opacity: visuals.cloudOpacity,
        depthWrite: false,
        roughness: 0.68,
        metalness: 0.02,
        clearcoat: 0.12,
      }),
    [domain.planetType, maps.cloudMap, nasaCloudTexture, nasaCloudPath, visuals.cloudOpacity]
  );

  const atmosphereMaterial = useMemo(
    () => createAtmosphereShellMaterial(domain.color, visuals.atmosphereOpacity, 2.25, 1.05),
    [domain.color, visuals.atmosphereOpacity]
  );

  const planetGlowTexture = useMemo(() => createPlanetGlowTexture(domain.color), [domain.color]);

  const planetGlowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: planetGlowTexture,
        transparent: true,
        opacity: visuals.auraOpacity * 1.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [planetGlowTexture, visuals.auraOpacity]
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

  // Life particles disabled - too noisy for a clean space aesthetic
  const activeLifeParticles = 0;
  const shouldShowIslands = isFocused && (cameraMode === 'focus' || cameraMode === 'detail');
  const visibleIslands = useMemo(
    () => (shouldShowIslands ? islands.slice(0, 20) : []),
    [islands, shouldShowIslands]
  );
  // Topic moons only unlock with planet evolution (stage/level gating from mapper),
  // never directly from early topic count alone.
  const topicMoonCount = Math.min(
    MAX_TOPIC_MOONS,
    Math.min(visuals.stageMoonCount, Math.max(0, (progress.topicsExplored || 0) - 1))
  );
  const topicMoonSeeds = useMemo(
    () =>
      Array.from({ length: topicMoonCount }, (_, index) => {
        const phase = ((orbitConfig.seed + index * 53) % 628) / 100;
        const offset = ((orbitConfig.seed + index * 73) % 100) / 100;
        return { phase, offset };
      }),
    [orbitConfig.seed, topicMoonCount]
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
    if (feedbackPulseNonce > 0) {
      feedbackPulseRef.current = 1;
    }
  }, [feedbackPulseNonce]);

  useEffect(() => {
    return () => {
      planetMaterial.dispose();
      cloudMaterial.dispose();
      atmosphereMaterial.dispose();
      planetGlowMaterial.dispose();
      planetGlowTexture.dispose();
    };
  }, [atmosphereMaterial, planetGlowMaterial, planetGlowTexture, cloudMaterial, planetMaterial]);

  const baseRadius = 0.52;
  // Keep geometry resolution stable to avoid focus <-> detail hitching.
  const planetSegments = 96;
  const cloudSegments = 72;
  const atmosphereSegments = 128;

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    feedbackPulseRef.current = Math.max(0, feedbackPulseRef.current - delta * 1.2);
    const feedbackPulse = feedbackPulseRef.current;

    if (!isFocused) {
      const angle = domain.startAngle + t * domain.orbitSpeed;
      const orbitPosition = getOrbitPosition(angle, domain.orbitRadius, orbitConfig);
      groupRef.current.position.set(
        orbitPosition[0],
        orbitPosition[1],
        orbitPosition[2]
      );
    }

    if (onPositionUpdate) {
      const p = groupRef.current.position;
      onPositionUpdate(domain.id, [p.x, p.y, p.z]);
    }

    if (planetRef.current) {
      planetRef.current.rotation.y += 0.002 + visuals.developmentLevel * 0.0014;
      planetRef.current.rotation.x += 0.00045;

      if (islandAnchorRef.current) {
        islandAnchorRef.current.rotation.copy(planetRef.current.rotation);
      }
    }

    if (cloudRef.current) {
      // Dynamic cloud drift: slightly different rotation speeds than planet
      cloudRef.current.rotation.y += 0.0022;
      cloudRef.current.rotation.z += 0.0007;
      cloudRef.current.rotation.x += Math.sin(t * 0.1) * 0.0002; // Tiny wobble
    }

    if (auraRef.current) {
      const stableFactor = 0.28 + visuals.orbitStability * 0.72;
      const glowPulse = 1 + Math.sin(t * (0.4 + stableFactor * 0.45) + orbitConfig.phase) * 0.035;
      auraRef.current.scale.setScalar(glowPulse + feedbackPulse * 0.08);
      const mat = auraRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity =
        visuals.auraOpacity *
        1.42 *
        (0.9 + Math.sin(t * (0.7 + stableFactor)) * 0.05 + feedbackPulse * 0.22);
    }

    if (atmosphereRef.current) {
      const atmosphereShader = atmosphereRef.current.material as THREE.ShaderMaterial;
      atmosphereShader.uniforms.uOpacity.value = visuals.atmosphereOpacity;
      atmosphereShader.uniforms.uSunPos.value.set(0, 0, 0);
    }

    if (selectionHaloRef.current) {
      const haloVisible = isFocused || feedbackPulse > 0.02;
      selectionHaloRef.current.visible = haloVisible;
      if (haloVisible) {
        const pulse = 1 + Math.sin(t * 2.1) * 0.03 + feedbackPulse * 0.22;
        selectionHaloRef.current.scale.setScalar(pulse);
        const haloMaterial = selectionHaloRef.current.material as THREE.MeshBasicMaterial;
        haloMaterial.opacity = isFocused
          ? 0.72 + feedbackPulse * 0.2
          : 0.2 + feedbackPulse * 0.5;
      }
    }

    // 🌍 Physics Update: Kepler-inspired orbital speeds (1/sqrt(radius))
    // Farther objects move slower, creating a realistic celestial rhythm

    topicMoonRefs.current.forEach((moon, index) => {
      if (!moon || index >= topicMoonCount) return;
      const seed = topicMoonSeeds[index];
      const planetRadius = baseRadius * visuals.scale;
      // Wide orbit: clearly separated from atmosphere and ring zone
      const radius = planetRadius * (26.0 + index * 3.5);

      // Keplerian speed: slower for outer orbits
      const keplerSpeed = 0.52 / Math.sqrt(radius);
      const angle = t * keplerSpeed * (0.8 + seed.offset * 0.45) + seed.phase;

      // Elliptical touch: slight X/Z variation
      const ecc = 1.0 + (seed.offset - 0.5) * 0.12;
      moon.position.x = Math.cos(angle) * radius * ecc;
      moon.position.z = Math.sin(angle) * radius;
      moon.position.y = Math.sin(angle * 0.75 + seed.phase) * (planetRadius * 0.85);
      moon.rotation.y += 0.008;
    });

    satelliteRefs.current.forEach((satellite, index) => {
      if (!satellite) return;
      if ((progress.topicsExplored || 0) < 1) {
        satellite.visible = false;
        return;
      }
      satellite.visible = true;
      const planetRadius = baseRadius * visuals.scale;
      // Deep space probe distance: far beyond any moon/ring zone
      const radius = planetRadius * (50.0 + index * 5.0);

      // Far satellites move very slow (realism)
      const keplerSpeed = 0.46 / Math.sqrt(radius);
      const angle = t * keplerSpeed * (0.7 + index * 0.12) + index * 1.37;

      const eccScale = 1.0 + (index % 3 === 0 ? 0.15 : 0.05);
      satellite.position.x = Math.cos(angle) * radius * eccScale;
      satellite.position.z = Math.sin(angle) * radius;
      satellite.position.y = Math.sin(angle * 0.42) * (planetRadius * (1.2 + index * 0.45));
      // Satellites tilt towards their flight path
      satellite.lookAt(0, 0, 0);
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

    const shouldExpandLabel = cameraMode === 'system';
    if (shouldExpandLabel !== labelExpanded) {
      setLabelExpanded(shouldExpandLabel);
    }
  });

  return (
    <group ref={groupRef} position={initialPosition}>
      {/* 🌏 Planet Group with axial tilt (Obliquity) */}
      <group rotation={getPlanetObliquity(domain.id)}>
        <Sphere
          ref={planetRef}
          args={[baseRadius * visuals.scale, planetSegments, planetSegments]}
          material={planetMaterial}
          onClick={handleClick}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto';
          }}
        >
        </Sphere>

        <Sphere
          ref={cloudRef}
          args={[baseRadius * visuals.scale * 1.03, cloudSegments, cloudSegments]}
          material={cloudMaterial}
        />

        <Sphere
          ref={atmosphereRef}
          args={[baseRadius * visuals.scale * 1.12, atmosphereSegments, cloudSegments]}
          material={atmosphereMaterial}
        />
      </group>

      {/* Soft billboard glow behind planet */}
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <mesh ref={auraRef} material={planetGlowMaterial}>
          <planeGeometry args={[baseRadius * visuals.scale * 4.5, baseRadius * visuals.scale * 4.5]} />
        </mesh>
      </Billboard>

      {/* Planet rings gated behind mastery level 3+ - off by default */}



      {/* Topic Moons: Faceted asteroid-like rocks with glowing orbital ring */}
      {Array.from({ length: topicMoonCount }).map((_, index) => {
        const moonSize = 0.042 + index * 0.005;
        const moonSeed = orbitConfig.seed + index * 137;
        // Unique irregular scale per moon so no two look the same
        const sx = 1.0 + ((moonSeed % 18) - 9) * 0.04;
        const sy = 1.0 + (((moonSeed >> 3) % 18) - 9) * 0.05;
        const sz = 1.0 + (((moonSeed >> 6) % 18) - 9) * 0.04;
        // Rocky tint: slight warm/cool variation
        const warm = moonSeed % 3 === 0;
        const moonColor = warm ? '#c8b89a' : '#9eaab8';
        const ringTilt = (moonSeed % 6) * (Math.PI / 6); // unique tilt per moon
        return (
          <group
            key={`topic_moon_${index}`}
            ref={(node) => { topicMoonRefs.current[index] = node as unknown as THREE.Group; }}
          >
            {/* Faceted rocky body — IcosahedronGeometry looks like a real asteroid */}
            <mesh scale={[moonSize * sx, moonSize * sy, moonSize * sz]}>
              <icosahedronGeometry args={[1, 1]} />
              <meshPhysicalMaterial
                color={moonColor}
                roughness={0.88}
                metalness={0.08}
                bumpMap={maps.bumpMap}
                bumpScale={0.3}
                clearcoat={0.05}
                clearcoatRoughness={0.95}
                flatShading
              />
            </mesh>

            {/* Glowing orbital ring in domain color */}
            <mesh rotation={[Math.PI / 2 + ringTilt * 0.4, ringTilt, 0]}>
              <ringGeometry args={[moonSize * 1.55, moonSize * 1.72, 48]} />
              <meshBasicMaterial
                color={domain.color}
                transparent
                opacity={0.55}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Soft outer glow */}
            <Sphere args={[moonSize * 1.6, 8, 8]}>
              <meshBasicMaterial
                color={domain.color}
                transparent
                opacity={0.07}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                side={THREE.BackSide}
              />
            </Sphere>
          </group>
        );
      })}

      {/* Satellites: Detailed space probes with dish, antenna, thrusters */}
      {Array.from({ length: visuals.satelliteCount }).map((_, index) => {
        const satSeed = orbitConfig.seed + index * 211;
        const accentColor = index % 2 === 0 ? '#ff6b35' : '#00d4ff';
        return (
          <group
            key={`sat_main_${index}`}
            ref={(node) => { satelliteRefs.current[index] = node as unknown as THREE.Group; }}
          >
            <group scale={0.014}>
              {/* Main bus (octagonal body) */}
              <mesh>
                <cylinderGeometry args={[0.5, 0.6, 1.4, 8]} />
                <meshPhysicalMaterial color="#b8c0cc" metalness={0.85} roughness={0.2} clearcoat={0.3} />
              </mesh>

              {/* Solar panel left */}
              <group position={[1.8, 0, 0]}>
                <mesh>
                  <boxGeometry args={[2.2, 0.03, 0.9]} />
                  <meshPhysicalMaterial
                    color="#0a1628"
                    emissive="#1a3a6a"
                    emissiveIntensity={0.6}
                    metalness={0.7}
                    roughness={0.15}
                    clearcoat={0.8}
                  />
                </mesh>
                {/* Panel grid lines */}
                <mesh position={[0, 0.02, 0]}>
                  <boxGeometry args={[2.2, 0.005, 0.9]} />
                  <meshBasicMaterial color="#2a5a9a" transparent opacity={0.3} />
                </mesh>
              </group>

              {/* Solar panel right */}
              <group position={[-1.8, 0, 0]}>
                <mesh>
                  <boxGeometry args={[2.2, 0.03, 0.9]} />
                  <meshPhysicalMaterial
                    color="#0a1628"
                    emissive="#1a3a6a"
                    emissiveIntensity={0.6}
                    metalness={0.7}
                    roughness={0.15}
                    clearcoat={0.8}
                  />
                </mesh>
                <mesh position={[0, 0.02, 0]}>
                  <boxGeometry args={[2.2, 0.005, 0.9]} />
                  <meshBasicMaterial color="#2a5a9a" transparent opacity={0.3} />
                </mesh>
              </group>

              {/* Panel arm connectors */}
              <mesh position={[0.65, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.04, 0.04, 0.3, 6]} />
                <meshStandardMaterial color="#8a8a8a" metalness={0.9} roughness={0.3} />
              </mesh>
              <mesh position={[-0.65, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.04, 0.04, 0.3, 6]} />
                <meshStandardMaterial color="#8a8a8a" metalness={0.9} roughness={0.3} />
              </mesh>

              {/* Communication dish */}
              <group position={[0, 0.85, 0.2]} rotation={[0.4, 0, 0]}>
                <mesh>
                  <sphereGeometry args={[0.4, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
                  <meshPhysicalMaterial
                    color="#d4d4d4"
                    metalness={0.9}
                    roughness={0.1}
                    side={THREE.DoubleSide}
                    clearcoat={0.5}
                  />
                </mesh>
                {/* Dish feed horn */}
                <mesh position={[0, 0.3, 0]}>
                  <cylinderGeometry args={[0.02, 0.03, 0.35, 6]} />
                  <meshStandardMaterial color="#888" metalness={0.9} roughness={0.2} />
                </mesh>
              </group>

              {/* Antenna mast */}
              <mesh position={[0.3, 0.9, -0.2]}>
                <cylinderGeometry args={[0.015, 0.015, 0.8, 4]} />
                <meshStandardMaterial color="#aaa" metalness={0.8} roughness={0.3} />
              </mesh>
              {/* Antenna tip beacon */}
              <mesh position={[0.3, 1.3, -0.2]}>
                <sphereGeometry args={[0.04, 8, 8]} />
                <meshBasicMaterial color={accentColor} />
              </mesh>

              {/* Thruster nozzles */}
              {(satSeed % 2 === 0) && (
                <group position={[0, -0.75, 0]}>
                  <mesh position={[0.2, 0, 0.2]}>
                    <coneGeometry args={[0.08, 0.16, 6]} />
                    <meshPhysicalMaterial color="#666" metalness={0.9} roughness={0.15} />
                  </mesh>
                  <mesh position={[-0.2, 0, 0.2]}>
                    <coneGeometry args={[0.08, 0.16, 6]} />
                    <meshPhysicalMaterial color="#666" metalness={0.9} roughness={0.15} />
                  </mesh>
                  <mesh position={[0, 0, -0.2]}>
                    <coneGeometry args={[0.08, 0.16, 6]} />
                    <meshPhysicalMaterial color="#666" metalness={0.9} roughness={0.15} />
                  </mesh>
                </group>
              )}

              {/* Gold foil insulation band */}
              <mesh position={[0, -0.35, 0]}>
                <cylinderGeometry args={[0.62, 0.62, 0.2, 8]} />
                <meshPhysicalMaterial
                  color="#c8a832"
                  metalness={0.6}
                  roughness={0.35}
                  clearcoat={0.4}
                />
              </mesh>
            </group>
          </group>
        );
      })}

      {/* Life particles (if enabled) */}
      {activeLifeParticles > 0 && Array.from({ length: activeLifeParticles }).map((_, index) => (
        <Sphere
          key={`life_${index}`}
          ref={(node) => {
            lifeParticleRefs.current[index] = node as unknown as THREE.Mesh;
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

      <group ref={islandAnchorRef}>
        {visibleIslands.map((topic, index) => {
          const topicOrbitRadius =
            cameraMode === 'detail'
              ? baseRadius * visuals.scale * 2.45
              : baseRadius * visuals.scale * 3.2;
          const pos = latLonToPlanetPosition(
            topic.lat,
            topic.lon,
            // Keep topic markers clearly separated while still visible in detail view.
            topicOrbitRadius
          );
          const isSelected = selectedTopicId === topic.topicId;
          const stage = topic.stage;

          const markerColor =
            stage === 'retained'
              ? '#f59e0b'
              : stage === 'apply'
                ? '#22c55e'
                : stage === 'understood'
                  ? '#60a5fa'
                  : '#a3a3a3';

          const markerSize =
            stage === 'retained'
              ? 0.048
              : stage === 'apply'
                ? 0.044
                : stage === 'understood'
                  ? 0.04
                  : 0.036;

          return (
            <group
              key={`island_${topic.topicId}_${index}`}
              position={[pos.x, pos.y, pos.z]}
              onClick={(event) => {
                event.stopPropagation();
                onSelectIsland?.(topic);
              }}
              onPointerOver={(event) => {
                event.stopPropagation();
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'auto';
              }}
            >
              {/* Outer soft aura for the island marker using a glowing sphere instead of billboard plane */}
              <Sphere args={[markerSize * 1.8, 16, 16]}>
                <meshBasicMaterial
                  color={markerColor}
                  transparent
                  opacity={0.12}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                />
              </Sphere>

              <Sphere args={[markerSize * 0.8, 16, 16]}>
                <meshStandardMaterial
                  color="#ffffff"
                  emissive={markerColor}
                  emissiveIntensity={stage === 'discovered' ? 0.3 : 1.2}
                  roughness={0.2}
                  metalness={0.9}
                />
              </Sphere>

              {/* Glowing core/crystal representation */}
              <Sphere args={[markerSize * 1.1, 16, 16]}>
                <meshPhysicalMaterial
                  color={markerColor}
                  transparent
                  opacity={0.6}
                  roughness={0.1}
                  transmission={0.9} // Glassy effect
                  thickness={0.5}
                />
              </Sphere>

              {/* Mastery ring wrapping around the sphere */}
              {stage === 'retained' && (
                <Billboard follow>
                  <mesh>
                    <ringGeometry args={[markerSize * 1.5, markerSize * 1.7, 32]} />
                    <meshBasicMaterial
                      color="#fde68a"
                      transparent
                      opacity={0.9}
                      blending={THREE.AdditiveBlending}
                      depthWrite={false}
                      side={THREE.DoubleSide}
                    />
                  </mesh>
                </Billboard>
              )}

              {/* Selection ring cleanly encircling the entire marker */}
              {isSelected && (
                <Billboard follow>
                  <mesh>
                    <ringGeometry args={[markerSize * 1.8, markerSize * 2.1, 32]} />
                    <meshBasicMaterial
                      color="#ffffff"
                      transparent
                      opacity={0.95}
                      blending={THREE.AdditiveBlending}
                      depthWrite={false}
                      side={THREE.DoubleSide}
                    />
                  </mesh>
                </Billboard>
              )}
            </group>
          );
        })}
      </group>

      <Html
        position={[0, baseRadius * visuals.scale + 0.6, 0]}
        center
        distanceFactor={14}
        zIndexRange={[6, 0]}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 1,
          opacity: cameraMode === 'system' && labelExpanded ? 1 : 0,
          transition: 'opacity 0.22s ease',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          {/* Replaced raw emoji with elegant label box */}
          {cameraMode === 'system' && (
            <div className="flex flex-col items-center bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: 'white',
                  textShadow: '0 1px 4px rgba(0,0,0,0.85)',
                  whiteSpace: 'nowrap',
                  fontFamily: '"Nunito", sans-serif',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}
              >
                {domain.label}
              </span>

            </div>
          )}
        </div>
      </Html>
    </group >
  );
};

function createPlanetMaps(
  baseHex: string,
  seed: number,
  planetType: CosmosDomain['planetType'],
  detailFactor: number,
  textureSize: number
): {
  surfaceMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  cloudMap: THREE.CanvasTexture;
  nightMap: THREE.CanvasTexture;
} {
  const profile = getPlanetTypeProfile(planetType);
  const size = textureSize;
  const surfaceCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  const cloudCanvas = document.createElement('canvas');
  surfaceCanvas.width = surfaceCanvas.height = size;
  bumpCanvas.width = bumpCanvas.height = size;
  roughCanvas.width = roughCanvas.height = size;
  cloudCanvas.width = cloudCanvas.height = size;
  const nightCanvas = document.createElement('canvas');
  nightCanvas.width = nightCanvas.height = size;

  const surfaceCtx = surfaceCanvas.getContext('2d');
  const bumpCtx = bumpCanvas.getContext('2d');
  const roughCtx = roughCanvas.getContext('2d');
  const cloudCtx = cloudCanvas.getContext('2d');
  const nightCtx = nightCanvas.getContext('2d');
  if (!surfaceCtx || !bumpCtx || !roughCtx || !cloudCtx || !nightCtx) {
    throw new Error('Could not create 2D canvas context for planet maps');
  }

  const surfaceData = surfaceCtx.createImageData(size, size);
  const bumpData = bumpCtx.createImageData(size, size);
  const roughData = roughCtx.createImageData(size, size);
  const cloudData = cloudCtx.createImageData(size, size);
  const nightData = nightCtx.createImageData(size, size);

  const baseColor = new THREE.Color(baseHex);
  const baseR = Math.floor(baseColor.r * 255);
  const baseG = Math.floor(baseColor.g * 255);
  const baseB = Math.floor(baseColor.b * 255);
  const biomePalette = getBiomePalette(planetType, baseColor);

  const hasContinents = planetType === 'terrestrial' || planetType === 'lush' || planetType === 'oceanic';
  const TWO_PI = Math.PI * 2;

  for (let y = 0; y < size; y += 1) {
    // UV → spherical coordinates (seamless, no equator seam)
    const ny = y / size;
    const phi = ny * Math.PI; // 0 = north pole, PI = south pole
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const latitude = Math.abs(ny * 2 - 1);
    const climateBand = 1 - smoothstep(0.68, 0.98, latitude);

    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const nx = x / size;
      const theta = nx * TWO_PI; // 0 → 2PI longitude

      // 3D point on unit sphere — all noise sampled here, no UV seams
      const sx = Math.cos(theta) * sinPhi;
      const sy = cosPhi;
      const sz = Math.sin(theta) * sinPhi;

      // Terrain noise in 3D (seamless)
      const bs = profile.baseScale;
      const rs = profile.ridgeScale;
      const n1 = fbm3D(sx * bs, sy * bs, sz * bs, seed, 6);
      const n2 = fbm3D(sx * rs, sy * rs, sz * rs, seed + 71, 4);
      const micro = fbm3D(sx * 32, sy * 32, sz * 32, seed + 911, 2);
      const ridge = Math.pow(Math.abs(0.5 - n2) * 2.0, profile.ridgePower);

      const altitude = clamp01((n1 * profile.heightWeight + ridge * profile.ridgeWeight) * 1.4 - 0.2);

      // Continental plates (3D seamless)
      const tectonicNoise = fbm3D(sx * 2.6, sy * 2.6, sz * 2.6, seed + 219, 5);
      const archipelagoNoise = fbm3D(sx * 5.5, sy * 5.5, sz * 5.5, seed + 577, 4);
      const coastDetailNoise = fbm3D(sx * 12, sy * 12, sz * 12, seed + 743, 3);
      const continentalSignal = tectonicNoise * 0.58 + archipelagoNoise * 0.28 + coastDetailNoise * 0.14;
      const continentalBase = smoothstep(0.42, 0.62, continentalSignal + (altitude - 0.5) * 0.18);
      const erosionNoise = fbm3D(sx * 8.5, sy * 8.5, sz * 8.5, seed + 887, 3);
      const erosionCut = smoothstep(0.42, 0.78, erosionNoise);
      const regionMask = hasContinents
        ? clamp01(continentalBase - erosionCut * 0.24 + (0.48 - latitude) * 0.06)
        : 0;

      const gasBand = planetType === 'gaseous' ? (Math.sin((ny * 42 + n1 * 8) * Math.PI) * 0.5 + 0.5) * (0.28 + n2 * 0.35) : 0;
      const lavaCrack = planetType === 'volcanic' ? smoothstep(0.62, 0.92, n2) : 0;
      const mountainMask = hasContinents
        ? regionMask * smoothstep(0.48, 0.82, altitude + ridge * 0.28 + micro * 0.08)
        : 0;
      const oceanMask = hasContinents ? clamp01(1 - regionMask) : 0;
      const shallowOceanMask = hasContinents
        ? clamp01(oceanMask * smoothstep(0.18, 0.58, 1 - altitude + ridge * 0.12))
        : 0;
      const deepOceanMask = hasContinents
        ? clamp01(oceanMask * smoothstep(0.32, 0.72, 1 - altitude + ridge * 0.22))
        : 0;
      const landMask = hasContinents ? clamp01(regionMask - mountainMask * 0.56) : 0;
      const coastMask = hasContinents
        ? clamp01(
            smoothstep(0.22, 0.52, 1 - Math.abs(regionMask - 0.5) * 2) *
            (0.52 + (1 - altitude) * 0.38)
          )
        : 0;

      const shade = profile.shadeMin + altitude * profile.shadeRange;
      const tint = profile.tintBase + n2 * profile.tintRange;
      const structureBoost = 0.74 + altitude * 0.82 + ridge * 0.18;

      if (hasContinents) {
        const weightSum = Math.max(
          0.0001,
          deepOceanMask + shallowOceanMask + landMask + mountainMask + coastMask * 0.42
        );
        const rBiome =
          (biomePalette.oceanDeep[0] * deepOceanMask +
            biomePalette.oceanShallow[0] * shallowOceanMask +
            biomePalette.land[0] * landMask +
            biomePalette.mountain[0] * mountainMask +
            biomePalette.coast[0] * coastMask * 0.42) /
          weightSum;
        const gBiome =
          (biomePalette.oceanDeep[1] * deepOceanMask +
            biomePalette.oceanShallow[1] * shallowOceanMask +
            biomePalette.land[1] * landMask +
            biomePalette.mountain[1] * mountainMask +
            biomePalette.coast[1] * coastMask * 0.42) /
          weightSum;
        const bBiome =
          (biomePalette.oceanDeep[2] * deepOceanMask +
            biomePalette.oceanShallow[2] * shallowOceanMask +
            biomePalette.land[2] * landMask +
            biomePalette.mountain[2] * mountainMask +
            biomePalette.coast[2] * coastMask * 0.42) /
          weightSum;
        const oceanContrast = 0.84 + deepOceanMask * 0.24 + shallowOceanMask * 0.14;
        const landContrast = 0.92 + landMask * 0.2 + coastMask * 0.18 + climateBand * 0.06;
        const mountainContrast = 1 + mountainMask * 0.35;
        const terrainContrast =
          0.9 +
          (oceanContrast * oceanMask + landContrast * landMask + mountainContrast * mountainMask + coastMask * 0.3) *
            0.45;

        surfaceData.data[i] = clamp255(rBiome * shade * tint * structureBoost * terrainContrast);
        surfaceData.data[i + 1] = clamp255(
          gBiome *
            shade *
            (profile.greenShift + n1 * 0.11 - deepOceanMask * 0.16 + landMask * 0.06) *
            structureBoost *
            terrainContrast
        );
        surfaceData.data[i + 2] = clamp255(
          bBiome *
            shade *
            (profile.blueShift + ridge * 0.1 + deepOceanMask * 0.38 + shallowOceanMask * 0.2) *
            structureBoost *
            terrainContrast
        );
      } else {
        surfaceData.data[i] = clamp255(baseR * shade * tint * profile.redShift * structureBoost);
        surfaceData.data[i + 1] = clamp255(baseG * shade * (profile.greenShift + n1 * 0.15) * structureBoost);
        surfaceData.data[i + 2] = clamp255(baseB * shade * (profile.blueShift + ridge * 0.15) * structureBoost);
      }
      surfaceData.data[i + 3] = 255;

      const terrainHeight = clamp01(
        altitude * 0.58 +
          mountainMask * 0.72 +
          ridge * 0.22 -
          deepOceanMask * 0.24 +
          coastMask * 0.08
      );
      const bump = clamp255(terrainHeight * 255);
      bumpData.data[i] = bump;
      bumpData.data[i + 1] = bump;
      bumpData.data[i + 2] = bump;
      bumpData.data[i + 3] = 255;

      const rough = clamp255(
        (
          profile.roughnessBase +
          ridge * 0.52 +
          n1 * 0.16 +
          micro * 0.1 -
          regionMask * 0.12 -
          gasBand * 0.12 +
          mountainMask * 0.12 -
          deepOceanMask * 0.24
        ) * 255
      );
      roughData.data[i] = rough;
      roughData.data[i + 1] = rough;
      roughData.data[i + 2] = rough;
      roughData.data[i + 3] = 255;

      // Clouds also seamless in 3D
      const cs = profile.cloudScale;
      const cloudNoise = fbm3D(sx * cs, sy * cs, sz * cs, seed + 133, 5);
      const cloudSwirl = fbm3D(sx * cs * 1.8, sy * cs * 1.8, sz * cs * 1.8, seed + 337, 3);
      const cloudAlpha = clamp255(Math.max(0, cloudNoise + cloudSwirl * 0.2 - profile.cloudThreshold) * profile.cloudGain);
      cloudData.data[i] = 255;
      cloudData.data[i + 1] = 255;
      cloudData.data[i + 2] = 255;
      cloudData.data[i + 3] = cloudAlpha;

      // Night-side lights
      let rN = 0, gN = 0, bN = 0;
      if (hasContinents) {
        const cityNoise = fbm3D(sx * 18.2, sy * 18.2, sz * 18.2, seed + 888, 3);
        if (regionMask > 0.4 && cityNoise > 0.65 && altitude < 0.65 && detailFactor > 0.05) {
          const glow = Math.pow((cityNoise - 0.65) * 2.8, 2.0) * 255 * Math.min(1.0, detailFactor * 2.2);
          rN = glow * 0.98; gN = glow * 0.94; bN = glow * 1.0;
        }
      } else if (planetType === 'volcanic' && lavaCrack > 0) {
        const lava = lavaCrack * 220;
        rN = lava; gN = lava * 0.28; bN = lava * 0.04;
      } else if (planetType === 'crystalline' && ridge > 0.6) {
        const crystal = ridge * 100 * detailFactor;
        rN = crystal * 0.4; gN = crystal * 0.8; bN = crystal;
      }
      nightData.data[i] = clamp255(rN);
      nightData.data[i + 1] = clamp255(gN);
      nightData.data[i + 2] = clamp255(bN);
      nightData.data[i + 3] = 255;
    }
  }

  surfaceCtx.putImageData(surfaceData, 0, 0);
  bumpCtx.putImageData(bumpData, 0, 0);
  roughCtx.putImageData(roughData, 0, 0);
  cloudCtx.putImageData(cloudData, 0, 0);
  nightCtx.putImageData(nightData, 0, 0);

  const surfaceMap = new THREE.CanvasTexture(surfaceCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  const cloudMap = new THREE.CanvasTexture(cloudCanvas);
  const nightMap = new THREE.CanvasTexture(nightCanvas);

  [surfaceMap, bumpMap, roughnessMap, cloudMap, nightMap].forEach((texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
  });
  surfaceMap.colorSpace = THREE.SRGBColorSpace;
  nightMap.colorSpace = THREE.SRGBColorSpace;

  return { surfaceMap, bumpMap, roughnessMap, cloudMap, nightMap };
}

interface PlanetTypeProfile {
  baseScale: number;
  ridgeScale: number;
  ridgePower: number;
  heightWeight: number;
  ridgeWeight: number;
  shadeMin: number;
  shadeRange: number;
  tintBase: number;
  tintRange: number;
  redShift: number;
  greenShift: number;
  blueShift: number;
  roughnessBase: number;
  cloudScale: number;
  cloudThreshold: number;
  cloudGain: number;
}

type BiomePalette = {
  oceanDeep: [number, number, number];
  oceanShallow: [number, number, number];
  land: [number, number, number];
  mountain: [number, number, number];
  coast: [number, number, number];
};

function getBiomePalette(
  planetType: CosmosDomain['planetType'],
  baseColor: THREE.Color
): BiomePalette {
  if (planetType === 'lush') {
    return {
      oceanDeep: [18, 72, 142],
      oceanShallow: [46, 130, 188],
      land: [52, 146, 72],
      mountain: [132, 150, 120],
      coast: [208, 198, 140],
    };
  }
  if (planetType === 'oceanic') {
    return {
      oceanDeep: [12, 64, 130],
      oceanShallow: [62, 154, 214],
      land: [72, 150, 108],
      mountain: [150, 168, 154],
      coast: [220, 206, 162],
    };
  }
  if (planetType === 'terrestrial') {
    return {
      oceanDeep: [16, 64, 128],
      oceanShallow: [62, 138, 196],
      land: [114, 146, 90],
      mountain: [146, 138, 128],
      coast: [216, 198, 154],
    };
  }

  const baseR = Math.round(baseColor.r * 255);
  const baseG = Math.round(baseColor.g * 255);
  const baseB = Math.round(baseColor.b * 255);
  return {
    oceanDeep: [Math.max(0, baseR - 68), Math.max(0, baseG - 50), Math.min(255, baseB + 48)],
    oceanShallow: [Math.max(0, baseR - 32), Math.max(0, baseG - 22), Math.min(255, baseB + 36)],
    land: [baseR, baseG, baseB],
    mountain: [Math.min(255, baseR + 38), Math.min(255, baseG + 34), Math.min(255, baseB + 28)],
    coast: [Math.min(255, baseR + 74), Math.min(255, baseG + 62), Math.min(255, baseB + 36)],
  };
}

function getPlanetTypeProfile(type: CosmosDomain['planetType']): PlanetTypeProfile {
  switch (type) {
    case 'oceanic':
      return {
        baseScale: 3.8,
        ridgeScale: 9.5,
        ridgePower: 1.2,
        heightWeight: 0.74,
        ridgeWeight: 0.26,
        shadeMin: 0.58,
        shadeRange: 0.56,
        tintBase: 0.9,
        tintRange: 0.2,
        redShift: 0.9,
        greenShift: 0.9,
        blueShift: 1.12,
        roughnessBase: 0.22,
        cloudScale: 5.4,
        cloudThreshold: 0.5,
        cloudGain: 680,
      };
    case 'icy':
      return {
        baseScale: 5.0,
        ridgeScale: 13.5,
        ridgePower: 1.34,
        heightWeight: 0.66,
        ridgeWeight: 0.34,
        shadeMin: 0.68,
        shadeRange: 0.5,
        tintBase: 0.98,
        tintRange: 0.13,
        redShift: 0.92,
        greenShift: 1.04,
        blueShift: 1.12,
        roughnessBase: 0.4,
        cloudScale: 7.0,
        cloudThreshold: 0.6,
        cloudGain: 460,
      };
    case 'lush':
      return {
        baseScale: 4.2,
        ridgeScale: 10.0,
        ridgePower: 1.0,
        heightWeight: 0.8,
        ridgeWeight: 0.2,
        shadeMin: 0.6,
        shadeRange: 0.56,
        tintBase: 0.84,
        tintRange: 0.24,
        redShift: 0.9,
        greenShift: 1.08,
        blueShift: 0.9,
        roughnessBase: 0.3,
        cloudScale: 6.0,
        cloudThreshold: 0.52,
        cloudGain: 640,
      };
    case 'desert':
      return {
        baseScale: 5.3,
        ridgeScale: 15.0,
        ridgePower: 1.4,
        heightWeight: 0.62,
        ridgeWeight: 0.38,
        shadeMin: 0.62,
        shadeRange: 0.48,
        tintBase: 0.93,
        tintRange: 0.16,
        redShift: 1.08,
        greenShift: 0.95,
        blueShift: 0.84,
        roughnessBase: 0.52,
        cloudScale: 5.0,
        cloudThreshold: 0.66,
        cloudGain: 380,
      };
    case 'volcanic':
      return {
        baseScale: 6.2,
        ridgeScale: 17.0,
        ridgePower: 1.56,
        heightWeight: 0.58,
        ridgeWeight: 0.42,
        shadeMin: 0.46,
        shadeRange: 0.64,
        tintBase: 0.86,
        tintRange: 0.23,
        redShift: 1.16,
        greenShift: 0.78,
        blueShift: 0.72,
        roughnessBase: 0.62,
        cloudScale: 4.2,
        cloudThreshold: 0.72,
        cloudGain: 320,
      };
    case 'gaseous':
      return {
        baseScale: 2.8,
        ridgeScale: 7.0,
        ridgePower: 0.9,
        heightWeight: 0.86,
        ridgeWeight: 0.14,
        shadeMin: 0.66,
        shadeRange: 0.42,
        tintBase: 0.95,
        tintRange: 0.18,
        redShift: 0.96,
        greenShift: 0.98,
        blueShift: 1.02,
        roughnessBase: 0.15,
        cloudScale: 3.8,
        cloudThreshold: 0.45,
        cloudGain: 720,
      };
    case 'crystalline':
      return {
        baseScale: 6.8,
        ridgeScale: 19.0,
        ridgePower: 1.7,
        heightWeight: 0.55,
        ridgeWeight: 0.45,
        shadeMin: 0.63,
        shadeRange: 0.52,
        tintBase: 0.98,
        tintRange: 0.2,
        redShift: 1.02,
        greenShift: 0.95,
        blueShift: 1.08,
        roughnessBase: 0.35,
        cloudScale: 7.5,
        cloudThreshold: 0.63,
        cloudGain: 460,
      };
    case 'terrestrial':
    default:
      return {
        baseScale: 4.5,
        ridgeScale: 11.0,
        ridgePower: 1.2,
        heightWeight: 0.76,
        ridgeWeight: 0.24,
        shadeMin: 0.62,
        shadeRange: 0.55,
        tintBase: 0.88,
        tintRange: 0.22,
        redShift: 1,
        greenShift: 0.92,
        blueShift: 0.9,
        roughnessBase: 0.32,
        cloudScale: 6.2,
        cloudThreshold: 0.55,
        cloudGain: 620,
      };
  }
}

function getCloudTint(type: CosmosDomain['planetType']): string {
  switch (type) {
    case 'volcanic':
      return '#f6d8c3';
    case 'desert':
      return '#f4e4d3';
    case 'icy':
      return '#eef6ff';
    case 'oceanic':
      return '#e4f2ff';
    case 'gaseous':
      return '#f7ecff';
    case 'crystalline':
      return '#efe8ff';
    case 'lush':
      return '#eaf7ef';
    case 'terrestrial':
    default:
      return '#eaf2ff';
  }
}

function createAtmosphereShellMaterial(
  color: THREE.ColorRepresentation,
  opacity: number,
  power: number,
  intensity: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uPower: { value: power },
      uIntensity: { value: intensity },
      uSunPos: { value: new THREE.Vector3(0, 0, 0) },
    },
    vertexShader: ATMOSPHERE_VERTEX,
    fragmentShader: ATMOSPHERE_FRAGMENT,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function createPlanetGlowTexture(color: string, size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const center = size / 2;

  const baseColor = new THREE.Color(color);
  const r = Math.round(baseColor.r * 255);
  const g = Math.round(baseColor.g * 255);
  const b = Math.round(baseColor.b * 255);

  const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.6)`);
  grad.addColorStop(0.15, `rgba(${r}, ${g}, ${b}, 0.35)`);
  grad.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.12)`);
  grad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.03)`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createRingTexture(color: string, seed: number, textureSize: number): THREE.CanvasTexture {
  const size = textureSize;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create 2D context for ring texture');
  }

  const base = new THREE.Color(color);
  const center = size * 0.5;
  const maxR = size * 0.5;
  const image = ctx.createImageData(size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - center;
      const dy = y - center;
      const radius = Math.sqrt(dx * dx + dy * dy) / maxR;
      const i = (y * size + x) * 4;

      if (radius < 0.36 || radius > 0.98) {
        image.data[i + 3] = 0;
        continue;
      }

      const stripeNoise = fbm2D(radius * 14 + 0.5, (Math.atan2(dy, dx) + Math.PI) * 0.8, seed + 211, 3);
      const bandNoise = fbm2D(radius * 25, radius * 3 + 1.2, seed + 377, 2);
      const edgeFade = smoothstep(0.36, 0.45, radius) * (1 - smoothstep(0.9, 0.98, radius));
      const alpha = clamp01(edgeFade * (0.34 + stripeNoise * 0.52 + bandNoise * 0.2));
      const brightness = 0.78 + stripeNoise * 0.38;

      image.data[i] = clamp255(base.r * 255 * brightness);
      image.data[i + 1] = clamp255(base.g * 255 * brightness);
      image.data[i + 2] = clamp255(base.b * 255 * (0.94 + bandNoise * 0.18));
      image.data[i + 3] = clamp255(alpha * 255);
    }
  }

  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
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

// Fast integer hash for grid corners
function hash2D(ix: number, iy: number, seed: number): number {
  const n = Math.sin(ix * 127.1 + iy * 311.7 + seed * 0.037) * 43758.5453123;
  return n - Math.floor(n);
}

// Interpolated value noise — produces smooth, coherent shapes (continents, mountains)
function noise2D(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  // Hermite smoothstep for C1-continuous interpolation
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  // Hash four grid corners
  const n00 = hash2D(ix, iy, seed);
  const n10 = hash2D(ix + 1, iy, seed);
  const n01 = hash2D(ix, iy + 1, seed);
  const n11 = hash2D(ix + 1, iy + 1, seed);

  // Bilinear interpolation
  const nx0 = n00 + sx * (n10 - n00);
  const nx1 = n01 + sx * (n11 - n01);
  return nx0 + sy * (nx1 - nx0);
}

// 3D hash for trilinear noise — avoids all UV seam issues
function hash3D(ix: number, iy: number, iz: number, seed: number): number {
  const n = Math.sin(ix * 127.1 + iy * 311.7 + iz * 74.7 + seed * 0.037) * 43758.5453123;
  return n - Math.floor(n);
}

// Trilinear interpolated 3D value noise — seamless on sphere surface
function noise3D(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;

  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const sz = fz * fz * (3 - 2 * fz);

  const n000 = hash3D(ix, iy, iz, seed);
  const n100 = hash3D(ix + 1, iy, iz, seed);
  const n010 = hash3D(ix, iy + 1, iz, seed);
  const n110 = hash3D(ix + 1, iy + 1, iz, seed);
  const n001 = hash3D(ix, iy, iz + 1, seed);
  const n101 = hash3D(ix + 1, iy, iz + 1, seed);
  const n011 = hash3D(ix, iy + 1, iz + 1, seed);
  const n111 = hash3D(ix + 1, iy + 1, iz + 1, seed);

  const nx00 = n000 + sx * (n100 - n000);
  const nx10 = n010 + sx * (n110 - n010);
  const nx01 = n001 + sx * (n101 - n001);
  const nx11 = n011 + sx * (n111 - n011);

  const nxy0 = nx00 + sy * (nx10 - nx00);
  const nxy1 = nx01 + sy * (nx11 - nx01);

  return nxy0 + sz * (nxy1 - nxy0);
}

// 3D FBM for seamless spherical sampling
function fbm3D(x: number, y: number, z: number, seed: number, octaves: number): number {
  let amplitude = 0.5;
  let frequency = 1;
  let value = 0;
  let max = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    value += noise3D(x * frequency, y * frequency, z * frequency, seed + octave * 31) * amplitude;
    max += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return max > 0 ? value / max : 0;
}

function clamp255(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(min: number, max: number, value: number): number {
  if (value <= min) return 0;
  if (value >= max) return 1;
  const t = (value - min) / (max - min);
  return t * t * (3 - 2 * t);
}

function getPlanetObliquity(domainId: string): [number, number, number] {
  const seed = hashString(`${domainId}:obliquity`);
  const tiltX = (((seed % 28) + 5) * Math.PI) / 180;
  const tiltZ = ((((seed >> 5) % 18) - 9) * Math.PI) / 180;
  return [tiltX, 0, tiltZ];
}

type OrbitConfig = {
  seed: number;
  inclination: number;
  eccentricity: number;
  phase: number;
};

function getOrbitPosition(
  angle: number,
  orbitRadius: number,
  orbitConfig: OrbitConfig
): [number, number, number] {
  const x = Math.cos(angle) * orbitRadius;
  const z = Math.sin(angle) * orbitRadius * orbitConfig.eccentricity;
  const y =
    Math.sin(angle + orbitConfig.phase) *
    orbitRadius *
    Math.sin(orbitConfig.inclination) *
    0.22;
  return [x, y, z];
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function latLonToPlanetPosition(lat: number, lon: number, radius: number): THREE.Vector3 {
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  const x = radius * Math.cos(latRad) * Math.cos(lonRad);
  const y = radius * Math.sin(latRad);
  const z = radius * Math.cos(latRad) * Math.sin(lonRad);
  return new THREE.Vector3(x, y, z);
}
