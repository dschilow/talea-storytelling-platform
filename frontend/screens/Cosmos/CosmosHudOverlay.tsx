import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, BookOpen, Brain, Clock3, Sparkles, ZoomIn } from "lucide-react";
import type { CosmosDomain, DomainProgress, TopicIsland } from "./CosmosTypes";
import type { TopicTimelineDTO } from "./apiCosmosClient";
import { getStageLabel, getStageColor } from "./CosmosProgressMapper";
import { LEARNING_STAGES } from "./CosmosTypes";
import { getDomainLearningPreset } from "./CosmosAssetsRegistry";

interface Props {
  domain: CosmosDomain | null;
  progress: DomainProgress | null;
  activeIslands: TopicIsland[];
  otherTopics: TopicIsland[];
  selectedTopic: TopicIsland | null;
  selectedTopicTimeline: TopicTimelineDTO | null;
  isLoadingTopics?: boolean;
  isLoadingTopicTimeline?: boolean;
  isVisible: boolean;
  isDetailMode?: boolean;
  onClose: () => void;
  onOpenDetail: () => void;
  onBackFromDetail: () => void;
  canFocusCycle?: boolean;
  onFocusPrev?: () => void;
  onFocusNext?: () => void;
  onOpenSuggestions: (domainId: string) => void;
  onStartTopicDoku: (topic: TopicIsland) => void;
  onStartTopicQuiz: (topic: TopicIsland) => void;
  onSelectTopic: (topic: TopicIsland) => void;
}

