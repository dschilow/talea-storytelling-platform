import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
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
} from "lucide-react";

import { useBackend } from "../../hooks/useBackend";
import type { Story, StoryConfig } from "../../types/story";
import { cn } from "@/lib/utils";
import { StoryParticipantsDialog } from "@/components/story/StoryParticipantsDialog";
import taleaLogo from "@/img/talea_logo.png";
import { useTheme } from "@/contexts/ThemeContext";
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

const KidsAppBackground: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
    {isDark ? (
      <div className="absolute inset-0 bg-[#0f172a]">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[20%] -right-[10%] h-[60%] w-[60%] rounded-full bg-indigo-900/30 blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            x: [0, -40, 0],
            y: [0, 50, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-[20%] -left-[10%] h-[50%] w-[50%] rounded-full bg-teal-900/20 blur-[100px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            x: [0, -30, 0],
            y: [0, -40, 0],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 4 }}
          className="absolute -bottom-[10%] left-[20%] h-[70%] w-[70%] rounded-full bg-purple-900/30 blur-[130px]"
        />
      </div>
    ) : (
      <div className="absolute inset-0 bg-gradient-to-br from-[#fdfbfb] to-[#f4f7fb]">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[20%] -right-[10%] h-[60%] w-[60%] rounded-full bg-pink-200/50 blur-[100px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            x: [0, -40, 0],
            y: [0, 50, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-[20%] -left-[10%] h-[50%] w-[50%] rounded-full bg-yellow-100/60 blur-[100px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            x: [0, -30, 0],
            y: [0, -40, 0],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 4 }}
          className="absolute -bottom-[10%] left-[20%] h-[70%] w-[70%] rounded-full bg-cyan-100/50 blur-[120px]"
        />
      </div>
    )}
  </div>
);

