import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface MagicBookProps {
    progress: number; // 0-1, controlled by scroll
    onBookOpened?: () => void;
}

const MagicBook: React.FC<MagicBookProps> = ({ progress, onBookOpened }) => {
    const bookRef = useRef<HTMLDivElement>(null);
    const leftPageRef = useRef<HTMLDivElement>(null);
    const rightPageRef = useRef<HTMLDivElement>(null);
    const glowRef = useRef<HTMLDivElement>(null);
    const particlesRef = useRef<HTMLDivElement>(null);

    // Book opening animation based on scroll progress
    useEffect(() => {
        if (!bookRef.current) return;

        // Calculate book opening angle (0 to 180 degrees for full open)
        const openAngle = Math.min(progress * 180, 180);
        const isFullyOpen = progress >= 0.8;

        // Animate left cover
        if (leftPageRef.current) {
            gsap.to(leftPageRef.current, {
                rotateY: -openAngle,
                duration: 0.1,
                ease: 'none',
            });
        }

        // Animate glow intensity
        if (glowRef.current) {
            gsap.to(glowRef.current, {
                opacity: progress * 1.5,
                scale: 1 + progress * 0.5,
                duration: 0.1,
            });
        }

        // Trigger callback when fully open
        if (isFullyOpen && onBookOpened) {
            onBookOpened();
        }
    }, [progress, onBookOpened]);

    return (
        <div
            ref={bookRef}
            className="magic-book"
            style={{
                perspective: '2000px',
                perspectiveOrigin: '50% 50%',
                width: '500px',
                height: '650px',
                position: 'relative',
                transformStyle: 'preserve-3d',
                transform: `scale(${1 - progress * 0.3}) translateY(${progress * -50}px)`,
            }}
        >
            {/* Inner Glow Effect */}
            <div
                ref={glowRef}
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: '120%',
                    height: '120%',
                    transform: 'translate(-50%, -50%)',
                    background: 'radial-gradient(ellipse at center, rgba(255, 206, 69, 0.8) 0%, rgba(124, 77, 255, 0.4) 40%, transparent 70%)',
                    filter: 'blur(40px)',
                    opacity: 0,
                    pointerEvents: 'none',
                    zIndex: 1,
                }}
            />

            {/* Book Spine */}
            <div
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: '5%',
                    width: '40px',
                    height: '90%',
                    background: 'linear-gradient(90deg, #5D3A1A 0%, #8B5A2B 50%, #5D3A1A 100%)',
                    transform: 'translateX(-50%) rotateY(90deg)',
                    transformOrigin: 'center',
                    boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)',
                    zIndex: 2,
                }}
            />

            {/* Left Cover (Opening) */}
            <div
                ref={leftPageRef}
                style={{
                    position: 'absolute',
                    left: '0',
                    top: '0',
                    width: '50%',
                    height: '100%',
                    transformStyle: 'preserve-3d',
                    transformOrigin: 'right center',
                    zIndex: 10,
                }}
            >
                {/* Front Cover */}
                <div
                    style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        backfaceVisibility: 'hidden',
                        background: 'linear-gradient(135deg, #7C4DFF 0%, #5E35B1 50%, #4527A0 100%)',
                        borderRadius: '8px 0 0 8px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.4), inset 0 0 30px rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px',
                        border: '3px solid rgba(255, 206, 69, 0.6)',
                    }}
                >
                    {/* Book Cover Design */}
                    <div style={{ textAlign: 'center' }}>
                        {/* Decorative Frame */}
                        <div
                            style={{
                                position: 'absolute',
                                inset: '15px',
                                border: '2px solid rgba(255, 206, 69, 0.4)',
                                borderRadius: '4px',
                                pointerEvents: 'none',
                            }}
                        />
                        {/* Corner Decorations */}
                        {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner) => (
                            <div
                                key={corner}
                                style={{
                                    position: 'absolute',
                                    width: '30px',
                                    height: '30px',
                                    [corner.includes('top') ? 'top' : 'bottom']: '25px',
                                    [corner.includes('left') ? 'left' : 'right']: '25px',
                                    borderTop: corner.includes('top') ? '3px solid rgba(255, 206, 69, 0.6)' : 'none',
                                    borderBottom: corner.includes('bottom') ? '3px solid rgba(255, 206, 69, 0.6)' : 'none',
                                    borderLeft: corner.includes('left') ? '3px solid rgba(255, 206, 69, 0.6)' : 'none',
                                    borderRight: corner.includes('right') ? '3px solid rgba(255, 206, 69, 0.6)' : 'none',
                                }}
                            />
                        ))}
                        
                        {/* Logo/Title */}
                        <div
                            style={{
                                fontSize: '3.5rem',
                                fontWeight: '900',
                                color: '#FFCE45',
                                textShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 40px rgba(255, 206, 69, 0.5)',
                                fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
                                letterSpacing: '0.05em',
                                marginBottom: '1rem',
                            }}
                        >
                            Talea
                        </div>
                        <div
                            style={{
                                fontSize: '1rem',
                                color: 'rgba(255,255,255,0.8)',
                                fontFamily: '"Nunito", system-ui, sans-serif',
                                textTransform: 'uppercase',
                                letterSpacing: '0.3em',
                            }}
                        >
                            Deine Geschichte
                        </div>

                        {/* Magic Symbol */}
                        <div
                            style={{
                                marginTop: '2rem',
                                fontSize: '2rem',
                            }}
                        >
                            ✨📖✨
                        </div>
                    </div>
                </div>

                {/* Back of Front Cover (Inside Left) */}
                <div
                    style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                        background: 'linear-gradient(135deg, #FFF8E7 0%, #F5E6C8 100%)',
                        borderRadius: '8px 0 0 8px',
                        boxShadow: 'inset 0 0 50px rgba(139, 90, 43, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '40px',
                    }}
                >
                    {/* Ornate Design on Inside Cover */}
                    <div style={{ textAlign: 'center', color: '#5D3A1A' }}>
                        <div style={{ fontSize: '1.2rem', fontStyle: 'italic', opacity: 0.7 }}>
                            "Es war einmal..."
                        </div>
                        <div style={{ marginTop: '2rem', fontSize: '3rem' }}>
                            🏰
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Cover (Static) */}
            <div
                ref={rightPageRef}
                style={{
                    position: 'absolute',
                    right: '0',
                    top: '0',
                    width: '50%',
                    height: '100%',
                    background: 'linear-gradient(135deg, #7C4DFF 0%, #5E35B1 50%, #4527A0 100%)',
                    borderRadius: '0 8px 8px 0',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.4), inset 0 0 30px rgba(255,255,255,0.1)',
                    border: '3px solid rgba(255, 206, 69, 0.6)',
                    borderLeft: 'none',
                    zIndex: 5,
                }}
            >
                {/* Pages Stack Effect */}
                <div
                    style={{
                        position: 'absolute',
                        top: '3%',
                        left: '-5px',
                        width: '5px',
                        height: '94%',
                        background: 'repeating-linear-gradient(to bottom, #F5E6C8 0px, #F5E6C8 2px, #E8D5B5 2px, #E8D5B5 4px)',
                        boxShadow: 'inset 2px 0 3px rgba(0,0,0,0.1)',
                    }}
                />
            </div>

            {/* Floating Particles when opening */}
            <div
                ref={particlesRef}
                style={{
                    position: 'absolute',
                    inset: '-50%',
                    pointerEvents: 'none',
                    opacity: progress,
                    zIndex: 20,
                }}
            >
                {[...Array(20)].map((_, i) => (
                    <div
                        key={i}
                        className="magic-particle"
                        style={{
                            position: 'absolute',
                            width: `${Math.random() * 8 + 4}px`,
                            height: `${Math.random() * 8 + 4}px`,
                            borderRadius: '50%',
                            background: i % 3 === 0 
                                ? 'radial-gradient(circle, #FFCE45 0%, #FFB300 100%)'
                                : i % 3 === 1 
                                    ? 'radial-gradient(circle, #7C4DFF 0%, #5E35B1 100%)'
                                    : 'radial-gradient(circle, #24C5A8 0%, #1A9E87 100%)',
                            boxShadow: '0 0 10px currentColor',
                            left: `${30 + Math.random() * 40}%`,
                            top: `${30 + Math.random() * 40}%`,
                            animation: `floatUp ${2 + Math.random() * 3}s ease-out infinite`,
                            animationDelay: `${Math.random() * 2}s`,
                            opacity: 0.8,
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default MagicBook;
