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
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            className="w-full max-w-xl overflow-hidden rounded-3xl border"
            style={{
              borderColor: isDark ? '#334a61' : '#dccfbe',
              background: isDark ? 'rgba(24,36,51,0.96)' : 'rgba(255,251,245,0.97)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="relative border-b px-5 pb-4 pt-5"
              style={{
                borderColor: isDark ? '#32465f' : '#e2d5c5',
                background: isDark
                  ? 'linear-gradient(135deg, rgba(79,111,149,0.24) 0%, rgba(134,112,165,0.22) 100%)'
                  : 'linear-gradient(135deg, rgba(234,222,208,0.72) 0%, rgba(229,222,240,0.82) 100%)',
              }}
            >
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border"
                style={{
                  borderColor: isDark ? '#3a4f67' : '#d9cbb9',
                  color: isDark ? '#c2d2e7' : '#607388',
                  background: isDark ? 'rgba(25,35,49,0.8)' : 'rgba(255,251,245,0.86)',
                }}
                aria-label="Modal schliessen"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em]" style={{ borderColor: isDark ? '#435a77' : '#d3c4b2', color: isDark ? '#c5d5e8' : '#5c728b' }}>
                <TypeIcon className="h-3.5 w-3.5" />
                {typeMeta.label}
              </div>

              <h2 className="mt-3 text-2xl font-semibold" style={{ color: isDark ? '#e8f0fb' : '#223347' }}>
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
                  borderColor: isDark ? '#334a61' : '#dccfbe',
                  background: isDark ? 'rgba(18,28,41,0.85)' : 'rgba(255,255,255,0.86)',
                }}
              >
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="h-56 w-full object-cover" />
                ) : (
                  <div className="flex h-56 w-full items-center justify-center">
                    <TypeIcon className="h-10 w-10" style={{ color: isDark ? '#c8d8eb' : '#607389' }} />
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
                    borderColor: isDark ? '#334a61' : '#dccfbe',
                    background: isDark ? 'rgba(20,31,45,0.8)' : 'rgba(255,251,246,0.9)',
                  }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: isDark ? '#97abc5' : '#6b7f97' }}>
                    {t('artifact.origin', 'Gefunden in')}
                  </p>
                  <button
                    type="button"
                    onClick={handleGoToStory}
                    className="mt-1 inline-flex items-center gap-2 text-sm font-semibold"
                    style={{ color: isDark ? '#cfe0f5' : '#31465e' }}
                  >
                    <Book className="h-4 w-4" />
                    <span className="line-clamp-1">{storyTitle || 'Geschichte oeffnen'}</span>
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
      borderColor: isDark ? '#334a61' : '#dccfbe',
      background: isDark ? 'rgba(20,31,45,0.8)' : 'rgba(255,251,246,0.9)',
    }}
  >
    <p className="text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: isDark ? '#97abc5' : '#6b7f97' }}>
      {label}
    </p>
    <p className="mt-1.5 text-sm leading-relaxed" style={{ color: isDark ? '#d4e2f4' : '#33485f' }}>
      {text}
    </p>
  </div>
);

export default ArtifactDetailModal;
