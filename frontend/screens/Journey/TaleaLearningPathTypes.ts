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

// ─── Progress & State Types ─────────────────────────────────────────────────

export type NodeState = 'locked' | 'available' | 'done' | 'echo';

export type UnlockRule =
  | { kind: 'always' }
  | { kind: 'prevDone'; nodeId: string }
  | { kind: 'quizScore'; quizId: string; minCorrect: number }
  | { kind: 'hasArtifact'; artifactId: string }
  | { kind: 'doneCount'; segment: string; min: number }
  | { kind: 'traitMinimum'; traitId: string; minValue: number };

export type NodeAction =
  | { type: 'navigate'; to: string; params?: Record<string, string> }
  | { type: 'sheet'; content: string }
  | { type: 'fork'; options: ForkOption[] };

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
  x: number;             // X percentage (0-100)
  y: number;             // local Y inside the segment (px)
  unlockRule: UnlockRule;
  action: NodeAction;
  rewardPreview?: RewardPreview;
  isEcho?: boolean;      // NEW: Flag for dynamically generated follow-up nodes (Echo-Loop)
}

export interface MapEdge {
  fromNodeId: string;
  toNodeId: string;
  style?: 'default' | 'branch' | 'highlight' | 'echo';
}

export interface MapSegment {
  segmentId: string;
  title: string;
  index: number;
  /** Background image for this segment tile */
  backgroundImage: string;
  /** Segment height in px */
  height: number;
  nodes: MapNode[];
  edges: MapEdge[];
  themeTags: string[];
  recommendedDailyStops?: string[];
}

export interface PendingNodeAction {
  nodeId: string;
  nodeType: NodeType;
  startedAt: number;
}

export interface ForkSelection {
  optionId: string;
  nextSegmentId: string;
  selectedAt: number;
}

export interface ProgressState {
  doneNodeIds: string[];
  inventoryArtifacts: Array<{ id: string; rarity: 'common' | 'rare' | 'epic' }>;
  stampsByTag: Partial<Record<RouteTag, number>>;
  lastActiveNodeId: string | null;
  dailySuggestedNodeIds: string[];
  quizResultsById: Record<string, { correctCount: number; totalCount: number }>;
  pendingNodeActions: PendingNodeAction[];
  forkSelectionsByNodeId: Record<string, ForkSelection>;
}

