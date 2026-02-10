import React, { useEffect, useMemo, useState } from "react";
import {
  BookMarked,
  BookOpen,
  Bot,
  Code,
  FastForward,
  FlaskConical,
  Gem,
  Home,
  LogOut,
  MoreHorizontal,
  Pause,
  Play,
  Rewind,
  Settings,
  Sparkles,
  User,
  Volume2,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { useClerk, useUser } from "@clerk/clerk-react";

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

const PRIMARY_ITEMS: NavItem[] = [
  { icon: Home, labelKey: "navigation.home", path: "/", tone: "#a88f80" },
  { icon: BookOpen, labelKey: "navigation.stories", path: "/stories", tone: "#b69684" },
  { icon: FlaskConical, label: "Dokus", path: "/doku", tone: "#bf9f8c" },
  { icon: User, labelKey: "navigation.avatars", path: "/avatar", tone: "#9b8a7d" },
];

const ADMIN_ITEMS: NavItem[] = [
  { icon: Sparkles, labelKey: "navigation.characters", path: "/characters", tone: "#b29a8a" },
  { icon: Gem, labelKey: "navigation.artifacts", path: "/artifacts", tone: "#bca390" },
  { icon: BookMarked, labelKey: "navigation.fairytales", path: "/fairytales", tone: "#ad9788" },
  { icon: Code, labelKey: "navigation.logs", path: "/logs", tone: "#9f8c7e" },
];

const SETTINGS_ITEM: NavItem = {
  icon: Settings,
  labelKey: "navigation.settings",
  path: "/settings",
  tone: "#a28d7f",
};

const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

type MoreSheetProps = {
  open: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  isActive: (path: string) => boolean;
  onSignOut: () => Promise<void>;
  onOpenTavi: () => void;
  labelOf: (item: NavItem) => string;
  isDark: boolean;
};

const MoreSheet: React.FC<MoreSheetProps> = ({
  open,
  isAdmin,
  onClose,
  onNavigate,
  isActive,
  onSignOut,
  onOpenTavi,
  labelOf,
  isDark,
}) => {
  const colors = isDark
    ? {
        panel: "linear-gradient(180deg,rgba(24,31,43,0.98)_0%,rgba(20,27,39,1)_100%)",
        border: "#2d3a50",
        card: "rgba(34,44,60,0.92)",
        cardBorder: "#30425c",
        text: "#dbe7f8",
        sub: "#96a7bf",
      }
    : {
        panel: "linear-gradient(180deg,#f5ebe0_0%,#edede9_100%)",
        border: "#d6ccc2",
        card: "rgba(255,255,255,0.62)",
        cardBorder: "#d5bdaf",
        text: "#3a322d",
        sub: "#7d6e62",
      };

  const visibleItems = [SETTINGS_ITEM, ...(isAdmin ? ADMIN_ITEMS : [])];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[72] bg-black/35 backdrop-blur-[2px]"
            onClick={onClose}
            aria-label="Mehr Menue schliessen"
          />

          <motion.div
            initial={{ y: "102%" }}
            animate={{ y: 0 }}
            exit={{ y: "102%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-[73] rounded-t-[24px] border px-4 pb-6 pt-3 shadow-[0_-18px_40px_rgba(41,50,64,0.22)]"
            style={{ borderColor: colors.border, background: colors.panel }}
          >
            <div className="mb-2 flex justify-center">
              <div className="h-1 w-12 rounded-full" style={{ background: colors.sub }} />
            </div>

            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: colors.sub }}>
                Werkzeuge
              </p>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border"
                style={{ borderColor: colors.border, background: colors.card, color: colors.sub }}
                aria-label="Sheet schliessen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {visibleItems.map((item, index) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <motion.button
                    key={item.path}
                    type="button"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.03 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      onNavigate(item.path);
                      onClose();
                    }}
                    className={cn(
                      "rounded-2xl border px-2 py-3 text-center",
                      active ? "shadow-[0_8px_18px_rgba(60,69,88,0.16)]" : ""
                    )}
                    style={{
                      borderColor: active ? `${item.tone}55` : colors.cardBorder,
                      background: active ? colors.card : "transparent",
                    }}
                  >
                    <span
                      className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{ background: active ? `${item.tone}24` : colors.card }}
                    >
                      <Icon className="h-4 w-4" style={{ color: active ? item.tone : colors.sub }} />
                    </span>
                    <span className="mt-1.5 block text-[11px] font-semibold leading-tight" style={{ color: colors.text }}>
                      {labelOf(item)}
                    </span>
                  </motion.button>
                );
              })}

              <motion.button
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: visibleItems.length * 0.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  onOpenTavi();
                  onClose();
                }}
                className="rounded-2xl border px-2 py-3 text-center"
                style={{ borderColor: colors.cardBorder, background: colors.card }}
              >
                <span className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: isDark ? "rgba(92,107,145,0.26)" : "rgba(229,216,205,0.88)" }}>
                  <Bot className="h-4 w-4" style={{ color: "#8b7567" }} />
                </span>
                <span className="mt-1.5 block text-[11px] font-semibold leading-tight" style={{ color: colors.text }}>
                  Tavi
                </span>
              </motion.button>

              <motion.button
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: (visibleItems.length + 1) * 0.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={async () => {
                  await onSignOut();
                  onClose();
                }}
                className="rounded-2xl border px-2 py-3 text-center"
                style={{ borderColor: "#bc8a8a", background: isDark ? "rgba(139,74,74,0.18)" : "rgba(255,236,236,0.82)" }}
              >
                <span className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: isDark ? "rgba(139,74,74,0.24)" : "rgba(255,216,216,0.9)" }}>
                  <LogOut className="h-4 w-4 text-[#a76060]" />
                </span>
                <span className="mt-1.5 block text-[11px] font-semibold leading-tight text-[#a76060]">
                  Logout
                </span>
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const BottomNav: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { resolvedTheme } = useTheme();
  const { track, isPlaying, togglePlay, close, currentTime, duration, seek } = useAudioPlayer();

  const [moreOpen, setMoreOpen] = useState(false);
  const [playerExpanded, setPlayerExpanded] = useState(false);

  const isDark = resolvedTheme === "dark";
  const isAdmin = user?.publicMetadata?.role !== "customer";

  const colors = isDark
    ? {
        nav: "rgba(19,27,39,0.96)",
        border: "#2f3d53",
        text: "#9ab0ca",
        textActive: "#e6eef9",
        more: "#a28d7f",
        audioBg: "rgba(26,36,51,0.94)",
        audioBorder: "#3a4962",
        audioSurface: "rgba(17,24,35,0.42)",
      }
    : {
        nav: "rgba(245,235,224,0.96)",
        border: "#d6ccc2",
        text: "#6f6258",
        textActive: "#3a322d",
        more: "#a28d7f",
        audioBg: "rgba(237,237,233,0.94)",
        audioBorder: "#d5bdaf",
        audioSurface: "rgba(255,255,255,0.54)",
      };

  const labelOf = (item: NavItem) => item.label ?? (item.labelKey ? t(item.labelKey) : "");

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const moreIsActive = useMemo(
    () => [SETTINGS_ITEM, ...(isAdmin ? ADMIN_ITEMS : [])].some((item) => isActive(item.path)),
    [location.pathname, isAdmin]
  );

  const openTaviChat = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("tavi:open"));
    }
  };

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  useEffect(() => {
    if (!track) {
      setPlayerExpanded(false);
    }
  }, [track]);

  const toggleExpanded = () => {
    setPlayerExpanded((value) => !value);
  };

  const handleSkip = (delta: number) => {
    seek((currentTime || 0) + delta);
  };

  const renderPrimaryItem = (item: NavItem) => {
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

        <span className="text-[10px] font-semibold leading-none" style={{ color: active ? colors.textActive : colors.text }}>
          {labelOf(item)}
        </span>
      </button>
    );
  };

  return (
    <>
      <MoreSheet
        open={moreOpen}
        isAdmin={isAdmin}
        onClose={() => setMoreOpen(false)}
        onNavigate={navigate}
        isActive={isActive}
        onSignOut={signOut}
        onOpenTavi={openTaviChat}
        labelOf={labelOf}
        isDark={isDark}
      />

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] px-2 pb-1 md:hidden">
        <div
          className="pointer-events-auto overflow-hidden rounded-[18px] border backdrop-blur"
          style={{
            borderColor: colors.border,
            background: colors.nav,
            boxShadow: isDark ? "0 10px 24px rgba(16,23,34,0.36)" : "0 10px 24px rgba(118,98,82,0.18)",
          }}
        >
          <AnimatePresence>
            {track && (
              <motion.div
                layout
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 12, opacity: 0 }}
                transition={{ type: "spring", stiffness: 360, damping: 32 }}
                className="mx-1 mt-1 mb-0.5 overflow-hidden rounded-xl border"
                style={{ borderColor: colors.audioBorder, background: colors.audioBg }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={toggleExpanded}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleExpanded();
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

                  <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ background: isDark ? "rgba(120,138,167,0.28)" : "rgba(123,135,152,0.24)" }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg,#d5bdaf 0%,#e3d5ca 55%,#d6ccc2 100%)", width: `${progress}%` }}
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
                            style={{ background: "linear-gradient(135deg,#d5bdaf 0%,#e3d5ca 55%,#d6ccc2 100%)", color: "#433a34" }}
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
            <div className="flex items-center">
              {PRIMARY_ITEMS.map(renderPrimaryItem)}

              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1"
                aria-label="Mehr Menue oeffnen"
              >
                {(moreIsActive || moreOpen) && (
                  <motion.span className="absolute -top-[2px] h-[3px] w-5 rounded-full" style={{ background: colors.more }} />
                )}

                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-lg"
                  style={{ background: moreIsActive || moreOpen ? "rgba(144,117,184,0.18)" : "transparent" }}
                >
                  <MoreHorizontal className="h-4 w-4" style={{ color: moreIsActive || moreOpen ? colors.more : colors.text }} />
                </span>

                <span className="text-[10px] font-semibold leading-none" style={{ color: moreIsActive || moreOpen ? colors.more : colors.text }}>
                  Mehr
                </span>
              </button>
            </div>
          </nav>
        </div>
      </div>
    </>
  );
};

export default BottomNav;


