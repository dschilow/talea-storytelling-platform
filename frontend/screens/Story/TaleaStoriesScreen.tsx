import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Clock3,
  Download,
  ImageOff,
  Grid3X3,
  LayoutList,
  Plus,
  Search,
  Trash2,
  Sparkles,
  RefreshCw,
  Filter,
  LogIn,
} from "lucide-react";

import { useBackend } from "../../hooks/useBackend";
import { exportStoryAsPDF, isPDFExportSupported } from "../../utils/pdfExport";
import type { Story } from "../../types/story";
import { wereStoryImagesSkipped } from "../../utils/storyQualityGate";
import { StoryParticipantsDialog } from "@/components/story/StoryParticipantsDialog";
import ProgressiveImage from "@/components/common/ProgressiveImage";
import { cn } from "@/lib/utils";
import taleaLogo from "@/img/talea_logo.png";
import { useTheme } from "@/contexts/ThemeContext";
import { useOptionalUserAccess } from "@/contexts/UserAccessContext";
import { useOffline } from "@/contexts/OfflineStorageContext";
import { useOptionalChildProfiles } from "@/contexts/ChildProfilesContext";
import TaleaStudioWorkspace from "./TaleaStudioWorkspace";
import CharacterOriginsScreen from "../CharacterPool/CharacterOriginsScreen";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  TaleaActionButton,
  TaleaLoadingState,
  TaleaPageBackground,
  taleaBodyFont,
  taleaChipClass,
  taleaDisplayFont,
  taleaGlassPanelClass,
  taleaInputClass,
  taleaInsetSurfaceClass,
  taleaPageShellClass,
  taleaSurfaceClass,
} from "@/components/talea/TaleaPastelPrimitives";

const headingFont = taleaDisplayFont;
const bodyFont = taleaBodyFont;

type ViewMode = "grid" | "list";
type SortMode = "newest" | "oldest" | "title";
type ContentTab = "stories" | "characters" | "studio";
type TranslateFn = TFunction;

const statusMeta: Record<Story["status"], { className: string }> = {
  complete: {
    className: "bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800",
  },
  generating: {
    className: "bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800",
  },
  error: {
    className: "bg-rose-100 text-rose-600 border-rose-200 dark:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800",
  },
};

