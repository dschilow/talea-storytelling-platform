import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, useScroll, useSpring } from 'framer-motion';
import { ArrowLeft, ChevronDown, Sparkles, Brain, Lightbulb } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';

import { useBackend } from '../../hooks/useBackend';
import { CinematicText } from '../../components/ui/cinematic-text';
import { Typewriter } from '../../components/ui/typewriter-text';
import type { Doku, DokuSection } from '../../types/doku';
import { cn } from '../../lib/utils';
import { QuizComponent } from '../../components/reader/QuizComponent';
import { FactsComponent } from '../../components/reader/FactsComponent';
import { ActivityComponent } from '../../components/reader/ActivityComponent';

const CinematicDokuViewer: React.FC = () => {
    const { dokuId } = useParams<{ dokuId: string }>();
    const navigate = useNavigate();
    const backend = useBackend();
    const { getToken } = useAuth();
    const containerRef = useRef<HTMLDivElement>(null);

    const [doku, setDoku] = useState<Doku | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [started, setStarted] = useState(false);
    const [dokuCompleted, setDokuCompleted] = useState(false);

    // Scroll Progress for the whole container
    const { scrollYProgress } = useScroll({
        container: containerRef,
    });

    const scaleX = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001
    });

    useEffect(() => {
        if (dokuId) {
            loadDoku();
        }
    }, [dokuId]);

    const loadDoku = async () => {
        if (!dokuId) return;
        try {
            setLoading(true);
            setError(null);
            const dokuData = await backend.doku.getDoku({ id: dokuId });
            setDoku(dokuData as unknown as Doku);
        } catch (err) {
            console.error('Error loading doku:', err);
            setError('Doku konnte nicht geladen werden.');
        } finally {
            setLoading(false);
        }
    };

    const handleStart = () => {
        setStarted(true);
        setTimeout(() => {
            const firstSection = document.getElementById('section-0');
            firstSection?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleDokuCompletion = async () => {
        if (!doku || !dokuId || dokuCompleted) return;

        try {
            setDokuCompleted(true);
            const token = await getToken();
            const { getBackendUrl } = await import('../../config');
            const target = getBackendUrl();

            const response = await fetch(`${target}/doku/mark-read`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    dokuId: dokuId,
                    dokuTitle: doku.title,
                    topic: doku.topic,
                })
            });

            if (response.ok) {
                const result = await response.json();
                import('../../utils/toastUtils').then(({ showSuccessToast }) => {
                    showSuccessToast(`🎉 Doku abgeschlossen! Wissen erweitert.`);
                });
            }
        } catch (error) {
            console.error('Error completing doku:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-black text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-t-4 border-teal-500 border-solid rounded-full animate-spin" />
                    <p className="text-xl font-serif tracking-widest animate-pulse">LADEN...</p>
                </div>
            </div>
        );
    }

    if (!doku) return null;

    return (
        <div className="fixed inset-0 bg-black text-white overflow-hidden font-sans">
            {/* Progress Bar */}
            {started && (
                <motion.div
                    className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 z-50 origin-left"
                    style={{ scaleX }}
                />
            )}

            {/* Navigation Controls */}
            <div className="fixed top-6 left-6 z-50 flex gap-4">
                <button
                    onClick={() => navigate('/doku')}
                    className="p-3 bg-black/40 backdrop-blur-md rounded-full hover:bg-white/10 transition-all border border-white/10 group"
                >
                    <ArrowLeft className="w-6 h-6 text-white group-hover:-translate-x-1 transition-transform" />
                </button>
            </div>

            {/* Main Scroll Container */}
            <div
                ref={containerRef}
                className="h-full overflow-y-auto scroll-smooth snap-y snap-mandatory"
            >
                {/* INTRO SECTION */}
                <section className="h-screen w-full relative flex items-center justify-center snap-start overflow-hidden">
                    <div className="absolute inset-0 z-0">
                        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-black z-10" />
                        <motion.img
                            initial={{ scale: 1.1 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 10, ease: "easeOut" }}
                            src={doku.coverImageUrl || '/placeholder-doku.jpg'}
                            alt="Cover"
                            className="w-full h-full object-cover"
                        />
                    </div>

                    <div className="relative z-20 text-center px-4 max-w-5xl mx-auto">
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 1, delay: 0.5 }}
                        >
                            <span className="inline-block py-1 px-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-sm font-medium tracking-widest mb-6 uppercase">
                                {doku.topic}
                            </span>
                            <h1 className="text-5xl md:text-7xl lg:text-9xl font-serif font-bold mb-8 tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 drop-shadow-2xl">
                                {doku.title}
                            </h1>
                            <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto leading-relaxed mb-12 font-light">
                                {doku.summary}
                            </p>

                            <motion.button
                                onClick={handleStart}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="group relative px-8 py-4 bg-white text-black rounded-full font-bold text-lg tracking-wide overflow-hidden"
                            >
                                <span className="relative z-10 flex items-center gap-2">
                                    WISSEN STARTEN <ChevronDown className="w-5 h-5 animate-bounce" />
                                </span>
                                <div className="absolute inset-0 bg-gradient-to-r from-teal-400 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            </motion.button>
                        </motion.div>
                    </div>
                </section>

                {/* SECTIONS */}
                {doku.content?.sections?.map((section, index) => (
                    <SectionView
                        key={index}
                        section={section}
                        index={index}
                        total={doku.content?.sections?.length || 0}
                        dokuTitle={doku.title}
                        dokuId={dokuId || ''}
                        onComplete={index === (doku.content?.sections?.length || 0) - 1 ? handleDokuCompletion : undefined}
                        isCompleted={dokuCompleted}
                    />
                ))}

                {/* Footer */}
                <section className="h-[50vh] snap-start flex items-center justify-center bg-black relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-teal-900/20 via-black to-black" />
                    <div className="text-center z-10">
                        <h2 className="text-4xl font-serif text-white mb-4">Ende der Doku</h2>
                        <button
                            onClick={() => navigate('/doku')}
                            className="text-gray-400 hover:text-white transition-colors underline underline-offset-4"
                        >
                            Zurück zur Übersicht
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
};

