/**
 * CosmosOrbitRig.tsx - Orbit path visualizer
 * Draws faint orbit circles for each domain planet.
 */

import React, { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { CameraMode, CosmosDomain } from './CosmosTypes';

interface Props {
  domains: CosmosDomain[];
  cameraMode: CameraMode;
  focusedDomainId?: string | null;
}

export const CosmosOrbitRig: React.FC<Props> = ({ domains, cameraMode, focusedDomainId }) => {
  const orbits = useMemo(() => {
    return domains.map((domain) => {
      const seed = hashString(domain.id);
      const inclination = (((seed % 18) - 9) * Math.PI) / 180;
      const eccentricity = 0.82 + (((seed >> 3) % 16) / 100);
      const phase = ((seed >> 8) % 628) / 100;
      const orbitConfig: OrbitConfig = {
        inclination,
        eccentricity,
        phase,
      };
      const segments = 120;
      const points: [number, number, number][] = [];
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(getOrbitPosition(angle, domain.orbitRadius, orbitConfig));
      }
      const orbitColor = new THREE.Color(domain.color)
        .lerp(new THREE.Color('#9fb2d6'), 0.72)
        .getStyle();
      return { id: domain.id, points, color: orbitColor, radius: domain.orbitRadius };
    });
  }, [domains]);

  const focusedIndex = focusedDomainId
    ? Math.max(0, domains.findIndex((domain) => domain.id === focusedDomainId))
    : -1;
  const minRadius = Math.min(...domains.map((domain) => domain.orbitRadius));
  const maxRadius = Math.max(...domains.map((domain) => domain.orbitRadius));

  return (
    <group>
      {orbits.map(({ id, points, color, radius }, index) => {
        const isFocused = focusedDomainId === id;
        const hasFocused = Boolean(focusedDomainId);
        const indexDistance = focusedIndex >= 0 ? Math.abs(index - focusedIndex) : Number.MAX_SAFE_INTEGER;
        const isNeighbor = indexDistance === 1;
        const isVisibleInMode =
          cameraMode === 'system' ||
          isFocused ||
          (cameraMode === 'focus' && isNeighbor);

        if (!isVisibleInMode) return null;

        const orbitDepthFade =
          maxRadius > minRadius
            ? THREE.MathUtils.lerp(1, 0.38, (radius - minRadius) / (maxRadius - minRadius))
            : 1;

        const baseOpacity =
          cameraMode === 'detail'
            ? isFocused
              ? 0.13
              : 0
            : cameraMode === 'focus'
            ? isFocused
              ? 0.11
              : 0.022
            : isFocused
            ? 0.1
            : hasFocused
            ? 0.024
            : 0.042;

        const opacity = baseOpacity * orbitDepthFade;
        const width = isFocused ? 1.05 : 0.55;

        return (
          <Line
            key={id}
            points={points}
            color={color}
            lineWidth={width}
            transparent
            opacity={opacity}
          />
        );
      })}
    </group>
  );
};

type OrbitConfig = {
  inclination: number;
  eccentricity: number;
  phase: number;
};

function getOrbitPosition(
  angle: number,
  orbitRadius: number,
  orbitConfig: OrbitConfig
): [number, number, number] {
  const x = Math.cos(angle) * orbitRadius;
  const z = Math.sin(angle) * orbitRadius * orbitConfig.eccentricity;
  const y =
    Math.sin(angle + orbitConfig.phase) *
    orbitRadius *
    Math.sin(orbitConfig.inclination) *
    0.22;
  return [x, y, z];
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}
