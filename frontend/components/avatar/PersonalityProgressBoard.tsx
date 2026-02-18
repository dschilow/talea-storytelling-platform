import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CircleHelp, Compass, Crown, GitBranch, Sparkles, Target, Trophy } from 'lucide-react';

import { useTheme } from '../../contexts/ThemeContext';
import type { AvatarProgression } from '../../types/avatar';

export interface PersonalityBoardTrait {
  id: string;
  label: string;
  value: number;
  subcategories: Array<{ name: string; value: number }>;
}

interface PersonalityProgressBoardProps {
  traits: PersonalityBoardTrait[];
  progression?: AvatarProgression | null;
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

type LearningNodeStatus = 'new' | 'active' | 'done';

interface LearningPathNode {
  id: string;
  lane: 'core' | 'domain' | 'quest' | 'perk';
  title: string;
  subtitle: string;
  detail: string;
  progress: number;
  status: LearningNodeStatus;
}

interface LearningPathLane {
  key: LearningPathNode['lane'];
  title: string;
  accent: string;
  nodes: LearningPathNode[];
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

const toTargetProgress = (progress: number, target: number) => {
  if (target <= 0) return 0;
  return clamp(Math.round((progress / target) * 100), 0, 100);
};

const toNodeStatus = (progress: number): LearningNodeStatus => {
  if (progress >= 100) return 'done';
  if (progress > 0) return 'active';
  return 'new';
};

const getNodeStatusLabel = (status: LearningNodeStatus) => {
  if (status === 'done') return 'Done';
  if (status === 'active') return 'Aktiv';
  return 'Neu';
};

const getTraitGrowthHint = (traitId: string, value: number) => {
  const hint = TRAIT_HINTS[traitId] || 'Steigt durch passende Lernaktivitaeten.';
  if (value <= 0) {
    return `Warum 0? ${hint}`;
  }
  return `Naechster Schritt: ${hint}`;
};

const getNodeStatusColors = (status: LearningNodeStatus, isDark: boolean) => {
  if (status === 'done') {
    return {
      border: isDark ? '#4f8b7a' : '#89b8a4',
      bg: isDark ? 'rgba(37,65,58,0.34)' : 'rgba(217,240,231,0.52)',
      text: isDark ? '#d7f2e8' : '#2f6550',
    };
  }
  if (status === 'active') {
    return {
      border: isDark ? '#4e6a89' : '#9ab4d3',
      bg: isDark ? 'rgba(39,52,71,0.4)' : 'rgba(227,236,248,0.62)',
      text: isDark ? '#d8e7fa' : '#3e5977',
    };
  }
  return {
    border: isDark ? '#3b5068' : '#d7c9b7',
    bg: isDark ? 'rgba(27,40,57,0.68)' : 'rgba(255,251,245,0.9)',
    text: isDark ? '#b5c8df' : '#687f99',
  };
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
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [selectedPathNodeId, setSelectedPathNodeId] = useState<string>('');

  const traitCards = useMemo(() => toTraitCards(traits, progression), [traits, progression]);
  const focusTrait = progression?.focusTrait
    ? traitCards.find((trait) => trait.id === progression.focusTrait)
    : traitCards[0];
  const perks = progression?.perks?.slice(0, 6) || [];
  const quests = progression?.quests?.slice(0, 4) || [];
  const knowledgeTrait = traits.find((trait) => trait.id === 'knowledge');

  const knowledgeDomains = useMemo(
    () =>
      progression?.topKnowledgeDomains?.length
        ? progression.topKnowledgeDomains.map((entry) => ({
            name: entry.name,
            value: Math.round(entry.value),
          }))
        : (knowledgeTrait?.subcategories || [])
            .slice()
            .sort((a, b) => b.value - a.value)
            .slice(0, 4)
            .map((entry) => ({
              name: entry.name,
              value: Math.round(entry.value),
            })),
    [knowledgeTrait?.subcategories, progression?.topKnowledgeDomains]
  );

  const learningPathLanes = useMemo<LearningPathLane[]>(() => {
    const storyProgress = toTargetProgress(progression?.stats?.storiesRead || 0, 12);
    const dokuProgress = toTargetProgress(progression?.stats?.dokusRead || 0, 8);
    const memoryProgress = toTargetProgress(progression?.stats?.memoryCount || 0, 24);
    const baseProgress = Math.round((storyProgress + dokuProgress + memoryProgress) / 3);

    const coreLane: LearningPathLane = {
      key: 'core',
      title: 'Pfadkern',
      accent: '#7f96c8',
      nodes: [
        {
          id: 'path-start',
          lane: 'core',
          title: 'Startzone',
          subtitle: `${progression?.stats?.storiesRead || 0} Storys / ${progression?.stats?.dokusRead || 0} Dokus`,
          detail: 'Die Startzone sammelt Aktivitaeten. Mehr Lesen oeffnet automatisch neue Zweige im Lernpfad.',
          progress: baseProgress,
          status: toNodeStatus(baseProgress),
        },
        {
          id: 'path-focus',
          lane: 'core',
          title: `Fokus: ${focusTrait?.label || 'Wissen'}`,
          subtitle: focusTrait ? `${focusTrait.value} Punkte` : 'Noch kein Fokus',
          detail: focusTrait
            ? `Aktueller Fokus ist ${focusTrait.label}. Der Ring zeigt den Weg zur naechsten Rangstufe.`
            : 'Sobald Werte wachsen, setzt das System automatisch einen Fokus.',
          progress: focusTrait?.progressToNext || 0,
          status: toNodeStatus(focusTrait?.progressToNext || 0),
        },
      ],
    };

    const domainNodes: LearningPathNode[] = knowledgeDomains.length
      ? knowledgeDomains.map((domain) => {
          const progress = toTargetProgress(domain.value, 45);
          return {
            id: `domain-${domain.name.toLowerCase().replace(/\s+/g, '-')}`,
            lane: 'domain',
            title: domain.name,
            subtitle: `${domain.value} Punkte`,
            detail: `Dieser Zweig wird automatisch erweitert, sobald neue Doku-Kategorien gelesen werden.`,
            progress,
            status: toNodeStatus(progress),
          };
        })
      : [
          {
            id: 'domain-none',
            lane: 'domain',
            title: 'Neuer Wissenszweig',
            subtitle: 'Noch nicht aktiv',
            detail: 'Lies eine Doku in einer neuen Kategorie, dann erscheint hier automatisch ein neuer Abzweig.',
            progress: 0,
            status: 'new',
          },
        ];

    const questNodes: LearningPathNode[] = quests.length
      ? quests.map((quest) => {
          const progress = toTargetProgress(quest.progress, quest.target);
          return {
            id: `quest-${quest.id}`,
            lane: 'quest',
            title: quest.title,
            subtitle: `${quest.progress}/${quest.target}`,
            detail: `${quest.description} Belohnung: ${quest.reward}.`,
            progress,
            status: quest.status === 'completed' ? 'done' : toNodeStatus(progress),
          };
        })
      : [
          {
            id: 'quest-none',
            lane: 'quest',
            title: 'Quest folgt',
            subtitle: 'Noch keine aktive Quest',
            detail: 'Quests werden mit mehr Aktivitaet automatisch sichtbar.',
            progress: 0,
            status: 'new',
          },
        ];

    const perkNodes: LearningPathNode[] = perks.length
      ? perks.slice(0, 4).map((perk) => {
          const progress = perk.unlocked
            ? 100
            : toTargetProgress(perk.currentValue, Math.max(1, perk.requiredValue));
          return {
            id: `perk-${perk.id}`,
            lane: 'perk',
            title: perk.title,
            subtitle: perk.unlocked
              ? 'Freigeschaltet'
              : `${perk.currentValue}/${perk.requiredValue} Punkte`,
            detail: `${perk.description} Trait: ${perk.trait}.`,
            progress,
            status: perk.unlocked ? 'done' : toNodeStatus(progress),
          };
        })
      : [
          {
            id: 'perk-none',
            lane: 'perk',
            title: 'Perk-Slot',
            subtitle: 'Noch nicht freigeschaltet',
            detail: 'Perks werden automatisch aktiv, wenn die noetigen Punkte erreicht sind.',
            progress: 0,
            status: 'new',
          },
        ];

    return [
      coreLane,
      { key: 'domain', title: 'Wissenszweige', accent: '#8db57f', nodes: domainNodes },
      { key: 'quest', title: 'Missionen', accent: '#d5bdaf', nodes: questNodes },
      { key: 'perk', title: 'Belohnungen', accent: '#b79f8e', nodes: perkNodes },
    ];
  }, [focusTrait, knowledgeDomains, perks, progression?.stats?.dokusRead, progression?.stats?.memoryCount, progression?.stats?.storiesRead, quests]);

  const learningPathNodes = useMemo(
    () => learningPathLanes.flatMap((lane) => lane.nodes),
    [learningPathLanes]
  );

  useEffect(() => {
    if (!learningPathNodes.length) return;
    if (!learningPathNodes.some((node) => node.id === selectedPathNodeId)) {
      setSelectedPathNodeId(learningPathNodes[0].id);
    }
  }, [learningPathNodes, selectedPathNodeId]);

  const selectedPathNode =
    learningPathNodes.find((node) => node.id === selectedPathNodeId) || learningPathNodes[0];

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

      <section
        className="rounded-2xl border p-3"
        style={{
          borderColor: isDark ? '#344b63' : '#d8ccbb',
          background: isDark ? 'rgba(22,33,49,0.74)' : 'rgba(255,255,255,0.75)',
        }}
      >
        <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: isDark ? '#97abc6' : '#6c819a' }}>
          <GitBranch className="h-4 w-4" />
          Interaktive Lernpfad-Karte
          <InfoHint
            isDark={isDark}
            text="Neue Doku-Kategorien erzeugen automatisch neue Wissenszweige. Bestehende Zweige erweitern sich mit jedem weiteren Lese-Impuls."
          />
        </p>
        <p className="mb-2 text-[11px]" style={{ color: isDark ? '#9eb4ce' : '#67819d' }}>
          Auto-Update: Sobald neue Progress-Daten ankommen, werden Stationen und Abzweigungen neu berechnet.
        </p>

