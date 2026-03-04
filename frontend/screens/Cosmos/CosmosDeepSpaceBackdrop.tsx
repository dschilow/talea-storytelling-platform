/**
 * CosmosDeepSpaceBackdrop.tsx - Cinematic deep-space layers
 *
 * Highly realistic procedural raymarching background that gives an
 * INFINITE 3D volumetric feel rather than a flat wallpaper.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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

  // 3D Noise and FBM
  vec3 hash33(vec3 p) {
    p = vec3(dot(p,vec3(127.1,311.7, 74.7)),
             dot(p,vec3(269.5,183.3,246.1)),
             dot(p,vec3(113.5,271.9,124.6)));
    return fract(sin(p)*43758.5453123);
  }

  float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = dot(hash33(i + vec3(0.0,0.0,0.0)), f - vec3(0.0,0.0,0.0));
    float n100 = dot(hash33(i + vec3(1.0,0.0,0.0)), f - vec3(1.0,0.0,0.0));
    float n010 = dot(hash33(i + vec3(0.0,1.0,0.0)), f - vec3(0.0,1.0,0.0));
    float n110 = dot(hash33(i + vec3(1.0,1.0,0.0)), f - vec3(1.0,1.0,0.0));
    float n001 = dot(hash33(i + vec3(0.0,0.0,1.0)), f - vec3(0.0,0.0,1.0));
    float n101 = dot(hash33(i + vec3(1.0,0.0,1.0)), f - vec3(1.0,0.0,1.0));
    float n011 = dot(hash33(i + vec3(0.0,1.0,1.0)), f - vec3(0.0,1.0,1.0));
    float n111 = dot(hash33(i + vec3(1.0,1.0,1.0)), f - vec3(1.0,1.0,1.0));

    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);

    float nxy0 = mix(nx00, nx10, f.y);
    float nxy1 = mix(nx01, nx11, f.y);

    return mix(nxy0, nxy1, f.z) * 0.5 + 0.5;
  }

  float fbm(vec3 p) {
    float f = 0.0;
    float w = 0.5;
    for (int i = 0; i < 5; i++) {
      f += w * noise3D(p);
      p *= 2.1;
      w *= 0.5;
    }
    return f;
  }

  float mapExt(float value, float min1, float max1, float min2, float max2) {
    return clamp(min2 + (value - min1) * (max2 - min2) / (max1 - min1), min2, max2);
  }

  // Realistic deep space nebula map
  vec3 skyMap(vec3 dir, float time) {
    // Galactic plane
    float band = exp(-pow(dir.y * 1.5 + sin(dir.x * 2.0)*0.2, 2.0) / 0.1) * 0.15;
    band += exp(-pow(dir.y * 0.8 - cos(dir.z * 1.5)*0.3, 2.0) / 0.3) * 0.05;

    // Deep volumetric nebulas
    vec3 p = dir * 2.5 + vec3(time * 0.005);
    float n1 = fbm(p * 1.2);
    float n2 = fbm(p * 2.8 - vec3(time * 0.007));
    float n3 = fbm(p * 5.5 + vec3(time * 0.003));

    // Colors mimicking Hubble pallet (OIII, Ha, SII)
    vec3 colOIII = vec3(0.1, 0.6, 0.8) * mapExt(n1, 0.4, 1.0, 0.0, 1.0) * 1.5;
    vec3 colHa = vec3(0.9, 0.2, 0.3) * mapExt(n2, 0.5, 1.0, 0.0, 1.0) * 1.2;
    vec3 colSII = vec3(0.7, 0.5, 0.1) * mapExt(n3, 0.6, 1.0, 0.0, 1.0) * 0.9;

    vec3 baseColor = (colOIII + colHa + colSII) * band;
    
    // Add dark dust lanes
    float dust = fbm(dir * 4.0 + vec3(5.0));
    baseColor *= smoothstep(0.3, 0.7, dust);

    // Infinite tiny background stars embedded in the texture
    float starDensity = 0.999;
    float starSignal = noise3D(dir * 300.0);
    float starFlash = step(starDensity, starSignal) * (1.0 + sin(time * 2.0 + dir.x * 1000.0) * 0.5);
    baseColor += starFlash * vec3(0.9, 0.95, 1.0) * band;

    // Ambient space void
    vec3 voidColor = vec3(0.002, 0.004, 0.008);
    return baseColor + voidColor;
  }

  void main() {
    vec3 dir = normalize(vWorldPos - cameraPosition);
    vec3 color = skyMap(dir, uTime);

    gl_FragColor = vec4(color, 1.0);
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
        depthWrite: false, // Don't occlude the scene
      }),
    []
  );

  useEffect(() => {
    return () => {
      skyMaterial.dispose();
    };
  }, [skyMaterial]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    skyMaterial.uniforms.uTime.value = t;
    if (skyRef.current) {
      skyRef.current.rotation.y = t * 0.005;
      skyRef.current.rotation.x = t * 0.001;
    }
  });

  return (
    <mesh ref={skyRef} scale={[200, 200, 200]} material={skyMaterial}>
      <sphereGeometry args={[1, 64, 64]} />
    </mesh>
  );
};
