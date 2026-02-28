import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Clock3,
  Download,
  Grid3X3,
  LayoutList,
  Plus,
  Search,
  Trash2,
  Sparkles
} from "lucide-react";

import { useBackend } from "../../hooks/useBackend";
import { exportStoryAsPDF, isPDFExportSupported } from "../../utils/pdfExport";
import type { Story } from "../../types/story";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StoryParticipantsDialog } from "@/components/story/StoryParticipantsDialog";
import ProgressiveImage from "@/components/common/ProgressiveImage";
import { cn } from "@/lib/utils";
import taleaLogo from "@/img/talea_logo.png";
import { useTheme } from "@/contexts/ThemeContext";
import { useOptionalUserAccess } from "@/contexts/UserAccessContext";
import { useOffline } from "@/contexts/OfflineStorageContext";
import TaleaStudioWorkspace from "./TaleaStudioWorkspace";

const headingFont = '"Nunito", "Quicksand", "Fredoka", sans-serif';
const bodyFont = '"Nunito", "Quicksand", "Fredoka", sans-serif';

type ViewMode = "grid" | "list";
type SortMode = "newest" | "oldest" | "title";
type ContentTab = "stories" | "studio";

const statusMeta: Record<Story["status"], { label: string; className: string }> = {
  complete: {
    label: "Fertig",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/50",
  },
  generating: {
    label: "In Arbeit",
    className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50",
  },
  error: {
    label: "Fehler",
    className: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800/50",
  },
};

