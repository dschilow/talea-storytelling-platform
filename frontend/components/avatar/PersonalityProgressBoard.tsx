import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CircleHelp, Compass, Crown, Sparkles, Target, Trophy } from 'lucide-react';

import { useTheme } from '../../contexts/ThemeContext';
import type { AvatarMemory, AvatarProgression } from '../../types/avatar';
import AvatarLearningWorldMap from './AvatarLearningWorldMap';

export interface PersonalityBoardTrait {
  id: string;
  label: string;
  value: number;
  subcategories: Array<{ name: string; value: number }>;
}

interface PersonalityProgressBoardProps {
  traits: PersonalityBoardTrait[];
  progression?: AvatarProgression | null;
  memories?: AvatarMemory[];
}

interface TraitCardData {
  id: string;
  label: string;
  value: number;
  displayProgress: number;
  rankProgress: number;
  rankName: string;
  nextRankAt: number | null;
  progressToNext: number;
}

const TRAIT_ACCENTS: Record<string, { start: string; end: string }> = {
  creativity: { start: '#d5bdaf', end: '#e3d5ca' },
  courage: { start: '#d49782', end: '#d2a87b' },
  empathy: { start: '#d6ccc2', end: '#e3d5ca' },
  curiosity: { start: '#8db57f', end: '#a7c88d' },
  teamwork: { start: '#d5bdaf', end: '#e3d5ca' },
  persistence: { start: '#b99674', end: '#c5a286' },
  logic: { start: '#d6ccc2', end: '#d5bdaf' },
  vocabulary: { start: '#d6ccc2', end: '#e3d5ca' },
  knowledge: { start: '#d5bdaf', end: '#e3d5ca' },
};

const TRAIT_HINTS: Record<string, string> = {
  knowledge: 'Steigt besonders durch Doku-Lesen und Wissensquiz.',
  creativity: 'Steigt bei kreativen Storys mit offenen Entscheidungen.',
  vocabulary: 'Steigt bei dialogreichen Inhalten und Begriffsquiz.',
  courage: 'Steigt bei Abenteuerinhalten mit Risiko-Entscheidungen.',
  curiosity: 'Steigt bei Entdecker- und Mystery-Inhalten.',
  teamwork: 'Steigt bei Teamaufgaben und Konfliktloesung.',
  empathy: 'Steigt bei Perspektivwechsel und emotionalen Szenen.',
  persistence: 'Steigt bei laengeren Storyboegen und Wiederholung.',
  logic: 'Steigt bei Raetseln, Analysen und Problemketten.',
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const fallbackRankName = (value: number) => {
  if (value >= 190) return 'Ikone';
  if (value >= 145) return 'Veteran';
  if (value >= 110) return 'Legende+';
  if (value >= 80) return 'Legende';
  if (value >= 60) return 'Meister';
  if (value >= 40) return 'Geselle';
  if (value >= 20) return 'Lehrling';
  return 'Anfaenger';
};

const toDisplayProgress = (id: string, value: number): number => {
  if (id === 'knowledge') {
    if (value <= 100) return clamp(Math.round(value), 0, 100);
    const normalized = (Math.log10(value + 10) / Math.log10(1010)) * 100;
    return clamp(Math.round(normalized), 0, 100);
  }

  if (value <= 100) return clamp(Math.round(value), 0, 100);
  const normalized = 100 - 100 / (1 + (value - 100) / 70);
  return clamp(Math.round(normalized), 0, 100);
};

const toTraitCards = (
  traits: PersonalityBoardTrait[],
  progression?: AvatarProgression | null
): TraitCardData[] => {
  if (progression?.traitMastery?.length) {
    return progression.traitMastery
      .map((entry) => ({
        id: entry.trait,
        label: entry.label,
        value: Math.round(entry.value),
        displayProgress: clamp(Math.round(entry.displayProgress), 0, 100),
        rankProgress: clamp(Math.round(entry.progressToNext), 0, 100),
        rankName: entry.rank.name,
        nextRankAt: entry.nextRankAt,
        progressToNext: clamp(Math.round(entry.progressToNext), 0, 100),
      }))
      .sort((left, right) => right.value - left.value);
  }

  return [...traits]
    .map((trait) => ({
      id: trait.id,
      label: trait.label,
      value: Math.round(trait.value),
      displayProgress: toDisplayProgress(trait.id, trait.value),
      rankProgress: toDisplayProgress(trait.id, trait.value),
      rankName: fallbackRankName(trait.value),
      nextRankAt: null,
      progressToNext: toDisplayProgress(trait.id, trait.value),
    }))
    .sort((left, right) => right.value - left.value);
};

const getTraitGrowthHint = (traitId: string, value: number) => {
  const hint = TRAIT_HINTS[traitId] || 'Steigt durch passende Lernaktivitaeten.';
  if (value <= 0) {
    return `Warum 0? ${hint}`;
  }
  return `Naechster Schritt: ${hint}`;
};

const InfoHint: React.FC<{
  text: string;
  isDark: boolean;
}> = ({ text, isDark }) => (
  <span className="group relative inline-flex">
    <button
      type="button"
      aria-label="Info"
      className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border transition-colors focus:outline-none"
      style={{
        borderColor: isDark ? '#415973' : '#d6cab9',
        color: isDark ? '#a9bdd8' : '#6b8099',
        background: isDark ? 'rgba(31,45,64,0.7)' : 'rgba(255,251,245,0.85)',
      }}
    >
      <CircleHelp className="h-3.5 w-3.5" />
    </button>
    <span
      className="pointer-events-none absolute right-0 top-[120%] z-20 w-64 rounded-xl border px-2.5 py-2 text-[11px] leading-snug opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      style={{
        borderColor: isDark ? '#415973' : '#d6cab9',
        color: isDark ? '#c9d8eb' : '#465c77',
        background: isDark ? 'rgba(19,29,42,0.96)' : 'rgba(255,252,247,0.98)',
      }}
    >
      {text}
    </span>
  </span>
);

