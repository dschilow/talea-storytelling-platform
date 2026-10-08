/**
 * CosmosShootingStars.tsx - An occasional shooting star far behind the planets.
 *
 * One streak quad, re-launched every few seconds on a random path across the
 * sky sphere. Costs a single draw call.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const STREAK_FRAGMENT = /* glsl */ `
uniform float uOpacity;
varying vec2 vUv;
void main() {
  // Bright head on the right, fading tail to the left, soft across the width.
  float along = vUv.x;
  float across = 1.0 - abs(vUv.y - 0.5) * 2.0;
  float tail = pow(along, 3.0);
  float head = smoothstep(0.9, 1.0, along);
  float alpha = (tail * 0.85 + head) * pow(across, 2.2) * uOpacity;
  vec3 color = mix(vec3(0.6, 0.75, 1.0), vec3(1.0, 0.98, 0.92), along);
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;

const STREAK_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const CosmosShootingStars: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const flight = useRef({
    start: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    startedAt: -100,
    duration: 1.1,
    nextAt: 3 + Math.random() * 4,
  });

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uOpacity: { value: 0 } },
        vertexShader: STREAK_VERTEX,
        fragmentShader: STREAK_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    []
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock, camera }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    const state = flight.current;

    if (t >= state.nextAt) {
      // Launch somewhere in the upper sky, on a sphere far behind the system.
      const theta = Math.random() * Math.PI * 2;
      const phi = 0.35 + Math.random() * 0.5;
      const radius = 135;
      state.start.set(
        Math.cos(theta) * Math.sin(phi) * radius,
        Math.cos(phi) * radius * 0.6 + 10,
        Math.sin(theta) * Math.sin(phi) * radius
      );
      const tangent = new THREE.Vector3(-Math.sin(theta), -0.35 - Math.random() * 0.3, Math.cos(theta));
      state.direction.copy(tangent.normalize());
      state.startedAt = t;
      state.duration = 0.9 + Math.random() * 0.6;
      state.nextAt = t + 6 + Math.random() * 9;
    }

    const k = (t - state.startedAt) / state.duration;
    if (k < 0 || k > 1) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    const travel = 48;
    mesh.position.copy(state.start).addScaledVector(state.direction, travel * k);
    // Face the camera while pointing along the flight direction.
    const toCamera = new THREE.Vector3().subVectors(camera.position, mesh.position).normalize();
    const side = new THREE.Vector3().crossVectors(state.direction, toCamera).normalize();
    const normal = new THREE.Vector3().crossVectors(side, state.direction).normalize();
    const basis = new THREE.Matrix4().makeBasis(state.direction, side, normal);
    mesh.quaternion.setFromRotationMatrix(basis);
    material.uniforms.uOpacity.value = Math.sin(Math.PI * k) * 0.9;
  });

  return (
    <mesh ref={meshRef} material={material} visible={false} frustumCulled={false}>
      <planeGeometry args={[14, 0.32]} />
    </mesh>
  );
};
