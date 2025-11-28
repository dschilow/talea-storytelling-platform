import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { MathUtils } from 'three';

interface BookModelProps {
    progress: number; // 0 (closed) to 1 (open)
}

const BOOK_WIDTH = 3;
const BOOK_HEIGHT = 4.2;
const BOOK_THICKNESS = 0.6;
const COVER_THICKNESS = 0.1;
const PAGE_OFFSET = 0.05;

export const BookModel: React.FC<BookModelProps> = ({ progress }) => {
    const groupRef = useRef<THREE.Group>(null);
    const frontCoverRef = useRef<THREE.Group>(null);
    const pagesRef = useRef<THREE.Group>(null);

    // Materials
    const coverMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#1a0b2e', // Deep blue
        roughness: 0.3,
        metalness: 0.1,
    }), []);

    const goldMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#ffd700',
        roughness: 0.2,
        metalness: 0.8,
    }), []);

    const pageMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#fdfbf7', // Off-white paper
        roughness: 0.8,
    }), []);

    useFrame(() => {
        if (!frontCoverRef.current || !groupRef.current) return;

        // Animate Front Cover Opening
        // Rotate around the spine (y-axis local)
        // Closed: 0, Open: -Math.PI * 0.9 (approx 160 degrees)
        const targetRotation = MathUtils.lerp(0, -Math.PI * 0.95, progress);

        // Smooth interpolation for the cover
        frontCoverRef.current.rotation.y = MathUtils.lerp(frontCoverRef.current.rotation.y, targetRotation, 0.1);

        // Animate the whole book floating/tilting
        // When opening, tilt it to face the camera more directly
        const targetTiltX = MathUtils.lerp(0.2, 0, progress); // Tilt up to face user
        const targetTiltY = MathUtils.lerp(-0.3, 0, progress); // Rotate to center
        const targetZ = MathUtils.lerp(0, 1.5, progress); // Move closer

        groupRef.current.rotation.x = MathUtils.lerp(groupRef.current.rotation.x, targetTiltX, 0.05);
        groupRef.current.rotation.y = MathUtils.lerp(groupRef.current.rotation.y, targetTiltY, 0.05);
        groupRef.current.position.z = MathUtils.lerp(groupRef.current.position.z, targetZ, 0.05);
    });

    return (
        <group ref={groupRef} rotation={[0.2, -0.3, 0]}>

            {/* Back Cover (Static relative to spine) */}
            <mesh position={[0, 0, -BOOK_THICKNESS / 2 + COVER_THICKNESS / 2]} castShadow receiveShadow material={coverMaterial}>
                <boxGeometry args={[BOOK_WIDTH, BOOK_HEIGHT, COVER_THICKNESS]} />
            </mesh>

            {/* Spine */}
            <mesh position={[-BOOK_WIDTH / 2 - COVER_THICKNESS / 2, 0, 0]} castShadow receiveShadow material={coverMaterial}>
                <boxGeometry args={[COVER_THICKNESS, BOOK_HEIGHT, BOOK_THICKNESS]} />
            </mesh>

            {/* Pages Block */}
            <mesh position={[0, 0, 0]} castShadow receiveShadow material={pageMaterial}>
                <boxGeometry args={[BOOK_WIDTH - PAGE_OFFSET, BOOK_HEIGHT - PAGE_OFFSET, BOOK_THICKNESS - COVER_THICKNESS * 2]} />
            </mesh>

            {/* Front Cover Group (Pivots at the spine) */}
            {/* The pivot point is at x = -BOOK_WIDTH/2 */}
            <group ref={frontCoverRef} position={[-BOOK_WIDTH / 2, 0, BOOK_THICKNESS / 2 - COVER_THICKNESS / 2]}>
                {/* The actual cover mesh, offset so its edge aligns with the pivot */}
                <mesh position={[BOOK_WIDTH / 2, 0, 0]} castShadow receiveShadow material={coverMaterial}>
                    <boxGeometry args={[BOOK_WIDTH, BOOK_HEIGHT, COVER_THICKNESS]} />
                </mesh>

                {/* Gold Decoration on Cover */}
                <mesh position={[BOOK_WIDTH / 2, 0, COVER_THICKNESS / 2 + 0.001]} material={goldMaterial}>
                    <boxGeometry args={[BOOK_WIDTH * 0.8, BOOK_HEIGHT * 0.8, 0.005]} />
                </mesh>

                {/* Title Text Placeholder (Geometry) */}
                <mesh position={[BOOK_WIDTH / 2, 0.5, COVER_THICKNESS / 2 + 0.01]} material={goldMaterial}>
                    <boxGeometry args={[1.5, 0.4, 0.01]} />
                </mesh>
            </group>

        </group>
    );
};
