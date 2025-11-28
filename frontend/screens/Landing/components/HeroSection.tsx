import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ArrowRight } from 'lucide-react';

interface HeroSectionProps {
    scrollProgress: number; // 0-1
    onEnterWorld: () => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({ scrollProgress, onEnterWorld }) => {
    const heroRef = useRef<HTMLDivElement>(null);
    const glowRef = useRef<HTMLDivElement>(null);
    const hasTriggeredRef = useRef(false);

    // Book starts CLOSED (0 degrees) and OPENS as you scroll (to 180 degrees)
    const openProgress = Math.min(scrollProgress * 1.5, 1); // Book opens in first 66% of hero section
    const openAngle = openProgress * 180; // 0 = closed, 180 = fully open
    const bookScale = 1 - openProgress * 0.3;
    const bookY = openProgress * -150;
    const bookOpacity = openProgress > 0.9 ? 1 - (openProgress - 0.9) * 10 : 1;
    const contentOpacity = Math.max(0, 1 - openProgress * 1.5);

    // Trigger world entry when book is fully open
    useEffect(() => {
        if (openProgress > 0.95 && !hasTriggeredRef.current) {
            hasTriggeredRef.current = true;
            onEnterWorld();
        }
    }, [openProgress, onEnterWorld]);

    // Animate glow based on opening
    useEffect(() => {
        if (glowRef.current) {
            gsap.to(glowRef.current, {
                opacity: Math.min(openProgress * 2, 1),
                scale: 1 + openProgress * 1.2,
                duration: 0.1,
            });
        }
    }, [openProgress]);

    return (
        <div
            ref={heroRef}
            style={{
                position: 'relative',
                width: '100%',
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
            }}
        >
            {/* Background Stars */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: `
                        radial-gradient(circle at 20% 20%, rgba(255,255,255,0.8) 1px, transparent 1px),
                        radial-gradient(circle at 80% 10%, rgba(255,255,255,0.6) 1px, transparent 1px),
                        radial-gradient(circle at 40% 30%, rgba(255,206,69,0.8) 1px, transparent 1px),
                        radial-gradient(circle at 60% 15%, rgba(124,77,255,0.8) 1.5px, transparent 1.5px),
                        radial-gradient(circle at 90% 25%, rgba(255,255,255,0.5) 1px, transparent 1px),
                        radial-gradient(circle at 10% 35%, rgba(36,197,168,0.8) 1.5px, transparent 1.5px),
                        radial-gradient(circle at 70% 40%, rgba(255,255,255,0.4) 1px, transparent 1px),
                        radial-gradient(circle at 30% 50%, rgba(240,147,251,0.6) 1px, transparent 1px),
                        radial-gradient(circle at 85% 55%, rgba(255,255,255,0.7) 1px, transparent 1px),
                        radial-gradient(circle at 15% 60%, rgba(255,206,69,0.5) 1px, transparent 1px)
                    `,
                    backgroundSize: '100% 100%',
                }}
            />

            {/* Ambient Glow from Book */}
            <div
                ref={glowRef}
                style={{
                    position: 'absolute',
                    width: '800px',
                    height: '800px',
                    background: 'radial-gradient(ellipse at center, rgba(255,206,69,0.5) 0%, rgba(124,77,255,0.3) 30%, rgba(36,197,168,0.1) 60%, transparent 80%)',
                    filter: 'blur(80px)',
                    opacity: 0,
                    pointerEvents: 'none',
                }}
            />

            {/* The Magic Book - 3D Transform Container */}
            <div
                style={{
                    position: 'relative',
                    width: 'clamp(280px, 45vw, 480px)',
                    height: 'clamp(360px, 60vw, 620px)',
                    perspective: '2000px',
                    perspectiveOrigin: '50% 50%',
                    transform: `scale(${bookScale}) translateY(${bookY}px)`,
                    opacity: bookOpacity,
                    transition: 'opacity 0.3s ease-out',
                    zIndex: 10,
                }}
            >
                {/* Book Container with 3D transform */}
                <div
                    style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        transformStyle: 'preserve-3d',
                    }}
                >
                    {/* RIGHT SIDE - Back Cover (always visible, static) */}
                    <div
                        style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            width: '50%',
                            height: '100%',
                            background: 'linear-gradient(135deg, #5E35B1 0%, #4527A0 50%, #311B92 100%)',
                            borderRadius: '0 12px 12px 0',
                            boxShadow: '5px 0 30px rgba(0,0,0,0.4)',
                            border: '3px solid rgba(255, 206, 69, 0.5)',
                            borderLeft: 'none',
                            zIndex: 1,
                        }}
                    >
                        {/* Page edges visible on left side of right cover */}
                        <div
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: '3%',
                                width: '8px',
                                height: '94%',
                                background: 'repeating-linear-gradient(to bottom, #FFF8E7 0px, #FFF8E7 2px, #E8D5B5 2px, #E8D5B5 4px)',
                                borderRadius: '0 0 0 2px',
                            }}
                        />
                    </div>

                    {/* Book Spine */}
                    <div
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: '2%',
                            width: '30px',
                            height: '96%',
                            background: 'linear-gradient(90deg, #3D2314 0%, #5D3A1A 30%, #8B5A2B 50%, #5D3A1A 70%, #3D2314 100%)',
                            transform: 'translateX(-50%)',
                            borderRadius: '3px',
                            boxShadow: 'inset 0 0 15px rgba(0,0,0,0.5)',
                            zIndex: 5,
                        }}
                    >
                        {/* Gold decorations on spine */}
                        <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: '20px', height: '2px', background: 'linear-gradient(90deg, transparent, #FFCE45, transparent)' }} />
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translateX(-50%)', width: '20px', height: '2px', background: 'linear-gradient(90deg, transparent, #FFCE45, transparent)' }} />
                        <div style={{ position: 'absolute', bottom: '10%', left: '50%', transform: 'translateX(-50%)', width: '20px', height: '2px', background: 'linear-gradient(90deg, transparent, #FFCE45, transparent)' }} />
                    </div>

                    {/* LEFT SIDE - Front Cover (this opens!) */}
                    <div
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            width: '50%',
                            height: '100%',
                            transformStyle: 'preserve-3d',
                            transformOrigin: 'right center',
                            transform: `rotateY(-${openAngle}deg)`,
                            zIndex: 10,
                        }}
                    >
                        {/* Front of Cover (visible when closed) */}
                        <div
                            style={{
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                backfaceVisibility: 'hidden',
                                background: 'linear-gradient(145deg, #9B6DFF 0%, #7C4DFF 30%, #5E35B1 70%, #4527A0 100%)',
                                borderRadius: '12px 0 0 12px',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 0 30px rgba(255,255,255,0.1)',
                                border: '3px solid rgba(255, 206, 69, 0.6)',
                                borderRight: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                            }}
                        >
                            {/* Decorative Frame */}
                            <div style={{ position: 'absolute', inset: '15px', border: '2px solid rgba(255, 206, 69, 0.4)', borderRadius: '6px', pointerEvents: 'none' }} />
                            
                            {/* Corner Ornaments */}
                            {['tl', 'tr', 'bl', 'br'].map((corner) => (
                                <div
                                    key={corner}
                                    style={{
                                        position: 'absolute',
                                        width: '35px',
                                        height: '35px',
                                        [corner.includes('t') ? 'top' : 'bottom']: '25px',
                                        [corner.includes('l') ? 'left' : 'right']: '25px',
                                        borderTop: corner.includes('t') ? '3px solid rgba(255, 206, 69, 0.6)' : 'none',
                                        borderBottom: corner.includes('b') ? '3px solid rgba(255, 206, 69, 0.6)' : 'none',
                                        borderLeft: corner.includes('l') ? '3px solid rgba(255, 206, 69, 0.6)' : 'none',
                                        borderRight: corner.includes('r') ? '3px solid rgba(255, 206, 69, 0.6)' : 'none',
                                    }}
                                />
                            ))}

                            {/* Book Title */}
                            <div style={{ textAlign: 'center', position: 'relative', padding: '20px' }}>
                                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem', animation: 'pulse 2s ease-in-out infinite' }}>✨</div>
                                <h1
                                    style={{
                                        fontSize: 'clamp(2.5rem, 7vw, 4rem)',
                                        fontWeight: '900',
                                        color: '#FFCE45',
                                        textShadow: '0 4px 30px rgba(0,0,0,0.5), 0 0 60px rgba(255, 206, 69, 0.5)',
                                        fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
                                        letterSpacing: '0.05em',
                                        margin: 0,
                                        lineHeight: 1,
                                    }}
                                >
                                    Talea
                                </h1>
                                <div
                                    style={{
                                        fontSize: 'clamp(0.6rem, 1.5vw, 0.9rem)',
                                        color: 'rgba(255,255,255,0.8)',
                                        fontFamily: '"Nunito", system-ui, sans-serif',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.35em',
                                        marginTop: '0.75rem',
                                    }}
                                >
                                    Deine Geschichte
                                </div>
                                <div style={{ width: '50%', height: '2px', background: 'linear-gradient(90deg, transparent, rgba(255, 206, 69, 0.5), transparent)', margin: '1rem auto 0' }} />
                                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '1.3rem', animation: 'float 3s ease-in-out infinite' }}>🌟</span>
                                    <span style={{ fontSize: '1.3rem', animation: 'float 3s ease-in-out infinite 0.2s' }}>📖</span>
                                    <span style={{ fontSize: '1.3rem', animation: 'float 3s ease-in-out infinite 0.4s' }}>🌟</span>
                                </div>
                            </div>
                        </div>

                        {/* Back of Cover / Inside Left Page (visible when opening) */}
                        <div
                            style={{
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                backfaceVisibility: 'hidden',
                                transform: 'rotateY(180deg)',
                                background: 'linear-gradient(135deg, #FFF8E7 0%, #F5E6C8 50%, #E8D5B5 100%)',
                                borderRadius: '12px 0 0 12px',
                                boxShadow: 'inset 0 0 40px rgba(139, 90, 43, 0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '30px',
                            }}
                        >
                            {/* Paper texture */}
                            <div style={{ position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
                            
                            <div style={{ textAlign: 'center', color: '#5D3A1A', position: 'relative' }}>
                                <div style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.6rem)', fontStyle: 'italic', opacity: 0.8, fontFamily: 'Georgia, serif', lineHeight: 1.6 }}>
                                    "Es war einmal..."
                                </div>
                                <div style={{ marginTop: '1.5rem', fontSize: 'clamp(2.5rem, 5vw, 4rem)', filter: 'drop-shadow(0 3px 6px rgba(139, 90, 43, 0.2))' }}>🏰</div>
                                <div style={{ marginTop: '1rem', fontSize: 'clamp(0.75rem, 1.5vw, 0.95rem)', color: '#8B5A2B', fontFamily: '"Nunito", system-ui, sans-serif' }}>
                                    ...und deine Geschichte beginnt jetzt
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Magical particles when book opens */}
                    {openProgress > 0.1 && (
                        <div style={{ position: 'absolute', left: '50%', top: '20%', transform: 'translateX(-50%)', width: '200%', height: '150%', pointerEvents: 'none', opacity: openProgress }}>
                            {[...Array(30)].map((_, i) => (
                                <div
                                    key={i}
                                    style={{
                                        position: 'absolute',
                                        left: `${25 + Math.random() * 50}%`,
                                        bottom: '30%',
                                        width: `${3 + Math.random() * 8}px`,
                                        height: `${3 + Math.random() * 8}px`,
                                        borderRadius: i % 5 === 0 ? '2px' : '50%',
                                        transform: i % 5 === 0 ? 'rotate(45deg)' : 'none',
                                        background: ['#FFCE45', '#7C4DFF', '#24C5A8', '#F093FB', '#FFF'][i % 5],
                                        boxShadow: `0 0 ${8 + Math.random() * 8}px currentColor`,
                                        animation: `riseUp ${2.5 + Math.random() * 2.5}s ease-out infinite`,
                                        animationDelay: `${Math.random() * 2}s`,
                                    }}
                                />
                            ))}
                            {['✨', '⭐', '💫', '🌟', '📚', '🦋', '🌙'].map((emoji, i) => (
                                <div
                                    key={emoji}
                                    style={{
                                        position: 'absolute',
                                        left: `${15 + i * 11}%`,
                                        bottom: '25%',
                                        fontSize: `${1 + Math.random() * 0.6}rem`,
                                        animation: `riseUp ${3.5 + Math.random() * 2}s ease-out infinite`,
                                        animationDelay: `${0.3 + Math.random() * 1.5}s`,
                                        filter: 'drop-shadow(0 0 10px rgba(255, 206, 69, 0.8))',
                                    }}
                                >
                                    {emoji}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Hero Text Content - Fades out as book opens */}
            <div
                style={{
                    position: 'absolute',
                    bottom: '12%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    textAlign: 'center',
                    maxWidth: '750px',
                    padding: '0 2rem',
                    opacity: contentOpacity,
                    pointerEvents: contentOpacity < 0.3 ? 'none' : 'auto',
                    transition: 'opacity 0.2s',
                    zIndex: 5,
                }}
            >
                <h2
                    style={{
                        fontSize: 'clamp(1.4rem, 3.5vw, 2.2rem)',
                        fontWeight: '700',
                        color: 'white',
                        marginBottom: '0.75rem',
                        fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
                        textShadow: '0 4px 25px rgba(0,0,0,0.5)',
                    }}
                >
                    Geschichten, die mit deinem Kind mitwachsen
                </h2>
                <p
                    style={{
                        fontSize: 'clamp(0.9rem, 2vw, 1.15rem)',
                        color: 'rgba(255,255,255,0.85)',
                        marginBottom: '1.75rem',
                        fontFamily: '"Nunito", system-ui, sans-serif',
                        lineHeight: 1.6,
                    }}
                >
                    Talea verwandelt dein Kind in die Hauptfigur – mit personalisierten
                    Märchen, Dokus und Avataren, die sich jede Erinnerung merken.
                </p>

                {/* CTA Buttons */}
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                        style={{
                            background: 'linear-gradient(135deg, #FFCE45 0%, #FFB300 100%)',
                            color: '#1A1A2E',
                            border: 'none',
                            padding: '0.9rem 2rem',
                            fontSize: '1rem',
                            fontWeight: '700',
                            borderRadius: '50px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 8px 35px rgba(255, 206, 69, 0.4)',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05) translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 45px rgba(255, 206, 69, 0.5)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1) translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 35px rgba(255, 206, 69, 0.4)'; }}
                    >
                        Jetzt kostenlos testen
                        <ArrowRight size={18} />
                    </button>
                    <button
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            color: 'white',
                            border: '2px solid rgba(255,255,255,0.3)',
                            padding: '0.9rem 2rem',
                            fontSize: '1rem',
                            fontWeight: '600',
                            borderRadius: '50px',
                            cursor: 'pointer',
                            backdropFilter: 'blur(10px)',
                            transition: 'all 0.2s',
                            fontFamily: '"Nunito", system-ui, sans-serif',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
                    >
                        ▶ Story-Demo ansehen
                    </button>
                </div>
            </div>

            {/* Scroll Indicator */}
            <div
                style={{
                    position: 'absolute',
                    bottom: '1.5rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.4rem',
                    opacity: contentOpacity * 0.8,
                    animation: 'bounce 2s ease-in-out infinite',
                }}
            >
                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                    Scroll um zu öffnen
                </span>
                <div style={{ width: '24px', height: '40px', border: '2px solid rgba(255,255,255,0.3)', borderRadius: '12px', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '6px', left: '50%', transform: 'translateX(-50%)', width: '3px', height: '6px', background: 'rgba(255,255,255,0.6)', borderRadius: '2px', animation: 'scrollDown 2s ease-in-out infinite' }} />
                </div>
            </div>
        </div>
    );
};

export default HeroSection;
