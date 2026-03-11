import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion, AnimatePresence, Variants } from "framer-motion";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Clock3,
  Library,
  LogIn,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  WandSparkles,
  Sparkles,
  Star,
  Zap,
  Swords,
  ScrollText
} from "lucide-react";

import { useBackend } from "../../hooks/useBackend";
import type { Story, StoryConfig } from "../../types/story";
import { cn } from "@/lib/utils";
import { StoryParticipantsDialog } from "@/components/story/StoryParticipantsDialog";
import taleaLogo from "@/img/talea_logo.png";
import { useTheme } from "@/contexts/ThemeContext";
import { useOptionalChildProfiles } from "@/contexts/ChildProfilesContext";
import CosmosHomeCard from '../Cosmos/CosmosHomeCard';
import { useCosmosState } from '../Cosmos/useCosmosState';
import { useOffline } from "@/contexts/OfflineStorageContext";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  TaleaActionButton,
  TaleaLoadingState,
  TaleaPageBackground,
  TaleaSectionHeading,
  taleaBodyFont,
  taleaChipClass,
  taleaDisplayFont,
  taleaInsetSurfaceClass,
  taleaPageShellClass,
  taleaSurfaceClass,
} from "@/components/talea/TaleaPastelPrimitives";

interface Avatar {
  id: string;
  name: string;
  imageUrl?: string;
  creationType: "ai-generated" | "photo-upload";
  avatarRole?: "child" | "companion";
}

interface Doku {
  id: string;
  title: string;
  topic: string;
  coverImageUrl?: string;
  status: "generating" | "complete" | "error";
  createdAt: string;
}

const headingFont = taleaDisplayFont;
const bodyFont = taleaBodyFont;

const storyStatusLabel: Record<Story["status"], string> = {
  complete: "Fertig",
  generating: "In Arbeit",
  error: "Fehler",
};

const dokuStatusLabel: Record<Doku["status"], string> = {
  complete: "Fertig",
  generating: "In Arbeit",
  error: "Fehler",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeDate(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.9 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", bounce: 0.5, duration: 0.6 } },
};

const KidsAppBackground: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <TaleaPageBackground isDark={isDark} />
);

const LoadingState: React.FC = () => (
  <TaleaLoadingState
    title="Talea richtet die Startseite neu ein"
    subtitle="Die Geschichten, Helden und Dokus werden gerade in ihre neuen Bereiche sortiert."
    icon={<WandSparkles className="h-9 w-9" />}
  />
);

