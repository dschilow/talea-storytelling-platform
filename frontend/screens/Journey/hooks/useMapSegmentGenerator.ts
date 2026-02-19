/**
 * useMapSegmentGenerator.ts
 * Builds MapSegment[] dynamically from the user's real backend data:
 * - Dokus grouped by topic → each topic becomes a segment
 * - Memories determine "done" status
 * - Stories matched to topics
 * - Audio dokus matched by category
 * - Seed segments as fallback for new users
 */
import { useState, useEffect, useMemo } from 'react';
import { useBackend } from '../../../hooks/useBackend';
import type { MapSegment, MapNode, MapEdge, RouteTag } from '../TaleaLearningPathTypes';
import { SEED_SEGMENTS } from '../TaleaLearningPathSeedData';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DokuItem {
  id: string;
  title: string;
  topic: string;
  status: string;
  createdAt: Date | string;
  metadata?: {
    configSnapshot?: {
      perspective?: string;
      includeInteractive?: boolean;
      quizQuestions?: number;
    };
  };
}

interface StoryItem {
  id: string;
  title: string;
  status: string;
  config: {
    genre?: string;
    avatarIds?: string[];
    avatars?: Array<{ id?: string }>;
  };
  createdAt: Date | string;
}

interface MemoryItem {
  storyId: string;
  storyTitle: string;
  contentType: 'story' | 'doku' | 'quiz' | 'activity';
  personalityChanges?: Array<{ trait: string; change: number }>;
}

interface AudioDokuItem {
  id: string;
  title: string;
  category?: string;
}

