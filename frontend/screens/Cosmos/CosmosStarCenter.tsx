/**
 * CosmosStarCenter.tsx - The child's central star
 * Warm, glowing sun at the center of the cosmos.
 * "Du bist der Mittelpunkt deines Lernkosmos."
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';

interface Props {
  avatarImageUrl?: string;
}

const STAR_GLOW_VERTEX = `
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const STAR_GLOW_FRAGMENT = `
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uPower;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - max(dot(normalize(vNormalW), viewDir), 0.0), uPower);
    float alpha = fresnel * uOpacity;
    vec3 color = uColor * (0.58 + fresnel * 0.95);
    gl_FragColor = vec4(color, alpha);
  }
`;

const STAR_CORONA_FRAGMENT = `
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;

  float noise3(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
  }

  void main() {
    vec3 n = normalize(vNormalW);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 1.9);
    float flicker = 0.72 + noise3(n * 21.0 + uTime * 0.16) * 0.5;
    float alpha = fresnel * uOpacity * flicker;
    vec3 color = uColor * (0.65 + fresnel * 1.05);
    gl_FragColor = vec4(color, alpha);
  }
`;

export const CosmosStarCenter: React.FC<Props> = ({ avatarImageUrl }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);
  const coronaRef = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);

  // Subtle pulsating animation
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = 1 + Math.sin(t * 1.5) * 0.04;

    if (meshRef.current) {
      meshRef.current.scale.setScalar(pulse);
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(pulse * 1.85);
      const glowMaterial = glowRef.current.material as THREE.ShaderMaterial;
      glowMaterial.uniforms.uOpacity.value = 0.18 + Math.sin(t * 2.1) * 0.03;
    }
    if (coronaRef.current) {
      coronaRef.current.scale.setScalar(2 + Math.sin(t * 0.8) * 0.08);
      const coronaMaterial = coronaRef.current.material as THREE.ShaderMaterial;
      coronaMaterial.uniforms.uOpacity.value = 0.12 + Math.sin(t * 1.1) * 0.025;
      coronaMaterial.uniforms.uTime.value = t;
      coronaRef.current.rotation.y += 0.0008;
      coronaRef.current.rotation.z += 0.0004;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 3.1 + Math.sin(t * 1.5) * 0.35;
    }
  });

  const starMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#fff4d6'),
        emissive: new THREE.Color('#ffb347'),
        emissiveIntensity: 1.9,
        roughness: 0.16,
        metalness: 0.02,
        clearcoat: 0.28,
        clearcoatRoughness: 0.42,
      }),
    []
  );

  const glowMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color('#ffd289') },
          uOpacity: { value: 0.18 },
          uPower: { value: 2.25 },
        },
        vertexShader: STAR_GLOW_VERTEX,
        fragmentShader: STAR_GLOW_FRAGMENT,
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  const coronaMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color('#ffb36b') },
          uOpacity: { value: 0.12 },
          uTime: { value: 0 },
        },
        vertexShader: STAR_GLOW_VERTEX,
        fragmentShader: STAR_CORONA_FRAGMENT,
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  useEffect(() => {
    return () => {
      starMaterial.dispose();
      glowMaterial.dispose();
      coronaMaterial.dispose();
    };
  }, [coronaMaterial, glowMaterial, starMaterial]);

  return (
    <group>
      {/* Main star body */}
      <Sphere ref={meshRef} args={[1.5, 64, 64]} material={starMaterial} />

      {/* Soft outer glow */}
      <Sphere ref={glowRef} args={[1.7, 32, 32]} material={glowMaterial} />
      <Sphere ref={coronaRef} args={[3.2, 28, 28]} material={coronaMaterial} />

      {/* Point light illuminating planets */}
      <pointLight
        ref={lightRef}
        color="#fff4d6"
        intensity={3.1}
        distance={74}
        decay={1.35}
      />

      {/* Ambient fill so planets aren't pitch black on the far side */}
      <ambientLight intensity={0.11} color="#b8c4ff" />
      <hemisphereLight intensity={0.2} color="#a2c6ff" groundColor="#1b112f" />
    </group>
  );
};