const SignedOutStart: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-5 py-10">
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.5 }}
        className="w-full max-w-4xl"
      >
        <Card className="overflow-hidden rounded-[3rem] border-[6px] border-white/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 shadow-[0_20px_60px_-15px_rgba(236,72,153,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(99,102,241,0.3)] backdrop-blur-2xl">
          <CardContent className="p-0 grid md:grid-cols-[1.4fr_1fr]">
            <div className="p-10 md:p-14 flex flex-col justify-center">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="inline-flex w-fit items-center gap-3 rounded-full border-4 border-white/80 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-2.5 shadow-xl"
              >
                <img src={taleaLogo} alt="Talea Logo" className="h-8 w-8 rounded-xl object-cover" />
                <p className="text-sm font-extrabold tracking-widest text-indigo-500 dark:text-indigo-300">TALEA STUDIO</p>
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-8 text-5xl font-black leading-tight text-slate-800 dark:text-slate-100 md:text-6xl"
                style={{ fontFamily: headingFont }}
              >
                Geschichten gestalten,
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-500 dark:from-pink-400 dark:to-purple-400">
                  mit Magie erleben ✨
                </span>
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-6 max-w-xl text-lg font-bold leading-relaxed text-slate-500 dark:text-slate-400"
              >
                {t(
                  "home.subtitle",
                  "Organisiere Avatare, Geschichten und Dokus in einer wunderbaren Umgebung für die besten Leseabenteuer."
                )}
              </motion.p>
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.05, y: -4, rotate: -2 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => navigate("/auth")}
                className="mt-10 inline-flex w-fit items-center gap-3 rounded-[2rem] bg-gradient-to-br from-pink-500 to-purple-600 px-10 py-5 text-xl font-black text-white shadow-xl shadow-pink-300/50 dark:shadow-purple-900/50 border-4 border-white/20"
              >
                <LogIn className="h-6 w-6" />
                Das Abenteuer beginnt
              </motion.button>
            </div>

            <div className="bg-gradient-to-br from-pink-100 to-cyan-100 dark:from-slate-800 dark:to-indigo-950 p-10 flex flex-col justify-center relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/40 dark:bg-white/5 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-pink-300/30 dark:bg-purple-500/20 rounded-full blur-3xl"></div>
              
              <div className="relative z-10">
                <p className="text-center text-sm font-black tracking-widest text-pink-500 dark:text-indigo-300 mb-8">
                  ENTDECKE DEINE WELT
                </p>
                <ul className="flex flex-col gap-5 text-base font-extrabold text-slate-700 dark:text-slate-200">
                  {[
                    { icon: "📚", text: "Story-Streams mit Teilnehmern", color: "text-cyan-600 dark:text-cyan-300", bg: "bg-cyan-100 dark:bg-cyan-900/50" },
                    { icon: "🦸‍♀️", text: "Schneller Zugriff auf Avatare", color: "text-pink-600 dark:text-pink-300", bg: "bg-pink-100 dark:bg-pink-900/50" },
                    { icon: "💡", text: "Dokus im gleichen Stil", color: "text-yellow-600 dark:text-yellow-300", bg: "bg-yellow-100 dark:bg-yellow-900/50" }
                  ].map((item, i) => (
                    <motion.li 
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                      whileHover={{ scale: 1.03, x: 8 }} 
                      className="flex items-center gap-4 rounded-[1.5rem] border-4 border-white/80 dark:border-slate-700 bg-white/70 dark:bg-slate-800 px-5 py-4 shadow-lg backdrop-blur-md cursor-default"
                    >
                      <span className={cn("flex h-12 w-12 items-center justify-center rounded-[1rem] shadow-inner text-xl", item.bg, item.color)}>
                        {item.icon}
                      </span>
                      {item.text}
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

const SectionHeading: React.FC<{
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, subtitle, icon, actionLabel, onAction }) => (
  <div className="mb-8 flex flex-wrap items-end justify-between gap-4 pl-2">
    <div className="flex items-center gap-4">
      {icon && (
        <div className="hidden md:flex h-14 w-14 items-center justify-center rounded-[1.5rem] bg-white/80 dark:bg-slate-800 border-4 border-white dark:border-slate-700 shadow-lg text-pink-500 dark:text-indigo-400">
          {icon}
        </div>
      )}
      <div>
        <h2
          className="text-3xl font-black text-slate-800 dark:text-slate-100 md:text-4xl flex items-center gap-3"
          style={{ fontFamily: headingFont }}
        >
          {title}
        </h2>
        <p className="mt-1.5 text-base font-extrabold text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
    </div>
    {actionLabel && onAction && (
      <motion.button
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-2 rounded-[1.5rem] border-4 border-white/80 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-6 py-3 text-sm font-black text-slate-700 dark:text-slate-200 shadow-lg backdrop-blur-md transition-all hover:bg-cyan-50 dark:hover:bg-slate-700/80 hover:text-cyan-600 dark:hover:text-cyan-300 hover:border-cyan-200 dark:hover:border-cyan-900"
      >
        {actionLabel}
        <ArrowRight className="h-5 w-5" />
      </motion.button>
    )}
  </div>
);

const StoryStatusTag: React.FC<{ status: Story["status"] }> = ({ status }) => (
  <motion.span
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    className={cn(
      "absolute right-5 top-5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] shadow-sm z-20",
      status === "complete" && "border-transparent bg-[#dcf4e8] text-slate-900 dark:bg-[#173629] dark:text-white",
      status === "generating" && "border-transparent bg-[#fde9cf] text-slate-900 dark:bg-[#493419] dark:text-white",
      status === "error" && "border-transparent bg-[#f9d8dd] text-slate-900 dark:bg-[#4d1f29] dark:text-white"
    )}
  >
    {storyStatusLabel[status]}
  </motion.span>
);

const StoryCard: React.FC<{
  story: Story;
  onRead: () => void;
  onDelete: () => void;
  canSaveOffline?: boolean;
  isSavedOffline?: boolean;
  isSavingOffline?: boolean;
  onToggleOffline?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  index: number;
}> = ({ story, onRead, onDelete, canSaveOffline, isSavedOffline, isSavingOffline, onToggleOffline, index }) => {
  const reduceMotion = useReducedMotion();
  const isFeatured = index === 0;

  return (
    <motion.article
      variants={itemVariants}
      whileHover={reduceMotion ? undefined : { y: -8, scale: 1.02 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      className={cn(
        "group cursor-pointer relative", 
        isFeatured ? "md:col-span-2 lg:col-span-2" : ""
      )}
      onClick={onRead}
    >
      <StoryStatusTag status={story.status} />

      <Card className={cn(taleaSurfaceClass, "h-full overflow-hidden border-0 transition-all group-hover:shadow-[0_28px_64px_-34px_rgba(175,141,166,0.4)] dark:group-hover:shadow-[0_32px_70px_-40px_rgba(2,8,23,0.95)]")}>
        <div className={cn("flex h-full min-w-0", isFeatured ? "flex-col sm:flex-row" : "flex-col")}>
          <div className={cn(
            "relative overflow-hidden p-2 sm:p-3", 
            isFeatured ? "sm:w-[48%] sm:p-3" : "h-56"
          )}>
            <div className={cn(taleaInsetSurfaceClass, "h-full w-full overflow-hidden rounded-[28px] border-0 p-2")}>
              {story.coverImageUrl ? (
                <img
                  src={story.coverImageUrl}
                  alt={story.title}
                  className="h-full w-full rounded-[20px] object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#f7dfe9_0%,#dff0ff_100%)] text-slate-500 dark:bg-[linear-gradient(135deg,rgba(92,68,97,0.48)_0%,rgba(53,82,116,0.4)_100%)] dark:text-slate-100">
                  <BookOpen className="h-16 w-16" />
                </div>
              )}
              
              <div className="absolute inset-2 rounded-[20px] bg-gradient-to-t from-slate-900/50 via-slate-900/5 to-transparent" />
            </div>

            <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 sm:bottom-6 sm:left-6">
              {canSaveOffline && story.status === "complete" && onToggleOffline && (
                <motion.button
                  whileHover={{ scale: 1.15, rotate: 5 }}
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={onToggleOffline}
                  disabled={isSavingOffline}
                  className="rounded-full border border-white/30 bg-black/35 p-3 text-white backdrop-blur-md transition-colors hover:bg-black/55 shadow-lg"
                  aria-label={isSavedOffline ? "Offline-Speicherung entfernen" : "Offline speichern"}
                >
                  {isSavingOffline ? (
                    <Clock3 className="h-5 w-5 animate-spin" />
                  ) : isSavedOffline ? (
                    <BookmarkCheck className="h-5 w-5 text-[#d4f1ff]" />
                  ) : (
                    <Bookmark className="h-5 w-5" />
                  )}
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.15, rotate: -5 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete();
                }}
                className="rounded-full border border-white/20 bg-[#7d434f]/82 p-3 text-white backdrop-blur-md transition-colors hover:bg-[#8f4c5a] shadow-lg"
                aria-label="Story loeschen"
              >
                <Trash2 className="h-5 w-5" />
              </motion.button>
            </div>
          </div>

          <CardContent className={cn("flex flex-col justify-between p-5 sm:p-6", isFeatured ? "sm:w-[52%] sm:p-7 lg:p-8 lg:pr-10" : "")}>
            <div className="space-y-3">
              {isFeatured ? (
                <span className={cn(taleaChipClass, "border-white/80 bg-white/86 text-[#9d7d8f] dark:border-white/10 dark:bg-white/5 dark:text-[#d2c5ff]")}>
                  Titelgeschichte
                </span>
              ) : null}
              <h3
                className="line-clamp-2 text-[1.75rem] font-semibold leading-tight text-slate-900 transition-colors dark:text-white sm:text-2xl"
                style={{ fontFamily: headingFont }}
              >
                {story.title}
              </h3>
              <p className={cn(
                "font-medium leading-7 text-slate-600 dark:text-slate-300",
                isFeatured ? "text-base line-clamp-4" : "text-sm line-clamp-2"
              )}>
                {story.summary || story.description || "Noch keine Zusammenfassung verfügbar."}
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <StoryParticipantsDialog story={story} maxVisible={isFeatured ? 6 : 4} />

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#efe4da] pt-4 dark:border-white/10">
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{formatDate(story.createdAt)}</span>
                <span className="rounded-full border border-white/80 bg-white/86 px-4 py-2 text-[0px] font-semibold text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold">
                    <span>Jetzt lesen</span>
                    <ArrowRight className="h-4 w-4" />
                  </span>
                  Loslesen ✨
                </span>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>
    </motion.article>
  );
};

const AvatarTile: React.FC<{
  avatar: Avatar;
  onOpen: () => void;
  onDelete: () => void;
}> = ({ avatar, onOpen, onDelete }) => (
  <motion.article
    variants={itemVariants}
    whileHover={{ y: -4, scale: 1.02 }}
    whileTap={{ scale: 0.95 }}
    role="button"
    tabIndex={0}
    onClick={onOpen}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen();
      }
    }}
    className={cn(taleaSurfaceClass, "group relative flex h-[11rem] w-[8.75rem] flex-shrink-0 flex-col items-center justify-center p-3 text-center sm:h-56 sm:w-44 sm:p-4")}
  >
    <div className="relative mx-auto mb-3 inline-block">
      <div className={cn(taleaInsetSurfaceClass, "h-[5.5rem] w-[5.5rem] overflow-hidden rounded-full border-0 p-2 shadow-[0_8px_20px_-5px_rgba(0,0,0,0.12)] sm:h-28 sm:w-28")}>
        <img
          src={
            avatar.imageUrl ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(avatar.name)}`
          }
          alt={avatar.name}
          className="h-full w-full rounded-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <span className="absolute -bottom-1 -right-1 rounded-full border border-white/80 bg-white/86 px-3 py-1.5 text-[0px] font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-lg dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">{avatar.creationType === "ai-generated" ? "AI Figur" : "Fotofigur"}</span>
        {avatar.creationType === "ai-generated" ? "AI ✨" : "Foto 📸"}
      </span>
    </div>

    <p className="w-full truncate px-2 text-base font-semibold text-slate-900 dark:text-white sm:text-lg">{avatar.name}</p>
    <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
      {avatar.creationType === "ai-generated" ? "AI-Figur" : "Fotofigur"}
    </p>
    
    <div className="absolute -top-3 -left-3 opacity-0 transition-all duration-300 scale-50 group-hover:opacity-100 group-hover:scale-100 z-10">
      <motion.button
        whileHover={{ scale: 1.15, rotate: -10 }}
        whileTap={{ scale: 0.9 }}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        className="rounded-full border border-[#f1d8de] bg-[#fff4f6] p-2.5 text-[#a14b5e] shadow-xl dark:border-[#4a2730] dark:bg-[#331921] dark:text-[#ffb3c1]"
        aria-label={`${avatar.name} loeschen`}
      >
        <Trash2 className="h-4 w-4" />
      </motion.button>
    </div>
  </motion.article>
);

const DokuBentoTicket: React.FC<{
  doku: Doku;
  onRead: () => void;
  onDelete: () => void;
}> = ({ doku, onRead, onDelete }) => (
  <motion.article
    variants={itemVariants}
    whileHover={{ y: -4, scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    className={cn(taleaSurfaceClass, "group relative cursor-pointer overflow-hidden border-0 p-4 sm:p-5")}
    role="button"
    tabIndex={0}
    onClick={onRead}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onRead();
      }
    }}
  >
    <div className="flex items-center gap-4 sm:gap-5">
      <div className={cn(taleaInsetSurfaceClass, "relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-[22px] border-0 p-2 sm:h-20 sm:w-20")}>
        {doku.coverImageUrl ? (
          <img src={doku.coverImageUrl} alt={doku.title} className="h-full w-full rounded-[16px] object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#f9ead0_0%,#dcecfb_100%)] text-slate-500 dark:bg-[linear-gradient(135deg,rgba(91,77,52,0.5)_0%,rgba(58,82,115,0.38)_100%)] dark:text-slate-100">
            <Library className="h-8 w-8" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex justify-between items-start gap-2">
          <div>
            <p className="line-clamp-1 text-xl font-semibold text-slate-900 dark:text-white transition-colors">{doku.title}</p>
            <p className="mt-1 line-clamp-1 text-sm font-medium text-[#9d7d50] dark:text-[#f0c989]">{doku.topic}</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.15, rotate: 10 }}
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="z-10 shrink-0 rounded-full border border-[#f1d8de] bg-[#fff4f6] p-2.5 text-[#a14b5e] opacity-0 transition-opacity group-hover:opacity-100 dark:border-[#4a2730] dark:bg-[#331921] dark:text-[#ffb3c1]"
            aria-label="Doku loeschen"
          >
            <Trash2 className="h-4 w-4" />
          </motion.button>
        </div>

        <div className="mt-4 flex items-center gap-3 text-xs font-black">
          <span className={cn(
             "rounded-full px-3 py-1.5 uppercase tracking-[0.18em] text-slate-900 shadow-sm z-10 dark:text-white",
             doku.status === "complete" ? "bg-[#dcf4e8] dark:bg-[#173629]" : doku.status === "generating" ? "bg-[#fde9cf] dark:bg-[#493419]" : "bg-[#f9d8dd] dark:bg-[#4d1f29]"
          )}>
            {dokuStatusLabel[doku.status]}
          </span>
          <span className="text-slate-500 dark:text-slate-400">{formatDate(doku.createdAt)}</span>
        </div>
      </div>
    </div>
  </motion.article>
);

const EmptyStateContainer: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  colorClass: string;
}> = ({ title, description, icon, actionLabel, onAction, colorClass }) => (
  <motion.div variants={itemVariants}>
    <Card className={cn(taleaSurfaceClass, "overflow-hidden border-0")}>
      <CardContent className="p-3 sm:p-4">
        <div className={cn(taleaInsetSurfaceClass, "flex flex-col items-center justify-center p-6 text-center sm:p-8 md:p-10")}>
        <motion.div 
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className={cn("mb-5 flex h-20 w-20 items-center justify-center rounded-[24px] shadow-inner sm:mb-6 sm:h-24 sm:w-24", colorClass)}
        >
          {icon}
        </motion.div>
        <h3 className="text-[2rem] font-semibold leading-tight text-slate-900 dark:text-white sm:text-[2.4rem]" style={{ fontFamily: headingFont }}>
          {title}
        </h3>
        <p className="mx-auto mt-4 max-w-xl text-sm font-medium leading-7 text-slate-600 dark:text-slate-300 sm:text-base">{description}</p>
        {actionLabel && onAction && (
          <div className="mt-7">
            <TaleaActionButton type="button" onClick={onAction} icon={<ArrowRight className="h-4 w-4" />}>
            {actionLabel}
            </TaleaActionButton>
          </div>
        )}
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

const PremiumSignedOutStart: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex min-h-[78vh] items-center justify-center px-3 py-8 sm:px-4 sm:py-10">
      <motion.div
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className={cn(taleaSurfaceClass, "w-full max-w-6xl overflow-hidden p-2 sm:p-3 md:p-4")}
      >
        <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
          <div className={cn(taleaInsetSurfaceClass, "flex flex-col justify-between gap-6 p-6 sm:gap-8 sm:p-8 md:p-10")}>
            <div>
              <span className={cn(taleaChipClass, "border-white/80 bg-white/86 text-[#8f7284] dark:border-white/10 dark:bg-white/5 dark:text-[#d2c5ff]")}>
                <img src={taleaLogo} alt="Talea Logo" className="mr-3 h-8 w-8 rounded-2xl object-cover" />
                Talea Kinderatelier
              </span>
              <h1
                className="mt-6 max-w-3xl text-[2.45rem] font-semibold leading-[1.04] text-slate-900 dark:text-white sm:mt-8 md:text-[4rem]"
                style={{ fontFamily: headingFont }}
              >
                Geschichten, Figuren und Wissen fuehlen sich wie aus einem Guss an.
              </h1>
              <p className="mt-5 max-w-2xl text-base font-medium leading-8 text-slate-600 dark:text-slate-300 md:text-lg">
                {t(
                  "home.subtitle",
                  "Talea fuehlt sich wie eine ruhige Kinderbibliothek an: weich, hochwertig, klar gegliedert und mit sanften Animationen an allen wichtigen Stellen."
                )}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <TaleaActionButton icon={<LogIn className="h-4 w-4" />} onClick={() => navigate("/auth")}>
                Zum Familienzugang
              </TaleaActionButton>
              <TaleaActionButton variant="secondary" icon={<BookOpen className="h-4 w-4" />} onClick={() => navigate("/auth")}>
                Geschichten entdecken
              </TaleaActionButton>
            </div>
          </div>

          <div className="grid gap-4">
            {[
              {
                title: "Neue Struktur",
                text: "Nicht nur Farben, sondern Hero, Hierarchie und Kartenfluss wurden neu gedacht.",
                tone: "from-[#f6dce7] to-[#faebd0]",
              },
              {
                title: "Sanfte Animationen",
                text: "Bewegung gibt Feedback, ohne laut zu sein oder die Inhalte zu ueberdecken.",
                tone: "from-[#dff0ff] to-[#e2f4ec]",
              },
              {
                title: "Wertige Karten",
                text: "Stories, Dokus und Avatare bekommen mehr Buehne und mehr Ruhe.",
                tone: "from-[#f3e4fb] to-[#eee1d2]",
              },
            ].map((item) => (
              <div key={item.title} className={cn(taleaSurfaceClass, "relative overflow-hidden p-5 sm:p-6")}>
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-75", item.tone)} />
                <div className="relative z-10">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8f7284] dark:text-[#d2c5ff]">Talea</p>
                  <h2
                    className="mt-3 text-[1.7rem] font-semibold leading-tight text-slate-900 dark:text-white"
                    style={{ fontFamily: headingFont }}
                  >
                    {item.title}
                  </h2>
                  <p className="mt-3 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

type HomeSignedInContentProps = {
  isDark: boolean;
  greeting: string;
  userName?: string | null;
  stories: Story[];
  storiesTotal: number;
  avatars: Avatar[];
  dokus: Doku[];
  dokusTotal: number;
  createAvatarPath: string;
  refreshing: boolean;
  onRefresh: () => void;
  goTo: (path: string) => void;
  onDeleteStory: (storyId: string, title: string) => void;
  onDeleteAvatar: (avatar: Avatar) => void;
  onDeleteDoku: (dokuId: string, title: string) => void;
  canUseOffline: boolean;
  isStorySaved: (storyId: string) => boolean;
  isSaving: (storyId: string) => boolean;
  toggleStory: (storyId: string) => void;
  cosmosState: ReturnType<typeof useCosmosState>["cosmosState"];
};

const HomeSignedInContent: React.FC<HomeSignedInContentProps> = ({
  isDark,
  greeting,
  userName,
  stories,
  storiesTotal,
  avatars,
  dokus,
  dokusTotal,
  createAvatarPath,
  refreshing,
  onRefresh,
  goTo,
  onDeleteStory,
  onDeleteAvatar,
  onDeleteDoku,
  canUseOffline,
  isStorySaved,
  isSaving,
  toggleStory,
  cosmosState,
}) => (
  <motion.div
    variants={containerVariants}
    initial="hidden"
    animate="show"
    className={cn(taleaPageShellClass, "space-y-8 pt-4 sm:space-y-10 sm:pt-6 md:pt-8")}
  >
    <section className="grid gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1.42fr)_minmax(19rem,0.88fr)]">
      <motion.div variants={itemVariants}>
        <div className={cn(taleaSurfaceClass, "p-4 sm:p-5 md:p-6 lg:p-8")}>
          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={cn(taleaInsetSurfaceClass, "rounded-[24px] p-2")}>
                  <UserButton
                    afterSignOutUrl="/"
                    userProfileMode="navigation"
                    userProfileUrl="/settings"
                    appearance={{ elements: { avatarBox: "h-14 w-14 md:h-16 md:w-16" } }}
                  />
                </div>
                <div>
                  <span className={cn(taleaChipClass, "border-white/80 bg-white/86 text-[#8f7284] dark:border-white/10 dark:bg-white/5 dark:text-[#d2c5ff]")}>
                    Talea Atelier
                  </span>
                  <h1
                    className="mt-4 text-[2.9rem] font-semibold leading-[0.98] text-slate-900 dark:text-white md:text-[4.35rem]"
                    style={{ fontFamily: headingFont }}
                  >
                    {greeting}, {userName || "Entdecker"}.
                  </h1>
                </div>
              </div>

              <TaleaActionButton
                variant="secondary"
                onClick={onRefresh}
                icon={<RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />}
                aria-label="Startseite aktualisieren"
              >
                Atelier neu ordnen
              </TaleaActionButton>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_15rem]">
              <div className="space-y-6">
                <p className="max-w-3xl text-base font-medium leading-8 text-slate-600 dark:text-slate-300 md:text-lg">
                  Home fuehlt sich jetzt wie eine kuratierte Kinderbuch-Auslage an: weich geschichtet, klar gefuehrt und deutlich weniger nach Standard-Dashboard.
                </p>

                <div className="flex flex-wrap gap-2.5 sm:gap-3">
                  <TaleaActionButton icon={<WandSparkles className="h-4 w-4" />} onClick={() => goTo("/story")}>
                    Neue Story zaubern
                  </TaleaActionButton>
                  <TaleaActionButton variant="secondary" icon={<BookOpen className="h-4 w-4" />} onClick={() => goTo("/stories")}>
                    Bibliothek oeffnen
                  </TaleaActionButton>
                  <TaleaActionButton variant="secondary" icon={<Library className="h-4 w-4" />} onClick={() => goTo("/doku/create")}>
                    Wissensreise starten
                  </TaleaActionButton>
                </div>

                <div className={cn(taleaInsetSurfaceClass, "grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_12rem] sm:p-5")}>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8f7284] dark:text-[#d2c5ff]">Heute im Fokus</p>
                    <h2 className="mt-3 text-[2rem] font-semibold leading-tight text-slate-900 dark:text-white" style={{ fontFamily: headingFont }}>
                      Ein leiser Start mit klarer Richtung.
                    </h2>
                    <p className="mt-3 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                      Statt vieler gleich lauter Kacheln fuehrt Home zuerst durch das Wichtigste und laesst die naechste Aktion wie eine Empfehlung wirken.
                    </p>
                  </div>

                  <div className="grid gap-2.5">
                    {[
                      { label: "Story", text: "Neue Fantasiereise", icon: <WandSparkles className="h-4 w-4" />, path: "/story" },
                      { label: "Avatar", text: "Helden bereitmachen", icon: <UserPlus className="h-4 w-4" />, path: "/avatar" },
                      { label: "Doku", text: "Wissen sanft entdecken", icon: <Library className="h-4 w-4" />, path: "/doku" },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => goTo(item.path)}
                        className="flex min-h-11 items-center justify-between gap-3 rounded-[20px] border border-white/75 bg-white/80 px-4 py-3 text-left shadow-sm transition hover:bg-white/92 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f6dce7_0%,#deefff_100%)] text-slate-700 dark:bg-[linear-gradient(135deg,rgba(111,84,114,0.48)_0%,rgba(65,96,131,0.36)_100%)] dark:text-white">
                            {item.icon}
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{item.label}</p>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.text}</p>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 content-start">
                {[
                  {
                    label: "Geschichten",
                    value: storiesTotal,
                    icon: <ScrollText className="h-5 w-5" />,
                    tone: "bg-[linear-gradient(135deg,#f8dde8_0%,#fbead1_100%)] dark:bg-[linear-gradient(135deg,rgba(109,84,114,0.5)_0%,rgba(92,76,55,0.38)_100%)]",
                  },
                  {
                    label: "Avatare",
                    value: avatars.length,
                    icon: <Swords className="h-5 w-5" />,
                    tone: "bg-[linear-gradient(135deg,#dff0ff_0%,#e2f4ec_100%)] dark:bg-[linear-gradient(135deg,rgba(65,98,130,0.46)_0%,rgba(47,89,79,0.32)_100%)]",
                  },
                  {
                    label: "Dokus",
                    value: dokusTotal,
                    icon: <Library className="h-5 w-5" />,
                    tone: "bg-[linear-gradient(135deg,#fbe9cf_0%,#efe5fb_100%)] dark:bg-[linear-gradient(135deg,rgba(92,77,52,0.46)_0%,rgba(88,69,123,0.34)_100%)]",
                  },
                ].map((item) => (
                  <div key={item.label} className={cn(taleaInsetSurfaceClass, "p-4 sm:p-5")}>
                    <div className="flex items-start justify-between gap-4">
                      <div className={cn("flex h-12 w-12 items-center justify-center rounded-[18px] text-slate-700 dark:text-white", item.tone)}>
                        {item.icon}
                      </div>
                      <span className="text-[2.2rem] font-semibold text-slate-900 dark:text-white" style={{ fontFamily: headingFont }}>
                        {item.value}
                      </span>
                    </div>
                    <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-5 sm:gap-6">
        <motion.div variants={itemVariants} className={cn(taleaSurfaceClass, "p-4 sm:p-5")}>
          <div className={cn(taleaInsetSurfaceClass, "space-y-4 p-4 sm:p-5")}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8f7284] dark:text-[#d2c5ff]">Atelierpfad</p>
              <h2 className="mt-3 text-[2rem] font-semibold leading-tight text-slate-900 dark:text-white" style={{ fontFamily: headingFont }}>
                Nicht klicken, sondern gefuehrt werden.
              </h2>
              <p className="mt-3 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                Jede naechste Aktion wirkt wie ein sanfter Vorschlag, nicht wie ein uebliches Shortcut-Panel.
              </p>
            </div>

            <div className="grid gap-3">
              {[
                { title: "Eine Story beginnen", text: "Direkt in den Generator.", icon: <WandSparkles className="h-5 w-5" />, path: "/story" },
                { title: "Helden pflegen", text: "Avatare neu anlegen oder ueberarbeiten.", icon: <UserPlus className="h-5 w-5" />, path: "/avatar" },
                { title: "Wissen sammeln", text: "Neue Dokus fuer neugierige Kinder starten.", icon: <Library className="h-5 w-5" />, path: "/doku" },
              ].map((item) => (
                <button key={item.title} type="button" onClick={() => goTo(item.path)} className={cn(taleaInsetSurfaceClass, "flex items-start gap-4 p-4 text-left sm:p-5")}>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#f5dce8_0%,#e5f2ff_100%)] text-slate-700 dark:bg-[linear-gradient(135deg,rgba(111,84,114,0.45)_0%,rgba(65,96,131,0.36)_100%)] dark:text-white">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white">{item.title}</p>
                    <p className="mt-1 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">{item.text}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className={cn(taleaSurfaceClass, "overflow-hidden p-2")}>
          <div className={cn(taleaInsetSurfaceClass, "overflow-hidden p-0")}>
            <CosmosHomeCard isDark={isDark} cosmosState={cosmosState} />
          </div>
        </motion.div>
      </div>
    </section>

    <section className={cn(taleaSurfaceClass, "p-4 sm:p-5 md:p-6")}>
      <div className="relative z-10 space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-end">
        <TaleaSectionHeading
          eyebrow="Start mit Geschichten"
          title="Eine groessere Buehne fuer die wichtigsten Abenteuer"
          subtitle="Home zeigt nicht mehr nur Kacheln, sondern fuehrt zuerst zur bedeutendsten Story und ordnet den Rest wie kuratierte Empfehlungen darum herum."
          actionLabel="Alle Stories"
          onAction={() => goTo("/stories")}
        />
        <div className={cn(taleaInsetSurfaceClass, "p-4 sm:p-5")}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8f7284] dark:text-[#d2c5ff]">Kuratiert</p>
          <p className="mt-3 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
            {storiesTotal} Geschichten stehen jetzt nicht mehr nebeneinander, sondern wirken wie bewusst ausgewaehlte Titel in einer kleinen Auslage.
          </p>
        </div>
      </div>

      {stories.length === 0 ? (
        <EmptyStateContainer
          title="Das erste Abenteuer bekommt hier seine grosse Karte"
          description="Sobald eine Geschichte angelegt ist, landet sie als Hero in einer ruhigen Bibliotheksansicht statt in einer normalen Standardliste."
          icon={<BookOpen className="h-12 w-12 text-blue-500 dark:text-indigo-300" />}
          colorClass="bg-blue-100 dark:bg-slate-700"
          actionLabel="Erste Story erstellen"
          onAction={() => goTo("/story")}
        />
      ) : (
        <div className="grid gap-5 sm:gap-6 xl:grid-cols-[1.28fr_0.92fr]">
          <StoryCard
            story={stories[0]}
            index={0}
            onRead={() => goTo(`/story-reader/${stories[0].id}`)}
            onDelete={() => onDeleteStory(stories[0].id, stories[0].title)}
            canSaveOffline={canUseOffline}
            isSavedOffline={isStorySaved(stories[0].id)}
            isSavingOffline={isSaving(stories[0].id)}
            onToggleOffline={(event) => {
              event.stopPropagation();
              toggleStory(stories[0].id);
            }}
          />

          <div className="grid gap-4">
            <button type="button" onClick={() => goTo("/story")} className={cn(taleaSurfaceClass, "overflow-hidden p-5 text-left sm:p-6")}>
              <p className={cn(taleaChipClass, "border-white/80 bg-white/86 text-[#9d7d8f] dark:border-white/10 dark:bg-white/5 dark:text-[#d2c5ff]")}>Neue Szene</p>
              <h3 className="mt-4 text-[1.9rem] font-semibold leading-tight text-slate-900 dark:text-white" style={{ fontFamily: headingFont }}>
                Eine weitere Geschichte vorbereiten
              </h3>
              <p className="mt-4 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                Die rechte Spalte kombiniert Erstellen und Entdecken statt leerem Fuellmaterial.
              </p>
            </button>

            {stories.slice(1, 4).map((story, index) => (
              <StoryCard
                key={story.id}
                story={story}
                index={index + 1}
                onRead={() => goTo(`/story-reader/${story.id}`)}
                onDelete={() => onDeleteStory(story.id, story.title)}
                canSaveOffline={canUseOffline}
                isSavedOffline={isStorySaved(story.id)}
                isSavingOffline={isSaving(story.id)}
                onToggleOffline={(event) => {
                  event.stopPropagation();
                  toggleStory(story.id);
                }}
              />
            ))}
          </div>
        </div>
      )}
      </div>
    </section>

    <section className="space-y-6">
      <TaleaSectionHeading
        eyebrow="Heldenkartei"
        title="Avatare wirken wie sorgfaeltig ausgelegte Charakterkarten"
        subtitle="Die Figurenleiste bleibt funktional, fuehlt sich aber weniger nach Standard-Slider und mehr nach kuratierter Galerie an."
        actionLabel="Alle Avatare"
        onAction={() => goTo("/avatar")}
      />

      {avatars.length === 0 ? (
        <EmptyStateContainer
          title="Der erste Held darf den neuen Kartenstil eroeffnen"
          description="Lege einen Avatar an, damit Home zu einer echten Charaktergalerie wird."
          icon={<UserPlus className="h-12 w-12 text-pink-500 dark:text-pink-300" />}
          colorClass="bg-pink-100 dark:bg-slate-700"
          actionLabel="Avatar erstellen"
          onAction={() => goTo(createAvatarPath)}
        />
      ) : (
        <div className="-mx-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
          <div className="flex gap-3.5 pb-4 sm:gap-4">
            <button type="button" onClick={() => goTo(createAvatarPath)} className={cn(taleaSurfaceClass, "w-[8.9rem] shrink-0 p-4 text-left sm:w-44 sm:p-6")}>
              <div className={cn(taleaInsetSurfaceClass, "flex h-full min-h-[170px] flex-col items-center justify-center gap-4 p-5 text-center sm:min-h-[180px] sm:p-6")}>
                <Plus className="h-10 w-10 text-slate-700 dark:text-white" />
                <p className="text-lg font-semibold text-slate-900 dark:text-white">Neuer Held</p>
              </div>
            </button>

            {avatars.map((avatar) => (
              <AvatarTile
                key={avatar.id}
                avatar={avatar}
                onOpen={() => goTo(`/avatar/edit/${avatar.id}`)}
                onDelete={() => onDeleteAvatar(avatar)}
              />
            ))}
          </div>
        </div>
      )}
    </section>

    <section className="space-y-6">
      <TaleaSectionHeading
        eyebrow="Wissensgarten"
        title="Dokus stehen visuell gleichwertig neben den Geschichten"
        subtitle="Auch die Wissenswelt wird als eigener hochwertiger Bereich inszeniert, mit grosser Themenkarte und flankierenden Eintraegen."
        actionLabel="Alle Dokus"
        onAction={() => goTo("/doku")}
      />

      {dokus.length === 0 ? (
        <EmptyStateContainer
          title="Hier waechst bald eine kleine Wissensbibliothek"
          description="Sobald die erste Doku erstellt ist, erscheint sie in derselben wertigen Kartenlogik wie die Stories."
          icon={<Library className="h-12 w-12 text-yellow-500 dark:text-yellow-300" />}
          colorClass="bg-yellow-100 dark:bg-slate-700"
          actionLabel="Erste Doku erstellen"
          onAction={() => goTo("/doku/create")}
        />
      ) : (
        <div className="grid gap-5 sm:gap-6 xl:grid-cols-[1.22fr_0.98fr]">
          <DokuBentoTicket
            doku={dokus[0]}
            onRead={() => goTo(`/doku-reader/${dokus[0].id}`)}
            onDelete={() => onDeleteDoku(dokus[0].id, dokus[0].title)}
          />

          <div className="grid gap-4">
            <button type="button" onClick={() => goTo("/doku/create")} className={cn(taleaSurfaceClass, "overflow-hidden p-5 text-left sm:p-6")}>
              <p className={cn(taleaChipClass, "border-white/80 bg-white/86 text-[#9d7d50] dark:border-white/10 dark:bg-white/5 dark:text-[#f0c989]")}>Neues Thema</p>
              <h3 className="mt-4 text-[1.9rem] font-semibold leading-tight text-slate-900 dark:text-white" style={{ fontFamily: headingFont }}>
                Eine neue Entdeckungsreise anlegen
              </h3>
              <p className="mt-4 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                Dokus sind kein Anhang mehr, sondern Teil derselben sorgfaeltigen Seitendramaturgie.
              </p>
            </button>

            {dokus.slice(1, 3).map((doku) => (
              <DokuBentoTicket
                key={doku.id}
                doku={doku}
                onRead={() => goTo(`/doku-reader/${doku.id}`)}
                onDelete={() => onDeleteDoku(doku.id, doku.title)}
              />
            ))}
          </div>
        </div>
      )}
    </section>

  </motion.div>
);

const TaleaHomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackend();
  const { user, isLoaded, isSignedIn } = useUser();
  const childProfiles = useOptionalChildProfiles();
  const activeProfileId = childProfiles?.activeProfileId;
  const activeProfile = childProfiles?.activeProfile ?? null;
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const { canUseOffline, isStorySaved, isSaving, toggleStory } = useOffline();
  const reduceMotion = useReducedMotion();
  const isDark = resolvedTheme === "dark";
  const { cosmosState } = useCosmosState();

  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [dokus, setDokus] = useState<Doku[]>([]);
  const [storiesTotal, setStoriesTotal] = useState(0);
  const [dokusTotal, setDokusTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Guten Morgen";
    if (hour < 18) return "Guten Tag";
    return "Guten Abend";
  }, []);
  const createAvatarPath = useMemo(() => {
    if (!activeProfile || activeProfile.childAvatarId) {
      return "/avatar/create";
    }

    return activeProfileId
      ? `/avatar/create?mode=child&profileId=${encodeURIComponent(activeProfileId)}`
      : "/avatar/create?mode=child";
  }, [activeProfile, activeProfileId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [avatarsResponse, storiesResponse, dokusResponse] = await Promise.all([
        backend.avatar.list({ profileId: activeProfileId || undefined }),
        backend.story.list({ limit: 12, offset: 0, profileId: activeProfileId || undefined }),
        backend.doku.listDokus({ limit: 8, offset: 0, profileId: activeProfileId || undefined }),
      ]);

      const normalizedAvatars: Avatar[] = (avatarsResponse.avatars || []).map((avatar) => ({
        id: avatar.id,
        name: avatar.name,
        imageUrl: avatar.imageUrl,
        creationType: avatar.creationType,
        avatarRole: avatar.avatarRole,
      }));

      const normalizedStories: Story[] = (storiesResponse.stories || []).map((storyItem) => {
        const summary =
          "summary" in storyItem && typeof storyItem.summary === "string"
            ? storyItem.summary
            : storyItem.description || "";
        const isPublic =
          "isPublic" in storyItem && typeof storyItem.isPublic === "boolean"
            ? storyItem.isPublic
            : false;
        const rawConfig = storyItem.config as Partial<StoryConfig> & {
          setting?: string;
        };
        const normalizedConfig: StoryConfig = {
          genre: rawConfig.genre || "adventure",
          style: rawConfig.style || rawConfig.setting || "classic",
          ageGroup: rawConfig.ageGroup || "6-8",
          moral: rawConfig.moral,
          avatars: rawConfig.avatars || [],
          characters: rawConfig.characters || [],
        };

        return {
          id: storyItem.id,
          userId: storyItem.userId,
          title: storyItem.title,
          summary,
          description: storyItem.description,
          config: normalizedConfig,
          coverImageUrl: storyItem.coverImageUrl || undefined,
          status: storyItem.status,
          isPublic,
          avatarDevelopments: storyItem.avatarDevelopments,
          metadata: storyItem.metadata,
          createdAt: normalizeDate(storyItem.createdAt),
          updatedAt: normalizeDate(storyItem.updatedAt),
        };
      });

      const normalizedDokus: Doku[] = (dokusResponse.dokus || []).map((dokuItem) => ({
        id: dokuItem.id,
        title: dokuItem.title,
        topic: dokuItem.topic,
        coverImageUrl: dokuItem.coverImageUrl || undefined,
        status: dokuItem.status,
        createdAt: normalizeDate(dokuItem.createdAt),
      }));

      setAvatars(normalizedAvatars);
      setStories(normalizedStories);
      setDokus(normalizedDokus);
      setStoriesTotal(storiesResponse.total ?? normalizedStories.length);
      setDokusTotal(dokusResponse.total ?? normalizedDokus.length);
    } catch (error) {
      console.error("Error loading home data:", error);
    } finally {
      setLoading(false);
    }
  }, [backend, activeProfileId]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn || !user) {
      setAvatars([]);
      setStories([]);
      setDokus([]);
      setStoriesTotal(0);
      setDokusTotal(0);
      setLoading(false);
      return;
    }

    void loadData();
  }, [isLoaded, isSignedIn, user?.id, loadData, activeProfileId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDeleteAvatar = useCallback(async (avatar: Avatar) => {
    if (!window.confirm(`"${avatar.name}" wirklich loeschen?`)) return;

    try {
      await backend.avatar.deleteAvatar({ id: avatar.id, profileId: activeProfileId || undefined });
      if (avatar.avatarRole === "child" || avatar.id === activeProfile?.childAvatarId) {
        await childProfiles?.refresh();
      }
      setAvatars((prev) => prev.filter((item) => item.id !== avatar.id));
    } catch (error) {
      console.error("Error deleting avatar:", error);
    }
  }, [activeProfile?.childAvatarId, activeProfileId, backend.avatar, childProfiles]);

  const handleDeleteStory = async (storyId: string, storyTitle: string) => {
    if (!window.confirm(`${t("common.delete", "Loeschen")} "${storyTitle}"?`)) return;

    try {
      await backend.story.deleteStory({ id: storyId, profileId: activeProfileId || undefined });
      setStories((prev) => prev.filter((story) => story.id !== storyId));
    } catch (error) {
      console.error("Error deleting story:", error);
    }
  };

  const handleDeleteDoku = async (dokuId: string, dokuTitle: string) => {
    if (!window.confirm(`${t("common.delete", "Loeschen")} "${dokuTitle}"?`)) return;

    try {
      await backend.doku.deleteDoku({ id: dokuId, profileId: activeProfileId || undefined });
      setDokus((prev) => prev.filter((doku) => doku.id !== dokuId));
    } catch (error) {
      console.error("Error deleting doku:", error);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="relative min-h-screen">
        <KidsAppBackground isDark={isDark} />
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden pb-24 sm:pb-28" style={{ fontFamily: bodyFont }}>
      <KidsAppBackground isDark={isDark} />

      <SignedOut>
        <PremiumSignedOutStart />
      </SignedOut>

      <SignedIn>
        <HomeSignedInContent
          isDark={isDark}
          greeting={greeting}
          userName={user?.firstName}
          stories={stories}
          storiesTotal={storiesTotal}
          avatars={avatars}
          dokus={dokus}
          dokusTotal={dokusTotal}
          createAvatarPath={createAvatarPath}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          goTo={navigate}
          onDeleteStory={handleDeleteStory}
          onDeleteAvatar={handleDeleteAvatar}
          onDeleteDoku={handleDeleteDoku}
          canUseOffline={canUseOffline}
          isStorySaved={isStorySaved}
          isSaving={isSaving}
          toggleStory={toggleStory}
          cosmosState={cosmosState}
        />
        {false && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-7xl space-y-12 px-4 pt-6 md:px-8 mt-4"
        >
          {/* Bento Hero Section */}
          <section className="grid lg:grid-cols-3 gap-6">
            {/* Welcome Main Block */}
            <motion.div variants={itemVariants} className="lg:col-span-2">
              <Card className="h-full overflow-hidden rounded-[3rem] border-[6px] border-white/80 dark:border-slate-700 bg-white/70 dark:bg-slate-800/80 shadow-[0_20px_50px_-12px_rgba(6,182,212,0.2)] dark:shadow-indigo-900/40 backdrop-blur-2xl">
                <CardContent className="p-8 md:p-12 relative h-full flex flex-col justify-center">
                  <div className="absolute -top-24 -right-24 w-80 h-80 bg-cyan-200/40 dark:bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
                  
                  <div className="flex flex-wrap items-start justify-between gap-6 mb-8 relative z-10">
                    <div className="flex items-center gap-5">
                      <div className="rounded-[2rem] border-[6px] border-white dark:border-slate-600 bg-white shadow-xl p-1">
                        <UserButton
                          afterSignOutUrl="/"
                          userProfileMode="navigation"
                          userProfileUrl="/settings"
                          appearance={{ elements: { avatarBox: "h-16 w-16" } }}
                        />
                      </div>
                      <div>
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="inline-flex items-center gap-2 rounded-full border-2 border-white/80 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-4 py-1.5 shadow-sm mb-2"
                        >
                          <Sparkles className="h-4 w-4 text-pink-500" />
                          <span className="text-xs font-black tracking-widest text-indigo-500 dark:text-indigo-300 uppercase">
                            TALEA ATELIER
                          </span>
                        </motion.div>
                        <h1
                          className="text-4xl font-black text-slate-800 dark:text-white md:text-5xl tracking-tight"
                          style={{ fontFamily: headingFont }}
                        >
                          {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600 dark:from-pink-400 dark:to-cyan-400">{user?.firstName || "Entdecker"}!</span>
                        </h1>
                      </div>
                    </div>
                    
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 180 }}
                      whileTap={{ scale: 0.9 }}
                      type="button"
                      onClick={handleRefresh}
                      className="rounded-[1.5rem] border-4 border-white/80 dark:border-slate-700 bg-white/80 dark:bg-slate-800 p-4 shadow-lg backdrop-blur-md text-cyan-600 dark:text-cyan-400"
                      aria-label="Aktualisieren"
                    >
                      <RefreshCw className={cn("h-6 w-6", refreshing && "animate-spin")} />
                    </motion.button>
                  </div>

                  <p className="max-w-2xl text-lg font-extrabold leading-relaxed text-slate-500 dark:text-slate-300 relative z-10">
                    Das Magie-Labor ist bereit! Erschaffe neue Helden, webe die verrücktesten Geschichten und sammle unendlich viel Wissen. 
                  </p>

                  <div className="mt-10 flex flex-wrap gap-4 relative z-10">
                    <motion.button
                      whileHover={{ scale: 1.05, y: -4 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={() => navigate("/story")}
                      className="inline-flex items-center gap-3 rounded-[2rem] bg-gradient-to-r from-cyan-400 to-blue-500 px-8 py-4 text-lg font-black text-white shadow-xl shadow-cyan-300/50 border-4 border-white/20"
                    >
                      <WandSparkles className="h-6 w-6" />
                      Story zaubern
                    </motion.button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Cosmos Card Block */}
            <motion.div variants={itemVariants} className="lg:col-span-1 rounded-[3rem] overflow-hidden shadow-[0_20px_50px_-12px_rgba(100,60,200,0.25)] dark:shadow-indigo-900/40 h-full flex flex-col">
               <CosmosHomeCard isDark={isDark} cosmosState={cosmosState} />
            </motion.div>
          </section>

          {/* Quick Stats Bento Row */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <motion.div variants={itemVariants} className="col-span-1">
              <motion.div
                whileHover={{ y: -5, scale: 1.02 }}
                className="h-full flex flex-col justify-center rounded-[2.5rem] border-[4px] border-white/80 dark:border-slate-700 bg-gradient-to-br from-pink-100 to-pink-200/50 dark:from-slate-800 dark:to-slate-800 p-6 shadow-lg backdrop-blur-xl cursor-default"
              >
                <div className="h-12 w-12 rounded-[1.2rem] bg-white/60 dark:bg-slate-700 flex items-center justify-center mb-4 shadow-sm text-pink-500">
                   <ScrollText className="h-6 w-6" />
                </div>
                <p className="text-sm font-black uppercase tracking-widest text-pink-500 dark:text-pink-300">Geschichten</p>
                <p className="mt-1 text-5xl font-black text-slate-800 dark:text-white">{storiesTotal}</p>
              </motion.div>
            </motion.div>

            <motion.div variants={itemVariants} className="col-span-1">
              <motion.div
                whileHover={{ y: -5, scale: 1.02 }}
                className="h-full flex flex-col justify-center rounded-[2.5rem] border-[4px] border-white/80 dark:border-slate-700 bg-gradient-to-br from-cyan-100 to-cyan-200/50 dark:from-slate-800 dark:to-slate-800 p-6 shadow-lg backdrop-blur-xl cursor-default"
              >
                <div className="h-12 w-12 rounded-[1.2rem] bg-white/60 dark:bg-slate-700 flex items-center justify-center mb-4 shadow-sm text-cyan-500">
                   <Swords className="h-6 w-6" />
                </div>
                <p className="text-sm font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-300">Avatare</p>
                <p className="mt-1 text-5xl font-black text-slate-800 dark:text-white">{avatars.length}</p>
              </motion.div>
            </motion.div>

            <motion.div variants={itemVariants} className="col-span-1">
              <motion.div
                whileHover={{ y: -5, scale: 1.02 }}
                className="h-full flex flex-col justify-center rounded-[2.5rem] border-[4px] border-white/80 dark:border-slate-700 bg-gradient-to-br from-yellow-100 to-yellow-200/50 dark:from-slate-800 dark:to-slate-800 p-6 shadow-lg backdrop-blur-xl cursor-default"
              >
                 <div className="h-12 w-12 rounded-[1.2rem] bg-white/60 dark:bg-slate-700 flex items-center justify-center mb-4 shadow-sm text-yellow-500">
                   <Zap className="h-6 w-6" />
                </div>
                <p className="text-sm font-black uppercase tracking-widest text-yellow-600 dark:text-yellow-400">Dokus</p>
                <p className="mt-1 text-5xl font-black text-slate-800 dark:text-white">{dokusTotal}</p>
              </motion.div>
            </motion.div>

            <motion.div variants={itemVariants} className="col-span-1">
               <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={() => navigate("/stories")}
                  className="h-full w-full flex flex-col justify-between rounded-[2.5rem] border-[4px] border-white/80 dark:border-slate-700 bg-gradient-to-br from-purple-400 to-indigo-500 p-6 text-left shadow-lg dark:from-indigo-600 dark:to-purple-700 group"
                >
                  <div className="h-12 w-12 rounded-[1.2rem] bg-white/30 flex items-center justify-center mb-4 shadow-sm text-white">
                     <Star className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-widest text-purple-100">Bibliothek</p>
                    <p className="mt-1 inline-flex items-center gap-2 text-2xl font-black text-white group-hover:gap-4 transition-all">
                      Zeig alles
                      <ArrowRight className="h-6 w-6" />
                    </p>
                  </div>
                </motion.button>
            </motion.div>
          </section>

          {/* Stories Section */}
          <section className="mt-12">
            <SectionHeading
              title="Deine neuesten Abenteuer"
              subtitle={`${storiesTotal} wundervolle Geschichten drängen sich im Regal`}
              icon={<BookOpen className="h-7 w-7" />}
              actionLabel="Alle ansehen"
              onAction={() => navigate("/stories")}
            />

            {stories.length === 0 ? (
              <EmptyStateContainer
                title="Die Seiten sind noch leer"
                description="Erschaffe dein allererstes Abenteuer! Mit einem Klick auf 'Story zaubern' kann die Magie sofort beginnen."
                icon={<BookOpen className="h-12 w-12 text-blue-500 dark:text-indigo-400" />}
                colorClass="bg-blue-100 dark:bg-slate-700"
                actionLabel="Zur Geschichten-Magie!"
                onAction={() => navigate("/story")}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
                {stories.slice(0, 5).map((story, index) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    index={index}
                    onRead={() => navigate(`/story-reader/${story.id}`)}
                    onDelete={() => handleDeleteStory(story.id, story.title)}
                    canSaveOffline={canUseOffline}
                    isSavedOffline={isStorySaved(story.id)}
                    isSavingOffline={isSaving(story.id)}
                    onToggleOffline={(event) => { event.stopPropagation(); toggleStory(story.id); }}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Avatars Scroll Row */}
          <section className="mt-12">
            <SectionHeading
              title="Deine Helden"
              subtitle={`${avatars.length} bunte Charaktere bevölkern deine Welt`}
              icon={<Swords className="h-7 w-7" />}
              actionLabel="Alle Helden"
              onAction={() => navigate("/avatar")}
            />

            {avatars.length === 0 ? (
              <EmptyStateContainer
                title="Noch keine Helden hier"
                description="Erwecke deinen ersten Avatar zum Leben, damit er spannende Abenteuer erleben kann!"
                icon={<UserPlus className="h-12 w-12 text-pink-500 dark:text-pink-400" />}
                colorClass="bg-pink-100 dark:bg-slate-700"
                actionLabel="Held erschaffen"
                onAction={() => navigate("/avatar/create")}
              />
            ) : (
              <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="flex overflow-x-auto pb-10 pt-4 gap-4 sm:gap-6 hide-scrollbar snap-x">
                  <AnimatePresence>
                    <motion.button
                      variants={itemVariants}
                      whileHover={{ y: -8, scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={() => navigate("/avatar/create")}
                      className="snap-start shrink-0 w-36 h-48 sm:w-44 sm:h-56 flex flex-col items-center justify-center rounded-[2.5rem] border-[4px] border-dashed border-pink-300 dark:border-slate-600 bg-pink-50/50 dark:bg-slate-800/40 p-4 text-center shadow-lg backdrop-blur-xl"
                    >
                      <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-white dark:bg-slate-700 shadow-xl text-pink-500 border-4 border-pink-100 dark:border-slate-600">
                        <Plus className="h-10 w-10" />
                      </div>
                      <p className="mt-4 text-lg font-black text-pink-600 dark:text-slate-100">Neuer Held</p>
                    </motion.button>

                    {avatars.map((avatar) => (
                      <div className="snap-start shrink-0" key={avatar.id}>
                        <AvatarTile
                          avatar={avatar}
                          onOpen={() => navigate(`/avatar/edit/${avatar.id}`)}
                          onDelete={() => handleDeleteAvatar(avatar.id, avatar.name)}
                        />
                      </div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </section>

          {/* Doku Bento Section */}
          <section className="mt-8">
            <SectionHeading
              title="Wissenswelt"
              subtitle={`${dokusTotal} faszinierende Dinge gelernt`}
              icon={<Library className="h-7 w-7" />}
              actionLabel="Alles Wissen"
              onAction={() => navigate("/doku")}
            />

            {dokus.length === 0 ? (
              <EmptyStateContainer
                title="Noch kein Wissen gesammelt"
                description="Starte deine erste Entdeckungsreise und lerne tolle Fakten über die Welt!"
                icon={<Library className="h-12 w-12 text-yellow-500 dark:text-yellow-400" />}
                colorClass="bg-yellow-100 dark:bg-slate-700"
                actionLabel="Wissen sammeln"
                onAction={() => navigate("/doku/create")}
              />
            ) : (
              <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
                 <motion.button
                    variants={itemVariants}
                    whileHover={{ y: -4, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => navigate("/doku/create")}
                    className="h-full min-h-[140px] flex items-center justify-center gap-4 rounded-[2rem] border-[4px] border-dashed border-yellow-300 dark:border-slate-600 bg-yellow-50/50 dark:bg-slate-800/40 p-6 text-center shadow-md backdrop-blur-xl"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-white dark:bg-slate-700 shadow-md text-yellow-500">
                      <Plus className="h-8 w-8" />
                    </div>
                    <p className="text-xl font-black text-yellow-600 dark:text-slate-100">Neues Thema <br/>erforschen</p>
                  </motion.button>

                {dokus.slice(0, 3).map((doku) => (
                  <DokuBentoTicket
                    key={doku.id}
                    doku={doku}
                    onRead={() => navigate(`/doku-reader/${doku.id}`)}
                    onDelete={() => handleDeleteDoku(doku.id, doku.title)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* CSS to hide scrollbar but keep functionality */}
          <style dangerouslySetInnerHTML={{ __html: `
            .hide-scrollbar::-webkit-scrollbar {
              display: none;
            }
            .hide-scrollbar {
              -ms-overflow-style: none; /* IE and Edge */
              scrollbar-width: none;  /* Firefox */
            }
          `}} />
        </motion.div>
        )}
      </SignedIn>
    </div>
  );
};

export default TaleaHomeScreen;
