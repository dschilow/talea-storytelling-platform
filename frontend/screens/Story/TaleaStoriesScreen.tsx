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
  Sparkles,
  RefreshCw,
  Filter,
  X
} from "lucide-react";

import { useBackend } from "../../hooks/useBackend";
import { exportStoryAsPDF, isPDFExportSupported } from "../../utils/pdfExport";
import type { Story } from "../../types/story";
import { StoryParticipantsDialog } from "@/components/story/StoryParticipantsDialog";
import ProgressiveImage from "@/components/common/ProgressiveImage";
import { cn } from "@/lib/utils";
import taleaLogo from "@/img/talea_logo.png";
import { useTheme } from "@/contexts/ThemeContext";
import { useOptionalUserAccess } from "@/contexts/UserAccessContext";
import { useOffline } from "@/contexts/OfflineStorageContext";
import { useOptionalChildProfiles } from "@/contexts/ChildProfilesContext";
import TaleaStudioWorkspace from "./TaleaStudioWorkspace";

const headingFont = '"Nunito", "Quicksand", "Fredoka", sans-serif';
const bodyFont = '"Nunito", "Quicksand", "Fredoka", sans-serif';

type ViewMode = "grid" | "list";
type SortMode = "newest" | "oldest" | "title";
type ContentTab = "stories" | "studio";

const statusMeta: Record<Story["status"], { label: string; className: string }> = {
  complete: {
    label: "Fertig",
    className: "bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800",
  },
  generating: {
    label: "In Arbeit",
    className: "bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800",
  },
  error: {
    label: "Fehler",
    className: "bg-rose-100 text-rose-600 border-rose-200 dark:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800",
  },
};

const genreLabels: Record<string, string> = {
  fairy_tales: "Märchen",
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
  return story.summary || story.description || "Noch keine Zusammenfassung verfügbar.";
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

// Organic floating background
const KidsAppBackground: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
    {isDark ? (
      <div className="absolute inset-0 bg-[#0f172a] transition-colors duration-500">
        <motion.div animate={{ rotate: 360, x: [0, 50, 0], y: [0, -50, 0] }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }} className="absolute -top-[20%] -right-[10%] h-[70vh] w-[70vh] rounded-[40%_60%_70%_30%/40%_50%_60%_50%] bg-indigo-900/30 blur-[80px]" />
        <motion.div animate={{ rotate: -360, x: [0, -30, 0], y: [0, 40, 0] }} transition={{ duration: 35, repeat: Infinity, ease: "linear" }} className="absolute top-[20%] -left-[10%] h-[60vh] w-[60vh] rounded-[60%_40%_30%_70%/50%_60%_40%_50%] bg-blue-900/20 blur-[100px]" />
        <motion.div animate={{ scale: [1, 1.1, 1], x: [0, 20, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }} className="absolute -bottom-[20%] left-[20%] h-[80vh] w-[80vh] rounded-full bg-purple-900/20 blur-[100px]" />
      </div>
    ) : (
      <div className="absolute inset-0 bg-[#f8fbff] transition-colors duration-500">
        <motion.div animate={{ rotate: 360, x: [0, 30, 0], y: [0, -30, 0] }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} className="absolute -top-[10%] -right-[10%] h-[60vh] w-[60vh] rounded-[40%_60%_70%_30%/40%_50%_60%_50%] bg-pink-200/40 blur-[80px]" />
        <motion.div animate={{ rotate: -360, x: [0, -40, 0], y: [0, 30, 0] }} transition={{ duration: 45, repeat: Infinity, ease: "linear" }} className="absolute top-[10%] -left-[10%] h-[50vh] w-[50vh] rounded-[60%_40%_30%_70%/50%_60%_40%_50%] bg-yellow-200/40 blur-[90px]" />
        <motion.div animate={{ rotate: 180, scale: [1, 1.2, 1] }} transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }} className="absolute -bottom-[10%] left-[30%] h-[70vh] w-[70vh] rounded-[50%_50%_40%_60%/60%_40%_50%_50%] bg-cyan-200/40 blur-[100px]" />
      </div>
    )}
    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMTI4LCAxMjgsIDEyOCwgMC4xKSIvPjwvc3ZnPg==')] opacity-50 dark:opacity-20" />
  </div>
);

