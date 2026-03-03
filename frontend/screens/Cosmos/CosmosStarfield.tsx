/**
 * CosmosStarfield.tsx - Procedural starfield background
 *
 * Uses instanced points for performance.
 * 4000 stars, no textures needed.
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';

interface Props {
  count?: number;
  radius?: number;
}

export const CosmosStarfield: React.FC<Props> = ({
  count = 4000,
  radius = 80,
}) => {
  const [positions, sizes] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Distribute on sphere surface, then push outward
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius + Math.random() * 20;

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      sz[i] = 0.3 + Math.random() * 1.2;
    }

    return [pos, sz];
  }, [count, radius]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, [positions, sizes]);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color="#c8d6e5"
        size={0.15}
        sizeAttenuation
        transparent
        opacity={0.8}
        depthWrite={false}
      />
    </points>
  );
};
