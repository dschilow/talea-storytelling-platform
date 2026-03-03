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
  focusedPosition?: [number, number, number] | null;
}

const OVERVIEW_POS = new THREE.Vector3(8, 14, 24);
const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 0);

export const CosmosCameraController: React.FC<Props> = ({
  mode,
  focusedDomain,
  focusedPosition,
}) => {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  // Smooth camera transition targets
  const targetPos = useRef(OVERVIEW_POS.clone());
  const targetLookAt = useRef(OVERVIEW_TARGET.clone());
  const currentLookAt = useRef(OVERVIEW_TARGET.clone());
  const isAnimating = useRef(false);

  useEffect(() => {
    if (mode === 'focused' && focusedDomain) {
      const [px, py, pz] = focusedPosition ?? [
        Math.cos(focusedDomain.startAngle) * focusedDomain.orbitRadius,
        0,
        Math.sin(focusedDomain.startAngle) * focusedDomain.orbitRadius,
      ];

      targetPos.current.set(px + 3.2, py + 2.2, pz + 4.8);
      targetLookAt.current.set(px, py, pz);
      isAnimating.current = true;
    } else {
      targetPos.current.copy(OVERVIEW_POS);
      targetLookAt.current.copy(OVERVIEW_TARGET);
      isAnimating.current = true;
    }
  }, [focusedDomain, focusedPosition, mode]);

  // Smooth lerp each frame
  useFrame(() => {
    if (!isAnimating.current) return;

    camera.position.lerp(targetPos.current, 0.055);
    currentLookAt.current.lerp(targetLookAt.current, 0.055);
    camera.lookAt(currentLookAt.current);

    // Update orbit controls target
    if (controlsRef.current) {
      controlsRef.current.target.copy(currentLookAt.current);
      controlsRef.current.update();
    }

    // Stop animating when close enough
    if (
      camera.position.distanceTo(targetPos.current) < 0.04 &&
      currentLookAt.current.distanceTo(targetLookAt.current) < 0.04
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
      autoRotate={mode === 'overview'}
      autoRotateSpeed={0.22}
      enableDamping
      dampingFactor={0.06}
      rotateSpeed={0.45}
    />
  );
};
