import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Sparkles, Volume2, VolumeX } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const SCENES = [
    {
        id: 'intro',
        image: '/landing-assets/cine_1_book.png',
        text: 'Es war einmal...',
        subtext: 'Jedes große Abenteuer beginnt mit einem Buch.',
        color: '#ffd700',
    },
    {
        id: 'magic',
        image: '/landing-assets/cine_2_magic.png',
        text: 'Eine Idee erwacht.',
        subtext: 'Magie strömt aus den Seiten und formt neue Welten.',
        color: '#a989f2',
    },
    {
        id: 'avatars',
        image: '/landing-assets/cine_3_avatars.png',
        text: 'Deine Helden.',
        subtext: 'Erschaffe einzigartige Charaktere, die mit dir wachsen.',
        color: '#4facfe',
    },
    {
        id: 'stories',
        image: '/landing-assets/cine_4_stories.png',
        text: 'Deine Geschichte.',
        subtext: 'Tauche ein in Abenteuer, die nur für dich geschrieben werden.',
        color: '#f093fb',
    },
    {
        id: 'dokus',
        image: '/landing-assets/cine_5_dokus.png',
        text: 'Dein Wissen.',
        subtext: 'Lerne von weisen Mentoren in deiner eigenen Akademie.',
        color: '#667eea',
    },
    {
        id: 'outro',
        image: '/landing-assets/cine_6_outro.png',
        text: 'Dein Königreich.',
        subtext: 'Bist du bereit, deine Reise zu beginnen?',
        color: '#ffd700',
        isLast: true,
    },
];

const CinematicLanding = () => {
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);
    const panelsRef = useRef<(HTMLDivElement | null)[]>([]);
    const textsRef = useRef<(HTMLDivElement | null)[]>([]);
    const [activeScene, setActiveScene] = useState(0);
    const [isMuted, setIsMuted] = useState(true);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Pin the container for the duration of the scroll
        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: container,
                start: 'top top',
                end: `+=${SCENES.length * 100}%`,
                scrub: 1,
                pin: true,
                onUpdate: (self) => {
                    const progress = self.progress;
                    const index = Math.min(
                        Math.floor(progress * SCENES.length),
                        SCENES.length - 1
                    );
                    setActiveScene(index);
                },
            },
        });

        // Animate each panel
        SCENES.forEach((_, index) => {
            if (index === 0) return; // First panel is already visible

            tl.fromTo(
                panelsRef.current[index],
                { opacity: 0, scale: 1.1 },
                { opacity: 1, scale: 1, duration: 1, ease: 'power2.inOut' },
                index // Start at the integer index (0, 1, 2...)
            );

            // Fade out previous panel slightly faster to avoid muddy overlap
            if (index > 0) {
                tl.to(
                    panelsRef.current[index - 1],
                    { opacity: 0, duration: 0.5 },
                    index
                )
            }
        });

        // Text animations are handled by the activeScene state for cleaner React updates,
        // but we can also use GSAP for them if we want precise scrub control.
        // Here we use a hybrid approach: GSAP controls the background "film strip",
        // React state controls the UI overlays.

        return () => {
            ScrollTrigger.getAll().forEach((t) => t.kill());
        };
    }, []);

    return (
        <div style={{ background: '#000', minHeight: '100vh' }}>
            {/* Scroll Container (Height determines scroll length) */}
            <div
                ref={containerRef}
                style={{
                    height: '100vh',
                    width: '100%',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {/* Background Panels */}
                {SCENES.map((scene, index) => (
                    <div
                        key={scene.id}
                        ref={(el) => { panelsRef.current[index] = el; }}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            zIndex: index,
                            opacity: index === 0 ? 1 : 0, // First one visible by default
                            background: `url(${scene.image}) center/cover no-repeat`,
                            willChange: 'opacity, transform',
                        }}
                    >
                        {/* Dark Overlay for text readability */}
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7))',
                        }} />
                    </div>
                ))}

                {/* Film Grain Overlay */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 50,
                    pointerEvents: 'none',
                    opacity: 0.05,
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                }} />

                {/* Vignette */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 51,
                    pointerEvents: 'none',
                    background: 'radial-gradient(circle, transparent 50%, rgba(0,0,0,0.8) 100%)',
                }} />

                {/* Text & UI Layer */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '2rem',
                }}>
                    {SCENES.map((scene, index) => (
                        <div
                            key={`text-${scene.id}`}
                            style={{
                                position: 'absolute',
                                opacity: activeScene === index ? 1 : 0,
                                transform: activeScene === index ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
                                transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                                maxWidth: '800px',
                                pointerEvents: activeScene === index ? 'auto' : 'none',
                            }}
                        >
                            <h1 style={{
                                fontSize: 'clamp(3rem, 8vw, 6rem)',
                                fontWeight: '900',
                                color: 'white',
                                marginBottom: '1rem',
                                textShadow: '0 10px 30px rgba(0,0,0,0.5)',
                                fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
                                letterSpacing: '-0.02em',
                            }}>
                                {scene.text}
                            </h1>

                            <p style={{
                                fontSize: 'clamp(1.2rem, 3vw, 2rem)',
                                color: 'rgba(255,255,255,0.9)',
                                marginBottom: '3rem',
                                textShadow: '0 5px 15px rgba(0,0,0,0.5)',
                                fontFamily: '"Nunito", system-ui, sans-serif',
                                fontWeight: '300',
                            }}>
                                {scene.subtext}
                            </p>

                            {scene.isLast && (
                                <button
                                    onClick={() => navigate('/story')}
                                    style={{
                                        background: 'white',
                                        color: 'black',
                                        border: 'none',
                                        padding: '1.5rem 4rem',
                                        fontSize: '1.5rem',
                                        fontWeight: '800',
                                        borderRadius: '100px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '1rem',
                                        boxShadow: '0 0 50px rgba(255,255,255,0.5)',
                                        transition: 'transform 0.2s',
                                        fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    Starten
                                    <ArrowRight size={24} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {/* Progress Indicators */}
                <div style={{
                    position: 'absolute',
                    right: '2rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                }}>
                    {SCENES.map((_, index) => (
                        <div
                            key={index}
                            style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                background: activeScene === index ? 'white' : 'rgba(255,255,255,0.3)',
                                transition: 'all 0.3s ease',
                                boxShadow: activeScene === index ? '0 0 10px rgba(255,255,255,0.8)' : 'none',
                            }}
                        />
                    ))}
                </div>

                {/* Scroll Hint */}
                <div style={{
                    position: 'absolute',
                    bottom: '2rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 100,
                    color: 'white',
                    opacity: activeScene === SCENES.length - 1 ? 0 : 0.7,
                    transition: 'opacity 0.5s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                }}>
                    <span style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '2px' }}>Scrollen</span>
                    <div style={{
                        width: '1px',
                        height: '40px',
                        background: 'linear-gradient(to bottom, white, transparent)',
                    }} />
                </div>
            </div>

            {/* Spacer to allow scrolling */}
            <div style={{ height: `${(SCENES.length - 1) * 100}vh` }} />
        </div>
    );
};

export default CinematicLanding;
