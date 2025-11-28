import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import './Book3D.css';

interface Book3DProps {
    progress: number; // 0 to 1 (0 = closed, 1 = fully open)
}

const Book3D: React.FC<Book3DProps> = ({ progress }) => {
    const bookRef = useRef<HTMLDivElement>(null);
    const coverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!bookRef.current || !coverRef.current) return;

        // Map progress to rotation
        // 0 -> 0deg (closed)
        // 1 -> -160deg (open)
        const rotation = gsap.utils.interpolate(0, -160, progress);

        gsap.to(coverRef.current, {
            rotateY: rotation,
            duration: 0.5,
            overwrite: true,
            ease: 'power2.out'
        });

        // Optional: Move the whole book slightly as it opens
        gsap.to(bookRef.current, {
            z: progress * 50, // Move towards camera
            x: progress * 20, // Shift right slightly to center the open pages
            duration: 0.5,
            overwrite: true
        });

    }, [progress]);

    return (
        <div className="book-scene">
            <div ref={bookRef} className="book">
                {/* Back Cover */}
                <div className="book-cover back"></div>

                {/* Pages (Stack) */}
                <div className="book-pages"></div>

                {/* Front Cover */}
                <div ref={coverRef} className="book-cover front">
                    <div className="front-face">
                        <h1>Talea</h1>
                        <p>Magische Geschichten</p>
                    </div>
                    <div className="back-face"></div>
                </div>

                {/* Spine */}
                <div className="book-spine"></div>
            </div>
        </div>
    );
};

export default Book3D;
