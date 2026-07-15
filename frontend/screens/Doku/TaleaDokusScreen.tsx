import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  ChevronDown,
  Filter,
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
  SlidersHorizontal,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

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
import { cn } from '@/lib/utils';
import {
  TaleaActionButton,
  TaleaPageBackground,
  taleaBodyFont,
  taleaDisplayFont,
  taleaInputClass,
  taleaPageShellClass,
} from '@/components/talea/TaleaPastelPrimitives';

type Palette = {
  pageGradient: string;
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
const AUDIO_DOKU_LIST_PAGE_SIZE = 100;
type TranslateFn = TFunction;

// Tab-Theme: jeder Tab hat einen eigenen Akzentcolor für klare visuelle Trennung
type TabTheme = {
  key: DokuTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string; // CSS color expression
  accentSoft: string;
  emoji: string;
};

function normalizeFilterValue(value: unknown): string {
  if (typeof value !== 'string') return '';
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

function translateWithFallback(t: TranslateFn, key: string, fallback: string): string {
  const translated = t(key, { defaultValue: fallback });
  return typeof translated === 'string' ? translated : fallback;
}

function formatDokuDepthLabel(depth: string, t: TranslateFn): string {
  if (depth === 'basic') return translateWithFallback(t, 'doku.depthBasic', 'Basis');
  if (depth === 'standard') return translateWithFallback(t, 'doku.depthStandard', 'Standard');
  if (depth === 'deep') return translateWithFallback(t, 'doku.depthDeep', 'Tief');
  return depth || translateWithFallback(t, 'doku.depthUnknown', 'Unbekannt');
}

function formatTopicLabel(topic: string, unknownFallback = 'Unbekannt'): string {
  if (!topic) return unknownFallback;
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

// ────────────────────────────────────────────────────────────────────────────────
// Audio Doku Card (aspect-square, klar als Audio erkennbar)
// ────────────────────────────────────────────────────────────────────────────────
const ICON_BTN =
  'inline-flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition-all hover:scale-105 active:scale-95';

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
}) => {
  const { t } = useTranslation();

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.025, 0.4), duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      onClick={onPlay}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onPlay();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Audio-Doku: ${doku.title}`}
      className="group w-full cursor-pointer overflow-hidden rounded-[1.75rem] border text-left outline-none transition-all duration-300 hover:shadow-[0_24px_48px_rgba(33,44,62,0.18)] focus-visible:ring-4 focus-visible:ring-[var(--talea-accent-lavender)]/30"
      style={{
        borderColor: palette.border,
        background: palette.panel,
        boxShadow: '0 10px 24px rgba(33,44,62,0.10)',
      }}
    >
      {/* Square cover, kein Crop */}
      <div
        className="relative aspect-square w-full overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--talea-accent-lavender) 26%, var(--talea-surface-inset)) 0%, var(--talea-surface-inset) 55%, color-mix(in srgb, var(--talea-accent-rose) 18%, var(--talea-surface-inset)) 100%)',
        }}
      >
        {/* Blurred background fill — als <img>, damit lazy loading greift */}
        {doku.coverImageUrl && (
          <img
            src={doku.coverImageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-65 blur-2xl"
            aria-hidden
          />
        )}

        {/* Foreground cover - voll sichtbar */}
        <div className="absolute inset-0 flex items-center justify-center p-3">
          <div className="relative h-full w-full overflow-hidden rounded-[1.25rem] shadow-[0_14px_30px_rgba(0,0,0,0.18)]">
            <ProgressiveImage
              src={doku.coverImageUrl}
              alt={doku.title}
              revealDelayMs={index * 30}
              containerClassName="h-full w-full"
              imageClassName="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
              skeletonClassName="bg-[var(--talea-media-skeleton)]"
              fallback={
                <div className="flex h-full w-full items-center justify-center bg-white/40">
                  <Headphones className="h-12 w-12" style={{ color: palette.muted }} />
                </div>
              }
            />

            {/* Waveform-Andeutung am unteren Rand des Bildes */}
            <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-center gap-0.5 opacity-80">
              {[3, 5, 7, 4, 8, 6, 9, 5, 7, 4, 6, 8, 5, 4, 6].map((h, i) => (
                <motion.span
                  key={i}
                  initial={{ scaleY: 0.4 }}
                  animate={{ scaleY: [0.4, 1, 0.5, 0.8, 0.4] }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    delay: i * 0.06,
                    ease: 'easeInOut',
                  }}
                  className="block w-[2px] origin-bottom rounded-full bg-white/85"
                  style={{ height: `${h * 2}px` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* AUDIO-Badge mit Lavender-Akzent */}
        <div className="absolute left-3 top-3 z-10">
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] backdrop-blur-md"
            style={{
              borderColor: 'color-mix(in srgb, var(--talea-accent-lavender) 60%, white)',
              background: 'color-mix(in srgb, var(--talea-accent-lavender) 88%, transparent)',
              color: 'white',
            }}
          >
            <Mic className="h-3 w-3" />
            Audio
          </span>
        </div>

        {/* Action icons */}
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
          {canSaveOffline && onToggleOffline && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleOffline();
              }}
              disabled={isSavingOffline}
              className={ICON_BTN}
              style={{
                borderColor: 'var(--talea-media-chrome-border)',
                background: 'var(--talea-media-chrome-bg)',
                color: 'var(--talea-media-foreground)',
              }}
              aria-label={
                isSavedOffline
                  ? t('doku.removeOffline', 'Offline-Speicherung entfernen')
                  : t('doku.saveOffline', 'Offline speichern')
              }
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
              className={ICON_BTN}
              style={{
                borderColor: 'var(--talea-media-chrome-border)',
                background: 'var(--talea-media-chrome-bg)',
                color: 'var(--talea-media-foreground)',
              }}
              aria-label={t('doku.editAudioDoku', 'Audio-Doku bearbeiten')}
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
              className={ICON_BTN}
              style={{
                borderColor: 'var(--talea-danger-border)',
                background: 'color-mix(in srgb, var(--talea-danger-soft) 90%, transparent)',
                color: 'var(--talea-danger)',
              }}
              aria-label={t('doku.deleteAudioDoku', 'Audio-Doku löschen')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Big Play button on hover */}
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <motion.div
            initial={{ scale: 0.85 }}
            whileHover={{ scale: 1 }}
            className="inline-flex h-16 w-16 items-center justify-center rounded-full border-2 shadow-[0_18px_40px_rgba(0,0,0,0.3)]"
            style={{
              borderColor: 'rgba(255,255,255,0.6)',
              background: 'color-mix(in srgb, var(--talea-accent-lavender) 90%, transparent)',
              color: 'white',
            }}
          >
            <Play className="h-6 w-6 translate-x-[2px]" fill="currentColor" />
          </motion.div>

          {onAddToQueue && (
            <button
              type="button"
              className="pointer-events-auto absolute bottom-4 right-4 inline-flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition-transform hover:scale-110"
              onClick={(e) => {
                e.stopPropagation();
                onAddToQueue();
              }}
              style={{
                borderColor: 'var(--talea-media-control-border)',
                background: 'var(--talea-media-control-bg)',
                color: 'var(--talea-media-foreground)',
              }}
              title={t('doku.addToQueue', 'Zur Warteschlange')}
              aria-label={t('doku.addToQueue', 'Zur Warteschlange hinzufügen')}
            >
              <ListPlus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="space-y-2.5 p-4">
        <h4
          className="line-clamp-2 text-base font-semibold leading-snug"
          style={{ color: palette.text, fontFamily: headingFont }}
        >
          {doku.title}
        </h4>
        <p className="line-clamp-2 text-xs leading-relaxed" style={{ color: palette.muted }}>
          {doku.description}
        </p>
        {(doku.ageGroup || doku.category) && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {doku.ageGroup && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  background: 'color-mix(in srgb, var(--talea-accent-lavender) 14%, var(--talea-surface-inset))',
                  color: palette.text,
                }}
              >
                Alter {doku.ageGroup}
              </span>
            )}
            {doku.category && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ background: palette.soft, color: palette.muted }}
              >
                {doku.category}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.article>
  );
};

// ────────────────────────────────────────────────────────────────────────────────
// Audio Modal
// ────────────────────────────────────────────────────────────────────────────────
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
        <div
          className="relative aspect-square w-full overflow-hidden"
          style={{
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--talea-accent-lavender) 32%, var(--talea-surface-inset)) 0%, var(--talea-surface-inset) 70%)',
          }}
        >
          {doku.coverImageUrl && (
            <div
              className="absolute inset-0 scale-110 opacity-60 blur-2xl"
              style={{
                backgroundImage: `url(${doku.coverImageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
              aria-hidden
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center p-4">
            {doku.coverImageUrl ? (
              <img
                src={doku.coverImageUrl}
                alt={doku.title}
                className="h-full w-full rounded-2xl object-cover shadow-2xl"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Headphones className="h-16 w-16" style={{ color: palette.muted }} />
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="absolute right-3 top-3 z-10 rounded-full border p-2 backdrop-blur-md"
            style={{
              borderColor: 'var(--talea-media-chrome-border)',
              background: 'var(--talea-media-chrome-bg)',
              color: 'var(--talea-media-foreground)',
            }}
            aria-label={t('doku.closeModal', 'Audio Modal schließen')}
          >
            <X className="h-4 w-4" />
          </button>

          <div className="absolute left-3 top-3 z-10">
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] backdrop-blur-md"
              style={{
                borderColor: 'color-mix(in srgb, var(--talea-accent-lavender) 60%, white)',
                background: 'color-mix(in srgb, var(--talea-accent-lavender) 88%, transparent)',
                color: 'white',
              }}
            >
              <Mic className="h-3 w-3" />
              Audio
            </span>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <h3 className="text-xl font-semibold" style={{ color: palette.text, fontFamily: headingFont }}>
            {doku.title}
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: palette.muted }}>
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-md transition-transform hover:scale-[1.02]"
                style={{
                  borderColor: 'transparent',
                  background:
                    'linear-gradient(135deg, var(--talea-accent-lavender) 0%, color-mix(in srgb, var(--talea-accent-rose) 70%, white) 100%)',
                  color: 'white',
                }}
              >
                <Play className="h-4 w-4" fill="currentColor" />
                {t('doku.audioPlay', 'Abspielen')}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ────────────────────────────────────────────────────────────────────────────────
// Skeleton
// ────────────────────────────────────────────────────────────────────────────────
const SectionLoading: React.FC<{ palette: Palette }> = ({ palette }) => (
  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {Array.from({ length: 8 }).map((_, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: i * 0.04 }}
        className="overflow-hidden rounded-[1.75rem] border"
        style={{ borderColor: palette.border, background: palette.panel }}
      >
        <div className="relative aspect-square w-full animate-pulse overflow-hidden" style={{ background: palette.soft }}>
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

// ────────────────────────────────────────────────────────────────────────────────
// Main Screen
// ────────────────────────────────────────────────────────────────────────────────
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
  const [activeTab, setActiveTab] = useState<DokuTab>(
    searchParams.get('mode') === 'audio' ? 'audio' : 'mine'
  );
  const [sortMode, setSortMode] = useState<DokuSortMode>('newest');
  const [topicFilter, setTopicFilter] = useState('all');
  const [ageGroupFilter, setAgeGroupFilter] = useState('all');
  const [depthFilter, setDepthFilter] = useState('all');
  const [audioScopeFilter, setAudioScopeFilter] = useState<AudioScope>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

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
        limit: 12,
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
      setPublicAccessMessage(
        getErrorMessage(error, t('doku.publicAccessError', 'Entdecken-Inhalte sind in deinem aktuellen Plan nicht verfügbar.'))
      );
    } finally {
      setLoadingPublic(false);
    }
  };

  const loadAudioDokus = async () => {
    try {
      setLoadingAudio(true);
      setAudioAccessMessage(null);

      const allAudioDokus: AudioDoku[] = [];
      let offset = 0;
      let total = 0;

      while (true) {
        const res = await backend.doku.listAudioDokus({
          limit: AUDIO_DOKU_LIST_PAGE_SIZE,
          offset,
          profileId: activeProfileId || undefined,
        });
        const page = (res.audioDokus || []) as any[];
        allAudioDokus.push(...page);
        total = res.total ?? allAudioDokus.length;
        if (!res.hasMore || page.length === 0) break;
        offset += page.length;
      }

      setAudioDokus(allAudioDokus);
      setTotalAudio(total);
    } catch (error) {
      console.error(error);
      setAudioDokus([]);
      setTotalAudio(0);
      setAudioAccessMessage(
        getErrorMessage(error, t('doku.audioAccessError', 'Audio-Dokus sind in deinem aktuellen Plan nicht verfügbar.'))
      );
    } finally {
      setLoadingAudio(false);
    }
  };

  const loadMoreMy = useCallback(async () => {
    if (loadingMoreMy || !hasMoreMy) return;
    try {
      setLoadingMoreMy(true);
      const res = await backend.doku.listDokus({
        limit: 12,
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
    if (!window.confirm(`${t('common.delete', 'Löschen')} "${dokuTitle}"?`)) return;
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
      setAudioError(t('doku.noAudioFile', 'Keine Audio-Datei verfügbar'));
      return;
    }
    const itemId = `audiodoku-${doku.id}`;
    const existingIdx = audioPlayer.playlist.findIndex((i) => i.id === itemId);
    if (existingIdx >= 0) {
      audioPlayer.playFromPlaylist(existingIdx);
    } else {
      audioPlayer.addAndPlay([
        {
          id: itemId,
          trackId: doku.id,
          title: doku.title,
          description: doku.description,
          coverImageUrl: doku.coverImageUrl,
          type: 'audio-doku',
          audioUrl: doku.audioUrl,
          conversionStatus: 'ready',
        },
      ]);
    }
  };

  const handleAddAudioToQueue = (doku: AudioDoku) => {
    if (!doku.audioUrl) return;
    audioPlayer.addToPlaylist([
      {
        id: `audiodoku-${doku.id}`,
        trackId: doku.id,
        title: doku.title,
        description: doku.description,
        coverImageUrl: doku.coverImageUrl,
        type: 'audio-doku',
        audioUrl: doku.audioUrl,
        conversionStatus: 'ready',
      },
    ]);
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
    if (!window.confirm(`${t('common.delete', 'Löschen')} "${doku.title}"?`)) return;
    try {
      await backend.doku.deleteAudioDoku({ id: doku.id });
      setAudioDokus((prev) => prev.filter((item) => item.id !== doku.id));
      setTotalAudio((prev) => Math.max(0, prev - 1));
      if (audioModal?.id === doku.id) setAudioModal(null);
    } catch (error) {
      console.error(error);
      alert(t('errors.generic', 'Fehler beim Löschen.'));
    }
  };

  const query = searchQuery.trim().toLowerCase();

  const sortDokus = useCallback(
    (items: Doku[]) => {
      const sorted = [...items];
      if (sortMode === 'title') return sorted.sort((a, b) => a.title.localeCompare(b.title, 'de'));
      if (sortMode === 'oldest')
        return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    [sortMode]
  );

  const sortAudioDokus = useCallback(
    (items: AudioDoku[]) => {
      const sorted = [...items];
      if (sortMode === 'title') return sorted.sort((a, b) => a.title.localeCompare(b.title, 'de'));
      if (sortMode === 'oldest')
        return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

  const hasActiveFilters =
    topicFilter !== 'all' ||
    ageGroupFilter !== 'all' ||
    depthFilter !== 'all' ||
    audioScopeFilter !== 'all' ||
    sortMode !== 'newest';

  const tabThemes: TabTheme[] = [
    {
      key: 'mine',
      label: t('doku.tabMine', 'Meine'),
      icon: GraduationCap,
      accent: 'var(--primary)',
      accentSoft: 'color-mix(in srgb, var(--primary) 20%, transparent)',
      emoji: '✨',
    },
    {
      key: 'discover',
      label: t('doku.tabDiscover', 'Entdecken'),
      icon: Globe,
      accent: 'var(--talea-accent-sky)',
      accentSoft: 'color-mix(in srgb, var(--talea-accent-sky) 20%, transparent)',
      emoji: '🌍',
    },
    {
      key: 'audio',
      label: t('doku.tabAudio', 'Hörwelt'),
      icon: Headphones,
      accent: 'var(--talea-accent-lavender)',
      accentSoft: 'color-mix(in srgb, var(--talea-accent-lavender) 20%, transparent)',
      emoji: '🎧',
    },
  ];

  const counts: Record<DokuTab, number> = {
    mine: totalMy,
    discover: totalPublic,
    audio: totalAudio,
  };

  return (
    <div className="relative min-h-screen pb-28" style={{ color: palette.text, fontFamily: bodyFont }}>
      <DokuBackground isDark={isDark} />

      <SignedOut>
        <div className={cn(taleaPageShellClass, 'flex min-h-[68vh] items-center justify-center py-10')}>
          <div className="w-full max-w-2xl rounded-3xl border bg-[var(--talea-surface-primary)] p-8 text-center shadow-lg" style={{ borderColor: palette.border }}>
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
        <div className={cn(taleaPageShellClass, 'relative z-10 space-y-6 pt-4')}>
          {/* Header */}
          <motion.header
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
          >
            <div className="min-w-0">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{
                  borderColor: palette.border,
                  background: 'var(--talea-surface-inset)',
                  color: palette.muted,
                }}
              >
                <BookOpen className="h-3 w-3" />
                Wissen entdecken
              </span>
              <h1
                className="mt-2 text-[2.4rem] font-semibold leading-[0.98] sm:text-[2.8rem]"
                style={{ fontFamily: headingFont, color: palette.text }}
              >
                Dokus
              </h1>
              <p className="mt-1 text-sm" style={{ color: palette.muted }}>
                {t('doku.subtitle', 'Entdecke spannende Wissensartikel und Audio-Geschichten')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <TaleaActionButton
                type="button"
                onClick={() => navigate('/doku/create')}
                icon={<Wand2 className="h-4 w-4" />}
              >
                {t('doku.createNew', 'Neue Doku')}
              </TaleaActionButton>
              {isAdmin ? (
                <TaleaActionButton
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/createaudiodoku')}
                  icon={<Headphones className="h-4 w-4" />}
                >
                  Audio-Doku
                </TaleaActionButton>
              ) : null}
            </div>
          </motion.header>

          {/* Segmented Tab Control */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-[1.5rem] border p-1.5 shadow-[0_8px_24px_rgba(33,44,62,0.08)]"
            style={{
              borderColor: palette.border,
              background: 'var(--talea-surface-primary)',
            }}
          >
            <div className="grid grid-cols-3 gap-1">
              {tabThemes.map((tab) => {
                const active = activeTab === tab.key;
                const Icon = tab.icon;
                return (
                  <motion.button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    whileHover={reduceMotion ? undefined : { scale: 1.01 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                    className="relative flex items-center justify-center gap-2 rounded-[1.1rem] px-3 py-3 text-sm font-semibold transition-colors sm:gap-2.5 sm:px-4"
                    style={{ color: active ? 'white' : palette.muted }}
                    aria-pressed={active}
                  >
                    {active && (
                      <motion.div
                        layoutId="doku-active-tab-pill"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        className="absolute inset-0 rounded-[1.1rem] shadow-[0_8px_20px_rgba(33,44,62,0.18)]"
                        style={{
                          background: `linear-gradient(135deg, ${tab.accent} 0%, color-mix(in srgb, ${tab.accent} 70%, white) 100%)`,
                        }}
                      />
                    )}
                    <Icon className="relative z-10 h-4 w-4 shrink-0" />
                    <span className="relative z-10 hidden truncate sm:inline">{tab.label}</span>
                    <span className="relative z-10 inline truncate sm:hidden">{tab.label}</span>
                    <span
                      className={cn(
                        'relative z-10 inline-flex h-5 min-w-[1.4rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                        active ? 'bg-white/25 text-white' : ''
                      )}
                      style={
                        !active
                          ? {
                              background: 'var(--talea-surface-inset)',
                              color: palette.muted,
                            }
                          : undefined
                      }
                    >
                      {counts[tab.key]}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* Filter Bar - kompakt */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {/* Search */}
              <label className="relative flex-1 min-w-0">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--talea-text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeTab === 'audio'
                      ? t('doku.searchPlaceholderAudio', 'Audio durchsuchen...')
                      : t('doku.searchPlaceholderText', 'Dokus durchsuchen...')
                  }
                  className={cn(taleaInputClass, 'pl-10 pr-10')}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--talea-text-muted)] hover:bg-[var(--talea-surface-inset)]"
                    aria-label="Suche löschen"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </label>

              {/* Sort dropdown */}
              <div className="relative">
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as DokuSortMode)}
                  className={cn(taleaInputClass, 'cursor-pointer appearance-none pl-10 pr-10 sm:w-52')}
                  aria-label={t('common.sort', 'Sortierung')}
                >
                  <option value="newest">{t('doku.sortNewest', 'Neueste zuerst')}</option>
                  <option value="oldest">{t('doku.sortOldest', 'Älteste zuerst')}</option>
                  <option value="title">{t('doku.sortTitle', 'Titel A-Z')}</option>
                </select>
                <SlidersHorizontal className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--talea-text-muted)]" />
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--talea-text-muted)]" />
              </div>

              {/* Filter toggle button */}
              <motion.button
                type="button"
                onClick={() => setShowAdvancedFilters((v) => !v)}
                whileHover={reduceMotion ? undefined : { y: -1 }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                className={cn(
                  'inline-flex h-11 items-center justify-center gap-2 rounded-[1.1rem] border px-4 text-sm font-semibold transition-all',
                  showAdvancedFilters || hasActiveFilters
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                    : 'border-[var(--talea-border-soft)] bg-white/80 text-[var(--talea-text-primary)] dark:bg-[var(--talea-surface-inset)]'
                )}
              >
                <Filter className="h-4 w-4" />
                Filter
                {hasActiveFilters && (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] font-bold text-white">
                    !
                  </span>
                )}
              </motion.button>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSortMode('newest');
                    setTopicFilter('all');
                    setAgeGroupFilter('all');
                    setDepthFilter('all');
                    setAudioScopeFilter('all');
                  }}
                  className="inline-flex h-11 items-center justify-center gap-1 rounded-[1.1rem] px-3 text-xs font-semibold text-[var(--talea-text-muted)] hover:text-[var(--talea-text-primary)]"
                >
                  <X className="h-3.5 w-3.5" />
                  Zurücksetzen
                </button>
              )}
            </div>

            {/* Advanced filters panel */}
            <AnimatePresence initial={false}>
              {showAdvancedFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div
                    className="rounded-[1.4rem] border p-4"
                    style={{ borderColor: palette.border, background: 'var(--talea-surface-inset)' }}
                  >
                    {activeTab !== 'audio' ? (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <FilterSelect
                          label={t('doku.filterTopic', 'Thema')}
                          value={topicFilter}
                          onChange={setTopicFilter}
                          options={[
                            { value: 'all', label: t('doku.filterAllTopics', 'Alle Themen') },
                            ...topicFilterOptions.map((topic) => ({
                              value: topic,
                              label: formatTopicLabel(topic, t('doku.topicUnknown', 'Unbekannt')),
                            })),
                          ]}
                        />
                        <FilterSelect
                          label={t('doku.filterAge', 'Alter')}
                          value={ageGroupFilter}
                          onChange={setAgeGroupFilter}
                          options={[
                            { value: 'all', label: t('doku.filterAllAges', 'Alle Altersgruppen') },
                            ...ageGroupFilterOptions.map((ageGroup) => ({ value: ageGroup, label: ageGroup })),
                          ]}
                        />
                        <FilterSelect
                          label={t('doku.filterDepth', 'Tiefe')}
                          value={depthFilter}
                          onChange={setDepthFilter}
                          options={[
                            { value: 'all', label: t('doku.filterAllDepths', 'Alle Tiefen') },
                            ...depthFilterOptions.map((depth) => ({
                              value: depth,
                              label: formatDokuDepthLabel(depth, t),
                            })),
                          ]}
                        />
                      </div>
                    ) : (
                      <FilterSelect
                        label={t('doku.filterAudioScope', 'Bereich')}
                        value={audioScopeFilter}
                        onChange={(v) => setAudioScopeFilter(v as AudioScope)}
                        options={[
                          { value: 'all', label: t('doku.filterAllAudio', 'Alle Audio') },
                          { value: 'mine', label: t('doku.filterMyAudio', 'Meine Audio') },
                          { value: 'public', label: t('doku.filterPublicAudio', 'Öffentliche Audio') },
                        ]}
                      />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              {isInitialLoading ? (
                <SectionLoading palette={palette} />
              ) : (
                <>
                  {activeTab === 'mine' && (
                    <section>
                      {filteredMyDokus.length === 0 ? (
                        <EmptyState
                          palette={palette}
                          message={
                            query
                              ? t('doku.noDokusQuery', 'Keine Doku passt zum Suchbegriff.')
                              : t('doku.noDokus', 'Noch keine Dokus')
                          }
                          actionLabel={!query ? t('doku.createNew', 'Neue Doku') : undefined}
                          onAction={!query ? () => navigate('/doku/create') : undefined}
                        />
                      ) : (
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {filteredMyDokus.map((doku, index) => (
                            <DokuCard
                              key={doku.id}
                              doku={doku}
                              imageLoading={index < 4 ? 'eager' : 'lazy'}
                              onRead={(item) => navigate(`/doku-reader/${item.id}`)}
                              onDelete={handleDeleteDoku}
                              onTogglePublic={handleTogglePublic}
                            />
                          ))}
                        </div>
                      )}

                      {hasMoreMy && !query && (
                        <div ref={myObserverRef} className="mt-6 h-4 text-center text-xs" style={{ color: palette.muted }}>
                          {loadingMoreMy ? t('doku.loadingMore', 'Weitere Dokus werden geladen...') : null}
                        </div>
                      )}
                    </section>
                  )}

                  {activeTab === 'discover' && (
                    <section>
                      {publicAccessMessage ? (
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
                        <EmptyState
                          palette={palette}
                          message={
                            query
                              ? t('doku.noPublicDokusQuery', 'Keine Entdecken-Doku passt zum Suchbegriff.')
                              : t('doku.noPublicDokus', 'Noch keine öffentlichen Dokus')
                          }
                        />
                      ) : (
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {filteredPublicDokus.map((doku, index) => (
                            <DokuCard key={doku.id} doku={doku} imageLoading={index < 4 ? 'eager' : 'lazy'} onRead={(item) => navigate(`/doku-reader/${item.id}`)} />
                          ))}
                        </div>
                      )}

                      {hasMorePublic && !publicAccessMessage && !query && (
                        <div
                          ref={publicObserverRef}
                          className="mt-6 h-4 text-center text-xs"
                          style={{ color: palette.muted }}
                        >
                          {loadingMorePublic
                            ? t('doku.loadingMorePublic', 'Weitere Entdecken-Dokus werden geladen...')
                            : null}
                        </div>
                      )}
                    </section>
                  )}

                  {activeTab === 'audio' && (
                    <section>
                      {audioAccessMessage ? (
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
                        <EmptyState
                          palette={palette}
                          message={
                            query
                              ? t('doku.noAudioDokusQuery', 'Keine Audio-Doku passt zum Suchbegriff.')
                              : t('doku.noAudioDokus', 'Noch keine Audio-Dokus verfügbar')
                          }
                          actionLabel={isAdmin && !query ? t('doku.audioCreateButton', 'Audio-Doku erstellen') : undefined}
                          onAction={isAdmin && !query ? () => navigate('/createaudiodoku') : undefined}
                        />
                      ) : (
                        <>
                          {filteredAudioDokus.length > 1 && (
                            <div className="mb-4 flex justify-end">
                              <motion.button
                                whileHover={reduceMotion ? undefined : { scale: 1.02, y: -1 }}
                                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                                onClick={handlePlayAllAudioDokus}
                                className="inline-flex items-center gap-2 rounded-full border-0 px-4 py-2 text-xs font-semibold text-white shadow-md"
                                style={{
                                  background:
                                    'linear-gradient(135deg, var(--talea-accent-lavender) 0%, color-mix(in srgb, var(--talea-accent-rose) 70%, white) 100%)',
                                }}
                              >
                                <PlayCircle className="h-4 w-4" fill="currentColor" />
                                {t('doku.audioPlayAll', 'Alle abspielen')}
                              </motion.button>
                            </div>
                          )}
                          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
            </motion.div>
          </AnimatePresence>
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

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────
const FilterSelect: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}> = ({ label, value, onChange, options }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--talea-text-muted)]">
      {label}
    </label>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(taleaInputClass, 'cursor-pointer appearance-none pr-10')}
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--talea-text-muted)]" />
    </div>
  </div>
);

const EmptyState: React.FC<{
  palette: Palette;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ palette, message, actionLabel, onAction }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.96 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.3 }}
    className="flex flex-col items-center justify-center gap-4 rounded-[1.75rem] border p-12 text-center"
    style={{ borderColor: palette.border, background: palette.panel }}
  >
    <div
      className="flex h-16 w-16 items-center justify-center rounded-2xl"
      style={{ background: 'color-mix(in srgb, var(--primary) 14%, var(--talea-surface-inset))' }}
    >
      <BookOpen className="h-7 w-7" style={{ color: 'var(--primary)' }} />
    </div>
    <p className="max-w-md text-sm" style={{ color: palette.muted }}>
      {message}
    </p>
    {actionLabel && onAction && (
      <TaleaActionButton type="button" onClick={onAction} icon={<Plus className="h-4 w-4" />}>
        {actionLabel}
      </TaleaActionButton>
    )}
  </motion.div>
);

export default TaleaDokusScreen;
