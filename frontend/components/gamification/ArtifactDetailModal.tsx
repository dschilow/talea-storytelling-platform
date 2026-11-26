import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Book, ExternalLink, Shield, Sparkles, Swords, Users, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../contexts/ThemeContext';
import { useBackend } from '../../hooks/useBackend';
import { InventoryItem } from '../../types/avatar';

interface ArtifactDetailModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  showStoryLink?: boolean;
}

const getTypeMeta = (type: InventoryItem['type']) => {
  switch (type) {
    case 'WEAPON':
      return { label: 'Werkzeug', icon: Swords };
    case 'KNOWLEDGE':
      return { label: 'Wissen', icon: Book };
    case 'COMPANION':
      return { label: 'Begleiter', icon: Users };
    default:
      return { label: 'Artefakt', icon: Shield };
  }
};

const ArtifactDetailModal: React.FC<ArtifactDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  showStoryLink = true,
}) => {
  const navigate = useNavigate();
  const backend = useBackend();
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [storyTitle, setStoryTitle] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    if (item?.sourceStoryId && showStoryLink) {
      backend.story
        .get({ id: item.sourceStoryId })
        .then((story: any) => {
          if (alive) {
            setStoryTitle(story?.title || null);
          }
        })
        .catch(() => {
          if (alive) {
            setStoryTitle(null);
          }
        });
    } else {
      setStoryTitle(null);
    }

    return () => {
      alive = false;
    };
  }, [item?.sourceStoryId, showStoryLink]);

  const typeMeta = useMemo(() => (item ? getTypeMeta(item.type) : null), [item]);

  const handleGoToStory = () => {
    if (!item?.sourceStoryId) {
      return;
    }

    onClose();
    navigate(`/story-reader/${item.sourceStoryId}`);
  };

  if (!item || !typeMeta) {
    return null;
  }

  const TypeIcon = typeMeta.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4 backdrop-blur-md"
          data-talea-android-back onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            className="w-full max-w-xl overflow-hidden rounded-3xl border"
            style={{
              borderColor: 'var(--talea-border-soft)',
              background: 'var(--talea-surface-primary)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="relative border-b px-5 pb-4 pt-5"
              style={{
                borderColor: 'var(--talea-border-light)',
                background: isDark
                  ? 'linear-gradient(135deg, rgba(79,111,149,0.24) 0%, rgba(134,112,165,0.22) 100%)'
                  : 'linear-gradient(135deg, rgba(234,222,208,0.72) 0%, rgba(229,222,240,0.82) 100%)',
              }}
            >
              <button
                type="button"
                data-talea-android-back onClick={onClose}
                className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border"
                style={{
                  borderColor: 'var(--talea-border-soft)',
                  color: 'var(--talea-text-tertiary)',
                  background: 'var(--talea-surface-primary)',
                }}
                aria-label="Modal schliessen"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em]" style={{ borderColor: 'var(--talea-border-soft)', color: 'var(--talea-text-tertiary)' }}>
                <TypeIcon className="h-3.5 w-3.5" />
                {typeMeta.label}
              </div>

              <h2 className="mt-3 text-2xl font-semibold" style={{ color: 'var(--talea-text-primary)' }}>
                {item.name}
              </h2>

              <div className="mt-2 flex items-center gap-1.5">
                {Array.from({ length: Math.max(1, item.level) }).map((_, index) => (
                  <Sparkles key={`modal-star-${index}`} className="h-4 w-4 text-[#c88c7a]" />
                ))}
              </div>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div
                className="overflow-hidden rounded-2xl border"
                style={{
                  borderColor: 'var(--talea-border-soft)',
                  background: 'var(--talea-surface-primary)',
                }}
              >
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="h-56 w-full object-cover" />
                ) : (
                  <div className="flex h-56 w-full items-center justify-center">
                    <TypeIcon className="h-10 w-10" style={{ color: 'var(--talea-text-tertiary)' }} />
                  </div>
                )}
              </div>

              <InfoBlock
                label={t('artifact.description', 'Beschreibung')}
                text={item.description || 'Keine Beschreibung vorhanden.'}
                isDark={isDark}
              />

              {item.storyEffect && (
                <InfoBlock
                  label={t('artifact.storyEffect', 'Magische Wirkung')}
                  text={item.storyEffect}
                  isDark={isDark}
                />
              )}

              {showStoryLink && item.sourceStoryId && (
                <div
                  className="rounded-2xl border px-3.5 py-3"
                  style={{
                    borderColor: 'var(--talea-border-soft)',
                    background: 'var(--talea-surface-primary)',
                  }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--talea-text-tertiary)' }}>
                    {t('artifact.origin', 'Gefunden in')}
                  </p>
                  <button
                    type="button"
                    onClick={handleGoToStory}
                    className="mt-1 inline-flex items-center gap-2 text-sm font-semibold"
                    style={{ color: 'var(--talea-text-secondary)' }}
                  >
                    <Book className="h-4 w-4" />
                    <span className="line-clamp-1">{storyTitle || 'Geschichte öffnen'}</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const InfoBlock: React.FC<{ label: string; text: string; isDark: boolean }> = ({ label, text, isDark }) => (
  <div
    className="rounded-2xl border px-3.5 py-3"
    style={{
      borderColor: 'var(--talea-border-soft)',
      background: 'var(--talea-surface-primary)',
    }}
  >
    <p className="text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--talea-text-tertiary)' }}>
      {label}
    </p>
    <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--talea-text-secondary)' }}>
      {text}
    </p>
  </div>
);

export default ArtifactDetailModal;
