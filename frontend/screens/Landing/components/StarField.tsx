import React, { useEffect, useRef, useMemo } from 'react';
import gsap from 'gsap';

interface StarFieldProps {
    intensity?: number; // 0-1
    className?: string;
}

interface Star {
    id: number;
    x: number;
    y: number;
    size: number;
    opacity: number;
    duration: number;
    delay: number;
    color: string;
}

const StarField: React.FC<StarFieldProps> = ({ intensity = 1, className }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Generate stars only once
    const stars = useMemo<Star[]>(() => {
        const colors = ['#FFFFFF', '#FFCE45', '#7C4DFF', '#24C5A8', '#F093FB'];
        return [...Array(100)].map((_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: Math.random() * 3 + 1,
            opacity: Math.random() * 0.5 + 0.3,
            duration: Math.random() * 3 + 2,
            delay: Math.random() * 5,
            color: colors[Math.floor(Math.random() * colors.length)],
        }));
    }, []);

    // Animate stars on intensity change
    useEffect(() => {
        if (!containerRef.current) return;
        
        gsap.to(containerRef.current, {
            opacity: intensity,
            duration: 0.5,
        });
    }, [intensity]);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
                pointerEvents: 'none',
            }}
        >
            {stars.map((star) => (
                <div
                    key={star.id}
                    style={{
                        position: 'absolute',
                        left: `${star.x}%`,
                        top: `${star.y}%`,
                        width: `${star.size}px`,
                        height: `${star.size}px`,
                        borderRadius: '50%',
                        backgroundColor: star.color,
                        boxShadow: `0 0 ${star.size * 2}px ${star.color}`,
                        opacity: star.opacity,
                        animation: `twinkle ${star.duration}s ease-in-out infinite`,
                        animationDelay: `${star.delay}s`,
                    }}
                />
            ))}
        </div>
    );
};

export default StarField;
