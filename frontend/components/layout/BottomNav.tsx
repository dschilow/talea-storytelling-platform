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
        className="relative flex flex-1 flex-col items-center gap-0.5 py-1.5"
        aria-label={labelOf(item)}
      >
        {active && (
          <motion.span
            layoutId="talea-mobile-active"
            className="absolute -top-0.5 h-[2px] w-6 rounded-full bg-[var(--primary)]"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}

        <Icon
          className={cn(
            "h-[18px] w-[18px] transition-colors duration-200",
            active ? "text-[var(--primary)]" : "text-[var(--talea-text-tertiary)]"
          )}
        />

        <span
          className={cn(
            "text-[9px] font-medium leading-none tracking-wide transition-colors duration-200",
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

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] px-2 pb-1.5 md:hidden">
        <div
          className="pointer-events-auto overflow-hidden rounded-2xl border backdrop-blur-xl"
          style={{
            borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
            background: isDark ? "rgba(17,19,23,0.94)" : "rgba(255,255,255,0.92)",
            boxShadow: isDark
              ? "0 -1px 3px rgba(0,0,0,0.2), 0 -8px 24px rgba(0,0,0,0.15)"
              : "0 -1px 3px rgba(0,0,0,0.03), 0 -8px 24px rgba(0,0,0,0.05)",
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
                className="mx-1.5 mb-0.5 mt-1.5 overflow-hidden rounded-xl border"
                style={{
                  borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                  background: isDark ? "rgba(26,29,36,0.9)" : "rgba(247,245,241,0.9)",
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
          <nav className={cn("px-1", isVisible ? "pb-0.5 pt-0.5" : "py-1")} aria-label="Mobile Navigation">
            <div className="flex items-center">{NAV_ITEMS.map(renderNavItem)}</div>
          </nav>
        </div>
      </div>
    </>
  );
};

export default BottomNav;
