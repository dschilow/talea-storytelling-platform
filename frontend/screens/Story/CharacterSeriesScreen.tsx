import React, { useEffect, useId, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth, useUser } from "@clerk/clerk-react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowLeft, BookOpen, Check, ChevronDown, Plus, RefreshCw, RotateCcw, Sparkles } from "lucide-react";

import type { Story } from "../../types/story";
import type { CharacterSeriesChoice } from "./wizard-steps/StepCharacterSeries";
import { useOptionalChildProfiles } from "@/contexts/ChildProfilesContext";
import { StoryParticipantsDialog } from "@/components/story/StoryParticipantsDialog";
import { TaleaCardMenu, type TaleaCardMenuAction } from "@/components/talea/TaleaCardMenu";
import {
  TaleaLoadingState,
  taleaBodyFont,
  taleaDisplayFont,
  taleaInsetSurfaceClass,
  taleaPageShellClass,
  taleaSurfaceClass,
} from "@/components/talea/TaleaPastelPrimitives";
import { cn } from "@/lib/utils";
import { resetCharacterSeries } from "../../utils/characterSeriesApi";
import { useCharacterSeriesCatalogue, useStoryActions, useStoryLibrary } from "./library/useStoryLibrary";
import {
  buildSeriesShelves,
  episodeWord,
  isNewStory,
  isStoryRead,
  joinNames,
  seriesEpisodeOf,
  seriesStoryPath,
  type SeriesShelf,
} from "./library/storyShelves";
import { AvatarFaces, SeriesPortrait, StoryCoverMedia, formatStoryDate, storyPreviewText } from "./library/StoryLibraryParts";

/**
 * One Figurenserie of this family, like the page of a Talea Original: the figure, every episode in reading order, who
 * played along, and the next episode one tap away.
 */
const CharacterSeriesScreen: React.FC = () => {
  const { seriesId = "" } = useParams<{ seriesId: string }>();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useUser();
  const { stories, loading, loadError, load, cancel, removeStory, profileId } = useStoryLibrary();
  const { catalogue, reload: reloadCatalogue } = useCharacterSeriesCatalogue(Boolean(isSignedIn));
  const { menuFor: storyMenu, isAdmin } = useStoryActions(removeStory);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void load();
    return cancel;
  }, [isLoaded, isSignedIn, load, cancel, profileId]);

  const shelf = useMemo(() => buildSeriesShelves(stories, catalogue).find((entry) => entry.id === seriesId), [stories, catalogue, seriesId]);
  const entry = catalogue?.find((item) => item.id === seriesId);
  const now = useMemo(() => Date.now(), [stories]);

  if (!shelf && !entry) {
    if (loading || (catalogue === null && !loadError)) return <TaleaLoadingState title="Figurenabenteuer" subtitle="Die Serie wird geöffnet." />;
    return (
      <div className={cn(taleaPageShellClass, "py-10")} style={{ fontFamily: taleaBodyFont }}>
        <div className={cn(taleaInsetSurfaceClass, "flex flex-col items-center gap-4 p-8 text-center")} role={loadError ? "alert" : undefined}>
          <p className="text-[15px] text-[var(--talea-text-secondary)]">{loadError || "Diese Serie gibt es in eurer Bibliothek nicht."}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {loadError ? (
              <button type="button" onClick={() => { void load(); reloadCatalogue(); }} className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--talea-surface-primary)] px-4 font-semibold text-[var(--primary)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]">
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Nochmal versuchen
              </button>
            ) : null}
            <button type="button" onClick={() => navigate("/stories")} className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--talea-surface-primary)] px-4 font-semibold text-[var(--talea-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Meine Geschichten
            </button>
          </div>
        </div>
      </div>
    );
  }

  const restartPath = (story: Story) => seriesStoryPath({ seriesId, avatarIds: (story.config?.avatars ?? []).map((avatar) => avatar.id), genre: story.config?.genre });
  const openStory = (story: Story) => navigate(story.status === "error" ? restartPath(story) : `/story-reader/${story.id}`);
  const title = shelf?.title ?? entry?.title ?? "Figurenabenteuer";

  return (
    <CharacterSeriesView
      shelf={shelf}
      entry={entry}
      now={now}
      loadError={loadError}
      menuFor={(story) => storyMenu(story, () => navigate(restartPath(story)))}
      onOpenStory={openStory}
      onCreate={() => navigate(seriesStoryPath({ seriesId, avatarIds: shelf?.lastAvatarIds ?? [], genre: shelf?.genre ?? entry?.genres?.[0] }))}
      onBack={() => navigate("/stories")}
      adminSlot={isAdmin ? <AdminSeriesReset seriesId={seriesId} title={title} counted={entry?.episodeCount ?? shelf?.completeCount ?? 0} onReset={reloadCatalogue} /> : null}
    />
  );
};