const PlayfulButton: React.FC<{
  children: React.ReactNode;
  onClick?: (e?: any) => void;
  className?: string;
  variant?: "primary" | "secondary" | "accent" | "ghost";
  disabled?: boolean;
}> = ({ children, onClick, className, variant = "primary", disabled }) => {
  const baseClasses = "relative inline-flex items-center justify-center font-bold transition-all outline-none pb-2 active:pb-0 active:translate-y-2 select-none overflow-hidden";
  
  const variants = {
    primary: "bg-indigo-500 text-white border-indigo-700 border-b-[6px] active:border-b-0 rounded-[1.5rem]",
    secondary: "bg-white text-slate-700 border-slate-200 border-b-[6px] active:border-b-0 rounded-[1.5rem] dark:bg-slate-800 dark:border-slate-900 dark:text-white",
    accent: "bg-pink-400 text-white border-pink-600 border-b-[6px] active:border-b-0 rounded-[1.5rem]",
    ghost: "bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 rounded-[1.5rem] active:translate-y-0 pb-0",
  };

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cn(baseClasses, variants[variant], className, disabled && "opacity-50 cursor-not-allowed active:pb-2 active:translate-y-0")}>
      <div className="px-5 py-2.5 w-full flex items-center justify-center gap-2 relative z-10">
        {children}
      </div>
      {variant !== "ghost" && (
        <div className="absolute inset-0 bg-white/20 opacity-0 hover:opacity-100 transition-opacity rounded-t-[1.3rem]" />
      )}
    </button>
  );
};

const BouncingLoader: React.FC = () => (
  <div className="flex justify-center items-center gap-2">
    {[0, 1, 2].map((i) => (
      <motion.div key={i} animate={{ y: [0, -10, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1, ease: "easeOut" }} className="w-3 h-3 rounded-full bg-indigo-400" />
    ))}
  </div>
);

const LoadingState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-20 gap-4">
     <BouncingLoader />
     <p className="text-slate-500 dark:text-slate-400 font-bold">Lade magische Geschichten...</p>
  </div>
);

const BentoBox: React.FC<{ children: React.ReactNode; className?: string; delay?: number; }> = ({ children, className, delay = 0 }) => {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay, ease: [0.23, 1, 0.32, 1] }}
      className={cn("rounded-[2rem] p-6 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-4 border-white/50 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]", className)}
    >
      {children}
    </motion.div>
  );
};

const FilterSelect: React.FC<{ value: string; onChange: (v: string) => void; options: { label: string; value: string }[]; label: string }> = ({ value, onChange, options, label }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="h-12 w-full rounded-2xl border-4 border-white/80 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 px-4 text-sm font-bold text-slate-600 dark:text-slate-300 outline-none transition-all focus:border-indigo-300 dark:focus:border-indigo-500 cursor-pointer shadow-sm appearance-none"
    aria-label={label}
  >
    <option value="all">Alle {label}</option>
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);

