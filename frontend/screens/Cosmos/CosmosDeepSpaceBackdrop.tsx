/**
 * CosmosDeepSpaceBackdrop.tsx - Cinematic deep-space layers
 *
 * Adds a soft Milky Way style band and volumetric-like nebula billboards
 * to avoid flat "2D wallpaper" feeling.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';

const VERTEX_SHADER = `
  varying vec3 vWorldDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldDir = normalize(worldPos.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  varying vec3 vWorldDir;
  uniform float uTime;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    float milkyBand = exp(-pow((dir.y * 0.55 + dir.x * 0.22), 2.0) / 0.032);
    float dustLanes = 0.45 + 0.55 * sin(dir.x * 28.0 + dir.z * 34.0 + uTime * 0.02);
    float starNoise = hash(floor(dir * 140.0));
    float tinyStars = smoothstep(0.984, 1.0, starNoise) * 0.5;

    vec3 cool = vec3(0.19, 0.26, 0.44);
    vec3 warm = vec3(0.42, 0.3, 0.18);
    vec3 bandColor = mix(cool, warm, clamp(dir.x * 0.5 + 0.5, 0.0, 1.0));
    vec3 color = bandColor * milkyBand * dustLanes * 0.55;
    color += vec3(tinyStars);

    float alpha = clamp(milkyBand * 0.42 + tinyStars * 0.65, 0.0, 0.55);
    gl_FragColor = vec4(color, alpha);
  }
`;

export const CosmosDeepSpaceBackdrop: React.FC = () => {
  const skyRef = useRef<THREE.Mesh>(null!);

  const skyMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  const nebulaMaps = useMemo(
    () => [
      createNebulaTexture(['#4d7cff', '#5dd6ff', '#8f75ff']),
      createNebulaTexture(['#ff7bbb', '#ff9a6b', '#ffe18c']),
      createNebulaTexture(['#5ce3b7', '#49a9ff', '#a4f1ff']),
    ],
    []
  );

  useEffect(() => {
    return () => {
      skyMaterial.dispose();
      nebulaMaps.forEach((map) => map.dispose());
    };
  }, [nebulaMaps, skyMaterial]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    skyMaterial.uniforms.uTime.value = t;
    if (skyRef.current) {
      skyRef.current.rotation.y = t * 0.008;
      skyRef.current.rotation.z = Math.sin(t * 0.05) * 0.03;
    }
  });

  return (
    <group>
      <mesh ref={skyRef} scale={[160, 160, 160]} material={skyMaterial}>
        <sphereGeometry args={[1, 64, 64]} />
      </mesh>

      <Billboard position={[-46, 16, -82]} follow={false} lockX={false} lockY={false} lockZ={false}>
        <mesh>
          <planeGeometry args={[52, 30]} />
          <meshBasicMaterial
            map={nebulaMaps[0]}
            transparent
            opacity={0.28}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </Billboard>

      <Billboard position={[58, 28, -68]} follow={false} lockX={false} lockY={false} lockZ={false}>
        <mesh rotation={[0, 0, -0.25]}>
          <planeGeometry args={[46, 28]} />
          <meshBasicMaterial
            map={nebulaMaps[1]}
            transparent
            opacity={0.22}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </Billboard>

      <Billboard position={[14, -24, -88]} follow={false} lockX={false} lockY={false} lockZ={false}>
        <mesh rotation={[0, 0, 0.2]}>
          <planeGeometry args={[62, 34]} />
          <meshBasicMaterial
            map={nebulaMaps[2]}
            transparent
            opacity={0.16}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </Billboard>
    </group>
  );
};

function createNebulaTexture(colors: [string, string, string] | string[]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const size = 512;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create 2D context for nebula texture');
  }

  ctx.clearRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'screen';

  const radialCenters = [
    { x: size * 0.36, y: size * 0.46, r: size * 0.34, color: colors[0] },
    { x: size * 0.58, y: size * 0.42, r: size * 0.28, color: colors[1] },
    { x: size * 0.49, y: size * 0.62, r: size * 0.36, color: colors[2] },
  ];

  radialCenters.forEach((center) => {
    const grad = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, center.r);
    grad.addColorStop(0, withAlpha(center.color, 0.55));
    grad.addColorStop(0.38, withAlpha(center.color, 0.28));
    grad.addColorStop(0.74, withAlpha(center.color, 0.08));
    grad.addColorStop(1, withAlpha(center.color, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  });

  const data = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const nx = x / size;
      const ny = y / size;
      const noise = fbm2D(nx * 4.8, ny * 4.8, 5);
      const alpha = data.data[i + 3] * (0.62 + noise * 0.58);
      data.data[i + 3] = Math.max(0, Math.min(255, Math.round(alpha)));
    }
  }
  ctx.putImageData(data, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function withAlpha(hex: string, alpha: number): string {
  const c = new THREE.Color(hex);
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  return `rgba(${r},${g},${b},${alpha})`;
}

function fbm2D(x: number, y: number, octaves: number): number {
  let amplitude = 0.5;
  let frequency = 1;
  let value = 0;
  let max = 0;
  for (let i = 0; i < octaves; i += 1) {
    value += noise2D(x * frequency, y * frequency) * amplitude;
    max += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return max > 0 ? value / max : 0;
}

function noise2D(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}