        <div className="overflow-x-auto pb-2">
          <div className="relative flex min-w-[980px] gap-3 pr-1">
            <div
              className="pointer-events-none absolute left-5 right-5 top-4 h-px"
              style={{ background: isDark ? 'rgba(110,129,154,0.36)' : 'rgba(148,163,184,0.5)' }}
            />
            {learningPathLanes.map((lane, laneIndex) => (
              <motion.section
                key={lane.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: laneIndex * 0.03 }}
                className="w-[230px] shrink-0"
              >
                <div
                  className="rounded-xl border px-2.5 py-2"
                  style={{
                    borderColor: isDark ? '#3b5168' : '#d8cab9',
                    background: isDark ? 'rgba(29,43,61,0.72)' : 'rgba(255,251,245,0.9)',
                  }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: isDark ? '#a6bbd4' : '#607a98' }}>
                    {lane.title}
                  </p>
                  <div
                    className="mt-1 h-1.5 rounded-full"
                    style={{ background: lane.accent }}
                  />
                </div>

                <div className="mt-2 space-y-2">
                  {lane.nodes.map((node) => {
                    const colors = getNodeStatusColors(node.status, isDark);
                    const selected = selectedPathNode?.id === node.id;

                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => setSelectedPathNodeId(node.id)}
                        className="w-full rounded-xl border px-2.5 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7f96c8]"
                        style={{
                          borderColor: colors.border,
                          background: colors.bg,
                          boxShadow: selected
                            ? isDark
                              ? '0 0 0 1px rgba(160,191,230,0.5)'
                              : '0 0 0 1px rgba(108,138,176,0.45)'
                            : 'none',
                        }}
                        aria-label={`Lernpfad Station ${node.title}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold" style={{ color: isDark ? '#e6eefb' : '#25374c' }}>
                              {node.title}
                            </p>
                            <p className="truncate text-[10px]" style={{ color: isDark ? '#a2b7d1' : '#607a98' }}>
                              {node.subtitle}
                            </p>
                          </div>
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]"
                            style={{ color: colors.text, border: `1px solid ${colors.border}` }}
                          >
                            {getNodeStatusLabel(node.status)}
                          </span>
                        </div>
                        <div
                          className="mt-1.5 h-1.5 overflow-hidden rounded-full"
                          style={{ background: isDark ? 'rgba(71,89,110,0.62)' : 'rgba(190,204,220,0.58)' }}
                        >
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: lane.accent }}
                            initial={{ width: 0 }}
                            animate={{ width: `${node.progress}%` }}
                            transition={{ duration: 0.34, ease: 'easeOut' }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.section>
            ))}
          </div>
        </div>

        {selectedPathNode && (
          <motion.article
            key={selectedPathNode.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="mt-2 rounded-xl border px-3 py-2"
            style={{
              borderColor: isDark ? '#3a5168' : '#d8cab9',
              background: isDark ? 'rgba(21,33,48,0.86)' : 'rgba(255,251,245,0.92)',
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.1em]" style={{ color: isDark ? '#97abc6' : '#6c819a' }}>
              Station Detail
            </p>
            <p className="text-sm font-semibold" style={{ color: isDark ? '#e7effb' : '#25374c' }}>
              {selectedPathNode.title}
            </p>
            <p className="text-xs leading-snug" style={{ color: isDark ? '#a8bdd7' : '#607a98' }}>
              {selectedPathNode.detail}
            </p>
            <p className="mt-1 text-[11px]" style={{ color: isDark ? '#9fb3cd' : '#68829f' }}>
              Fortschritt: {selectedPathNode.progress}%
            </p>
          </motion.article>
        )}
      </section>

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


