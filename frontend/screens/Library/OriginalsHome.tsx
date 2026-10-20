import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, RefreshCw } from "lucide-react";
import { useBackend } from "@/hooks/useBackend";
import { useOptionalChildProfiles } from "@/contexts/ChildProfilesContext";
import { TaleaLoadingState, taleaDisplayFont, taleaInsetSurfaceClass } from "@/components/talea/TaleaPastelPrimitives";
import { cn } from "@/lib/utils";
import { Billboard } from "./components/Billboard";
import { EpisodeTile, Rail } from "./components/Rail";
import { CollectibleCard } from "./components/CollectibleCard";
import {
  episodeReaderPath,
  errorMessage,
  formatRelease,
  seriesPath,
  type LibraryCollectionResponse,
  type LibraryEpisodeCard,
  type LibrarySeriesResponse,
  type LibraryShelvesResponse,
} from "./libraryShared";

/**
 * Talea Originals: the pre-produced series every child can read. Billboard on
 * top, then rows — continue, new this week, one row per series — and the
 * collection as the reward that pulls children back next Friday.
 */
const OriginalsHome: React.FC = () => {
  const backend = useBackend();
  const navigate = useNavigate();
  const profileId = useOptionalChildProfiles()?.activeProfileId;
  const [shelves, setShelves] = useState<LibraryShelvesResponse | null>(null);
  const [seriesPages, setSeriesPages] = useState<Record<string, LibrarySeriesResponse>>({});
  const [collection, setCollection] = useState<LibraryCollectionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await backend.story.libraryShelves({ profileId: profileId || undefined });
      setShelves(next);
      const [pages, collected] = await Promise.all([
        Promise.all(next.series.map((series) => backend.story.librarySeries({ slug: series.slug, profileId: profileId || undefined }))),
        backend.story.libraryCollection({ profileId: profileId || undefined }),
      ]);
      setSeriesPages(Object.fromEntries(pages.map((page) => [page.series.slug, page])));
      setCollection(collected);
    } catch (loadError) {
      setError(errorMessage(loadError, "Die Originals konnten nicht geladen werden."));
    } finally {
      setLoading(false);
    }
  }, [backend, profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEpisode = (card: LibraryEpisodeCard, slug: string) => {
    if (card.locked) {
      navigate("/settings?section=billing");
      return;
    }
    navigate(card.available ? episodeReaderPath(card.id) : seriesPath(slug));
  };

  if (loading && !shelves) {
    return <TaleaLoadingState title="Talea Originals" subtitle="Die Reihen werden aus dem Regal geholt." />;
  }

  if (error || !shelves) {
    return (
      <div className={cn(taleaInsetSurfaceClass, "flex flex-col items-center gap-4 p-8 text-center")}>
        <p className="text-[15px] text-[var(--talea-text-secondary)]">{error || "Keine Daten."}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--talea-surface-primary)] px-4 text-[15px] font-semibold text-[var(--primary)] shadow-sm"
        >
          <RefreshCw className="h-4 w-4" /> Nochmal versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <Billboard
        series={shelves.series}
        onRead={(series) => series.readNext && navigate(episodeReaderPath(series.readNext.episodeId))}
        onOpenSeries={(series) => navigate(seriesPath(series.slug))}
      />

      {shelves.continueReading.length ? (
        <Rail title="Weiterlesen" subtitle="Da, wo ihr aufgehört habt.">
          {shelves.continueReading.map((entry) => (
            <EpisodeTile key={entry.episode.id} card={entry.episode} seriesTitle={entry.seriesTitle} wide onOpen={() => openEpisode(entry.episode, entry.seriesSlug)} />
          ))}
        </Rail>
      ) : null}

      {shelves.newEpisodes.length ? (
        <Rail title="Neu diese Woche" subtitle="Jeden Freitag um 15 Uhr kommen neue Folgen.">
          {shelves.newEpisodes.map((entry) => (
            <EpisodeTile key={entry.episode.id} card={entry.episode} seriesTitle={entry.seriesTitle} wide onOpen={() => openEpisode(entry.episode, entry.seriesSlug)} />
          ))}
        </Rail>
      ) : null}

      {shelves.series.map((series) => {
        const page = seriesPages[series.slug];
        const episodes = (page?.episodes || []).filter((card) => card.available || card.locked || card.publishAt);
        return (
          <Rail
            key={series.id}
            title={series.title}
            subtitle={[series.seasonTitle ? `Staffel 1: ${series.seasonTitle}` : null, series.nextRelease ? `Nächste Folge ${formatRelease(series.nextRelease)}` : series.releaseLabel].filter(Boolean).join(" · ")}
            actionLabel="Alle Folgen"
            onAction={() => navigate(seriesPath(series.slug))}
          >
            {episodes.map((card) => (
              <EpisodeTile key={card.id} card={card} onOpen={() => openEpisode(card, series.slug)} />
            ))}
            <ComingSoonTile series={series} shown={episodes.length} onOpen={() => navigate(seriesPath(series.slug))} />
          </Rail>
        );
      })}

      {collection ? <CollectionTeaser collection={collection} /> : null}
    </div>
  );
};

