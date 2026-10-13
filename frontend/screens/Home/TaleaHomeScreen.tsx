import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  ArrowRight, Bookmark, BookmarkCheck, BookOpen, Clock3, ImageOff,
  Library, LogIn, Plus, RefreshCw, Sparkles, Trash2, UserPlus, WandSparkles,
} from "lucide-react";

import { useBackend } from "../../hooks/useBackend";
import type { Story, StoryConfig } from "../../types/story";
import { wereStoryImagesSkipped } from "../../utils/storyQualityGate";
import { cn } from "@/lib/utils";
import { TaleaLogo } from "@/components/brand/TaleaLogo";
import { useTheme } from "@/contexts/ThemeContext";
import { useOptionalChildProfiles } from "@/contexts/ChildProfilesContext";
import CosmosHomeCard from "../Cosmos/CosmosHomeCard";
import { useCosmosState } from "../Cosmos/useCosmosState";
import { useOffline } from "@/contexts/OfflineStorageContext";
import {
  TaleaActionButton, TaleaLoadingState, TaleaPageBackground, TaleaSectionHeading,
  taleaBodyFont, taleaDisplayFont, taleaPageShellClass, taleaSurfaceClass,
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
const focusClass = "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--talea-page-solid)]";
const enterEase = [0.22, 1, 0.36, 1] as const;

function getDateLocale(i18nLang: string): string {
  const map: Record<string, string> = {
    de: "de-DE", en: "en-GB", fr: "fr-FR", es: "es-ES", it: "it-IT", nl: "nl-NL", ru: "ru-RU",
  };
  return map[i18nLang.split("-")[0]] || "de-DE";
}

function formatDate(value: string, locale = "de-DE") {
  return new Date(value).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

function normalizeDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: enterEase } },
};

const KidsAppBackground: React.FC<{ isDark: boolean }> = ({ isDark }) => <TaleaPageBackground isDark={isDark} />;

const LoadingState: React.FC = () => {
  const { t } = useTranslation();
  return (
    <TaleaLoadingState
      title={t("homeScreen.loadingTitle")}
      subtitle={t("homeScreen.loadingSubtitle")}
      icon={<WandSparkles className="h-9 w-9" aria-hidden />}
    />
  );
};