/** The series page itself: everything it shows comes in as props (the screen above loads it). */
const CharacterSeriesView: React.FC<{
  shelf?: SeriesShelf;
  entry?: CharacterSeriesChoice;
  now: number;
  loadError?: string | null;
  menuFor: (story: Story) => TaleaCardMenuAction[];
  onOpenStory: (story: Story) => void;
  onCreate: () => void;
  onBack: () => void;
  adminSlot?: React.ReactNode;
}> = ({ shelf, entry, now, loadError, menuFor, onOpenStory: openStory, onCreate, onBack, adminSlot }) => {
  const reduceMotion = useReducedMotion();
  const episodesHeadingId = useId();
  const castHeadingId = useId();
  const title = shelf?.title ?? entry?.title ?? "Figurenabenteuer";
  const portrait = shelf?.portraitUrl ?? entry?.imageUrl ?? undefined;
  const description = shelf?.description ?? entry?.description;
  const cover = shelf?.coverImageUrl;
  const nextEpisode = shelf ? shelf.nextEpisode : (entry ? entry.episodeCount + 1 : null);
  const avatarIds = shelf?.lastAvatarIds ?? [];
  const firstUnread = shelf && shelf.firstUnreadIndex >= 0 ? shelf.episodes[shelf.firstUnreadIndex] : undefined;
  const firstUnreadEpisode = firstUnread ? seriesEpisodeOf(firstUnread) : null;
  const nextNames = shelf ? joinNames(shelf.avatars.filter((avatar) => avatarIds.includes(avatar.id)).map((avatar) => avatar.name), 2) : "";
  const canCreate = Boolean(nextEpisode) && !shelf?.generating;
  const meta = shelf
    ? shelf.completeCount === 0 && shelf.earlier.length > 0
      ? `Neuer Durchgang · ${episodeWord(shelf.earlier.length)} von früher`
      : [episodeWord(shelf.completeCount), shelf.readCount ? `${shelf.readCount} gelesen` : null, shelf.avatars.length ? `mit ${joinNames(shelf.avatars.map((avatar) => avatar.name), 3)}` : null].filter(Boolean).join(" · ")
    : "Noch keine Folge";
  const castStory = shelf ? castOf(shelf) : null;

  const createButton = (primary: boolean) => canCreate ? (
    <button
      type="button"
      onClick={onCreate}
      className={primary
        ? "inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-bold text-[#24160e] transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        : "inline-flex min-h-12 items-center gap-2 rounded-full bg-white/18 px-5 text-[15px] font-semibold text-white backdrop-blur-md transition hover:bg-white/26 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"}
    >
      <Plus className="h-5 w-5" aria-hidden="true" /> Folge {nextEpisode} erstellen
    </button>
  ) : null;

  return (
    <div className="pb-12" style={{ fontFamily: taleaBodyFont }}>
      {/* ── Hero ── */}
      <section className="relative isolate overflow-hidden bg-[#1d140f] text-white">
        {cover ? (
          <motion.img
            src={cover}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[50%_35%]"
            initial={{ scale: reduceMotion ? 1 : 1.06, opacity: reduceMotion ? 1 : 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 1.4, ease: "easeOut" }}
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_30%,rgba(185,81,52,0.55),transparent_60%)]" aria-hidden="true" />
        )}
        {/* Phones stack more text over the picture, so the scrim reaches higher there; wider screens darken the text side. */}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(20,12,8,0.95)_0%,rgba(20,12,8,0.6)_40%,rgba(20,12,8,0.15)_75%)] max-sm:bg-[linear-gradient(to_top,rgba(20,12,8,0.96)_0%,rgba(20,12,8,0.8)_55%,rgba(20,12,8,0.45)_100%)]" />
        <div className="absolute inset-0 hidden bg-[linear-gradient(to_right,rgba(20,12,8,0.72)_0%,rgba(20,12,8,0.38)_42%,rgba(20,12,8,0)_68%)] sm:block" aria-hidden="true" />
        <div className={cn(taleaPageShellClass, "relative flex min-h-[30rem] flex-col justify-between gap-8 pb-8 pt-4 sm:min-h-[34rem] sm:pb-10")}>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-black/35 px-4 text-[14px] font-semibold backdrop-blur-md transition hover:bg-black/50 focus-visible:outline-2 focus-visible:outline-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Meine Geschichten
          </button>
          <div className="flex max-w-2xl flex-col gap-3">
            <div className="flex items-center gap-3">
              <SeriesPortrait src={portrait} size="lg" className="ring-white/80" />
              <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#ffd9c4]">Figurenabenteuer · Eure Serie</span>
            </div>
            <h1 className="text-[2.3rem] font-bold leading-[1.02] [text-wrap:balance] sm:text-[3.2rem]" style={{ fontFamily: taleaDisplayFont }}>
              {title}
            </h1>
            {description ? <p className="text-[16px] leading-relaxed text-white/88">{description}</p> : null}
            <p className="text-[13px] font-medium text-white/75">{meta}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2.5">
              {firstUnread ? (
                <button
                  type="button"
                  onClick={() => openStory(firstUnread)}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-bold text-[#24160e] transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <BookOpen className="h-5 w-5" aria-hidden="true" /> {firstUnreadEpisode ? `Folge ${firstUnreadEpisode} lesen` : "Weiterlesen"}
                </button>
              ) : null}
              {createButton(!firstUnread)}
              {shelf?.generating ? (
                <span className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white/18 px-5 text-[15px] font-semibold text-white backdrop-blur-md">
                  <Sparkles className="h-5 w-5 motion-safe:animate-pulse" aria-hidden="true" /> {nextEpisode ? `Folge ${nextEpisode} wird geschrieben …` : "Neue Folge wird geschrieben …"}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className={cn(taleaPageShellClass, "mt-8 space-y-10")}>
        {/* ── Episodes ── */}
        <section aria-labelledby={episodesHeadingId}>
          <h2 id={episodesHeadingId} className="px-1 text-[1.35rem] font-bold text-[var(--talea-text-primary)]" style={{ fontFamily: taleaDisplayFont }}>
            Folgen
          </h2>
          {loadError && shelf ? <p role="alert" className="mt-2 px-1 text-[14px] text-[var(--talea-text-secondary)]">{loadError}</p> : null}
          <ol className="mt-4 flex flex-col gap-3">
            {(shelf?.episodes ?? []).map((story) => (
              <li key={story.id}>
                <EpisodeRow story={story} episode={seriesEpisodeOf(story) ?? (story.status === "generating" ? nextEpisode : null)} menu={menuFor(story)} onOpen={() => openStory(story)} now={now} />
              </li>
            ))}
            {canCreate && nextEpisode ? (
              <li>
                <button
                  type="button"
                  onClick={onCreate}
                  className="group flex w-full items-center gap-3 rounded-[1.375rem] border-2 border-dashed border-[var(--talea-border-accent)] bg-[color-mix(in_srgb,var(--primary)_6%,transparent)] p-2.5 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_11%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] sm:gap-5 sm:p-3"
                >
                  <span className="flex aspect-[3/2] w-[38%] max-w-[15rem] shrink-0 items-center justify-center rounded-[12px] bg-[var(--talea-surface-primary)]">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_8px_20px_color-mix(in_srgb,var(--primary)_35%,transparent)] transition-transform duration-200 group-hover:scale-105 motion-reduce:group-hover:scale-100">
                      <Plus className="h-6 w-6" aria-hidden="true" />
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1 py-1">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--primary)]">Folge {nextEpisode}</span>
                    <span className="text-[16px] font-semibold leading-snug text-[var(--talea-text-primary)] sm:text-[17px]">{shelf?.completeCount ? "Wie geht es weiter?" : "Eure erste Begegnung"}</span>
                    <span className="text-[14px] leading-snug text-[var(--talea-text-secondary)]">
                      {nextNames ? `Mit ${nextNames} die nächste Folge erzählen` : shelf?.completeCount ? "Die nächste Folge erzählen" : "Wählt eure Avatare und lernt die Figur kennen"}
                    </span>
                  </span>
                </button>
              </li>
            ) : null}
          </ol>
          {shelf && !shelf.episodes.length && !canCreate && !shelf.generating ? (
            <p className="mt-3 px-1 text-[14px] text-[var(--talea-text-secondary)]">Diese Serie wird gerade nicht weitergeschrieben. Ihre Folgen könnt ihr weiter lesen.</p>
          ) : null}
        </section>

        {/* ── Earlier run (admin reset or an older timeline) ── */}
        {shelf?.earlier.length ? (
          <details className="group rounded-[22px] bg-[var(--talea-surface-inset)] p-4 sm:p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)] [&::-webkit-details-marker]:hidden">
              <span>
                <span className="block text-[16px] font-bold text-[var(--talea-text-primary)]">Frühere Folgen</span>
                <span className="block text-[13px] text-[var(--talea-text-secondary)]">{episodeWord(shelf.earlier.length)} aus einem früheren Durchgang, weiter lesbar</span>
              </span>
              <ChevronDown className="h-5 w-5 shrink-0 text-[var(--talea-text-secondary)] transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
            </summary>
            <ol className="mt-4 flex flex-col gap-3">
              {shelf.earlier.map((story) => (
                <li key={story.id}>
                  <EpisodeRow story={story} episode={seriesEpisodeOf(story)} menu={menuFor(story)} onOpen={() => openStory(story)} now={now} />
                </li>
              ))}
            </ol>
          </details>
        ) : null}

        {/* ── Cast ── */}
        {castStory ? (
          <section aria-labelledby={castHeadingId}>
            <h2 id={castHeadingId} className="px-1 text-[1.35rem] font-bold text-[var(--talea-text-primary)]" style={{ fontFamily: taleaDisplayFont }}>
              Mit dabei
            </h2>
            <p className="mt-1 px-1 text-[15px] text-[var(--talea-text-secondary)]">Eure Avatare und alle Figuren, die ihr in dieser Serie getroffen habt. Tippt auf eine Figur für ihr Profil.</p>
            <StoryParticipantsDialog story={castStory} maxVisible={12} className="mt-4" />
          </section>
        ) : null}

        {adminSlot}
      </div>
    </div>
  );
};

