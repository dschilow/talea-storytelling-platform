import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { ArrowRight, Sparkles, Menu, X } from 'lucide-react';

import HeroSection from './components/HeroSection';
import StarField from './components/StarField';
import MagicParticles from './components/MagicParticles';
import WorldMap from './components/WorldMap';
import FeatureIsland, { FEATURES } from './components/FeatureIsland';
import PricingSection from './components/PricingSection';
import Footer from './components/Footer';

import './LandingPage.css';

gsap.registerPlugin(ScrollTrigger);

// Custom hook for responsive design
const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return isMobile;
};

// Custom hook for reduced motion preference
const usePrefersReducedMotion = () => {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        setPrefersReducedMotion(mediaQuery.matches);

        const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    return prefersReducedMotion;
};

// Scenes/Chapters of the landing page
const CHAPTERS = [
    { id: 'hero', name: 'Das Buch', progress: 0 },
    { id: 'world', name: 'Die Welt', progress: 0.15 },
    { id: 'storywald', name: 'Storywald', progress: 0.25 },
    { id: 'avatar-werkstatt', name: 'Avatare', progress: 0.40 },
    { id: 'wissensberge', name: 'Wissen', progress: 0.55 },
    { id: 'erinnerungsbaum', name: 'Gedächtnis', progress: 0.70 },
    { id: 'werte-garten', name: 'Werte', progress: 0.80 },
    { id: 'eltern-lounge', name: 'Eltern', progress: 0.88 },
    { id: 'pricing', name: 'Preise', progress: 0.95 },
];

