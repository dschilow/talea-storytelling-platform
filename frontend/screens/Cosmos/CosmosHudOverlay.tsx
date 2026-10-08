import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Brain,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cloud,
  Crown,
  HelpCircle,
  Mountain,
  Orbit,
  Sparkles,
  Sprout,
  Star,
  Waves,
  Wind,
  ZoomIn,
} from "lucide-react";
import type { CosmosDomain, DomainProgress, TopicIsland } from "./CosmosTypes";
import type { TopicTimelineDTO } from "./apiCosmosClient";
import { getStageLabel, getStageColor } from "./CosmosProgressMapper";
import {
  MAX_EVOLUTION_STAGE,
  STAR_POINT_RULES,
  getStageCopy,
  type PlanetEvolution,
} from "./CosmosEvolution";
import { MOON_STAGE_COLORS } from "./CosmosPlanetThemes";
import { formatTopicTitle } from "./CosmosPlanetDomain";

interface Props {
  domain: CosmosDomain | null;
  progress: DomainProgress | null;
  evolution: PlanetEvolution | null;
  activeIslands: TopicIsland[];
  otherTopics: TopicIsland[];
  selectedTopic: TopicIsland | null;
  selectedTopicTimeline: TopicTimelineDTO | null;
  isLoadingTopics?: boolean;
  isLoadingTopicTimeline?: boolean;
  isVisible: boolean;
  isTransitioning?: boolean;
  isDetailMode?: boolean;
  onClose: () => void;
  onOpenDetail: () => void;
  onBackFromDetail: () => void;
  canFocusCycle?: boolean;
  onFocusPrev?: () => void;
  onFocusNext?: () => void;
  onOpenSuggestions: (domainId: string) => void;
  onStartTopicDoku: (
    topic: TopicIsland,
    entry?: TopicTimelineDTO["docs"][number] | null
  ) => void;
  onStartTopicQuiz: (
    topic: TopicIsland,
    entry?: TopicTimelineDTO["docs"][number] | null
  ) => void;
  onSelectTopic: (topic: TopicIsland) => void;
}

const STAGE_ICONS = [Star, Mountain, Wind, Waves, Cloud, Sprout, Sparkles, Orbit, Crown];

