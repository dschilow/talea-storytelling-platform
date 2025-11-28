import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Sparkles, Star, BookOpen, Users, Brain, Heart, Shield, TreePine } from 'lucide-react';
import './LandingPage.css';

gsap.registerPlugin(ScrollTrigger);

// Feature data
const FEATURES = [
    {
        id: 'stories',
        icon: BookOpen,
        title: 'Personalisierte Geschichten',
        subtitle: 'Der Storywald',
        description: 'Dein Kind wird zur Hauptfigur in magischen Märchen, Abenteuern und Dokumentationen.',
        color: '#24C5A8',
        emoji: '📚',
    },
    {
        id: 'avatars',
        icon: Users,
        title: 'Einzigartige Avatare',
        subtitle: 'Die Avatar-Werkstatt',
        description: 'Erstelle einen digitalen Zwilling deines Kindes, der in jeder Geschichte lebendig wird.',
        color: '#7C4DFF',
        emoji: '🎭',
    },
    {
        id: 'learning',
        icon: Brain,
        title: 'Spielend Lernen',
        subtitle: 'Die Wissensberge',
        description: 'Bildungsinhalte verpackt in spannende Geschichten, die Neugier wecken.',
        color: '#F093FB',
        emoji: '🧠',
    },
    {
        id: 'memory',
        icon: TreePine,
        title: 'Wachsendes Gedächtnis',
        subtitle: 'Der Erinnerungsbaum',
        description: 'Talea merkt sich alles und baut auf vorherigen Abenteuern auf.',
        color: '#FFCE45',
        emoji: '🌳',
    },
    {
        id: 'values',
        icon: Heart,
        title: 'Werte vermitteln',
        subtitle: 'Der Werte-Garten',
        description: 'Freundschaft, Mut und Mitgefühl – kindgerecht in Geschichten eingebettet.',
        color: '#FF6B6B',
        emoji: '💝',
    },
    {
        id: 'parents',
        icon: Shield,
        title: 'Volle Kontrolle',
        subtitle: 'Die Eltern-Lounge',
        description: 'Du bestimmst Themen, Länge und Inhalte. 100% kindersicher.',
        color: '#4ECDC4',
        emoji: '🛡️',
    },
];

const PRICING = [
    {
        name: 'Starter',
        price: 'Kostenlos',
        period: '',
        features: ['3 Geschichten pro Monat', '1 Avatar', 'Standard-Qualität'],
        cta: 'Kostenlos starten',
        popular: false,
    },
    {
        name: 'Familie',
        price: '€9,99',
        period: '/Monat',
        features: ['Unbegrenzte Geschichten', '5 Avatare', 'HD-Qualität', 'Gedächtnis-Funktion', 'Keine Werbung'],
        cta: 'Jetzt starten',
        popular: true,
    },
    {
        name: 'Premium',
        price: '€19,99',
        period: '/Monat',
        features: ['Alles aus Familie', 'Unbegrenzte Avatare', '4K-Qualität', 'Prioritäts-Support', 'Frühzugang zu Features'],
        cta: 'Premium wählen',
        popular: false,
    },
];

