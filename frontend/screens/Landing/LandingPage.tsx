import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Sparkles, Star, BookOpen, Users, Brain, Heart, Shield, TreePine } from 'lucide-react';
import './LandingPage.css';

gsap.registerPlugin(ScrollTrigger);

// Feature configuration (without text - text comes from translations)
const FEATURE_CONFIG = [
    { id: 'stories', icon: BookOpen, color: '#24C5A8', emoji: '📚' },
    { id: 'avatars', icon: Users, color: '#7C4DFF', emoji: '🎭' },
    { id: 'learning', icon: Brain, color: '#F093FB', emoji: '🧠' },
    { id: 'memory', icon: TreePine, color: '#FFCE45', emoji: '🌳' },
    { id: 'values', icon: Heart, color: '#FF6B6B', emoji: '💝' },
    { id: 'parents', icon: Shield, color: '#4ECDC4', emoji: '🛡️' },
];

// Pricing configuration (without text - text comes from translations)
const PRICING_CONFIG = [
    { id: 'starter', popular: false },
    { id: 'family', popular: true },
    { id: 'premium', popular: false },
];

const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
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
                    {t('landing.nav.start')}
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
                        <p>{t('landing.hero.tagline')}</p>
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
                                                        <p className="page-text">{t('landing.hero.page1')}</p>
                                                    </>
                                                )}
                                                {pageNum === 2 && (
                                                    <>
                                                        <span className="page-emoji">🏰</span>
                                                        <p className="page-text">{t('landing.hero.page2')}</p>
                                                    </>
                                                )}
                                                {pageNum === 3 && (
                                                    <>
                                                        <span className="page-emoji">🌟</span>
                                                        <p className="page-text">{t('landing.hero.page3')}</p>
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
                                        <p>{t('landing.hero.coverTitle')}</p>
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
                        <span>{t('landing.hero.scrollHint')}</span>
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
                            {t('landing.features.title')}
                        </h2>

                        <div className="features-grid">
                            {FEATURE_CONFIG.map((feature, index) => {
                                const isVisible = scrollProgress > 0.2 + index * 0.06;
                                const Icon = feature.icon;

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
                                        <h3>{t(`landing.features.${feature.id}.title`)}</h3>
                                        <p className="feature-subtitle">{t(`landing.features.${feature.id}.subtitle`)}</p>
                                        <p className="feature-description">{t(`landing.features.${feature.id}.description`)}</p>
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
                            {t('landing.pricing.title')}
                        </h2>

                        <div className="pricing-grid">
                            {PRICING_CONFIG.map((plan, index) => {
                                const features = t(`landing.pricing.${plan.id}.features`, { returnObjects: true }) as string[];
                                return (
                                    <div
                                        key={plan.id}
                                        className={`pricing-card ${plan.popular ? 'popular' : ''}`}
                                        style={{ transitionDelay: `${index * 0.15}s` }}
                                    >
                                        {plan.popular && <div className="popular-badge">{t('landing.pricing.popular')}</div>}
                                        <h3>{t(`landing.pricing.${plan.id}.name`)}</h3>
                                        <div className="price">
                                            <span className="amount">{t(`landing.pricing.${plan.id}.price`)}</span>
                                            <span className="period">{t(`landing.pricing.${plan.id}.period`, { defaultValue: '' })}</span>
                                        </div>
                                        <ul className="features-list">
                                            {Array.isArray(features) && features.map((feature: string) => (
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
                                            {t(`landing.pricing.${plan.id}.cta`)}
                                            <ArrowRight size={18} />
                                        </button>
                                    </div>
                                );
                            })}
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
                    <p>{t('landing.footer.copyright')}</p>
                    <div className="footer-links">
                        <a href="/privacy">{t('landing.footer.privacy')}</a>
                        <a href="/terms">{t('landing.footer.terms')}</a>
                        <a href="/contact">{t('landing.footer.contact')}</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
