/**
 * CosmosPlanetDomain.tsx - High-fidelity domain planet
 *
 * Visuals evolve continuously with mastery/confidence:
 * - Procedural surface map and bump detail
 * - Dynamic cloud layer and aura
 * - Progressive ring intensity and satellite count
 * - Life-signal particles for advanced progression
 */

import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Sphere, Ring, Html, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import type { CosmosDomain, DomainProgress, TopicIsland } from './CosmosTypes';
import { mapProgressToVisuals } from './CosmosProgressMapper';

interface Props {
  domain: CosmosDomain;
  progress: DomainProgress;
  isFocused: boolean;
  isDetailMode?: boolean;
  islands?: TopicIsland[];
  selectedTopicId?: string | null;
  textureSize?: number;
  ringTextureSize?: number;
  feedbackPulseNonce?: number;
  onSelect: (domainId: string, focusPosition: [number, number, number]) => void;
  onSelectIsland?: (topic: TopicIsland) => void;
}

const MAX_LIFE_PARTICLES = 10;
const MAX_TOPIC_MOONS = 8;
type PlanetMapSet = {
  surfaceMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  cloudMap: THREE.CanvasTexture;
};

const PLANET_MAP_CACHE = new Map<string, PlanetMapSet>();
const RING_MAP_CACHE = new Map<string, THREE.CanvasTexture>();

