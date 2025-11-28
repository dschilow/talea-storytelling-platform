import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';

interface WorldMapProps {
    progress: number; // 0-1
    activeFeature: number;
}

const WorldMap: React.FC<WorldMapProps> = ({ progress, activeFeature }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const cloudsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mapRef.current) return;

        // Zoom and pan based on progress
        const scale = 1 + progress * 0.5;
        const translateY = progress * -10;

        gsap.to(mapRef.current, {
            scale,
            y: `${translateY}%`,
            duration: 0.3,
            ease: 'power2.out',
        });
    }, [progress]);

    return (
        <div
            ref={mapRef}
            style={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
            }}
        >
            {/* Sky Gradient */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(
                        180deg,
                        #05081A 0%,
                        #0F1B3D 20%,
                        #1A2F5A 40%,
                        #2D4A7C 60%,
                        #4A6FA5 80%,
                        #7B9BC7 100%
                    )`,
                }}
            />

            {/* Stars (only visible at top) */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: `radial-gradient(circle at 20% 20%, #fff 1px, transparent 1px),
                                radial-gradient(circle at 80% 10%, #fff 1px, transparent 1px),
                                radial-gradient(circle at 40% 30%, #fff 1px, transparent 1px),
                                radial-gradient(circle at 60% 15%, #fff 1.5px, transparent 1.5px),
                                radial-gradient(circle at 90% 25%, #fff 1px, transparent 1px),
                                radial-gradient(circle at 10% 35%, #fff 1.5px, transparent 1.5px)`,
                    opacity: 1 - progress * 2,
                }}
            />

            {/* Moon */}
            <div
                style={{
                    position: 'absolute',
                    top: '10%',
                    right: '15%',
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #FFF9E6 0%, #FFE082 100%)',
                    boxShadow: '0 0 60px rgba(255, 224, 130, 0.6), 0 0 120px rgba(255, 224, 130, 0.3)',
                    opacity: 1 - progress,
                }}
            />

            {/* Floating Islands (Background) */}
            <svg
                style={{
                    position: 'absolute',
                    bottom: '10%',
                    left: '0',
                    width: '100%',
                    height: '80%',
                }}
                viewBox="0 0 1920 800"
                preserveAspectRatio="xMidYMid slice"
            >
                {/* Main Island - Story Forest */}
                <g transform="translate(200, 300)">
                    <ellipse
                        cx="150"
                        cy="100"
                        rx="180"
                        ry="40"
                        fill="#2D5A3D"
                        opacity="0.8"
                    />
                    <ellipse
                        cx="150"
                        cy="90"
                        rx="160"
                        ry="35"
                        fill="#3D7A4D"
                    />
                    {/* Trees */}
                    {[0, 50, 100, 150, 200, 250].map((x, i) => (
                        <g key={i} transform={`translate(${x + 30}, ${60 - i * 5})`}>
                            <polygon
                                points="15,0 30,40 0,40"
                                fill={i % 2 === 0 ? '#1B4D2E' : '#24C5A8'}
                            />
                            <polygon
                                points="15,15 28,45 2,45"
                                fill={i % 2 === 0 ? '#2D6B40' : '#3DD9B8'}
                            />
                        </g>
                    ))}
                </g>

                {/* Avatar Workshop Island */}
                <g transform="translate(1400, 200)">
                    <ellipse
                        cx="120"
                        cy="80"
                        rx="140"
                        ry="35"
                        fill="#4A3B6B"
                        opacity="0.8"
                    />
                    <ellipse
                        cx="120"
                        cy="70"
                        rx="120"
                        ry="30"
                        fill="#5E4A8A"
                    />
                    {/* Castle/Workshop */}
                    <rect x="80" y="20" width="80" height="50" fill="#7C4DFF" rx="5" />
                    <rect x="100" y="-10" width="40" height="30" fill="#9B6DFF" rx="3" />
                    <polygon points="120,-20 140,-10 100,-10" fill="#B78DFF" />
                </g>

                {/* Knowledge Mountains */}
                <g transform="translate(800, 100)">
                    <polygon
                        points="150,120 300,120 225,-20"
                        fill="#4A5A7A"
                    />
                    <polygon
                        points="100,120 200,120 150,20"
                        fill="#5A6A9A"
                    />
                    <polygon
                        points="200,120 280,120 240,30"
                        fill="#6A7AAA"
                    />
                    {/* Snow caps */}
                    <polygon
                        points="225,-20 240,10 210,10"
                        fill="#FFF"
                        opacity="0.9"
                    />
                    {/* Observatory */}
                    <circle cx="150" cy="25" r="15" fill="#667EEA" />
                    <ellipse cx="150" cy="25" rx="20" ry="8" fill="#7B8EFA" />
                </g>

                {/* Memory Tree Island */}
                <g transform="translate(500, 450)">
                    <ellipse
                        cx="100"
                        cy="60"
                        rx="120"
                        ry="30"
                        fill="#5A4A2A"
                        opacity="0.8"
                    />
                    <ellipse
                        cx="100"
                        cy="50"
                        rx="100"
                        ry="25"
                        fill="#7A6A4A"
                    />
                    {/* Giant Tree */}
                    <rect x="85" y="-40" width="30" height="90" fill="#8B5A2B" rx="5" />
                    <circle cx="100" cy="-50" r="60" fill="#FFCE45" opacity="0.6" />
                    <circle cx="100" cy="-50" r="45" fill="#FFD54F" opacity="0.8" />
                    {/* Glowing fruits */}
                    {[
                        { x: 60, y: -70 },
                        { x: 140, y: -60 },
                        { x: 80, y: -30 },
                        { x: 120, y: -40 },
                    ].map((pos, i) => (
                        <circle
                            key={i}
                            cx={pos.x}
                            cy={pos.y}
                            r="8"
                            fill="#FFCE45"
                            style={{ filter: 'drop-shadow(0 0 5px #FFCE45)' }}
                        />
                    ))}
                </g>

                {/* Values Garden */}
                <g transform="translate(1200, 450)">
                    <ellipse
                        cx="100"
                        cy="60"
                        rx="130"
                        ry="35"
                        fill="#4A3A5A"
                        opacity="0.8"
                    />
                    <ellipse
                        cx="100"
                        cy="50"
                        rx="110"
                        ry="28"
                        fill="#5A4A7A"
                    />
                    {/* Flowers */}
                    {[30, 70, 110, 150].map((x, i) => (
                        <g key={i} transform={`translate(${x}, ${30 - i * 3})`}>
                            <rect x="8" y="10" width="4" height="20" fill="#3A8A3A" />
                            <circle cx="10" cy="5" r="12" fill={['#F093FB', '#FF7043', '#FFCE45', '#7C4DFF'][i]} opacity="0.9" />
                        </g>
                    ))}
                </g>

                {/* Parents Lounge (Castle) */}
                <g transform="translate(900, 550)">
                    <ellipse
                        cx="100"
                        cy="50"
                        rx="100"
                        ry="25"
                        fill="#4A4A5A"
                        opacity="0.8"
                    />
                    <ellipse
                        cx="100"
                        cy="40"
                        rx="80"
                        ry="20"
                        fill="#5A5A7A"
                    />
                    {/* Cozy House */}
                    <rect x="60" y="-10" width="80" height="50" fill="#FF7043" rx="5" />
                    <polygon points="100,-30 150,-10 50,-10" fill="#FF8A65" />
                    <rect x="85" y="10" width="30" height="30" fill="#FFCC80" rx="2" />
                    {/* Warm light from window */}
                    <circle cx="100" cy="25" r="20" fill="#FFCC80" opacity="0.3" style={{ filter: 'blur(10px)' }} />
                </g>
            </svg>

            {/* Animated Clouds */}
            <div
                ref={cloudsRef}
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                }}
            >
                {[...Array(5)].map((_, i) => (
                    <div
                        key={i}
                        style={{
                            position: 'absolute',
                            left: `${i * 25 - 10}%`,
                            top: `${20 + i * 10}%`,
                            width: `${100 + i * 30}px`,
                            height: `${40 + i * 10}px`,
                            background: 'rgba(255,255,255,0.15)',
                            borderRadius: '50px',
                            filter: 'blur(20px)',
                            animation: `cloudFloat ${20 + i * 5}s linear infinite`,
                            animationDelay: `${i * 3}s`,
                        }}
                    />
                ))}
            </div>

            {/* Floating Particles */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                }}
            >
                {[...Array(30)].map((_, i) => (
                    <div
                        key={i}
                        style={{
                            position: 'absolute',
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            width: `${2 + Math.random() * 4}px`,
                            height: `${2 + Math.random() * 4}px`,
                            borderRadius: '50%',
                            background: ['#FFCE45', '#7C4DFF', '#24C5A8', '#F093FB'][Math.floor(Math.random() * 4)],
                            opacity: 0.6,
                            animation: `floatUp ${5 + Math.random() * 10}s ease-in-out infinite`,
                            animationDelay: `${Math.random() * 5}s`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default WorldMap;
