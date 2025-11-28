import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Sparkles, ArrowRight } from 'lucide-react';
import Book3DScene from './components/Book3DScene';
import WorldMap from './components/WorldMap';
import './LandingPage.css';

gsap.registerPlugin(ScrollTrigger);

const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);
    const [progress, setProgress] = useState(0);

    // Total scroll distance multiplier (height of container)
    // 500vh means the user has to scroll 5 screen heights to see everything
    const TOTAL_SCROLL_HEIGHT = '800vh';

    useEffect(() => {
        const ctx = gsap.context(() => {
            ScrollTrigger.create({
                trigger: containerRef.current,
                start: 'top top',
                end: 'bottom bottom',
                scrub: 0.5, // Smooth scrubbing
                onUpdate: (self) => {
                    setProgress(self.progress);
                },
            });
        }, containerRef);

        return () => ctx.revert();
    }, []);

    // Derived animation states
    // 0.0 - 0.15: Book Opening
    // 0.15 - 0.25: Transition to Map (Zoom in / Fade)
    // 0.25 - 1.0: Map Exploration

    // Normalize book progress (0 to 1) during the first 15% of scroll
    const bookProgress = Math.min(progress / 0.15, 1);

    // Opacity of the book scene: Fade out as we zoom into map
    // Starts fading out at 15%, gone by 25%
    const bookOpacity = progress < 0.15 ? 1 : Math.max(0, 1 - (progress - 0.15) * 10);
    // const bookScale = 1 + progress * 2; // Slight zoom in while opening (Handled in 3D now)

    // Map opacity: Fades in as book fades out
    // Starts appearing at 15%, fully visible by 25%
    const mapOpacity = progress < 0.15 ? 0 : Math.min((progress - 0.15) * 10, 1);

    // Map exploration progress (0 to 1) mapped from 0.25 to 1.0 of total scroll
    const mapProgress = Math.max(0, (progress - 0.25) / 0.75);

    return (
        <div
            ref={containerRef}
            className="landing-container"
            style={{ height: TOTAL_SCROLL_HEIGHT }}
        >
            {/* Fixed Navigation */}
            <nav className="landing-nav">
                <div className="nav-logo">
                    <Sparkles className="nav-icon" />
                    <span>Talea</span>
                </div>
                <button className="nav-cta" onClick={() => navigate('/story')}>
                    Jetzt starten
                </button>
            </nav>

            {/* Sticky Viewport */}
            <div className="sticky-viewport">

                {/* Layer 1: World Map (Background) */}
                <div
                    className="layer-map"
                    style={{ opacity: mapOpacity, pointerEvents: mapOpacity > 0.5 ? 'auto' : 'none' }}
                >
                    <WorldMap progress={mapProgress} />
                </div>

                {/* Layer 2: Book Scene (Foreground) */}
                <div
                    className="layer-book"
                    style={{
                        opacity: bookOpacity,
                        // transform: `scale(${bookScale})`, // 3D scene handles scale
                        pointerEvents: bookOpacity > 0.5 ? 'auto' : 'none'
                    }}
                >
                    <div className="book-center-wrapper" style={{ width: '100%', height: '100%' }}>
                        <Book3DScene progress={bookProgress} />

                        <div className="scroll-hint" style={{ opacity: 1 - bookProgress }}>
                            <p>Scroll zum Öffnen</p>
                            <div className="scroll-mouse">
                                <div className="scroll-wheel" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Layer 3: Text Overlays (UI) */}
                {/* These appear at specific points during the map exploration */}
                <div className="layer-ui">
                    {/* Intro / Hero Text */}
                    <div
                        className="ui-section hero"
                        style={{
                            opacity: Math.max(0, 1 - bookProgress * 3),
                            transform: `translateY(-${bookProgress * 50}px)`
                        }}
                    >
                        <h1>Geschichten, die mitwachsen</h1>
                        <p>Talea verwandelt dein Kind in die Hauptfigur.</p>
                    </div>

                    {/* Feature 1: Story Forest */}
                    <FeatureOverlay
                        visible={mapProgress > 0.1 && mapProgress < 0.3}
                        title="Der Storywald"
                        description="Jede Nacht eine neue, persönliche Geschichte. KI schreibt Geschichten mit deinem Kind als Held*in."
                        alignment="left"
                    />

                    {/* Feature 2: Avatar Workshop */}
                    <FeatureOverlay
                        visible={mapProgress > 0.3 && mapProgress < 0.5}
                        title="Avatar Werkstatt"
                        description="Erstelle in Sekunden einen Avatar, der deinem Kind ähnlich sieht. Nutzbar in Geschichten und Dokus."
                        alignment="right"
                    />

                    {/* Feature 3: Knowledge Mountains */}
                    <FeatureOverlay
                        visible={mapProgress > 0.5 && mapProgress < 0.7}
                        title="Wissensberge"
                        description="Entdecke die Welt mit kindgerechten Dokus. Perfekt als Ergänzung zu Schule & Neugier-Fragen."
                        alignment="center"
                    />

                    {/* Feature 4: Memory Tree */}
                    <FeatureOverlay
                        visible={mapProgress > 0.7 && mapProgress < 0.9}
                        title="Erinnerungsbaum"
                        description="Avatare, die sich alles merken. Jede gelesene Geschichte wird als Erinnerung gespeichert."
                        alignment="left"
                    />

                    {/* CTA / Footer at the end */}
                    <div
                        className={`ui-section cta-final ${mapProgress > 0.9 ? 'visible' : ''}`}
                    >
                        <h2>Bereit für das Abenteuer?</h2>
                        <button className="big-cta" onClick={() => navigate('/story')}>
                            Kostenlos testen <ArrowRight />
                        </button>
                        <div className="footer-links-mini">
                            <span>Datenschutz</span> • <span>Impressum</span>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};

// Helper component for text overlays
const FeatureOverlay: React.FC<{
    visible: boolean;
    title: string;
    description: string;
    alignment: 'left' | 'right' | 'center';
}> = ({ visible, title, description, alignment }) => {
    return (
        <div
            className={`feature-overlay align-${alignment} ${visible ? 'visible' : ''}`}
        >
            <div className="feature-content">
                <h2>{title}</h2>
                <p>{description}</p>
            </div>
        </div>
    );
};

export default LandingPage;
