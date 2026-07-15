import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  BookOpen,
  Brain,
  ChevronUp,
  FlaskConical,
  Home,
  ListMusic,
  Loader2,
  Play,
  Pause,
  User,
  Volume2,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { PlaylistDrawer } from '@/components/audio/PlaylistDrawer';
import { WaveformEqualizer } from '@/components/audio/WaveformEqualizer';
import { AudioPlaybackControls } from '@/components/audio/AudioPlaybackControls';

interface NavItem {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  path?: string;
  labelKey?: string;
  label?: string;
  onClick?: () => void;
}

const NAV_ITEMS: NavItem[] = [
  { icon: Home, labelKey: 'navigation.home', path: '/' },
  { icon: BookOpen, labelKey: 'navigation.stories', path: '/stories' },
  { icon: User, labelKey: 'navigation.avatars', path: '/avatar' },
  { icon: FlaskConical, label: 'Dokus', path: '/doku' },
  { icon: Brain, label: 'Quiz', path: '/quiz' },
  {
    icon: Bot,
    label: 'Tavi',
    onClick: () => {
      window.dispatchEvent(new Event('tavi:open'));
    },
  },
];

const BottomNav: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme } = useTheme();
  const {
    track,
    isPlaying,
    togglePlay,
    currentTime,
    duration,
    isPlaylistActive,
    playlist,
    currentIndex,
    togglePlaylistDrawer,
    isPlaylistDrawerOpen,
    waitingForConversion,
  } = useAudioPlayer();

  const [playerExpanded, setPlayerExpanded] = useState(false);
  const isDark = resolvedTheme === 'dark';
  const isVisible = Boolean(track) || waitingForConversion;
  const currentItem =
    currentIndex >= 0 && currentIndex < playlist.length ? playlist[currentIndex] : null;
  const nextItem = useMemo(
    () =>
      playlist
        .slice(currentIndex >= 0 ? currentIndex + 1 : 0)
        .find((item) => item.conversionStatus !== 'error') || null,
    [currentIndex, playlist],
  );
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const queueLabel =
    currentIndex >= 0 && playlist.length > 0 ? `${currentIndex + 1}/${playlist.length}` : null;
  const subtitle =
    currentItem?.parentStoryTitle ||
    currentItem?.parentDokuTitle ||
    track?.description ||
    'Talea Audio';

  useEffect(() => {
    if (!track && !waitingForConversion) {
      setPlayerExpanded(false);
    }
  }, [track, waitingForConversion]);

  const isActive = (path?: string) => {
    if (!path) return false;
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const labelOf = (item: NavItem) => item.label ?? (item.labelKey ? t(item.labelKey) : '');

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.path);

    return (
      <button
        key={item.path ?? item.label ?? item.labelKey ?? 'tavi'}
        type="button"
        onClick={() => (item.onClick ? item.onClick() : item.path ? navigate(item.path) : undefined)}
        className="relative flex flex-1 flex-col items-center gap-1 rounded-[1.2rem] px-1.5 py-2"
        aria-label={labelOf(item)}
      >
        {active ? (
          <motion.span
            layoutId="talea-mobile-active"
            className="absolute inset-0 rounded-[1.2rem] border border-[var(--talea-border-accent)] bg-[linear-gradient(135deg,rgba(255,255,255,0.76)_0%,rgba(231,239,232,0.88)_46%,rgba(227,235,247,0.82)_100%)] dark:bg-[linear-gradient(135deg,rgba(229,176,183,0.14)_0%,rgba(154,199,182,0.18)_46%,rgba(176,200,231,0.16)_100%)]"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        ) : null}

        <div
          className={cn(
            'relative flex h-9 w-9 items-center justify-center rounded-[0.95rem] border transition-colors duration-200',
            active
              ? 'border-white/70 bg-white/82 text-[var(--primary)] shadow-[0_8px_20px_rgba(91,72,59,0.08)] dark:border-white/10 dark:bg-white/6'
              : 'border-transparent bg-transparent text-[var(--talea-text-tertiary)]',
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>

        <span
          className={cn(
            'relative text-[9px] font-medium leading-none tracking-[0.04em] transition-colors duration-200',
            active ? 'font-semibold text-[var(--primary)]' : 'text-[var(--talea-text-tertiary)]',
          )}
        >
          {labelOf(item)}
        </span>
      </button>
    );
  };

  return (
    <>
      <AnimatePresence>{isPlaylistDrawerOpen ? <PlaylistDrawer variant="mobile" /> : null}</AnimatePresence>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] px-3 pb-2.5 md:hidden">
        <div
          className="pointer-events-auto overflow-hidden rounded-[2rem] border shadow-[var(--talea-shadow-medium)] backdrop-blur-2xl"
          style={{
            borderColor: 'var(--talea-border-light)',
            background: isDark ? 'rgba(19,27,37,0.92)' : 'rgba(255,251,247,0.92)',
          }}
        >
          <AnimatePresence initial={false}>
            {isVisible ? (
              <motion.div
                layout
                initial={{ y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 14, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                className="mx-2 mb-1 mt-2 overflow-hidden rounded-[1.5rem] border"
                style={{
                  borderColor: 'var(--talea-border-light)',
                  background:
                    'linear-gradient(180deg, color-mix(in srgb, var(--talea-surface-primary) 94%, white) 0%, color-mix(in srgb, var(--talea-surface-inset) 92%, transparent) 100%)',
                }}
              >
                {/* Header: div statt <button>, weil verschachtelte Buttons
                    (Play/Chevron im Header) invalides HTML sind und das
                    Ein-/Ausklappen unzuverlässig machten. */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setPlayerExpanded((value) => !value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setPlayerExpanded((value) => !value);
                    }
                  }}
                  className="w-full cursor-pointer select-none px-3 py-2.5 text-left"
                  aria-expanded={playerExpanded}
                  aria-label={playerExpanded ? 'Player einklappen' : 'Player ausklappen'}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[0.9rem] border border-white/10 bg-[var(--talea-surface-inset)]">
                      {waitingForConversion && !track ? (
                        <div className="flex h-full w-full items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" />
                        </div>
                      ) : currentItem?.coverImageUrl || track?.coverImageUrl ? (
                        <img
                          src={currentItem?.coverImageUrl || track?.coverImageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--talea-gradient-secondary)_0%,var(--talea-gradient-lavender)_100%)]">
                          <Volume2 className="h-4 w-4 text-[var(--talea-text-secondary)]" />
                        </div>
                      )}
                      {isPlaying ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/28">
                          <WaveformEqualizer isPlaying isWaiting={false} isDark={isDark} size="sm" />
                        </div>
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--talea-text-primary)]">
                        {waitingForConversion && !track ? 'Audio wird vorbereitet' : currentItem?.title || track?.title}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] font-medium text-[var(--talea-text-secondary)]">
                        {queueLabel ? (
                          <span className="shrink-0 rounded-full bg-[var(--talea-surface-inset)] px-1.5 py-px text-[9px] font-semibold text-[var(--talea-text-tertiary)]">
                            {queueLabel}
                          </span>
                        ) : null}
                        <span className="truncate">{subtitle}</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        togglePlay();
                      }}
                      disabled={waitingForConversion && !track}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-md disabled:opacity-50"
                      style={{
                        background:
                          'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--talea-accent-sky) 74%, white) 100%)',
                      }}
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                      {waitingForConversion && !track ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="ml-[1px] h-4 w-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setPlayerExpanded((value) => !value);
                      }}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
                      style={{
                        borderColor: 'var(--talea-border-soft)',
                        background: 'var(--talea-surface-primary)',
                        color: 'var(--talea-text-secondary)',
                      }}
                      aria-expanded={playerExpanded}
                      aria-label={playerExpanded ? 'Player einklappen' : 'Player ausklappen'}
                    >
                      <motion.span
                        animate={{ rotate: playerExpanded ? 180 : 0 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className="flex"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </motion.span>
                    </button>
                  </div>
                </div>

                <div className="h-[3px] overflow-hidden bg-[var(--talea-progress-track)]">
                  <motion.div
                    className="h-full rounded-full bg-[linear-gradient(90deg,var(--primary)_0%,var(--talea-accent-sky)_55%,var(--talea-accent-peach)_100%)]"
                    style={{ width: `${progress}%` }}
                    transition={{ ease: 'easeOut', duration: 0.2 }}
                  />
                </div>

                <AnimatePresence initial={false}>
                  {playerExpanded ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden border-t"
                      style={{ borderColor: 'var(--talea-border-light)' }}
                    >
                      <div className="space-y-4 px-4 pb-4 pt-3.5">
                        <AudioPlaybackControls
                          variant="streaming"
                          showClose
                          showNavigation={isPlaylistActive && playlist.length > 1}
                          onQueueClick={playlist.length > 0 ? togglePlaylistDrawer : undefined}
                        />

                        {nextItem ? (
                          <button
                            type="button"
                            onClick={togglePlaylistDrawer}
                            className="flex w-full items-center gap-3 rounded-[1.1rem] border px-3 py-2.5 text-left"
                            style={{
                              borderColor: 'var(--talea-border-light)',
                              background: 'var(--talea-surface-primary)',
                            }}
                          >
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[0.8rem] bg-[var(--talea-surface-inset)]">
                              {nextItem.coverImageUrl ? (
                                <img src={nextItem.coverImageUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <Volume2 className="h-4 w-4 text-[var(--talea-text-tertiary)]" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--talea-text-tertiary)]">
                                Als Nächstes
                              </p>
                              <p className="mt-0.5 truncate text-sm font-semibold text-[var(--talea-text-primary)]">
                                {nextItem.title}
                              </p>
                            </div>
                            <ListMusic className="h-4 w-4 shrink-0 text-[var(--talea-text-tertiary)]" />
                          </button>
                        ) : null}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <nav className={cn('px-2', isVisible ? 'pb-1 pt-0.5' : 'py-1.5')} aria-label="Mobile Navigation">
            <div className="flex items-center">{NAV_ITEMS.map(renderNavItem)}</div>
          </nav>
        </div>
      </div>
    </>
  );
};

export default BottomNav;
