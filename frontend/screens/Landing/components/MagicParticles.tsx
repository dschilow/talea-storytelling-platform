import React, { useEffect, useRef, useMemo } from 'react';
import gsap from 'gsap';

interface MagicParticlesProps {
    active: boolean;
    intensity?: number;
    origin?: { x: number; y: number };
}

interface Particle {
    id: number;
    x: number;
    y: number;
    size: number;
    color: string;
    delay: number;
    duration: number;
    angle: number;
    distance: number;
}

const MagicParticles: React.FC<MagicParticlesProps> = ({
    active,
    intensity = 1,
    origin = { x: 50, y: 50 },
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const particles = useMemo<Particle[]>(() => {
        const colors = [
            '#FFCE45', // Gold
            '#7C4DFF', // Primary Purple
            '#24C5A8', // Turquoise
            '#F093FB', // Pink
            '#667EEA', // Blue
            '#FFF',    // White
        ];

        return [...Array(50)].map((_, i) => ({
            id: i,
            x: origin.x + (Math.random() - 0.5) * 20,
            y: origin.y + (Math.random() - 0.5) * 20,
            size: Math.random() * 12 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            delay: Math.random() * 2,
            duration: 2 + Math.random() * 3,
            angle: Math.random() * 360,
            distance: 30 + Math.random() * 50,
        }));
    }, [origin.x, origin.y]);

    useEffect(() => {
        if (!containerRef.current) return;

        gsap.to(containerRef.current, {
            opacity: active ? intensity : 0,
            duration: 0.5,
        });

        if (active) {
            const particleEls = containerRef.current.querySelectorAll('.particle');
            particleEls.forEach((el, i) => {
                const particle = particles[i];
                const radians = (particle.angle * Math.PI) / 180;
                const endX = Math.cos(radians) * particle.distance;
                const endY = Math.sin(radians) * particle.distance - particle.distance;

                gsap.fromTo(
                    el,
                    {
                        x: 0,
                        y: 0,
                        scale: 0,
                        opacity: 0,
                    },
                    {
                        x: endX + '%',
                        y: endY + '%',
                        scale: 1,
                        opacity: 1,
                        duration: particle.duration,
                        delay: particle.delay,
                        repeat: -1,
                        ease: 'power2.out',
                        keyframes: {
                            '0%': { opacity: 0 },
                            '25%': { opacity: 1 },
                            '75%': { opacity: 1 },
                            '100%': { opacity: 0 },
                        },
                    }
                );
            });
        }

        return () => {
            gsap.killTweensOf('.particle');
        };
    }, [active, intensity, particles]);

    return (
        <div
            ref={containerRef}
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                opacity: 0,
                zIndex: 100,
            }}
        >
            {particles.map((particle) => (
                <div
                    key={particle.id}
                    className="particle"
                    style={{
                        position: 'absolute',
                        left: `${particle.x}%`,
                        top: `${particle.y}%`,
                        width: `${particle.size}px`,
                        height: `${particle.size}px`,
                        borderRadius: particle.id % 4 === 0 ? '2px' : '50%',
                        transform: particle.id % 4 === 0 ? 'rotate(45deg)' : 'none',
                        background: particle.color,
                        boxShadow: `0 0 ${particle.size}px ${particle.color}`,
                    }}
                />
            ))}

            {/* Special larger elements */}
            {['✨', '⭐', '💫', '🌟'].map((emoji, i) => (
                <div
                    key={emoji}
                    className="particle special-particle"
                    style={{
                        position: 'absolute',
                        left: `${origin.x + (i - 1.5) * 15}%`,
                        top: `${origin.y}%`,
                        fontSize: '1.5rem',
                        filter: 'drop-shadow(0 0 10px rgba(255, 206, 69, 0.8))',
                    }}
                >
                    {emoji}
                </div>
            ))}
        </div>
    );
};

export default MagicParticles;
