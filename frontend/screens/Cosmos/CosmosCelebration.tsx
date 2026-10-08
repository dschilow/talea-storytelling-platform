/**
 * CosmosCelebration.tsx - The "your planet grew" moment.
 *
 * CelebrationBurst lives inside the canvas (shockwave + star burst at the
 * planet), CelebrationCard is the DOM card that explains what just unlocked.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import * as THREE from 'three';
import type { CosmosDomain } from './CosmosTypes';
import type { GrowthEvent } from './CosmosSeenState';
import { getStageCopy } from './CosmosEvolution';

const BURST_PARTICLES = 110;
const BURST_DURATION = 2.2;

const BURST_VERTEX = /* glsl */ `
attribute vec3 aDirection;
attribute float aSpeed;
attribute float aSize;
uniform float uAge;
uniform float uPixelRatio;
varying float vFade;
void main() {
  float travel = 1.0 - exp(-uAge * 2.6);
  vec3 pos = aDirection * aSpeed * travel;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  vFade = 1.0 - smoothstep(0.35, 1.0, uAge / ${BURST_DURATION.toFixed(1)});
  gl_PointSize = clamp(aSize * uPixelRatio * (30.0 / -mv.z), 1.0, 14.0);
}
`;

const BURST_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vFade;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float star = smoothstep(0.5, 0.0, d);
  float rays = max(smoothstep(0.08, 0.0, abs(uv.x)), smoothstep(0.08, 0.0, abs(uv.y))) * smoothstep(0.5, 0.1, d);
  vec3 color = mix(uColor, vec3(1.0), 0.45);
  gl_FragColor = vec4(color * (star * star + rays * 0.8), (star + rays * 0.6) * vFade);
  #include <colorspace_fragment>
}
`;

interface BurstProps {
  position: [number, number, number];
  color: string;
  radius: number;
  /** Every new value fires the burst once; 0 = idle. */
  nonce: number;
}

export const CelebrationBurst: React.FC<BurstProps> = ({ position, color, radius, nonce }) => {
  const startRef = useRef<number | null>(null);
  const ringARef = useRef<THREE.Mesh>(null!);
  const ringBRef = useRef<THREE.Mesh>(null!);
  const pointsRef = useRef<THREE.Points>(null!);

  const ringMaterials = useMemo(
    () =>
      [0, 1].map(
        () =>
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
          })
      ),
    [color]
  );

  const burst = useMemo(() => {
    const directions = new Float32Array(BURST_PARTICLES * 3);
    const speeds = new Float32Array(BURST_PARTICLES);
    const sizes = new Float32Array(BURST_PARTICLES);
    for (let i = 0; i < BURST_PARTICLES; i += 1) {
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      directions[i * 3] = r * Math.cos(theta);
      directions[i * 3 + 1] = u * 0.7;
      directions[i * 3 + 2] = r * Math.sin(theta);
      speeds[i] = 1.4 + Math.random() * 2.6;
      sizes[i] = 2 + Math.random() * 5;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BURST_PARTICLES * 3), 3));
    geometry.setAttribute('aDirection', new THREE.BufferAttribute(directions, 3));
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uAge: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uColor: { value: new THREE.Color(color) },
      },
      vertexShader: BURST_VERTEX,
      fragmentShader: BURST_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry, material };
  }, [color]);

  useEffect(() => {
    startRef.current = null;
  }, [nonce]);

  useEffect(
    () => () => {
      ringMaterials.forEach((material) => material.dispose());
      burst.geometry.dispose();
      burst.material.dispose();
    },
    [burst, ringMaterials]
  );

  useFrame(({ clock }) => {
    const active = nonce > 0;
    if (!active) {
      if (ringARef.current) ringARef.current.visible = false;
      if (ringBRef.current) ringBRef.current.visible = false;
      if (pointsRef.current) pointsRef.current.visible = false;
      return;
    }
    if (startRef.current === null) startRef.current = clock.elapsedTime;
    const age = clock.elapsedTime - startRef.current;
    const done = age > BURST_DURATION;

    const rings: Array<[React.MutableRefObject<THREE.Mesh>, number, number]> = [
      [ringARef, 0, 0],
      [ringBRef, 0.28, 1],
    ];
    for (const [ref, delay, index] of rings) {
      const mesh = ref.current;
      if (!mesh) continue;
      const k = (age - delay) / 1.5;
      mesh.visible = k > 0 && k < 1;
      if (!mesh.visible) continue;
      const eased = 1 - Math.pow(1 - k, 3);
      mesh.scale.setScalar(radius * (1.2 + eased * 6.5));
      ringMaterials[index].opacity = (1 - k) * (index === 0 ? 0.85 : 0.5);
    }

    if (pointsRef.current) {
      pointsRef.current.visible = !done;
      burst.material.uniforms.uAge.value = age;
    }
  });

  return (
    <group position={position}>
      <Billboard follow>
        <mesh ref={ringARef} material={ringMaterials[0]} visible={false}>
          <ringGeometry args={[0.96, 1, 128]} />
        </mesh>
        <mesh ref={ringBRef} material={ringMaterials[1]} visible={false}>
          <ringGeometry args={[0.9, 1, 128]} />
        </mesh>
      </Billboard>
      <points
        ref={pointsRef}
        geometry={burst.geometry}
        material={burst.material}
        frustumCulled={false}
        visible={false}
      />
    </group>
  );
};

interface CardProps {
  domain: CosmosDomain | null;
  event: GrowthEvent | null;
  visible: boolean;
  index: number;
  total: number;
  onNext: () => void;
}

export const CelebrationCard: React.FC<CardProps> = ({ domain, event, visible, index, total, onNext }) => {
  const stageUp = Boolean(event && event.toStage > event.fromStage);
  const newMoons = event ? Math.max(0, event.toTopics - event.fromTopics) : 0;
  const copy = event && domain ? getStageCopy(event.toStage, domain.planetType) : null;
  const isLast = index >= total - 1;

  return (
    <AnimatePresence>
      {visible && domain && event && (
        <motion.div
          key={`${event.domainId}:${index}`}
          initial={{ opacity: 0, y: 40, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="absolute left-1/2 z-40 w-[min(92vw,26rem)] -translate-x-1/2"
          style={{ bottom: 'max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
          role="status"
          aria-live="polite"
        >
          <div
            className="relative overflow-hidden rounded-3xl border p-5 text-center backdrop-blur-xl"
            style={{
              borderColor: `${domain.color}55`,
              background: 'linear-gradient(160deg, rgba(14,16,40,0.94) 0%, rgba(24,18,52,0.96) 100%)',
              boxShadow: `0 24px 70px rgba(0,0,0,0.55), 0 0 60px ${domain.color}33`,
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full blur-3xl"
              style={{ background: `${domain.color}40` }}
            />
            <p className="relative text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/60">
              {stageUp ? 'Dein Planet ist gewachsen' : 'Ein neuer Wissensmond'}
            </p>
            <h3 className="relative mt-1 text-xl font-extrabold text-white">
              <span aria-hidden className="mr-1.5">
                {domain.icon}
              </span>
              {domain.label}
            </h3>

            {stageUp && copy && (
              <div className="relative mt-3 flex flex-col items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold"
                  style={{ background: `${domain.color}26`, color: domain.color, border: `1px solid ${domain.color}55` }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Stufe {event.toStage}: {copy.name}
                </span>
                <p className="text-sm font-semibold text-white/80">{copy.unlock}</p>
              </div>
            )}

            {newMoons > 0 && (
              <p className="relative mt-3 text-sm font-semibold text-white/75">
                {newMoons === 1
                  ? 'Ein neues Thema kreist jetzt als Mond um deinen Planeten.'
                  : `${newMoons} neue Themen kreisen jetzt als Monde um deinen Planeten.`}
              </p>
            )}

            <button
              type="button"
              onClick={onNext}
              className="relative mt-4 w-full rounded-2xl px-4 py-3 text-sm font-extrabold text-white transition-transform active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${domain.color}, ${domain.emissiveColor})`,
                boxShadow: `0 10px 28px ${domain.color}45`,
              }}
            >
              {isLast ? 'Super!' : `Weiter (${index + 1}/${total})`}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export function fireStarConfetti(color: string): void {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  void confetti({
    particleCount: 70,
    spread: 75,
    startVelocity: 32,
    origin: { y: 0.45 },
    shapes: ['star'],
    colors: [color, '#fde68a', '#ffffff'],
    scalar: 0.9,
    zIndex: 60,
  });
}

/** Rising four-note chime with a soft shimmer (Web Audio, no assets). */
export function playGrowthChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;
    const globalWindow = window as typeof window & { __taleaFocusAudioCtx?: AudioContext };
    const ctx = globalWindow.__taleaFocusAudioCtx ?? (globalWindow.__taleaFocusAudioCtx = new AudioContextCtor());
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    const now = ctx.currentTime + 0.02;
    const master = ctx.createGain();
    master.gain.value = 0.06;
    master.connect(ctx.destination);

    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const start = now + index * 0.12;
      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      overtone.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, start);
      overtone.frequency.setValueAtTime(frequency * 2, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(index === 3 ? 0.9 : 0.6, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + (index === 3 ? 1.6 : 0.7));
      osc.connect(gain);
      overtone.connect(gain);
      gain.connect(master);
      osc.start(start);
      overtone.start(start);
      osc.stop(start + 1.7);
      overtone.stop(start + 1.7);
    });
  } catch {
    // Sound is optional.
  }
}
