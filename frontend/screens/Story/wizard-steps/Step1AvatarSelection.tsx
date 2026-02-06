// Step 1: Avatar Selection — Dark magical theme with glowing cards

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Plus, Image as ImageIcon, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBackend } from '../../../hooks/useBackend';
import { useTranslation } from 'react-i18next';

interface Avatar { id: string; name: string; imageUrl?: string; age: number; gender: string; }
interface Props { state: { selectedAvatars: string[] }; updateState: (updates: any) => void; }

export default function Step1AvatarSelection({ state, updateState }: Props) {
  const backend = useBackend();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAvatars(); }, []);

  const loadAvatars = async () => {
    try {
      const response = await backend.avatar.list();
      setAvatars((response.avatars || []).map((a: any) => ({
        id: a.id, name: a.name, imageUrl: a.imageUrl, age: a.age || 0, gender: a.gender || 'unknown',
      })));
    } catch (err) { console.error('[Step1] Error:', err); }
    finally { setLoading(false); }
  };

  const toggleAvatar = (id: string) => {
    const sel = state.selectedAvatars.includes(id)
      ? state.selectedAvatars.filter(x => x !== id)
      : [...state.selectedAvatars, id];
    updateState({ selectedAvatars: sel });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-3 border-[#A989F2] border-t-transparent rounded-full mb-4"
        />
        <p className="text-white/50">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h2 className="text-2xl font-extrabold text-white mb-2" style={{ fontFamily: '"Fredoka", sans-serif' }}>
          🧸 {t('wizard.titles.avatars')}
        </h2>
        <p className="text-white/50 text-sm">{t('wizard.subtitles.avatars')}</p>
      </motion.div>

      {/* Avatar Grid */}
      {avatars.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl"
        >
          <User size={48} className="mx-auto text-white/20 mb-4" />
          <p className="text-white/40 mb-6">{t('homePage.emptyAvatarsTitle')}</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/avatar/create')}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl text-white font-bold shadow-xl"
            style={{ background: 'linear-gradient(135deg, #A989F2, #FF6B9D)', boxShadow: '0 8px 30px rgba(169,137,242,0.4)' }}
          >
            <Plus size={20} />
            {t('avatar.create')}
          </motion.button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {avatars.map((avatar, i) => {
            const isSelected = state.selectedAvatars.includes(avatar.id);
            return (
              <motion.button
                key={avatar.id}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06, type: 'spring' as const, damping: 20 }}
                whileHover={{ y: -6, scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => toggleAvatar(avatar.id)}
                className="relative group"
              >
                {/* Glow effect behind selected card */}
                {isSelected && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute -inset-1 rounded-3xl z-0"
                    style={{
                      background: 'linear-gradient(135deg, #A989F2, #FF6B9D)',
                      filter: 'blur(12px)',
                      opacity: 0.5,
                    }}
                  />
                )}

                {/* Card */}
                <div className={`relative z-10 rounded-2xl p-3 transition-all duration-300 ${
                  isSelected
                    ? 'bg-gradient-to-br from-[#A989F2]/20 to-[#FF6B9D]/20 border-2 border-[#A989F2]/60 shadow-xl shadow-[#A989F2]/20'
                    : 'bg-white/[0.06] border border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}>
                  {/* Check badge */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 90 }}
                        className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg z-20"
                        style={{ background: 'linear-gradient(135deg, #34D399, #10B981)' }}
                      >
                        ✓
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Avatar Image */}
                  <div className="aspect-square rounded-xl overflow-hidden mb-3 bg-gradient-to-br from-[#A989F2]/20 to-[#FF6B9D]/20 flex items-center justify-center">
                    {avatar.imageUrl ? (
                      <img src={avatar.imageUrl} alt={avatar.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={36} className="text-white/20" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="text-left">
                    <p className="font-bold text-white text-sm truncate">{avatar.name}</p>
                    <p className="text-xs text-white/40">{avatar.age} {t('wizard.summary.age')}, {avatar.gender === 'male' ? '👦' : avatar.gender === 'female' ? '👧' : '🧒'}</p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Selection summary */}
      <AnimatePresence>
        {state.selectedAvatars.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 10, height: 0 }}
            className="rounded-2xl p-4 border flex items-center gap-3"
            style={{
              background: 'linear-gradient(135deg, rgba(52,211,153,0.1), rgba(16,185,129,0.05))',
              borderColor: 'rgba(52,211,153,0.3)',
            }}
          >
            <Sparkles className="text-emerald-400 w-5 h-5 flex-shrink-0" />
            <p className="font-semibold text-emerald-300 text-sm">
              ✓ {state.selectedAvatars.length} {t('wizard.summary.avatars')} {t('common.selected')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