export interface MapSegmentGeneratorResult {
  segments: MapSegment[];
  backendDoneNodeIds: Set<string>;
  loading: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Normalize a topic string to a URL-safe slug */
function topicSlug(topic: string): string {
  return topic
    .toLowerCase()
    .trim()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Infer a RouteTag from a topic string (keyword matching) */
function inferRouteTag(topic: string): RouteTag {
  const t = topic.toLowerCase();
  // heart: emotions, friendship, feelings
  if (/freund|gefühl|emotion|liebe|herz|zusammen|team|hilf/.test(t)) return 'heart';
  // courage: adventure, bravery, challenges
  if (/mut|abenteuer|held|kampf|stark|gefahr|herausforder/.test(t)) return 'courage';
  // creative: art, music, fantasy, imagination
  if (/kreativ|kunst|musik|fantasie|malen|bastel|erfind|traum/.test(t)) return 'creative';
  // mind: science, knowledge, learning (default)
  return 'mind';
}

/** Check if a topic string loosely matches a story genre */
function storyMatchesTopic(story: StoryItem, slug: string, topic: string): boolean {
  const t = topic.toLowerCase();
  const genre = (story.config?.genre ?? '').toLowerCase();
  const title = story.title.toLowerCase();
  // Direct slug match in genre or title
  if (genre.includes(slug) || title.includes(slug)) return true;
  // Keyword overlap
  const keywords = t.split(/[\s&,]+/).filter(w => w.length > 3);
  return keywords.some(kw => genre.includes(kw) || title.includes(kw));
}

function pickSegmentBackground(slug: string, index: number): string {
  if (/space|star|planet|astro|galaxy/.test(slug)) return '/assets/lernpfad_no_path.png';
  if (/friend|emotion|heart|team/.test(slug)) return '/assets/lernpfad_high.jpg';
  if (/weather|nature|ocean|rain|forest/.test(slug)) return '/assets/learning-world-reference.png';
  const pool = ['/assets/lernpfad_no_path.png', '/assets/lernpfad_high.jpg', '/assets/learning-world-reference.png'];
  return pool[index % pool.length];
}

function segmentHeightForNodeCount(nodeCount: number): number {
  return Math.max(1320, 860 + nodeCount * 180);
}

function storyBelongsToAvatar(story: StoryItem, avatarId: string | null): boolean {
  if (!avatarId) return true;
  const fromIds = story.config?.avatarIds ?? [];
  const fromAvatars = (story.config?.avatars ?? [])
    .map((entry) => entry.id)
    .filter((id): id is string => Boolean(id));
  const all = [...fromIds, ...fromAvatars];
  if (all.length === 0) return true;
  return all.includes(avatarId);
}

// ─── Segment Builder ────────────────────────────────────────────────────────

function buildDynamicSegments(
  dokus: DokuItem[],
  stories: StoryItem[],
  memories: MemoryItem[],
  audioDokus: AudioDokuItem[],
  maxSegments: number,
  avatarId: string | null,
): { segments: MapSegment[]; backendDoneIds: Set<string> } {
  const backendDoneIds = new Set<string>();

  // Build lookup sets from memories
  const doneDokuIds = new Set<string>();
  const doneStoryIds = new Set<string>();
  for (const mem of memories) {
    if (mem.contentType === 'doku' && mem.storyId) doneDokuIds.add(mem.storyId);
    if (mem.contentType === 'story' && mem.storyId) doneStoryIds.add(mem.storyId);
  }

  // Group dokus by normalized topic
  const topicGroups = new Map<string, { slug: string; topic: string; dokus: DokuItem[] }>();
  for (const doku of dokus) {
    if (doku.status !== 'complete') continue;
    const slug = topicSlug(doku.topic);
    if (!slug) continue;
    const existing = topicGroups.get(slug);
    if (existing) {
      existing.dokus.push(doku);
    } else {
      topicGroups.set(slug, { slug, topic: doku.topic, dokus: [doku] });
    }
  }

  // Sort groups by most recently created doku (newest first)
  const sortedGroups = [...topicGroups.values()].sort((a, b) => {
    const aMax = Math.max(...a.dokus.map(d => new Date(d.createdAt).getTime()));
    const bMax = Math.max(...b.dokus.map(d => new Date(d.createdAt).getTime()));
    return bMax - aMax;
  });

  // Build audio doku lookup by category slug
  const audioBySlug = new Map<string, AudioDokuItem>();
  for (const ad of audioDokus) {
    if (ad.category) {
      audioBySlug.set(topicSlug(ad.category), ad);
    }
  }

  const segments: MapSegment[] = [];

  for (let si = 0; si < Math.min(sortedGroups.length, maxSegments); si++) {
    const group = sortedGroups[si];
    const route = inferRouteTag(group.topic);
    const nodes: MapNode[] = [];
    const edges: MapEdge[] = [];
    let prevNodeId: string | null = null;

    // Sort dokus newest first within group
    const sortedDokus = [...group.dokus].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // DokuStop nodes — one per doku
    for (let di = 0; di < sortedDokus.length; di++) {
      const doku = sortedDokus[di];
      const nodeId = `dyn-${group.slug}-doku-${doku.id.slice(0, 8)}`;
      const isDone = doneDokuIds.has(doku.id);
      if (isDone) backendDoneIds.add(nodeId);

      // Spread nodes across the road (alternate x positions)
      const xBase = di % 2 === 0 ? 40 : 60;

      nodes.push({
        nodeId,
        type: 'DokuStop',
        route,
        title: doku.title.length > 25 ? doku.title.slice(0, 22) + '…' : doku.title,
        subtitle: `Doku: ${doku.topic}`,
        x: xBase + (di % 3) * 5,
        y: 8 + di * 16,
        unlockRule: prevNodeId ? { kind: 'prevDone', nodeId: prevNodeId } : { kind: 'always' },
        action: { type: 'navigate', to: `/doku-reader/${doku.id}` },
        rewardPreview: { stamps: 1 },
      });

      if (prevNodeId) edges.push({ fromNodeId: prevNodeId, toNodeId: nodeId });
      prevNodeId = nodeId;
    }

    // QuizStop — only if any doku in this group has quiz sections
    const hasQuiz = sortedDokus.some(d =>
      (d.metadata?.configSnapshot?.quizQuestions ?? 0) > 0 ||
      d.metadata?.configSnapshot?.includeInteractive,
    );
    if (hasQuiz && prevNodeId) {
      const quizNodeId = `dyn-${group.slug}-quiz`;
      nodes.push({
        nodeId: quizNodeId,
        type: 'QuizStop',
        route,
        title: `${group.topic} Quiz`,
        subtitle: 'Teste dein Wissen!',
        x: 35,
        y: 8 + sortedDokus.length * 16,
        unlockRule: { kind: 'prevDone', nodeId: prevNodeId },
        action: { type: 'navigate', to: '/quiz', params: { tags: group.slug } },
        rewardPreview: { stamps: 1 },
      });
      edges.push({ fromNodeId: prevNodeId, toNodeId: quizNodeId });
      prevNodeId = quizNodeId;
    }

    // StoryGate — always present
    const storyNodeId = `dyn-${group.slug}-story`;
    const matchedStory = stories.find((s) =>
      storyBelongsToAvatar(s, avatarId) && storyMatchesTopic(s, group.slug, group.topic),
    );
    if (matchedStory && doneStoryIds.has(matchedStory.id)) {
      backendDoneIds.add(storyNodeId);
    }

    const yPos = 8 + (sortedDokus.length + (hasQuiz ? 1 : 0)) * 16;
    nodes.push({
      nodeId: storyNodeId,
      type: 'StoryGate',
      route: 'creative',
      title: `${group.topic} Abenteuer`,
      subtitle: 'Lass dir eine Geschichte erzählen!',
      x: 60,
      y: yPos,
      unlockRule: prevNodeId ? { kind: 'prevDone', nodeId: prevNodeId } : { kind: 'always' },
      action: { type: 'navigate', to: '/story', params: { tags: group.slug } },
      rewardPreview: { chestPossible: true, stamps: 2, label: '🎁 Truhe' },
    });
    if (prevNodeId) edges.push({ fromNodeId: prevNodeId, toNodeId: storyNodeId });
    prevNodeId = storyNodeId;

    // MemoryFire — always
    const memNodeId = `dyn-${group.slug}-mem`;
    nodes.push({
      nodeId: memNodeId,
      type: 'MemoryFire',
      route: 'heart',
      title: 'Was habe ich gelernt?',
      subtitle: 'Reflexion ins Tagebuch',
      x: 42,
      y: yPos + 16,
      unlockRule: { kind: 'prevDone', nodeId: prevNodeId },
      action: { type: 'sheet', content: 'memory-reflection' },
      rewardPreview: { stamps: 1 },
    });
    edges.push({ fromNodeId: prevNodeId, toNodeId: memNodeId });
    prevNodeId = memNodeId;

    // StudioStage — only if matching audio doku exists
    const matchedAudio = audioBySlug.get(group.slug);
    if (matchedAudio) {
      const audioNodeId = `dyn-${group.slug}-audio`;
      nodes.push({
        nodeId: audioNodeId,
        type: 'StudioStage',
        route: 'creative',
        title: matchedAudio.title.length > 22 ? matchedAudio.title.slice(0, 19) + '…' : matchedAudio.title,
        subtitle: 'Hör dir die Folge an',
        x: 55,
        y: yPos + 32,
        unlockRule: { kind: 'prevDone', nodeId: prevNodeId },
        action: { type: 'navigate', to: '/doku', params: { mode: 'audio', tags: group.slug } },
        rewardPreview: { stamps: 1 },
      });
      edges.push({ fromNodeId: prevNodeId, toNodeId: audioNodeId });
    }

    segments.push({
      segmentId: `dyn-${group.slug}`,
      title: group.topic,
      index: si,
      backgroundImage: pickSegmentBackground(group.slug, si),
      height: segmentHeightForNodeCount(nodes.length),
      nodes,
      edges,
      themeTags: [group.slug],
    });
  }

  // "Neue Entdeckungen" segment — always at the end with suggested topics
  const suggestedTopics = ['Dinosaurier', 'Ozean & Meer', 'Roboter & KI'];
  const existingSlugs = new Set(sortedGroups.map(g => g.slug));
  const newTopics = suggestedTopics.filter(t => !existingSlugs.has(topicSlug(t)));

  if (newTopics.length > 0) {
    const suggestNodes: MapNode[] = [];
    const suggestEdges: MapEdge[] = [];
    let prevId: string | null = null;

    for (let i = 0; i < newTopics.length; i++) {
      const topic = newTopics[i];
      const slug = topicSlug(topic);
      const nodeId = `dyn-suggest-${slug}`;
      suggestNodes.push({
        nodeId,
        type: 'DokuStop',
        route: inferRouteTag(topic),
        title: topic,
        subtitle: 'Neues Thema entdecken!',
        x: i % 2 === 0 ? 45 : 55,
        y: 8 + i * 18,
        unlockRule: { kind: 'always' },
        action: { type: 'navigate', to: '/doku/create', params: { topicTags: slug } },
        rewardPreview: { stamps: 1 },
      });
      if (prevId) suggestEdges.push({ fromNodeId: prevId, toNodeId: nodeId });
      prevId = nodeId;
    }

    segments.push({
      segmentId: 'dyn-suggestions',
      title: 'Neue Entdeckungen',
      index: segments.length,
      backgroundImage: '/assets/lernpfad.png',
      height: segmentHeightForNodeCount(suggestNodes.length),
      nodes: suggestNodes,
      edges: suggestEdges,
      themeTags: ['suggestions'],
    });
  }

  return { segments, backendDoneIds };
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useMapSegmentGenerator(
  avatarId: string | null,
  visibleSegmentCount: number = 6,
): MapSegmentGeneratorResult {
  const backend = useBackend();
  const [dokus, setDokus] = useState<DokuItem[]>([]);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [audioDokus, setAudioDokus] = useState<AudioDokuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      try {
        const [dokuRes, storyRes, memRes, audioRes] = await Promise.all([
          backend.doku.listDokus({ limit: 100, offset: 0 }).catch(() => ({ dokus: [] })),
          backend.story.list({ limit: 100, offset: 0 }).catch(() => ({ stories: [] })),
          avatarId
            ? backend.avatar.getMemories({ id: avatarId }).catch(() => ({ memories: [] }))
            : Promise.resolve({ memories: [] }),
          backend.doku.listAudioDokus({ limit: 50, offset: 0 }).catch(() => ({ audioDokus: [] })),
        ]);

        if (cancelled) return;

        setDokus((dokuRes as any).dokus ?? []);
        setStories((storyRes as any).stories ?? []);
        setMemories((memRes as any).memories ?? []);
        setAudioDokus((audioRes as any).audioDokus ?? []);
      } catch (err) {
        console.warn('[useMapSegmentGenerator] Failed to fetch data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [backend, avatarId]);

  return useMemo(() => {
    // If still loading, return seed segments as skeleton
    if (loading) {
      return { segments: SEED_SEGMENTS, backendDoneNodeIds: new Set<string>(), loading: true };
    }

    // If user has no content at all, use seed segments
    const completeDokus = dokus.filter(d => (d as any).status === 'complete');
    if (completeDokus.length === 0 && stories.length === 0) {
      return { segments: SEED_SEGMENTS, backendDoneNodeIds: new Set<string>(), loading: false };
    }

    // Build dynamic segments from real data
    const { segments, backendDoneIds } = buildDynamicSegments(
      completeDokus,
      stories,
      memories,
      audioDokus,
      visibleSegmentCount,
      avatarId,
    );

    return { segments, backendDoneNodeIds: backendDoneIds, loading: false };
  }, [dokus, stories, memories, audioDokus, loading, visibleSegmentCount, avatarId]);
}
