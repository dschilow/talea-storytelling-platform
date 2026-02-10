import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Star, X } from 'lucide-react';
import { InventoryItem } from '../../types/avatar';

interface ArtifactRewardToastProps {
  item: InventoryItem | null;
  isVisible: boolean;
  onClose: () => void;
  onViewDetails?: () => void;
  isUpgrade?: boolean;
}

const ArtifactRewardToast: React.FC<ArtifactRewardToastProps> = ({
  item,
  isVisible,
  onClose,
  onViewDetails,
  isUpgrade = false
}) => {
  if (!item) return null;

  const getRarityColor = () => {
    if (item.level >= 3) return 'from-yellow-400 via-amber-500 to-orange-500';
    if (item.level === 2) return 'from-stone-400 via-stone-500 to-amber-500';
    return 'from-amber-400 via-orange-500 to-rose-500';
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onClick={onClose}
        >
          {/* Background Particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
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
                  delay: i * 0.1,
                  repeat: Infinity,
                  repeatDelay: 2
                }}
              >
                <Sparkles className="w-6 h-6 text-yellow-400" />
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
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glow Effect */}
            <div className={`absolute inset-0 bg-gradient-to-br ${getRarityColor()} blur-3xl opacity-50 scale-150`} />
            
            {/* Main Card */}
            <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl shadow-2xl overflow-hidden border border-white/20">
              {/* Header */}
              <div className="relative p-6 text-center">
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
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
                    <Sparkles className="w-6 h-6 text-yellow-400" />
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200 bg-clip-text text-transparent">
                      {isUpgrade ? `Artefakt verstärkt! (Stufe ${item.level})` : 'Neues Artefakt erhalten!'}
                    </h2>
                    <Sparkles className="w-6 h-6 text-yellow-400" />
                  </div>
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
                    className={`absolute inset-0 bg-gradient-to-br ${getRarityColor()} rounded-full blur-xl`}
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0.8, 0.5]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity
                    }}
                    style={{ margin: '-20px' }}
                  />
                  
                  {/* Image */}
                  <div className="relative w-48 h-48 bg-gradient-to-br from-white/10 to-white/5 rounded-2xl p-3 border border-white/20">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-contain rounded-xl"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-amber-500/30 to-orange-500/30 rounded-xl flex items-center justify-center">
                        <span className="text-7xl">🎁</span>
                      </div>
                    )}
                  </div>

                  {/* Floating stars */}
                  {[...Array(item.level)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute"
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ 
                        opacity: 1, 
                        scale: 1,
                        y: [0, -10, 0],
                      }}
                      transition={{
                        delay: 1 + i * 0.2,
                        y: {
                          duration: 2,
                          repeat: Infinity,
                          delay: i * 0.3
                        }
                      }}
                      style={{
                        top: '10px',
                        left: `${30 + i * 40}%`,
                        transform: 'translateX(-50%)'
                      }}
                    >
                      <Star className="w-6 h-6 text-yellow-400 fill-current drop-shadow-lg" />
                    </motion.div>
                  ))}
                </div>

                {/* Name */}
                <motion.h3
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                  className="text-2xl font-bold text-white mb-2 px-6 text-center"
                >
                  {item.name}
                </motion.h3>

                {/* Description */}
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1 }}
                  className="text-gray-300 text-center px-8 max-w-sm leading-relaxed"
                >
                  {item.description}
                </motion.p>

                {/* Story Effect Badge */}
                {item.storyEffect && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.3 }}
                    className="mt-4 mx-6 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-xl p-3 border border-amber-400/30"
                  >
                    <p className="text-sm text-amber-200 text-center">
                      <span className="font-semibold">✨ Magische Wirkung: </span>
                      {item.storyEffect}
                    </p>
                  </motion.div>
                )}
              </motion.div>

              {/* Actions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5 }}
                className="p-6 pt-0 flex gap-3"
              >
                {onViewDetails && (
                  <button
                    onClick={onViewDetails}
                    className="flex-1 py-3 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/20"
                  >
                    Details ansehen
                  </button>
                )}
                <button
                  onClick={onClose}
                  className={`${onViewDetails ? 'flex-1' : 'w-full'} py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg`}
                >
                  Fantastisch! 🎉
                </button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ArtifactRewardToast;

