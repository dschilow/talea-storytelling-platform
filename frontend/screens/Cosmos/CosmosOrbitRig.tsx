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
      return { id: domain.id, points, color: domain.color };
    });
  }, [domains]);

  return (
    <group>
      {orbits.map(({ id, points, color }) => (
        <Line
          key={id}
          points={points}
          color={color}
          lineWidth={0.5}
          transparent
          opacity={0.12}
        />
      ))}
    </group>
  );
};