const genreLabels: Record<string, string> = {
  fairy_tales: "Maerchen",
  adventure: "Abenteuer",
  magic: "Magie",
  animals: "Tiere",
  scifi: "Sci-Fi",
  modern: "Modern",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStoryPreviewText(story: Story) {
  return story.summary || story.description || "Noch keine Zusammenfassung verfuegbar.";
}

function normalizeKey(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
}

function getStoryGenreKey(story: Story): string {
  return normalizeKey(story.config?.genre);
}

function getStoryAgeGroupKey(story: Story): string {
  return normalizeKey(story.config?.ageGroup);
}

function getStoryLengthKey(story: Story): string {
  const length = normalizeKey((story.config as Story["config"] & { length?: string })?.length);
  if (length) return length;

  const chapterCount = story.chapters?.length ?? story.pages?.length ?? 0;
  if (chapterCount <= 3) return "short";
  if (chapterCount <= 6) return "medium";
  if (chapterCount > 6) return "long";
  return "";
}

function formatGenreLabel(genre: string): string {
  if (!genre) return "Unbekannt";
  if (genreLabels[genre]) return genreLabels[genre];
  return genre
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAgeLabel(ageGroup: string): string {
  if (!ageGroup) return "Unbekannt";
  return ageGroup;
}

function formatLengthLabel(length: string): string {
  if (length === "short") return "Kurz";
  if (length === "medium") return "Mittel";
  if (length === "long") return "Lang";
  return length || "Unbekannt";
}

type StoryAvatarFilterOption = {
  id: string;
  name: string;
};

function getStoryAvatarParticipants(story: Story): StoryAvatarFilterOption[] {
  const participants = new Map<string, string>();

  const addParticipant = (entry: unknown) => {
    if (!entry || typeof entry !== "object") return;

    const rawId = (entry as { id?: unknown }).id;
    const rawName = (entry as { name?: unknown }).name;
    const id = typeof rawId === "string" ? rawId.trim() : "";
    const name = typeof rawName === "string" ? rawName.trim() : "";

    if (!id) return;
    participants.set(id, name || id);
  };

  for (const participant of story.avatarParticipants || []) {
    addParticipant(participant);
  }

  for (const participant of story.config?.avatars || []) {
    addParticipant(participant);
  }

  return Array.from(participants.entries()).map(([id, name]) => ({ id, name }));
}

const KidsAppBackground: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#fdfbf7] dark:bg-[#111827]" aria-hidden>
    <div className="absolute inset-0 bg-white/40 dark:bg-transparent backdrop-blur-[100px] z-10" />
    <motion.div
      className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full opacity-60 dark:opacity-20 blur-3xl mix-blend-multiply dark:mix-blend-screen"
      style={{ background: isDark ? '#3730a3' : '#a7f3d0' }}
      animate={{ x: [0, 40, 0], y: [0, 30, 0], scale: [1, 1.1, 1] }}
      transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute top-[10%] -right-[10%] w-[60%] h-[60%] rounded-full opacity-60 dark:opacity-20 blur-3xl mix-blend-multiply dark:mix-blend-screen"
      style={{ background: isDark ? '#1e3a8a' : '#fecdd3' }}
      animate={{ x: [0, -30, 0], y: [0, 40, 0], scale: [1, 1.2, 1] }}
      transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute -bottom-[20%] left-[20%] w-[80%] h-[80%] rounded-full opacity-60 dark:opacity-20 blur-3xl mix-blend-multiply dark:mix-blend-screen"
      style={{ background: isDark ? '#115e59' : '#bfdbfe' }}
      animate={{ x: [0, -20, 0], y: [0, -30, 0], scale: [1, 1.1, 1] }}
      transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
    />
  </div>
);

const StoryStatusChip: React.FC<{ status: Story["status"] }> = ({ status }) => (
  <span
    className={cn(
      "inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider shadow-sm",
      statusMeta[status].className
    )}
  >
    {statusMeta[status].label}
  </span>
);

const GridStoryCard: React.FC<{
  story: Story;
  index: number;
  onRead: () => void;
  onDelete: () => void;
  canDownload: boolean;
  onDownloadPdf: (event: React.MouseEvent<HTMLButtonElement>) => void;
  isDownloading: boolean;
  canSaveOffline?: boolean;
  isSavedOffline?: boolean;
  isSavingOffline?: boolean;
  onToggleOffline?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}> = ({ story, index, onRead, onDelete, canDownload, onDownloadPdf, isDownloading, canSaveOffline, isSavedOffline, isSavingOffline, onToggleOffline }) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" }}
      whileHover={reduceMotion ? undefined : { y: -8, scale: 1.02 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      onClick={onRead}
      className="group cursor-pointer h-full"
    >
      <Card className="h-full flex flex-col overflow-hidden rounded-[2em] border-white/50 dark:border-white/10 bg-white/70 dark:bg-slate-800/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-all duration-300 border-2">
        <div className="relative h-56 shrink-0 overflow-hidden rounded-t-[2.5em]">
          <ProgressiveImage
            src={story.coverImageUrl}
            alt={story.title}
            revealDelayMs={index * 35}
            containerClassName="h-full w-full"
            imageClassName="transition-transform duration-700 ease-out group-hover:scale-105"
            fallback={
              <div className="flex h-full w-full items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-400">
                <BookOpen className="h-10 w-10 text-slate-300" />
              </div>
            }
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

          <div className="absolute left-4 top-4">
            <StoryStatusChip status={story.status} />
          </div>

          <div className="absolute right-4 top-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {canSaveOffline && story.status === "complete" && onToggleOffline && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={onToggleOffline}
                disabled={isSavingOffline}
                className="rounded-xl border border-white/20 bg-black/30 backdrop-blur-md p-2 text-white hover:bg-black/50 transition-colors shadow-sm"
                aria-label={isSavedOffline ? "Offline-Speicherung entfernen" : "Offline speichern"}
              >
                {isSavingOffline ? (
                  <Clock3 className="h-4 w-4 animate-spin" />
                ) : isSavedOffline ? (
                  <BookmarkCheck className="h-4 w-4 text-emerald-300" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </motion.button>
            )}
            {canDownload && story.status === "complete" && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={onDownloadPdf}
                className="rounded-xl border border-white/20 bg-black/30 backdrop-blur-md p-2 text-white hover:bg-black/50 transition-colors shadow-sm"
                aria-label="PDF herunterladen"
              >
                {isDownloading ? (
                  <Clock3 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
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
              className="rounded-xl border border-white/20 bg-rose-500/80 backdrop-blur-md p-2 text-white hover:bg-rose-600 transition-colors shadow-sm"
              aria-label="Story loeschen"
            >
              <Trash2 className="h-4 w-4" />
            </motion.button>
          </div>
        </div>

        <CardContent className="flex flex-col flex-1 p-6 space-y-4">
          <div className="space-y-2">
            <h3
              className="line-clamp-2 text-xl font-bold text-slate-800 dark:text-slate-100"
              style={{ fontFamily: headingFont }}
            >
              {story.title}
            </h3>
            <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400 font-medium">
              {getStoryPreviewText(story)}
            </p>
          </div>

          <div className="mt-auto pt-2">
            <StoryParticipantsDialog story={story} maxVisible={5} />
          </div>

          <div className="flex items-center justify-between pt-2 text-[13px] font-semibold text-slate-400 dark:text-slate-500">
            <span>{formatDate(story.createdAt)}</span>
            <span className="text-indigo-500 dark:text-indigo-400 flex items-center gap-1 group-hover:text-indigo-600 transition-colors">
              Loslesen <motion.span animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>→</motion.span>
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.article>
  );
};

const ListStoryRow: React.FC<{
  story: Story;
  index: number;
  onRead: () => void;
  onDelete: () => void;
  canDownload: boolean;
  onDownloadPdf: (event: React.MouseEvent<HTMLButtonElement>) => void;
  isDownloading: boolean;
  canSaveOffline?: boolean;
  isSavedOffline?: boolean;
  isSavingOffline?: boolean;
  onToggleOffline?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}> = ({ story, index, onRead, onDelete, canDownload, onDownloadPdf, isDownloading, canSaveOffline, isSavedOffline, isSavingOffline, onToggleOffline }) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, x: -20 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" }}
      whileHover={reduceMotion ? undefined : { y: -4, scale: 1.01 }}
      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
      onClick={onRead}
      className="group cursor-pointer"
    >
      <Card className="overflow-hidden rounded-[2em] border-white/50 dark:border-white/10 bg-white/70 dark:bg-slate-800/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_15px_35px_rgb(0,0,0,0.08)] transition-all duration-300 border-2">
        <div className="flex flex-col md:flex-row">
          <div className="relative h-48 w-full md:h-auto md:w-64 shrink-0 overflow-hidden p-2 rounded-[2em]">
            <div className="w-full h-full rounded-[1.5em] overflow-hidden relative">
                <ProgressiveImage
                  src={story.coverImageUrl}
                  alt={story.title}
                  revealDelayMs={index * 30}
                  containerClassName="h-full w-full"
                  imageClassName="transition-transform duration-700 ease-out group-hover:scale-105"
                  fallback={
                    <div className="flex h-full w-full items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-400">
                      <BookOpen className="h-10 w-10 text-slate-300" />
                    </div>
                  }
                />
            </div>
          </div>

          <div className="flex flex-1 flex-col p-6">
            <div className="flex items-start justify-between gap-4">
              <h3
                className="line-clamp-2 text-2xl font-bold text-slate-800 dark:text-slate-100"
                style={{ fontFamily: headingFont }}
              >
                {story.title}
              </h3>

              <div className="flex items-center gap-2 shrink-0">
                <StoryStatusChip status={story.status} />
                {canSaveOffline && story.status === "complete" && onToggleOffline && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    type="button"
                    onClick={onToggleOffline}
                    disabled={isSavingOffline}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    {isSavingOffline ? (
                      <Clock3 className="h-4 w-4 animate-spin" />
                    ) : isSavedOffline ? (
                      <BookmarkCheck className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                  </motion.button>
                )}
                {canDownload && story.status === "complete" && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    type="button"
                    onClick={onDownloadPdf}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    {isDownloading ? (
                      <Clock3 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
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
                  className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-white/50 dark:bg-slate-800/50 p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </motion.button>
              </div>
            </div>

            <p className="mt-3 line-clamp-2 text-base text-slate-500 dark:text-slate-400 font-medium">
              {getStoryPreviewText(story)}
            </p>

            <StoryParticipantsDialog story={story} maxVisible={6} className="mt-5" />

            <div className="mt-auto pt-4 flex items-center justify-between text-[13px] font-semibold text-slate-400">
              <span>{formatDate(story.createdAt)}</span>
              <span className="text-indigo-500 dark:text-indigo-400 flex items-center gap-1 group-hover:text-indigo-600 transition-colors">
                Loslesen <motion.span animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>→</motion.span>
              </span>
            </div>
          </div>
        </div>
      </Card>
    </motion.article>
  );
};

const EmptyState: React.FC<{
  onPrimary: () => void;
  primaryLabel: string;
  title: string;
  description: string;
}> = ({ onPrimary, primaryLabel, title, description }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.5, type: 'spring' }}
  >
    <Card className="rounded-[2.5em] border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] py-12">
      <CardContent className="px-8 py-10">
        <motion.div 
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-100 text-indigo-500 shadow-sm"
        >
          <Sparkles className="h-10 w-10" />
        </motion.div>
        <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: headingFont }}>
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base font-medium leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={onPrimary}
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-400 to-purple-400 px-6 py-4 text-sm font-bold text-white shadow-[0_8px_20px_rgba(99,102,241,0.3)] transition-all"
        >
          <Plus className="h-5 w-5" />
          {primaryLabel}
        </motion.button>
      </CardContent>
    </Card>
  </motion.div>
);

const LoadingState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-32 space-y-8">
    <motion.div
      animate={{ y: [0, -20, 0], rotate: [0, -5, 5, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      className="relative drop-shadow-xl"
    >
      <div className="absolute inset-0 bg-indigo-200 blur-2xl rounded-full animate-pulse opacity-50" />
      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2em] shadow-xl relative z-10 border border-white/50 dark:border-white/10">
        <BookOpen className="w-16 h-16 text-indigo-400" />
      </div>
    </motion.div>
    <motion.div
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      className="flex flex-col items-center gap-2"
    >
      <p className="text-xl font-bold text-slate-600 dark:text-slate-300" style={{ fontFamily: headingFont }}>
        Magie wird gewirkt...
      </p>
      <div className="flex gap-1">
        <motion.div className="w-2 h-2 rounded-full bg-indigo-300" animate={{ y: [0,-6,0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
        <motion.div className="w-2 h-2 rounded-full bg-purple-300" animate={{ y: [0,-6,0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
        <motion.div className="w-2 h-2 rounded-full bg-pink-300" animate={{ y: [0,-6,0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
      </div>
    </motion.div>
  </div>
);

const TaleaStoriesScreen: React.FC = () => {
  const backend = useBackend();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const { isAdmin } = useOptionalUserAccess();
  const { canUseOffline, isStorySaved, isSaving, toggleStory } = useOffline();
  const { isLoaded: authLoaded, isSignedIn } = useUser();
  const reduceMotion = useReducedMotion();
  const isDark = resolvedTheme === "dark";

  const [stories, setStories] = useState<Story[]>([]);
  const [contentTab, setContentTab] = useState<ContentTab>("stories");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [genreFilter, setGenreFilter] = useState("all");
  const [ageGroupFilter, setAgeGroupFilter] = useState("all");
  const [lengthFilter, setLengthFilter] = useState("all");
  const [avatarFilter, setAvatarFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [downloadingStoryId, setDownloadingStoryId] = useState<string | null>(null);

  const observerTarget = useRef<HTMLDivElement>(null);

  const loadStories = async () => {
    try {
      setLoading(true);
      const response = await backend.story.list({ limit: 12, offset: 0 });
      setStories((response.stories as unknown as Story[]) || []);
      setTotal(response.total || 0);
      setHasMore(response.hasMore || false);
    } catch (error) {
      console.error("Error loading stories:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreStories = useCallback(async () => {
    if (!hasMore || loadingMore) return;

    try {
      setLoadingMore(true);
      const response = await backend.story.list({ limit: 12, offset: stories.length });
      setStories((prev) => [...prev, ...((response.stories as unknown as Story[]) || [])]);
      setHasMore(response.hasMore || false);
    } catch (error) {
      console.error("Error loading more stories:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [backend, hasMore, loadingMore, stories.length]);

  useEffect(() => {
    if (authLoaded && isSignedIn && contentTab === "stories") {
      loadStories();
    } else if (authLoaded && !isSignedIn) {
      setLoading(false);
    } else if (authLoaded && isSignedIn && contentTab === "studio") {
      setLoading(false);
    }
  }, [authLoaded, isSignedIn, contentTab]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (contentTab === "stories" && entries[0]?.isIntersecting && hasMore && !loadingMore && !loading) {
          loadMoreStories();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [contentTab, hasMore, loadingMore, loading, loadMoreStories]);

  const handleDeleteStory = async (storyId: string, storyTitle: string) => {
    if (!window.confirm(`${t("common.delete", "Loeschen")} \"${storyTitle}\"?`)) return;

    try {
      await backend.story.deleteStory({ id: storyId });
      setStories((prev) => prev.filter((story) => story.id !== storyId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error deleting story:", error);
    }
  };

  const handleDownloadPdf = async (
    storyId: string,
    storyStatus: Story["status"],
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation();

    if (!isAdmin || !isPDFExportSupported() || storyStatus !== "complete") return;

    try {
      setDownloadingStoryId(storyId);
      const fullStory = await backend.story.get({ id: storyId });
      if (!fullStory.chapters || fullStory.chapters.length === 0) return;
      await exportStoryAsPDF(fullStory as any);
    } catch (error) {
      console.error("PDF export failed:", error);
    } finally {
      setDownloadingStoryId(null);
    }
  };

  const genreFilterOptions = useMemo(
    () =>
      Array.from(new Set(stories.map((story) => getStoryGenreKey(story)).filter(Boolean))).sort((a, b) =>
        formatGenreLabel(a).localeCompare(formatGenreLabel(b), "de")
      ),
    [stories]
  );

  const ageGroupFilterOptions = useMemo(
    () =>
      Array.from(new Set(stories.map((story) => getStoryAgeGroupKey(story)).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "de")
      ),
    [stories]
  );

  const lengthFilterOptions = useMemo(
    () => Array.from(new Set(stories.map((story) => getStoryLengthKey(story)).filter(Boolean))),
    [stories]
  );

  const avatarFilterOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const story of stories) {
      for (const participant of getStoryAvatarParticipants(story)) {
        byId.set(participant.id, participant.name);
      }
    }

    return Array.from(byId.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [stories]);

  const filteredStories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const result = stories.filter((story) => {
      if (genreFilter !== "all" && getStoryGenreKey(story) !== genreFilter) return false;
      if (ageGroupFilter !== "all" && getStoryAgeGroupKey(story) !== ageGroupFilter) return false;
      if (lengthFilter !== "all" && getStoryLengthKey(story) !== lengthFilter) return false;

      if (avatarFilter !== "all") {
        const avatarIds = new Set(getStoryAvatarParticipants(story).map((participant) => participant.id));
        if (!avatarIds.has(avatarFilter)) return false;
      }

      if (!query) return true;

      const title = story.title?.toLowerCase() || "";
      const summary = story.summary?.toLowerCase() || "";
      const description = story.description?.toLowerCase() || "";

      return title.includes(query) || summary.includes(query) || description.includes(query);
    });

    if (sortMode === "title") {
      return [...result].sort((a, b) => a.title.localeCompare(b.title, "de"));
    }

    if (sortMode === "oldest") {
      return [...result].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }

    return [...result].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [stories, searchQuery, genreFilter, ageGroupFilter, lengthFilter, avatarFilter, sortMode]);

  const completeCount = stories.filter((story) => story.status === "complete").length;
  const generatingCount = stories.filter((story) => story.status === "generating").length;
  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    genreFilter !== "all" ||
    ageGroupFilter !== "all" ||
    lengthFilter !== "all" ||
    avatarFilter !== "all";

  return (
    <div className="relative min-h-screen pb-24" style={{ fontFamily: bodyFont }}>
      <KidsAppBackground isDark={isDark} />

      <SignedOut>
        <div className="flex min-h-[72vh] items-center justify-center px-6">
          <Card className="w-full max-w-xl rounded-[2.5em] border-white/60 dark:border-white/10 bg-white/70 dark:bg-slate-800/80 backdrop-blur-xl text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] py-10">
            <CardHeader>
              <CardTitle className="text-3xl font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: headingFont }}>
                Zugriff erforderlich
              </CardTitle>
              <CardDescription className="text-base font-medium text-slate-500 dark:text-slate-400 mt-2">
                Melde dich an, um deine Story-Bibliothek zu sehen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => navigate("/auth")}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-400 to-purple-400 px-8 py-4 text-base font-bold text-white shadow-[0_8px_20px_rgba(99,102,241,0.3)]"
              >
                Anmelden
              </motion.button>
            </CardContent>
          </Card>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="space-y-8 pt-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.section
            initial={reduceMotion ? false : { opacity: 0, y: -20 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.5, type: 'spring', bounce: 0.4 }}
          >
            <Card className="rounded-[2.5em] border-white/60 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden relative">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-indigo-100/50 dark:bg-indigo-900/20 blur-3xl pointer-events-none" />
              <CardHeader className="gap-6 pb-8 md:flex-row md:items-end md:justify-between relative z-10 p-8">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/80 dark:bg-indigo-900/30 px-4 py-2 shadow-sm">
                    <img src={taleaLogo} alt="Talea Logo" className="h-6 w-6 rounded-md object-cover" />
                    <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Story Library</p>
                  </div>
                  <CardTitle
                    className="text-4xl font-extrabold text-slate-800 dark:text-slate-100 md:text-5xl tracking-tight leading-tight"
                    style={{ fontFamily: headingFont }}
                  >
                    {contentTab === "stories" ? "Deine magischen Geschichten" : "Talea Studio Serien"}
                  </CardTitle>
                  <CardDescription className="max-w-2xl text-lg font-medium text-slate-500 dark:text-slate-400">
                    {contentTab === "stories"
                      ? "Finde, lies und lade alle deine wunderschönen Geschichten herunter."
                      : "Verwalte Serien, serie-exklusive Story Charaktere und neue Folgen in einem Studio-Workflow."}
                  </CardDescription>

                  <div className="inline-flex rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-1.5 mt-4 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setContentTab("stories")}
                      className={cn(
                        "rounded-xl px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition-all",
                        contentTab === "stories" ? "bg-indigo-500 text-white shadow-md" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      )}
                    >
                      Meine Stories
                    </button>
                    <button
                      type="button"
                      onClick={() => setContentTab("studio")}
                      className={cn(
                        "rounded-xl px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition-all",
                        contentTab === "studio" ? "bg-indigo-500 text-white shadow-md" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      )}
                    >
                      Talea Studio
                    </button>
                  </div>
                </div>

                {contentTab === "stories" && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => navigate("/story")}
                    className="shrink-0 inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-400 to-purple-400 px-6 text-base font-bold text-white shadow-[0_8px_20px_rgba(99,102,241,0.3)]"
                  >
                    <Plus className="h-6 w-6" />
                    Neue Story zaubern
                  </motion.button>
                )}
              </CardHeader>

              {contentTab === "stories" && (
                <CardContent className="grid grid-cols-1 gap-4 pt-0 sm:grid-cols-3 relative z-10 px-8 pb-8">
                  <div className="rounded-[1.5em] border border-slate-100 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/40 p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Gesamt</p>
                    <p className="mt-1 text-4xl font-extrabold text-slate-700 dark:text-slate-100">{total}</p>
                  </div>
                  <div className="rounded-[1.5em] border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/60 dark:bg-emerald-900/20 p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-500">Fertig</p>
                    <p className="mt-1 text-4xl font-extrabold text-emerald-600 dark:text-emerald-400">{completeCount}</p>
                  </div>
                  <div className="rounded-[1.5em] border border-amber-100 dark:border-amber-900/30 bg-amber-50/60 dark:bg-amber-900/20 p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-500">In Arbeit</p>
                    <p className="mt-1 text-4xl font-extrabold text-amber-600 dark:text-amber-400">{generatingCount}</p>
                  </div>
                </CardContent>
              )}
            </Card>
          </motion.section>

          {contentTab === "stories" && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="rounded-[2em] border-white/60 dark:border-white/10 bg-white/70 dark:bg-slate-800/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <CardContent className="space-y-5 p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <label className="relative flex-1 group">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Nach Titel oder Inhalt suchen..."
                        className="h-14 w-full rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 py-2 pl-12 pr-4 text-base font-medium text-slate-700 dark:text-slate-200 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white dark:focus:bg-slate-900 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.1)]"
                      />
                    </label>

                    <select
                      value={sortMode}
                      onChange={(event) => setSortMode(event.target.value as SortMode)}
                      className="h-14 rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 px-4 text-base font-bold text-slate-600 dark:text-slate-300 outline-none transition-all focus:border-indigo-300 focus:bg-white dark:focus:bg-slate-900 cursor-pointer"
                      aria-label="Sortierung"
                    >
                      <option value="newest">Neueste zuerst</option>
                      <option value="oldest">Älteste zuerst</option>
                      <option value="title">Titel A-Z</option>
                    </select>

                    <div className="inline-flex rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-1.5">
                      <button
                        type="button"
                        onClick={() => setViewMode("grid")}
                        className={cn(
                          "rounded-xl p-2.5 transition-all",
                          viewMode === "grid" ? "bg-indigo-500 text-white shadow-md" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                        )}
                        aria-label="Rasteransicht"
                      >
                        <Grid3X3 className="h-6 w-6" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("list")}
                        className={cn(
                          "rounded-xl p-2.5 transition-all",
                          viewMode === "list" ? "bg-indigo-500 text-white shadow-md" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                        )}
                        aria-label="Listenansicht"
                      >
                        <LayoutList className="h-6 w-6" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <select
                      value={genreFilter}
                      onChange={(event) => setGenreFilter(event.target.value)}
                      className="h-14 rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 px-4 text-sm font-bold text-slate-600 dark:text-slate-300 outline-none transition-all focus:border-indigo-300 cursor-pointer"
                      aria-label="Genre Filter"
                    >
                      <option value="all">Alle Genres</option>
                      {genreFilterOptions.map((genre) => (
                        <option key={genre} value={genre}>
                          {formatGenreLabel(genre)}
                        </option>
                      ))}
                    </select>

                    <select
                      value={ageGroupFilter}
                      onChange={(event) => setAgeGroupFilter(event.target.value)}
                      className="h-14 rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 px-4 text-sm font-bold text-slate-600 dark:text-slate-300 outline-none transition-all focus:border-indigo-300 cursor-pointer"
                      aria-label="Altersgruppe Filter"
                    >
                      <option value="all">Alle Altersgruppen</option>
                      {ageGroupFilterOptions.map((ageGroup) => (
                        <option key={ageGroup} value={ageGroup}>
                          {formatAgeLabel(ageGroup)}
                        </option>
                      ))}
                    </select>

                    <select
                      value={lengthFilter}
                      onChange={(event) => setLengthFilter(event.target.value)}
                      className="h-14 rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 px-4 text-sm font-bold text-slate-600 dark:text-slate-300 outline-none transition-all focus:border-indigo-300 cursor-pointer"
                      aria-label="Laengen Filter"
                    >
                      <option value="all">Alle Längen</option>
                      {lengthFilterOptions.map((length) => (
                        <option key={length} value={length}>
                          {formatLengthLabel(length)}
                        </option>
                      ))}
                    </select>

                    <select
                      value={avatarFilter}
                      onChange={(event) => setAvatarFilter(event.target.value)}
                      className="h-14 rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 px-4 text-sm font-bold text-slate-600 dark:text-slate-300 outline-none transition-all focus:border-indigo-300 cursor-pointer"
                      aria-label="Avatar Filter"
                    >
                      <option value="all">Alle Avatare</option>
                      {avatarFilterOptions.map((avatar) => (
                        <option key={avatar.id} value={avatar.id}>
                          {avatar.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setGenreFilter("all");
                        setAgeGroupFilter("all");
                        setLengthFilter("all");
                        setAvatarFilter("all");
                      }}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      Filter zurücksetzen
                    </button>
                  </div>
                </CardContent>
              </Card>
            </motion.section>
          )}

          <section>
            {contentTab === "studio" ? (
              <TaleaStudioWorkspace />
            ) : loading ? (
              <LoadingState />
            ) : filteredStories.length === 0 ? (
              <EmptyState
                onPrimary={() => {
                  if (hasActiveFilters) {
                    setSearchQuery("");
                    setGenreFilter("all");
                    setAgeGroupFilter("all");
                    setLengthFilter("all");
                    setAvatarFilter("all");
                    return;
                  }
                  navigate("/story");
                }}
                primaryLabel={hasActiveFilters ? "Filter zurücksetzen" : "Erste Story zaubern"}
                title={hasActiveFilters ? "Keine Treffer gefunden" : "Noch keine Geschichten"}
                description={
                  hasActiveFilters
                    ? "Wir konnten keine Geschichten finden, die zu deinen Filtern passen. Probier es mit anderen Filtern!"
                    : "Starte jetzt mit deiner allerersten Geschichte. Finde deine Helden und stürze dich in ein Abenteuer!"
                }
              />
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredStories.map((story, index) => (
                  <GridStoryCard
                    key={story.id}
                    story={story}
                    index={index}
                    onRead={() => navigate(`/story-reader/${story.id}`)}
                    onDelete={() => handleDeleteStory(story.id, story.title)}
                    canDownload={isAdmin}
                    onDownloadPdf={(event) => handleDownloadPdf(story.id, story.status, event)}
                    isDownloading={downloadingStoryId === story.id}
                    canSaveOffline={canUseOffline}
                    isSavedOffline={isStorySaved(story.id)}
                    isSavingOffline={isSaving(story.id)}
                    onToggleOffline={(event) => { event.stopPropagation(); toggleStory(story.id); }}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-5">
                {filteredStories.map((story, index) => (
                  <ListStoryRow
                    key={story.id}
                    story={story}
                    index={index}
                    onRead={() => navigate(`/story-reader/${story.id}`)}
                    onDelete={() => handleDeleteStory(story.id, story.title)}
                    canDownload={isAdmin}
                    onDownloadPdf={(event) => handleDownloadPdf(story.id, story.status, event)}
                    isDownloading={downloadingStoryId === story.id}
                    canSaveOffline={canUseOffline}
                    isSavedOffline={isStorySaved(story.id)}
                    isSavingOffline={isSaving(story.id)}
                    onToggleOffline={(event) => { event.stopPropagation(); toggleStory(story.id); }}
                  />
                ))}
              </div>
            )}

            {contentTab === "stories" && hasMore && !loading && (
              <div ref={observerTarget} className="mt-10 flex justify-center pb-8">
                {loadingMore && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="inline-flex items-center gap-3 rounded-full border border-indigo-100 dark:border-indigo-900/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md px-6 py-3 text-sm font-bold text-indigo-600 dark:text-indigo-400 shadow-sm"
                  >
                    <Clock3 className="h-5 w-5 animate-spin" />
                    Weitere Stories werden herbeigezaubert...
                  </motion.div>
                )}
              </div>
            )}
          </section>
        </div>
      </SignedIn>
    </div>
  );
};

export default TaleaStoriesScreen;