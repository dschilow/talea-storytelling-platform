import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Image as ImageIcon, Plus, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { useBackend } from '../../../hooks/useBackend';
import { useOptionalChildProfiles } from '../../../contexts/ChildProfilesContext';
import { getPreferredAvatarIds } from '@/lib/child-profile-defaults';
import { TaleaSelectedBadge } from '@/components/talea/TaleaPastelPrimitives';

interface Avatar {
  id: string;
  name: string;
  imageUrl?: string;
  age: number;
  gender: string;
  avatarRole?: 'child' | 'companion';
  isOwnedByCurrentUser?: boolean;
  sharedByLabel?: string;
}

interface Props {
  state: { selectedAvatars: string[] };
  updateState: (updates: any) => void;
}

const accent = 'var(--primary)';

export default function Step1AvatarSelection({ state, updateState }: Props) {
  const backend = useBackend();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const childProfiles = useOptionalChildProfiles();
  const activeProfileId = childProfiles?.activeProfileId;
  const activeProfile = childProfiles?.activeProfile ?? null;
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);
  const needsChildAvatar = Boolean(activeProfile && !activeProfile.childAvatarId);
  const createAvatarRoute = needsChildAvatar
    ? `/avatar/create?mode=child${activeProfileId ? `&profileId=${encodeURIComponent(activeProfileId)}` : ''}`
    : '/avatar/create';

  useEffect(() => {
    void loadAvatars();
  }, [activeProfileId]);

  const loadAvatars = async () => {
    try {
      const response = await backend.avatar.list({ profileId: activeProfileId || undefined });
      setAvatars(
        (response.avatars || []).map((avatar: any) => ({
          id: avatar.id,
          name: avatar.name,
          imageUrl: avatar.imageUrl,
          age: avatar.age || 0,
          gender: avatar.gender || 'unknown',
          avatarRole: avatar.avatarRole,
          isOwnedByCurrentUser: avatar.isOwnedByCurrentUser !== false,
          sharedByLabel: avatar.sharedBy?.name || avatar.sharedBy?.email || undefined,
        }))
      );
    } catch (error) {
      console.error('[Step1AvatarSelection] Failed to load avatars:', error);
    } finally {
      setLoading(false);
    }
  };

  // The step header promises "Wähle 1-4 Avatare" — enforce it instead of
  // letting the child pick every avatar they own and blow up the cast.
  const MAX_AVATARS = 4;

  const toggleAvatar = (id: string) => {
    if (state.selectedAvatars.includes(id)) {
      updateState({ selectedAvatars: state.selectedAvatars.filter((item) => item !== id) });
      return;
    }
    if (state.selectedAvatars.length >= MAX_AVATARS) return;
    updateState({ selectedAvatars: [...state.selectedAvatars, id] });
  };

  const selectedCount = state.selectedAvatars.length;
  const orderedAvatars = useMemo(() => {
    const preferredIds = new Set(getPreferredAvatarIds(activeProfile));

    return [...avatars].sort((left, right) => {
      const leftChild = left.id === activeProfile?.childAvatarId || left.avatarRole === 'child' ? 1 : 0;
      const rightChild = right.id === activeProfile?.childAvatarId || right.avatarRole === 'child' ? 1 : 0;
      if (leftChild !== rightChild) {
        return rightChild - leftChild;
      }

      const leftPreferred = preferredIds.has(left.id) ? 1 : 0;
      const rightPreferred = preferredIds.has(right.id) ? 1 : 0;
      if (leftPreferred !== rightPreferred) {
        return rightPreferred - leftPreferred;
      }

      return left.name.localeCompare(right.name, 'de');
    });
  }, [activeProfile, avatars]);

  useEffect(() => {
    if (state.selectedAvatars.length > 0 || orderedAvatars.length === 0) {
      return;
    }

    const preferredIds = getPreferredAvatarIds(activeProfile).filter((avatarId) =>
      orderedAvatars.some((avatar) => avatar.id === avatarId)
    );

    if (preferredIds.length === 0) {
      return;
    }

    updateState({ selectedAvatars: preferredIds.slice(0, 1) });
  }, [activeProfile, orderedAvatars, state.selectedAvatars.length, updateState]);

  const selectedLabel = useMemo(() => {
    if (selectedCount === 0) return t('wizard.subtitles.avatars');
    const noun = selectedCount === 1 ? t('wizard.common.avatarSingular') : t('wizard.summary.avatars');
    const suffix = selectedCount >= MAX_AVATARS ? ` — ${t('wizard.common.avatarMaxReached')}` : '';
    return `${selectedCount} ${noun} ${t('common.selected')}${suffix}`;
  }, [selectedCount, t]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
          className="mb-3 h-10 w-10 rounded-full border-[3px] border-[var(--talea-text-tertiary)] border-t-transparent"
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
            onClick={() => navigate(createAvatarRoute)}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-[#1e2d42] shadow-[0_10px_20px_rgba(44,57,76,0.14)]"
            style={{ borderColor: '#d4c5b5', background: 'linear-gradient(135deg,#f2d9d6 0%,#e8d8e9 42%,#d6e3cf 100%)' }}
          >
            <Plus className="h-4 w-4" />
            {needsChildAvatar ? t('wizard.common.createChildAvatar') : t('avatar.create')}
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {orderedAvatars.map((avatar, index) => {
            const isSelected = state.selectedAvatars.includes(avatar.id);
            const isBlocked = !isSelected && selectedCount >= MAX_AVATARS;
            return (
              <motion.button
                key={avatar.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                whileHover={isBlocked ? undefined : { y: -3 }}
                whileTap={isBlocked ? undefined : { scale: 0.98 }}
                onClick={() => toggleAvatar(avatar.id)}
                aria-pressed={isSelected}
                disabled={isBlocked}
                className={cn(
                  'relative overflow-hidden rounded-2xl border p-3 text-left transition-colors',
                  isSelected ? 'bg-accent/55' : 'bg-card/70',
                  isBlocked && 'cursor-not-allowed opacity-45'
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
                {avatar.avatarRole === 'child' ? (
                  <p className="mt-0.5 text-xs font-semibold text-[var(--talea-text-tertiary)]">{t('wizard.common.childAvatar')}</p>
                ) : null}
                {avatar.isOwnedByCurrentUser === false && avatar.sharedByLabel ? (
                  <p className="mt-0.5 text-xs text-[#6f8cab]">{t('wizard.common.sharedBy', { name: avatar.sharedByLabel })}</p>
                ) : avatar.age > 0 ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {`${avatar.age} ${t('wizard.summary.age')}`}
                  </p>
                ) : null}

                <AnimatePresence>
                  {isSelected && <TaleaSelectedBadge label={avatar.name} />}
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

