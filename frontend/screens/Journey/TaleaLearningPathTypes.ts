/**
 * TaleaLearningPathTypes.ts  –  Phase A/B
 */

export type NodeType =
  | 'DokuStop'
  | 'QuizStop'
  | 'StoryGate'
  | 'StudioStage'
  | 'MemoryFire'
  | 'Fork';

export type RouteTag = 'heart' | 'mind' | 'courage' | 'creative';
export type NodeState = 'locked' | 'available' | 'done';

export type UnlockRule =
  | { kind: 'always' }
  | { kind: 'prevDone';   nodeId: string }
  | { kind: 'quizScore';  quizId: string; minCorrect: number }
  | { kind: 'hasArtifact'; artifactId: string }
  | { kind: 'doneCount';  segment: string; min: number };

export type NodeAction =
  | { type: 'navigate'; to: string; params?: Record<string, string> }
  | { type: 'sheet';    content: string }
  | { type: 'fork';     options: ForkOption[] };

export interface ForkOption {
  id: string;
  label: string;
  icon: string;
  routeTag: RouteTag;
  nextSegmentId: string;
}

export interface RewardPreview {
  chestPossible?: boolean;
  stamps?: number;
  label?: string;
}

export interface MapNode {
  nodeId: string;
  type: NodeType;
  route: RouteTag;
  title: string;
  subtitle: string;
  /** x 0–100 relativ zur Segment-Breite */
  x: number;
  /** y 0–100 relativ zur Segment-Höhe */
  y: number;
  unlockRule: UnlockRule;
  action: NodeAction;
  rewardPreview?: RewardPreview;
}

export interface MapEdge {
  fromNodeId: string;
  toNodeId: string;
  style?: 'default' | 'branch' | 'highlight';
}

export interface MapSegment {
  segmentId: string;
  title: string;
  index: number;
  nodes: MapNode[];
  edges: MapEdge[];
  themeTags: string[];
  recommendedDailyStops?: string[];
}

export interface ProgressState {
  doneNodeIds: string[];
  inventoryArtifacts: Array<{ id: string; rarity: 'common' | 'rare' | 'epic' }>;
  stampsByTag: Partial<Record<RouteTag, number>>;
  lastActiveNodeId: string | null;
  dailySuggestedNodeIds: string[];
  quizResultsById: Record<string, { correctCount: number; totalCount: number }>;
}