/** The supplied book mark is the illustration: a familiar face, with room to breathe. */
const BrandBook: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <div aria-hidden className={cn("relative flex items-center justify-center", compact ? "h-48 sm:h-60" : "min-h-64 sm:min-h-80 lg:min-h-[25rem]")}>
    <div className={cn("absolute rounded-full bg-[var(--talea-accent-terracotta-soft)]", compact ? "h-44 w-44 sm:h-56 sm:w-56" : "h-60 w-60 sm:h-80 sm:w-80")} />
    <div className="absolute bottom-[16%] left-[15%] h-12 w-12 -rotate-12 rounded-2xl border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] sm:h-16 sm:w-16" />
    <Sparkles className="absolute right-[17%] top-[12%] h-7 w-7 rotate-12 text-[var(--primary)]" strokeWidth={1.5} />
    <img src="/brand/talea-icon-primary.svg" alt="" width="320" height="320" className={cn("relative -rotate-[8deg] object-contain drop-shadow-[0_12px_14px_rgba(62,40,31,0.10)]", compact ? "h-40 w-40 sm:h-52 sm:w-52" : "h-56 w-56 sm:h-72 sm:w-72")} />
    <BookOpen className="absolute bottom-[10%] right-[12%] h-7 w-7 rotate-12 text-[var(--talea-text-secondary)]" strokeWidth={1.5} />
  </div>
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
  const { t, i18n } = useTranslation();
  const imagesSkipped = wereStoryImagesSkipped(story);
  const genreKey = String(story.config?.genre || "");
  const genre = genreKey
    ? t(`storiesScreen.genre.${genreKey}`, { defaultValue: genreKey.replace(/[-_]+/g, " ") })
    : "";
  const actions: TaleaCardMenuAction[] = [
    ...(canSaveOffline && story.status === "complete" && onToggleOffline ? [{
      label: isSavedOffline ? t("homeScreen.offlineRemove") : t("homeScreen.offlineSave"),
      icon: isSavingOffline ? <Clock3 className="h-4 w-4 motion-safe:animate-spin" /> : isSavedOffline ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />,
      onSelect: onToggleOffline,
      disabled: isSavingOffline,
    }] : []),
    { label: t("homeScreen.deleteStory"), icon: <Trash2 className="h-4 w-4" />, onSelect: onDelete, destructive: true },
  ];
  return (
    <motion.article variants={itemVariants} whileHover={reduceMotion ? undefined : { y: -3 }} className="group relative w-[min(68vw,15rem)] shrink-0 snap-start sm:w-56 lg:w-60">
      <button type="button" onClick={onRead} className={cn("block w-full rounded-2xl text-left", focusClass)} aria-label={[story.title, story.status !== "complete" ? t(`homeScreen.status.${story.status}`) : null, imagesSkipped ? t("homeScreen.imagesSkipped", "Bilder übersprungen") : null].filter(Boolean).join(" · ")}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-[var(--talea-media-skeleton)] shadow-[var(--talea-shadow-medium)] ring-1 ring-[var(--talea-border-light)]">
          {story.coverImageUrl ? (
            <img src={story.coverImageUrl} alt="" loading={index < 3 ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]" />
          ) : (
            <div className="flex h-full items-center justify-center text-[var(--primary)]"><BookOpen className="h-12 w-12" aria-hidden /></div>
          )}
          {story.status !== "complete" && (
            <span className={cn("absolute bottom-3 left-3 rounded-full bg-[var(--talea-surface-primary)] px-3 py-1.5 text-xs font-semibold", story.status === "error" ? "text-[var(--talea-danger)]" : "text-[var(--talea-text-primary)]")}>
              {t(`homeScreen.status.${story.status}`)}
            </span>
          )}
          {imagesSkipped && <span className="absolute bottom-3 right-3 rounded-full bg-[var(--talea-surface-primary)] p-2 text-[var(--talea-text-secondary)]" title={t("homeScreen.imagesSkipped", "Bilder übersprungen")}><ImageOff className="h-4 w-4" aria-hidden /></span>}
        </div>
        <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-snug text-[var(--talea-text-primary)]" style={{ fontFamily: headingFont }}>{story.title}</h3>
        <p className="mt-1 truncate text-xs text-[var(--talea-text-secondary)]">{[genre, formatDate(story.createdAt, getDateLocale(i18n.language))].filter(Boolean).join(" · ")}</p>
      </button>
      <TaleaCardMenu actions={actions} label={`${t("common.actions", "Aktionen")}: ${story.title}`} className="!absolute right-2 top-2" />
    </motion.article>
  );
};

