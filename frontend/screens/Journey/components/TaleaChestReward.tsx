import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Artifact {
    id: string;
    name: string;
    icon: string;
    rarity: 'common' | 'rare' | 'epic';
}

interface Props {
    artifactId: string;
    rarity: 'common' | 'rare' | 'epic';
    onClose: () => void;
    isDark: boolean;
}

const RARITY_COLORS = {
    common: '#94a3b8',
    rare: '#3b82f6',
    epic: '#a855f7',
};

const TaleaChestReward: React.FC<Props> = ({ artifactId, rarity, onClose, isDark }) => {
    const [stage, setStage] = useState<'closed' | 'open'>('closed');

    // Real artifact data lookup (stubbed for now, should come from a central registry)
    const artifactName = artifactId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const color = RARITY_COLORS[rarity];

    useEffect(() => {
        // Auto-open after a short delay
        const t = setTimeout(() => {
            setStage('open');
            void confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: [color, '#f5a623', '#ffffff']
            });
        }, 1800);
        return () => clearTimeout(t);
    }, [color]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md">
            <motion.div
                className="fixed inset-0 bg-black/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            />

            <div className="relative flex flex-col items-center">
                <AnimatePresence mode="wait">
                    {stage === 'closed' ? (
                        <motion.div
                            key="chest-closed"
                            className="relative cursor-pointer"
                            initial={{ scale: 0, rotate: -20 }}
                            animate={{
                                scale: 1,
                                rotate: [0, -5, 5, -5, 5, 0],
                                transition: {
                                    scale: { type: 'spring', stiffness: 260, damping: 20 },
                                    rotate: { delay: 0.6, duration: 0.5, repeat: 2 }
                                }
                            }}
                            exit={{ scale: 1.2, opacity: 0, transition: { duration: 0.2 } }}
                            onClick={() => setStage('open')}
                        >
                            <div className="text-[120px] drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]">🎁</div>
                            <motion.div
                                className="absolute inset-x-0 -bottom-4 flex justify-center"
                                animate={{ opacity: [0.4, 1, 0.4] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                            >
                                <div className="rounded-full bg-white/20 px-4 py-1 text-xs font-bold text-white backdrop-blur-sm">
                                    Wird geöffnet...
                                </div>
                            </motion.div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="chest-open"
                            className="flex flex-col items-center"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        >
                            <div className="relative mb-6">
                                <motion.div
                                    className="absolute inset-0 rounded-full"
                                    style={{ background: color, filter: 'blur(60px)', opacity: 0.3 }}
                                    animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0.4, 0.2] }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                />
                                <div className="relative text-[100px] drop-shadow-2xl">
                                    {rarity === 'epic' ? '💎' : rarity === 'rare' ? '⚔️' : '📜'}
                                </div>
                                <motion.div
                                    className="absolute -right-4 -top-4 text-4xl"
                                    animate={{ scale: [1, 1.3, 1], rotate: [0, 20, -20, 0] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                >
                                    ✨
                                </motion.div>
                            </div>

                            <div className="text-center">
                                <motion.p
                                    className="text-[10px] font-black uppercase tracking-[0.2em]"
                                    style={{ color }}
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    {rarity} Artefakt gefunden!
                                </motion.p>
                                <motion.h2
                                    className="mt-1 text-3xl font-black text-white drop-shadow-sm"
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    {artifactName}
                                </motion.h2>
                                <motion.p
                                    className="mt-3 max-w-xs text-sm text-white/70"
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                >
                                    Dein Avatar hat ein neues Item für seine Schatzkammer erhalten.
                                </motion.p>
                            </div>

                            <motion.button
                                type="button"
                                onClick={onClose}
                                className="mt-8 flex items-center gap-2 rounded-2xl bg-white px-8 py-3.5 text-sm font-bold text-black shadow-xl"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.6 }}
                            >
                                Super!
                            </motion.button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default TaleaChestReward;