const SectionView: React.FC<{
    section: DokuSection;
    index: number;
    total: number;
    dokuTitle: string;
    dokuId: string;
    onComplete?: () => void;
    isCompleted?: boolean;
}> = ({ section, index, total, dokuTitle, dokuId, onComplete, isCompleted }) => {
    const [headerInView, setHeaderInView] = useState(false);

    return (
        <div id={`section-${index}`} className="min-h-screen w-full relative bg-black snap-start flex flex-col">
            {/* Section Header */}
            <div className="relative h-[60vh] w-full overflow-hidden shrink-0">
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40 z-10" />
                <motion.img
                    initial={{ scale: 1.2 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: false, amount: 0.3 }}
                    transition={{ duration: 1.5 }}
                    // Use section image idea to generate a placeholder or use a generic one if no image available
                    src={`https://picsum.photos/seed/doku-${index}/1920/1080`}
                    alt={section.title}
                    className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 p-4 pb-2 md:px-16 md:pb-4 z-20">
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        onViewportEnter={() => setHeaderInView(true)}
                    >
                        <span className="text-teal-400 font-bold tracking-widest uppercase text-sm mb-2 block h-6">
                            {headerInView && (
                                <Typewriter
                                    text={`Abschnitt ${index + 1} von ${total}`}
                                    speed={50}
                                    cursor=""
                                />
                            )}
                        </span>
                        <h2 className="text-4xl md:text-6xl font-serif font-bold text-white mb-4 leading-tight min-h-[1.2em]">
                            {headerInView && (
                                <Typewriter
                                    text={section.title}
                                    speed={70}
                                    delay={1000}
                                    cursor="|"
                                    className="font-['Merriweather']"
                                />
                            )}
                        </h2>
                    </motion.div>
                </div>
            </div>

            {/* Section Content */}
            <div className="flex-1 bg-black px-6 py-12 md:px-20 md:py-16 pb-64">
                <div className="max-w-3xl mx-auto space-y-16">
                    <CinematicText text={section.content} />

                    {/* Key Facts */}
                    {section.keyFacts && section.keyFacts.length > 0 && (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-8 backdrop-blur-sm">
                            <div className="flex items-center gap-3 mb-6 text-teal-400">
                                <Lightbulb className="w-6 h-6" />
                                <h3 className="text-xl font-bold uppercase tracking-wider">Wichtige Fakten</h3>
                            </div>
                            <ul className="space-y-4">
                                {section.keyFacts.map((fact, i) => (
                                    <li key={i} className="flex gap-4 text-gray-300 text-lg leading-relaxed">
                                        <span className="text-teal-500 font-bold">•</span>
                                        {fact}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Interactive Elements */}
                    {section.interactive?.quiz?.enabled && (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-8 backdrop-blur-sm">
                            <div className="flex items-center gap-3 mb-6 text-purple-400">
                                <Brain className="w-6 h-6" />
                                <h3 className="text-xl font-bold uppercase tracking-wider">Quiz Zeit</h3>
                            </div>
                            <QuizComponent
                                section={section}
                                dokuTitle={dokuTitle}
                                dokuId={dokuId}
                                onPersonalityChange={(changes) => {
                                    import('../../utils/toastUtils').then(({ showPersonalityUpdateToast }) => {
                                        showPersonalityUpdateToast(changes);
                                    });
                                }}
                            />
                        </div>
                    )}

                    {onComplete && (
                        <div className="mt-32 flex justify-center">
                            <motion.button
                                initial={{ opacity: 0, scale: 0.9 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                onClick={onComplete}
                                disabled={isCompleted}
                                className={cn(
                                    "px-16 py-8 rounded-none text-2xl font-black uppercase tracking-widest transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] border-2 border-white",
                                    isCompleted
                                        ? "bg-green-600 border-green-600 text-white cursor-default"
                                        : "bg-transparent text-white hover:bg-white hover:text-black hover:scale-105"
                                )}
                            >
                                {isCompleted ? (
                                    <>
                                        <Sparkles className="w-6 h-6 mr-2" /> ABGESCHLOSSEN
                                    </>
                                ) : (
                                    "DOKU ABSCHLIESSEN"
                                )}
                            </motion.button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CinematicDokuViewer;
