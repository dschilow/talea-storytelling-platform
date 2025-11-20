import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence, useSpring } from 'framer-motion';
import { ArrowLeft, BookOpen, ChevronDown, Sparkles } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';

import { useBackend } from '../../hooks/useBackend';
import { CinematicText } from '../../components/ui/cinematic-text';
import { Typewriter } from '../../components/ui/typewriter-text';
import type { Story, Chapter } from '../../types/story';
import { cn } from '../../lib/utils';

const CinematicStoryViewer: React.FC = () => {
    const { storyId } = useParams<{ storyId: string }>();
    const navigate = useNavigate();
    const backend = useBackend();
    const { getToken } = useAuth();
    const containerRef = useRef<HTMLDivElement>(null);

    const [story, setStory] = useState<Story | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [started, setStarted] = useState(false);
    const [storyCompleted, setStoryCompleted] = useState(false);

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
        if (storyId) {
            loadStory();
        }
    }, [storyId]);

    const loadStory = async () => {
        if (!storyId) return;
        try {
            setLoading(true);
            setError(null);
            const storyData = await backend.story.get({ id: storyId });
            setStory(storyData as unknown as Story);
        } catch (err) {
            console.error('Error loading story:', err);
            setError('Geschichte konnte nicht geladen werden.');
        } finally {
            setLoading(false);
        }
    };

    const handleStart = () => {
        setStarted(true);
        // Smooth scroll to first chapter after a small delay
        setTimeout(() => {
            const firstChapter = document.getElementById('chapter-0');
            firstChapter?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleStoryCompletion = async () => {
        if (!story || !storyId || storyCompleted) return;

        try {
            setStoryCompleted(true);
            const token = await getToken();
            const { getBackendUrl } = await import('../../config');
            const target = getBackendUrl();

            const response = await fetch(`${target}/story/mark-read`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    storyId: storyId,
                    storyTitle: story.title,
                    genre: story.config.genre,
                })
            });

            if (response.ok) {
                const result = await response.json();
                import('../../utils/toastUtils').then(({ showSuccessToast }) => {
                    showSuccessToast(`🎉 Geschichte abgeschlossen!`);
                });
            }
        } catch (error) {
            console.error('Error completing story:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-black text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-t-4 border-purple-500 border-solid rounded-full animate-spin" />
                    <p className="text-xl font-serif tracking-widest animate-pulse">LADEN...</p>
                </div>
            </div>
        );
    }

    if (!story) return null;

    return (
        <div className="fixed inset-0 bg-black text-white overflow-hidden font-sans">
            {/* Progress Bar */}
            {started && (
                <motion.div
                    className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 z-50 origin-left"
                    style={{ scaleX }}
                />
            )}

            {/* Navigation Controls */}
            <div className="fixed top-6 left-6 z-50 flex gap-4">
                <button
                    onClick={() => navigate('/stories')}
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
                    {/* Background Image with Parallax-like effect (fixed) */}
                    <div className="absolute inset-0 z-0">
                        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-black z-10" />
                        <motion.img
                            initial={{ scale: 1.1 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 10, ease: "easeOut" }}
                            src={story.coverImageUrl || '/placeholder-story.jpg'}
                            alt="Cover"
                            className="w-full h-full object-cover"
                        />
                    </div>

                    {/* Content */}
                    <div className="relative z-20 text-center px-4 max-w-5xl mx-auto">
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 1, delay: 0.5 }}
                        >
                            <span className="inline-block py-1 px-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-sm font-medium tracking-widest mb-6 uppercase">
                                {story.config.genre}
                            </span>
                            <h1 className="text-5xl md:text-7xl lg:text-9xl font-serif font-bold mb-8 tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 drop-shadow-2xl">
                                {story.title}
                            </h1>
                            <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto leading-relaxed mb-12 font-light">
                                {story.summary}
                            </p>

                            <motion.button
                                onClick={handleStart}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="group relative px-8 py-4 bg-white text-black rounded-full font-bold text-lg tracking-wide overflow-hidden"
                            >
                                <span className="relative z-10 flex items-center gap-2">
                                    GESCHICHTE STARTEN <ChevronDown className="w-5 h-5 animate-bounce" />
                                </span>
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            </motion.button>
                        </motion.div>
                    </div>
                </section>

                {/* CHAPTERS */}
                {story.chapters?.map((chapter, index) => (
                    <ChapterSection
                        key={chapter.id || index}
                        chapter={chapter}
                        index={index}
                        total={story.chapters?.length || 0}
                        onComplete={index === (story.chapters?.length || 0) - 1 ? handleStoryCompletion : undefined}
                        isCompleted={storyCompleted}
                    />
                ))}

                {/* Footer / End Screen */}
                <section className="h-[50vh] snap-start flex items-center justify-center bg-black relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black" />
                    <div className="text-center z-10">
                        <h2 className="text-4xl font-serif text-white mb-4">Ende</h2>
                        <button
                            onClick={() => navigate('/stories')}
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

const ChapterSection: React.FC<{
    chapter: Chapter;
    index: number;
    total: number;
    onComplete?: () => void;
    isCompleted?: boolean;
}> = ({ chapter, index, total, onComplete, isCompleted }) => {
    const [headerInView, setHeaderInView] = useState(false);

    return (
        <div id={`chapter-${index}`} className="min-h-screen w-full relative bg-black snap-start flex flex-col">
            {/* Chapter Header / Title Card */}
            <div className="relative h-[60vh] w-full overflow-hidden shrink-0">
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40 z-10" />
                <motion.img
                    initial={{ scale: 1.2 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: false, amount: 0.3 }}
                    transition={{ duration: 1.5 }}
                    src={chapter.imageUrl || `https://picsum.photos/seed/${index}/1920/1080`}
                    alt={chapter.title}
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
                        <span className="text-purple-400 font-bold tracking-widest uppercase text-sm mb-2 block h-6">
                            {headerInView && (
                                <Typewriter
                                    text={`Kapitel ${index + 1} von ${total}`}
                                    speed={50}
                                    cursor=""
                                />
                            )}
                        </span>
                        <h2 className="text-4xl md:text-6xl font-serif font-bold text-white mb-4 leading-tight min-h-[1.2em]">
                            {headerInView && (
                                <Typewriter
                                    text={chapter.title}
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

            {/* Chapter Content */}
            <div className="flex-1 bg-black px-6 py-12 md:px-20 md:py-16 pb-64">
                <div className="max-w-3xl mx-auto">
                    <CinematicText text={chapter.content} />

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
                                    "GESCHICHTE ABSCHLIESSEN"
                                )}
                            </motion.button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CinematicStoryViewer;