function getCachedPlanetMaps(
  baseHex: string,
  seed: number,
  planetType: CosmosDomain['planetType'],
  detailFactor: number,
  textureSize: number
): PlanetMapSet {
  const quantizedDetail = Math.round(detailFactor * 4) / 4;
  const key = `${baseHex}|${seed}|${planetType}|${quantizedDetail}|${textureSize}`;
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
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ATMOSPHERE_FRAGMENT = `
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uPower;
  uniform float uIntensity;
  uniform vec3 uSunPos;
  void main() {
    vec3 n = normalize(vNormalW);
    vec3 viewDir = normalize(vViewDir);

    // Fresnel rim
    float NdotV = dot(n, viewDir);
    float fresnel = pow(1.0 - abs(NdotV), uPower);

    // Sun-side backlight (rim glow stronger on sun side)
    vec3 sunDir = normalize(uSunPos - vWorldPos);
    float sunAlignment = max(0.0, dot(n, sunDir));
    float backlight = pow(1.0 - abs(NdotV), 3.0) * sunAlignment * 0.6;

    // Smooth alpha with no hard edge
    float rim = smoothstep(0.0, 0.85, fresnel);
    float alpha = (rim + backlight) * uOpacity;
    alpha = smoothstep(0.0, 1.0, alpha);

    // Color with warm sun-side tint
    vec3 warmTint = mix(uColor, vec3(1.0, 0.85, 0.65), backlight * 0.4);
    vec3 color = warmTint * (0.5 + fresnel * uIntensity + backlight * 0.8);

    gl_FragColor = vec4(color, alpha);
  }
`;

export const CosmosPlanetDomain: React.FC<Props> = ({
  domain,
  progress,
  isFocused,
  isDetailMode = false,
  islands = [],
  selectedTopicId = null,
  textureSize = 512,
  ringTextureSize = 512,
  feedbackPulseNonce = 0,
  onSelect,
  onSelectIsland,
}) => {
  const groupRef = useRef<THREE.Group>(null!);
  const planetRef = useRef<THREE.Mesh>(null!);
  const cloudRef = useRef<THREE.Mesh>(null!);
  const atmosphereRef = useRef<THREE.Mesh>(null!);
  const auraRef = useRef<THREE.Mesh>(null!);
  const satelliteRefs = useRef<Array<THREE.Mesh | null>>([]);
  const topicMoonRefs = useRef<Array<THREE.Mesh | null>>([]);
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
  const ringMap = useMemo(
    () => getCachedRingMap(domain.color, orbitConfig.seed, ringTextureSize),
    [domain.color, orbitConfig.seed, ringTextureSize]
  );

  const planetMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#ffffff'),
        map: maps.surfaceMap,
        bumpMap: maps.bumpMap,
        bumpScale: 0.09 + visuals.surfaceDetail * 0.34,
        roughnessMap: maps.roughnessMap,
        roughness:
          progress.stage === 'discovered'
            ? 0.86
            : Math.max(0.16, 0.68 - visuals.surfaceDetail * 0.34),
        metalness: 0.015 + visuals.developmentLevel * 0.03,
        clearcoat:
          progress.stage === 'discovered'
            ? 0.04
            : 0.13 + visuals.developmentLevel * 0.42,
        clearcoatRoughness:
          progress.stage === 'discovered'
            ? 0.78
            : 0.4 - visuals.developmentLevel * 0.16,
        emissive: new THREE.Color(domain.emissiveColor),
        emissiveIntensity: 0.02 + visuals.emissiveIntensity * 0.24,
        envMapIntensity: 0.46 + visuals.developmentLevel * 0.56,
        sheen: 0.3 + visuals.developmentLevel * 0.4,
        sheenRoughness: 0.6,
        sheenColor: new THREE.Color(domain.color).multiplyScalar(0.5),
        iridescence: visuals.developmentLevel * 0.15,
        iridescenceIOR: 1.3,
      }),
    [
      domain.color,
      domain.emissiveColor,
      maps.bumpMap,
      maps.roughnessMap,
      maps.surfaceMap,
      progress.stage,
      visuals.developmentLevel,
      visuals.emissiveIntensity,
      visuals.surfaceDetail,
    ]
  );

  const cloudMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: maps.cloudMap,
        alphaMap: maps.cloudMap,
        color: getCloudTint(domain.planetType),
        transparent: true,
        opacity: visuals.cloudOpacity,
        depthWrite: false,
        roughness: 0.68,
        metalness: 0.02,
        clearcoat: 0.12,
      }),
    [domain.planetType, maps.cloudMap, visuals.cloudOpacity]
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

  const activeLifeParticles = Math.min(
    MAX_LIFE_PARTICLES,
    Math.floor(visuals.lifeSignalStrength * MAX_LIFE_PARTICLES)
  );
  const visibleIslands = useMemo(
    () => (isDetailMode ? islands.slice(0, 20) : []),
    [isDetailMode, islands]
  );
  const stageMoonCount = visuals.stageMoonCount;
  const topicMoonCount = Math.min(
    MAX_TOPIC_MOONS,
    Math.max(stageMoonCount, Math.min(4, progress.topicsExplored || 0))
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

  useFrame(({ clock, camera }, delta) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    feedbackPulseRef.current = Math.max(0, feedbackPulseRef.current - delta * 1.2);
    const feedbackPulse = feedbackPulseRef.current;

    if (!isFocused) {
      const angle = domain.startAngle + t * domain.orbitSpeed;
      const jitterAmount = (1 - visuals.orbitStability) * (isDetailMode ? 0.03 : 0.1);
      const wobble =
        jitterAmount *
        Math.sin(t * 3 + domain.startAngle + orbitConfig.phase) *
        0.12;
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

      if (islandAnchorRef.current) {
        islandAnchorRef.current.rotation.copy(planetRef.current.rotation);
      }
    }

    if (cloudRef.current) {
      cloudRef.current.rotation.y += 0.0016;
      cloudRef.current.rotation.z += 0.0005;
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

    topicMoonRefs.current.forEach((moon, index) => {
      if (!moon || index >= topicMoonCount) return;
      const seed = topicMoonSeeds[index];
      const angle = t * (0.8 + seed.offset * 0.8) + seed.phase;
      const radius = 1.25 + visuals.scale * 0.28 + index * 0.17;
      moon.position.x = Math.cos(angle) * radius;
      moon.position.z = Math.sin(angle) * radius;
      moon.position.y = Math.sin(angle * 0.75 + seed.phase) * 0.18;
      moon.rotation.y += 0.01;
    });

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

    const distance = groupRef.current.position.distanceTo(camera.position);
    const shouldExpandLabel = isFocused || distance < (labelExpanded ? 18 : 15);
    if (shouldExpandLabel !== labelExpanded) {
      setLabelExpanded(shouldExpandLabel);
    }
  });

  const baseRadius = 0.52;
  const ringLayers =
    visuals.hasRing && visuals.ringOpacity > 0
      ? Math.max(1, Math.round(visuals.ringOpacity * 3))
      : 0;

  return (
    <group ref={groupRef} position={initialPosition}>
      <Sphere
        ref={planetRef}
        args={[baseRadius * visuals.scale, 64, 64]}
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

      <Ring
        ref={selectionHaloRef}
        args={[baseRadius * visuals.scale * 1.26, baseRadius * visuals.scale * 1.34, 96]}
        rotation={[Math.PI / 2, 0, 0]}
        visible={isFocused}
      >
        <meshBasicMaterial
          color={domain.emissiveColor}
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </Ring>

      <Sphere
        ref={cloudRef}
        args={[baseRadius * visuals.scale * 1.03, 40, 40]}
        material={cloudMaterial}
      />

      <Sphere
        ref={atmosphereRef}
        args={[baseRadius * visuals.scale * 1.12, 48, 48]}
        material={atmosphereMaterial}
      />

      {/* Soft billboard glow behind planet */}
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <mesh ref={auraRef} material={planetGlowMaterial}>
          <planeGeometry args={[baseRadius * visuals.scale * 4.5, baseRadius * visuals.scale * 4.5]} />
        </mesh>
      </Billboard>

      {ringLayers > 0 &&
        Array.from({ length: ringLayers }).map((_, index) => {
          const inner = baseRadius * visuals.scale * (1.42 + index * 0.22);
          const outer = inner + baseRadius * visuals.scale * (0.32 + index * 0.08);
          const opacity = Math.max(0.08, visuals.ringOpacity * (0.8 - index * 0.22));
          return (
            <Ring
              key={`ring_${index}`}
              args={[inner, outer, 96]}
              rotation={[Math.PI / (2.45 + index * 0.04), 0, index * 0.05]}
            >
              <meshPhysicalMaterial
                map={ringMap}
                alphaMap={ringMap}
                color={new THREE.Color(domain.color).multiplyScalar(1.06)}
                transparent
                opacity={opacity}
                emissive={domain.emissiveColor}
                emissiveIntensity={0.08 + visuals.developmentLevel * 0.14}
                roughness={0.72}
                metalness={0.03}
                clearcoat={0.12}
                side={THREE.DoubleSide}
                depthWrite={false}
                alphaTest={0.02}
              />
            </Ring>
          );
        })}

      {Array.from({ length: topicMoonCount }).map((_, index) => {
        const size = 0.055 + Math.min(0.06, visuals.developmentLevel * 0.045 + index * 0.004);
        return (
          <Sphere
            key={`topic_moon_${index}`}
            ref={(node) => {
              topicMoonRefs.current[index] = node;
            }}
            args={[size, 12, 12]}
          >
            <meshStandardMaterial
              color="#d6e7ff"
              emissive={domain.emissiveColor}
              emissiveIntensity={0.12 + visuals.developmentLevel * 0.18}
              roughness={0.52}
              metalness={0.08}
            />
          </Sphere>
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

      <group ref={islandAnchorRef}>
      {visibleIslands.map((topic, index) => {
        const pos = latLonToPlanetPosition(
          topic.lat,
          topic.lon,
          baseRadius * visuals.scale * 1.04
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
            ? 0.07
            : stage === 'apply'
            ? 0.062
            : stage === 'understood'
            ? 0.056
            : 0.05;

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
            <Sphere args={[markerSize, 10, 10]}>
              <meshStandardMaterial
                color={markerColor}
                emissive={markerColor}
                emissiveIntensity={stage === 'discovered' ? 0.2 : 0.38}
                roughness={0.42}
                metalness={0.08}
              />
            </Sphere>

            {(stage === 'apply' || stage === 'retained') && (
              <mesh position={[0, markerSize + 0.03, 0]}>
                <cylinderGeometry args={[0.006, 0.006, 0.08, 8]} />
                <meshStandardMaterial color="#f5f5f5" roughness={0.4} metalness={0.2} />
              </mesh>
            )}

            {stage === 'retained' && (
              <Ring args={[markerSize * 1.5, markerSize * 2.0, 24]} rotation={[Math.PI / 2, 0, 0]}>
                <meshBasicMaterial
                  color="#fde68a"
                  transparent
                  opacity={0.75}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </Ring>
            )}

            {isSelected && (
              <Ring args={[markerSize * 1.9, markerSize * 2.35, 24]} rotation={[Math.PI / 2, 0, 0]}>
                <meshBasicMaterial
                  color="#ffffff"
                  transparent
                  opacity={0.95}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </Ring>
            )}
          </group>
        );
      })}
      </group>

      <Html
        position={[0, baseRadius * visuals.scale + 0.6, 0]}
        center
        distanceFactor={14}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <span style={{ fontSize: labelExpanded ? '18px' : '16px' }}>{domain.icon}</span>
          {labelExpanded && !isDetailMode && (
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
          )}
          {isFocused && !isDetailMode && (
            <span
              style={{
                fontSize: '9px',
                fontWeight: 700,
                color: '#d8dcff',
                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                whiteSpace: 'nowrap',
                fontFamily: '"Nunito", sans-serif',
              }}
            >
              {progress.stage === 'retained'
                ? 'Sitzt wirklich'
                : progress.stage === 'apply'
                ? 'Anwenden'
                : progress.stage === 'understood'
                ? 'Verstanden'
                : 'Entdeckt'}
            </span>
          )}
        </div>
      </Html>
    </group>
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

      const n1 = fbm2D(nx * profile.baseScale, ny * profile.baseScale, seed, 4);
      const n2 = fbm2D(nx * profile.ridgeScale, ny * profile.ridgeScale, seed + 71, 3);
      const micro = fbm2D(nx * 32, ny * 32, seed + 911, 2);
      const continentNoise = fbm2D(nx * 2.4, ny * 2.4, seed + 219, 4);
      const regionNoise = fbm2D(nx * 5.4, ny * 5.4, seed + 527, 3);
      const latitude = Math.abs(ny - 0.5) * 2;
      const ridge = Math.pow(Math.abs(0.5 - n2) * 2, profile.ridgePower);
      const altitude = clamp01(n1 * profile.heightWeight + ridge * profile.ridgeWeight);
      const hasContinents =
        planetType === 'terrestrial' || planetType === 'lush' || planetType === 'oceanic';
      const regionMask = hasContinents
        ? smoothstep(0.46, 0.76, continentNoise) * smoothstep(0.2, 1, detailFactor)
        : 0;
      const gasBand =
        planetType === 'gaseous'
          ? (Math.sin((ny * 42 + n1 * 8) * Math.PI) * 0.5 + 0.5) * (0.28 + n2 * 0.35)
          : 0;
      const iceCap =
        planetType === 'icy' || planetType === 'oceanic'
          ? smoothstep(0.58, 0.96, latitude) * (0.2 + detailFactor * 0.4)
          : 0;
      const lavaCrack =
        planetType === 'volcanic'
          ? smoothstep(0.62, 0.92, n2) * smoothstep(0.4, 1, detailFactor)
          : 0;

      const shade = profile.shadeMin + altitude * profile.shadeRange + micro * 0.08;
      const tint = profile.tintBase + n2 * profile.tintRange;
      const regionBoost =
        1 +
        regionMask * (0.12 + regionNoise * 0.24) +
        gasBand * 0.24 +
        iceCap * 0.36 +
        lavaCrack * 0.42;
      surfaceData.data[i] = clamp255(baseR * shade * tint * profile.redShift * regionBoost);
      surfaceData.data[i + 1] = clamp255(baseG * shade * (profile.greenShift + n1 * 0.22) * regionBoost);
      surfaceData.data[i + 2] = clamp255(baseB * shade * (profile.blueShift + ridge * 0.2) * (1 + regionMask * 0.08));
      surfaceData.data[i + 3] = 255;

      const bump = clamp255((altitude + regionMask * 0.2 + micro * 0.07 + lavaCrack * 0.15) * 255);
      bumpData.data[i] = bump;
      bumpData.data[i + 1] = bump;
      bumpData.data[i + 2] = bump;
      bumpData.data[i + 3] = 255;

      const rough = clamp255((profile.roughnessBase + ridge * 0.52 + n1 * 0.16 + micro * 0.1 - regionMask * 0.09 - gasBand * 0.12) * 255);
      roughData.data[i] = rough;
      roughData.data[i + 1] = rough;
      roughData.data[i + 2] = rough;
      roughData.data[i + 3] = 255;

      const cloudNoise = fbm2D(nx * profile.cloudScale, ny * profile.cloudScale, seed + 133, 5);
      const cloudSwirl = fbm2D(nx * profile.cloudScale * 1.8, ny * profile.cloudScale * 1.1, seed + 337, 3);
      const cloudAlpha = clamp255(Math.max(0, cloudNoise + cloudSwirl * 0.2 - profile.cloudThreshold) * profile.cloudGain);
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
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
  });
  surfaceMap.colorSpace = THREE.SRGBColorSpace;

  return { surfaceMap, bumpMap, roughnessMap, cloudMap };
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

function smoothstep(min: number, max: number, value: number): number {
  if (value <= min) return 0;
  if (value >= max) return 1;
  const t = (value - min) / (max - min);
  return t * t * (3 - 2 * t);
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