/** Everyone of the series in one participants list: the avatars and the figures they met, the lead figure first. */
function castOf(shelf: SeriesShelf): Story | null {
  const all = [...shelf.earlier, ...shelf.episodes];
  const base = all.find((story) => story.status === "complete") ?? all[0];
  // Avatars of an earlier run (before an admin reset) played along too.
  const avatars = [...shelf.avatars, ...all.slice().reverse().flatMap((story) => story.config?.avatars ?? [])]
    .filter((avatar, index, list) => list.findIndex((other) => other.id === avatar.id) === index);
  if (!base || (!avatars.length && !shelf.figures.length)) return null;
  return { ...base, id: `series-${shelf.id}`, config: { ...base.config, avatars, characters: shelf.figures } };
}

const EpisodeRow: React.FC<{
  story: Story;
  episode: number | null;
  menu: TaleaCardMenuAction[];
  onOpen: () => void;
  now: number;
}> = ({ story, episode, menu, onOpen, now }) => {
  const read = isStoryRead(story);
  const fresh = isNewStory(story, now);
  const writing = story.status === "generating";
  const failed = story.status === "error";
  const label = episode ? `Folge ${episode}` : writing ? "Neue Folge" : "Folge";
  // While it is written the story only has the server's placeholder title and description.
  const title = writing ? "Neue Folge entsteht" : story.title;
  const text = writing ? "Talea schreibt gerade die nächste Folge. Das dauert nur ein paar Minuten." : storyPreviewText(story);
  return (
    <div className={cn(taleaSurfaceClass, "group flex gap-3 p-2.5 sm:gap-5 sm:p-3")}>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 gap-3 rounded-[14px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] sm:gap-5"
        aria-label={`${label}: ${title}${read ? " (gelesen)" : fresh ? " (neu)" : failed ? " (fehlgeschlagen, neu starten)" : ""}`}
      >
        <span className="relative aspect-[3/2] w-[38%] max-w-[15rem] shrink-0 overflow-hidden rounded-[12px] bg-[var(--talea-media-skeleton)]">
          {writing ? (
            <span className="flex h-full w-full items-center justify-center [background:var(--talea-gradient-warm)] text-[var(--primary)]">
              <Sparkles className="h-7 w-7 motion-safe:animate-pulse" aria-hidden="true" />
            </span>
          ) : (
            <StoryCoverMedia src={story.coverImageUrl} alt="" rounded="rounded-none" fallbackIconClassName="h-9 w-9" />
          )}
          {failed ? <span className="absolute inset-0 bg-black/35" aria-hidden="true" /> : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-1 pr-11">
          <span className="flex flex-wrap items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--talea-text-tertiary)]">
            {label}
            {fresh ? <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-[10px] text-white">Neu</span> : null}
          </span>
          <span className="line-clamp-2 text-[16px] font-semibold leading-snug text-[var(--talea-text-primary)] sm:text-[17px]">{title}</span>
          <span className="line-clamp-2 text-[14px] leading-snug text-[var(--talea-text-secondary)] max-sm:hidden">{text}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--talea-text-secondary)]">
            {writing ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">Wird gerade geschrieben …</span>
            ) : failed ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-300"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Nicht fertig geworden · neu starten</span>
            ) : read ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300"><Check className="h-3.5 w-3.5" aria-hidden="true" /> Gelesen</span>
            ) : (
              <span>{formatStoryDate(story.createdAt)}</span>
            )}
            <AvatarFaces people={story.config?.avatars ?? []} />
          </span>
        </span>
      </button>
      <TaleaCardMenu actions={menu} label={`Aktionen für ${story.title}`} className="!absolute right-2.5 top-2.5 [&>button]:bg-[var(--talea-surface-inset)] [&>button]:text-[var(--talea-text-secondary)] [&>button]:backdrop-blur-none" />
    </div>
  );
};

