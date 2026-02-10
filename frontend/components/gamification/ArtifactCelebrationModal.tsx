import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Star, X, Gem, Scroll, Sword, Crown, Wand2 } from 'lucide-react';

// Types for the unlocked artifact from the pool system
export interface UnlockedArtifact {
  id: string;
  name: string;
  description: string;
  category: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  emoji?: string;
  visualKeywords?: string[];
  imageUrl?: string;
}

interface ArtifactCelebrationModalProps {
  artifact: UnlockedArtifact | null;
  isVisible: boolean;
  onClose: () => void;
  onViewTreasureRoom?: () => void;
}

const ArtifactCelebrationModal: React.FC<ArtifactCelebrationModalProps> = ({
  artifact,
  isVisible,
  onClose,
  onViewTreasureRoom,
}) => {
  if (!artifact) return null;

  // Get colors based on rarity
  const getRarityColors = () => {
    switch (artifact.rarity) {
      case 'legendary':
        return {
          gradient: 'from-amber-400 via-yellow-500 to-orange-500',
          glow: 'shadow-amber-500/50',
          badge: 'bg-gradient-to-r from-amber-500 to-yellow-600',
          badgeText: 'Legendär',
        };
      case 'rare':
        return {
          gradient: 'from-amber-400 via-amber-500 to-stone-500',
          glow: 'shadow-amber-500/50',
          badge: 'bg-gradient-to-r from-amber-500 to-stone-600',
          badgeText: 'Selten',
        };
      case 'uncommon':
        return {
          gradient: 'from-emerald-400 via-green-500 to-teal-500',
          glow: 'shadow-emerald-500/50',
          badge: 'bg-gradient-to-r from-emerald-500 to-teal-600',
          badgeText: 'Ungewöhnlich',
        };
      default:
        return {
          gradient: 'from-slate-400 via-gray-500 to-zinc-500',
          glow: 'shadow-slate-500/50',
          badge: 'bg-gradient-to-r from-slate-500 to-gray-600',
          badgeText: 'Gewöhnlich',
        };
    }
  };

  // Get icon based on category
  const getCategoryIcon = () => {
    switch (artifact.category?.toLowerCase()) {
      case 'weapon':
      case 'sword':
        return <Sword className="w-5 h-5" />;
      case 'magic':
      case 'wand':
        return <Wand2 className="w-5 h-5" />;
      case 'jewelry':
      case 'crown':
        return <Crown className="w-5 h-5" />;
      case 'book':
      case 'scroll':
        return <Scroll className="w-5 h-5" />;
      default:
        return <Gem className="w-5 h-5" />;
    }
  };

  const rarityConfig = getRarityColors();
  const starCount = artifact.rarity === 'legendary' ? 4 : artifact.rarity === 'rare' ? 3 : artifact.rarity === 'uncommon' ? 2 : 1;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={onClose}
        >
          {/* Background Particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(30)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute"
                initial={{
                  opacity: 0,
                  scale: 0,
                  x: '50vw',
                  y: '50vh'
                }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1.5, 0],
                  x: `${Math.random() * 100}vw`,
                  y: `${Math.random() * 100}vh`,
                }}
                transition={{
                  duration: 3,
                  delay: i * 0.08,
                  repeat: Infinity,
                  repeatDelay: 1.5
                }}
              >
                <Sparkles className={`w-6 h-6 ${
                  artifact.rarity === 'legendary' ? 'text-yellow-400' :
                  artifact.rarity === 'rare' ? 'text-amber-400' :
                  artifact.rarity === 'uncommon' ? 'text-emerald-400' : 'text-slate-400'
                }`} />
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ scale: 0.3, opacity: 0, y: 100, rotateX: 45 }}
            animate={{
              scale: 1,
              opacity: 1,
              y: 0,
              rotateX: 0,
              transition: {
                type: 'spring',
                damping: 20,
                stiffness: 200,
                delay: 0.2
              }
            }}
            exit={{ scale: 0.3, opacity: 0, y: -100 }}
            className="relative max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glow Effect */}
            <div className={`absolute inset-0 bg-gradient-to-br ${rarityConfig.gradient} blur-3xl opacity-40 scale-150`} />

            {/* Main Card */}
            <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl shadow-2xl overflow-hidden border border-white/10">
              {/* Animated Border */}
              <motion.div
                className={`absolute inset-0 bg-gradient-to-r ${rarityConfig.gradient} opacity-50`}
                style={{ padding: '2px' }}
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
              />

              <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 m-0.5 rounded-3xl">
                {/* Header */}
                <div className="relative p-6 text-center">
                  {/* Close button */}
                  <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  {/* Title with shimmer */}
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <motion.div
                        animate={{ rotate: [0, 360] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                      >
                        <Sparkles className="w-6 h-6 text-yellow-400" />
                      </motion.div>
                      <h2 className={`text-2xl font-bold bg-gradient-to-r ${rarityConfig.gradient} bg-clip-text text-transparent`}>
                        Schatz entdeckt!
                      </h2>
                      <motion.div
                        animate={{ rotate: [0, -360] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                      >
                        <Sparkles className="w-6 h-6 text-yellow-400" />
                      </motion.div>
                    </div>
                    <p className="text-white/60 text-sm">Du hast ein neues Artefakt freigeschaltet!</p>
                  </motion.div>
                </div>

                {/* Artifact Display */}
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.7, type: 'spring', damping: 15 }}
                  className="flex flex-col items-center pb-6"
                >
                  {/* Glowing Image Container */}
                  <div className="relative mb-6">
                    {/* Outer glow ring */}
                    <motion.div
                      className={`absolute inset-0 bg-gradient-to-br ${rarityConfig.gradient} rounded-2xl blur-xl`}
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.4, 0.7, 0.4]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity
                      }}
                      style={{ margin: '-15px' }}
                    />

                    {/* Image or Emoji Fallback */}
                    <div className={`relative w-40 h-40 bg-gradient-to-br from-white/10 to-white/5 rounded-2xl p-3 border border-white/20 ${rarityConfig.glow} shadow-lg`}>
                      {artifact.imageUrl ? (
                        <img
                          src={artifact.imageUrl}
                          alt={artifact.name}
                          className="w-full h-full object-contain rounded-xl"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl flex items-center justify-center">
                          <span className="text-6xl">{artifact.emoji || '🎁'}</span>
                        </div>
                      )}
                    </div>

                    {/* Floating stars based on rarity */}
                    {[...Array(starCount)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{
                          opacity: 1,
                          scale: 1,
                          y: [0, -8, 0],
                        }}
                        transition={{
                          delay: 1 + i * 0.15,
                          y: {
                            duration: 2,
                            repeat: Infinity,
                            delay: i * 0.2
                          }
                        }}
                        style={{
                          top: '-10px',
                          left: `${25 + i * (50 / starCount)}%`,
                          transform: 'translateX(-50%)'
                        }}
                      >
                        <Star className={`w-5 h-5 fill-current drop-shadow-lg ${
                          artifact.rarity === 'legendary' ? 'text-yellow-400' :
                          artifact.rarity === 'rare' ? 'text-amber-400' :
                          artifact.rarity === 'uncommon' ? 'text-emerald-400' : 'text-slate-400'
                        }`} />
                      </motion.div>
                    ))}
                  </div>

                  {/* Rarity Badge */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8 }}
                    className={`${rarityConfig.badge} px-4 py-1 rounded-full text-white text-sm font-semibold mb-3 flex items-center gap-2`}
                  >
                    {getCategoryIcon()}
                    <span>{rarityConfig.badgeText}</span>
                  </motion.div>

                  {/* Name */}
                  <motion.h3
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                    className="text-2xl font-bold text-white mb-2 px-6 text-center"
                  >
                    {artifact.name}
                  </motion.h3>

                  {/* Description */}
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.1 }}
                    className="text-gray-300 text-center px-8 max-w-sm leading-relaxed text-sm"
                  >
                    {artifact.description}
                  </motion.p>

                  {/* Category Badge */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.3 }}
                    className="mt-4 flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/10"
                  >
                    {getCategoryIcon()}
                    <span className="text-white/80 text-sm capitalize">{artifact.category}</span>
                  </motion.div>
                </motion.div>

                {/* Actions */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.5 }}
                  className="p-6 pt-0 flex gap-3"
                >
                  {onViewTreasureRoom && (
                    <button
                      onClick={onViewTreasureRoom}
                      className="flex-1 py-3 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/20"
                    >
                      Schatzkammer
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className={`${onViewTreasureRoom ? 'flex-1' : 'w-full'} py-3 bg-gradient-to-r ${rarityConfig.gradient} text-white font-bold rounded-xl hover:opacity-90 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg`}
                  >
                    Fantastisch! {artifact.emoji || '🎉'}
                  </button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ArtifactCelebrationModal;

