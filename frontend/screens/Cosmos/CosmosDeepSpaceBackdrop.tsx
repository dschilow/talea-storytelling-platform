/**
 * CosmosDeepSpaceBackdrop.tsx - Cinematic deep-space layers
 *
 * Adds a soft Milky Way style band and volumetric-like nebula billboards
 * to avoid flat "2D wallpaper" feeling.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Props {
  enabledNebulaBillboards?: boolean;
  nebulaTextureSize?: number;
}

const VERTEX_SHADER = `
  varying vec3 vWorldPos;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  varying vec3 vWorldPos;
  uniform float uTime;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = hash(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash(i + vec3(1.0, 1.0, 1.0));

    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);
    float nxy0 = mix(nx00, nx10, f.y);
    float nxy1 = mix(nx01, nx11, f.y);
    return mix(nxy0, nxy1, f.z);
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      value += noise(p) * amp;
      p *= 2.05;
      amp *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 dir = normalize(vWorldPos - cameraPosition);
    float milkyBand = exp(-pow((dir.y * 0.58 + dir.x * 0.24), 2.0) / 0.042);
    float nebula = fbm(dir * 6.5 + vec3(0.0, 0.0, uTime * 0.01));
    float dust = fbm(dir * 13.0 - vec3(uTime * 0.003, 0.0, 0.0));
    float starNoiseA = hash(dir * 1900.0 + vec3(17.0, 29.0, 41.0));
    float starNoiseB = hash(dir * 620.0 + vec3(67.0, 11.0, 91.0));
    float tinyStars = smoothstep(0.9974, 1.0, starNoiseA);
    float brightStars = smoothstep(0.9992, 1.0, starNoiseB) * 0.92;

    vec3 cool = vec3(0.08, 0.12, 0.25);
    vec3 warm = vec3(0.24, 0.17, 0.31);
    vec3 bandColor = mix(cool, warm, clamp(dir.x * 0.5 + 0.5, 0.0, 1.0));
    vec3 starColor = mix(vec3(0.82, 0.88, 1.0), vec3(1.0, 0.95, 0.86), hash(dir * 740.0));

    vec3 nebulaColor = bandColor * milkyBand * (0.42 + nebula * 0.48) * (0.54 + dust * 0.32);
    vec3 color = nebulaColor + starColor * (tinyStars * 0.7 + brightStars * 1.1);
    float alpha = clamp(milkyBand * 0.3 + tinyStars * 0.42 + brightStars * 0.7, 0.0, 0.52);

    gl_FragColor = vec4(color, alpha);
  }
`;

export const CosmosDeepSpaceBackdrop: React.FC<Props> = ({
  enabledNebulaBillboards = true,
  nebulaTextureSize = 1024,
}) => {
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
      createNebulaTexture(['#4d7cff', '#5dd6ff', '#8f75ff'], nebulaTextureSize),
      createNebulaTexture(['#ff7bbb', '#ff9a6b', '#ffe18c'], nebulaTextureSize),
      createNebulaTexture(['#5ce3b7', '#49a9ff', '#a4f1ff'], nebulaTextureSize),
    ],
    [nebulaTextureSize]
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
        <sphereGeometry args={[1, 112, 112]} />
      </mesh>

      {enabledNebulaBillboards && (
        <>
          <mesh position={[-52, 22, -100]} rotation={[0.42, -0.52, 0.34]}>
            <planeGeometry args={[42, 26]} />
            <meshBasicMaterial
              map={nebulaMaps[0]}
              transparent
              opacity={0.1}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
            />
          </mesh>

          <mesh position={[66, 34, -88]} rotation={[0.18, 0.4, -0.22]}>
            <planeGeometry args={[38, 24]} />
            <meshBasicMaterial
              map={nebulaMaps[1]}
              transparent
              opacity={0.08}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
            />
          </mesh>

          <mesh position={[8, -20, -110]} rotation={[-0.26, 0.12, 0.48]}>
            <planeGeometry args={[56, 28]} />
            <meshBasicMaterial
              map={nebulaMaps[2]}
              transparent
              opacity={0.06}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      )}
    </group>
  );
};

function createNebulaTexture(
  colors: [string, string, string] | string[],
  textureSize: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const size = textureSize;
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
      const largeNoise = fbm2D(nx * 2.1, ny * 2.1, 4);
      const detailNoise = fbm2D(nx * 6.4, ny * 6.4, 3);
      const noiseMix = largeNoise * 0.72 + detailNoise * 0.28;
      const alpha = data.data[i + 3] * (0.72 + noiseMix * 0.24);
      data.data[i + 3] = Math.max(0, Math.min(255, Math.round(alpha)));
    }
  }
  ctx.putImageData(data, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
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
