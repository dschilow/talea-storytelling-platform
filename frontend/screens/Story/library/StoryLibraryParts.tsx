import React from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, BookOpen, Check, ImageOff, Plus, Sparkles } from "lucide-react";

import type { Avatar, Story } from "../../../types/story";
import type { CharacterSeriesChoice } from "../wizard-steps/StepCharacterSeries";
import { wereStoryImagesSkipped } from "../../../utils/storyQualityGate";
import ProgressiveImage from "@/components/common/ProgressiveImage";
import { TaleaCardMenu, type TaleaCardMenuAction } from "@/components/talea/TaleaCardMenu";
import { taleaDisplayFont } from "@/components/talea/TaleaPastelPrimitives";
import { cn } from "@/lib/utils";
import { Rail } from "../../Library/components/Rail";
import {
  episodeWord,
  isNewStory,
  isStoryRead,
  joinNames,
  seriesEpisodeOf,
  type SeriesShelf,
} from "./storyShelves";

export function formatStoryDate(value: string, locale = "de-DE") {
  return new Date(value).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

export function storyPreviewText(story: Story) {
  if (story.status === "error") return "Diese Geschichte konnte nicht fertig werden. Die Story-Münze geht automatisch zurück; starte sie einfach neu.";
  if (story.status === "generating") return story.summary || story.description || "Talea schreibt gerade an dieser Geschichte …";
  return story.summary || story.description || null;
}

/**
 * Cover-Darstellung ohne Crop: Die Story-Cover werden quadratisch (1024x1024)
 * generiert. Statt sie in flache Container zu quetschen (object-cover schnitt
 * Köpfe ab), zeigt das Bild sich vollständig (object-contain) über einer
 * unscharfen Version seiner selbst, die den Container füllt.
 */
export const StoryCoverMedia: React.FC<{
  src?: string | null;
  alt: string;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
  revealDelayMs?: number;
  fallbackIconClassName?: string;
  rounded?: string;
}> = ({ src, alt, loading = "lazy", fetchPriority = "auto", revealDelayMs = 0, fallbackIconClassName = "h-12 w-12", rounded = "rounded-[18px]" }) => (
  <div className={cn("relative h-full w-full overflow-hidden", rounded)}>
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
        <div className="flex h-full w-full items-center justify-center [background:var(--talea-gradient-nature)] text-[var(--talea-text-tertiary)]">
          <BookOpen className={fallbackIconClassName} />
        </div>
      }
    />
  </div>
);

const statusTone: Record<Story["status"], string> = {
  complete: "bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800",
  generating: "bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800",
  error: "bg-rose-100 text-rose-600 border-rose-200 dark:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800",
};

export const StoryStatusChip: React.FC<{ status: Story["status"] }> = ({ status }) => {
  const { t } = useTranslation();
  if (status === "complete") return null;
  return (
    <span className={cn("inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] shadow-sm", statusTone[status])}>
      {t(`storiesScreen.status.${status}`, status)}
    </span>
  );
};

export const StoryImageSkipChip: React.FC = () => (
  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 shadow-sm dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300">
    <ImageOff className="h-3.5 w-3.5" />
    Bilder übersprungen
  </span>
);

/** Chapter books show their progress while the job is still writing; `compact` for narrow cards. */
export const BookChip: React.FC<{ story: Story; compact?: boolean }> = ({ story, compact }) => {
  const book = story.metadata?.book;
  if (book?.format !== "chapter-book") return null;
  const label = book.state === "complete"
    ? compact ? "Kapitelbuch" : `Kapitelbuch · ${book.chaptersPlanned} Kapitel`
    : compact ? `Kapitelbuch · ${book.chaptersReady}/${book.chaptersPlanned}` : `Kapitelbuch · ${book.chaptersReady}/${book.chaptersPlanned} geschrieben`;
  return (
    <span className="inline-flex rounded-full border border-[var(--talea-border-light)] bg-[var(--talea-glass-bg)] px-3 py-1 text-[11px] font-semibold text-[var(--talea-text-primary)] shadow-sm backdrop-blur">
      {label}
    </span>
  );
};

