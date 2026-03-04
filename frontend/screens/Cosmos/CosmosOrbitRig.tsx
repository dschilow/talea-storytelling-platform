/**
 * CosmosOrbitRig.tsx - Orbit path visualizer
 * Draws faint orbit circles for each domain planet.
 */

import React, { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { CosmosDomain } from './CosmosTypes';

interface Props {
  domains: CosmosDomain[];
  focusedDomainId?: string | null;
}

export const CosmosOrbitRig: React.FC<Props> = ({ domains, focusedDomainId }) => {
  const orbits = useMemo(() => {
    return domains.map((domain) => {
      const seed = hashString(domain.id);
      const tiltX = (((seed % 10) - 5) * Math.PI) / 180;
      const tiltZ = ((((seed >> 3) % 10) - 5) * Math.PI) / 180;
      const segments = 64;
      const points: [number, number, number][] = [];
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push([
          Math.cos(angle) * domain.orbitRadius,
          0,
          Math.sin(angle) * domain.orbitRadius,
        ]);
      }
      const orbitColor = new THREE.Color(domain.color)
        .lerp(new THREE.Color('#9fb2d6'), 0.72)
        .getStyle();
      return { id: domain.id, points, color: orbitColor, tiltX, tiltZ };
    });
  }, [domains]);

  return (
    <group>
      {orbits.map(({ id, points, color, tiltX, tiltZ }) => {
        const isFocused = focusedDomainId === id;
        const hasFocused = Boolean(focusedDomainId);
        const opacity = isFocused ? 0.16 : hasFocused ? 0.025 : 0.055;
        const width = isFocused ? 1.4 : 0.8;

        return (
        <group key={id} rotation={[tiltX, 0, tiltZ]}>
          <Line
            points={points}
            color={color}
            lineWidth={width}
            transparent
            opacity={opacity}
          />
        </group>
      );
      })}
    </group>
  );
};

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}
