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
}

export const CosmosOrbitRig: React.FC<Props> = ({ domains }) => {
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
      return { id: domain.id, points, color: domain.color, tiltX, tiltZ };
    });
  }, [domains]);

  return (
    <group>
      {orbits.map(({ id, points, color, tiltX, tiltZ }) => (
        <group key={id} rotation={[tiltX, 0, tiltZ]}>
          <Line
            points={points}
            color={color}
            lineWidth={0.5}
            transparent
            opacity={0.11}
          />
        </group>
      ))}
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