function formatDate(value: string, locale = "de-DE") {
  return new Date(value).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStoryPreviewText(story: Story) {
  return story.summary || story.description || null;
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

function translateWithFallback(t: TranslateFn, key: string, fallback: string): string {
  const translated = t(key, { defaultValue: fallback });
  return typeof translated === "string" ? translated : fallback;
}

function formatGenreLabel(genre: string, t: TranslateFn): string {
  if (!genre) return translateWithFallback(t, "storiesScreen.genre.unknown", "Unbekannt");
  const key = `storiesScreen.genre.${genre}`;
  const translated = translateWithFallback(t, key, "");
  if (translated && translated !== key) return translated;
  return genre
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatLengthLabel(length: string, t: TranslateFn): string {
  if (!length) return translateWithFallback(t, "storiesScreen.length.unknown", "Unbekannt");
  const key = `storiesScreen.length.${length}`;
  const translated = translateWithFallback(t, key, "");
  if (translated && translated !== key) return translated;
  return length;
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
  <TaleaPageBackground isDark={isDark} />
);

const LoadingState: React.FC = () => {
  const { t } = useTranslation();
  return (
    <TaleaLoadingState
      title={t("storiesScreen.loadingTitle")}
      subtitle={t("storiesScreen.loadingSubtitle")}
      icon={<BookOpen className="h-9 w-9" />}
    />
  );
};

/**
 * Cover-Darstellung ohne Crop: Die Story-Cover werden quadratisch (1024x1024)
 * generiert. Statt sie in flache Container zu quetschen (object-cover schnitt
 * Köpfe ab), zeigt das Bild sich vollständig (object-contain) über einer
 * unscharfen Version seiner selbst, die den Container füllt.
 */
const StoryCoverMedia: React.FC<{
  src?: string | null;
  alt: string;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
  revealDelayMs?: number;
  fallbackIconClassName?: string;
}> = ({ src, alt, loading = "lazy", fetchPriority = "auto", revealDelayMs = 0, fallbackIconClassName = "h-12 w-12" }) => (
  <div className="relative h-full w-full overflow-hidden rounded-[18px]">
    {src ? (
      <img
        src={src}
        alt=""
        loading={loading}
        decoding="async"
        aria-hidden
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-75 blur-xl"
      />
    ) : null}
    <ProgressiveImage
      src={src}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      revealDelayMs={revealDelayMs}
      containerClassName="relative h-full w-full"
      imageClassName="object-contain transition-transform duration-700 ease-out group-hover:scale-[1.03]"
      fallback={
        <div className="flex h-full w-full items-center justify-center bg-[var(--talea-gradient-nature)] text-[var(--talea-text-tertiary)]">
          <BookOpen className={fallbackIconClassName} />
        </div>
      }
    />
  </div>
);

const FilterSelect: React.FC<{ value: string; onChange: (v: string) => void; options: { label: string; value: string }[]; label: string; allLabel?: string }> = ({ value, onChange, options, label, allLabel }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={cn(taleaInputClass, "cursor-pointer appearance-none")}
    aria-label={label}
  >
    <option value="all">{allLabel || label}</option>
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);

const StoryStatusChip: React.FC<{ status: Story["status"] }> = ({ status }) => {
  const { t } = useTranslation();
  if (status === "complete") return null;

  return (
    <span className={cn("inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] shadow-sm", statusMeta[status].className)}>
      {t(`storiesScreen.status.${status}`, status)}
    </span>
  );
};

const StoryImageSkipChip: React.FC = () => (
  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 shadow-sm dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300">
    <ImageOff className="h-3.5 w-3.5" />
    Bilder ubersprungen
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
  const isFeatured = index === 0;
  const imagesSkipped = wereStoryImagesSkipped(story);

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={reduceMotion ? undefined : { y: -4 }}
      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
      className={cn(
        "group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-[var(--talea-border-light)] bg-white/70 dark:bg-[var(--talea-surface-primary)] transition-all duration-300 hover:border-transparent hover:shadow-lg",
        isFeatured && "lg:flex-row"
      )}
      onClick={onRead}
    >
      <div className={cn("relative w-full shrink-0 p-2", isFeatured && "lg:w-[44%] lg:self-center")}>
        <div className={cn(taleaInsetSurfaceClass, "relative aspect-square w-full overflow-hidden rounded-[26px] border-0 p-2")}>
          <StoryCoverMedia
            src={story.coverImageUrl}
            alt={story.title}
            loading={index < 3 ? "eager" : "lazy"}
            fetchPriority={isFeatured ? "high" : "auto"}
            revealDelayMs={index * 35}
            fallbackIconClassName="h-14 w-14"
          />
        </div>

        <div className="absolute left-4 top-4">
          <StoryStatusChip status={story.status} />
        </div>

        {imagesSkipped ? (
          <div className="absolute left-4 top-14">
            <StoryImageSkipChip />
          </div>
        ) : null}

        <div className="absolute right-4 top-4 flex gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
          {canSaveOffline && story.status === "complete" && onToggleOffline && (
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} type="button" onClick={onToggleOffline} disabled={isSavingOffline} className="rounded-full border border-white/20 bg-black/35 backdrop-blur-md p-2 text-white hover:bg-black/55 shadow-sm">
              {isSavingOffline ? <Clock3 className="h-4 w-4 animate-spin" /> : isSavedOffline ? <BookmarkCheck className="h-4 w-4 text-emerald-400" /> : <Bookmark className="h-4 w-4" />}
            </motion.button>
          )}
          {canDownload && story.status === "complete" && (
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} type="button" onClick={onDownloadPdf} className="rounded-full border border-white/20 bg-black/35 backdrop-blur-md p-2 text-white hover:bg-black/55 shadow-sm">
              {isDownloading ? <Clock3 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </motion.button>
          )}
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="rounded-full border border-white/20 bg-[#7d434f]/82 backdrop-blur-md p-2 text-white hover:bg-[#8f4c5a] shadow-sm">
            <Trash2 className="h-4 w-4" />
          </motion.button>
        </div>
      </div>

      <div className={cn("flex flex-1 flex-col p-4 sm:p-5", isFeatured && "lg:justify-between lg:py-6")}>
        <div>
          {isFeatured ? (
            <span className={cn(taleaChipClass, "border-white/80 bg-white/86 text-[var(--talea-text-secondary)] dark:border-white/10 dark:bg-white/5 dark:text-[var(--talea-text-secondary)]")}>
              Empfohlen
            </span>
          ) : null}
          <h3 className={cn("line-clamp-2 font-semibold leading-tight text-slate-900 dark:text-white", isFeatured ? "mt-4 text-[1.85rem] sm:text-[2.2rem]" : "text-xl")} style={{ fontFamily: headingFont }}>
            {story.title}
          </h3>
        </div>
        <p className={cn("mt-3 flex-1 font-medium leading-7 text-slate-600 dark:text-slate-300", isFeatured ? "line-clamp-4 text-base" : "line-clamp-2 text-sm")}>
          {getStoryPreviewText(story)}
        </p>
        {imagesSkipped ? (
          <p className="mt-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
            Bildgenerierung wurde nach der Qualitatsprufung ubersprungen.
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 border-t border-[var(--talea-border-light)] pt-5 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StoryParticipantsDialog story={story} maxVisible={isFeatured ? 5 : 4} />
            <span className="rounded-full border border-white/80 bg-white/86 px-3 py-1 text-xs font-semibold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">{formatDate(story.createdAt)}</span>
          </div>
          {isFeatured ? (
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-300">
              <Sparkles className="h-4 w-4 text-[var(--primary)] dark:text-[var(--talea-text-secondary)]" />
              Direkt weiterlesen
            </div>
          ) : null}
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
  const imagesSkipped = wereStoryImagesSkipped(story);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.995 }}
      onClick={onRead}
      className="group cursor-pointer"
    >
      <div className="flex flex-col gap-4 overflow-hidden rounded-2xl border border-[var(--talea-border-light)] bg-white/70 dark:bg-[var(--talea-surface-primary)] p-1.5 transition-all duration-300 hover:border-transparent hover:shadow-lg sm:flex-row sm:p-2">
        <div className={cn(taleaInsetSurfaceClass, "relative aspect-[4/3] shrink-0 overflow-hidden rounded-[26px] border-0 p-2 sm:aspect-auto sm:h-auto sm:w-56 lg:w-64")}>
          <StoryCoverMedia
            src={story.coverImageUrl}
            alt={story.title}
            revealDelayMs={index * 30}
            fallbackIconClassName="h-10 w-10"
          />
        </div>

        <div className="flex flex-1 flex-col px-2 pb-4 sm:px-0 sm:py-4 sm:pr-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <h3 className="line-clamp-2 text-2xl font-semibold leading-tight text-slate-900 dark:text-white" style={{ fontFamily: headingFont }}>{story.title}</h3>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <StoryStatusChip status={story.status} />
              {imagesSkipped ? <StoryImageSkipChip /> : null}
              
              <div className="hidden sm:flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {canSaveOffline && story.status === "complete" && onToggleOffline && (
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} type="button" onClick={onToggleOffline} disabled={isSavingOffline} className="rounded-full border border-white/80 bg-white/86 p-2 text-slate-500 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                    {isSavingOffline ? <Clock3 className="h-4 w-4 animate-spin" /> : isSavedOffline ? <BookmarkCheck className="h-4 w-4 text-emerald-500" /> : <Bookmark className="h-4 w-4" />}
                  </motion.button>
                )}
                {canDownload && story.status === "complete" && (
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} type="button" onClick={onDownloadPdf} className="rounded-full border border-white/80 bg-white/86 p-2 text-slate-500 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                    {isDownloading ? <Clock3 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  </motion.button>
                )}
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="rounded-full border border-[#f1d8de] bg-[#fff4f6] p-2 text-[#a14b5e] dark:border-[#4a2730] dark:bg-[#331921] dark:text-[#ffb3c1]">
                  <Trash2 className="h-4 w-4" />
                </motion.button>
              </div>
            </div>
          </div>
          
          <p className="mt-3 line-clamp-2 text-base font-medium leading-7 text-slate-600 dark:text-slate-300">{getStoryPreviewText(story)}</p>
          {imagesSkipped ? (
            <p className="mt-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
              Bildgenerierung wurde nach der Qualitatsprufung ubersprungen.
            </p>
          ) : null}
          
          <div className="mt-auto flex flex-col gap-4 border-t border-[var(--talea-border-light)] pt-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
            <StoryParticipantsDialog story={story} maxVisible={5} />
            <span className="self-start rounded-full border border-white/80 bg-white/86 px-3 py-1.5 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 sm:self-auto">{formatDate(story.createdAt)}</span>
          </div>
          <div className="mt-3 flex items-center gap-2 sm:hidden">
            {canSaveOffline && story.status === "complete" && onToggleOffline && (
              <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} type="button" onClick={onToggleOffline} disabled={isSavingOffline} className="rounded-full border border-white/80 bg-white/86 p-2 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                {isSavingOffline ? <Clock3 className="h-4 w-4 animate-spin" /> : isSavedOffline ? <BookmarkCheck className="h-4 w-4 text-emerald-500" /> : <Bookmark className="h-4 w-4" />}
              </motion.button>
            )}
            {canDownload && story.status === "complete" && (
              <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} type="button" onClick={onDownloadPdf} className="rounded-full border border-white/80 bg-white/86 p-2 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                {isDownloading ? <Clock3 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </motion.button>
            )}
            <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="rounded-full border border-[#f1d8de] bg-[#fff4f6] p-2 text-[#a14b5e] dark:border-[#4a2730] dark:bg-[#331921] dark:text-[#ffb3c1]">
              <Trash2 className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.article>
  );
};