export const CosmosHudOverlay: React.FC<Props> = ({
  domain,
  progress,
  activeIslands,
  otherTopics,
  selectedTopic,
  selectedTopicTimeline,
  isLoadingTopics = false,
  isLoadingTopicTimeline = false,
  isVisible,
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
  if (!domain || !progress) return null;

  const stageLabel = getStageLabel(progress.stage);
  const stageColor = getStageColor(progress.stage);
  const evidenceLine = progress.recentHighlight || "Neue Lernspur gesammelt.";
  const stages = Object.entries(LEARNING_STAGES) as [string, { label: string }][];
  const currentStageIdx = stages.findIndex(([key]) => key === progress.stage);
  const evolutionPips = Math.max(
    1,
    Math.min(10, Math.round((Number(progress.planetLevel || 1) / 50) * 10))
  );
  const detailCards = getDetailCards(domain.id, progress);
  const dueRecall =
    selectedTopicTimeline?.recallTasks.find((task) => task.status === "pending") ||
    null;
  const showTopicInsights =
    isDetailMode ||
    isLoadingTopics ||
    activeIslands.length > 0 ||
    Boolean(selectedTopic);
  const bottomInset = isDetailMode
    ? "max(0.75rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))"
    : "max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))";
  const sideInset = "max(0.75rem, calc(env(safe-area-inset-left, 0px) + 0.5rem))";

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className={[
            "absolute z-30",
            isDetailMode
              ? "left-4 right-4 bottom-4 md:left-auto md:right-6 md:w-[26rem] md:max-w-[26rem]"
              : "bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-xl",
          ].join(" ")}
          style={
            isDetailMode
              ? { bottom: bottomInset, left: sideInset, right: sideInset }
              : { bottom: bottomInset }
          }
        >
          <div
            className={[
              "relative rounded-3xl border border-white/10 p-5 backdrop-blur-xl",
              isDetailMode ? "max-h-[72vh] overflow-y-auto" : "",
            ].join(" ")}
            style={{
              background: "linear-gradient(135deg, rgba(15,15,35,0.92) 0%, rgba(25,20,50,0.95) 100%)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            <button
              onClick={isDetailMode ? onBackFromDetail : onClose}
              className="absolute top-4 right-4 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white/60 hover:text-white/90 hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {isDetailMode ? "Fokus" : "Zurueck"}
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                style={{
                  background: `${domain.color}20`,
                  border: `2px solid ${domain.color}40`,
                }}
              >
                {domain.icon}
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">{domain.label}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold"
                    style={{
                      background: `${stageColor}20`,
                      color: stageColor,
                      border: `1px solid ${stageColor}30`,
                    }}
                  >
                    <Sparkles className="h-3 w-3" />
                    {stageLabel}
                  </span>
                  <span className="text-[11px] text-white/40">
                    Level {progress.planetLevel || 1} - {progress.topicsExplored} Themen
                  </span>
                </div>
              </div>
            </div>

            {canFocusCycle && (
              <div className="mb-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onFocusPrev}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-xs font-bold text-white/85 hover:bg-white/14 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Vorheriger
                </button>
                <button
                  type="button"
                  onClick={onFocusNext}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-xs font-bold text-white/85 hover:bg-white/14 transition-colors"
                >
                  Naechster
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="mb-4">
              <div className="flex gap-1 mb-1.5">
                {stages.map(([key], idx) => (
                  <div
                    key={key}
                    className="flex-1 h-1.5 rounded-full"
                    style={{ background: idx <= currentStageIdx ? stageColor : "rgba(255,255,255,0.08)" }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[9px] text-white/30 font-semibold">
                {stages.map(([key, { label }]) => (
                  <span key={key}>{label}</span>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-white/50 font-bold uppercase tracking-wide">
                  Evolutionspfad
                </span>
                <span className="text-[10px] text-white/35">Planet-Level</span>
              </div>
              <div className="grid grid-cols-10 gap-1">
                {Array.from({ length: 10 }).map((_, idx) => (
                  <div
                    key={`evo_${idx}`}
                    className="h-1.5 rounded-full"
                    style={{
                      background: idx < evolutionPips ? stageColor : "rgba(255,255,255,0.08)",
                      boxShadow: idx < evolutionPips ? `0 0 8px ${stageColor}55` : "none",
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl bg-white/5 p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-white/50 font-bold uppercase tracking-wide mb-1">
                  <Brain className="h-3 w-3" />
                  Wissenstiefe
                </div>
                <div className="text-sm font-extrabold text-white">
                  {progress.masteryText || getMasteryDescriptor(progress.mastery)}
                </div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-white/50 font-bold uppercase tracking-wide mb-1">
                  <Sparkles className="h-3 w-3" />
                  Lernsicherheit
                </div>
                <div className="text-sm font-extrabold text-white">
                  {progress.confidenceText || getConfidenceDescriptor(progress.confidence)}
                </div>
              </div>
            </div>

            <div className="mb-4 rounded-xl bg-white/5 p-3 text-xs text-white/65 border border-white/5">
              {evidenceLine}
            </div>

            {showTopicInsights && (
              <div className="mb-4 space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-white/60">
                      Topic-Inseln
                    </h4>
                    {isLoadingTopics && (
                      <span className="text-[11px] text-white/45">laedt...</span>
                    )}
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                    {(activeIslands || []).map((topic) => (
                      <button
                        key={topic.topicId}
                        type="button"
                        onClick={() => onSelectTopic(topic)}
                        className="w-full text-left rounded-lg px-2.5 py-2 text-xs transition-colors border"
                        style={{
                          borderColor: selectedTopic?.topicId === topic.topicId ? `${stageColor}66` : "rgba(255,255,255,0.12)",
                          background: selectedTopic?.topicId === topic.topicId ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                          color: "rgba(255,255,255,0.9)",
                        }}
                      >
                        <div className="font-semibold">{topic.topicTitle}</div>
                        <div className="text-[11px] text-white/55">
                          {getStageLabel(topic.stage)} - {topic.masteryLabel} - {topic.docsCount} Inhalte
                        </div>
                      </button>
                    ))}
                    {activeIslands.length === 0 && !isLoadingTopics && (
                      <div className="text-xs text-white/45">Noch keine aktiven Topics.</div>
                    )}
                  </div>
                </div>

                {selectedTopic && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">{selectedTopic.topicTitle}</h4>
                        <p className="text-[11px] text-white/55">
                          {getStageLabel(selectedTopic.stage)} - {selectedTopic.masteryLabel} - {selectedTopic.confidenceLabel}
                        </p>
                      </div>
                      {selectedTopic.recallDueAt && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 border border-amber-300/35 px-2 py-1 text-[10px] font-bold text-amber-100">
                          <Clock3 className="h-3 w-3" />
                          Recall faellig
                        </span>
                      )}
                    </div>

                    <div className="rounded-lg bg-black/20 border border-white/10 p-2.5 text-xs text-white/75">
                      <div className="font-semibold mb-1">Letzte Dokus/Stories</div>
                      <div className="space-y-1">
                        {(selectedTopicTimeline?.docs || []).slice(0, 5).map((entry) => (
                          <div key={entry.contentId} className="flex items-center justify-between gap-2">
                            <span className="truncate">{entry.title}</span>
                            <span className="text-[10px] text-white/45 uppercase">{entry.type}</span>
                          </div>
                        ))}
                        {isLoadingTopicTimeline && (
                          <div className="text-[11px] text-white/45">Timeline wird geladen...</div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onStartTopicDoku(selectedTopic)}
                        className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white/90 hover:bg-white/15 transition-colors"
                      >
                        Doku starten
                      </button>
                      <button
                        type="button"
                        onClick={() => onStartTopicQuiz(selectedTopic)}
                        className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white/90 hover:bg-white/15 transition-colors"
                      >
                        Quiz starten
                      </button>
                    </div>

                    {dueRecall && (
                      <button
                        type="button"
                        className="w-full rounded-xl border border-amber-300/40 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-100 hover:bg-amber-500/20 transition-colors"
                      >
                        Kurzer Recall (30-60s)
                      </button>
                    )}
                  </div>
                )}

                {otherTopics.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-white/60 mb-2">
                      Weitere Topics ({otherTopics.length})
                    </h4>
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                      {otherTopics.map((topic) => (
                        <button
                          key={topic.topicId}
                          type="button"
                          onClick={() => onSelectTopic(topic)}
                          className="w-full text-left rounded-md px-2 py-1.5 text-xs text-white/75 hover:bg-white/8 transition-colors"
                        >
                          {topic.topicTitle}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2">
                  {detailCards.map((card) => (
                    <div
                      key={card}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/75"
                    >
                      {card}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={isDetailMode ? onBackFromDetail : onOpenDetail}
                className="w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold text-white/85 transition-all hover:bg-white/12 active:scale-[0.98]"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.14)",
                }}
              >
                <ZoomIn className="h-4 w-4" />
                {isDetailMode ? "Zur Fokusansicht" : "Planet Detail"}
              </button>
              <button
                onClick={() => onOpenSuggestions(domain.id)}
                className="w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold text-white transition-all hover:brightness-110 active:scale-[0.98]"
                style={{
                  background: `linear-gradient(135deg, ${domain.color}, ${domain.emissiveColor})`,
                  boxShadow: `0 8px 24px ${domain.color}40`,
                }}
              >
                <BookOpen className="h-4 w-4" />
                Weiterlernen
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

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

function getDetailCards(domainId: string, progress: DomainProgress): string[] {
  const preset = getDomainLearningPreset(domainId);
  return [
    `Weiterlernen: ${preset.topic}`,
    progress.topicsExplored > 0
      ? `${progress.topicsExplored} Themen bereits erkundet`
      : "Starte mit einem ersten Thema",
    progress.stage === "retained"
      ? "Pro Tipp: Transferfragen fuer neue Situationen"
      : "Empfehlung: Kurzer Recall in 3-7 Tagen",
  ];
}

