/**
 * CosmosStarCenter.tsx - The child's central star
 * Warm, glowing sun at the center of the cosmos.
 * "Du bist der Mittelpunkt deines Lernkosmos."
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';

interface Props {
  avatarImageUrl?: string;
}

export const CosmosStarCenter: React.FC<Props> = ({ avatarImageUrl }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);
  const coronaRef = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);

  // Subtle pulsating animation
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = 1 + Math.sin(t * 1.5) * 0.04;

    if (meshRef.current) {
      meshRef.current.scale.setScalar(pulse);
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(pulse * 1.8);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.12 + Math.sin(t * 2) * 0.04;
    }
    if (coronaRef.current) {
      coronaRef.current.scale.setScalar(2 + Math.sin(t * 0.8) * 0.08);
      (coronaRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.08 + Math.sin(t * 1.1) * 0.03;
      coronaRef.current.rotation.y += 0.0008;
      coronaRef.current.rotation.z += 0.0004;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 2.7 + Math.sin(t * 1.5) * 0.35;
    }
  });

  const starMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#fff4d6'),
        emissive: new THREE.Color('#ffb347'),
        emissiveIntensity: 2.4,
        roughness: 0.16,
        metalness: 0.02,
        clearcoat: 0.35,
        clearcoatRoughness: 0.45,
      }),
    []
  );

  const glowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#ffcc66'),
        transparent: true,
        opacity: 0.15,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    []
  );
  const coronaMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#ffc57d'),
        transparent: true,
        opacity: 0.08,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  return (
    <group>
      {/* Main star body */}
      <Sphere ref={meshRef} args={[1.5, 32, 32]} material={starMaterial} />

      {/* Soft outer glow */}
      <Sphere ref={glowRef} args={[1.5, 24, 24]} material={glowMaterial} />
      <Sphere ref={coronaRef} args={[3.2, 18, 18]} material={coronaMaterial} />

      {/* Point light illuminating planets */}
      <pointLight
        ref={lightRef}
        color="#fff4d6"
        intensity={2.7}
        distance={60}
        decay={1.5}
      />

      {/* Ambient fill so planets aren't pitch black on the far side */}
      <ambientLight intensity={0.15} color="#b8c4ff" />
    </group>
  );
};