const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);
    const bookRef = useRef<HTMLDivElement>(null);
    
    const [scrollProgress, setScrollProgress] = useState(0);

    // Book animation with ScrollTrigger
    useEffect(() => {
        const ctx = gsap.context(() => {
            // Main scroll progress
            ScrollTrigger.create({
                trigger: containerRef.current,
                start: 'top top',
                end: 'bottom bottom',
                scrub: 0.5,
                onUpdate: (self) => {
                    setScrollProgress(self.progress);
                },
            });

            // Book cover opening animation
            const frontCover = document.querySelector('.book-cover-front');
            if (frontCover) {
                gsap.to(frontCover, {
                    rotateY: -160,
                    scrollTrigger: {
                        trigger: '.book-section',
                        start: 'top top',
                        end: '30% top',
                        scrub: 1,
                    },
                });
            }

            // Pages animation - each page turns one after another
            const pages = document.querySelectorAll('.book-page');
            pages.forEach((page, index) => {
                gsap.to(page, {
                    rotateY: -160,
                    scrollTrigger: {
                        trigger: '.book-section',
                        start: `${15 + index * 10}% top`,
                        end: `${35 + index * 10}% top`,
                        scrub: 1,
                    },
                });
            });

        }, containerRef);

        return () => ctx.revert();
    }, []);

    // Calculate section visibility
    const bookProgress = Math.min(scrollProgress * 4, 1);
    const showFeatures = scrollProgress > 0.2;
    const showPricing = scrollProgress > 0.75;

    return (
        <div 
            ref={containerRef}
            className="landing-container"
        >
            {/* Fixed Navigation */}
            <nav className="landing-nav">
                <div className="nav-logo">
                    <Sparkles className="nav-icon" />
                    <span>Talea</span>
                </div>
                <button 
                    className="nav-cta"
                    onClick={() => navigate('/story')}
                >
                    Jetzt starten
                </button>
            </nav>

            {/* Progress Bar */}
            <div 
                className="progress-bar"
                style={{ width: `${scrollProgress * 100}%` }}
            />

            {/* Sticky Content Container */}
            <div className="sticky-container">
                
                {/* Stars Background */}
                <div className="stars-bg">
                    {[...Array(50)].map((_, i) => (
                        <div
                            key={i}
                            className="star"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 3}s`,
                                width: `${2 + Math.random() * 3}px`,
                                height: `${2 + Math.random() * 3}px`,
                            }}
                        />
                    ))}
                </div>

                {/* SECTION 1: Book Animation */}
                <section 
                    className="book-section"
                    style={{
                        opacity: bookProgress < 0.8 ? 1 : 1 - (bookProgress - 0.8) * 5,
                        transform: `scale(${1 - bookProgress * 0.15})`,
                        pointerEvents: bookProgress > 0.9 ? 'none' : 'auto',
                    }}
                >
                    {/* Hero Text above book */}
                    <div 
                        className="hero-text"
                        style={{ opacity: Math.max(0, 1 - bookProgress * 2) }}
                    >
                        <h1>Talea</h1>
                        <p>Magische Geschichten für dein Kind</p>
                    </div>

                    {/* The 3D Book */}
                    <div ref={bookRef} className="book-3d">
                        <div className="book-wrapper">
                            {/* Back Cover (always visible) */}
                            <div className="book-cover-back">
                                <div className="cover-pattern" />
                            </div>

                            {/* Inner Pages */}
                            <div className="book-pages">
                                {[1, 2, 3].map((pageNum) => (
                                    <div key={pageNum} className={`book-page page-${pageNum}`}>
                                        <div className="page-front">
                                            <div className="page-content">
                                                {pageNum === 1 && (
                                                    <>
                                                        <span className="page-emoji">✨</span>
                                                        <p className="page-text">Es war einmal...</p>
                                                    </>
                                                )}
                                                {pageNum === 2 && (
                                                    <>
                                                        <span className="page-emoji">🏰</span>
                                                        <p className="page-text">...ein Kind voller Träume.</p>
                                                    </>
                                                )}
                                                {pageNum === 3 && (
                                                    <>
                                                        <span className="page-emoji">🌟</span>
                                                        <p className="page-text">Deine Reise beginnt hier.</p>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="page-back" />
                                    </div>
                                ))}
                            </div>

                            {/* Front Cover (opens first) */}
                            <div className="book-cover-front">
                                <div className="cover-front-face">
                                    <div className="cover-border" />
                                    <div className="cover-title">
                                        <Star className="cover-star" />
                                        <h2>Talea</h2>
                                        <p>Deine Geschichte</p>
                                        <div className="cover-emojis">
                                            <span>🌟</span>
                                            <span>📖</span>
                                            <span>🌟</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="cover-back-face" />
                            </div>

                            {/* Spine */}
                            <div className="book-spine">
                                <span>T A L E A</span>
                            </div>
                        </div>
                    </div>

                    {/* Scroll Hint */}
                    <div 
                        className="scroll-hint"
                        style={{ opacity: Math.max(0, 1 - bookProgress * 3) }}
                    >
                        <span>Scroll zum Öffnen</span>
                        <div className="scroll-mouse">
                            <div className="scroll-wheel" />
                        </div>
                    </div>
                </section>

                {/* SECTION 2: Features */}
                {showFeatures && (
                    <section 
                        className="features-section"
                        style={{
                            opacity: showPricing ? Math.max(0, 1 - (scrollProgress - 0.75) * 4) : Math.min((scrollProgress - 0.2) * 3, 1),
                        }}
                    >
                        <h2 className="section-title">
                            <span className="title-emoji">🌍</span>
                            Entdecke die Welt von Talea
                        </h2>
                        
                        <div className="features-grid">
                            {FEATURES.map((feature, index) => {
                                const isVisible = scrollProgress > 0.2 + index * 0.06;
                                
                                return (
                                    <div 
                                        key={feature.id}
                                        className={`feature-card ${isVisible ? 'visible' : ''}`}
                                        style={{
                                            '--feature-color': feature.color,
                                            transitionDelay: `${index * 0.1}s`,
                                        } as React.CSSProperties}
                                    >
                                        <div className="feature-icon">
                                            <span className="feature-emoji">{feature.emoji}</span>
                                        </div>
                                        <h3>{feature.title}</h3>
                                        <p className="feature-subtitle">{feature.subtitle}</p>
                                        <p className="feature-description">{feature.description}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* SECTION 3: Pricing */}
                {showPricing && (
                    <section 
                        className="pricing-section"
                        style={{
                            opacity: Math.min((scrollProgress - 0.75) * 4, 1),
                        }}
                    >
                        <h2 className="section-title">
                            <span className="title-emoji">💎</span>
                            Wähle deinen Plan
                        </h2>
                        
                        <div className="pricing-grid">
                            {PRICING.map((plan, index) => (
                                <div 
                                    key={plan.name}
                                    className={`pricing-card ${plan.popular ? 'popular' : ''}`}
                                    style={{ transitionDelay: `${index * 0.15}s` }}
                                >
                                    {plan.popular && <div className="popular-badge">Beliebt</div>}
                                    <h3>{plan.name}</h3>
                                    <div className="price">
                                        <span className="amount">{plan.price}</span>
                                        <span className="period">{plan.period}</span>
                                    </div>
                                    <ul className="features-list">
                                        {plan.features.map((feature) => (
                                            <li key={feature}>
                                                <Sparkles size={14} />
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>
                                    <button 
                                        className={`pricing-cta ${plan.popular ? 'primary' : ''}`}
                                        onClick={() => navigate('/story')}
                                    >
                                        {plan.cta}
                                        <ArrowRight size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="footer-content">
                    <div className="footer-logo">
                        <Sparkles />
                        <span>Talea</span>
                    </div>
                    <p>Magische Geschichten für Kinder © 2025</p>
                    <div className="footer-links">
                        <a href="/privacy">Datenschutz</a>
                        <a href="/terms">AGB</a>
                        <a href="/contact">Kontakt</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
