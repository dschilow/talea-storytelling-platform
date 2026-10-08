/**
 * CosmosOrbitRig.tsx - Orbit paths with a glowing trail behind every planet.
 *
 * Each orbit is one thin line whose brightness fades along the path behind the
 * planet (read from the shared orbit angles), like a comet tail.
 */

import React, { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CameraMode, CosmosDomain } from './CosmosTypes';
import { getOrbitConfig, getOrbitPosition, type OrbitLayout } from './CosmosOrbit';

interface Props {
  domains: CosmosDomain[];
  cameraMode: CameraMode;
  focusedDomainId?: string | null;
  orbitLayout?: OrbitLayout;
  orbitAngles: React.MutableRefObject<Map<string, number>>;
}

const SEGMENTS = 256;

const ORBIT_VERTEX = /* glsl */ `
attribute float aAngle;
varying float vAngle;
void main() {
  vAngle = aAngle;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const ORBIT_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uPlanetAngle;
uniform float uBase;
uniform float uTrail;
varying float vAngle;
const float TAU = 6.28318530718;
void main() {
  float behind = mod(uPlanetAngle - vAngle, TAU) / TAU;
  float trail = pow(1.0 - behind, 7.0);
  float alpha = uBase + uTrail * trail;
  gl_FragColor = vec4(uColor * (1.0 + trail * 0.6), alpha);
  #include <colorspace_fragment>
}
`;

export const CosmosOrbitRig: React.FC<Props> = ({
  domains,
  cameraMode,
  focusedDomainId,
  orbitLayout = { scale: 1, stretch: 1 },
  orbitAngles,
}) => {
  const orbits = useMemo(
    () =>
      domains.map((domain) => {
        const config = getOrbitConfig(domain.id);
        const positions = new Float32Array((SEGMENTS + 1) * 3);
        const angles = new Float32Array(SEGMENTS + 1);
        for (let i = 0; i <= SEGMENTS; i += 1) {
          const angle = (i / SEGMENTS) * Math.PI * 2;
          const [x, y, z] = getOrbitPosition(angle, domain.orbitRadius * orbitLayout.scale, config, orbitLayout.stretch);
          positions[i * 3] = x;
          positions[i * 3 + 1] = y;
          positions[i * 3 + 2] = z;
          angles[i] = angle;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));
        const material = new THREE.ShaderMaterial({
          uniforms: {
            uColor: { value: new THREE.Color(domain.color).lerp(new THREE.Color('#c7d2fe'), 0.45) },
            uPlanetAngle: { value: domain.startAngle },
            uBase: { value: 0.05 },
            uTrail: { value: 0.4 },
          },
          vertexShader: ORBIT_VERTEX,
          fragmentShader: ORBIT_FRAGMENT,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const line = new THREE.Line(geometry, material);
        line.frustumCulled = false;
        return { id: domain.id, line, material, geometry };
      }),
    [domains, orbitLayout.scale, orbitLayout.stretch]
  );

  useEffect(
    () => () => {
      for (const orbit of orbits) {
        orbit.geometry.dispose();
        orbit.material.dispose();
      }
    },
    [orbits]
  );

  const focusedIndex = focusedDomainId ? domains.findIndex((domain) => domain.id === focusedDomainId) : -1;

  useFrame(() => {
    orbits.forEach((orbit, index) => {
      const angle = orbitAngles.current.get(orbit.id);
      if (angle !== undefined) {
        // The shader expects the angle on the drawn circle (0..2PI).
        orbit.material.uniforms.uPlanetAngle.value = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      }

      const isFocused = orbit.id === focusedDomainId;
      const isNeighbor = focusedIndex >= 0 && Math.abs(index - focusedIndex) === 1;
      let base = 0.05;
      let trail = 0.42;
      if (cameraMode === 'focus') {
        base = isFocused ? 0.07 : isNeighbor ? 0.02 : 0;
        trail = isFocused ? 0.3 : isNeighbor ? 0.1 : 0;
      } else if (cameraMode === 'detail') {
        base = isFocused ? 0.05 : 0;
        trail = isFocused ? 0.18 : 0;
      } else if (focusedDomainId && !isFocused) {
        base = 0.035;
      }
      orbit.line.visible = base > 0 || trail > 0;
      orbit.material.uniforms.uBase.value = base;
      orbit.material.uniforms.uTrail.value = trail;
    });
  });

  return (
    <group>
      {orbits.map((orbit) => (
        <primitive key={orbit.id} object={orbit.line} />
      ))}
    </group>
  );
};
