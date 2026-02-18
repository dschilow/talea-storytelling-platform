import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  CheckCircle2,
  Compass,
  FlaskConical,
  GitBranch,
  Lock,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';

import type { AvatarMemory, AvatarProgression } from '../../types/avatar';

type MapNodeStatus = 'new' | 'active' | 'complete';
type MapNodeKind =
  | 'start'
  | 'doku'
  | 'story'
  | 'quiz'
  | 'activity'
  | 'branch-unlock'
  | 'branch-grow'
  | 'quest'
  | 'perk'
  | 'future';

interface MapNode {
  id: string;
  kind: MapNodeKind;
  status: MapNodeStatus;
  title: string;
  subtitle: string;
  detail: string;
  y: number;
  x: number;
  progress: number;
  parentId?: string;
  lane: 'main' | 'branch' | 'future';
}

interface AvatarLearningWorldMapProps {
  memories: AvatarMemory[];
  progression?: AvatarProgression | null;
  isDark: boolean;
}

interface PathPoint {
  y: number;
  x: number;
}

const MAP_TILE_HEIGHT = 3072;
const ROAD_POINTS: PathPoint[] = [
  { y: 0, x: 65.43 },
  { y: 0.0417, x: 39.35 },
  { y: 0.0833, x: 49.22 },
  { y: 0.125, x: 69.58 },
  { y: 0.1667, x: 33.01 },
  { y: 0.2083, x: 61.84 },
  { y: 0.25, x: 40.43 },
  { y: 0.2917, x: 41.47 },
  { y: 0.3333, x: 58.25 },
  { y: 0.375, x: 51.08 },
  { y: 0.4167, x: 44.08 },
  { y: 0.4583, x: 64.0 },
  { y: 0.5, x: 47.97 },
  { y: 0.5417, x: 34.93 },
  { y: 0.5833, x: 63.76 },
  { y: 0.625, x: 47.25 },
  { y: 0.6667, x: 34.57 },
  { y: 0.7083, x: 61.15 },
  { y: 0.75, x: 43.1 },
  { y: 0.7917, x: 35.42 },
  { y: 0.8333, x: 61.96 },
  { y: 0.875, x: 58.73 },
  { y: 0.9167, x: 38.93 },
  { y: 0.9583, x: 45.45 },
  { y: 1, x: 65.43 },
];
const BRANCH_OFFSETS = [-15, 15, -12, 12, -16, 16];

