// Step 1: Avatar Selection
// User selects which avatars to include in the story

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Plus, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBackend } from '../../../hooks/useBackend';
import { useTranslation } from 'react-i18next';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } } as const;
const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, damping: 20 } } };

interface Avatar {
  id: string;
  name: string;
  imageUrl?: string;
  age: number;
  gender: string;
}

interface Props {
  state: {
    selectedAvatars: string[];
  };
  updateState: (updates: any) => void;
}

export default function Step1AvatarSelection({ state, updateState }: Props) {
  const backend = useBackend();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAvatars();
  }, []);

  const loadAvatars = async () => {
    try {
      console.log('[Step1] Loading avatars from backend...');
      const response = await backend.avatar.list();
      console.log('[Step1] Backend response:', response);

      const loadedAvatars = (response.avatars || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        imageUrl: a.imageUrl,
        age: a.age || 0,
        gender: a.gender || 'unknown'
      }));

      setAvatars(loadedAvatars);
      console.log('[Step1] Loaded avatars:', loadedAvatars.length);
    } catch (err) {
      console.error('[Step1] Error loading avatars:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAvatar = (avatarId: string) => {
    const newSelection = state.selectedAvatars.includes(avatarId)
      ? state.selectedAvatars.filter(id => id !== avatarId)
      : [...state.selectedAvatars, avatarId];

    updateState({ selectedAvatars: newSelection });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mb-4" />
        <p className="text-gray-600">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <motion.div className="space-y-6" variants={stagger} initial="hidden" animate="show">
      {/* Title & Description */}
      <motion.div className="text-center" variants={fadeUp}>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2" style={{ fontFamily: 'Fredoka, sans-serif' }}>
          🧸 {t('wizard.titles.avatars')}
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          {t('wizard.subtitles.avatars')}
        </p>
      </motion.div>

      {/* Avatar Grid */}
      {avatars.length === 0 ? (
        <motion.div className="text-center py-12 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-white/40" variants={fadeUp}>
          <User size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-300 mb-4">{t('homePage.emptyAvatarsTitle')}</p>
          <motion.button
            onClick={() => navigate('/avatar/create')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold shadow-lg"
          >
            <Plus size={20} />
            {t('avatar.create')}
          </motion.button>
        </motion.div>
      ) : (
        <motion.div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4" variants={fadeUp}>
          {avatars.map((avatar, i) => {
            const isSelected = state.selectedAvatars.includes(avatar.id);

            return (
              <motion.button
                key={avatar.id}
                onClick={() => toggleAvatar(avatar.id)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05, type: 'spring', damping: 20 }}
                whileHover={{ y: -4, boxShadow: '0 8px 25px rgba(169,137,242,0.2)' }}
                whileTap={{ scale: 0.97 }}
                className={`
                  relative p-4 rounded-2xl border-2 transition-colors
                  ${isSelected
                    ? 'border-purple-500 bg-purple-50/80 dark:bg-purple-900/30 ring-4 ring-purple-200/60'
                    : 'border-white/60 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl hover:border-purple-300'}
                `}
              >
                {/* Selection Badge */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                      className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg z-10"
                    >
                      ✓
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Avatar Image */}
                <div className="aspect-square rounded-lg bg-gradient-to-br from-purple-200 to-pink-200 mb-3 flex items-center justify-center overflow-hidden">
                  {avatar.imageUrl ? (
                    <img
                      src={avatar.imageUrl}
                      alt={avatar.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon size={40} className="text-purple-400" />
                  )}
                </div>

                {/* Avatar Info */}
                <div className="text-left">
                  <p className="font-semibold text-gray-800 dark:text-white truncate">{avatar.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{avatar.age} {t('wizard.summary.age')}, {avatar.gender === 'male' ? '👦' : avatar.gender === 'female' ? '👧' : '🧒'}</p>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      )}

      {/* Selection Summary */}
      <AnimatePresence>
        {state.selectedAvatars.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="bg-emerald-50/80 dark:bg-emerald-900/30 border-2 border-emerald-400 rounded-2xl p-4 backdrop-blur-sm"
          >
            <p className="font-semibold text-emerald-800 dark:text-emerald-300">
              ✓ {state.selectedAvatars.length} {t('wizard.summary.avatars')} {t('common.selected')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
