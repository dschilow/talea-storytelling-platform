import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  FlaskConical,
  Globe,
  GraduationCap,
  Headphones,
  ListPlus,
  Loader2,
  Mic,
  Pencil,
  Play,
  PlayCircle,
  Plus,
  Search,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';

import { DokuCard } from '../../components/cards/DokuCard';
import { useBackend } from '../../hooks/useBackend';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { AudioPlaybackControls } from '../../components/audio/AudioPlaybackControls';
import type { Doku } from '../../types/doku';
import type { AudioDoku } from '../../types/audio-doku';
import { useTheme } from '../../contexts/ThemeContext';
import { useOptionalUserAccess } from '../../contexts/UserAccessContext';
import { useOffline } from '../../contexts/OfflineStorageContext';
import { useOptionalChildProfiles } from '@/contexts/ChildProfilesContext';
import ProgressiveImage from '@/components/common/ProgressiveImage';
import {
  TaleaActionButton,
  TaleaMetricPill,
  TaleaPageBackground,
  taleaBodyFont,
  taleaChipClass,
  taleaDisplayFont,
  taleaInputClass,
  taleaPageShellClass,
  taleaSurfaceClass,
} from '@/components/talea/TaleaPastelPrimitives';

type Palette = {
  pageGradient: string;
  haloA: string;
  haloB: string;
  panel: string;
  border: string;
  text: string;
  muted: string;
  soft: string;
  primary: string;
  primaryText: string;
};

const headingFont = taleaDisplayFont;
const bodyFont = taleaBodyFont;

type DokuTab = 'mine' | 'discover' | 'audio';
type DokuSortMode = 'newest' | 'oldest' | 'title';
type AudioScope = 'all' | 'mine' | 'public';

function normalizeFilterValue(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
}

function getDokuTopicValue(doku: Doku): string {
  return normalizeFilterValue(doku.topic || doku.metadata?.configSnapshot?.topic);
}

function getDokuAgeGroupValue(doku: Doku): string {
  return normalizeFilterValue(doku.metadata?.configSnapshot?.ageGroup);
}

function getDokuDepthValue(doku: Doku): string {
  return normalizeFilterValue(doku.metadata?.configSnapshot?.depth);
}

function formatDokuDepthLabel(depth: string): string {
  if (depth === 'basic') return 'Basis';
  if (depth === 'standard') return 'Standard';
  if (depth === 'deep') return 'Tief';
  return depth || 'Unbekannt';
}

function formatTopicLabel(topic: string): string {
  if (!topic) return 'Unbekannt';
  return topic
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getPalette(_isDark: boolean): Palette {
  return {
    pageGradient: 'var(--talea-page)',
    haloA: 'var(--talea-gradient-primary)',
    haloB: 'var(--talea-gradient-ocean)',
    panel: 'var(--talea-surface-primary)',
    border: 'var(--talea-border-light)',
    text: 'var(--talea-text-primary)',
    muted: 'var(--talea-text-secondary)',
    soft: 'var(--talea-surface-inset)',
    primary: 'linear-gradient(135deg,var(--primary) 0%, color-mix(in srgb, var(--talea-accent-sky) 72%, white) 100%)',
    primaryText: 'var(--primary-foreground)',
  };
}

const DokuBackground: React.FC<{ isDark: boolean }> = ({ isDark }) => <TaleaPageBackground isDark={isDark} />;

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count: number;
  palette: Palette;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ icon, title, subtitle, count, palette, actionLabel, onAction }) => (
  <div className="mb-4 flex items-center justify-between gap-3">
    <div className="flex items-center gap-2.5">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: palette.soft, color: palette.text }}>
        {icon}
      </div>
      <div>
        <h3 className="text-xl leading-none" style={{ fontFamily: headingFont, color: palette.text }}>
          {title}
        </h3>
        <p className="text-xs mt-1" style={{ color: palette.muted }}>
          {subtitle} ({count})
        </p>
      </div>
    </div>

    {onAction && actionLabel && (
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
        style={{ borderColor: palette.border, background: palette.primary, color: palette.primaryText }}
      >
        <Plus className="h-3.5 w-3.5" />
        {actionLabel}
      </button>
    )}
  </div>
);

