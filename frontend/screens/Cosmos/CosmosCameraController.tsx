/**
 * CosmosCameraController.tsx - Cinematic camera controls with zoom modes.
 *
 * Modes:
 * - system: full solar-system overview
 * - focus: selected planet + neighboring context
 * - detail: close inspection of selected planet
 */

import React, { useRef, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { CameraMode, CosmosDomain } from './CosmosTypes';

interface Props {
  mode: CameraMode;
  focusedDomain?: CosmosDomain | null;
  focusedPosition?: [number, number, number] | null;
}

const SYSTEM_POS = new THREE.Vector3(16, 9, 30);
const SYSTEM_TARGET = new THREE.Vector3(0, 0, 0);

export const CosmosCameraController: React.FC<Props> = ({
  mode,
  focusedDomain,
  focusedPosition,
}) => {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(true);

  const targetPos = useRef(SYSTEM_POS.clone());
  const targetLookAt = useRef(SYSTEM_TARGET.clone());
  const currentLookAt = useRef(SYSTEM_TARGET.clone());
  const isAnimating = useRef(false);
  const isCinematic = useRef(false);
  const cinematicStart = useRef<number | null>(null);
  const cinematicDuration = useRef(0.95);
  const shotFrom = useRef(new THREE.Vector3());
  const shotTo = useRef(new THREE.Vector3());

  useEffect(() => {
    if ((mode === 'focus' || mode === 'detail') && focusedDomain) {
      const [px, py, pz] = focusedPosition ?? [
        Math.cos(focusedDomain.startAngle) * focusedDomain.orbitRadius,
        0,
        Math.sin(focusedDomain.startAngle) * focusedDomain.orbitRadius,
      ];
      const focus = new THREE.Vector3(px, py, pz);
      const fromStar = focus.clone().normalize();
      if (fromStar.lengthSq() < 0.0001) {
        fromStar.set(0.6, 0.2, 1).normalize();
      }
      const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), fromStar);
      if (side.lengthSq() < 0.0001) side.set(1, 0, 0);
      side.normalize();

      const focusDistance = mode === 'detail' ? 3.4 : 7.4;
      const sideOffset = mode === 'detail' ? 0.95 : 2.8;
      const heightOffset = mode === 'detail' ? 1.25 : 2.35;

      shotFrom.current.copy(camera.position);
      shotTo.current
        .copy(focus)
        .add(fromStar.clone().multiplyScalar(focusDistance))
        .add(side.clone().multiplyScalar(sideOffset * 0.68))
        .add(new THREE.Vector3(0, heightOffset, 0));

      targetPos.current.copy(shotTo.current);
      targetLookAt.current.copy(focus);
      cinematicDuration.current = mode === 'detail' ? 0.72 : 0.92;
      cinematicStart.current = null;
      isCinematic.current = true;
      isAnimating.current = true;
      setAutoRotateEnabled(false);
      return;
    }

    targetPos.current.copy(SYSTEM_POS);
    targetLookAt.current.copy(SYSTEM_TARGET);
    isCinematic.current = false;
    cinematicStart.current = null;
    isAnimating.current = true;
    setAutoRotateEnabled(true);
  }, [camera, focusedDomain, focusedPosition, mode]);

  useFrame(({ clock }) => {
    if ((mode === 'focus' || mode === 'detail') && isCinematic.current) {
      if (cinematicStart.current == null) {
        cinematicStart.current = clock.elapsedTime;
      }
      const elapsed = clock.elapsedTime - cinematicStart.current;
      const t = Math.min(1, elapsed / cinematicDuration.current);
      const eased = easeOutCubic(t);
      camera.position.lerpVectors(shotFrom.current, shotTo.current, eased);
      camera.position.y += Math.sin(Math.PI * eased) * (mode === 'detail' ? 0.12 : 0.24);
      currentLookAt.current.lerp(targetLookAt.current, 0.2);
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
      controlsRef.current.enabled = false;
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

  const minDistance = mode === 'detail' ? 2.6 : mode === 'focus' ? 5.2 : 12;
  const maxDistance = mode === 'detail' ? 6.8 : mode === 'focus' ? 13.5 : 52;
  const minPolarAngle = mode === 'detail' ? Math.PI * 0.26 : mode === 'focus' ? Math.PI * 0.2 : Math.PI * 0.16;
  const maxPolarAngle = mode === 'detail' ? Math.PI * 0.44 : mode === 'focus' ? Math.PI * 0.52 : Math.PI * 0.58;
  const rotateSpeed = mode === 'detail' ? 0.22 : mode === 'focus' ? 0.28 : 0.34;
  const minAzimuthAngle =
    mode === 'system'
      ? -Infinity
      : mode === 'detail'
      ? -Math.PI
      : -Math.PI * 0.56;
  const maxAzimuthAngle =
    mode === 'system'
      ? Infinity
      : mode === 'detail'
      ? Math.PI
      : Math.PI * 0.56;

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={mode === 'system'}
      enableZoom
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={minPolarAngle}
      maxPolarAngle={maxPolarAngle}
      minAzimuthAngle={minAzimuthAngle}
      maxAzimuthAngle={maxAzimuthAngle}
      autoRotate={mode === 'system' && autoRotateEnabled}
      autoRotateSpeed={0.08}
      enableDamping
      dampingFactor={0.1}
      rotateSpeed={rotateSpeed}
      onStart={() => {
        isAnimating.current = false;
        isCinematic.current = false;
        if (controlsRef.current) {
          const activeTarget = controlsRef.current.target as THREE.Vector3;
          currentLookAt.current.copy(activeTarget);
          targetLookAt.current.copy(activeTarget);
          targetPos.current.copy(camera.position);
        }
        if (mode === 'system') {
          setAutoRotateEnabled(false);
        }
      }}
    />
  );
};

function easeOutCubic(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return 1 - Math.pow(1 - t, 3);
}
