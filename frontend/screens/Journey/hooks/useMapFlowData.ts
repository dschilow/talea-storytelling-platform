/**
 * useMapFlowData.ts
 * Transforms MapSegment[] + ProgressState into flat node/edge lists
 * with absolute positions for the scrollable map container.
 * Reuses ROAD_POINTS + pathXAtY layout logic from the original map.
 */
import { useMemo } from 'react';
import type { MapSegment, MapNode, NodeState, ProgressState } from '../TaleaLearningPathTypes';
import { computeNodeStates } from '../TaleaLearningPathSeedData';

// ─── Road path logic ────────────────────────────────────────────────────────

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

// ─── FlatNode – node with computed absolute position + state ────────────────

export interface FlatNode {
  node: MapNode;
  state: NodeState;
  segmentTitle: string;
  segmentIndex: number;
  mapY: number;
  /** x position as % of container width (7–89) */
  xPercent: number;
  nodeIndex: number;
}

// ─── Edge data ──────────────────────────────────────────────────────────────

export interface FlatEdge {
  fromNodeId: string;
  toNodeId: string;
  fromX: number; // % (same as node xPercent)
  fromY: number; // px
  toX: number;
  toY: number;
  edgeState: 'done' | 'available' | 'locked';
}

// ─── Segment label info ─────────────────────────────────────────────────────

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
  traitValues?: Record<string, number>,
) {
  return useMemo(() => {
    const flatNodes: FlatNode[] = [];
    const flatEdges: FlatEdge[] = [];
    const segmentLabels: SegmentLabel[] = [];
    const doneSet = new Set(progress.doneNodeIds);

    // Position lookup for edges
    const posMap = new Map<string, { x: number; y: number }>();

    let globalIdx = 0;
    let y = TOP_OFFSET;

    for (const seg of segments) {
      const { nodesWithState } = computeNodeStates(seg, progress, traitValues);
      const segStartY = y;
      let segDone = 0;

      for (const { node, state } of nodesWithState) {
        if (state === 'done') segDone++;

        const roadX = pathXAtY(y);
        const xPercent = clamp(roadX + (node.x - 50) * 0.16, 7, 89);

        flatNodes.push({
          node,
          state,
          segmentTitle: seg.title,
          segmentIndex: seg.index,
          mapY: y,
          xPercent,
          nodeIndex: globalIdx,
        });

        posMap.set(node.nodeId, { x: xPercent, y });
        y += NODE_SPACING;
        globalIdx++;
      }

      segmentLabels.push({
        segmentId: seg.segmentId,
        title: seg.title,
        y: segStartY - 122,
        index: seg.index,
        doneCount: segDone,
        totalCount: seg.nodes.length,
      });

      // Edges
      for (const edge of seg.edges) {
        const fromPos = posMap.get(edge.fromNodeId);
        const toPos = posMap.get(edge.toNodeId);
        if (!fromPos || !toPos) continue;

        const fromDone = doneSet.has(edge.fromNodeId);
        const toDone = doneSet.has(edge.toNodeId);
        const edgeState: 'done' | 'available' | 'locked' =
          fromDone && toDone ? 'done' : fromDone ? 'available' : 'locked';

        flatEdges.push({
          fromNodeId: edge.fromNodeId,
          toNodeId: edge.toNodeId,
          fromX: fromPos.x,
          fromY: fromPos.y,
          toX: toPos.x,
          toY: toPos.y,
          edgeState,
        });
      }

      y += SEGMENT_GAP;
    }

    const mapHeight = Math.max(
      (flatNodes[flatNodes.length - 1]?.mapY ?? TOP_OFFSET) + 420,
      MAP_TILE_HEIGHT,
    );

    return { flatNodes, flatEdges, segmentLabels, mapHeight };
  }, [segments, progress, heuteNodeIds, traitValues]);
}