const AudioDokuCard: React.FC<{
  doku: AudioDoku;
  index: number;
  onPlay: () => void;
  onAddToQueue?: () => void;
  palette: Palette;
  isAdmin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  canSaveOffline?: boolean;
  isSavedOffline?: boolean;
  isSavingOffline?: boolean;
  onToggleOffline?: () => void;
}> = ({
  doku,
  index,
  onPlay,
  onAddToQueue,
  palette,
  isAdmin,
  onEdit,
  onDelete,
  canSaveOffline,
  isSavedOffline,
  isSavingOffline,
  onToggleOffline,
}) => (
  <motion.article
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.03, duration: 0.24 }}
    whileHover={{ y: -4 }}
    onClick={onPlay}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onPlay();
      }
    }}
    role="button"
    tabIndex={0}
    aria-label={`Audio-Doku abspielen: ${doku.title}`}
    className="group w-full cursor-pointer overflow-hidden rounded-3xl border text-left shadow-[0_12px_28px_rgba(33,44,62,0.12)]"
    style={{ borderColor: palette.border, background: palette.panel }}
  >
    <div className="relative h-44 overflow-hidden" style={{ background: palette.soft }}>
      <ProgressiveImage
        src={doku.coverImageUrl}
        alt={doku.title}
        revealDelayMs={index * 35}
        containerClassName="h-full w-full"
        imageClassName="transition-transform duration-500 group-hover:scale-[1.04]"
        skeletonClassName="bg-[var(--talea-media-skeleton)]"
        fallback={
          <div className="flex h-full w-full items-center justify-center">
            <Headphones className="h-12 w-12" style={{ color: palette.muted }} />
          </div>
        }
      />

      <div className="absolute inset-0" style={{ background: 'var(--talea-media-overlay)' }} />

      <div
        className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{
          borderColor: 'var(--talea-media-chrome-border)',
          background: 'var(--talea-media-chrome-bg)',
          color: 'var(--talea-media-foreground)',
        }}
      >
        <Mic className="h-3 w-3" />
        Audio
      </div>

      <div className="absolute right-3 top-3 flex items-center gap-2">
        {canSaveOffline && onToggleOffline && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleOffline();
            }}
            disabled={isSavingOffline}
            className="rounded-xl border p-2"
            style={{ borderColor: palette.border, background: palette.panel, color: palette.text }}
            aria-label={isSavedOffline ? 'Offline-Speicherung entfernen' : 'Offline speichern'}
          >
            {isSavingOffline ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSavedOffline ? (
              <BookmarkCheck className="h-4 w-4" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </button>
        )}

        {isAdmin && onEdit && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            className="rounded-xl border p-2"
            style={{ borderColor: palette.border, background: palette.panel, color: palette.text }}
            aria-label="Audio-Doku bearbeiten"
            title="Audio-Doku bearbeiten"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}

        {isAdmin && onDelete && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="rounded-xl border p-2"
            style={{
              borderColor: 'var(--talea-danger-border)',
              background: 'var(--talea-danger-soft)',
              color: 'var(--talea-danger)',
            }}
            aria-label="Audio-Doku loeschen"
            title="Audio-Doku loeschen"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-3 opacity-0 transition-opacity group-hover:opacity-100">
        <div
          className="inline-flex h-14 w-14 items-center justify-center rounded-full border"
          style={{
            borderColor: 'var(--talea-media-control-border)',
            background: 'var(--talea-media-control-bg)',
            color: 'var(--talea-media-foreground)',
          }}
        >
          <Play className="h-5 w-5 ml-0.5" />
        </div>
        {onAddToQueue && (
          <button
            type="button"
            className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border transition-transform hover:scale-110"
            onClick={(e) => {
              e.stopPropagation();
              onAddToQueue();
            }}
            style={{
              borderColor: 'var(--talea-media-control-border)',
              background: 'var(--talea-media-control-bg)',
              color: 'var(--talea-media-foreground)',
            }}
            title="Zur Warteschlange"
            aria-label="Zur Warteschlange hinzufuegen"
          >
            <ListPlus className="h-4 w-4" />
          </button>
        )}
      </div>

      <h4 className="absolute bottom-3 left-3 right-3 line-clamp-2 text-lg font-semibold text-white">
        {doku.title}
      </h4>
    </div>

    <div className="p-4">
      <p className="line-clamp-2 text-sm" style={{ color: palette.muted }}>
        {doku.description}
      </p>
      {(doku.ageGroup || doku.category) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {doku.ageGroup && (
            <span className="rounded-full border px-2 py-1 text-[11px]" style={{ borderColor: palette.border, color: palette.text, background: palette.soft }}>
              Alter {doku.ageGroup}
            </span>
          )}
          {doku.category && (
            <span className="rounded-full border px-2 py-1 text-[11px]" style={{ borderColor: palette.border, color: palette.text, background: palette.soft }}>
              {doku.category}
            </span>
          )}
        </div>
      )}
    </div>
  </motion.article>
);

