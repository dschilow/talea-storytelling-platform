import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Float, ContactShadows } from '@react-three/drei';
import { BookModel } from './BookModel';

interface Book3DSceneProps {
    progress: number;
}

const Book3DScene: React.FC<Book3DSceneProps> = ({ progress }) => {
    return (
        <div style={{ width: '100%', height: '100%' }}>
            <Canvas shadows camera={{ position: [0, 0, 8], fov: 35 }}>
                <Suspense fallback={null}>
                    <ambientLight intensity={0.5} />
                    <spotLight
                        position={[10, 10, 10]}
                        angle={0.15}
                        penumbra={1}
                        intensity={1}
                        castShadow
                    />
                    <pointLight position={[-10, -10, -10]} intensity={0.5} color="#7C4DFF" />

                    <Float
                        speed={2} // Animation speed
                        rotationIntensity={0.5} // XYZ rotation intensity
                        floatIntensity={0.5} // Up/down float intensity
                    >
                        <BookModel progress={progress} />
                    </Float>

                    <ContactShadows
                        position={[0, -2.5, 0]}
                        opacity={0.4}
                        scale={10}
                        blur={2.5}
                        far={4}
                    />

                    {/* Magical Environment Reflection */}
                    <Environment preset="night" />
                </Suspense>
            </Canvas>
        </div>
    );
};

export default Book3DScene;
