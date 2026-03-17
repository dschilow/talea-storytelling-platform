import React, { useEffect, useMemo, useState } from "react";
import {
  Bot,
  BookOpen,
  Brain,
  FastForward,
  FlaskConical,
  Home,
  ListMusic,
  Loader2,
  Pause,
  Play,
  Rewind,
  SkipBack,
  SkipForward,
  User,
  Volume2,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { PlaylistDrawer } from "@/components/audio/PlaylistDrawer";
import { WaveformEqualizer } from "@/components/audio/WaveformEqualizer";

interface NavItem {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  path?: string;
  labelKey?: string;
  label?: string;
  onClick?: () => void;
}

const NAV_ITEMS: NavItem[] = [
  { icon: Home, labelKey: "navigation.home", path: "/" },
  { icon: BookOpen, labelKey: "navigation.stories", path: "/stories" },
  { icon: User, labelKey: "navigation.avatars", path: "/avatar" },
  { icon: FlaskConical, label: "Dokus", path: "/doku" },
  { icon: Brain, label: "Quiz", path: "/quiz" },
  {
    icon: Bot,
    label: "Tavi",
    onClick: () => {
      window.dispatchEvent(new Event("tavi:open"));
    },
  },
];

const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const BottomNav: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme } = useTheme();
  const {
    track,
    isPlaying,
    togglePlay,
    close,
    currentTime,
    duration,
    seek,
    isPlaylistActive,
    playlist,
    currentIndex,
    playNext,
    playPrevious,
    togglePlaylistDrawer,
    isPlaylistDrawerOpen,
    waitingForConversion,
  } = useAudioPlayer();

  const [playerExpanded, setPlayerExpanded] = useState(false);
  const isDark = resolvedTheme === "dark";

  const isVisible = track || waitingForConversion;

  useEffect(() => {
    if (!track && !waitingForConversion) {
      setPlayerExpanded(false);
    }
  }, [track, waitingForConversion]);

  const isActive = (path?: string) => {
    if (!path) return false;
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const labelOf = (item: NavItem) => item.label ?? (item.labelKey ? t(item.labelKey) : "");
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const handleSkip = (delta: number) => {
    seek((currentTime || 0) + delta);
  };

  const hasPrev = isPlaylistActive && currentIndex > 0;
  const hasNext = isPlaylistActive && currentIndex < playlist.length - 1;
  const showNav = isPlaylistActive && playlist.length > 1;

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.path);

    return (
      <button
        key={item.path ?? item.label ?? item.labelKey ?? "tavi"}
        type="button"
        onClick={() => (item.onClick ? item.onClick() : item.path ? navigate(item.path) : undefined)}
        className="relative flex flex-1 flex-col items-center gap-1 rounded-[1.2rem] px-1.5 py-2"
        aria-label={labelOf(item)}
      >
        {active && (
          <motion.span
            layoutId="talea-mobile-active"
            className="absolute inset-0 rounded-[1.2rem] border border-[var(--talea-border-accent)] bg-[linear-gradient(135deg,rgba(255,255,255,0.76)_0%,rgba(231,239,232,0.88)_46%,rgba(227,235,247,0.82)_100%)] dark:bg-[linear-gradient(135deg,rgba(229,176,183,0.14)_0%,rgba(154,199,182,0.18)_46%,rgba(176,200,231,0.16)_100%)]"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}

        <div
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-[0.95rem] border transition-colors duration-200",
            active
              ? "border-white/70 bg-white/82 text-[var(--primary)] shadow-[0_8px_20px_rgba(91,72,59,0.08)] dark:border-white/10 dark:bg-white/6"
              : "border-transparent bg-transparent text-[var(--talea-text-tertiary)]"
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>

        <span
          className={cn(
            "relative text-[9px] font-medium leading-none tracking-[0.04em] transition-colors duration-200",
            active ? "text-[var(--primary)] font-semibold" : "text-[var(--talea-text-tertiary)]"
          )}
        >
          {labelOf(item)}
        </span>
      </button>
    );
  };

  return (
    <>
      <AnimatePresence>
        {isPlaylistDrawerOpen && <PlaylistDrawer variant="mobile" />}
      </AnimatePresence>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] px-3 pb-2.5 md:hidden">
        <div
          className="pointer-events-auto overflow-hidden rounded-[2rem] border shadow-[var(--talea-shadow-medium)] backdrop-blur-2xl"
          style={{
            borderColor: "var(--talea-border-light)",
            background: isDark ? "rgba(19,27,37,0.9)" : "rgba(255,251,247,0.9)",
          }}
        >
          {/* Audio Player */}
          <AnimatePresence>
            {isVisible && (
              <motion.div
                layout
                initial={{ y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 14, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="mx-2 mb-1 mt-2 overflow-hidden rounded-[1.4rem] border"
                style={{
                  borderColor: "var(--talea-border-light)",
                  background: isDark ? "rgba(24,32,44,0.92)" : "rgba(250,243,236,0.92)",
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setPlayerExpanded((value) => !value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setPlayerExpanded((value) => !value);
                    }
                  }}
                  className="cursor-pointer px-2.5 pt-2"
                  aria-label={playerExpanded ? "Audio-Player einklappen" : "Audio-Player ausklappen"}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 overflow-hidden rounded-lg bg-[var(--talea-surface-inset)]">
                      {waitingForConversion && !track ? (
                        <div className="flex h-full w-full items-center justify-center">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--primary)]" />
                        </div>
                      ) : track?.coverImageUrl ? (
                        <img src={track.coverImageUrl} alt={track.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Volume2 className="h-3.5 w-3.5 text-[var(--talea-text-tertiary)]" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold leading-tight text-[var(--talea-text-primary)]">
                        {waitingForConversion && !track ? "Wird konvertiert..." : track?.title}
                      </p>
                      <p className="truncate text-[9px] text-[var(--talea-text-tertiary)]">
                        {waitingForConversion && !track
                          ? "Audio wird vorbereitet"
                          : `${isPlaying ? "Wird abgespielt" : "Pausiert"} - ${formatTime(currentTime)} / ${formatTime(duration)}`}
                      </p>
                    </div>

                    <WaveformEqualizer isPlaying={isPlaying} isWaiting={waitingForConversion} isDark={isDark} size="sm" />

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        togglePlay();
                      }}
                      disabled={waitingForConversion && !track}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary)] text-white disabled:opacity-40 transition-transform active:scale-95"
                      aria-label={isPlaying ? "Audio pausieren" : "Audio starten"}
                    >
                      {waitingForConversion && !track ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isPlaying ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        close();
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--talea-text-tertiary)] hover:text-[var(--talea-text-secondary)] transition-colors"
                      aria-label="Audio schliessen"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2 mb-1.5 h-[2px] overflow-hidden rounded-full bg-[var(--talea-border-light)]">
                    <motion.div
                      className="h-full rounded-full bg-[var(--primary)]"
                      style={{ width: `${progress}%` }}
                      transition={{ ease: "easeOut", duration: 0.2 }}
                    />
                  </div>
                </div>

                {/* Expanded controls */}
                <AnimatePresence initial={false}>
                  {playerExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="overflow-hidden border-t"
                      style={{ borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
                    >
                      <div className="px-3 pb-2.5 pt-2">
                        <p className="line-clamp-2 text-[9px] leading-relaxed text-[var(--talea-text-tertiary)]">
                          {track?.description || "Audio aus Talea"}
                        </p>

                        <div className="mt-2 flex items-center justify-center gap-2">
                          {showNav && (
                            <button
                              type="button"
                              onClick={() => playPrevious()}
                              disabled={!hasPrev}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--talea-text-tertiary)] disabled:opacity-30 transition-colors hover:text-[var(--talea-text-primary)]"
                              aria-label="Vorheriger Track"
                            >
                              <SkipBack className="h-3.5 w-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleSkip(-15)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--talea-text-tertiary)] hover:text-[var(--talea-text-primary)] transition-colors"
                            aria-label="15 Sekunden zurueck"
                          >
                            <Rewind className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={togglePlay}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary)] text-white transition-transform active:scale-95"
                            aria-label={isPlaying ? "Audio pausieren" : "Audio starten"}
                          >
                            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-[1px] h-4 w-4" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSkip(15)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--talea-text-tertiary)] hover:text-[var(--talea-text-primary)] transition-colors"
                            aria-label="15 Sekunden vor"
                          >
                            <FastForward className="h-4 w-4" />
                          </button>

                          {showNav && (
                            <button
                              type="button"
                              onClick={() => playNext()}
                              disabled={!hasNext}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--talea-text-tertiary)] disabled:opacity-30 transition-colors hover:text-[var(--talea-text-primary)]"
                              aria-label="Naechster Track"
                            >
                              <SkipForward className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {isPlaylistActive && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePlaylistDrawer();
                              }}
                              className="ml-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--talea-text-tertiary)] hover:text-[var(--talea-text-primary)] transition-colors"
                              aria-label="Warteschlange"
                            >
                              <ListMusic className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Items */}
          <nav className={cn("px-2", isVisible ? "pb-1 pt-0.5" : "py-1.5")} aria-label="Mobile Navigation">
            <div className="flex items-center">{NAV_ITEMS.map(renderNavItem)}</div>
          </nav>
        </div>
      </div>
    </>
  );
};

export default BottomNav;