const TaleaLandingPage: React.FC = () => {
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);
    const stickyContainerRef = useRef<HTMLDivElement>(null);
    const lenisRef = useRef<Lenis | null>(null);

    const isMobile = useIsMobile();
    const prefersReducedMotion = usePrefersReducedMotion();

    const [scrollProgress, setScrollProgress] = useState(0);
    const [activeChapter, setActiveChapter] = useState(0);
    const [bookOpened, setBookOpened] = useState(false);
    const [showWorld, setShowWorld] = useState(false);
    const [activeFeature, setActiveFeature] = useState(-1);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Initialize Lenis smooth scroll (disabled on mobile for better performance)
    useEffect(() => {
        if (isMobile || prefersReducedMotion) {
            // Use native scroll on mobile
            return;
        }

        lenisRef.current = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
            wheelMultiplier: 1,
            touchMultiplier: 2,
        });

        function raf(time: number) {
            lenisRef.current?.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);

        // Sync Lenis with ScrollTrigger
        lenisRef.current.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => {
            lenisRef.current?.raf(time * 1000);
        });
        gsap.ticker.lagSmoothing(0);

        return () => {
            lenisRef.current?.destroy();
        };
    }, [isMobile, prefersReducedMotion]);

    // Main scroll animation
    useEffect(() => {
        const container = containerRef.current;
        const stickyContainer = stickyContainerRef.current;
        if (!container || !stickyContainer) return;

        const scrollTrigger = ScrollTrigger.create({
            trigger: container,
            start: 'top top',
            end: 'bottom bottom',
            scrub: isMobile ? 0.2 : 0.5, // Faster on mobile
            onUpdate: (self) => {
                const progress = self.progress;
                setScrollProgress(progress);

                // Determine active chapter
                for (let i = CHAPTERS.length - 1; i >= 0; i--) {
                    if (progress >= CHAPTERS[i].progress) {
                        setActiveChapter(i);
                        break;
                    }
                }

                // Show world after book opens
                if (progress > 0.1) {
                    setShowWorld(true);
                }

                // Determine active feature
                const featureStart = 0.25;
                const featureEnd = 0.90;
                if (progress >= featureStart && progress <= featureEnd) {
                    const featureProgress = (progress - featureStart) / (featureEnd - featureStart);
                    const featureIndex = Math.floor(featureProgress * FEATURES.length);
                    setActiveFeature(Math.min(featureIndex, FEATURES.length - 1));
                } else {
                    setActiveFeature(-1);
                }
            },
        });

        return () => {
            scrollTrigger.kill();
        };
    }, []);

    const handleBookOpened = useCallback(() => {
        setBookOpened(true);
    }, []);

    // Calculate section-specific progress values
    // heroProgress goes from 0 to 1 in the first 20% of scroll
    const heroProgress = Math.min(scrollProgress / 0.20, 1);
    // worldProgress starts at 10% scroll and completes at 25%
    const worldProgress = scrollProgress > 0.08 ? Math.min((scrollProgress - 0.08) / 0.17, 1) : 0;
    // Features start at 25% and go to 90%
    const featuresProgress = scrollProgress > 0.25 ? Math.min((scrollProgress - 0.25) / 0.65, 1) : 0;
    const pricingVisible = scrollProgress > 0.92;
    
    // Hero fades out as world fades in
    const heroOpacity = heroProgress < 0.7 ? 1 : Math.max(0, 1 - (heroProgress - 0.7) * 3.33);
    // World fades in smoothly
    const worldOpacity = worldProgress;

    return (
        <div
            className="landing-page"
            ref={containerRef}
            style={{
                background: 'linear-gradient(180deg, #05081A 0%, #0A0E27 50%, #05081A 100%)',
                minHeight: '1000vh', // Long scroll for all chapters
                position: 'relative',
            }}
        >
            {/* Sticky Container - Stays in view while scrolling */}
            <div
                ref={stickyContainerRef}
                style={{
                    position: 'sticky',
                    top: 0,
                    height: '100vh',
                    width: '100%',
                    overflow: 'hidden',
                }}
            >
                {/* Star Field Background */}
                <StarField intensity={1 - worldProgress * 0.7} />

                {/* World Map (appears after book opens) */}
                {showWorld && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            opacity: worldOpacity,
                            transition: 'opacity 0.3s ease-out',
                            zIndex: 5,
                            background: 'linear-gradient(180deg, #0A0E27 0%, #1A1A3E 30%, #2D2D5A 60%, #1A1A3E 100%)',
                        }}
                    >
                        <WorldMap progress={featuresProgress} activeFeature={activeFeature} />
                    </div>
                )}

                {/* Magic Particles */}
                <MagicParticles
                    active={heroProgress > 0.3 && heroProgress < 0.9}
                    intensity={heroProgress}
                    origin={{ x: 50, y: 40 }}
                />

                {/* Hero Section with Book */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        opacity: heroOpacity,
                        transform: `scale(${1 - heroProgress * 0.15})`,
                        pointerEvents: heroOpacity < 0.1 ? 'none' : 'auto',
                        zIndex: 10,
                        transition: 'opacity 0.2s ease-out',
                    }}
                >
                    <HeroSection
                        scrollProgress={heroProgress}
                        onEnterWorld={handleBookOpened}
                    />
                </div>

                {/* Feature Islands */}
                {showWorld && activeFeature >= 0 && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 20,
                            padding: '2rem',
                        }}
                    >
                        {FEATURES.map((feature, index) => (
                            <FeatureIsland
                                key={feature.id}
                                {...feature}
                                isActive={activeFeature === index}
                                progress={featuresProgress}
                            />
                        ))}
                    </div>
                )}

                {/* Pricing Section */}
                {pricingVisible && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 30,
                            background: 'linear-gradient(180deg, rgba(5,8,26,0.8) 0%, rgba(5,8,26,0.95) 100%)',
                        }}
                    >
                        <PricingSection isVisible={pricingVisible} />
                    </div>
                )}

                {/* Chapter Navigation (Right Side) - Hidden on mobile */}
                {!isMobile && (
                    <nav
                        style={{
                            position: 'fixed',
                            right: '2rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 100,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                        }}
                    >
                        {CHAPTERS.map((chapter, index) => (
                            <button
                                key={chapter.id}
                                onClick={() => {
                                    const targetScroll = chapter.progress * (document.body.scrollHeight - window.innerHeight);
                                    if (lenisRef.current) {
                                        lenisRef.current.scrollTo(targetScroll, { duration: 1.5 });
                                    } else {
                                        window.scrollTo({ top: targetScroll, behavior: 'smooth' });
                                    }
                                }}
                                style={{
                                    width: activeChapter === index ? '40px' : '12px',
                                    height: '12px',
                                    borderRadius: '6px',
                                    background: activeChapter === index
                                        ? 'linear-gradient(90deg, #FFCE45, #7C4DFF)'
                                        : 'rgba(255,255,255,0.3)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    boxShadow: activeChapter === index
                                        ? '0 0 15px rgba(255, 206, 69, 0.6)'
                                        : 'none',
                                }}
                                title={chapter.name}
                            />
                        ))}
                    </nav>
                )}

                {/* Progress Bar (Top) */}
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: `${scrollProgress * 100}%`,
                        height: '3px',
                        background: 'linear-gradient(90deg, #7C4DFF 0%, #FFCE45 50%, #24C5A8 100%)',
                        zIndex: 200,
                        boxShadow: '0 0 20px rgba(255, 206, 69, 0.5)',
                    }}
                />

                {/* Logo (Top Left) */}
                <div
                    style={{
                        position: 'fixed',
                        top: '1.5rem',
                        left: '2rem',
                        zIndex: 100,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                    }}
                >
                    <span
                        style={{
                            fontSize: isMobile ? '1.2rem' : '1.5rem',
                            fontWeight: '900',
                            color: '#FFCE45',
                            fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
                            textShadow: '0 0 20px rgba(255, 206, 69, 0.5)',
                        }}
                    >
                        ✨ Talea
                    </span>
                </div>

                {/* Mobile Menu Button */}
                {isMobile && (
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        style={{
                            position: 'fixed',
                            top: '1.5rem',
                            right: '1rem',
                            zIndex: 150,
                            background: 'rgba(255,255,255,0.1)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.2)',
                            padding: '0.75rem',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            backdropFilter: 'blur(10px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                )}

                {/* Mobile Menu Overlay */}
                {isMobile && mobileMenuOpen && (
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 140,
                            background: 'rgba(5, 8, 26, 0.95)',
                            backdropFilter: 'blur(20px)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '1.5rem',
                            padding: '2rem',
                        }}
                    >
                        {CHAPTERS.map((chapter, index) => (
                            <button
                                key={chapter.id}
                                onClick={() => {
                                    const targetScroll = chapter.progress * (document.body.scrollHeight - window.innerHeight);
                                    window.scrollTo({ top: targetScroll, behavior: 'smooth' });
                                    setMobileMenuOpen(false);
                                }}
                                style={{
                                    background: activeChapter === index
                                        ? 'linear-gradient(90deg, #7C4DFF, #FFCE45)'
                                        : 'transparent',
                                    color: 'white',
                                    border: activeChapter === index ? 'none' : '1px solid rgba(255,255,255,0.2)',
                                    padding: '1rem 2rem',
                                    borderRadius: '50px',
                                    fontSize: '1.1rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    width: '80%',
                                    maxWidth: '300px',
                                    fontFamily: '"Nunito", system-ui, sans-serif',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {chapter.name}
                            </button>
                        ))}

                        <button
                            onClick={() => {
                                navigate('/story');
                                setMobileMenuOpen(false);
                            }}
                            style={{
                                marginTop: '1rem',
                                background: 'linear-gradient(135deg, #FFCE45 0%, #FFB300 100%)',
                                color: '#1A1A2E',
                                border: 'none',
                                padding: '1rem 2.5rem',
                                borderRadius: '50px',
                                fontSize: '1.1rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                width: '80%',
                                maxWidth: '300px',
                                fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
                                boxShadow: '0 10px 40px rgba(255, 206, 69, 0.4)',
                            }}
                        >
                            <Sparkles size={20} />
                            Jetzt starten
                        </button>
                    </div>
                )}

                {/* CTA Button (Top Right) - Hidden on mobile */}
                {!isMobile && (
                    <button
                        onClick={() => navigate('/story')}
                        style={{
                            position: 'fixed',
                            top: '1.5rem',
                            right: '5rem',
                            zIndex: 100,
                            background: 'rgba(255,255,255,0.1)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.2)',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '50px',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            backdropFilter: 'blur(10px)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s',
                            fontFamily: '"Nunito", system-ui, sans-serif',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, #7C4DFF 0%, #5E35B1 100%)';
                            e.currentTarget.style.borderColor = 'transparent';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                        }}
                    >
                        <Sparkles size={16} />
                        Starten
                    </button>
                )}

                {/* Current Chapter Label - Simplified on mobile */}
                <div
                    style={{
                        position: 'fixed',
                        bottom: isMobile ? '1rem' : '2rem',
                        left: isMobile ? '1rem' : '2rem',
                        zIndex: 100,
                        display: 'flex',
                        alignItems: isMobile ? 'flex-start' : 'center',
                        flexDirection: isMobile ? 'column' : 'row',
                        gap: isMobile ? '0.25rem' : '1rem',
                    }}
                >
                    <span
                        style={{
                            fontSize: isMobile ? '0.65rem' : '0.75rem',
                            color: 'rgba(255,255,255,0.4)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.2em',
                        }}
                    >
                        Kapitel {activeChapter + 1}
                    </span>
                    <span
                        style={{
                            fontSize: isMobile ? '0.85rem' : '1rem',
                            color: 'rgba(255,255,255,0.8)',
                            fontWeight: '600',
                            fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
                        }}
                    >
                        {CHAPTERS[activeChapter]?.name}
                    </span>
                </div>
            </div>

            {/* Footer (at the very bottom) */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                }}
            >
                <Footer />
            </div>
        </div>
    );
};

export default TaleaLandingPage;