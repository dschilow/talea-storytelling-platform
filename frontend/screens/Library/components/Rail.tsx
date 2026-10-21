import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Clock3, Headphones, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { taleaDisplayFont } from "@/components/talea/TaleaPastelPrimitives";
import { episodeLabel, formatRelease, type LibraryEpisodeCard } from "../libraryShared";

/** A horizontal shelf like a streaming row: swipe on phones, arrow buttons on wider screens. */
export const Rail: React.FC<{
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}> = ({ title, subtitle, actionLabel, onAction, children }) => {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    setEdges({ start: element.scrollLeft < 8, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    update();
    const element = scroller.current;
    if (!element) return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [update]);

  const scrollBy = (direction: 1 | -1) => {
    const element = scroller.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-4 px-1">
        <div className="min-w-0">
          <h2 className="truncate text-[1.25rem] font-bold leading-tight text-[var(--talea-text-primary)] md:text-[1.4rem]" style={{ fontFamily: taleaDisplayFont }}>
            {title}
          </h2>
          {subtitle ? <p className="mt-0.5 text-[14px] text-[var(--talea-text-secondary)]">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex h-10 items-center gap-0.5 rounded-full px-3 text-[14px] font-semibold text-[var(--primary)] hover:bg-[var(--talea-surface-inset)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
            >
              {actionLabel}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          <div className="hidden gap-1 md:flex">
            {([-1, 1] as const).map((direction) => (
              <button
                key={direction}
                type="button"
                onClick={() => scrollBy(direction)}
                disabled={direction === -1 ? edges.start : edges.end}
                aria-label={direction === -1 ? "Zurückblättern" : "Weiterblättern"}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--talea-surface-inset)] text-[var(--talea-text-primary)] transition-opacity hover:brightness-95 disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
              >
                {direction === -1 ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div
        ref={scroller}
        onScroll={update}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] md:-mx-6 md:scroll-px-6 md:px-6 md:gap-4 lg:mx-0 lg:scroll-px-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </section>
  );
};

/** One episode as a landscape tile: picture first, title under it, state in the picture's corners. */
export const EpisodeTile: React.FC<{
  card: LibraryEpisodeCard;
  seriesTitle?: string;
  onOpen: () => void;
  wide?: boolean;
}> = ({ card, seriesTitle, onOpen, wide }) => {
  const upcoming = !card.available && !card.locked;
  const progressPct = card.progress === "finished" ? 100 : card.progress === "started" ? Math.max(12, Math.round(((card.chapterIndex + 0.5) / 3) * 100)) : 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={upcoming}
      className={cn(
        "group shrink-0 snap-start text-left focus-visible:outline-none",
        wide ? "w-[78vw] max-w-[22rem] sm:w-[22rem]" : "w-[64vw] max-w-[17.5rem] sm:w-[17.5rem]",
      )}
      aria-label={`${episodeLabel(card)}: ${card.title}${card.locked ? " (mit Abo)" : upcoming ? ` (erscheint ${formatRelease(card.publishAt)})` : ""}`}
    >
      <div className="relative aspect-[3/2] overflow-hidden rounded-[16px] bg-[var(--talea-surface-inset)] ring-1 ring-black/5 transition-transform duration-300 group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-[var(--primary)]">
        {card.coverImageUrl ? (
          <img
            src={card.coverImageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className={cn("h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]", (card.locked || upcoming) && "opacity-55 saturate-50")}
          />
        ) : null}
        <span className="absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
          {episodeLabel(card)}
        </span>
        {card.isNew ? (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-[var(--primary)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">Neu</span>
        ) : null}
        {card.locked ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-[12px] font-semibold text-white">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Mit Abo
            </span>
          </span>
        ) : upcoming ? (
          <span className="absolute inset-x-2.5 bottom-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-[12px] font-semibold text-white">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> {formatRelease(card.publishAt)}
          </span>
        ) : null}
        {card.hasAudio && !card.locked && !upcoming ? (
          <span className="absolute bottom-3 right-2.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            <Headphones className="h-3.5 w-3.5" aria-hidden="true" /> Hörspiel
          </span>
        ) : null}
        {progressPct > 0 ? (
          <span className="absolute inset-x-0 bottom-0 h-1.5 bg-black/30" aria-hidden="true">
            <span className="block h-full bg-[var(--primary)]" style={{ width: `${progressPct}%` }} />
          </span>
        ) : null}
      </div>
      <div className="mt-2 px-0.5">
        {seriesTitle ? <p className="truncate text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--talea-text-tertiary)]">{seriesTitle}</p> : null}
        <p className="truncate text-[15px] font-semibold text-[var(--talea-text-primary)]">{card.title}</p>
        <p className="text-[13px] text-[var(--talea-text-secondary)]">
          {card.progress === "finished" ? "Gelesen" : card.progress === "started" ? `Weiter bei Kapitel ${card.chapterIndex + 1}` : `${card.readingMinutes || "~10"} Min. Lesezeit`}
        </p>
      </div>
    </button>
  );
};
