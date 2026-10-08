/**
 * CosmosCameraController.tsx - Cinematic camera controls with zoom modes.
 *
 * Modes:
 * - system: full solar-system overview, framed for the current screen shape
 * - focus: selected planet + its moons, seen from its sunlit side
 * - detail: close inspection of selected planet
 *
 * Every mode change is a time-based camera flight (frame-rate independent);
 * afterwards OrbitControls take over until the next change.
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { CameraMode, CosmosDomain } from './CosmosTypes';

interface Props {
  mode: CameraMode;
  focusedDomain?: CosmosDomain | null;
  focusedPosition?: [number, number, number] | null;
  /** Largest orbit radius in scene units (after layout scaling). */
  systemRadius?: number;
  onTransitionStateChange?: (isTransitioning: boolean) => void;
}

const SYSTEM_TARGET = new THREE.Vector3(0, 0, 0);
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const LANDSCAPE_FOV = 46;
const PORTRAIT_FOV = 54;

interface Flight {
  active: boolean;
  start: number | null;
  duration: number;
  arc: number;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromLook: THREE.Vector3;
  toLook: THREE.Vector3;
}

export const CosmosCameraController: React.FC<Props> = ({
  mode,
  focusedDomain,
  focusedPosition,
  systemRadius = 19,
  onTransitionStateChange,
}) => {
  const controlsRef = useRef<any>(null);
  const { camera, size } = useThree();
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(true);
  const isPortrait = size.height > size.width;
  const fov = isPortrait ? PORTRAIT_FOV : LANDSCAPE_FOV;

  const systemPosition = useMemo(
    () => computeSystemCameraPosition(size.width, size.height, fov, systemRadius),
    [fov, size.height, size.width, systemRadius]
  );
  const systemDistance = systemPosition.length();

  const lookAtRef = useRef(SYSTEM_TARGET.clone());
  const introDoneRef = useRef(false);
  const flightRef = useRef<Flight>({
    active: false,
    start: null,
    duration: 1,
    arc: 0,
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    fromLook: new THREE.Vector3(),
    toLook: new THREE.Vector3(),
  });
  const transitionStateRef = useRef(false);
  const viewOffsetRef = useRef({ x: 0, y: 0 });

  const reportTransitionState = useCallback((next: boolean) => {
    if (transitionStateRef.current === next) return;
    transitionStateRef.current = next;
    onTransitionStateChange?.(next);
  }, [onTransitionStateChange]);

  useEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    if (perspective.isPerspectiveCamera && perspective.fov !== fov) {
      perspective.fov = fov;
      perspective.updateProjectionMatrix();
    }
  }, [camera, fov]);

  useEffect(() => {
    const flight = flightRef.current;

    if ((mode === 'focus' || mode === 'detail') && focusedDomain) {
      const [px, py, pz] = focusedPosition ?? [
        Math.cos(focusedDomain.startAngle) * focusedDomain.orbitRadius,
        0,
        Math.sin(focusedDomain.startAngle) * focusedDomain.orbitRadius,
      ];
      const focus = new THREE.Vector3(px, py, pz);
      const fromStar = focus.clone().normalize();
      if (fromStar.lengthSq() < 0.0001) fromStar.set(0.6, 0.2, 1).normalize();
      const side = new THREE.Vector3().crossVectors(WORLD_UP, fromStar);
      if (side.lengthSq() < 0.0001) side.set(1, 0, 0);
      side.normalize();

      // Three-quarter view from the sunlit side: day side, terminator and the
      // night lights are all visible. The HUD offset is handled by the view offset.
      const viewDir = new THREE.Vector3().addScaledVector(fromStar, -0.5).addScaledVector(side, 0.86).normalize();
      const distance = mode === 'detail' ? (isPortrait ? 5.4 : 4.4) : isPortrait ? 10.5 : 8.2;
      const height = mode === 'detail' ? (isPortrait ? 1.6 : 1.25) : isPortrait ? 3.2 : 2.35;

      flight.fromPos.copy(camera.position);
      flight.toPos.copy(focus).addScaledVector(viewDir, distance).add(new THREE.Vector3(0, height, 0));
      flight.fromLook.copy(lookAtRef.current);
      flight.toLook.copy(focus);
      flight.duration = mode === 'detail' ? 0.9 : 1.35;
      flight.arc = mode === 'detail' ? 0.1 : 0.7;
      setAutoRotateEnabled(false);
    } else {
      if (!introDoneRef.current) {
        // First frame: start far out and glide into the system.
        camera.position.copy(systemPosition).multiplyScalar(1.7).add(new THREE.Vector3(0, systemDistance * 0.3, 0));
        lookAtRef.current.copy(SYSTEM_TARGET);
      }
      flight.fromPos.copy(camera.position);
      flight.toPos.copy(systemPosition);
      flight.fromLook.copy(lookAtRef.current);
      flight.toLook.copy(SYSTEM_TARGET);
      flight.duration = introDoneRef.current ? 1.4 : 2.6;
      flight.arc = 0;
      setAutoRotateEnabled(true);
    }

    introDoneRef.current = true;
    flight.start = null;
    flight.active = true;
    reportTransitionState(true);
  }, [camera, focusedDomain, focusedPosition, isPortrait, mode, reportTransitionState, systemDistance, systemPosition]);

  useFrame(({ clock }) => {
    const offsetTarget = getFocusViewOffset(mode, Boolean(focusedDomain), size.width, size.height);
    const offset = viewOffsetRef.current;
    offset.x += (offsetTarget.x - offset.x) * 0.08;
    offset.y += (offsetTarget.y - offset.y) * 0.08;
    const perspective = camera as THREE.PerspectiveCamera;
    if (Math.abs(offset.x) < 0.5 && Math.abs(offset.y) < 0.5 && offsetTarget.x === 0 && offsetTarget.y === 0) {
      if (perspective.view?.enabled) perspective.clearViewOffset();
    } else {
      perspective.setViewOffset(size.width, size.height, offset.x, offset.y, size.width, size.height);
    }

    const flight = flightRef.current;
    const controls = controlsRef.current;
    if (!flight.active) {
      if (controls) lookAtRef.current.copy(controls.target);
      return;
    }

    if (flight.start === null) flight.start = clock.elapsedTime;
    const t = Math.min(1, (clock.elapsedTime - flight.start) / flight.duration);
    const eased = easeInOutCubic(t);
    camera.position.lerpVectors(flight.fromPos, flight.toPos, eased);
    camera.position.y += Math.sin(Math.PI * eased) * flight.arc;
    lookAtRef.current.lerpVectors(flight.fromLook, flight.toLook, eased);
    camera.lookAt(lookAtRef.current);

    if (controls) {
      // Disabled controls skip their own update, so they cannot clamp the flight.
      controls.enabled = false;
      controls.target.copy(lookAtRef.current);
    }

    if (t >= 1) {
      flight.active = false;
      if (controls) {
        controls.enabled = true;
        controls.update();
      }
      reportTransitionState(false);
    }
  });

  const minDistance = mode === 'detail' ? 1.6 : mode === 'focus' ? 4.5 : Math.min(12, systemDistance * 0.4);
  const maxDistance = mode === 'detail' ? 7 : mode === 'focus' ? 16 : Math.max(52, systemDistance * 1.35);
  const minPolarAngle = mode === 'detail' ? Math.PI * 0.12 : mode === 'focus' ? Math.PI * 0.2 : Math.PI * 0.12;
  const maxPolarAngle = mode === 'detail' ? Math.PI * 0.88 : mode === 'focus' ? Math.PI * 0.55 : Math.PI * 0.58;
  const rotateSpeed = mode === 'detail' ? 0.22 : mode === 'focus' ? 0.3 : 0.34;

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={mode === 'system'}
      enableZoom
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={minPolarAngle}
      maxPolarAngle={maxPolarAngle}
      autoRotate={mode === 'system' && autoRotateEnabled}
      autoRotateSpeed={0.08}
      enableDamping
      dampingFactor={0.1}
      rotateSpeed={rotateSpeed}
      onStart={() => {
        const flight = flightRef.current;
        if (flight.active) {
          flight.active = false;
          if (controlsRef.current) controlsRef.current.enabled = true;
          reportTransitionState(false);
        }
        if (mode === 'system') {
          setAutoRotateEnabled(false);
        }
      }}
    />
  );
};

