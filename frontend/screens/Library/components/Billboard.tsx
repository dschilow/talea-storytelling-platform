import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BookOpen, Info, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { taleaDisplayFont } from "@/components/talea/TaleaPastelPrimitives";
import { formatRelease, ORIGINALS_NAME, type LibrarySeriesCard } from "../libraryShared";

const ROTATE_MS = 9000;

/**
 * The top of Talea Originals: one series at a time as a full-bleed picture,
 * like the billboard of a streaming service. The picture carries the mood; the
 * scrim only keeps the words readable.
 */
export const Billboard: React.FC<{
  series: LibrarySeriesCard[];
  onRead: (series: LibrarySeriesCard) => void;
  onOpenSeries: (series: LibrarySeriesCard) => void;
}> = ({ series, onRead, onOpenSeries }) => {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = series[index % Math.max(1, series.length)];

  const go = useCallback((next: number) => setIndex((next + series.length) % series.length), [series.length]);

  useEffect(() => {
    if (series.length < 2 || paused || reduceMotion) return;
    const timer = window.setTimeout(() => go(index + 1), ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [index, paused, reduceMotion, series.length, go]);

  if (!current) return null;
  const meta = [`${current.ageBand.replace("-", "–")} Jahre`, current.genre.split(",")[0], current.releaseLabel].filter(Boolean);

  return (
    <section
      aria-roledescription="Karussell"
      aria-label={`${ORIGINALS_NAME}: Reihen`}
      className="relative isolate overflow-hidden rounded-[26px] bg-[#1d140f] shadow-[0_24px_60px_-28px_rgba(40,20,10,0.6)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative aspect-[4/5] w-full sm:aspect-[16/10] lg:aspect-[21/9]">
        <AnimatePresence initial={false} mode="sync">
          <motion.div
            key={current.id}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.9, ease: "easeOut" }}
          >
            {current.coverImageUrl ? (
              <motion.img
                src={current.coverImageUrl}
                alt=""
                className="h-full w-full object-cover object-[50%_35%]"
                initial={{ scale: reduceMotion ? 1 : 1.0 }}
                animate={{ scale: reduceMotion ? 1 : 1.07 }}
                transition={{ duration: ROTATE_MS / 1000 + 1, ease: "linear" }}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
        {/* Scrim: dark only where the words are. */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(20,12,8,0.92)_0%,rgba(20,12,8,0.55)_38%,rgba(20,12,8,0)_68%)] lg:bg-[linear-gradient(to_right,rgba(20,12,8,0.88)_0%,rgba(20,12,8,0.5)_42%,rgba(20,12,8,0)_70%)]" />

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-5 pb-6 text-white sm:p-8 lg:inset-y-0 lg:right-auto lg:w-[52%] lg:justify-center lg:p-12">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
              transition={{ duration: reduceMotion ? 0 : 0.45, ease: [0.2, 0.65, 0.3, 0.9] }}
              className="flex flex-col gap-3"
            >
              <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#ffd9c4]">{ORIGINALS_NAME} · Reihe</span>
              <h2 className="text-[2.2rem] font-bold leading-[1.02] [text-wrap:balance] sm:text-[2.8rem] lg:text-[3.4rem]" style={{ fontFamily: taleaDisplayFont }}>
                {current.title}
              </h2>
              <p className="line-clamp-3 max-w-xl text-[15px] leading-relaxed text-white/88 sm:text-[16px]">{current.logline}</p>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium text-white/75">
                {meta.map((part, partIndex) => (
                  <React.Fragment key={part}>
                    {partIndex > 0 ? <span aria-hidden="true">·</span> : null}
                    <span>{part}</span>
                  </React.Fragment>
                ))}
              </p>
              {current.nextRelease ? (
                <p className="text-[13px] font-semibold text-[#ffd9c4]">Nächste Folge: {formatRelease(current.nextRelease)}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2.5">
                {current.readNext ? (
                  <button
                    type="button"
                    onClick={() => onRead(current)}
                    className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-bold text-[#24160e] shadow-sm transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    {current.readNext.label.startsWith("Weiter") ? <BookOpen className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5 fill-current" aria-hidden="true" />}
                    {current.readNext.label}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onOpenSeries(current)}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white/18 px-5 text-[15px] font-semibold text-white backdrop-blur-md transition hover:bg-white/26 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <Info className="h-5 w-5" aria-hidden="true" />
                  Zur Reihe
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {series.length > 1 ? (
          <div className="absolute right-4 top-4 flex gap-1.5 sm:right-6 sm:top-6" role="tablist" aria-label="Reihe wählen">
            {series.map((entry, entryIndex) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={entryIndex === index}
                aria-label={entry.title}
                onClick={() => go(entryIndex)}
                className="group flex h-8 items-center px-1 focus-visible:outline-2 focus-visible:outline-white"
              >
                <span className={cn("block h-1.5 rounded-full bg-white/45 transition-all duration-300 group-hover:bg-white/80", entryIndex === index ? "w-7 bg-white" : "w-3")} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
};
