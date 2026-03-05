/**
 * CosmosStarCenter.tsx - The child's central star
 * Warm, glowing sun at the center of the cosmos.
 * Uses billboard sprite for soft volumetric glow (no hard shell rings).
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, ThreeEvent, useLoader } from '@react-three/fiber';
import { Sphere, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import type { CameraMode } from './CosmosTypes';

interface Props {
  avatarImageUrl?: string;
  cameraMode: CameraMode;
  godRaysDuration?: number;
  onSelect?: () => void;
}

// Soft radial glow texture generated once
function createGlowTexture(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const center = size / 2;

  // Multi-layer radial gradient for natural falloff
  const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
  grad.addColorStop(0, 'rgba(255, 242, 205, 0.95)');
  grad.addColorStop(0.08, 'rgba(255, 226, 165, 0.7)');
  grad.addColorStop(0.18, 'rgba(255, 202, 124, 0.4)');
  grad.addColorStop(0.34, 'rgba(255, 176, 90, 0.2)');
  grad.addColorStop(0.52, 'rgba(255, 154, 64, 0.08)');
  grad.addColorStop(0.72, 'rgba(255, 132, 44, 0.022)');
  grad.addColorStop(1, 'rgba(255, 100, 30, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Add subtle noise for organic feel
  const imageData = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = (x - center) / center;
      const dy = (y - center) / center;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.12 && dist < 0.7) {
        const noise = (Math.sin(x * 0.08 + y * 0.12) * Math.cos(x * 0.05 - y * 0.09)) * 0.08;
        const alpha = imageData.data[i + 3];
        imageData.data[i + 3] = Math.max(0, Math.min(255, alpha + alpha * noise));
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// Corona texture with filament-like rays
function createCoronaTexture(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const center = size / 2;

  ctx.clearRect(0, 0, size, size);

  // Soft, long rays with tapered alpha gradient.
  // +20% rays vs previous baseline for denser, more cinematic corona.
  const rayCount = 116;
  for (let r = 0; r < rayCount; r++) {
    const angle = (r / rayCount) * Math.PI * 2;
    const length = center * (0.46 + Math.random() * 0.5);
    const width = 0.8 + Math.random() * 2.8;
    const opacity = 0.025 + Math.random() * 0.06;

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(angle);

    const grad = ctx.createLinearGradient(0, 0, length, 0);
    grad.addColorStop(0, 'rgba(255, 210, 130, 0)');
    grad.addColorStop(0.2, `rgba(255, 196, 108, ${opacity})`);
    grad.addColorStop(0.58, `rgba(255, 173, 84, ${opacity * 0.42})`);
    grad.addColorStop(1, 'rgba(255, 140, 50, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, -width / 2, length, width);
    ctx.restore();
  }

  const outerGrad = ctx.createRadialGradient(center, center, center * 0.18, center, center, center);
  outerGrad.addColorStop(0, 'rgba(255, 224, 150, 0.22)');
  outerGrad.addColorStop(0.45, 'rgba(255, 188, 102, 0.1)');
  outerGrad.addColorStop(0.76, 'rgba(255, 162, 78, 0.035)');
  outerGrad.addColorStop(1, 'rgba(255, 140, 60, 0)');
  ctx.fillStyle = outerGrad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

const STAR_SURFACE_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  uniform float uTime;

  // Simple noise for surface distortion
  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec3 pos = position;

    // Subtle surface roiling
    float n = hash(pos * 8.0 + uTime * 0.3) * 0.02;
    pos += normal * n;

    vec4 world = modelMatrix * vec4(pos, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const STAR_SURFACE_FRAGMENT = `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  uniform float uTime;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z
    );
    return n;
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.1;
      a *= 0.48;
    }
    return v;
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    // Animated surface noise for solar convection cells
    vec3 noisePos = vWorldPos * 3.2 + uTime * 0.08;
    float surface = fbm(noisePos);
    float detail = fbm(noisePos * 3.0 + 1.5);

    // Keep the star fully emissive from all viewing angles.
    float NdotV = max(0.0, dot(n, viewDir));
    float limbBoost = 0.92 + 0.18 * pow(1.0 - NdotV, 0.7);

    // Color variation: bright yellow center, orange-red edges
    vec3 hotColor = vec3(1.0, 0.96, 0.82);
    vec3 warmColor = vec3(1.0, 0.72, 0.36);
    vec3 coolColor = vec3(0.92, 0.48, 0.18);

    vec3 color = mix(coolColor, warmColor, surface);
    color = mix(color, hotColor, detail * 0.6);
    color *= limbBoost;

    // Granulation pattern
    float granulation = fbm(vWorldPos * 12.0 + uTime * 0.04);
    color += vec3(0.08, 0.04, 0.0) * granulation;

    // Emissive boost
    color *= 1.6;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const CORONA_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CORONA_FRAGMENT = `
  varying vec2 vUv;
  uniform float uTime;
  
  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z
    );
    return n;
  }
  
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i=0; i<4; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    float dist = length(uv);
    if(dist > 1.0) discard;
    
    // Streaks radiating outward seamlessly
    vec2 dir = normalize(uv);
    vec3 rayPos = vec3(dir * 5.0, uTime * 0.15);
    vec3 rayPos2 = vec3(dir * 2.5, uTime * 0.25 + 10.0);
    
    float rayNoise = fbm(rayPos);
    float rayNoise2 = fbm(rayPos2);
    
    float rays = smoothstep(0.3, 0.7, rayNoise * 0.6 + rayNoise2 * 0.4);
    
    // Fade out towards edge and inner edge (planet surface)
    float mask = smoothstep(1.0, 0.5, dist) * smoothstep(0.1, 0.3, dist);
    
    // Corona Base Color (Softer, less dominant)
    vec3 color = vec3(1.0, 0.65, 0.2) * (rays * 0.85 + 0.05);
    
    // Central intense glow (reduced)
    float coreGlow = smoothstep(0.4, 0.0, dist);
    color += vec3(1.0, 0.85, 0.5) * coreGlow * 0.9;
    
    gl_FragColor = vec4(color, mask * 0.75);
  }
`;

export const CosmosStarCenter: React.FC<Props> = ({
  avatarImageUrl,
  cameraMode,
  godRaysDuration = 1.6,
  onSelect,
}) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const glowSpriteRef = useRef<THREE.Mesh>(null!);
  const coronaSpriteRef = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);

  const glowTexture = useMemo(() => createGlowTexture(512), []);
  const coronaTexture = useMemo(() => createCoronaTexture(512), []);
  const sunTexture = useLoader(THREE.TextureLoader, '/textures/planets/sun.jpg');

  const starMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: sunTexture,
        emissiveMap: sunTexture,
        emissive: new THREE.Color('#ffcf7a'),
        emissiveIntensity: 1.9,
        roughness: 0.92,
        metalness: 0,
        toneMapped: true,
      }),
    [sunTexture]
  );

  const glowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: glowTexture,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [glowTexture]
  );

  const coronaMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: coronaTexture,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [coronaTexture]
  );

  useMemo(() => {
    sunTexture.colorSpace = THREE.SRGBColorSpace;
    sunTexture.minFilter = THREE.LinearMipmapLinearFilter;
    sunTexture.magFilter = THREE.LinearFilter;
    sunTexture.generateMipmaps = true;
    sunTexture.wrapS = THREE.RepeatWrapping;
    sunTexture.wrapT = THREE.RepeatWrapping;
  }, [sunTexture]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = 1 + Math.sin(t * 1.2) * 0.01;
    const introBlend = Math.max(0.42, 1 - t / (godRaysDuration * 1.9));
    const raysVisible = cameraMode === 'system' ? introBlend : 0.54;

    if (meshRef.current) {
      meshRef.current.scale.setScalar(pulse);
      meshRef.current.rotation.y += 0.00085;
    }
    if (glowSpriteRef.current) {
      const glowPulse = 1 + Math.sin(t * 0.72) * 0.016;
      glowSpriteRef.current.scale.setScalar(2.64 * glowPulse);
      const mat = glowSpriteRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (0.18 + Math.sin(t * 0.72) * 0.02) * raysVisible;
    }
    if (coronaSpriteRef.current) {
      coronaSpriteRef.current.rotation.z += 0.0001;
      const coronaPulse = 1 + Math.sin(t * 0.43) * 0.011;
      coronaSpriteRef.current.scale.setScalar(2.9 * coronaPulse);
      const mat = coronaSpriteRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (0.16 + Math.sin(t * 0.63) * 0.014) * raysVisible;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 1.18 + Math.sin(t * 1.4) * 0.06;
    }
  });

  useEffect(() => {
    return () => {
      starMaterial.dispose();
      glowMaterial.dispose();
      coronaMaterial.dispose();
      glowTexture.dispose();
      coronaTexture.dispose();
    };
  }, [coronaMaterial, coronaTexture, glowMaterial, glowTexture, starMaterial]);

  const handleStarClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect?.();
  };

  return (
    <group>
      {/* Main star body with animated surface shader */}
      <Sphere
        ref={meshRef}
        args={[0.55, 72, 72]}
        material={starMaterial}
        onClick={handleStarClick}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      />

      {/* Billboard glow - no hard edges, smooth falloff */}
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <mesh ref={glowSpriteRef} material={glowMaterial}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      </Billboard>

      {/* Billboard corona with ray filaments */}
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <mesh ref={coronaSpriteRef} material={coronaMaterial}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      </Billboard>

      {/* Point light illuminating planets */}
      <pointLight
        ref={lightRef}
        color="#fff4d6"
        intensity={1.35}
        distance={56}
        decay={1.2}
      />

      {/* Ambient fill */}
      <ambientLight intensity={0.045} color="#9bb3ff" />
      <hemisphereLight intensity={0.08} color="#95bbff" groundColor="#171129" />
    </group>
  );
};
