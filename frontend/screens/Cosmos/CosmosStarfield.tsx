/**
 * CosmosStarfield.tsx - Procedural star layer with soft round sprites.
 *
 * Uses `points` for performance (single draw-call per layer).
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Props {
  count?: number;
  radius?: number;
  driftSpeed?: number;
  twinkleStrength?: number;
  sizeRange?: [number, number];
  opacity?: number;
}

const STARFIELD_VERTEX = `
  attribute float aSize;
  attribute float aTwinkle;
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uTwinkleStrength;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float twinkleBase = sin(uTime * (0.45 + aTwinkle * 1.8) + aTwinkle * 6.28318530718);
    float twinkle = 0.78 + 0.22 * twinkleBase * uTwinkleStrength;
    float perspective = 108.0 / max(18.0, -mvPosition.z);
    float pointSize = aSize * twinkle * uPixelRatio * perspective;

    gl_PointSize = clamp(pointSize, 0.4, 2.6);
    gl_Position = projectionMatrix * mvPosition;

    vColor = aColor;
    vAlpha = twinkle;
  }
`;

const STARFIELD_FRAGMENT = `
  varying vec3 vColor;
  varying float vAlpha;
  uniform float uOpacity;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;

    float core = smoothstep(0.2, 0.0, dist);
    float halo = smoothstep(0.5, 0.15, dist) * 0.35;
    float alpha = (core + halo) * vAlpha * uOpacity;

    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

export const CosmosStarfield: React.FC<Props> = ({
  count = 1200,
  radius = 80,
  driftSpeed = 0.0002,
  twinkleStrength = 1,
  sizeRange = [0.55, 1.8],
  opacity = 1,
}) => {
  const pointsRef = useRef<THREE.Points>(null!);

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const twinkles = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius + Math.random() * 40;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const temperature = sampleStarTemperature(Math.random());
      const color = blackbodyColor(temperature);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      // Many small stars, few larger stars.
      const sizeBias = Math.pow(Math.random(), 1.8);
      sizes[i] = sizeRange[0] + sizeBias * (sizeRange[1] - sizeRange[0]);
      twinkles[i] = Math.random();
    }

    const bufferGeometry = new THREE.BufferGeometry();
    bufferGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    bufferGeometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    bufferGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    bufferGeometry.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkles, 1));

    const shaderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: {
          value:
            typeof window === 'undefined'
              ? 1
              : Math.min(window.devicePixelRatio || 1, 2),
        },
        uTwinkleStrength: { value: twinkleStrength },
        uOpacity: { value: opacity },
      },
      vertexShader: STARFIELD_VERTEX,
      fragmentShader: STARFIELD_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return {
      geometry: bufferGeometry,
      material: shaderMaterial,
    };
  }, [count, opacity, radius, sizeRange, twinkleStrength]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    material.uniforms.uTime.value = t;
    if (pointsRef.current) {
      pointsRef.current.rotation.y += driftSpeed;
      pointsRef.current.rotation.x = Math.sin(t * driftSpeed * 80) * 0.012;
    }
  });

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <primitive object={material} attach="material" />
    </points>
  );
};

function sampleStarTemperature(randomValue: number): number {
  if (randomValue < 0.01) return 11000 + randomValue * 600000;
  if (randomValue < 0.06) return 7200 + randomValue * 60000;
  if (randomValue < 0.2) return 5600 + randomValue * 8000;
  if (randomValue < 0.48) return 4300 + randomValue * 5000;
  return 2800 + randomValue * 2600;
}

function blackbodyColor(tempK: number): THREE.Color {
  const t = Math.max(1000, Math.min(40000, tempK)) / 100;
  let r: number;
  let g: number;
  let b: number;

  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }

  const normalize = (value: number) => Math.min(255, Math.max(0, value)) / 255;
  return new THREE.Color(normalize(r), normalize(g), normalize(b));
}