const AvatarTile: React.FC<{ avatar: Avatar; onOpen: () => void; onDelete: () => void }> = ({ avatar, onOpen, onDelete }) => {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  return (
    <motion.article variants={itemVariants} whileHover={reduceMotion ? undefined : { y: -3 }} className={cn(taleaSurfaceClass, "group w-36 shrink-0 overflow-visible sm:w-40")}>
      <button type="button" onClick={onOpen} className={cn("flex min-h-48 w-full flex-col items-center justify-center px-3 pb-4 pt-7 text-center", focusClass)}>
        <div className="mb-3 h-24 w-24 overflow-hidden rounded-full bg-[var(--talea-surface-inset)] ring-4 ring-[var(--talea-surface-inset)]">
          {avatar.imageUrl ? <img src={avatar.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105" /> : <UserPlus className="mx-auto mt-7 h-10 w-10 text-[var(--primary)]" aria-hidden />}
        </div>
        <h3 className="w-full truncate text-base font-semibold text-[var(--talea-text-primary)]" style={{ fontFamily: headingFont }}>{avatar.name}</h3>
        <p className="mt-1 text-xs text-[var(--talea-text-secondary)]">{t(avatar.avatarRole === "child" ? "homeScreen.childProfileLabel" : avatar.creationType === "ai-generated" ? "homeScreen.aiFigureLabel" : "homeScreen.photoFigureLabel")}</p>
      </button>
      <TaleaCardMenu actions={[{ label: t("homeScreen.deleteAvatar"), icon: <Trash2 className="h-4 w-4" />, onSelect: onDelete, destructive: true }]} label={`${t("common.actions", "Aktionen")}: ${avatar.name}`} className="!absolute right-1 top-1" />
    </motion.article>
  );
};

const DokuBentoTicket: React.FC<{ doku: Doku; onRead: () => void; onDelete: () => void }> = ({ doku, onRead, onDelete }) => {
  const { t, i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  return (
    <motion.article variants={itemVariants} whileHover={reduceMotion ? undefined : { y: -2 }} className={cn(taleaSurfaceClass, "group")}>
      <button type="button" onClick={onRead} className={cn("flex min-h-28 w-full items-center gap-4 p-4 pr-12 text-left sm:p-5 sm:pr-14", focusClass)}>
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--talea-surface-inset)] sm:h-24 sm:w-24">
          {doku.coverImageUrl ? <img src={doku.coverImageUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Library className="mx-auto mt-6 h-8 w-8 text-[var(--primary)] sm:mt-8" aria-hidden />}
        </div>
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-[var(--talea-text-primary)] sm:text-lg" style={{ fontFamily: headingFont }}>{doku.title}</h3>
          {doku.topic && doku.topic !== doku.title && <p className="mt-1 line-clamp-1 text-sm text-[var(--talea-text-secondary)]">{doku.topic}</p>}
          <p className="mt-2 text-xs text-[var(--talea-text-secondary)]">
            {doku.status !== "complete" && <span className={doku.status === "error" ? "font-semibold text-[var(--talea-danger)]" : "font-semibold"}>{t(`homeScreen.status.${doku.status}`)} · </span>}
            {formatDate(doku.createdAt, getDateLocale(i18n.language))}
          </p>
        </div>
      </button>
      <TaleaCardMenu actions={[{ label: t("homeScreen.deleteDoku"), icon: <Trash2 className="h-4 w-4" />, onSelect: onDelete, destructive: true }]} label={`${t("common.actions", "Aktionen")}: ${doku.title}`} className="!absolute right-2 top-2" />
    </motion.article>
  );
};

const EmptyStateContainer: React.FC<{ title: string; description: string; icon: React.ReactNode; actionLabel: string; onAction: () => void }> = ({ title, description, icon, actionLabel, onAction }) => (
  <div className={cn(taleaSurfaceClass, "flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:p-8")}>
    <div aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--talea-accent-terracotta-soft)] text-[var(--primary)]">{icon}</div>
    <div className="min-w-0 flex-1">
      <h3 className="text-xl font-medium text-[var(--talea-text-primary)]" style={{ fontFamily: headingFont }}>{title}</h3>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--talea-text-secondary)]">{description}</p>
    </div>
    <TaleaActionButton variant="secondary" onClick={onAction} icon={<ArrowRight className="h-4 w-4" />}>{actionLabel}</TaleaActionButton>
  </div>
);

