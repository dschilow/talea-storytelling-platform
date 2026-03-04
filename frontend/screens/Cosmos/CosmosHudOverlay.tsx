/**
 * CosmosHudOverlay.tsx - Overlay for focused/detail planet state.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BookOpen, Brain, Sparkles, ZoomIn } from 'lucide-react';
import type { CosmosDomain, DomainProgress } from './CosmosTypes';
import { getStageLabel, getStageColor } from './CosmosProgressMapper';
import { LEARNING_STAGES } from './CosmosTypes';
import { getDomainLearningPreset } from './CosmosAssetsRegistry';

interface Props {
  domain: CosmosDomain | null;
  progress: DomainProgress | null;
  isVisible: boolean;
  isDetailMode?: boolean;
  onClose: () => void;
  onOpenDetail: () => void;
  onBackFromDetail: () => void;
  onStartLearning: (domainId: string) => void;
}

export const CosmosHudOverlay: React.FC<Props> = ({
  domain,
  progress,
  isVisible,
  isDetailMode = false,
  onClose,
  onOpenDetail,
  onBackFromDetail,
  onStartLearning,
}) => {
  if (!domain || !progress) return null;

  const stageLabel = getStageLabel(progress.stage);
  const stageColor = getStageColor(progress.stage);
  const masteryDescriptor = getMasteryDescriptor(progress.mastery);
  const confidenceDescriptor = getConfidenceDescriptor(progress.confidence);
  const evidenceLines = buildEvidenceLines(progress);
  const detailCards = getDetailCards(domain.id, progress);
  const evolutionPips = Math.max(
    1,
    Math.min(10, Math.round((progress.mastery * 0.65 + progress.confidence * 0.35) / 10))
  );

  const stages = Object.entries(LEARNING_STAGES) as [string, { label: string }][];
  const currentStageIdx = stages.findIndex(([key]) => key === progress.stage);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-[90%] max-w-md"
        >
          <div
            className="relative rounded-3xl border border-white/10 p-5 backdrop-blur-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(15,15,35,0.92) 0%, rgba(25,20,50,0.95) 100%)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <button
              onClick={isDetailMode ? onBackFromDetail : onClose}
              className="absolute top-4 right-4 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white/60 hover:text-white/90 hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {isDetailMode ? 'Fokus' : 'Zurueck'}
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
                <h3
                  className="text-lg font-extrabold text-white"
                  style={{ fontFamily: '"Nunito", sans-serif' }}
                >
                  {domain.label}
                </h3>
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
                    {progress.topicsExplored} Themen erkundet
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex gap-1 mb-1.5">
                {stages.map(([key], idx) => (
                  <div
                    key={key}
                    className="flex-1 h-1.5 rounded-full"
                    style={{
                      background:
                        idx <= currentStageIdx ? stageColor : 'rgba(255,255,255,0.08)',
                    }}
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
                <span className="text-[10px] text-white/35">
                  Waechst mit jedem Lernschritt
                </span>
              </div>
              <div className="grid grid-cols-10 gap-1">
                {Array.from({ length: 10 }).map((_, idx) => (
                  <div
                    key={`evo_${idx}`}
                    className="h-1.5 rounded-full"
                    style={{
                      background: idx < evolutionPips ? stageColor : 'rgba(255,255,255,0.08)',
                      boxShadow: idx < evolutionPips ? `0 0 8px ${stageColor}55` : 'none',
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
                  {masteryDescriptor}
                </div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-white/50 font-bold uppercase tracking-wide mb-1">
                  <Sparkles className="h-3 w-3" />
                  Lernsicherheit
                </div>
                <div className="text-sm font-extrabold text-white">
                  {confidenceDescriptor}
                </div>
              </div>
            </div>

            {evidenceLines.length > 0 && (
              <div className="mb-4 rounded-xl bg-white/5 p-3 text-xs text-white/65 border border-white/5 space-y-1.5">
                {evidenceLines.map((line) => (
                  <p key={line} className="leading-snug">
                    {line}
                  </p>
                ))}
              </div>
            )}

            {isDetailMode && (
              <div className="mb-4 grid grid-cols-1 gap-2">
                {detailCards.map((card) => (
                  <div
                    key={card}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/75"
                  >
                    {card}
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={isDetailMode ? onBackFromDetail : onOpenDetail}
                className="w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold text-white/85 transition-all hover:bg-white/12 active:scale-[0.98]"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.14)',
                }}
              >
                <ZoomIn className="h-4 w-4" />
                {isDetailMode ? 'Zur Fokusansicht' : 'Planet Detail'}
              </button>
              <button
                onClick={() => onStartLearning(domain.id)}
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
  if (mastery >= 80) return 'Experte';
  if (mastery >= 55) return 'Sicher';
  if (mastery >= 25) return 'Vertraut';
  return 'Erste Spur';
}

function getConfidenceDescriptor(confidence: number): string {
  if (confidence >= 70) return 'Sitzt wirklich';
  if (confidence >= 45) return 'Sitzt';
  if (confidence >= 20) return 'Meist sicher';
  return 'Gerade entdeckt';
}

function buildEvidenceLines(progress: DomainProgress): string[] {
  const lines: string[] = [];
  if (progress.recentHighlight) {
    lines.push(progress.recentHighlight);
  } else {
    const quizScore = Math.max(1, Math.min(5, Math.round(progress.mastery / 20)));
    lines.push(`Quiz-Indikator: ${quizScore}/5 richtig`);
  }

  const recallScore = Math.max(1, Math.min(4, Math.round(progress.confidence / 25)));
  lines.push(`Recall-Indikator: ${recallScore}/4`);
  return lines.slice(0, 2);
}

function getDetailCards(domainId: string, progress: DomainProgress): string[] {
  const preset = getDomainLearningPreset(domainId);
  return [
    `Weiterlernen: ${preset.topic}`,
    progress.topicsExplored > 0
      ? `${progress.topicsExplored} Themen bereits erkundet`
      : 'Starte mit einem ersten Thema',
    progress.stage === 'mastered'
      ? 'Pro Tipp: Transferfragen fuer neue Situationen'
      : 'Empfehlung: Kurzer Recall in 3-7 Tagen',
  ];
}
