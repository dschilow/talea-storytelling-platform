import React, { useEffect, useState } from 'react';
import { X, Sparkles, ArrowUp, Star, Shield, Zap } from 'lucide-react';
import { InventoryItem, Skill } from '../../types/avatar';
import Button from '../common/Button';
import Card from '../common/Card';
import FadeInView from '../animated/FadeInView';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

interface LevelUpModalProps {
    isOpen: boolean;
    onClose: () => void;
    item?: InventoryItem;
    skill?: Skill;
    type: 'new_item' | 'item_upgrade' | 'new_skill' | 'skill_upgrade';
}

const LevelUpModal: React.FC<LevelUpModalProps> = ({ isOpen, onClose, item, skill, type }) => {
    const [showContent, setShowContent] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShowContent(true);
            // Trigger confetti
            const duration = 3000;
            const end = Date.now() + duration;

            const frame = () => {
                confetti({
                    particleCount: 2,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: ['#A855F7', '#EC4899', '#FCD34D']
                });
                confetti({
                    particleCount: 2,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: ['#A855F7', '#EC4899', '#FCD34D']
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            };
            frame();
        } else {
            setShowContent(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const getTitle = () => {
        switch (type) {
            case 'new_item': return 'Neuer Gegenstand!';
            case 'item_upgrade': return 'Gegenstand verbessert!';
            case 'new_skill': return 'Neue Fähigkeit!';
            case 'skill_upgrade': return 'Fähigkeit verbessert!';
            default: return 'Belohnung!';
        }
    };

    const getIcon = () => {
        if (item) return <Shield className="w-16 h-16 text-purple-500" />;
        if (skill) return <Zap className="w-16 h-16 text-yellow-500" />;
        return <Star className="w-16 h-16 text-purple-500" />;
    };

    const getName = () => item?.name || skill?.name || 'Unbekannt';
    const getDescription = () => item?.description || skill?.description || '';
    const getLevel = () => item?.level || skill?.level || 1;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="w-full max-w-md"
                    >
                        <Card variant="glass" className="relative overflow-hidden border-2 border-purple-400/50 shadow-2xl">
                            {/* Background Glow Effects */}
                            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                                <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
                                <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                            </div>

                            <div className="relative z-10 p-8 text-center">
                                <button
                                    onClick={onClose}
                                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>

                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.2, type: "spring" }}
                                    className="mx-auto mb-6 w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-purple-100"
                                >
                                    {getIcon()}
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600 mb-2">
                                        {getTitle()}
                                    </h2>

                                    <div className="flex items-center justify-center gap-2 mb-4">
                                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-bold flex items-center">
                                            <ArrowUp className="w-3 h-3 mr-1" />
                                            Level {getLevel()}
                                        </span>
                                        {type.includes('upgrade') && (
                                            <span className="text-gray-400 text-sm line-through">Level {getLevel() - 1}</span>
                                        )}
                                    </div>

                                    <h3 className="text-xl font-bold text-gray-800 mb-2">{getName()}</h3>
                                    <p className="text-gray-600 mb-8 leading-relaxed">
                                        {getDescription()}
                                    </p>

                                    <Button
                                        title="Großartig!"
                                        onPress={onClose}
                                        className="w-full py-4 text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300"
                                    />
                                </motion.div>
                            </div>
                        </Card>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default LevelUpModal;
