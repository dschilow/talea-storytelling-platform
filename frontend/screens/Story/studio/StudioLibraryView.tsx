import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Clapperboard, Film, Layers3, Plus, Sparkles, Star, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import type { StudioSeries } from "@/types/studio";

import { episodeStatusLabel, formatStudioDate, headingFont, type StudioPalette } from "./studioPalette";

export type StudioSeriesOverview = {
  episodeCount: number;
  publishedCount: number;
  characterCount: number;
  latestEpisodeTitle?: string;
  latestEpisodeStatus?: string;
  coverImageUrl?: string;
};

interface StudioLibraryViewProps {
  palette: StudioPalette;
  series: StudioSeries[];
  overview: Record<string, StudioSeriesOverview>;
  loading?: boolean;
  onSelectSeries: (id: string) => void;
  onCreateSeries: () => void;
}

const StudioLibraryView: React.FC<StudioLibraryViewProps> = ({
  palette,
  series,
  overview,
  loading,
  onSelectSeries,
  onCreateSeries,
}) => {
  const reduceMotion = useReducedMotion();

  const totalEpisodes = series.reduce((sum, s) => sum + (overview[s.id]?.episodeCount || 0), 0);
  const totalPublished = series.reduce((sum, s) => sum + (overview[s.id]?.publishedCount || 0), 0);
  const totalInProgress = totalEpisodes - totalPublished;

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-3xl">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 20% 0%, rgba(167,139,214,0.35) 0%, transparent 50%), radial-gradient(circle at 90% 100%, rgba(108,174,157,0.32) 0%, transparent 55%), linear-gradient(135deg, #1a1530 0%, #0d1f2c 100%)",
          }}
        />
        <div className="relative px-6 py-10 md:px-10 md:py-14">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/85 backdrop-blur">
                <Clapperboard className="h-3.5 w-3.5" />
                Talea Studios
              </div>
              <h1
                className="text-5xl leading-[1.05] text-white md:text-6xl"
                style={{ fontFamily: headingFont }}
              >
                Dein eigenes Story-Universum.
              </h1>
              <p className="max-w-2xl text-base text-white/70">
                Plane Serien wie eine Marvel-Phase: wiederkehrende Charaktere, aufeinander
                aufbauende Folgen, kuratierte Drops. Jede Folge ein Cliffhanger.
              </p>
            </div>
            <button
              type="button"
              onClick={onCreateSeries}
              className="inline-flex h-12 items-center gap-2 self-start rounded-2xl border border-white/30 bg-white/95 px-6 text-sm font-bold uppercase tracking-wider text-[#1a1530] shadow-[0_10px_40px_rgba(167,139,214,0.4)] transition hover:bg-white"
            >
              <Plus className="h-4 w-4" />
              Neue Serie starten
            </button>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatBadge icon={<Film className="h-4 w-4" />} label="Aktive Serien" value={series.length} />
            <StatBadge icon={<Layers3 className="h-4 w-4" />} label="Folgen gesamt" value={totalEpisodes} />
            <StatBadge icon={<Star className="h-4 w-4" />} label="Veröffentlicht" value={totalPublished} accent="success" />
            <StatBadge icon={<TrendingUp className="h-4 w-4" />} label="In Produktion" value={totalInProgress} accent="progress" />
          </div>
        </div>
      </header>

      {series.length === 0 ? (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed p-12 text-center",
            palette.border
          )}
        >
          <div
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-full",
              palette.cardElevated,
              palette.text
            )}
          >
            <Sparkles className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className={cn("text-2xl", palette.text)} style={{ fontFamily: headingFont }}>
              Bereit für deine erste Serie?
            </h3>
            <p className={cn("max-w-md text-sm", palette.textMuted)}>
              Erstelle eine Serie, lege ihren Canon fest und füge wiederkehrende Charaktere hinzu.
              Danach generierst du Folgen, die aufeinander aufbauen.
            </p>
          </div>
          <button
            type="button"
            onClick={onCreateSeries}
            className={cn(
              "mt-2 inline-flex h-11 items-center gap-2 rounded-xl border px-5 text-sm font-semibold",
              palette.primary,
              palette.primaryText,
              palette.primaryBorder
            )}
          >
            <Plus className="h-4 w-4" />
            Erste Serie anlegen
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className={cn("text-3xl", palette.text)} style={{ fontFamily: headingFont }}>
                Deine Serien
              </h2>
              <p className={cn("text-sm", palette.textMuted)}>
                Klicke eine Karte, um Folgen, Charaktere und den Workflow zu öffnen.
              </p>
            </div>
            {loading && <p className={cn("text-xs", palette.textDim)}>Lade Übersicht…</p>}
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {series.map((item, index) => {
              const ov = overview[item.id];
              const inProgress = (ov?.episodeCount || 0) - (ov?.publishedCount || 0);
              return (
                <motion.button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectSeries(item.id)}
                  initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, delay: index * 0.04 }}
                  className={cn(
                    "group relative flex h-[460px] flex-col overflow-hidden rounded-3xl border text-left shadow-[0_18px_48px_rgba(15,25,42,0.12)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_rgba(15,25,42,0.22)]",
                    palette.card
                  )}
                >
                  <div
                    className="relative h-[60%] overflow-hidden"
                    style={{
                      background: ov?.coverImageUrl
                        ? `${palette.heroOverlay}, url(${ov.coverImageUrl}) center/cover no-repeat`
                        : "linear-gradient(135deg, #2a2148 0%, #1f3a4a 50%, #2c4a3e 100%)",
                    }}
                  >
                    {!ov?.coverImageUrl && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-25">
                        <Clapperboard className="h-32 w-32 text-white" strokeWidth={0.5} />
                      </div>
                    )}

                    <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-black/45 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
                        <Layers3 className="h-3 w-3" />
                        Serie
                      </span>
                      {ov?.publishedCount && ov.publishedCount > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-500/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-50 backdrop-blur-sm">
                          <Star className="h-3 w-3" /> {ov.publishedCount} live
                        </span>
                      ) : null}
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
                      <h3
                        className="line-clamp-2 text-3xl leading-[1.1] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
                        style={{ fontFamily: headingFont }}
                      >
                        {item.title}
                      </h3>
                      {item.logline && (
                        <p className="mt-1.5 line-clamp-2 text-sm text-white/80">{item.logline}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div className="grid grid-cols-3 gap-2">
                      <MiniStat
                        palette={palette}
                        label="Folgen"
                        value={ov?.episodeCount ?? 0}
                      />
                      <MiniStat
                        palette={palette}
                        label="Live"
                        value={ov?.publishedCount ?? 0}
                        tone="success"
                      />
                      <MiniStat
                        palette={palette}
                        label="In Arbeit"
                        value={inProgress > 0 ? inProgress : 0}
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-[10px] font-semibold uppercase tracking-wider", palette.textDim)}>
                          Letzte Folge
                        </p>
                        <p className={cn("truncate text-sm font-medium", palette.text)}>
                          {ov?.latestEpisodeTitle || "Noch keine Folge"}
                        </p>
                        {ov?.latestEpisodeStatus && (
                          <p className={cn("text-[11px]", palette.textMuted)}>
                            {episodeStatusLabel[ov.latestEpisodeStatus] || ov.latestEpisodeStatus}
                          </p>
                        )}
                      </div>
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full border transition-transform group-hover:translate-x-1",
                          palette.borderStrong,
                          palette.text
                        )}
                      >
                        →
                      </div>
                    </div>
                  </div>

                  <p
                    className={cn(
                      "absolute right-4 top-[calc(60%-0.5rem)] -translate-y-full text-[10px] uppercase tracking-wider",
                      palette.textDim
                    )}
                  >
                    {formatStudioDate(item.updatedAt)}
                  </p>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const StatBadge: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: "success" | "progress";
}> = ({ icon, label, value, accent }) => {
  const accentClass =
    accent === "success"
      ? "text-emerald-300"
      : accent === "progress"
      ? "text-amber-200"
      : "text-white";
  return (
    <div className="rounded-2xl border border-white/15 bg-white/8 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
        {icon}
        {label}
      </div>
      <p className={cn("mt-1 text-3xl font-bold", accentClass)} style={{ fontFamily: headingFont }}>
        {value}
      </p>
    </div>
  );
};

const MiniStat: React.FC<{
  palette: StudioPalette;
  label: string;
  value: number;
  tone?: "success";
}> = ({ palette, label, value, tone }) => {
  return (
    <div className={cn("rounded-xl border px-2.5 py-2", palette.border, palette.cardElevated)}>
      <p className={cn("text-[9px] font-semibold uppercase tracking-wider", palette.textDim)}>{label}</p>
      <p
        className={cn(
          "text-lg font-bold leading-none",
          tone === "success" && value > 0 ? "text-emerald-500 dark:text-emerald-300" : palette.text
        )}
      >
        {value}
      </p>
    </div>
  );
};

export default StudioLibraryView;
