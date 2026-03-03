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

const OVERVIEW_POS = new THREE.Vector3(13, 9, 25);
const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 0);

export const CosmosCameraController: React.FC<Props> = ({
  mode,
  focusedDomain,
  focusedPosition,
}) => {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  const targetPos = useRef(OVERVIEW_POS.clone());
  const targetLookAt = useRef(OVERVIEW_TARGET.clone());
  const currentLookAt = useRef(OVERVIEW_TARGET.clone());
  const isAnimating = useRef(false);
  const isCinematic = useRef(false);
  const cinematicStart = useRef<number | null>(null);
  const shotFrom = useRef(new THREE.Vector3());
  const shotMid = useRef(new THREE.Vector3());
  const shotTo = useRef(new THREE.Vector3());
  const cinematicDuration = 1.45;

  useEffect(() => {
    if (mode === 'focused' && focusedDomain) {
      const [px, py, pz] = focusedPosition ?? [
        Math.cos(focusedDomain.startAngle) * focusedDomain.orbitRadius,
        0,
        Math.sin(focusedDomain.startAngle) * focusedDomain.orbitRadius,
      ];
      const focus = new THREE.Vector3(px, py, pz);
      const toCamera = camera.position.clone().sub(focus).normalize();
      const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), toCamera);
      if (side.lengthSq() < 0.0001) side.set(1, 0, 0);
      side.normalize();

      shotFrom.current.copy(camera.position);
      shotMid.current
        .copy(focus)
        .add(toCamera.clone().multiplyScalar(7.2))
        .add(side.clone().multiplyScalar(2.4))
        .add(new THREE.Vector3(0, 2.8, 0));
      shotTo.current
        .copy(focus)
        .add(toCamera.clone().multiplyScalar(4.6))
        .add(side.clone().multiplyScalar(1.7))
        .add(new THREE.Vector3(0, 2.1, 0));

      targetPos.current.copy(shotTo.current);
      targetLookAt.current.set(px, py, pz);
      cinematicStart.current = null;
      isCinematic.current = true;
      isAnimating.current = true;
    } else {
      targetPos.current.copy(OVERVIEW_POS);
      targetLookAt.current.copy(OVERVIEW_TARGET);
      isCinematic.current = false;
      cinematicStart.current = null;
      isAnimating.current = true;
    }
  }, [camera, focusedDomain, focusedPosition, mode]);

  useFrame(({ clock }) => {
    if (mode === 'focused' && isCinematic.current) {
      if (cinematicStart.current == null) {
        cinematicStart.current = clock.elapsedTime;
      }
      const elapsed = clock.elapsedTime - cinematicStart.current;
      const t = Math.min(1, elapsed / cinematicDuration);

      if (t < 0.52) {
        const p = smoothstep(0, 0.52, t);
        camera.position.lerpVectors(shotFrom.current, shotMid.current, p);
      } else {
        const p = smoothstep(0.52, 1, t);
        camera.position.lerpVectors(shotMid.current, shotTo.current, p);
      }
      currentLookAt.current.lerp(targetLookAt.current, 0.11);
      camera.lookAt(currentLookAt.current);

      if (controlsRef.current) {
        controlsRef.current.enabled = false;
        controlsRef.current.target.copy(currentLookAt.current);
        controlsRef.current.update();
      }

      if (t >= 1) {
        isCinematic.current = false;
      }
      return;
    }

    if (!isAnimating.current) {
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
        controlsRef.current.update();
      }
      return;
    }

    camera.position.lerp(targetPos.current, 0.055);
    currentLookAt.current.lerp(targetLookAt.current, 0.055);
    camera.lookAt(currentLookAt.current);

    if (controlsRef.current) {
      controlsRef.current.enabled = true;
      controlsRef.current.target.copy(currentLookAt.current);
      controlsRef.current.update();
    }

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
      autoRotateSpeed={0.14}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.38}
    />
  );
};

function smoothstep(min: number, max: number, value: number): number {
  if (value <= min) return 0;
  if (value >= max) return 1;
  const t = (value - min) / (max - min);
  return t * t * (3 - 2 * t);
}
