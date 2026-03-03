/**
 * CosmosPlanetDomain.tsx - A single knowledge domain planet
 *
 * Visual appearance is driven ENTIRELY by DomainProgress:
 * - Scale from mastery
 * - Glow from confidence
 * - Atmosphere at "understood"
 * - Ring at "can_explain"
 * - Satellites at "mastered"
 *
 * Uses procedural materials (no texture downloads needed).
 */

import React, { useRef, useMemo, useCallback } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Sphere, Ring, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { CosmosDomain, DomainProgress, PlanetVisuals } from './CosmosTypes';
import { mapProgressToVisuals } from './CosmosProgressMapper';

interface Props {
  domain: CosmosDomain;
  progress: DomainProgress;
  isFocused: boolean;
  onSelect: (domainId: string) => void;
}

export const CosmosPlanetDomain: React.FC<Props> = ({
  domain,
  progress,
  isFocused,
  onSelect,
}) => {
  const groupRef = useRef<THREE.Group>(null!);
  const planetRef = useRef<THREE.Mesh>(null!);
  const atmosphereRef = useRef<THREE.Mesh>(null!);
  const satelliteRef = useRef<THREE.Mesh>(null!);

  const visuals = useMemo(() => mapProgressToVisuals(progress), [progress]);

  // Planet material — procedural, color-driven
  const planetMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(domain.color),
        emissive: new THREE.Color(domain.emissiveColor),
        emissiveIntensity: visuals.emissiveIntensity,
        roughness: 0.65,
        metalness: 0.1,
      }),
    [domain.color, domain.emissiveColor, visuals.emissiveIntensity]
  );

  // Atmosphere material (translucent shell)
  const atmosphereMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(domain.color),
        transparent: true,
        opacity: visuals.atmosphereOpacity,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [domain.color, visuals.atmosphereOpacity]
  );

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onSelect(domain.id);
    },
    [domain.id, onSelect]
  );

  // Orbit animation
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    const angle = domain.startAngle + t * domain.orbitSpeed;

    // Wobble inversely proportional to stability
    const wobble = (1 - visuals.orbitStability) * Math.sin(t * 3 + domain.startAngle) * 0.15;

    groupRef.current.position.x = Math.cos(angle) * domain.orbitRadius;
    groupRef.current.position.z = Math.sin(angle) * domain.orbitRadius;
    groupRef.current.position.y = wobble;

    // Gentle self-rotation
    if (planetRef.current) {
      planetRef.current.rotation.y += 0.003;
    }

    // Satellite orbits around planet
    if (satelliteRef.current && visuals.hasSatellites) {
      const satAngle = t * 2;
      satelliteRef.current.position.x = Math.cos(satAngle) * (visuals.scale + 0.6);
      satelliteRef.current.position.z = Math.sin(satAngle) * (visuals.scale + 0.6);
      satelliteRef.current.position.y = Math.sin(satAngle * 0.5) * 0.2;
    }
  });

  const baseRadius = 0.5;

  return (
    <group ref={groupRef}>
      {/* Clickable planet body */}
      <Sphere
        ref={planetRef}
        args={[baseRadius * visuals.scale, 24, 24]}
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

      {/* Atmosphere shell */}
      {visuals.hasAtmosphere && (
        <Sphere
          ref={atmosphereRef}
          args={[baseRadius * visuals.scale * 1.2, 20, 20]}
          material={atmosphereMaterial}
        />
      )}

      {/* Ring (at can_explain stage) */}
      {visuals.hasRing && (
        <Ring
          args={[
            baseRadius * visuals.scale * 1.4,
            baseRadius * visuals.scale * 1.9,
            32,
          ]}
          rotation={[Math.PI / 2.5, 0, 0]}
        >
          <meshBasicMaterial
            color={domain.color}
            transparent
            opacity={0.25}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </Ring>
      )}

      {/* Satellite moon (at mastered stage) */}
      {visuals.hasSatellites && (
        <Sphere ref={satelliteRef} args={[0.08, 12, 12]}>
          <meshStandardMaterial
            color="#e2e8f0"
            emissive="#94a3b8"
            emissiveIntensity={0.3}
          />
        </Sphere>
      )}

      {/* Domain label (always visible, small) */}
      <Html
        position={[0, baseRadius * visuals.scale + 0.5, 0]}
        center
        distanceFactor={15}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          <span style={{ fontSize: '18px' }}>{domain.icon}</span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'white',
              textShadow: '0 1px 4px rgba(0,0,0,0.8)',
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