/** The last tile of a series row: what is still to come, so the row never ends in nothing. */
const ComingSoonTile: React.FC<{ series: LibraryShelvesResponse["series"][number]; shown: number; onOpen: () => void }> = ({ series, shown, onOpen }) => {
  const remaining = Math.max(0, series.plannedCount - shown);
  if (!remaining) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex aspect-[3/2] w-[64vw] max-w-[17.5rem] shrink-0 snap-start flex-col items-start justify-end gap-1 rounded-[16px] border-2 border-dashed border-[var(--talea-border-light)] p-4 text-left transition hover:bg-[var(--talea-surface-inset)] focus-visible:outline-2 focus-visible:outline-[var(--primary)] sm:w-[17.5rem]"
    >
      <span className="text-[2rem] font-bold leading-none text-[var(--talea-text-primary)]" style={{ fontFamily: taleaDisplayFont }}>
        +{remaining}
      </span>
      <span className="text-[14px] font-semibold text-[var(--talea-text-primary)]">{remaining === 1 ? "weitere Folge" : "weitere Folgen"} in dieser Staffel</span>
      <span className="text-[13px] text-[var(--talea-text-secondary)]">{series.releaseLabel}</span>
    </button>
  );
};

const CollectionTeaser: React.FC<{ collection: LibraryCollectionResponse }> = ({ collection }) => {
  const navigate = useNavigate();
  const recent = [...collection.items].sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt)).slice(0, 6);
  return (
    <section className={cn(taleaInsetSurfaceClass, "overflow-hidden p-5 sm:p-7")}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--primary)]">Deine Sammlung</span>
          <h2 className="mt-1 text-[1.5rem] font-bold leading-tight text-[var(--talea-text-primary)]" style={{ fontFamily: taleaDisplayFont }}>
            {collection.items.length ? `${collection.items.length} von ${collection.total} Karten gesammelt` : "Zu jeder Folge gibt es eine Sammelkarte"}
          </h2>
          <p className="mt-1.5 max-w-md text-[15px] leading-snug text-[var(--talea-text-secondary)]">
            Flunker-Karten aus dem Lindenweg 7 und Monster-Steckbriefe aus Oma Hildes Ordner. Wer eine Folge zu Ende liest, bekommt die Karte.
          </p>
          {collection.items.length ? (
            <button
              type="button"
              onClick={() => navigate(seriesPath(recent[0].seriesSlug) + "?view=collection")}
              className="mt-4 inline-flex h-11 items-center gap-1 rounded-full bg-[var(--talea-surface-primary)] px-4 text-[15px] font-semibold text-[var(--primary)] shadow-sm"
            >
              Sammlung ansehen <ChevronRight className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {recent.length ? (
          <div className="relative flex h-[15rem] shrink-0 items-center justify-center sm:w-[19rem]">
            {recent.slice(0, 3).map((item, index) => (
              <div
                key={item.episodeId}
                className="absolute"
                style={{ transform: `translateX(${(index - (Math.min(3, recent.length) - 1) / 2) * 64}px) rotate(${(index - 1) * 7}deg)`, zIndex: index }}
              >
                <CollectibleCard collectible={item.collectible} size="sm" />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default OriginalsHome;
