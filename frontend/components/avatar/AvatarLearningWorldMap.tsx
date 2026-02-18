
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Atom,
  BookOpen,
  Brain,
  CheckCircle2,
  Compass,
  Dna,
  FlaskConical,
  Globe2,
  Landmark,
  Lock,
  Sigma,
  Sparkles,
  Target,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { AvatarMemory, AvatarProgression } from '../../types/avatar';

type MapNodeStatus = 'locked' | 'active' | 'complete';
type MapNodeKind = 'hub' | 'category' | 'milestone' | 'future';

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
  domainId?: string;
  parentId?: string;
  lane: 'main' | 'branch' | 'future';
}

interface DomainProgress {
  id: string;
  label: string;
  docsRead: number;
  xp: number;
  level: number;
  milestonesUnlocked: number;
  nextMilestoneXp: number | null;
  progressToNext: number;
  lastLearnedAt?: string;
  recentDocTitles: string[];
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

const MAP_BACKGROUND_IMAGE = '/assets/lernpfad_no_path.png';
const MAP_IMAGE_WIDTH = 554;
const MAP_IMAGE_HEIGHT = 2048;
const MILESTONES = [30, 70, 120, 180, 260, 360];
const BRANCH_OFFSETS = [-15, 15, -18, 18, -21, 21];

const ROAD_POINTS: PathPoint[] = [
  { y: 0, x: 61 },
  { y: 0.045, x: 52 },
  { y: 0.09, x: 40 },
  { y: 0.14, x: 33 },
  { y: 0.19, x: 45 },
  { y: 0.24, x: 60 },
  { y: 0.29, x: 67 },
  { y: 0.34, x: 57 },
  { y: 0.39, x: 44 },
  { y: 0.44, x: 33 },
  { y: 0.49, x: 31 },
  { y: 0.54, x: 43 },
  { y: 0.59, x: 58 },
  { y: 0.64, x: 66 },
  { y: 0.69, x: 57 },
  { y: 0.74, x: 45 },
  { y: 0.79, x: 34 },
  { y: 0.84, x: 33 },
  { y: 0.89, x: 47 },
  { y: 0.94, x: 61 },
  { y: 1, x: 57 },
];

const DOMAIN_LABELS: Record<string, string> = {
  history: 'Geschichte',
  science: 'Wissenschaft',
  geography: 'Geografie',
  physics: 'Physik',
  biology: 'Biologie',
  chemistry: 'Chemie',
  mathematics: 'Mathematik',
  astronomy: 'Astronomie',
  general: 'Allgemeinwissen',
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeDomainId = (raw: string) =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'general';

const toDomainLabel = (raw: string) => {
  const normalized = normalizeDomainId(raw);
  return DOMAIN_LABELS[normalized] || raw;
};

const formatLearnedAt = (dateString?: string) => {
  if (!dateString) return 'Noch keine Doku gelesen';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Unbekanntes Datum';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const getMemoryDomains = (memory: AvatarMemory): string[] => {
  const raw = (memory.personalityChanges || [])
    .map((entry) => entry.trait)
    .filter((trait) => trait.startsWith('knowledge.'))
    .map((trait) => trait.split('.')[1] || '')
    .filter((value) => value.length > 0);

  return Array.from(new Set(raw));
};

const getNodeIcon = (node: MapNode, domainLabel?: string): LucideIcon => {
  if (node.kind === 'hub') return Compass;
  if (node.kind === 'future') return Lock;
  if (node.kind === 'milestone') return Target;

  const id = normalizeDomainId(domainLabel || node.domainId || '');
  if (id.includes('phys')) return Atom;
  if (id.includes('chem')) return FlaskConical;
  if (id.includes('bio')) return Dna;
  if (id.includes('geo')) return Globe2;
  if (id.includes('mathe') || id.includes('math')) return Sigma;
  if (id.includes('hist')) return Landmark;
  if (id.includes('astro')) return Sparkles;
  if (id.includes('science') || id.includes('wissen')) return Brain;
  return BookOpen;
};

const getNodeStatusLabel = (status: MapNodeStatus) => {
  if (status === 'complete') return 'Done';
  if (status === 'active') return 'Aktiv';
  return 'Locked';
};

const getNodeStatusColors = (status: MapNodeStatus, isDark: boolean) => {
  if (status === 'complete') {
    return {
      border: isDark ? '#5ca187' : '#7ab89a',
      bg: isDark ? 'rgba(38,74,63,0.68)' : 'rgba(216,240,226,0.82)',
      text: isDark ? '#d6f3e7' : '#2f6950',
    };
  }

  if (status === 'active') {
    return {
      border: isDark ? '#739cd4' : '#8cb2df',
      bg: isDark ? 'rgba(38,55,80,0.72)' : 'rgba(220,231,246,0.86)',
      text: isDark ? '#deebff' : '#355476',
    };
  }

  return {
    border: isDark ? '#4e637f' : '#dbcdb8',
    bg: isDark ? 'rgba(21,34,50,0.76)' : 'rgba(255,251,243,0.9)',
    text: isDark ? '#a8bed8' : '#6c829b',
  };
};

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

const pathXAtY = (y: number, tileHeight: number) => {
  const local = ((y % tileHeight) + tileHeight) % tileHeight;
  return pathXAtPercent(local / tileHeight);
};

const buildPathForHeight = (mapHeight: number, tileHeight: number) => {
  if (mapHeight <= 0 || tileHeight <= 0) return '';
  const tileCount = Math.ceil(mapHeight / tileHeight) + 1;
  let d = '';

  for (let tile = 0; tile < tileCount; tile += 1) {
    const baseY = tile * tileHeight;
    for (let index = 0; index < ROAD_POINTS.length; index += 1) {
      const point = ROAD_POINTS[index];
      const x = point.x;
      const y = baseY + point.y * tileHeight;

      if (index === 0 && tile === 0) {
        d += `M ${x} ${y}`;
        continue;
      }

      const prev = ROAD_POINTS[index - 1 >= 0 ? index - 1 : ROAD_POINTS.length - 1];
      const prevBase = index === 0 ? (tile - 1) * tileHeight : baseY;
      const prevY = prevBase + prev.y * tileHeight;
      const prevX = prev.x;
      const dy = y - prevY;
      const c1y = prevY + dy * 0.46;
      const c2y = y - dy * 0.46;
      d += ` C ${prevX} ${c1y}, ${x} ${c2y}, ${x} ${y}`;
    }
  }

  return d;
};

const buildBranchPath = (source: MapNode, target: MapNode) => {
  const deltaY = target.y - source.y;
  const c1x = source.x + (target.x - source.x) * 0.6;
  const c2x = target.x - (target.x - source.x) * 0.26;
  const c1y = source.y + deltaY * 0.24;
  const c2y = target.y - deltaY * 0.34;
  return `M ${source.x} ${source.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${target.x} ${target.y}`;
};

const getMilestoneStatus = (xp: number, threshold: number, isNext: boolean): MapNodeStatus => {
  if (xp >= threshold) return 'complete';
  if (isNext) return 'active';
  return 'locked';
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
  const [expandedDomainId, setExpandedDomainId] = useState<string>('');
  const [mapWidth, setMapWidth] = useState(420);
  const [scrollTop, setScrollTop] = useState(0);
  const futureGrowthGateRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);

  const tileHeight = useMemo(() => {
    const safeWidth = Math.max(320, mapWidth);
    return Math.round((safeWidth / MAP_IMAGE_WIDTH) * MAP_IMAGE_HEIGHT);
  }, [mapWidth]);

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

    const updateWidth = () => {
      if (element.clientWidth > 0) {
        setMapWidth(element.clientWidth);
      }
    };

    updateWidth();
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;

    const onScroll = () => {
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current);
      }
      scrollRafRef.current = requestAnimationFrame(() => {
        const top = element.scrollTop;
        setScrollTop(top);

        const nearBottom = top + element.clientHeight >= element.scrollHeight - 240;
        if (nearBottom && top > futureGrowthGateRef.current) {
          futureGrowthGateRef.current = top + 280;
          setFutureDepth((current) => current + 8);
        }
      });
    };

    element.addEventListener('scroll', onScroll);
    return () => {
      element.removeEventListener('scroll', onScroll);
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  const domainProgress = useMemo<DomainProgress[]>(() => {
    const sortedDokuMemories = [...memories]
      .filter((memory) => memory.contentType === 'doku')
      .sort(
        (a, b) =>
          new Date(a.createdAt || a.timestamp || '').getTime() -
          new Date(b.createdAt || b.timestamp || '').getTime()
      );

    const byDomain = new Map<string, DomainProgress>();

    sortedDokuMemories.forEach((memory) => {
      const domains = getMemoryDomains(memory);
      const effectiveDomains = domains.length ? domains : ['general'];
      const uniqueDomains = Array.from(new Set(effectiveDomains));
      const domainDelta = (memory.personalityChanges || [])
        .filter((entry) => entry.trait.startsWith('knowledge.'))
        .reduce((sum, entry) => sum + Math.abs(entry.change || 0), 0);
      const xpGainBase = clamp(Math.round(domainDelta * 11) + 16, 12, 72);
      const xpGainPerDomain = Math.max(8, Math.round(xpGainBase / uniqueDomains.length));

      uniqueDomains.forEach((rawDomain) => {
        const domainId = normalizeDomainId(rawDomain);
        const existing =
          byDomain.get(domainId) ||
          ({
            id: domainId,
            label: toDomainLabel(rawDomain),
            docsRead: 0,
            xp: 0,
            level: 1,
            milestonesUnlocked: 0,
            nextMilestoneXp: MILESTONES[0],
            progressToNext: 0,
            lastLearnedAt: undefined,
            recentDocTitles: [],
          } satisfies DomainProgress);

        existing.docsRead += 1;
        existing.xp += xpGainPerDomain;
        existing.lastLearnedAt = memory.createdAt || memory.timestamp;

        if (memory.storyTitle) {
          existing.recentDocTitles = [memory.storyTitle, ...existing.recentDocTitles]
            .filter((title, index, list) => list.indexOf(title) === index)
            .slice(0, 4);
        }

        byDomain.set(domainId, existing);
      });
    });

    (progression?.topKnowledgeDomains || []).forEach((domain) => {
      const domainId = normalizeDomainId(domain.name);
      const existing =
        byDomain.get(domainId) ||
        ({
          id: domainId,
          label: toDomainLabel(domain.name),
          docsRead: 0,
          xp: 0,
          level: 1,
          milestonesUnlocked: 0,
          nextMilestoneXp: MILESTONES[0],
          progressToNext: 0,
          lastLearnedAt: undefined,
          recentDocTitles: [],
        } satisfies DomainProgress);

      existing.label = toDomainLabel(domain.name);
      existing.xp = Math.max(existing.xp, Math.round(domain.value * 2));
      byDomain.set(domainId, existing);
    });

    const entries = [...byDomain.values()].map((domain) => {
      const milestonesUnlocked = MILESTONES.filter((threshold) => domain.xp >= threshold).length;
      const nextMilestoneXp = MILESTONES.find((threshold) => threshold > domain.xp) || null;
      const progressToNext = nextMilestoneXp
        ? clamp(Math.round((domain.xp / Math.max(1, nextMilestoneXp)) * 100), 0, 100)
        : 100;

      return {
        ...domain,
        level: milestonesUnlocked + 1,
        milestonesUnlocked,
        nextMilestoneXp,
        progressToNext,
      };
    });

    if (!entries.length) {
      return [
        {
          id: 'general',
          label: 'Allgemeinwissen',
          docsRead: 0,
          xp: 0,
          level: 1,
          milestonesUnlocked: 0,
          nextMilestoneXp: MILESTONES[0],
          progressToNext: 0,
          lastLearnedAt: undefined,
          recentDocTitles: [],
        },
      ];
    }

    return entries.sort((left, right) => right.xp - left.xp);
  }, [memories, progression?.topKnowledgeDomains]);

  useEffect(() => {
    if (!domainProgress.length) return;
    if (!expandedDomainId || !domainProgress.some((domain) => domain.id === expandedDomainId)) {
      setExpandedDomainId(domainProgress[0].id);
    }
  }, [domainProgress, expandedDomainId]);

  const nodes = useMemo<MapNode[]>(() => {
    const result: MapNode[] = [];
    const mainNodeIds: string[] = [];
    let y = 140;

    const hubNode: MapNode = {
      id: 'hub-start',
      kind: 'hub',
      status: 'complete',
      title: 'Lernlager',
      subtitle: 'Start',
      detail: 'Hier beginnt deine Doku-Welt. Jeder neue Themenbereich erzeugt einen echten Zweig.',
      y,
      x: pathXAtY(y, tileHeight),
      progress: 100,
      lane: 'main',
    };
    result.push(hubNode);
    mainNodeIds.push(hubNode.id);

    domainProgress.forEach((domain, domainIndex) => {
      y += 212;
      const mainNode: MapNode = {
        id: `domain-${domain.id}`,
        kind: 'category',
        status: domain.docsRead >= 2 ? 'complete' : domain.docsRead > 0 ? 'active' : 'locked',
        title: domain.label,
        subtitle: `${domain.docsRead} Dokus - Lvl ${domain.level}`,
        detail:
          domain.docsRead > 0
            ? `${domain.docsRead} Dokus gelesen. Letzte Aktivitaet: ${formatLearnedAt(domain.lastLearnedAt)}.`
            : 'Noch keine Doku in dieser Kategorie gelesen.',
        y,
        x: pathXAtY(y, tileHeight),
        progress: domain.progressToNext,
        domainId: domain.id,
        parentId: mainNodeIds[mainNodeIds.length - 1],
        lane: 'main',
      };
      result.push(mainNode);
      mainNodeIds.push(mainNode.id);

      if (expandedDomainId === domain.id) {
        const branchTargetCount = Math.min(4, Math.max(2, domain.milestonesUnlocked + 1));
        const branchDirection = domainIndex % 2 === 0 ? -1 : 1;
        const nextMilestone = domain.nextMilestoneXp || MILESTONES[MILESTONES.length - 1];

        for (let branchIndex = 0; branchIndex < branchTargetCount; branchIndex += 1) {
          const milestoneTarget = MILESTONES[Math.min(branchIndex, MILESTONES.length - 1)];
          const isNext = milestoneTarget === nextMilestone;
          const status = getMilestoneStatus(domain.xp, milestoneTarget, isNext);
          const branchY = y + 82 + branchIndex * 88;
          const branchX = clamp(
            mainNode.x +
              branchDirection *
                Math.abs(BRANCH_OFFSETS[(domainIndex + branchIndex) % BRANCH_OFFSETS.length]),
            11,
            89
          );

          result.push({
            id: `milestone-${domain.id}-${branchIndex}`,
            kind: 'milestone',
            status,
            title: `${domain.label} ${branchIndex + 1}`,
            subtitle: `${domain.xp}/${milestoneTarget} XP`,
            detail:
              status === 'complete'
                ? 'Meilenstein abgeschlossen. Dein Lernzweig bleibt offen und sichtbar.'
                : status === 'active'
                  ? `Naechstes Ziel: ${milestoneTarget} XP in ${domain.label}.`
                  : `Gesperrt bis vorherige Etappen in ${domain.label} aktiv sind.`,
            y: branchY,
            x: branchX,
            progress: clamp(
              Math.round((domain.xp / Math.max(1, milestoneTarget)) * 100),
              0,
              100
            ),
            domainId: domain.id,
            parentId: mainNode.id,
            lane: 'branch',
          });
        }

        y += branchTargetCount * 48;
      }
    });

    for (let index = 0; index < futureDepth; index += 1) {
      y += 186;
      const futureNode: MapNode = {
        id: `future-${index}`,
        kind: 'future',
        status: 'locked',
        title: `Unbekannte Region ${index + 1}`,
        subtitle: 'Neue Doku-Kategorie schaltet frei',
        detail: 'Lies Dokus in bisher ungelesenen Kategorien, damit hier neue Abzweigungen entstehen.',
        y,
        x: pathXAtY(y, tileHeight),
        progress: 0,
        parentId: mainNodeIds[mainNodeIds.length - 1],
        lane: 'future',
      };

      result.push(futureNode);
      mainNodeIds.push(futureNode.id);
    }

    return result;
  }, [domainProgress, expandedDomainId, futureDepth, tileHeight]);

  const branchPaths = useMemo(() => {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    return nodes
      .filter((node) => node.parentId && node.lane === 'branch')
      .map((node) => {
        const parent = nodeById.get(node.parentId!);
        if (!parent) return null;
        return { id: `${parent.id}-${node.id}`, path: buildBranchPath(parent, node), status: node.status };
      })
      .filter(
        (entry): entry is { id: string; path: string; status: MapNodeStatus } => Boolean(entry)
      );
  }, [nodes]);

  useEffect(() => {
    if (!nodes.length) return;
    if (!nodes.some((node) => node.id === selectedNodeId)) {
      const firstCategory = nodes.find((node) => node.kind === 'category');
      setSelectedNodeId((firstCategory || nodes[0]).id);
    }
  }, [nodes, selectedNodeId]);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || nodes[0];
  const selectedDomain = selectedNode?.domainId
    ? domainProgress.find((domain) => domain.id === selectedNode.domainId)
    : null;
  const mapHeight = Math.max((nodes[nodes.length - 1]?.y || 220) + 260, Math.round(tileHeight * 2.2));
  const roadPath = useMemo(() => buildPathForHeight(mapHeight, tileHeight), [mapHeight, tileHeight]);
  const mapProgress = mapHeight <= 0 ? 0 : clamp((scrollTop / mapHeight) * 100, 0, 100);
  const parallaxShiftFar = reduceMotion ? 0 : scrollTop * 0.08;
  const parallaxShiftNear = reduceMotion ? 0 : scrollTop * 0.16;

  const handleNodeClick = (node: MapNode) => {
    setSelectedNodeId(node.id);

    if (node.kind === 'category' && node.domainId) {
      setExpandedDomainId((current) => (current === node.domainId ? '' : node.domainId));
      return;
    }

    if (node.kind === 'milestone' && node.domainId) {
      setExpandedDomainId(node.domainId);
    }
  };

  return (
    <section
      className="rounded-3xl border p-3 sm:p-4"
      style={{
        borderColor: isDark ? '#2d435a' : '#d8cab8',
        background: isDark
          ? 'linear-gradient(180deg, rgba(15,25,39,0.98) 0%, rgba(13,22,34,0.98) 100%)'
          : 'linear-gradient(180deg, rgba(249,245,236,0.98) 0%, rgba(245,237,227,0.98) 100%)',
      }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-[0.12em]"
            style={{ color: isDark ? '#9bb0cb' : '#6d829b' }}
          >
            Interaktive Lernpfad-Karte
          </p>
          <p className="text-sm font-semibold" style={{ color: isDark ? '#e6effb' : '#24374d' }}>
            Kategorien aus Dokus erzeugen automatisch neue Zweige
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
        className="mb-2 flex items-center justify-between gap-2 rounded-2xl border px-3 py-2"
        style={{
          borderColor: isDark ? '#3b5168' : '#d8cab9',
          background: isDark ? 'rgba(22,34,50,0.74)' : 'rgba(255,252,247,0.82)',
        }}
      >
        <div className="text-[11px] uppercase tracking-[0.1em]" style={{ color: isDark ? '#96abc6' : '#6f849e' }}>
          Kartenfortschritt
        </div>
        <div className="text-xs font-semibold" style={{ color: isDark ? '#dce8f8' : '#2b425a' }}>
          {Math.round(mapProgress)}%
        </div>
      </div>

      <div
        ref={mapRef}
        className="relative h-[74vh] min-h-[520px] overflow-y-auto rounded-3xl border"
        style={{
          borderColor: isDark ? '#365069' : '#d3c4b2',
          backgroundColor: isDark ? '#1a2a3f' : '#edf2df',
        }}
      >
        <div className="relative" style={{ height: `${mapHeight}px` }}>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `url('${MAP_BACKGROUND_IMAGE}')`,
              backgroundRepeat: 'repeat-y',
              backgroundSize: `100% ${tileHeight}px`,
              backgroundPosition: 'center top',
            }}
          />

          <motion.div
            className="pointer-events-none absolute inset-0"
            style={{
              y: -parallaxShiftFar,
              background:
                'radial-gradient(circle at 20% 18%, rgba(255,255,255,0.17), transparent 40%), radial-gradient(circle at 78% 70%, rgba(255,255,255,0.14), transparent 46%)',
              opacity: isDark ? 0.48 : 0.34,
            }}
          />

          <motion.div
            className="pointer-events-none absolute inset-0"
            style={{
              y: -parallaxShiftNear,
              background:
                'linear-gradient(180deg, rgba(7,19,35,0.3) 0%, rgba(8,20,37,0.08) 28%, rgba(8,20,37,0.22) 100%)',
              mixBlendMode: isDark ? 'normal' : 'multiply',
            }}
          />

          {!reduceMotion && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 20 }).map((_, index) => (
                <motion.div
                  key={`spark-${index}`}
                  className="absolute rounded-full"
                  style={{
                    width: `${4 + (index % 3) * 2}px`,
                    height: `${4 + (index % 3) * 2}px`,
                    left: `${6 + ((index * 9) % 86)}%`,
                    top: `${2 + ((index * 7) % 96)}%`,
                    background: isDark ? 'rgba(180,220,255,0.35)' : 'rgba(136,194,255,0.34)',
                    boxShadow:
                      isDark
                        ? '0 0 14px rgba(166,211,255,0.36)'
                        : '0 0 12px rgba(126,173,225,0.28)',
                  }}
                  animate={{ y: [0, -18, 0], opacity: [0.12, 0.38, 0.12] }}
                  transition={{ duration: 3 + index * 0.22, repeat: Infinity, ease: 'easeInOut' }}
                />
              ))}
            </div>
          )}

          <svg
            className="pointer-events-none absolute left-0 top-0 w-full"
            height={mapHeight}
            viewBox={`0 0 100 ${mapHeight}`}
            preserveAspectRatio="none"
          >
            <path
              d={roadPath}
              stroke={isDark ? 'rgba(9,16,24,0.42)' : 'rgba(40,59,82,0.18)'}
              strokeWidth={24}
              fill="none"
              strokeLinecap="round"
            />
            <path
              d={roadPath}
              stroke={isDark ? '#dbd6c5' : '#efe7d1'}
              strokeWidth={17}
              fill="none"
              strokeLinecap="round"
            />
            <path
              d={roadPath}
              stroke={isDark ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.58)'}
              strokeWidth={2.6}
              fill="none"
              strokeLinecap="round"
            />
            <motion.path
              d={roadPath}
              stroke={isDark ? 'rgba(132,186,241,0.86)' : 'rgba(104,155,221,0.8)'}
              strokeWidth={3.1}
              fill="none"
              strokeLinecap="round"
              strokeDasharray="16 13"
              animate={reduceMotion ? undefined : { strokeDashoffset: [0, -90] }}
              transition={
                reduceMotion ? undefined : { duration: 3.2, repeat: Infinity, ease: 'linear' }
              }
            />

            {branchPaths.map((entry) => (
              <motion.path
                key={entry.id}
                d={entry.path}
                stroke={
                  entry.status === 'complete'
                    ? isDark
                      ? 'rgba(145,224,167,0.82)'
                      : 'rgba(101,182,129,0.86)'
                    : entry.status === 'active'
                      ? isDark
                        ? 'rgba(144,188,240,0.82)'
                        : 'rgba(113,156,224,0.86)'
                      : isDark
                        ? 'rgba(118,138,162,0.62)'
                        : 'rgba(181,193,209,0.7)'
                }
                strokeWidth={2.2}
                fill="none"
                strokeLinecap="round"
                strokeDasharray="7 9"
                animate={reduceMotion ? undefined : { strokeDashoffset: [0, -28] }}
                transition={
                  reduceMotion ? undefined : { duration: 2.5, repeat: Infinity, ease: 'linear' }
                }
              />
            ))}
          </svg>

          {nodes.map((node, index) => {
            const domain = node.domainId
              ? domainProgress.find((entry) => entry.id === node.domainId)
              : undefined;
            const Icon = getNodeIcon(node, domain?.label);
            const colors = getNodeStatusColors(node.status, isDark);
            const selected = selectedNode?.id === node.id;
            const size = node.kind === 'category' ? 92 : node.kind === 'milestone' ? 72 : 82;

            return (
              <motion.button
                key={node.id}
                type="button"
                onClick={() => handleNodeClick(node)}
                aria-label={`${node.title} - ${node.subtitle}`}
                className="absolute rounded-full border px-2 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8aa6d4]"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  top: `${node.y - size / 2}px`,
                  left: `calc(${node.x}% - ${size / 2}px)`,
                  borderColor: colors.border,
                  background: colors.bg,
                  boxShadow: selected
                    ? isDark
                      ? '0 0 0 2px rgba(154,185,230,0.58), 0 14px 28px rgba(9,16,24,0.4)'
                      : '0 0 0 2px rgba(108,138,176,0.55), 0 12px 24px rgba(77,93,112,0.25)'
                    : isDark
                      ? '0 8px 18px rgba(8,14,22,0.3)'
                      : '0 8px 18px rgba(88,102,120,0.2)',
                }}
                initial={{ opacity: 0, scale: 0.84 }}
                animate={{
                  opacity: 1,
                  scale: selected ? 1.08 : 1,
                  y: reduceMotion ? 0 : [0, -4, 0],
                }}
                transition={{
                  opacity: { duration: 0.24, delay: index * 0.015 },
                  scale: { duration: 0.2, ease: 'easeOut' },
                  y: reduceMotion
                    ? { duration: 0 }
                    : {
                        duration: 2.6 + (index % 3) * 0.42,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      },
                }}
              >
                {!reduceMotion && node.status !== 'complete' && (
                  <motion.span
                    className="pointer-events-none absolute inset-0 rounded-full"
                    style={{
                      border: `2px solid ${
                        isDark ? 'rgba(159,200,238,0.44)' : 'rgba(132,169,210,0.46)'
                      }`,
                    }}
                    animate={{ scale: [1, 1.22, 1], opacity: [0.58, 0.04, 0.58] }}
                    transition={{ duration: 2.1, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}

                <div className="relative z-10 flex h-full flex-col items-center justify-center">
                  <Icon className="h-4.5 w-4.5" style={{ color: colors.text }} />
                  <span
                    className="mt-1 line-clamp-2 px-0.5 text-[9px] font-semibold leading-tight"
                    style={{ color: isDark ? '#ecf3fd' : '#2d435c' }}
                  >
                    {node.title}
                  </span>
                  <span
                    className="mt-0.5 rounded-full px-1.5 py-[1px] text-[8px] font-semibold uppercase tracking-[0.08em]"
                    style={{
                      color: colors.text,
                      border: `1px solid ${colors.border}`,
                      background: isDark ? 'rgba(15,24,37,0.52)' : 'rgba(255,255,255,0.74)',
                    }}
                  >
                    {getNodeStatusLabel(node.status)}
                  </span>
                </div>

                {node.status === 'complete' && (
                  <CheckCircle2
                    className="absolute -right-1 -top-1 h-4 w-4"
                    style={{ color: isDark ? '#95dfbe' : '#4f9e7f' }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selectedNode && (
          <motion.article
            key={selectedNode.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="mt-2 rounded-2xl border px-3 py-3"
            style={{
              borderColor: isDark ? '#3a5168' : '#d8cab9',
              background: isDark ? 'rgba(20,32,47,0.92)' : 'rgba(255,251,245,0.95)',
            }}
          >
            <p
              className="text-[11px] uppercase tracking-[0.1em]"
              style={{ color: isDark ? '#97abc6' : '#6c819a' }}
            >
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

            {selectedDomain && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <InfoChip label="Kategorie" value={selectedDomain.label} isDark={isDark} />
                <InfoChip label="Dokus" value={String(selectedDomain.docsRead)} isDark={isDark} />
                <InfoChip label="XP" value={String(selectedDomain.xp)} isDark={isDark} />
                <InfoChip
                  label="Zuletzt gelernt"
                  value={formatLearnedAt(selectedDomain.lastLearnedAt)}
                  isDark={isDark}
                />
              </div>
            )}

            {selectedNode.kind === 'category' && selectedNode.domainId && (
              <button
                type="button"
                onClick={() =>
                  setExpandedDomainId((current) =>
                    current === selectedNode.domainId ? '' : selectedNode.domainId || ''
                  )
                }
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors"
                style={{
                  borderColor: isDark ? '#4d6788' : '#cdbda8',
                  color: isDark ? '#dce8f8' : '#3b5472',
                  background: isDark ? 'rgba(34,50,72,0.64)' : 'rgba(255,255,255,0.82)',
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {expandedDomainId === selectedNode.domainId ? 'Zweig einklappen' : 'Zweig ausklappen'}
              </button>
            )}

            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full"
              style={{ background: isDark ? 'rgba(71,89,110,0.62)' : 'rgba(190,204,220,0.58)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: isDark ? '#86a9d1' : '#7f96c8' }}
                initial={{ width: 0 }}
                animate={{ width: `${selectedNode.progress}%` }}
                transition={{ duration: 0.32, ease: 'easeOut' }}
              />
            </div>
          </motion.article>
        )}
      </AnimatePresence>
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

const InfoChip: React.FC<{ label: string; value: string; isDark: boolean }> = ({
  label,
  value,
  isDark,
}) => (
  <div
    className="rounded-xl border px-2 py-1.5"
    style={{
      borderColor: isDark ? '#415973' : '#d6cab9',
      background: isDark ? 'rgba(30,45,64,0.62)' : 'rgba(255,255,255,0.8)',
    }}
  >
    <p className="text-[10px] uppercase tracking-[0.1em]" style={{ color: isDark ? '#9cb3cf' : '#6c829b' }}>
      {label}
    </p>
    <p className="text-[11px] font-semibold leading-tight" style={{ color: isDark ? '#e6effb' : '#2f4761' }}>
      {value}
    </p>
  </div>
);

export default AvatarLearningWorldMap;