export const CosmosHudOverlay: React.FC<Props> = ({
  domain,
  progress,
  evolution,
  activeIslands,
  otherTopics,
  selectedTopic,
  selectedTopicTimeline,
  isLoadingTopics = false,
  isLoadingTopicTimeline = false,
  isVisible,
  isTransitioning = false,
  isDetailMode = false,
  onClose,
  onOpenDetail,
  onBackFromDetail,
  canFocusCycle = false,
  onFocusPrev,
  onFocusNext,
  onOpenSuggestions,
  onStartTopicDoku,
  onStartTopicQuiz,
  onSelectTopic,
}) => {
  const [selectedTimelineDocId, setSelectedTimelineDocId] = React.useState<string | null>(null);
  const [showPointRules, setShowPointRules] = React.useState(false);

  React.useEffect(() => {
    const firstId = selectedTopicTimeline?.docs?.[0]?.contentId || null;
    setSelectedTimelineDocId((current) => {
      if (!selectedTopicTimeline?.docs?.length) return null;
      if (current && selectedTopicTimeline.docs.some((entry) => entry.contentId === current)) {
        return current;
      }
      return firstId;
    });
  }, [selectedTopicTimeline]);

  if (!domain || !progress || !evolution) return null;

  const stageColor = getStageColor(progress.stage);
  const moonCount = Math.max(Number(progress.topicsExplored || 0), activeIslands.length);
  const isStardust = evolution.stage === 0;
  const selectedTimelineEntry =
    selectedTopicTimeline?.docs?.find((entry) => entry.contentId === selectedTimelineDocId) ||
    selectedTopicTimeline?.docs?.[0] ||
    null;
  const firstDoku = selectedTopicTimeline?.docs?.find((entry) => entry.type === "doku") || null;
  const dueRecall =
    selectedTopicTimeline?.recallTasks.find((task) => task.status === "pending") || null;
  const showTopicInsights = isDetailMode && !isTransitioning;
  const bottomInset = isDetailMode
    ? "max(0.75rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))"
    : "max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))";

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 220, damping: 28, mass: 0.95 }}
          className="absolute left-3 right-3 z-30 md:left-auto md:right-6 md:w-[26rem] md:max-w-[26rem]"
          style={{ bottom: bottomInset }}
        >
          <div
            className={[
              "relative overflow-y-auto rounded-3xl border border-white/10 p-4 md:p-5 backdrop-blur-xl md:max-h-[78vh]",
              isDetailMode ? "max-h-[58vh]" : "max-h-[50vh]",
            ].join(" ")}
            style={{
              background: "linear-gradient(135deg, rgba(13,14,34,0.93) 0%, rgba(24,19,50,0.95) 100%)",
              boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 48px ${domain.color}1f, inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${domain.id}:${isDetailMode ? "detail" : "focus"}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Header */}
                <div className="mb-3 flex items-center gap-3 pr-20">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
                    style={{
                      background: `radial-gradient(circle at 35% 30%, ${domain.color}55, ${domain.color}14)`,
                      border: `1.5px solid ${domain.color}66`,
                      boxShadow: `0 0 18px ${domain.color}33`,
                    }}
                  >
                    {domain.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-extrabold text-white">{domain.label}</h3>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-extrabold"
                        style={{
                          background: `${domain.color}22`,
                          color: domain.color,
                          border: `1px solid ${domain.color}44`,
                        }}
                      >
                        <Sparkles className="h-3 w-3" />
                        {isStardust ? "Sternenstaub" : `Stufe ${evolution.stage} · ${evolution.current.name}`}
                      </span>
                      <span className="text-[11px] font-semibold text-white/45">
                        {moonCount === 1 ? "1 Wissensmond" : `${moonCount} Wissensmonde`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="absolute right-3 top-3 flex items-center gap-1">
                  {canFocusCycle && (
                    <>
                      <IconButton label="Vorheriger Planet" onClick={onFocusPrev}>
                        <ChevronLeft className="h-4 w-4" />
                      </IconButton>
                      <IconButton label="Nächster Planet" onClick={onFocusNext}>
                        <ChevronRight className="h-4 w-4" />
                      </IconButton>
                    </>
                  )}
                  <IconButton label={isDetailMode ? "Zurück zum Planeten" : "Zurück zur Übersicht"} onClick={isDetailMode ? onBackFromDetail : onClose}>
                    <ArrowLeft className="h-4 w-4" />
                  </IconButton>
                </div>

                {isStardust ? (
                  <div
                    className="mb-4 rounded-2xl border p-3.5 text-sm font-semibold leading-relaxed text-white/80"
                    style={{ borderColor: `${domain.color}33`, background: `${domain.color}12` }}
                  >
                    Diese Welt ist noch Sternenstaub. Lies eine erste Doku über{" "}
                    <span className="font-extrabold text-white">{domain.label}</span>, dann entsteht hier dein Planet!
                  </div>
                ) : (
                  <EvolutionTrack domain={domain} evolution={evolution} />
                )}

                {/* Star points to the next stage */}
                <div className="mb-4">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white/80">
                      {evolution.next ? (
                        <>
                          Noch <span style={{ color: domain.color }}>{evolution.pointsToNext} ⭐</span> bis{" "}
                          <span className="text-white">„{evolution.next.name}“</span>
                        </>
                      ) : (
                        "Höchste Stufe erreicht – eine echte Sternenwelt!"
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPointRules((value) => !value)}
                      className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] font-bold text-white/50 hover:bg-white/10 hover:text-white/80"
                      aria-expanded={showPointRules}
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      Sternenpunkte
                    </button>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(evolution.progressToNext * 100)}%` }}
                      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        background: `linear-gradient(90deg, ${domain.emissiveColor}, ${domain.color})`,
                        boxShadow: `0 0 12px ${domain.color}88`,
                      }}
                    />
                  </div>
                  <AnimatePresence initial={false}>
                    {showPointRules && (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-2 grid grid-cols-1 gap-1.5 overflow-hidden sm:grid-cols-3"
                      >
                        {STAR_POINT_RULES.map((rule) => (
                          <li
                            key={rule.label}
                            className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-2 py-1.5 text-[11px] text-white/70"
                          >
                            <span>{rule.label}</span>
                            <span className="font-extrabold text-amber-200">{rule.points}</span>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>

                {!isStardust && (
                  <div className={["mb-4 grid-cols-2 gap-2.5", isDetailMode ? "grid" : "hidden md:grid"].join(" ")}>
                    <div className="rounded-xl bg-white/5 p-2.5">
                      <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/50">
                        <Brain className="h-3 w-3" />
                        Wissenstiefe
                      </div>
                      <div className="text-sm font-extrabold text-white">
                        {progress.masteryText || getMasteryDescriptor(progress.mastery)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/5 p-2.5">
                      <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/50">
                        <Sparkles className="h-3 w-3" />
                        Lernsicherheit
                      </div>
                      <div className="text-sm font-extrabold text-white">
                        {progress.confidenceText || getConfidenceDescriptor(progress.confidence)}
                      </div>
                    </div>
                  </div>
                )}

                {!isStardust && progress.recentHighlight && (
                  <div
                    className={[
                      "mb-4 rounded-xl border border-white/5 bg-white/5 p-2.5 text-xs text-white/65",
                      isDetailMode ? "block" : "hidden md:block",
                    ].join(" ")}
                  >
                    {progress.recentHighlight}
                  </div>
                )}

                {showTopicInsights && (
                  <div className="mb-4 space-y-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wide text-white/60">
                          Wissensmonde
                        </h4>
                        {isLoadingTopics && <span className="text-[11px] text-white/45">lädt …</span>}
                      </div>
                      <div className="max-h-32 space-y-1.5 overflow-y-auto pr-1">
                        {activeIslands.map((topic) => {
                          const isSelected = selectedTopic?.topicId === topic.topicId;
                          const moonColor = MOON_STAGE_COLORS[topic.stage] ?? domain.color;
                          return (
                            <button
                              key={topic.topicId}
                              type="button"
                              onClick={() => onSelectTopic(topic)}
                              className="flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors"
                              style={{
                                borderColor: isSelected ? `${moonColor}88` : "rgba(255,255,255,0.12)",
                                background: isSelected ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                              }}
                            >
                              <span
                                aria-hidden
                                className="h-3 w-3 shrink-0 rounded-full"
                                style={{ background: moonColor, boxShadow: `0 0 8px ${moonColor}` }}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-semibold text-white/90">
                                  {formatTopicTitle(topic.topicTitle)}
                                </span>
                                <span className="block text-[11px] text-white/55">
                                  {getStageLabel(topic.stage)} · {topic.docsCount} {topic.docsCount === 1 ? "Inhalt" : "Inhalte"}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                        {activeIslands.length === 0 && !isLoadingTopics && (
                          <div className="text-xs text-white/45">Noch keine Wissensmonde.</div>
                        )}
                      </div>
                    </div>

                    {selectedTopic && (
                      <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-white">
                              {formatTopicTitle(selectedTopic.topicTitle)}
                            </h4>
                            <p className="text-[11px] text-white/55">
                              {getStageLabel(selectedTopic.stage)} · {selectedTopic.masteryLabel} · {selectedTopic.confidenceLabel}
                            </p>
                          </div>
                          {selectedTopic.recallDueAt && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300/35 bg-amber-500/20 px-2 py-1 text-[10px] font-bold text-amber-100">
                              <Clock3 className="h-3 w-3" />
                              Wiederholung fällig
                            </span>
                          )}
                        </div>

                        <div className="rounded-lg border border-white/10 bg-black/20 p-2.5 text-xs text-white/75">
                          <div className="mb-1 font-semibold">Deine Dokus und Geschichten</div>
                          <div className="space-y-1.5">
                            {(selectedTopicTimeline?.docs || []).slice(0, 5).map((entry) => (
                              <button
                                key={entry.contentId}
                                type="button"
                                onClick={() => setSelectedTimelineDocId(entry.contentId)}
                                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors"
                                style={{
                                  background:
                                    selectedTimelineEntry?.contentId === entry.contentId
                                      ? "rgba(255,255,255,0.12)"
                                      : "rgba(255,255,255,0.04)",
                                  border:
                                    selectedTimelineEntry?.contentId === entry.contentId
                                      ? `1px solid ${stageColor}66`
                                      : "1px solid rgba(255,255,255,0.08)",
                                }}
                              >
                                <span className="truncate">{entry.title}</span>
                                <span className="text-[10px] uppercase text-white/45">
                                  {entry.type === "story" ? "Geschichte" : "Doku"}
                                </span>
                              </button>
                            ))}
                            {isLoadingTopicTimeline && (
                              <div className="text-[11px] text-white/45">wird geladen …</div>
                            )}
                            {!isLoadingTopicTimeline && (selectedTopicTimeline?.docs?.length || 0) === 0 && (
                              <div className="text-[11px] text-white/45">Noch keine Inhalte gespeichert.</div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => onStartTopicDoku(selectedTopic, selectedTimelineEntry)}
                            disabled={!selectedTimelineEntry}
                            className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white/90 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {selectedTimelineEntry?.type === "story" ? "Geschichte öffnen" : "Doku öffnen"}
                          </button>
                          <button
                            type="button"
                            onClick={() => onStartTopicQuiz(selectedTopic, selectedTimelineEntry)}
                            disabled={selectedTimelineEntry?.type !== "doku"}
                            className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white/90 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            Quiz starten
                          </button>
                        </div>

                        {dueRecall && firstDoku && (
                          <button
                            type="button"
                            onClick={() => onStartTopicQuiz(selectedTopic, firstDoku)}
                            className="w-full rounded-xl border border-amber-300/40 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-100 transition-colors hover:bg-amber-500/20"
                          >
                            Kurz wiederholen im Quiz
                          </button>
                        )}
                      </div>
                    )}

                    {otherTopics.length > 0 && (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-white/60">
                          Weitere Themen ({otherTopics.length})
                        </h4>
                        <div className="max-h-24 space-y-1 overflow-y-auto pr-1">
                          {otherTopics.map((topic) => (
                            <button
                              key={topic.topicId}
                              type="button"
                              onClick={() => onSelectTopic(topic)}
                              className="w-full rounded-md px-2 py-1.5 text-left text-xs text-white/75 transition-colors hover:bg-white/8"
                            >
                              {formatTopicTitle(topic.topicTitle)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className={isStardust ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-2"}>
                  {!isStardust && (
                    <button
                      type="button"
                      onClick={isDetailMode ? onBackFromDetail : onOpenDetail}
                      className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-3 py-3 text-sm font-extrabold text-white/85 transition-all hover:bg-white/12 active:scale-[0.98]"
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.14)",
                      }}
                    >
                      <ZoomIn className="h-4 w-4" />
                      {isDetailMode ? "Zum Planeten" : "Monde ansehen"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenSuggestions(domain.id)}
                    className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-3 py-3 text-sm font-extrabold text-white transition-all hover:brightness-110 active:scale-[0.98]"
                    style={{
                      background: `linear-gradient(135deg, ${domain.color}, ${domain.emissiveColor})`,
                      boxShadow: `0 8px 24px ${domain.color}40`,
                    }}
                  >
                    <BookOpen className="h-4 w-4" />
                    {isStardust ? "Erste Doku finden" : "Weiterlernen"}
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const IconButton: React.FC<{ label: string; onClick?: () => void; children: React.ReactNode }> = ({
  label,
  onClick,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className="flex h-8 w-8 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white"
  >
    {children}
  </button>
);

/** Eight milestones; reached ones glow, the next one waits with its name. */
const EvolutionTrack: React.FC<{ domain: CosmosDomain; evolution: PlanetEvolution }> = ({ domain, evolution }) => (
  <div className="mb-3">
    <div className="relative flex items-center justify-between px-1">
      <div className="absolute left-4 right-4 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-white/10" />
      <div
        className="absolute left-4 top-1/2 h-0.5 -translate-y-1/2 rounded-full"
        style={{
          width: `calc((100% - 2rem) * ${Math.min(1, (evolution.stage - 1 + evolution.progressToNext) / (MAX_EVOLUTION_STAGE - 1))})`,
          background: `linear-gradient(90deg, ${domain.emissiveColor}, ${domain.color})`,
          boxShadow: `0 0 8px ${domain.color}`,
        }}
      />
      {Array.from({ length: MAX_EVOLUTION_STAGE }).map((_, index) => {
        const stage = index + 1;
        const Icon = STAGE_ICONS[stage];
        const reached = stage <= evolution.stage;
        const isCurrent = stage === evolution.stage;
        const isNext = stage === evolution.stage + 1;
        return (
          <div
            key={stage}
            title={`Stufe ${stage}: ${getStageCopy(stage, domain.planetType).name}`}
            className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border transition-all"
            style={{
              background: reached ? `radial-gradient(circle at 35% 30%, ${domain.color}, ${domain.emissiveColor})` : "rgba(15,17,40,0.95)",
              borderColor: reached ? `${domain.color}` : isNext ? `${domain.color}88` : "rgba(255,255,255,0.14)",
              boxShadow: isCurrent ? `0 0 0 3px ${domain.color}33, 0 0 16px ${domain.color}aa` : "none",
              borderStyle: isNext ? "dashed" : "solid",
            }}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: reached ? "#0b1020" : isNext ? domain.color : "rgba(255,255,255,0.3)" }} />
          </div>
        );
      })}
    </div>
  </div>
);

function getMasteryDescriptor(mastery: number): string {
  if (mastery >= 80) return "Experte";
  if (mastery >= 55) return "Sicher";
  if (mastery >= 25) return "Vertraut";
  return "Erste Spur";
}

function getConfidenceDescriptor(confidence: number): string {
  if (confidence >= 70) return "Sitzt wirklich";
  if (confidence >= 45) return "Sitzt";
  if (confidence >= 20) return "Meist sicher";
  return "Gerade entdeckt";
}
