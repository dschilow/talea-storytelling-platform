import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Image as ImageIcon, Plus, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { useBackend } from '../../../hooks/useBackend';

interface Avatar {
  id: string;
  name: string;
  imageUrl?: string;
  age: number;
  gender: string;
}

interface Props {
  state: { selectedAvatars: string[] };
  updateState: (updates: any) => void;
}

const accent = '#a88f80';
const success = '#b79f8e';

export default function Step1AvatarSelection({ state, updateState }: Props) {
  const backend = useBackend();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadAvatars();
  }, []);

  const loadAvatars = async () => {
    try {
      const response = await backend.avatar.list();
      setAvatars(
        (response.avatars || []).map((avatar: any) => ({
          id: avatar.id,
          name: avatar.name,
          imageUrl: avatar.imageUrl,
          age: avatar.age || 0,
          gender: avatar.gender || 'unknown',
        }))
      );
    } catch (error) {
      console.error('[Step1AvatarSelection] Failed to load avatars:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAvatar = (id: string) => {
    const selected = state.selectedAvatars.includes(id)
      ? state.selectedAvatars.filter((item) => item !== id)
      : [...state.selectedAvatars, id];

    updateState({ selectedAvatars: selected });
  };

  const selectedCount = state.selectedAvatars.length;

  const selectedLabel = useMemo(() => {
    if (selectedCount === 0) return t('wizard.subtitles.avatars');
    return `${selectedCount} ${t('wizard.summary.avatars')} ${t('common.selected')}`;
  }, [selectedCount, t]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
          className="mb-3 h-10 w-10 rounded-full border-[3px] border-[#a88f80] border-t-transparent"
        />
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h2 className="mb-1 text-2xl font-bold text-foreground" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
          {t('wizard.titles.avatars')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('wizard.subtitles.avatars')}</p>
      </motion.div>

      {avatars.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-border bg-card/70 p-10 text-center shadow-[0_14px_28px_rgba(31,44,62,0.08)]"
        >
          <UserRound className="mx-auto mb-4 h-10 w-10 text-muted-foreground/70" />
          <p className="mb-5 text-sm text-muted-foreground">{t('homePage.emptyAvatarsTitle')}</p>
          <button
            type="button"
            onClick={() => navigate('/avatar/create')}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-[#1e2d42] shadow-[0_10px_20px_rgba(44,57,76,0.14)]"
            style={{ borderColor: '#d4c5b5', background: 'linear-gradient(135deg,#f2d9d6 0%,#e8d8e9 42%,#d6e3cf 100%)' }}
          >
            <Plus className="h-4 w-4" />
            {t('avatar.create')}
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {avatars.map((avatar, index) => {
            const isSelected = state.selectedAvatars.includes(avatar.id);
            return (
              <motion.button
                key={avatar.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleAvatar(avatar.id)}
                className={cn(
                  'relative overflow-hidden rounded-2xl border p-3 text-left transition-colors',
                  isSelected ? 'bg-accent/55' : 'bg-card/70'
                )}
                style={{
                  borderColor: isSelected ? `${accent}66` : 'var(--color-border)',
                }}
              >
                <div className="mb-3 aspect-square overflow-hidden rounded-xl bg-muted/40">
                  {avatar.imageUrl ? (
                    <img src={avatar.imageUrl} alt={avatar.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/70" />
                    </div>
                  )}
                </div>

                <p className="truncate text-sm font-semibold text-foreground">{avatar.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {avatar.age > 0 ? `${avatar.age} ${t('wizard.summary.age')}` : t('wizard.common.notSelected')}
                </p>

                <AnimatePresence>
                  {isSelected && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: success }}
                    >
                      OK
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl border border-[#7baea032] bg-[#7baea014] px-4 py-3"
      >
        <p className="text-sm font-semibold text-foreground/85">{selectedLabel}</p>
      </motion.div>
    </div>
  );
}

