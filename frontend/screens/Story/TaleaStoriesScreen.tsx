import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import {
  BookOpen,
  Clock3,
  Download,
  Grid3X3,
  LayoutList,
  Plus,
  Search,
  Sparkles,
  Trash2,
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
import { cn } from "@/lib/utils";

const palette = {
  page: "#f2efe8",
};

const headingFont = '"Fraunces", "Times New Roman", serif';
const bodyFont = '"Manrope", "Segoe UI", sans-serif';

type ViewMode = "grid" | "list";
type StatusFilter = "all" | "complete" | "generating" | "error";
type SortMode = "newest" | "oldest" | "title";

const statusMeta: Record<Story["status"], { label: string; className: string }> = {
  complete: {
    label: "Fertig",
    className: "bg-[#deece8] text-[#1f6f67] border-[#bedcd5]",
  },
  generating: {
    label: "In Arbeit",
    className: "bg-[#f5e9d8] text-[#946437] border-[#e8d2b5]",
  },
  error: {
    label: "Fehler",
    className: "bg-[#f5dddd] text-[#a34a4a] border-[#e8c1c1]",
  },
};

const filterLabels: Record<StatusFilter, string> = {
  all: "Alle",
  complete: "Fertig",
  generating: "In Arbeit",
  error: "Fehler",
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

const StoriesBackground: React.FC = () => (
  <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
    <div
      className="absolute inset-0"
      style={{
        background: `radial-gradient(1080px 540px at 100% 0%, #e8dfd2 0%, transparent 57%),
                     radial-gradient(920px 450px at 0% 16%, #dce9e7 0%, transparent 62%),
                     ${palette.page}`,
      }}
    />
  </div>
);

const StoryStatusChip: React.FC<{ status: Story["status"] }> = ({ status }) => (
  <span
    className={cn(
      "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
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
  onDownloadPdf: (event: React.MouseEvent<HTMLButtonElement>) => void;
  isDownloading: boolean;
}> = ({ story, index, onRead, onDelete, onDownloadPdf, isDownloading }) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.025 }}
      whileHover={reduceMotion ? undefined : { y: -4 }}
      whileTap={reduceMotion ? undefined : { scale: 0.995 }}
      onClick={onRead}
      className="group cursor-pointer"
    >
      <Card className="overflow-hidden border-[#d7d0c3] bg-[#fbfaf7] shadow-[0_12px_30px_rgba(21,32,44,0.08)] transition-shadow group-hover:shadow-[0_18px_44px_rgba(21,32,44,0.12)]">
        <div className="relative h-56 overflow-hidden">
          {story.coverImageUrl ? (
            <img
              src={story.coverImageUrl}
              alt={story.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#ebe5d9] text-[#7b7468]">
              <BookOpen className="h-10 w-10" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/15 to-transparent" />

          <div className="absolute left-3 top-3">
            <StoryStatusChip status={story.status} />
          </div>

          <div className="absolute right-3 top-3 flex items-center gap-2">
            {story.status === "complete" && (
              <button
                type="button"
                onClick={onDownloadPdf}
                className="rounded-lg border border-white/40 bg-black/45 p-1.5 text-white transition-colors hover:bg-black/70"
                aria-label="PDF herunterladen"
              >
                {isDownloading ? (
                  <Clock3 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="rounded-lg border border-white/40 bg-black/45 p-1.5 text-white transition-colors hover:bg-[#7f2d2d]"
              aria-label="Story loeschen"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <CardContent className="space-y-3 p-5">
          <div className="space-y-1">
            <h3
              className="line-clamp-2 text-xl leading-tight text-[#17212d]"
              style={{ fontFamily: headingFont }}
            >
              {story.title}
            </h3>
            <p className="line-clamp-2 text-sm leading-relaxed text-[#607083]">
              {getStoryPreviewText(story)}
            </p>
          </div>

          <StoryParticipantsDialog story={story} maxVisible={5} />

          <div className="flex items-center justify-between text-xs text-[#627180]">
            <span>{formatDate(story.createdAt)}</span>
            <span className="font-semibold text-[#1f6f67]">Oeffnen</span>
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
  onDownloadPdf: (event: React.MouseEvent<HTMLButtonElement>) => void;
  isDownloading: boolean;
}> = ({ story, index, onRead, onDelete, onDownloadPdf, isDownloading }) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, x: -12 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.02 }}
      onClick={onRead}
      className="group cursor-pointer"
    >
      <Card className="overflow-hidden border-[#d7d0c3] bg-[#fbfaf7] shadow-[0_10px_26px_rgba(21,32,44,0.06)] transition-shadow group-hover:shadow-[0_14px_34px_rgba(21,32,44,0.12)]">
        <div className="flex flex-col md:flex-row">
          <div className="relative h-44 w-full md:h-auto md:w-56">
            {story.coverImageUrl ? (
              <img src={story.coverImageUrl} alt={story.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#ebe5d9] text-[#7b7468]">
                <BookOpen className="h-9 w-9" />
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <h3
                className="line-clamp-2 text-xl leading-tight text-[#17212d]"
                style={{ fontFamily: headingFont }}
              >
                {story.title}
              </h3>

              <div className="flex items-center gap-2">
                <StoryStatusChip status={story.status} />
                {story.status === "complete" && (
                  <button
                    type="button"
                    onClick={onDownloadPdf}
                    className="rounded-lg border border-[#e3d8cb] p-1.5 text-[#5f6d7d] transition-colors hover:bg-[#f2ece2]"
                    aria-label="PDF herunterladen"
                  >
                    {isDownloading ? (
                      <Clock3 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete();
                  }}
                  className="rounded-lg border border-[#e3d8cb] p-1.5 text-[#a34a4a] transition-colors hover:bg-[#f5e7e7]"
                  aria-label="Story loeschen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#607083]">
              {getStoryPreviewText(story)}
            </p>

            <StoryParticipantsDialog story={story} maxVisible={6} className="mt-4" />

            <div className="mt-4 flex items-center justify-between text-xs text-[#627180]">
              <span>{formatDate(story.createdAt)}</span>
              <span className="font-semibold text-[#1f6f67]">Oeffnen</span>
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
  <Card className="border-[#d7d0c3] bg-[#fbfaf7] text-center shadow-[0_12px_30px_rgba(21,32,44,0.06)]">
    <CardContent className="px-8 py-14">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#deece8] text-[#1f6f67]">
        <BookOpen className="h-7 w-7" />
      </div>
      <h2 className="text-3xl text-[#17212d]" style={{ fontFamily: headingFont }}>
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#607083]">{description}</p>
      <button
        type="button"
        onClick={onPrimary}
        className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#1f6f67] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        {primaryLabel}
      </button>
    </CardContent>
  </Card>
);

const LoadingState: React.FC = () => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    {Array.from({ length: 6 }).map((_, index) => (
      <div
        key={index}
        className="h-72 animate-pulse rounded-2xl border border-[#ddd5c8] bg-[#ece7de]"
      />
    ))}
  </div>
);

const TaleaStoriesScreen: React.FC = () => {
  const backend = useBackend();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isLoaded: authLoaded, isSignedIn } = useUser();
  const reduceMotion = useReducedMotion();

  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [downloadingStoryId, setDownloadingStoryId] = useState<string | null>(null);

  const observerTarget = useRef<HTMLDivElement>(null);

  const loadStories = async () => {
    try {
      setLoading(true);
      const response = await backend.story.list({ limit: 12, offset: 0 });
      setStories((response.stories as Story[]) || []);
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
      setStories((prev) => [...prev, ...((response.stories as Story[]) || [])]);
      setHasMore(response.hasMore || false);
    } catch (error) {
      console.error("Error loading more stories:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [backend, hasMore, loadingMore, stories.length]);

  useEffect(() => {
    if (authLoaded && isSignedIn) {
      loadStories();
    } else if (authLoaded && !isSignedIn) {
      setLoading(false);
    }
  }, [authLoaded, isSignedIn]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore && !loading) {
          loadMoreStories();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, loadMoreStories]);

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

    if (!isPDFExportSupported() || storyStatus !== "complete") return;

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

  const filteredStories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const result = stories.filter((story) => {
      const statusMatches = statusFilter === "all" || story.status === statusFilter;
      if (!statusMatches) return false;

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
  }, [stories, searchQuery, statusFilter, sortMode]);

  const completeCount = stories.filter((story) => story.status === "complete").length;
  const generatingCount = stories.filter((story) => story.status === "generating").length;
  const hasActiveFilters = searchQuery.trim().length > 0 || statusFilter !== "all";

  return (
    <div className="relative min-h-screen pb-24" style={{ fontFamily: bodyFont }}>
      <StoriesBackground />

      <SignedOut>
        <div className="flex min-h-[72vh] items-center justify-center px-6">
          <Card className="w-full max-w-xl border-[#d7d0c3] bg-[#fbfaf7] text-center shadow-[0_12px_30px_rgba(21,32,44,0.08)]">
            <CardHeader>
              <CardTitle className="text-3xl text-[#17212d]" style={{ fontFamily: headingFont }}>
                Zugriff erforderlich
              </CardTitle>
              <CardDescription className="text-sm text-[#607083]">
                Melde dich an, um deine Story-Bibliothek zu sehen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <button
                type="button"
                onClick={() => navigate("/auth")}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1f6f67] px-4 py-2 text-sm font-semibold text-white"
              >
                Anmelden
              </button>
            </CardContent>
          </Card>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="space-y-6 pt-4">
          <motion.section
            initial={reduceMotion ? false : { opacity: 0, y: -12 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          >
            <Card className="border-[#d7d0c3] bg-[#fbfaf7]/95 shadow-[0_16px_36px_rgba(21,32,44,0.08)] backdrop-blur">
              <CardHeader className="gap-5 pb-4 md:flex-row md:items-end md:justify-between">
                <div className="space-y-2">
                  <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#1f6f67]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Story Library
                  </p>
                  <CardTitle
                    className="text-4xl leading-tight text-[#17212d] md:text-5xl"
                    style={{ fontFamily: headingFont }}
                  >
                    Geschichten mit klarer Struktur
                  </CardTitle>
                  <CardDescription className="max-w-2xl text-sm leading-relaxed text-[#607083]">
                    Uebersichtlich filtern, Teilnehmer vergroessern und jede Story direkt oeffnen oder als PDF exportieren.
                  </CardDescription>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/story")}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1f6f67] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Neue Story
                </button>
              </CardHeader>

              <CardContent className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
                <div className="rounded-xl border border-[#e0d8cc] bg-[#f7f4ee] p-3">
                  <p className="text-xs uppercase tracking-wide text-[#647486]">Gesamt</p>
                  <p className="mt-1 text-2xl font-semibold text-[#17212d]">{total}</p>
                </div>
                <div className="rounded-xl border border-[#e0d8cc] bg-[#f7f4ee] p-3">
                  <p className="text-xs uppercase tracking-wide text-[#647486]">Fertig</p>
                  <p className="mt-1 text-2xl font-semibold text-[#17212d]">{completeCount}</p>
                </div>
                <div className="rounded-xl border border-[#e0d8cc] bg-[#f7f4ee] p-3">
                  <p className="text-xs uppercase tracking-wide text-[#647486]">In Arbeit</p>
                  <p className="mt-1 text-2xl font-semibold text-[#17212d]">{generatingCount}</p>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          <Card className="border-[#d7d0c3] bg-[#fbfaf7] shadow-[0_12px_30px_rgba(21,32,44,0.06)]">
            <CardContent className="space-y-4 p-4 md:p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <label className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#607083]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Nach Titel oder Inhalt suchen..."
                    className="h-11 w-full rounded-xl border border-[#d7d0c3] bg-[#f6f2ea] py-2 pl-10 pr-3 text-sm text-[#17212d] outline-none transition-colors focus:border-[#1f6f67]"
                  />
                </label>

                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                  className="h-11 rounded-xl border border-[#d7d0c3] bg-[#f6f2ea] px-3 text-sm font-medium text-[#17212d] outline-none transition-colors focus:border-[#1f6f67]"
                  aria-label="Sortierung"
                >
                  <option value="newest">Neueste zuerst</option>
                  <option value="oldest">Aelteste zuerst</option>
                  <option value="title">Titel A-Z</option>
                </select>

                <div className="inline-flex rounded-xl border border-[#d7d0c3] bg-[#f6f2ea] p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "rounded-lg p-2",
                      viewMode === "grid" ? "bg-[#1f6f67] text-white" : "text-[#607083]"
                    )}
                    aria-label="Rasteransicht"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "rounded-lg p-2",
                      viewMode === "list" ? "bg-[#1f6f67] text-white" : "text-[#607083]"
                    )}
                    aria-label="Listenansicht"
                  >
                    <LayoutList className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(Object.keys(filterLabels) as StatusFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStatusFilter(filter)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
                      statusFilter === filter
                        ? "border-[#1f6f67] bg-[#deece8] text-[#1f6f67]"
                        : "border-[#d7d0c3] bg-[#f6f2ea] text-[#607083] hover:bg-[#ece7de]"
                    )}
                  >
                    {filterLabels[filter]}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <section>
            {loading ? (
              <LoadingState />
            ) : filteredStories.length === 0 ? (
              <EmptyState
                onPrimary={() => {
                  if (hasActiveFilters) {
                    setSearchQuery("");
                    setStatusFilter("all");
                    return;
                  }
                  navigate("/story");
                }}
                primaryLabel={hasActiveFilters ? "Filter zuruecksetzen" : "Erste Story erstellen"}
                title={hasActiveFilters ? "Keine Treffer gefunden" : "Noch keine Geschichten"}
                description={
                  hasActiveFilters
                    ? "Passe Suchbegriff oder Filter an, um passende Stories anzuzeigen."
                    : "Starte mit deiner ersten Story. Teilnehmer in den Karten bleiben anklickbar und vergroesserbar."
                }
              />
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {filteredStories.map((story, index) => (
                  <GridStoryCard
                    key={story.id}
                    story={story}
                    index={index}
                    onRead={() => navigate(`/story-reader/${story.id}`)}
                    onDelete={() => handleDeleteStory(story.id, story.title)}
                    onDownloadPdf={(event) => handleDownloadPdf(story.id, story.status, event)}
                    isDownloading={downloadingStoryId === story.id}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredStories.map((story, index) => (
                  <ListStoryRow
                    key={story.id}
                    story={story}
                    index={index}
                    onRead={() => navigate(`/story-reader/${story.id}`)}
                    onDelete={() => handleDeleteStory(story.id, story.title)}
                    onDownloadPdf={(event) => handleDownloadPdf(story.id, story.status, event)}
                    isDownloading={downloadingStoryId === story.id}
                  />
                ))}
              </div>
            )}

            {hasMore && !loading && (
              <div ref={observerTarget} className="mt-6 flex justify-center">
                {loadingMore && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#d7d0c3] bg-[#fbfaf7] px-4 py-2 text-xs font-semibold text-[#607083]">
                    <Clock3 className="h-3.5 w-3.5 animate-spin" />
                    Weitere Stories werden geladen...
                  </div>
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