const PremiumSignedOutStart: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  return (
    <div className={cn(taleaPageShellClass, "py-5 sm:py-8")}>
      <motion.section initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: enterEase }} className="relative grid overflow-hidden rounded-[2rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] lg:grid-cols-[1.2fr_0.8fr]">
        <div className="relative z-10 p-6 sm:p-10 lg:p-14">
          <TaleaLogo variant="horizontal" className="h-14 w-auto sm:h-16" />
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--primary)]">{t("homeScreen.discoverWorld")}</p>
          <h1 className="mt-4 max-w-xl text-[2.45rem] font-medium leading-[1.08] tracking-[-0.025em] text-[var(--talea-text-primary)] sm:text-[3.4rem] xl:text-[4rem]" style={{ fontFamily: headingFont }}>{t("homeScreen.signedOutTitle")}</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[var(--talea-text-secondary)] sm:text-lg sm:leading-8">{t("homePage.landingSubtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <TaleaActionButton onClick={() => navigate("/auth")} icon={<ArrowRight className="h-4 w-4" />}>{t("homeScreen.adventureBegins")}</TaleaActionButton>
            <TaleaActionButton variant="secondary" onClick={() => navigate("/auth")} icon={<LogIn className="h-4 w-4" />}>{t("auth.signIn")}</TaleaActionButton>
          </div>
        </div>
        <div className="flex flex-col justify-center bg-[var(--talea-surface-inset)] px-4 pb-6 lg:py-10">
          <BrandBook />
          <p className="px-4 text-center text-lg font-medium text-[var(--talea-text-primary)]" style={{ fontFamily: headingFont }}>{t("homeScreen.featureWorld")}</p>
          <p className="mx-auto mt-2 max-w-xs px-4 text-center text-sm leading-6 text-[var(--talea-text-secondary)]">{t("homeScreen.featureWorldDesc")}</p>
        </div>
      </motion.section>
      <div className="mt-5 grid gap-4 sm:mt-6 sm:grid-cols-3">
        {[
          { icon: UserPlus, title: "homePage.featureAvatarTitle", desc: "homePage.featureAvatarDesc" },
          { icon: BookOpen, title: "homePage.featureStoryTitle", desc: "homePage.featureStoryDesc" },
          { icon: Library, title: "homePage.featureDokuTitle", desc: "homePage.featureDokuDesc" },
        ].map(({ icon: Icon, title, desc }, index) => (
          <motion.div key={title} initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : 0.12 + index * 0.07, duration: 0.35, ease: enterEase }} className={cn(taleaSurfaceClass, "flex items-center gap-4 p-5 sm:flex-col sm:items-start sm:p-6")}>
            <div aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--talea-accent-terracotta-soft)] text-[var(--primary)]"><Icon className="h-5 w-5" strokeWidth={1.7} /></div>
            <div><h2 className="text-lg font-medium text-[var(--talea-text-primary)]" style={{ fontFamily: headingFont }}>{t(title)}</h2><p className="mt-1.5 text-sm leading-6 text-[var(--talea-text-secondary)]">{t(desc)}</p></div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

type HomeSignedInContentProps = {
  isDark: boolean; greeting: string; userName?: string | null;
  stories: Story[]; storiesTotal: number; avatars: Avatar[]; dokus: Doku[]; dokusTotal: number;
  createAvatarPath: string; refreshing: boolean; onRefresh: () => void; goTo: (path: string) => void;
  onDeleteStory: (storyId: string, title: string) => void; onDeleteAvatar: (avatar: Avatar) => void;
  onDeleteDoku: (dokuId: string, title: string) => void;
  canUseOffline: boolean; isStorySaved: (storyId: string) => boolean; isSaving: (storyId: string) => boolean;
  toggleStory: (storyId: string) => void; cosmosState: ReturnType<typeof useCosmosState>["cosmosState"];
};