const NewBadge: React.FC = () => (
  <span className="rounded-full bg-[var(--primary)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">Neu</span>
);

const ReadBadge: React.FC = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
    <Check className="h-3.5 w-3.5" aria-hidden="true" /> Gelesen
  </span>
);

/** The children's avatars as small overlapping faces; the names are read out, not shown. */
export const AvatarFaces: React.FC<{ people: Array<Pick<Avatar, "id" | "name" | "imageUrl">>; max?: number; className?: string }> = ({ people, max = 3, className }) => {
  if (!people.length) return null;
  const visible = people.slice(0, max);
  const rest = people.length - visible.length;
  return (
    <span className={cn("inline-flex items-center", className)}>
      <span className="flex -space-x-2" aria-hidden="true">
        {visible.map((person) => person.imageUrl ? (
          <img key={person.id} src={person.imageUrl} alt="" loading="lazy" decoding="async" className="h-6 w-6 rounded-full bg-[var(--talea-surface-inset)] object-cover object-top ring-2 ring-[var(--talea-surface-primary)]" />
        ) : (
          <span key={person.id} className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--talea-accent-terracotta-soft)] text-[10px] font-bold text-[var(--primary)] ring-2 ring-[var(--talea-surface-primary)]">
            {person.name.trim().charAt(0).toUpperCase()}
          </span>
        ))}
      </span>
      {rest > 0 ? <span className="ml-1.5 text-[12px] font-semibold text-[var(--talea-text-tertiary)]" aria-hidden="true">+{rest}</span> : null}
      <span className="sr-only">Mit {joinNames(people.map((person) => person.name), 6)}</span>
    </span>
  );
};

/** The series lead's pool portrait (square, full picture), cropped into a round medallion. */
export const SeriesPortrait: React.FC<{ src?: string; size?: "sm" | "md" | "lg"; className?: string }> = ({ src, size = "md", className }) => (
  <span
    aria-hidden="true"
    className={cn(
      "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_6px_16px_rgba(40,20,10,0.16)] ring-2 ring-[var(--talea-surface-primary)]",
      size === "sm" ? "h-9 w-9" : size === "md" ? "h-12 w-12" : "h-20 w-20 sm:h-24 sm:w-24",
      className,
    )}
  >
    {src ? <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <Sparkles className="h-1/2 w-1/2 text-[var(--primary)]" />}
  </span>
);

/** Section header of the library: eyebrow, title, one line of why, optional action on the right. */
export const LibrarySectionHeading: React.FC<{ id: string; eyebrow: string; title: string; subtitle?: string; action?: React.ReactNode }> = ({ id, eyebrow, title, subtitle, action }) => (
  <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-1">
    <div className="min-w-0">
      <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--primary)]">{eyebrow}</p>
      <h2 id={id} className="mt-1 text-[1.6rem] font-bold leading-tight text-[var(--talea-text-primary)] [text-wrap:balance] md:text-[1.85rem]" style={{ fontFamily: taleaDisplayFont }}>
        {title}
      </h2>
      {subtitle ? <p className="mt-1 max-w-2xl text-[15px] leading-snug text-[var(--talea-text-secondary)]">{subtitle}</p> : null}
    </div>
    {action}
  </div>
);

export interface LibraryHeroAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}

