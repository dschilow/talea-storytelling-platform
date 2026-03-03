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
import TaleaJourneyCard from '../Journey/TaleaJourneyCard';
import { useOffline } from "@/contexts/OfflineStorageContext";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

interface Avatar {
  id: string;
  name: string;
  imageUrl?: string;
  creationType: "ai-generated" | "photo-upload";
}

interface Doku {
  id: string;
  title: string;
  topic: string;
  coverImageUrl?: string;
  status: "generating" | "complete" | "error";
  createdAt: string;
}

const headingFont = '"Nunito", "Quicksand", "Fredoka", sans-serif';
const bodyFont = '"Nunito", "Quicksand", "Fredoka", sans-serif';

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
  <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
    {isDark ? (
      <div className="absolute inset-0 bg-[#0f172a]">
        <motion.div animate={{ scale: [1, 1.1, 1], x: [0, 50, 0], y: [0, 30, 0] }} transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }} className="absolute -top-[20%] -right-[10%] h-[60%] w-[60%] rounded-full bg-indigo-900/40 blur-[120px]" />
        <motion.div animate={{ scale: [1, 1.2, 1], x: [0, -40, 0], y: [0, 50, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }} className="absolute top-[20%] -left-[10%] h-[50%] w-[50%] rounded-full bg-teal-900/30 blur-[100px]" />
        <motion.div animate={{ scale: [1, 1.1, 1], x: [0, -30, 0], y: [0, -40, 0] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 4 }} className="absolute -bottom-[10%] left-[20%] h-[70%] w-[70%] rounded-full bg-purple-900/40 blur-[130px]" />
      </div>
    ) : (
      <div className="absolute inset-0 bg-gradient-to-br from-[#fdfbfb] to-[#f4f7fb]">
        <motion.div animate={{ scale: [1, 1.1, 1], x: [0, 50, 0], y: [0, 30, 0] }} transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }} className="absolute -top-[20%] -right-[10%] h-[60%] w-[60%] rounded-full bg-pink-200/60 blur-[100px]" />
        <motion.div animate={{ scale: [1, 1.2, 1], x: [0, -40, 0], y: [0, 50, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }} className="absolute top-[20%] -left-[10%] h-[50%] w-[50%] rounded-full bg-yellow-100/70 blur-[100px]" />
        <motion.div animate={{ scale: [1, 1.1, 1], x: [0, -30, 0], y: [0, -40, 0] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 4 }} className="absolute -bottom-[10%] left-[20%] h-[70%] w-[70%] rounded-full bg-cyan-100/60 blur-[120px]" />
      </div>
    )}
    
    {/* Floating Elements layer */}
    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 mix-blend-overlay"></div>
  </div>
);