const DOMAIN_LABELS: Record<string, string> = {
  history: 'Geschichte',
  science: 'Wissenschaft',
  geography: 'Geografie',
  physics: 'Physik',
  biology: 'Biologie',
  chemistry: 'Chemie',
  mathematics: 'Mathematik',
  astronomy: 'Astronomie',
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toDomainLabel = (raw: string) => DOMAIN_LABELS[raw] || raw;

const getNodeIcon = (kind: MapNodeKind) => {
  if (kind === 'start') return Compass;
  if (kind === 'doku') return FlaskConical;
  if (kind === 'story') return BookOpen;
  if (kind === 'quiz') return Target;
  if (kind === 'activity') return Sparkles;
  if (kind === 'branch-unlock') return GitBranch;
  if (kind === 'branch-grow') return GitBranch;
  if (kind === 'quest') return Target;
  if (kind === 'perk') return Trophy;
  return Lock;
};

const getNodeStatusLabel = (status: MapNodeStatus) => {
  if (status === 'complete') return 'Done';
  if (status === 'active') return 'Aktiv';
  return 'Neu';
};

const getNodeStatusColors = (status: MapNodeStatus, isDark: boolean) => {
  if (status === 'complete') {
    return {
      border: isDark ? '#4f8b7a' : '#89b8a4',
      bg: isDark ? 'rgba(37,65,58,0.38)' : 'rgba(217,240,231,0.64)',
      text: isDark ? '#d7f2e8' : '#2f6550',
    };
  }
  if (status === 'active') {
    return {
      border: isDark ? '#4e6a89' : '#9ab4d3',
      bg: isDark ? 'rgba(39,52,71,0.5)' : 'rgba(227,236,248,0.7)',
      text: isDark ? '#d8e7fa' : '#3e5977',
    };
  }
  return {
    border: isDark ? '#3b5068' : '#d7c9b7',
    bg: isDark ? 'rgba(27,40,57,0.74)' : 'rgba(255,251,245,0.9)',
    text: isDark ? '#b5c8df' : '#687f99',
  };
};

const getMemoryKind = (memory: AvatarMemory): MapNodeKind => {
  if (memory.contentType === 'doku') return 'doku';
  if (memory.contentType === 'quiz') return 'quiz';
  if (memory.contentType === 'activity') return 'activity';
  return 'story';
};

const getMemoryDomains = (memory: AvatarMemory): string[] =>
  (memory.personalityChanges || [])
    .map((entry) => entry.trait)
    .filter((trait) => trait.startsWith('knowledge.'))
    .map((trait) => trait.split('.')[1] || '')
    .filter((trait) => trait.length > 0);

const pathXAtPercent = (percent: number) => {
  const normalized = clamp(percent, 0, 1);
  for (let index = 1; index < ROAD_POINTS.length; index += 1) {
    const left = ROAD_POINTS[index - 1];
    const right = ROAD_POINTS[index];
    if (normalized <= right.y) {
      const segment = Math.max(0.0001, right.y - left.y);
      const t = clamp((normalized - left.y) / segment, 0, 1);
      return left.x + (right.x - left.x) * t;
    }
  }
  return ROAD_POINTS[ROAD_POINTS.length - 1].x;
};

const pathXAtY = (y: number) => {
  const local = ((y % MAP_TILE_HEIGHT) + MAP_TILE_HEIGHT) % MAP_TILE_HEIGHT;
  return pathXAtPercent(local / MAP_TILE_HEIGHT);
};

const buildPathForHeight = (mapHeight: number) => {
  if (mapHeight <= 0) return '';
  const tileCount = Math.ceil(mapHeight / MAP_TILE_HEIGHT) + 1;
  let d = '';

  for (let tile = 0; tile < tileCount; tile += 1) {
    const baseY = tile * MAP_TILE_HEIGHT;
    for (let index = 0; index < ROAD_POINTS.length; index += 1) {
      const point = ROAD_POINTS[index];
      const x = point.x;
      const y = baseY + point.y * MAP_TILE_HEIGHT;
      if (index === 0 && tile === 0) {
        d += `M ${x} ${y}`;
        continue;
      }
      const prev = ROAD_POINTS[index - 1 >= 0 ? index - 1 : ROAD_POINTS.length - 1];
      const prevBase = index === 0 ? (tile - 1) * MAP_TILE_HEIGHT : baseY;
      const prevY = prevBase + prev.y * MAP_TILE_HEIGHT;
      const prevX = prev.x;
      const dy = y - prevY;
      const c1y = prevY + dy * 0.45;
      const c2y = y - dy * 0.45;
      d += ` C ${prevX} ${c1y}, ${x} ${c2y}, ${x} ${y}`;
    }
  }

  return d;
};

const buildBranchPath = (source: MapNode, target: MapNode) => {
  const deltaY = target.y - source.y;
  const c1x = source.x + (target.x - source.x) * 0.58;
  const c2x = target.x - (target.x - source.x) * 0.24;
  const c1y = source.y + deltaY * 0.22;
  const c2y = target.y - deltaY * 0.3;
  return `M ${source.x} ${source.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${target.x} ${target.y}`;
};

export const AvatarLearningWorldMap: React.FC<AvatarLearningWorldMapProps> = ({
  memories,
  progression,
  isDark,
}) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();
  const [futureDepth, setFutureDepth] = useState(14);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');

  const stats = useMemo(() => {
    const storyCount = memories.filter((entry) => (entry.contentType || 'story') === 'story').length;
    const dokuCount = memories.filter((entry) => entry.contentType === 'doku').length;
    return {
      stories: progression?.stats?.storiesRead ?? storyCount,
      dokus: progression?.stats?.dokusRead ?? dokuCount,
      quests:
        progression?.stats?.completedQuests ??
        progression?.quests?.filter((quest) => quest.status === 'completed').length ??
        0,
      level: progression?.overallLevel ?? 1,
    };
  }, [memories, progression]);

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;

    const onScroll = () => {
      if (element.scrollTop + element.clientHeight >= element.scrollHeight - 220) {
        setFutureDepth((current) => current + 8);
      }
    };

    element.addEventListener('scroll', onScroll);
    return () => element.removeEventListener('scroll', onScroll);
  }, []);

  const nodes = useMemo<MapNode[]>(() => {
    const sortedMemories = [...memories].sort(
      (a, b) =>
        new Date(a.createdAt || a.timestamp || '').getTime() -
        new Date(b.createdAt || b.timestamp || '').getTime()
    );

    const result: MapNode[] = [];
    const mainIds: string[] = [];
    let y = 130;

    const startNode: MapNode = {
      id: 'map-start',
      kind: 'start',
      status: 'complete',
      title: 'Startlager',
      subtitle: 'Deine Weltreise beginnt',
      detail: 'Mit jeder Story und Doku waechst die Karte automatisch weiter nach unten.',
      y,
      x: pathXAtY(y),
      progress: 100,
      lane: 'main',
    };
    result.push(startNode);
    mainIds.push(startNode.id);

    const branchDepth = new Map<string, number>();

    sortedMemories.forEach((memory, memoryIndex) => {
      y += 180;
      const kind = getMemoryKind(memory);
      const progress = clamp(
        24 + Math.round(Math.abs(memory.personalityChanges?.length || 1) * 14),
        14,
        100
      );

      const mainNode: MapNode = {
        id: `memory-${memory.id}`,
        kind,
        status: 'complete',
        title: memory.storyTitle || 'Neue Etappe',
        subtitle: (memory.contentType || 'story').toUpperCase(),
        detail: memory.experience || 'Neue Erinnerung gespeichert.',
        y,
        x: pathXAtY(y),
        progress,
        parentId: mainIds[mainIds.length - 1],
        lane: 'main',
      };
      result.push(mainNode);
      mainIds.push(mainNode.id);

      if (kind === 'doku') {
        const domains = getMemoryDomains(memory);
        domains.forEach((domain, domainIndex) => {
          const current = branchDepth.get(domain) || 0;
          const nextDepth = current + 1;
          branchDepth.set(domain, nextDepth);

          y += 118;
          const branchX = clamp(
            mainNode.x + BRANCH_OFFSETS[(memoryIndex + domainIndex) % BRANCH_OFFSETS.length],
            16,
            84
          );

          result.push({
            id: `branch-${domain}-${memory.id}-${domainIndex}`,
            kind: current === 0 ? 'branch-unlock' : 'branch-grow',
            status: current === 0 ? 'new' : 'active',
            title: current === 0 ? `Neuer Zweig: ${toDomainLabel(domain)}` : `${toDomainLabel(domain)} vertieft`,
            subtitle: `Stufe ${nextDepth}`,
            detail:
              current === 0
                ? 'Neue Doku-Kategorie freigeschaltet: dieser Abzweig bleibt dauerhaft sichtbar.'
                : 'Durch weitere Dokus in derselben Kategorie waechst dieser Zweig weiter.',
            y,
            x: branchX,
            progress: clamp(nextDepth * 24, 10, 100),
            parentId: mainNode.id,
            lane: 'branch',
          });
        });
      }
    });

    const activeQuest = progression?.quests?.find((quest) => quest.status === 'active');
    if (activeQuest) {
      y += 176;
      const progress = clamp(Math.round((activeQuest.progress / Math.max(1, activeQuest.target)) * 100), 0, 100);
      const node: MapNode = {
        id: `quest-${activeQuest.id}`,
        kind: 'quest',
        status: 'active',
        title: activeQuest.title,
        subtitle: `${activeQuest.progress}/${activeQuest.target}`,
        detail: `${activeQuest.description} Belohnung: ${activeQuest.reward}.`,
        y,
        x: pathXAtY(y),
        progress,
        parentId: mainIds[mainIds.length - 1],
        lane: 'main',
      };
      result.push(node);
      mainIds.push(node.id);
    }

    const nextPerk = progression?.perks?.find((perk) => !perk.unlocked);
    if (nextPerk) {
      y += 176;
      const progress = clamp(Math.round((nextPerk.currentValue / Math.max(1, nextPerk.requiredValue)) * 100), 0, 100);
      const node: MapNode = {
        id: `perk-${nextPerk.id}`,
        kind: 'perk',
        status: 'active',
        title: `Naechster Perk: ${nextPerk.title}`,
        subtitle: `${nextPerk.currentValue}/${nextPerk.requiredValue}`,
        detail: `${nextPerk.description} Wird automatisch freigeschaltet, sobald der Wert erreicht ist.`,
        y,
        x: pathXAtY(y),
        progress,
        parentId: mainIds[mainIds.length - 1],
        lane: 'main',
      };
      result.push(node);
      mainIds.push(node.id);
    }

    for (let index = 0; index < futureDepth; index += 1) {
      y += 176;
      const node: MapNode = {
        id: `future-${index}`,
        kind: 'future',
        status: 'new',
        title: `Unbekannte Region ${index + 1}`,
        subtitle: 'Wird beim Weiterlesen freigeschaltet',
        detail: 'Lies mehr Dokus/Storys, damit hier echte Stationen entstehen.',
        y,
        x: pathXAtY(y),
        progress: 0,
        parentId: mainIds[mainIds.length - 1],
        lane: 'future',
      };
      result.push(node);
      mainIds.push(node.id);
    }

    return result;
  }, [futureDepth, memories, progression?.perks, progression?.quests]);

  const branchPaths = useMemo(() => {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    return nodes
      .filter((node) => node.parentId && node.lane === 'branch')
      .map((node) => {
        const parent = byId.get(node.parentId!);
        if (!parent) return null;
        return { id: `${parent.id}-${node.id}`, path: buildBranchPath(parent, node) };
      })
      .filter((entry): entry is { id: string; path: string } => Boolean(entry));
  }, [nodes]);

  useEffect(() => {
    if (!nodes.length) return;
    if (!nodes.some((node) => node.id === selectedNodeId)) {
      const latestReal = [...nodes].reverse().find((node) => node.kind !== 'future');
      setSelectedNodeId((latestReal || nodes[0]).id);
    }
  }, [nodes, selectedNodeId]);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || nodes[0];
  const mapHeight = (nodes[nodes.length - 1]?.y || 180) + 260;
  const roadPath = buildPathForHeight(mapHeight);

  return (
    <section
      className="rounded-3xl border p-3 sm:p-4"
      style={{
        borderColor: isDark ? '#2e445b' : '#d9ccbb',
        background: isDark
          ? 'linear-gradient(180deg, rgba(17,27,41,0.96) 0%, rgba(15,24,37,0.96) 100%)'
          : 'linear-gradient(180deg, rgba(250,246,240,0.95) 0%, rgba(245,238,229,0.95) 100%)',
      }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: isDark ? '#9bb0cb' : '#6d829b' }}>
            Game Lernwelt
          </p>
          <p className="text-sm font-semibold" style={{ color: isDark ? '#e6effb' : '#24374d' }}>
            Pfad folgt exakt der Karte
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <HudBadge label="Storys" value={stats.stories} isDark={isDark} />
          <HudBadge label="Dokus" value={stats.dokus} isDark={isDark} />
          <HudBadge label="Quests" value={stats.quests} isDark={isDark} />
          <HudBadge label="Lvl" value={stats.level} isDark={isDark} />
        </div>
      </div>

      <div
        ref={mapRef}
        className="relative h-[74vh] min-h-[520px] overflow-y-auto rounded-3xl border"
        style={{
          borderColor: isDark ? '#365069' : '#d3c4b2',
          backgroundImage: "url('/assets/lernpfad_high.jpg')",
          backgroundRepeat: 'repeat-y',
          backgroundSize: `100% ${MAP_TILE_HEIGHT}px`,
          backgroundPosition: 'center top',
          backgroundColor: isDark ? '#1a2a3f' : '#edf2df',
          filter: isDark ? 'saturate(0.72) brightness(0.78)' : 'none',
        }}
      >
        {!reduceMotion && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 10 }).map((_, index) => (
              <motion.div
                key={`spark-${index}`}
                className="absolute rounded-full"
                style={{
                  width: `${5 + (index % 3) * 2}px`,
                  height: `${5 + (index % 3) * 2}px`,
                  left: `${8 + ((index * 11) % 80)}%`,
                  top: `${7 + ((index * 9) % 88)}%`,
                  background: isDark ? 'rgba(180,220,255,0.28)' : 'rgba(150,199,255,0.3)',
                  boxShadow: isDark ? '0 0 12px rgba(166,211,255,0.3)' : '0 0 10px rgba(126,173,225,0.24)',
                }}
                animate={{ y: [0, -16, 0], opacity: [0.14, 0.32, 0.14] }}
                transition={{ duration: 3.4 + index * 0.26, repeat: Infinity, ease: 'easeInOut' }}
              />
            ))}
          </div>
        )}

        <div className="relative" style={{ height: `${mapHeight}px` }}>
          <svg className="pointer-events-none absolute left-0 top-0 w-full" height={mapHeight} viewBox={`0 0 100 ${mapHeight}`} preserveAspectRatio="none">
            <motion.path
              d={roadPath}
              stroke={isDark ? 'rgba(150,198,255,0.82)' : 'rgba(124,174,235,0.84)'}
              strokeWidth={2.2}
              fill="none"
              strokeLinecap="round"
              strokeDasharray="12 11"
              animate={reduceMotion ? undefined : { strokeDashoffset: [0, -88] }}
              transition={reduceMotion ? undefined : { duration: 3.6, repeat: Infinity, ease: 'linear' }}
            />
            {branchPaths.map((entry) => (
              <motion.path
                key={entry.id}
                d={entry.path}
                stroke={isDark ? 'rgba(154,214,165,0.76)' : 'rgba(125,186,138,0.8)'}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeDasharray="6 8"
                animate={reduceMotion ? undefined : { strokeDashoffset: [0, -32] }}
                transition={reduceMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: 'linear' }}
              />
            ))}
          </svg>

          {nodes.map((node, index) => {
            const Icon = getNodeIcon(node.kind);
            const colors = getNodeStatusColors(node.status, isDark);
            const selected = selectedNode?.id === node.id;
            const isFuture = node.kind === 'future';

            return (
              <motion.button
                key={node.id}
                type="button"
                onClick={() => setSelectedNodeId(node.id)}
                className="absolute h-20 w-20 rounded-full border p-2 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7f96c8]"
                style={{
                  top: `${node.y - 40}px`,
                  left: `calc(${node.x}% - 40px)`,
                  borderColor: colors.border,
                  background: colors.bg,
                  boxShadow: selected
                    ? isDark
                      ? '0 0 0 2px rgba(160,191,230,0.56), 0 12px 26px rgba(9,16,24,0.38)'
                      : '0 0 0 2px rgba(108,138,176,0.5), 0 10px 22px rgba(77,93,112,0.22)'
                    : isDark
                      ? '0 8px 18px rgba(8,14,22,0.28)'
                      : '0 8px 18px rgba(88,102,120,0.18)',
                }}
                initial={{ opacity: 0, scale: 0.86 }}
                animate={{
                  opacity: 1,
                  scale: selected ? 1.07 : 1,
                  y: reduceMotion ? 0 : [0, -3, 0],
                }}
                transition={{
                  opacity: { duration: 0.24, delay: index * 0.015 },
                  scale: { duration: 0.2, ease: 'easeOut' },
                  y: reduceMotion
                    ? { duration: 0 }
                    : { duration: 2.9 + (index % 3) * 0.4, repeat: Infinity, ease: 'easeInOut' },
                }}
              >
                {!reduceMotion && !isFuture && node.status !== 'complete' && (
                  <motion.span
                    className="pointer-events-none absolute inset-0 rounded-full"
                    style={{ border: `2px solid ${isDark ? 'rgba(159,200,238,0.44)' : 'rgba(132,169,210,0.46)'}` }}
                    animate={{ scale: [1, 1.22, 1], opacity: [0.62, 0.05, 0.62] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}

                <div className="relative z-10 flex h-full flex-col items-center justify-center">
                  <Icon className="h-4 w-4" style={{ color: colors.text }} />
                  <span className="mt-1 line-clamp-2 text-[9px] font-semibold leading-tight" style={{ color: isDark ? '#e4edf9' : '#2f455d' }}>
                    {node.title}
                  </span>
                  <span className="mt-0.5 rounded-full px-1.5 py-[1px] text-[8px] font-semibold uppercase tracking-[0.08em]" style={{ color: colors.text, border: `1px solid ${colors.border}`, background: isDark ? 'rgba(16,25,38,0.5)' : 'rgba(255,255,255,0.72)' }}>
                    {getNodeStatusLabel(node.status)}
                  </span>
                </div>

                {node.status === 'complete' && (
                  <CheckCircle2 className="absolute -right-1 -top-1 h-4 w-4" style={{ color: isDark ? '#8fd5b8' : '#4f9e7f' }} />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {selectedNode && (
        <motion.article
          key={selectedNode.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="mt-2 rounded-2xl border px-3 py-3"
          style={{
            borderColor: isDark ? '#3a5168' : '#d8cab9',
            background: isDark ? 'rgba(20,32,47,0.9)' : 'rgba(255,251,245,0.94)',
          }}
        >
          <p className="text-[11px] uppercase tracking-[0.1em]" style={{ color: isDark ? '#97abc6' : '#6c819a' }}>
            Aktuelle Station
          </p>
          <p className="text-sm font-semibold" style={{ color: isDark ? '#e7effb' : '#25374c' }}>
            {selectedNode.title}
          </p>
          <p className="text-xs" style={{ color: isDark ? '#a6bbd4' : '#617b98' }}>
            {selectedNode.subtitle}
          </p>
          <p className="text-xs leading-snug" style={{ color: isDark ? '#a8bdd7' : '#607a98' }}>
            {selectedNode.detail}
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: isDark ? 'rgba(71,89,110,0.62)' : 'rgba(190,204,220,0.58)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: isDark ? '#86a9d1' : '#7f96c8' }}
              initial={{ width: 0 }}
              animate={{ width: `${selectedNode.progress}%` }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
          </div>
        </motion.article>
      )}
    </section>
  );
};

const HudBadge: React.FC<{ label: string; value: number; isDark: boolean }> = ({
  label,
  value,
  isDark,
}) => (
  <div
    className="rounded-xl border px-2.5 py-1.5 text-center"
    style={{
      borderColor: isDark ? '#3a5168' : '#d8cab9',
      background: isDark ? 'rgba(28,40,57,0.72)' : 'rgba(255,255,255,0.72)',
    }}
  >
    <p className="text-[9px] uppercase tracking-[0.1em]" style={{ color: isDark ? '#99aec9' : '#6d829b' }}>
      {label}
    </p>
    <p className="text-sm font-semibold" style={{ color: isDark ? '#e7effb' : '#25374c' }}>
      {value}
    </p>
  </div>
);

export default AvatarLearningWorldMap;
