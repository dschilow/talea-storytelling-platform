import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
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
}

interface AvatarLearningWorldMapProps {
  memories: AvatarMemory[];
  progression?: AvatarProgression | null;
  isDark: boolean;
}

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
      bg: isDark ? 'rgba(37,65,58,0.36)' : 'rgba(217,240,231,0.6)',
      text: isDark ? '#d7f2e8' : '#2f6550',
    };
  }
  if (status === 'active') {
    return {
      border: isDark ? '#4e6a89' : '#9ab4d3',
      bg: isDark ? 'rgba(39,52,71,0.42)' : 'rgba(227,236,248,0.66)',
      text: isDark ? '#d8e7fa' : '#3e5977',
    };
  }
  return {
    border: isDark ? '#3b5068' : '#d7c9b7',
    bg: isDark ? 'rgba(27,40,57,0.7)' : 'rgba(255,251,245,0.9)',
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

const toDomainLabel = (raw: string) => DOMAIN_LABELS[raw] || raw;

const buildPath = (nodes: MapNode[]) => {
  if (nodes.length === 0) return '';
  let path = `M ${nodes[0].x} ${nodes[0].y}`;
  for (let index = 1; index < nodes.length; index += 1) {
    const prev = nodes[index - 1];
    const current = nodes[index];
    const deltaY = current.y - prev.y;
    const c1y = prev.y + deltaY * 0.42;
    const c2y = current.y - deltaY * 0.42;
    path += ` C ${prev.x} ${c1y}, ${current.x} ${c2y}, ${current.x} ${current.y}`;
  }
  return path;
};

const toNodeX = (index: number) => {
  const pattern = [50, 32, 68, 30, 70, 36, 64];
  return pattern[index % pattern.length];
};

export const AvatarLearningWorldMap: React.FC<AvatarLearningWorldMapProps> = ({
  memories,
  progression,
  isDark,
}) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [futureDepth, setFutureDepth] = useState(10);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;

    const onScroll = () => {
      if (element.scrollTop + element.clientHeight >= element.scrollHeight - 180) {
        setFutureDepth((current) => current + 6);
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
    let y = 76;
    const branchDepth = new Map<string, number>();

    result.push({
      id: 'map-start',
      kind: 'start',
      status: 'complete',
      title: 'Startinsel',
      subtitle: 'Hier beginnt der Lernpfad',
      detail: 'Mit jeder Story und Doku waechst die Karte nach oben weiter.',
      y,
      x: 50,
      progress: 100,
    });

    sortedMemories.forEach((memory, index) => {
      y += 132;
      const kind = getMemoryKind(memory);
      const progress = clamp(32 + Math.round(Math.abs(memory.personalityChanges?.length || 1) * 12), 18, 100);

      result.push({
        id: `memory-${memory.id}`,
        kind,
        status: 'complete',
        title: memory.storyTitle || 'Neue Etappe',
        subtitle: (memory.contentType || 'story').toUpperCase(),
        detail: memory.experience || 'Neue Erinnerung gespeichert.',
        y,
        x: toNodeX(index + 1),
        progress,
      });

      if (kind === 'doku') {
        const domains = getMemoryDomains(memory);
        domains.forEach((domain, domainIndex) => {
          const currentDepth = branchDepth.get(domain) || 0;
          const nextDepth = currentDepth + 1;
          branchDepth.set(domain, nextDepth);

          y += 96;
          result.push({
            id: `branch-${domain}-${memory.id}-${domainIndex}`,
            kind: currentDepth === 0 ? 'branch-unlock' : 'branch-grow',
            status: currentDepth === 0 ? 'new' : 'active',
            title:
              currentDepth === 0
                ? `Neuer Zweig: ${toDomainLabel(domain)}`
                : `${toDomainLabel(domain)} erweitert`,
            subtitle: `Stufe ${nextDepth}`,
            detail:
              currentDepth === 0
                ? 'Neue Kategorie freigeschaltet: dieser Abzweig ist jetzt Teil deiner Weltkarte.'
                : 'Dieser Zweig wird durch weitere Dokus in derselben Kategorie breiter und tiefer.',
            y,
            x: toNodeX(index + domainIndex + 2),
            progress: clamp(nextDepth * 22, 10, 100),
          });
        });
      }
    });

    const activeQuest = progression?.quests?.find((quest) => quest.status === 'active');
    if (activeQuest) {
      y += 132;
      result.push({
        id: `quest-${activeQuest.id}`,
        kind: 'quest',
        status: 'active',
        title: activeQuest.title,
        subtitle: `${activeQuest.progress}/${activeQuest.target}`,
        detail: `${activeQuest.description} Belohnung: ${activeQuest.reward}.`,
        y,
        x: toNodeX(result.length + 1),
        progress: clamp(Math.round((activeQuest.progress / Math.max(1, activeQuest.target)) * 100), 0, 100),
      });
    }

    const nextPerk = progression?.perks?.find((perk) => !perk.unlocked);
    if (nextPerk) {
      y += 132;
      result.push({
        id: `perk-${nextPerk.id}`,
        kind: 'perk',
        status: 'active',
        title: `Naechster Perk: ${nextPerk.title}`,
        subtitle: `${nextPerk.currentValue}/${nextPerk.requiredValue} Punkte`,
        detail: 'Wenn der Wert erreicht ist, wird dieser Perk automatisch freigeschaltet.',
        y,
        x: toNodeX(result.length + 1),
        progress: clamp(Math.round((nextPerk.currentValue / Math.max(1, nextPerk.requiredValue)) * 100), 0, 100),
      });
    }

    for (let index = 0; index < futureDepth; index += 1) {
      y += 126;
      result.push({
        id: `future-${index}`,
        kind: 'future',
        status: 'new',
        title: `Unbekannte Region ${index + 1}`,
        subtitle: 'Wird durch neue Inhalte freigeschaltet',
        detail: 'Lies weiter Dokus/Storys: die Weltkarte fuegt automatisch neue echte Knoten hinzu.',
        y,
        x: toNodeX(result.length + 1),
        progress: 0,
      });
    }

    return result;
  }, [futureDepth, memories, progression?.perks, progression?.quests]);

  useEffect(() => {
    if (!nodes.length) return;
    if (!nodes.some((node) => node.id === selectedNodeId)) {
      const latestRealNode = [...nodes].reverse().find((node) => node.kind !== 'future');
      setSelectedNodeId((latestRealNode || nodes[0]).id);
    }
  }, [nodes, selectedNodeId]);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || nodes[0];
  const mapHeight = (nodes[nodes.length - 1]?.y || 160) + 120;
  const pathD = buildPath(nodes);

  return (
    <section
      className="rounded-2xl border p-3"
      style={{
        borderColor: isDark ? '#344b63' : '#d8ccbb',
        background: isDark ? 'rgba(22,33,49,0.76)' : 'rgba(255,255,255,0.75)',
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: isDark ? '#97abc6' : '#6c819a' }}>
        Vertikale Lernweltkarte
      </p>
      <p className="mb-2 text-[11px]" style={{ color: isDark ? '#9eb4ce' : '#67819d' }}>
        Infinite Scroll: je mehr gelesen wird, desto weiter waechst die Karte und neue Abzweigungen erscheinen automatisch.
      </p>

      <div ref={mapRef} className="relative h-[68vh] min-h-[480px] overflow-y-auto rounded-2xl border" style={{ borderColor: isDark ? '#3a5168' : '#d8cab9' }}>
        <div className="relative" style={{ height: `${mapHeight}px` }}>
          <svg className="pointer-events-none absolute left-0 top-0 w-full" height={mapHeight} viewBox={`0 0 100 ${mapHeight}`} preserveAspectRatio="none">
            <path d={pathD} stroke={isDark ? 'rgba(228,236,247,0.3)' : 'rgba(255,255,255,0.9)'} strokeWidth={7.5} fill="none" strokeLinecap="round" />
            <path d={pathD} stroke={isDark ? 'rgba(127,150,200,0.55)' : 'rgba(157,181,214,0.55)'} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeDasharray="7 8" />
          </svg>

          {nodes.map((node) => {
            const Icon = getNodeIcon(node.kind);
            const colors = getNodeStatusColors(node.status, isDark);
            const selected = selectedNode?.id === node.id;
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
                  boxShadow: selected ? (isDark ? '0 0 0 2px rgba(160,191,230,0.5)' : '0 0 0 2px rgba(108,138,176,0.46)') : 'none',
                }}
              >
                <div className="flex h-full flex-col items-center justify-center">
                  <Icon className="h-4 w-4" style={{ color: colors.text }} />
                  <span className="mt-1 line-clamp-2 text-[9px] font-semibold leading-tight" style={{ color: isDark ? '#e4edf9' : '#2f455d' }}>
                    {node.title}
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
        <article className="mt-2 rounded-xl border px-3 py-2" style={{ borderColor: isDark ? '#3a5168' : '#d8cab9', background: isDark ? 'rgba(21,33,48,0.86)' : 'rgba(255,251,245,0.92)' }}>
          <p className="text-[11px] uppercase tracking-[0.1em]" style={{ color: isDark ? '#97abc6' : '#6c819a' }}>
            Station Detail
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
        </article>
      )}
    </section>
  );
};

export default AvatarLearningWorldMap;