const LoadingState: React.FC = () => (
  <div className="flex min-h-[62vh] items-center justify-center">
    <div className="relative">
      <motion.div 
        animate={{ y: [0, -15, 0], scale: [1, 1.05, 1] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        className="inline-flex flex-col items-center gap-4 rounded-[2rem] border-4 border-white/60 dark:border-white/10 bg-white/40 dark:bg-slate-800/40 p-10 shadow-2xl shadow-pink-200/40 dark:shadow-indigo-900/40 backdrop-blur-md"
      >
        <div className="relative">
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="absolute inset-0 rounded-full bg-pink-300 blur-xl"
          />
          <motion.div
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
            className="relative z-10 rounded-full bg-gradient-to-br from-pink-100 to-cyan-100 p-4 shadow-inner dark:from-indigo-400 dark:to-purple-500"
          >
            <WandSparkles className="h-10 w-10 text-pink-500 dark:text-white" />
          </motion.div>
        </div>
        <span className="text-xl font-bold text-pink-500 dark:text-indigo-300" style={{ fontFamily: headingFont }}>Magie wird geladen...</span>
      </motion.div>
    </div>
  </div>
);

const SignedOutStart: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-5">
      <Card className="w-full max-w-3xl rounded-[2.5rem] border-4 border-white/60 dark:border-white/10 bg-white/40 dark:bg-slate-900/60 p-2 shadow-2xl shadow-pink-200/30 dark:shadow-indigo-900/30 backdrop-blur-xl">
        <CardContent className="grid gap-8 rounded-[2rem] bg-white/60 dark:bg-slate-800/60 p-8 md:grid-cols-[1.25fr_1fr] md:p-10">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-3 rounded-full border-2 border-white/80 dark:border-white/10 bg-white/80 dark:bg-slate-700/80 px-4 py-2 shadow-sm">
              <img src={taleaLogo} alt="Talea Logo" className="h-7 w-7 rounded-xl object-cover shadow-sm" />
              <p className="text-sm font-bold tracking-widest text-indigo-400 dark:text-indigo-300">TALEA STUDIO</p>
            </div>
            <h1
              className="mt-6 text-4xl font-extrabold leading-tight text-slate-800 dark:text-slate-100 md:text-5xl"
              style={{ fontFamily: headingFont }}
            >
              Geschichten gestalten,
              <br />
              <span className="text-pink-400 dark:text-purple-400">mit Magie erleben ✨</span>
            </h1>
            <p className="mt-5 max-w-xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-300">
              {t(
                "home.subtitle",
                "Organisiere Avatare, Geschichten und Dokus in einer wunderbaren Umgebung für die besten Leseabenteuer."
              )}
            </p>
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => navigate("/auth")}
              className="mt-8 inline-flex w-fit items-center gap-3 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-400 px-8 py-4 text-base font-bold text-white shadow-lg shadow-pink-300/50 dark:shadow-purple-900/50"
            >
              <LogIn className="h-5 w-5" />
              Jetzt anmelden
            </motion.button>
          </div>

          <div className="flex flex-col justify-center rounded-[2rem] border-2 border-white/60 dark:border-white/10 bg-gradient-to-br from-pink-50 to-cyan-50 dark:from-slate-800 dark:to-indigo-950 p-6 shadow-inner">
            <p className="text-center text-sm font-bold tracking-widest text-pink-400 dark:text-indigo-300">
              ENTDECKE
            </p>
            <ul className="mt-6 flex flex-col gap-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <motion.li whileHover={{ x: 5 }} className="flex items-center gap-3 rounded-2xl border-2 border-white/60 dark:border-white/10 bg-white/70 dark:bg-slate-700/50 px-4 py-3 shadow-sm backdrop-blur-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-100 text-cyan-500 dark:bg-cyan-900 dark:text-cyan-300">📚</span>
                Story-Streams mit Teilnehmern
              </motion.li>
              <motion.li whileHover={{ x: 5 }} className="flex items-center gap-3 rounded-2xl border-2 border-white/60 dark:border-white/10 bg-white/70 dark:bg-slate-700/50 px-4 py-3 shadow-sm backdrop-blur-sm">
                 <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-100 text-pink-500 dark:bg-pink-900 dark:text-pink-300">🦸‍♀️</span>
                Schneller Zugriff auf Avatare
              </motion.li>
              <motion.li whileHover={{ x: 5 }} className="flex items-center gap-3 rounded-2xl border-2 border-white/60 dark:border-white/10 bg-white/70 dark:bg-slate-700/50 px-4 py-3 shadow-sm backdrop-blur-sm">
                 <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 text-yellow-500 dark:bg-yellow-900 dark:text-yellow-300">💡</span>
                Dokus im gleichen Stil
              </motion.li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const SectionHeading: React.FC<{
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, subtitle, actionLabel, onAction }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-4 pl-2">
    <div>
      <h2
        className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 md:text-4xl"
        style={{ fontFamily: headingFont }}
      >
        {title}
      </h2>
      <p className="mt-1 text-base font-semibold text-slate-500 dark:text-slate-400">{subtitle}</p>
    </div>
    {actionLabel && onAction && (
      <motion.button
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-2 rounded-2xl border-2 border-white/80 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 px-5 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 shadow-sm backdrop-blur-sm transition-colors"
      >
        {actionLabel}
        <ArrowRight className="h-4 w-4 text-cyan-400 dark:text-cyan-300" />
      </motion.button>
    )}
  </div>
);

const StoryStatusTag: React.FC<{ status: Story["status"] }> = ({ status }) => (
  <span
    className={cn(
      "rounded-full border-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider backdrop-blur-md shadow-sm",
      status === "complete" && "border-white/50 bg-emerald-100/90 text-emerald-600 dark:bg-emerald-900/80 dark:text-emerald-300 dark:border-emerald-700/50",
      status === "generating" && "border-white/50 bg-amber-100/90 text-amber-600 dark:bg-amber-900/80 dark:text-amber-300 dark:border-amber-700/50",
      status === "error" && "border-white/50 bg-rose-100/90 text-rose-600 dark:bg-rose-900/80 dark:text-rose-300 dark:border-rose-700/50"
    )}
  >
    {storyStatusLabel[status]}
  </span>
);