const MeterRing: React.FC<{
  progress: number;
  size?: number;
  strokeWidth?: number;
  accentStart: string;
  accentEnd: string;
  label: string;
  value: number;
}> = ({
  progress,
  size = 98,
  strokeWidth = 9,
  accentStart,
  accentEnd,
  label,
  value,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = clamp(progress, 0, 100);
  const dashOffset = circumference - (clamped / 100) * circumference;
  const gradientId = `ring-${label.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  return (
    <div className="relative">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={accentStart} />
            <stop offset="100%" stopColor={accentEnd} />
          </linearGradient>
        </defs>

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(148,163,184,0.22)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/75">Punkte</p>
        <p className="text-lg font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
};

const QuestDial: React.FC<{
  progress: number;
  target: number;
  completed: boolean;
}> = ({ progress, target, completed }) => {
  const ratio = target <= 0 ? 0 : clamp(progress / target, 0, 1);
  const degrees = Math.round(ratio * 360);

  return (
    <div
      className="relative h-11 w-11 rounded-full"
      style={{
        background: `conic-gradient(${completed ? '#b79f8e' : '#7f96c8'} ${degrees}deg, rgba(148,163,184,0.24) ${degrees}deg)`,
      }}
    >
      <div className="absolute inset-[4px] flex items-center justify-center rounded-full bg-card text-[10px] font-semibold text-foreground">
        {progress}/{target}
      </div>
    </div>
  );
};

export const PersonalityProgressBoard: React.FC<PersonalityProgressBoardProps> = ({
  traits,
  progression,
  memories = [],
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const traitCards = useMemo(() => toTraitCards(traits, progression), [traits, progression]);
  const focusTrait = progression?.focusTrait
    ? traitCards.find((trait) => trait.id === progression.focusTrait)
    : traitCards[0];
  const perks = progression?.perks?.slice(0, 6) || [];
  const quests = progression?.quests?.slice(0, 4) || [];

  return (
    <div className="space-y-4">
      <section
        className="rounded-2xl border p-4"
        style={{
          borderColor: isDark ? '#344b63' : '#d6ccc2',
          background: isDark ? 'rgba(20,30,44,0.76)' : 'rgba(255,255,255,0.74)',
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em]" style={{ color: isDark ? '#9cb1cb' : '#6f8299' }}>
              <Compass className="h-3.5 w-3.5" />
              Entwicklungs-Navigation
              <InfoHint
                isDark={isDark}
                text="Hier siehst du den aktuellen Entwicklungsstand, den naechsten Fokus und die wichtigsten Ziele fuer den Avatar."
              />
            </p>
            <h3 className="text-lg font-semibold" style={{ color: isDark ? '#e8f0fb' : '#24364b' }}>
              {progression?.headline || 'Kompetenzprofil'}
            </h3>
            <p className="text-xs" style={{ color: isDark ? '#9db2cd' : '#6c8098' }}>
              {progression?.memoryFocusHint || 'Die Ringe zeigen den Rang-Fortschritt, nicht das Punktelimit.'}
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full border px-3 py-1.5" style={{ borderColor: isDark ? '#415973' : '#d6cab9', background: isDark ? 'rgba(31,45,64,0.7)' : 'rgba(255,251,245,0.86)' }}>
            <Crown className="h-4 w-4" style={{ color: isDark ? '#c6d8ef' : '#4f657f' }} />
            <span className="text-sm font-semibold" style={{ color: isDark ? '#e8f0fb' : '#2b425b' }}>
              Stufe {progression?.overallLevel || 1}
            </span>
            <InfoHint
              isDark={isDark}
              text="Die Stufe ergibt sich aus Rangstufen aller Eigenschaften, abgeschlossenen Zielen und freigeschalteten Vorteilen."
            />
          </div>
        </div>

        {focusTrait && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: isDark ? '#415973' : '#d5bdaf', color: isDark ? '#c5d6ec' : '#6a5c52' }}>
            <Sparkles className="h-3.5 w-3.5" />
            Fokus: {focusTrait.label} ({focusTrait.rankName})
            <InfoHint
              isDark={isDark}
              text="Fokus bedeutet: Das ist aktuell die staerkste oder am weitesten entwickelte Eigenschaft."
            />
          </div>
        )}
      </section>

      <AvatarLearningWorldMap memories={memories} progression={progression} isDark={isDark} />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {traitCards.map((trait, index) => {
          const accent = TRAIT_ACCENTS[trait.id] || TRAIT_ACCENTS.logic;

          return (
            <motion.article
              key={trait.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: index * 0.03 }}
              className="rounded-2xl border p-3"
              style={{
                borderColor: isDark ? '#364d64' : '#dbcdbc',
                background: isDark ? 'rgba(23,35,50,0.82)' : 'rgba(255,251,245,0.9)',
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: isDark ? '#e8f0fb' : '#25384e' }}>
                    {trait.label}
                    <InfoHint
                      isDark={isDark}
                      text="Punkte steigen durch Lesen, Quiz und Aktionen. Der Rang steigt in Stufen (Anfaenger, Lehrling, ...)."
                    />
                  </p>
                  <p className="text-xs" style={{ color: isDark ? '#9bb0cc' : '#6d8198' }}>
                    Rang: {trait.rankName}
                  </p>
                </div>
                <MeterRing
                  progress={trait.rankProgress}
                  accentStart={accent.start}
                  accentEnd={accent.end}
                  label={trait.id}
                  value={trait.value}
                />
              </div>

              <p className="mt-2 text-[11px]" style={{ color: isDark ? '#98acc8' : '#6a7f98' }}>
                {trait.nextRankAt
                  ? `Naechster Rang ab ${trait.nextRankAt} (${trait.progressToNext}%)`
                  : 'Hoechster Rang erreicht'}
              </p>
              <p className="mt-1 text-[11px]" style={{ color: isDark ? '#8ea5c4' : '#7289a2' }}>
                Gesamtstaerke (skaliert): {trait.displayProgress}%
              </p>
              <p
                className="mt-1 text-[11px] leading-snug"
                style={{
                  color:
                    trait.value <= 0
                      ? isDark
                        ? '#d7c7ab'
                        : '#7a5f3d'
                      : isDark
                        ? '#94abca'
                        : '#67829e',
                }}
              >
                {getTraitGrowthHint(trait.id, trait.value)}
              </p>
            </motion.article>
          );
        })}
      </section>

      {perks.length > 0 && (
        <section
          className="rounded-2xl border p-3"
          style={{
            borderColor: isDark ? '#33495f' : '#d8ccbb',
            background: isDark ? 'rgba(20,31,45,0.72)' : 'rgba(255,255,255,0.74)',
          }}
        >
          <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: isDark ? '#97abc6' : '#6c819a' }}>
            <Trophy className="h-4 w-4" />
            Vorteile
            <InfoHint
              isDark={isDark}
              text="Vorteile werden ab bestimmten Punktestufen automatisch freigeschaltet und staerken die Avatar-Entwicklung."
            />
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {perks.map((perk) => (
              <article
                key={perk.id}
                className="rounded-xl border px-3 py-2"
                style={{
                  borderColor: perk.unlocked
                    ? isDark
                      ? '#4f8b7a'
                      : '#89b8a4'
                    : isDark
                      ? '#395069'
                      : '#d8cab9',
                  background: perk.unlocked
                    ? isDark
                      ? 'rgba(37,65,58,0.36)'
                      : 'rgba(217,240,231,0.55)'
                    : isDark
                      ? 'rgba(27,40,57,0.72)'
                      : 'rgba(255,251,245,0.9)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold" style={{ color: isDark ? '#e7effb' : '#25374c' }}>
                    {perk.title}
                  </p>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ background: isDark ? 'rgba(73,94,120,0.5)' : '#ebe2d6', color: isDark ? '#d1def0' : '#556d88' }}>
                    {perk.rarity}
                  </span>
                </div>
                <p className="mt-1 text-xs" style={{ color: isDark ? '#9fb3cc' : '#6d8098' }}>
                  {perk.description}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {quests.length > 0 && (
        <section
          className="rounded-2xl border p-3"
          style={{
            borderColor: isDark ? '#33495f' : '#d8ccbb',
            background: isDark ? 'rgba(20,31,45,0.72)' : 'rgba(255,255,255,0.74)',
          }}
        >
          <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: isDark ? '#97abc6' : '#6c819a' }}>
            <Target className="h-4 w-4" />
            Ziele
            <InfoHint
              isDark={isDark}
              text="Ziele sind klare Aufgaben mit Fortschritt. Wenn ein Ziel voll ist, gilt es als abgeschlossen."
            />
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {quests.map((quest) => (
              <article
                key={quest.id}
                className="flex items-center gap-3 rounded-xl border px-3 py-2"
                style={{
                  borderColor:
                    quest.status === 'completed'
                      ? isDark
                        ? '#4f8b7a'
                        : '#89b8a4'
                      : isDark
                        ? '#395069'
                        : '#d8cab9',
                  background:
                    quest.status === 'completed'
                      ? isDark
                        ? 'rgba(37,65,58,0.34)'
                        : 'rgba(217,240,231,0.52)'
                      : isDark
                        ? 'rgba(27,40,57,0.72)'
                        : 'rgba(255,251,245,0.9)',
                }}
              >
                <QuestDial
                  progress={quest.progress}
                  target={quest.target}
                  completed={quest.status === 'completed'}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" style={{ color: isDark ? '#e7effb' : '#25374c' }}>
                    {quest.title}
                  </p>
                  <p className="truncate text-xs" style={{ color: isDark ? '#9fb3cc' : '#6d8098' }}>
                    {quest.reward}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default PersonalityProgressBoard;


