import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  BookOpen,
  ChevronDown,
  Grid3X3,
  Info,
  LayoutList,
  LogIn,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";

import type { Story } from "../../types/story";
import { cn } from "@/lib/utils";
import { TaleaLogo } from "@/components/brand/TaleaLogo";
import { useTheme } from "@/contexts/ThemeContext";
import { useOptionalUserAccess } from "@/contexts/UserAccessContext";
import OriginalsHome from "../Library/OriginalsHome";
import CharacterOriginsScreen from "../CharacterPool/CharacterOriginsScreen";
import type { TaleaCardMenuAction } from "@/components/talea/TaleaCardMenu";
import { IconTabs, iconTabId, type IconTabItem } from "@/components/navigation/IconTabs";
import {
  TaleaActionButton,
  TaleaLoadingState,
  TaleaPageBackground,
  taleaBodyFont,
  taleaChipClass,
  taleaDisplayFont,
  taleaInputClass,
  taleaInsetSurfaceClass,
  taleaPageShellClass,
  taleaSurfaceClass,
} from "@/components/talea/TaleaPastelPrimitives";
import type { CharacterSeriesChoice } from "./wizard-steps/StepCharacterSeries";
import { useCharacterSeriesCatalogue, useStoryActions, useStoryLibrary } from "./library/useStoryLibrary";
import {
  buildSeriesShelves,
  isStoryRead,
  joinNames,
  pickFeaturedStory,
  seriesEpisodeOf,
  seriesIdOf,
  seriesPagePath,
  seriesStoryPath,
  episodeWord,
  type SeriesShelf,
} from "./library/storyShelves";
import {
  LibraryHero,
  LibrarySectionHeading,
  LibraryStoryCard,
  ListStoryRow,
  SeriesDiscover,
  SeriesRow,
  formatStoryDate,
  storyPreviewText,
  type LibraryHeroAction,
} from "./library/StoryLibraryParts";

const headingFont = taleaDisplayFont;
const bodyFont = taleaBodyFont;

type ViewMode = "grid" | "list";
type SortMode = "newest" | "oldest" | "title";
type ContentTab = "stories" | "originals" | "characters";
type TranslateFn = TFunction;

/** Stories per step of "Weitere Geschichten anzeigen". */
const COLLECTION_PAGE = 12;

function normalizeKey(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
}