const StoryStatusChip: React.FC<{ status: Story["status"] }> = ({ status }) => (
  <span className={cn("inline-flex rounded-full border-2 px-3 py-1 text-[11px] font-bold uppercase tracking-wider shadow-sm", statusMeta[status].className)}>
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
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      whileHover={reduceMotion ? undefined : { y: -8, scale: 1.02 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      className="group cursor-pointer flex flex-col h-full bg-white dark:bg-slate-800 rounded-[2rem] border-4 border-slate-100 dark:border-slate-700 overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.05)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-shadow"
      onClick={onRead}
    >
      <div className="relative h-56 w-full p-2 shrink-0">
        <div className="w-full h-full rounded-[1.5rem] overflow-hidden relative">
          <ProgressiveImage
            src={story.coverImageUrl}
            alt={story.title}
            revealDelayMs={index * 35}
            containerClassName="w-full h-full"
            imageClassName="transition-transform duration-700 ease-out group-hover:scale-110 object-cover"
            fallback={
              <div className="flex h-full w-full items-center justify-center bg-indigo-50 dark:bg-slate-700/50 text-indigo-300">
                <BookOpen className="h-14 w-14" />
              </div>
            }
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent opacity-80" />
        </div>

        <div className="absolute left-4 top-4">
          <StoryStatusChip status={story.status} />
        </div>

        <div className="absolute right-4 top-4 flex gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
          {canSaveOffline && story.status === "complete" && onToggleOffline && (
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} type="button" onClick={onToggleOffline} disabled={isSavingOffline} className="rounded-xl border-2 border-white/20 bg-black/40 backdrop-blur-md p-2 text-white hover:bg-black/60 shadow-sm">
              {isSavingOffline ? <Clock3 className="h-4 w-4 animate-spin" /> : isSavedOffline ? <BookmarkCheck className="h-4 w-4 text-emerald-400" /> : <Bookmark className="h-4 w-4" />}
            </motion.button>
          )}
          {canDownload && story.status === "complete" && (
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} type="button" onClick={onDownloadPdf} className="rounded-xl border-2 border-white/20 bg-black/40 backdrop-blur-md p-2 text-white hover:bg-black/60 shadow-sm">
              {isDownloading ? <Clock3 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </motion.button>
          )}
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="rounded-xl border-2 border-white/20 bg-rose-500/80 backdrop-blur-md p-2 text-white hover:bg-rose-600 shadow-sm">
            <Trash2 className="h-4 w-4" />
          </motion.button>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <h3 className="line-clamp-2 text-xl font-bold text-slate-800 dark:text-neutral-100 leading-tight" style={{ fontFamily: headingFont }}>{story.title}</h3>
        <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400 font-semibold mt-3 flex-1 leading-relaxed">
          {getStoryPreviewText(story)}
        </p>

        <div className="mt-5 pt-5 border-t-2 border-slate-100 dark:border-slate-700/50 flex flex-col gap-3">
          <StoryParticipantsDialog story={story} maxVisible={4} />
          <div className="flex justify-between items-center">
             <span className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700/50 px-3 py-1 rounded-lg">{formatDate(story.createdAt)}</span>
          </div>
        </div>
      </div>
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
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={reduceMotion ? undefined : { y: -4, scale: 1.01 }}
      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
      onClick={onRead}
      className="group cursor-pointer"
    >
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] border-4 border-slate-100 dark:border-slate-700 shadow-[0_4px_20px_rgb(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-all duration-300 overflow-hidden flex flex-col sm:flex-row p-2 gap-4">
        <div className="relative h-48 sm:h-auto sm:w-64 shrink-0 rounded-[1.5rem] overflow-hidden">
          <ProgressiveImage
            src={story.coverImageUrl}
            alt={story.title}
            revealDelayMs={index * 30}
            containerClassName="w-full h-full"
            imageClassName="transition-transform duration-700 ease-out group-hover:scale-105 object-cover"
            fallback={
              <div className="flex h-full w-full items-center justify-center bg-indigo-50 dark:bg-slate-700/50 text-indigo-300">
                <BookOpen className="h-10 w-10" />
              </div>
            }
          />
        </div>

        <div className="flex flex-1 flex-col py-4 pr-4">
          <div className="flex items-start justify-between gap-4">
            <h3 className="line-clamp-2 text-2xl font-bold text-slate-800 dark:text-neutral-100 leading-tight" style={{ fontFamily: headingFont }}>{story.title}</h3>
            <div className="flex items-center gap-2 shrink-0">
              <StoryStatusChip status={story.status} />
              
              <div className="hidden sm:flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {canSaveOffline && story.status === "complete" && onToggleOffline && (
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} type="button" onClick={onToggleOffline} disabled={isSavingOffline} className="rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                    {isSavingOffline ? <Clock3 className="h-4 w-4 animate-spin" /> : isSavedOffline ? <BookmarkCheck className="h-4 w-4 text-emerald-500" /> : <Bookmark className="h-4 w-4" />}
                  </motion.button>
                )}
                {canDownload && story.status === "complete" && (
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} type="button" onClick={onDownloadPdf} className="rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                    {isDownloading ? <Clock3 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  </motion.button>
                )}
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="rounded-xl border-2 border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-900/50 p-2 text-rose-500 hover:bg-rose-100 hover:text-rose-600">
                  <Trash2 className="h-4 w-4" />
                </motion.button>
              </div>
            </div>
          </div>
          
          <p className="mt-3 line-clamp-2 text-base text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">{getStoryPreviewText(story)}</p>
          
          <div className="mt-auto pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t-2 border-slate-50 dark:border-slate-700/50">
            <StoryParticipantsDialog story={story} maxVisible={5} />
            <span className="text-sm font-bold text-slate-400 bg-slate-50 dark:bg-slate-700 px-3 py-1.5 rounded-xl self-start sm:self-auto">{formatDate(story.createdAt)}</span>
          </div>
        </div>
      </div>
    </motion.article>
  );
};