const AudioModal: React.FC<{
  doku: AudioDoku;
  onClose: () => void;
  onPlay: () => void;
  isPlaying: boolean;
  audioError: string | null;
  palette: Palette;
}> = ({ doku, onClose, onPlay, isPlaying, audioError, palette }) => {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/55 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 16 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-3xl border"
        style={{ borderColor: palette.border, background: palette.panel }}
      >
        <div className="relative h-48 overflow-hidden" style={{ background: palette.soft }}>
          {doku.coverImageUrl ? (
            <img src={doku.coverImageUrl} alt={doku.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Headphones className="h-14 w-14" style={{ color: palette.muted }} />
            </div>
          )}
          <div className="absolute inset-0" style={{ background: 'var(--talea-media-overlay-strong)' }} />

          <button
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full border p-2"
            style={{
              borderColor: 'var(--talea-media-chrome-border)',
              background: 'var(--talea-media-chrome-bg)',
              color: 'var(--talea-media-foreground)',
            }}
            aria-label="Audio Modal schliessen"
          >
            <X className="h-4 w-4" />
          </button>

          <h3 className="absolute bottom-4 left-4 right-4 text-xl font-semibold text-white">{doku.title}</h3>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm" style={{ color: palette.muted }}>
            {doku.description}
          </p>

          {audioError && (
            <div
              className="rounded-xl border p-3 text-sm"
              style={{
                borderColor: 'var(--talea-danger-border)',
                background: 'var(--talea-danger-soft)',
                color: 'var(--talea-danger)',
              }}
            >
              {audioError}
            </div>
          )}

          <div className="rounded-2xl border p-4" style={{ borderColor: palette.border, background: palette.soft }}>
            {isPlaying ? (
              <AudioPlaybackControls variant="full" showClose />
            ) : (
              <button
                type="button"
                onClick={onPlay}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold"
                style={{ borderColor: palette.border, background: palette.primary, color: palette.primaryText }}
              >
                <Play className="h-4 w-4" />
                {t('doku.audioPlay', 'Abspielen')}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const SectionLoading: React.FC<{ palette: Palette }> = ({ palette }) => (
  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: i * 0.04 }}
        className="overflow-hidden rounded-3xl border"
        style={{ borderColor: palette.border, background: palette.panel }}
      >
        <div className="relative h-44 animate-pulse" style={{ background: palette.soft }}>
          <motion.div
            className="absolute inset-y-0 -left-1/3 w-1/3 bg-white/30 dark:bg-white/10"
            animate={{ x: ['0%', '420%'] }}
            transition={{ duration: 1.25, repeat: Infinity, ease: 'easeInOut', delay: i * 0.05 }}
          />
        </div>
        <div className="space-y-3 p-4">
          <div className="h-5 w-4/5 animate-pulse rounded" style={{ background: palette.soft }} />
          <div className="h-4 w-full animate-pulse rounded" style={{ background: palette.soft }} />
          <div className="h-4 w-3/4 animate-pulse rounded" style={{ background: palette.soft }} />
        </div>
      </motion.div>
    ))}
  </div>
);

const TaleaDokusScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const backend = useBackend();
  const audioPlayer = useAudioPlayer();
  const { isSignedIn, isLoaded, user } = useUser();
  const activeProfileId = useOptionalChildProfiles()?.activeProfileId;
  const { isAdmin } = useOptionalUserAccess();
  const { canUseOffline, isAudioDokuSaved, isSaving, toggleAudioDoku } = useOffline();
  const { resolvedTheme } = useTheme();
  const reduceMotion = useReducedMotion();

  const isDark = resolvedTheme === 'dark';
  const palette = useMemo(() => getPalette(isDark), [isDark]);

  const [myDokus, setMyDokus] = useState<Doku[]>([]);
  const [publicDokus, setPublicDokus] = useState<Doku[]>([]);
  const [audioDokus, setAudioDokus] = useState<AudioDoku[]>([]);
  const [loadingMy, setLoadingMy] = useState(true);
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [loadingAudio, setLoadingAudio] = useState(true);
  const [loadingMoreMy, setLoadingMoreMy] = useState(false);
  const [loadingMorePublic, setLoadingMorePublic] = useState(false);
  const [hasMoreMy, setHasMoreMy] = useState(true);
  const [hasMorePublic, setHasMorePublic] = useState(true);
  const [totalMy, setTotalMy] = useState(0);
  const [totalPublic, setTotalPublic] = useState(0);
  const [totalAudio, setTotalAudio] = useState(0);
  const [audioModal, setAudioModal] = useState<AudioDoku | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [publicAccessMessage, setPublicAccessMessage] = useState<string | null>(null);
  const [audioAccessMessage, setAudioAccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('tags') ?? '');
  const [activeTab, setActiveTab] = useState<DokuTab>(searchParams.get('mode') === 'audio' ? 'audio' : 'mine');
  const [sortMode, setSortMode] = useState<DokuSortMode>('newest');
  const [topicFilter, setTopicFilter] = useState('all');
  const [ageGroupFilter, setAgeGroupFilter] = useState('all');
  const [depthFilter, setDepthFilter] = useState('all');
  const [audioScopeFilter, setAudioScopeFilter] = useState<AudioScope>('all');
  const [activeControl, setActiveControl] = useState<string | null>(null);

  const myObserverRef = useRef<HTMLDivElement>(null);
  const publicObserverRef = useRef<HTMLDivElement>(null);

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  };

  const loadMyDokus = async () => {
    try {
      setLoadingMy(true);
      const res = await backend.doku.listDokus({
        limit: 10,
        offset: 0,
        profileId: activeProfileId || undefined,
      });
      setMyDokus(res.dokus as any[]);
      setTotalMy(res.total);
      setHasMoreMy(res.hasMore);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMy(false);
    }
  };

  const loadPublicDokus = async () => {
    try {
      setLoadingPublic(true);
      setPublicAccessMessage(null);
      const res = await backend.doku.listPublicDokus({ limit: 12, offset: 0 });
      setPublicDokus(res.dokus as any[]);
      setTotalPublic(res.total);
      setHasMorePublic(res.hasMore);
    } catch (error) {
      console.error(error);
      setPublicDokus([]);
      setTotalPublic(0);
      setHasMorePublic(false);
      setPublicAccessMessage(getErrorMessage(error, 'Entdecken-Inhalte sind in deinem aktuellen Plan nicht verfuegbar.'));
    } finally {
      setLoadingPublic(false);
    }
  };

  const loadAudioDokus = async () => {
    try {
      setLoadingAudio(true);
      setAudioAccessMessage(null);
      const res = await backend.doku.listAudioDokus({
        limit: 12,
        offset: 0,
        profileId: activeProfileId || undefined,
      });
      setAudioDokus(res.audioDokus as any[]);
      setTotalAudio(res.total);
    } catch (error) {
      console.error(error);
      setAudioDokus([]);
      setTotalAudio(0);
      setAudioAccessMessage(getErrorMessage(error, 'Audio-Dokus sind in deinem aktuellen Plan nicht verfuegbar.'));
    } finally {
      setLoadingAudio(false);
    }
  };

  const loadMoreMy = useCallback(async () => {
    if (loadingMoreMy || !hasMoreMy) return;
    try {
      setLoadingMoreMy(true);
      const res = await backend.doku.listDokus({
        limit: 10,
        offset: myDokus.length,
        profileId: activeProfileId || undefined,
      });
      setMyDokus((prev) => [...prev, ...(res.dokus as any[])]);
      setHasMoreMy(res.hasMore);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMoreMy(false);
    }
  }, [backend, hasMoreMy, loadingMoreMy, myDokus.length, activeProfileId]);

  const loadMorePublic = useCallback(async () => {
    if (loadingMorePublic || !hasMorePublic || publicAccessMessage) return;
    try {
      setLoadingMorePublic(true);
      const res = await backend.doku.listPublicDokus({ limit: 12, offset: publicDokus.length });
      setPublicDokus((prev) => [...prev, ...(res.dokus as any[])]);
      setHasMorePublic(res.hasMore);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMorePublic(false);
    }
  }, [backend, hasMorePublic, loadingMorePublic, publicAccessMessage, publicDokus.length]);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setMyDokus([]);
      setPublicDokus([]);
      setAudioDokus([]);
      setTotalMy(0);
      setTotalPublic(0);
      setTotalAudio(0);
      setHasMoreMy(false);
      setHasMorePublic(false);
      setLoadingMy(false);
      setLoadingPublic(false);
      setLoadingAudio(false);
      return;
    }

    void loadMyDokus();
    void loadPublicDokus();
    void loadAudioDokus();
  }, [isLoaded, isSignedIn, backend, activeProfileId, user?.id]);

  useEffect(() => {
    if (!isSignedIn || activeTab !== 'mine') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreMy && !loadingMoreMy && !loadingMy) {
          void loadMoreMy();
        }
      },
      { threshold: 0.1 }
    );

    const target = myObserverRef.current;
    if (target) observer.observe(target);
    return () => {
      if (target) observer.unobserve(target);
    };
  }, [hasMoreMy, loadingMoreMy, loadingMy, loadMoreMy, isSignedIn, activeTab]);

  useEffect(() => {
    if (!isSignedIn || publicAccessMessage || activeTab !== 'discover') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMorePublic && !loadingMorePublic && !loadingPublic) {
          void loadMorePublic();
        }
      },
      { threshold: 0.1 }
    );

    const target = publicObserverRef.current;
    if (target) observer.observe(target);
    return () => {
      if (target) observer.unobserve(target);
    };
  }, [hasMorePublic, loadingMorePublic, loadingPublic, loadMorePublic, isSignedIn, publicAccessMessage, activeTab]);

  const handleDeleteDoku = async (dokuId: string, dokuTitle: string) => {
    if (!window.confirm(`${t('common.delete', 'Loeschen')} "${dokuTitle}"?`)) return;

    try {
      await backend.doku.deleteDoku({ id: dokuId, profileId: activeProfileId || undefined });
      setMyDokus((prev) => prev.filter((d) => d.id !== dokuId));
    } catch (error) {
      console.error(error);
    }
  };

  const handleTogglePublic = async (dokuId: string, currentIsPublic: boolean) => {
    try {
      await backend.doku.updateDoku({
        id: dokuId,
        isPublic: !currentIsPublic,
        profileId: activeProfileId || undefined,
      });
      setMyDokus((prev) => prev.map((d) => (d.id === dokuId ? { ...d, isPublic: !currentIsPublic } : d)));
      if (currentIsPublic) {
        setPublicDokus((prev) => prev.filter((d) => d.id !== dokuId));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handlePlayAudio = (doku: AudioDoku) => {
    setAudioError(null);
    if (!doku.audioUrl) {
      setAudioError('Keine Audio-Datei verfuegbar');
      return;
    }
    const itemId = `audiodoku-${doku.id}`;
    const existingIdx = audioPlayer.playlist.findIndex((i) => i.id === itemId);
    if (existingIdx >= 0) {
      audioPlayer.playFromPlaylist(existingIdx);
    } else {
      audioPlayer.addAndPlay([{
        id: itemId,
        trackId: doku.id,
        title: doku.title,
        description: doku.description,
        coverImageUrl: doku.coverImageUrl,
        type: 'audio-doku',
        audioUrl: doku.audioUrl,
        conversionStatus: 'ready',
      }]);
    }
  };

  const handleAddAudioToQueue = (doku: AudioDoku) => {
    if (!doku.audioUrl) return;
    audioPlayer.addToPlaylist([{
      id: `audiodoku-${doku.id}`,
      trackId: doku.id,
      title: doku.title,
      description: doku.description,
      coverImageUrl: doku.coverImageUrl,
      type: 'audio-doku',
      audioUrl: doku.audioUrl,
      conversionStatus: 'ready',
    }]);
  };

  const handlePlayAllAudioDokus = () => {
    const items = filteredAudioDokus
      .filter((d) => d.audioUrl)
      .map((d) => ({
        id: `audiodoku-${d.id}`,
        trackId: d.id,
        title: d.title,
        description: d.description,
        coverImageUrl: d.coverImageUrl,
        type: 'audio-doku' as const,
        audioUrl: d.audioUrl,
        conversionStatus: 'ready' as const,
      }));
    if (items.length === 0) return;
    audioPlayer.clearPlaylist();
    audioPlayer.addAndPlay(items);
  };

  const handleEditAudioDoku = (doku: AudioDoku) => {
    if (!isAdmin) return;
    navigate(`/createaudiodoku?edit=${encodeURIComponent(doku.id)}`);
  };

  const handleDeleteAudioDoku = async (doku: AudioDoku) => {
    if (!isAdmin) return;
    if (!window.confirm(`${t('common.delete', 'Loeschen')} "${doku.title}"?`)) {
      return;
    }

    try {
      await backend.doku.deleteAudioDoku({ id: doku.id });
      setAudioDokus((prev) => prev.filter((item) => item.id !== doku.id));
      setTotalAudio((prev) => Math.max(0, prev - 1));
      if (audioModal?.id === doku.id) {
        setAudioModal(null);
      }
    } catch (error) {
      console.error(error);
      alert(t('errors.generic', 'Fehler beim Loeschen.'));
    }
  };

  const query = searchQuery.trim().toLowerCase();

  const sortDokus = useCallback(
    (items: Doku[]) => {
      const sorted = [...items];
      if (sortMode === 'title') {
        sorted.sort((a, b) => a.title.localeCompare(b.title, 'de'));
        return sorted;
      }
      if (sortMode === 'oldest') {
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return sorted;
      }
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return sorted;
    },
    [sortMode]
  );

  const sortAudioDokus = useCallback(
    (items: AudioDoku[]) => {
      const sorted = [...items];
      if (sortMode === 'title') {
        sorted.sort((a, b) => a.title.localeCompare(b.title, 'de'));
        return sorted;
      }
      if (sortMode === 'oldest') {
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return sorted;
      }
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return sorted;
    },
    [sortMode]
  );

  const activeTextDokus = useMemo(
    () => (activeTab === 'discover' ? publicDokus : myDokus),
    [activeTab, myDokus, publicDokus]
  );

  const topicFilterOptions = useMemo(
    () =>
      Array.from(new Set(activeTextDokus.map((doku) => getDokuTopicValue(doku)).filter(Boolean))).sort((a, b) =>
        formatTopicLabel(a).localeCompare(formatTopicLabel(b), 'de')
      ),
    [activeTextDokus]
  );

  const ageGroupFilterOptions = useMemo(
    () =>
      Array.from(new Set(activeTextDokus.map((doku) => getDokuAgeGroupValue(doku)).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'de')
      ),
    [activeTextDokus]
  );

  const depthFilterOptions = useMemo(
    () => Array.from(new Set(activeTextDokus.map((doku) => getDokuDepthValue(doku)).filter(Boolean))),
    [activeTextDokus]
  );

  const matchesTextFilters = useCallback(
    (doku: Doku) => {
      if (topicFilter !== 'all' && getDokuTopicValue(doku) !== topicFilter) return false;
      if (ageGroupFilter !== 'all' && getDokuAgeGroupValue(doku) !== ageGroupFilter) return false;
      if (depthFilter !== 'all' && getDokuDepthValue(doku) !== depthFilter) return false;
      return true;
    },
    [topicFilter, ageGroupFilter, depthFilter]
  );

  const filteredMyDokus = useMemo(() => {
    const filtered = myDokus.filter((doku) => {
      if (!matchesTextFilters(doku)) return false;
      if (!query) return true;
      return doku.title.toLowerCase().includes(query) || (doku.topic || '').toLowerCase().includes(query);
    });
    return sortDokus(filtered);
  }, [myDokus, matchesTextFilters, query, sortDokus]);

  const filteredPublicDokus = useMemo(() => {
    const filtered = publicDokus.filter((doku) => {
      if (!matchesTextFilters(doku)) return false;
      if (!query) return true;
      return doku.title.toLowerCase().includes(query) || (doku.topic || '').toLowerCase().includes(query);
    });
    return sortDokus(filtered);
  }, [publicDokus, matchesTextFilters, query, sortDokus]);

  const filteredAudioDokus = useMemo(() => {
    const filtered = audioDokus.filter((doku) => {
      if (audioScopeFilter === 'mine' && doku.userId !== user?.id) return false;
      if (audioScopeFilter === 'public' && !doku.isPublic) return false;
      if (!query) return true;
      return (
        doku.title.toLowerCase().includes(query) ||
        (doku.description || '').toLowerCase().includes(query) ||
        (doku.category || '').toLowerCase().includes(query) ||
        (doku.ageGroup || '').toLowerCase().includes(query)
      );
    });
    return sortAudioDokus(filtered);
  }, [audioDokus, audioScopeFilter, query, sortAudioDokus, user?.id]);

  const isInitialLoading =
    isSignedIn &&
    ((activeTab === 'mine' && loadingMy) ||
      (activeTab === 'discover' && loadingPublic) ||
      (activeTab === 'audio' && loadingAudio));

  const controlHover = reduceMotion ? undefined : { y: -2, scale: 1.01 };
  const controlTap = reduceMotion ? undefined : { scale: 0.985 };
  const controlFocusRing = (controlId: string) =>
    activeControl === controlId
      ? '0 0 0 4px color-mix(in srgb, var(--primary) 12%, transparent)'
      : '0 0 0 0 transparent';

  return (
    <div className="relative min-h-screen pb-28" style={{ color: palette.text, fontFamily: bodyFont }}>
      <DokuBackground isDark={isDark} />

      <SignedOut>
        <div className={cn(taleaPageShellClass, 'flex min-h-[68vh] items-center justify-center py-10')}>
          <div className={cn(taleaSurfaceClass, 'w-full max-w-2xl p-8 text-center')}>
            <h2 className="text-3xl" style={{ fontFamily: headingFont, color: palette.text }}>
              {t('errors.unauthorized', 'Bitte melde dich an')}
            </h2>
            <TaleaActionButton type="button" onClick={() => navigate('/auth')} className="mt-5">
              {t('auth.signIn', 'Anmelden')}
            </TaleaActionButton>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <div className={cn(taleaPageShellClass, 'relative z-10 space-y-5 pt-3')}>
          <header className={cn(taleaSurfaceClass, 'overflow-hidden p-3 sm:p-4 md:p-5')}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
              <div className="min-w-0">
                <span className={taleaChipClass}>Dokus</span>

                <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <h1
                    className="text-[1.85rem] font-semibold leading-[0.98] text-[var(--talea-text-primary)] sm:text-[2.15rem]"
                    style={{ fontFamily: headingFont }}
                  >
                    Dokus
                  </h1>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <TaleaActionButton type="button" onClick={() => navigate('/doku/create')} icon={<Wand2 className="h-4 w-4" />}>
                      {t('doku.createNew', 'Neue Doku')}
                    </TaleaActionButton>
                    {isAdmin ? (
                      <TaleaActionButton type="button" variant="secondary" onClick={() => navigate('/createaudiodoku')} icon={<Headphones className="h-4 w-4" />}>
                        Audio
                      </TaleaActionButton>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3 xl:w-[19rem] xl:grid-cols-3">
                {[
                  { label: 'Meine', value: String(totalMy) },
                  { label: 'Entdecken', value: String(totalPublic) },
                  { label: 'Audio', value: String(totalAudio) },
                ].map((metric) => (
                  <motion.div key={metric.label} whileHover={controlHover} transition={{ type: 'spring', stiffness: 320, damping: 24 }}>
                    <TaleaMetricPill label={metric.label} value={metric.value} />
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <motion.label
                className="relative min-w-0"
                whileHover={controlHover}
                animate={{ boxShadow: controlFocusRing('doku-search') }}
                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              >
                <motion.div
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--talea-text-muted)]"
                  animate={activeControl === 'doku-search' && !reduceMotion ? { x: 1.5, scale: 1.06 } : { x: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 24 }}
                >
                  <Search className="h-4 w-4" />
                </motion.div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setActiveControl('doku-search')}
                  onBlur={() => setActiveControl((current) => (current === 'doku-search' ? null : current))}
                  placeholder={
                    activeTab === 'audio'
                      ? t('doku.searchPlaceholder', 'Audio durchsuchen...')
                      : t('doku.searchPlaceholder', 'Dokus durchsuchen...')
                  }
                  className={cn(taleaInputClass, 'pl-10')}
                />
              </motion.label>

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {([
                  { key: 'mine', label: 'Meine', count: totalMy },
                  { key: 'discover', label: 'Entdecken', count: totalPublic },
                  { key: 'audio', label: 'Hoerwelt', count: totalAudio },
                ] as const).map((tab) => {
                  const active = activeTab === tab.key;
                  return (
                    <motion.button
                      whileHover={controlHover}
                      whileTap={controlTap}
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className="relative inline-flex shrink-0 items-center gap-2 overflow-hidden rounded-[1rem] border px-3 py-2 text-xs font-semibold transition-colors border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] text-[var(--talea-text-secondary)]"
                    >
                      {active ? (
                        <motion.span
                          layoutId="doku-active-tab"
                          className="absolute inset-0 rounded-[1rem] border border-[var(--talea-border-accent)] bg-[linear-gradient(135deg,rgba(255,255,255,0.76)_0%,rgba(231,239,232,0.88)_46%,rgba(227,235,247,0.82)_100%)] dark:bg-[linear-gradient(135deg,rgba(229,176,183,0.14)_0%,rgba(154,199,182,0.18)_46%,rgba(176,200,231,0.16)_100%)]"
                          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                        />
                      ) : null}
                      <span className="relative z-10">{tab.label}</span>
                      <span className="relative z-10 rounded-full bg-white/65 px-2 py-0.5 text-[10px] dark:bg-white/8">
                        {tab.count}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {activeTab !== 'audio' ? (
                <>
                  {[
                    {
                      id: 'topic-filter',
                      value: topicFilter,
                      onChange: (value: string) => setTopicFilter(value),
                      ariaLabel: 'Thema filtern',
                      options: [
                        { value: 'all', label: 'Alle Themen' },
                        ...topicFilterOptions.map((topic) => ({ value: topic, label: formatTopicLabel(topic) })),
                      ],
                    },
                    {
                      id: 'age-filter',
                      value: ageGroupFilter,
                      onChange: (value: string) => setAgeGroupFilter(value),
                      ariaLabel: 'Altersgruppe filtern',
                      options: [
                        { value: 'all', label: 'Alle Altersgruppen' },
                        ...ageGroupFilterOptions.map((ageGroup) => ({ value: ageGroup, label: ageGroup })),
                      ],
                    },
                    {
                      id: 'depth-filter',
                      value: depthFilter,
                      onChange: (value: string) => setDepthFilter(value),
                      ariaLabel: 'Tiefe filtern',
                      options: [
                        { value: 'all', label: 'Alle Tiefen' },
                        ...depthFilterOptions.map((depth) => ({ value: depth, label: formatDokuDepthLabel(depth) })),
                      ],
                    },
                  ].map((control) => (
                    <motion.div
                      key={control.id}
                      className="relative"
                      whileHover={controlHover}
                      animate={{ boxShadow: controlFocusRing(control.id) }}
                      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                    >
                      <select
                        value={control.value}
                        onChange={(event) => control.onChange(event.target.value)}
                        onFocus={() => setActiveControl(control.id)}
                        onBlur={() => setActiveControl((current) => (current === control.id ? null : current))}
                        className={cn(taleaInputClass, 'cursor-pointer appearance-none pr-10')}
                        aria-label={control.ariaLabel}
                      >
                        {control.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <motion.div
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--talea-text-muted)]"
                        animate={activeControl === control.id && !reduceMotion ? { y: 1, scale: 1.08 } : { y: 0, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 340, damping: 24 }}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </motion.div>
                    </motion.div>
                  ))}
                </>
              ) : (
                <motion.div
                  className="relative"
                  whileHover={controlHover}
                  animate={{ boxShadow: controlFocusRing('audio-scope-filter') }}
                  transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                >
                  <select
                    value={audioScopeFilter}
                    onChange={(event) => setAudioScopeFilter(event.target.value as AudioScope)}
                    onFocus={() => setActiveControl('audio-scope-filter')}
                    onBlur={() => setActiveControl((current) => (current === 'audio-scope-filter' ? null : current))}
                    className={cn(taleaInputClass, 'cursor-pointer appearance-none pr-10')}
                    aria-label="Audio Bereich filtern"
                  >
                    <option value="all">Alle Audio</option>
                    <option value="mine">Meine Audio</option>
                    <option value="public">Oeffentliche Audio</option>
                  </select>
                  <motion.div
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--talea-text-muted)]"
                    animate={activeControl === 'audio-scope-filter' && !reduceMotion ? { y: 1, scale: 1.08 } : { y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 24 }}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </motion.div>
                </motion.div>
              )}

              <motion.div
                className="relative"
                whileHover={controlHover}
                animate={{ boxShadow: controlFocusRing('sort-mode') }}
                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              >
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as DokuSortMode)}
                  onFocus={() => setActiveControl('sort-mode')}
                  onBlur={() => setActiveControl((current) => (current === 'sort-mode' ? null : current))}
                  className={cn(taleaInputClass, 'cursor-pointer appearance-none pr-10')}
                  aria-label="Sortierung"
                >
                  <option value="newest">Neueste zuerst</option>
                  <option value="oldest">Aelteste zuerst</option>
                  <option value="title">Titel A-Z</option>
                </select>
                <motion.div
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--talea-text-muted)]"
                  animate={activeControl === 'sort-mode' && !reduceMotion ? { y: 1, scale: 1.08 } : { y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 24 }}
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.div>
              </motion.div>

              <TaleaActionButton
                type="button"
                variant="secondary"
                onClick={() => {
                  setSearchQuery('');
                  setSortMode('newest');
                  setTopicFilter('all');
                  setAgeGroupFilter('all');
                  setDepthFilter('all');
                  setAudioScopeFilter('all');
                }}
                className="h-11 w-full justify-center"
              >
                Filter zuruecksetzen
              </TaleaActionButton>
            </div>
          </header>

          {isInitialLoading ? (
            <SectionLoading palette={palette} />
          ) : (
            <>
              {activeTab === 'mine' && (
                <section>
                  <SectionHeader
                    icon={<GraduationCap className="h-4 w-4" />}
                    title={t('doku.myDokus', 'Meine Dokus')}
                    subtitle={t('doku.myDokusSubtitle', 'Deine persoenlichen Wissensartikel')}
                    count={totalMy}
                    palette={palette}
                  />

                  {loadingMy ? (
                    <SectionLoading palette={palette} />
                  ) : filteredMyDokus.length === 0 ? (
                    <div className="rounded-2xl border p-8 text-center" style={{ borderColor: palette.border, background: palette.panel }}>
                      <p className="text-sm" style={{ color: palette.muted }}>
                        {query ? 'Keine Doku passt zum Suchbegriff.' : t('doku.noDokus', 'Noch keine Dokus')}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {filteredMyDokus.map((doku) => (
                        <DokuCard
                          key={doku.id}
                          doku={doku}
                          onRead={(item) => navigate(`/doku-reader/${item.id}`)}
                          onDelete={handleDeleteDoku}
                          onTogglePublic={handleTogglePublic}
                        />
                      ))}
                    </div>
                  )}

                  {hasMoreMy && !query && (
                    <div ref={myObserverRef} className="mt-4 h-4 text-center text-xs" style={{ color: palette.muted }}>
                      {loadingMoreMy ? 'Weitere Dokus werden geladen...' : null}
                    </div>
                  )}
                </section>
              )}

              {activeTab === 'discover' && (
                <section>
                  <SectionHeader
                    icon={<Globe className="h-4 w-4" />}
                    title="Entdecken"
                    subtitle="Geteilte Dokus aus der Community"
                    count={totalPublic}
                    palette={palette}
                  />

                  {loadingPublic ? (
                    <SectionLoading palette={palette} />
                  ) : publicAccessMessage ? (
                    <div
                      className="rounded-2xl border p-6 text-center text-sm"
                      style={{
                        borderColor: 'var(--talea-danger-border)',
                        background: 'var(--talea-danger-soft)',
                        color: 'var(--talea-danger)',
                      }}
                    >
                      {publicAccessMessage}
                    </div>
                  ) : filteredPublicDokus.length === 0 ? (
                    <div className="rounded-2xl border p-8 text-center" style={{ borderColor: palette.border, background: palette.panel }}>
                      <p className="text-sm" style={{ color: palette.muted }}>
                        {query ? 'Keine Entdecken-Doku passt zum Suchbegriff.' : t('doku.noPublicDokus', 'Keine oeffentlichen Artikel')}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {filteredPublicDokus.map((doku) => (
                        <DokuCard key={doku.id} doku={doku} onRead={(item) => navigate(`/doku-reader/${item.id}`)} />
                      ))}
                    </div>
                  )}

                  {hasMorePublic && !publicAccessMessage && !query && (
                    <div ref={publicObserverRef} className="mt-4 h-4 text-center text-xs" style={{ color: palette.muted }}>
                      {loadingMorePublic ? 'Weitere Entdecken-Dokus werden geladen...' : null}
                    </div>
                  )}
                </section>
              )}

              {activeTab === 'audio' && (
                <section>
                  <SectionHeader
                    icon={<Headphones className="h-4 w-4" />}
                    title="Hoerwelt"
                    subtitle="Dokus zum Anhoeren"
                    count={totalAudio}
                    palette={palette}
                    actionLabel={isAdmin ? t('doku.audioCreateButton', 'Audio erstellen') : undefined}
                    onAction={isAdmin ? () => navigate('/createaudiodoku') : undefined}
                  />

                  {loadingAudio ? (
                    <SectionLoading palette={palette} />
                  ) : audioAccessMessage ? (
                    <div
                      className="rounded-2xl border p-6 text-center text-sm"
                      style={{
                        borderColor: 'var(--talea-danger-border)',
                        background: 'var(--talea-danger-soft)',
                        color: 'var(--talea-danger)',
                      }}
                    >
                      {audioAccessMessage}
                    </div>
                  ) : filteredAudioDokus.length === 0 ? (
                    <div className="rounded-2xl border p-8 text-center" style={{ borderColor: palette.border, background: palette.panel }}>
                      <p className="text-sm" style={{ color: palette.muted }}>
                        {query ? 'Keine Audio-Doku passt zum Suchbegriff.' : t('doku.noAudioDokus', 'Noch keine Audio-Dokus')}
                      </p>
                    </div>
                  ) : (
                    <>
                      {filteredAudioDokus.length > 1 && (
                        <div className="mb-4 flex justify-end">
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={handlePlayAllAudioDokus}
                            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-sm transition-colors"
                            style={{ borderColor: palette.border, background: palette.panel, color: palette.text }}
                          >
                            <PlayCircle className="h-4 w-4" />
                            Alle abspielen
                          </motion.button>
                        </div>
                      )}
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {filteredAudioDokus.map((doku, i) => (
                          <AudioDokuCard
                            key={doku.id}
                            doku={doku}
                            index={i}
                            onPlay={() => setAudioModal(doku)}
                            onAddToQueue={() => handleAddAudioToQueue(doku)}
                            palette={palette}
                            isAdmin={isAdmin}
                            onEdit={() => handleEditAudioDoku(doku)}
                            onDelete={() => handleDeleteAudioDoku(doku)}
                            canSaveOffline={canUseOffline}
                            isSavedOffline={isAudioDokuSaved(doku.id)}
                            isSavingOffline={isSaving(doku.id)}
                            onToggleOffline={() => toggleAudioDoku(doku)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </section>
              )}
            </>
          )}
        </div>

        <AnimatePresence>
          {audioModal && (
            <AudioModal
              doku={audioModal}
              onClose={() => setAudioModal(null)}
              onPlay={() => handlePlayAudio(audioModal)}
              isPlaying={audioPlayer.track?.id === audioModal.id}
              audioError={audioError}
              palette={palette}
            />
          )}
        </AnimatePresence>
      </SignedIn>
    </div>
  );
};

export default TaleaDokusScreen;