const StoryCard: React.FC<{
  story: Story;
  onRead: () => void;
  onDelete: () => void;
  canSaveOffline?: boolean;
  isSavedOffline?: boolean;
  isSavingOffline?: boolean;
  onToggleOffline?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}> = ({ story, onRead, onDelete, canSaveOffline, isSavedOffline, isSavingOffline, onToggleOffline }) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      whileHover={reduceMotion ? undefined : { y: -8, scale: 1.01 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", bounce: 0.5 }}
      className="group cursor-pointer"
      onClick={onRead}
    >
      <Card className="overflow-hidden rounded-[2rem] border-4 border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 shadow-xl shadow-pink-100/40 dark:shadow-indigo-900/20 backdrop-blur-xl transition-all group-hover:shadow-2xl group-hover:shadow-pink-200/50 dark:group-hover:shadow-indigo-900/50">
        <div className="relative h-56 overflow-hidden rounded-t-[1.5rem] p-2">
          <div className="h-full w-full overflow-hidden rounded-3xl">
            {story.coverImageUrl ? (
              <img
                src={story.coverImageUrl}
                alt={story.title}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-100 to-cyan-100 dark:from-slate-700 dark:to-indigo-900 text-pink-300 dark:text-indigo-400">
                <BookOpen className="h-14 w-14" />
              </div>
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/10 to-transparent" />
          </div>

          <div className="absolute left-5 top-5">
            <StoryStatusTag status={story.status} />
          </div>

          <div className="absolute right-5 top-5 flex items-center gap-2">
            {canSaveOffline && story.status === "complete" && onToggleOffline && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={onToggleOffline}
                disabled={isSavingOffline}
                className="rounded-2xl border-2 border-white/30 bg-black/30 p-2.5 text-white backdrop-blur-md transition-colors hover:bg-cyan-500/80"
                aria-label={isSavedOffline ? "Offline-Speicherung entfernen" : "Offline speichern"}
              >
                {isSavingOffline ? (
                  <Clock3 className="h-4 w-4 animate-spin" />
                ) : isSavedOffline ? (
                  <BookmarkCheck className="h-4 w-4 text-cyan-300" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="rounded-2xl border-2 border-white/30 bg-black/30 p-2.5 text-white backdrop-blur-md transition-colors hover:bg-rose-500/80"
              aria-label="Story loeschen"
            >
              <Trash2 className="h-4 w-4" />
            </motion.button>
          </div>
        </div>

        <CardContent className="space-y-4 p-6">
          <div className="space-y-2">
            <h3
              className="line-clamp-2 text-2xl font-bold leading-tight text-slate-800 dark:text-slate-100"
              style={{ fontFamily: headingFont }}
            >
              {story.title}
            </h3>
            <p className="line-clamp-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
              {story.summary || story.description || "Noch keine Zusammenfassung verfuegbar."}
            </p>
          </div>

          <StoryParticipantsDialog story={story} maxVisible={4} />

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{formatDate(story.createdAt)}</span>
            <span className="rounded-xl bg-pink-100 px-3 py-1.5 text-xs font-bold text-pink-500 dark:bg-pink-900/50 dark:text-pink-300">Loslesen ✨</span>
          </div>
        </CardContent>
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
    whileHover={{ y: -6, scale: 1.02 }}
    whileTap={{ scale: 0.96 }}
    transition={{ type: "spring", bounce: 0.5 }}
    role="button"
    tabIndex={0}
    onClick={onOpen}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen();
      }
    }}
    className="group relative overflow-hidden rounded-[2rem] border-4 border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 p-5 text-center shadow-xl shadow-cyan-100/40 dark:shadow-indigo-900/20 backdrop-blur-md"
  >
    <div className="relative mx-auto inline-block">
      <div className="h-20 w-20 overflow-hidden rounded-[1.5rem] border-4 border-white dark:border-slate-700 shadow-md">
        <img
          src={
            avatar.imageUrl ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(avatar.name)}`
          }
          alt={avatar.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      </div>
      <span className="absolute -bottom-2 -right-2 rounded-xl border-2 border-white bg-gradient-to-r from-pink-400 to-purple-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm dark:border-slate-800">
        {avatar.creationType === "ai-generated" ? "AI ✨" : "Foto"}
      </span>
      <span className="sr-only">{avatar.name}</span>
    </div>

    <p className="mt-5 truncate text-base font-bold text-slate-800 dark:text-slate-100">{avatar.name}</p>
    <p className="mt-1 text-xs font-semibold text-slate-400 dark:text-slate-500">Zum Bearbeiten</p>

    <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        className="rounded-xl bg-white/80 p-2 text-rose-500 shadow-sm backdrop-blur-sm dark:bg-slate-700/80 dark:text-rose-400"
        aria-label={`${avatar.name} loeschen`}
      >
        <Trash2 className="h-4 w-4" />
      </motion.button>
    </div>
  </motion.article>
);

const DokuRow: React.FC<{
  doku: Doku;
  onRead: () => void;
  onDelete: () => void;
}> = ({ doku, onRead, onDelete }) => (
  <motion.article
    whileHover={{ x: 6 }}
    whileTap={{ scale: 0.98 }}
    className="group cursor-pointer rounded-[2rem] border-4 border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 p-4 shadow-xl shadow-yellow-100/30 dark:shadow-indigo-900/20 backdrop-blur-md"
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
    <div className="flex items-center gap-4">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[1.5rem] border-4 border-white/80 dark:border-slate-700 bg-gradient-to-br from-yellow-100 to-orange-100 dark:from-slate-700 dark:to-indigo-900 shadow-sm">
        {doku.coverImageUrl ? (
          <img src={doku.coverImageUrl} alt={doku.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-orange-300 dark:text-indigo-400">
            <Library className="h-8 w-8" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 pt-1">
            <p className="line-clamp-1 text-lg font-bold text-slate-800 dark:text-slate-100">{doku.title}</p>
            <p className="mt-1 line-clamp-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{doku.topic}</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="rounded-xl border-2 border-rose-100 bg-rose-50 p-2 text-rose-500 opacity-0 transition-opacity group-hover:opacity-100 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-400"
            aria-label="Doku loeschen"
          >
            <Trash2 className="h-4 w-4" />
          </motion.button>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs font-bold">
          <span className="rounded-xl bg-white/80 px-3 py-1 uppercase tracking-wider text-slate-500 shadow-sm dark:bg-slate-700/80 dark:text-slate-300">
            {dokuStatusLabel[doku.status]}
          </span>
          <span className="text-slate-400 dark:text-slate-500">{formatDate(doku.createdAt)}</span>
        </div>
      </div>
    </div>
  </motion.article>
);

const EmptyBlock: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, description, actionLabel, onAction }) => (
  <Card className="rounded-[2rem] border-4 border-dashed border-white/80 dark:border-white/10 bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm">
    <CardContent className="flex flex-col items-center p-10 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-pink-100 text-pink-400 dark:bg-slate-700 dark:text-indigo-400">
        <WandSparkles className="h-10 w-10" />
      </div>
      <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: headingFont }}>
        {title}
      </h3>
      <p className="mx-auto mt-3 max-w-md text-base font-medium text-slate-500 dark:text-slate-400">{description}</p>
      {actionLabel && onAction && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={onAction}
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-400 px-6 py-3 text-base font-bold text-white shadow-lg shadow-pink-200/50"
        >
          {actionLabel}
        </motion.button>
      )}
    </CardContent>
  </Card>
);

const TaleaHomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackend();
  const { user, isLoaded, isSignedIn } = useUser();
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

  const loadData = async () => {
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
  };

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      loadData();
    } else if (isLoaded && !isSignedIn) {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDeleteAvatar = async (avatarId: string, avatarName: string) => {
    if (!window.confirm(`\"${avatarName}\" wirklich loeschen?`)) return;

    try {
      await backend.avatar.deleteAvatar({ id: avatarId });
      setAvatars((prev) => prev.filter((avatar) => avatar.id !== avatarId));
    } catch (error) {
      console.error("Error deleting avatar:", error);
    }
  };

  const handleDeleteStory = async (storyId: string, storyTitle: string) => {
    if (!window.confirm(`${t("common.delete", "Loeschen")} \"${storyTitle}\"?`)) return;

    try {
      await backend.story.deleteStory({ id: storyId });
      setStories((prev) => prev.filter((story) => story.id !== storyId));
    } catch (error) {
      console.error("Error deleting story:", error);
    }
  };

  const handleDeleteDoku = async (dokuId: string, dokuTitle: string) => {
    if (!window.confirm(`${t("common.delete", "Loeschen")} \"${dokuTitle}\"?`)) return;

    try {
      await backend.doku.deleteDoku({ id: dokuId });
      setDokus((prev) => prev.filter((doku) => doku.id !== dokuId));
    } catch (error) {
      console.error("Error deleting doku:", error);
    }
  };

  if (!isLoaded) {
    return (
      <div className="relative min-h-screen">
        <KidsAppBackground isDark={isDark} />
        <LoadingState />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="relative min-h-screen">
        <KidsAppBackground isDark={isDark} />
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-32" style={{ fontFamily: bodyFont }}>
      <KidsAppBackground isDark={isDark} />

      <SignedOut>
        <SignedOutStart />
      </SignedOut>

      <SignedIn>
        <div className="mx-auto max-w-7xl space-y-12 px-4 pt-8 md:px-8">
          <motion.section
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <Card className="overflow-hidden rounded-[2.5rem] border-4 border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-800/80 shadow-2xl shadow-cyan-100/40 dark:shadow-indigo-900/30 backdrop-blur-xl">
              <CardContent className="grid gap-8 p-8 md:p-10 lg:grid-cols-[1.35fr_1fr]">
                <div>
                  <div className="mb-6 inline-flex w-fit items-center gap-3 rounded-full border-2 border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-700/80 px-4 py-2 shadow-sm">
                    <img src={taleaLogo} alt="Talea Logo" className="h-6 w-6 rounded-lg object-cover" />
                    <span className="text-xs font-bold tracking-widest text-indigo-400 dark:text-indigo-300">
                      TALEA ZAUBERWELT
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="rounded-[1.5rem] border-4 border-white/80 dark:border-slate-700 bg-white shadow-sm p-1">
                        <UserButton
                          afterSignOutUrl="/"
                          userProfileMode="navigation"
                          userProfileUrl="/settings"
                          appearance={{ elements: { avatarBox: "h-14 w-14" } }}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-bold uppercase tracking-widest text-pink-400 dark:text-pink-300">{greeting},</p>
                        <h1
                          className="mt-1 text-4xl font-extrabold text-slate-800 dark:text-slate-100 md:text-5xl"
                          style={{ fontFamily: headingFont }}
                        >
                          {user?.firstName || "Talea Entdecker"}! ✨
                        </h1>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={handleRefresh}
                      className="inline-flex items-center gap-2 rounded-2xl border-2 border-white/80 dark:border-white/10 bg-white/60 dark:bg-slate-700/80 px-5 py-3 text-sm font-bold text-slate-600 dark:text-slate-200 shadow-sm backdrop-blur-sm transition-colors"
                    >
                      <RefreshCw
                        className={cn("h-4 w-4 text-cyan-500", refreshing && "animate-spin")}
                      />
                      Aktualisieren
                    </motion.button>
                  </div>

                  <p className="mt-8 max-w-2xl text-base font-semibold leading-relaxed text-slate-500 dark:text-slate-300">
                    Willkommen im Atelier! Hier kannst du zauberhafte Geschichten erschaffen, 
                    neue Begleiter erwecken und spannendes Wissen sammeln. Alles in einer wunderschönen Welt.
                  </p>

                  <div className="mt-8 flex flex-wrap gap-4">
                    <motion.button
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={() => navigate("/story")}
                      className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-cyan-300/50"
                    >
                      <WandSparkles className="h-5 w-5" />
                      Neue Story zaubern
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={() => navigate("/avatar/create")}
                      className="inline-flex items-center gap-3 rounded-2xl border-2 border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-700/80 px-6 py-3.5 text-base font-bold text-slate-700 dark:text-slate-200 shadow-sm backdrop-blur-sm"
                    >
                      <UserPlus className="h-5 w-5 text-pink-400" />
                      Avatar erstellen
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={() => navigate("/doku/create")}
                      className="inline-flex items-center gap-3 rounded-2xl border-2 border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-700/80 px-6 py-3.5 text-base font-bold text-slate-700 dark:text-slate-200 shadow-sm backdrop-blur-sm"
                    >
                      <Library className="h-5 w-5 text-yellow-500" />
                      Doku schreiben
                    </motion.button>
                  </div>
                </div>

                <div className="flex flex-col gap-6">
                  <div className="rounded-[2rem] overflow-hidden shadow-lg shadow-pink-100/50 dark:shadow-indigo-900/30">
                    <TaleaJourneyCard isDark={resolvedTheme === 'dark'} avatarId={avatars[0]?.id} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col rounded-[1.5rem] border-2 border-white/60 dark:border-white/10 bg-gradient-to-br from-pink-50 to-pink-100/50 dark:from-slate-700 dark:to-slate-800 p-5 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-widest text-pink-400 dark:text-pink-300">
                        Geschichten
                      </p>
                      <p className="mt-2 text-4xl font-extrabold text-slate-800 dark:text-white">{storiesTotal}</p>
                    </div>
                    <div className="flex flex-col rounded-[1.5rem] border-2 border-white/60 dark:border-white/10 bg-gradient-to-br from-cyan-50 to-cyan-100/50 dark:from-slate-700 dark:to-slate-800 p-5 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-widest text-cyan-400 dark:text-cyan-300">
                        Avatare
                      </p>
                      <p className="mt-2 text-4xl font-extrabold text-slate-800 dark:text-white">{avatars.length}</p>
                    </div>
                    <div className="flex flex-col rounded-[1.5rem] border-2 border-white/60 dark:border-white/10 bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-slate-700 dark:to-slate-800 p-5 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-widest text-yellow-500 dark:text-yellow-400">
                        Dokus
                      </p>
                      <p className="mt-2 text-4xl font-extrabold text-slate-800 dark:text-white">{dokusTotal}</p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => navigate("/stories")}
                      className="flex flex-col justify-between rounded-[1.5rem] border-2 border-white/60 dark:border-white/10 bg-gradient-to-br from-purple-100 to-pink-100 p-5 text-left shadow-sm dark:from-indigo-900/50 dark:to-purple-900/50"
                    >
                      <p className="text-xs font-bold uppercase tracking-widest text-purple-500 dark:text-purple-300">
                        Bibliothek
                      </p>
                      <p className="mt-2 inline-flex items-center gap-2 text-base font-bold text-slate-800 dark:text-white">
                        Alle zeigen
                        <ArrowRight className="h-5 w-5" />
                      </p>
                    </motion.button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          <section>
            <SectionHeading
              title="Aktuelle Abenteuer ✨"
              subtitle={`${storiesTotal} wundervolle Geschichten warten auf dich`}
              actionLabel="Alle ansehen"
              onAction={() => navigate("/stories")}
            />

            {stories.length === 0 ? (
              <EmptyBlock
                title="Die Seiten sind noch leer..."
                description="Erschaffe dein allererstes Abenteuer! Mit einem Klick auf 'Neue Story' kann die Magie beginnen."
                actionLabel="Zur Geschichten-Magie!"
                onAction={() => navigate("/story")}
              />
            ) : (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                {stories.slice(0, 6).map((story) => (
                  <StoryCard
                    key={story.id}
                    story={story}
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

          <section className="grid grid-cols-1 gap-12 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <SectionHeading
                title="Deine Helden 🦸‍♀️"
                subtitle={`${avatars.length} bunte Charaktere in deiner Welt`}
                actionLabel="Alle Helden"
                onAction={() => navigate("/avatar")}
              />

              {avatars.length === 0 ? (
                <EmptyBlock
                  title="Noch keine Helden hier"
                  description="Erwecke deinen ersten Avatar zum Leben, damit er spannende Abenteuer erleben kann!"
                  actionLabel="Helden erschaffen"
                  onAction={() => navigate("/avatar/create")}
                />
              ) : (
                <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
                  {avatars.slice(0, 5).map((avatar) => (
                    <AvatarTile
                      key={avatar.id}
                      avatar={avatar}
                      onOpen={() => navigate(`/avatar/edit/${avatar.id}`)}
                      onDelete={() => handleDeleteAvatar(avatar.id, avatar.name)}
                    />
                  ))}

                  <motion.button
                    whileHover={{ y: -6, scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                    type="button"
                    onClick={() => navigate("/avatar/create")}
                    className="flex flex-col items-center justify-center rounded-[2rem] border-4 border-dashed border-white/80 dark:border-white/10 bg-white/40 dark:bg-slate-800/40 p-6 text-center shadow-sm backdrop-blur-sm"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-pink-100 text-pink-500 shadow-inner dark:bg-slate-700 dark:text-pink-400">
                      <Plus className="h-8 w-8" />
                    </div>
                    <p className="mt-4 text-base font-bold text-slate-800 dark:text-slate-100">Neuer Held</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Jetzt erschaffen</p>
                  </motion.button>
                </div>
              )}
            </div>

            <div>
              <SectionHeading
                title="Wissenswelt 💡"
                subtitle={`${dokusTotal} faszinierende Dinge gelernt`}
                actionLabel="Alles Wissen"
                onAction={() => navigate("/doku")}
              />

              {dokus.length === 0 ? (
                <EmptyBlock
                  title="Noch kein Wissen gesammelt"
                  description="Starte deine erste Entdeckungsreise und sammle tolles Wissen!"
                  actionLabel="Wissen sammeln"
                  onAction={() => navigate("/doku/create")}
                />
              ) : (
                <div className="space-y-4">
                  {dokus.slice(0, 4).map((doku) => (
                    <DokuRow
                      key={doku.id}
                      doku={doku}
                      onRead={() => navigate(`/doku-reader/${doku.id}`)}
                      onDelete={() => handleDeleteDoku(doku.id, doku.title)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </SignedIn>
    </div>
  );
};

export default TaleaHomeScreen;