const HomeSignedInContent: React.FC<HomeSignedInContentProps> = ({
  isDark, greeting, userName, stories, storiesTotal, avatars, dokus, dokusTotal, createAvatarPath,
  refreshing, onRefresh, goTo, onDeleteStory, onDeleteAvatar, onDeleteDoku, canUseOffline,
  isStorySaved, isSaving, toggleStory, cosmosState,
}) => {
  const { t, i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  const reveal = {
    initial: reduceMotion ? false as const : { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.12 },
    transition: { duration: 0.4, ease: enterEase },
  };
  return (
    <motion.div variants={containerVariants} initial={reduceMotion ? false : "hidden"} animate="show" className={cn(taleaPageShellClass, "space-y-8 pt-3 sm:space-y-10 sm:pt-5")}>
      <motion.header variants={itemVariants} className="relative overflow-hidden rounded-[1.75rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] sm:rounded-[2rem]">
        <div className="grid lg:grid-cols-[1.25fr_0.75fr]">
          <div className="relative z-10 p-6 sm:p-8 lg:p-10">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--talea-text-secondary)]">{new Intl.DateTimeFormat(getDateLocale(i18n.language), { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p>
              <button type="button" onClick={onRefresh} disabled={refreshing} aria-label={t("common.refresh")} aria-busy={refreshing} className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] text-[var(--talea-text-secondary)] transition-colors hover:text-[var(--primary)] disabled:opacity-50", focusClass)}><RefreshCw className={cn("h-4 w-4", refreshing && "motion-safe:animate-spin")} aria-hidden /></button>
            </div>
            <h1 className="mt-5 text-[2.15rem] font-medium leading-[1.1] tracking-[-0.025em] text-[var(--talea-text-primary)] sm:text-[2.8rem] lg:text-[3.25rem]" style={{ fontFamily: headingFont }}>{greeting},<br /><span className="text-[var(--primary)]">{userName || t("homeScreen.defaultUser")}.</span></h1>
            <p className="mt-4 text-base leading-relaxed text-[var(--talea-text-secondary)]">{t("home.subtitle")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <TaleaActionButton icon={<WandSparkles className="h-4 w-4" />} onClick={() => goTo("/story")}>{t("homeScreen.newStory")}</TaleaActionButton>
              <TaleaActionButton variant="secondary" icon={<BookOpen className="h-4 w-4" />} onClick={() => goTo("/stories")}>{t("homeScreen.library")}</TaleaActionButton>
            </div>
          </div>
          <div className="hidden items-center justify-center bg-[var(--talea-surface-inset)] lg:flex"><div className="w-full max-w-sm"><BrandBook compact /></div></div>
        </div>
        <div className="grid grid-cols-3 border-t border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] px-3 py-3 sm:px-6">
          {[
            { label: t("homeScreen.statsStories"), value: storiesTotal, path: "/stories" },
            { label: t("homeScreen.statsAvatars"), value: avatars.length, path: "/avatar" },
            { label: t("homeScreen.statsDokus"), value: dokusTotal, path: "/doku" },
          ].map((stat) => <button key={stat.path} type="button" onClick={() => goTo(stat.path)} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[var(--talea-text-secondary)] transition-colors hover:bg-[var(--talea-surface-primary)] sm:flex-row sm:gap-3", focusClass)}><span className="text-xl font-semibold tabular-nums text-[var(--talea-text-primary)]" style={{ fontFamily: headingFont }}>{stat.value}</span><span className="text-xs sm:text-sm">{stat.label}</span></button>)}
        </div>
      </motion.header>

      <motion.section {...reveal} className="space-y-5">
        <TaleaSectionHeading eyebrow={t("homeScreen.yourStoriesEyebrow")} title={t("homeScreen.yourStories")} subtitle={t("homeScreen.yourStoriesSubtitle")} actionLabel={t("homeScreen.allStories")} onAction={() => goTo("/stories")} />
        {stories.length === 0 ? <EmptyStateContainer title={t("homeScreen.noStoriesTitle")} description={t("homeScreen.noStoriesDesc")} icon={<BookOpen className="h-7 w-7" />} actionLabel={t("homeScreen.createFirstStory")} onAction={() => goTo("/story")} /> : (
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 pt-1 [scrollbar-width:thin] [scrollbar-color:var(--talea-border-strong)_transparent] md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
            {stories.slice(0, 8).map((story, index) => <StoryCard key={story.id} story={story} index={index} onRead={() => goTo(`/story-reader/${story.id}`)} onDelete={() => onDeleteStory(story.id, story.title)} canSaveOffline={canUseOffline} isSavedOffline={isStorySaved(story.id)} isSavingOffline={isSaving(story.id)} onToggleOffline={() => toggleStory(story.id)} />)}
          </div>
        )}
      </motion.section>

      <motion.section {...reveal} className="space-y-5">
        <TaleaSectionHeading eyebrow={t("homeScreen.yourAvatarsEyebrow")} title={t("homeScreen.yourAvatars")} subtitle={t("homeScreen.yourAvatarsSubtitle")} actionLabel={t("homeScreen.allAvatars")} onAction={() => goTo("/avatar")} />
        {avatars.length === 0 ? <EmptyStateContainer title={t("homeScreen.noAvatarsTitle")} description={t("homeScreen.noAvatarsDesc")} icon={<UserPlus className="h-7 w-7" />} actionLabel={t("homeScreen.createAvatar")} onAction={() => goTo(createAvatarPath)} /> : (
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 pt-1 [scrollbar-width:thin] [scrollbar-color:var(--talea-border-strong)_transparent] md:mx-0 md:px-0">
            <button type="button" onClick={() => goTo(createAvatarPath)} className={cn("flex min-h-48 w-36 shrink-0 snap-start flex-col items-center justify-center gap-3 rounded-[1.375rem] border-2 border-dashed border-[var(--talea-border-strong)] px-3 text-center transition-colors hover:bg-[var(--talea-surface-primary)] sm:w-40", focusClass)}><span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--talea-accent-terracotta-soft)] text-[var(--primary)]"><Plus className="h-6 w-6" aria-hidden /></span><span className="text-sm font-semibold text-[var(--primary)]">{t("homeScreen.newHero")}</span></button>
            {avatars.map((avatar) => <AvatarTile key={avatar.id} avatar={avatar} onOpen={() => goTo(`/avatar/edit/${avatar.id}`)} onDelete={() => onDeleteAvatar(avatar)} />)}
          </div>
        )}
      </motion.section>

      <motion.section {...reveal} className="space-y-5">
        <TaleaSectionHeading eyebrow={t("homeScreen.yourDokusEyebrow")} title={t("homeScreen.yourDokus")} subtitle={t("homeScreen.yourDokusSubtitle")} actionLabel={t("homeScreen.allDokus")} onAction={() => goTo("/doku")} />
        {dokus.length === 0 ? <EmptyStateContainer title={t("homeScreen.noDokusTitle")} description={t("homeScreen.noDokusDesc")} icon={<Library className="h-7 w-7" />} actionLabel={t("homeScreen.createFirstDoku")} onAction={() => goTo("/doku/create")} /> : (
          <div className="grid gap-4 md:grid-cols-2">
            <button type="button" onClick={() => goTo("/doku/create")} className={cn("flex min-h-28 items-center gap-4 rounded-[1.375rem] border border-dashed border-[var(--talea-border-strong)] p-5 text-left transition-colors hover:bg-[var(--talea-surface-primary)]", focusClass)}><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--talea-accent-terracotta-soft)] text-[var(--primary)]"><Plus className="h-6 w-6" aria-hidden /></span><span className="flex-1 text-lg font-medium text-[var(--talea-text-primary)]" style={{ fontFamily: headingFont }}>{t("homeScreen.knowledgeJourney")}</span><ArrowRight className="h-5 w-5 text-[var(--primary)]" aria-hidden /></button>
            {dokus.slice(0, 3).map((doku) => <DokuBentoTicket key={doku.id} doku={doku} onRead={() => goTo(`/doku-reader/${doku.id}`)} onDelete={() => onDeleteDoku(doku.id, doku.title)} />)}
          </div>
        )}
      </motion.section>
      <motion.section {...reveal} className={cn(taleaSurfaceClass, "overflow-hidden p-0")}><CosmosHomeCard isDark={isDark} cosmosState={cosmosState} /></motion.section>
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
  const isDark = resolvedTheme === "dark";
  const { cosmosState } = useCosmosState();

  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [dokus, setDokus] = useState<Doku[]>([]);
  const [storiesTotal, setStoriesTotal] = useState(0);
  const [dokusTotal, setDokusTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const loadRequest = useRef(0);
  const currentProfileId = useRef(activeProfileId);
  currentProfileId.current = activeProfileId;

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

  const loadData = useCallback(async (showLoading = true) => {
    const request = ++loadRequest.current;
    try {
      if (showLoading) {
        setLoading(true);
        setHasLoadedData(false);
      }
      setLoadError(false);
      const [avatarsResponse, storiesResponse, dokusResponse] = await Promise.all([
        backend.avatar.list({ profileId: activeProfileId || undefined }),
        backend.story.list({ limit: 12, offset: 0, profileId: activeProfileId || undefined }),
        backend.doku.listDokus({ limit: 8, offset: 0, profileId: activeProfileId || undefined }),
      ]);
      if (request !== loadRequest.current) return;

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
      setHasLoadedData(true);
    } catch (error) {
      if (request !== loadRequest.current) return;
      console.error("Error loading home data:", error);
      setLoadError(true);
    } finally {
      if (request === loadRequest.current) setLoading(false);
    }
  }, [backend, activeProfileId]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn || !user) {
      loadRequest.current += 1;
      setAvatars([]);
      setStories([]);
      setDokus([]);
      setStoriesTotal(0);
      setDokusTotal(0);
      setLoadError(false);
      setHasLoadedData(false);
      setLoading(false);
      return;
    }

    void loadData();
  }, [isLoaded, isSignedIn, user?.id, loadData, activeProfileId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(!hasLoadedData);
    setRefreshing(false);
  };

  const handleDeleteAvatar = useCallback(async (avatar: Avatar) => {
    if (!window.confirm(`"${avatar.name}" ${t("common.deleteConfirm")}`)) return;
    const request = loadRequest.current;
    const profileId = activeProfileId;

    try {
      await backend.avatar.deleteAvatar({ id: avatar.id, profileId: activeProfileId || undefined });
      if (request !== loadRequest.current || profileId !== currentProfileId.current) return;
      if (avatar.avatarRole === "child" || avatar.id === activeProfile?.childAvatarId) {
        await childProfiles?.refresh();
      }
      if (request !== loadRequest.current || profileId !== currentProfileId.current) return;
      setAvatars((prev) => prev.filter((item) => item.id !== avatar.id));
    } catch (error) {
      console.error("Error deleting avatar:", error);
      if (request === loadRequest.current && profileId === currentProfileId.current) toast.error(t("errors.generic"));
    }
  }, [activeProfile?.childAvatarId, activeProfileId, backend.avatar, childProfiles, t]);

  const handleDeleteStory = async (storyId: string, storyTitle: string) => {
    if (!window.confirm(`${t("common.delete", "Loeschen")} "${storyTitle}"?`)) return;
    const request = loadRequest.current;
    const profileId = activeProfileId;

    try {
      await backend.story.deleteStory({ id: storyId, profileId: activeProfileId || undefined });
      if (request !== loadRequest.current || profileId !== currentProfileId.current) return;
      setStories((prev) => prev.filter((story) => story.id !== storyId));
      setStoriesTotal((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error deleting story:", error);
      if (request === loadRequest.current && profileId === currentProfileId.current) toast.error(t("errors.generic"));
    }
  };

  const handleDeleteDoku = async (dokuId: string, dokuTitle: string) => {
    if (!window.confirm(`${t("common.delete", "Loeschen")} "${dokuTitle}"?`)) return;
    const request = loadRequest.current;
    const profileId = activeProfileId;

    try {
      await backend.doku.deleteDoku({ id: dokuId, profileId: activeProfileId || undefined });
      if (request !== loadRequest.current || profileId !== currentProfileId.current) return;
      setDokus((prev) => prev.filter((doku) => doku.id !== dokuId));
      setDokusTotal((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error deleting doku:", error);
      if (request === loadRequest.current && profileId === currentProfileId.current) toast.error(t("errors.generic"));
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
        {loadError && (
          <div className={cn(taleaPageShellClass, "pt-5")}>
            <div role="alert" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--talea-border-strong)] bg-[var(--talea-surface-primary)] p-6">
              <p className="text-sm font-medium text-[var(--talea-text-primary)]">{t("errors.generic")}</p>
              <TaleaActionButton variant="secondary" disabled={refreshing} onClick={handleRefresh} icon={<RefreshCw className={cn("h-4 w-4", refreshing && "motion-safe:animate-spin")} />}>
                {t("common.retry")}
              </TaleaActionButton>
            </div>
          </div>
        )}
        {hasLoadedData && (
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
        )}
      </SignedIn>
    </div>
  );
};

export default TaleaHomeScreen;
