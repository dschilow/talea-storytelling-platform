import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, BookOpen, CheckCircle2, Clock3, Lock, Play, RefreshCw } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useBackend } from "@/hooks/useBackend";
import { useOptionalChildProfiles } from "@/contexts/ChildProfilesContext";
import { TaleaLoadingState, taleaDisplayFont, taleaInsetSurfaceClass, taleaPageShellClass, taleaSurfaceClass } from "@/components/talea/TaleaPastelPrimitives";
import { cn } from "@/lib/utils";
import { CollectibleCard, CollectibleCardBack } from "./components/CollectibleCard";
import OriginalsStudioPanel from "./admin/OriginalsStudioPanel";
import {
  catchphraseOf,
  episodeLabel,
  episodeReaderPath,
  errorMessage,
  formatRelease,
  ORIGINALS_NAME,
  originalsHomePath,
  ROLE_LABELS,
  STATE_LABELS,
  STATE_TONES,
  type LibraryCharacter,
  type LibraryCollectionResponse,
  type LibraryEpisodeCard,
  type LibrarySeriesResponse,
} from "./libraryShared";

type View = "episodes" | "characters" | "collection" | "studio";

const OriginalsSeriesScreen: React.FC = () => {
  const { slug = "" } = useParams<{ slug: string }>();
  const [params, setParams] = useSearchParams();
  const backend = useBackend();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const profileId = useOptionalChildProfiles()?.activeProfileId;
  const [page, setPage] = useState<LibrarySeriesResponse | null>(null);
  const [collection, setCollection] = useState<LibraryCollectionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [character, setCharacter] = useState<LibraryCharacter | null>(null);
  const view = (params.get("view") as View) || "episodes";
  const setView = (next: View) => setParams(next === "episodes" ? {} : { view: next }, { replace: true });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [next, collected] = await Promise.all([
        backend.story.librarySeries({ slug, profileId: profileId || undefined }),
        backend.story.libraryCollection({ profileId: profileId || undefined }),
      ]);
      setPage(next);
      setCollection(collected);
    } catch (loadError) {
      setError(errorMessage(loadError, "Diese Reihe konnte nicht geladen werden."));
    }
  }, [backend, slug, profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  const views = useMemo(() => {
    const list: Array<{ id: View; label: string }> = [
      { id: "episodes", label: "Folgen" },
      { id: "characters", label: "Figuren" },
      { id: "collection", label: "Sammlung" },
    ];
    if (page?.isAdmin) list.push({ id: "studio", label: "Studio" });
    return list;
  }, [page?.isAdmin]);

  if (error) {
    return (
      <div className={cn(taleaPageShellClass, "py-10")}>
        <div className={cn(taleaInsetSurfaceClass, "flex flex-col items-center gap-4 p-8 text-center")}>
          <p className="text-[15px] text-[var(--talea-text-secondary)]">{error}</p>
          <button type="button" onClick={() => void load()} className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--talea-surface-primary)] px-4 font-semibold text-[var(--primary)]">
            <RefreshCw className="h-4 w-4" /> Nochmal versuchen
          </button>
        </div>
      </div>
    );
  }
  if (!page) return <TaleaLoadingState title={ORIGINALS_NAME} subtitle="Die Reihe wird geöffnet." />;

  const { series } = page;
  const readable = page.episodes.filter((card) => card.available || card.locked);
  const seriesCollected = (collection?.items || []).filter((item) => item.seriesSlug === series.slug);

  return (
    <div className="pb-12">
      {/* ── Hero ── */}
      <section className="relative isolate overflow-hidden bg-[#1d140f] text-white">
        {series.coverImageUrl ? (
          <motion.img
            src={series.coverImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[50%_35%]"
            initial={{ scale: reduceMotion ? 1 : 1.06, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 1.4, ease: "easeOut" }}
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(20,12,8,0.95)_0%,rgba(20,12,8,0.6)_40%,rgba(20,12,8,0.15)_75%)]" />
        <div className={cn(taleaPageShellClass, "relative flex min-h-[30rem] flex-col justify-between gap-8 pb-8 pt-4 sm:min-h-[34rem] sm:pb-10")}>
          <button
            type="button"
            onClick={() => navigate(originalsHomePath)}
            className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-black/35 px-4 text-[14px] font-semibold backdrop-blur-md transition hover:bg-black/50 focus-visible:outline-2 focus-visible:outline-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {ORIGINALS_NAME}
          </button>
          <div className="flex max-w-2xl flex-col gap-3">
            <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#ffd9c4]">{ORIGINALS_NAME} · Reihe</span>
            <h1 className="text-[2.4rem] font-bold leading-[1.02] [text-wrap:balance] sm:text-[3.4rem]" style={{ fontFamily: taleaDisplayFont }}>
              {series.title}
            </h1>
            <p className="text-[16px] leading-relaxed text-white/88">{series.logline}</p>
            <p className="flex flex-wrap gap-x-2 gap-y-1 text-[13px] font-medium text-white/75">
              <span>{series.ageBand.replace("-", "–")} Jahre</span>
              <span aria-hidden="true">·</span>
              <span>{series.genre}</span>
              <span aria-hidden="true">·</span>
              <span>{series.releaseLabel} neu</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {series.readNext ? (
                <button
                  type="button"
                  onClick={() => navigate(episodeReaderPath(series.readNext!.episodeId))}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-bold text-[#24160e] transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {series.readNext.label.startsWith("Weiter") ? <BookOpen className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5 fill-current" aria-hidden="true" />}
                  {series.readNext.label}
                </button>
              ) : null}
              <span className="text-[13px] text-white/75">
                {series.finishedCount} von {series.episodeCount} {series.episodeCount === 1 ? "Folge" : "Folgen"} gelesen
                {series.nextRelease ? ` · nächste Folge ${formatRelease(series.nextRelease)}` : ""}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className={cn(taleaPageShellClass, "mt-6")}>
        {/* ── Sections ── */}
        <div role="tablist" aria-label="Bereiche der Reihe" className="inline-flex rounded-full bg-[var(--talea-surface-inset)] p-1">
          {views.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={view === entry.id}
              onClick={() => setView(entry.id)}
              className={cn(
                "h-10 rounded-full px-4 text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--primary)]",
                view === entry.id ? "bg-[var(--talea-surface-primary)] text-[var(--talea-text-primary)] shadow-sm" : "text-[var(--talea-text-secondary)]",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {view === "episodes" ? (
            <EpisodeList cards={page.episodes} seasonTitle={series.seasonTitle} isAdmin={page.isAdmin} onOpen={(card) => navigate(card.locked ? "/settings?section=billing" : episodeReaderPath(card.id))} />
          ) : null}

          {view === "characters" ? <CharacterGallery characters={page.characters} onOpen={setCharacter} /> : null}

          {view === "collection" ? (
            <div>
              <p className="mb-5 max-w-xl text-[15px] text-[var(--talea-text-secondary)]">
                {seriesCollected.length
                  ? `${seriesCollected.length} von ${readable.length} ${series.collectibleName} gesammelt. Zu jeder gelesenen Folge gibt es eine Karte.`
                  : `Lies eine Folge bis zum Ende, dann bekommst du die erste von ${series.plannedCount} ${series.collectibleName}.`}
              </p>
              <div className="grid grid-cols-2 justify-items-center gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {readable.map((card) => {
                  const collected = seriesCollected.find((item) => item.episodeId === card.id);
                  return collected ? (
                    <CollectibleCard key={card.id} collectible={collected.collectible} size="sm" className="w-full max-w-[13rem]" />
                  ) : (
                    <CollectibleCardBack key={card.id} type={series.collectibleType} label={`${episodeLabel(card)}: ${card.title}`} className="w-full max-w-[13rem]" />
                  );
                })}
              </div>
            </div>
          ) : null}

          {view === "studio" && page.isAdmin ? <OriginalsStudioPanel slug={series.slug} onChanged={() => void load()} /> : null}
        </div>
      </div>

      <CharacterDialog character={character} onClose={() => setCharacter(null)} />
    </div>
  );
};

const EpisodeList: React.FC<{ cards: LibraryEpisodeCard[]; seasonTitle?: string; isAdmin: boolean; onOpen: (card: LibraryEpisodeCard) => void }> = ({ cards, seasonTitle, isAdmin, onOpen }) => (
  <section>
    <h2 className="text-[1.25rem] font-bold text-[var(--talea-text-primary)]" style={{ fontFamily: taleaDisplayFont }}>
      Staffel 1{seasonTitle ? `: ${seasonTitle}` : ""}
    </h2>
    <ol className="mt-4 flex flex-col gap-3">
      {cards.map((card) => {
        const upcoming = !card.available && !card.locked;
        return (
          <li key={card.id}>
            <button
              type="button"
              onClick={() => onOpen(card)}
              disabled={upcoming}
              className={cn(taleaSurfaceClass, "group flex w-full gap-3 p-2.5 text-left transition hover:brightness-[0.99] focus-visible:outline-2 focus-visible:outline-[var(--primary)] disabled:cursor-default sm:gap-5 sm:p-3")}
            >
              <span className="relative aspect-[3/2] w-[38%] max-w-[15rem] shrink-0 overflow-hidden rounded-[12px] bg-[var(--talea-surface-inset)]">
                {card.coverImageUrl ? <img src={card.coverImageUrl} alt="" loading="lazy" className={cn("h-full w-full object-cover", (upcoming || card.locked) && "opacity-55 saturate-50")} /> : null}
                {card.available && !card.locked ? (
                  <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[#24160e]"><Play className="h-5 w-5 fill-current" /></span>
                  </span>
                ) : null}
                {card.progress !== "new" ? (
                  <span className="absolute inset-x-0 bottom-0 h-1.5 bg-black/30" aria-hidden="true">
                    <span className="block h-full bg-[var(--primary)]" style={{ width: card.progress === "finished" ? "100%" : `${Math.round(((card.chapterIndex + 0.5) / 3) * 100)}%` }} />
                  </span>
                ) : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-1">
                <span className="flex flex-wrap items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--talea-text-tertiary)]">
                  {episodeLabel(card)}
                  {card.isNew ? <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-[10px] text-white">Neu</span> : null}
                  {isAdmin && card.state ? <span className={cn("rounded-full px-2 py-0.5 text-[10px] normal-case tracking-normal", STATE_TONES[card.state])}>{STATE_LABELS[card.state]}</span> : null}
                </span>
                <span className="text-[16px] font-semibold leading-snug text-[var(--talea-text-primary)] sm:text-[17px]">{card.title}</span>
                <span className="line-clamp-2 text-[14px] leading-snug text-[var(--talea-text-secondary)] max-sm:hidden">{card.summary}</span>
                <span className="flex items-center gap-1.5 text-[13px] text-[var(--talea-text-secondary)]">
                  {card.locked ? (
                    <><Lock className="h-3.5 w-3.5" aria-hidden="true" /> Mit Abo</>
                  ) : upcoming ? (
                    <><Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> {card.publishAt ? `Erscheint ${formatRelease(card.publishAt)}` : "Bald"}</>
                  ) : card.progress === "finished" ? (
                    <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> Gelesen</>
                  ) : (
                    `${card.readingMinutes || "~10"} Min. Lesezeit`
                  )}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  </section>
);

const CharacterGallery: React.FC<{ characters: LibraryCharacter[]; onOpen: (character: LibraryCharacter) => void }> = ({ characters, onOpen }) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
    {characters.map((character) => {
      const phrase = catchphraseOf(character.speechStyle);
      return (
        <button
          key={character.id}
          type="button"
          onClick={() => onOpen(character)}
          className={cn(taleaSurfaceClass, "group flex flex-col text-left transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-[var(--primary)]")}
        >
          <span className="block aspect-square overflow-hidden bg-white">
            {character.imageUrl ? <img src={character.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.04]" /> : null}
          </span>
          <span className="flex flex-col gap-0.5 p-3">
            <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--talea-text-tertiary)]">{ROLE_LABELS[character.role] ?? character.role}</span>
            <span className="text-[16px] font-bold text-[var(--talea-text-primary)]" style={{ fontFamily: taleaDisplayFont }}>{character.name}</span>
            {phrase ? <span className="line-clamp-2 text-[13px] italic text-[var(--talea-text-secondary)]">„{phrase}“</span> : null}
          </span>
        </button>
      );
    })}
  </div>
);

const CharacterDialog: React.FC<{ character: LibraryCharacter | null; onClose: () => void }> = ({ character, onClose }) => (
  <DialogPrimitive.Root open={Boolean(character)} onOpenChange={(open) => !open && onClose()}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[2000] bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[2001] max-h-[90vh] w-[min(92vw,34rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[24px] bg-[var(--talea-surface-primary)] shadow-2xl focus:outline-none">
        {character ? (
          <>
            <div className="aspect-[4/3] bg-white">
              {character.imageUrl ? <img src={character.imageUrl} alt="" className="h-full w-full object-contain" /> : null}
            </div>
            <div className="flex flex-col gap-3 p-6">
              <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--talea-text-tertiary)]">
                {ROLE_LABELS[character.role] ?? character.role}{character.ageYears ? ` · ${character.ageYears} Jahre` : ""}
              </span>
              <DialogPrimitive.Title className="text-[1.75rem] font-bold leading-tight text-[var(--talea-text-primary)]" style={{ fontFamily: taleaDisplayFont }}>
                {character.name}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-[15px] leading-relaxed text-[var(--talea-text-primary)]">{character.personality}</DialogPrimitive.Description>
              <p className="text-[15px] leading-relaxed text-[var(--talea-text-secondary)]">{character.speechStyle}</p>
              <DialogPrimitive.Close className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-[var(--talea-surface-inset)] px-5 text-[15px] font-semibold text-[var(--primary)]">
                Schließen
              </DialogPrimitive.Close>
            </div>
          </>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
);

export default OriginalsSeriesScreen;
