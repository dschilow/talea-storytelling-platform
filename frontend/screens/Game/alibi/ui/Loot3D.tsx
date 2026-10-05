/* Echte 3D-Szene (WebGL) für den Beute-Moment: Das Beutestück als goldene Medaille dreht sich über einem
 * Steinsockel, mit Funken und warmem Licht. Wird nur bei Bedarf geladen (React.lazy). */
import React, { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Float, Sparkles, useTexture } from "@react-three/drei";
import * as THREE from "three";

const Medal: React.FC<{ src: string }> = ({ src }) => {
  const tex = useTexture(src);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const ref = useRef<THREE.Group>(null);
  const t0 = useRef(0);
  useFrame((_, dt) => {
    if (!ref.current) return;
    t0.current += dt;
    // Erst schnelles Einschwingen, dann ruhiges Drehen
    const spin = t0.current < 1.2 ? 7 * (1.2 - t0.current) + 0.8 : 0.8;
    ref.current.rotation.y += dt * spin;
  });
  return (
    <group ref={ref}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.2, 1.2, 0.24, 72, 1, true]} />
        <meshStandardMaterial color="#f0b347" metalness={0.55} roughness={0.28} emissive="#7a4a0c" emissiveIntensity={0.45} side={THREE.DoubleSide} />
      </mesh>
      {[1, -1].map((side) => (
        <group key={side} position={[0, 0, 0.121 * side]} rotation={[0, side === 1 ? 0 : Math.PI, 0]}>
          <mesh>
            <circleGeometry args={[1.04, 72]} />
            <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.55} roughness={0.6} metalness={0.02} />
          </mesh>
          <mesh position={[0, 0, 0.002]}>
            <ringGeometry args={[1.04, 1.2, 72]} />
            <meshStandardMaterial color="#fbe39f" metalness={0.5} roughness={0.22} emissive="#8a5a14" emissiveIntensity={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const Pedestal: React.FC = () => (
  <group position={[0, -1.72, 0]}>
    <mesh>
      <cylinderGeometry args={[1.05, 1.25, 0.34, 48]} />
      <meshStandardMaterial color="#3b3658" roughness={0.85} metalness={0.1} />
    </mesh>
    <mesh position={[0, 0.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[1.02, 0.035, 12, 64]} />
      <meshStandardMaterial color="#f2b04a" metalness={0.9} roughness={0.25} emissive="#7a4a10" emissiveIntensity={0.4} />
    </mesh>
  </group>
);

const Loot3D: React.FC<{ src: string }> = ({ src }) => (
  <Canvas dpr={[1, 2]} camera={{ position: [0, 0.2, 4.4], fov: 40 }} gl={{ antialias: true, alpha: true, powerPreference: "low-power" }} style={{ background: "transparent" }}>
    <ambientLight intensity={0.9} />
    <directionalLight position={[3, 4, 5]} intensity={2.4} color="#fff1d2" />
    <pointLight position={[-3, -0.5, 2.5]} intensity={12} color="#9a72ff" />
    <pointLight position={[2.5, 2, -1.5]} intensity={20} color="#ffb84d" />
    <Suspense fallback={null}>
      <Float speed={2.2} rotationIntensity={0.12} floatIntensity={0.55} floatingRange={[-0.08, 0.12]}>
        <Medal src={src} />
      </Float>
    </Suspense>
    <Sparkles count={46} scale={[4.2, 3.2, 2]} size={3.2} speed={0.45} color="#ffe6a3" opacity={0.9} />
    <Pedestal />
    <ContactShadows position={[0, -1.53, 0]} opacity={0.55} scale={4.5} blur={2.6} far={2.2} />
  </Canvas>
);

export default Loot3D;