const PremiumStoriesSignedOut: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[78vh] items-center justify-center px-3 py-8 sm:px-4 sm:py-10">
      <div className={cn(taleaSurfaceClass, "w-full max-w-5xl overflow-hidden p-2 sm:p-3 md:p-4")}>
        <div className="grid gap-4 lg:grid-cols-[1.06fr_0.94fr]">
          <div className={cn(taleaInsetSurfaceClass, "flex flex-col justify-between gap-6 p-6 sm:gap-8 sm:p-8 md:p-10")}>
            <div>
              <span className={cn(taleaChipClass, "border-white/80 bg-white/86 text-[var(--talea-text-secondary)] dark:border-white/10 dark:bg-white/5 dark:text-[var(--talea-text-secondary)]")}>
                <img src={taleaLogo} alt="Talea Logo" className="mr-3 h-7 w-7 rounded-2xl object-cover" />
                Story Stream
              </span>
              <h1 className="mt-6 text-[2.45rem] font-semibold leading-[1.04] text-slate-900 dark:text-white sm:mt-8 md:text-[3.8rem]" style={{ fontFamily: headingFont }}>
                Alle Geschichten an einem Ort.
              </h1>
              <p className="mt-5 max-w-2xl text-base font-medium leading-8 text-slate-600 dark:text-slate-300 md:text-lg">
                Weiterlesen, neue Abenteuer starten und alles nach Genre, Alter oder Figuren filtern.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <TaleaActionButton icon={<LogIn className="h-4 w-4" />} onClick={() => navigate("/auth")}>
                Jetzt anmelden
              </TaleaActionButton>
              <TaleaActionButton variant="secondary" icon={<BookOpen className="h-4 w-4" />} onClick={() => navigate("/auth")}>
                Bibliothek betreten
              </TaleaActionButton>
            </div>
          </div>

          <div className="grid gap-4">
            {[
              "Weiterlesen und Reihen fortsetzen",
              "Eigene Abenteuer schnell wiederfinden",
              "Stories, Audio und Dokus direkt nebeneinander",
            ].map((item) => (
              <div key={item} className={cn(taleaSurfaceClass, "p-5 sm:p-6")}>
                <p className="text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

type StoriesSignedInContentProps = {
  contentTab: ContentTab;
  setContentTab: (value: ContentTab) => void;
  total: number;
  completeCount: number;
  generatingCount: number;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  viewMode: ViewMode;
  setViewMode: (value: ViewMode) => void;
  showFilters: boolean;
  setShowFilters: (value: boolean) => void;
  sortMode: SortMode;
  setSortMode: (value: SortMode) => void;
  genreFilter: string;
  setGenreFilter: (value: string) => void;
  ageGroupFilter: string;
  setAgeGroupFilter: (value: string) => void;
  lengthFilter: string;
  setLengthFilter: (value: string) => void;
  avatarFilter: string;
  setAvatarFilter: (value: string) => void;
  genreFilterOptions: { label: string; value: string }[];
  ageGroupFilterOptions: { label: string; value: string }[];
  lengthFilterOptions: { label: string; value: string }[];
  avatarFilterOptions: { label: string; value: string }[];
  filteredStories: Story[];
  loading: boolean;
  hasActiveFilters: boolean;
  isDesktop: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  observerTarget: React.RefObject<HTMLDivElement | null>;
  isAdmin: boolean;
  downloadingStoryId: string | null;
  canUseOffline: boolean;
  isStorySaved: (storyId: string) => boolean;
  isSaving: (storyId: string) => boolean;
  toggleStory: (storyId: string) => void;
  onDeleteStory: (storyId: string, title: string) => void;
  onDownloadPdf: (storyId: string, status: Story["status"], event: React.MouseEvent<HTMLButtonElement>) => void;
  onResetFilters: () => void;
  onRefresh: () => void;
  goTo: (path: string) => void;
};

const StoriesSignedInContent: React.FC<StoriesSignedInContentProps> = ({
  contentTab,
  setContentTab,
  total,
  completeCount,
  generatingCount,
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  showFilters,
  setShowFilters,
  sortMode,
  setSortMode,
  genreFilter,
  setGenreFilter,
  ageGroupFilter,
  setAgeGroupFilter,
  lengthFilter,
  setLengthFilter,
  avatarFilter,
  setAvatarFilter,
  genreFilterOptions,
  ageGroupFilterOptions,
  lengthFilterOptions,
  avatarFilterOptions,
  filteredStories,
  loading,
  hasActiveFilters,
  isDesktop,
  loadingMore,
  hasMore,
  observerTarget,
  isAdmin,
  downloadingStoryId,
  canUseOffline,
  isStorySaved,
  isSaving,
  toggleStory,
  onDeleteStory,
  onDownloadPdf,
  onResetFilters,
  onRefresh,
  goTo,
}) => {
  const { t } = useTranslation();
  const featuredStory = filteredStories[0];
  const shelfStories = filteredStories.slice(featuredStory ? 1 : 0);
  const showFilterPanel = isDesktop || showFilters;
  const isStudioTabActive = isAdmin && contentTab === "studio";

  return (
    <div className={cn(taleaPageShellClass, "flex flex-col gap-4 pb-6 pt-2 sm:gap-6 sm:pb-8 sm:pt-6")}>
      <div className={cn(taleaSurfaceClass, "p-3 sm:p-5 md:px-7 md:py-6")}>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--talea-text-tertiary)]">
              Story Stream
            </p>
            <h1 className="mt-1 text-[1.9rem] font-semibold leading-[1.05] text-slate-900 dark:text-white sm:text-[2.3rem]" style={{ fontFamily: headingFont }}>
              {t("story.myStories")}
            </h1>
            <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
              {t("homeScreen.yourStoriesSubtitle")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <TaleaActionButton variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={onRefresh} aria-label={t("common.refresh")}>
              <span className="hidden sm:inline">{t("common.refresh")}</span>
            </TaleaActionButton>
            <TaleaActionButton icon={<Plus className="h-4 w-4" />} onClick={() => goTo("/story")}>
              {t("homeScreen.newStory")}
            </TaleaActionButton>
          </div>
        </div>

        <div className="mt-4 grid gap-3 border-t border-[var(--talea-border-light)] pt-4 dark:border-white/10 lg:grid-cols-[auto_1fr] lg:items-center">
          <div className="grid grid-flow-col auto-cols-fr rounded-[1.25rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] p-1 dark:border-white/10">
            <button type="button" onClick={() => setContentTab("stories")} className={cn("rounded-[0.95rem] px-3 py-2 text-sm font-semibold transition sm:px-5", contentTab === "stories" ? "bg-white text-[var(--primary)] shadow-sm dark:bg-white/10 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200")}>
              {t("storiesScreen.storiesTab")}
            </button>
            <button type="button" role="tab" aria-selected={contentTab === "characters"} onClick={() => setContentTab("characters")} className={cn("rounded-[0.95rem] px-3 py-2 text-sm font-semibold transition sm:px-5", contentTab === "characters" ? "bg-white text-[var(--primary)] shadow-sm dark:bg-white/10 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200")}>
              Charaktere
            </button>
            {isAdmin ? (
              <button type="button" onClick={() => setContentTab("studio")} className={cn("rounded-[0.95rem] px-3 py-2 text-sm font-semibold transition sm:px-5", contentTab === "studio" ? "bg-white text-[var(--primary)] shadow-sm dark:bg-white/10 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200")}>
                {t("storiesScreen.studioTab")}
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-3 divide-x divide-[var(--talea-border-light)] rounded-[1.25rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] dark:border-white/10">
            {[
              { label: t("common.total"), value: total, dot: "bg-[var(--primary)]" },
              { label: t("storiesScreen.status.complete"), value: completeCount, dot: "bg-emerald-400" },
              { label: t("storiesScreen.status.generating"), value: generatingCount, dot: "bg-amber-400" },
            ].map((item) => (
              <div key={item.label} className="flex min-w-0 items-center justify-center gap-1.5 px-2 py-2.5">
                <span className={cn("h-2 w-2 rounded-full", item.dot)} aria-hidden />
                <span className="text-sm font-bold text-slate-900 tabular-nums dark:text-white">{item.value}</span>
                <span className="truncate text-[10px] font-medium text-slate-500 dark:text-slate-400 sm:text-xs">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {contentTab === "characters" ? (
        <CharacterOriginsScreen />
      ) : !isStudioTabActive ? (
        <div className="flex flex-col gap-6 sm:gap-8 xl:flex-row xl:items-start">
          <div className="w-full xl:w-[18.5rem] xl:shrink-0 xl:sticky xl:top-24">
            <div className="flex items-center gap-3 xl:hidden">
              <TaleaActionButton variant="secondary" className="flex-1" icon={<Filter className="h-4 w-4" />} onClick={() => setShowFilters(!showFilters)}>
                Filter
              </TaleaActionButton>
              <div className={cn(taleaSurfaceClass, "flex gap-1 p-1")}>
                <button type="button" onClick={() => setViewMode("grid")} className={cn("rounded-full p-3", viewMode === "grid" ? "bg-white/90 text-slate-900 dark:bg-white/10 dark:text-white" : "text-slate-400")}><Grid3X3 className="h-4 w-4" /></button>
                <button type="button" onClick={() => setViewMode("list")} className={cn("rounded-full p-3", viewMode === "list" ? "bg-white/90 text-slate-900 dark:bg-white/10 dark:text-white" : "text-slate-400")}><LayoutList className="h-4 w-4" /></button>
              </div>
            </div>

            <AnimatePresence>
              {showFilterPanel ? (
                <motion.div initial={{ opacity: 0, height: isDesktop ? "auto" : 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className={cn(taleaSurfaceClass, "mt-3 p-4 sm:p-5 xl:mt-0")}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Filter</p>
                      {hasActiveFilters ? (
                        <button type="button" onClick={onResetFilters} className="text-sm font-semibold text-red-500 dark:text-red-400">
                          {t("common.cancel", "Zurücksetzen")}
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-4 space-y-3">
                      <FilterSelect label={t("common.sort", "Sortierung")} value={sortMode} onChange={(value) => setSortMode(value as SortMode)} options={[{ value: "newest", label: t("storiesScreen.sortNewest") }, { value: "oldest", label: t("storiesScreen.sortOldest") }, { value: "title", label: t("storiesScreen.sortTitle") }]} />
                      <FilterSelect label={t("storiesScreen.filterGenre")} value={genreFilter} onChange={setGenreFilter} options={genreFilterOptions} allLabel={t("storiesScreen.filterAll", { label: t("storiesScreen.filterGenre") })} />
                      <FilterSelect label={t("storiesScreen.filterAge")} value={ageGroupFilter} onChange={setAgeGroupFilter} options={ageGroupFilterOptions} allLabel={t("storiesScreen.filterAll", { label: t("storiesScreen.filterAge") })} />
                      <FilterSelect label={t("storiesScreen.filterLength")} value={lengthFilter} onChange={setLengthFilter} options={lengthFilterOptions} allLabel={t("storiesScreen.filterAll", { label: t("storiesScreen.filterLength") })} />
                      <FilterSelect label={t("storiesScreen.filterAvatar")} value={avatarFilter} onChange={setAvatarFilter} options={avatarFilterOptions} allLabel={t("storiesScreen.filterAll", { label: t("storiesScreen.filterAvatar") })} />
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="min-w-0 flex-1">
            <div className={cn(taleaGlassPanelClass, "flex flex-col gap-3 p-3 lg:flex-row lg:items-center")}>
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t("common.search")} className={cn(taleaInputClass, "pl-11 pr-4")} />
              </div>
              <div className="hidden items-center gap-3 xl:flex">
                <span className="whitespace-nowrap text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {filteredStories.length} Titel
                </span>
                <div className="flex gap-1 rounded-full border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] p-1 dark:border-white/10">
                  <button type="button" aria-label="Rasteransicht" onClick={() => setViewMode("grid")} className={cn("rounded-full p-2.5", viewMode === "grid" ? "bg-white text-[var(--primary)] shadow-sm dark:bg-white/10 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300")}><Grid3X3 className="h-4 w-4" /></button>
                  <button type="button" aria-label="Listenansicht" onClick={() => setViewMode("list")} className={cn("rounded-full p-2.5", viewMode === "list" ? "bg-white text-[var(--primary)] shadow-sm dark:bg-white/10 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300")}><LayoutList className="h-4 w-4" /></button>
                </div>
              </div>
            </div>

            <div className="mt-5" role="status" aria-live="polite">
              <div>
                {loading ? (
                  <LoadingState />
                ) : filteredStories.length === 0 ? (
                  <div className={cn(taleaInsetSurfaceClass, "p-8 text-center sm:p-10")}>
                    <h3 className="text-[2rem] font-semibold text-slate-900 dark:text-white" style={{ fontFamily: headingFont }}>
                      {hasActiveFilters ? t("storiesScreen.noFilterResults") : t("storiesScreen.noStories")}
                    </h3>
                    <p className="mt-3 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                      {hasActiveFilters ? t("storiesScreen.noFilterResultsDesc") : t("storiesScreen.noStoriesDesc")}
                    </p>
                    <div className="mt-6 flex justify-center">
                      <TaleaActionButton onClick={hasActiveFilters ? onResetFilters : () => goTo("/story")}>
                        {hasActiveFilters ? t("common.cancel") : t("storiesScreen.createFirstStory")}
                      </TaleaActionButton>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {featuredStory ? (
                      <GridStoryCard
                        story={featuredStory}
                        index={0}
                        onRead={() => goTo(`/story-reader/${featuredStory.id}`)}
                        onDelete={() => onDeleteStory(featuredStory.id, featuredStory.title)}
                        canDownload={isAdmin}
                        onDownloadPdf={(event) => onDownloadPdf(featuredStory.id, featuredStory.status, event)}
                        isDownloading={downloadingStoryId === featuredStory.id}
                        canSaveOffline={canUseOffline}
                        isSavedOffline={isStorySaved(featuredStory.id)}
                        isSavingOffline={isSaving(featuredStory.id)}
                        onToggleOffline={(event) => {
                          event.stopPropagation();
                          toggleStory(featuredStory.id);
                        }}
                      />
                    ) : null}

                    <div className={cn(viewMode === "grid" ? "grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3 sm:gap-6" : "flex flex-col gap-5 sm:gap-6")}>
                      {shelfStories.map((story, index) =>
                        viewMode === "grid" ? (
                          <GridStoryCard
                            key={story.id}
                            story={story}
                            index={index + 1}
                            onRead={() => goTo(`/story-reader/${story.id}`)}
                            onDelete={() => onDeleteStory(story.id, story.title)}
                            canDownload={isAdmin}
                            onDownloadPdf={(event) => onDownloadPdf(story.id, story.status, event)}
                            isDownloading={downloadingStoryId === story.id}
                            canSaveOffline={canUseOffline}
                            isSavedOffline={isStorySaved(story.id)}
                            isSavingOffline={isSaving(story.id)}
                            onToggleOffline={(event) => {
                              event.stopPropagation();
                              toggleStory(story.id);
                            }}
                          />
                        ) : (
                          <ListStoryRow
                            key={story.id}
                            story={story}
                            index={index + 1}
                            onRead={() => goTo(`/story-reader/${story.id}`)}
                            onDelete={() => onDeleteStory(story.id, story.title)}
                            canDownload={isAdmin}
                            onDownloadPdf={(event) => onDownloadPdf(story.id, story.status, event)}
                            isDownloading={downloadingStoryId === story.id}
                            canSaveOffline={canUseOffline}
                            isSavedOffline={isStorySaved(story.id)}
                            isSavingOffline={isSaving(story.id)}
                            onToggleOffline={(event) => {
                              event.stopPropagation();
                              toggleStory(story.id);
                            }}
                          />
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {hasMore && !loading ? (
              <div ref={observerTarget} className="mt-12 flex justify-center">
                {loadingMore ? (
                  <div className={cn(taleaSurfaceClass, "inline-flex items-center gap-3 px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-100")}>
                    <Clock3 className="h-4 w-4 animate-spin" />
                    Mehr Stories laden...
                  </div>
                ) : (
                  <div className="h-10" />
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className={cn(taleaSurfaceClass, "p-2")}>
          <div className={cn(taleaInsetSurfaceClass, "p-0")}>
            <TaleaStudioWorkspace />
          </div>
        </div>
      )}
    </div>
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
  const isDark = resolvedTheme === "dark";
  const isDesktop = useMediaQuery("(min-width: 1280px)");

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
      const response = await backend.story.list({
        limit: 12,
        offset: 0,
        profileId: activeProfileId || undefined,
      });
      setStories((response.stories as unknown as Story[]) || []);
      setTotal(response.total || 0);
      setHasMore(response.hasMore || false);
    } catch (error) {
      console.error("Error loading stories:", error);
    } finally {
      setLoading(false);
    }
  }, [backend, activeProfileId]);

  const loadMoreStories = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    try {
      setLoadingMore(true);
      const response = await backend.story.list({
        limit: 12,
        offset: stories.length,
        profileId: activeProfileId || undefined,
      });
      setStories((prev) => [...prev, ...((response.stories as unknown as Story[]) || [])]);
      setHasMore(response.hasMore || false);
    } catch (error) {
      console.error("Error loading more stories:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [backend, hasMore, loadingMore, stories.length, activeProfileId]);

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
      await backend.story.deleteStory({ id: storyId, profileId: activeProfileId || undefined });
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
      const fullStory = await backend.story.get({ id: storyId, profileId: activeProfileId || undefined });
      if (!fullStory.chapters || fullStory.chapters.length === 0) return;
      await exportStoryAsPDF(fullStory as any);
    } catch (error) {
      console.error("PDF export failed:", error);
    } finally {
      setDownloadingStoryId(null);
    }
  };

  const genreFilterOptions = useMemo(() => Array.from(new Set(stories.map((story) => getStoryGenreKey(story)).filter(Boolean))).map(v => ({ value: v, label: formatGenreLabel(v, t) })).sort((a,b)=>a.label.localeCompare(b.label)), [stories, t]);
  const ageGroupFilterOptions = useMemo(() => Array.from(new Set(stories.map((story) => getStoryAgeGroupKey(story)).filter(Boolean))).map(v => ({ value: v, label: v })).sort((a,b)=>a.label.localeCompare(b.label)), [stories]);
  const lengthFilterOptions = useMemo(() => Array.from(new Set(stories.map((story) => getStoryLengthKey(story)).filter(Boolean))).map(v => ({ value: v, label: formatLengthLabel(v, t) })), [stories, t]);
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
    <div className="relative min-h-screen overflow-x-hidden pb-24 sm:pb-28" style={{ fontFamily: bodyFont }}>
      <KidsAppBackground isDark={isDark} />

      <SignedOut>
        <PremiumStoriesSignedOut />
      </SignedOut>

      <SignedIn>
        <StoriesSignedInContent
          contentTab={contentTab}
          setContentTab={setContentTab}
          total={total}
          completeCount={completeCount}
          generatingCount={generatingCount}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          viewMode={viewMode}
          setViewMode={setViewMode}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          sortMode={sortMode}
          setSortMode={setSortMode}
          genreFilter={genreFilter}
          setGenreFilter={setGenreFilter}
          ageGroupFilter={ageGroupFilter}
          setAgeGroupFilter={setAgeGroupFilter}
          lengthFilter={lengthFilter}
          setLengthFilter={setLengthFilter}
          avatarFilter={avatarFilter}
          setAvatarFilter={setAvatarFilter}
          genreFilterOptions={genreFilterOptions}
          ageGroupFilterOptions={ageGroupFilterOptions}
          lengthFilterOptions={lengthFilterOptions}
          avatarFilterOptions={avatarFilterOptions}
          filteredStories={filteredStories}
          loading={loading}
          hasActiveFilters={hasActiveFilters}
          isDesktop={isDesktop}
          loadingMore={loadingMore}
          hasMore={hasMore}
          observerTarget={observerTarget}
          isAdmin={isAdmin}
          downloadingStoryId={downloadingStoryId}
          canUseOffline={canUseOffline}
          isStorySaved={isStorySaved}
          isSaving={isSaving}
          toggleStory={toggleStory}
          onDeleteStory={handleDeleteStory}
          onDownloadPdf={handleDownloadPdf}
          onResetFilters={() => {
            setSearchQuery("");
            setGenreFilter("all");
            setAgeGroupFilter("all");
            setLengthFilter("all");
            setAvatarFilter("all");
          }}
          onRefresh={() => {
            if (contentTab === "stories") {
              void loadStories();
            }
          }}
          goTo={navigate}
        />
      </SignedIn>
    </div>
  );
};

export default TaleaStoriesScreen;
