import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Brain,
  FastForward,
  FlaskConical,
  Home,
  Pause,
  Play,
  Rewind,
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

interface NavItem {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  path: string;
  tone: string;
  labelKey?: string;
  label?: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: Home, labelKey: "navigation.home", path: "/", tone: "#a88f80" },
  { icon: BookOpen, labelKey: "navigation.stories", path: "/stories", tone: "#b69684" },
  { icon: User, labelKey: "navigation.avatars", path: "/avatar", tone: "#9b8a7d" },
  { icon: FlaskConical, label: "Dokus", path: "/doku", tone: "#bf9f8c" },
  { icon: Brain, label: "Quiz", path: "/quiz", tone: "#a38978" },
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
  const { track, isPlaying, togglePlay, close, currentTime, duration, seek } = useAudioPlayer();

  const [playerExpanded, setPlayerExpanded] = useState(false);

  const isDark = resolvedTheme === "dark";
  const colors = useMemo(
    () =>
      isDark
        ? {
            nav: "rgba(20,29,42,0.96)",
            border: "#2f3f57",
            text: "#9fb2cc",
            textActive: "#edf3fd",
            audioBg: "rgba(27,38,54,0.96)",
            audioBorder: "#3b4d67",
            audioSurface: "rgba(19,28,40,0.42)",
            progressBase: "rgba(131,152,184,0.3)",
          }
        : {
            nav: "rgba(245,235,224,0.96)",
            border: "#d5bdaf",
            text: "#5f554d",
            textActive: "#2e2722",
            audioBg: "rgba(237,237,233,0.98)",
            audioBorder: "#d6ccc2",
            audioSurface: "rgba(255,255,255,0.58)",
            progressBase: "rgba(131,118,106,0.24)",
          },
    [isDark]
  );

  useEffect(() => {
    if (!track) {
      setPlayerExpanded(false);
    }
  }, [track]);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const labelOf = (item: NavItem) => item.label ?? (item.labelKey ? t(item.labelKey) : "");
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const handleSkip = (delta: number) => {
    seek((currentTime || 0) + delta);
  };

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.path);

    return (
      <button
        key={item.path}
        type="button"
        onClick={() => navigate(item.path)}
        className="relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1"
        aria-label={labelOf(item)}
      >
        {active && (
          <motion.span
            layoutId="talea-mobile-active"
            className="absolute -top-[2px] h-[3px] w-5 rounded-full"
            style={{ background: item.tone }}
          />
        )}

        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-lg"
          style={{ background: active ? `${item.tone}20` : "transparent" }}
        >
          <Icon className="h-4 w-4" style={{ color: active ? item.tone : colors.text }} />
        </span>

        <span
          className="text-[10px] font-semibold leading-none"
          style={{ color: active ? colors.textActive : colors.text }}
        >
          {labelOf(item)}
        </span>
      </button>
    );
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] px-2 pb-1 md:hidden">
      <div
        className="pointer-events-auto overflow-hidden rounded-[18px] border backdrop-blur"
        style={{
          borderColor: colors.border,
          background: colors.nav,
          boxShadow: isDark ? "0 10px 26px rgba(13,20,32,0.42)" : "0 10px 24px rgba(118,98,82,0.18)",
        }}
      >
        <AnimatePresence>
          {track && (
            <motion.div
              layout
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 14, opacity: 0 }}
              transition={{ type: "spring", stiffness: 360, damping: 34 }}
              className="mx-1 mb-0.5 mt-1 overflow-hidden rounded-xl border"
              style={{ borderColor: colors.audioBorder, background: colors.audioBg }}
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
                className="cursor-pointer px-2 pt-2"
                aria-label={playerExpanded ? "Audio-Player einklappen" : "Audio-Player ausklappen"}
              >
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 overflow-hidden rounded-lg border border-white/20 bg-slate-200/40 dark:bg-slate-700/40">
                    {track.coverImageUrl ? (
                      <img src={track.coverImageUrl} alt={track.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Volume2 className="h-4 w-4 text-[#8b7567]" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-semibold leading-tight" style={{ color: colors.textActive }}>
                      {track.title}
                    </p>
                    <p className="truncate text-[9px]" style={{ color: colors.text }}>
                      {isPlaying ? "Wird abgespielt" : "Pausiert"} - {formatTime(currentTime)} / {formatTime(duration)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      togglePlay();
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border"
                    style={{ borderColor: colors.audioBorder, background: colors.audioSurface }}
                    aria-label={isPlaying ? "Audio pausieren" : "Audio starten"}
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4" style={{ color: colors.textActive }} />
                    ) : (
                      <Play className="h-4 w-4" style={{ color: colors.textActive }} />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      close();
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border"
                    style={{ borderColor: "#c6a093", background: "rgba(198,160,147,0.2)" }}
                    aria-label="Audio schliessen"
                  >
                    <X className="h-4 w-4 text-[#9e6d5f]" />
                  </button>
                </div>

                <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ background: colors.progressBase }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: "linear-gradient(90deg,#d5bdaf 0%,#e3d5ca 55%,#d6ccc2 100%)",
                      width: `${progress}%`,
                    }}
                    transition={{ ease: "easeOut", duration: 0.2 }}
                  />
                </div>
              </div>

              <AnimatePresence initial={false}>
                {playerExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.24, ease: "easeOut" }}
                    className="overflow-hidden border-t"
                    style={{ borderColor: colors.audioBorder, background: colors.audioSurface }}
                  >
                    <div className="px-2 pb-2 pt-1.5">
                      <p className="line-clamp-2 text-[9px] leading-relaxed" style={{ color: colors.text }}>
                        {track.description || "Audio aus Talea"}
                      </p>

                      <div className="mt-1.5 flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSkip(-15)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border"
                          style={{ borderColor: colors.audioBorder, background: "transparent", color: colors.text }}
                          aria-label="15 Sekunden zurueck"
                        >
                          <Rewind className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={togglePlay}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full"
                          style={{
                            background: "linear-gradient(135deg,#d5bdaf 0%,#e3d5ca 55%,#d6ccc2 100%)",
                            color: "#433a34",
                          }}
                          aria-label={isPlaying ? "Audio pausieren" : "Audio starten"}
                        >
                          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-[1px] h-4 w-4" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSkip(15)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border"
                          style={{ borderColor: colors.audioBorder, background: "transparent", color: colors.text }}
                          aria-label="15 Sekunden vor"
                        >
                          <FastForward className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <nav className={cn("px-1", track ? "pb-0.5 pt-0.5" : "py-0.5")} aria-label="Mobile Navigation">
          <div className="flex items-center">{NAV_ITEMS.map(renderNavItem)}</div>
        </nav>
      </div>
    </div>
  );
};

export default BottomNav;