const LoadingState: React.FC = () => (
  <div className="flex min-h-[62vh] items-center justify-center">
    <div className="relative">
      <motion.div 
        animate={{ y: [0, -15, 0], scale: [1, 1.05, 1] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        className="inline-flex flex-col items-center gap-4 rounded-[2.5rem] border-4 border-white/80 dark:border-white/20 bg-white/60 dark:bg-slate-800/60 p-12 shadow-2xl shadow-pink-200/50 dark:shadow-indigo-900/50 backdrop-blur-xl"
      >
        <div className="relative">
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="absolute inset-0 rounded-full bg-pink-300 blur-2xl"
          />
          <motion.div
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
            className="relative z-10 rounded-full bg-gradient-to-br from-pink-200 to-cyan-200 p-5 shadow-inner dark:from-indigo-500 dark:to-purple-500"
          >
            <WandSparkles className="h-12 w-12 text-pink-600 dark:text-white" />
          </motion.div>
        </div>
        <span className="text-2xl font-extrabold text-pink-600 dark:text-indigo-300" style={{ fontFamily: headingFont }}>Magie wird geladen...</span>
      </motion.div>
    </div>
  </div>
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
      "absolute -top-3 -right-3 rotate-3 rounded-2xl border-4 px-4 py-2 text-sm font-black uppercase tracking-wider backdrop-blur-md shadow-xl z-20",
      status === "complete" && "border-white bg-gradient-to-r from-emerald-400 to-teal-400 text-white dark:border-emerald-700/50",
      status === "generating" && "border-white bg-gradient-to-r from-amber-400 to-orange-400 text-white dark:border-amber-700/50",
      status === "error" && "border-white bg-gradient-to-r from-rose-500 to-pink-500 text-white dark:border-rose-700/50"
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

      <Card className="h-full overflow-hidden rounded-[2.5rem] border-[6px] border-white/80 dark:border-slate-700 bg-white/70 dark:bg-slate-800/80 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.1)] dark:shadow-indigo-900/30 backdrop-blur-xl transition-all group-hover:shadow-[0_25px_50px_-12px_rgba(236,72,153,0.3)] dark:group-hover:shadow-indigo-900/60">
        <div className={cn("flex h-full", isFeatured ? "flex-col sm:flex-row" : "flex-col")}>
          <div className={cn(
            "relative overflow-hidden p-3", 
            isFeatured ? "sm:w-1/2 sm:p-4" : "h-56"
          )}>
            <div className="h-full w-full overflow-hidden rounded-[2rem] border-4 border-white/50 shadow-inner">
              {story.coverImageUrl ? (
                <img
                  src={story.coverImageUrl}
                  alt={story.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110 group-hover:rotate-1"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-200 to-cyan-200 dark:from-slate-700 dark:to-indigo-900 text-pink-400 dark:text-indigo-400">
                  <BookOpen className="h-16 w-16" />
                </div>
              )}
              
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/10 to-transparent" />
            </div>

            <div className="absolute left-6 bottom-6 flex items-center gap-2 z-10">
              {canSaveOffline && story.status === "complete" && onToggleOffline && (
                <motion.button
                  whileHover={{ scale: 1.15, rotate: 5 }}
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={onToggleOffline}
                  disabled={isSavingOffline}
                  className="rounded-full border-2 border-white/30 bg-black/40 p-3 text-white backdrop-blur-md transition-colors hover:bg-cyan-500/90 shadow-lg"
                  aria-label={isSavedOffline ? "Offline-Speicherung entfernen" : "Offline speichern"}
                >
                  {isSavingOffline ? (
                    <Clock3 className="h-5 w-5 animate-spin" />
                  ) : isSavedOffline ? (
                    <BookmarkCheck className="h-5 w-5 text-cyan-300" />
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
                className="rounded-full border-2 border-white/30 bg-black/40 p-3 text-white backdrop-blur-md transition-colors hover:bg-rose-500/90 shadow-lg"
                aria-label="Story loeschen"
              >
                <Trash2 className="h-5 w-5" />
              </motion.button>
            </div>
          </div>

          <CardContent className={cn("flex flex-col justify-between p-6", isFeatured ? "sm:w-1/2 sm:p-8 sm:pr-10" : "")}>
            <div className="space-y-3">
              <h3
                className="text-2xl font-black leading-tight text-slate-800 dark:text-slate-100 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors line-clamp-2"
                style={{ fontFamily: headingFont }}
              >
                {story.title}
              </h3>
              <p className={cn(
                "font-bold text-slate-500 dark:text-slate-400",
                isFeatured ? "text-base line-clamp-4" : "text-sm line-clamp-2"
              )}>
                {story.summary || story.description || "Noch keine Zusammenfassung verfügbar."}
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <StoryParticipantsDialog story={story} maxVisible={isFeatured ? 6 : 4} />

              <div className="flex items-center justify-between pt-2 border-t-2 border-slate-100/50 dark:border-slate-700/50 mt-4">
                <span className="text-sm font-extrabold text-slate-400 dark:text-slate-500">{formatDate(story.createdAt)}</span>
                <span className="rounded-2xl bg-gradient-to-r from-pink-400 to-purple-400 px-4 py-2 text-sm font-black text-white shadow-md group-hover:shadow-lg transition-shadow">
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
    whileHover={{ y: -8, scale: 1.05 }}
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
    className="group relative flex-shrink-0 w-36 h-48 sm:w-44 sm:h-56 flex flex-col items-center justify-center rounded-[2.5rem] border-[6px] border-white/80 dark:border-slate-700 bg-white/80 dark:bg-slate-800 p-4 text-center shadow-[0_10px_30px_-10px_rgba(6,182,212,0.3)] dark:shadow-indigo-900/30 backdrop-blur-xl"
  >
    <div className="relative mx-auto inline-block mb-3">
      <div className="h-24 w-24 sm:h-28 sm:w-28 overflow-hidden rounded-full border-4 border-white dark:border-slate-600 shadow-[0_8px_20px_-5px_rgba(0,0,0,0.2)] bg-gradient-to-br from-pink-100 to-cyan-100">
        <img
          src={
            avatar.imageUrl ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(avatar.name)}`
          }
          alt={avatar.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      </div>
      <span className="absolute -bottom-1 -right-1 rounded-2xl border-[3px] border-white dark:border-slate-800 bg-gradient-to-r from-pink-500 to-purple-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg">
        {avatar.creationType === "ai-generated" ? "AI ✨" : "Foto 📸"}
      </span>
    </div>

    <p className="w-full truncate text-lg font-black text-slate-800 dark:text-slate-100 px-2">{avatar.name}</p>
    
    <div className="absolute -top-3 -left-3 opacity-0 transition-all duration-300 scale-50 group-hover:opacity-100 group-hover:scale-100 z-10">
      <motion.button
        whileHover={{ scale: 1.15, rotate: -10 }}
        whileTap={{ scale: 0.9 }}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        className="rounded-full bg-white p-2.5 text-rose-500 shadow-xl border-2 border-rose-100 dark:bg-slate-700 dark:text-rose-400 dark:border-rose-900/50"
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
    className="group cursor-pointer relative overflow-hidden rounded-[2rem] border-[4px] border-white/80 dark:border-slate-700 bg-white/70 dark:bg-slate-800/80 p-5 shadow-lg shadow-yellow-100/40 dark:shadow-indigo-900/20 backdrop-blur-xl"
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
    <div className="flex items-center gap-5">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[1.5rem] border-4 border-white/90 dark:border-slate-600 bg-gradient-to-br from-yellow-200 to-orange-300 dark:from-slate-700 dark:to-indigo-800 shadow-inner">
        {doku.coverImageUrl ? (
          <img src={doku.coverImageUrl} alt={doku.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-orange-600 dark:text-indigo-300">
            <Library className="h-8 w-8" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex justify-between items-start gap-2">
          <div>
            <p className="line-clamp-1 text-xl font-black text-slate-800 dark:text-slate-100 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">{doku.title}</p>
            <p className="mt-1 line-clamp-1 text-sm font-extrabold text-slate-500 dark:text-slate-400">{doku.topic}</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.15, rotate: 10 }}
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="shrink-0 rounded-full border-2 border-rose-100 bg-rose-50 p-2.5 text-rose-500 opacity-0 transition-opacity group-hover:opacity-100 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-400 z-10"
            aria-label="Doku loeschen"
          >
            <Trash2 className="h-4 w-4" />
          </motion.button>
        </div>

        <div className="mt-4 flex items-center gap-3 text-xs font-black">
          <span className={cn(
             "rounded-2xl px-3 py-1.5 uppercase tracking-wider text-white shadow-sm z-10",
             doku.status === "complete" ? "bg-emerald-500" : doku.status === "generating" ? "bg-amber-500" : "bg-rose-500"
          )}>
            {dokuStatusLabel[doku.status]}
          </span>
          <span className="text-slate-400 dark:text-slate-500">{formatDate(doku.createdAt)}</span>
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
    <Card className="overflow-hidden rounded-[3rem] border-4 border-dashed border-white/80 dark:border-slate-700 bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl">
      <CardContent className="flex flex-col items-center justify-center p-12 text-center">
        <motion.div 
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className={cn("mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] shadow-inner", colorClass)}
        >
          {icon}
        </motion.div>
        <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100" style={{ fontFamily: headingFont }}>
          {title}
        </h3>
        <p className="mx-auto mt-4 max-w-md text-lg font-bold text-slate-500 dark:text-slate-400">{description}</p>
        {actionLabel && onAction && (
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={onAction}
            className="mt-8 inline-flex items-center gap-3 rounded-[2rem] bg-gradient-to-r from-pink-500 to-purple-500 px-8 py-4 text-lg font-black text-white shadow-xl shadow-pink-300/50"
          >
            {actionLabel}
          </motion.button>
        )}
      </CardContent>
    </Card>
  </motion.div>
);

const TaleaHomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackend();
  const { user, isLoaded, isSignedIn } = useUser();
  const activeProfileId = useOptionalChildProfiles()?.activeProfileId;
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const { canUseOffline, isStorySaved, isSaving, toggleStory } = useOffline();
  const reduceMotion = useReducedMotion();
  const isDark = resolvedTheme === "dark";

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

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [avatarsResponse, storiesResponse, dokusResponse] = await Promise.all([
        backend.avatar.list(),
        backend.story.list({ limit: 12, offset: 0 }),
        backend.doku.listDokus({ limit: 8, offset: 0 }),
      ]);

      const normalizedAvatars: Avatar[] = (avatarsResponse.avatars || []).map((avatar) => ({
        id: avatar.id,
        name: avatar.name,
        imageUrl: avatar.imageUrl,
        creationType: avatar.creationType,
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
  }, [backend]);

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

  const handleDeleteAvatar = async (avatarId: string, avatarName: string) => {
    if (!window.confirm(`"${avatarName}" wirklich loeschen?`)) return;

    try {
      await backend.avatar.deleteAvatar({ id: avatarId });
      setAvatars((prev) => prev.filter((avatar) => avatar.id !== avatarId));
    } catch (error) {
      console.error("Error deleting avatar:", error);
    }
  };

  const handleDeleteStory = async (storyId: string, storyTitle: string) => {
    if (!window.confirm(`${t("common.delete", "Loeschen")} "${storyTitle}"?`)) return;

    try {
      await backend.story.deleteStory({ id: storyId });
      setStories((prev) => prev.filter((story) => story.id !== storyId));
    } catch (error) {
      console.error("Error deleting story:", error);
    }
  };

  const handleDeleteDoku = async (dokuId: string, dokuTitle: string) => {
    if (!window.confirm(`${t("common.delete", "Loeschen")} "${dokuTitle}"?`)) return;

    try {
      await backend.doku.deleteDoku({ id: dokuId });
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
    <div className="relative min-h-screen pb-32 overflow-x-hidden" style={{ fontFamily: bodyFont }}>
      <KidsAppBackground isDark={isDark} />

      <SignedOut>
        <SignedOutStart />
      </SignedOut>

      <SignedIn>
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

            {/* Journey Card Block */}
            <motion.div variants={itemVariants} className="lg:col-span-1 border-[6px] border-white/80 dark:border-slate-700 rounded-[3rem] overflow-hidden shadow-[0_20px_50px_-12px_rgba(236,72,153,0.2)] dark:shadow-indigo-900/40 bg-white/50 dark:bg-slate-800/50 backdrop-blur-xl h-full flex flex-col">
               <div className="p-6 pb-0 flex-grow h-full">
                 <TaleaJourneyCard isDark={resolvedTheme === 'dark'} avatarId={avatars[0]?.id} />
               </div>
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
      </SignedIn>
    </div>
  );
};

export default TaleaHomeScreen;