const TaleaStoriesScreen: React.FC = () => {
  const backend = useBackend();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const { isAdmin } = useOptionalUserAccess();
  const { canUseOffline, isStorySaved, isSaving, toggleStory } = useOffline();
  const { isLoaded: authLoaded, isSignedIn } = useUser();
  const activeProfileId = useOptionalChildProfiles()?.activeProfileId;
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
  
  const [showFilters, setShowFilters] = useState(false);

  const observerTarget = useRef<HTMLDivElement>(null);

  const loadStories = useCallback(async () => {
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
  }, [backend]);

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
    if (!authLoaded) {
      return;
    }

    if (!isSignedIn) {
      setStories([]);
      setTotal(0);
      setHasMore(false);
      setLoading(false);
      return;
    }

    if (contentTab === "stories") {
      void loadStories();
    } else {
      setLoading(false);
    }
  }, [authLoaded, isSignedIn, contentTab, loadStories, activeProfileId]);

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
    if (!window.confirm(`${t("common.delete", "Löschen")} "${storyTitle}"?`)) return;
    try {
      await backend.story.deleteStory({ id: storyId });
      setStories((prev) => prev.filter((story) => story.id !== storyId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error deleting story:", error);
    }
  };

  const handleDownloadPdf = async (storyId: string, storyStatus: Story["status"], event: React.MouseEvent<HTMLButtonElement>) => {
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

  const genreFilterOptions = useMemo(() => Array.from(new Set(stories.map((story) => getStoryGenreKey(story)).filter(Boolean))).map(v => ({ value: v, label: formatGenreLabel(v) })).sort((a,b)=>a.label.localeCompare(b.label)), [stories]);
  const ageGroupFilterOptions = useMemo(() => Array.from(new Set(stories.map((story) => getStoryAgeGroupKey(story)).filter(Boolean))).map(v => ({ value: v, label: formatAgeLabel(v) })).sort((a,b)=>a.label.localeCompare(b.label)), [stories]);
  const lengthFilterOptions = useMemo(() => Array.from(new Set(stories.map((story) => getStoryLengthKey(story)).filter(Boolean))).map(v => ({ value: v, label: formatLengthLabel(v) })), [stories]);
  const avatarFilterOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const story of stories) {
      for (const participant of getStoryAvatarParticipants(story)) {
        byId.set(participant.id, participant.name);
      }
    }
    return Array.from(byId.entries()).map(([id, name]) => ({ value: id, label: name })).sort((a, b) => a.label.localeCompare(b.label));
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

    if (sortMode === "title") return [...result].sort((a, b) => a.title.localeCompare(b.title, "de"));
    if (sortMode === "oldest") return [...result].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [stories, searchQuery, genreFilter, ageGroupFilter, lengthFilter, avatarFilter, sortMode]);

  const completeCount = stories.filter((story) => story.status === "complete").length;
  const generatingCount = stories.filter((story) => story.status === "generating").length;
  const hasActiveFilters = searchQuery.trim().length > 0 || genreFilter !== "all" || ageGroupFilter !== "all" || lengthFilter !== "all" || avatarFilter !== "all";

  return (
    <div className="relative min-h-screen pb-32" style={{ fontFamily: bodyFont }}>
      <KidsAppBackground isDark={isDark} />

      <SignedOut>
        <div className="flex min-h-[80vh] items-center justify-center p-4">
           <BentoBox className="max-w-md w-full text-center p-10 flex flex-col items-center gap-6">
             <div className="w-20 h-20 bg-indigo-100 dark:bg-slate-700 text-indigo-500 rounded-3xl flex items-center justify-center mb-2 shadow-inner">
               <BookOpen className="w-10 h-10" />
             </div>
             <h1 className="text-3xl font-extrabold text-slate-800 dark:text-neutral-100" style={{ fontFamily: headingFont }}>Willkommen in der Bibliothek</h1>
             <p className="text-slate-500 dark:text-slate-400 font-semibold mb-2">Melde dich an, um all deine zauberhaften Geschichten zu verwalten und auf Abenteuerreise zu gehen.</p>
             <PlayfulButton onClick={() => navigate("/auth")} className="w-full text-lg">Jetzt Anmelden</PlayfulButton>
           </BentoBox>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 flex flex-col gap-8">
          
          {/* Header Bento */}
          <BentoBox className="relative overflow-hidden bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-indigo-950/50 border-none !p-0">
             <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-300/30 rounded-full blur-3xl pointer-events-none" />
             
             <div className="p-8 sm:p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative z-10">
               <div>
                 <div className="inline-flex items-center gap-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-4 py-1.5 rounded-full font-bold text-xs uppercase tracking-wider mb-4 shadow-sm">
                   <img src={taleaLogo} alt="Talea Logo" className="w-5 h-5 rounded-md" />
                   Bibliothek
                 </div>
                 <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-800 dark:text-white" style={{ fontFamily: headingFont }}>
                   {contentTab === "stories" ? "Deine Magischen Geschichten" : "Talea Studio Serien"}
                 </h1>
                 <p className="text-lg font-semibold text-slate-600 dark:text-slate-300 mt-4 max-w-xl">
                    {contentTab === "stories" ? "Stöbere durch all deine kreativen Werke. Filtern, Lesen und Genießen." : "Plane Serien, verwalte Charaktere und behalte den Überblick in deinem Studio."}
                 </p>

                 {/* Segmented Control */}
                 <div className="mt-8 flex bg-white/60 dark:bg-slate-900/60 p-1.5 rounded-[1.5rem] w-fit border-2 border-slate-100 dark:border-slate-700">
                    <button onClick={() => setContentTab("stories")} className={cn("px-6 py-2.5 rounded-xl font-bold text-sm transition-all", contentTab === "stories" ? "bg-indigo-500 text-white shadow-md" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white")}>Meine Stories</button>
                    <button onClick={() => setContentTab("studio")} className={cn("px-6 py-2.5 rounded-xl font-bold text-sm transition-all", contentTab === "studio" ? "bg-indigo-500 text-white shadow-md" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white")}>Talea Studio</button>
                 </div>
               </div>

               {contentTab === "stories" && (
                 <PlayfulButton onClick={() => navigate("/story")} className="shrink-0 w-full md:w-auto text-lg py-4 px-6 shadow-xl shadow-indigo-500/20">
                   <Plus className="w-6 h-6 mr-1 font-bold" /> Neue Story
                 </PlayfulButton>
               )}
             </div>
          </BentoBox>

          {contentTab === "stories" && (
            <div className="flex flex-col xl:flex-row gap-8 items-start">
              {/* Left sidebar / Filters */}
              <div className="w-full xl:w-80 shrink-0 flex flex-col gap-6 xl:sticky xl:top-24">
                <BentoBox className="!p-5 bg-indigo-50 dark:bg-slate-800 flex justify-between xl:justify-start xl:flex-col gap-4 text-center xl:text-left border-indigo-100 dark:border-slate-700">
                   <div>
                     <span className="block text-xs font-bold uppercase text-indigo-500 mb-1">Geschichten</span>
                     <span className="block text-4xl font-extrabold text-slate-800 dark:text-white">{total}</span>
                   </div>
                   <div className="hidden xl:block w-full h-[2px] bg-indigo-200/50 dark:bg-slate-700" />
                   <div className="flex xl:flex-col gap-4 xl:gap-2">
                     <div className="flex items-center gap-2">
                       <div className="w-3 h-3 rounded-full bg-emerald-400" />
                       <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{completeCount} Fertig</span>
                     </div>
                     <div className="flex items-center gap-2">
                       <div className="w-3 h-3 rounded-full bg-amber-400" />
                       <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{generatingCount} In Arbeit</span>
                     </div>
                   </div>
                </BentoBox>

                <div className="flex items-center gap-2 xl:hidden w-full">
                   <button onClick={() => setShowFilters(!showFilters)} className="flex-1 bg-white/80 dark:bg-slate-800/80 border-4 border-white dark:border-slate-700 rounded-[1.5rem] p-3 text-center font-bold text-slate-700 dark:text-slate-200 flex justify-center items-center gap-2 shadow-sm transition-all focus:outline-none focus:ring-4 focus:ring-indigo-100">
                     <Filter className="w-5 h-5" /> Filter {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-rose-500 relative -top-2 -left-1" />}
                   </button>
                   <div className="flex bg-white/80 dark:bg-slate-800/80 p-1.5 rounded-[1.5rem] border-4 border-white dark:border-slate-700 shadow-sm shrink-0">
                      <button onClick={() => setViewMode("grid")} className={cn("p-2 rounded-xl transition-colors", viewMode==="grid" ? "bg-indigo-100 text-indigo-600 shadow-sm" : "text-slate-400")}><Grid3X3 className="w-5 h-5"/></button>
                      <button onClick={() => setViewMode("list")} className={cn("p-2 rounded-xl transition-colors", viewMode==="list" ? "bg-indigo-100 text-indigo-600 shadow-sm" : "text-slate-400")}><LayoutList className="w-5 h-5"/></button>
                   </div>
                </div>

                <AnimatePresence>
                  {(showFilters || window.innerWidth >= 1280) && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="w-full overflow-hidden xl:!h-auto xl:!opacity-100">
                      <BentoBox className="!p-5 flex flex-col gap-4">
                        <div className="flex items-center justify-between xl:pb-2">
                          <h3 className="font-bold text-slate-800 dark:text-slate-200">Suche & Filter</h3>
                          <div className="hidden xl:flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-[1.25rem] border-2 border-slate-200 dark:border-slate-800">
                            <button onClick={() => setViewMode("grid")} className={cn("p-1.5 rounded-xl transition-colors", viewMode==="grid" ? "bg-white dark:bg-slate-700 shadow-sm flex" : "text-slate-400")}><Grid3X3 className="w-4 h-4"/></button>
                            <button onClick={() => setViewMode("list")} className={cn("p-1.5 rounded-xl transition-colors", viewMode==="list" ? "bg-white dark:bg-slate-700 shadow-sm flex" : "text-slate-400")}><LayoutList className="w-4 h-4"/></button>
                          </div>
                        </div>

                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Suchen..." className="w-full pl-10 pr-4 py-3 rounded-2xl border-4 border-white/80 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 font-bold text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-300 dark:focus:border-indigo-500 shadow-sm transition-all" />
                        </div>
                        
                        <div className="h-[2px] bg-slate-100 dark:bg-slate-700/50 my-2" />

                        <FilterSelect label="Sortierung" value={sortMode} onChange={(v) => setSortMode(v as SortMode)} options={[ {value:"newest",label:"Neueste zuerst"}, {value:"oldest",label:"Älteste zuerst"}, {value:"title",label:"Titel A-Z"} ]} />
                        <FilterSelect label="Kategorie / Genre" value={genreFilter} onChange={setGenreFilter} options={genreFilterOptions} />
                        <FilterSelect label="Altersgruppe" value={ageGroupFilter} onChange={setAgeGroupFilter} options={ageGroupFilterOptions} />
                        <FilterSelect label="Spiellänge" value={lengthFilter} onChange={setLengthFilter} options={lengthFilterOptions} />
                        <FilterSelect label="Teilnehmer" value={avatarFilter} onChange={setAvatarFilter} options={avatarFilterOptions} />

                        {hasActiveFilters && (
                          <button onClick={() => { setSearchQuery(""); setGenreFilter("all"); setAgeGroupFilter("all"); setLengthFilter("all"); setAvatarFilter("all"); }} className="mt-2 text-sm font-bold text-rose-500 bg-rose-50 border-2 border-rose-100 dark:border-rose-900/50 dark:bg-rose-900/30 py-3 rounded-2xl hover:bg-rose-100 transition-colors shadow-sm">
                            Filter zurücksetzen
                          </button>
                        )}
                      </BentoBox>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Stories Grid */}
              <div className="flex-1 w-full min-w-0 pb-10">
                {loading ? (
                  <LoadingState />
                ) : filteredStories.length === 0 ? (
                  <BentoBox className="text-center py-20 !border-dashed border-4 border-slate-300 dark:border-slate-700 bg-white/40 dark:bg-slate-800/40 mt-0">
                    <div className="mx-auto w-24 h-24 bg-indigo-100 dark:bg-slate-700 text-indigo-400 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
                       {hasActiveFilters ? <Search className="w-12 h-12" /> : <Sparkles className="w-12 h-12" />}
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200" style={{ fontFamily: headingFont }}>{hasActiveFilters ? "Keine Treffer gefunden" : "Noch keine Geschichten"}</h3>
                    <p className="text-slate-500 font-semibold max-w-sm mx-auto mt-3 mb-8">{hasActiveFilters ? "Wir konnten keine Geschichten finden, die zu deinen Filtern passen." : "Starte jetzt mit deiner allerersten Geschichte!"}</p>
                    <PlayfulButton onClick={() => { if (hasActiveFilters) { setSearchQuery(""); setGenreFilter("all"); setAgeGroupFilter("all"); setLengthFilter("all"); setAvatarFilter("all"); } else navigate("/story"); }} className="px-8 py-3 text-lg">
                       {hasActiveFilters ? "Filter zurücksetzen" : "Erste Story zaubern"}
                    </PlayfulButton>
                  </BentoBox>
                ) : (
                  <div className={cn(viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-3 gap-6" : "flex flex-col gap-6")}>
                    {filteredStories.map((story, index) => (
                      viewMode === "grid" ? (
                        <GridStoryCard
                          key={story.id} index={index} story={story}
                          onRead={() => navigate(`/story-reader/${story.id}`)}
                          onDelete={() => handleDeleteStory(story.id, story.title)} canDownload={isAdmin} onDownloadPdf={(e) => handleDownloadPdf(story.id, story.status, e)} isDownloading={downloadingStoryId === story.id} canSaveOffline={canUseOffline} isSavedOffline={isStorySaved(story.id)} isSavingOffline={isSaving(story.id)} onToggleOffline={(e) => { e.stopPropagation(); toggleStory(story.id); }}
                        />
                      ) : (
                        <ListStoryRow
                          key={story.id} index={index} story={story}
                          onRead={() => navigate(`/story-reader/${story.id}`)}
                          onDelete={() => handleDeleteStory(story.id, story.title)} canDownload={isAdmin} onDownloadPdf={(e) => handleDownloadPdf(story.id, story.status, e)} isDownloading={downloadingStoryId === story.id} canSaveOffline={canUseOffline} isSavedOffline={isStorySaved(story.id)} isSavingOffline={isSaving(story.id)} onToggleOffline={(e) => { e.stopPropagation(); toggleStory(story.id); }}
                        />
                      )
                    ))}
                  </div>
                )}

                {hasMore && !loading && (
                  <div ref={observerTarget} className="mt-16 flex justify-center">
                    {loadingMore ? (
                      <div className="inline-flex items-center gap-3 bg-white dark:bg-slate-800 px-8 py-4 rounded-full border-4 border-slate-100 dark:border-slate-700 shadow-md text-indigo-500 font-bold">
                        <Clock3 className="w-5 h-5 animate-spin" /> Mehr Stories laden...
                      </div>
                    ) : (
                      <div className="h-10" />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {contentTab === "studio" && (
             <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}}>
                <TaleaStudioWorkspace />
             </motion.div>
          )}

        </div>
      </SignedIn>
    </div>
  );
};

export default TaleaStoriesScreen;
