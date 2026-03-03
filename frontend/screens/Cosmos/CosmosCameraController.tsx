/**
 * CosmosCameraController.tsx - Camera animation & controls
 *
 * Two modes:
 * - overview: orbit controls, full solar system view
 * - focused: smooth lerp to selected planet, limited controls
 *
 * Uses @react-three/drei CameraControls for smooth transitions.
 */

import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { CameraMode } from './CosmosTypes';
import type { CosmosDomain } from './CosmosTypes';

interface Props {
  mode: CameraMode;
  focusedDomain?: CosmosDomain | null;
  focusedOrbitAngle?: number;
  onResetFocus: () => void;
}

const OVERVIEW_POS = new THREE.Vector3(0, 18, 28);
const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 0);

export const CosmosCameraController: React.FC<Props> = ({
  mode,
  focusedDomain,
  focusedOrbitAngle = 0,
  onResetFocus,
}) => {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  // Smooth camera transition targets
  const targetPos = useRef(OVERVIEW_POS.clone());
  const targetLookAt = useRef(OVERVIEW_TARGET.clone());
  const isAnimating = useRef(false);

  useEffect(() => {
    if (mode === 'focused' && focusedDomain) {
      // Compute planet's current position
      const px = Math.cos(focusedOrbitAngle) * focusedDomain.orbitRadius;
      const pz = Math.sin(focusedOrbitAngle) * focusedDomain.orbitRadius;

      // Camera slightly above and behind the planet
      targetPos.current.set(px + 3, 3, pz + 5);
      targetLookAt.current.set(px, 0, pz);
      isAnimating.current = true;
    } else {
      targetPos.current.copy(OVERVIEW_POS);
      targetLookAt.current.copy(OVERVIEW_TARGET);
      isAnimating.current = true;
    }
  }, [mode, focusedDomain, focusedOrbitAngle]);

  // Smooth lerp each frame
  useFrame(() => {
    if (!isAnimating.current) return;

    camera.position.lerp(targetPos.current, 0.04);
    const currentLookAt = new THREE.Vector3();
    camera.getWorldDirection(currentLookAt);
    currentLookAt.add(camera.position);
    currentLookAt.lerp(targetLookAt.current, 0.04);
    camera.lookAt(currentLookAt);

    // Update orbit controls target
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLookAt.current, 0.04);
      controlsRef.current.update();
    }

    // Stop animating when close enough
    if (
      camera.position.distanceTo(targetPos.current) < 0.05
    ) {
      isAnimating.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom={true}
      minDistance={mode === 'focused' ? 3 : 10}
      maxDistance={mode === 'focused' ? 12 : 50}
      minPolarAngle={Math.PI * 0.1}
      maxPolarAngle={Math.PI * 0.6}
      enableDamping
      dampingFactor={0.05}
      rotateSpeed={0.5}
    />
  );
};
