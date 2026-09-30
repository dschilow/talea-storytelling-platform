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
  ImageOff,
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
import { wereStoryImagesSkipped } from "../../utils/storyQualityGate";
import { cn } from "@/lib/utils";
import { StoryParticipantsDialog } from "@/components/story/StoryParticipantsDialog";
import taleaLogo from "@/img/talea_logo.png";
import { useTheme } from "@/contexts/ThemeContext";
import { useOptionalChildProfiles } from "@/contexts/ChildProfilesContext";
import CosmosHomeCard from '../Cosmos/CosmosHomeCard';
import { useCosmosState } from '../Cosmos/useCosmosState';
// TaviHomeGreeting moved from hero area — can be re-added as floating element
// import { TaviHomeGreeting } from '../../agents';
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
import { TaleaCardMenu, type TaleaCardMenuAction } from "@/components/talea/TaleaCardMenu";

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

function formatDate(value: string, locale?: string) {
  return new Date(value).toLocaleDateString(locale || "de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getDateLocale(i18nLang: string): string {
  const map: Record<string, string> = {
    de: "de-DE", en: "en-GB", fr: "fr-FR", es: "es-ES", it: "it-IT", nl: "nl-NL", ru: "ru-RU",
  };
  return map[i18nLang] || "de-DE";
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

const LoadingState: React.FC = () => {
  const { t } = useTranslation();
  return (
    <TaleaLoadingState
      title={t("homeScreen.loadingTitle", "Talea richtet die Startseite neu ein")}
      subtitle={t("homeScreen.loadingSubtitle", "Die Geschichten, Helden und Dokus werden gerade in ihre neuen Bereiche sortiert.")}
      icon={<WandSparkles className="h-9 w-9" />}
    />
  );
};

const SignedOutStart: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const features = [
    { icon: "📚", textKey: "homeScreen.featureStreams", color: "text-cyan-600 dark:text-cyan-300", bg: "bg-cyan-100 dark:bg-cyan-900/50" },
    { icon: "🦸‍♀️", textKey: "homeScreen.featureAvatarAccess", color: "text-pink-600 dark:text-pink-300", bg: "bg-pink-100 dark:bg-pink-900/50" },
    { icon: "💡", textKey: "homeScreen.featureDokuStyle", color: "text-yellow-600 dark:text-yellow-300", bg: "bg-yellow-100 dark:bg-yellow-900/50" },
  ];

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
                {t("homeScreen.signedOutTitle", "Geschichten, Figuren und Wissen an einem Ort.")}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-6 max-w-xl text-lg font-bold leading-relaxed text-slate-500 dark:text-slate-400"
              >
                {t("home.subtitle", "Organisiere Avatare, Geschichten und Dokus in einer wunderbaren Umgebung für die besten Leseabenteuer.")}
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
                {t("homeScreen.adventureBegins", "Das Abenteuer beginnt")}
              </motion.button>
            </div>

            <div className="bg-gradient-to-br from-pink-100 to-cyan-100 dark:from-slate-800 dark:to-indigo-950 p-10 flex flex-col justify-center relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/40 dark:bg-white/5 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-pink-300/30 dark:bg-purple-500/20 rounded-full blur-3xl"></div>

              <div className="relative z-10">
                <p className="text-center text-sm font-black tracking-widest text-pink-500 dark:text-indigo-300 mb-8">
                  {t("homeScreen.discoverWorld", "ENTDECKE DEINE WELT")}
                </p>
                <ul className="flex flex-col gap-5 text-base font-extrabold text-slate-700 dark:text-slate-200">
                  {features.map((item, i) => (
                    <motion.li
                      key={item.textKey}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                      whileHover={{ scale: 1.03, x: 8 }}
                      className="flex items-center gap-4 rounded-[1.5rem] border-4 border-white/80 dark:border-slate-700 bg-white/70 dark:bg-slate-800 px-5 py-4 shadow-lg backdrop-blur-md cursor-default"
                    >
                      <span className={cn("flex h-12 w-12 items-center justify-center rounded-[1rem] shadow-inner text-xl", item.bg, item.color)}>
                        {item.icon}
                      </span>
                      {t(item.textKey)}
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

const StoryStatusTag: React.FC<{ status: Story["status"] }> = ({ status }) => {
  const { t } = useTranslation();
  if (status === "complete") return null;

  const label = t(`homeScreen.status.${status}`, status);
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={cn(
        "absolute right-5 top-5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] shadow-sm z-20",
        status === "generating" && "border-transparent bg-[#fde9cf] text-slate-900 dark:bg-[#493419] dark:text-white",
        status === "error" && "border-transparent bg-[#f9d8dd] text-slate-900 dark:bg-[#4d1f29] dark:text-white"
      )}
    >
      {label}
    </motion.span>
  );
};

const StoryImageSkipTag: React.FC = () => (
  <motion.span
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    className="absolute left-5 top-5 z-20 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 shadow-sm dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300"
  >
    <ImageOff className="h-3.5 w-3.5" />
    Bilder ubersprungen
  </motion.span>
);

const StoryCard: React.FC<{
  story: Story;
  onRead: () => void;
  onDelete: () => void;
  canSaveOffline?: boolean;
  isSavedOffline?: boolean;
  isSavingOffline?: boolean;
  onToggleOffline?: () => void;
  index: number;
}> = ({ story, onRead, onDelete, canSaveOffline, isSavedOffline, isSavingOffline, onToggleOffline, index }) => {
  const reduceMotion = useReducedMotion();
  const { t } = useTranslation();
  const imagesSkipped = wereStoryImagesSkipped(story);
  const genre = String(story.config?.genre || "").replace(/[-_]+/g, " ").trim();

  const actions: TaleaCardMenuAction[] = [
    ...(canSaveOffline && story.status === "complete" && onToggleOffline
      ? [{
          label: isSavedOffline ? t("homeScreen.offlineRemove") : t("homeScreen.offlineSave"),
          icon: isSavingOffline ? <Clock3 className="h-4 w-4 animate-spin" /> : isSavedOffline ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />,
          onSelect: onToggleOffline,
          disabled: isSavingOffline,
        }]
      : []),
    { label: t("homeScreen.deleteStory"), icon: <Trash2 className="h-4 w-4" />, onSelect: onDelete, destructive: true },
  ];

  return (
    <motion.article
      variants={itemVariants}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      className="group relative w-[min(68vw,15.5rem)] shrink-0 snap-start sm:w-[15.5rem]"
    >
      <button
        type="button"
        onClick={onRead}
        className="block w-full text-left focus-visible:outline-none"
        aria-label={story.title}
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[var(--talea-media-skeleton)] shadow-[var(--talea-shadow-medium)] ring-1 ring-[var(--talea-border-light)] group-focus-visible:ring-4 group-focus-visible:ring-[var(--primary)]/30">
          {story.coverImageUrl ? (
            <img
              src={story.coverImageUrl}
              alt=""
              loading={index < 3 ? "eager" : "lazy"}
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--talea-text-tertiary)]">
              <BookOpen className="h-12 w-12" />
            </div>
          )}
          <StoryStatusTag status={story.status} />
          {imagesSkipped ? <StoryImageSkipTag /> : null}
        </div>
        <h3
          className="mt-2.5 line-clamp-2 text-[15px] font-semibold leading-snug text-[var(--talea-text-primary)]"
          style={{ fontFamily: headingFont }}
        >
          {story.title}
        </h3>
        <p className="mt-0.5 truncate text-[13px] text-[var(--talea-text-secondary)]">
          {[genre, formatDate(story.createdAt)].filter(Boolean).join(" · ")}
        </p>
      </button>

      <TaleaCardMenu actions={actions} label={`Aktionen für ${story.title}`} className="!absolute right-2 top-2" />
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
    whileTap={{ scale: 0.97 }}
    role="button"
    tabIndex={0}
    onClick={onOpen}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen();
      }
    }}
    className={cn(taleaSurfaceClass, "group relative flex h-[10.5rem] w-[8.5rem] flex-shrink-0 flex-col items-center justify-center p-3 text-center sm:h-52 sm:w-40 sm:p-4")}
  >
    <div className="relative mx-auto mb-3 inline-block">
      <div className="h-[5.5rem] w-[5.5rem] overflow-hidden rounded-full ring-1 ring-[var(--talea-border-light)] sm:h-28 sm:w-28">
        <img
          src={
            avatar.imageUrl ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(avatar.name)}`
          }
          alt={avatar.name}
          className="h-full w-full rounded-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      </div>
    </div>

    <p className="w-full truncate px-2 text-[15px] font-semibold text-[var(--talea-text-primary)]">{avatar.name}</p>
    <p className="mt-0.5 text-[13px] text-[var(--talea-text-tertiary)]">
      {avatar.avatarRole === "child" ? "Kinderprofil" : avatar.creationType === "ai-generated" ? "AI-Figur" : "Fotofigur"}
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
        aria-label={`${avatar.name} löschen`}
      >
        <Trash2 className="h-4 w-4" />
      </motion.button>
    </div>
  </motion.article>
);

const dokuStatusLabel: Record<Doku["status"], string> = {
  complete: "Fertig",
  generating: "Wird erstellt",
  error: "Fehler",
};

const DokuBentoTicket: React.FC<{
  doku: Doku;
  onRead: () => void;
  onDelete: () => void;
}> = ({ doku, onRead, onDelete }) => (
  <motion.article
    variants={itemVariants}
    whileHover={{ y: -4, scale: 1.015, transition: { type: "spring", stiffness: 300, damping: 22 } }}
    whileTap={{ scale: 0.98 }}
    className={cn(taleaSurfaceClass, "group relative cursor-pointer overflow-hidden p-3 transition-colors hover:bg-[var(--talea-surface-inset)]/40 sm:p-4")}
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
    <div className="flex items-center gap-3.5">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--talea-media-skeleton)] sm:h-[4.5rem] sm:w-[4.5rem]">
        {doku.coverImageUrl ? (
          <img src={doku.coverImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#f9ead0_0%,#dcecfb_100%)] text-slate-500 dark:bg-[linear-gradient(135deg,rgba(91,77,52,0.5)_0%,rgba(58,82,115,0.38)_100%)] dark:text-slate-100">
            <Library className="h-8 w-8" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex justify-between items-start gap-2">
          <div>
            <p className="line-clamp-2 text-[17px] font-semibold leading-snug text-[var(--talea-text-primary)]">{doku.title}</p>
            {doku.topic && doku.topic !== doku.title ? (
              <p className="mt-0.5 line-clamp-1 text-[13px] text-[var(--talea-text-secondary)]">{doku.topic}</p>
            ) : null}
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

        <p className="mt-1.5 text-[13px] text-[var(--talea-text-tertiary)]">
          {doku.status !== "complete" ? (
            <span className={doku.status === "error" ? "font-semibold text-[var(--talea-danger)]" : "font-semibold text-[var(--talea-warning)]"}>
              {dokuStatusLabel[doku.status]} ·{" "}
            </span>
          ) : null}
          {formatDate(doku.createdAt)}
        </p>
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
              <span className={cn(taleaChipClass, "border-white/80 bg-white/86 text-[var(--talea-text-secondary)] dark:border-white/10 dark:bg-white/5 dark:text-[var(--primary)]")}>
                <img src={taleaLogo} alt="Talea Logo" className="mr-3 h-8 w-8 rounded-2xl object-cover" />
                Talea Kinderatelier
              </span>
              <h1
                className="mt-6 max-w-3xl text-[2.45rem] font-semibold leading-[1.04] text-slate-900 dark:text-white sm:mt-8 md:text-[4rem]"
                style={{ fontFamily: headingFont }}
              >
                Geschichten, Figuren und Wissen an einem Ort.
              </h1>
              <p className="mt-5 max-w-2xl text-base font-medium leading-8 text-slate-600 dark:text-slate-300 md:text-lg">
                {t(
                  "home.subtitle",
                  "Entdecke neue Geschichten, wechsle zwischen Avataren und starte Dokus oder Audio ohne Umwege."
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
                title: "Weiterhoeren",
                text: "Stories und Audio bleiben griffbereit und koennen direkt fortgesetzt werden.",
                tone: "from-[#f6dce7] to-[#faebd0]",
              },
              {
                title: "Eigene Welt",
                text: "Avatare, Geschichten und Dokus stehen in einer gemeinsamen Familienbibliothek.",
                tone: "from-[#dff0ff] to-[#e2f4ec]",
              },
              {
                title: "Fuer Kinder gemacht",
                text: "Groesse Karten, klare Wege und ruhige Motion machen die App einfacher zu benutzen.",
                tone: "from-[#f3e4fb] to-[#eee1d2]",
              },
            ].map((item) => (
              <div key={item.title} className={cn(taleaSurfaceClass, "relative overflow-hidden p-5 sm:p-6")}>
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-75", item.tone)} />
                <div className="relative z-10">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--talea-text-secondary)] dark:text-[var(--primary)]">Talea</p>
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
}) => {
  const { t } = useTranslation();
  return (
  <motion.div
    variants={containerVariants}
    initial="hidden"
    animate="show"
    className={cn(taleaPageShellClass, "space-y-7 pt-1 sm:space-y-9")}
  >
    {/* -- Large title + quick actions (iOS "Today" style) -- */}
    <motion.header variants={itemVariants} className="px-1">
      <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--talea-text-tertiary)]">
        {new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
      </p>
      <h1
        className="mt-0.5 text-[2rem] font-bold leading-tight text-[var(--talea-text-primary)] md:text-[2.5rem]"
        style={{ fontFamily: headingFont }}
      >
        {greeting}, <span className="text-[var(--primary)]">{userName || t("homeScreen.defaultUser")}</span>
      </h1>
    </motion.header>

    <motion.section variants={itemVariants} className={cn(taleaSurfaceClass, "p-3 sm:p-4")}>
      <div className="grid grid-cols-3 divide-x divide-[var(--talea-border-light)]">
        {[
          { label: t("homeScreen.statsStories"), value: storiesTotal, path: "/stories" },
          { label: t("homeScreen.statsAvatars"), value: avatars.length, path: "/avatar" },
          { label: t("homeScreen.statsDokus"), value: dokusTotal, path: "/doku" },
        ].map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={() => goTo(stat.path)}
            className="flex flex-col items-center gap-0.5 py-1 transition-opacity hover:opacity-75"
          >
            <span className="text-[1.375rem] font-bold tabular-nums text-[var(--talea-text-primary)]">{stat.value}</span>
            <span className="text-[13px] text-[var(--talea-text-secondary)]">{stat.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--talea-border-light)] pt-3 sm:grid-cols-3">
        <TaleaActionButton className="col-span-2 sm:col-span-1" icon={<WandSparkles className="h-4 w-4" />} onClick={() => goTo("/story")}>
          {t("homeScreen.newStory")}
        </TaleaActionButton>
        <TaleaActionButton variant="secondary" icon={<BookOpen className="h-4 w-4" />} onClick={() => goTo("/stories")}>
          {t("homeScreen.library")}
        </TaleaActionButton>
        <TaleaActionButton variant="secondary" icon={<Library className="h-4 w-4" />} onClick={() => goTo("/doku/create")}>
          {t("homeScreen.knowledgeJourney")}
        </TaleaActionButton>
      </div>
    </motion.section>
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-3"
    >
      <TaleaSectionHeading
        eyebrow={t("homeScreen.yourStoriesEyebrow")}
        title={t("homeScreen.yourStories")}
        subtitle={t("homeScreen.yourStoriesSubtitle")}
        actionLabel={t("homeScreen.allStories")}
        onAction={() => goTo("/stories")}
      />

      {stories.length === 0 ? (
        <EmptyStateContainer
          title={t("homeScreen.noStoriesTitle")}
          description={t("homeScreen.noStoriesDesc")}
          icon={<BookOpen className="h-12 w-12 text-blue-500 dark:text-indigo-300" />}
          colorClass="bg-blue-100 dark:bg-slate-700"
          actionLabel={t("homeScreen.createFirstStory")}
          onAction={() => goTo("/story")}
        />
      ) : (
        // Shelf like Apple Books "Weiterlesen": swipe sideways, snaps to each cover.
        <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 [&::-webkit-scrollbar]:hidden">
          <div className="flex snap-x snap-mandatory gap-3.5 sm:gap-4">
            {stories.slice(0, 8).map((story, index) => (
              <StoryCard
                key={story.id}
                story={story}
                index={index}
                onRead={() => goTo(`/story-reader/${story.id}`)}
                onDelete={() => onDeleteStory(story.id, story.title)}
                canSaveOffline={canUseOffline}
                isSavedOffline={isStorySaved(story.id)}
                isSavingOffline={isSaving(story.id)}
                onToggleOffline={() => toggleStory(story.id)}
              />
            ))}
          </div>
        </div>
      )}
    </motion.section>

    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-3"
    >
      <TaleaSectionHeading
        eyebrow={t("homeScreen.yourAvatarsEyebrow")}
        title={t("homeScreen.yourAvatars")}
        subtitle={t("homeScreen.yourAvatarsSubtitle")}
        actionLabel={t("homeScreen.allAvatars")}
        onAction={() => goTo("/avatar")}
      />

      {avatars.length === 0 ? (
        <EmptyStateContainer
          title={t("homeScreen.noAvatarsTitle")}
          description={t("homeScreen.noAvatarsDesc")}
          icon={<UserPlus className="h-12 w-12 text-pink-500 dark:text-pink-300" />}
          colorClass="bg-pink-100 dark:bg-slate-700"
          actionLabel={t("homeScreen.createAvatar")}
          onAction={() => goTo(createAvatarPath)}
        />
      ) : (
        <div className="-mx-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
          <div className="flex gap-3.5 pb-4 sm:gap-4">
            <button type="button" onClick={() => goTo(createAvatarPath)} className="flex h-[10.5rem] w-[8.5rem] shrink-0 flex-col items-center justify-center gap-3 rounded-[1.375rem] border-2 border-dashed border-[var(--talea-border-strong)] text-center transition-colors hover:bg-[var(--talea-surface-primary)] sm:h-52 sm:w-40">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">
                <Plus className="h-6 w-6" />
              </span>
              <p className="text-[15px] font-semibold text-[var(--primary)]">{t("homeScreen.newHero")}</p>
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
    </motion.section>

    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-3"
    >
      <TaleaSectionHeading
        eyebrow={t("homeScreen.yourDokusEyebrow")}
        title={t("homeScreen.yourDokus")}
        subtitle={t("homeScreen.yourDokusSubtitle")}
        actionLabel={t("homeScreen.allDokus")}
        onAction={() => goTo("/doku")}
      />

      {dokus.length === 0 ? (
        <EmptyStateContainer
          title={t("homeScreen.noDokusTitle")}
          description={t("homeScreen.noDokusDesc")}
          icon={<Library className="h-12 w-12 text-yellow-500 dark:text-yellow-300" />}
          colorClass="bg-yellow-100 dark:bg-slate-700"
          actionLabel={t("homeScreen.createFirstDoku")}
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
    </motion.section>

    {/* -- Cosmos -- */}
    <motion.section variants={itemVariants} className={cn(taleaSurfaceClass, "overflow-hidden p-0")}>
      <CosmosHomeCard isDark={isDark} cosmosState={cosmosState} />
    </motion.section>

  </motion.div>
  );
};

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
    if (hour < 12) return t("homeScreen.greeting.morning");
    if (hour < 18) return t("homeScreen.greeting.day");
    return t("homeScreen.greeting.evening");
  }, [t]);

  // Header identity follows the ACTIVE CHILD PROFILE (not the Clerk parent account).
  // Falls back to the account first name only when no profile is active.
  const profileDisplayName = activeProfile?.name || user?.firstName || null;
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
    if (!window.confirm(`"${avatar.name}" ${t("common.deleteConfirm")}`)) return;

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
          userName={profileDisplayName}
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
                    onToggleOffline={() => toggleStory(story.id)}
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
                          onDelete={() => handleDeleteAvatar(avatar)}
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