/**
 * Pixel shift of the rendered image so the focused planet sits in the space the
 * HUD leaves free: beside the docked panel on wide screens, above the bottom
 * sheet on phones.
 */
function getFocusViewOffset(mode: CameraMode, hasFocus: boolean, width: number, height: number) {
  if (mode === 'system' || !hasFocus) return { x: 0, y: 0 };
  if (width >= 768) {
    const panel = Math.min(416, width * 0.4) + 24;
    return { x: panel / 2, y: 0 };
  }
  return { x: 0, y: height * (mode === 'detail' ? 0.26 : 0.22) };
}

/**
 * Smallest camera distance (on a fixed viewing direction) at which the whole
 * outermost orbit fits on screen. Portrait screens look down more steeply so
 * the orbit ellipses use the tall screen better.
 */
function computeSystemCameraPosition(
  width: number,
  height: number,
  fovDeg: number,
  systemRadius: number
): THREE.Vector3 {
  const aspect = Math.max(0.3, width / Math.max(1, height));
  const portrait = aspect < 1;
  const elevation = THREE.MathUtils.degToRad(portrait ? 46 : 16);
  const azimuth = Math.atan2(16, 30);
  const direction = new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation)
  );
  const forward = direction.clone().negate();
  const right = new THREE.Vector3().crossVectors(forward, WORLD_UP).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  const tanY = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2) * 0.86;
  const tanX = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2) * aspect * 0.94;
  // Room for the planet itself and its label below.
  const radius = systemRadius + 1.5;

  const fits = (distance: number) => {
    const cameraPos = direction.clone().multiplyScalar(distance);
    const rel = new THREE.Vector3();
    for (let i = 0; i < 64; i += 1) {
      const angle = (i / 64) * Math.PI * 2;
      rel.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius).sub(cameraPos);
      const depth = rel.dot(forward);
      if (depth <= 0.1) return false;
      if (Math.abs(rel.dot(right)) / depth > tanX) return false;
      if (Math.abs(rel.dot(up)) / depth > tanY) return false;
    }
    return true;
  };

  let low = 4;
  let high = 400;
  for (let iteration = 0; iteration < 28; iteration += 1) {
    const mid = (low + high) / 2;
    if (fits(mid)) high = mid;
    else low = mid;
  }
  return direction.multiplyScalar(high);
}

function easeInOutCubic(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