function getStoryGenreKey(story: Story): string {
  const genre = normalizeKey(story.config?.genre).replace(/-/g, "_");
  return genre === "fairytale" || genre === "fairy_tale" ? "fairy_tales" : genre;
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
 * Filter as a pill: shows the category until something is picked, then the
 * picked value, tinted. The transparent native <select> on top opens the
 * system picker (the wheel on iPhone) instead of a hand-made dropdown.
 */
const FilterSelect: React.FC<{ value: string; onChange: (v: string) => void; options: { label: string; value: string }[]; label: string; allLabel?: string; allValue?: string }> = ({ value, onChange, options, label, allLabel, allValue = "all" }) => {
  const isActive = value !== allValue;
  const shown = isActive ? options.find((opt) => opt.value === value)?.label ?? label : label;
  return (
    <label
      className={cn(
        "relative inline-flex h-11 shrink-0 items-center gap-1 rounded-full pl-3.5 pr-2.5 text-[14px] font-semibold transition focus-within:ring-2 focus-within:ring-[var(--primary)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--talea-page-solid)]",
        isActive ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-[var(--talea-surface-inset)] text-[var(--talea-text-primary)]"
      )}
    >
      <span className="max-w-[10rem] truncate">{shown}</span>
      <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
        aria-label={label}
      >
        {allLabel !== undefined ? <option value={allValue}>{allLabel}</option> : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
};

/** Free stories (or search results) as a cover grid or a list, twelve at a time. */
const StoryCollection: React.FC<{
  stories: Story[];
  viewMode: ViewMode;
  eyebrowFor: (story: Story) => string | null;
  menuFor: (story: Story) => TaleaCardMenuAction[];
  onOpen: (story: Story) => void;
  now: number;
}> = ({ stories, viewMode, eyebrowFor, menuFor, onOpen, now }) => {
  const [limit, setLimit] = useState(COLLECTION_PAGE);
  const visible = stories.slice(0, limit);
  const remaining = stories.length - visible.length;
  return (
    <>
      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
          {visible.map((story, index) => (
            <LibraryStoryCard key={story.id} story={story} index={index % COLLECTION_PAGE} eyebrow={eyebrowFor(story)} menu={menuFor(story)} onOpen={() => onOpen(story)} now={now} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((story, index) => (
            <ListStoryRow key={story.id} story={story} index={index % COLLECTION_PAGE} eyebrow={eyebrowFor(story)} menu={menuFor(story)} onOpen={() => onOpen(story)} now={now} />
          ))}
        </div>
      )}
      {remaining > 0 ? (
        <div className="mt-7 flex justify-center">
          <button
            type="button"
            onClick={() => setLimit((value) => value + COLLECTION_PAGE)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--talea-surface-inset)] px-5 text-[15px] font-semibold text-[var(--primary)] transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
            Weitere Geschichten anzeigen
            <span className="font-medium text-[var(--talea-text-tertiary)]">({remaining})</span>
          </button>
        </div>
      ) : null}
    </>
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
                <TaleaLogo variant="small" className="mr-3 h-7 w-7" alt="" />
                Story Stream
              </span>
              <h1 className="mt-6 text-[2.45rem] font-semibold leading-[1.04] text-[var(--talea-text-primary)] sm:mt-8 md:text-[3.8rem]" style={{ fontFamily: headingFont }}>
                Alle Geschichten an einem Ort.
              </h1>
              <p className="mt-5 max-w-2xl text-base font-medium leading-8 text-[var(--talea-text-secondary)] md:text-lg">
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
                <p className="text-sm font-medium leading-7 text-[var(--talea-text-secondary)]">{item}</p>
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
  remainingStoryCredits: number | null | undefined;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  viewMode: ViewMode;
  setViewMode: (value: ViewMode) => void;
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
  stories: Story[];
  filteredStories: Story[];
  shelves: SeriesShelf[];
  discoverSeries: CharacterSeriesChoice[];
  featuredStory: Story | undefined;
  loading: boolean;
  loadError: string | null;
  hasActiveFilters: boolean;
  menuFor: (story: Story) => TaleaCardMenuAction[];
  eyebrowFor: (story: Story) => string | null;
  onOpenStory: (story: Story) => void;
  onOpenSeries: (shelf: SeriesShelf) => void;
  onCreateNext: (shelf: SeriesShelf) => void;
  onStartSeries: (series: CharacterSeriesChoice) => void;
  onResetFilters: () => void;
  onRefresh: () => void;
  goTo: (path: string) => void;
};

const StoriesSignedInContent: React.FC<StoriesSignedInContentProps> = ({
  contentTab,
  setContentTab,
  total,
  remainingStoryCredits,
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
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
  stories,
  filteredStories,
  shelves,
  discoverSeries,
  featuredStory,
  loading,
  loadError,
  hasActiveFilters,
  menuFor,
  eyebrowFor,
  onOpenStory,
  onOpenSeries,
  onCreateNext,
  onStartSeries,
  onResetFilters,
  onRefresh,
  goTo,
}) => {
  const { t } = useTranslation();
  // One clock per load, so a "Neu" badge does not flicker between renders.
  const now = useMemo(() => Date.now(), [stories]);
  // Unknown credits are not shown at all — a bare "-" read like a broken value.
  const remainingStoryLabel = remainingStoryCredits === undefined
    ? null
    : remainingStoryCredits === null ? "\u221e" : remainingStoryCredits;
  const tabGroupId = useId();
  const seriesHeadingId = useId();
  const freeHeadingId = useId();
  const resultsHeadingId = useId();
  const contentTabs: IconTabItem<ContentTab>[] = [
    { id: "stories", label: t("storiesScreen.storiesTab"), icon: "stories" },
    // Talea Originals: the pre-produced series, for every child (admins produce them on the series page).
    { id: "originals", label: t("storiesScreen.originalsTab", "Originals"), icon: "studio" },
    { id: "characters", label: "Charaktere", icon: "figures" },
  ];
  // A new filter starts the collection at its first twelve again.
  const collectionKey = [searchQuery, genreFilter, ageGroupFilter, lengthFilter, avatarFilter, sortMode, viewMode].join("|");
  const freeStories = useMemo(() => filteredStories.filter((story) => !seriesIdOf(story)), [filteredStories]);

  const hero = useMemo(() => {
    if (!featuredStory) return null;
    const read = isStoryRead(featuredStory);
    const names = joinNames((featuredStory.config?.avatars ?? []).map((avatar) => avatar.name), 2);
    const dateAndCast = [formatStoryDate(featuredStory.createdAt), names ? `mit ${names}` : null].filter(Boolean).join(" · ");
    const readIt: LibraryHeroAction = { label: read ? "Nochmal lesen" : "Geschichte lesen", icon: <BookOpen className="h-5 w-5" aria-hidden="true" />, onClick: () => onOpenStory(featuredStory) };
    const seriesId = seriesIdOf(featuredStory);
    const shelf = seriesId ? shelves.find((entry) => entry.id === seriesId) : undefined;
    if (shelf) {
      const figure = shelf.characterName ?? "Figurenabenteuer";
      const toSeries: LibraryHeroAction = { label: "Zur Serie", icon: <Info className="h-5 w-5" aria-hidden="true" />, onClick: () => onOpenSeries(shelf) };
      const episode = seriesEpisodeOf(featuredStory);
      // Everything read: the billboard invites the next episode instead of offering the old one again.
      if (read && shelf.unreadCount === 0 && shelf.nextEpisode && !shelf.generating) {
        const nextNames = joinNames(shelf.avatars.filter((avatar) => shelf.lastAvatarIds.includes(avatar.id)).map((avatar) => avatar.name), 2);
        return {
          imageUrl: featuredStory.coverImageUrl || shelf.coverImageUrl,
          portraitUrl: shelf.portraitUrl,
          eyebrow: `Figurenabenteuer · ${figure}`,
          title: shelf.title,
          text: `${episode ? `Folge ${episode} ` : ""}„${featuredStory.title}“ habt ihr gelesen. Wie geht es weiter? Erzählt ${nextNames ? `mit ${nextNames} ` : ""}die nächste Folge.`,
          meta: `${episodeWord(shelf.completeCount)} · zuletzt ${formatStoryDate(featuredStory.createdAt)}`,
          primary: { label: `Folge ${shelf.nextEpisode} erstellen`, icon: <Plus className="h-5 w-5" aria-hidden="true" />, onClick: () => onCreateNext(shelf) },
          secondary: toSeries,
        };
      }
      return {
        imageUrl: featuredStory.coverImageUrl,
        portraitUrl: shelf.portraitUrl,
        eyebrow: episode ? `${figure} · Folge ${episode}` : figure,
        title: featuredStory.title,
        text: storyPreviewText(featuredStory),
        meta: dateAndCast,
        primary: { ...readIt, label: read ? "Nochmal lesen" : episode ? `Folge ${episode} lesen` : "Jetzt lesen" },
        secondary: toSeries,
      };
    }
    const genre = getStoryGenreKey(featuredStory);
    return {
      imageUrl: featuredStory.coverImageUrl,
      eyebrow: [read ? "Aus eurer Sammlung" : "Neu für euch", genre ? formatGenreLabel(genre, t) : null].filter(Boolean).join(" · "),
      title: featuredStory.title,
      text: storyPreviewText(featuredStory),
      meta: dateAndCast,
      primary: readIt,
    };
  }, [featuredStory, shelves, onOpenStory, onOpenSeries, onCreateNext, t]);

  const seriesSection = shelves.length ? (
    <section aria-labelledby={seriesHeadingId} className="min-w-0">
      <LibrarySectionHeading
        id={seriesHeadingId}
        eyebrow="Figurenabenteuer"
        title="Eure Serien"
        subtitle="Eure Avatare spielen mit, und jede Folge erzählt die Geschichte weiter."
      />
      <div className="space-y-9">
        {shelves.map((shelf) => (
          <SeriesRow
            key={shelf.id}
            shelf={shelf}
            menuFor={menuFor}
            onOpenEpisode={onOpenStory}
            onOpenSeries={() => onOpenSeries(shelf)}
            onCreateNext={() => onCreateNext(shelf)}
            now={now}
          />
        ))}
        {discoverSeries.length ? <SeriesDiscover series={discoverSeries} onStart={onStartSeries} /> : null}
      </div>
    </section>
  ) : null;

  const freeSection = freeStories.length ? (
    <section aria-labelledby={freeHeadingId} className={cn("min-w-0", shelves.length > 0 && "border-t border-[var(--talea-border-light)] pt-10")}>
      <LibrarySectionHeading
        id={freeHeadingId}
        eyebrow="Frei erfunden"
        title="Eigene Geschichten"
        subtitle="Jedes Abenteuer steht für sich, erfunden für eure Avatare."
        action={<span className="pb-1 text-[13px] text-[var(--talea-text-tertiary)]">{freeStories.length} {freeStories.length === 1 ? "Geschichte" : "Geschichten"}</span>}
      />
      <StoryCollection key={collectionKey} stories={freeStories} viewMode={viewMode} eyebrowFor={eyebrowFor} menuFor={menuFor} onOpen={onOpenStory} now={now} />
    </section>
  ) : null;

  // No series yet: the idea is explained once, below the family's own stories (or under the empty state).
  const seriesTeaser = !shelves.length && discoverSeries.length ? <SeriesDiscover prominent series={discoverSeries} onStart={onStartSeries} /> : null;

  return (
    <div className={cn(taleaPageShellClass, "flex flex-col gap-4 pb-6 pt-2 sm:gap-6 sm:pb-8 sm:pt-6")}>
      <header className="px-1">
        <div className="flex items-end justify-between gap-4">
          <h1
            className="min-w-0 text-[2rem] font-bold leading-tight text-[var(--talea-text-primary)] md:text-[2.5rem]"
            style={{ fontFamily: headingFont }}
          >
            {t("story.myStories")}
          </h1>
          <div className="flex shrink-0 items-center gap-2 pb-1">
            <button
              type="button"
              onClick={onRefresh}
              aria-label={t("common.refresh")}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--talea-surface-inset)] text-[var(--primary)] transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            {/* Phone: round "+" like an iOS nav-bar button; wider screens show the label. */}
            <TaleaActionButton
              icon={<Plus className="h-5 w-5" />}
              onClick={() => goTo("/story")}
              aria-label={t("homeScreen.newStory")}
              className="h-11 min-h-11 w-11 rounded-full px-0 sm:w-auto sm:px-4"
            >
              <span className="hidden sm:inline">{t("homeScreen.newStory")}</span>
            </TaleaActionButton>
          </div>
        </div>
        <p className="mt-1 text-[15px] text-[var(--talea-text-secondary)]">
          {contentTab === "originals" ? (
            "Talea Originals: Reihen für alle Kinder, jeden Freitag eine neue Folge"
          ) : (
            <>
              {total} {total === 1 ? "Geschichte" : "Geschichten"}
              {remainingStoryLabel !== null ? <> · {remainingStoryLabel} übrig in diesem Monat</> : null}
            </>
          )}
        </p>

        <IconTabs
          items={contentTabs}
          value={contentTab}
          onChange={setContentTab}
          label="Bibliotheksbereiche"
          idBase={tabGroupId}
          panelId={() => `${tabGroupId}-panel`}
          className="mt-4 sm:inline-grid sm:min-w-[22rem]"
        />
      </header>

      <div
        id={`${tabGroupId}-panel`}
        role="tabpanel"
        aria-labelledby={iconTabId(tabGroupId, contentTab)}
        tabIndex={0}
        className="min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)]"
      >
      {contentTab === "characters" ? (
        <CharacterOriginsScreen />
      ) : contentTab === "originals" ? (
        <OriginalsHome />
      ) : (
        <div className="space-y-6 sm:space-y-8">
          {hero && !hasActiveFilters && !loading && !loadError ? <LibraryHero {...hero} /> : null}
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <label className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--talea-text-tertiary)]" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t("common.search")}
                  aria-label={t("storiesScreen.searchStories", "Geschichten durchsuchen")}
                  className={cn(taleaInputClass, "pl-10 pr-4")}
                />
              </label>
              <div role="radiogroup" aria-label="Ansicht" className="flex shrink-0 rounded-[0.7rem] bg-[var(--talea-surface-inset)] p-0.5">
                {([
                  { id: "grid", label: "Rasteransicht", icon: <Grid3X3 className="h-4 w-4" /> },
                  { id: "list", label: "Listenansicht", icon: <LayoutList className="h-4 w-4" /> },
                ] as Array<{ id: ViewMode; label: string; icon: React.ReactNode }>).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    role="radio"
                    aria-checked={viewMode === mode.id}
                    aria-label={mode.label}
                    onClick={() => setViewMode(mode.id)}
                    className={cn(
                      "inline-flex h-11 w-11 items-center justify-center rounded-[0.55rem] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--primary)]",
                      viewMode === mode.id
                        ? "bg-[var(--talea-accent-terracotta-soft)] text-[var(--primary)] shadow-[var(--talea-shadow-soft)]"
                        : "text-[var(--talea-text-tertiary)]"
                    )}
                  >
                    {mode.icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter pills: one row, scrolls sideways on narrow screens */}
            <div className="-mx-4 mt-2.5 overflow-x-auto px-4 [scrollbar-width:none] md:-mx-6 md:px-6 lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max items-center gap-2 py-1">
                <FilterSelect
                  label={t("common.sort", "Sortierung")}
                  value={sortMode}
                  allValue="newest"
                  onChange={(value) => setSortMode(value as SortMode)}
                  options={[{ value: "newest", label: t("storiesScreen.sortNewest") }, { value: "oldest", label: t("storiesScreen.sortOldest") }, { value: "title", label: t("storiesScreen.sortTitle") }]}
                />
                <FilterSelect label={t("storiesScreen.filterGenre")} value={genreFilter} onChange={setGenreFilter} options={genreFilterOptions} allLabel={t("storiesScreen.filterAll", { label: t("storiesScreen.filterGenre") })} />
                <FilterSelect label={t("storiesScreen.filterAge")} value={ageGroupFilter} onChange={setAgeGroupFilter} options={ageGroupFilterOptions} allLabel={t("storiesScreen.filterAll", { label: t("storiesScreen.filterAge") })} />
                <FilterSelect label={t("storiesScreen.filterLength")} value={lengthFilter} onChange={setLengthFilter} options={lengthFilterOptions} allLabel={t("storiesScreen.filterAll", { label: t("storiesScreen.filterLength") })} />
                <FilterSelect label={t("storiesScreen.filterAvatar")} value={avatarFilter} onChange={setAvatarFilter} options={avatarFilterOptions} allLabel={t("storiesScreen.filterAll", { label: t("storiesScreen.filterAvatar") })} />
                {hasActiveFilters ? (
                  <button type="button" onClick={onResetFilters} className="h-11 shrink-0 rounded-lg px-2 text-[14px] font-semibold text-[var(--primary)] hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--primary)]">
                    Zurücksetzen
                  </button>
                ) : null}
                <span className="shrink-0 pl-1 text-[13px] text-[var(--talea-text-tertiary)]">{filteredStories.length} Titel</span>
              </div>
            </div>

            <div className="mt-6">
              {loadError && stories.length > 0 && (
                <div className={cn(taleaInsetSurfaceClass, "mb-6 p-4 text-center")} role="alert">
                  <p className="text-[var(--talea-text-primary)]">{loadError}</p>
                  <TaleaActionButton className="mt-3" onClick={onRefresh}>Erneut versuchen</TaleaActionButton>
                </div>
              )}
              {loading ? (
                <LoadingState />
              ) : loadError && stories.length === 0 ? (
                <div className={cn(taleaInsetSurfaceClass, "p-8 text-center")} role="alert">
                  <p className="text-[var(--talea-text-primary)]">{loadError}</p>
                  <TaleaActionButton className="mt-4" onClick={onRefresh}>Erneut versuchen</TaleaActionButton>
                </div>
              ) : stories.length === 0 || (hasActiveFilters && filteredStories.length === 0) ? (
                <div className="space-y-6">
                  <div className={cn(taleaInsetSurfaceClass, "p-8 text-center sm:p-10")}>
                    <h3 className="text-[2rem] font-semibold text-[var(--talea-text-primary)]" style={{ fontFamily: headingFont }}>
                      {hasActiveFilters ? t("storiesScreen.noFilterResults") : t("storiesScreen.noStories")}
                    </h3>
                    <p className="mt-3 text-sm font-medium leading-7 text-[var(--talea-text-secondary)]">
                      {hasActiveFilters ? t("storiesScreen.noFilterResultsDesc") : t("storiesScreen.noStoriesDesc")}
                    </p>
                    <div className="mt-6 flex justify-center">
                      <TaleaActionButton onClick={hasActiveFilters ? onResetFilters : () => goTo("/story")}>
                        {hasActiveFilters ? t("common.cancel") : t("storiesScreen.createFirstStory")}
                      </TaleaActionButton>
                    </div>
                  </div>
                  {hasActiveFilters ? null : seriesTeaser}
                </div>
              ) : hasActiveFilters ? (
                <section aria-labelledby={resultsHeadingId} className="min-w-0">
                  <h2 id={resultsHeadingId} className="sr-only">Suchergebnisse</h2>
                  <StoryCollection key={collectionKey} stories={filteredStories} viewMode={viewMode} eyebrowFor={eyebrowFor} menuFor={menuFor} onOpen={onOpenStory} now={now} />
                </section>
              ) : (
                <div className="space-y-12 sm:space-y-14">
                  {seriesSection}
                  {freeSection}
                  {seriesTeaser}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};


const TaleaStoriesScreen: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const { billing, refresh: refreshUserAccess } = useOptionalUserAccess();
  const { isLoaded: authLoaded, isSignedIn } = useUser();
  const isDark = resolvedTheme === "dark";
  const { stories, total, loading, loadError, load, cancel, clear, removeStory, profileId } = useStoryLibrary();
  const { menuFor: storyMenu } = useStoryActions(removeStory);

  // The tab lives in the URL so "back" from a series page lands on Originals again.
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [contentTab, setContentTabState] = useState<ContentTab>(
    requestedTab === "originals" || requestedTab === "characters" ? requestedTab : "stories"
  );
  const setContentTab = useCallback(
    (value: ContentTab) => {
      setContentTabState(value);
      setSearchParams(value === "stories" ? {} : { tab: value }, { replace: true });
    },
    [setSearchParams]
  );
  const { catalogue, reload: reloadCatalogue } = useCharacterSeriesCatalogue(Boolean(isSignedIn) && contentTab === "stories");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [genreFilter, setGenreFilter] = useState("all");
  const [ageGroupFilter, setAgeGroupFilter] = useState("all");
  const [lengthFilter, setLengthFilter] = useState("all");
  const [avatarFilter, setAvatarFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");

  useEffect(() => {
    if (!authLoaded) {
      return;
    }

    if (!isSignedIn) {
      clear();
      return;
    }

    void refreshUserAccess();

    if (contentTab === "stories") {
      void load();
    }
    return cancel;
  }, [authLoaded, isSignedIn, contentTab, load, cancel, clear, profileId, refreshUserAccess]);

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

  const hasActiveFilters = searchQuery.trim().length > 0 || genreFilter !== "all" || ageGroupFilter !== "all" || lengthFilter !== "all" || avatarFilter !== "all";

  const shelves = useMemo(() => buildSeriesShelves(stories, catalogue), [stories, catalogue]);
  const shelvesById = useMemo(() => new Map(shelves.map((shelf) => [shelf.id, shelf])), [shelves]);
  const discoverSeries = useMemo(() => (catalogue ?? []).filter((entry) => !shelvesById.has(entry.id)), [catalogue, shelvesById]);
  const featuredStory = useMemo(() => pickFeaturedStory(stories, shelves), [stories, shelves]);

  /** A failed story starts again in the wizard; a failed series episode with its series, avatars and world. */
  const restartPath = useCallback((story: Story) => {
    const seriesId = seriesIdOf(story);
    if (!seriesId) return "/story";
    return seriesStoryPath({ seriesId, avatarIds: (story.config?.avatars ?? []).map((avatar) => avatar.id), genre: story.config?.genre });
  }, []);
  const openStory = useCallback((story: Story) => navigate(story.status === "error" ? restartPath(story) : `/story-reader/${story.id}`), [navigate, restartPath]);
  const menuFor = useCallback((story: Story) => storyMenu(story, () => navigate(restartPath(story))), [storyMenu, navigate, restartPath]);
  const openSeries = useCallback((shelf: SeriesShelf) => navigate(seriesPagePath(shelf.id)), [navigate]);
  const createNext = useCallback((shelf: SeriesShelf) => navigate(seriesStoryPath({ seriesId: shelf.id, avatarIds: shelf.lastAvatarIds, genre: shelf.genre })), [navigate]);
  const startSeries = useCallback((series: CharacterSeriesChoice) => navigate(seriesStoryPath({ seriesId: series.id, genre: series.genres?.[0] })), [navigate]);
  /** What a card says above its title: the world of a free story, the figure and episode of a series episode. */
  const eyebrowFor = useCallback((story: Story) => {
    const seriesId = seriesIdOf(story);
    if (seriesId) {
      const name = shelvesById.get(seriesId)?.characterName ?? "Figurenabenteuer";
      const episode = seriesEpisodeOf(story);
      return episode ? `${name} · Folge ${episode}` : name;
    }
    const genre = getStoryGenreKey(story);
    return genre ? formatGenreLabel(genre, t) : null;
  }, [shelvesById, t]);

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
          remainingStoryCredits={billing?.storyCredits.remaining}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          viewMode={viewMode}
          setViewMode={setViewMode}
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
          stories={stories}
          filteredStories={filteredStories}
          shelves={shelves}
          discoverSeries={discoverSeries}
          featuredStory={featuredStory}
          loading={loading}
          loadError={loadError}
          hasActiveFilters={hasActiveFilters}
          menuFor={menuFor}
          eyebrowFor={eyebrowFor}
          onOpenStory={openStory}
          onOpenSeries={openSeries}
          onCreateNext={createNext}
          onStartSeries={startSeries}
          onResetFilters={() => {
            setSearchQuery("");
            setGenreFilter("all");
            setAgeGroupFilter("all");
            setLengthFilter("all");
            setAvatarFilter("all");
          }}
          onRefresh={() => {
            if (contentTab === "stories") {
              void load();
              reloadCatalogue();
            }
          }}
          goTo={navigate}
        />
      </SignedIn>
    </div>
  );
};

export default TaleaStoriesScreen;
