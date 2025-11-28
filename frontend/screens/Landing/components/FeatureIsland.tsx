import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';

interface FeatureIslandProps {
    id: string;
    title: string;
    description: string;
    bullets: string[];
    icon: string;
    color: string;
    image?: string;
    position: { x: number; y: number };
    isActive: boolean;
    progress: number;
}

const FeatureIsland: React.FC<FeatureIslandProps> = ({
    id,
    title,
    description,
    bullets,
    icon,
    color,
    image,
    position,
    isActive,
    progress,
}) => {
    const islandRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!islandRef.current || !contentRef.current) return;

        if (isActive) {
            gsap.to(islandRef.current, {
                scale: 1,
                opacity: 1,
                duration: 0.8,
                ease: 'back.out(1.7)',
            });

            gsap.fromTo(
                contentRef.current.children,
                { opacity: 0, y: 30 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.6,
                    stagger: 0.1,
                    delay: 0.3,
                    ease: 'power3.out',
                }
            );
        } else {
            gsap.to(islandRef.current, {
                scale: 0.8,
                opacity: 0.3,
                duration: 0.5,
            });
        }
    }, [isActive]);

    return (
        <div
            ref={islandRef}
            className="feature-island"
            style={{
                position: 'absolute',
                left: `${position.x}%`,
                top: `${position.y}%`,
                transform: 'translate(-50%, -50%)',
                width: '100%',
                maxWidth: '600px',
                padding: '2rem',
                opacity: 0.3,
                scale: 0.8,
            }}
        >
            {/* Island Background */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
                    borderRadius: '30px',
                    border: `2px solid ${color}30`,
                    backdropFilter: 'blur(20px)',
                    boxShadow: `0 20px 60px ${color}20, inset 0 0 60px ${color}10`,
                }}
            />

            {/* Content */}
            <div
                ref={contentRef}
                style={{
                    position: 'relative',
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem',
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div
                        style={{
                            fontSize: '3rem',
                            width: '80px',
                            height: '80px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: `linear-gradient(135deg, ${color} 0%, ${color}AA 100%)`,
                            borderRadius: '20px',
                            boxShadow: `0 10px 30px ${color}50`,
                        }}
                    >
                        {icon}
                    </div>
                    <div>
                        <h2
                            style={{
                                fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                                fontWeight: '800',
                                color: 'white',
                                fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
                                margin: 0,
                                textShadow: '0 4px 20px rgba(0,0,0,0.3)',
                            }}
                        >
                            {title}
                        </h2>
                        <p
                            style={{
                                fontSize: '1.1rem',
                                color: 'rgba(255,255,255,0.7)',
                                margin: 0,
                                fontFamily: '"Nunito", system-ui, sans-serif',
                            }}
                        >
                            {description}
                        </p>
                    </div>
                </div>

                {/* Image */}
                {image && (
                    <div
                        style={{
                            width: '100%',
                            height: '200px',
                            borderRadius: '16px',
                            background: `url(${image}) center/cover no-repeat`,
                            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                            border: '2px solid rgba(255,255,255,0.1)',
                        }}
                    />
                )}

                {/* Bullets */}
                <ul
                    style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                    }}
                >
                    {bullets.map((bullet, i) => (
                        <li
                            key={i}
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '0.75rem',
                                fontSize: '1.1rem',
                                color: 'rgba(255,255,255,0.9)',
                                fontFamily: '"Nunito", system-ui, sans-serif',
                            }}
                        >
                            <span
                                style={{
                                    color: color,
                                    fontSize: '1.2rem',
                                    flexShrink: 0,
                                }}
                            >
                                ✦
                            </span>
                            {bullet}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Floating Decoration */}
            <div
                style={{
                    position: 'absolute',
                    top: '-20px',
                    right: '-20px',
                    fontSize: '2rem',
                    animation: 'float 3s ease-in-out infinite',
                }}
            >
                ✨
            </div>
        </div>
    );
};

// Feature data
export const FEATURES = [
    {
        id: 'storywald',
        title: 'Der Storywald',
        description: 'Jede Nacht eine neue, persönliche Geschichte',
        bullets: [
            'KI schreibt Geschichten mit deinem Kind als Held*in',
            'Wähle Thema, Länge & Stimmung mit wenigen Klicks',
            'Passend zum Alter – die Geschichten wachsen mit',
        ],
        icon: '🌲',
        color: '#24C5A8',
        position: { x: 25, y: 50 },
        image: '/landing-assets/cine_4_stories.png',
    },
    {
        id: 'avatar-werkstatt',
        title: 'Die Avatar-Werkstatt',
        description: 'Dein Kind als Hauptfigur',
        bullets: [
            'Erstelle in Sekunden einen Avatar, der deinem Kind ähnlich sieht',
            'Mehrere Avatare für Geschwister & Freunde',
            'Nutzbar in Geschichten und Dokus',
        ],
        icon: '🎨',
        color: '#7C4DFF',
        position: { x: 75, y: 40 },
        image: '/landing-assets/cine_3_avatars.png',
    },
    {
        id: 'wissensberge',
        title: 'Die Wissensberge',
        description: 'Entdecke die Welt mit kindgerechten Dokus',
        bullets: [
            'Wähle ein Thema – Talea erklärt es in Bildern & Geschichten',
            'Komplett kindgerecht, verständlich und spannend',
            'Perfekt als Ergänzung zu Schule & Neugier-Fragen',
        ],
        icon: '🔭',
        color: '#667EEA',
        position: { x: 50, y: 35 },
        image: '/landing-assets/cine_5_dokus.png',
    },
    {
        id: 'erinnerungsbaum',
        title: 'Der Erinnerungsbaum',
        description: 'Avatare, die sich alles merken',
        bullets: [
            'Jede gelesene Geschichte wird als Erinnerung gespeichert',
            'Avatare erinnern sich an Entscheidungen und Erlebnisse',
            'Später nehmen sie darauf Bezug – ganz wie echte Freunde',
        ],
        icon: '🌳',
        color: '#FFCE45',
        position: { x: 30, y: 60 },
    },
    {
        id: 'werte-garten',
        title: 'Der Werte-Garten',
        description: 'Werte & Fähigkeiten wachsen mit jeder Story',
        bullets: [
            'Definiere Lernziele (Mut, Wissen, Empathie, Wortschatz…)',
            'Geschichten und Dokus richten sich nach diesen Zielen',
            'Ein Dashboard zeigt dir, wie sich dein Kind entwickelt',
        ],
        icon: '🌻',
        color: '#F093FB',
        position: { x: 70, y: 55 },
    },
    {
        id: 'eltern-lounge',
        title: 'Die Eltern-Lounge',
        description: 'Du behältst immer die Kontrolle',
        bullets: [
            'Alters- und Inhaltsfilter per Klick einstellbar',
            'Transparente Übersicht über Themen & Lernfortschritte',
            'Datenschutz & Sicherheit nach höchsten Standards',
        ],
        icon: '🏰',
        color: '#FF7043',
        position: { x: 50, y: 70 },
    },
];

export default FeatureIsland;