/** The billboard on top of "Meine Geschichten": one story, the picture carries the mood, the scrim keeps words readable. */
export const LibraryHero: React.FC<{
  ariaLabel?: string;
  imageUrl?: string;
  eyebrow: string;
  title: string;
  text?: string | null;
  meta?: string;
  portraitUrl?: string;
  primary: LibraryHeroAction;
  secondary?: LibraryHeroAction;
}> = ({ ariaLabel = "Weiterlesen", imageUrl, eyebrow, title, text, meta, portraitUrl, primary, secondary }) => {
  const reduceMotion = useReducedMotion();
  return (
    <section aria-label={ariaLabel} className="relative isolate overflow-hidden rounded-[26px] bg-[#251a16] shadow-[0_24px_60px_-28px_rgba(40,20,10,0.6)]">
      <div className="relative min-h-[25rem] sm:min-h-[24rem] lg:min-h-[23rem]">
        {imageUrl ? (
          <motion.img
            src={imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center sm:object-[50%_35%]"
            initial={{ scale: reduceMotion ? 1 : 1.05, opacity: reduceMotion ? 1 : 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 1.2, ease: "easeOut" }}
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(20,12,8,0.94),rgba(20,12,8,0.25)_90%)] lg:bg-[linear-gradient(to_right,rgba(20,12,8,0.93),rgba(20,12,8,0.25)_85%)]" />
        <div className="relative flex min-h-[25rem] max-w-2xl flex-col justify-end gap-3 p-6 text-white sm:min-h-[24rem] sm:p-8 lg:min-h-[23rem] lg:justify-center lg:p-12">
          <div className="flex items-center gap-2.5">
            {portraitUrl ? <SeriesPortrait src={portraitUrl} size="sm" className="ring-white/70" /> : null}
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffd9c4]">{eyebrow}</span>
          </div>
          <h2 className="line-clamp-3 text-[2.1rem] font-bold leading-[1.05] [text-wrap:balance] sm:text-[2.8rem]" style={{ fontFamily: taleaDisplayFont }}>{title}</h2>
          {text ? <p className="line-clamp-3 max-w-lg text-[15px] leading-relaxed text-white/90">{text}</p> : null}
          {meta ? <p className="text-sm text-white/75">{meta}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2.5">
            <button type="button" onClick={primary.onClick} className="inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-white px-5 text-[15px] font-bold text-[#24160e] transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              {primary.icon}
              {primary.label}
            </button>
            {secondary ? (
              <button type="button" onClick={secondary.onClick} className="inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-white/18 px-5 text-[15px] font-semibold text-white backdrop-blur-md transition hover:bg-white/26 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                {secondary.icon}
                {secondary.label}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};

const tileWidth = "w-[64vw] max-w-[17.5rem] shrink-0 snap-start sm:w-[17.5rem]";

/** One episode of a series as a landscape tile, like an episode of a Talea Original. */
export const SeriesEpisodeTile: React.FC<{
  story: Story;
  episode: number | null;
  menu: TaleaCardMenuAction[];
  onOpen: () => void;
  now?: number;
}> = ({ story, episode, menu, onOpen, now }) => {
  const label = episode ? `Folge ${episode}` : null;
  const read = isStoryRead(story);
  const fresh = isNewStory(story, now);
  const writing = story.status === "generating";
  const failed = story.status === "error";
  // While it is written the story only has the server's placeholder title.
  const title = writing ? "Neue Folge entsteht" : story.title;
  const meta = writing ? "Dauert nur ein paar Minuten" : failed ? "Nicht fertig geworden · neu starten" : read ? "Gelesen" : formatStoryDate(story.createdAt);
  return (
    <div className={cn("group relative", tileWidth)}>
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left focus-visible:outline-none"
        aria-label={`${label ? `${label}: ` : ""}${title}${read ? " (gelesen)" : fresh ? " (neu)" : failed ? " (fehlgeschlagen)" : ""}`}
      >
        <div className="relative aspect-[3/2] overflow-hidden rounded-[16px] bg-[var(--talea-media-skeleton)] ring-1 ring-black/5 transition-transform duration-300 group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-[var(--primary)] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
          {writing ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 [background:var(--talea-gradient-warm)] text-[var(--primary)]">
              <Sparkles className="h-8 w-8 motion-safe:animate-pulse" aria-hidden="true" />
              <span className="text-[13px] font-semibold text-[var(--talea-text-secondary)]">Talea schreibt …</span>
            </div>
          ) : (
            <StoryCoverMedia src={story.coverImageUrl} alt="" rounded="rounded-none" fallbackIconClassName="h-10 w-10" />
          )}
          {failed ? <div className="absolute inset-0 bg-black/35" aria-hidden="true" /> : null}
          <div className="absolute left-2.5 top-2.5 flex flex-wrap items-center gap-1.5 pr-14">
            {label ? <span className="rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">{label}</span> : null}
            {fresh ? <NewBadge /> : null}
          </div>
          {failed ? (
            <span className="absolute inset-x-2.5 bottom-2.5 inline-flex w-fit items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-[12px] font-semibold text-white">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Fehlgeschlagen
            </span>
          ) : read ? (
            <span className="absolute bottom-2.5 left-2.5"><ReadBadge /></span>
          ) : null}
        </div>
        <div className="mt-2 px-0.5">
          <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-[var(--talea-text-primary)]">{title}</p>
          <p className="mt-0.5 text-[13px] text-[var(--talea-text-secondary)]">{meta}</p>
        </div>
      </button>
      <TaleaCardMenu actions={menu} label={`Aktionen für ${title}`} className="!absolute right-2 top-2" />
    </div>
  );
};

/** The last tile of a series row: the next episode is one tap away, so the row never ends in nothing. */
export const SeriesNextTile: React.FC<{ episode: number; avatarNames: string[]; onCreate: () => void }> = ({ episode, avatarNames, onCreate }) => {
  const names = joinNames(avatarNames);
  return (
    <button type="button" onClick={onCreate} className={cn("group text-left focus-visible:outline-none", tileWidth)} aria-label={`Folge ${episode} erstellen${names ? ` mit ${names}` : ""}`}>
      <div className="flex aspect-[3/2] flex-col items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-[var(--talea-border-accent)] bg-[color-mix(in_srgb,var(--primary)_7%,transparent)] transition-colors duration-200 group-hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] group-focus-visible:ring-2 group-focus-visible:ring-[var(--primary)] group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[var(--talea-page-solid)]">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_8px_20px_color-mix(in_srgb,var(--primary)_35%,transparent)] transition-transform duration-200 group-hover:scale-105 motion-reduce:group-hover:scale-100">
          <Plus className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className="text-[1.3rem] font-bold leading-none text-[var(--talea-text-primary)]" style={{ fontFamily: taleaDisplayFont }}>Folge {episode}</span>
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-[15px] font-semibold leading-snug text-[var(--talea-text-primary)]">Wie geht es weiter?</p>
        <p className="mt-0.5 line-clamp-1 text-[13px] text-[var(--talea-text-secondary)]">{names ? `Mit ${names} weitererzählen` : "Die nächste Folge erzählen"}</p>
      </div>
    </button>
  );
};

/** One row per series: portrait, the episodes in reading order, and the next episode at the end. */
export const SeriesRow: React.FC<{
  shelf: SeriesShelf;
  menuFor: (story: Story) => TaleaCardMenuAction[];
  onOpenEpisode: (story: Story) => void;
  onOpenSeries: () => void;
  onCreateNext: () => void;
  now?: number;
}> = ({ shelf, menuFor, onOpenEpisode, onOpenSeries, onCreateNext, now }) => {
  const subtitle = [
    shelf.completeCount ? episodeWord(shelf.completeCount) : "Erste Folge",
    shelf.unreadCount ? `${shelf.unreadCount} ungelesen` : null,
    shelf.avatars.length ? `mit ${joinNames(shelf.avatars.map((avatar) => avatar.name), 2)}` : null,
  ].filter(Boolean).join(" · ");
  // Open the row where reading continues; when everything is read, at the newest episode next to "Wie geht es weiter?".
  const startIndex = shelf.firstUnreadIndex >= 0 ? shelf.firstUnreadIndex : Math.max(0, shelf.episodes.length - 1);
  return (
    <Rail
      title={shelf.title}
      titleAs="h3"
      subtitle={subtitle}
      leading={<SeriesPortrait src={shelf.portraitUrl} className="max-sm:h-10 max-sm:w-10" />}
      actionLabel="Alle Folgen"
      onAction={onOpenSeries}
      startIndex={startIndex}
    >
      {shelf.episodes.map((story) => (
        <SeriesEpisodeTile
          key={story.id}
          story={story}
          episode={seriesEpisodeOf(story) ?? (story.status === "generating" ? shelf.nextEpisode : null)}
          menu={menuFor(story)}
          onOpen={() => onOpenEpisode(story)}
          now={now}
        />
      ))}
      {!shelf.generating && shelf.nextEpisode ? (
        <SeriesNextTile episode={shelf.nextEpisode} avatarNames={shelf.avatars.filter((avatar) => shelf.lastAvatarIds.includes(avatar.id)).map((avatar) => avatar.name)} onCreate={onCreateNext} />
      ) : null}
    </Rail>
  );
};

/**
 * Figures the family has not met yet. Prominent (no series started) it explains the idea; otherwise it is a quiet strip
 * under the series rows.
 */
export const SeriesDiscover: React.FC<{
  series: CharacterSeriesChoice[];
  prominent?: boolean;
  onStart: (series: CharacterSeriesChoice) => void;
}> = ({ series, prominent, onStart }) => {
  if (!series.length) return null;
  // Inside the sentence an article is lower case: "Trefft Kapitän Blubbert, die Nebelfee …".
  const names = series.map((entry) => (entry.characterName || entry.title).replace(/^(Der|Die|Das) /, (article) => article.toLowerCase()));
  return (
    <div className={cn("rounded-[22px] bg-[var(--talea-surface-inset)]", prominent ? "p-5 sm:p-7" : "p-4 sm:p-5")}>
      {prominent ? (
        <div className="max-w-2xl">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--primary)]">Neu: Figurenabenteuer</p>
          <h3 className="mt-1 text-[1.45rem] font-bold leading-tight text-[var(--talea-text-primary)] [text-wrap:balance]" style={{ fontFamily: taleaDisplayFont }}>
            Serien, in denen eure Avatare mitspielen
          </h3>
          <p className="mt-1.5 text-[15px] leading-snug text-[var(--talea-text-secondary)]">
            Trefft {joinNames(names, 2)}. Jede Folge erzählt eure gemeinsame Geschichte weiter, wie bei einer richtigen Serie.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-[1.05rem] font-bold text-[var(--talea-text-primary)]" style={{ fontFamily: taleaDisplayFont }}>Neue Figuren kennenlernen</h3>
          <p className="text-[13px] text-[var(--talea-text-secondary)]">Jede Figur bringt ihre eigene Serie mit.</p>
        </div>
      )}
      <ul className="-mx-1 mt-4 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap sm:gap-2 [&::-webkit-scrollbar]:hidden">
        {series.map((entry) => (
          <li key={entry.id} className="shrink-0">
            <button
              type="button"
              onClick={() => onStart(entry)}
              className="group flex w-[6.5rem] flex-col items-center gap-2 rounded-2xl p-2 text-center transition-colors hover:bg-[var(--talea-surface-primary)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
              aria-label={`${entry.title}: erste Folge erstellen`}
            >
              <SeriesPortrait src={entry.imageUrl || undefined} size="lg" className="transition-transform duration-200 group-hover:scale-[1.04] motion-reduce:group-hover:scale-100 sm:h-20 sm:w-20" />
              <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-[var(--talea-text-primary)]">{entry.characterName || entry.title}</span>
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--primary)]">
                <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Folge 1
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** A free story in the cover grid: the picture first, then what it is, its title and who played along. */
export const LibraryStoryCard: React.FC<{
  story: Story;
  index: number;
  eyebrow?: string | null;
  menu: TaleaCardMenuAction[];
  onOpen: () => void;
  now?: number;
}> = ({ story, index, eyebrow, menu, onOpen, now }) => {
  const reduceMotion = useReducedMotion();
  const read = isStoryRead(story);
  const fresh = isNewStory(story, now);
  const imagesSkipped = wereStoryImagesSkipped(story);
  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="group relative min-w-0"
    >
      <button type="button" onClick={onOpen} className="flex w-full flex-col text-left focus-visible:outline-none" aria-label={`${story.title} öffnen`}>
        <div className="relative aspect-square overflow-hidden rounded-[18px] bg-[var(--talea-media-skeleton)] ring-1 ring-black/5 transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[var(--talea-shadow-medium)] group-focus-visible:ring-2 group-focus-visible:ring-[var(--primary)] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
          <StoryCoverMedia
            src={story.coverImageUrl}
            alt=""
            rounded="rounded-none"
            loading={index < 4 ? "eager" : "lazy"}
            revealDelayMs={Math.min(index, 8) * 35}
            fallbackIconClassName="h-12 w-12"
          />
          {fresh ? <span className="absolute left-2.5 top-2.5"><NewBadge /></span> : null}
          {/* States sit at the bottom edge: the top right belongs to the "…" menu. */}
          <div className="absolute inset-x-2.5 bottom-2.5 flex flex-wrap items-end gap-1.5">
            {story.status !== "complete" ? <StoryStatusChip status={story.status} /> : null}
            {imagesSkipped ? <StoryImageSkipChip /> : null}
            <BookChip story={story} compact />
            {read ? <ReadBadge /> : null}
          </div>
        </div>
        <div className="mt-2.5 px-0.5">
          {eyebrow ? <p className="truncate text-[11.5px] font-bold uppercase tracking-[0.08em] text-[var(--talea-text-tertiary)]">{eyebrow}</p> : null}
          <h3 className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug text-[var(--talea-text-primary)] sm:text-[16px]" style={{ fontFamily: taleaDisplayFont }}>
            {story.title}
          </h3>
          <span className="mt-1.5 flex items-center gap-2">
            <AvatarFaces people={story.config?.avatars ?? []} />
            <span className="text-[12.5px] text-[var(--talea-text-tertiary)]">{formatStoryDate(story.createdAt)}</span>
          </span>
        </div>
      </button>
      <TaleaCardMenu actions={menu} label={`Aktionen für ${story.title}`} className="!absolute right-2 top-2" />
    </motion.article>
  );
};

/** The list view: a smaller cover, the summary and the state in one row. */
export const ListStoryRow: React.FC<{
  story: Story;
  index: number;
  eyebrow?: string | null;
  menu: TaleaCardMenuAction[];
  onOpen: () => void;
  now?: number;
}> = ({ story, index, eyebrow, menu, onOpen, now }) => {
  const reduceMotion = useReducedMotion();
  const imagesSkipped = wereStoryImagesSkipped(story);
  const read = isStoryRead(story);
  const fresh = isNewStory(story, now);
  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="group relative flex items-start gap-2 rounded-[1.375rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] p-2.5 pr-3 shadow-[var(--talea-shadow-soft)] transition-shadow hover:shadow-[var(--talea-shadow-medium)]"
    >
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3.5 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-[var(--primary)] sm:gap-4" aria-label={`${story.title} öffnen`}>
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--talea-media-skeleton)] sm:h-24 sm:w-24">
          <StoryCoverMedia src={story.coverImageUrl} alt="" revealDelayMs={index * 30} fallbackIconClassName="h-8 w-8" />
        </div>
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="truncate text-[11.5px] font-bold uppercase tracking-[0.08em] text-[var(--talea-text-tertiary)]">{eyebrow}</p> : null}
          <h3 className="line-clamp-2 text-[17px] font-semibold leading-snug text-[var(--talea-text-primary)]" style={{ fontFamily: taleaDisplayFont }}>
            {story.title}
          </h3>
          <p className="mt-0.5 line-clamp-1 text-[15px] text-[var(--talea-text-secondary)] sm:line-clamp-2">{storyPreviewText(story)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-[var(--talea-text-tertiary)]">
            {story.status !== "complete" ? <StoryStatusChip status={story.status} /> : null}
            {imagesSkipped ? <StoryImageSkipChip /> : null}
            <BookChip story={story} />
            {fresh ? <NewBadge /> : null}
            {read ? <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300"><Check className="h-3.5 w-3.5" aria-hidden="true" /> Gelesen</span> : null}
            <AvatarFaces people={story.config?.avatars ?? []} />
            <span>{formatStoryDate(story.createdAt)}</span>
          </div>
        </div>
      </button>
      <TaleaCardMenu actions={menu} label={`Aktionen für ${story.title}`} className="self-start [&>button]:bg-[var(--talea-surface-inset)] [&>button]:text-[var(--talea-text-secondary)] [&>button]:backdrop-blur-none" />
    </motion.article>
  );
};
