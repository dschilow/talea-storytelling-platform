/**
 * useMapFlowData.ts
 * Transforms MapSegment[] + ProgressState into flat node/edge lists
 * with absolute positions for the scrollable map container.
 */
import { useMemo } from 'react';
import type { MapSegment, MapNode, NodeState, ProgressState, RouteTag } from '../TaleaLearningPathTypes';
import { computeNodeStates } from '../TaleaLearningPathSeedData';
import { ROUTE_TO_TRAITS } from '../constants/routeTraitMapping';

interface PathPoint { y: number; x: number }

export const MAP_TILE_HEIGHT = 2048;

export const ROAD_POINTS: PathPoint[] = [
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

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const pathXAtPercent = (pct: number): number => {
  const n = clamp(pct, 0, 1);
  for (let i = 1; i < ROAD_POINTS.length; i++) {
    const l = ROAD_POINTS[i - 1];
    const r = ROAD_POINTS[i];
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
      if (i === 0 && tile === 0) {
        d += `M ${x} ${y}`;
        continue;
      }
      const prev = ROAD_POINTS[i > 0 ? i - 1 : ROAD_POINTS.length - 1];
      const prevBase = i === 0 ? (tile - 1) * MAP_TILE_HEIGHT : base;
      const py = prevBase + prev.y * MAP_TILE_HEIGHT;
      const dy = y - py;
      d += ` C ${prev.x} ${py + dy * 0.46}, ${x} ${y - dy * 0.46}, ${x} ${y}`;
    }
  }
  return d;
};

const SEGMENT_GAP = 110;
const TOP_OFFSET = 96;

export interface FlatNode {
  node: MapNode;
  state: NodeState;
  segmentTitle: string;
  segmentIndex: number;
  mapY: number;
  /** x position as % of container width (7-89) */
  xPercent: number;
  nodeIndex: number;
}

export interface FlatEdge {
  fromNodeId: string;
  toNodeId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  edgeState: 'done' | 'available' | 'locked';
}

export interface SegmentLabel {
  segmentId: string;
  title: string;
  y: number;
  index: number;
  doneCount: number;
  totalCount: number;
  dominantTraitId?: string;
  dominantTraitValue?: number;
}

export interface SegmentBlock {
  segmentId: string;
  top: number;
  height: number;
  backgroundImage: string;
}

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
    const segmentBlocks: SegmentBlock[] = [];
    const doneSet = new Set(progress.doneNodeIds);
    const posMap = new Map<string, { x: number; y: number }>();

    let globalIdx = 0;
    let y = TOP_OFFSET;

    for (const seg of segments) {
      const { nodesWithState } = computeNodeStates(seg, progress, traitValues);
      const segStartY = y;
      const segHeight = Math.max(980, seg.height ?? MAP_TILE_HEIGHT);
      let segDone = 0;

      segmentBlocks.push({
        segmentId: seg.segmentId,
        top: segStartY,
        height: segHeight,
        backgroundImage: seg.backgroundImage,
      });

      for (const { node, state } of nodesWithState) {
        if (state === 'done') segDone++;

        const yPct = clamp(node.y, 0, 100) / 100;
        const mapY = segStartY + yPct * segHeight;
        const fallbackX = pathXAtY(mapY);
        const xPercent = clamp(Number.isFinite(node.x) ? node.x : fallbackX, 7, 89);

        flatNodes.push({
          node,
          state,
          segmentTitle: seg.title,
          segmentIndex: seg.index,
          mapY,
          xPercent,
          nodeIndex: globalIdx,
        });

        posMap.set(node.nodeId, { x: xPercent, y: mapY });
        globalIdx++;
      }

      const routeCounts: Record<string, number> = {};
      for (const n of seg.nodes) {
        routeCounts[n.route] = (routeCounts[n.route] ?? 0) + 1;
      }
      const topRoute = Object.entries(routeCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] as RouteTag | undefined;
      const dominantTraitId = topRoute ? ROUTE_TO_TRAITS[topRoute]?.[0] : undefined;

      segmentLabels.push({
        segmentId: seg.segmentId,
        title: seg.title,
        y: segStartY + 28,
        index: seg.index,
        doneCount: segDone,
        totalCount: seg.nodes.length,
        dominantTraitId,
        dominantTraitValue: dominantTraitId && traitValues ? traitValues[dominantTraitId] ?? 0 : undefined,
      });

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

      y += segHeight + SEGMENT_GAP;
    }

    const mapHeight = Math.max(
      (segmentBlocks[segmentBlocks.length - 1]?.top ?? TOP_OFFSET)
      + (segmentBlocks[segmentBlocks.length - 1]?.height ?? 0)
      + 420,
      MAP_TILE_HEIGHT,
    );

    return { flatNodes, flatEdges, segmentLabels, segmentBlocks, mapHeight };
  }, [segments, progress, heuteNodeIds, traitValues]);
}

