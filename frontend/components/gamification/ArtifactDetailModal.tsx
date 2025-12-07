import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Zap, Book, Shield, Users, Sparkles, ExternalLink } from 'lucide-react';
import { InventoryItem } from '../../types/avatar';
import { useNavigate } from 'react-router-dom';
import { useBackend } from '../../hooks/useBackend';
import { useTranslation } from 'react-i18next';

interface ArtifactDetailModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  showStoryLink?: boolean;
}

const ArtifactDetailModal: React.FC<ArtifactDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  showStoryLink = true
}) => {
  const navigate = useNavigate();
  const backend = useBackend();
  const { t } = useTranslation();
  const [storyTitle, setStoryTitle] = useState<string | null>(null);

  useEffect(() => {
    if (item?.sourceStoryId && showStoryLink) {
      // Fetch story title
      backend.story.get({ id: item.sourceStoryId })
        .then((story: any) => setStoryTitle(story.title))
        .catch(() => setStoryTitle(null));
    }
  }, [item?.sourceStoryId, showStoryLink]);

  const getIcon = () => {
    if (!item) return <Shield className="w-8 h-8 text-purple-500" />;
    switch (item.type) {
      case 'WEAPON': return <Zap className="w-8 h-8 text-yellow-500" />;
      case 'KNOWLEDGE': return <Book className="w-8 h-8 text-blue-500" />;
      case 'COMPANION': return <Users className="w-8 h-8 text-green-500" />;
      default: return <Shield className="w-8 h-8 text-purple-500" />;
    }
  };

  const getTypeLabel = () => {
    if (!item) return '';
    switch (item.type) {
      case 'WEAPON': return t('artifact.type.weapon', 'Magische Waffe');
      case 'KNOWLEDGE': return t('artifact.type.knowledge', 'Wissen');
      case 'COMPANION': return t('artifact.type.companion', 'Begleiter');
      default: return t('artifact.type.tool', 'Werkzeug');
    }
  };

  const getRarityGradient = () => {
    if (!item) return 'from-gray-400 to-gray-600';
    if (item.level >= 3) return 'from-yellow-400 via-amber-500 to-orange-500';
    if (item.level === 2) return 'from-blue-400 via-indigo-500 to-purple-500';
    return 'from-purple-400 via-pink-500 to-rose-500';
  };

  const handleGoToStory = () => {
    if (item?.sourceStoryId) {
      onClose();
      navigate(`/story-reader/${item.sourceStoryId}`);
    }
  };

  if (!item) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gradient Header */}
            <div className={`bg-gradient-to-br ${getRarityGradient()} p-6 pb-20 relative overflow-hidden`}>
              {/* Sparkle Effects */}
              <div className="absolute inset-0 overflow-hidden">
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                      opacity: [0, 1, 0],
                      scale: [0, 1, 0],
                      x: Math.random() * 100 - 50,
                      y: Math.random() * 100 - 50,
                    }}
                    transition={{
                      duration: 2,
                      delay: i * 0.3,
                      repeat: Infinity,
                    }}
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                    }}
                  >
                    <Sparkles className="w-4 h-4 text-white/60" />
                  </motion.div>
                ))}
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>

              {/* Type Badge */}
              <div className="flex items-center gap-2 text-white/90 text-sm font-medium">
                {getIcon()}
                <span>{getTypeLabel()}</span>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-white mt-3">{item.name}</h2>

              {/* Level Stars */}
              <div className="flex gap-1 mt-2">
                {[...Array(Math.max(item.level, 1))].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-300 fill-current" />
                ))}
              </div>
            </div>

            {/* Artifact Image - Overlapping */}
            <div className="relative -mt-16 px-6">
              <div className="bg-white rounded-2xl shadow-xl p-3 mx-auto w-48 h-48">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-contain rounded-xl"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center">
                    <span className="text-6xl">🎁</span>
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 pt-4 space-y-4">
              {/* Description */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {t('artifact.description', 'Beschreibung')}
                </h3>
                <p className="text-gray-700 leading-relaxed">{item.description}</p>
              </div>

              {/* Story Effect */}
              {item.storyEffect && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                  <h3 className="text-sm font-semibold text-purple-700 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    {t('artifact.storyEffect', 'Magische Wirkung')}
                  </h3>
                  <p className="text-purple-600 text-sm">{item.storyEffect}</p>
                </div>
              )}

              {/* Source Story */}
              {showStoryLink && item.sourceStoryId && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-500 mb-2">
                    {t('artifact.origin', 'Gefunden in')}
                  </h3>
                  <button
                    onClick={handleGoToStory}
                    className="flex items-center gap-2 text-purple-600 hover:text-purple-800 font-medium transition-colors group"
                  >
                    <Book className="w-4 h-4" />
                    <span className="group-hover:underline">
                      {storyTitle || t('artifact.loadingStory', 'Geschichte wird geladen...')}
                    </span>
                    <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(item.acquiredAt).toLocaleDateString('de-DE', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* Close Button */}
            <div className="p-6 pt-0">
              <button
                onClick={onClose}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg"
              >
                {t('common.close', 'Schließen')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ArtifactDetailModal;
