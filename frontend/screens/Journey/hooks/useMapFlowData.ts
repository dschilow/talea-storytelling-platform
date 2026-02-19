/**
 * useMapFlowData.ts
 * Transforms MapSegment[] + ProgressState into React Flow nodes/edges.
 * Reuses ROAD_POINTS + pathXAtY layout logic from the original map.
 */
import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { MapSegment, MapNode, NodeState, ProgressState, NodeType, RouteTag } from '../TaleaLearningPathTypes';
import { computeNodeStates } from '../TaleaLearningPathSeedData';

// ─── Road path logic (from original TaleaLearningPathMapView) ───────────────

interface PathPoint { y: number; x: number }

export const MAP_TILE_HEIGHT = 2048;

export const ROAD_POINTS: PathPoint[] = [
  { y: 0,     x: 61 },
  { y: 0.045, x: 52 },
  { y: 0.09,  x: 40 },
  { y: 0.14,  x: 33 },
  { y: 0.19,  x: 45 },
  { y: 0.24,  x: 60 },
  { y: 0.29,  x: 67 },
  { y: 0.34,  x: 57 },
  { y: 0.39,  x: 44 },
  { y: 0.44,  x: 33 },
  { y: 0.49,  x: 31 },
  { y: 0.54,  x: 43 },
  { y: 0.59,  x: 58 },
  { y: 0.64,  x: 66 },
  { y: 0.69,  x: 57 },
  { y: 0.74,  x: 45 },
  { y: 0.79,  x: 34 },
  { y: 0.84,  x: 33 },
  { y: 0.89,  x: 47 },
  { y: 0.94,  x: 61 },
  { y: 1,     x: 57 },
];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const pathXAtPercent = (pct: number): number => {
  const n = clamp(pct, 0, 1);
  for (let i = 1; i < ROAD_POINTS.length; i++) {
    const l = ROAD_POINTS[i - 1], r = ROAD_POINTS[i];
    if (n <= r.y) {
      const seg = Math.max(0.0001, r.y - l.y);
      const t = clamp((n - l.y) / seg, 0, 1);
      return l.x + (r.x - l.x) * t;
    }
  }
  return ROAD_POINTS[ROAD_POINTS.length - 1].x;
};

const pathXAtY = (y: number): number => {
  const local = ((y % MAP_TILE_HEIGHT) + MAP_TILE_HEIGHT) % MAP_TILE_HEIGHT;
  return pathXAtPercent(local / MAP_TILE_HEIGHT);
};

export const buildRoadPath = (mapHeight: number): string => {
  if (mapHeight <= 0) return '';
  const tiles = Math.ceil(mapHeight / MAP_TILE_HEIGHT) + 1;
  let d = '';
  for (let tile = 0; tile < tiles; tile++) {
    const base = tile * MAP_TILE_HEIGHT;
    for (let i = 0; i < ROAD_POINTS.length; i++) {
      const pt = ROAD_POINTS[i];
      const x = pt.x;
      const y = base + pt.y * MAP_TILE_HEIGHT;
      if (i === 0 && tile === 0) { d += `M ${x} ${y}`; continue; }
      const prev = ROAD_POINTS[i > 0 ? i - 1 : ROAD_POINTS.length - 1];
      const prevBase = i === 0 ? (tile - 1) * MAP_TILE_HEIGHT : base;
      const py = prevBase + prev.y * MAP_TILE_HEIGHT;
      const dy = y - py;
      d += ` C ${prev.x} ${py + dy * 0.46}, ${x} ${y - dy * 0.46}, ${x} ${y}`;
    }
  }
  return d;
};

// ─── Layout constants ───────────────────────────────────────────────────────

const NODE_SPACING = 190;
const SEGMENT_GAP  = 260;
const TOP_OFFSET   = 160;
// React Flow uses pixel positions; we use a virtual canvas width of 600px
// to convert the % x-positions into absolute coordinates
const CANVAS_WIDTH = 600;
const NODE_SIZE    = 88;

// ─── Node data payload for custom GameMapNode ───────────────────────────────

export interface GameNodeData {
  mapNode: MapNode;
  state: NodeState;
  segmentTitle: string;
  segmentIndex: number;
  isLastActive: boolean;
  isHeuteHighlighted: boolean;
  nodeIndex: number;
  [key: string]: unknown;
}

export type GameFlowNode = Node<GameNodeData, 'gameNode'>;

export interface GameEdgeData {
  edgeState: 'done' | 'available' | 'locked';
  [key: string]: unknown;
}

export type GameFlowEdge = Edge<GameEdgeData>;

// ─── Segment info for labels ────────────────────────────────────────────────

export interface SegmentLabel {
  segmentId: string;
  title: string;
  y: number;
  index: number;
  doneCount: number;
  totalCount: number;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useMapFlowData(
  segments: MapSegment[],
  progress: ProgressState,
  heuteNodeIds: Set<string>,
) {
  return useMemo(() => {
    const nodes: GameFlowNode[] = [];
    const edges: GameFlowEdge[] = [];
    const segmentLabels: SegmentLabel[] = [];
    const doneSet = new Set(progress.doneNodeIds);
    let globalIdx = 0;
    let y = TOP_OFFSET;

    for (const seg of segments) {
      const { nodesWithState } = computeNodeStates(seg, progress);
      const segStartY = y;

      let segDone = 0;
      for (const { node, state } of nodesWithState) {
        if (state === 'done') segDone++;
        const roadXPct = pathXAtY(y);
        const rawXPct = clamp(roadXPct + (node.x - 50) * 0.16, 7, 89);
        const pixelX = (rawXPct / 100) * CANVAS_WIDTH - NODE_SIZE / 2;

        nodes.push({
          id: node.nodeId,
          type: 'gameNode',
          position: { x: pixelX, y },
          data: {
            mapNode: node,
            state,
            segmentTitle: seg.title,
            segmentIndex: seg.index,
            isLastActive: progress.lastActiveNodeId === node.nodeId,
            isHeuteHighlighted: heuteNodeIds.has(node.nodeId),
            nodeIndex: globalIdx,
          },
          draggable: false,
          selectable: false,
          connectable: false,
        });

        y += NODE_SPACING;
        globalIdx++;
      }

      segmentLabels.push({
        segmentId: seg.segmentId,
        title: seg.title,
        y: segStartY - 100,
        index: seg.index,
        doneCount: segDone,
        totalCount: seg.nodes.length,
      });

      // Edges
      for (const edge of seg.edges) {
        const fromDone = doneSet.has(edge.fromNodeId);
        const toDone = doneSet.has(edge.toNodeId);
        const edgeState: 'done' | 'available' | 'locked' =
          fromDone && toDone ? 'done' : fromDone ? 'available' : 'locked';

        edges.push({
          id: `e-${edge.fromNodeId}-${edge.toNodeId}`,
          source: edge.fromNodeId,
          target: edge.toNodeId,
          type: 'gamePath',
          data: { edgeState },
        });
      }

      y += SEGMENT_GAP;
    }

    const mapHeight = Math.max(y + 200, MAP_TILE_HEIGHT);

    return { nodes, edges, segmentLabels, mapHeight };
  }, [segments, progress, heuteNodeIds]);
}