/** Admin test tool: the counter of this series starts again at 0 for the active profile; the stories stay readable. */
const AdminSeriesReset: React.FC<{ seriesId: string; title: string; counted: number; onReset: () => void }> = ({ seriesId, title, counted, onReset }) => {
  const { getToken } = useAuth();
  const profileId = useOptionalChildProfiles()?.activeProfileId;
  const [state, setState] = useState<{ busy: boolean; message: string | null; error: string | null }>({ busy: false, message: null, error: null });
  const reset = async () => {
    if (!window.confirm(`Folgen-Zähler von „${title}“ für dieses Profil auf 0 setzen?\n\nDie bisherigen ${episodeWord(counted)} bleiben in der Bibliothek, zählen aber nicht mehr. Die nächste Geschichte beginnt wieder mit Folge 1.`)) return;
    setState({ busy: true, message: null, error: null });
    try {
      const result = await resetCharacterSeries(getToken, seriesId, profileId);
      setState({ busy: false, message: `${episodeWord(result.resetEpisodes)} zurückgesetzt. Die nächste Geschichte ist wieder Folge 1.`, error: null });
      onReset();
    } catch (error) {
      setState({ busy: false, message: null, error: error instanceof Error && error.message ? error.message : "Der Zähler konnte nicht zurückgesetzt werden." });
    }
  };
  return (
    <section className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm">
      <p className="font-semibold text-[var(--talea-text-primary)]">Admin-Test: Folgen-Zähler</p>
      <p className="mt-0.5 text-xs text-[var(--talea-text-secondary)]">
        {counted > 0
          ? `${episodeWord(counted)} zählen für dieses Profil. Zurücksetzen beginnt die Serie wieder mit Folge 1; die Geschichten bleiben lesbar.`
          : "Der Zähler steht auf 0, die nächste Geschichte ist Folge 1."}
      </p>
      <button
        type="button"
        onClick={() => void reset()}
        disabled={state.busy || counted === 0}
        className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-500/50 px-3 py-2 text-sm font-semibold text-[var(--talea-text-primary)] transition-colors hover:bg-amber-400/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RotateCcw aria-hidden className={cn("h-4 w-4", state.busy && "animate-spin")} />
        {state.busy ? "Wird zurückgesetzt …" : "Zähler auf 0 setzen"}
      </button>
      <p role="status" aria-live="polite" className="mt-1.5 text-xs font-medium text-[var(--talea-text-primary)] empty:hidden">{state.message}</p>
      {state.error ? <p role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{state.error}</p> : null}
    </section>
  );
};

export default CharacterSeriesScreen;
