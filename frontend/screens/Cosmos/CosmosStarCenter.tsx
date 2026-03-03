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
    if (lightRef.current) {
      lightRef.current.intensity = 2.5 + Math.sin(t * 1.5) * 0.3;
    }
  });

  const starMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#fff4d6'),
        emissive: new THREE.Color('#ffb347'),
        emissiveIntensity: 2.0,
        roughness: 0.2,
        metalness: 0.0,
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

  return (
    <group>
      {/* Main star body */}
      <Sphere ref={meshRef} args={[1.5, 32, 32]} material={starMaterial} />

      {/* Soft outer glow */}
      <Sphere ref={glowRef} args={[1.5, 24, 24]} material={glowMaterial} />

      {/* Point light illuminating planets */}
      <pointLight
        ref={lightRef}
        color="#fff4d6"
        intensity={2.5}
        distance={60}
        decay={1.5}
      />

      {/* Ambient fill so planets aren't pitch black on the far side */}
      <ambientLight intensity={0.15} color="#b8c4ff" />
    </group>
  );
};
