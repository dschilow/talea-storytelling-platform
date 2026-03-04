/**
 * CosmosCameraController.tsx - Cinematic camera controls with zoom modes.
 *
 * Modes:
 * - system: full solar-system overview
 * - focus: selected planet + neighboring context
 * - detail: close inspection of selected planet
 */

import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { CameraMode, CosmosDomain } from './CosmosTypes';

interface Props {
  mode: CameraMode;
  focusedDomain?: CosmosDomain | null;
  focusedPosition?: [number, number, number] | null;
}

const SYSTEM_POS = new THREE.Vector3(13, 8, 25);
const SYSTEM_TARGET = new THREE.Vector3(0, 0, 0);

export const CosmosCameraController: React.FC<Props> = ({
  mode,
  focusedDomain,
  focusedPosition,
}) => {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  const targetPos = useRef(SYSTEM_POS.clone());
  const targetLookAt = useRef(SYSTEM_TARGET.clone());
  const currentLookAt = useRef(SYSTEM_TARGET.clone());
  const isAnimating = useRef(false);
  const isCinematic = useRef(false);
  const cinematicStart = useRef<number | null>(null);
  const shotFrom = useRef(new THREE.Vector3());
  const shotMid = useRef(new THREE.Vector3());
  const shotTo = useRef(new THREE.Vector3());
  const cinematicDuration = 1.25;

  useEffect(() => {
    if ((mode === 'focus' || mode === 'detail') && focusedDomain) {
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

      const focusDistance = mode === 'detail' ? 3.3 : 6.2;
      const midDistance = mode === 'detail' ? 5.6 : 8.1;
      const sideOffset = mode === 'detail' ? 0.8 : 2.2;
      const heightOffset = mode === 'detail' ? 1.3 : 2.5;

      shotFrom.current.copy(camera.position);
      shotMid.current
        .copy(focus)
        .add(toCamera.clone().multiplyScalar(midDistance))
        .add(side.clone().multiplyScalar(sideOffset))
        .add(new THREE.Vector3(0, heightOffset + 0.8, 0));
      shotTo.current
        .copy(focus)
        .add(toCamera.clone().multiplyScalar(focusDistance))
        .add(side.clone().multiplyScalar(sideOffset * 0.68))
        .add(new THREE.Vector3(0, heightOffset, 0));

      targetPos.current.copy(shotTo.current);
      targetLookAt.current.copy(focus);
      cinematicStart.current = null;
      isCinematic.current = true;
      isAnimating.current = true;
      return;
    }

    targetPos.current.copy(SYSTEM_POS);
    targetLookAt.current.copy(SYSTEM_TARGET);
    isCinematic.current = false;
    cinematicStart.current = null;
    isAnimating.current = true;
  }, [camera, focusedDomain, focusedPosition, mode]);

  useFrame(({ clock }) => {
    if ((mode === 'focus' || mode === 'detail') && isCinematic.current) {
      if (cinematicStart.current == null) {
        cinematicStart.current = clock.elapsedTime;
      }
      const elapsed = clock.elapsedTime - cinematicStart.current;
      const t = Math.min(1, elapsed / cinematicDuration);

      if (t < 0.5) {
        const p = smoothstep(0, 0.5, t);
        camera.position.lerpVectors(shotFrom.current, shotMid.current, p);
      } else {
        const p = smoothstep(0.5, 1, t);
        camera.position.lerpVectors(shotMid.current, shotTo.current, p);
      }
      currentLookAt.current.lerp(targetLookAt.current, 0.12);
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

    camera.position.lerp(targetPos.current, 0.058);
    currentLookAt.current.lerp(targetLookAt.current, 0.058);
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

  const minDistance = mode === 'detail' ? 2.2 : mode === 'focus' ? 4 : 10;
  const maxDistance = mode === 'detail' ? 8 : mode === 'focus' ? 14 : 50;

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={Math.PI * 0.1}
      maxPolarAngle={Math.PI * 0.6}
      autoRotate={mode === 'system'}
      autoRotateSpeed={0.12}
      enableDamping
      dampingFactor={0.09}
      rotateSpeed={0.36}
    />
  );
};

function smoothstep(min: number, max: number, value: number): number {
  if (value <= min) return 0;
  if (value >= max) return 1;
  const t = (value - min) / (max - min);
  return t * t * (3 - 2 * t);
}
