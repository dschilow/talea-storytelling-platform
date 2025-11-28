import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';

interface PricingCardProps {
    title: string;
    price: string;
    period: string;
    features: string[];
    isPopular?: boolean;
    color: string;
    icon: string;
    delay?: number;
}

const PricingCard: React.FC<PricingCardProps> = ({
    title,
    price,
    period,
    features,
    isPopular = false,
    color,
    icon,
    delay = 0,
}) => {
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!cardRef.current) return;

        gsap.fromTo(
            cardRef.current,
            { opacity: 0, y: 50, rotateY: -15 },
            {
                opacity: 1,
                y: 0,
                rotateY: 0,
                duration: 0.8,
                delay,
                ease: 'back.out(1.7)',
            }
        );
    }, [delay]);

    return (
        <div
            ref={cardRef}
            style={{
                position: 'relative',
                padding: isPopular ? '2.5rem' : '2rem',
                background: isPopular
                    ? `linear-gradient(135deg, ${color}20 0%, ${color}10 100%)`
                    : 'rgba(255,255,255,0.05)',
                borderRadius: '24px',
                border: isPopular ? `2px solid ${color}` : '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(20px)',
                boxShadow: isPopular
                    ? `0 20px 60px ${color}30, 0 0 40px ${color}10`
                    : '0 10px 40px rgba(0,0,0,0.2)',
                transform: isPopular ? 'scale(1.05)' : 'scale(1)',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                cursor: 'pointer',
                minWidth: '280px',
                flex: 1,
            }}
            onMouseEnter={(e) => {
                gsap.to(e.currentTarget, {
                    scale: isPopular ? 1.08 : 1.03,
                    duration: 0.3,
                    ease: 'power2.out',
                });
            }}
            onMouseLeave={(e) => {
                gsap.to(e.currentTarget, {
                    scale: isPopular ? 1.05 : 1,
                    duration: 0.3,
                    ease: 'power2.out',
                });
            }}
        >
            {/* Popular Badge */}
            {isPopular && (
                <div
                    style={{
                        position: 'absolute',
                        top: '-12px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`,
                        color: 'white',
                        padding: '0.5rem 1.5rem',
                        borderRadius: '20px',
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        boxShadow: `0 4px 20px ${color}50`,
                    }}
                >
                    ⭐ Beliebt
                </div>
            )}

            {/* Icon */}
            <div
                style={{
                    fontSize: '3rem',
                    marginBottom: '1rem',
                    textAlign: 'center',
                }}
            >
                {icon}
            </div>

            {/* Title */}
            <h3
                style={{
                    fontSize: '1.5rem',
                    fontWeight: '700',
                    color: 'white',
                    textAlign: 'center',
                    marginBottom: '0.5rem',
                    fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
                }}
            >
                {title}
            </h3>

            {/* Price */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <span
                    style={{
                        fontSize: '3rem',
                        fontWeight: '900',
                        color: color,
                        fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
                    }}
                >
                    {price}
                </span>
                <span
                    style={{
                        fontSize: '1rem',
                        color: 'rgba(255,255,255,0.6)',
                    }}
                >
                    {period}
                </span>
            </div>

            {/* Features */}
            <ul
                style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    marginBottom: '2rem',
                }}
            >
                {features.map((feature, i) => (
                    <li
                        key={i}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.5rem 0',
                            color: 'rgba(255,255,255,0.9)',
                            fontSize: '0.95rem',
                            fontFamily: '"Nunito", system-ui, sans-serif',
                        }}
                    >
                        <span style={{ color: color }}>✓</span>
                        {feature}
                    </li>
                ))}
            </ul>

            {/* CTA Button */}
            <button
                style={{
                    width: '100%',
                    padding: '1rem 2rem',
                    background: isPopular
                        ? `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`
                        : 'rgba(255,255,255,0.1)',
                    color: 'white',
                    border: isPopular ? 'none' : '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '12px',
                    fontSize: '1.1rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
                    boxShadow: isPopular ? `0 10px 30px ${color}40` : 'none',
                }}
            >
                {isPopular ? 'Jetzt starten' : 'Auswählen'}
            </button>
        </div>
    );
};

interface PricingSectionProps {
    isVisible: boolean;
}

const PricingSection: React.FC<PricingSectionProps> = ({ isVisible }) => {
    const sectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!sectionRef.current || !isVisible) return;

        gsap.fromTo(
            sectionRef.current,
            { opacity: 0, y: 50 },
            { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }
        );
    }, [isVisible]);

    const plans = [
        {
            title: 'Starter',
            price: '€4,99',
            period: '/Monat',
            icon: '📖',
            color: '#24C5A8',
            features: [
                '5 Geschichten pro Monat',
                '1 Avatar',
                'Standard-Themen',
                'Basis-Support',
            ],
        },
        {
            title: 'Familie',
            price: '€9,99',
            period: '/Monat',
            icon: '👨‍👩‍👧‍👦',
            color: '#7C4DFF',
            isPopular: true,
            features: [
                '20 Geschichten pro Monat',
                '5 Avatare',
                'Alle Themen + Dokus',
                'Avatar-Gedächtnis',
                'Lernziel-Tracking',
                'Prioritäts-Support',
            ],
        },
        {
            title: 'Premium',
            price: '€14,99',
            period: '/Monat',
            icon: '👑',
            color: '#FFCE45',
            features: [
                'Unbegrenzte Geschichten',
                'Unbegrenzte Avatare',
                'Alle Features',
                'Eigene Charaktere',
                'Offline-Modus',
                'VIP-Support',
            ],
        },
    ];

    return (
        <div
            ref={sectionRef}
            style={{
                padding: '4rem 2rem',
                maxWidth: '1200px',
                margin: '0 auto',
                opacity: 0,
            }}
        >
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                <h2
                    style={{
                        fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                        fontWeight: '900',
                        color: 'white',
                        marginBottom: '1rem',
                        fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
                    }}
                >
                    Wähle deinen Plan
                </h2>
                <p
                    style={{
                        fontSize: '1.2rem',
                        color: 'rgba(255,255,255,0.7)',
                        fontFamily: '"Nunito", system-ui, sans-serif',
                    }}
                >
                    Starte noch heute und entdecke die Magie personalisierter Geschichten
                </p>
            </div>

            {/* Cards */}
            <div
                style={{
                    display: 'flex',
                    gap: '2rem',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    alignItems: 'stretch',
                    perspective: '1000px',
                }}
            >
                {plans.map((plan, i) => (
                    <PricingCard key={plan.title} {...plan} delay={i * 0.15} />
                ))}
            </div>

            {/* Trust Badges */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '3rem',
                    marginTop: '3rem',
                    flexWrap: 'wrap',
                }}
            >
                {[
                    { icon: '🔒', text: 'SSL verschlüsselt' },
                    { icon: '🛡️', text: 'DSGVO konform' },
                    { icon: '💳', text: 'Jederzeit kündbar' },
                    { icon: '✨', text: '7 Tage kostenlos' },
                ].map((badge) => (
                    <div
                        key={badge.text}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: '0.9rem',
                        }}
                    >
                        <span style={{ fontSize: '1.2rem' }}>{badge.icon}</span>
                        {badge.text}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PricingSection;
